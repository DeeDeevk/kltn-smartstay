import { IsInt, IsUUID, Min } from 'class-validator';

export class AddServiceDto {
  @IsUUID()
  serviceId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;
}
