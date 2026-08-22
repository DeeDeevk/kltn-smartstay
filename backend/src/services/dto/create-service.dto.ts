import { IsInt, IsOptional, IsString, Min } from 'class-validator';

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
}
