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
    findAvailableRoomTypes: jest.Mock;
    create: jest.Mock;
    findByDateForAgent: jest.Mock;
  };
  let promotionService: { validateCode: jest.Mock };
  let serviceService: { findActiveByIds: jest.Mock };
  let paymentService: { createLinkForBooking: jest.Mock };
  let faqEmbeddingService: { search: jest.Mock };
  let placesService: { getNearbyPlaces: jest.Mock };
  let localEventService: { findForDate: jest.Mock };
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
      findAvailableRoomTypes: jest.fn().mockResolvedValue([
        {
          roomTypeId: 'rt-1',
          name: 'Standard Room',
          basePrice: 1200000,
          availableCount: 3,
        },
        {
          roomTypeId: 'rt-2',
          name: 'Superior Room',
          basePrice: 1500000,
          availableCount: 1,
        },
        {
          roomTypeId: 'rt-3',
          name: 'Honeymoon Suite',
          basePrice: 3900000,
          availableCount: 1,
        },
      ]),
      create: jest.fn().mockResolvedValue({
        bookingId: 'b-1',
        status: 'PENDING',
        totalAmount: 2160000,
      }),
      findByDateForAgent: jest.fn().mockResolvedValue({
        total: 2,
        statusCounts: { CONFIRMED: 1, PENDING: 1 },
        bookings: [
          {
            bookingId: '4ae6e73a-1111-2222-3333-444455556666',
            guestName: 'Nguyễn Văn A',
            guestPhone: '0901234567',
            status: 'CONFIRMED',
          },
          {
            bookingId: '5bf7f84b-1111-2222-3333-444455556666',
            guestName: 'Trần Thị B',
            guestPhone: '0907654321',
            status: 'PENDING',
          },
        ],
      }),
    };
    promotionService = { validateCode: jest.fn() };
    serviceService = { findActiveByIds: jest.fn().mockResolvedValue([]) };
    paymentService = { createLinkForBooking: jest.fn() };
    faqEmbeddingService = { search: jest.fn() };
    placesService = { getNearbyPlaces: jest.fn() };
    localEventService = { findForDate: jest.fn() };

    tools = new AiAgentToolsService(
      conversationRepo as unknown as never,
      {} as unknown as never, // roomTypeService (không dùng trực tiếp trong các case dưới)
      bookingService as unknown as never,
      promotionService as unknown as never,
      serviceService as unknown as never,
      paymentService as unknown as never,
      faqEmbeddingService as unknown as never,
      placesService as unknown as never,
      localEventService as unknown as never,
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
        role: 'CUSTOMER',
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
        role: 'CUSTOMER',
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
        role: 'CUSTOMER',
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
        role: 'CUSTOMER',
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
        role: 'CUSTOMER',
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
        role: 'CUSTOMER',
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
        role: 'CUSTOMER',
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
      role: 'CUSTOMER',
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
        role: 'CUSTOMER',
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
        role: 'CUSTOMER',
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
        role: 'CUSTOMER',
        conversation: makeConversation(),
        currentUserMessage: { text: 'hi', createdAt: new Date() },
      },
    );

    expect(result.success).toBe(false);
    expect(faqEmbeddingService.search).not.toHaveBeenCalled();
  });

  it('search_rooms filters out room types above maxPrice, matching what a budget-limited text answer describes', async () => {
    const result = await tools.execute(
      'search_rooms',
      {
        checkIn: '2026-03-20',
        checkOut: '2026-03-22',
        guests: 1,
        maxPrice: 2000000,
      },
      {
        userId: 'user-1',
        role: 'CUSTOMER',
        conversation: makeConversation(),
        currentUserMessage: {
          text: 'phòng 1 người dưới 2 triệu',
          createdAt: new Date(),
        },
      },
    );

    expect(result.success).toBe(true);
    if (!result.success) return;
    const rooms = result.data as Array<{ name: string; basePrice: number }>;
    // Honeymoon Suite (3.900.000) phải bị loại — nếu tool trả nguyên danh sách chưa lọc,
    // card phòng hiển thị cho khách sẽ có phòng vượt ngân sách dù câu trả lời chữ nói
    // "dưới 2 triệu".
    expect(rooms.map((r) => r.name)).toEqual([
      'Standard Room',
      'Superior Room',
    ]);
    expect(rooms.every((r) => r.basePrice <= 2000000)).toBe(true);
  });

  it('get_nearby_places rejects an invalid category before calling PlacesService', async () => {
    const result = await tools.execute(
      'get_nearby_places',
      { category: 'zoo' },
      {
        userId: 'user-1',
        role: 'CUSTOMER',
        conversation: makeConversation(),
        currentUserMessage: {
          text: 'gần đây có gì chơi',
          createdAt: new Date(),
        },
      },
    );

    expect(result.success).toBe(false);
    expect(placesService.getNearbyPlaces).not.toHaveBeenCalled();
  });

  it('get_nearby_places forwards a valid category (and optional radius) to PlacesService', async () => {
    placesService.getNearbyPlaces.mockResolvedValue([
      {
        name: 'Quán ăn ABC',
        address: '123 Lê Lợi',
        rating: 4.5,
        mapsUri: 'https://maps.google.com/x',
        location: null,
      },
    ]);

    const result = await tools.execute(
      'get_nearby_places',
      { category: 'restaurant', radius: 1000 },
      {
        userId: 'user-1',
        role: 'CUSTOMER',
        conversation: makeConversation(),
        currentUserMessage: { text: 'quán ăn gần đây', createdAt: new Date() },
      },
    );

    expect(placesService.getNearbyPlaces).toHaveBeenCalledWith(
      'restaurant',
      1000,
    );
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect((result.data as Array<{ name: string }>)[0].name).toBe(
      'Quán ăn ABC',
    );
  });

  it('get_local_events rejects an empty date and requires it before calling LocalEventService', async () => {
    const result = await tools.execute(
      'get_local_events',
      {},
      {
        userId: 'user-1',
        role: 'CUSTOMER',
        conversation: makeConversation(),
        currentUserMessage: {
          text: 'cuối tuần này có sự kiện gì',
          createdAt: new Date(),
        },
      },
    );

    expect(result.success).toBe(false);
    expect(localEventService.findForDate).not.toHaveBeenCalled();
  });

  it('get_local_events forwards the date and maps entries to title/description/recurrence', async () => {
    localEventService.findForDate.mockResolvedValue([
      {
        eventId: 'e-1',
        title: 'Chợ đêm phố đi bộ',
        description: 'Diễn ra mỗi tối thứ Bảy',
        recurrence: 'WEEKLY',
        dayOfWeek: 6,
        specificDate: null,
      },
    ]);

    const result = await tools.execute(
      'get_local_events',
      { date: '2026-03-21' },
      {
        userId: 'user-1',
        role: 'CUSTOMER',
        conversation: makeConversation(),
        currentUserMessage: {
          text: 'thứ 7 này có sự kiện gì không',
          createdAt: new Date(),
        },
      },
    );

    expect(localEventService.findForDate).toHaveBeenCalledWith('2026-03-21');
    expect(result.success).toBe(true);
    if (!result.success) return;
    // 2026-03-21 is a Saturday ("Thứ Bảy") — computed server-side so the model quotes it
    // instead of doing its own (unreliable) date-to-weekday arithmetic.
    expect(result.data).toEqual({
      date: '2026-03-21',
      weekday: 'Thứ Bảy',
      events: [
        {
          title: 'Chợ đêm phố đi bộ',
          description: 'Diễn ra mỗi tối thứ Bảy',
          recurrence: 'WEEKLY',
        },
      ],
    });
  });

  // Phạm vi dữ liệu đơn đặt phòng do VAI TRÒ quyết định ở server, không phải do model
  // truyền tham số — khách hàng không được xem đơn của người khác dù có dụ model.
  function listBookingsCtx(role: string) {
    return {
      userId: 'user-1',
      role,
      conversation: makeConversation(),
      currentUserMessage: {
        text: 'hôm nay có bao nhiêu khách nhận phòng',
        createdAt: new Date(),
      },
    };
  }

  it('list_bookings_by_date: lễ tân xem được toàn bộ đơn của khách sạn', async () => {
    const result = await tools.execute(
      'list_bookings_by_date',
      { date: '2026-09-20' },
      listBookingsCtx('STAFF'),
    );

    expect(bookingService.findByDateForAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        date: '2026-09-20',
        dateType: 'arrival',
        requesterUserId: undefined,
      }),
    );
    expect(result.success).toBe(true);
    if (!result.success) return;
    const data = result.data as {
      scope: string;
      total: number;
      bookings: { bookingCode: string; guestPhone?: string }[];
    };
    expect(data.scope).toBe('hotel');
    expect(data.total).toBe(2);
    expect(data.bookings[0].bookingCode).toBe('4AE6E73A');
    expect(data.bookings[0].guestPhone).toBe('0901234567');
  });

  it('list_bookings_by_date: khách hàng chỉ xem được đơn của chính mình, không lộ SĐT', async () => {
    const result = await tools.execute(
      'list_bookings_by_date',
      { date: '2026-09-20', dateType: 'departure' },
      listBookingsCtx('CUSTOMER'),
    );

    expect(bookingService.findByDateForAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        dateType: 'departure',
        requesterUserId: 'user-1',
      }),
    );
    expect(result.success).toBe(true);
    if (!result.success) return;
    const data = result.data as {
      scope: string;
      bookings: { guestPhone?: string }[];
    };
    expect(data.scope).toBe('own');
    expect(data.bookings[0].guestPhone).toBeUndefined();
  });

  it('list_bookings_by_date: từ chối khi ngày sai định dạng', async () => {
    const result = await tools.execute(
      'list_bookings_by_date',
      { date: '20/09/2026' },
      listBookingsCtx('STAFF'),
    );

    expect(result.success).toBe(false);
    expect(bookingService.findByDateForAgent).not.toHaveBeenCalled();
  });
});
