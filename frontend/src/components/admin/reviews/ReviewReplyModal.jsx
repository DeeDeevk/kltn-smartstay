import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'react-toastify';
import Modal from '../../common/Modal';
import StarRating from '../../common/StarRating';
import { useReplyReviewMutation } from '../../../services/review';

// Khớp với ReplyReviewDto ở backend (@Length(1, 1000)).
const REPLY_MAX = 1000;

export default function ReviewReplyModal({ review, open, onClose }) {
  const [reply, setReply] = useState('');
  const [replyReview, { isLoading }] = useReplyReviewMutation();

  // Modal luôn được mount ở trang cha nên state không tự mất khi đóng — không reset
  // thì mở phản hồi đánh giá khác sẽ thấy nguyên nội dung của lần trước.
  useEffect(() => {
    if (!open) return;
    setReply(review?.reply ?? '');
  }, [open, review?.reviewId, review?.reply]);

  const handleSubmit = async () => {
    const trimmed = reply.trim();
    if (!trimmed) {
      toast.error('Vui lòng nhập nội dung phản hồi');
      return;
    }
    try {
      await replyReview({ reviewId: review.reviewId, reply: trimmed }).unwrap();
      toast.success('Đã gửi phản hồi');
      onClose();
    } catch (err) {
      toast.error(err?.data?.message || 'Không thể gửi phản hồi');
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Phản hồi đánh giá"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="rounded-xl px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 disabled:opacity-70"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isLoading}
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-70"
          >
            {isLoading && <Loader2 size={16} className="animate-spin" />}
            Gửi phản hồi
          </button>
        </>
      }
    >
      <div className="space-y-4 text-sm">
        {/* Hiện lại nguyên văn đánh giá ngay trên ô soạn: phản hồi mà không nhìn thấy
            khách viết gì thì rất dễ trả lời lạc đề. */}
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-gray-900">{review?.authorName}</span>
            <StarRating value={review?.rating ?? 0} size={14} />
            <span className="text-xs text-gray-500">{review?.roomTypeName}</span>
          </div>
          <p className="mt-2 leading-relaxed text-gray-600 wrap-anywhere">{review?.comment}</p>
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label className="block font-semibold text-gray-700">Nội dung phản hồi</label>
            <span className="text-xs text-gray-400">
              {reply.length}/{REPLY_MAX}
            </span>
          </div>
          <textarea
            rows={5}
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            maxLength={REPLY_MAX}
            placeholder="Cảm ơn anh/chị đã góp ý..."
            className="w-full resize-y rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
            autoFocus
          />
          <p className="mt-1.5 text-xs text-gray-400">
            Phản hồi hiển thị công khai dưới đánh giá ở trang chi tiết phòng.
          </p>
        </div>
      </div>
    </Modal>
  );
}
