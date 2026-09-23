import { IsIn, IsString, IsUUID, Length } from 'class-validator';

// Các mức sao hợp lệ. Liệt kê thẳng thay vì @Min/@Max: vừa chặn được giá trị ngoài
// khoảng, vừa chặn luôn các mức lẻ không cho phép (4.3, 4.75...) mà client có thể gửi
// lên khi không đi qua giao diện.
export const ALLOWED_RATINGS = [
  0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5,
];

export class CreateReviewDto {
  @IsUUID()
  bookingId!: string;

  @IsIn(ALLOWED_RATINGS, {
    message: 'Số sao phải nằm trong khoảng 0.5 đến 5, theo bước nửa sao',
  })
  rating!: number;

  @IsString()
  @Length(5, 1000)
  comment!: string;
}
