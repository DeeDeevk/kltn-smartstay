import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Conversation } from './conversation.entity';
import { User } from '../../users/entities/user.entity';
import { MessageAttachmentType } from '../../common/enums/message-attachment-type.enum';

@Entity('Message')
export class Message {
  @PrimaryGeneratedColumn('uuid', { name: 'messageId' })
  messageId!: string;

  @ManyToOne(() => Conversation, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'conversationId' })
  conversation!: Conversation;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: 'senderId' })
  sender!: User;

  // Có thể rỗng khi tin nhắn chỉ gửi ảnh (ChatService.saveMessage bắt buộc content HOẶC
  // attachmentUrl phải có ít nhất 1, không cho cả 2 cùng rỗng).
  @Column({ name: 'content', type: 'text', default: '' })
  content!: string;

  // Phải khai báo type tường minh: cột nullable kiểu "string | null" là union type,
  // reflect-metadata trả design:type là Object (không phải String) cho union, khiến
  // TypeORM không suy ra được kiểu cột Postgres (DataTypeNotSupportedError) — cùng lý do
  // với HotelConfig.googlePlaceId (xem hotel-config.entity.ts).
  @Column({ name: 'attachmentUrl', type: 'varchar', nullable: true })
  attachmentUrl!: string | null;

  @Column({
    name: 'attachmentType',
    type: 'enum',
    enum: MessageAttachmentType,
    nullable: true,
  })
  attachmentType!: MessageAttachmentType | null;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt!: Date;
}
