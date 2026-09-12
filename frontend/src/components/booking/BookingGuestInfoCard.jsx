import { User as UserIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

// Nhận đúng { fullName, phone, email } thay vì cả object booking — hẹp props để dễ test
// và dùng lại được ở bất kỳ đâu cần hiển thị thông tin khách (không phụ thuộc shape booking).
export default function BookingGuestInfoCard({ guestInfo }) {
  const { t } = useTranslation();

  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
      <h4 className="mb-3 flex items-center gap-1 text-xs font-bold uppercase tracking-widest text-gray-400">
        <UserIcon size={12} /> {t('booking.history.detail.guestInfo')}
      </h4>
      <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
        <div>
          <p className="text-[11px] text-gray-500">{t('booking.history.detail.guestName')}</p>
          <p className="text-sm font-bold text-gray-800">{guestInfo?.fullName}</p>
        </div>
        <div>
          <p className="text-[11px] text-gray-500">{t('booking.history.detail.guestPhone')}</p>
          <p className="text-sm font-bold text-gray-800">{guestInfo?.phone}</p>
        </div>
        {guestInfo?.email && (
          <div className="sm:col-span-2">
            <p className="text-[11px] text-gray-500">{t('booking.history.detail.guestEmail')}</p>
            <p className="text-sm font-bold text-gray-800">{guestInfo.email}</p>
          </div>
        )}
      </div>
    </div>
  );
}
