import { RoomTypeStatus } from 'src/common/enums/room-type-status.enum';
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('RoomType')
export class RoomType {
  @PrimaryGeneratedColumn('uuid', { name: 'roomTypeId' })
  roomTypeId!: string;

  @Column({ name: 'name', length: 100 })
  name!: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  description!: string | null;

  @Column({ name: 'basePrice', type: 'int' })
  basePrice!: number;

  @Column({ name: 'capacity', type: 'int' })
  capacity!: number;

  @Column({ name: 'amenities', type: 'jsonb', default: () => "'[]'" })
  amenities!: string[];

  @Column({ name: 'images', type: 'jsonb', default: () => "'[]'" })
  images!: string[];

  @Column({
    name: 'status',
    type: 'enum',
    enum: RoomTypeStatus,
    default: RoomTypeStatus.ACTIVE,
  })
  status!: RoomTypeStatus;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updatedAt' })
  updatedAt!: Date;
}
