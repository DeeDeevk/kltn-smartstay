import { useState } from 'react';
import { CalendarDays, CreditCard, Loader2, Users } from 'lucide-react';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';
import Header from '../layout/Header';
import Footer from '../layout/Footer';
import ConfirmModal from '../common/ConfirmModal';
import {
  useCancelBookingMutation,
  useGetMyBookingsQuery,
} from '../../services/booking';
import { useCreatePayOSLinkMutation } from '../../services/payment';
import formatCurrencyUtil from '../../utils/formatCurrency';

const STATUS_STYLES = {
  PENDING: 'bg-amber-50 text-amber-600',
  CONFIRMED: 'bg-blue-50 text-blue-600',
  CHECKED_IN: 'bg-emerald-50 text-emerald-600',
  CHECKED_OUT: 'bg-gray-100 text-gray-600',
  CANCELLED: 'bg-red-50 text-red-600',
};

export default function BookingHistoryPage() {
  const { t, i18n } = useTranslation();
  const { data, isFetching, error } = useGetMyBookingsQuery();
  const [cancelBooking, { isLoading: isCancelling }] = useCancelBookingMutation();
  const [createPayOSLink, { isLoading: isRedirecting }] = useCreatePayOSLinkMutation();
  const [payingId, setPayingId] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);

  const bookings = data?.data ?? [];

  const formatCurrency = (amount) => formatCurrencyUtil(amount, i18n.language);

  const formatDate = (value) => new Date(value).toLocaleDateString(i18n.language === 'en' ? 'en-US' : 'vi-VN');

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
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16">
        <h1 className="text-2xl font-bold text-gray-900 mb-8">{t('booking.history.title')}</h1>

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
          <div className="rounded-xl border border-gray-200 bg-white p-12 text-center text-gray-400">
            {t('booking.history.empty')}
          </div>
        )}

        {!isFetching && !error && bookings.length > 0 && (
          <div className="space-y-4">
            {bookings.map((booking) => {
              const canPayNow =
                booking.paymentMethod === 'PAYOS' &&
                booking.paymentStatus === 'UNPAID' &&
                booking.status === 'PENDING';
              const canCancel = booking.status === 'PENDING' || booking.status === 'CONFIRMED';

              return (
                <div
                  key={booking.bookingId}
                  className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-bold text-gray-900">{booking.roomType?.name}</p>
                      <p className="mt-1 flex items-center gap-1.5 text-sm text-gray-500">
                        <CalendarDays size={14} /> {formatDate(booking.checkInDate)} — {formatDate(booking.checkOutDate)}
                      </p>
                      <p className="mt-1 flex items-center gap-1.5 text-sm text-gray-500">
                        <Users size={14} /> {booking.guestInfo?.fullName}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className={`inline-flex items-center rounded-full text-xs font-semibold px-2.5 py-1 ${STATUS_STYLES[booking.status] || 'bg-gray-100 text-gray-600'}`}>
                        {t(`booking.status.${booking.status}`, booking.status)}
                      </span>
                      <span className="flex items-center gap-1 text-xs font-medium text-gray-400">
                        <CreditCard size={12} />
                        {booking.paymentMethod === 'PAYOS' ? t('booking.payment.payos') : t('booking.payment.cash')} · {t(`booking.payment.${booking.paymentStatus}`, booking.paymentStatus)}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-4">
                    <span className="text-lg font-bold text-blue-600">{formatCurrency(booking.totalAmount)}</span>
                    <div className="flex gap-2">
                      {canPayNow && (
                        <button
                          type="button"
                          onClick={() => handlePayNow(booking.bookingId)}
                          disabled={isRedirecting && payingId === booking.bookingId}
                          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-blue-700 disabled:opacity-70"
                        >
                          {isRedirecting && payingId === booking.bookingId ? t('booking.history.redirecting') : t('booking.history.payNow')}
                        </button>
                      )}
                      {canCancel && (
                        <button
                          type="button"
                          onClick={() => setCancelTarget(booking)}
                          className="rounded-lg bg-red-50 px-4 py-2 text-sm font-semibold text-red-600 transition-colors hover:bg-red-100"
                        >
                          {t('booking.history.cancel')}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
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
    </div>
  );
}
