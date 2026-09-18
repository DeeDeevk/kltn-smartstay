import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EventRecurrence } from 'src/common/enums/event-recurrence.enum';

@Entity('LocalEvent')
export class LocalEvent {
  @PrimaryGeneratedColumn('uuid', { name: 'eventId' })
  eventId!: string;

  @Column({ name: 'title', length: 200 })
  title!: string;

  @Column({ name: 'description', type: 'text' })
  description!: string;

  @Column({
    name: 'recurrence',
    type: 'enum',
    enum: EventRecurrence,
  })
  recurrence!: EventRecurrence;

  // 0 = Chủ Nhật ... 6 = Thứ Bảy, chỉ có ý nghĩa khi recurrence = WEEKLY.
  @Column({ name: 'dayOfWeek', type: 'int', nullable: true })
  dayOfWeek!: number | null;

  // Định dạng YYYY-MM-DD, chỉ có ý nghĩa khi recurrence = ONCE.
  @Column({ name: 'specificDate', type: 'date', nullable: true })
  specificDate!: string | null;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updatedAt' })
  updatedAt!: Date;
}
