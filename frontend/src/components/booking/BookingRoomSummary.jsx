import { Calendar } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import formatDate from '../../utils/formatDate';
import { BOOKING_STATUS_STYLES, PAYMENT_STATUS_STYLES } from '../../utils/bookingStatusStyles';
import StatusPill from './StatusPill';

const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1566073771259-6a8506099945?q=80&w=800&auto=format&fit=crop';

// Khối tóm tắt phòng: ảnh, tên, 2 badge trạng thái, ngày nhận/trả, lý do hủy (nếu có).
export default function BookingRoomSummary({ booking }) {
  const { t, i18n } = useTranslation();
  const roomImage = booking.roomType?.images?.[0] || FALLBACK_IMAGE;

  return (
    <div className="flex flex-col gap-6 md:flex-row">
      <div className="aspect-video w-full shrink-0 overflow-hidden rounded-xl bg-gray-100 shadow-inner md:aspect-square md:w-1/3">
        <img src={roomImage} alt={booking.roomType?.name} className="h-full w-full object-cover" />
      </div>
      <div className="flex-1 space-y-4">
        <div>
          <h3 className="text-lg font-bold text-gray-900">{booking.roomType?.name}</h3>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusPill
              value={booking.status}
              styles={BOOKING_STATUS_STYLES}
              label={t(`booking.status.${booking.status}`, booking.status)}
            />
            <StatusPill
              value={booking.paymentStatus}
              styles={PAYMENT_STATUS_STYLES}
              label={t(`booking.payment.${booking.paymentStatus}`, booking.paymentStatus)}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 pt-2">
          <div className="space-y-1">
            <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">
              <Calendar size={10} /> {t('booking.history.detail.checkIn')}
            </p>
            <p className="text-sm font-semibold text-gray-700">{formatDate(booking.checkInDate, i18n.language)}</p>
          </div>
          <div className="space-y-1">
            <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">
              <Calendar size={10} /> {t('booking.history.detail.checkOut')}
            </p>
            <p className="text-sm font-semibold text-gray-700">{formatDate(booking.checkOutDate, i18n.language)}</p>
          </div>
        </div>

        {booking.cancelReason && (
          <div className="rounded-lg border border-red-100 bg-red-50 px-3 py-2">
            <p className="text-[11px] font-bold uppercase tracking-wide text-red-500">
              {t('booking.history.detail.cancelReason')}
            </p>
            <p className="mt-0.5 text-xs text-red-600">{booking.cancelReason}</p>
          </div>
        )}
      </div>
    </div>
  );
}
