import { IsInt, Min } from 'class-validator';

export class CheckOutShiftDto {
  @IsInt()
  @Min(0)
  closingCash!: number;
}
