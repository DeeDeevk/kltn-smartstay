import { IsInt, Min } from 'class-validator';

export class CheckInShiftDto {
  @IsInt()
  @Min(0)
  openingCash!: number;
}
