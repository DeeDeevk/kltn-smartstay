import { Repository } from 'typeorm';
import { RoomTypeReviewSummaryService } from './room-type-review-summary.service';
import { RoomType } from './entities/room-type.entity';
import { ReviewService } from '../reviews/review.service';
import { GeminiProvider } from '../ai-agent/llm/gemini.provider';

const ROOM_TYPE_ID = 'rt-1';

function buildService(overrides?: {
  roomType?: Partial<RoomType> | null;
  totalReviews?: number;
  recentReviews?: { rating: number; comment: string }[];
  generateJson?: jest.Mock;
}) {
  const roomType =
    overrides?.roomType === null
      ? null
      : {
          roomTypeId: ROOM_TYPE_ID,
          reviewSummary: null,
          ...overrides?.roomType,
        };

  const update = jest.fn().mockResolvedValue(undefined);
  const roomTypeRepo = {
    findOne: jest.fn().mockResolvedValue(roomType),
    update,
  } as unknown as Repository<RoomType>;

  const countForRoomType = jest
    .fn()
    .mockResolvedValue(overrides?.totalReviews ?? 0);
  const findRecentForSummary = jest
    .fn()
    .mockResolvedValue(overrides?.recentReviews ?? []);
  const reviewService = {
    countForRoomType,
    findRecentForSummary,
  } as unknown as ReviewService;

  const generateJson =
    overrides?.generateJson ??
    jest.fn().mockResolvedValue({
      positives: ['Sạch sẽ'],
      negatives: [],
      overallComment: 'Khách hài lòng.',
    });
  const geminiProvider = { generateJson } as unknown as GeminiProvider;

  const service = new RoomTypeReviewSummaryService(
    roomTypeRepo,
    reviewService,
    geminiProvider,
  );

  return {
    service,
    update,
    countForRoomType,
    findRecentForSummary,
    generateJson,
  };
}

describe('RoomTypeReviewSummaryService', () => {
  it('báo lỗi 404 khi roomTypeId không tồn tại', async () => {
    const { service } = buildService({ roomType: null });
    await expect(service.getSummary(ROOM_TYPE_ID)).rejects.toThrow(
      'Không tìm thấy loại phòng',
    );
  });

  it('trả null và KHÔNG gọi Gemini khi chưa đủ đánh giá (dưới 3)', async () => {
    const { service, generateJson } = buildService({ totalReviews: 2 });

    const result = await service.getSummary(ROOM_TYPE_ID);

    expect(result).toBeNull();
    expect(generateJson).not.toHaveBeenCalled();
  });

  it('cache còn mới (reviewCount khớp tổng hiện tại) -> trả cache ngay, KHÔNG gọi Gemini', async () => {
    const cached = {
      positives: ['Vị trí đẹp'],
      negatives: [],
      overallComment: 'Khách rất hài lòng.',
      reviewCount: 5,
      generatedAt: '2026-01-01T00:00:00.000Z',
    };
    const { service, generateJson, update } = buildService({
      roomType: { reviewSummary: cached },
      totalReviews: 5,
    });

    const result = await service.getSummary(ROOM_TYPE_ID);

    expect(result).toEqual(cached);
    expect(generateJson).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it('cache cũ (reviewCount khác tổng hiện tại) -> gọi Gemini tổng hợp lại và lưu cache mới', async () => {
    const oldCache = {
      positives: ['Cũ'],
      negatives: [],
      overallComment: 'Cũ.',
      reviewCount: 3,
      generatedAt: '2026-01-01T00:00:00.000Z',
    };
    const generateJson = jest.fn().mockResolvedValue({
      positives: ['Sạch sẽ', 'Nhân viên thân thiện'],
      negatives: ['Wifi yếu'],
      overallComment: 'Đa số khách hài lòng, chỉ có ý kiến về wifi.',
    });
    const { service, update } = buildService({
      roomType: { reviewSummary: oldCache },
      totalReviews: 5, // khác reviewCount=3 của cache cũ -> phải tổng hợp lại
      recentReviews: [
        { rating: 5, comment: 'Phòng sạch, nhân viên thân thiện' },
        { rating: 3, comment: 'Wifi hơi yếu' },
      ],
      generateJson,
    });

    const result = await service.getSummary(ROOM_TYPE_ID);

    expect(generateJson).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      positives: ['Sạch sẽ', 'Nhân viên thân thiện'],
      negatives: ['Wifi yếu'],
      overallComment: 'Đa số khách hài lòng, chỉ có ý kiến về wifi.',
      reviewCount: 5,
    });
    expect(update).toHaveBeenCalledWith(
      { roomTypeId: ROOM_TYPE_ID },
      { reviewSummary: result },
    );
  });

  it('chưa từng có cache (reviewSummary=null) -> vẫn tổng hợp bình thường', async () => {
    const { service, update } = buildService({
      roomType: { reviewSummary: null },
      totalReviews: 4,
      recentReviews: [{ rating: 4, comment: 'Ổn' }],
    });

    const result = await service.getSummary(ROOM_TYPE_ID);

    expect(result).not.toBeNull();
    expect(update).toHaveBeenCalledTimes(1);
  });

  it('Gemini lỗi, CÓ cache cũ -> trả cache cũ thay vì null, không ném lỗi', async () => {
    const oldCache = {
      positives: ['Giữ nguyên'],
      negatives: [],
      overallComment: 'Giữ nguyên.',
      reviewCount: 3,
      generatedAt: '2026-01-01T00:00:00.000Z',
    };
    // status 400 (không nằm trong retryableStatus) để test không phải chờ retry thật —
    // hành vi retry-with-backoff đã có test riêng ở retry-with-backoff.spec.ts.
    const generateJson = jest
      .fn()
      .mockRejectedValue(
        Object.assign(new Error('bad request'), { status: 400 }),
      );
    const { service, update } = buildService({
      roomType: { reviewSummary: oldCache },
      totalReviews: 6,
      generateJson,
    });

    const result = await service.getSummary(ROOM_TYPE_ID);

    expect(result).toEqual(oldCache);
    expect(update).not.toHaveBeenCalled();
  });

  it('Gemini lỗi, KHÔNG có cache cũ -> trả null thay vì ném lỗi', async () => {
    const generateJson = jest
      .fn()
      .mockRejectedValue(
        Object.assign(new Error('bad request'), { status: 400 }),
      );
    const { service } = buildService({
      roomType: { reviewSummary: null },
      totalReviews: 4,
      generateJson,
    });

    const result = await service.getSummary(ROOM_TYPE_ID);

    expect(result).toBeNull();
  });

  it('normalize(): lọc phần tử không phải string, cắt tối đa 4 ý mỗi loại', async () => {
    const generateJson = jest.fn().mockResolvedValue({
      positives: ['A', 'B', 'C', 'D', 'E', 123, null],
      negatives: ['X', '', '  '],
      overallComment: '  Câu tổng quan.  ',
    });
    const { service } = buildService({
      totalReviews: 3,
      recentReviews: [{ rating: 4, comment: 'ok' }],
      generateJson,
    });

    const result = await service.getSummary(ROOM_TYPE_ID);

    expect(result?.positives).toEqual(['A', 'B', 'C', 'D']);
    expect(result?.negatives).toEqual(['X']);
    expect(result?.overallComment).toBe('Câu tổng quan.');
  });
});
