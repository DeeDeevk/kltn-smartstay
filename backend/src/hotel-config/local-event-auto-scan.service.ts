import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Redis from 'ioredis';
import { REDIS_CLIENT } from 'src/redis/redis.module';
import { LocalEvent } from './entities/local-event.entity';
import { EventScanRun } from './entities/event-scan-run.entity';
import { LocalEventSource } from 'src/common/enums/local-event-source.enum';
import { LocalEventStatus } from 'src/common/enums/local-event-status.enum';
import { EventScanTriggeredBy } from 'src/common/enums/event-scan-triggered-by.enum';
import { EventScanStatus } from 'src/common/enums/event-scan-status.enum';
import { HotelConfigService } from './hotel-config.service';
import { GeminiProvider } from 'src/ai-agent/llm/gemini.provider';
import { LocalEventExtractionService } from './local-event-extraction.service';

// MỞ RỘNG NGOÀI PHẠM VI SRS GỐC (SRS ghi rõ "không tự động tổng hợp sự kiện từ nguồn
// ngoài"). Khác với LocalEventExtractionService (admin chủ động dán link/text/file —
// "AI hỗ trợ nhập liệu"), tính năng NÀY để hệ thống chủ động tự tìm nguồn thay cho admin,
// theo lịch (cron hàng tuần) hoặc theo yêu cầu (admin bấm "Quét ngay") — đây mới thực sự là
// bước "tự động tổng hợp sự kiện từ nguồn ngoài" mà SRS nói tới. Vẫn được đánh giá là chấp
// nhận được (không phải "tự động hoá hoàn toàn" không kiểm soát) vì 2 lý do, ghi rõ ở đây
// để dùng cho báo cáo khoá luận:
//   1. Kết quả LUÔN ở trạng thái PENDING (source = AI_SUGGESTED) — get_local_events (tool
//      của agent AI) chỉ đọc status = APPROVED, nên KHÔNG có sự kiện nào từ lần quét tự
//      động này lộ ra cho khách cho tới khi admin chủ động vào tab "Chờ duyệt" và bấm
//      "Duyệt" từng cái một — con người vẫn là lớp kiểm soát cuối cùng trước khi dữ liệu
//      AI tạo ra ảnh hưởng tới trải nghiệm khách thật.
//   2. Mỗi lần quét đều ghi lại đầy đủ "nguồn trích dẫn" (citations: URL + tiêu đề mà
//      Gemini search-grounding đã dùng để tổng hợp câu trả lời) vào EventScanRun — không
//      phải hộp đen, admin xem được chính xác AI đã dựa vào nguồn nào khi đề xuất sự kiện.
@Injectable()
export class LocalEventAutoScanService {
  private readonly logger = new Logger(LocalEventAutoScanService.name);

  private static readonly MIN_RANGE_DAYS = 1;
  private static readonly MAX_RANGE_DAYS = 60;
  private static readonly LOCK_KEY = 'local-event-auto-scan:lock';
  // Đủ rộng cho cả thời gian gọi Gemini (có retry) lẫn bước lưu DB — nếu tiến trình chết
  // giữa chừng mà không kịp giải phóng khoá ở finally, khoá tự hết hạn sau ngần này thay vì
  // kẹt vĩnh viễn.
  private static readonly LOCK_TTL_SECONDS = 300;

