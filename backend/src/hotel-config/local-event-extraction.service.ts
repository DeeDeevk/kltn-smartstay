import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as cheerio from 'cheerio';
import { LocalEvent } from './entities/local-event.entity';
import { ExtractLocalEventsDto } from './dto/extract-local-events.dto';
import { EventRecurrence } from 'src/common/enums/event-recurrence.enum';
import { LocalEventSource } from 'src/common/enums/local-event-source.enum';
import { LocalEventStatus } from 'src/common/enums/local-event-status.enum';
import { GeminiProvider } from 'src/ai-agent/llm/gemini.provider';

// Out-of-SRS extension (SRS explicitly says "không tự động tổng hợp sự kiện từ nguồn
// ngoài" — no automatic aggregation from external sources). This is judged to stay within
// that boundary because it never runs on its own: an admin must actively paste a
// link/text AND separately click "Duyệt" per event before get_local_events can ever see
// it (LocalEventService.findForDate filters status = APPROVED) — this is "AI-assisted data
// entry with human review", not autonomous collection. Flagging this clearly for the PR/
// code review since it goes beyond what the original SRS scoped.

// Sent to Gemini as the system instruction for generateJson() — deliberately strict:
// extraction-only, no invented events, no outside knowledge, blank date fields (not a
// guessed date) when the source text itself is ambiguous.
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

const FETCH_TIMEOUT_MS = 10_000;
// Characters of source text actually sent to Gemini — keeps the prompt small/cheap and
// bounds cost regardless of how long the admin's link/paste is.
const MAX_CONTENT_LENGTH = 20_000;
// LocalEvent.sourceRef is `text` (unbounded) but there's no reason to store more than
// admins would ever need to cross-check a suggestion against.
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
    // Injected directly (not through the LLM_PROVIDER interface) — see LlmModule's
    // comment: extraction is a one-shot JSON call, not the agent's tool-calling chat
    // loop that LlmProvider models, and this feature is explicitly OK being Gemini-
    // specific for now.
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
    const content = rawContent.slice(0, MAX_CONTENT_LENGTH);
    const sourceRef = (dto.url ?? dto.text ?? '').slice(
      0,
      MAX_SOURCE_REF_LENGTH,
    );

    let parsed: unknown;
    try {
      parsed = await this.geminiProvider.generateJson(
        EXTRACTION_SYSTEM_PROMPT,
        content,
      );
    } catch (err) {
      this.logger.error(
        `Local event extraction failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw new BadRequestException('Không đọc được nội dung nguồn này.');
    }

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

  // Never trusts Gemini's JSON shape blindly — every field is type/format-checked here
  // before it can become a DB row. Returns null (item dropped) only when title is missing/
  // empty; a missing/ambiguous date is kept (per EXTRACTION_SYSTEM_PROMPT) since that's the
  // documented "admin fills it in later" path, gated by LocalEventService.approve().
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

    // isRecurring only takes effect when it's paired with a valid dayOfWeek — an
    // "isRecurring: true" with no usable dayOfWeek is exactly the "date unclear" case,
    // stored as ONCE with specificDate left null (see class comment on why recurrence
    // can't just be left unset: the column is NOT NULL and this feature intentionally
    // avoids changing that).
    const isRecurring = raw.isRecurring === true && dayOfWeek !== null;

    return {
      title,
      description,
      recurrence: isRecurring ? EventRecurrence.WEEKLY : EventRecurrence.ONCE,
      dayOfWeek: isRecurring ? dayOfWeek : null,
      specificDate: isRecurring ? null : specificDate,
    };
  }

  // Basic SSRF guard: rejects the obvious private/loopback hostname patterns. Not a full
  // defense (doesn't resolve DNS to catch a public domain that rebinds to an internal IP) —
  // proportionate to this being an admin-only, manually-triggered endpoint, not public
  // input, per the task's ask for a "basic" guard.
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
