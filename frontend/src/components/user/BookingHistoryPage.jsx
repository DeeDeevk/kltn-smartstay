import { useState } from 'react';
import { CalendarDays, CreditCard, ImageOff, Loader2 } from 'lucide-react';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';
import Header from '../layout/Header';
import Footer from '../layout/Footer';
import ConfirmModal from '../common/ConfirmModal';
import BookingDetailModal from '../booking/BookingDetailModal';
import StatusPill from '../booking/StatusPill';
import { BOOKING_STATUS_STYLES, PAYMENT_STATUS_STYLES } from '../../utils/bookingStatusStyles';
import {
  useCancelBookingMutation,
  useGetMyBookingsQuery,
} from '../../services/booking';
import { useCreatePayOSLinkMutation } from '../../services/payment';
import formatCurrency from '../../utils/formatCurrency';
import formatDate from '../../utils/formatDate';
import getBookingCode from '../../utils/bookingCode';

function BookingActions({ booking, canPayNow, canCancel, isPaying, onPayNow, onCancel, onViewDetail, t }) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {canPayNow && (
        <button
          type="button"
          onClick={() => onPayNow(booking.bookingId)}
          disabled={isPaying}
          className="rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-bold text-white transition-colors hover:bg-blue-700 disabled:opacity-70"
        >
          {isPaying ? t('booking.history.redirecting') : t('booking.history.payNow')}
        </button>
      )}
      {canCancel && (
        <button
          type="button"
          onClick={() => onCancel(booking)}
          className="rounded-lg bg-red-50 px-3.5 py-2 text-xs font-semibold text-red-600 transition-colors hover:bg-red-100"
        >
          {t('booking.history.cancel')}
        </button>
      )}
      <button
        type="button"
        onClick={() => onViewDetail(booking)}
        className="rounded-lg border border-gray-200 px-3.5 py-2 text-xs font-semibold text-gray-600 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600"
      >
        {t('booking.history.viewDetail')}
      </button>
    </div>
  );
}

