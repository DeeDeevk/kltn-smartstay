import type { ConfigService } from '@nestjs/config';
import type { FindOperator, Repository } from 'typeorm';
import type { Faq } from '../entities/faq.entity';
import {
  cosineSimilarity,
  FaqEmbeddingService,
  LOW_CONFIDENCE_THRESHOLD,
} from './faq-embedding.service';

const VECTOR_SIZE = 768;

// A tiny deterministic "fake embedding": a hashed bag-of-words vector. This is NOT a
// real semantic embedding, but it reproduces the one property these tests actually
// rely on -- texts sharing vocabulary get a high cosine similarity, texts sharing none
// get a low one -- without making real network calls to the Gemini embedding API.
// Gemini trả về vector dài hơn 768 chiều; phần đuôi ở đây toàn số 1 nên nếu service
// quên cắt về 768 thì độ giống bị lệch và test kiểm tra độ dài sẽ bắt được.
const RAW_DIMENSIONS = 1024;
function fakeEmbed(text: string): number[] {
  const vector = new Array<number>(RAW_DIMENSIONS).fill(0);
  vector.fill(1, VECTOR_SIZE);
  const words = text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  for (const word of words) {
    let hash = 0;
    for (let i = 0; i < word.length; i += 1) {
      hash = (hash * 31 + word.charCodeAt(i)) >>> 0;
    }
    vector[hash % VECTOR_SIZE] += 1;
  }
  return vector;
}

// Pinecone giả, lưu record trong bộ nhớ: đủ để chạy luồng fetch -> upsert ->
// listPaginated -> deleteMany -> query của service mà không cần gọi Pinecone thật.
// Tên bắt đầu bằng "mock" để jest.mock (bị hoist lên đầu file) được phép tham chiếu.
interface StoredRecord {
  id: string;
  values: number[];
  metadata: Record<string, unknown>;
}
const mockPoints = new Map<string, StoredRecord>();
const mockIndex = {
  fetch: jest.fn(({ ids }: { ids: string[] }) =>
    Promise.resolve({
      records: Object.fromEntries(
        ids
          .filter((id) => mockPoints.has(id))
          .map((id) => [id, mockPoints.get(id)!]),
      ),
    }),
  ),
  upsert: jest.fn(({ records }: { records: StoredRecord[] }) => {
    for (const r of records) mockPoints.set(r.id, r);
    return Promise.resolve();
  }),
  listPaginated: jest.fn(() =>
    Promise.resolve({ vectors: [...mockPoints.keys()].map((id) => ({ id })) }),
  ),
  deleteMany: jest.fn(({ ids }: { ids: string[] }) => {
    for (const id of ids) mockPoints.delete(id);
    return Promise.resolve();
  }),
  query: jest.fn(({ vector, topK }: { vector: number[]; topK: number }) =>
    Promise.resolve({
      matches: [...mockPoints.values()]
        .map((p) => ({ id: p.id, score: cosineSimilarity(vector, p.values) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, topK),
    }),
  ),
};
jest.mock('@pinecone-database/pinecone', () => ({
  Pinecone: jest.fn(() => ({ index: () => mockIndex })),
}));

// Single-text embedding: used for search queries and as the per-row fallback when a
// batch fails.
const embedContent = jest.fn(
  (request: { content: { parts: Array<{ text: string }> } }) =>
    Promise.resolve({
      embedding: { values: fakeEmbed(request.content.parts[0].text) },
    }),
);

// Batch embedding used when indexing FAQs; counting its calls lets tests assert that
// stale FAQs go out together and unchanged ones are not re-embedded.
const batchEmbedContents = jest.fn(
  (request: {
    requests: Array<{
      content: { parts: Array<{ text: string }> };
      taskType: string;
    }>;
  }) =>
    Promise.resolve({
      embeddings: request.requests.map((r) => ({
        values: fakeEmbed(r.content.parts[0].text),
      })),
    }),
);

// jest.requireActual() is untyped (returns `any`) by nature of CommonJS interop, so
// spreading it below to keep the real TaskType enum etc. alongside our fake
// GoogleGenerativeAI class is unavoidably flagged by the no-unsafe-* rules — there is
// no safer typed alternative for a jest.mock factory.
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return */
jest.mock('@google/generative-ai', () => {
  const actual = jest.requireActual('@google/generative-ai');
  return {
    ...actual,
    GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
      getGenerativeModel: () => ({ embedContent, batchEmbedContents }),
    })),
  };
});
/* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return */

