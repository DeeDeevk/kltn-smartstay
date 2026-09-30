import { Repository } from 'typeorm';
import { ReviewService } from './review.service';
import { Review } from './entities/review.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { ReviewAnalysisService } from './review-analysis.service';
import { NotificationService } from '../notifications/notification.service';
import { ReviewAnalysis } from './review-analysis.types';

const SAMPLE_ANALYSIS: ReviewAnalysis = {
  aspects: [],
  summary: 'ok',
  toneMismatch: false,
  analyzedAt: '2026-01-01T00:00:00.000Z',
};

function buildPending(count: number): Review[] {
  return Array.from({ length: count }, (_, i) => ({
    reviewId: `review-${i}`,
    rating: 4,
    comment: `Đánh giá số ${i}`,
    aiAnalysis: null,
  })) as unknown as Review[];
}

function buildService({
  pending,
  analyzeResults,
}: {
  pending: Review[];
  // Kết quả lần lượt trả về cho mỗi lần gọi analyze() — null = giả lập lỗi/thất bại
  // (đúng hợp đồng thật của ReviewAnalysisService.analyze: không throw, trả null).
  analyzeResults: (ReviewAnalysis | null)[];
}) {
  const reviewRepo = {
    find: jest.fn().mockResolvedValue(pending),
    update: jest.fn().mockResolvedValue(undefined),
    count: jest.fn().mockResolvedValue(0),
  } as unknown as Repository<Review>;
  const bookingRepo = {} as unknown as Repository<Booking>;

  let callIndex = 0;
  const analyze = jest.fn(() => {
    const result =
      analyzeResults[Math.min(callIndex, analyzeResults.length - 1)];
    callIndex += 1;
    return Promise.resolve(result);
  });
  const reviewAnalysisService = { analyze } as unknown as ReviewAnalysisService;
  const notificationService = {
    notifyReviewReplied: jest.fn().mockResolvedValue(undefined),
  } as unknown as NotificationService;

  const service = new ReviewService(
    reviewRepo,
    bookingRepo,
    reviewAnalysisService,
    notificationService,
  );
  return { service, reviewRepo, analyze, notificationService };
}

describe('ReviewService.analyzePending — dừng sớm khi lỗi liên tiếp', () => {
  it('mọi lượt đều thành công -> chạy hết, không dừng sớm', async () => {
    const pending = buildPending(5);
    const { service, analyze } = buildService({
      pending,
      analyzeResults: [SAMPLE_ANALYSIS],
    });

    const result = await service.analyzePending();

    expect(analyze).toHaveBeenCalledTimes(5);
    expect(result).toEqual({
      analyzed: 5,
      failed: 0,
      remaining: 0,
      abortedEarly: false,
    });
  });

  it('lỗi liên tiếp đủ CONSECUTIVE_FAILURE_LIMIT (3) thì dừng ngay, không chạy hết danh sách', async () => {
    // 10 đánh giá đang chờ nhưng Gemini lỗi (trả null) ngay từ đầu -> phải dừng sau
    // đúng 3 lần lỗi liên tiếp, không cố chạy hết cả 10 (đó chính là lý do có giới hạn
    // này: tránh admin ngồi chờ vô ích khi Gemini đang quá tải cả loạt).
    const pending = buildPending(10);
    const { service, analyze } = buildService({
      pending,
      analyzeResults: [null, null, null],
    });

    const result = await service.analyzePending();

    expect(analyze).toHaveBeenCalledTimes(3);
    expect(result).toEqual({
      analyzed: 0,
      failed: 3,
      remaining: 0,
      abortedEarly: true,
    });
  });

  it('lỗi xen kẽ với thành công (không đủ 3 lần lỗi LIÊN TIẾP) thì KHÔNG dừng sớm, vẫn chạy hết', async () => {
    // Thất bại - thành công - thất bại - thất bại - thành công: chưa bao giờ có 3 lỗi
    // liên tiếp (bộ đếm bị reset về 0 mỗi khi có 1 lần thành công xen giữa).
    const pending = buildPending(5);
    const { service, analyze } = buildService({
      pending,
      analyzeResults: [null, SAMPLE_ANALYSIS, null, null, SAMPLE_ANALYSIS],
    });

    const result = await service.analyzePending();

    expect(analyze).toHaveBeenCalledTimes(5);
    expect(result).toEqual({
      analyzed: 2,
      failed: 3,
      remaining: 0,
      abortedEarly: false,
    });
  });

  it('đúng đến 2 lỗi liên tiếp rồi thành công ở lần thứ 3 -> KHÔNG chạm ngưỡng dừng (biên đúng của CONSECUTIVE_FAILURE_LIMIT)', async () => {
    const pending = buildPending(4);
    const { service, analyze } = buildService({
      pending,
      analyzeResults: [null, null, SAMPLE_ANALYSIS, SAMPLE_ANALYSIS],
    });

    const result = await service.analyzePending();

    expect(analyze).toHaveBeenCalledTimes(4);
    expect(result.abortedEarly).toBe(false);
    // 2 lần lỗi đầu (chưa chạm ngưỡng 3) + 2 lần thành công sau đó = 2, không phải 3 —
    // "lỗi liên tiếp" chỉ đếm 2 lần rồi bị reset khi gặp thành công, không cộng dồn
    // xuyên suốt các lượt thành công.
    expect(result.analyzed).toBe(2);
  });
});

