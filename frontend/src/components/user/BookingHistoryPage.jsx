import { useState } from 'react';
import { CalendarDays, CreditCard, Loader2, Users } from 'lucide-react';
import { toast } from 'react-toastify';
import Header from '../layout/Header';
import Footer from '../layout/Footer';
import ConfirmModal from '../common/ConfirmModal';
import {
  useCancelBookingMutation,
  useGetMyBookingsQuery,
} from '../../services/booking';
import { useCreatePayOSLinkMutation } from '../../services/payment';

const formatCurrency = (amount) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount).replace('₫', 'đ');

const formatDate = (value) => new Date(value).toLocaleDateString('vi-VN');

const STATUS_STYLES = {
  PENDING: 'bg-amber-50 text-amber-600',
  CONFIRMED: 'bg-blue-50 text-blue-600',
  CHECKED_IN: 'bg-emerald-50 text-emerald-600',
  CHECKED_OUT: 'bg-gray-100 text-gray-600',
  CANCELLED: 'bg-red-50 text-red-600',
};

const STATUS_LABELS = {
  PENDING: 'Chờ xác nhận',
  CONFIRMED: 'Đã xác nhận',
  CHECKED_IN: 'Đang lưu trú',
  CHECKED_OUT: 'Đã trả phòng',
  CANCELLED: 'Đã hủy',
};

const PAYMENT_LABELS = {
  UNPAID: 'Chưa thanh toán',
  PAID: 'Đã thanh toán',
};

export default function BookingHistoryPage() {
  const { data, isFetching, error } = useGetMyBookingsQuery();
  const [cancelBooking, { isLoading: isCancelling }] = useCancelBookingMutation();
  const [createPayOSLink, { isLoading: isRedirecting }] = useCreatePayOSLinkMutation();
  const [payingId, setPayingId] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);

  const bookings = data?.data ?? [];

  const handlePayNow = async (bookingId) => {
    setPayingId(bookingId);
    try {
      const { checkoutUrl } = await createPayOSLink(bookingId).unwrap();
      window.location.href = checkoutUrl;
    } catch (err) {
      toast.error(err?.data?.message || 'Không thể tạo liên kết thanh toán');
      setPayingId(null);
    }
  };

  const handleConfirmCancel = async () => {
    if (!cancelTarget) return;
    try {
      await cancelBooking({
        bookingId: cancelTarget.bookingId,
        reason: 'Khách yêu cầu hủy đặt phòng',
      }).unwrap();
      toast.success('Đã hủy đơn đặt phòng');
      setCancelTarget(null);
    } catch (err) {
      toast.error(err?.data?.message || 'Không thể hủy đơn đặt phòng');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16">
        <h1 className="text-2xl font-bold text-gray-900 mb-8">Lịch sử đặt phòng</h1>

        {isFetching && (
          <div className="flex justify-center py-16 text-gray-400">
            <Loader2 className="animate-spin" size={28} />
          </div>
        )}

        {!isFetching && error && (
          <div className="rounded-xl border border-red-100 bg-red-50 p-6 text-center text-sm text-red-600">
            {error?.data?.message || 'Không thể tải lịch sử đặt phòng'}
          </div>
        )}

        {!isFetching && !error && bookings.length === 0 && (
          <div className="rounded-xl border border-gray-200 bg-white p-12 text-center text-gray-400">
            Bạn chưa có đơn đặt phòng nào.
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
                        {STATUS_LABELS[booking.status] || booking.status}
                      </span>
                      <span className="flex items-center gap-1 text-xs font-medium text-gray-400">
                        <CreditCard size={12} />
                        {booking.paymentMethod === 'PAYOS' ? 'PayOS' : 'Tiền mặt'} · {PAYMENT_LABELS[booking.paymentStatus] || booking.paymentStatus}
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
                          {isRedirecting && payingId === booking.bookingId ? 'Đang chuyển...' : 'Thanh toán ngay'}
                        </button>
                      )}
                      {canCancel && (
                        <button
                          type="button"
                          onClick={() => setCancelTarget(booking)}
                          className="rounded-lg bg-red-50 px-4 py-2 text-sm font-semibold text-red-600 transition-colors hover:bg-red-100"
                        >
                          Hủy đơn
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
        title="Hủy đơn đặt phòng"
        message={`Bạn có chắc muốn hủy đơn đặt phòng "${cancelTarget?.roomType?.name}"?`}
        confirmLabel="Hủy đơn"
        danger
        loading={isCancelling}
        onConfirm={handleConfirmCancel}
        onClose={() => setCancelTarget(null)}
      />
    </div>
  );
}
