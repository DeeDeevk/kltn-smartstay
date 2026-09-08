import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository, SelectQueryBuilder } from 'typeorm';
import Redis from 'ioredis';
import { Booking } from './entities/booking.entity';
import { BookingServiceItem } from './entities/booking-service-item.entity';
import { CreateBookingDto } from './dto/create-booking.dto';
import { CreateWalkInBookingDto } from './dto/create-walk-in-booking.dto';
import { QueryBookingDto } from './dto/query-booking.dto';
import { QueryMyBookingDto } from './dto/query-my-booking.dto';
import { CheckInDto } from './dto/check-in.dto';
import { CheckOutDto } from './dto/check-out.dto';
import { AddServiceDto } from './dto/add-service.dto';
import { CancelBookingDto } from './dto/cancel-booking.dto';
import { Room } from 'src/rooms/entities/room.entity';
import { RoomStatus } from 'src/common/enums/room-status.enum';
import { BookingStatus } from 'src/common/enums/booking-status.enum';
import { PaymentMethod } from 'src/common/enums/payment-method.enum';
import { PaymentStatus } from 'src/common/enums/payment-status.enum';
import { UserRole } from 'src/common/enums/user-role.enum';
import { RoomTypeService } from 'src/room-types/room-type.service';
import { ServiceService } from 'src/services/service.service';
import { PromotionService } from 'src/promotions/promotion.service';
import { UserService } from 'src/users/user.service';
import { REDIS_CLIENT } from 'src/redis/redis.module';

const LOCK_TTL_MS = 5000;
// Thuế GTGT áp dụng cho dịch vụ lưu trú tại Việt Nam — chỉ tính trên tiền phòng, không
// tính trên dịch vụ đi kèm (đồ ăn, giặt ủi... đã có mức thuế/giá riêng).
const VAT_RATE = 0.08;
// Giờ trả phòng tiêu chuẩn: quá 12h trưa ngày check-out thì tính thêm đêm lưu trú.
const CHECKOUT_DEADLINE_HOUR = 12;
// Việt Nam không có giờ mùa hè, lệch cố định UTC+7 quanh năm — dùng để quy đổi "12h trưa
// giờ Việt Nam" ra mốc UTC tuyệt đối, độc lập với timezone của server chạy backend.
const VIETNAM_UTC_OFFSET_HOURS = 7;

interface Requester {
  userId: string;
  role: string;
}

@Injectable()
export class BookingService {
  constructor(
    @InjectRepository(Booking)
    private readonly bookingRepo: Repository<Booking>,
    @InjectRepository(BookingServiceItem)
    private readonly bookingServiceItemRepo: Repository<BookingServiceItem>,
    @InjectRepository(Room)
    private readonly roomRepo: Repository<Room>,
    @Inject(REDIS_CLIENT) private readonly redisClient: Redis,
    private readonly roomTypeService: RoomTypeService,
    private readonly serviceService: ServiceService,
    private readonly promotionService: PromotionService,
    private readonly userService: UserService,
  ) {}