describe('ReviewService.reply — chỉ báo cho khách ở lần phản hồi ĐẦU TIÊN', () => {
  function buildReplyService(existingReply: string | null) {
    const review = {
      reviewId: 'r1',
      reply: existingReply,
      user: { userId: 'u1' },
      booking: { bookingId: 'b1', roomType: { name: 'Deluxe' } },
    };
    const reviewRepo = {
      findOne: jest.fn().mockResolvedValue(review),
      save: jest.fn().mockImplementation((r) => Promise.resolve(r)),
    } as unknown as Repository<Review>;
    const bookingRepo = {} as unknown as Repository<Booking>;
    const reviewAnalysisService = {} as unknown as ReviewAnalysisService;
    // Giữ riêng 1 tham chiếu notifyReviewReplied kiểu jest.Mock (không ép kiểu qua
    // NotificationService) để dùng trong expect(...) — tham chiếu 1 method lấy thẳng từ
    // object đã cast sang class thật sẽ bị @typescript-eslint/unbound-method cảnh báo
    // "mất this khi tách khỏi object", dù ở đây là mock nên không áp dụng.
    const notifyReviewReplied = jest.fn().mockResolvedValue(undefined);
    const notificationService = {
      notifyReviewReplied,
    } as unknown as NotificationService;

    const service = new ReviewService(
      reviewRepo,
      bookingRepo,
      reviewAnalysisService,
      notificationService,
    );
    return { service, notifyReviewReplied };
  }

  it('lần phản hồi đầu tiên (chưa có reply cũ) -> gửi thông báo cho khách', async () => {
    const { service, notifyReviewReplied } = buildReplyService(null);

    await service.reply('r1', { reply: 'Cảm ơn quý khách!' });

    expect(notifyReviewReplied).toHaveBeenCalledWith('u1', {
      bookingId: 'b1',
      roomTypeName: 'Deluxe',
      reply: 'Cảm ơn quý khách!',
    });
  });

  it('sửa phản hồi đã có sẵn -> KHÔNG gửi thêm thông báo (tránh làm phiền khách)', async () => {
    const { service, notifyReviewReplied } = buildReplyService('Phản hồi cũ');

    await service.reply('r1', { reply: 'Phản hồi đã sửa lại' });

    expect(notifyReviewReplied).not.toHaveBeenCalled();
  });
});
