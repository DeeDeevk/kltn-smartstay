import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import * as cheerio from 'cheerio';
import { PDFParse } from 'pdf-parse';
import * as mammoth from 'mammoth';
import { assertSafeUrl } from './ssrf-guard';

// Bóc văn bản thuần từ 1 nguồn (link hoặc file admin tải lên) — dùng chung cho
// LocalEventExtractionService VÀ LocalPlaceExtractionService, tránh 2 nơi cùng cài đặt
// riêng SSRF guard/giới hạn dung lượng/đọc PDF-DOCX mà chỉ 1 nơi được sửa khi có lỗi. Chỉ
// lo việc "đưa về text thuần", KHÔNG biết gì về Gemini hay cấu trúc dữ liệu đích — mỗi
// domain (event/place) tự quyết định prompt và cách sanitize kết quả của riêng mình.
const FETCH_TIMEOUT_MS = 10_000;
// Số lần chuyển hướng tối đa được đi theo khi tải link — đủ cho các trang rút gọn URL/CMS
// redirect vài bước, chặn vòng lặp redirect vô hạn hoặc chuỗi quá dài.
const MAX_REDIRECTS = 3;
// Đọc theo stream và huỷ ngay khi vượt ngưỡng thay vì tải hết về rồi mới cắt — tránh 1 link
// trỏ tới file khổng lồ chiếm hết bộ nhớ trước khi kịp kiểm tra dung lượng.
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
// Đuôi file được chấp nhận cho luồng tải file lên — kiểm tra theo đuôi tên file thay vì
// mimetype vì nhiều trình duyệt/hệ điều hành gửi mimetype không nhất quán cho .docx.
const SUPPORTED_FILE_EXTENSIONS = ['.pdf', '.docx', '.txt'];
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

@Injectable()
export class SourceContentService {
  private readonly logger = new Logger(SourceContentService.name);

  // Chặn SSRF: xem chú thích chi tiết ở ssrf-guard.ts (giao thức, phân giải DNS, kiểm tra
  // MỌI địa chỉ IP trả về, và ghi chú về giới hạn DNS rebinding còn lại).
  //
  // Chạy lại assertSafeUrl() cho MỖI lần chuyển hướng (redirect: 'manual' + tự đi theo ở
  // đây) chứ không chỉ kiểm tra URL ban đầu: một link công khai hoàn toàn hợp lệ vẫn có
  // thể 302 sang địa chỉ nội bộ, và bước kiểm tra ở URL gốc không bắt được việc đó.
  async readUrlText(urlStr: string): Promise<string> {
    let currentUrl = urlStr;
    let html = '';

    for (let hop = 0; ; hop += 1) {
      const target = await assertSafeUrl(currentUrl);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      try {
        const res = await fetch(target.toString(), {
          signal: controller.signal,
          redirect: 'manual',
          headers: { 'User-Agent': 'VikaHotel-LocalEventBot/1.0' },
        });

        const location = res.headers.get('location');
        if (res.status >= 300 && res.status < 400 && location) {
          if (hop >= MAX_REDIRECTS) {
            throw new BadRequestException(
              'Link chuyển hướng quá nhiều lần, không thể tải.',
            );
          }
          // new URL(location, target) để tự phân giải redirect dạng đường dẫn tương đối.
          currentUrl = new URL(location, target).toString();
          continue;
        }

        if (!res.ok) {
          throw new BadRequestException(
            `Không tải được nội dung từ link (HTTP ${res.status}).`,
          );
        }

        html = await this.readBodyWithLimit(res, MAX_RESPONSE_BYTES);
        break;
      } catch (err) {
        if (err instanceof BadRequestException) throw err;
        this.logger.warn(
          `Failed to fetch URL for source content extraction: ${err instanceof Error ? err.message : String(err)}`,
        );
        throw new BadRequestException('Không tải được nội dung từ link này.');
      } finally {
        clearTimeout(timeout);
      }
    }

    const $ = cheerio.load(html);
    $('script, style, nav, header, footer, noscript, svg, iframe').remove();
    const text = $('body').text().replace(/\s+/g, ' ').trim();
    if (!text) {
      throw new BadRequestException('Không đọc được nội dung từ link này.');
    }
    return text;
  }

  // Validate (dung lượng, đuôi file) rồi bóc text thuần từ file admin tải lên — gộp cả 2
  // bước vào đây vì không domain nào (event/place) cần tách riêng, luôn dùng cùng nhau.
  async readFileText(file: Express.Multer.File): Promise<string> {
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
    return text;
  }

  private getFileExtension(filename: string): string {
    const idx = filename.lastIndexOf('.');
    return idx === -1 ? '' : filename.slice(idx).toLowerCase();
  }

  // Mỗi định dạng có 1 cách bóc text riêng, nhưng đều trả về cùng 1 kiểu string thuần.
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
    // Không bao giờ tới đây vì ext đã được kiểm tra nằm trong SUPPORTED_FILE_EXTENSIONS ở
    // readFileText, nhưng vẫn cần trả về cho TypeScript thấy đủ nhánh.
    return '';
  }

  // Đọc response theo stream, huỷ ngay khi vượt maxBytes thay vì await res.text() đọc hết
  // rồi mới cắt — không để 1 link trỏ tới file khổng lồ chiếm hết bộ nhớ trước khi kịp
  // giới hạn.
  private async readBodyWithLimit(
    res: Response,
    maxBytes: number,
  ): Promise<string> {
    if (!res.body) return '';
    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let received = 0;
    let text = '';
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        received += value.byteLength;
        if (received > maxBytes) {
          await reader.cancel();
          throw new BadRequestException(
            'Nội dung từ link vượt quá dung lượng cho phép.',
          );
        }
        text += decoder.decode(value, { stream: true });
      }
      text += decoder.decode();
      return text;
    } finally {
      reader.releaseLock();
    }
  }
}
