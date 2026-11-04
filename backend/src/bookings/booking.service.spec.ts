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
import { UserService } from '../users/user.service';
import { ServiceService } from '../services/service.service';

// Chỉ test markPaidByOrderCode(), findById(), cancel() và addService() — các hàm có đổi
// hành vi trong KAN-117/KAN-121/kiểm tra ca làm. Các dependency khác của BookingService
// không được những hàm này gọi tới, nên chỉ cần stub rỗng để constructor không ném lỗi.
function buildService(overrides?: {
  booking?: Partial<Booking> | null;
  refundRequestByBookingId?: Record<string, unknown> | null;
  // true (mặc định) = nhân viên đang trong ca, assertOnDuty() không ném lỗi.
  shiftOnDuty?: boolean;
  // Dịch vụ đang bán mà findActiveByIds() trả về (mặc định rỗng).
  activeServices?: { serviceId: string; name: string; price: number }[];
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
  const itemSave = jest.fn((x: unknown) => Promise.resolve(x));
  const itemCreate = jest.fn((x: unknown) => x);
  // cancel()/markPaidByOrderCode() chạy trong 1 transaction (manager.transaction) —
  // giả lập manager chạy callback NGAY (không thật sự mở transaction DB), trả cùng
  // các mock save/findOne ở trên cho Booking để assertion trên bookingSave vẫn đúng
  // dù lệnh save() giờ đi qua manager.getRepository(Booking) thay vì gọi trực tiếp.
  const bookingRepo = {
    findOne: bookingFindOne,
    save: bookingSave,
    manager: {
      transaction: jest.fn((cb: (manager: unknown) => unknown) =>
        cb({
          getRepository: (entity: unknown) =>
            entity === Booking
              ? { save: bookingSave, findOne: bookingFindOne }
              : { save: itemSave, create: itemCreate },
        }),
      ),
    },
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

  // addService()/checkOut() gọi findActiveByIds() để kiểm tra dịch vụ còn bán và lấy đơn giá.
  const findActiveByIds = jest
    .fn()
    .mockResolvedValue(overrides?.activeServices ?? []);
  const serviceService = { findActiveByIds } as unknown as ServiceService;

  const service = new BookingService(
    bookingRepo,
    {} as never, // bookingServiceItemRepo
    {} as never, // roomRepo
    {} as never, // redisClient
    {} as never, // roomTypeService
    serviceService,
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
    itemSave,
    findActiveByIds,
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

    // Tham số thứ 2 là EntityManager của transaction bọc quanh save() + record() (xem
    // markPaidByOrderCode) — không quan tâm hình dạng cụ thể, chỉ cần xác nhận có truyền.
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        bookingId: 'booking-1',
        method: PaymentMethod.PAYOS,
        payerBankInfo,
      }),
      expect.anything(),
    );
  });

  it('không truyền payerBankInfo -> PaymentTransactionService.record() nhận null', async () => {
    const { service, record } = buildService();

    await service.markPaidByOrderCode(123456);

    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({ payerBankInfo: null }),
      expect.anything(),
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

describe('BookingService.addService', () => {
  const staff = { userId: 'staff-1', role: 'STAFF' };
  const admin = { userId: 'admin-1', role: 'ADMIN' };
  const water = { serviceId: 'svc-1', name: 'Nước suối', price: 20000 };
  const dto = { items: [{ serviceId: 'svc-1', quantity: 2 }] };
  // Hàm (không phải hằng) vì saveServiceItems() ghi thẳng vào booking.serviceItems —
  // dùng chung 1 object thì test sau dính dịch vụ của test trước.
  const checkedInBooking = () =>
    ({
      bookingId: 'booking-1',
      status: BookingStatus.CHECKED_IN,
      roomAmount: 500000,
      lateCheckoutFee: 0,
      discountAmount: 0,
      paidAmount: 0,
      serviceItems: [],
    }) as unknown as Booking;

  it('STAFF chưa vô ca -> 403, không đọc đơn', async () => {
    const { service, assertOnDuty, bookingFindOne } = buildService({
      shiftOnDuty: false,
      booking: checkedInBooking(),
    });

    await expect(service.addService('booking-1', dto, staff)).rejects.toThrow(
      ForbiddenException,
    );
    expect(assertOnDuty).toHaveBeenCalledWith('staff-1', 'thêm dịch vụ');
    expect(bookingFindOne).not.toHaveBeenCalled();
  });

  it('đơn chưa nhận phòng -> 400, không lưu dịch vụ', async () => {
    // Đơn mặc định của buildService() đang PENDING.
    const { service, itemSave } = buildService({ activeServices: [water] });

    await expect(service.addService('booking-1', dto, staff)).rejects.toThrow(
      BadRequestException,
    );
    expect(itemSave).not.toHaveBeenCalled();
  });

  it('dịch vụ không tồn tại / đã ngưng -> 400, không lưu dịch vụ', async () => {
    const { service, itemSave } = buildService({
      booking: checkedInBooking(),
      activeServices: [],
    });

    await expect(service.addService('booking-1', dto, staff)).rejects.toThrow(
      BadRequestException,
    );
    expect(itemSave).not.toHaveBeenCalled();
  });

  it('hợp lệ -> lưu đúng đơn giá, cộng tiền dịch vụ (không tính VAT trên dịch vụ)', async () => {
    const { service, itemSave } = buildService({
      booking: checkedInBooking(),
      activeServices: [water],
    });

    const res = await service.addService('booking-1', dto, staff);

    expect(itemSave).toHaveBeenCalledTimes(1);
    expect(itemSave).toHaveBeenCalledWith([
      expect.objectContaining({ quantity: 2, unitPrice: 20000 }),
    ]);
    expect(res.serviceItems).toHaveLength(1);
    expect(res.serviceAmount).toBe(40000);
    // 500000 phòng + 40000 VAT 8% tiền phòng + 40000 dịch vụ.
    expect(res.totalAmount).toBe(580000);
  });

  it('ADMIN không có ca -> vẫn thêm được (admin bỏ qua check ca)', async () => {
    const { service, assertOnDuty } = buildService({
      shiftOnDuty: false,
      booking: checkedInBooking(),
      activeServices: [water],
    });

    const res = await service.addService('booking-1', dto, admin);

    expect(assertOnDuty).not.toHaveBeenCalled();
    expect(res.serviceAmount).toBe(40000);
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
describe('BookingService.markFailedByOrderCode', () => {
  it('đơn UNPAID -> chuyển FAILED và lưu đúng 1 lần', async () => {
    const { service, bookingSave } = buildService();

    const result = await service.markFailedByOrderCode(123456);

    expect(result?.paymentStatus).toBe(PaymentStatus.FAILED);
    expect(bookingSave).toHaveBeenCalledTimes(1);
  });

  it('đơn đã FAILED -> không lưu lại, không tạo thêm thông báo trùng', async () => {
    const { service, bookingSave } = buildService({
      booking: {
        bookingId: 'booking-1',
        payosOrderCode: '123456',
        paymentStatus: PaymentStatus.FAILED,
        user: { userId: 'user-1' },
      } as never,
    });

    await service.markFailedByOrderCode(123456);

    expect(bookingSave).not.toHaveBeenCalled();
  });
});

describe('BookingService.assignFreshPayosOrderCode', () => {
  it('đơn FAILED (link cũ hết hạn) -> cấp mã mới và đưa về UNPAID', async () => {
    const { service, bookingSave } = buildService({
      booking: {
        bookingId: 'booking-1',
        payosOrderCode: '123456',
        paymentStatus: PaymentStatus.FAILED,
      },
    });

    const code = await service.assignFreshPayosOrderCode('booking-1');

    expect(code).not.toBe('123456');
    expect(bookingSave).toHaveBeenCalledWith(
      expect.objectContaining({
        payosOrderCode: code,
        paymentStatus: PaymentStatus.UNPAID,
      }),
    );
  });

  it('đơn PAID (lễ tân thu thêm lúc trả phòng) -> chỉ đổi mã, giữ nguyên PAID', async () => {
    const { service, bookingSave } = buildService({
      booking: {
        bookingId: 'booking-1',
        payosOrderCode: '123456',
        paymentStatus: PaymentStatus.PAID,
      },
    });

    await service.assignFreshPayosOrderCode('booking-1');

    expect(bookingSave).toHaveBeenCalledWith(
      expect.objectContaining({ paymentStatus: PaymentStatus.PAID }),
    );
  });
});

type NewBookingInfo = {
  bookingId: string;
  guestName?: string | null;
  roomTypeName?: string | null;
  checkIn: string;
  checkOut: string;
};

// notifyStaffOfNewBooking() là hàm PRIVATE, chỉ gọi từ create() ngay sau khi đơn đã lưu
// xong (fire-and-forget qua `void`). Test thẳng hàm này thay vì dựng lại toàn bộ create()
// (transaction, khoá Redis, đếm phòng trống, áp mã khuyến mãi...) — những phần đó không
// đổi hành vi và không liên quan tới việc báo thông báo đơn mới, nên không cần kéo theo
// vào test này. Ép kiểu qua 1 interface cục bộ (thay vì `any`) để không vi phạm
// no-unsafe-call/no-unsafe-member-access của eslint.
function callNotifyStaffOfNewBooking(
  service: BookingService,
  bookerUserId: string,
  booking: NewBookingInfo,
): Promise<void> {
  return (
    service as unknown as {
      notifyStaffOfNewBooking: (
        bookerUserId: string,
        booking: NewBookingInfo,
      ) => Promise<void>;
    }
  ).notifyStaffOfNewBooking(bookerUserId, booking);
}

describe('BookingService.notifyStaffOfNewBooking (private) — báo đơn mới cho nhân viên + admin', () => {
  function buildNotifyService(overrides?: {
    staffIds?: string[];
    findActiveStaffIdsError?: Error;
  }) {
    const notifyStaffNewBooking = jest.fn().mockResolvedValue(undefined);
    const notifyAdminNewBooking = jest.fn().mockResolvedValue(undefined);
    const notificationService = {
      notifyStaffNewBooking,
      notifyAdminNewBooking,
    } as unknown as NotificationService;

    const findActiveStaffIds = overrides?.findActiveStaffIdsError
      ? jest.fn().mockRejectedValue(overrides.findActiveStaffIdsError)
      : jest
          .fn()
          .mockResolvedValue(overrides?.staffIds ?? ['staff-1', 'staff-2']);
    const userService = { findActiveStaffIds } as unknown as UserService;

    const service = new BookingService(
      {} as never, // bookingRepo
      {} as never, // bookingServiceItemRepo
      {} as never, // roomRepo
      {} as never, // redisClient
      {} as never, // roomTypeService
      {} as never, // serviceService
      {} as never, // promotionService
      userService,
      {} as never, // realtimeGateway
      {} as never, // shiftAssignmentService
      {} as never, // paymentTransactionService
      notificationService,
      {} as never, // refundRequestService
    );

    return {
      service,
      notifyStaffNewBooking,
      notifyAdminNewBooking,
      findActiveStaffIds,
    };
  }

  const booking = {
    bookingId: 'booking-1',
    guestName: 'Khách A',
    roomTypeName: 'Deluxe',
    checkIn: '2026-10-20',
    checkOut: '2026-10-22',
  };

  it('đặt phòng thành công -> báo cho cả nhân viên đang trực VÀ admin đang hoạt động', async () => {
    const { service, notifyStaffNewBooking, notifyAdminNewBooking } =
      buildNotifyService();

    await callNotifyStaffOfNewBooking(service, 'user-1', booking);

    expect(notifyStaffNewBooking).toHaveBeenCalledWith(
      ['staff-1', 'staff-2'],
      booking,
    );
    // excludeUserId = người đặt -> notifyAdminNewBooking tự lọc người đặt ra nếu họ
    // cũng là admin (xem NotificationService.notifyAdmins).
    expect(notifyAdminNewBooking).toHaveBeenCalledWith(booking, 'user-1');
  });

  it('người đặt cũng nằm trong danh sách nhân viên đang trực -> không tự báo cho chính mình', async () => {
    const { service, notifyStaffNewBooking } = buildNotifyService({
      staffIds: ['staff-1', 'booker-1'],
    });

    await callNotifyStaffOfNewBooking(service, 'booker-1', booking);

    expect(notifyStaffNewBooking).toHaveBeenCalledWith(['staff-1'], booking);
  });

  it('báo nhân viên lỗi (VD DB down) -> vẫn báo admin bình thường, không ném lỗi ra ngoài', async () => {
    const { service, notifyAdminNewBooking } = buildNotifyService({
      findActiveStaffIdsError: new Error('DB down'),
    });

    await expect(
      callNotifyStaffOfNewBooking(service, 'user-1', booking),
    ).resolves.toBeUndefined();
    expect(notifyAdminNewBooking).toHaveBeenCalledWith(booking, 'user-1');
  });

  it('báo admin lỗi -> không ném lỗi ra ngoài (lỗi thông báo không làm hỏng việc tạo đơn)', async () => {
    const { service, notifyAdminNewBooking, notifyStaffNewBooking } =
      buildNotifyService();
    notifyAdminNewBooking.mockRejectedValueOnce(
      new Error('Notify admin failed'),
    );

    await expect(
      callNotifyStaffOfNewBooking(service, 'user-1', booking),
    ).resolves.toBeUndefined();
    expect(notifyStaffNewBooking).toHaveBeenCalled();
  });
});
