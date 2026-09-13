import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { Room } from './entities/room.entity';
import { Booking } from 'src/bookings/entities/booking.entity';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomStatusDto } from './dto/update-room-status.dto';
import { QueryAvailabilityDto } from './dto/query-availability.dto';
import { QueryRoomMapDto } from './dto/query-room-map.dto';
import { RoomStatus } from 'src/common/enums/room-status.enum';
import { BookingStatus } from 'src/common/enums/booking-status.enum';
import { RoomTypeService } from 'src/room-types/room-type.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';

// Trạng thái booking được coi là "đang giữ" 1 phòng vật lý trong khoảng ngày.
const ACTIVE_BOOKING_STATUSES = [
  BookingStatus.PENDING,
  BookingStatus.CONFIRMED,
  BookingStatus.CHECKED_IN,
];

export type RoomMapItem = Room & {
  rangeStatus?: 'AVAILABLE' | 'BOOKED';
  rangeGuestName?: string | null;
};

@Injectable()
export class RoomService {
  constructor(
    @InjectRepository(Room)
    private readonly roomRepo: Repository<Room>,
    @InjectRepository(Booking)
    private readonly bookingRepo: Repository<Booking>,
    private readonly roomTypeService: RoomTypeService,
    private readonly realtimeGateway: RealtimeGateway,
  ) {}

  // Chưa có module Bookings nên tạm coi phòng "trống" = status AVAILABLE,
  // chưa đối chiếu khoảng ngày checkIn/checkOut với lịch đặt thực tế.
  async checkAvailability(query: QueryAvailabilityDto) {
    const checkIn = new Date(query.checkIn);
    const checkOut = new Date(query.checkOut);
    if (checkIn >= checkOut) {
      throw new BadRequestException('Ngày check-in phải trước ngày check-out');
    }

    const qb = this.roomRepo
      .createQueryBuilder('room')
      .innerJoinAndSelect('room.roomType', 'roomType')
      .where('room.status = :status', { status: RoomStatus.AVAILABLE })
      .andWhere('roomType.capacity >= :guests', { guests: query.guests });

    if (query.roomTypeId) {
      qb.andWhere('roomType.roomTypeId = :roomTypeId', {
        roomTypeId: query.roomTypeId,
      });
    }

    const rooms = await qb.getMany();

    const availableByType = new Map<
      string,
      { roomType: Room['roomType']; availableCount: number }
    >();
    for (const room of rooms) {
      const existing = availableByType.get(room.roomType.roomTypeId);
      if (existing) {
        existing.availableCount += 1;
      } else {
        availableByType.set(room.roomType.roomTypeId, {
          roomType: room.roomType,
          availableCount: 1,
        });
      }
    }

    return Array.from(availableByType.values()).map(
      ({ roomType, availableCount }) => ({
        ...roomType,
        availableCount,
      }),
    );
  }

  async getRoomMap(query: QueryRoomMapDto): Promise<RoomMapItem[]> {
    const qb = this.roomRepo
      .createQueryBuilder('room')
      .innerJoinAndSelect('room.roomType', 'roomType')
      .orderBy('room.roomNumber', 'ASC');

    if (query.floorId !== undefined) {
      qb.andWhere('room.floor = :floorId', { floorId: query.floorId });
    }
    if (query.roomTypeId) {
      qb.andWhere('roomType.roomTypeId = :roomTypeId', {
        roomTypeId: query.roomTypeId,
      });
    }

    const rooms = (await qb.getMany()) as RoomMapItem[];

    // Không lọc theo ngày -> trả nguyên trạng thái phòng.
    if (!query.checkIn || !query.checkOut) {
      return rooms;
    }

    if (new Date(query.checkIn) >= new Date(query.checkOut)) {
      throw new BadRequestException('Ngày check-in phải trước ngày check-out');
    }

    // Các booking đã gán phòng cụ thể và có khoảng ngày giao với [checkIn, checkOut).
    const overlapping = await this.bookingRepo
      .createQueryBuilder('booking')
      .innerJoinAndSelect('booking.room', 'room')
      .where('booking.status IN (:...statuses)', {
        statuses: ACTIVE_BOOKING_STATUSES,
      })
      .andWhere('booking.checkInDate < :checkOut', { checkOut: query.checkOut })
      .andWhere('booking.checkOutDate > :checkIn', { checkIn: query.checkIn })
      .getMany();

    const bookedRoomIds = new Map<string, string | null>();
    for (const booking of overlapping) {
      if (booking.room) {
        bookedRoomIds.set(
          booking.room.roomId,
          booking.guestInfo?.fullName ?? null,
        );
      }
    }

    return rooms.map((room) => {
      const isBooked = bookedRoomIds.has(room.roomId);
      return Object.assign(room, {
        rangeStatus: isBooked ? 'BOOKED' : 'AVAILABLE',
        rangeGuestName: isBooked ? bookedRoomIds.get(room.roomId) : null,
      } as Pick<RoomMapItem, 'rangeStatus' | 'rangeGuestName'>);
    });
  }

