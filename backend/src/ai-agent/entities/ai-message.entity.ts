import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { AiMessageRole } from 'src/common/enums/ai-message-role.enum';
import { AiConversation } from './ai-conversation.entity';

// Log đầy đủ hội thoại (kể cả các lượt gọi tool) — phục vụ làm dataset đánh giá độ
// chính xác của agent cho báo cáo đồ án. USER/MODEL lưu nội dung văn bản ở "content";
// TOOL lưu tên tool + tham số model gọi + kết quả trả về (không có "content" văn bản).
// Mọi lần tải lịch sử đều lọc theo conversationId rồi sắp theo createdAt — index kép này
// phục vụ đúng truy vấn đó. Tên đặt cố định để khớp với migration
// AddIndexAiMessageConversationCreatedAt (không để TypeORM tự sinh tên dạng hash).
@Index('IDX_ai_message_conversation_created_at', ['conversation', 'createdAt'])
@Entity('AiMessage')
export class AiMessage {
  @PrimaryGeneratedColumn('uuid', { name: 'messageId' })
  messageId!: string;

  @ManyToOne(() => AiConversation, (conversation) => conversation.messages, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'conversationId' })
  conversation!: AiConversation;

  @Column({ name: 'role', type: 'enum', enum: AiMessageRole })
  role!: AiMessageRole;

  @Column({ name: 'content', type: 'text', nullable: true })
  content!: string | null;

  @Column({ name: 'toolName', type: 'varchar', length: 100, nullable: true })
  toolName!: string | null;

  @Column({ name: 'toolArgs', type: 'jsonb', nullable: true })
  toolArgs!: Record<string, unknown> | null;

  @Column({ name: 'toolResult', type: 'jsonb', nullable: true })
  toolResult!: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt!: Date;
}
