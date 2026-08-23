import { IsInt, IsString, IsUUID, Min } from 'class-validator';

export class CreateRoomDto {
  @IsString()
  roomNumber!: string;

  @IsInt()
  @Min(0)
  floor!: number;

  @IsUUID()
  roomTypeId!: string;
}