  async create(userId: string, dto: CreateBookingDto) {
    if (new Date(dto.checkIn) >= new Date(dto.checkOut)) {
      throw new BadRequestException('Ngày check-in phải trước ngày check-out');
    }

    const roomType = await this.roomTypeService.findActiveById(dto.roomTypeId);
    const user = await this.userService.findById(userId);
    const stayDates = this.getStayDates(dto.checkIn, dto.checkOut);

    const lockKeys = await this.acquireLocks(dto.roomTypeId, stayDates);
    try {
      const totalRooms = await this.roomRepo.count({
        where: { roomType: { roomTypeId: dto.roomTypeId } },
      });
      const overlapping = await this.countOverlappingBookings(
        dto.roomTypeId,
        dto.checkIn,
        dto.checkOut,
      );
      if (overlapping >= totalRooms) {
        throw new ConflictException(
          'Loại phòng đã hết trong khoảng ngày đã chọn',
        );
      }

      const extraServices = dto.extraServiceIds?.length
        ? await this.serviceService.findActiveByIds(dto.extraServiceIds)
        : [];
      if (extraServices.length !== (dto.extraServiceIds?.length ?? 0)) {
        throw new BadRequestException(
          'Một số dịch vụ đi kèm không tồn tại hoặc đã ngưng cung cấp',
        );
      }

      const nights = stayDates.length;
      const roomAmount = roomType.basePrice * nights;
      const serviceAmount = extraServices.reduce(
        (sum, service) => sum + service.price,
        0,
      );

      let promotionId: string | null = null;
      let discountAmount = 0;
      if (dto.promotionCode) {
        const result = await this.promotionService.validateCode(
          dto.promotionCode,
          roomAmount + serviceAmount,
        );
        promotionId = result.promotion.promotionId;
        discountAmount = result.discountAmount;
      }

      const paymentMethod = dto.paymentMethod ?? PaymentMethod.CASH;
      const payosOrderCode =
        paymentMethod === PaymentMethod.PAYOS
          ? String(Date.now())
          : null;

      const booking = this.bookingRepo.create({
        user,
        roomType,
        room: null,
        checkInDate: dto.checkIn,
        checkOutDate: dto.checkOut,
        guestInfo: dto.guestInfo,
        promotion: promotionId ? { promotionId } : null,
        discountAmount,
        roomAmount,
        status: BookingStatus.PENDING,
        paymentMethod,
        paymentStatus: PaymentStatus.UNPAID,
        payosOrderCode,
      } as Partial<Booking>);
      const saved = await this.bookingRepo.save(booking);

      if (extraServices.length > 0) {
        const items = extraServices.map((service) =>
          this.bookingServiceItemRepo.create({
            booking: saved,
            service,
            quantity: 1,
            unitPrice: service.price,
          }),
        );
        await this.bookingServiceItemRepo.save(items);
      }

      if (promotionId) {
        await this.promotionService.incrementUsage(promotionId);
      }

      return this.toDetailResponse(await this.findByIdRaw(saved.bookingId));
    } finally {
      await this.releaseLocks(lockKeys);
    }
  }

  // Lễ tân tạo đơn cho khách vãng lai ngay tại quầy, gắn thẳng 1 phòng vật lý.
  // Đơn được tạo ở trạng thái CONFIRMED (đã xác nhận, chờ check-in). Người đăng nhập
  // (staff) được lưu vào booking.user vì khách vãng lai không có tài khoản.
  async createWalkIn(staffUserId: string, dto: CreateWalkInBookingDto) {
    if (new Date(dto.checkIn) >= new Date(dto.checkOut)) {
      throw new BadRequestException('Ngày check-in phải trước ngày check-out');
    }

    const room = await this.roomRepo.findOne({ where: { roomId: dto.roomId } });
    if (!room) {
      throw new NotFoundException('Không tìm thấy phòng');
    }
    if (room.status === RoomStatus.MAINTENANCE) {
      throw new BadRequestException('Phòng đang bảo trì, không thể nhận khách');
    }

    const staff = await this.userService.findById(staffUserId);
    const stayDates = this.getStayDates(dto.checkIn, dto.checkOut);
    const lockKeys = await this.acquireLocks(`room:${dto.roomId}`, stayDates);
    try {
      const overlapping = await this.bookingRepo
        .createQueryBuilder('booking')
        .innerJoin('booking.room', 'bookedRoom')
        .where('bookedRoom.roomId = :roomId', { roomId: dto.roomId })
        .andWhere('booking.status IN (:...statuses)', {
          statuses: [
            BookingStatus.PENDING,
            BookingStatus.CONFIRMED,
            BookingStatus.CHECKED_IN,
          ],
        })
        .andWhere('booking.checkInDate < :checkOut', { checkOut: dto.checkOut })
        .andWhere('booking.checkOutDate > :checkIn', { checkIn: dto.checkIn })
        .getCount();
      if (overlapping > 0) {
        throw new ConflictException(
          'Phòng đã có lịch đặt giao với khoảng ngày này',
        );
      }

      const extraServices = dto.extraServiceIds?.length
        ? await this.serviceService.findActiveByIds(dto.extraServiceIds)
        : [];
      if (extraServices.length !== (dto.extraServiceIds?.length ?? 0)) {
        throw new BadRequestException(
          'Một số dịch vụ đi kèm không tồn tại hoặc đã ngưng cung cấp',
        );
      }

      const nights = stayDates.length;
      const roomAmount = room.roomType.basePrice * nights;

      const booking = this.bookingRepo.create({
        user: staff,
        roomType: room.roomType,
        room,
        checkInDate: dto.checkIn,
        checkOutDate: dto.checkOut,
        guestInfo: dto.guestInfo,
        promotion: null,
        discountAmount: 0,
        roomAmount,
        status: BookingStatus.CONFIRMED,
        paymentMethod: dto.paymentMethod ?? PaymentMethod.CASH,
        paymentStatus: PaymentStatus.UNPAID,
        payosOrderCode: null,
      } as Partial<Booking>);
      const saved = await this.bookingRepo.save(booking);

      if (extraServices.length > 0) {
        await this.bookingServiceItemRepo.save(
          extraServices.map((service) =>
            this.bookingServiceItemRepo.create({
              booking: saved,
              service,
              quantity: 1,
              unitPrice: service.price,
            }),
          ),
        );
      }

      return this.toDetailResponse(await this.findByIdRaw(saved.bookingId));
    } finally {
      await this.releaseLocks(lockKeys);
    }
  }

