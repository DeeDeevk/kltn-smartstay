import { Injectable, Logger } from '@nestjs/common';

// Danh sách ngân hàng NAPAS công khai của VietQR, không cần API key — dùng để tra mã BIN
// (bắt buộc cho Quick Link API) từ TÊN ngân hàng khi PayOS không trả sẵn mã BIN thô đáng
// tin cậy (xem payment.service.ts). Xem https://api.vietqr.io/v2/banks.
const VIETQR_BANKS_URL = 'https://api.vietqr.io/v2/banks';

interface VietqrBank {
  name: string;
  code: string;
  bin: string;
  shortName: string;
}

// Bỏ dấu + hạ chữ thường + bỏ "ngân hàng"/"tmcp" (các từ đệm hay lặp lại giữa tên PayOS trả
// về và tên trong danh sách VietQR, VD "TMCP Tiên Phong" so với "Ngân hàng TMCP Tiên
// Phong") để so khớp CHÍNH XÁC (không fuzzy/substring) — khớp lỏng lẻo hơn có rủi ro nhận
// nhầm ngân hàng, không chấp nhận được khi liên quan tới chuyển tiền thật.
function normalizeBankLabel(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/\bngan hang\b/g, '')
    .replace(/\btmcp\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

@Injectable()
export class VietqrBankService {
  private readonly logger = new Logger(VietqrBankService.name);
  // Cache trong bộ nhớ — danh sách ngân hàng NAPAS gần như không đổi, chỉ cần tải 1 lần cho
  // suốt vòng đời process thay vì gọi lại ở mỗi request (KAN-123). null = chưa tải lần nào;
  // [] = đã tải nhưng rỗng/lỗi (vẫn cache để khỏi gọi lại liên tục khi API đang lỗi).
  private cachedBanks: VietqrBank[] | null = null;

  // Trả về mã BIN (6 số) nếu tìm được đúng 1 ngân hàng khớp CHÍNH XÁC theo tên (so khớp cả
  // với `name` đầy đủ lẫn `shortName`, và với `code` viết tắt NAPAS) — null nếu không chắc
  // chắn, KHÔNG đoán đại (xem comment đầu normalizeBankLabel()).
  async findBinByName(bankName: string | null | undefined): Promise<string | null> {
    if (!bankName) return null;
    const banks = await this.getBanks();
    const target = normalizeBankLabel(bankName);
    if (!target) return null;
    const match = banks.find(
      (b) =>
        normalizeBankLabel(b.name) === target ||
        normalizeBankLabel(b.shortName) === target ||
        b.code.toLowerCase() === target,
    );
    return match?.bin ?? null;
  }

  private async getBanks(): Promise<VietqrBank[]> {
    if (this.cachedBanks) return this.cachedBanks;
    try {
      const response = await fetch(VIETQR_BANKS_URL);
      const json = (await response.json()) as { data?: VietqrBank[] };
      // Chỉ cache khi tải THÀNH CÔNG — lỗi mạng tạm thời (API sập lúc này) không nên khoá
      // cứng thành "mãi mãi không tra được" cho tới khi restart server; để null thì lần gọi
      // sau còn thử tải lại.
      this.cachedBanks = json.data ?? [];
      return this.cachedBanks;
    } catch (error) {
      this.logger.warn(
        `Không tải được danh sách ngân hàng VietQR: ${(error as Error).message}`,
      );
      return [];
    }
  }
}
