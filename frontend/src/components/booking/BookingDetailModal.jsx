import { X, Calendar, User as UserIcon, Receipt, PlusCircle } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useTranslation } from 'react-i18next';
import formatCurrency from '../../utils/formatCurrency';
import { VAT_RATE } from '../../utils/vat';
import { BOOKING_STATUS_STYLES, PAYMENT_STATUS_STYLES } from '../../utils/bookingStatusStyles';

const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1566073771259-6a8506099945?q=80&w=800&auto=format&fit=crop';

export function StatusPill({ value, styles, label }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ring-inset whitespace-nowrap ${
        styles[value] || 'bg-gray-100 text-gray-600 ring-gray-200'
      }`}
    >
      {label}
    </span>
  );
}

export default function BookingDetailModal({ booking, onClose }) {
  const { t, i18n } = useTranslation();
  if (!booking) return null;

  const dateLocale = i18n.language === 'en' ? 'en-US' : 'vi-VN';
  const formatDate = (value) => new Date(value).toLocaleDateString(dateLocale, { day: '2-digit', month: '2-digit', year: 'numeric' });
  const bookingCode = booking.bookingId.slice(0, 8).toUpperCase();
  const roomImage = booking.roomType?.images?.[0] || FALLBACK_IMAGE;
  const serviceItems = booking.serviceItems || [];

  const qrValue = [
    'VIKA HOTEL - BOOKING TICKET',
    `Ma: ${bookingCode}`,
    `Khach: ${booking.guestInfo?.fullName ?? ''}`,
    `Phong: ${booking.roomType?.name ?? ''}`,
    `Thoi gian: ${formatDate(booking.checkInDate)} -> ${formatDate(booking.checkOutDate)}`,
    `Tong tien: ${formatCurrency(booking.totalAmount, i18n.language)}`,
  ].join('\n')

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="flex w-full max-w-2xl max-h-[90vh] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-white p-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900">{t('booking.history.detail.title')}</h2>
            <p className="mt-1 text-xs text-gray-500">
              {t('booking.history.detail.bookingCode')}:{' '}
              <span className="font-mono font-bold text-blue-600">{bookingCode}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
            aria-label={t('common.close')}
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-8 overflow-y-auto p-6">
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
                  <p className="text-sm font-semibold text-gray-700">{formatDate(booking.checkInDate)}</p>
                </div>
                <div className="space-y-1">
                  <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    <Calendar size={10} /> {t('booking.history.detail.checkOut')}
                  </p>
                  <p className="text-sm font-semibold text-gray-700">{formatDate(booking.checkOutDate)}</p>
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

          {/* Guest Info */}
          <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
            <h4 className="mb-3 flex items-center gap-1 text-xs font-bold uppercase tracking-widest text-gray-400">
              <UserIcon size={12} /> {t('booking.history.detail.guestInfo')}
            </h4>
            <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
              <div>
                <p className="text-[11px] text-gray-500">{t('booking.history.detail.guestName')}</p>
                <p className="text-sm font-bold text-gray-800">{booking.guestInfo?.fullName}</p>
              </div>
              <div>
                <p className="text-[11px] text-gray-500">{t('booking.history.detail.guestPhone')}</p>
                <p className="text-sm font-bold text-gray-800">{booking.guestInfo?.phone}</p>
              </div>
              {booking.guestInfo?.email && (
                <div className="sm:col-span-2">
                  <p className="text-[11px] text-gray-500">{t('booking.history.detail.guestEmail')}</p>
                  <p className="text-sm font-bold text-gray-800">{booking.guestInfo.email}</p>
                </div>
              )}
            </div>
          </div>

          {/* Extra services */}
          <div>
            <h4 className="mb-3 flex items-center gap-1 text-xs font-bold uppercase tracking-widest text-gray-400">
              <PlusCircle size={12} /> {t('booking.history.detail.extraServices')}
            </h4>
            {serviceItems.length > 0 ? (
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
                    {serviceItems.map((item) => (
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

          <div className="flex w-full justify-center">
            <QRCodeSVG value={qrValue} size={180} level="M" />
          </div>
        </div>

        {/* Footer */}
        <div className="mt-auto border-t border-gray-100 bg-gray-50 p-6">
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between text-gray-500">
              <span>{t('booking.history.detail.roomAmount')}</span>
              <span>{formatCurrency(booking.roomAmount, i18n.language)}</span>
            </div>
            {booking.discountAmount > 0 && (
              <div className="flex justify-between text-emerald-600">
                <span>{t('booking.history.detail.discount')}</span>
                <span>-{formatCurrency(booking.discountAmount, i18n.language)}</span>
              </div>
            )}
            {booking.serviceAmount > 0 && (
              <div className="flex justify-between text-gray-500">
                <span>{t('booking.history.detail.serviceAmount')}</span>
                <span>{formatCurrency(booking.serviceAmount, i18n.language)}</span>
              </div>
            )}
            {booking.vatAmount > 0 && (
              <div className="flex justify-between text-gray-500">
                <span>{t('booking.history.detail.vat', { rate: VAT_RATE * 100 })}</span>
                <span>{formatCurrency(booking.vatAmount, i18n.language)}</span>
              </div>
            )}
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-gray-200 pt-3">
            <div className="flex items-center gap-2 text-gray-400">
              <Receipt size={18} />
              <span className="text-sm font-medium">{t('booking.history.detail.total')}</span>
            </div>
            <div className="text-right">
              <p className="text-2xl font-black text-blue-600">{formatCurrency(booking.totalAmount, i18n.language)}</p>
              <p className="mt-1 text-[10px] italic text-gray-500">{t('booking.history.detail.vatNote')}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