export default function BookingHistoryPage() {
  const { t, i18n } = useTranslation();
  const { data, isFetching, error } = useGetMyBookingsQuery();
  const [cancelBooking, { isLoading: isCancelling }] = useCancelBookingMutation();
  const [createPayOSLink, { isLoading: isRedirecting }] = useCreatePayOSLinkMutation();
  const [payingId, setPayingId] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [detailBooking, setDetailBooking] = useState(null);

  const bookings = data?.data ?? [];

  const handlePayNow = async (bookingId) => {
    setPayingId(bookingId);
    try {
      const { checkoutUrl } = await createPayOSLink(bookingId).unwrap();
      window.location.href = checkoutUrl;
    } catch (err) {
      toast.error(err?.data?.message || t('booking.history.linkError'));
      setPayingId(null);
    }
  };

  const handleConfirmCancel = async () => {
    if (!cancelTarget) return;
    try {
      await cancelBooking({
        bookingId: cancelTarget.bookingId,
        reason: t('booking.history.cancelReason'),
      }).unwrap();
      toast.success(t('booking.history.cancelSuccess'));
      setCancelTarget(null);
    } catch (err) {
      toast.error(err?.data?.message || t('booking.history.cancelError'));
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">{t('booking.history.title')}</h1>
          <p className="mt-1 text-sm text-gray-500">
            {bookings.length > 0 && `${bookings.length} ${i18n.language === 'en' ? 'bookings' : 'đơn đặt phòng'}`}
          </p>
        </div>

        {isFetching && (
          <div className="flex justify-center py-16 text-gray-400">
            <Loader2 className="animate-spin" size={28} />
          </div>
        )}

        {!isFetching && error && (
          <div className="rounded-xl border border-red-100 bg-red-50 p-6 text-center text-sm text-red-600">
            {error?.data?.message || t('booking.history.loadError')}
          </div>
        )}

        {!isFetching && !error && bookings.length === 0 && (
          <div className="rounded-2xl border border-gray-200 bg-white p-16 text-center text-gray-400">
            {t('booking.history.empty')}
          </div>
        )}

        {!isFetching && !error && bookings.length > 0 && (
          <>
            {/* Desktop: bảng chuyên nghiệp */}
            <div className="hidden overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm md:block">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[860px] border-collapse text-left">
                  <thead>
                    <tr className="whitespace-nowrap border-b border-gray-100 bg-gray-50/80 text-[11px] font-bold uppercase tracking-wide text-gray-400">
                      <th className="px-6 py-4">{t('booking.history.table.room')}</th>
                      <th className="px-4 py-4">{t('booking.history.table.code')}</th>
                      <th className="px-4 py-4">{t('booking.history.table.dates')}</th>
                      <th className="px-4 py-4 text-right">{t('booking.history.table.total')}</th>
                      <th className="px-4 py-4">{t('booking.history.table.payment')}</th>
                      <th className="px-4 py-4">{t('booking.history.table.status')}</th>
                      <th className="px-6 py-4 text-right">{t('booking.history.table.actions')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {bookings.map((booking) => {
                      const canPayNow =
                        booking.paymentMethod === 'PAYOS' &&
                        booking.paymentStatus === 'UNPAID' &&
                        booking.status === 'PENDING';
                      const canCancel = booking.status === 'PENDING' || booking.status === 'CONFIRMED';
                      const isPaying = isRedirecting && payingId === booking.bookingId;

                      return (
                        <tr key={booking.bookingId} className="transition-colors hover:bg-gray-50/60">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-gray-100">
                                {booking.roomType?.images?.[0] ? (
                                  <img
                                    src={booking.roomType.images[0]}
                                    alt={booking.roomType?.name}
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center text-gray-300">
                                    <ImageOff size={18} />
                                  </div>
                                )}
                              </div>
                              <span className="font-semibold text-gray-900">{booking.roomType?.name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <span className="font-mono text-xs font-bold text-blue-600">
                              {getBookingCode(booking.bookingId)}
                            </span>
                          </td>
                          <td className="px-4 py-4">
                            <span className="flex items-center gap-1.5 text-sm text-gray-600">
                              <CalendarDays size={14} className="text-gray-400" />
                              {formatDate(booking.checkInDate, i18n.language)} – {formatDate(booking.checkOutDate, i18n.language)}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-right">
                            <span className="text-base font-bold tabular-nums text-blue-600">
                              {formatCurrency(booking.totalAmount, i18n.language)}
                            </span>
                          </td>
                          <td className="px-4 py-4">
                            <StatusPill
                              value={booking.paymentStatus}
                              styles={PAYMENT_STATUS_STYLES}
                              label={t(`booking.payment.${booking.paymentStatus}`, booking.paymentStatus)}
                            />
                          </td>
                          <td className="px-4 py-4">
                            <StatusPill
                              value={booking.status}
                              styles={BOOKING_STATUS_STYLES}
                              label={t(`booking.status.${booking.status}`, booking.status)}
                            />
                          </td>
                          <td className="px-6 py-4">
                            <BookingActions
                              booking={booking}
                              canPayNow={canPayNow}
                              canCancel={canCancel}
                              isPaying={isPaying}
                              onPayNow={handlePayNow}
                              onCancel={setCancelTarget}
                              onViewDetail={setDetailBooking}
                              t={t}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile: card */}
            <div className="space-y-4 md:hidden">
              {bookings.map((booking) => {
                const canPayNow =
                  booking.paymentMethod === 'PAYOS' &&
                  booking.paymentStatus === 'UNPAID' &&
                  booking.status === 'PENDING';
                const canCancel = booking.status === 'PENDING' || booking.status === 'CONFIRMED';
                const isPaying = isRedirecting && payingId === booking.bookingId;

                return (
                  <div key={booking.bookingId} className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                    <div className="flex gap-3 p-4">
                      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-gray-100">
                        {booking.roomType?.images?.[0] ? (
                          <img
                            src={booking.roomType.images[0]}
                            alt={booking.roomType?.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-gray-300">
                            <ImageOff size={18} />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-bold text-gray-900">{booking.roomType?.name}</p>
                        <p className="mt-0.5 font-mono text-[11px] font-bold text-blue-600">
                          {getBookingCode(booking.bookingId)}
                        </p>
                        <p className="mt-1 flex items-center gap-1.5 text-xs text-gray-500">
                          <CalendarDays size={12} /> {formatDate(booking.checkInDate, i18n.language)} – {formatDate(booking.checkOutDate, i18n.language)}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
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
                    </div>
                    <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3">
                      <span className="flex items-center gap-1 text-[11px] font-medium text-gray-400">
                        <CreditCard size={12} />
                        {booking.paymentMethod === 'PAYOS' ? t('booking.payment.payos') : t('booking.payment.cash')}
                      </span>
                      <span className="text-base font-bold tabular-nums text-blue-600">{formatCurrency(booking.totalAmount, i18n.language)}</span>
                    </div>
                    <div className="border-t border-gray-100 px-4 py-3">
                      <BookingActions
                        booking={booking}
                        canPayNow={canPayNow}
                        canCancel={canCancel}
                        isPaying={isPaying}
                        onPayNow={handlePayNow}
                        onCancel={setCancelTarget}
                        onViewDetail={setDetailBooking}
                        t={t}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </main>
      <Footer />

      <ConfirmModal
        open={Boolean(cancelTarget)}
        title={t('booking.history.cancelTitle')}
        message={t('booking.history.cancelMessage', { roomName: cancelTarget?.roomType?.name })}
        confirmLabel={t('booking.history.cancel')}
        danger
        loading={isCancelling}
        onConfirm={handleConfirmCancel}
        onClose={() => setCancelTarget(null)}
      />

      {detailBooking && (
        <BookingDetailModal booking={detailBooking} onClose={() => setDetailBooking(null)} />
      )}
    </div>
  );
}
