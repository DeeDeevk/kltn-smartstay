import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as cheerio from 'cheerio';
import { PDFParse } from 'pdf-parse';
import * as mammoth from 'mammoth';
import { LocalEvent } from './entities/local-event.entity';
import { ExtractLocalEventsDto } from './dto/extract-local-events.dto';
import { EventRecurrence } from 'src/common/enums/event-recurrence.enum';
import { LocalEventSource } from 'src/common/enums/local-event-source.enum';
import { LocalEventStatus } from 'src/common/enums/local-event-status.enum';
import { GeminiProvider } from 'src/ai-agent/llm/gemini.provider';

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

const FETCH_TIMEOUT_MS = 10_000;
// Số ký tự của text nguồn thực sự gửi cho Gemini — giữ prompt nhỏ/rẻ và giới hạn chi phí
// bất kể link/đoạn dán của admin dài bao nhiêu.
const MAX_CONTENT_LENGTH = 20_000;
// LocalEvent.sourceRef là kiểu `text` (không giới hạn) nhưng không có lý do gì để lưu
// nhiều hơn mức admin cần để đối chiếu lại 1 đề xuất.
const MAX_SOURCE_REF_LENGTH = 2000;
const TITLE_MAX_LENGTH = 200;
// Đuôi file được chấp nhận cho luồng tải file lên — kiểm tra theo đuôi tên file thay vì
// mimetype vì nhiều trình duyệt/hệ điều hành gửi mimetype không nhất quán cho .docx.
const SUPPORTED_FILE_EXTENSIONS = ['.pdf', '.docx', '.txt'];
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

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
  ) {}

  async extract(dto: ExtractLocalEventsDto): Promise<LocalEvent[]> {
    if (Boolean(dto.url) === Boolean(dto.text)) {
      throw new BadRequestException(
        'Vui lòng cung cấp đúng một trong hai: link hoặc nội dung văn bản.',
      );
    }

    const rawContent = dto.url
      ? await this.fetchUrlText(dto.url)
      : (dto.text as string);
    const sourceRef = dto.url ?? dto.text ?? '';
    return this.extractFromContent(rawContent, sourceRef);
  }

  // Đọc file admin tải lên (.pdf/.docx/.txt), bóc ra text thuần rồi đưa qua cùng luồng
  // trích xuất như link/text (extractFromContent) — không viết lại logic gọi Gemini/lọc
  // kết quả riêng cho file, tránh 2 nơi cùng chỉnh 1 hành vi mà chỉ sửa 1.
  async extractFromFile(file: Express.Multer.File): Promise<LocalEvent[]> {
    if (!file) {
      throw new BadRequestException('Vui lòng chọn file cần trích xuất.');
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      throw new BadRequestException(
        `File vượt quá dung lượng cho phép (tối đa ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB).`,
      );
    }

    const ext = this.getFileExtension(file.originalname);
    if (!SUPPORTED_FILE_EXTENSIONS.includes(ext)) {
      throw new BadRequestException(
        `Định dạng file không được hỗ trợ (chỉ nhận ${SUPPORTED_FILE_EXTENSIONS.join(', ')}).`,
      );
    }

    const text = await this.extractTextFromFile(file.buffer, ext);
    if (!text.trim()) {
      throw new BadRequestException('Không đọc được nội dung từ file này.');
    }

    return this.extractFromContent(text, file.originalname);
  }

  private getFileExtension(filename: string): string {
    const idx = filename.lastIndexOf('.');
    return idx === -1 ? '' : filename.slice(idx).toLowerCase();
  }

  // Mỗi định dạng có 1 cách bóc text riêng, nhưng đều trả về cùng 1 kiểu string thuần để
  // extractFromContent xử lý tiếp giống hệt nhau, không cần biết nguồn gốc từ đâu.
  private async extractTextFromFile(
    buffer: Buffer,
    ext: string,
  ): Promise<string> {
    try {
      if (ext === '.txt') {
        return buffer.toString('utf-8');
      }
      if (ext === '.pdf') {
        const parser = new PDFParse({ data: buffer });
        try {
          const result = await parser.getText();
          // pdf-parse chèn dòng phân trang dạng "-- 1 of 3 --" giữa các trang — không
          // phải nội dung thật, lọc bỏ trước khi đưa cho Gemini.
          return result.text.replace(/--\s*\d+\s*of\s*\d+\s*--/g, ' ');
        } finally {
          await parser.destroy();
        }
      }
      if (ext === '.docx') {
        const result = await mammoth.extractRawText({ buffer });
        return result.value;
      }
    } catch (err) {
      this.logger.warn(
        `Failed to extract text from uploaded file (${ext}): ${err instanceof Error ? err.message : String(err)}`,
      );
      throw new BadRequestException('Không đọc được nội dung từ file này.');
    }
    // Không bao giờ tới đây vì ext đã được kiểm tra nằm trong SUPPORTED_FILE_EXTENSIONS
    // ở extractFromFile, nhưng vẫn cần trả về cho TypeScript thấy đủ nhánh.
    return '';
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
    const content = rawContent.slice(0, MAX_CONTENT_LENGTH);
    const sourceRef = sourceRefInput.slice(0, MAX_SOURCE_REF_LENGTH);

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

  // Chặn SSRF ở mức cơ bản: từ chối các dạng hostname nội bộ/loopback rõ ràng. Không phải
  // phòng thủ toàn diện (không resolve DNS để bắt trường hợp 1 domain công khai rebind
  // sang IP nội bộ) — mức độ này phù hợp vì đây là endpoint chỉ admin mới gọi được và
  // phải chủ động kích hoạt (không phải input công khai), đúng theo yêu cầu ban đầu là
  // "chặn cơ bản".
  private assertNotPrivateHost(hostname: string): void {
    const lower = hostname.toLowerCase();
    const isPrivate =
      lower === 'localhost' ||
      lower === '0.0.0.0' ||
      lower === '::1' ||
      lower.endsWith('.local') ||
      /^127\./.test(lower) ||
      /^10\./.test(lower) ||
      /^192\.168\./.test(lower) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(lower);
    if (isPrivate) {
      throw new BadRequestException(
        'Không được phép trích xuất từ địa chỉ nội bộ.',
      );
    }
  }

  private async fetchUrlText(urlStr: string): Promise<string> {
    const parsed = new URL(urlStr);
    this.assertNotPrivateHost(parsed.hostname);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let html: string;
    try {
      const res = await fetch(parsed.toString(), {
        signal: controller.signal,
        redirect: 'follow',
        headers: { 'User-Agent': 'VikaHotel-LocalEventBot/1.0' },
      });
      if (!res.ok) {
        throw new BadRequestException(
          `Không tải được nội dung từ link (HTTP ${res.status}).`,
        );
      }
      html = await res.text();
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      this.logger.warn(
        `Failed to fetch URL for local event extraction: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw new BadRequestException('Không tải được nội dung từ link này.');
    } finally {
      clearTimeout(timeout);
    }

    const $ = cheerio.load(html);
    $('script, style, nav, header, footer, noscript, svg, iframe').remove();
    const text = $('body').text().replace(/\s+/g, ' ').trim();
    if (!text) {
      throw new BadRequestException('Không đọc được nội dung từ link này.');
    }
    return text;
  }
}
