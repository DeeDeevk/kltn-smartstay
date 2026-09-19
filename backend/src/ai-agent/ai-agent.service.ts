import {
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiConversation } from './entities/ai-conversation.entity';
import { AiMessage } from './entities/ai-message.entity';
import { AiMessageRole } from 'src/common/enums/ai-message-role.enum';
import { SendMessageDto } from './dto/send-message.dto';
import { LLM_PROVIDER } from './llm/llm-provider.interface';
import type {
  LlmChatResult,
  LlmMessage,
  LlmProvider,
} from './llm/llm-provider.interface';
import { AI_AGENT_TOOLS } from './tools/ai-agent-tools.definitions';
import { AiAgentToolsService } from './tools/ai-agent-tools.service';
import { buildSystemPrompt } from './constants/system-prompt.constant';

// Số vòng gọi tool tối đa cho 1 tin nhắn của khách — chặn vòng lặp vô hạn nếu model
// cứ liên tục gọi tool mà không bao giờ trả lời bằng văn bản. Đặt 6 vì flow đặt phòng
// đầy đủ có thể cần tới search_rooms -> check_availability -> propose_booking (3 vòng
// gọi tool) trước khi model mới trả lời bằng văn bản ở vòng kế tiếp; để 4 dễ bị chặn
// giữa chừng và rơi vào FALLBACK_REPLY dù model chưa thực sự bế tắc.
const MAX_TOOL_ROUNDS = 6;
const FALLBACK_REPLY =
  'Xin lỗi, hiện tôi chưa thể xử lý yêu cầu này, bạn vui lòng thử lại hoặc liên hệ lễ tân.';
// Chỉ gửi cho LLM N lượt hỏi-đáp gần nhất — hội thoại dài mà gửi toàn bộ thì mỗi tin
// nhắn mới đều tốn token cho cả lịch sử cũ, chậm và đắt dần theo thời gian.
const MAX_HISTORY_TURNS = 10;
// Số dòng tối đa đọc từ DB để dựng ngữ cảnh cho LLM (sendMessage) — buildHistoryContext()
// chỉ dùng MAX_HISTORY_TURNS lượt gần nhất + vài kết quả tool nên không cần tải cả hội
// thoại dài mỗi tin nhắn. Mỗi lượt chiếm USER + các dòng TOOL + MODEL, nên 40 dòng đủ cho
// 10 lượt khi trung bình mỗi lượt gọi không quá 2 tool. getHistory() thì không dùng
// giới hạn này (xem ghi chú tại đó).
const HISTORY_FETCH_LIMIT = 40;
// Lỗi tạm thời từ nhà cung cấp LLM (quá tải/giới hạn tần suất) — đáng để thử lại.
const RETRYABLE_LLM_STATUS = new Set([429, 500, 502, 503, 504]);
const LLM_RETRY_DELAYS_MS = [1000, 3000];

@Injectable()
export class AiAgentService {
  private readonly logger = new Logger(AiAgentService.name);

  constructor(
    @InjectRepository(AiConversation)
    private readonly conversationRepo: Repository<AiConversation>,
    @InjectRepository(AiMessage)
    private readonly messageRepo: Repository<AiMessage>,
    @Inject(LLM_PROVIDER) private readonly llmProvider: LlmProvider,
    private readonly toolsService: AiAgentToolsService,
  ) {}

