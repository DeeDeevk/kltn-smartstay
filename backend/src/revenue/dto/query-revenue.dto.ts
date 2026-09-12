import { IsDateString, IsEnum, IsOptional } from 'class-validator';

// Độ chi tiết của trục thời gian trên biểu đồ: gom theo ngày / tuần / tháng / năm.
export enum RevenueGroupBy {
  DAY = 'day',
  WEEK = 'week',
  MONTH = 'month',
  YEAR = 'year',
}

export class QueryRevenueDto {
  // Khoảng thống kê, dạng 'YYYY-MM-DD' (bao gồm cả 2 đầu).
  @IsDateString()
  from!: string;

  @IsDateString()
  to!: string;

  @IsOptional()
  @IsEnum(RevenueGroupBy)
  groupBy?: RevenueGroupBy = RevenueGroupBy.DAY;
}
