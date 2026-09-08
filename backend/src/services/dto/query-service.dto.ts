import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ServiceCategory } from 'src/common/enums/service-category.enum';

export class QueryServiceDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(ServiceCategory)
  category?: ServiceCategory;
}
