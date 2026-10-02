import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import Modal from '../common/Modal';
import StarRating from '../common/StarRating';
import { useCreateReviewMutation } from '../../services/review';

// Khớp với CreateReviewDto ở backend (@Length(5, 1000)).
const COMMENT_MIN = 5;
const COMMENT_MAX = 1000;

const RATING_LABEL_KEYS = {
  5: 'room.reviews.ratingExcellent',
  4: 'room.reviews.ratingGood',
  3: 'room.reviews.ratingAverage',
  2: 'room.reviews.ratingPoor',
  1: 'room.reviews.ratingBad',
};

export default function ReviewModal({ isOpen, onClose, bookingId, roomType }) {
  const { t } = useTranslation();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [createReview, { isLoading }] = useCreateReviewMutation();

  // Modal được mount sẵn ở trang cha, đóng lại không tự xoá state — không reset thì
  // lần đánh giá đơn tiếp theo sẽ thấy nguyên nội dung vừa gõ cho đơn trước.
  useEffect(() => {
    if (!isOpen) return;
    setRating(5);
    setComment('');
  }, [isOpen, bookingId]);

  const handleSubmit = async () => {
    const trimmed = comment.trim();
    if (trimmed.length < COMMENT_MIN) {
      toast.error(t('room.reviews.commentTooShort', { count: COMMENT_MIN }));
      return;
    }
    try {
      // Chỉ gửi bookingId — backend tự suy ra loại phòng từ đơn, và cũng tự kiểm tra
      // đơn có đúng của người đang đăng nhập và đã trả phòng hay chưa.
      await createReview({ bookingId, rating, comment: trimmed }).unwrap();
      toast.success(t('room.reviews.submitSuccess'));
      onClose();
    } catch (err) {
      toast.error(err?.data?.message || t('room.reviews.submitError'));
    }
  };

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title={t('room.reviews.writeReview')}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="rounded-xl px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 disabled:opacity-70"
          >
            {t('room.reviews.cancel')}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isLoading}
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-70"
          >
            {isLoading ? t('room.reviews.submitting') : t('room.reviews.submit')}
          </button>
        </>
      }
    >
      <div className="space-y-5 text-sm">
        <p className="text-gray-500">
          {t('room.reviews.reviewSubtitle', { roomName: roomType?.name })}
        </p>

        <div>
          <label className="mb-1.5 block font-semibold text-gray-700">
            {t('room.reviews.satisfaction')}
          </label>
          <div className="flex items-center gap-3">
            <StarRating value={rating} onChange={setRating} />
            {/* Hiện luôn con số bên cạnh: nửa sao rất khó ước lượng bằng mắt, nhất là
                khi phân vân giữa 3.5 và 4. */}
            <span className="text-sm text-gray-500">
              {rating.toFixed(1)} — {t(RATING_LABEL_KEYS[Math.ceil(rating)])}
            </span>
          </div>
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label className="block font-semibold text-gray-700">
              {t('room.reviews.commentLabel')}
            </label>
            <span className="text-xs text-gray-400">
              {comment.length}/{COMMENT_MAX}
            </span>
          </div>
          <textarea
            rows={5}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={COMMENT_MAX}
            placeholder={t('room.reviews.commentPlaceholder')}
            className="w-full resize-y rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>
    </Modal>
  );
}
