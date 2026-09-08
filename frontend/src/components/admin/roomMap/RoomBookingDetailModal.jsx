import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { Loader2, LogIn, LogOut, CheckCircle2 } from 'lucide-react';
import Modal from '../../common/Modal';
import StatusPill from '../../booking/StatusPill';
import {
  BOOKING_STATUS_STYLES,
  PAYMENT_STATUS_STYLES,
} from '../../../utils/bookingStatusStyles';
import formatDate from '../../../utils/formatDate';
import getBookingCode from '../../../utils/bookingCode';
import {
  useCheckInMutation,
  useConfirmBookingMutation,
} from '../../../services/booking';

const BOOKING_STATUS_LABELS = {
  PENDING: 'Chờ xác nhận',
  CONFIRMED: 'Đã xác nhận (chưa nhận phòng)',
  CHECKED_IN: 'Đang lưu trú',
  CHECKED_OUT: 'Đã trả phòng',
  CANCELLED: 'Đã huỷ',
};

const PAYMENT_STATUS_LABELS = {
  UNPAID: 'Chưa thanh toán',
  PAID: 'Đã thanh toán',
  FAILED: 'Thanh toán lỗi',
};

// Modal chi tiết đơn trong trang Sơ đồ phòng > phòng: ngoài thông tin đơn còn cho lễ tân
// làm thủ tục nhận phòng / trả phòng ngay (khác BookingDetailModal của khách chỉ để xem).
export default function RoomBookingDetailModal({
  booking,
  roomId,
  onChanged,
  onClose,
}) {
  const navigate = useNavigate();
  const [confirmBooking, { isLoading: confirming }] = useConfirmBookingMutation();
  const [checkIn, { isLoading: checkingIn }] = useCheckInMutation();
  const busy = confirming || checkingIn;

  if (!booking) return null;

  const goCheckout = () => {
    onClose();
    navigate(`/admin/rooms/${roomId}/checkout/${booking.bookingId}`);
  };

  const run = async (action, successMsg) => {
    try {
      await action().unwrap();
      toast.success(successMsg);
      onChanged?.();
      onClose();
    } catch (err) {
      toast.error(err?.data?.message || 'Thao tác không thành công');
    }
  };

  return (
    <Modal
      open={Boolean(booking)}
      onClose={onClose}
      title="Chi tiết đặt phòng"
      size="lg"
    >
      <div className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2">
        <Info label="Mã đặt phòng">
          <span className="font-mono font-bold text-blue-600">
            {getBookingCode(booking.bookingId)}
          </span>
        </Info>
        <Info label="Khách hàng">{booking.guestInfo?.fullName || '—'}</Info>
        <Info label="Số điện thoại">{booking.guestInfo?.phone || '—'}</Info>
        <Info label="Email">{booking.guestInfo?.email || 'Chưa cập nhật'}</Info>
        <Info label="Thời gian lưu trú">
          {formatDate(booking.checkInDate)} → {formatDate(booking.checkOutDate)}
        </Info>
        <Info label="Trạng thái đơn">
          <StatusPill
            value={booking.status}
            styles={BOOKING_STATUS_STYLES}
            label={BOOKING_STATUS_LABELS[booking.status] || booking.status}
          />
        </Info>
        <Info label="Thanh toán">
          <StatusPill
            value={booking.paymentStatus}
            styles={PAYMENT_STATUS_STYLES}
            label={
              PAYMENT_STATUS_LABELS[booking.paymentStatus] ||
              booking.paymentStatus
            }
          />
        </Info>
        <Info label="Ghi chú">
          {booking.status === 'CANCELLED' && booking.cancelReason
            ? booking.cancelReason
            : 'Không có ghi chú'}
        </Info>
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-end gap-3 border-t border-gray-100 pt-5">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50"
        >
          Đóng
        </button>

        {booking.status === 'PENDING' && (
          <ActionButton
            icon={CheckCircle2}
            tone="blue"
            busy={busy}
            onClick={() =>
              run(
                () => confirmBooking(booking.bookingId),
                'Đã xác nhận đơn — có thể làm thủ tục nhận phòng',
              )
            }
          >
            Xác nhận đơn
          </ActionButton>
        )}

        {booking.status === 'CONFIRMED' && (
          <ActionButton
            icon={LogIn}
            tone="green"
            busy={busy}
            onClick={() =>
              run(
                () =>
                  checkIn({
                    bookingId: booking.bookingId,
                    roomId: booking.room?.roomId || roomId,
                  }),
                'Đã nhận phòng cho khách',
              )
            }
          >
            Làm thủ tục nhận phòng
          </ActionButton>
        )}

        {booking.status === 'CHECKED_IN' && (
          <ActionButton icon={LogOut} tone="amber" busy={busy} onClick={goCheckout}>
            Làm thủ tục trả phòng
          </ActionButton>
        )}
      </div>
    </Modal>
  );
}

function Info({ label, children }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
        {label}
      </p>
      <div className="mt-1 font-semibold text-gray-900">{children}</div>
    </div>
  );
}

const TONE_CLASSES = {
  blue: 'bg-blue-600 hover:bg-blue-700',
  green: 'bg-emerald-600 hover:bg-emerald-700',
  amber: 'bg-amber-500 hover:bg-amber-600',
};

function ActionButton({ icon: Icon, tone, busy, onClick, children }) {
  return (
    <button
      type="button"
      disabled={busy}
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors disabled:opacity-60 ${TONE_CLASSES[tone]}`}
    >
      {busy ? <Loader2 size={15} className="animate-spin" /> : <Icon size={15} />}
      {children}
    </button>
  );
}
