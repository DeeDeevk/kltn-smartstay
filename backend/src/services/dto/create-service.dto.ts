import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { ServiceCategory } from 'src/common/enums/service-category.enum';

export class CreateServiceDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsInt()
  @Min(0)
  price!: number;

  @IsString()
  unit!: string;

  @IsOptional()
  @IsEnum(ServiceCategory)
  category?: ServiceCategory;
}
