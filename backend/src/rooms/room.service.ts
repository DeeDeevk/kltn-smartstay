import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Room } from './entities/room.entity';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomStatusDto } from './dto/update-room-status.dto';
import { QueryAvailabilityDto } from './dto/query-availability.dto';
import { QueryRoomMapDto } from './dto/query-room-map.dto';
import { RoomStatus } from 'src/common/enums/room-status.enum';
import { RoomTypeService } from 'src/room-types/room-type.service';

@Injectable()
export class RoomService {
  constructor(
    @InjectRepository(Room)
    private readonly roomRepo: Repository<Room>,
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

  async getRoomMap(query: QueryRoomMapDto): Promise<Room[]> {
    return this.roomRepo.find({
      where: query.floorId !== undefined ? { floor: query.floorId } : undefined,
      order: { roomNumber: 'ASC' },
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
