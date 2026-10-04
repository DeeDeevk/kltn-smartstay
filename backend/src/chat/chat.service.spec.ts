import { Repository } from 'typeorm';
import { ChatService } from './chat.service';
import {
  Conversation,
  ConversationStatus,
} from './entities/conversation.entity';
import { Message } from './entities/message.entity';
import { UserService } from '../users/user.service';
import { UserRole } from '../common/enums/user-role.enum';
import { MessageAttachmentType } from '../common/enums/message-attachment-type.enum';

const CONVERSATION_ID = 'conv-1';
const SENDER_ID = 'user-1';

function buildService(overrides?: {
  conversation?: Partial<Conversation>;
  sender?: { userId: string; role: UserRole; fullName?: string };
}) {
  const conversation: Conversation = {
    conversationId: CONVERSATION_ID,
    customer: { userId: SENDER_ID } as Conversation['customer'],
    staff: null,
    status: ConversationStatus.OPEN,
    lastMessageAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides?.conversation,
  };
  const sender = overrides?.sender ?? {
    userId: SENDER_ID,
    role: UserRole.CUSTOMER,
    fullName: 'Khách A',
  };

  const conversationSave = jest.fn((x: unknown) => Promise.resolve(x));
  const conversationRepo = {
    findOne: jest.fn().mockResolvedValue(conversation),
    save: conversationSave,
  } as unknown as Repository<Conversation>;

  const messageCreate = jest.fn((x: unknown) => x);
  const messageSave = jest.fn((x: unknown) =>
    Promise.resolve({
      ...(x as object),
      messageId: 'msg-1',
      createdAt: new Date(),
    }),
  );
  const messageRepo = {
    create: messageCreate,
    save: messageSave,
  } as unknown as Repository<Message>;

  const userService = {
    findById: jest.fn().mockResolvedValue(sender),
  } as unknown as UserService;

  const service = new ChatService(conversationRepo, messageRepo, userService);
  return {
    service,
    conversationSave,
    messageCreate,
    messageSave,
    conversation,
  };
}

describe('ChatService.saveMessage — validate nội dung/đính kèm (KAN-112)', () => {
  it('từ chối khi content rỗng VÀ không có attachmentUrl', async () => {
    const { service } = buildService();
    await expect(
      service.saveMessage(CONVERSATION_ID, SENDER_ID, '   '),
    ).rejects.toThrow('Tin nhắn cần có nội dung hoặc ảnh đính kèm');
  });

  it('chấp nhận tin nhắn CHỈ có ảnh (content rỗng, có attachmentUrl)', async () => {
    const { service, messageCreate } = buildService();
    await service.saveMessage(
      CONVERSATION_ID,
      SENDER_ID,
      '',
      'https://cdn.example.com/chat/qr.webp',
      MessageAttachmentType.IMAGE,
    );
    expect(messageCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        content: '',
        attachmentUrl: 'https://cdn.example.com/chat/qr.webp',
        attachmentType: MessageAttachmentType.IMAGE,
      }),
    );
  });

  it('chấp nhận tin nhắn chỉ có text (không đổi hành vi cũ)', async () => {
    const { service, messageCreate } = buildService();
    await service.saveMessage(CONVERSATION_ID, SENDER_ID, '  Xin chào  ');
    expect(messageCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        content: 'Xin chào',
        attachmentUrl: null,
        attachmentType: null,
      }),
    );
  });

  it('toMessageResponse trả kèm attachmentUrl/attachmentType', () => {
    const { service } = buildService();
    const message = {
      messageId: 'm1',
      sender: {
        userId: SENDER_ID,
        fullName: 'Khách A',
        role: UserRole.CUSTOMER,
      },
      content: '',
      attachmentUrl: 'https://cdn.example.com/x.webp',
      attachmentType: MessageAttachmentType.IMAGE,
      createdAt: new Date(),
    } as unknown as Message;

    const result = service.toMessageResponse(CONVERSATION_ID, message);
    expect(result.attachmentUrl).toBe('https://cdn.example.com/x.webp');
    expect(result.attachmentType).toBe(MessageAttachmentType.IMAGE);
  });
});