  async findAll(query: QueryBookingDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const qb = this.filterQuery();

    if (query.status) {
      qb.andWhere('booking.status = :status', { status: query.status });
    }
    if (query.statuses?.trim()) {
      const list = query.statuses
        .split(',')
        .map((s) => s.trim())
        .filter((s): s is BookingStatus =>
          (Object.values(BookingStatus) as string[]).includes(s),
        );
      if (list.length > 0) {
        qb.andWhere('booking.status IN (:...statusList)', { statusList: list });
      }
    }
    if (query.roomId) {
      qb.andWhere('room.roomId = :roomId', { roomId: query.roomId });
    }
    if (query.assignableRoomId) {
      const target = await this.roomRepo.findOne({
        where: { roomId: query.assignableRoomId },
      });
      if (!target) {
        throw new NotFoundException('Không tìm thấy phòng');
      }
      qb.andWhere(
        new Brackets((w) => {
          w.where('room.roomId = :assignRoomId', {
            assignRoomId: query.assignableRoomId,
          }).orWhere(
            new Brackets((inner) => {
              inner
                .where('room.roomId IS NULL')
                .andWhere('roomType.roomTypeId = :assignRoomTypeId', {
                  assignRoomTypeId: target.roomType.roomTypeId,
                })
                .andWhere('booking.status IN (:...assignStatuses)', {
                  assignStatuses: [
                    BookingStatus.PENDING,
                    BookingStatus.CONFIRMED,
                  ],
                });
            }),
          );
        }),
      );
    }
    if (query.checkIn) {
      qb.andWhere('booking.checkInDate >= :checkIn', {
        checkIn: query.checkIn,
      });
    }
    if (query.checkOut) {
      qb.andWhere('booking.checkOutDate <= :checkOut', {
        checkOut: query.checkOut,
      });
    }
    if (query.search?.trim()) {
      // Mã đơn hiển thị = 8 ký tự đầu UUID (viết hoa) -> so khớp prefix, bỏ tiền tố "BK-".
      const raw = query.search.trim();
      const codePrefix = raw.replace(/^bk-/i, '').toLowerCase();
      qb.andWhere(
        new Brackets((w) => {
          w.where('CAST(booking.bookingId AS TEXT) ILIKE :codePrefix', {
            codePrefix: `${codePrefix}%`,
          })
            .orWhere("booking.guestInfo->>'fullName' ILIKE :kw", {
              kw: `%${raw}%`,
            })
            .orWhere("booking.guestInfo->>'email' ILIKE :kw", {
              kw: `%${raw}%`,
            });
        }),
      );
    }

    return this.paginate(qb, page, limit);
  }

  async findMyBookings(userId: string, query: QueryMyBookingDto) {
    const page = query.page ?? 1;
    const limit = 10;
    const qb = this.filterQuery().where('user.userId = :userId', { userId });

    if (query.status) {
      qb.andWhere('booking.status = :status', { status: query.status });
    }

    return this.paginate(qb, page, limit);
  }

  async findById(bookingId: string, requester: Requester) {
    const booking = await this.findByIdRaw(bookingId);
    this.assertCanView(booking, requester);
    return this.toDetailResponse(booking);
  }

  async confirm(bookingId: string) {
    const booking = await this.findByIdRaw(bookingId);
    if (booking.status !== BookingStatus.PENDING) {
      throw new BadRequestException('Đơn không ở trạng thái chờ xác nhận');
    }
    booking.status = BookingStatus.CONFIRMED;
    await this.bookingRepo.save(booking);
    return this.toDetailResponse(booking);
  }

