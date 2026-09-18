import { createHash } from 'crypto';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GoogleGenerativeAI, TaskType } from '@google/generative-ai';
import { Faq } from '../entities/faq.entity';

// Below this cosine-similarity score, the best match is not close enough to be
// presented as a confident answer — the caller (get_policy) should tell the model
// to hedge or point the guest to reception instead of stating the entry as fact.
export const LOW_CONFIDENCE_THRESHOLD = 0.71;

export interface FaqSearchResult {
  entry: Faq;
  similarity: number;
  lowConfidence: boolean;
}

interface IndexedFaqEntry {
  entry: Faq;
  vector: number[];
}

export interface FaqReindexSummary {
  indexed: number;
  embedded: number;
  failed: number;
}

// Lightweight RAG over the FAQ table (a few dozen entries at most). Vectors are
// persisted on each Faq row so a restart only embeds rows that are new or edited;
// search itself is an in-memory cosine-similarity scan over active entries, which is
// fast enough at this scale without a dedicated vector database.
@Injectable()
export class FaqEmbeddingService implements OnModuleInit {
  private readonly logger = new Logger(FaqEmbeddingService.name);
  private readonly client: GoogleGenerativeAI;
  private readonly embeddingModel: string;
  private index: IndexedFaqEntry[] = [];
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
    if (!this.indexReady) {
      try {
        await this.refresh();
      } catch (err) {
        this.logger.warn(
          `FAQ index still unavailable: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
    if (this.index.length === 0) return [];

    const queryVector = await this.embed(queryText, TaskType.RETRIEVAL_QUERY);
    return this.index
      .map(({ entry, vector }) => {
        const similarity = cosineSimilarity(queryVector, vector);
        return {
          entry,
          similarity,
          lowConfidence: similarity < LOW_CONFIDENCE_THRESHOLD,
        };
      })
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK);
  }

  // Re-reads active FAQs from the DB, embeds only rows whose text or embedding model
  // changed since last time, and swaps in the new in-memory index. Called at boot and
  // after every admin create/update/delete so the bot answers from the latest policy.
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

    let embedded = 0;
    let failed = 0;
    const nextIndex: IndexedFaqEntry[] = [];
    for (const faq of faqs) {
      const text = embeddingText(faq);
      const hash = sha256(text);
      let vector = faq.embedding;
      if (
        !vector ||
        faq.embeddingHash !== hash ||
        faq.embeddingModel !== this.embeddingModel
      ) {
        try {
          vector = await this.embed(text, TaskType.RETRIEVAL_DOCUMENT);
          faq.embedding = vector;
          faq.embeddingHash = hash;
          faq.embeddingModel = this.embeddingModel;
          await this.faqRepo.update(faq.faqId, {
            embedding: vector,
            embeddingHash: hash,
            embeddingModel: this.embeddingModel,
          });
          embedded += 1;
        } catch (err) {
          // One bad row shouldn't hide every other FAQ from search — skip it, it will
          // be retried on the next refresh since its hash still won't match.
          failed += 1;
          this.logger.warn(
            `Failed to embed FAQ ${faq.faqId}: ${err instanceof Error ? err.message : String(err)}`,
          );
          continue;
        }
      }
      nextIndex.push({ entry: faq, vector });
    }

    this.index = nextIndex;
    this.indexReady = failed === 0;
    this.logger.log(
      `Indexed ${nextIndex.length} FAQ entries for semantic search (${embedded} newly embedded, ${failed} failed)`,
    );
    return { indexed: nextIndex.length, embedded, failed };
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
    return result.embedding.values;
  }
}

// Embed question + answer together so retrieval matches on either the canonical
// question phrasing or vocabulary that only appears in the answer.
function embeddingText(faq: Pick<Faq, 'question' | 'answer'>): string {
  return `${faq.question}\n${faq.answer}`;
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
