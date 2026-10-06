import { Repository } from 'typeorm';
import { RefundRequestService } from './refund-request.service';
import { RefundRequest } from './entities/refund-request.entity';
import { Booking } from '../bookings/entities/booking.entity';
import {
  Conversation,
  ConversationStatus,
} from '../chat/entities/conversation.entity';
import { NotificationService } from '../notifications/notification.service';
import { HotelConfigService } from '../hotel-config/hotel-config.service';
import { PaymentTransactionService } from '../cash-ledger/payment-transaction.service';
import { RefundRequestStatus } from '../common/enums/refund-request-status.enum';

const BOOKING_USER_ID = 'user-1';
// "Now" cố định cho mọi test (useFakeTimers) — checkInDate mặc định của buildBooking() nằm
// cách mốc này đủ xa (>= 48h, freeCancellationHours mặc định) để các test không liên quan
// tới chính sách hoàn tiền theo thời điểm huỷ (KAN-117) vẫn luôn rơi vào nhánh hoàn 100%,
// giữ đúng hành vi/giả định mà các test đó đã viết từ trước.
const FAKE_NOW = new Date('2026-06-15T00:00:00.000Z');

function buildBooking(overrides?: Partial<Booking>): Booking {
  return {
    bookingId: 'booking-1',
    user: { userId: BOOKING_USER_ID, fullName: 'Khách A' },
    roomType: { name: 'Deluxe' },
    paidAmount: 500000,
    checkInDate: '2026-06-20',
    guestInfo: { fullName: 'Khách A', phone: '0900000000' },
    ...overrides,
  } as Booking;
}

function buildService(overrides?: {
  openConversation?: Partial<Conversation> | null;
  refundRequest?: Partial<RefundRequest>;
  mine?: Partial<RefundRequest>[];
  hotelConfig?: {
    freeCancellationHours?: number;
    partialRefundPercent?: number;
    refundProcessingSlaHours?: number;
  };
  latestPaymentTransaction?: { payerBankInfo: Record<string, string> | null } | null;
}) {
  const refundRequestSave = jest.fn((x: unknown) => Promise.resolve(x));
  const refundRequestCreate = jest.fn((x: unknown) => x);
  const refundRequestFind = jest.fn().mockResolvedValue(overrides?.mine ?? []);
  const refundRequestRepo = {
    create: refundRequestCreate,
    save: refundRequestSave,
    find: refundRequestFind,
    findOne: jest.fn().mockResolvedValue(
      overrides?.refundRequest
        ? {
            refundRequestId: 'refund-1',
            status: RefundRequestStatus.PENDING,
            booking: buildBooking(),
            ...overrides.refundRequest,
          }
        : null,
    ),
  } as unknown as Repository<RefundRequest>;

  const conversationRepo = {
    findOne: jest
      .fn()
      .mockResolvedValue(
        overrides?.openConversation === undefined
          ? { conversationId: 'conv-1', status: ConversationStatus.OPEN }
          : overrides.openConversation,
      ),
  } as unknown as Repository<Conversation>;

  const notifyRefund = jest.fn().mockResolvedValue(undefined);
  const notificationService = {
    notifyRefund,
  } as unknown as NotificationService;

  const hotelConfigGetOrCreate = jest.fn().mockResolvedValue({
    freeCancellationHours: 48,
    partialRefundPercent: 50,
    refundProcessingSlaHours: 24,
    ...overrides?.hotelConfig,
  });
  const hotelConfigService = {
    getOrCreate: hotelConfigGetOrCreate,
  } as unknown as HotelConfigService;

  const findLatestForBooking = jest
    .fn()
    .mockResolvedValue(overrides?.latestPaymentTransaction ?? null);
  const paymentTransactionService = {
    findLatestForBooking,
  } as unknown as PaymentTransactionService;

  const service = new RefundRequestService(
    refundRequestRepo,
    conversationRepo,
    notificationService,
    hotelConfigService,
    paymentTransactionService,
  );
  return {
    service,
    refundRequestSave,
    refundRequestCreate,
    refundRequestFind,
    conversationRepo,
    notifyRefund,
    hotelConfigGetOrCreate,
    findLatestForBooking,
  };
}

beforeEach(() => {
  jest.useFakeTimers().setSystemTime(FAKE_NOW);
});

afterEach(() => {
  jest.useRealTimers();
});

