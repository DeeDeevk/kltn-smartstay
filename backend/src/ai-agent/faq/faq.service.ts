import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Faq } from '../entities/faq.entity';
import { CreateFaqDto } from '../dto/create-faq.dto';
import { UpdateFaqDto } from '../dto/update-faq.dto';
import { FaqEmbeddingService } from '../rag/faq-embedding.service';

// Cột embedding* là dữ liệu nội bộ của RAG (mảng vài nghìn số) — không trả ra API.
export type FaqView = Omit<
  Faq,
  'embedding' | 'embeddingModel' | 'embeddingHash'
>;

function toView(faq: Faq): FaqView {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { embedding, embeddingModel, embeddingHash, ...view } = faq;
  return view;
}

@Injectable()
export class FaqService {
  private readonly logger = new Logger(FaqService.name);

  constructor(
    @InjectRepository(Faq) private readonly faqRepo: Repository<Faq>,
    private readonly faqEmbeddingService: FaqEmbeddingService,
  ) {}

  async findAll(onlyActive: boolean): Promise<FaqView[]> {
    const faqs = await this.faqRepo.find({
      where: onlyActive ? { isActive: true } : {},
      order: { category: 'ASC', createdAt: 'ASC' },
    });
    return faqs.map(toView);
  }

  async create(dto: CreateFaqDto): Promise<FaqView> {
    const saved = await this.faqRepo.save(
      this.faqRepo.create({
        question: dto.question.trim(),
        answer: dto.answer.trim(),
        category: dto.category?.trim() || null,
        isActive: dto.isActive ?? true,
      }),
    );
    await this.syncIndex();
    return toView(saved);
  }

  async update(faqId: string, dto: UpdateFaqDto): Promise<FaqView> {
    const faq = await this.faqRepo.findOne({ where: { faqId } });
    if (!faq) throw new NotFoundException('Không tìm thấy FAQ');

    if (dto.question !== undefined) faq.question = dto.question.trim();
    if (dto.answer !== undefined) faq.answer = dto.answer.trim();
    if (dto.category !== undefined) faq.category = dto.category.trim() || null;
    if (dto.isActive !== undefined) faq.isActive = dto.isActive;

    const saved = await this.faqRepo.save(faq);
    await this.syncIndex();
    return toView(saved);
  }

  async remove(faqId: string): Promise<{ faqId: string }> {
    const result = await this.faqRepo.delete(faqId);
    if (!result.affected) throw new NotFoundException('Không tìm thấy FAQ');
    await this.syncIndex();
    return { faqId };
  }

  reindex() {
    return this.faqEmbeddingService.refresh();
  }

  // Dữ liệu FAQ đã lưu DB thành công thì thao tác CRUD coi như thành công — lỗi embed
  // (VD Gemini tạm lỗi) chỉ log lại, FAQ đó sẽ được embed bù ở lần refresh kế tiếp
  // (lần search tiếp theo, hoặc admin bấm reindex).
  private async syncIndex(): Promise<void> {
    try {
      await this.faqEmbeddingService.refresh();
    } catch (err) {
      this.logger.warn(
        `FAQ saved but re-indexing failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
