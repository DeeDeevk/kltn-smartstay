import { createHash } from 'crypto';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { GoogleGenerativeAI, TaskType } from '@google/generative-ai';
import { Faq } from '../entities/faq.entity';
import { QdrantClient } from '@qdrant/js-client-rest';

// Below this cosine-similarity score, the best match is not close enough to be
// presented as a confident answer — the caller (get_policy) should tell the model
// to hedge or point the guest to reception instead of stating the entry as fact.
export const LOW_CONFIDENCE_THRESHOLD = 0.68;

export interface FaqSearchResult {
  entry: Faq;
  similarity: number;
  lowConfidence: boolean;
}

export interface FaqReindexSummary {
  indexed: number;
  embedded: number;
  failed: number;
}

interface StaleFaq {
  faq: Faq;
  text: string;
  hash: string;
}

// Gemini batchEmbedContents accepts at most 100 requests per call.
const EMBED_BATCH_SIZE = 100;
const VECTOR_SIZE = 768;

// Lưu vector ở Qdrant thay vì trong DB để tránh bloat bảng FAQ (mỗi vector ~3KB, vài nghìn FAQ là vài MB).
@Injectable()
export class FaqEmbeddingService implements OnModuleInit {
  private readonly logger = new Logger(FaqEmbeddingService.name);
  private readonly client: GoogleGenerativeAI;
  private readonly embeddingModel: string;
  private readonly qdrant: QdrantClient;
  private readonly collection: string;
  // false until one refresh has fully succeeded — lets search() retry a refresh that
  // failed at boot (e.g. embedding API briefly unreachable) instead of staying empty.
  private indexReady = false;
  // Shared promise so concurrent callers (boot + an admin edit + a search) don't each
  // start their own refresh and embed the same rows twice.
  private refreshing: Promise<FaqReindexSummary> | null = null;

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(Faq) private readonly faqRepo: Repository<Faq>,
  ) {
    const apiKey = this.config.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      throw new Error('Missing GEMINI_API_KEY environment variable');
    }
    this.client = new GoogleGenerativeAI(apiKey);
    // text-embedding-004 is not enabled for embedContent on every API key/project
    // (confirmed via ListModels for this project — only the gemini-embedding-* family
    // is available here), so default to the current generally-available embedding
    // model instead. Still overridable via env for projects where text-embedding-004
    // (or a newer model) is actually enabled.
    this.embeddingModel =
      this.config.get<string>('GEMINI_EMBEDDING_MODEL') ??
      'gemini-embedding-001';
    this.qdrant = new QdrantClient({
      url: config.get<string>('QDRANT_URL') ?? 'http://localhost:6333',
    });
    this.collection = config.get('QDRANT_COLLECTION') ?? 'faq';
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.ensureCollection();
      await this.refresh();
    } catch (err) {
      // A DB/embedding failure at boot shouldn't crash the whole app — search() will
      // retry the refresh on the next call instead.
      this.logger.error(
        `Failed to build FAQ embedding index: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  // Tạo collection nếu chưa có. Distance 'Cosine' -> điểm Qdrant trả về CHÍNH LÀ độ
  // giống cosine, nên ngưỡng LOW_CONFIDENCE_THRESHOLD = 0.68.
  private async ensureCollection() {
    const { exists } = await this.qdrant.collectionExists(this.collection);
    if (!exists) {
      await this.qdrant.createCollection(this.collection, {
        vectors: {
          size: VECTOR_SIZE,
          distance: 'Cosine',
        },
      });
    }
  }

  async search(queryText: string, topK = 2): Promise<FaqSearchResult[]> {
    try {
      if (!this.indexReady) await this.refresh().catch(() => {});
      const queryVector = await this.embed(queryText, TaskType.RETRIEVAL_QUERY);
      const { points: hits } = await this.qdrant.query(this.collection, {
        query: queryVector,
        limit: topK,
      });
      if (hits.length === 0) return [];

      // Nội dung FAQ lấy từ Postgres (nguồn gốc), không nhét vào payload Qdrant — để admin
      // sửa câu chữ là bot dùng ngay bản mới, không lệch giữa hai nơi.
      const faqs = await this.faqRepo.findBy({
        faqId: In(hits.map((h) => String(h.id))),
      });
      const byId = new Map(faqs.map((f) => [f.faqId, f]));

      return hits
        .filter((h) => byId.has(String(h.id)))
        .map((h) => ({
          entry: byId.get(String(h.id))!,
          similarity: h.score,
          lowConfidence: h.score < LOW_CONFIDENCE_THRESHOLD,
        }));
    } catch (error) {
      this.logger.error(
        `Tìm FAQ thất bại: ${error instanceof Error ? error.message : String(error)}`,
      );
      return [];
    }
  }

  refresh(): Promise<FaqReindexSummary> {
    if (!this.refreshing) {
      this.refreshing = this.doRefresh().finally(() => {
        this.refreshing = null;
      });
    }
    return this.refreshing;
  }

  private async doRefresh(): Promise<FaqReindexSummary> {
    const faqs = await this.faqRepo.find({ where: { isActive: true } });

    // Lấy payload (hash, model) hiện có trong Qdrant. Dùng faqId làm id của điểm —
    // Qdrant nhận UUID làm id, nên 1 FAQ = đúng 1 điểm, upsert lại là ghi đè.
    const existing = await this.qdrant.retrieve(this.collection, {
      ids: faqs.map((faq) => faq.faqId),
      with_payload: true,
      with_vector: false,
    });
    const stored = new Map(existing.map((p) => [String(p.id), p.payload]));
    const stale = faqs
      .map((faq) => ({
        faq,
        text: embeddingText(faq),
        hash: sha256(embeddingText(faq)),
      }))
      .filter(({ faq, hash }) => {
        const p = stored.get(faq.faqId);
        return !p || p.hash !== hash || p.model !== this.embeddingModel;
      });
    let embedded = 0;
    let failed = 0;
    for (const batch of chunk(stale, EMBED_BATCH_SIZE)) {
      const vectors = await this.embedDocuments(batch.map((s) => s.text));
      const points = batch.flatMap((s, i) => {
        const v = vectors[i];
        if (v instanceof Error) {
          failed += 1;
          return [];
        }
        return [
          {
            id: s.faq.faqId,
            vector: v,
            payload: { hash: s.hash, model: this.embeddingModel },
          },
        ];
      });
      if (points.length > 0) {
        await this.qdrant.upsert(this.collection, { wait: true, points });
        embedded += points.length;
      }
    }
    // Xoá điểm của FAQ đã bị xoá hoặc bị ẩn — trước đây việc này tự xảy ra vì chỉ mục
    // RAM dựng lại từ đầu mỗi lần; giờ chỉ mục nằm lâu dài trong Qdrant nên phải dọn tay.
    const activeIds = new Set(faqs.map((faq) => faq.faqId));
    const { points: all } = await this.qdrant.scroll(this.collection, {
      limit: 10_000,
      with_payload: false,
    });
    const orphanIds = all
      .map((p) => String(p.id))
      .filter((id) => !activeIds.has(id));
    if (orphanIds.length > 0) {
      await this.qdrant.delete(this.collection, {
        wait: true,
        points: orphanIds,
      });
    }
    this.indexReady = failed === 0;
    return { indexed: faqs.length - failed, embedded, failed };
  }

  // Embeds document texts with one batchEmbedContents call instead of one request per
  // FAQ. A batch is all-or-nothing on the API side: a single unembeddable FAQ (or a
  // transient error) rejects the whole batch. To keep the "one bad row doesn't hide
  // the others" guarantee, a failed batch is retried row by row and each row reports
  // its own vector or error, in the same order as `texts`.
  private async embedDocuments(
    texts: string[],
  ): Promise<Array<number[] | Error>> {
    try {
      return await this.embedBatch(texts, TaskType.RETRIEVAL_DOCUMENT);
    } catch (err) {
      this.logger.warn(
        `Batch embedding of ${texts.length} FAQ(s) failed (${err instanceof Error ? err.message : String(err)}); retrying one by one`,
      );
      const results: Array<number[] | Error> = [];
      for (const text of texts) {
        try {
          results.push(await this.embed(text, TaskType.RETRIEVAL_DOCUMENT));
        } catch (rowErr) {
          results.push(
            rowErr instanceof Error ? rowErr : new Error(String(rowErr)),
          );
        }
      }
      return results;
    }
  }

  private async embedBatch(
    texts: string[],
    taskType: TaskType,
  ): Promise<number[][]> {
    const model = this.client.getGenerativeModel({
      model: this.embeddingModel,
    });
    const result = await model.batchEmbedContents({
      requests: texts.map((text) => ({
        content: { role: 'user', parts: [{ text }] },
        taskType,
      })),
    });
    if (result.embeddings.length !== texts.length) {
      throw new Error(
        `Batch embedding returned ${result.embeddings.length} vectors for ${texts.length} texts`,
      );
    }
    return result.embeddings.map((e) => e.values.slice(0, VECTOR_SIZE));
  }

  // taskType tells the embedding model whether this text is a document being indexed
  // or a query being searched with — Gemini's retrieval-tuned embedding models produce
  // measurably better matches with this asymmetric hint than embedding both the same way.
  private async embed(text: string, taskType: TaskType): Promise<number[]> {
    const model = this.client.getGenerativeModel({
      model: this.embeddingModel,
    });
    const result = await model.embedContent({
      content: { role: 'user', parts: [{ text }] },
      taskType,
    });
    return result.embedding.values.slice(0, VECTOR_SIZE);
  }
}

// Embed question + answer together so retrieval matches on either the canonical
// question phrasing or vocabulary that only appears in the answer.
function embeddingText(faq: Pick<Faq, 'question' | 'answer'>): string {
  return `${faq.question}\n${faq.answer}`;
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function sha256(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
