import { IsDateString } from 'class-validator';

export class TriggerAutoScanDto {
  @IsDateString()
  fromDate!: string;

  @IsDateString()
  toDate!: string;
}
