import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum ConversationStatus {
  OPEN = 'OPEN',
  CLOSED = 'CLOSED',
}

// 1 hội thoại = 1 khách hàng đang cần hỗ trợ. staff là người lễ tân đầu tiên trả
// lời (gán khi có tin nhắn đầu tiên từ phía staff), có thể null nếu chưa ai nhận.
@Entity('Conversation')
export class Conversation {
  @PrimaryGeneratedColumn('uuid', { name: 'conversationId' })
  conversationId!: string;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: 'customerId' })
  customer!: User;

  @ManyToOne(() => User, { eager: true, nullable: true })
  @JoinColumn({ name: 'staffId' })
  staff!: User | null;

  @Column({
    name: 'status',
    type: 'enum',
    enum: ConversationStatus,
    default: ConversationStatus.OPEN,
  })
  status!: ConversationStatus;

  @Column({ name: 'lastMessageAt', type: 'timestamptz', nullable: true })
  lastMessageAt!: Date | null;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updatedAt' })
  updatedAt!: Date;
}
