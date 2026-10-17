import { IsInt, IsUUID, Max, Min } from 'class-validator';

export class AddServiceDto {
  @IsUUID()
  serviceId!: string;

  @IsInt()
  @Min(1)
  @Max(100)
  quantity!: number;
}
