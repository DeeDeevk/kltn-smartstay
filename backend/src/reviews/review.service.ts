import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { Review } from './entities/review.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { CreateReviewDto } from './dto/create-review.dto';
import { QueryReviewDto } from './dto/query-review.dto';
import { ReplyReviewDto } from './dto/reply-review.dto';
import { BookingStatus } from '../common/enums/booking-status.enum';

// Chỉ lấy đánh giá tốt cho khu "Cảm nhận khách hàng" ngoài trang chủ — đó là khu
// marketing, không phải danh sách đánh giá đầy đủ (danh sách đầy đủ nằm ở trang chi
// tiết phòng và hiện mọi mức sao).
const FEATURED_MIN_RATING = 4;
const FEATURED_DEFAULT_LIMIT = 3;

@Injectable()
export class ReviewService {
  constructor(
    @InjectRepository(Review)
    private readonly reviewRepo: Repository<Review>,
    // Booking thuộc cùng module (ReservationsModule) nên dùng chung repository ở đây
    // là trong-cùng-module, không phá ranh giới modular monolith.
    @InjectRepository(Booking)
    private readonly bookingRepo: Repository<Booking>,
  ) {}

  async findAll(query: QueryReviewDto) {
    const qb = this.baseQuery();
    if (query.roomTypeId) {
      qb.andWhere('roomType.roomTypeId = :roomTypeId', {
        roomTypeId: query.roomTypeId,
      });
    }
    const reviews = await qb.getMany();
    return reviews.map((review) => this.toPublicResponse(review));
  }

  async findFeatured(limit = FEATURED_DEFAULT_LIMIT) {
    const reviews = await this.baseQuery()
      .andWhere('review.rating >= :min', { min: FEATURED_MIN_RATING })
      .take(limit)
      .getMany();
    return reviews.map((review) => this.toPublicResponse(review));
  }

  // Đánh giá của chính khách — trang "Lịch sử đặt phòng" dùng để biết đơn nào đã đánh
  // giá rồi mà ẩn nút đi.
  async findMine(userId: string) {
    const reviews = await this.baseQuery()
      .andWhere('user.userId = :userId', { userId })
      .getMany();
    return reviews.map((review) => ({
      ...this.toPublicResponse(review),
      bookingId: review.booking?.bookingId ?? null,
    }));
  }

  async create(userId: string, dto: CreateReviewDto) {
    const booking = await this.bookingRepo.findOne({
      where: { bookingId: dto.bookingId },
      relations: { user: true, roomType: true },
    });
    if (!booking) {
      throw new NotFoundException('Không tìm thấy đơn đặt phòng');
    }
    if (booking.user?.userId !== userId) {
      throw new ForbiddenException(
        'Bạn chỉ có thể đánh giá đơn đặt phòng của chính mình',
      );
    }
    if (booking.status !== BookingStatus.CHECKED_OUT) {
      throw new BadRequestException(
        'Chỉ có thể đánh giá sau khi đã trả phòng',
      );
    }

    const review = this.reviewRepo.create({
      booking,
      user: booking.user,
      rating: dto.rating,
      comment: dto.comment.trim(),
    });

    try {
      const saved = await this.reviewRepo.save(review);
      return this.toPublicResponse(saved);
    } catch (err) {
      // Bắt vi phạm UNIQUE(bookingId) thay vì kiểm tra trước rồi mới ghi: hai request
      // gửi cùng lúc đều có thể qua được bước kiểm tra, chỉ ràng buộc ở DB mới chắc.
      if (err instanceof QueryFailedError) {
        throw new ConflictException('Bạn đã đánh giá đơn đặt phòng này rồi');
      }
      throw err;
    }
  }

  async reply(reviewId: string, dto: ReplyReviewDto) {
    const review = await this.reviewRepo.findOne({ where: { reviewId } });
    if (!review) {
      throw new NotFoundException('Không tìm thấy đánh giá');
    }
    review.reply = dto.reply.trim();
    return this.toPublicResponse(await this.reviewRepo.save(review));
  }

  private baseQuery() {
    return this.reviewRepo
      .createQueryBuilder('review')
      .innerJoinAndSelect('review.booking', 'booking')
      .innerJoinAndSelect('booking.roomType', 'roomType')
      .innerJoinAndSelect('review.user', 'user')
      .orderBy('review.reviewDate', 'DESC');
  }

  // Chỉ trả ra những trường cần cho hiển thị công khai. KHÔNG spread nguyên entity:
  // user là quan hệ eager nên sẽ kéo theo email, số điện thoại, mật khẩu hash... lên
  // trang công khai ai cũng xem được.
  private toPublicResponse(review: Review) {
    return {
      reviewId: review.reviewId,
      rating: review.rating,
      comment: review.comment,
      reviewDate: review.reviewDate,
      reply: review.reply,
      authorName: review.user?.fullName ?? 'Khách hàng',
      roomTypeId: review.booking?.roomType?.roomTypeId ?? null,
      roomTypeName: review.booking?.roomType?.name ?? null,
    };
  }
}
