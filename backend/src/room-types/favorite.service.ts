import { InjectRepository } from '@nestjs/typeorm';
import { FavoriteRoomType } from './entities/favorite-room-type.entity';
import { Repository } from 'typeorm';
import { RoomTypeService } from './room-type.service';
import { Injectable } from '@nestjs/common';

@Injectable()
export class FavoriteService {
  constructor(
    @InjectRepository(FavoriteRoomType)
    private readonly favoriteRepo: Repository<FavoriteRoomType>,
    private readonly roomTypeService: RoomTypeService,
  ) {}

  async findMine(userId: string) {
    const rows = await this.favoriteRepo.find({
      where: { userId },
      relations: { roomType: true },
      order: { createdAt: 'DESC' },
    });
    return rows.map((r) => r.roomType);
  }

  async add(userId: string, roomTypeId: string) {
    await this.roomTypeService.findActiveById(roomTypeId);
    await this.favoriteRepo
      .createQueryBuilder()
      .insert()
      .values({ userId, roomTypeId })
      .orIgnore()
      .execute();
    return { roomTypeId, isFavorite: true };
  }

  async remove(userId: string, roomTypeId: string) {
    await this.favoriteRepo.delete({ userId, roomTypeId });
    return { roomTypeId, isFavorite: false };
  }
}
