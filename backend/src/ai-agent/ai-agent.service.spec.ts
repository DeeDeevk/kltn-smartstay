import { randomUUID } from 'crypto';
import {
  ForbiddenException,
  HttpException,
  NotFoundException,
} from '@nestjs/common';
import { AI_DAILY_QUOTA_EXCEEDED, AiAgentService } from './ai-agent.service';
import { AiConversation } from './entities/ai-conversation.entity';
import { AiMessage } from './entities/ai-message.entity';
import { AiMessageRole } from 'src/common/enums/ai-message-role.enum';
import type { LlmChatResult } from './llm/llm-provider.interface';
import type { AiAgentToolsService } from './tools/ai-agent-tools.service';

// Fake repository tối giản trong bộ nhớ — đủ cho các thao tác find/findOne/create/save
// mà AiAgentService dùng, khỏi phải dựng cả TypeORM + Postgres cho unit test.
class FakeRepo<T extends { createdAt?: Date }> {
  private rows: T[] = [];

  constructor(private readonly idField: keyof T) {}

  create(partial: Partial<T>): T {
    return { ...partial, [this.idField]: randomUUID() } as unknown as T;
  }

  save(entity: T): Promise<T> {
    if (!entity.createdAt) entity.createdAt = new Date();
    this.rows.push(entity);
    return Promise.resolve(entity);
  }

  // Hỗ trợ order theo createdAt và take. DESC = sắp ASC (ổn định) rồi đảo, để các dòng
  // trùng createdAt (lưu liên tiếp trong cùng mili-giây) vẫn giữ đúng thứ tự thời gian.
  find(options?: {
    order?: { createdAt?: 'ASC' | 'DESC' };
    take?: number;
  }): Promise<T[]> {
    const sorted = [...this.rows].sort(
      (a, b) => a.createdAt!.getTime() - b.createdAt!.getTime(),
    );
    if (options?.order?.createdAt === 'DESC') sorted.reverse();
    return Promise.resolve(
      options?.take === undefined ? sorted : sorted.slice(0, options.take),
    );
  }

  // Lọc theo các field trong `where` (so sánh bằng ===), lấy bản ghi lưu gần nhất khớp —
  // giống findOne thật: không khớp thì trả undefined thay vì bản ghi bất kỳ.
  findOne(options?: {
    where?: Record<string, unknown>;
  }): Promise<T | undefined> {
    const where = Object.entries(options?.where ?? {});
    const match = [...this.rows]
      .reverse()
      .find((row) =>
        where.every(
          ([key, value]) => (row as Record<string, unknown>)[key] === value,
        ),
      );
    return Promise.resolve(match);
  }
}

