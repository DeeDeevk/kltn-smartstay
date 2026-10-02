import { IsString, Length } from 'class-validator';

export class ReplyReviewDto {
  @IsString()
  @Length(1, 1000)
  reply!: string;
}
