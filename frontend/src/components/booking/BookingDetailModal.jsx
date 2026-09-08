import { useRef } from 'react';
import { Download, X } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useTranslation } from 'react-i18next';
import getBookingCode from '../../utils/bookingCode';
import getBookingQrPayload from '../../utils/bookingQrPayload';
import downloadQrPng from '../../utils/downloadQr';
import BookingRoomSummary from './BookingRoomSummary';
import BookingGuestInfoCard from './BookingGuestInfoCard';
import BookingServiceItemsTable from './BookingServiceItemsTable';
import BookingPriceSummary from './BookingPriceSummary';

// Chỉ lo khung modal (backdrop/header/scroll) và ráp các khối nội dung lại — mỗi khối là
// 1 component riêng, nhận props hẹp, test được độc lập mà không cần dựng cả modal này.
export default function BookingDetailModal({ booking, onClose }) {
  const { t } = useTranslation();
  const qrRef = useRef(null);
  if (!booking) return null;

  const bookingCode = getBookingCode(booking.bookingId);
  const qrValue = getBookingQrPayload(booking);
  const handleSaveQr = () =>
    downloadQrPng(qrRef.current?.querySelector('svg'), `vika-qr-${bookingCode}.png`);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="flex w-full max-w-2xl max-h-[90vh] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
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

        <div className="space-y-8 overflow-y-auto p-6">
          <BookingRoomSummary booking={booking} />
          <BookingGuestInfoCard guestInfo={booking.guestInfo} />
          <BookingServiceItemsTable items={booking.serviceItems} />

          <div className="flex w-full flex-col items-center gap-3">
            <div ref={qrRef} className="rounded-xl border border-gray-100 bg-white p-3">
              <QRCodeSVG value={qrValue} size={180} level="M" />
            </div>
            <button
              type="button"
              onClick={handleSaveQr}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
            >
              <Download size={16} /> {t('checkout.success.saveQr')}
            </button>
          </div>
        </div>

        <div className="mt-auto border-t border-gray-100 bg-gray-50 p-6">
          <BookingPriceSummary
            roomAmount={booking.roomAmount}
            discountAmount={booking.discountAmount}
            serviceAmount={booking.serviceAmount}
            vatAmount={booking.vatAmount}
            totalAmount={booking.totalAmount}
          />
        </div>
      </div>
    </div>
  );
}
