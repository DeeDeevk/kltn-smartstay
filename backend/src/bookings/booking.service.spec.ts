import { Repository } from 'typeorm';
import { BookingService } from './booking.service';
import { Booking } from './entities/booking.entity';
import { PaymentStatus } from '../common/enums/payment-status.enum';
import { BookingStatus } from '../common/enums/booking-status.enum';
import { PaymentMethod } from '../common/enums/payment-method.enum';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { PaymentTransactionService } from '../cash-ledger/payment-transaction.service';
import { NotificationService } from '../notifications/notification.service';
import { RefundRequestService } from '../refund-requests/refund-request.service';

// Chỉ test markPaidByOrderCode() và findById() — 2 hàm duy nhất đổi hành vi trong KAN-117/
// KAN-121. Các dependency khác của BookingService không được 2 hàm này gọi tới, nên chỉ
// cần stub rỗng để constructor không ném lỗi.
function buildService(overrides?: {
  booking?: Partial<Booking> | null;
  refundRequestByBookingId?: Record<string, unknown> | null;
}) {
  const booking: Booking | null =
    overrides?.booking === undefined
      ? ({
          bookingId: 'booking-1',
          payosOrderCode: '123456',
          paymentStatus: PaymentStatus.UNPAID,
          status: BookingStatus.PENDING,
          paidAmount: 0,
          roomAmount: 500000,
          lateCheckoutFee: 0,
          discountAmount: 0,
          serviceItems: [],
          user: { userId: 'user-1' },
          roomType: { name: 'Deluxe' },
          guestInfo: { fullName: 'Khách A' },
        } as unknown as Booking)
      : (overrides.booking as Booking | null);

  const bookingSave = jest.fn((x: Booking) => Promise.resolve(x));
  const bookingRepo = {
    findOne: jest.fn().mockResolvedValue(booking),
    save: bookingSave,
  } as unknown as Repository<Booking>;

  const record = jest.fn().mockResolvedValue(undefined);
  const paymentTransactionService = {
    record,
  } as unknown as PaymentTransactionService;

  const realtimeGateway = {
    emitBookingPaid: jest.fn(),
    emitBookingUpdatedForCustomer: jest.fn(),
  } as unknown as RealtimeGateway;

  const notificationService = {
    notifyBooking: jest.fn().mockResolvedValue(undefined),
  } as unknown as NotificationService;

  const findByBookingId = jest
    .fn()
    .mockResolvedValue(overrides?.refundRequestByBookingId ?? null);
  const refundRequestService = {
    findByBookingId,
  } as unknown as RefundRequestService;

  const service = new BookingService(
    bookingRepo,
    {} as never, // bookingServiceItemRepo
    {} as never, // roomRepo
    {} as never, // redisClient
    {} as never, // roomTypeService
    {} as never, // serviceService
    {} as never, // promotionService
    {} as never, // userService
    realtimeGateway,
    {} as never, // shiftAssignmentService
    paymentTransactionService,
    notificationService,
    refundRequestService,
  );

  return { service, bookingRepo, bookingSave, record, realtimeGateway, findByBookingId };
}

describe('BookingService.markPaidByOrderCode', () => {
  it('có truyền payerBankInfo -> PaymentTransactionService.record() nhận đúng giá trị đó', async () => {
    const { service, record } = buildService();
    const payerBankInfo = { 'Tên người chuyển': 'Nguyen Van A', 'Số tài khoản': '0123456789' };

    await service.markPaidByOrderCode(123456, payerBankInfo);

    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        bookingId: 'booking-1',
        method: PaymentMethod.PAYOS,
        payerBankInfo,
      }),
    );
  });

  it('không truyền payerBankInfo -> PaymentTransactionService.record() nhận null', async () => {
    const { service, record } = buildService();

    await service.markPaidByOrderCode(123456);

    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({ payerBankInfo: null }),
    );
  });

  it('đơn không tồn tại (sai orderCode) -> trả null, không gọi record()', async () => {
    const { service, record } = buildService({ booking: null });

    const result = await service.markPaidByOrderCode(999999);

    expect(result).toBeNull();
    expect(record).not.toHaveBeenCalled();
  });

  it('đơn đã PAID từ trước -> trả luôn booking hiện có, không ghi thêm giao dịch mới', async () => {
    const { service, record, bookingSave } = buildService({
      booking: {
        bookingId: 'booking-1',
        payosOrderCode: '123456',
        paymentStatus: PaymentStatus.PAID,
      } as Booking,
    });

    const result = await service.markPaidByOrderCode(123456, { a: 'b' });

    expect(result?.paymentStatus).toBe(PaymentStatus.PAID);
    expect(bookingSave).not.toHaveBeenCalled();
    expect(record).not.toHaveBeenCalled();
  });
});

describe('BookingService.findById', () => {
  const requester = { userId: 'user-1', role: 'CUSTOMER' };

  it('đơn có RefundRequest -> đính kèm field refundRequest vào response', async () => {
    const refundRequestByBookingId = {
      refundRequestId: 'refund-1',
      status: 'COMPLETED',
      amount: 250000,
      refundPercent: 50,
      reason: 'Khách đổi lịch',
      adminNote: 'Đã chuyển khoản',
      proofImageUrl: 'https://cdn.example.com/proof.webp',
    };
    const { service, findByBookingId } = buildService({ refundRequestByBookingId });

    const result = await service.findById('booking-1', requester);

    expect(findByBookingId).toHaveBeenCalledWith('booking-1');
    expect(result.refundRequest).toEqual(refundRequestByBookingId);
  });

  it('đơn không có RefundRequest nào (chưa huỷ/chưa thanh toán) -> refundRequest = null', async () => {
    const { service } = buildService();

    const result = await service.findById('booking-1', requester);

    expect(result.refundRequest).toBeNull();
  });
});
