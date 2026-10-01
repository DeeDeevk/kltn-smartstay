import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LocalEvent } from './entities/local-event.entity';
import { ExtractLocalEventsDto } from './dto/extract-local-events.dto';
import { EventRecurrence } from 'src/common/enums/event-recurrence.enum';
import { LocalEventSource } from 'src/common/enums/local-event-source.enum';
import { LocalEventStatus } from 'src/common/enums/local-event-status.enum';
import { GeminiProvider } from 'src/ai-agent/llm/gemini.provider';
import { SourceContentService } from './source-content.service';

// Mở rộng ngoài phạm vi SRS (SRS ghi rõ "không tự động tổng hợp sự kiện từ nguồn ngoài").
// Được đánh giá là vẫn nằm trong ranh giới đó vì tính năng không bao giờ tự chạy một
// mình: admin phải chủ động dán link/text/tải file lên VÀ tự bấm "Duyệt" riêng từng sự
// kiện thì get_local_events mới thấy được (LocalEventService.findForDate lọc theo
// status = APPROVED) — đây là "AI hỗ trợ nhập liệu, có con người duyệt lại", không phải
// thu thập tự động. Ghi chú rõ ở đây để review PR/code chú ý, vì đây là phần vượt khỏi
// phạm vi SRS gốc.

// Gửi cho Gemini làm system instruction cho generateJson() — cố tình viết chặt chẽ: chỉ
// trích xuất, không bịa sự kiện, không dùng kiến thức ngoài văn bản, để trống trường ngày
// (không tự đoán) khi bản thân văn bản nguồn không rõ ràng.
const EXTRACTION_SYSTEM_PROMPT = `Bạn là công cụ trích xuất sự kiện địa phương từ văn bản. CHỈ trích xuất
các sự kiện có ngày/thời gian được nêu trong văn bản được cung cấp bên dưới. TUYỆT ĐỐI KHÔNG
suy đoán, KHÔNG bịa thêm sự kiện không có trong văn bản, KHÔNG dùng kiến thức bên ngoài văn
bản này. Nếu văn bản không có sự kiện nào, trả về mảng rỗng [].

Với mỗi sự kiện tìm được, xác định:
- title: tên sự kiện, ngắn gọn.
- description: mô tả ngắn (địa điểm, giờ, giá vé... nếu văn bản có nêu).
- isRecurring: true nếu sự kiện lặp lại theo thứ trong tuần (VD "mỗi thứ Bảy"), false nếu
  chỉ diễn ra một lần hoặc không rõ.
- dayOfWeek: chỉ điền khi isRecurring = true, số từ 0-6 (0 = Chủ Nhật, 1 = Thứ Hai, ...,
  6 = Thứ Bảy); các trường hợp khác để null.
- specificDate: chỉ điền khi isRecurring = false VÀ văn bản nêu rõ ngày cụ thể, định dạng
  YYYY-MM-DD; TUYỆT ĐỐI không tự đoán năm nếu văn bản không nêu rõ năm — để null nếu vậy.

Nếu ngày của một sự kiện không đủ rõ ràng để điền dayOfWeek/specificDate, VẪN trả về sự
kiện đó (không bỏ qua) nhưng để 2 trường ngày = null, và ghi chú trong description phần
thông tin ngày còn thiếu để người duyệt tự bổ sung.

Trả về ĐÚNG một mảng JSON, không kèm giải thích hay markdown, đúng khuôn dạng:
[{ "title": string, "description": string, "isRecurring": boolean, "dayOfWeek": number | null, "specificDate": string | null }]`;

// Lỗi tạm thời từ Gemini (quá tải/giới hạn tần suất) — đáng để thử lại thay vì báo lỗi
// ngay cho admin. Cùng danh sách mã lỗi và độ trễ như AiAgentService.chatWithRetry() (2
// file khác nhau, không share hằng số vì đó là private const của ai-agent.service.ts —
// nhưng cùng nguyên tắc, nên giữ giống nhau để dễ hiểu).
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);
const RETRY_DELAYS_MS = [1000, 3000];

// Số ký tự của text nguồn thực sự gửi cho Gemini — giữ prompt nhỏ/rẻ và giới hạn chi phí
// bất kể link/đoạn dán của admin dài bao nhiêu.
const MAX_CONTENT_LENGTH = 20_000;
// LocalEvent.sourceRef là kiểu `text` (không giới hạn) nhưng không có lý do gì để lưu
// nhiều hơn mức admin cần để đối chiếu lại 1 đề xuất.
const MAX_SOURCE_REF_LENGTH = 2000;
const TITLE_MAX_LENGTH = 200;

