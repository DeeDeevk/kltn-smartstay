import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  Max,
  IsInt,
  ValidateIf,
} from 'class-validator';
import { EventRecurrence } from 'src/common/enums/event-recurrence.enum';

// MONTHLY is a recognized enum value in the DB (reserved for later) but the entity has no
// "day of month" field yet, so the admin CRUD only accepts the 2 types the schema can
// actually represent today — matching the 2 options the settings page UI offers.
const SUPPORTED_RECURRENCES = [
  EventRecurrence.ONCE,
  EventRecurrence.WEEKLY,
] as const;

export class CreateLocalEventDto {
  @IsString()
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsIn(SUPPORTED_RECURRENCES, {
    message: 'recurrence must be ONCE or WEEKLY (MONTHLY is not supported yet)',
  })
  recurrence!: EventRecurrence;

  // Required when recurrence = WEEKLY, skipped otherwise.
  @ValidateIf(
    (dto: CreateLocalEventDto) => dto.recurrence === EventRecurrence.WEEKLY,
  )
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek?: number;

  // Required when recurrence = ONCE, skipped otherwise.
  @ValidateIf(
    (dto: CreateLocalEventDto) => dto.recurrence === EventRecurrence.ONCE,
  )
  @IsDateString()
  specificDate?: string;
}
