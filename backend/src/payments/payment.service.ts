import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  APIError,
  PayOS,
  type PaymentLink,
  type PaymentLinkItem,
} from '@payos/node';
import { BookingService } from '../bookings/booking.service';
import { VietqrBankService } from './vietqr-bank.service';
import { PaymentMethod } from '../common/enums/payment-method.enum';
import { PaymentStatus } from '../common/enums/payment-status.enum';

interface Requester {
  userId: string;
  role: string;
}

// Các trạng thái PayOS coi là giao dịch đã kết thúc mà KHÔNG thành công — khác với
// PENDING/PROCESSING/UNDERPAID vốn vẫn đang chờ, chưa nên báo thất bại cho khách.
const FAILED_PAYOS_STATUSES = ['CANCELLED', 'EXPIRED', 'FAILED'];

// Field tên người/tài khoản/mã ngân hàng chuyển khoản — có trong CẢ WebhookData
// (payos.webhooks.verify) lẫn Transaction (payos.paymentRequests.get().transactions), đúng
// tên field theo type definition của @payos/node (lib/resources/webhooks/webhook.d.ts và
// lib/resources/v2/payment-requests/payment-requests.d.ts) — đã kiểm tra, không đoán mò.
// counterAccountBankId: SDK có khai field này (kiểu string|null) nhưng KHÔNG có tài liệu
// (README/CHANGELOG/JSDoc) nào xác nhận chắc chắn đây là mã BIN theo chuẩn NAPAS hay 1 ID
// nội bộ khác của PayOS — xem comment ở resolveBankBin() về cách xử lý an toàn cho việc này.
interface PayosCounterAccountFields {
  counterAccountBankId?: string | null;
  counterAccountBankName?: string | null;
  counterAccountName?: string | null;
  counterAccountNumber?: string | null;
}

// Mã BIN NAPAS luôn đúng 6 chữ số; mã viết tắt NAPAS (VCB, BIDV, ICB...) quan sát được dài
// 2-6 chữ cái hoa. counterAccountBankId chỉ được tin dùng thẳng nếu khớp 1 trong 2 dạng này
// — không khớp thì coi như không tin cậy, chuyển sang tra theo tên (xem resolveBankBin()).
const VALID_BANK_ID_PATTERN = /^(\d{6}|[A-Z]{2,6})$/;

// Link thanh toán PayOS mobile cần đủ thông tin để tự mở app ngân hàng bằng VietQR
// deeplink (không chỉ quét ảnh QR): bin + accountNumber + accountName + amount +
// description là 5 field bắt buộc của chuẩn VietQR, orderCode để đối chiếu với đơn.
export interface PayosLinkResult {
  checkoutUrl: string;
  qrCode: string;
  expiredAt: number;
  bin: string;
  accountNumber: string;
  accountName: string;
  amount: number;
  description: string;
  orderCode: string;
}

@Injectable()
export class PaymentService {
  private readonly payos: PayOS;
  private readonly frontendUrl: string;

  constructor(
    private readonly config: ConfigService,
    private readonly bookingService: BookingService,
    private readonly vietqrBankService: VietqrBankService,
  ) {
    this.payos = new PayOS({
      clientId: this.config.get<string>('PAYOS_CLIENT_ID')!,
      apiKey: this.config.get<string>('PAYOS_API_KEY')!,
      checksumKey: this.config.get<string>('PAYOS_CHECKSUM_KEY')!,
    });
    // CORS_ORIGIN có thể chứa nhiều domain — domain đầu tiên là frontend chính.
    this.frontendUrl = this.config
      .get<string>('CORS_ORIGIN', 'http://localhost:5173')
      .split(',')[0]
      .trim();
  }