interface RawExtractedEvent {
  title?: unknown;
  description?: unknown;
  isRecurring?: unknown;
  dayOfWeek?: unknown;
  specificDate?: unknown;
}

@Injectable()
export class LocalEventExtractionService {
  private readonly logger = new Logger(LocalEventExtractionService.name);

  constructor(
    @InjectRepository(LocalEvent)
    private readonly localEventRepo: Repository<LocalEvent>,
    // Inject trực tiếp (không qua interface LLM_PROVIDER) — xem chú thích ở LlmModule:
    // trích xuất là 1 lệnh gọi JSON one-shot, khác hẳn vòng lặp chat gọi-tool của agent
    // mà LlmProvider mô hình hoá, và tính năng này được chấp nhận gắn cứng với Gemini
    // cho hiện tại.
    private readonly geminiProvider: GeminiProvider,
    // Tách phần "đọc link/file ra text thuần" (fetch + SSRF guard + bóc PDF/DOCX) thành
    // service riêng, dùng chung với LocalPlaceExtractionService — xem
    // source-content.service.ts.
    private readonly sourceContentService: SourceContentService,
  ) {}

  async extract(dto: ExtractLocalEventsDto): Promise<LocalEvent[]> {
    if (Boolean(dto.url) === Boolean(dto.text)) {
      throw new BadRequestException(
        'Vui lòng cung cấp đúng một trong hai: link hoặc nội dung văn bản.',
      );
    }

    const rawContent = dto.url
      ? await this.sourceContentService.readUrlText(dto.url)
      : (dto.text as string);
    const sourceRef = dto.url ?? dto.text ?? '';
    return this.extractFromContent(rawContent, sourceRef);
  }

  // Đọc file admin tải lên (.pdf/.docx/.txt), bóc ra text thuần rồi đưa qua cùng luồng
  // trích xuất như link/text (extractFromContent) — không viết lại logic gọi Gemini/lọc
  // kết quả riêng cho file, tránh 2 nơi cùng chỉnh 1 hành vi mà chỉ sửa 1.
  async extractFromFile(file: Express.Multer.File): Promise<LocalEvent[]> {
    const text = await this.sourceContentService.readFileText(file);
    return this.extractFromContent(text, file.originalname);
  }

  // Thử lại khi Gemini lỗi tạm thời (quá tải/giới hạn tần suất) trước khi báo lỗi cho
  // admin — không có bước này thì 1 lần Gemini nghẽn thoáng qua (thực tế đã gặp: lỗi 503
  // "currently experiencing high demand" khi test trực tiếp) sẽ làm cả lượt trích xuất
  // thất bại ngay, admin phải tự bấm lại từ đầu dù chỉ cần đợi vài giây là qua.
  private async generateJsonWithRetry(content: string): Promise<unknown> {
    for (let attempt = 0; ; attempt += 1) {
      try {
        return await this.geminiProvider.generateJson(
          EXTRACTION_SYSTEM_PROMPT,
          content,
        );
      } catch (err) {
        const status = (err as { status?: number })?.status;
        const retryable = status === undefined || RETRYABLE_STATUS.has(status);
        const message = err instanceof Error ? err.message : String(err);
        if (!retryable || attempt >= RETRY_DELAYS_MS.length) {
          this.logger.error(
            `Local event extraction failed${status ? ` (status ${status})` : ''}: ${message}`,
          );
          throw new BadRequestException('Không đọc được nội dung nguồn này.');
        }
        this.logger.warn(
          `Local event extraction call failed${status ? ` (status ${status})` : ''}, retrying (${attempt + 1}/${RETRY_DELAYS_MS.length}): ${message}`,
        );
        await new Promise((resolve) =>
          setTimeout(resolve, RETRY_DELAYS_MS[attempt]),
        );
      }
    }
  }

