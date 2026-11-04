import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { QueryServiceDto } from './query-service.dto';

// Danh sách cho admin: thêm phân trang, vẫn lọc theo search/category như GET /services.
export class QueryAdminServiceDto extends QueryServiceDto {
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
  limit?: number = 10;
}
