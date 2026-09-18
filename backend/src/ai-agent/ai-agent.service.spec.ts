import { randomUUID } from 'crypto';
import { AiAgentService } from './ai-agent.service';
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

  find(): Promise<T[]> {
    return Promise.resolve(
      [...this.rows].sort(
        (a, b) => a.createdAt!.getTime() - b.createdAt!.getTime(),
      ),
    );
  }

  findOne(): Promise<T | undefined> {
    return Promise.resolve(this.rows[this.rows.length - 1]);
  }
}

describe('AiAgentService', () => {
  let conversationRepo: FakeRepo<AiConversation>;
  let messageRepo: FakeRepo<AiMessage>;
  let llmProvider: { chat: jest.Mock };
  let toolsService: {
    execute: jest.MockedFunction<AiAgentToolsService['execute']>;
  };
  let service: AiAgentService;

  const userId = 'user-1';

  beforeEach(() => {
    conversationRepo = new FakeRepo<AiConversation>('conversationId');
    messageRepo = new FakeRepo<AiMessage>('messageId');
    llmProvider = { chat: jest.fn() };
    toolsService = {
      execute: jest.fn() as jest.MockedFunction<AiAgentToolsService['execute']>,
    };

    service = new AiAgentService(
      conversationRepo as unknown as never,
      messageRepo as unknown as never,
      llmProvider,
      toolsService as unknown as never,
    );

    // getOwnedConversation so sánh conversation.user.userId — set sẵn để findOne trả về
    // đúng owner cho các lượt hội thoại tiếp theo trong cùng 1 test.
    conversationRepo.create = function (partial) {
      return {
        ...partial,
        conversationId: randomUUID(),
        user: { userId },
      } as unknown as AiConversation;
    };
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
});