  async createLinkForBooking(
    bookingId: string,
    requester: Requester,
  ): Promise<PayosLinkResult> {
    const booking = await this.bookingService.findById(bookingId, requester);

    if (booking.paymentMethod !== PaymentMethod.PAYOS) {
      throw new BadRequestException(
        'Đơn đặt phòng này không sử dụng thanh toán PayOS',
      );
    }
    if (booking.paymentStatus === PaymentStatus.PAID) {
      throw new BadRequestException('Đơn đặt phòng đã được thanh toán');
    }
    if (!booking.payosOrderCode) {
      throw new BadRequestException(
        'Đơn đặt phòng chưa có mã thanh toán PayOS',
      );
    }

    const returnUrl = `${this.frontendUrl}/payment/success?bookingId=${bookingId}`;
    const cancelUrl = `${this.frontendUrl}/payment/cancel?bookingId=${bookingId}`;
    const items: PaymentLinkItem[] = [
      {
        name: booking.roomType.name,
        quantity: 1,
        price: booking.totalAmount,
      },
    ];
    const buyer = {
      buyerName: booking.guestInfo.fullName,
      buyerPhone: booking.guestInfo.phone,
      buyerEmail: booking.guestInfo.email,
    };

    const orderCode = Number(booking.payosOrderCode);

    try {
      return await this.createPaymentLink({
        orderCode,
        amount: booking.totalAmount,
        returnUrl,
        cancelUrl,
        items,
        ...buyer,
      });
    } catch (err) {
      if (!(err instanceof APIError)) throw err;

      // @payos/node không có tài liệu (README/CHANGELOG/JSDoc) xác nhận chắc chắn mã lỗi
      // cụ thể khi create() thất bại vì orderCode đã tồn tại (tinh thần giống comment ở
      // resolveBankBin() — không đoán mò mã lỗi của PayOS). Thay vì so khớp err.code/err.desc
      // theo một chuỗi/con số không có gì đảm bảo đúng, xác minh trực tiếp bằng dữ liệu thật:
      // gọi get(orderCode) ngay sau đó — lấy được bản ghi nghĩa là orderCode THẬT SỰ đã tồn
      // tại (đúng nguyên nhân khiến create() báo lỗi); không lấy được (get() cũng lỗi) thì
      // chứng tỏ create() thất bại vì lý do khác (sai tham số, PayOS lỗi tạm thời...) — ném
      // lại lỗi gốc để client biết, không nuốt lỗi/trả nhầm kết quả.
      let existing: PaymentLink;
      try {
        existing = await this.payos.paymentRequests.get(orderCode);
      } catch {
        throw err;
      }

      if (existing.status === 'PAID') {
        // Lấy payerBankInfo giống hệt syncStatus() — tránh để PaymentTransaction của
        // nhánh fallback này thiếu thông tin ngân hàng, khiến RefundRequest tạo sau này
        // (nếu đơn bị huỷ) không tự dựng được ảnh VietQR (KAN-123).
        const latestTransaction = [...(existing.transactions ?? [])].sort(
          (a, b) =>
            new Date(b.transactionDateTime).getTime() -
            new Date(a.transactionDateTime).getTime(),
        )[0];
        const payerBankInfo = latestTransaction
          ? await this.extractPayerBankInfo(latestTransaction)
          : null;
        await this.bookingService.markPaidByOrderCode(orderCode, payerBankInfo);
        throw new BadRequestException('Đơn đặt phòng đã được thanh toán');
      }

      if (
        existing.status === 'PENDING' ||
        existing.status === 'CANCELLED' ||
        existing.status === 'EXPIRED'
      ) {
        if (existing.status === 'PENDING') {
          // Huỷ link cũ trước khi phát hành orderCode mới — PayOS không cho 1 orderCode
          // có 2 link cùng PENDING, và không huỷ thì link cũ vẫn hiện hoạt, khách có thể
          // lỡ tay thanh toán nhầm vào link đã bị thay thế.
          await this.payos.paymentRequests.cancel(
            orderCode,
            'Tạo lại link thanh toán mới',
          );
        }
        // Ghi orderCode mới vào booking ngay — webhook/syncStatus tra theo
        // booking.payosOrderCode nên phải trỏ đúng link vừa phát hành.
        const freshOrderCode = Number(
          await this.bookingService.assignFreshPayosOrderCode(bookingId),
        );
        return this.createPaymentLink({
          orderCode: freshOrderCode,
          amount: booking.totalAmount,
          returnUrl,
          cancelUrl,
          items,
          ...buyer,
        });
      }

      // UNDERPAID/PROCESSING/FAILED: orderCode cũ đang có giao dịch dở dang (VD khách đã
      // chuyển thiếu, hoặc PayOS đang xử lý) — không tự ý huỷ/phát hành lại, rủi ro orphan
      // phần tiền khách đã chuyển hoặc tạo 2 link cùng nhận tiền cho 1 đơn. Cần lễ tân/admin
      // kiểm tra thủ công qua cổng quản trị PayOS.
      throw new BadRequestException(
        `Link thanh toán hiện ở trạng thái ${existing.status}, không thể tự tạo lại. Vui lòng liên hệ lễ tân để được hỗ trợ.`,
      );
    }
  }

