import 'dotenv/config';
import { DataSource } from 'typeorm';
import { Review } from '../reviews/entities/review.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { BookingServiceItem } from '../bookings/entities/booking-service-item.entity';
import { Room } from '../rooms/entities/room.entity';
import { RoomType } from '../room-types/entities/room-type.entity';
import { Promotion } from '../promotions/entities/promotion.entity';
import { User } from '../users/entities/user.entity';
import { Service } from '../services/entities/service.entity';
import { BookingStatus } from '../common/enums/booking-status.enum';

// Đánh giá mẫu, trộn đủ cả 3 nhóm để trang quản lý có dữ liệu thật mà xem:
// tích cực (>= 4 sao), trung lập (3 - 3.5), tiêu cực (< 3).
//
// Nội dung cố tình viết đa khía cạnh (vừa khen vừa chê trong cùng một câu) để phần
// AI bóc tách có cái mà bóc — đánh giá kiểu "ok lắm" thì không thể hiện được gì.
const SAMPLE_REVIEWS: Array<{ rating: number; comment: string }> = [
  // --- Tích cực ---
  {
    rating: 5,
    comment:
      'Phòng rất sạch sẽ, ga giường thơm. Lễ tân nhiệt tình, nhận phòng sớm mà vẫn được hỗ trợ. Vị trí ngay trung tâm, đi bộ ra chợ đêm chỉ 5 phút.',
  },
  {
    rating: 4.5,
    comment:
      'Bữa sáng ngon và nhiều món, nhân viên phục vụ chu đáo. Phòng rộng rãi, view đẹp. Chỉ tiếc là wifi ở ban công hơi yếu.',
  },
  {
    rating: 4,
    comment:
      'Giá này mà được phòng như vậy là quá hợp lý. Hồ bơi sạch, điều hoà mát. Thủ tục nhận phòng nhanh gọn.',
  },
  {
    rating: 5,
    comment:
      'Đi cùng gia đình, các bé rất thích hồ bơi. Nhân viên hỗ trợ kê thêm giường phụ rất nhanh. Sẽ quay lại lần sau.',
  },
  // --- Trung lập ---
  {
    rating: 3.5,
    comment:
      'Phòng ổn, sạch sẽ, nhưng đồ đạc hơi cũ và vòi sen yếu. Bữa sáng bình thường, không có gì đặc biệt.',
  },
  {
    rating: 3,
    comment:
      'Vị trí thuận tiện nhưng phòng hơi nhỏ so với hình trên web. Nhân viên thân thiện.',
  },
  // --- Tiêu cực ---
  {
    rating: 2,
    comment:
      'Phòng ồn quá, ngay mặt đường nên cả đêm nghe tiếng xe. Điều hoà kêu to. Báo lễ tân nhưng không đổi được phòng khác.',
  },
  {
    rating: 1.5,
    comment:
      'Chờ nhận phòng gần một tiếng dù đã đặt trước. Phòng có mùi ẩm mốc, khăn tắm bị ố. Giá này không xứng đáng.',
  },
  {
    rating: 2.5,
    comment:
      'Wifi rớt liên tục, không làm việc được. Bữa sáng dọn hết sớm dù chưa tới giờ kết thúc.',
  },
];

async function run() {
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    // Booking kéo theo cả cụm quan hệ của nó nên phải khai báo đủ, nếu không TypeORM
    // báo lỗi thiếu metadata khi khởi tạo.
    entities: [
      Review,
      Booking,
      BookingServiceItem,
      Room,
      RoomType,
      Promotion,
      User,
      Service,
    ],
    synchronize: true,
  });

  await dataSource.initialize();
  const reviewRepo = dataSource.getRepository(Review);
  const bookingRepo = dataSource.getRepository(Booking);

  // Đánh giá bắt buộc gắn với 1 đơn ĐÃ TRẢ PHÒNG — đúng ràng buộc nghiệp vụ ở
  // ReviewService, seed không được phép đi đường tắt phá luật đó.
  const bookings = await bookingRepo.find({
    where: { status: BookingStatus.CHECKED_OUT },
    relations: { user: true },
    order: { checkOutDate: 'DESC' },
  });

  if (bookings.length === 0) {
    console.log(
      'Không có đơn nào ở trạng thái "Đã hoàn thành" — hãy check-out vài đơn trước rồi chạy lại.',
    );
    await dataSource.destroy();
    return;
  }

  // Mỗi đơn chỉ được 1 đánh giá (UNIQUE ở DB), nên bỏ qua đơn đã có.
  const existing = await reviewRepo.find({ relations: { booking: true } });
  const reviewedBookingIds = new Set(
    existing.map((review) => review.booking?.bookingId),
  );
  const available = bookings.filter((b) => !reviewedBookingIds.has(b.bookingId));

  if (available.length === 0) {
    console.log('Mọi đơn đã hoàn thành đều đã có đánh giá — không thêm gì.');
    await dataSource.destroy();
    return;
  }

  const willSeed = Math.min(available.length, SAMPLE_REVIEWS.length);
  if (available.length < SAMPLE_REVIEWS.length) {
    console.log(
      `Chỉ có ${available.length} đơn chưa đánh giá, sẽ tạo ${willSeed}/${SAMPLE_REVIEWS.length} đánh giá mẫu.`,
    );
  }

  for (let i = 0; i < willSeed; i += 1) {
    const booking = available[i];
    const data = SAMPLE_REVIEWS[i];
    await reviewRepo.save(
      reviewRepo.create({
        booking,
        user: booking.user,
        rating: data.rating,
        comment: data.comment,
      }),
    );
    console.log(
      `Đã tạo đánh giá ${data.rating} sao cho đơn ${booking.bookingId.slice(0, 8)}`,
    );
  }

  console.log(
    '\nXong. Vào /admin/reviews và bấm "Phân tích lại" ở từng đánh giá để chạy AI bóc tách khía cạnh.',
  );
  await dataSource.destroy();
}

run().catch((err) => {
  console.error('Seed đánh giá thất bại:', err);
  process.exit(1);
});
