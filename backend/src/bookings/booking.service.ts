import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Redis from 'ioredis';
import { Booking } from './entities/booking.entity';
import { BookingServiceItem } from './entities/booking-service-item.entity';
import { CreateBookingDto } from './dto/create-booking.dto';
import { QueryBookingDto } from './dto/query-booking.dto';
import { QueryMyBookingDto } from './dto/query-my-booking.dto';
import { CheckInDto } from './dto/check-in.dto';
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

  async findAll(query: QueryBookingDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const qb = this.baseQuery();

    if (query.status) {
      qb.andWhere('booking.status = :status', { status: query.status });
    }
    if (query.roomId) {
      qb.andWhere('room.roomId = :roomId', { roomId: query.roomId });
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

    const [data, total] = await qb
      .orderBy('booking.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { data: data.map((b) => this.toDetailResponse(b)), total };
  }

  async findMyBookings(userId: string, query: QueryMyBookingDto) {
    const page = query.page ?? 1;
    const limit = 10;
    const qb = this.baseQuery().where('user.userId = :userId', { userId });

    if (query.status) {
      qb.andWhere('booking.status = :status', { status: query.status });
    }

    const [data, total] = await qb
      .orderBy('booking.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { data: data.map((b) => this.toDetailResponse(b)), total };
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
    }
    await this.bookingRepo.save(booking);

    return this.toDetailResponse(booking);
  }

  async checkOut(bookingId: string) {
    const booking = await this.findByIdRaw(bookingId);
    if (booking.status !== BookingStatus.CHECKED_IN) {
      throw new BadRequestException(
        'Đơn phải ở trạng thái đang lưu trú trước khi check-out',
      );
    }

    booking.status = BookingStatus.CHECKED_OUT;
    await this.bookingRepo.save(booking);

    if (booking.room) {
      booking.room.status = RoomStatus.CLEANING;
      await this.roomRepo.save(booking.room);
    }

    const detail = this.toDetailResponse(booking);
    return {
      booking: detail,
      finalInvoice: {
        roomAmount: booking.roomAmount,
        serviceAmount: detail.serviceAmount,
        discountAmount: booking.discountAmount,
        vatAmount: detail.vatAmount,
        totalAmount: detail.totalAmount,
      },
    };
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
    // Thuế GTGT 8% tính trên tiền phòng sau khuyến mãi (không áp dụng cho dịch vụ đi kèm).
    const netRoomAmount = booking.roomAmount - booking.discountAmount;
    const vatAmount = Math.round(netRoomAmount * VAT_RATE);
    const totalAmount = netRoomAmount + serviceAmount + vatAmount;
    return { ...booking, serviceAmount, vatAmount, totalAmount };
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
    roomTypeId: string,
    dates: string[],
  ): Promise<string[]> {
    const acquired: string[] = [];
    for (const date of dates) {
      const key = `lock:booking:${roomTypeId}:${date}`;
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
