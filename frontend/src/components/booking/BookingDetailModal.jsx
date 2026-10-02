import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Copy, Download, QrCode, X } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import getBookingCode from '../../utils/bookingCode';
import getBookingQrPayload from '../../utils/bookingQrPayload';
import downloadQrPng from '../../utils/downloadQr';
import BookingRoomSummary from './BookingRoomSummary';
import BookingGuestInfoCard from './BookingGuestInfoCard';
import BookingServiceItemsTable from './BookingServiceItemsTable';
import BookingPriceSummary from './BookingPriceSummary';

// Chỉ lo khung modal (backdrop/header/scroll) và ráp các khối nội dung lại — mỗi khối là
// 1 component riêng, nhận props hẹp, test được độc lập mà không cần dựng cả modal này.
//
// Render qua createPortal thẳng ra document.body — giống component Modal dùng chung ở
// common/ — để "fixed inset-0" không bao giờ bị một ancestor có backdrop-filter/transform
// (vd. Header có backdrop-blur) co vùng hiển thị lại.
export default function BookingDetailModal({ booking, onClose }) {
  const { t } = useTranslation();
  const qrRef = useRef(null);

  // Đóng bằng phím Esc + khoá scroll nền trong lúc modal mở, dọn dẹp khi đóng/unmount
  // để không rò rỉ listener hay để body kẹt lại overflow:hidden.
  useEffect(() => {
    if (!booking) return undefined;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [booking, onClose]);

  if (!booking) return null;

  const bookingCode = getBookingCode(booking.bookingId);
  const qrValue = getBookingQrPayload(booking);

  const handleSaveQr = () =>
    downloadQrPng(qrRef.current?.querySelector('svg'), `vika-qr-${bookingCode}.png`);

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(bookingCode);
      toast.success(t('booking.history.detail.codeCopied'));
    } catch {
      /* Clipboard API bị chặn (trình duyệt cũ, không phải HTTPS...) -> bỏ qua, không chặn UI */
    }
  };

  return createPortal(
    // Không đóng khi bấm ra ngoài (backdrop) — thống nhất với component Modal dùng
    // chung, tránh lỡ tay đóng mất. Chỉ đóng qua nút X / nút Đóng / phím Esc.
    <div
      className="modal-backdrop-in fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="booking-detail-title"
    >
      <div className="modal-panel-in flex w-full max-w-2xl max-h-[90vh] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 bg-white p-6">
          <div>
            <h2 id="booking-detail-title" className="text-xl font-bold text-gray-900">
              {t('booking.history.detail.title')}
            </h2>
            <button
              type="button"
              onClick={handleCopyCode}
              className="mt-1 inline-flex items-center gap-1.5 text-xs text-gray-500 transition-colors hover:text-blue-600"
              title={t('booking.history.detail.copyCode')}
            >
              {t('booking.history.detail.bookingCode')}:{' '}
              <span className="font-mono font-bold text-blue-600">{bookingCode}</span>
              <Copy size={12} />
            </button>
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

          <div className="flex w-full flex-col items-center gap-3 rounded-xl border border-dashed border-gray-200 bg-gray-50/60 p-5">
            <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-gray-400">
              <QrCode size={14} /> {t('booking.history.detail.qrHint')}
            </p>
            <div ref={qrRef} className="rounded-xl border border-gray-100 bg-white p-3 shadow-sm">
              <QRCodeSVG value={qrValue} size={180} level="M" />
            </div>
            <button
              type="button"
              onClick={handleSaveQr}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
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
    </div>,
    document.body,
  );
}
