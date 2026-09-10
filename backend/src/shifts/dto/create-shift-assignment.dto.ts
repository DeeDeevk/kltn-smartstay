import { IsDateString, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateShiftAssignmentDto {
  @IsUUID()
  staffId!: string;

  @IsUUID()
  shiftTypeId!: string;

  // 'YYYY-MM-DD' — ngày làm việc, không kèm giờ (giờ đã cố định theo ShiftType).
  @IsDateString()
  workDate!: string;

  @IsOptional()
  @IsString()
  note?: string;
}