function makeConfig(): ConfigService {
  return {
    get: (key: string) =>
      ({ GEMINI_API_KEY: 'fake-key', PINECONE_API_KEY: 'fake-pinecone' })[key],
  } as unknown as ConfigService;
}

function makeFaq(faqId: string, question: string, answer: string): Faq {
  return {
    faqId,
    question,
    answer,
    category: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

// Minimal in-memory stand-in for Repository<Faq>: only find() and findBy() are used.
function makeRepo(rows: Faq[]) {
  return {
    find: jest.fn(({ where }: { where: { isActive: boolean } }) =>
      Promise.resolve(rows.filter((r) => r.isActive === where.isActive)),
    ),
    findBy: jest.fn(({ faqId }: { faqId: FindOperator<string[]> }) =>
      Promise.resolve(rows.filter((r) => faqId.value.includes(r.faqId))),
    ),
  };
}

function makeService(repo: ReturnType<typeof makeRepo>) {
  return new FaqEmbeddingService(
    makeConfig(),
    repo as unknown as Repository<Faq>,
  );
}

function seedRows(): Faq[] {
  return [
    makeFaq(
      'cancel',
      'Huỷ phòng có mất phí không?',
      'Quý khách có thể huỷ đặt phòng miễn phí bất kỳ lúc nào trước khi nhận phòng.',
    ),
    makeFaq(
      'late-checkout',
      'Trả phòng trễ có bị tính phí không?',
      'Trả phòng sau 12:00 trưa, mỗi 24 giờ trễ tính thêm phụ thu 1 đêm.',
    ),
  ];
}

describe('FaqEmbeddingService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPoints.clear();
  });

  describe('boot', () => {
    it('keeps the app running when Pinecone is unreachable at boot', async () => {
      mockIndex.fetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));
      const service = makeService(makeRepo(seedRows()));

      await expect(service.onModuleInit()).resolves.toBeUndefined();
    });
  });

  describe('search', () => {
    it('matches a question about an existing FAQ topic to the cancellation entry with high similarity', async () => {
      const service = makeService(makeRepo(seedRows()));
      await service.onModuleInit();

      const results = await service.search('huỷ phòng có mất phí không', 1);

      expect(results).toHaveLength(1);
      expect(results[0].entry.faqId).toBe('cancel');
      expect(results[0].similarity).toBeGreaterThan(LOW_CONFIDENCE_THRESHOLD);
      expect(results[0].lowConfidence).toBe(false);
    });

    it('matches a late-checkout question to the late-checkout entry, not the cancellation one', async () => {
      const service = makeService(makeRepo(seedRows()));
      await service.onModuleInit();

      const results = await service.search(
        'trả phòng trễ có bị tính phí không',
        1,
      );

      expect(results[0].entry.faqId).toBe('late-checkout');
      expect(results[0].similarity).toBeGreaterThan(LOW_CONFIDENCE_THRESHOLD);
    });

    it('flags a completely unrelated question as low confidence instead of returning a confident wrong match', async () => {
      const service = makeService(makeRepo(seedRows()));
      await service.onModuleInit();

      const results = await service.search('khách sạn có nuôi mèo không', 1);

      expect(results).toHaveLength(1);
      expect(results[0].similarity).toBeLessThan(LOW_CONFIDENCE_THRESHOLD);
      expect(results[0].lowConfidence).toBe(true);
    });

    it('sends a 768-dim query vector to Pinecone with the requested topK', async () => {
      const service = makeService(makeRepo(seedRows()));
      await service.onModuleInit();

      await service.search('huỷ phòng', 3);

      const [request] = mockIndex.query.mock.calls[0];
      expect(request.vector).toHaveLength(VECTOR_SIZE);
      expect(request.topK).toBe(3);
    });

    it('reads the FAQ content from the DB, so an admin edit shows up without re-indexing', async () => {
      const rows = seedRows();
      const service = makeService(makeRepo(rows));
      await service.onModuleInit();

      rows[0].answer = 'Nội dung mới do admin vừa sửa.';
      const results = await service.search('huỷ phòng có mất phí không', 1);

      expect(results[0].entry.answer).toBe('Nội dung mới do admin vừa sửa.');
    });

    it('skips a Pinecone match whose FAQ row no longer exists in the DB', async () => {
      const rows = seedRows();
      const service = makeService(makeRepo(rows));
      await service.onModuleInit();

      rows.splice(0, 1); // xoá thẳng trong DB, Pinecone chưa kịp dọn
      const results = await service.search('huỷ phòng có mất phí không', 5);

      expect(results.map((r) => r.entry.faqId)).toEqual(['late-checkout']);
    });

    it('returns an empty result set when Pinecone fails instead of throwing', async () => {
      const service = makeService(makeRepo(seedRows()));
      await service.onModuleInit();
      mockIndex.query.mockRejectedValueOnce(new Error('Pinecone down'));

      await expect(service.search('huỷ phòng')).resolves.toEqual([]);
    });

    it('returns an empty result set when there are no FAQs at all', async () => {
      const service = makeService(makeRepo([]));
      await service.onModuleInit();

      expect(await service.search('bất kỳ câu hỏi nào')).toEqual([]);
    });
  });

  describe('refresh', () => {
    it('upserts one point per FAQ, keyed by faqId, with vectors cut to 768 dims', async () => {
      const service = makeService(makeRepo(seedRows()));

      const summary = await service.refresh();

      expect(summary).toEqual({ indexed: 2, embedded: 2, failed: 0 });
      expect([...mockPoints.keys()].sort()).toEqual([
        'cancel',
        'late-checkout',
      ]);
      for (const point of mockPoints.values()) {
        expect(point.values).toHaveLength(VECTOR_SIZE);
        expect(typeof point.metadata.hash).toBe('string');
        expect(point.metadata.model).toBe('gemini-embedding-001');
        expect(point.metadata.faqId).toBe(point.id);
      }
    });

    it('does not re-embed unchanged FAQs on the next refresh', async () => {
      const service = makeService(makeRepo(seedRows()));
      await service.refresh();
      batchEmbedContents.mockClear();
      mockIndex.upsert.mockClear();

      const second = await service.refresh();

      expect(second).toEqual({ indexed: 2, embedded: 0, failed: 0 });
      expect(batchEmbedContents).not.toHaveBeenCalled();
      expect(mockIndex.upsert).not.toHaveBeenCalled();
    });

    it('re-embeds only the FAQ whose answer was edited', async () => {
      const rows = seedRows();
      const service = makeService(makeRepo(rows));
      await service.refresh();

      rows[1].answer = 'Trả phòng sau 14:00 chiều tính phụ thu nửa đêm.';
      batchEmbedContents.mockClear();
      const summary = await service.refresh();

      expect(summary.embedded).toBe(1);
      expect(batchEmbedContents).toHaveBeenCalledTimes(1);
      expect(batchEmbedContents.mock.calls[0][0].requests).toHaveLength(1);
    });

    it('re-embeds a FAQ stored with a different embedding model', async () => {
      const rows = seedRows();
      const service = makeService(makeRepo(rows));
      await service.refresh();
      mockPoints.get('cancel')!.metadata.model = 'text-embedding-004';
      batchEmbedContents.mockClear();

      const summary = await service.refresh();

      expect(summary.embedded).toBe(1);
      expect(mockPoints.get('cancel')!.metadata.model).toBe(
        'gemini-embedding-001',
      );
    });

    it('embeds all stale FAQs in one batch call instead of one request per FAQ', async () => {
      const rows = seedRows();
      const service = makeService(makeRepo(rows));

      await service.refresh();

      expect(batchEmbedContents).toHaveBeenCalledTimes(1);
      const { requests } = batchEmbedContents.mock.calls[0][0];
      expect(requests).toHaveLength(2);
      expect(requests.every((r) => r.taskType === 'RETRIEVAL_DOCUMENT')).toBe(
        true,
      );
      expect(embedContent).not.toHaveBeenCalled();
      // Each point received the vector of its own text (results map back in order).
      expect(mockPoints.get('cancel')!.values).toEqual(
        fakeEmbed(`${rows[0].question}\n${rows[0].answer}`).slice(
          0,
          VECTOR_SIZE,
        ),
      );
      expect(mockPoints.get('late-checkout')!.values).toEqual(
        fakeEmbed(`${rows[1].question}\n${rows[1].answer}`).slice(
          0,
          VECTOR_SIZE,
        ),
      );
    });

    it('splits more than 100 stale FAQs across several batch calls', async () => {
      const rows = Array.from({ length: 250 }, (_, i) =>
        makeFaq(`faq-${i}`, `Câu hỏi số ${i}?`, `Câu trả lời số ${i}.`),
      );
      const service = makeService(makeRepo(rows));

      const summary = await service.refresh();

      expect(summary).toEqual({ indexed: 250, embedded: 250, failed: 0 });
      expect(
        batchEmbedContents.mock.calls.map((call) => call[0].requests.length),
      ).toEqual([100, 100, 50]);
      expect(mockIndex.upsert).toHaveBeenCalledTimes(3);
    });

    it('when a batch fails, retries row by row so one bad FAQ does not hide the others', async () => {
      const service = makeService(makeRepo(seedRows()));
      batchEmbedContents.mockRejectedValueOnce(
        new Error('400 invalid content'),
      );
      // Row-by-row retry runs in order: the first FAQ is the unembeddable one.
      embedContent.mockRejectedValueOnce(new Error('text too long'));

      const summary = await service.refresh();

      expect(summary).toEqual({ indexed: 1, embedded: 1, failed: 1 });
      expect(embedContent).toHaveBeenCalledTimes(2);
      // Failed row is not written, so it stays stale and is retried next time.
      expect(mockPoints.has('cancel')).toBe(false);
      expect(mockPoints.has('late-checkout')).toBe(true);

      const retry = await service.refresh();
      expect(retry).toEqual({ indexed: 2, embedded: 1, failed: 0 });
      expect(mockPoints.has('cancel')).toBe(true);
    });

    it('deletes the point of a FAQ that was hidden or removed', async () => {
      const rows = seedRows();
      const service = makeService(makeRepo(rows));
      await service.refresh();

      rows[0].isActive = false;
      await service.refresh();

      expect(mockIndex.deleteMany).toHaveBeenCalledWith({ ids: ['cancel'] });
      expect([...mockPoints.keys()]).toEqual(['late-checkout']);
    });

    it('does not call delete when there is nothing to clean up', async () => {
      const service = makeService(makeRepo(seedRows()));

      await service.refresh();

      expect(mockIndex.deleteMany).not.toHaveBeenCalled();
    });

    it('shares one in-flight refresh between concurrent callers', async () => {
      const service = makeService(makeRepo(seedRows()));

      const [a, b] = await Promise.all([service.refresh(), service.refresh()]);

      expect(a).toBe(b);
      expect(batchEmbedContents).toHaveBeenCalledTimes(1);
    });
  });
});
