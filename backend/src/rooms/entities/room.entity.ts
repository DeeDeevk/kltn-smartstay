import { RoomStatus } from 'src/common/enums/room-status.enum';
import { RoomType } from 'src/room-types/entities/room-type.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

@Entity('Room')
@Unique(['roomNumber'])
export class Room {
  @PrimaryGeneratedColumn('uuid', { name: 'roomId' })
  roomId!: string;

  @Column({ name: 'roomNumber', length: 20 })
  roomNumber!: string;

  @Column({ name: 'floor', type: 'int' })
  floor!: number;

  @ManyToOne(() => RoomType, { onDelete: 'RESTRICT', eager: true })
  @JoinColumn({ name: 'roomTypeId' })
  roomType!: RoomType;

  @Column({
    name: 'status',
    type: 'enum',
    enum: RoomStatus,
    default: RoomStatus.AVAILABLE,
  })
  status!: RoomStatus;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updatedAt' })
  updatedAt!: Date;
}
