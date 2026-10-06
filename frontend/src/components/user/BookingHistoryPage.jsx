import { useEffect, useMemo, useState } from 'react';
import { useDispatch } from 'react-redux';
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Clock,
  CreditCard,
  ImageOff,
  Loader2,
  MessageCircle,
} from 'lucide-react';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';
import Header from '../layout/Header';
import Footer from '../layout/Footer';
import ConfirmModal from '../common/ConfirmModal';
import BookingDetailModal from '../booking/BookingDetailModal';
import ReviewModal from '../room/ReviewModal';
import StatusPill from '../booking/StatusPill';
import { BOOKING_STATUS_STYLES, PAYMENT_STATUS_STYLES } from '../../utils/bookingStatusStyles';
import {
  bookingApi,
  useCancelBookingMutation,
  useGetCancellationPreviewQuery,
  useGetMyBookingsQuery,
} from '../../services/booking';
import { useSocket } from '../../context/SocketContext';
import { useCreatePayOSLinkMutation } from '../../services/payment';
import { useGetMyReviewsQuery } from '../../services/review';
import { useGetMyRefundRequestsQuery } from '../../services/refundRequest';
import formatCurrency from '../../utils/formatCurrency';
import formatDate from '../../utils/formatDate';
import getBookingCode from '../../utils/bookingCode';
import openReceptionChat from '../../utils/openReceptionChat';

// Icon + màu riêng cho từng trạng thái RefundRequest — KHÔNG dùng pill badge như
// booking.status/paymentStatus (StatusPill) để tránh xếp chồng 3 pill nhìn rối; đây là 1
// dòng phụ nhỏ (12-13px) nằm ngay dưới, canh lề trái với badge trạng thái đơn.
// PENDING_OVERDUE là trạng thái "ảo" (không có thật ở backend) — chỉ để chọn style khác
// cho đúng cùng 1 refund.status='PENDING' khi đã quá SLA xử lý (KAN-122).
const REFUND_STATUS_CONFIG = {
  PENDING: { icon: Clock, className: 'text-amber-600', labelKey: 'booking.history.refundPending' },
  PENDING_OVERDUE: {
    icon: AlertTriangle,
    className: 'text-red-600',
    labelKey: 'booking.history.refundOverdue',
  },
  COMPLETED: {
    icon: CheckCircle2,
    className: 'text-green-600',
    labelKey: 'booking.history.refundCompleted',
  },
  REJECTED: {
    icon: AlertTriangle,
    className: 'text-red-600',
    labelKey: 'booking.history.refundRejected',
  },
};

// Còn PENDING nhưng đã quá refundProcessingSlaHours (HotelConfig, KAN-122) kể từ lúc tạo ->
// coi là quá hạn, khách cần được nhắc chủ động liên hệ thay vì chờ im lặng. Tính lại mỗi lần
// render (không polling) — F5/mở lại trang là đủ cập nhật đúng, không cần real-time.
function isRefundOverdue(refund) {
  if (!refund || refund.status !== 'PENDING') return false;
  const slaHours = refund.refundProcessingSlaHours ?? 24;
  const hoursSincePending = (Date.now() - new Date(refund.createdAt).getTime()) / (60 * 60 * 1000);
  return hoursSincePending >= slaHours;
}

// Dòng phụ hiển thị trạng thái hoàn tiền cho 1 đơn đã huỷ đã thanh toán — tạo TỰ ĐỘNG khi
// huỷ đơn (KAN-114), khách không cần tự "yêu cầu" hoàn tiền. Không có RefundRequest nào
// (đơn huỷ nhưng chưa từng thanh toán) thì không hiện gì — refund ở đây luôn undefined/null
// trong trường hợp đó.
function RefundStatus({ refund, t }) {
  if (!refund) return null;
  const configKey = refund.status === 'PENDING' && isRefundOverdue(refund) ? 'PENDING_OVERDUE' : refund.status;
  const config = REFUND_STATUS_CONFIG[configKey];
  if (!config) return null;
  const Icon = config.icon;
  return (
    <div className={`mt-1.5 flex items-center gap-1 text-[12px] font-semibold ${config.className}`}>
      <Icon size={13} className="shrink-0" />
      <span>{t(config.labelKey)}</span>
      {refund.status === 'REJECTED' && refund.adminNote && (
        <span className="font-normal text-gray-400">
          · {t('booking.history.refundRejectedReason', { reason: refund.adminNote })}
        </span>
      )}
    </div>
  );
}

