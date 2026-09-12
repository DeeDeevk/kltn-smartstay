import { IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class CreateRoomDto {
  // Bỏ trống -> backend tự đặt theo quy ước T{tầng}{số thứ tự}, vd T101, T205.
  @IsOptional()
  @IsString()
  roomNumber?: string;

  @IsInt()
  @Min(0)
  floor!: number;

  @IsUUID()
  roomTypeId!: string;
}
