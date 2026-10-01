import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LocalPlace } from './entities/local-place.entity';
import { ExtractLocalPlacesDto } from './dto/extract-local-places.dto';
import { LocalPlaceSource } from 'src/common/enums/local-place-source.enum';
import { LocalPlaceStatus } from 'src/common/enums/local-place-status.enum';
import { GeminiProvider } from 'src/ai-agent/llm/gemini.provider';
import { SourceContentService } from './source-content.service';

// Cùng tinh thần "AI hỗ trợ nhập liệu, có con người duyệt lại" như
// LocalEventExtractionService (xem chú thích đầu file đó): AI chỉ tạo bản nháp
// status=PENDING, address/latitude/longitude luôn để null — admin BẮT BUỘC tự chọn địa chỉ
// qua Vietmap Autocomplete rồi mới duyệt được (xem LocalPlaceService.approve()). AI không
// tự geocode addressHint thành toạ độ vì đó là suy đoán không ai kiểm chứng lại.

// Gửi cho Gemini làm system instruction cho generateJson() — chỉ trích xuất địa điểm có tên
// cụ thể, không bịa thêm, không tự geocode (chỉ gợi ý addressHint dạng chữ thô để admin tự
// xác nhận lại qua Vietmap).
const EXTRACTION_PLACE_SYSTEM_PROMPT = `Bạn là công cụ trích xuất địa điểm tham quan/vui chơi/ăn uống từ văn
bản. CHỈ trích xuất các địa điểm có tên cụ thể được nêu trong văn bản được cung cấp bên
dưới. TUYỆT ĐỐI KHÔNG suy đoán, KHÔNG bịa thêm địa điểm không có trong văn bản, KHÔNG dùng
kiến thức bên ngoài văn bản này. Nếu văn bản không nhắc tới địa điểm cụ thể nào, trả về mảng
rỗng [].

Với mỗi địa điểm tìm được, xác định:
- name: tên địa điểm, ngắn gọn.
- description: mô tả ngắn (đặc điểm nổi bật, lý do đáng đến, nếu văn bản có nêu).
- addressHint: nếu văn bản có đề cập địa chỉ hoặc khu vực cụ thể của địa điểm này, ghi lại
  nguyên văn (không cần chính xác tuyệt đối, admin sẽ tự xác nhận lại qua bản đồ); để null
  nếu văn bản không nêu địa chỉ/khu vực nào.

Trả về ĐÚNG một mảng JSON, không kèm giải thích hay markdown, đúng khuôn dạng:
[{ "name": string, "description": string, "addressHint": string | null }]`;

// Cùng danh sách mã lỗi/độ trễ retry như LocalEventExtractionService — 2 file khác nhau,
// không share hằng số vì mỗi service có thể cần chỉnh riêng sau này, nhưng giữ giống nhau
// hiện tại cho dễ hiểu.
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);
const RETRY_DELAYS_MS = [1000, 3000];

// Số ký tự của text nguồn thực sự gửi cho Gemini — giữ prompt nhỏ/rẻ, cùng giới hạn với
// LocalEventExtractionService.MAX_CONTENT_LENGTH.
const MAX_CONTENT_LENGTH = 20_000;
const MAX_SOURCE_REF_LENGTH = 2000;
const NAME_MAX_LENGTH = 200;
// Vietmap Autocomplete chỉ cần vài chục ký tự gợi ý — addressHint dài hơn không có lý do
// gì để lưu nguyên, tránh 1 đoạn văn bản dài bị AI nhét nhầm vào trường này.
const ADDRESS_HINT_MAX_LENGTH = 255;

interface RawExtractedPlace {
  name?: unknown;
  description?: unknown;
  addressHint?: unknown;
}

@Injectable()
export class LocalPlaceExtractionService {
  private readonly logger = new Logger(LocalPlaceExtractionService.name);

  constructor(
    @InjectRepository(LocalPlace)
    private readonly localPlaceRepo: Repository<LocalPlace>,
    private readonly geminiProvider: GeminiProvider,
    private readonly sourceContentService: SourceContentService,
  ) {}

