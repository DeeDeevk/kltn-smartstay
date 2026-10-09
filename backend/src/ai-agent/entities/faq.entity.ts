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

  @CreateDateColumn({ name: 'createdAt' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updatedAt' })
  updatedAt!: Date;
}
