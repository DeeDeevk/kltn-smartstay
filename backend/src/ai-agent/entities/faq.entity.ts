import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

// Kho tri thức FAQ/chính sách khách sạn — nguồn dữ liệu cho RAG của tool get_policy.
// 4 cột đầu bám theo class diagram (faqId, question, answer, category); các cột
// embedding* là phần bổ sung để lưu sẵn vector, không phải gọi API embed lại toàn bộ
// FAQ mỗi lần khởi động backend.
@Entity('FAQ')
export class Faq {
  @PrimaryGeneratedColumn('uuid', { name: 'faqId' })
  faqId!: string;

  @Column({ name: 'question', type: 'text' })
  question!: string;

  @Column({ name: 'answer', type: 'text' })
  answer!: string;

  // Nhóm chủ đề (VD: "Huỷ phòng", "Thanh toán") — hiển thị làm "nguồn" khi bot trả lời.
  @Column({ name: 'category', type: 'varchar', length: 100, nullable: true })
  category!: string | null;

  // FAQ bị ẩn sẽ không được đưa vào index tìm kiếm, nhưng vẫn giữ lại trong DB.
  @Column({ name: 'isActive', type: 'boolean', default: true })
  isActive!: boolean;

  // Vector embedding của "question + answer". Lưu jsonb (mảng số) thay vì kiểu vector
  // của pgvector để không phải cài thêm extension — với vài chục FAQ, tính cosine
  // similarity trong RAM là đủ nhanh.
  @Column({ name: 'embedding', type: 'jsonb', nullable: true })
  embedding!: number[] | null;

  // Tên model đã sinh ra embedding — đổi GEMINI_EMBEDDING_MODEL thì vector cũ không còn
  // so sánh được với vector câu hỏi mới, cần embed lại.
  @Column({
    name: 'embeddingModel',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  embeddingModel!: string | null;

  // Hash SHA-256 của đoạn text đã đem đi embed. Admin sửa question/answer thì hash lệch
  // -> biết cần embed lại. Dùng hash thay vì so updatedAt vì mọi lệnh UPDATE (kể cả lúc
  // chính mình ghi embedding vào) đều làm TypeORM tự đổi updatedAt.
  @Column({
    name: 'embeddingHash',
    type: 'varchar',
    length: 64,
    nullable: true,
  })
  embeddingHash!: string | null;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updatedAt' })
  updatedAt!: Date;
}
