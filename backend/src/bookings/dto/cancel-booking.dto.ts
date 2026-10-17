import { IsString, MaxLength } from 'class-validator';

export class CancelBookingDto {
  @IsString()
  @MaxLength(500)
  reason!: string;
}
