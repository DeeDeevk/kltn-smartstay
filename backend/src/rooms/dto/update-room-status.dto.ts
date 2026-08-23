import { IsEnum } from 'class-validator';
import { RoomStatus } from 'src/common/enums/room-status.enum';

export class UpdateRoomStatusDto {
  @IsEnum(RoomStatus)
  status!: RoomStatus;
}
