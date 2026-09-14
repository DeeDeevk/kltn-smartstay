import type { ConfigService } from '@nestjs/config';
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
      getGenerativeModel: () => ({
        embedContent: (request: {
          content: { parts: Array<{ text: string }> };
        }) =>
          Promise.resolve({
            embedding: { values: fakeEmbed(request.content.parts[0].text) },
          }),
      }),
    })),
  };
});
/* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return */

function makeConfig(): ConfigService {
  return {
    get: (key: string) => (key === 'GEMINI_API_KEY' ? 'fake-key' : undefined),
  } as unknown as ConfigService;
}

describe('FaqEmbeddingService', () => {
  let service: FaqEmbeddingService;

  beforeEach(async () => {
    service = new FaqEmbeddingService(makeConfig());
    await service.onModuleInit();
  });

  it('matches a question about an existing FAQ topic to the cancellation entry with high similarity', async () => {
    const results = await service.search('huỷ phòng có mất phí không', 1);

    expect(results).toHaveLength(1);
    expect(results[0].entry.id).toBe('cancellation-before-checkin');
    expect(results[0].similarity).toBeGreaterThan(LOW_CONFIDENCE_THRESHOLD);
    expect(results[0].lowConfidence).toBe(false);
  });

  it('matches a late-checkout question to the late-checkout-fee entry, not the cancellation one', async () => {
    const results = await service.search(
      'trả phòng trễ có bị tính phí không',
      1,
    );

    expect(results[0].entry.id).toBe('late-checkout-fee');
    expect(results[0].similarity).toBeGreaterThan(LOW_CONFIDENCE_THRESHOLD);
  });

  it('flags a completely unrelated question as low confidence instead of returning a confident wrong match', async () => {
    const results = await service.search('khách sạn có nuôi mèo không', 1);

    expect(results).toHaveLength(1);
    expect(results[0].similarity).toBeLessThan(LOW_CONFIDENCE_THRESHOLD);
    expect(results[0].lowConfidence).toBe(true);
  });

  it('returns an empty result set when the index failed to build (e.g. embedding API was unreachable at boot)', async () => {
    const brokenService = new FaqEmbeddingService({
      get: () => 'fake-key',
    } as unknown as ConfigService);
    // Force an empty index without calling onModuleInit, simulating a boot-time
    // embedding failure that was caught and logged rather than crashing the app.
    const results = await brokenService.search('bất kỳ câu hỏi nào');

    expect(results).toEqual([]);
  });
});
