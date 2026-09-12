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
import { User } from '../../users/entities/user.entity';
import { ShiftType } from './shift-type.entity';
import { ShiftAssignmentStatus } from '../../common/enums/shift-assignment-status.enum';

// 1 dòng = 1 nhân viên được phân vào 1 loại ca, vào 1 ngày làm việc cụ thể.
// status bắt đầu ở SCHEDULED (mới xếp lịch) — CHECKEDIN/CHECKEDOUT/ABSENT dành
// cho giai đoạn theo dõi chấm công thực tế (chưa làm ở Phase 1: phân ca).
@Entity('ShiftAssignment')
@Unique(['staff', 'shiftType', 'workDate'])
export class ShiftAssignment {
  @PrimaryGeneratedColumn('uuid', { name: 'shiftAssignmentId' })
  shiftAssignmentId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'staffId' })
  staff!: User;

  @ManyToOne(() => ShiftType, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'shiftTypeId' })
  shiftType!: ShiftType;

  @Column({ name: 'workDate', type: 'date' })
  workDate!: string;

  @Column({
    name: 'status',
    type: 'enum',
    enum: ShiftAssignmentStatus,
    default: ShiftAssignmentStatus.SCHEDULED,
  })
  status!: ShiftAssignmentStatus;

  @Column({ name: 'checkInAt', type: 'timestamp', nullable: true })
  checkInAt!: Date | null;

  @Column({ name: 'checkOutAt', type: 'timestamp', nullable: true })
  checkOutAt!: Date | null;

  @Column({ name: 'note', type: 'text', nullable: true })
  note!: string | null;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updatedAt' })
  updatedAt!: Date;
}