  async sendMessage(userId: string, dto: SendMessageDto) {
    const conversation = dto.conversationId
      ? await this.getOwnedConversation(dto.conversationId, userId)
      : await this.createConversation(userId);

    const history = await this.loadRecentMessages(conversation.conversationId);

    const userMessage = await this.messageRepo.save(
      this.messageRepo.create({
        conversation,
        role: AiMessageRole.USER,
        content: dto.message,
      }),
    );

    const llmMessages: LlmMessage[] = [
      {
        role: 'system',
        parts: [{ type: 'text', text: buildSystemPrompt() }],
      },
      ...this.buildHistoryContext(history),
      this.toLlmMessage(userMessage),
    ];

    let finalText: string | null = null;
    let latestRooms: unknown[] | null = null;
    let latestPromotions: unknown[] | null = null;
    let latestBooking: unknown = null;
    let latestBookingFormRequest: unknown = null;
    for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
      const result = await this.chatWithRetry(llmMessages);
      // LLM vẫn lỗi sau khi đã thử lại -> dừng, trả FALLBACK_REPLY thay vì lỗi 500.
      if (!result) break;

      if (result.toolCalls.length === 0) {
        finalText = result.text ?? FALLBACK_REPLY;
        break;
      }

      llmMessages.push({
        role: 'model',
        parts: [
          ...(result.text
            ? [{ type: 'text' as const, text: result.text }]
            : []),
          ...result.toolCalls.map((call) => ({
            type: 'tool_call' as const,
            id: call.id,
            name: call.name,
            args: call.args,
            thoughtSignature: call.thoughtSignature,
          })),
        ],
      });

      const toolResultParts: LlmMessage['parts'] = [];
      for (const call of result.toolCalls) {
        const execResult = await this.toolsService.execute(
          call.name,
          call.args,
          {
            userId,
            conversation,
            currentUserMessage: {
              text: userMessage.content ?? '',
              createdAt: userMessage.createdAt,
              confirmProposalId: dto.confirmProposalId ?? null,
            },
          },
        );

        await this.messageRepo.save(
          this.messageRepo.create({
            conversation,
            role: AiMessageRole.TOOL,
            toolName: call.name,
            toolArgs: call.args,
            toolResult: execResult as Record<string, unknown>,
          }),
        );

        if (execResult.success) {
          if (call.name === 'search_rooms' && Array.isArray(execResult.data)) {
            latestRooms = execResult.data;
          } else if (call.name === 'check_availability' && execResult.data) {
            latestRooms = [execResult.data];
          } else if (
            call.name === 'get_promotions' &&
            Array.isArray(execResult.data)
          ) {
            latestPromotions = execResult.data;
          } else if (call.name === 'create_booking') {
            latestBooking = execResult.data;
          } else if (call.name === 'request_booking_form') {
            latestBookingFormRequest = execResult.data;
          }
        }

        toolResultParts.push({
          type: 'tool_result',
          id: call.id,
          name: call.name,
          result: execResult,
        });
      }
      llmMessages.push({ role: 'tool', parts: toolResultParts });
    }

    const reply = finalText ?? FALLBACK_REPLY;
    await this.messageRepo.save(
      this.messageRepo.create({
        conversation,
        role: AiMessageRole.MODEL,
        content: reply,
      }),
    );

