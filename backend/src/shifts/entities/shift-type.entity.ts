import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

// Loại ca cố định trong ngày (vd. Ca sáng 06:00-14:00, Ca chiều 14:00-22:00,
// Ca đêm 22:00-06:00) — Admin định nghĩa 1 lần, dùng lại khi phân ca cho nhân viên.
@Entity('ShiftType')
export class ShiftType {
  @PrimaryGeneratedColumn('uuid', { name: 'shiftTypeId' })
  shiftTypeId!: string;

  @Column({ name: 'name', length: 50 })
  name!: string;

  // Lưu dạng 'HH:mm:ss' (kiểu 'time' của Postgres, không gắn ngày cụ thể).
  @Column({ name: 'startTime', type: 'time' })
  startTime!: string;

  @Column({ name: 'endTime', type: 'time' })
  endTime!: string;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updatedAt' })
  updatedAt!: Date;
}
