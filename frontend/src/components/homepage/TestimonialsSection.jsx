import { useTranslation } from 'react-i18next';
import { Quote } from 'lucide-react';
import StarRating from '../common/StarRating';
import { useGetFeaturedReviewsQuery } from '../../services/review';

const AVATAR_STYLES = [
  'bg-blue-50 text-blue-600',
  'bg-amber-50 text-amber-600',
  'bg-rose-50 text-rose-600',
];

// "Nguyễn Hồ Việt Khoa" -> "NK". Chỉ lấy chữ cái đầu của từ đầu và từ cuối để ô avatar
// không bị tràn với tên tiếng Việt (thường 3-4 từ).
function getInitials(name) {
  const words = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0][0].toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

export default function TestimonialsSection() {
  const { t } = useTranslation();
  const { data: reviews = [], isLoading } = useGetFeaturedReviewsQuery(3);

  // Chưa có đánh giá thật nào thì ẩn hẳn cả khu này. Thà không hiện còn hơn hiện
  // khung rỗng hoặc lời khen bịa — đây là phần khách đọc để quyết định có đặt hay không.
  if (isLoading || reviews.length === 0) return null;

  return (
    <section className="py-20 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <span className="inline-block text-xs font-bold uppercase tracking-widest text-blue-600 mb-3">
            {t('home.testimonials.eyebrow')}
          </span>
          <h2 className="font-display text-3xl font-semibold text-gray-900 mb-3">{t('home.testimonials.title')}</h2>
          <p className="text-gray-500">{t('home.testimonials.subtitle')}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {reviews.map((review, index) => (
            <div
              key={review.reviewId}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm p-7 flex flex-col"
            >
              <Quote size={28} className="text-blue-100 mb-3" fill="currentColor" />

              <div className="mb-4">
                <StarRating value={review.rating} size={15} />
              </div>

              <p className="text-gray-600 text-sm leading-relaxed italic flex-1">
                "{review.comment}"
              </p>

              <div className="flex items-center gap-3 mt-6 pt-6 border-t border-gray-100">
                <div
                  className={`w-11 h-11 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${AVATAR_STYLES[index % AVATAR_STYLES.length]}`}
                >
                  {getInitials(review.authorName)}
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-gray-900 text-sm truncate">{review.authorName}</p>
                  <p className="text-gray-400 text-xs truncate">{review.roomTypeName}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