  async checkIn(bookingId: string, dto: CheckInDto) {
    const booking = await this.findByIdRaw(bookingId);
    if (booking.status !== BookingStatus.CONFIRMED) {
      throw new BadRequestException(
        'Đơn phải ở trạng thái đã xác nhận trước khi check-in',
      );
    }

    const room = await this.roomRepo.findOne({
      where: { roomId: dto.roomId },
    });
    if (!room) {
      throw new NotFoundException('Không tìm thấy phòng');
    }
    if (room.roomType.roomTypeId !== booking.roomType.roomTypeId) {
      throw new BadRequestException('Phòng không thuộc loại phòng của đơn đặt');
    }
    if (room.status !== RoomStatus.AVAILABLE) {
      throw new BadRequestException('Phòng không sẵn sàng');
    }

    room.status = RoomStatus.OCCUPIED;
    await this.roomRepo.save(room);

    booking.room = room;
    booking.status = BookingStatus.CHECKED_IN;
    // Đơn CASH được lễ tân thu tiền mặt trực tiếp ngay lúc check-in (khác đơn PayOS đã
    // có luồng xác nhận thanh toán riêng qua webhook/sync) — đánh dấu đã thanh toán luôn.
    if (
      booking.paymentMethod === PaymentMethod.CASH &&
      booking.paymentStatus !== PaymentStatus.PAID
    ) {
      booking.paymentStatus = PaymentStatus.PAID;
      booking.paidAmount = this.toDetailResponse(booking).totalAmount;
    }
    await this.bookingRepo.save(booking);

    return this.toDetailResponse(booking);
  }

  // Toàn bộ thao tác ghi (thêm dịch vụ, chốt phụ thu trả muộn, đổi trạng thái đơn,
  // đổi trạng thái phòng) được gộp trong 1 transaction — trước đây là các lệnh save()
  // rời rạc, lỗi/crash giữa chừng có thể để lại đơn CHECKED_OUT nhưng phòng vẫn OCCUPIED
  // (hoặc ngược lại), sai lệch vĩnh viễn giữa Sơ đồ phòng và trạng thái đơn thật.
  async checkOut(bookingId: string, dto: CheckOutDto = {}) {
    return this.bookingRepo.manager.transaction(async (manager) => {
      const bookingRepo = manager.getRepository(Booking);
      const roomRepo = manager.getRepository(Room);

      const booking = await bookingRepo.findOne({ where: { bookingId } });
      if (!booking) {
        throw new NotFoundException('Không tìm thấy đơn đặt phòng');
      }
      if (booking.status !== BookingStatus.CHECKED_IN) {
        throw new BadRequestException(
          'Đơn phải ở trạng thái đang lưu trú trước khi check-out',
        );
      }

      // Ghi nhận dịch vụ / minibar khách tiêu dùng thêm ngay lúc trả phòng.
      if (dto.extraServices?.length) {
        const ids = dto.extraServices.map((item) => item.serviceId);
        const services = await this.serviceService.findActiveByIds(ids);
        const byId = new Map(services.map((s) => [s.serviceId, s]));
        if (services.length !== new Set(ids).size) {
          throw new BadRequestException(
            'Một số dịch vụ không tồn tại hoặc đã ngưng cung cấp',
          );
        }
        const serviceItemRepo = manager.getRepository(BookingServiceItem);
        const newItems = await serviceItemRepo.save(
          dto.extraServices.map((item) =>
            serviceItemRepo.create({
              booking,
              service: byId.get(item.serviceId),
              quantity: item.quantity,
              unitPrice: byId.get(item.serviceId)!.price,
            }),
          ),
        );
        // Cập nhật thẳng vào bộ nhớ để toDetailResponse() bên dưới tính đúng ngay,
        // khỏi phải load lại từ DB.
        booking.serviceItems = [...booking.serviceItems, ...newItems];
      }

      // Chốt phụ thu trả phòng muộn tại thời điểm này.
      const late = this.computeLateCheckout(booking);
      booking.lateNights = late.nights;
      booking.lateCheckoutFee = late.fee;
      booking.status = BookingStatus.CHECKED_OUT;

      if (dto.markPaid) {
        booking.paymentStatus = PaymentStatus.PAID;
        booking.paidAmount = this.toDetailResponse(booking).totalAmount;
        if (dto.paymentMethod) {
          booking.paymentMethod = dto.paymentMethod;
        }
      }
      await bookingRepo.save(booking);

      if (booking.room) {
        booking.room.status = RoomStatus.CLEANING;
        await roomRepo.save(booking.room);
      }

      const finalDetail = this.toDetailResponse(booking);
      return {
        booking: finalDetail,
        finalInvoice: {
          roomAmount: booking.roomAmount,
          lateNights: late.nights,
          lateCheckoutFee: late.fee,
          serviceAmount: finalDetail.serviceAmount,
          discountAmount: booking.discountAmount,
          vatAmount: finalDetail.vatAmount,
          totalAmount: finalDetail.totalAmount,
          paidAmount: finalDetail.paidAmount,
          dueAmount: finalDetail.dueAmount,
        },
      };
    });
  }

