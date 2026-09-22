import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EventRecurrence } from 'src/common/enums/event-recurrence.enum';
import { LocalEventSource } from 'src/common/enums/local-event-source.enum';

@Entity('LocalEvent')
export class LocalEvent {
  @PrimaryGeneratedColumn('uuid', { name: 'eventId' })
  eventId!: string;

  @Column({ name: 'title', length: 200 })
  title!: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  description!: string | null;

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

  // Reserved for a future "AI-suggested events" feature — every row the admin CRUD
  // creates today is 'manual'. Added now so that feature won't need a schema migration
  // later; no AI-suggestion logic exists yet.
  @Column({
    name: 'source',
    type: 'enum',
    enum: LocalEventSource,
    default: LocalEventSource.MANUAL,
  })
  source!: LocalEventSource;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updatedAt' })
  updatedAt!: Date;
}
