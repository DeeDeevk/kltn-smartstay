// src/features/search/components/RoomCard.jsx
import { Star, User, Sparkles, Heart } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import formatCurrency from '../../utils/formatCurrency';

const CAPACITY_LABEL_KEYS = {
  1: 'search.roomCard.single',
  2: 'search.roomCard.double',
  3: 'search.roomCard.triple',
};

export default function RoomCard({ room, startDate, endDate }) {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  const capacityLabel = (capacity) => t(CAPACITY_LABEL_KEYS[capacity] ?? 'search.roomCard.family');

  const handleBookNow = () => {
    const roomId = room.roomTypeId || room.id;
    let url = `/rooms/${roomId}`;

    if (startDate && endDate) {
      const checkInStr = startDate.toISOString().split('T')[0];
      const checkOutStr = endDate.toISOString().split('T')[0];
      url += `?checkIn=${checkInStr}&checkOut=${checkOutStr}`;
    }

    navigate(url);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-lg transition-shadow duration-300 flex flex-col h-full group">
      {/* ... image section ... */}
      <div className="relative h-48 overflow-hidden">
        <img
          src={room.images && room.images.length > 0 ? room.images[0].url : 'https://images.unsplash.com/photo-1566073771259-6a8506099945?q=80&w=2070&auto=format&fit=crop'}
          alt={room.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        {/* Badge Giảm giá / Nổi bật */}
        {room.discount && (
          <span className="absolute top-3 left-3 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded">
            {t('search.roomCard.discount', { percent: room.discount })}
          </span>
        )}
        {room.tag && (
          <span className="absolute top-3 left-3 bg-green-500 text-white text-xs font-bold px-2 py-1 rounded">
            {room.tag}
          </span>
        )}
      </div>

      {/* --- CONTENT SECTION --- */}
      <div className="p-4 flex flex-col flex-1">
        {/* Loại phòng & Rating */}
        <div className="flex justify-between items-center mb-2">
          <div className="flex gap-2">
            <span className="bg-blue-50 text-blue-600 text-xs font-semibold px-2 py-1 rounded">
              {capacityLabel(room.capacity_people)}
            </span>
            {/* {room.roomClass && (
              <span className="bg-amber-50 text-amber-600 text-xs font-semibold px-2 py-1 rounded border border-amber-100 uppercase tracking-wider">
                {room.roomClass.name}
              </span>
            )} */}
          </div>
          {/* <div className="flex items-center gap-1 text-orange-500 text-sm font-bold">
            <Star size={14} fill="currentColor" />
            <span>{Number(room.average_rating).toFixed(1)}</span>
            <span className="text-gray-400 font-normal">({room.review_count})</span>
          </div> */}
        </div>

        {/* Tên phòng */}
        <h3 className="text-lg font-bold text-gray-900 mb-2 line-clamp-2">
          {room.name}
        </h3>

        {/* Thông số kỹ thuật */}
        <div className="flex flex-wrap gap-3 text-sm text-gray-500 mb-4">
          <div className="flex items-center gap-1">
            <User size={14} /> {room.capacity_people} {t('search.roomCard.guests')}
          </div>
          {room.amenities?.length > 0 && (
            <div className="flex items-center gap-1">
              <Sparkles size={14} /> {room.amenities.length} {t('search.roomCard.amenitiesCount')}
            </div>
          )}
        </div>
        {room.availableCount > 0 ? (
          <p className="text-blue-600 font-semibold text-sm mb-1">
            {room.availableCount} {t('search.roomCard.roomsLeft')}
          </p>
        ) : room.availableCount === 0 ? (
          <p className="text-red-500 font-semibold text-sm mb-1">{t('search.roomCard.soldOut')}</p>
        ) : null}
        {/* Giá & Button (Đẩy xuống đáy) */}
        <div className="mt-auto flex items-end justify-between">
          <div>
            {room.oldPrice && (
              <p className="text-xs text-gray-400 line-through mb-0.5">
                {formatCurrency(room.oldPrice, i18n.language)}
              </p>
            )}
            <p className="text-xl font-bold text-gray-900">
              {formatCurrency(room.basePrice || room.base_price, i18n.language)}
            </p>

            <p className="text-xs text-gray-500">{t('search.roomCard.perNight')}</p>
          </div>
          <button
            onClick={handleBookNow}
            disabled={room.availableCount === 0}
            className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded-lg transition-colors text-sm"
          >
            {t('search.roomCard.bookNow')}
          </button>
        </div>
      </div>
    </div>
  );
}