  async addService(bookingId: string, dto: AddServiceDto) {
    const booking = await this.findByIdRaw(bookingId);
    if (booking.status !== BookingStatus.CHECKED_IN) {
      throw new BadRequestException(
        'Chỉ có thể thêm dịch vụ khi khách đang lưu trú',
      );
    }

    const service = await this.serviceService.findActiveById(dto.serviceId);
    const item = this.bookingServiceItemRepo.create({
      booking,
      service,
      quantity: dto.quantity,
      unitPrice: service.price,
    });
    await this.bookingServiceItemRepo.save(item);

    return this.toDetailResponse(await this.findByIdRaw(bookingId));
  }

  async cancel(bookingId: string, requester: Requester, dto: CancelBookingDto) {
    const booking = await this.findByIdRaw(bookingId);
    this.assertCanView(booking, requester);

    if (
      booking.status !== BookingStatus.PENDING &&
      booking.status !== BookingStatus.CONFIRMED
    ) {
      throw new BadRequestException('Không thể huỷ đơn ở trạng thái hiện tại');
    }

    booking.status = BookingStatus.CANCELLED;
    booking.cancelReason = dto.reason;
    await this.bookingRepo.save(booking);

    if (booking.room) {
      booking.room.status = RoomStatus.AVAILABLE;
      await this.roomRepo.save(booking.room);
    }

    return { message: 'Đã huỷ đơn đặt phòng' };
  }

  // Dùng chung bởi webhook PayOS và endpoint đồng bộ trạng thái thủ công
  // (localhost không nhận được webhook thật từ PayOS nên PaymentService gọi
  // trực tiếp payos.paymentRequests.get() rồi gọi lại hàm này để cập nhật).
  async markPaidByOrderCode(orderCode: number): Promise<Booking | null> {
    const booking = await this.bookingRepo.findOne({
      where: { payosOrderCode: String(orderCode) },
    });
    if (!booking) return null;
    if (booking.paymentStatus === PaymentStatus.PAID) return booking;

    booking.paymentStatus = PaymentStatus.PAID;
    booking.paidAmount = this.toDetailResponse(booking).totalAmount;
    if (booking.status === BookingStatus.PENDING) {
      booking.status = BookingStatus.CONFIRMED;
    }
    return this.bookingRepo.save(booking);
  }

  // Gọi khi PayOS báo giao dịch đã kết thúc mà không thành công (CANCELLED/EXPIRED/FAILED)
  // — không đổi BookingStatus (đơn vẫn giữ chỗ PENDING), chỉ đánh dấu để FE hiển thị
  // "thanh toán thất bại" và cho phép tạo lại link thanh toán mới cho cùng booking.
  async markFailedByOrderCode(orderCode: number): Promise<Booking | null> {
    const booking = await this.bookingRepo.findOne({
      where: { payosOrderCode: String(orderCode) },
    });
    if (!booking) return null;
    if (booking.paymentStatus === PaymentStatus.PAID) return booking;

    booking.paymentStatus = PaymentStatus.FAILED;
    return this.bookingRepo.save(booking);
  }

  private assertCanView(booking: Booking, requester: Requester): void {
    const isOwner = booking.user.userId === requester.userId;
    const role = requester.role as UserRole;
    const isStaffOrAdmin = role === UserRole.STAFF || role === UserRole.ADMIN;
    if (!isOwner && !isStaffOrAdmin) {
      throw new ForbiddenException(
        'Bạn không có quyền thao tác trên đơn đặt phòng này',
      );
    }
  }

