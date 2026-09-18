import {
  IsDateString,
  IsEnum,
  IsInt,
  IsString,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import { EventRecurrence } from 'src/common/enums/event-recurrence.enum';

export class CreateLocalEventDto {
  @IsString()
  title!: string;

  @IsString()
  description!: string;

  @IsEnum(EventRecurrence)
  recurrence!: EventRecurrence;

  // Bắt buộc khi recurrence = WEEKLY, bỏ qua validate ở các recurrence khác.
  @ValidateIf(
    (dto: CreateLocalEventDto) => dto.recurrence === EventRecurrence.WEEKLY,
  )
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek?: number;

  // Bắt buộc khi recurrence = ONCE, bỏ qua validate ở các recurrence khác.
  @ValidateIf(
    (dto: CreateLocalEventDto) => dto.recurrence === EventRecurrence.ONCE,
  )
  @IsDateString()
  specificDate?: string;
}
