import { IsString, Matches, MaxLength } from 'class-validator';

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

export class CreateShiftTypeDto {
  @IsString()
  @MaxLength(50)
  name!: string;

  @IsString()
  @Matches(TIME_REGEX, { message: 'startTime phải theo định dạng HH:mm' })
  startTime!: string;

  @IsString()
  @Matches(TIME_REGEX, { message: 'endTime phải theo định dạng HH:mm' })
  endTime!: string;
}
