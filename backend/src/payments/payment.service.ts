import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PayOS } from '@payos/node';
import { BookingService } from '../bookings/booking.service';
import { PaymentMethod } from '../common/enums/payment-method.enum';
import { PaymentStatus } from '../common/enums/payment-status.enum';

interface Requester {
  userId: string;
  role: string;
}

// Các trạng thái PayOS coi là giao dịch đã kết thúc mà KHÔNG thành công — khác với
// PENDING/PROCESSING/UNDERPAID vốn vẫn đang chờ, chưa nên báo thất bại cho khách.
const FAILED_PAYOS_STATUSES = ['CANCELLED', 'EXPIRED', 'FAILED'];

@Injectable()
export class PaymentService {
  private readonly payos: PayOS;
  private readonly frontendUrl: string;

  constructor(
    private readonly config: ConfigService,
    private readonly bookingService: BookingService,
  ) {
    this.payos = new PayOS({
      clientId: this.config.get<string>('PAYOS_CLIENT_ID')!,
      apiKey: this.config.get<string>('PAYOS_API_KEY')!,
      checksumKey: this.config.get<string>('PAYOS_CHECKSUM_KEY')!,
    });
    this.frontendUrl =
      this.config.get<string>('CORS_ORIGIN') ?? 'http://localhost:5173';
  }

  async createLinkForBooking(bookingId: string, requester: Requester) {
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
      throw new BadRequestException('Đơn đặt phòng chưa có mã thanh toán PayOS');
    }

    const orderCode = Number(booking.payosOrderCode);
    const returnUrl = `${this.frontendUrl}/payment/success?bookingId=${bookingId}`;
    const cancelUrl = `${this.frontendUrl}/payment/cancel?bookingId=${bookingId}`;
    // Link hết hạn sau 15 phút — đủ để hiển thị đếm ngược có ý nghĩa trên trang checkout
    // thay vì để mặc định không giới hạn thời gian của PayOS.
    const expiredAt = Math.floor(Date.now() / 1000) + 15 * 60;

    try {
      const link = await this.payos.paymentRequests.create({
        orderCode,
        amount: booking.totalAmount,
        description: `DH ${String(orderCode).slice(-8)}`,
        returnUrl,
        cancelUrl,
        expiredAt,
        items: [
          {
            name: booking.roomType.name,
            quantity: 1,
            price: booking.totalAmount,
          },
        ],
        buyerName: booking.guestInfo.fullName,
        buyerPhone: booking.guestInfo.phone,
        buyerEmail: booking.guestInfo.email,
      });
      return {
        checkoutUrl: link.checkoutUrl,
        qrCode: link.qrCode,
        expiredAt: link.expiredAt ?? expiredAt,
      };
    } catch {
      // orderCode đã tồn tại link từ lần tạo trước đó (VD: người dùng bấm "Thanh toán
      // lại") — lấy thông tin link cũ và tự dựng lại checkoutUrl theo mẫu chuẩn của PayOS.
      const existing = await this.payos.paymentRequests.get(orderCode);
      if (existing.status === 'PAID') {
        await this.bookingService.markPaidByOrderCode(orderCode);
        throw new BadRequestException('Đơn đặt phòng đã được thanh toán');
      }
      return {
        checkoutUrl: `https://pay.payos.vn/web/${existing.id}`,
        qrCode: null,
      };
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
        await this.bookingService.markPaidByOrderCode(orderCode);
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
        await this.bookingService.markPaidByOrderCode(verified.orderCode);
      }
      return { success: true };
    } catch {
      return { success: false };
    }
  }
}
