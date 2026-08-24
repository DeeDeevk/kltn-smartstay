import React, { useState } from 'react';
import { X, Star, Loader2, Send } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useCreateReviewMutation } from '../../services/review';
import { toast } from 'react-toastify';

const ReviewModal = ({ isOpen, onClose, bookingId, roomType, roomTypeId }) => {
  const { t } = useTranslation();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [hover, setHover] = useState(0);

  const [createReview, { isLoading }] = useCreateReviewMutation();

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await createReview({
        booking_id: bookingId,
        room_type_id: roomTypeId,
        rating,
        comment
      }).unwrap();

      toast.success(t('room.reviews.submitSuccess'));
      onClose();
    } catch (err) {
      toast.error(err.data?.message || t('room.reviews.submitError'));
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/50 ">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">

        {/* Header */}
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">{t('room.reviews.writeReview')}</h2>
            <p className="text-xs text-gray-500 mt-1">{t('room.reviews.reviewSubtitle', { roomName: roomType?.name })}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Star Rating */}
          <div className="flex flex-col items-center justify-center py-4 bg-blue-50/50 rounded-xl space-y-3">
            <span className="text-sm font-semibold text-blue-600 uppercase tracking-wider">{t('room.reviews.satisfaction')}</span>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  className="transition-transform active:scale-90"
                  onMouseEnter={() => setHover(star)}
                  onMouseLeave={() => setHover(0)}
                  onClick={() => setRating(star)}
                >
                  <Star
                    size={40}
                    className={`transition-colors duration-200 ${(hover || rating) >= star
                        ? 'fill-yellow-400 text-yellow-400'
                        : 'text-gray-300 fill-gray-100'
                      }`}
                  />
                </button>
              ))}
            </div>
            <span className="text-lg font-bold text-gray-700">
              {rating === 5 ? t('room.reviews.ratingExcellent') :
                rating === 4 ? t('room.reviews.ratingGood') :
                  rating === 3 ? t('room.reviews.ratingAverage') :
                    rating === 2 ? t('room.reviews.ratingPoor') : t('room.reviews.ratingBad')}
            </span>
          </div>

          {/* Comment Area */}
          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-700 ml-1">{t('room.reviews.commentLabel')}</label>
            <textarea
              required
              rows={4}
              className="w-full p-4 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none text-gray-700"
              placeholder={t('room.reviews.commentPlaceholder')}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          </div>

          {/* Footer Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 px-4 rounded-xl border border-gray-200 text-gray-600 font-bold hover:bg-gray-50 transition-colors"
            >
              {t('room.reviews.cancel')}
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 py-3 px-4 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-200 disabled:opacity-50"
            >
              {isLoading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <>
                  <Send size={18} />
                  {t('room.reviews.submit')}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ReviewModal;