describe('AiAgentService', () => {
  let conversationRepo: FakeRepo<AiConversation>;
  let messageRepo: FakeRepo<AiMessage>;
  let llmProvider: { chat: jest.Mock };
  let toolsService: {
    execute: jest.MockedFunction<AiAgentToolsService['execute']>;
  };
  let hotelConfigService: { getOrCreate: jest.Mock };
  let service: AiAgentService;
  let countRecentUserMessages: jest.SpyInstance<
    Promise<number>,
    [string, Date]
  >;

  const userId = 'user-1';

  beforeEach(() => {
    conversationRepo = new FakeRepo<AiConversation>('conversationId');
    messageRepo = new FakeRepo<AiMessage>('messageId');
    llmProvider = { chat: jest.fn() };
    toolsService = {
      execute: jest.fn() as jest.MockedFunction<AiAgentToolsService['execute']>,
    };
    // Default: a configured hotel with a real address — matches the common case. Tests
    // about the "not configured" wording override this per-test.
    hotelConfigService = {
      getOrCreate: jest.fn().mockResolvedValue({
        address: '123 Lê Lợi, Q1, TP.HCM',
        latitude: 10.77,
        longitude: 106.7,
      }),
    };

    service = new AiAgentService(
      conversationRepo as unknown as never,
      messageRepo as unknown as never,
      llmProvider,
      toolsService as unknown as never,
      hotelConfigService as unknown as never,
    );

    // Đếm hạn mức ngày dùng QueryBuilder (fake repo không có) — mặc định 0 lượt đã dùng,
    // test riêng về hạn mức sẽ đặt giá trị khác.
    countRecentUserMessages = jest
      .spyOn(
        service as unknown as {
          countRecentUserMessages: (u: string, s: Date) => Promise<number>;
        },
        'countRecentUserMessages',
      )
      .mockResolvedValue(0);

    // getOwnedConversation so sánh conversation.userId (cột FK mà repo thật tự điền khi
    // findOne) — set sẵn để findOne trả về đúng owner cho các lượt tiếp theo trong test.
    conversationRepo.create = function (partial) {
      return {
        ...partial,
        conversationId: randomUUID(),
        userId,
      } as unknown as AiConversation;
    };
  });

  it('system prompt kèm đúng địa chỉ khách sạn khi HotelConfig đã cấu hình, và dặn không cần gọi tool', async () => {
    llmProvider.chat.mockResolvedValueOnce({
      text: 'Dạ khách sạn ở 123 Lê Lợi ạ.',
      toolCalls: [],
    } satisfies LlmChatResult);

    await service.sendMessage(userId, { message: 'Khách sạn ở đâu?' });

    const [messages] = llmProvider.chat.mock.calls[0] as [
      Array<{ role: string; parts: Array<{ type: string; text?: string }> }>,
    ];
    const systemText = messages[0].parts[0].text ?? '';
    expect(systemText).toContain('123 Lê Lợi, Q1, TP.HCM');
    expect(systemText).toContain('KHÔNG cần gọi tool');
  });

  it('system prompt nói rõ CHƯA cấu hình địa chỉ khi HotelConfig còn ở toạ độ mặc định (0,0), không bịa địa chỉ', async () => {
    hotelConfigService.getOrCreate.mockResolvedValue({
      address: '',
      latitude: 0,
      longitude: 0,
    });
    llmProvider.chat.mockResolvedValueOnce({
      text: 'Dạ hiện khách sạn chưa cập nhật địa chỉ ạ.',
      toolCalls: [],
    } satisfies LlmChatResult);

    await service.sendMessage(userId, { message: 'Khách sạn ở đâu?' });

    const [messages] = llmProvider.chat.mock.calls[0] as [
      Array<{ role: string; parts: Array<{ type: string; text?: string }> }>,
    ];
    const systemText = messages[0].parts[0].text ?? '';
    expect(systemText).toContain('CHƯA được cấu hình');
    expect(systemText).not.toContain('123 Lê Lợi');
  });

  it('vẫn trả lời bình thường (không throw/500) khi HotelConfig lookup lỗi tạm thời, và coi như chưa cấu hình', async () => {
    hotelConfigService.getOrCreate.mockRejectedValue(
      new Error('connection pool exhausted'),
    );
    llmProvider.chat.mockResolvedValueOnce({
      text: 'Dạ hiện tôi chưa có thông tin địa chỉ ạ.',
      toolCalls: [],
    } satisfies LlmChatResult);

    const result = await service.sendMessage(userId, {
      message: 'Khách sạn ở đâu?',
    });

    expect(result.reply).toBe('Dạ hiện tôi chưa có thông tin địa chỉ ạ.');
    const [messages] = llmProvider.chat.mock.calls[0] as [
      Array<{ role: string; parts: Array<{ type: string; text?: string }> }>,
    ];
    const systemText = messages[0].parts[0].text ?? '';
    expect(systemText).toContain('CHƯA được cấu hình');
  });

  it('luồng tư vấn thành công: đề xuất đặt phòng rồi tạo booking sau khi khách xác nhận ở lượt kế tiếp', async () => {
    const proposeSummary = {
      roomTypeId: 'rt-1',
      roomTypeName: 'Deluxe',
      checkIn: '2026-03-20',
      checkOut: '2026-03-22',
      nights: 2,
      guestInfo: { fullName: 'Nguyễn Văn A', phone: '0901234567' },
      extraServiceIds: [],
      roomAmount: 2000000,
      serviceAmount: 0,
      discountAmount: 0,
      vatAmount: 160000,
      totalAmount: 2160000,
    };

    llmProvider.chat
      .mockResolvedValueOnce({
        text: null,
        toolCalls: [{ id: 'c1', name: 'propose_booking', args: {} }],
      } satisfies LlmChatResult)
      .mockResolvedValueOnce({
        text: 'Dạ đây là thông tin đặt phòng, anh/chị xác nhận đặt giúp em nhé?',
        toolCalls: [],
      } satisfies LlmChatResult);
    toolsService.execute.mockResolvedValueOnce({
      success: true,
      data: proposeSummary,
    });

    const turn1 = await service.sendMessage(userId, {
      message:
        'Cho tôi đặt phòng Deluxe 20/03 đến 22/03, tên Nguyễn Văn A, sđt 0901234567',
    });

    expect(toolsService.execute).toHaveBeenCalledWith(
      'propose_booking',
      {},
      expect.objectContaining({ userId }),
    );
    expect(turn1.reply).toContain('xác nhận');

    llmProvider.chat
      .mockResolvedValueOnce({
        text: null,
        toolCalls: [{ id: 'c2', name: 'create_booking', args: {} }],
      } satisfies LlmChatResult)
      .mockResolvedValueOnce({
        text: 'Đặt phòng thành công, mã đơn BK-0001.',
        toolCalls: [],
      } satisfies LlmChatResult);
    toolsService.execute.mockResolvedValueOnce({
      success: true,
      data: { bookingId: 'b-1', status: 'PENDING', totalAmount: 2160000 },
    });

    const turn2 = await service.sendMessage(userId, {
      conversationId: turn1.conversationId,
      message: 'Đồng ý, chốt đặt phòng giúp em',
    });

    // expect.objectContaining(...) trả kiểu `any` theo @types/jest — không tránh được
    // cảnh báo no-unsafe-assignment ở đây khi dùng matcher lồng nhau.
    /* eslint-disable @typescript-eslint/no-unsafe-assignment */
    expect(toolsService.execute).toHaveBeenNthCalledWith(
      2,
      'create_booking',
      {},
      expect.objectContaining({
        currentUserMessage: expect.objectContaining({
          text: 'Đồng ý, chốt đặt phòng giúp em',
        }),
      }),
    );
    /* eslint-enable @typescript-eslint/no-unsafe-assignment */
    expect(turn2.reply).toContain('thành công');
  });

  it('hết hạn mức 100 tin/24 giờ thì báo 429 kèm mã riêng và không gọi LLM', async () => {
    countRecentUserMessages.mockResolvedValue(100);

    const error = await service
      .sendMessage(userId, { message: 'Xin chào' })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getStatus()).toBe(429);
    expect((error as HttpException).getResponse()).toMatchObject({
      code: AI_DAILY_QUOTA_EXCEEDED,
    });
    expect(llmProvider.chat).not.toHaveBeenCalled();
  });

  it('còn dưới hạn mức (99 tin) thì vẫn trả lời; đếm theo đúng user trong 24 giờ gần nhất', async () => {
    countRecentUserMessages.mockResolvedValue(99);
    llmProvider.chat.mockResolvedValueOnce({
      text: 'Dạ em chào anh/chị ạ.',
      toolCalls: [],
    } satisfies LlmChatResult);

    const result = await service.sendMessage(userId, { message: 'Xin chào' });

    expect(result.reply).toBe('Dạ em chào anh/chị ạ.');
    const [countedUser, since] = countRecentUserMessages.mock.calls[0];
    expect(countedUser).toBe(userId);
    const windowMs = Date.now() - since.getTime();
    expect(windowMs).toBeGreaterThanOrEqual(24 * 60 * 60 * 1000 - 1000);
    expect(windowMs).toBeLessThan(24 * 60 * 60 * 1000 + 5000);
  });

  it('hội thoại không tồn tại thì báo 404 và không gọi LLM', async () => {
    await expect(
      service.sendMessage(userId, {
        conversationId: randomUUID(),
        message: 'Xin chào',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(llmProvider.chat).not.toHaveBeenCalled();
  });

  it('hội thoại của người khác thì báo 403, cả khi nhắn tin lẫn khi xem lịch sử', async () => {
    llmProvider.chat.mockResolvedValue({
      text: 'Dạ em chào anh/chị ạ.',
      toolCalls: [],
    } satisfies LlmChatResult);
    const { conversationId } = await service.sendMessage(userId, {
      message: 'Xin chào',
    });
    llmProvider.chat.mockClear();

    await expect(
      service.sendMessage('user-2', { conversationId, message: 'Cho tôi xem' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.getHistory(conversationId, 'user-2'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(llmProvider.chat).not.toHaveBeenCalled();

    // Chủ sở hữu thật vẫn xem được.
    await expect(
      service.getHistory(conversationId, userId),
    ).resolves.toHaveLength(2);
  });

  it('luồng thiếu thông tin: agent hỏi lại thay vì gọi tool khi khách chưa cho đủ dữ liệu', async () => {
    llmProvider.chat.mockResolvedValueOnce({
      text: 'Dạ anh/chị vui lòng cho em biết ngày nhận phòng, ngày trả phòng và số lượng khách ạ.',
      toolCalls: [],
    } satisfies LlmChatResult);

    const result = await service.sendMessage(userId, {
      message: 'Tôi muốn đặt phòng',
    });

    expect(toolsService.execute).not.toHaveBeenCalled();
    expect(result.reply).toContain('ngày nhận phòng');
  });

  it('luồng khách huỷ giữa chừng: agent không được tạo booking khi khách đổi ý sau khi đã đề xuất', async () => {
    llmProvider.chat
      .mockResolvedValueOnce({
        text: null,
        toolCalls: [{ id: 'c1', name: 'propose_booking', args: {} }],
      } satisfies LlmChatResult)
      .mockResolvedValueOnce({
        text: 'Dạ đây là thông tin đặt phòng, anh/chị xác nhận giúp em nhé?',
        toolCalls: [],
      } satisfies LlmChatResult);
    toolsService.execute.mockResolvedValueOnce({
      success: true,
      data: { totalAmount: 2160000 },
    });

    const turn1 = await service.sendMessage(userId, {
      message: 'Đặt phòng Deluxe 20/03-22/03 cho tôi',
    });

    // Khách đổi ý — model tuân theo system prompt, không gọi create_booking.
    llmProvider.chat.mockResolvedValueOnce({
      text: 'Dạ vâng, em đã huỷ yêu cầu đặt phòng này. Anh/chị cần hỗ trợ gì thêm không ạ?',
      toolCalls: [],
    } satisfies LlmChatResult);

    const turn2 = await service.sendMessage(userId, {
      conversationId: turn1.conversationId,
      message: 'Thôi tôi đổi ý, không đặt nữa',
    });

    expect(toolsService.execute).toHaveBeenCalledTimes(1); // chỉ propose_booking ở turn1
    expect(toolsService.execute).not.toHaveBeenCalledWith(
      'create_booking',
      expect.anything(),
      expect.anything(),
    );
    expect(turn2.reply).toContain('huỷ');

    const savedMessages = await messageRepo.find();
    expect(
      savedMessages.some(
        (m) => m.role === AiMessageRole.TOOL && m.toolName === 'create_booking',
      ),
    ).toBe(false);
  });

  it('Gemini lỗi tạm thời (503) thì thử lại và vẫn trả lời được', async () => {
    jest.useFakeTimers();
    try {
      llmProvider.chat
        .mockRejectedValueOnce(
          Object.assign(new Error('model overloaded'), { status: 503 }),
        )
        .mockResolvedValueOnce({
          text: 'Dạ em chào anh/chị ạ.',
          toolCalls: [],
        } satisfies LlmChatResult);

      const pending = service.sendMessage(userId, { message: 'Xin chào' });
      await jest.advanceTimersByTimeAsync(1000);
      const result = await pending;

      expect(llmProvider.chat).toHaveBeenCalledTimes(2);
      expect(result.reply).toBe('Dạ em chào anh/chị ạ.');
    } finally {
      jest.useRealTimers();
    }
  });

  it('Gemini lỗi không thể thử lại (400) thì trả câu trả lời dự phòng thay vì lỗi 500', async () => {
    llmProvider.chat.mockRejectedValue(
      Object.assign(new Error('invalid request'), { status: 400 }),
    );

    const result = await service.sendMessage(userId, { message: 'Xin chào' });

    expect(llmProvider.chat).toHaveBeenCalledTimes(1);
    expect(result.reply).toContain('Xin lỗi');
    // Câu trả lời dự phòng vẫn được lưu để lịch sử hội thoại không bị hụt 1 lượt.
    const saved = await messageRepo.find();
    expect(saved.at(-1)?.role).toBe(AiMessageRole.MODEL);
  });

  it('chỉ gửi cho LLM 10 lượt hỏi-đáp gần nhất, bắt đầu bằng tin nhắn của khách', async () => {
    llmProvider.chat.mockResolvedValue({
      text: 'Dạ vâng ạ.',
      toolCalls: [],
    } satisfies LlmChatResult);

    let conversationId: string | undefined;
    for (let i = 1; i <= 12; i += 1) {
      const result = await service.sendMessage(userId, {
        conversationId,
        message: `câu hỏi số ${i}`,
      });
      conversationId = result.conversationId;
    }

    const lastCall = llmProvider.chat.mock.calls.at(-1) as [
      Array<{ role: string; parts: Array<{ text?: string }> }>,
    ];
    const sent = lastCall[0].filter((m) => m.role !== 'system');
    const userTexts = sent
      .filter((m) => m.role === 'user')
      .map((m) => m.parts[0].text);

    // 10 lượt cũ gần nhất (câu 2..11) + câu hiện tại (12); câu 1 bị cắt bỏ.
    expect(userTexts).toHaveLength(11);
    expect(userTexts[0]).toBe('câu hỏi số 2');
    expect(userTexts.at(-1)).toBe('câu hỏi số 12');
    expect(sent[0].role).toBe('user');
  });

  it('chỉ đọc 40 dòng gần nhất từ DB; cửa sổ cắt giữa lượt vẫn mở đầu bằng tin nhắn khách, còn getHistory trả đủ', async () => {
    // Mỗi lượt = 1 USER + 4 TOOL + 1 MODEL = 6 dòng nên 12 lượt (72 dòng) vượt xa 40.
    llmProvider.chat.mockImplementation((messages: Array<{ role: string }>) =>
      Promise.resolve(
        messages.at(-1)?.role === 'tool'
          ? { text: 'Dạ vâng ạ.', toolCalls: [] }
          : {
              text: null,
              toolCalls: [1, 2, 3, 4].map((n) => ({
                id: `c${n}`,
                name: 'search_rooms',
                args: {},
              })),
            },
      ),
    );
    toolsService.execute.mockResolvedValue({ success: true, data: [] });

    let conversationId: string | undefined;
    for (let i = 1; i <= 12; i += 1) {
      const result = await service.sendMessage(userId, {
        conversationId,
        message: `câu hỏi số ${i}`,
      });
      conversationId = result.conversationId;
    }

    const findSpy = jest.spyOn(messageRepo, 'find');
    llmProvider.chat.mockClear();
    await service.sendMessage(userId, {
      conversationId,
      message: 'câu hỏi số 13',
    });

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const expectedQuery = expect.objectContaining({
      order: { createdAt: 'DESC' },
      take: 40,
    });
    expect(findSpy).toHaveBeenCalledWith(expectedQuery);

    // Lần gọi LLM đầu tiên của lượt 13. 40 dòng cuối của 72 dòng bắt đầu ở 1 dòng TOOL
    // của lượt 6 -> bị bỏ cho tới USER kế tiếp (câu 7); thứ tự vẫn cũ -> mới.
    const firstCall = llmProvider.chat.mock.calls[0] as [
      Array<{ role: string; parts: Array<{ text?: string }> }>,
    ];
    const sent = firstCall[0].filter((m) => m.role !== 'system');
    expect(sent[0].role).toBe('user');
    expect(
      sent.filter((m) => m.role === 'user').map((m) => m.parts[0].text),
    ).toEqual([7, 8, 9, 10, 11, 12, 13].map((n) => `câu hỏi số ${n}`));

    // getHistory vẫn trả toàn bộ 13 lượt x 6 dòng, không bị giới hạn.
    await expect(
      service.getHistory(conversationId!, userId),
    ).resolves.toHaveLength(78);
  });
});
