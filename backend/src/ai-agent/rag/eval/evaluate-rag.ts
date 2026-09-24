import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { DataSource } from 'typeorm';
import { GoogleGenerativeAI, TaskType } from '@google/generative-ai';
import { Faq } from '../../entities/faq.entity';
import { cosineSimilarity } from '../faq-embedding.service';
import { EVAL_SET, EvalItem } from './faq-eval-set';

const CACHE_FILE = path.join(__dirname, 'query-embeddings.cache.json');
const RESULT_FILE = path.join(__dirname, 'rag-eval-result.json');
const MODEL = process.env.GEMINI_EMBEDDING_MODEL ?? 'gemini-embedding-001';
// Quét ngưỡng 0.60 → 0.80, bước 0.01
const THRESHOLDS = Array.from(
  { length: 21 },
  (_, i) => +(0.6 + i * 0.01).toFixed(2),
);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ── 1. Embed câu hỏi thử (có cache + retry) ─────────────────────────────
async function embedQueries(queries: string[]): Promise<Map<string, number[]>> {
  const cache: Record<string, number[]> = fs.existsSync(CACHE_FILE)
    ? JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'))
    : {};
  const model = new GoogleGenerativeAI(
    process.env.GEMINI_API_KEY!,
  ).getGenerativeModel({ model: MODEL });

  for (const q of queries) {
    const key = `${MODEL}::${q}`; // đổi model thì cache cũ không bị dùng nhầm
    if (cache[key]) continue;
    for (let attempt = 1; ; attempt++) {
      try {
        const res = await model.embedContent({
          content: { role: 'user', parts: [{ text: q }] },
          taskType: TaskType.RETRIEVAL_QUERY,
        });
        cache[key] = res.embedding.values;
        fs.writeFileSync(CACHE_FILE, JSON.stringify(cache)); // lưu ngay, lỗi giữa chừng không mất
        break;
      } catch (err) {
        if (attempt >= 3) throw err;
        console.warn(`Lỗi embed "${q}" (lần ${attempt}), thử lại sau 30s...`);
        await sleep(30_000);
      }
    }
    await sleep(300);
  }
  return new Map(queries.map((q) => [q, cache[`${MODEL}::${q}`]]));
}

// ── 2. Xếp hạng FAQ cho từng câu hỏi ────────────────────────────────────
interface Ranked {
  item: EvalItem;
  split: 'dev' | 'test';
  top1: string;
  top1Score: number;
  rank: number | null;
}

function rankAll(faqs: Faq[], vectors: Map<string, number[]>): Ranked[] {
  return EVAL_SET.map((item, i) => {
    const qv = vectors.get(item.query)!;
    const ranked = faqs
      .map((f) => ({
        question: f.question,
        score: cosineSimilarity(qv, f.embedding!),
      }))
      .sort((a, b) => b.score - a.score);
    const idx = item.expected
      ? ranked.findIndex((r) => r.question === item.expected)
      : -1;
    return {
      item,
      split: i % 2 === 0 ? 'dev' : 'test',
      top1: ranked[0].question,
      top1Score: ranked[0].score,
      rank: idx >= 0 ? idx + 1 : null,
    };
  });
}

// ── 3. Chỉ số truy xuất (chỉ tính trên câu CÓ đáp án) ───────────────────
function retrievalMetrics(rows: Ranked[]) {
  const ans = rows.filter((r) => r.item.expected);
  const pct = (n: number) => +((n / ans.length) * 100).toFixed(1);
  return {
    n: ans.length,
    'Hit@1 (%)': pct(ans.filter((r) => r.rank === 1).length),
    'Hit@2 (%)': pct(ans.filter((r) => r.rank !== null && r.rank <= 2).length),
    MRR: +(ans.reduce((s, r) => s + 1 / r.rank!, 0) / ans.length).toFixed(3),
  };
}

// ── 4. Quét ngưỡng: quyết định "trả lời" hay "từ chối" có đúng không ─────
function sweep(rows: Ranked[]) {
  const ans = rows.filter((r) => r.item.expected);
  const unans = rows.filter((r) => !r.item.expected);
  return THRESHOLDS.map((t) => {
    const correctAnswer = ans.filter(
      (r) => r.top1Score >= t && r.rank === 1,
    ).length;
    const wrongAnswer = ans.filter(
      (r) => r.top1Score >= t && r.rank !== 1,
    ).length;
    const falseReject = ans.filter((r) => r.top1Score < t).length;
    const correctReject = unans.filter((r) => r.top1Score < t).length;
    const falseAccept = unans.length - correctReject;
    return {
      threshold: t,
      correctAnswer,
      wrongAnswer,
      falseReject,
      correctReject,
      falseAccept,
      'accuracy (%)': +(
        ((correctAnswer + correctReject) / rows.length) *
        100
      ).toFixed(1),
    };
  });
}

async function run() {
  const ds = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    entities: [Faq],
  });
  await ds.initialize();
  const faqs = await ds.getRepository(Faq).find({ where: { isActive: true } });
  await ds.destroy();

  // Kiểm tra dữ liệu đầu vào trước khi đo
  const questions = new Set(faqs.map((f) => f.question));
  const missing = EVAL_SET.filter(
    (e) => e.expected && !questions.has(e.expected),
  );
  if (missing.length)
    throw new Error(
      `expected không khớp FAQ nào:\n${missing.map((m) => ' - ' + m.expected).join('\n')}`,
    );
  if (faqs.some((f) => !f.embedding))
    throw new Error(
      'Có FAQ chưa embed — restart backend hoặc gọi /faqs/reindex trước.',
    );

  const vectors = await embedQueries(EVAL_SET.map((e) => e.query));
  const rows = rankAll(faqs, vectors);
  const dev = rows.filter((r) => r.split === 'dev');
  const test = rows.filter((r) => r.split === 'test');

  console.log('\n=== Chỉ số truy xuất ===');
  console.table({
    dev: retrievalMetrics(dev),
    test: retrievalMetrics(test),
    all: retrievalMetrics(rows),
  });

  // Chọn ngưỡng trên DEV, báo cáo trên TEST
  const devSweep = sweep(dev);
  const best = devSweep.reduce((a, b) =>
    b['accuracy (%)'] > a['accuracy (%)'] ? b : a,
  );
  console.log('\n=== Quét ngưỡng trên tập DEV ===');
  console.table(devSweep);
  const testAtBest = sweep(test).find((s) => s.threshold === best.threshold)!;
  console.log(
    `\nNgưỡng tốt nhất (dev): ${best.threshold} → accuracy trên TEST: ${testAtBest['accuracy (%)']}%`,
  );

  // Liệt kê câu sai để phân tích lỗi
  console.log('\n=== Câu truy xuất sai (top-1 ≠ expected) ===');
  console.table(
    rows
      .filter((r) => r.item.expected && r.rank !== 1)
      .map((r) => ({
        query: r.item.query,
        expected: r.item.expected,
        got: r.top1,
        rank: r.rank,
        score: +r.top1Score.toFixed(3),
      })),
  );

  fs.writeFileSync(
    RESULT_FILE,
    JSON.stringify(
      {
        model: MODEL,
        faqCount: faqs.length,
        evalCount: rows.length,
        retrieval: { dev: retrievalMetrics(dev), test: retrievalMetrics(test) },
        bestThreshold: best.threshold,
        devSweep,
        testAtBest,
      },
      null,
      2,
    ),
  );
  console.log(`\nĐã lưu kết quả: ${RESULT_FILE}`);
}

run().catch((err) => {
  console.error('Đánh giá thất bại:', err);
  process.exit(1);
});