describe('RefundRequestService.createForCancelledBooking', () => {
  it('huỷ sớm (>= freeCancellationHours) -> amount = 100% booking.paidAmount và tự gắn hội thoại OPEN tìm được', async () => {
    const { service, refundRequestCreate } = buildService();
    const booking = buildBooking({ paidAmount: 750000 });

    await service.createForCancelledBooking(booking, 'Đổi lịch');

    expect(refundRequestCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 750000,
        refundPercent: 100,
        payerBankInfo: null,
        conversation: {
          conversationId: 'conv-1',
          status: ConversationStatus.OPEN,
        },
        status: RefundRequestStatus.PENDING,
        reason: 'Đổi lịch',
      }),
    );
  });

  it('không có hội thoại OPEN nào -> vẫn tạo được, conversation = null', async () => {
    const { service, refundRequestCreate } = buildService({
      openConversation: null,
    });
    const booking = buildBooking();

    await service.createForCancelledBooking(booking, 'Khách đổi ý');

    expect(refundRequestCreate).toHaveBeenCalledWith(
      expect.objectContaining({ conversation: null }),
    );
  });

  it('lỗi khi lưu -> trả null thay vì ném lỗi (không được làm hỏng cancel() đã huỷ đơn thành công)', async () => {
    const { service, refundRequestSave } = buildService();
    refundRequestSave.mockRejectedValueOnce(new Error('DB down'));

    const result = await service.createForCancelledBooking(
      buildBooking(),
      'Lý do',
    );

    expect(result).toBeNull();
  });
});

describe('RefundRequestService — chính sách hoàn tiền theo thời điểm huỷ (KAN-117)', () => {
  // FAKE_NOW = 2026-06-15T00:00:00Z; giờ nhận phòng chuẩn 14h VN (UTC+7) = 07:00 UTC.
  it('computeRefundPreview(): huỷ sớm >= freeCancellationHours -> refundPercent 100%', async () => {
    const { service } = buildService();
    const booking = buildBooking({ checkInDate: '2026-06-20', paidAmount: 500000 });

    const preview = await service.computeRefundPreview(booking);

    expect(preview.refundPercent).toBe(100);
    expect(preview.refundAmount).toBe(500000);
    expect(preview.freeCancellationHours).toBe(48);
    expect(preview.hoursUntilCheckIn).toBeGreaterThanOrEqual(48);
  });

  it('computeRefundPreview(): huỷ cận giờ (< freeCancellationHours) -> refundPercent = partialRefundPercent', async () => {
    const { service } = buildService({
      hotelConfig: { freeCancellationHours: 48, partialRefundPercent: 50 },
    });
    // Nhận phòng cùng ngày 07:00 UTC -> còn 7 giờ, dưới mốc 48h.
    const booking = buildBooking({ checkInDate: '2026-06-15', paidAmount: 500000 });

    const preview = await service.computeRefundPreview(booking);

    expect(preview.hoursUntilCheckIn).toBeGreaterThan(0);
    expect(preview.hoursUntilCheckIn).toBeLessThan(48);
    expect(preview.refundPercent).toBe(50);
    expect(preview.refundAmount).toBe(250000);
  });

  it('computeRefundPreview(): huỷ sau giờ nhận phòng (no-show) -> refundPercent 0%', async () => {
    const { service } = buildService();
    const booking = buildBooking({ checkInDate: '2026-06-10', paidAmount: 500000 });

    const preview = await service.computeRefundPreview(booking);

    expect(preview.hoursUntilCheckIn).toBeLessThanOrEqual(0);
    expect(preview.refundPercent).toBe(0);
    expect(preview.refundAmount).toBe(0);
  });

  it('createForCancelledBooking(): huỷ cận giờ -> amount/refundPercent tính theo partialRefundPercent', async () => {
    const { service, refundRequestCreate } = buildService({
      hotelConfig: { freeCancellationHours: 48, partialRefundPercent: 50 },
    });
    const booking = buildBooking({ checkInDate: '2026-06-15', paidAmount: 500000 });

    await service.createForCancelledBooking(booking, 'Huỷ cận giờ');

    expect(refundRequestCreate).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 250000, refundPercent: 50 }),
    );
  });

  it('createForCancelledBooking(): huỷ sau giờ nhận phòng -> KHÔNG tạo RefundRequest, trả null', async () => {
    const { service, refundRequestCreate, refundRequestSave } = buildService();
    const booking = buildBooking({ checkInDate: '2026-06-10', paidAmount: 500000 });

    const result = await service.createForCancelledBooking(booking, 'Huỷ trễ/no-show');

    expect(result).toBeNull();
    expect(refundRequestCreate).not.toHaveBeenCalled();
    expect(refundRequestSave).not.toHaveBeenCalled();
  });

  it('createForCancelledBooking(): có PaymentTransaction gần nhất với payerBankInfo -> lấy đúng giá trị đó thay vì null', async () => {
    const { service, refundRequestCreate, findLatestForBooking } = buildService({
      latestPaymentTransaction: {
        payerBankInfo: { 'Tên người chuyển': 'Nguyen Van A', 'Số tài khoản': '0123456789' },
      },
    });
    const booking = buildBooking();

    await service.createForCancelledBooking(booking, 'Đổi lịch');

    expect(findLatestForBooking).toHaveBeenCalledWith('booking-1');
    expect(refundRequestCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        payerBankInfo: { 'Tên người chuyển': 'Nguyen Van A', 'Số tài khoản': '0123456789' },
      }),
    );
  });

  it('createForCancelledBooking(): không có PaymentTransaction nào (hoặc PayOS không trả) -> payerBankInfo null', async () => {
    const { service, refundRequestCreate } = buildService();
    const booking = buildBooking();

    await service.createForCancelledBooking(booking, 'Đổi lịch');

    expect(refundRequestCreate).toHaveBeenCalledWith(
      expect.objectContaining({ payerBankInfo: null }),
    );
  });
});

