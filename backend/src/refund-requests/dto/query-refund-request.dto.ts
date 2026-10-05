import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { RefundRequestStatus } from '../../common/enums/refund-request-status.enum';

export class QueryRefundRequestDto {
  // Bỏ trống = lấy tất cả trạng thái (vẫn luôn sắp PENDING lên trước, xem
  // RefundRequestService.findAll()).
  @IsOptional()
  @IsEnum(RefundRequestStatus)
  status?: RefundRequestStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
