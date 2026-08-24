import { IsString } from 'class-validator';

export class CancelBookingDto {
  @IsString()
  reason!: string;
}
