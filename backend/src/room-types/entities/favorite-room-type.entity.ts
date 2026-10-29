import {
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { RoomType } from './room-type.entity';

@Entity('FavoriteRoomType')
export class FavoriteRoomType {
  @PrimaryColumn('uuid', { name: 'userId' })
  userId!: string;

  @PrimaryColumn('uuid', { name: 'roomTypeId' })
  roomTypeId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @ManyToOne(() => RoomType, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'roomTypeId' })
  roomType!: RoomType;

  @CreateDateColumn({name: 'createdAt'})
  createdAt!: Date
}