  private static readonly RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);
  private static readonly RETRY_DELAYS_MS = [1000, 3000, 8000];

  constructor(
    @InjectRepository(LocalEvent)
    private readonly localEventRepo: Repository<LocalEvent>,
    @InjectRepository(EventScanRun)
    private readonly scanRunRepo: Repository<EventScanRun>,
    @Inject(REDIS_CLIENT) private readonly redisClient: Redis,
    private readonly hotelConfigService: HotelConfigService,
    private readonly geminiProvider: GeminiProvider,
    // Tái dùng pipeline "text -> Gemini -> sanitize" có sẵn thay vì chép lại
    // EXTRACTION_SYSTEM_PROMPT/logic lọc kết quả — xem extractDraftsFromContent().
    private readonly extractionService: LocalEventExtractionService,
  ) {}

  async scan(
    fromDate: string,
    toDate: string,
    triggeredBy: EventScanTriggeredBy,
    triggeredByUserId: string | null,
  ): Promise<EventScanRun> {
    this.assertValidRange(fromDate, toDate);

    const locked = await this.acquireLock();
    if (!locked) {
      throw new BadRequestException(
        'Đang có một lượt quét sự kiện khác chạy, vui lòng thử lại sau.',
      );
    }

    try {
      return await this.runScan(
        fromDate,
        toDate,
        triggeredBy,
        triggeredByUserId,
      );
    } finally {
      await this.releaseLock();
    }
  }

  // toDate > fromDate và khoảng cách trong [1, 60] ngày — validate TRƯỚC khi giành khoá/gọi
  // Gemini, không để 1 request sai định dạng chiếm khoá của lượt quét hợp lệ khác.
  private assertValidRange(fromDate: string, toDate: string): void {
    const from = new Date(`${fromDate}T00:00:00Z`);
    const to = new Date(`${toDate}T00:00:00Z`);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      throw new BadRequestException('Ngày không hợp lệ.');
    }
    const diffDays = Math.round((to.getTime() - from.getTime()) / 86_400_000);
    if (diffDays <= 0) {
      throw new BadRequestException('Ngày kết thúc phải sau ngày bắt đầu.');
    }
    if (
      diffDays < LocalEventAutoScanService.MIN_RANGE_DAYS ||
      diffDays > LocalEventAutoScanService.MAX_RANGE_DAYS
    ) {
      throw new BadRequestException(
        `Khoảng ngày quét phải từ ${LocalEventAutoScanService.MIN_RANGE_DAYS} đến ${LocalEventAutoScanService.MAX_RANGE_DAYS} ngày.`,
      );
    }
  }

  private async acquireLock(): Promise<boolean> {
    const result = await this.redisClient.set(
      LocalEventAutoScanService.LOCK_KEY,
      '1',
      'EX',
      LocalEventAutoScanService.LOCK_TTL_SECONDS,
      'NX',
    );
    return result === 'OK';
  }

  private async releaseLock(): Promise<void> {
    await this.redisClient.del(LocalEventAutoScanService.LOCK_KEY);
  }

  private async runScan(
    fromDate: string,
    toDate: string,
    triggeredBy: EventScanTriggeredBy,
    triggeredByUserId: string | null,
  ): Promise<EventScanRun> {
    const hotelConfig = await this.hotelConfigService.getOrCreate();
    const configured = !(
      hotelConfig.latitude === 0 && hotelConfig.longitude === 0
    );
    if (!configured) {
      // Dừng TRƯỚC khi gọi Gemini — không có địa chỉ thì câu tìm kiếm vô nghĩa, và gọi
      // search-grounding tốn quota hơn hẳn 1 lệnh gọi JSON thường.
      return this.saveRun({
        fromDate,
        toDate,
        triggeredBy,
        triggeredByUserId,
        status: EventScanStatus.FAILED,
        errorMessage:
          'Chưa cấu hình địa chỉ khách sạn (mục Vị trí khách sạn) nên không thể tìm sự kiện xung quanh.',
        citations: [],
        createdEventsCount: 0,
        skippedDuplicateCount: 0,
      });
    }

    const prompt = `Tìm các sự kiện, lễ hội, hoạt động giải trí nổi bật diễn ra gần ${hotelConfig.address} trong khoảng từ ${fromDate} đến ${toDate}. Liệt kê tên sự kiện, thời gian cụ thể, mô tả ngắn, chỉ dựa trên kết quả tìm kiếm thực tế, không suy đoán.`;

    let searchResult: {
      text: string;
      citations: { url: string; title: string }[];
    };
    try {
      searchResult = await this.generateWithSearchRetry(prompt);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Auto-scan search-grounding failed: ${message}`);
      return this.saveRun({
        fromDate,
        toDate,
        triggeredBy,
        triggeredByUserId,
        status: EventScanStatus.FAILED,
        errorMessage:
          'Không tìm kiếm được sự kiện lúc này, vui lòng thử lại sau.',
        citations: [],
        createdEventsCount: 0,
        skippedDuplicateCount: 0,
      });
    }

    try {
      const drafts = await this.extractionService.extractDraftsFromContent(
        searchResult.text,
      );
      const { created, skippedDuplicateCount } = await this.saveDedupedDrafts(
        drafts,
        fromDate,
        toDate,
      );
      return this.saveRun({
        fromDate,
        toDate,
        triggeredBy,
        triggeredByUserId,
        status: EventScanStatus.SUCCESS,
        errorMessage: null,
        citations: searchResult.citations,
        createdEventsCount: created,
        skippedDuplicateCount,
      });
    } catch (err) {
      // extractDraftsFromContent() ném BadRequestException khi Gemini không tìm thấy sự
      // kiện nào trong văn bản search-grounded — đây KHÔNG phải lỗi hệ thống, chỉ đơn giản
      // là không có sự kiện nào trong khoảng ngày đó. Vẫn ghi SUCCESS (quét thành công,
      // chỉ là 0 kết quả) để không làm admin tưởng nhầm có sự cố kỹ thuật, nhưng giữ lại
      // citations để biết Gemini đã thực sự tìm kiếm (nếu có).
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Auto-scan found no events to save: ${message}`);
      return this.saveRun({
        fromDate,
        toDate,
        triggeredBy,
        triggeredByUserId,
        status: EventScanStatus.SUCCESS,
        errorMessage: null,
        citations: searchResult.citations,
        createdEventsCount: 0,
        skippedDuplicateCount: 0,
      });
    }
  }

  private async generateWithSearchRetry(
    prompt: string,
  ): Promise<{ text: string; citations: { url: string; title: string }[] }> {
    for (let attempt = 0; ; attempt += 1) {
      try {
        return await this.geminiProvider.generateWithSearch(prompt);
      } catch (err) {
        const status = (err as { status?: number })?.status;
        const retryable =
          status === undefined ||
          LocalEventAutoScanService.RETRYABLE_STATUS.has(status);
        if (
          !retryable ||
          attempt >= LocalEventAutoScanService.RETRY_DELAYS_MS.length
        ) {
          throw err;
        }
        this.logger.warn(
          `Gemini search-grounding call failed${status ? ` (status ${status})` : ''}, retrying (${attempt + 1}/${LocalEventAutoScanService.RETRY_DELAYS_MS.length})`,
        );
        await new Promise((resolve) =>
          setTimeout(
            resolve,
            LocalEventAutoScanService.RETRY_DELAYS_MS[attempt],
          ),
        );
      }
    }
  }

  // Chống trùng: so title (chuẩn hoá) VÀ (specificDate trùng HOẶC dayOfWeek trùng) với
  // LocalEvent đã có — BẤT KỲ status nào (kể cả PENDING/đã bị từ chối-xoá thì không còn
  // trong DB nên tự động không tính), tránh 2 lần quét trùng khoảng ngày tạo ra 2 bản ghi
  // y hệt nhau cho admin duyệt 2 lần. Nạp toàn bộ LocalEvent 1 lần (bảng này nhỏ, vài chục
  // dòng là nhiều) thay vì query riêng cho từng draft — tránh N+1.
  private async saveDedupedDrafts(
    drafts: Pick<
      LocalEvent,
      'title' | 'description' | 'recurrence' | 'dayOfWeek' | 'specificDate'
    >[],
    fromDate: string,
    toDate: string,
  ): Promise<{ created: number; skippedDuplicateCount: number }> {
    const existing = await this.localEventRepo.find({
      select: { title: true, specificDate: true, dayOfWeek: true },
    });
    const existingNormalized = existing.map((e) => ({
      title: this.normalizeTitle(e.title),
      specificDate: e.specificDate,
      dayOfWeek: e.dayOfWeek,
    }));

    const sourceRef = `Quét tự động (${fromDate} → ${toDate})`;
    let skippedDuplicateCount = 0;
    const toCreate: typeof drafts = [];

    for (const draft of drafts) {
      const normalizedTitle = this.normalizeTitle(draft.title);
      const isDuplicate = existingNormalized.some((e) => {
        if (e.title !== normalizedTitle) return false;
        if (draft.specificDate && e.specificDate === draft.specificDate) {
          return true;
        }
        if (
          draft.dayOfWeek !== null &&
          draft.dayOfWeek !== undefined &&
          e.dayOfWeek === draft.dayOfWeek
        ) {
          return true;
        }
        return false;
      });

      if (isDuplicate) {
        skippedDuplicateCount += 1;
        continue;
      }
      toCreate.push(draft);
      // Thêm ngay vào existingNormalized để 2 draft TRÙNG NHAU trong CÙNG 1 lần quét
      // (Gemini lặp lại cùng 1 sự kiện 2 lần trong câu trả lời) cũng bị phát hiện, không
      // chỉ so với dữ liệu đã có từ trước.
      existingNormalized.push({
        title: normalizedTitle,
        specificDate: draft.specificDate,
        dayOfWeek: draft.dayOfWeek,
      });
    }

    if (toCreate.length === 0) {
      return { created: 0, skippedDuplicateCount };
    }

    const events = toCreate.map((draft) =>
      this.localEventRepo.create({
        ...draft,
        source: LocalEventSource.AI_SUGGESTED,
        status: LocalEventStatus.PENDING,
        sourceRef,
      }),
    );
    const saved = await this.localEventRepo.save(events);
    return { created: saved.length, skippedDuplicateCount };
  }

  private normalizeTitle(title: string): string {
    return title.toLowerCase().trim().replace(/\s+/g, ' ');
  }

  private async saveRun(data: {
    fromDate: string;
    toDate: string;
    triggeredBy: EventScanTriggeredBy;
    triggeredByUserId: string | null;
    status: EventScanStatus;
    errorMessage: string | null;
    citations: { url: string; title: string }[];
    createdEventsCount: number;
    skippedDuplicateCount: number;
  }): Promise<EventScanRun> {
    const run = this.scanRunRepo.create(data);
    return this.scanRunRepo.save(run);
  }
}
