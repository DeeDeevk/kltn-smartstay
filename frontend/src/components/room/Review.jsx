import StarIcon from "../../assets/icon/star.png";
import { useTranslation } from "react-i18next";

export default function Review({ authorName, rating, comment, reviewDate, reply }) {
  const { t, i18n } = useTranslation();
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString(i18n.language === 'en' ? 'en-US' : 'vi-VN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const username = authorName || t('room.reviews.defaultGuestName');
  const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=random`;

  return (
    <div className="flex flex-col gap-4 p-5 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
      {/* Header: User Info & Rating */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-blue-50">
            <img src={avatarUrl} alt={username} className="w-full h-full object-cover" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-bold text-gray-900">{username}</span>
            <span className="text-[11px] text-gray-400 font-medium uppercase tracking-tight">
              {formatDate(reviewDate)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 bg-yellow-50 px-2.5 py-1 rounded-lg border border-yellow-100">
          <span className="text-sm font-bold text-yellow-700">{Number(rating).toFixed(1)}</span>
          <img src={StarIcon} alt="rating" className="w-4 h-4" />
        </div>
      </div>

      {/* Comment Body */}
      <div className="text-sm text-gray-600 leading-relaxed italic">
        {comment}
      </div>

      {/* Phản hồi của khách sạn — chỉ hiện khi admin đã trả lời */}
      {reply && (
        <div className="rounded-xl border-l-2 border-blue-200 bg-blue-50/60 px-4 py-3">
          <p className="text-[11px] font-bold uppercase tracking-tight text-blue-600">
            {t('room.reviews.hotelReply')}
          </p>
          <p className="mt-1 text-sm leading-relaxed text-gray-600">{reply}</p>
        </div>
      )}
    </div>
  );
}