  async findById(roomId: string): Promise<Room> {
    const room = await this.roomRepo.findOne({ where: { roomId } });
    if (!room) {
      throw new NotFoundException('Không tìm thấy phòng');
    }
    return room;
  }

  async create(dto: CreateRoomDto): Promise<Room> {
    const roomType = await this.roomTypeService.findByIdForAdmin(
      dto.roomTypeId,
    );

    // Không nhập số phòng -> tự đặt theo quy ước T{tầng}{số thứ tự}, vd T101, T205.
    const roomNumber =
      dto.roomNumber?.trim() || (await this.nextRoomNumber(dto.floor));

    const existed = await this.roomRepo.findOne({
      where: { roomNumber },
    });
    if (existed) {
      throw new ConflictException('Số phòng đã tồn tại');
    }

    const room = this.roomRepo.create({
      roomNumber,
      floor: dto.floor,
      roomType,
    });
    try {
      return await this.roomRepo.save(room);
    } catch (err) {
      // Giữa lúc check `existed` ở trên và save() thật, 1 request khác (VD 2 admin cùng
      // bấm tạo phòng, hoặc số phòng tự sinh trùng nhau) có thể đã chiếm đúng roomNumber
      // này — ràng buộc UNIQUE ở DB là chốt chặn cuối, dịch lỗi 23505 (Postgres unique
      // violation) thành 409 thân thiện thay vì để lọt ra 500 chưa được xử lý.
      if (
        err instanceof QueryFailedError &&
        (err as unknown as { code?: string }).code === '23505'
      ) {
        throw new ConflictException('Số phòng đã tồn tại');
      }
      throw err;
    }
  }

  // Số phòng trống kế tiếp trên 1 tầng theo quy ước T{tầng}{NN}.
  private async nextRoomNumber(floor: number): Promise<string> {
    const floorRooms = await this.roomRepo.find({ where: { floor } });
    const used = new Set(floorRooms.map((r) => r.roomNumber));
    for (let seq = 1; seq < 1000; seq += 1) {
      const candidate = `T${floor}${String(seq).padStart(2, '0')}`;
      if (!used.has(candidate)) return candidate;
    }
    throw new ConflictException('Tầng đã đầy, không thể tự sinh số phòng mới');
  }

  async updateStatus(roomId: string, dto: UpdateRoomStatusDto): Promise<Room> {
    const room = await this.findById(roomId);
    room.status = dto.status;
    const saved = await this.roomRepo.save(room);
    this.realtimeGateway.emitRoomStatusChanged({
      roomId: saved.roomId,
      status: saved.status,
    });
    return saved;
  }

  // Tổng số phòng vật lý — dùng cho công suất phòng & RevPAR ở module Revenue.
  count(): Promise<number> {
    return this.roomRepo.count();
  }

  // Số lượng phòng gom theo trạng thái — phục vụ DashboardService (thống kê tổng
  // quan) mà không để module Dashboard truy cập thẳng repository Room.
  countGroupedByStatus(): Promise<Array<{ group: string; count: string }>> {
    return this.roomRepo
      .createQueryBuilder('room')
      .select('room.status', 'group')
      .addSelect('COUNT(*)', 'count')
      .groupBy('room.status')
      .getRawMany<{ group: string; count: string }>();
  }
}
