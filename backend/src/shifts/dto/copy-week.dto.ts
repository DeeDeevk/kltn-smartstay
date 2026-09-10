import { IsDateString } from 'class-validator';

// Cả 2 đều là ngày bắt đầu của 1 tuần (thường là Thứ 2) dạng 'YYYY-MM-DD'.
// Service sao chép ca từ [sourceWeekStart, +6 ngày] sang [targetWeekStart, +6 ngày],
// giữ nguyên thứ trong tuần.
export class CopyWeekDto {
  @IsDateString()
  sourceWeekStart!: string;

  @IsDateString()
  targetWeekStart!: string;
}