    return {
      conversationId: conversation.conversationId,
      reply,
      rooms: latestRooms,
      promotions: latestPromotions,
      pendingBooking: conversation.pendingBooking ?? null,
      booking: latestBooking,
      bookingFormRequest: latestBookingFormRequest,
    };
  }

  async getHistory(conversationId: string, userId: string) {
    const conversation = await this.getOwnedConversation(
      conversationId,
      userId,
    );
    // Cố ý tải TOÀN BỘ, không giới hạn như loadRecentMessages(): hàm này trả lại đầy đủ
    // hội thoại cho khách xem/cuộn lại, còn loadRecentMessages() chỉ dựng ngữ cảnh gửi
    // LLM (vốn đã tự cắt còn vài lượt gần nhất). Hai mục đích khác nhau, không phải
    // thiếu nhất quán.
    const messages = await this.messageRepo.find({
      where: { conversation: { conversationId: conversation.conversationId } },
      order: { createdAt: 'ASC' },
    });
    return messages.map((m) => ({
      messageId: m.messageId,
      role: m.role,
      content: m.content,
      toolName: m.toolName,
      toolArgs: m.toolArgs,
      toolResult: m.toolResult,
      createdAt: m.createdAt,
    }));
  }

  // Lấy HISTORY_FETCH_LIMIT dòng gần nhất ở tầng DB (DESC + take) rồi đảo lại thành thứ
  // tự cũ -> mới như buildHistoryContext() mong đợi. Cửa sổ theo số dòng có thể bắt đầu
  // giữa 1 lượt (VD ngay tại dòng TOOL/MODEL) nên bỏ các dòng đầu cho tới tin nhắn USER
  // đầu tiên — buildHistoryContext() luôn giả định ngữ cảnh mở đầu bằng câu của khách.
  private async loadRecentMessages(
    conversationId: string,
  ): Promise<AiMessage[]> {
    const newestFirst = await this.messageRepo.find({
      where: { conversation: { conversationId } },
      order: { createdAt: 'DESC' },
      take: HISTORY_FETCH_LIMIT,
    });
    const oldestFirst = newestFirst.reverse();
    const firstUserIndex = oldestFirst.findIndex(
      (m) => m.role === AiMessageRole.USER,
    );
    return firstUserIndex === -1 ? [] : oldestFirst.slice(firstUserIndex);
  }

  private async createConversation(userId: string): Promise<AiConversation> {
    const conversation = this.conversationRepo.create({
      user: { userId } as AiConversation['user'],
      pendingBooking: null,
      pendingBookingProposedAt: null,
    });
    return this.conversationRepo.save(conversation);
  }

  private async getOwnedConversation(
    conversationId: string,
    userId: string,
  ): Promise<AiConversation> {
    const conversation = await this.conversationRepo.findOne({
      where: { conversationId },
    });
    if (!conversation) {
      throw new NotFoundException('Không tìm thấy cuộc hội thoại');
    }
    // Vẫn tách 2 bước để phân biệt "không tồn tại" (404) và "của người khác" (403) như
    // trước; conversation.userId là cột FK đọc trong cùng query, không tải entity User.
    if (conversation.userId !== userId) {
      throw new ForbiddenException(
        'Bạn không có quyền truy cập cuộc hội thoại này',
      );
    }
    return conversation;
  }

  // Trước đây khi tải lại lịch sử ở 1 request HTTP mới, các message role=TOOL (chứa
  // roomTypeId, giá, danh sách khuyến mãi...) bị lọc bỏ hoàn toàn, chỉ giữ lại câu trả
  // lời văn bản cuối cùng. Hệ quả: khách hỏi tiếp "đặt phòng đó cho tôi" ở 1 tin nhắn
  // sau, model không còn biết "phòng đó" là roomTypeId nào vì dữ liệu tool gốc đã mất,
  // dễ trả lời sai hoặc phải hỏi lại từ đầu. Giữ lại tối đa 3 kết quả tool gần nhất
  // (dạng tóm tắt text) làm ngữ cảnh, tránh phình quá nhiều token cho hội thoại dài.
  // Gọi LLM, thử lại với lỗi tạm thời (429 quá tần suất, 5xx quá tải). Trả null nếu vẫn
  // lỗi — người gọi sẽ trả FALLBACK_REPLY cho khách thay vì để lỗi 500 lọt ra ngoài.
  private async chatWithRetry(
    messages: LlmMessage[],
  ): Promise<LlmChatResult | null> {
    for (let attempt = 0; ; attempt += 1) {
      try {
        return await this.llmProvider.chat(messages, AI_AGENT_TOOLS);
      } catch (err) {
        const status = (err as { status?: number })?.status;
        const retryable =
          status === undefined || RETRYABLE_LLM_STATUS.has(status);
        if (!retryable || attempt >= LLM_RETRY_DELAYS_MS.length) {
          this.logger.error(
            `LLM call failed${status ? ` (status ${status})` : ''}: ${err instanceof Error ? err.message : String(err)}`,
          );
          return null;
        }
        this.logger.warn(
          `LLM call failed${status ? ` (status ${status})` : ''}, retrying (${attempt + 1}/${LLM_RETRY_DELAYS_MS.length})`,
        );
        await new Promise((resolve) =>
          setTimeout(resolve, LLM_RETRY_DELAYS_MS[attempt]),
        );
      }
    }
  }

  private buildHistoryContext(fullHistory: AiMessage[]): LlmMessage[] {
    // Chỉ giữ MAX_HISTORY_TURNS lượt gần nhất, cắt đúng tại 1 tin nhắn USER để ngữ cảnh
    // luôn bắt đầu bằng câu của khách (không mở đầu giữa chừng bằng câu trả lời/tool).
    const userIndexes = fullHistory
      .map((m, i) => (m.role === AiMessageRole.USER ? i : -1))
      .filter((i) => i >= 0);
    const startIndex =
      userIndexes.length > MAX_HISTORY_TURNS
        ? userIndexes[userIndexes.length - MAX_HISTORY_TURNS]
        : 0;
    const history = fullHistory.slice(startIndex);

    const MAX_TOOL_CONTEXT = 3;
    const toolIndexes = history
      .map((m, i) => (m.role === AiMessageRole.TOOL && m.toolResult ? i : -1))
      .filter((i) => i >= 0);
    const keepToolIndexes = new Set(toolIndexes.slice(-MAX_TOOL_CONTEXT));

    const messages: LlmMessage[] = [];
    history.forEach((m, i) => {
      if (m.role === AiMessageRole.TOOL) {
        if (!keepToolIndexes.has(i)) return;
        messages.push({
          role: 'model',
          parts: [
            {
              type: 'text',
              text: `[Dữ liệu tool "${m.toolName}" ở lượt trước, dùng để tham chiếu nếu khách nhắc lại]: ${JSON.stringify(m.toolResult)}`,
            },
          ],
        });
        return;
      }
      if (m.content) messages.push(this.toLlmMessage(m));
    });
    return messages;
  }

  private toLlmMessage(message: AiMessage): LlmMessage {
    return {
      role: message.role === AiMessageRole.USER ? 'user' : 'model',
      parts: [{ type: 'text', text: message.content ?? '' }],
    };
  }
}
