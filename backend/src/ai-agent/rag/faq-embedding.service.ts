import { createHash } from 'crypto';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { GoogleGenerativeAI, TaskType } from '@google/generative-ai';
import { Faq } from '../entities/faq.entity';
import { Index, Pinecone } from '@pinecone-database/pinecone';

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

// Metadata lưu kèm mỗi vector trên Pinecone: hash + model để biết FAQ nào cần embed
// lại, faqId để lọc theo FAQ khi query.
type FaqVectorMeta = {
  hash: string;
  model: string;
  faqId: string;
};

// Gemini batchEmbedContents accepts at most 100 requests per call.
const EMBED_BATCH_SIZE = 100;
const VECTOR_SIZE = 768;

// Vector FAQ lưu trên Pinecone (id = faqId), nội dung FAQ vẫn nằm ở Postgres.
@Injectable()
export class FaqEmbeddingService implements OnModuleInit {
  private readonly logger = new Logger(FaqEmbeddingService.name);
  private readonly client: GoogleGenerativeAI;
  private readonly embeddingModel: string;
  private readonly index: Index<FaqVectorMeta>;
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
    // Overridable via env; đổi model thì refresh() tự embed lại toàn bộ FAQ.
    this.embeddingModel =
      this.config.get<string>('GEMINI_EMBEDDING_MODEL') ??
      'gemini-embedding-001';
    const pineconeKey = this.config.get<string>('PINECONE_API_KEY');
    if (!pineconeKey) {
      throw new Error('Không tìm thấy PINECONE_API_KEY trong biến môi trường');
    }
    this.index = new Pinecone({
      apiKey: pineconeKey,
    }).index<FaqVectorMeta>({
      name: this.config.get<string>('PINECONE_INDEX') ?? 'faq',
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.refresh();
    } catch (err) {
      // A DB/embedding failure at boot shouldn't crash the whole app — search() will
      // retry the refresh on the next call instead.
      this.logger.error(
        `Failed to build FAQ embedding index: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async search(queryText: string, topK = 2): Promise<FaqSearchResult[]> {
    try {
      if (!this.indexReady) await this.refresh().catch(() => {});
      const queryVector = await this.embed(queryText, TaskType.RETRIEVAL_QUERY);
      const { matches } = await this.index.query({
        vector: queryVector,
        topK,
      });
      if (matches.length === 0) return [];

      // Nội dung FAQ lấy từ Postgres (nguồn gốc), không lưu trong metadata Pinecone — để
      // admin sửa câu chữ là bot dùng ngay bản mới, không lệch giữa hai nơi.
      const faqs = await this.faqRepo.findBy({
        faqId: In(matches.map((m) => String(m.id))),
      });
      const byId = new Map(faqs.map((f) => [f.faqId, f]));

      return matches
        .filter((m) => byId.has(String(m.id)))
        .map((m) => ({
          entry: byId.get(String(m.id))!,
          similarity: m.score ?? 0,
          lowConfidence: (m.score ?? 0) < LOW_CONFIDENCE_THRESHOLD,
        }));
    } catch (error) {
      this.logger.error(
        `Tìm FAQ thất bại: ${error instanceof Error ? error.message : String(error)}`,
      );
      return [];
    }
  }

  // Embeds only FAQs whose text or embedding model changed since last time, and removes
  // vectors of hidden/deleted FAQs. Called at boot and after every admin create/update/delete.
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

    const stored = new Map<string, FaqVectorMeta | undefined>();
    if (faqs.length > 0) {
      const { records } = await this.index.fetch({
        ids: faqs.map((f) => f.faqId),
      });
      for (const [id, r] of Object.entries(records)) {
        stored.set(id, r.metadata);
      }
    }

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
            values: v,
            metadata: {
              hash: s.hash,
              model: this.embeddingModel,
              faqId: s.faq.faqId,
            },
          },
        ];
      });
      if (points.length > 0) {
        await this.index.upsert({ records: points });
        embedded += points.length;
      }
    }
    // Xoá vector của FAQ đã bị xoá hoặc bị ẩn. listPaginated trả id theo từng trang.
    const activeIds = new Set(faqs.map((f) => f.faqId));
    const allIds: string[] = [];
    let token: string | undefined;
    do {
      const page = await this.index.listPaginated({
        paginationToken: token,
      });
      allIds.push(...(page.vectors ?? []).map((v) => v.id!));
      token = page.pagination?.next;
    } while (token);
    const orphanIds = allIds.filter((id) => !activeIds.has(id));
    if (orphanIds.length > 0) {
      await this.index.deleteMany({
        ids: orphanIds,
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
