import { useMemo, useState } from 'react';
import { Loader2, Search, Send, Sparkles, TriangleAlert } from 'lucide-react';
import { toast } from 'react-toastify';
import StarRating from '../../common/StarRating';
import ReviewReplyModal from './ReviewReplyModal';
import {
  useAnalyzeAllReviewsMutation,
  useGetAllReviewsQuery,
} from '../../../services/review';

// 'this' so sánh được với tháng trước; 'all' thì không có kỳ nào để đối chiếu nên ẩn
// cột xu hướng đi.
const PERIODS = [
  { value: 'this', label: 'Tháng này' },
  { value: 'prev', label: 'Tháng trước' },
  { value: 'all', label: 'Tất cả' },
];

function monthKey(date, offset = 0) {
  const d = new Date(date);
  d.setDate(1);
  d.setMonth(d.getMonth() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// Đếm số lượt bị chê theo chủ đề. Chỉ tính aspect NEGATIVE — bảng này để biết phải
// sửa cái gì, lời khen không thuộc về đây.
function countComplaints(list) {
  const counter = new Map();
  for (const review of list) {
    for (const aspect of review.aiAnalysis?.aspects ?? []) {
      if (aspect.sentiment !== 'NEGATIVE') continue;
      counter.set(aspect.topic, (counter.get(aspect.topic) ?? 0) + 1);
    }
  }
  return counter;
}

// Nhãn tiếng Việt cho các mã chủ đề AI trả về (enum ReviewTopic ở backend).
const TOPIC_LABELS = {
  CLEANLINESS: 'Vệ sinh',
  ROOM_CONDITION: 'Cơ sở vật chất',
  NOISE: 'Tiếng ồn',
  STAFF: 'Nhân viên',
  CHECKIN: 'Nhận/trả phòng',
  BREAKFAST: 'Ăn uống',
  AMENITIES: 'Tiện nghi',
  LOCATION: 'Vị trí',
  VALUE: 'Giá cả',
  WIFI: 'Wifi',
  OTHER: 'Khác',
};

// Ngưỡng phân loại theo thang nửa sao (0.5 - 5). Giữ ở một chỗ duy nhất để thẻ thống
// kê, bộ lọc và nhãn trên từng đánh giá không bao giờ nói khác nhau.
//
// Có cả mức TRUNG LẬP chứ không chỉ tích cực/tiêu cực: 3 sao là "tạm được", gộp vào
// tiêu cực sẽ thổi phồng số lượng khách không hài lòng, gộp vào tích cực thì che mất
// nhóm khách đang lưng chừng — chính là nhóm dễ kéo lên hoặc mất nhất.
const SENTIMENTS = {
  POSITIVE: { label: 'Tích cực', className: 'bg-green-50 text-green-700', min: 4 },
  NEUTRAL: { label: 'Trung lập', className: 'bg-amber-50 text-amber-700', min: 3 },
  NEGATIVE: { label: 'Tiêu cực', className: 'bg-red-50 text-red-700', min: 0 },
};

function getSentiment(rating) {
  if (rating >= SENTIMENTS.POSITIVE.min) return 'POSITIVE';
  if (rating >= SENTIMENTS.NEUTRAL.min) return 'NEUTRAL';
  return 'NEGATIVE';
}

const FILTERS = [
  { value: 'all', label: 'Tất cả' },
  { value: 'POSITIVE', label: 'Tích cực (từ 4 sao)' },
  { value: 'NEUTRAL', label: 'Trung lập (3 – 3.5 sao)' },
  { value: 'NEGATIVE', label: 'Tiêu cực (dưới 3 sao)' },
  { value: 'NO_REPLY', label: 'Chưa phản hồi' },
];

function formatDate(value) {
  return new Date(value).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

// Bỏ dấu để tìm "phong sach" vẫn ra "phòng sạch".
function normalize(text) {
  return (text ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase();
}

function StatCard({ label, value, hint, tone = 'text-gray-900' }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${tone}`}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-gray-400">{hint}</p>}
    </div>
  );
}

function ReviewRow({ review, onReply }) {
  const sentiment = SENTIMENTS[getSentiment(review.rating)];
  const analysis = review.aiAnalysis;

  return (
    <li className="px-4 py-4">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-gray-900">{review.authorName}</span>
            <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${sentiment.className}`}>
              {sentiment.label}
            </span>
            <StarRating value={review.rating} size={14} />
            <span className="text-sm font-semibold text-gray-600">
              {Number(review.rating).toFixed(1)}
            </span>
          </div>

          <p className="mt-1 text-xs text-gray-400">
            {review.roomTypeName} · {formatDate(review.reviewDate)}
          </p>

          <p className="mt-2 text-sm leading-relaxed text-gray-700 wrap-anywhere">
            {review.comment}
          </p>

          {analysis?.aspects?.length > 0 && (
            // Chip khía cạnh do AI bóc tách. title = câu trích nguyên văn, để admin
            // đối chiếu ngay xem AI hiểu đúng chỗ nào trong đánh giá.
            <div className="mt-2 flex flex-wrap gap-1.5">
              {analysis.aspects.map((aspect, index) => (
                <span
                  key={`${aspect.topic}-${index}`}
                  title={`"${aspect.quote}"`}
                  className={`cursor-help rounded-md px-2 py-0.5 text-xs font-semibold ${
                    aspect.sentiment === 'NEGATIVE'
                      ? 'bg-red-50 text-red-700'
                      : 'bg-green-50 text-green-700'
                  }`}
                >
                  {TOPIC_LABELS[aspect.topic] ?? aspect.topic}
                </span>
              ))}
            </div>
          )}

          {analysis?.toneMismatch && (
            <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-amber-600">
              <TriangleAlert size={14} />
              Số sao và nội dung không khớp nhau — nên đọc kỹ
            </p>
          )}

          {review.reply && (
            <div className="mt-2 rounded-lg border-l-2 border-blue-200 bg-blue-50/60 px-3 py-2">
              <p className="text-[11px] font-bold uppercase tracking-tight text-blue-600">
                Phản hồi của khách sạn
              </p>
              <p className="mt-0.5 text-sm text-gray-600 wrap-anywhere">{review.reply}</p>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => onReply(review)}
          className="flex shrink-0 items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-600 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600"
        >
          <Send size={14} />
          {review.reply ? 'Sửa phản hồi' : 'Phản hồi'}
        </button>
      </div>
    </li>
  );
}

// Xem và phản hồi đánh giá của khách, phân loại theo số sao.
export default function ReviewManagementPage() {
  const { data: reviews = [], isFetching, error } = useGetAllReviewsQuery();
  const [analyzeAll, { isLoading: analyzingAll }] = useAnalyzeAllReviewsMutation();
  const [replyTarget, setReplyTarget] = useState(null);
  const [period, setPeriod] = useState('this');
  const [keyword, setKeyword] = useState('');
  const [filter, setFilter] = useState('all');

  const stats = useMemo(() => {
    const total = reviews.length;
    const sum = reviews.reduce((acc, r) => acc + Number(r.rating), 0);
    const count = (key) => reviews.filter((r) => getSentiment(r.rating) === key).length;
    return {
      total,
      average: total ? sum / total : 0,
      positive: count('POSITIVE'),
      neutral: count('NEUTRAL'),
      negative: count('NEGATIVE'),
      noReply: reviews.filter((r) => !r.reply).length,
    };
  }, [reviews]);

  const filtered = useMemo(() => {
    const needle = normalize(keyword.trim());
    return reviews.filter((review) => {
      if (filter === 'NO_REPLY' && review.reply) return false;
      if (filter !== 'all' && filter !== 'NO_REPLY' && getSentiment(review.rating) !== filter) {
        return false;
      }
      if (needle && !normalize(`${review.authorName} ${review.comment}`).includes(needle)) {
        return false;
      }
      return true;
    });
  }, [reviews, keyword, filter]);

  const percent = (value) => (stats.total ? Math.round((value / stats.total) * 100) : 0);

  // Đánh giá thuộc kỳ đang xem, và kỳ liền trước để so sánh.
  // KHÔNG gọi AI ở bước này — khía cạnh đã được bóc tách và lưu sẵn từ lúc khách gửi
  // đánh giá, ở đây chỉ đếm. Miễn phí, tức thì, cho cùng kết quả mỗi lần mở trang.
  const { periodReviews, previousReviews } = useMemo(() => {
    if (period === 'all') return { periodReviews: reviews, previousReviews: [] };
    const now = new Date();
    const current = monthKey(now, period === 'prev' ? -1 : 0);
    const previous = monthKey(now, period === 'prev' ? -2 : -1);
    const inMonth = (key) => reviews.filter((r) => monthKey(r.reviewDate) === key);
    return { periodReviews: inMonth(current), previousReviews: inMonth(previous) };
  }, [reviews, period]);

  const topComplaints = useMemo(() => {
    const current = countComplaints(periodReviews);
    const previous = countComplaints(previousReviews);
    return [...current.entries()]
      .map(([topic, count]) => ({
        topic,
        count,
        delta: period === 'all' ? null : count - (previous.get(topic) ?? 0),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [periodReviews, previousReviews, period]);

  // Chủ đề bị chê tách theo loại phòng — trả lời "phòng nào hỏng cái gì" thay vì chỉ
  // "khách sạn bị chê gì". Kèm điểm trung bình để thấy loại phòng nào đang kéo điểm xuống.
  const byRoomType = useMemo(() => {
    const groups = new Map();
    for (const review of periodReviews) {
      const name = review.roomTypeName ?? 'Không xác định';
      const entry = groups.get(name) ?? { name, ratings: [], topics: new Map() };
      entry.ratings.push(Number(review.rating));
      for (const aspect of review.aiAnalysis?.aspects ?? []) {
        if (aspect.sentiment !== 'NEGATIVE') continue;
        entry.topics.set(aspect.topic, (entry.topics.get(aspect.topic) ?? 0) + 1);
      }
      groups.set(name, entry);
    }
    return [...groups.values()]
      .map((entry) => ({
        name: entry.name,
        reviewCount: entry.ratings.length,
        average: entry.ratings.reduce((a, b) => a + b, 0) / entry.ratings.length,
        complaints: [...entry.topics.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3),
        totalComplaints: [...entry.topics.values()].reduce((a, b) => a + b, 0),
      }))
      .sort((a, b) => b.totalComplaints - a.totalComplaints || a.average - b.average);
  }, [periodReviews]);

  const maxComplaint = topComplaints[0]?.count ?? 0;
  const unanalyzed = reviews.filter((r) => !r.aiAnalysis).length;

  const handleAnalyzeAll = async () => {
    try {
      const result = await analyzeAll().unwrap();
      toast.success(
        result.remaining > 0
          ? `Đã phân tích ${result.analyzed} đánh giá, còn ${result.remaining} — bấm tiếp để chạy nốt`
          : `Đã phân tích xong ${result.analyzed} đánh giá`,
      );
      if (result.failed > 0) {
        toast.warning(`${result.failed} đánh giá phân tích lỗi, thử lại sau ít phút`);
      }
    } catch (err) {
      toast.error(err?.data?.message || 'Không chạy được phân tích hàng loạt');
    }
  };

  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Đánh giá của khách</h1>
          <p className="mt-1 text-sm text-gray-500">
            Phân loại theo số sao khách chấm sau khi trả phòng
          </p>
        </div>
        {unanalyzed > 0 && (
          <button
            type="button"
            onClick={handleAnalyzeAll}
            disabled={analyzingAll}
            className="flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-violet-700 disabled:opacity-70"
          >
            {analyzingAll ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Sparkles size={16} />
            )}
            Phân tích tất cả ({unanalyzed})
          </button>
        )}
      </div>

      {/* Chọn kỳ áp dụng cho CẢ hai bảng phân tích bên dưới — hai bảng nói về cùng một
          khoảng thời gian thì mới đối chiếu với nhau được. */}
      <div className="mb-5 inline-flex rounded-lg border border-gray-200 bg-white p-1">
        {PERIODS.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => setPeriod(item.value)}
            className={`rounded-md px-3 py-1.5 text-sm font-semibold transition-colors ${
              period === item.value
                ? 'bg-blue-600 text-white'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Điểm trung bình"
          value={stats.average.toFixed(1)}
          hint={`${stats.total} đánh giá`}
        />
        <StatCard
          label="Tích cực"
          value={stats.positive}
          hint={`${percent(stats.positive)}% tổng số`}
          tone="text-green-600"
        />
        <StatCard
          label="Trung lập"
          value={stats.neutral}
          hint={`${percent(stats.neutral)}% tổng số`}
          tone="text-amber-600"
        />
        <StatCard
          label="Tiêu cực"
          value={stats.negative}
          hint={`${percent(stats.negative)}% tổng số · ${stats.noReply} chưa phản hồi`}
          tone="text-red-600"
        />
      </div>

      {topComplaints.length > 0 && (
        <div className="mb-5 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-bold text-gray-900">Chủ đề bị chê nhiều nhất</h2>
            {unanalyzed > 0 && (
              <span className="text-xs text-gray-400">
                {unanalyzed} đánh giá chưa phân tích, chưa được tính vào đây
              </span>
            )}
          </div>
          <div className="space-y-2">
            {topComplaints.map(({ topic, count, delta }) => (
              <div key={topic} className="flex items-center gap-3">
                <span className="w-32 shrink-0 text-sm text-gray-600">
                  {TOPIC_LABELS[topic] ?? topic}
                </span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full bg-red-400"
                    style={{ width: `${(count / maxComplaint) * 100}%` }}
                  />
                </div>
                <span className="w-14 shrink-0 text-right text-sm font-semibold text-gray-700">
                  {count} lượt
                </span>
                {/* Tăng so với kỳ trước là tín hiệu xấu -> đỏ; giảm là tốt -> xanh. */}
                <span className="w-20 shrink-0 text-right text-xs font-semibold">
                  {delta === null ? (
                    <span className="text-gray-300">—</span>
                  ) : delta > 0 ? (
                    <span className="text-red-600">↑ {delta} vs kỳ trước</span>
                  ) : delta < 0 ? (
                    <span className="text-green-600">↓ {Math.abs(delta)} vs kỳ trước</span>
                  ) : (
                    <span className="text-gray-400">→ không đổi</span>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {byRoomType.length > 0 && (
        <div className="mb-5 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 px-5 py-4">
            <h2 className="font-bold text-gray-900">Theo loại phòng</h2>
            <p className="mt-0.5 text-xs text-gray-500">
              Xếp theo số lượt bị chê, loại phòng cần xử lý trước nằm trên cùng
            </p>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wider text-gray-400">
              <tr>
                <th className="px-5 py-3 text-left font-semibold">Loại phòng</th>
                <th className="px-5 py-3 text-left font-semibold">Điểm TB</th>
                <th className="px-5 py-3 text-left font-semibold">Bị chê nhiều nhất</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {byRoomType.map((row) => (
                <tr key={row.name}>
                  <td className="px-5 py-3">
                    <p className="font-semibold text-gray-900">{row.name}</p>
                    <p className="text-xs text-gray-400">{row.reviewCount} đánh giá</p>
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`font-bold ${
                        row.average >= 4
                          ? 'text-green-600'
                          : row.average >= 3
                            ? 'text-amber-600'
                            : 'text-red-600'
                      }`}
                    >
                      {row.average.toFixed(1)}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    {row.complaints.length === 0 ? (
                      <span className="text-xs text-gray-400">Không có lời chê nào</span>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {row.complaints.map(([topic, count]) => (
                          <span
                            key={topic}
                            className="rounded-md bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700"
                          >
                            {TOPIC_LABELS[topic] ?? topic} · {count}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative min-w-60 flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="Tìm theo tên khách hoặc nội dung..."
            className="w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-9 pr-3 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {FILTERS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
      </div>

      {isFetching && reviews.length === 0 && (
        <div className="flex justify-center py-16 text-gray-400">
          <Loader2 className="animate-spin" size={28} />
        </div>
      )}

      {!isFetching && error && (
        <div className="rounded-xl border border-red-100 bg-red-50 p-6 text-center text-sm text-red-600">
          {error?.data?.message || 'Không thể tải danh sách đánh giá'}
        </div>
      )}

      {!error && !(isFetching && reviews.length === 0) && filtered.length === 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center text-gray-400">
          {reviews.length === 0
            ? 'Chưa có đánh giá nào. Khách chỉ đánh giá được sau khi đã trả phòng.'
            : 'Không có đánh giá nào khớp bộ lọc.'}
        </div>
      )}

      {filtered.length > 0 && (
        <ul className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          {filtered.map((review) => (
            <ReviewRow key={review.reviewId} review={review} onReply={setReplyTarget} />
          ))}
        </ul>
      )}

      <ReviewReplyModal
        review={replyTarget}
        open={Boolean(replyTarget)}
        onClose={() => setReplyTarget(null)}
      />
    </>
  );
}
