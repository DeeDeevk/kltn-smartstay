import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { BookingService } from './booking.service';
import { Booking } from './entities/booking.entity';
import { PaymentStatus } from '../common/enums/payment-status.enum';
import { BookingStatus } from '../common/enums/booking-status.enum';
import { PaymentMethod } from '../common/enums/payment-method.enum';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { ShiftAssignmentService } from '../shifts/shift-assignment.service';
import { PaymentTransactionService } from '../cash-ledger/payment-transaction.service';
import { NotificationService } from '../notifications/notification.service';
import { RefundRequestService } from '../refund-requests/refund-request.service';

// Chỉ test markPaidByOrderCode(), findById() và cancel() — các hàm có đổi hành vi trong
// KAN-117/KAN-121/kiểm tra ca làm khi huỷ đơn. Các dependency khác của BookingService
// không được những hàm này gọi tới, nên chỉ cần stub rỗng để constructor không ném lỗi.
function buildService(overrides?: {
  booking?: Partial<Booking> | null;
  refundRequestByBookingId?: Record<string, unknown> | null;
  // true (mặc định) = nhân viên đang trong ca, assertOnDuty() không ném lỗi.
  shiftOnDuty?: boolean;
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
  const bookingFindOne = jest.fn().mockResolvedValue(booking);
  const bookingRepo = {
    findOne: bookingFindOne,
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

  const notifyAdmins = jest.fn().mockResolvedValue(undefined);
  const notificationService = {
    notifyBooking: jest.fn().mockResolvedValue(undefined),
    notifyAdmins,
  } as unknown as NotificationService;

  const findByBookingId = jest
    .fn()
    .mockResolvedValue(overrides?.refundRequestByBookingId ?? null);
  const computeRefundPreview = jest.fn().mockResolvedValue({
    hoursUntilCheckIn: 999,
    refundPercent: 100,
    refundAmount: 0,
    freeCancellationHours: 48,
  });
  const createForCancelledBooking = jest.fn().mockResolvedValue(null);
  const refundRequestService = {
    findByBookingId,
    computeRefundPreview,
    createForCancelledBooking,
  } as unknown as RefundRequestService;

  // Mặc định (shiftOnDuty không truyền hoặc true): coi như luôn đang trong ca, không ném
  // lỗi — đúng hành vi mà assertStaffOnDuty() mong đợi ở nhánh happy-path hiện có cho
  // checkIn/checkOut cũng như các test cancel() không liên quan tới nghiệp vụ ca làm.
  const onDuty = overrides?.shiftOnDuty ?? true;
  const assertOnDuty = jest
    .fn()
    .mockImplementation((_staffId: string, action?: string) => {
      if (!onDuty) {
        return Promise.reject(
          new ForbiddenException(
            `Bạn cần vô ca trước khi làm thủ tục ${action ?? 'nhận/trả phòng'} cho khách`,
          ),
        );
      }
      return Promise.resolve();
    });
  const shiftAssignmentService = {
    assertOnDuty,
  } as unknown as ShiftAssignmentService;

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
    shiftAssignmentService,
    paymentTransactionService,
    notificationService,
    refundRequestService,
  );

  return {
    service,
    bookingRepo,
    bookingSave,
    bookingFindOne,
    record,
    realtimeGateway,
    findByBookingId,
    assertOnDuty,
    notifyAdmins,
    createForCancelledBooking,
  };
}

describe('BookingService.markPaidByOrderCode', () => {
  it('có truyền payerBankInfo -> PaymentTransactionService.record() nhận đúng giá trị đó', async () => {
    const { service, record } = buildService();
    const payerBankInfo = {
      'Tên người chuyển': 'Nguyen Van A',
      'Số tài khoản': '0123456789',
    };

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
      },
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
    const { service, findByBookingId } = buildService({
      refundRequestByBookingId,
    });

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

describe('BookingService.cancel', () => {
  const dto = { reason: 'Khách đổi lịch' };

  it('STAFF chưa vô ca -> bị chặn, ForbiddenException, không huỷ đơn, không tạo RefundRequest', async () => {
    const {
      service,
      bookingFindOne,
      bookingSave,
      assertOnDuty,
      createForCancelledBooking,
    } = buildService({ shiftOnDuty: false });
    const requester = { userId: 'staff-1', role: 'STAFF' };

    await expect(service.cancel('booking-1', requester, dto)).rejects.toThrow(
      ForbiddenException,
    );

    // assertStaffOnDuty() là bước đầu tiên của cancel() -> ném lỗi trước cả khi đọc đơn.
    expect(bookingFindOne).not.toHaveBeenCalled();
    expect(bookingSave).not.toHaveBeenCalled();
    expect(createForCancelledBooking).not.toHaveBeenCalled();
    // Message phải nói đúng "huỷ đơn", không phải message mặc định "nhận/trả phòng".
    expect(assertOnDuty).toHaveBeenCalledWith('staff-1', 'huỷ đơn');
  });

  it('STAFF đang trong ca -> huỷ đơn thành công như luồng cũ', async () => {
    const { service, bookingSave, assertOnDuty } = buildService({
      shiftOnDuty: true,
    });
    const requester = { userId: 'staff-1', role: 'STAFF' };

    const result = await service.cancel('booking-1', requester, dto);

    expect(assertOnDuty).toHaveBeenCalledWith('staff-1', 'huỷ đơn');
    expect(bookingSave).toHaveBeenCalledWith(
      expect.objectContaining({
        status: BookingStatus.CANCELLED,
        cancelReason: dto.reason,
      }),
    );
    expect(result).toEqual({ message: 'Đã huỷ đơn đặt phòng' });
  });

  it('ADMIN huỷ đơn dù không có ca nào -> vẫn thành công (admin luôn bỏ qua check ca)', async () => {
    const { service, bookingSave, assertOnDuty } = buildService({
      shiftOnDuty: false,
    });
    const requester = { userId: 'admin-1', role: 'ADMIN' };

    const result = await service.cancel('booking-1', requester, dto);

    // assertStaffOnDuty() chỉ gọi assertOnDuty() khi role === STAFF -> admin không đụng tới.
    expect(assertOnDuty).not.toHaveBeenCalled();
    expect(bookingSave).toHaveBeenCalledWith(
      expect.objectContaining({ status: BookingStatus.CANCELLED }),
    );
    expect(result).toEqual({ message: 'Đã huỷ đơn đặt phòng' });
  });

  it('CUSTOMER tự huỷ đơn của chính mình -> vẫn thành công như cũ (không áp dụng check ca)', async () => {
    const { service, bookingSave, assertOnDuty } = buildService({
      shiftOnDuty: false,
    });
    // Khớp user.userId = 'user-1' của fixture đơn mặc định trong buildService().
    const requester = { userId: 'user-1', role: 'CUSTOMER' };

    const result = await service.cancel('booking-1', requester, dto);

    expect(assertOnDuty).not.toHaveBeenCalled();
    expect(bookingSave).toHaveBeenCalledWith(
      expect.objectContaining({ status: BookingStatus.CANCELLED }),
    );
    expect(result).toEqual({ message: 'Đã huỷ đơn đặt phòng' });
  });
});

describe('BookingService.create — chặn ngày nhận phòng đã qua', () => {
  // Cố định "hôm nay" = 09/10/2026 giờ VN (02:00 UTC = 09:00 VN), chỉ giả lập Date.
  beforeEach(() => {
    jest.useFakeTimers({
      now: new Date('2026-10-09T02:00:00Z'),
      doNotFake: [
        'nextTick',
        'setImmediate',
        'setTimeout',
        'setInterval',
        'queueMicrotask',
      ],
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('báo 400 khi ngày nhận phòng là hôm qua, không chạm tới DB', async () => {
    const { service, bookingSave } = buildService();

    await expect(
      service.create('user-1', {
        roomTypeId: 'rt-1',
        checkIn: '2026-10-08',
        checkOut: '2026-10-10',
      } as never),
    ).rejects.toThrow(
      new BadRequestException('Ngày nhận phòng không được ở trong quá khứ'),
    );
    expect(bookingSave).not.toHaveBeenCalled();
  });

  it('tính "hôm nay" theo giờ Việt Nam: 23:30 UTC ngày 08/10 đã là 09/10 ở VN', async () => {
    jest.setSystemTime(new Date('2026-10-08T23:30:00Z'));
    const { service } = buildService();

    await expect(
      service.create('user-1', {
        roomTypeId: 'rt-1',
        checkIn: '2026-10-08',
        checkOut: '2026-10-10',
      } as never),
    ).rejects.toThrow('quá khứ');
  });
});
