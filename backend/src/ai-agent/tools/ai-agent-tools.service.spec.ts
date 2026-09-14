import { AiAgentToolsService } from './ai-agent-tools.service';
import { AiConversation } from '../entities/ai-conversation.entity';

// Test guardrail thật (không mock ToolsService) — đây là phần "bắt buộc" của đề bài:
// create_booking chỉ được thực thi khi đã có propose_booking ở một lượt TRƯỚC đó và
// khách vừa trả lời đồng ý rõ ràng. Các service tầng dưới (RoomTypeService,
// BookingService, PromotionService, ServiceService) được mock vì đây là unit test cho
// logic điều phối/guardrail, không phải test tích hợp DB.
describe('AiAgentToolsService', () => {
  let conversationRepo: { save: jest.Mock };
  let bookingService: {
    getRoomTypeAvailability: jest.Mock;
    create: jest.Mock;
  };
  let promotionService: { validateCode: jest.Mock };
  let serviceService: { findActiveByIds: jest.Mock };
  let paymentService: { createLinkForBooking: jest.Mock };
  let tools: AiAgentToolsService;

  const roomType = { roomTypeId: 'rt-1', name: 'Deluxe', basePrice: 1000000 };

  beforeEach(() => {
    conversationRepo = { save: jest.fn((c) => Promise.resolve(c)) };
    bookingService = {
      getRoomTypeAvailability: jest.fn().mockResolvedValue({
        roomType,
        availableCount: 2,
        available: true,
      }),
      create: jest.fn().mockResolvedValue({
        bookingId: 'b-1',
        status: 'PENDING',
        totalAmount: 2160000,
      }),
    };
    promotionService = { validateCode: jest.fn() };
    serviceService = { findActiveByIds: jest.fn().mockResolvedValue([]) };
    paymentService = { createLinkForBooking: jest.fn() };

    tools = new AiAgentToolsService(
      conversationRepo as unknown as never,
      {} as unknown as never, // roomTypeService (không dùng trực tiếp trong các case dưới)
      bookingService as unknown as never,
      promotionService as unknown as never,
      serviceService as unknown as never,
      paymentService as unknown as never,
    );
  });

  function makeConversation(
    overrides: Partial<AiConversation> = {},
  ): AiConversation {
    return {
      conversationId: 'conv-1',
      pendingBooking: null,
      pendingBookingProposedAt: null,
      ...overrides,
    } as AiConversation;
  }

  it('propose_booking tính đúng tổng tiền (giá phòng theo số đêm + VAT) và lưu pendingBooking', async () => {
    const conversation = makeConversation();
    const result = await tools.execute(
      'propose_booking',
      {
        roomTypeId: 'rt-1',
        checkIn: '2026-03-20',
        checkOut: '2026-03-22',
        guestFullName: 'Nguyễn Văn A',
        guestPhone: '0901234567',
        paymentMethod: 'CASH',
      },
      {
        userId: 'user-1',
        conversation,
        currentUserMessage: { text: 'đặt phòng deluxe', createdAt: new Date() },
      },
    );

    expect(result.success).toBe(true);
    if (!result.success) return;
    const data = result.data as { totalAmount: number; nights: number };
    // roomAmount = 1.000.000 * 2 đêm = 2.000.000, VAT 8% = 160.000 -> tổng 2.160.000
    expect(data.nights).toBe(2);
    expect(data.totalAmount).toBe(2160000);
    expect(conversation.pendingBooking).not.toBeNull();
    expect(conversation.pendingBookingProposedAt).toBeInstanceOf(Date);
  });

  it('propose_booking bị từ chối khi chưa biết phương thức thanh toán', async () => {
    const conversation = makeConversation();
    const result = await tools.execute(
      'propose_booking',
      {
        roomTypeId: 'rt-1',
        checkIn: '2026-03-20',
        checkOut: '2026-03-22',
        guestFullName: 'Nguyễn Văn A',
        guestPhone: '0901234567',
        // thiếu paymentMethod
      },
      {
        userId: 'user-1',
        conversation,
        currentUserMessage: { text: 'đặt phòng deluxe', createdAt: new Date() },
      },
    );

    expect(result.success).toBe(false);
    expect(conversation.pendingBooking).toBeNull();
  });

  it('create_booking bị từ chối khi chưa có pendingBooking nào', async () => {
    const conversation = makeConversation();

    const result = await tools.execute(
      'create_booking',
      {},
      {
        userId: 'user-1',
        conversation,
        currentUserMessage: { text: 'Đồng ý', createdAt: new Date() },
      },
    );

    expect(result.success).toBe(false);
    expect(bookingService.create).not.toHaveBeenCalled();
  });

  it('create_booking bị từ chối khi propose_booking và xác nhận xảy ra trong CÙNG một lượt', async () => {
    const proposedAt = new Date('2026-01-01T10:00:00Z');
    const conversation = makeConversation({
      pendingBooking: { totalAmount: 2160000 } as never,
      pendingBookingProposedAt: proposedAt,
    });

    const result = await tools.execute(
      'create_booking',
      {},
      {
        userId: 'user-1',
        conversation,
        // Tin nhắn hiện tại có createdAt TRƯỚC/BẰNG thời điểm propose -> chưa đủ 1 lượt
        // round-trip, phải coi như chưa xác nhận.
        currentUserMessage: {
          text: 'Đồng ý',
          createdAt: new Date('2026-01-01T09:59:59Z'),
        },
      },
    );

    expect(result.success).toBe(false);
    expect(bookingService.create).not.toHaveBeenCalled();
  });

  it('create_booking bị từ chối khi khách trả lời "không đồng ý" (phủ định chứa từ đồng ý)', async () => {
    const proposedAt = new Date('2026-01-01T10:00:00Z');
    const conversation = makeConversation({
      pendingBooking: { totalAmount: 2160000 } as never,
      pendingBookingProposedAt: proposedAt,
    });

    const result = await tools.execute(
      'create_booking',
      {},
      {
        userId: 'user-1',
        conversation,
        currentUserMessage: {
          text: 'Thôi không đồng ý đâu, để tôi suy nghĩ thêm',
          createdAt: new Date('2026-01-01T10:05:00Z'),
        },
      },
    );

    expect(result.success).toBe(false);
    expect(bookingService.create).not.toHaveBeenCalled();
  });

  it('create_booking thành công khi đã propose ở lượt trước và khách xác nhận đồng ý ở lượt sau', async () => {
    const proposedAt = new Date('2026-01-01T10:00:00Z');
    const pendingBooking = {
      roomTypeId: 'rt-1',
      checkIn: '2026-03-20',
      checkOut: '2026-03-22',
      guestInfo: { fullName: 'Nguyễn Văn A', phone: '0901234567' },
      extraServiceIds: [],
      paymentMethod: 'CASH',
      totalAmount: 2160000,
    };
    const conversation = makeConversation({
      pendingBooking: pendingBooking as never,
      pendingBookingProposedAt: proposedAt,
    });

    const result = await tools.execute(
      'create_booking',
      {},
      {
        userId: 'user-1',
        conversation,
        currentUserMessage: {
          text: 'Dạ đồng ý ạ',
          createdAt: new Date('2026-01-01T10:05:00Z'),
        },
      },
    );

    expect(result.success).toBe(true);
    expect(bookingService.create).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ roomTypeId: 'rt-1', paymentMethod: 'CASH' }),
    );
    expect(paymentService.createLinkForBooking).not.toHaveBeenCalled();
    // Sau khi tạo booking thành công, pendingBooking phải được xoá để không bị tạo trùng.
    expect(conversation.pendingBooking).toBeNull();
    expect(conversation.pendingBookingProposedAt).toBeNull();
  });

  it('create_booking với paymentMethod=PAYOS tạo kèm link/QR thanh toán', async () => {
    const proposedAt = new Date('2026-01-01T10:00:00Z');
    const pendingBooking = {
      roomTypeId: 'rt-1',
      checkIn: '2026-03-20',
      checkOut: '2026-03-22',
      guestInfo: { fullName: 'Nguyễn Văn A', phone: '0901234567' },
      extraServiceIds: [],
      paymentMethod: 'PAYOS',
      totalAmount: 2160000,
    };
    const conversation = makeConversation({
      pendingBooking: pendingBooking as never,
      pendingBookingProposedAt: proposedAt,
    });
    paymentService.createLinkForBooking.mockResolvedValue({
      checkoutUrl: 'https://pay.payos.vn/web/abc',
      qrCode: '00020101...qr-payload',
      expiredAt: 1234567890,
    });

    const result = await tools.execute(
      'create_booking',
      {},
      {
        userId: 'user-1',
        conversation,
        currentUserMessage: {
          text: 'Dạ đồng ý ạ',
          createdAt: new Date('2026-01-01T10:05:00Z'),
        },
      },
    );

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(paymentService.createLinkForBooking).toHaveBeenCalledWith(
      'b-1',
      expect.objectContaining({ userId: 'user-1' }),
    );
    const data = result.data as { qrCode: string; checkoutUrl: string };
    expect(data.qrCode).toBe('00020101...qr-payload');
    expect(data.checkoutUrl).toBe('https://pay.payos.vn/web/abc');
  });
});