  // Dùng chung cho cả 3 nguồn (link, text dán tay, file tải lên): cắt bớt nội dung, gọi
  // Gemini, kiểm tra/lọc kết quả rồi lưu thành các dòng LocalEvent status=pending.
  private async extractFromContent(
    rawContent: string,
    sourceRefInput: string,
  ): Promise<LocalEvent[]> {
    const drafts = await this.extractDraftsFromContent(rawContent);
    const sourceRef = sourceRefInput.slice(0, MAX_SOURCE_REF_LENGTH);

    const events = drafts.map((draft) =>
      this.localEventRepo.create({
        ...draft,
        source: LocalEventSource.AI_SUGGESTED,
        status: LocalEventStatus.PENDING,
        sourceRef,
      }),
    );
    return this.localEventRepo.save(events);
  }

  // Public để LocalEventAutoScanService tái dùng ĐÚNG pipeline "text -> Gemini -> sanitize"
  // (cắt nội dung, EXTRACTION_SYSTEM_PROMPT, retry, lọc kết quả) thay vì chép lại logic —
  // khác với extractFromContent() ở trên, hàm này KHÔNG lưu DB: auto-scan cần tự kiểm tra
  // trùng lặp với toàn bộ LocalEvent hiện có trước khi lưu, extractFromContent() không có
  // bước đó (luồng trích xuất thủ công vốn luôn do admin tự xem lại từng cái).
  async extractDraftsFromContent(
    rawContent: string,
  ): Promise<
    Pick<
      LocalEvent,
      'title' | 'description' | 'recurrence' | 'dayOfWeek' | 'specificDate'
    >[]
  > {
    const content = rawContent.slice(0, MAX_CONTENT_LENGTH);
    const parsed = await this.generateJsonWithRetry(content);

    if (!Array.isArray(parsed)) {
      this.logger.warn(
        `Gemini returned non-array for local event extraction: ${JSON.stringify(parsed).slice(0, 200)}`,
      );
      throw new BadRequestException(
        'Không tìm thấy sự kiện nào trong nguồn này.',
      );
    }

    const drafts = (parsed as RawExtractedEvent[])
      .map((raw) => this.sanitizeExtractedEvent(raw))
      .filter((draft): draft is NonNullable<typeof draft> => draft !== null);

    if (drafts.length === 0) {
      throw new BadRequestException(
        'Không tìm thấy sự kiện nào trong nguồn này.',
      );
    }
    return drafts;
  }

  // Không bao giờ tin mù quáng vào cấu trúc JSON Gemini trả về — mọi trường đều được
  // kiểm tra kiểu/định dạng ở đây trước khi trở thành 1 dòng DB. Chỉ trả về null (bỏ
  // item) khi thiếu/rỗng title; ngày thiếu/mơ hồ vẫn được giữ lại (theo đúng
  // EXTRACTION_SYSTEM_PROMPT) vì đó là luồng "admin tự bổ sung sau" đã tài liệu hoá, được
  // chặn lại ở LocalEventService.approve().
  private sanitizeExtractedEvent(
    raw: RawExtractedEvent,
  ): Pick<
    LocalEvent,
    'title' | 'description' | 'recurrence' | 'dayOfWeek' | 'specificDate'
  > | null {
    const title =
      typeof raw.title === 'string'
        ? raw.title.trim().slice(0, TITLE_MAX_LENGTH)
        : '';
    if (!title) return null;

    const description =
      typeof raw.description === 'string' && raw.description.trim()
        ? raw.description.trim()
        : null;

    const dayOfWeek =
      typeof raw.dayOfWeek === 'number' &&
      Number.isInteger(raw.dayOfWeek) &&
      raw.dayOfWeek >= 0 &&
      raw.dayOfWeek <= 6
        ? raw.dayOfWeek
        : null;
    const specificDate =
      typeof raw.specificDate === 'string' &&
      /^\d{4}-\d{2}-\d{2}$/.test(raw.specificDate)
        ? raw.specificDate
        : null;

    // isRecurring chỉ có hiệu lực khi đi kèm dayOfWeek hợp lệ — "isRecurring: true" mà
    // không có dayOfWeek dùng được chính là trường hợp "ngày không rõ", được lưu như
    // ONCE với specificDate để null (xem chú thích đầu class để hiểu vì sao không thể
    // để trống hẳn recurrence: cột này NOT NULL và tính năng này cố tình không đổi điều
    // đó).
    const isRecurring = raw.isRecurring === true && dayOfWeek !== null;

    return {
      title,
      description,
      recurrence: isRecurring ? EventRecurrence.WEEKLY : EventRecurrence.ONCE,
      dayOfWeek: isRecurring ? dayOfWeek : null,
      specificDate: isRecurring ? null : specificDate,
    };
  }
}
