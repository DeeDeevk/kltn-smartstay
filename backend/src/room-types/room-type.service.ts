import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RoomType } from './entities/room-type.entity';
import { CreateRoomTypeDto } from './dto/create-room-type.dto';
import { UpdateRoomTypeDto } from './dto/update-room-type.dto';
import { QueryRoomTypeDto } from './dto/query-room-type.dto';
import { RoomTypeStatus } from 'src/common/enums/room-type-status.enum';

@Injectable()
export class RoomTypeService {
  constructor(
    @InjectRepository(RoomType)
    private readonly roomTypeRepo: Repository<RoomType>,
  ) {}

  async findAllActive(query: QueryRoomTypeDto): Promise<RoomType[]> {
    const qb = this.roomTypeRepo
      .createQueryBuilder('roomType')
      .where('roomType.status = :status', { status: RoomTypeStatus.ACTIVE });

    if (query.capacity) {
      qb.andWhere('roomType.capacity >= :capacity', {
        capacity: query.capacity,
      });
    }
    if (query.priceMin !== undefined) {
      qb.andWhere('roomType.basePrice >= :priceMin', {
        priceMin: query.priceMin,
      });
    }
    if (query.priceMax !== undefined) {
      qb.andWhere('roomType.basePrice <= :priceMax', {
        priceMax: query.priceMax,
      });
    }
    if (query.search) {
      qb.andWhere('roomType.name ILIKE :search', {
        search: `%${query.search}%`,
      });
    }

    return qb.orderBy('roomType.createdAt', 'DESC').getMany();
  }

  async findActiveById(roomTypeId: string): Promise<RoomType> {
    const roomType = await this.roomTypeRepo.findOne({
      where: { roomTypeId, status: RoomTypeStatus.ACTIVE },
    });
    if (!roomType) {
      throw new NotFoundException('Không tìm thấy loại phòng');
    }
    return roomType;
  }

  async findByIdForAdmin(roomTypeId: string): Promise<RoomType> {
    const roomType = await this.roomTypeRepo.findOne({
      where: { roomTypeId },
    });
    if (!roomType) {
      throw new NotFoundException('Không tìm thấy loại phòng');
    }
    return roomType;
  }

  async create(dto: CreateRoomTypeDto): Promise<RoomType> {
    const roomType = this.roomTypeRepo.create({
      ...dto,
      amenities: dto.amenities ?? [],
      images: dto.images ?? [],
    });
    return this.roomTypeRepo.save(roomType);
  }

  async update(roomTypeId: string, dto: UpdateRoomTypeDto): Promise<RoomType> {
    const roomType = await this.findByIdForAdmin(roomTypeId);
    Object.assign(roomType, dto);
    return this.roomTypeRepo.save(roomType);
  }

  async softDelete(roomTypeId: string): Promise<{ message: string }> {
    const roomType = await this.findByIdForAdmin(roomTypeId);
    if (roomType.status === RoomTypeStatus.INACTIVE) {
      throw new ConflictException('Loại phòng đã ngưng kinh doanh');
    }
    roomType.status = RoomTypeStatus.INACTIVE;
    await this.roomTypeRepo.save(roomType);
    return { message: 'Đã ngưng kinh doanh loại phòng' };
  }
}
