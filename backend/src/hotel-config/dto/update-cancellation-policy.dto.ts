import { IsInt, Max, Min } from 'class-validator';

export class UpdateCancellationPolicyDto {
  @IsInt()
  @Min(0)
  freeCancellationHours!: number;

  @IsInt()
  @Min(0)
  @Max(100)
  partialRefundPercent!: number;
}
