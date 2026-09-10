import { IsDateString, IsOptional, IsUUID } from 'class-validator';

// Dùng cho cả 2 chỗ: Admin xem lịch phân ca theo tuần (kèm staffId để lọc theo
// 1 nhân viên) và Staff xem lịch của chính mình (không cần staffId, controller
// tự gắn theo user đang đăng nhập).
export class QueryShiftAssignmentDto {
  @IsDateString()
  from!: string;

  @IsDateString()
  to!: string;

  @IsOptional()
  @IsUUID()
  staffId?: string;
}
