import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI, TaskType } from '@google/generative-ai';
import { FAQ_DATA, FaqEntry } from './faq-data';

// Below this cosine-similarity score, the best match is not close enough to be
// presented as a confident answer — the caller (get_policy) should tell the model
// to hedge or point the guest to reception instead of stating the entry as fact.
export const LOW_CONFIDENCE_THRESHOLD = 0.5;

export interface FaqSearchResult {
  entry: FaqEntry;
  similarity: number;
  lowConfidence: boolean;
}

interface IndexedFaqEntry {
  entry: FaqEntry;
  vector: number[];
}

// Lightweight RAG over a small, static FAQ set (a few dozen entries at most) — no
// dedicated vector database needed, an in-memory array plus a linear cosine-similarity
// scan is fast enough at this scale and keeps the ai-agent module self-contained.
@Injectable()
export class FaqEmbeddingService implements OnModuleInit {
  private readonly logger = new Logger(FaqEmbeddingService.name);
  private readonly client: GoogleGenerativeAI;
  private readonly embeddingModel: string;
  private index: IndexedFaqEntry[] = [];

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      throw new Error('Missing GEMINI_API_KEY environment variable');
    }
    this.client = new GoogleGenerativeAI(apiKey);
    this.embeddingModel =
      this.config.get<string>('GEMINI_EMBEDDING_MODEL') ?? 'text-embedding-004';
  }

  // Embed the whole (static) FAQ dataset exactly once at startup instead of on every
  // get_policy call — the dataset never changes at runtime, so re-embedding it per
  // request would just be repeated network calls that always produce the same vectors.
  async onModuleInit(): Promise<void> {
    try {
      await this.buildIndex();
    } catch (err) {
      // A transient embedding-API failure at boot shouldn't crash the whole app —
      // search() degrades to "no match" (empty index) rather than taking down every
      // other ai-agent tool with it.
      this.logger.error(
        `Failed to build FAQ embedding index: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async search(queryText: string, topK = 2): Promise<FaqSearchResult[]> {
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

  private async buildIndex(): Promise<void> {
    this.index = await Promise.all(
      FAQ_DATA.map(async (entry) => ({
        entry,
        // Embed question + content together so retrieval matches on either the
        // canonical question phrasing or vocabulary that only appears in the answer.
        vector: await this.embed(
          `${entry.question}\n${entry.content}`,
          TaskType.RETRIEVAL_DOCUMENT,
        ),
      })),
    );
    this.logger.log(
      `Indexed ${this.index.length} FAQ entries for semantic search`,
    );
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

function cosineSimilarity(a: number[], b: number[]): number {
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
