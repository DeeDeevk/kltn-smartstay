import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { EventRecurrence } from 'src/common/enums/event-recurrence.enum';

// See create-local-event.dto.ts: MONTHLY isn't supported by the entity yet.
const SUPPORTED_RECURRENCES = [
  EventRecurrence.ONCE,
  EventRecurrence.WEEKLY,
] as const;

export class UpdateLocalEventDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsIn(SUPPORTED_RECURRENCES, {
    message: 'recurrence must be ONCE or WEEKLY (MONTHLY is not supported yet)',
  })
  recurrence?: EventRecurrence;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek?: number;

  @IsOptional()
  @IsDateString()
  specificDate?: string;
}