  private toDetailResponse(booking: Booking) {
    const serviceAmount = booking.serviceItems.reduce(
      (sum, item) => sum + item.unitPrice * item.quantity,
      0,
    );
    // Thuế GTGT 8% tính trên tiền phòng (gồm phụ thu trả muộn) sau khuyến mãi,
    // không áp dụng cho dịch vụ đi kèm.
    const netRoomAmount =
      booking.roomAmount + booking.lateCheckoutFee - booking.discountAmount;
    const vatAmount = Math.round(netRoomAmount * VAT_RATE);
    const totalAmount = netRoomAmount + serviceAmount + vatAmount;
    const dueAmount = Math.max(0, totalAmount - booking.paidAmount);
    return {
      ...booking,
      serviceAmount,
      vatAmount,
      totalAmount,
      dueAmount,
    };
  }

  // Tính phụ thu trả phòng muộn: mốc chuẩn là 12h trưa ngày check-out, quá giờ đó
  // mỗi 24h tính thêm 1 đêm theo đơn giá loại phòng.
  private computeLateCheckout(booking: Booking): {
    isLate: boolean;
    deadline: string;
    nights: number;
    fee: number;
  } {
    // Xây mốc bằng Date.UTC() (giờ tuyệt đối) thay vì new Date(...).setHours() (giờ địa
    // phương của server) — server chạy ở UTC (phổ biến khi deploy cloud) sẽ tính sai lệch
    // 7 tiếng nếu dùng giờ địa phương thay vì quy đổi rõ ràng sang giờ Việt Nam.
    const [year, month, day] = booking.checkOutDate.split('-').map(Number);
    const deadline = new Date(
      Date.UTC(year, month - 1, day, CHECKOUT_DEADLINE_HOUR - VIETNAM_UTC_OFFSET_HOURS),
    );
    const now = new Date();
    if (now <= deadline) {
      return { isLate: false, deadline: deadline.toISOString(), nights: 0, fee: 0 };
    }
    const nights = Math.ceil(
      (now.getTime() - deadline.getTime()) / (24 * 60 * 60 * 1000),
    );
    return {
      isLate: true,
      deadline: deadline.toISOString(),
      nights,
      fee: nights * booking.roomType.basePrice,
    };
  }

  // Xem trước hoá đơn trả phòng (chưa ghi vào DB) để lễ tân đối chiếu trước khi
  // bấm hoàn tất: gồm phụ thu trả muộn hiện tại + các dịch vụ đã ghi nhận.
  async getCheckoutPreview(bookingId: string) {
    const booking = await this.findByIdRaw(bookingId);
    if (booking.status !== BookingStatus.CHECKED_IN) {
      throw new BadRequestException('Đơn không ở trạng thái đang lưu trú');
    }
    const late = this.computeLateCheckout(booking);

    const serviceAmount = booking.serviceItems.reduce(
      (sum, item) => sum + item.unitPrice * item.quantity,
      0,
    );
    const netRoomAmount =
      booking.roomAmount + late.fee - booking.discountAmount;
    const vatAmount = Math.round(netRoomAmount * VAT_RATE);
    const totalAmount = netRoomAmount + serviceAmount + vatAmount;

    return {
      booking: this.toDetailResponse(booking),
      lateCheckout: late,
      invoice: {
        roomAmount: booking.roomAmount,
        lateCheckoutFee: late.fee,
        discountAmount: booking.discountAmount,
        serviceAmount,
        vatAmount,
        totalAmount,
        paidAmount: booking.paidAmount,
        dueAmount: Math.max(0, totalAmount - booking.paidAmount),
      },
    };
  }

  private async findByIdRaw(bookingId: string): Promise<Booking> {
    const booking = await this.bookingRepo.findOne({ where: { bookingId } });
    if (!booking) {
      throw new NotFoundException('Không tìm thấy đơn đặt phòng');
    }
    return booking;
  }

  private baseQuery() {
    return this.bookingRepo
      .createQueryBuilder('booking')
      .leftJoinAndSelect('booking.user', 'user')
      .leftJoinAndSelect('booking.roomType', 'roomType')
      .leftJoinAndSelect('booking.room', 'room')
      .leftJoinAndSelect('booking.promotion', 'promotion')
      .leftJoinAndSelect('booking.serviceItems', 'serviceItems')
      .leftJoinAndSelect('serviceItems.service', 'service');
  }

