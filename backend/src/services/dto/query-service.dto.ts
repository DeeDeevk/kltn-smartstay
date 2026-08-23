import { IsOptional, IsString } from 'class-validator';

export class QueryServiceDto {
  @IsOptional()
  @IsString()
  search?: string;
}
