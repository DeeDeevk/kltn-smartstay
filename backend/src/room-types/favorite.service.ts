import { InjectRepository } from '@nestjs/typeorm';
import { FavoriteRoomType } from './entities/favorite-room-type.entity';
import { Repository } from 'typeorm';
import { RoomTypeService } from './room-type.service';
import { Injectable } from '@nestjs/common';
import { RealtimeGateway } from '../realtime/realtime.gateway';

@Injectable()
export class FavoriteService {
  constructor(
    @InjectRepository(FavoriteRoomType)
    private readonly favoriteRepo: Repository<FavoriteRoomType>,
    private readonly roomTypeService: RoomTypeService,
    private readonly realtimeGateway: RealtimeGateway,
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
    const result = { roomTypeId, isFavorite: true };
    this.realtimeGateway.emitFavoriteUpdated(userId, result);
    return result;
  }

  async remove(userId: string, roomTypeId: string) {
    await this.favoriteRepo.delete({ userId, roomTypeId });
    const result = { roomTypeId, isFavorite: false };
    this.realtimeGateway.emitFavoriteUpdated(userId, result);
    return result;
  }
}