  // Dùng cho danh sách có phân trang: KHÔNG join serviceItems (quan hệ 1-nhiều). Join
  // thẳng 1-nhiều rồi skip/take là lỗi kinh điển của TypeORM — mỗi service item nhân
  // thêm 1 dòng SQL trước khi LIMIT/OFFSET được áp, làm sai cả tổng số lẫn danh sách trả
  // về (đơn có dịch vụ có thể bị thiếu/lặp giữa các trang). Chỉ lọc + phân trang theo
  // bookingId ở đây, paginate() bên dưới sẽ fetch lại đầy đủ quan hệ theo đúng ID đó.
  private filterQuery() {
    return this.bookingRepo
      .createQueryBuilder('booking')
      .leftJoin('booking.user', 'user')
      .leftJoin('booking.roomType', 'roomType')
      .leftJoin('booking.room', 'room');
  }

  private async paginate(
    qb: SelectQueryBuilder<Booking>,
    page: number,
    limit: number,
  ) {
    const total = await qb.clone().getCount();
    if (total === 0) {
      return { data: [], total: 0 };
    }

    // Lưu ý: .skip()/.take() chỉ được TypeORM dịch đúng ra LIMIT/OFFSET khi dùng chung
    // với getMany() — với getRawMany() phải gọi thẳng .limit()/.offset(), nếu không
    // TypeORM âm thầm bỏ qua giới hạn và trả về toàn bộ kết quả (đã kiểm chứng bằng
    // cách in getSql() ra so sánh 2 cách viết).
    const idRows = await qb
      .clone()
      .select('booking.bookingId', 'bookingId')
      .orderBy('booking.createdAt', 'DESC')
      .limit(limit)
      .offset((page - 1) * limit)
      .getRawMany<{ bookingId: string }>();
    const ids = idRows.map((row) => row.bookingId);
    if (ids.length === 0) {
      return { data: [], total };
    }

    const rows = await this.baseQuery()
      .where('booking.bookingId IN (:...ids)', { ids })
      .getMany();
    // IN (...) không giữ thứ tự đã phân trang — sắp lại theo đúng thứ tự ID ở trên.
    const order = new Map(ids.map((id, index) => [id, index]));
    rows.sort((a, b) => order.get(a.bookingId)! - order.get(b.bookingId)!);

    return { data: rows.map((b) => this.toDetailResponse(b)), total };
  }

  private async countOverlappingBookings(
    roomTypeId: string,
    checkIn: string,
    checkOut: string,
  ): Promise<number> {
    return this.bookingRepo
      .createQueryBuilder('booking')
      .innerJoin('booking.roomType', 'roomType')
      .where('roomType.roomTypeId = :roomTypeId', { roomTypeId })
      .andWhere('booking.status IN (:...statuses)', {
        statuses: [
          BookingStatus.PENDING,
          BookingStatus.CONFIRMED,
          BookingStatus.CHECKED_IN,
        ],
      })
      .andWhere('booking.checkInDate < :checkOut', { checkOut })
      .andWhere('booking.checkOutDate > :checkIn', { checkIn })
      .getCount();
  }

  private getStayDates(checkIn: string, checkOut: string): string[] {
    const dates: string[] = [];
    const cursor = new Date(checkIn);
    const end = new Date(checkOut);
    while (cursor < end) {
      dates.push(cursor.toISOString().slice(0, 10));
      cursor.setDate(cursor.getDate() + 1);
    }
    return dates;
  }

  // Redis Distributed Lock (SETNX theo roomTypeId+ngày) — chống nhiều request
  // cùng đặt trùng loại phòng/ngày khi có nhiều khách thao tác đồng thời
  private async acquireLocks(
    scope: string,
    dates: string[],
  ): Promise<string[]> {
    const acquired: string[] = [];
    for (const date of dates) {
      const key = `lock:booking:${scope}:${date}`;
      const result = await this.redisClient.set(
        key,
        '1',
        'PX',
        LOCK_TTL_MS,
        'NX',
      );
      if (result === null) {
        await this.releaseLocks(acquired);
        throw new ConflictException(
          'Loại phòng đang được xử lý bởi một yêu cầu đặt khác, vui lòng thử lại',
        );
      }
      acquired.push(key);
    }
    return acquired;
  }

  private async releaseLocks(keys: string[]): Promise<void> {
    if (keys.length > 0) {
      await this.redisClient.del(...keys);
    }
  }
}
