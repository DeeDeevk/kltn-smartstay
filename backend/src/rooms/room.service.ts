import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Room } from './entities/room.entity';
import { Booking } from 'src/bookings/entities/booking.entity';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomStatusDto } from './dto/update-room-status.dto';
import { QueryAvailabilityDto } from './dto/query-availability.dto';
import { QueryRoomMapDto } from './dto/query-room-map.dto';
import { RoomStatus } from 'src/common/enums/room-status.enum';
import { BookingStatus } from 'src/common/enums/booking-status.enum';
import { RoomTypeService } from 'src/room-types/room-type.service';

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

    const existed = await this.roomRepo.findOne({
      where: { roomNumber: dto.roomNumber },
    });
    if (existed) {
      throw new ConflictException('Số phòng đã tồn tại');
    }

    const room = this.roomRepo.create({
      roomNumber: dto.roomNumber,
      floor: dto.floor,
      roomType,
    });
    return this.roomRepo.save(room);
  }

  async updateStatus(roomId: string, dto: UpdateRoomStatusDto): Promise<Room> {
    const room = await this.findById(roomId);
    room.status = dto.status;
    return this.roomRepo.save(room);
  }
}
