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
  let faqEmbeddingService: { search: jest.Mock };
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
    faqEmbeddingService = { search: jest.fn() };

    tools = new AiAgentToolsService(
      conversationRepo as unknown as never,
      {} as unknown as never, // roomTypeService (không dùng trực tiếp trong các case dưới)
      bookingService as unknown as never,
      promotionService as unknown as never,
      serviceService as unknown as never,
      paymentService as unknown as never,
      faqEmbeddingService as unknown as never,
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

  // Đề xuất đã tạo ở lượt trước, dùng chung cho các case kiểm tra lời đồng ý bên dưới.
  function runCreateBooking(
    text: string,
    confirmProposalId?: string,
  ): ReturnType<AiAgentToolsService['execute']> {
    const conversation = makeConversation({
      pendingBooking: {
        proposalId: 'proposal-current',
        roomTypeId: 'rt-1',
        checkIn: '2026-03-20',
        checkOut: '2026-03-22',
        guestInfo: { fullName: 'Nguyễn Văn A', phone: '0901234567' },
        extraServiceIds: [],
        paymentMethod: 'CASH',
      } as never,
      pendingBookingProposedAt: new Date('2026-01-01T10:00:00Z'),
    });
    return tools.execute(
      'create_booking',
      {},
      {
        userId: 'user-1',
        conversation,
        currentUserMessage: {
          text,
          createdAt: new Date('2026-01-01T10:05:00Z'),
          confirmProposalId,
        },
      },
    );
  }

  it.each([
    ['từ "ok" nằm trong từ khác', 'tôi muốn sửa booking'],
    ['câu hỏi có chữ "được"', 'có được giảm giá thêm không?'],
    ['phủ định đứng sau', 'ok không'],
    ['phủ định viết tắt đứng trước', 'ko đồng ý'],
  ])(
    'create_booking bị từ chối khi tin nhắn không phải lời đồng ý (%s)',
    async (_case, text) => {
      const result = await runCreateBooking(text);

      expect(result.success).toBe(false);
      expect(bookingService.create).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['có dấu', 'Ok, chốt đơn nhé'],
    ['không dấu', 'dong y'],
    // Một số bộ gõ gửi chữ tổ hợp dấu (NFD) — phải chuẩn hoá mới khớp được.
    ['chữ tổ hợp dấu (NFD)', 'Dạ đồng ý ạ'.normalize('NFD')],
  ])(
    'create_booking chấp nhận lời đồng ý rõ ràng (%s)',
    async (_case, text) => {
      const result = await runCreateBooking(text);

      expect(result.success).toBe(true);
      expect(bookingService.create).toHaveBeenCalled();
    },
  );

  it('create_booking thành công khi khách bấm nút xác nhận đúng bản đề xuất hiện tại', async () => {
    const result = await runCreateBooking(
      'Tôi muốn đặt phòng',
      'proposal-current',
    );

    expect(result.success).toBe(true);
    expect(bookingService.create).toHaveBeenCalled();
  });

  it('create_booking bị từ chối khi nút xác nhận thuộc một bản đề xuất cũ', async () => {
    const result = await runCreateBooking(
      'Tôi đồng ý đặt phòng theo thông tin trên.',
      'proposal-old',
    );

    expect(result.success).toBe(false);
    expect(bookingService.create).not.toHaveBeenCalled();
  });

  it('propose_booking gán proposalId mới cho mỗi lần đề xuất', async () => {
    const args = {
      roomTypeId: 'rt-1',
      checkIn: '2026-03-20',
      checkOut: '2026-03-22',
      guestFullName: 'Nguyễn Văn A',
      guestPhone: '0901234567',
      paymentMethod: 'CASH',
    };
    const ctx = {
      userId: 'user-1',
      conversation: makeConversation(),
      currentUserMessage: { text: 'đặt phòng', createdAt: new Date() },
    };

    await tools.execute('propose_booking', args, ctx);
    const firstId = ctx.conversation.pendingBooking?.proposalId;
    await tools.execute('propose_booking', args, ctx);
    const secondId = ctx.conversation.pendingBooking?.proposalId;

    expect(firstId).toEqual(expect.any(String));
    expect(secondId).toEqual(expect.any(String));
    expect(secondId).not.toBe(firstId);
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

  it('get_policy forwards the free-text query to FaqEmbeddingService.search and maps its results', async () => {
    faqEmbeddingService.search.mockResolvedValue([
      {
        entry: {
          faqId: 'late-checkout-fee',
          question: 'Trả phòng trễ có bị tính phí không?',
          answer: 'Phụ thu trả phòng trễ...',
          category: 'Nhận / trả phòng',
        },
        similarity: 0.82,
        lowConfidence: false,
      },
    ]);

    const result = await tools.execute(
      'get_policy',
      { query: 'trả phòng trễ có bị tính phí không' },
      {
        userId: 'user-1',
        conversation: makeConversation(),
        currentUserMessage: {
          text: 'trả phòng trễ có bị tính phí không',
          createdAt: new Date(),
        },
      },
    );

    expect(faqEmbeddingService.search).toHaveBeenCalledWith(
      'trả phòng trễ có bị tính phí không',
    );
    expect(result.success).toBe(true);
    if (!result.success) return;
    const data = result.data as {
      results: Array<{
        content: string;
        category: string;
        lowConfidence: boolean;
      }>;
    };
    expect(data.results).toHaveLength(1);
    expect(data.results[0].content).toBe('Phụ thu trả phòng trễ...');
    expect(data.results[0].category).toBe('Nhận / trả phòng');
    expect(data.results[0].lowConfidence).toBe(false);
  });

  it('get_policy rejects an empty query without calling the embedding search', async () => {
    const result = await tools.execute(
      'get_policy',
      { query: '   ' },
      {
        userId: 'user-1',
        conversation: makeConversation(),
        currentUserMessage: { text: 'hi', createdAt: new Date() },
      },
    );

    expect(result.success).toBe(false);
    expect(faqEmbeddingService.search).not.toHaveBeenCalled();
  });
});
