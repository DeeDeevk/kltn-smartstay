import { Repository } from 'typeorm';
import { RefundRequestService } from './refund-request.service';
import { RefundRequest } from './entities/refund-request.entity';
import { Booking } from '../bookings/entities/booking.entity';
import {
  Conversation,
  ConversationStatus,
} from '../chat/entities/conversation.entity';
import { NotificationService } from '../notifications/notification.service';
import { RefundRequestStatus } from '../common/enums/refund-request-status.enum';

const BOOKING_USER_ID = 'user-1';

function buildBooking(overrides?: Partial<Booking>): Booking {
  return {
    bookingId: 'booking-1',
    user: { userId: BOOKING_USER_ID, fullName: 'Khách A' },
    roomType: { name: 'Deluxe' },
    paidAmount: 500000,
    guestInfo: { fullName: 'Khách A', phone: '0900000000' },
    ...overrides,
  } as Booking;
}

function buildService(overrides?: {
  openConversation?: Partial<Conversation> | null;
  refundRequest?: Partial<RefundRequest>;
}) {
  const refundRequestSave = jest.fn((x: unknown) => Promise.resolve(x));
  const refundRequestCreate = jest.fn((x: unknown) => x);
  const refundRequestRepo = {
    create: refundRequestCreate,
    save: refundRequestSave,
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

  const service = new RefundRequestService(
    refundRequestRepo,
    conversationRepo,
    notificationService,
  );
  return {
    service,
    refundRequestSave,
    refundRequestCreate,
    conversationRepo,
    notifyRefund,
  };
}

describe('RefundRequestService.createForCancelledBooking', () => {
  it('tạo RefundRequest với amount = booking.paidAmount và tự gắn hội thoại OPEN tìm được', async () => {
    const { service, refundRequestCreate } = buildService();
    const booking = buildBooking({ paidAmount: 750000 });

    await service.createForCancelledBooking(booking, 'Đổi lịch');

    expect(refundRequestCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 750000,
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