function BookingActions({
  booking,
  canPayNow,
  canCancel,
  canReview,
  showContactReception,
  isPaying,
  onPayNow,
  onCancel,
  onReview,
  onViewDetail,
  onContactReception,
  t,
}) {
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
      {canReview && (
        <button
          type="button"
          onClick={() => onReview(booking)}
          className="rounded-lg bg-amber-50 px-3.5 py-2 text-xs font-semibold text-amber-700 transition-colors hover:bg-amber-100"
        >
          {t('booking.history.review')}
        </button>
      )}
      {/* Chỉ hiện khi RefundRequest còn PENDING VÀ đã quá SLA xử lý (xem isRefundOverdue) —
          còn trong hạn thì chỉ cần badge trạng thái, không cần làm phiền khách bằng nút này
          (KAN-122). Kiểu fill đỏ (khác các nút outline khác) vì đây là tình huống cần khách
          chú ý ngay — đã quá hạn cam kết xử lý. */}
      {showContactReception && (
        <button
          type="button"
          onClick={() => onContactReception(booking)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-red-700"
        >
          <MessageCircle size={14} /> {t('booking.history.contactReception')}
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
  const [cancelReasonInput, setCancelReasonInput] = useState('');
  const [detailBookingId, setDetailBookingId] = useState(null);
  const [reviewTarget, setReviewTarget] = useState(null);

  // Reset ô nhập lý do mỗi khi mở dialog huỷ cho 1 đơn khác hoặc đóng dialog lại —
  // tránh lý do của lần huỷ trước còn sót lại khi mở dialog mới.
  useEffect(() => {
    setCancelReasonInput('');
  }, [cancelTarget]);

  // Xem trước mức hoàn tiền nếu huỷ ngay lúc này (KAN-117) — chỉ cần gọi khi đơn đã thanh
  // toán (đơn chưa thanh toán thì huỷ không có gì để hoàn, không cần hỏi backend).
  const { data: cancellationPreview } = useGetCancellationPreviewQuery(cancelTarget?.bookingId, {
    skip: !cancelTarget || !cancelTarget.paidAmount,
  });

  // Đánh giá khách đã viết — để ẩn nút "Đánh giá" ở những đơn đã đánh giá rồi (backend
  // cũng chặn, nhưng để nút ở đó rồi báo lỗi khi bấm thì khó chịu).
  const { data: myReviews = [] } = useGetMyReviewsQuery();
  const reviewedBookingIds = new Set(myReviews.map((r) => r.bookingId));

  // Yêu cầu hoàn tiền của chính khách (tạo tự động khi huỷ đơn đã thanh toán, KAN-114) —
  // map theo bookingId để tra nhanh khi render từng dòng.
  const { data: myRefundRequests = [] } = useGetMyRefundRequestsQuery();
  const refundByBookingId = useMemo(
    () => new Map(myRefundRequests.map((r) => [r.bookingId, r])),
    [myRefundRequests],
  );

  const bookings = data?.data ?? [];
  // Lấy lại object từ danh sách mới nhất thay vì giữ 1 bản chụp tĩnh — nếu socket
  // 'booking:updated' làm mới danh sách trong lúc modal đang mở (lễ tân xác nhận/huỷ
  // đơn này), modal chi tiết đổi trạng thái theo ngay thay vì hiện dữ liệu cũ.
  const detailBooking = bookings.find((b) => b.bookingId === detailBookingId) ?? null;

  // Lễ tân xác nhận/check-in/check-out/huỷ đơn ở phía họ -> đơn của mình đổi trạng
  // thái ngay trên máy khác, tự làm mới danh sách thay vì bắt khách F5 lại trang.
  const dispatch = useDispatch();
  const socket = useSocket();
  useEffect(() => {
    const handleBookingUpdated = () => {
      dispatch(bookingApi.util.invalidateTags([{ type: 'Booking', id: 'MY_LIST' }]));
    };
    socket.on('booking:updated', handleBookingUpdated);
    return () => socket.off('booking:updated', handleBookingUpdated);
  }, [socket, dispatch]);

  // "Liên hệ lễ tân" chỉ cần mở đúng widget chat lễ tân — khách chỉ có DUY NHẤT 1 hội thoại
  // đang mở tại 1 thời điểm (getOrCreateOwnConversation ở backend), nên không cần biết
  // trước conversationId/scroll tới đoạn nào, mở ra là thấy đúng cuộc hội thoại cần gửi.
  const handleContactReception = () => openReceptionChat();

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
    const trimmedReason = cancelReasonInput.trim();
    try {
      await cancelBooking({
        bookingId: cancelTarget.bookingId,
        reason: trimmedReason || t('booking.history.cancelReason'),
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
                      const canReview = booking.status === 'CHECKED_OUT' && !reviewedBookingIds.has(booking.bookingId);
                      const isPaying = isRedirecting && payingId === booking.bookingId;
                      const refund = refundByBookingId.get(booking.bookingId);
                      const showContactReception = isRefundOverdue(refund);

                      return (
                        <tr key={booking.bookingId} className="transition-colors hover:bg-gray-50/60">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-gray-100">
                                {booking.roomType?.images?.[0] ? (
                                  <img
                                    loading="lazy"
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
                            <RefundStatus refund={refund} t={t} />
                          </td>
                          <td className="px-6 py-4">
                            <BookingActions
                              booking={booking}
                              showContactReception={showContactReception}
                              onContactReception={handleContactReception}
                              canPayNow={canPayNow}
                              canCancel={canCancel}
                              canReview={canReview}
                              isPaying={isPaying}
                              onPayNow={handlePayNow}
                              onCancel={setCancelTarget}
                              onReview={setReviewTarget}
                              onViewDetail={(b) => setDetailBookingId(b.bookingId)}
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
                const canReview = booking.status === 'CHECKED_OUT' && !reviewedBookingIds.has(booking.bookingId);
                const isPaying = isRedirecting && payingId === booking.bookingId;
                const refund = refundByBookingId.get(booking.bookingId);
                const showContactReception = isRefundOverdue(refund);

                return (
                  <div key={booking.bookingId} className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                    <div className="flex gap-3 p-4">
                      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-gray-100">
                        {booking.roomType?.images?.[0] ? (
                          <img
                            loading="lazy"
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
                        <RefundStatus refund={refund} t={t} />
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
                        showContactReception={showContactReception}
                        onContactReception={handleContactReception}
                        canPayNow={canPayNow}
                        canCancel={canCancel}
                        canReview={canReview}
                        isPaying={isPaying}
                        onPayNow={handlePayNow}
                        onCancel={setCancelTarget}
                        onReview={setReviewTarget}
                        onViewDetail={(b) => setDetailBookingId(b.bookingId)}
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
      >
        {cancellationPreview && cancellationPreview.hoursUntilCheckIn > 0 && (
          <>
            {cancellationPreview.refundPercent === 100 && (
              <div className="mt-3 flex items-start gap-2 rounded-xl bg-green-50 px-3 py-2.5 text-sm text-green-700">
                <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
                <span>
                  {t('booking.history.cancellationPreviewFull', {
                    amount: formatCurrency(cancellationPreview.refundAmount, i18n.language),
                    hours: Math.floor(cancellationPreview.hoursUntilCheckIn),
                  })}
                </span>
              </div>
            )}
            {cancellationPreview.refundPercent > 0 && cancellationPreview.refundPercent < 100 && (
              <div className="mt-3 flex items-start gap-2 rounded-xl bg-orange-50 px-3 py-2.5 text-sm font-medium text-orange-700">
                <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                <span>
                  {t('booking.history.cancellationPreviewPartial', {
                    percent: cancellationPreview.refundPercent,
                    amount: formatCurrency(cancellationPreview.refundAmount, i18n.language),
                    paidAmount: formatCurrency(cancelTarget?.paidAmount, i18n.language),
                    freeHours: cancellationPreview.freeCancellationHours,
                  })}
                </span>
              </div>
            )}
          </>
        )}
        <div className="mt-3">
          <label className="mb-1 block text-xs font-semibold text-gray-500">
            {t('booking.history.cancelReasonInputLabel')}
          </label>
          <textarea
            rows={3}
            maxLength={500}
            value={cancelReasonInput}
            onChange={(e) => setCancelReasonInput(e.target.value)}
            placeholder={t('booking.history.cancelReasonInputPlaceholder')}
            className="w-full resize-y rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </ConfirmModal>

      {detailBooking && (
        <BookingDetailModal booking={detailBooking} onClose={() => setDetailBookingId(null)} />
      )}

      <ReviewModal
        isOpen={Boolean(reviewTarget)}
        bookingId={reviewTarget?.bookingId}
        roomType={reviewTarget?.roomType}
        onClose={() => setReviewTarget(null)}
      />
    </div>
  );
}
