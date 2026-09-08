import { PlusCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import formatCurrency from '../../utils/formatCurrency';

// items: booking.serviceItems (mỗi item có service.name, quantity, unitPrice).
export default function BookingServiceItemsTable({ items = [] }) {
  const { t, i18n } = useTranslation();

  return (
    <div>
      <h4 className="mb-3 flex items-center gap-1 text-xs font-bold uppercase tracking-widest text-gray-400">
        <PlusCircle size={12} /> {t('booking.history.detail.extraServices')}
      </h4>
      {items.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-gray-100 shadow-sm">
          <table className="w-full border-collapse bg-white text-left">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-[10px] font-bold uppercase text-gray-400">
                <th className="px-4 py-2">{t('booking.history.detail.service')}</th>
                <th className="px-4 py-2 text-center">{t('booking.history.detail.quantity')}</th>
                <th className="px-4 py-2 text-right">{t('booking.history.detail.unitPrice')}</th>
                <th className="px-4 py-2 text-right">{t('booking.history.detail.subtotal')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 text-xs">
              {items.map((item) => (
                <tr key={item.bookingServiceId}>
                  <td className="px-4 py-3 font-medium text-gray-700">{item.service?.name}</td>
                  <td className="px-4 py-3 text-center text-gray-600">{item.quantity}</td>
                  <td className="px-4 py-3 text-right text-gray-500">{formatCurrency(item.unitPrice, i18n.language)}</td>
                  <td className="px-4 py-3 text-right font-bold text-gray-800">
                    {formatCurrency(item.unitPrice * item.quantity, i18n.language)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 py-6 text-center">
          <p className="text-sm text-gray-400">{t('booking.history.detail.noServices')}</p>
        </div>
      )}
    </div>
  );
}
