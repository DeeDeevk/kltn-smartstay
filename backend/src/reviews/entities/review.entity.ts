import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Booking } from '../../bookings/entities/booking.entity';
import { User } from '../../users/entities/user.entity';

// Đánh giá của khách sau khi đã ở xong. Gắn vào BOOKING chứ không gắn thẳng vào loại
// phòng: đó là thứ chứng minh khách thật sự đã lưu trú, nên không ai đánh giá được
// phòng mình chưa từng ở. Loại phòng suy ra qua booking.roomType khi cần lọc.
@Entity('Review')
// Mỗi đơn chỉ đánh giá được 1 lần — chặn ở tầng DB chứ không chỉ ở service, tránh
// hai request gửi đồng thời cùng lọt qua bước kiểm tra.
@Unique(['booking'])
export class Review {
  @PrimaryGeneratedColumn('uuid', { name: 'reviewId' })
  reviewId!: string;

  @ManyToOne(() => Booking, { onDelete: 'CASCADE', eager: true })
  @JoinColumn({ name: 'bookingId' })
  booking!: Booking;

  @ManyToOne(() => User, { onDelete: 'CASCADE', eager: true })
  @JoinColumn({ name: 'userId' })
  user!: User;

  // 0.5 - 5 sao, bước nửa sao.
  //
  // numeric(2,1) chứ không phải int (chấm được nửa sao) và cũng không phải float
  // (numeric là số thập phân chính xác, không có sai số nhị phân khi cộng dồn để tính
  // điểm trung bình). Đổi lại, driver Postgres trả numeric về dưới dạng CHUỖI để không
  // mất độ chính xác với số lớn — nên phải có transformer, nếu không `rating` lên tới
  // frontend sẽ là "4.5" và mọi phép cộng tính trung bình biến thành nối chuỗi.
  @Column({
    name: 'rating',
    type: 'numeric',
    precision: 2,
    scale: 1,
    transformer: {
      to: (value: number) => value,
      from: (value: string | null) => (value === null ? null : Number(value)),
    },
  })
  rating!: number;

  @Column({ name: 'comment', type: 'text' })
  comment!: string;

  @CreateDateColumn({ name: 'reviewDate' })
  reviewDate!: Date;

  // Phản hồi của khách sạn, null = chưa phản hồi.
  @Column({ name: 'reply', type: 'text', nullable: true })
  reply!: string | null;
}