  // Dùng chung cho cả lượt tạo link đầu tiên lẫn lượt phát hành lại (orderCode mới) khi
  // orderCode cũ đã tồn tại link không còn dùng được — cùng 1 chỗ build request + map
  // response, tránh lặp logic giữa 2 nhánh của createLinkForBooking().
  private async createPaymentLink(params: {
    orderCode: number;
    amount: number;
    returnUrl: string;
    cancelUrl: string;
    items: PaymentLinkItem[];
    buyerName?: string;
    buyerPhone?: string;
    buyerEmail?: string;
  }): Promise<PayosLinkResult> {
    const description = `DH ${String(params.orderCode).slice(-8)}`;
    // Link hết hạn sau 15 phút — đủ để hiển thị đếm ngược có ý nghĩa trên trang checkout
    // thay vì để mặc định không giới hạn thời gian của PayOS.
    const expiredAt = Math.floor(Date.now() / 1000) + 15 * 60;

    const link = await this.payos.paymentRequests.create({
      ...params,
      description,
      expiredAt,
    });

    return {
      checkoutUrl: link.checkoutUrl,
      qrCode: link.qrCode,
      expiredAt: link.expiredAt ?? expiredAt,
      bin: link.bin,
      accountNumber: link.accountNumber,
      accountName: link.accountName,
      amount: link.amount,
      description: link.description,
      orderCode: String(link.orderCode),
    };
  }

  // Tạo link/QR PayOS để thu phần tiền còn lại khi lễ tân trả phòng (khác
  // createLinkForBooking: dùng cho mọi đơn, kể cả đơn tiền mặt, số tiền tuỳ ý).
  async createCheckoutLink(
    bookingId: string,
    amount: number,
    requester: Requester,
  ) {
    if (!Number.isInteger(amount) || amount <= 0) {
      throw new BadRequestException('Số tiền cần thu không hợp lệ');
    }
    // Không chặn theo paymentStatus: đơn có thể đã "PAID" phần đặt cọc lúc check-in
    // nhưng vẫn phát sinh tiền dịch vụ/phụ thu khi trả phòng. Số tiền cần thu do màn
    // Check-out tính (đã trừ phần đã trả) và gửi lên qua `amount`.
    const booking = await this.bookingService.findById(bookingId, requester);

    const orderCode = Number(
      await this.bookingService.assignFreshPayosOrderCode(bookingId),
    );
    const returnUrl = `${this.frontendUrl}/payment/success?bookingId=${bookingId}`;
    const cancelUrl = `${this.frontendUrl}/payment/cancel?bookingId=${bookingId}`;
    const expiredAt = Math.floor(Date.now() / 1000) + 15 * 60;

    const link = await this.payos.paymentRequests.create({
      orderCode,
      amount,
      description: `TT ${String(orderCode).slice(-8)}`,
      returnUrl,
      cancelUrl,
      expiredAt,
      items: [
        {
          name: `Phòng ${booking.room?.roomNumber ?? ''}`.trim() || 'Trả phòng',
          quantity: 1,
          price: amount,
        },
      ],
      buyerName: booking.guestInfo.fullName,
      buyerPhone: booking.guestInfo.phone,
      buyerEmail: booking.guestInfo.email,
    });

    return {
      checkoutUrl: link.checkoutUrl,
      qrCode: link.qrCode,
      orderCode: String(orderCode),
      amount,
      expiredAt: link.expiredAt ?? expiredAt,
    };
  }

  // Kiểm tra trạng thái link PayOS vừa tạo ở màn Check-out. Khác syncStatus: KHÔNG
  // short-circuit theo booking.paymentStatus (đơn có thể đã "PAID" phần đặt cọc) và
  // KHÔNG tự đánh dấu đã trả — việc chốt tiền do nút "Hoàn tất Check-out" lo.
  async checkoutSyncStatus(bookingId: string, requester: Requester) {
    const booking = await this.bookingService.findById(bookingId, requester);
    if (!booking.payosOrderCode) {
      return { paid: false, status: 'NO_ORDER' };
    }
    try {
      const info = await this.payos.paymentRequests.get(
        Number(booking.payosOrderCode),
      );
      return { paid: info.status === 'PAID', status: info.status };
    } catch {
      return { paid: false, status: 'UNKNOWN' };
    }
  }