  async extract(dto: ExtractLocalPlacesDto): Promise<LocalPlace[]> {
    if (Boolean(dto.url) === Boolean(dto.text)) {
      throw new BadRequestException(
        'Vui lòng cung cấp đúng một trong hai: link hoặc nội dung văn bản.',
      );
    }

    const rawContent = dto.url
      ? await this.sourceContentService.readUrlText(dto.url)
      : (dto.text as string);
    const sourceRef = (dto.url ?? dto.text ?? '').slice(
      0,
      MAX_SOURCE_REF_LENGTH,
    );

    const content = rawContent.slice(0, MAX_CONTENT_LENGTH);
    const parsed = await this.generateJsonWithRetry(content);

    if (!Array.isArray(parsed)) {
      this.logger.warn(
        `Gemini returned non-array for local place extraction: ${JSON.stringify(parsed).slice(0, 200)}`,
      );
      throw new BadRequestException(
        'Không tìm thấy địa điểm nào trong nguồn này.',
      );
    }

    const drafts = (parsed as RawExtractedPlace[])
      .map((raw) => this.sanitizeExtractedPlace(raw))
      .filter((draft): draft is NonNullable<typeof draft> => draft !== null);

    if (drafts.length === 0) {
      throw new BadRequestException(
        'Không tìm thấy địa điểm nào trong nguồn này.',
      );
    }

    const places = drafts.map((draft) =>
      this.localPlaceRepo.create({
        name: draft.name,
        description: draft.description,
        // addressHint là chữ thô AI đọc được, CHƯA xác nhận qua bản đồ — lưu riêng cột
        // addressHint (chỉ để UI gợi ý), KHÔNG lưu vào cột address thật (đòi hỏi admin tự
        // chọn qua Vietmap Autocomplete rồi mới duyệt được, xem LocalPlaceService.approve()).
        addressHint: draft.addressHint,
        address: null,
        latitude: null,
        longitude: null,
        source: LocalPlaceSource.AI_SUGGESTED,
        status: LocalPlaceStatus.PENDING,
        sourceRef,
      }),
    );
    return this.localPlaceRepo.save(places);
  }

  // Cùng cơ chế thử lại như LocalEventExtractionService.generateJsonWithRetry — xem chú
  // thích ở đó để biết lý do (lỗi tạm thời 503 "high demand" đã gặp khi test trực tiếp).
  private async generateJsonWithRetry(content: string): Promise<unknown> {
    for (let attempt = 0; ; attempt += 1) {
      try {
        return await this.geminiProvider.generateJson(
          EXTRACTION_PLACE_SYSTEM_PROMPT,
          content,
        );
      } catch (err) {
        const status = (err as { status?: number })?.status;
        const retryable = status === undefined || RETRYABLE_STATUS.has(status);
        const message = err instanceof Error ? err.message : String(err);
        if (!retryable || attempt >= RETRY_DELAYS_MS.length) {
          this.logger.error(
            `Local place extraction failed${status ? ` (status ${status})` : ''}: ${message}`,
          );
          throw new BadRequestException('Không đọc được nội dung nguồn này.');
        }
        this.logger.warn(
          `Local place extraction call failed${status ? ` (status ${status})` : ''}, retrying (${attempt + 1}/${RETRY_DELAYS_MS.length}): ${message}`,
        );
        await new Promise((resolve) =>
          setTimeout(resolve, RETRY_DELAYS_MS[attempt]),
        );
      }
    }
  }

  // Không bao giờ tin mù quáng vào cấu trúc JSON Gemini trả về — chỉ trả về null (bỏ item)
  // khi thiếu/rỗng name; description/addressHint thiếu vẫn giữ lại địa điểm (không bỏ qua).
  private sanitizeExtractedPlace(raw: RawExtractedPlace): {
    name: string;
    description: string | null;
    addressHint: string | null;
  } | null {
    const name =
      typeof raw.name === 'string'
        ? raw.name.trim().slice(0, NAME_MAX_LENGTH)
        : '';
    if (!name) return null;

    const description =
      typeof raw.description === 'string' && raw.description.trim()
        ? raw.description.trim()
        : null;
    const addressHint =
      typeof raw.addressHint === 'string' && raw.addressHint.trim()
        ? raw.addressHint.trim().slice(0, ADDRESS_HINT_MAX_LENGTH)
        : null;

    return { name, description, addressHint };
  }
}
