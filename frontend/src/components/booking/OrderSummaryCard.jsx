import { useTranslation } from 'react-i18next';
import formatCurrencyUtil from '../../utils/formatCurrency';
import { VAT_RATE, calculateVat } from '../../utils/vat';

const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1566073771259-6a8506099945?q=80&w=800&auto=format&fit=crop';

export default function OrderSummaryCard({ room, startDate, endDate, nights, totalPrice, vatAmount = 0, discountAmount = 0 }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'en' ? 'en-US' : 'vi-VN';
  const roomSubtotal = totalPrice - vatAmount;
  const pricePerNight = roomSubtotal / nights;

  // VAT phải tính lại TRÊN tiền phòng đã trừ khuyến mãi, không phải giữ nguyên VAT cũ —
  // khớp với công thức `netRoomAmount * VAT_RATE` ở backend, nếu không tổng tiền hiện
  // cho khách sẽ lệch với số tiền thật của đơn.
  const netRoomSubtotal = Math.max(roomSubtotal - discountAmount, 0);
  const effectiveVat = discountAmount > 0 ? calculateVat(netRoomSubtotal) : vatAmount;
  const grandTotal = netRoomSubtotal + effectiveVat;

  const formatCurrency = (amount) => formatCurrencyUtil(amount, i18n.language);

  const formatDate = (date) =>
    new Date(date).toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' });

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-5">
      <h2 className="font-bold text-lg text-gray-900">{t('checkout.summary.title')}</h2>

      <div className="flex gap-4">
        <img
          src={room.images?.[0]?.url || FALLBACK_IMAGE}
          alt={room.name}
          className="w-20 h-20 rounded-lg object-cover shrink-0"
        />
        <div className="min-w-0">
          <p className="font-semibold text-gray-900 truncate">{room.name}</p>
          <p className="text-sm text-gray-500 mt-1">{t('checkout.summary.nights', { count: nights })}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm border-y border-gray-100 py-4">
        <div>
          <p className="text-gray-400 text-xs uppercase font-bold mb-1">{t('checkout.summary.checkIn')}</p>
          <p className="font-semibold text-gray-800">{formatDate(startDate)}</p>
        </div>
        <div>
          <p className="text-gray-400 text-xs uppercase font-bold mb-1">{t('checkout.summary.checkOut')}</p>
          <p className="font-semibold text-gray-800">{formatDate(endDate)}</p>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-sm text-gray-600">
          <span>{t('checkout.summary.priceNights', { price: formatCurrency(pricePerNight), nights })}</span>
          <span>{formatCurrency(roomSubtotal)}</span>
        </div>
        {discountAmount > 0 && (
          <div className="flex justify-between text-sm font-semibold text-green-600">
            <span>{t('checkout.summary.discount')}</span>
            <span>-{formatCurrency(discountAmount)}</span>
          </div>
        )}
        <div className="flex justify-between text-sm text-gray-500">
          <span>{t('checkout.summary.vat', { rate: VAT_RATE * 100 })}</span>
          <span>{formatCurrency(effectiveVat)}</span>
        </div>
        <div className="flex justify-between items-center pt-3 border-t border-gray-100">
          <span className="font-bold text-gray-900">{t('checkout.summary.total')}</span>
          <span className="font-bold text-blue-600 text-lg">{formatCurrency(grandTotal)}</span>
        </div>
      </div>
    </div>
  );
}