describe('RefundRequestService.complete / reject', () => {
  it('complete(): đổi status COMPLETED, lưu processedByUserId/processedAt, gửi thông báo cho khách', async () => {
    const { service, refundRequestSave, notifyRefund } = buildService({
      refundRequest: {},
    });

    const result = await service.complete(
      'refund-1',
      { adminNote: 'Đã chuyển khoản, mã GD 123' },
      'admin-1',
    );

    expect(result.status).toBe(RefundRequestStatus.COMPLETED);
    expect(result.processedByUserId).toBe('admin-1');
    expect(result.processedAt).toBeInstanceOf(Date);
    expect(refundRequestSave).toHaveBeenCalledTimes(1);
    expect(notifyRefund).toHaveBeenCalledWith(
      BOOKING_USER_ID,
      'REFUND_COMPLETED',
      expect.objectContaining({ adminNote: 'Đã chuyển khoản, mã GD 123' }),
    );
  });

  it('complete(): có kèm proofImageUrl -> lưu đúng URL đó', async () => {
    const { service } = buildService({ refundRequest: {} });

    const result = await service.complete(
      'refund-1',
      {
        adminNote: 'Đã chuyển khoản',
        proofImageUrl: 'https://cdn.example.com/vikahotel/refund-proof/abc.webp',
      },
      'admin-1',
    );

    expect(result.proofImageUrl).toBe(
      'https://cdn.example.com/vikahotel/refund-proof/abc.webp',
    );
  });

  it('complete(): không kèm proofImageUrl -> lưu null, vẫn hoàn tất bình thường', async () => {
    const { service } = buildService({ refundRequest: {} });

    const result = await service.complete(
      'refund-1',
      { adminNote: 'Đã chuyển khoản' },
      'admin-1',
    );

    expect(result.proofImageUrl).toBeNull();
    expect(result.status).toBe(RefundRequestStatus.COMPLETED);
  });

  it('reject(): đổi status REJECTED, bắt buộc có adminNote, gửi thông báo kèm lý do', async () => {
    const { service, notifyRefund } = buildService({ refundRequest: {} });

    const result = await service.reject(
      'refund-1',
      { adminNote: 'Không xác minh được thông tin chuyển khoản' },
      'admin-1',
    );

    expect(result.status).toBe(RefundRequestStatus.REJECTED);
    expect(notifyRefund).toHaveBeenCalledWith(
      BOOKING_USER_ID,
      'REFUND_REJECTED',
      expect.objectContaining({
        adminNote: 'Không xác minh được thông tin chuyển khoản',
      }),
    );
  });

  it('từ chối complete() lần 2 trên 1 yêu cầu đã COMPLETED', async () => {
    const { service } = buildService({
      refundRequest: { status: RefundRequestStatus.COMPLETED },
    });

    await expect(service.complete('refund-1', {}, 'admin-1')).rejects.toThrow(
      'đã được xử lý trước đó',
    );
  });
});

