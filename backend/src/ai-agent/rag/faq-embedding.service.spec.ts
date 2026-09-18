import type { ConfigService } from '@nestjs/config';
import type { Repository } from 'typeorm';
import type { Faq } from '../entities/faq.entity';
import {
  FaqEmbeddingService,
  LOW_CONFIDENCE_THRESHOLD,
} from './faq-embedding.service';

// A tiny deterministic "fake embedding": a hashed bag-of-words vector. This is NOT a
// real semantic embedding, but it reproduces the one property these tests actually
// rely on -- texts sharing vocabulary get a high cosine similarity, texts sharing none
// get a low one -- without making real network calls to the Gemini embedding API.
const DIMENSIONS = 256;
function fakeEmbed(text: string): number[] {
  const vector = new Array<number>(DIMENSIONS).fill(0);
  const words = text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  for (const word of words) {
    let hash = 0;
    for (let i = 0; i < word.length; i += 1) {
      hash = (hash * 31 + word.charCodeAt(i)) >>> 0;
    }
    vector[hash % DIMENSIONS] += 1;
  }
  return vector;
}

// Counts real embed calls so tests can assert that unchanged FAQs are not re-embedded.
const embedContent = jest.fn(
  (request: { content: { parts: Array<{ text: string }> } }) =>
    Promise.resolve({
      embedding: { values: fakeEmbed(request.content.parts[0].text) },
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
      getGenerativeModel: () => ({ embedContent }),
    })),
  };
});
/* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return */

function makeConfig(): ConfigService {
  return {
    get: (key: string) => (key === 'GEMINI_API_KEY' ? 'fake-key' : undefined),
  } as unknown as ConfigService;
}

function makeFaq(faqId: string, question: string, answer: string): Faq {
  return {
    faqId,
    question,
    answer,
    category: null,
    isActive: true,
    embedding: null,
    embeddingModel: null,
    embeddingHash: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

// Minimal in-memory stand-in for Repository<Faq>: only find() and update() are used.
function makeRepo(rows: Faq[]) {
  const repo = {
    find: jest.fn(({ where }: { where: { isActive: boolean } }) =>
      Promise.resolve(rows.filter((r) => r.isActive === where.isActive)),
    ),
    update: jest.fn((faqId: string, patch: Partial<Faq>) => {
      const row = rows.find((r) => r.faqId === faqId);
      if (row) Object.assign(row, patch);
      return Promise.resolve({ affected: row ? 1 : 0 });
    }),
  };
  return repo;
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
  beforeEach(() => embedContent.mockClear());

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

  it('persists embeddings and does not re-embed unchanged FAQs on the next refresh', async () => {
    const rows = seedRows();
    const repo = makeRepo(rows);
    const service = makeService(repo);

    const first = await service.refresh();
    expect(first).toEqual({ indexed: 2, embedded: 2, failed: 0 });
    expect(rows.every((r) => r.embedding && r.embeddingHash)).toBe(true);

    const second = await service.refresh();
    expect(second).toEqual({ indexed: 2, embedded: 0, failed: 0 });
    expect(repo.update).toHaveBeenCalledTimes(2);
  });

  it('re-embeds only the FAQ whose answer was edited', async () => {
    const rows = seedRows();
    const service = makeService(makeRepo(rows));
    await service.refresh();

    rows[1].answer = 'Trả phòng sau 14:00 chiều tính phụ thu nửa đêm.';
    const summary = await service.refresh();

    expect(summary.embedded).toBe(1);
  });

  it('excludes inactive FAQs from search results', async () => {
    const rows = seedRows();
    rows[0].isActive = false;
    const service = makeService(makeRepo(rows));
    await service.onModuleInit();

    const results = await service.search('huỷ phòng có mất phí không', 5);

    expect(results.map((r) => r.entry.faqId)).toEqual(['late-checkout']);
  });

  it('retries building the index on search when it failed at boot', async () => {
    const repo = makeRepo(seedRows());
    repo.find.mockRejectedValueOnce(new Error('DB not ready'));
    const service = makeService(repo);

    await service.onModuleInit(); // fails, logged, app keeps running
    const results = await service.search('huỷ phòng có mất phí không', 1);

    expect(results[0].entry.faqId).toBe('cancel');
  });

  it('returns an empty result set when there are no FAQs at all', async () => {
    const service = makeService(makeRepo([]));
    await service.onModuleInit();

    expect(await service.search('bất kỳ câu hỏi nào')).toEqual([]);
  });
});
