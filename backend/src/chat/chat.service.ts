import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Conversation, ConversationStatus } from './entities/conversation.entity';
import { Message } from './entities/message.entity';
import { UserService } from '../users/user.service';
import { UserRole } from '../common/enums/user-role.enum';

interface Requester {
  userId: string;
  role: string;
}

const MAX_MESSAGE_LENGTH = 2000;

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(Conversation)
    private readonly conversationRepo: Repository<Conversation>,
    @InjectRepository(Message)
    private readonly messageRepo: Repository<Message>,
    private readonly userService: UserService,
  ) {}

  // Mỗi khách chỉ có 1 hội thoại OPEN tại 1 thời điểm — gọi lại thì trả về hội
  // thoại cũ thay vì tạo mới, để lịch sử chat không bị chia lẻ mỗi lần mở widget.
  async getOrCreateOwnConversation(userId: string): Promise<Conversation> {
    const existing = await this.conversationRepo.findOne({
      where: { customer: { userId }, status: ConversationStatus.OPEN },
      order: { createdAt: 'DESC' },
    });
    if (existing) return existing;

    const customer = await this.userService.findById(userId);
    return this.conversationRepo.save(
      this.conversationRepo.create({ customer, status: ConversationStatus.OPEN }),
    );
  }

  async listOpenConversations(): Promise<Conversation[]> {
    return this.conversationRepo.find({
      where: { status: ConversationStatus.OPEN },
      order: { lastMessageAt: 'DESC', createdAt: 'DESC' },
    });
  }

  async findConversationById(conversationId: string): Promise<Conversation> {
    const conversation = await this.conversationRepo.findOne({
      where: { conversationId },
    });
    if (!conversation) {
      throw new NotFoundException('Không tìm thấy hội thoại');
    }
    return conversation;
  }

  // Khách chỉ xem được hội thoại của chính mình; lễ tân (STAFF) xem được mọi hội
  // thoại. Admin không tham gia chat với khách nên không có ngoại lệ ở đây.
  assertCanAccess(conversation: Conversation, requester: Requester) {
    const isOwner = conversation.customer.userId === requester.userId;
    const isStaff = requester.role === UserRole.STAFF;
    if (!isOwner && !isStaff) {
      throw new ForbiddenException('Bạn không có quyền xem hội thoại này');
    }
  }

  async getMessages(conversationId: string) {
    const messages = await this.messageRepo.find({
      where: { conversation: { conversationId } },
      order: { createdAt: 'ASC' },
    });
    return messages.map((m) => this.toMessageResponse(conversationId, m));
  }

  // Dùng chung cho cả REST (lịch sử tin nhắn) và socket (tin nhắn mới) để 2 nguồn
  // trả về đúng 1 hình dạng — FE không phải xử lý 2 kiểu payload khác nhau.
  toMessageResponse(conversationId: string, message: Message) {
    return {
      conversationId,
      messageId: message.messageId,
      senderId: message.sender.userId,
      senderName: message.sender.fullName,
      senderRole: message.sender.role,
      content: message.content,
      createdAt: message.createdAt,
    };
  }

  async saveMessage(
    conversationId: string,
    senderId: string,
    rawContent: string,
  ): Promise<Message> {
    const content = rawContent.trim().slice(0, MAX_MESSAGE_LENGTH);
    if (!content) {
      throw new ForbiddenException('Nội dung tin nhắn không được để trống');
    }

    const conversation = await this.findConversationById(conversationId);
    const sender = await this.userService.findById(senderId);

    const message = await this.messageRepo.save(
      this.messageRepo.create({ conversation, sender, content }),
    );

    conversation.lastMessageAt = message.createdAt;
    if (!conversation.staff && sender.role === UserRole.STAFF) {
      conversation.staff = sender;
    }
    await this.conversationRepo.save(conversation);

    return message;
  }
}