describe('RefundRequestService.findMine', () => {
  it('trả về field tối thiểu, KHÔNG lộ payerBankInfo/conversation/processedByUserId', async () => {
    const { service, refundRequestFind } = buildService({
      mine: [
        {
          refundRequestId: 'refund-1',
          booking: buildBooking({ bookingId: 'booking-1' }),
          amount: 500000,
          refundPercent: 100,
          status: RefundRequestStatus.PENDING,
          adminNote: null,
          createdAt: new Date('2026-01-01'),
          processedAt: null,
          payerBankInfo: { secret: 'không được lộ ra ngoài' },
          processedByUserId: 'admin-999',
        },
      ],
    });

    const result = await service.findMine(BOOKING_USER_ID);

    expect(refundRequestFind).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { booking: { user: { userId: BOOKING_USER_ID } } },
      }),
    );
    expect(result).toEqual([
      {
        refundRequestId: 'refund-1',
        bookingId: 'booking-1',
        amount: 500000,
        refundPercent: 100,
        status: RefundRequestStatus.PENDING,
        adminNote: null,
        createdAt: new Date('2026-01-01'),
        processedAt: null,
        refundProcessingSlaHours: 24,
      },
    ]);
  });

  it('không có yêu cầu nào -> trả mảng rỗng', async () => {
    const { service } = buildService({ mine: [] });
    const result = await service.findMine(BOOKING_USER_ID);
    expect(result).toEqual([]);
  });
});

describe('RefundRequestService.findByBookingId', () => {
  it('có RefundRequest -> trả đúng các field cần cho modal chi tiết đơn (KAN-121)', async () => {
    const { service } = buildService({
      refundRequest: {
        refundRequestId: 'refund-1',
        amount: 1620,
        refundPercent: 50,
        status: RefundRequestStatus.COMPLETED,
        reason: 'Khách đổi lịch',
        adminNote: 'Đã chuyển khoản',
        proofImageUrl: 'https://cdn.example.com/proof.webp',
      },
    });

    const result = await service.findByBookingId('booking-1');

    expect(result).toEqual({
      refundRequestId: 'refund-1',
      status: RefundRequestStatus.COMPLETED,
      amount: 1620,
      refundPercent: 50,
      reason: 'Khách đổi lịch',
      adminNote: 'Đã chuyển khoản',
      proofImageUrl: 'https://cdn.example.com/proof.webp',
      refundProcessingSlaHours: 24,
      qrImageUrl: null,
    });
  });

  it('không có RefundRequest nào (đơn chưa huỷ/chưa thanh toán) -> trả null', async () => {
    const { service } = buildService({ refundRequest: undefined });

    const result = await service.findByBookingId('booking-2');

    expect(result).toBeNull();
  });
});

describe('RefundRequestService.getRefundProcessingSlaHours', () => {
  it('đọc đúng giá trị đã cấu hình trong HotelConfig (KAN-122)', async () => {
    const { service } = buildService({
      hotelConfig: { refundProcessingSlaHours: 6 },
    });

    const result = await service.getRefundProcessingSlaHours();

    expect(result).toBe(6);
  });
});

describe('RefundRequestService.buildQrImageUrl', () => {
  it('có đủ bankBin + accountNumber -> dựng đúng URL Quick Link VietQR', () => {
    const { service } = buildService();
    // UUID thật luôn chỉ gồm hex ở 8 ký tự đầu (không có dấu "-" cho tới vị trí thứ 9) —
    // dùng 1 bookingId dạng UUID thật để addInfo không dính ký tự đặc biệt, đúng thực tế
    // production (khác buildBooking() mặc định 'booking-1' chỉ để test các phần khác).
    const refund = {
      amount: 1620,
      booking: buildBooking({ bookingId: 'a1b2c3d4-e556-43d3-8f50-960dae7d8cfa' }),
      payerBankInfo: {
        'Tên người chuyển': 'Nguyen Van A',
        'Số tài khoản': '0123456789',
        'Ngân hàng': 'TPBank',
        bankBin: '970423',
      },
    } as unknown as RefundRequest;

    const url = service.buildQrImageUrl(refund);

    expect(url).toContain('https://img.vietqr.io/image/970423-0123456789-compact2.png');
    expect(url).toContain('amount=1620');
    expect(url).toContain('addInfo=Hoan+tien+A1B2C3D4');
    expect(url).toContain('accountName=Nguyen+Van+A');
  });

  it('thiếu bankBin -> trả null', () => {
    const { service } = buildService();
    const refund = {
      amount: 1620,
      booking: buildBooking(),
      payerBankInfo: { 'Số tài khoản': '0123456789' },
    } as unknown as RefundRequest;

    expect(service.buildQrImageUrl(refund)).toBeNull();
  });

  it('thiếu accountNumber -> trả null', () => {
    const { service } = buildService();
    const refund = {
      amount: 1620,
      booking: buildBooking(),
      payerBankInfo: { bankBin: '970423' },
    } as unknown as RefundRequest;

    expect(service.buildQrImageUrl(refund)).toBeNull();
  });

  it('payerBankInfo = null -> trả null', () => {
    const { service } = buildService();
    const refund = {
      amount: 1620,
      booking: buildBooking(),
      payerBankInfo: null,
    } as unknown as RefundRequest;

    expect(service.buildQrImageUrl(refund)).toBeNull();
  });
});
