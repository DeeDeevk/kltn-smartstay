import { Receipt } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import formatCurrency from '../../utils/formatCurrency';
import { VAT_RATE } from '../../utils/vat';

// Breakdown giá dạng hoá đơn — chỉ nhận số, không phụ thuộc shape booking, nên tái dùng
// được cho mọi màn cần hiển thị breakdown (hoá đơn check-out, xem lại đơn ở admin...).
export default function BookingPriceSummary({ roomAmount, discountAmount = 0, serviceAmount = 0, vatAmount = 0, totalAmount }) {
  const { t, i18n } = useTranslation();

  return (
    <div>
      <div className="space-y-1.5 text-sm">
        <div className="flex justify-between text-gray-500">
          <span>{t('booking.history.detail.roomAmount')}</span>
          <span>{formatCurrency(roomAmount, i18n.language)}</span>
        </div>
        {discountAmount > 0 && (
          <div className="flex justify-between text-emerald-600">
            <span>{t('booking.history.detail.discount')}</span>
            <span>-{formatCurrency(discountAmount, i18n.language)}</span>
          </div>
        )}
        {serviceAmount > 0 && (
          <div className="flex justify-between text-gray-500">
            <span>{t('booking.history.detail.serviceAmount')}</span>
            <span>{formatCurrency(serviceAmount, i18n.language)}</span>
          </div>
        )}
        {vatAmount > 0 && (
          <div className="flex justify-between text-gray-500">
            <span>{t('booking.history.detail.vat', { rate: VAT_RATE * 100 })}</span>
            <span>{formatCurrency(vatAmount, i18n.language)}</span>
          </div>
        )}
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-gray-200 pt-3">
        <div className="flex items-center gap-2 text-gray-400">
          <Receipt size={18} />
          <span className="text-sm font-medium">{t('booking.history.detail.total')}</span>
        </div>
        <div className="text-right">
          <p className="text-2xl font-black text-blue-600">{formatCurrency(totalAmount, i18n.language)}</p>
          <p className="mt-1 text-[10px] italic text-gray-500">{t('booking.history.detail.vatNote')}</p>
        </div>
      </div>
    </div>
  );
}
