import { GeminiProvider } from '../ai-agent/llm/gemini.provider';
import { ReviewAnalysisService } from './review-analysis.service';
import { AspectSentiment, ReviewTopic } from './review-analysis.types';

function buildService(generateJson: jest.Mock) {
  const gemini = { generateJson } as unknown as GeminiProvider;
  return new ReviewAnalysisService(gemini);
}

describe('ReviewAnalysisService', () => {
  describe('normalize() qua analyze() — không tin mù JSON Gemini trả về', () => {
    it('giữ lại khía cạnh hợp lệ, quote khớp nguyên văn trong đánh giá (không phân biệt hoa/thường)', async () => {
      const generateJson = jest.fn().mockResolvedValue({
        aspects: [
          {
            topic: 'CLEANLINESS',
            sentiment: 'NEGATIVE',
            quote: 'Phòng Bẩn quá',
          },
        ],
        summary: 'Phòng bẩn',
        toneMismatch: false,
      });
      const service = buildService(generateJson);

      const result = await service.analyze(2, 'phòng bẩn quá, không hài lòng');

      expect(result?.aspects).toEqual([
        {
          topic: ReviewTopic.CLEANLINESS,
          sentiment: AspectSentiment.NEGATIVE,
          quote: 'Phòng Bẩn quá',
        },
      ]);
    });

    it('loại bỏ khía cạnh có quote KHÔNG thật sự nằm trong đánh giá gốc (model bịa chữ)', async () => {
      const generateJson = jest.fn().mockResolvedValue({
        aspects: [
          {
            topic: 'STAFF',
            sentiment: 'POSITIVE',
            quote: 'nhân viên siêu thân thiện',
          },
        ],
        summary: 'Tốt',
        toneMismatch: false,
      });
      const service = buildService(generateJson);

      // Đánh giá gốc không hề nhắc tới nhân viên — quote bịa phải bị loại.
      const result = await service.analyze(5, 'phòng đẹp, view biển tuyệt vời');

      expect(result?.aspects).toEqual([]);
    });

    it('quy chủ đề lạ (model tự bịa) về OTHER thay vì giữ nguyên giá trị không hợp lệ', async () => {
      const generateJson = jest.fn().mockResolvedValue({
        aspects: [
          {
            topic: 'PARKING_LOT_NOT_IN_ENUM',
            sentiment: 'NEGATIVE',
            quote: 'bãi xe chật',
          },
        ],
        summary: 'Bãi xe chật',
        toneMismatch: false,
      });
      const service = buildService(generateJson);

      const result = await service.analyze(3, 'bãi xe chật quá');

      expect(result?.aspects[0].topic).toBe(ReviewTopic.OTHER);
    });

    it('sentiment lạ/thiếu mặc định về POSITIVE (chỉ NEGATIVE mới cần khớp đúng chuỗi)', async () => {
      const generateJson = jest.fn().mockResolvedValue({
        aspects: [{ topic: 'WIFI', sentiment: 'khong-ro', quote: 'wifi ổn' }],
        summary: 'Wifi ổn',
        toneMismatch: false,
      });
      const service = buildService(generateJson);

      const result = await service.analyze(4, 'wifi ổn, dùng tốt');

      expect(result?.aspects[0].sentiment).toBe(AspectSentiment.POSITIVE);
    });

    it('aspects không phải mảng (model trả sai kiểu) -> coi như rỗng, không throw', async () => {
      const generateJson = jest.fn().mockResolvedValue({
        aspects: 'không phải mảng',
        summary: '',
        toneMismatch: false,
      });
      const service = buildService(generateJson);

      const result = await service.analyze(3, 'bình thường');

      expect(result?.aspects).toEqual([]);
    });

    it('Gemini trả về giá trị rỗng (null/undefined) -> vẫn trả về ReviewAnalysis hợp lệ, không throw', async () => {
      const generateJson = jest.fn().mockResolvedValue(null);
      const service = buildService(generateJson);

      const result = await service.analyze(3, 'bình thường');

      // Tách riêng analyzedAt (timestamp động, không so được bằng toEqual với giá trị
      // cố định) khỏi phần còn lại — gộp chung vào 1 object literal khiến
      // @typescript-eslint/no-unsafe-assignment bắt lỗi expect.any() trả về `any`.
      expect(typeof result?.analyzedAt).toBe('string');
      expect(result).toMatchObject({
        aspects: [],
        summary: '',
        toneMismatch: false,
      });
    });
  });

  describe('retry khi Gemini lỗi tạm thời', () => {
    // RETRY_DELAYS_MS thật (1s/3s/8s) sẽ làm test chạy quá timeout mặc định của Jest
    // (5s) nếu chờ thời gian thật — dùng fake timers, cùng cách ai-agent.service.spec.ts
    // đã làm cho chatWithRetry().
    afterEach(() => {
      jest.useRealTimers();
    });

    it('lỗi 503 thì thử lại rồi thành công, không trả về null', async () => {
      jest.useFakeTimers();
      const generateJson = jest
        .fn()
        .mockRejectedValueOnce(
          Object.assign(new Error('quá tải'), { status: 503 }),
        )
        .mockResolvedValueOnce({
          aspects: [],
          summary: 'ok',
          toneMismatch: false,
        });
      const service = buildService(generateJson);

      const pending = service.analyze(4, 'bình thường');
      await jest.advanceTimersByTimeAsync(1000);
      const result = await pending;

      expect(generateJson).toHaveBeenCalledTimes(2);
      expect(result).not.toBeNull();
    });

    it('lỗi không thuộc danh sách retryable (VD 400) thì KHÔNG thử lại, trả về null ngay', async () => {
      const generateJson = jest
        .fn()
        .mockRejectedValue(
          Object.assign(new Error('bad request'), { status: 400 }),
        );
      const service = buildService(generateJson);

      const result = await service.analyze(4, 'bình thường');

      expect(generateJson).toHaveBeenCalledTimes(1);
      expect(result).toBeNull();
    });

    it('hết số lần thử lại vẫn lỗi -> trả về null thay vì ném lỗi (không được làm hỏng việc gửi đánh giá)', async () => {
      jest.useFakeTimers();
      const generateJson = jest
        .fn()
        .mockRejectedValue(
          Object.assign(new Error('luôn quá tải'), { status: 503 }),
        );
      const service = buildService(generateJson);

      const pending = service.analyze(4, 'bình thường');
      // 3 lần thử lại của RETRY_DELAYS_MS = [1000, 3000, 8000] -> tua qua từng nhịp.
      await jest.advanceTimersByTimeAsync(1000);
      await jest.advanceTimersByTimeAsync(3000);
      await jest.advanceTimersByTimeAsync(8000);
      const result = await pending;

      expect(generateJson).toHaveBeenCalledTimes(4);
      expect(result).toBeNull();
    });
  });
});