  async syncStatus(bookingId: string, requester: Requester) {
    const booking = await this.bookingService.findById(bookingId, requester);
    if (
      booking.paymentStatus === PaymentStatus.PAID ||
      !booking.payosOrderCode
    ) {
      return booking;
    }

    const orderCode = Number(booking.payosOrderCode);
    try {
      const info = await this.payos.paymentRequests.get(orderCode);
      if (info.status === 'PAID') {
        // Giao dịch mới nhất (nếu có nhiều, VD khách chuyển thiếu rồi chuyển bù) là giao
        // dịch đáng tin nhất để biết ai vừa chuyển tiền.
        const latestTransaction = [...(info.transactions ?? [])].sort(
          (a, b) =>
            new Date(b.transactionDateTime).getTime() -
            new Date(a.transactionDateTime).getTime(),
        )[0];
        const payerBankInfo = latestTransaction
          ? await this.extractPayerBankInfo(latestTransaction)
          : null;
        await this.bookingService.markPaidByOrderCode(orderCode, payerBankInfo);
        return this.bookingService.findById(bookingId, requester);
      }
      if (FAILED_PAYOS_STATUSES.includes(info.status)) {
        await this.bookingService.markFailedByOrderCode(orderCode);
        return this.bookingService.findById(bookingId, requester);
      }
    } catch {
      // Chưa có link/giao dịch nào trên PayOS ứng với orderCode này — giữ nguyên trạng thái
    }
    return booking;
  }

  // Endpoint webhook thật từ PayOS — chỉ hoạt động khi backend có URL public
  // (không hoạt động khi chạy localhost, dùng syncStatus() ở trên để test cục bộ).
  async handleWebhook(body: unknown) {
    try {
      const verified = await this.payos.webhooks.verify(
        body as Parameters<typeof this.payos.webhooks.verify>[0],
      );
      if (verified?.orderCode && verified.code === '00') {
        await this.bookingService.markPaidByOrderCode(
          verified.orderCode,
          await this.extractPayerBankInfo(verified),
        );
      }
      return { success: true };
    } catch {
      return { success: false };
    }
  }

  // Chỉ giữ field THẬT SỰ có giá trị (SDK khai optional/nullable) — trả null nếu không field
  // nào có dữ liệu, KHÔNG bịa cấu trúc giả. bankBin (KAN-123) chỉ thêm vào nếu tra được —
  // dùng để dựng ảnh VietQR thật sau này (xem RefundRequestService.buildQrImageUrl), KHÔNG
  // phải thông tin cần nhân viên đọc trực tiếp nên đặt tên field thuần (không phải nhãn
  // tiếng Việt như 3 field còn lại).
  private async extractPayerBankInfo(
    data: PayosCounterAccountFields,
  ): Promise<Record<string, string> | null> {
    const info: Record<string, string> = {};
    if (data.counterAccountName)
      info['Tên người chuyển'] = data.counterAccountName;
    if (data.counterAccountNumber)
      info['Số tài khoản'] = data.counterAccountNumber;
    if (data.counterAccountBankName)
      info['Ngân hàng'] = data.counterAccountBankName;

    const bankBin = await this.resolveBankBin(data);
    if (bankBin) info.bankBin = bankBin;

    return Object.keys(info).length > 0 ? info : null;
  }

  // Ưu tiên counterAccountBankId nếu SDK có trả VÀ giá trị khớp định dạng mã BIN/mã viết
  // tắt NAPAS hợp lệ (xem VALID_BANK_ID_PATTERN — SDK không có tài liệu xác nhận chắc chắn
  // đây là BIN NAPAS nên vẫn kiểm định dạng trước khi tin, không dùng thẳng vô điều kiện).
  // Không có/không khớp định dạng -> tra theo tên (counterAccountBankName) qua danh sách
  // công khai VietQR. Không chắc chắn trường hợp nào -> null, KHÔNG đoán đại (rủi ro chuyển
  // nhầm ngân hàng khi dùng tạo QR chuyển khoản thật).
  private async resolveBankBin(
    data: PayosCounterAccountFields,
  ): Promise<string | null> {
    const rawId = data.counterAccountBankId?.trim();
    if (rawId && VALID_BANK_ID_PATTERN.test(rawId)) {
      return rawId;
    }
    return this.vietqrBankService.findBinByName(data.counterAccountBankName);
  }
}
