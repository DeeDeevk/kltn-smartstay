import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { CheckCircle2, DoorOpen, Loader2, LogIn, LogOut, XCircle } from 'lucide-react';
import Modal from '../../common/Modal';
import StatusPill from '../../booking/StatusPill';
import AvailableRoomPicker from '../../booking/AvailableRoomPicker';
import {
  BOOKING_STATUS_STYLES,
  PAYMENT_STATUS_STYLES,
} from '../../../utils/bookingStatusStyles';
import formatCurrency from '../../../utils/formatCurrency';
import formatDate from '../../../utils/formatDate';
import getBookingCode from '../../../utils/bookingCode';
import {
  useConfirmBookingMutation,
  useCancelBookingMutation,
  useCheckInMutation,
} from '../../../services/booking';

const BOOKING_STATUS_LABELS = {
  PENDING: 'Chờ xác nhận',
  CONFIRMED: 'Đã xác nhận',
  CHECKED_IN: 'Đang lưu trú',
  CHECKED_OUT: 'Đã hoàn thành',
  CANCELLED: 'Đã huỷ',
};
const PAYMENT_STATUS_LABELS = {
  UNPAID: 'Chưa thanh toán',
  PAID: 'Đã thanh toán',
  FAILED: 'Thanh toán lỗi',
};

export default function BookingAdminDetailModal({ booking, onClose, onChanged }) {
  const navigate = useNavigate();
  const [confirmBooking, { isLoading: confirming }] = useConfirmBookingMutation();
  const [cancelBooking, { isLoading: cancelling }] = useCancelBookingMutation();
  const [checkIn, { isLoading: checkingIn }] = useCheckInMutation();
  const [cancelMode, setCancelMode] = useState(false);
  const [reason, setReason] = useState('');
  // Bước chọn phòng của luồng nhận phòng — mở ngay trong modal này thay vì điều hướng
  // sang Sơ đồ phòng: đơn đặt online luôn chưa gán phòng (khách chỉ chọn LOẠI phòng),
  // nên nếu chỉ navigate thì nhân viên rơi vào sơ đồ trống trơn và phải tự mò phòng.
  const [checkInMode, setCheckInMode] = useState(false);
  const [selectedRoomId, setSelectedRoomId] = useState(null);

  // Modal này luôn được mount (trang cha chỉ đổi prop `booking`), nên state không tự
  // mất đi khi đóng — mở đơn A rồi bấm "Huỷ đơn"/"Nhận phòng", đóng lại, mở đơn B sẽ
  // thấy nguyên ô lý do huỷ hoặc danh sách phòng của lần trước. Reset theo bookingId.
  useEffect(() => {
    setCheckInMode(false);
    setSelectedRoomId(null);
    setCancelMode(false);
    setReason('');
  }, [booking?.bookingId]);

  if (!booking) return null;

  const busy = confirming || cancelling || checkingIn;
  const canCancel =
    booking.status === 'PENDING' || booking.status === 'CONFIRMED';

  const done = (msg) => {
    toast.success(msg);
    onChanged?.();
    onClose();
  };

  const handleConfirm = async () => {
    try {
      await confirmBooking(booking.bookingId).unwrap();
      done('Đã xác nhận đơn đặt phòng');
    } catch (err) {
      toast.error(err?.data?.message || 'Không thể xác nhận đơn');
    }
  };

  // Đơn đã được gán phòng sẵn thì bỏ qua bước chọn, nhận phòng luôn.
  const handleCheckIn = async () => {
    const roomId = booking.room?.roomId ?? selectedRoomId;
    if (!roomId) {
      toast.error('Vui lòng chọn phòng để nhận phòng cho khách');
      return;
    }
    try {
      await checkIn({ bookingId: booking.bookingId, roomId }).unwrap();
      done('Đã nhận phòng cho khách');
    } catch (err) {
      toast.error(err?.data?.message || 'Không thể nhận phòng');
    }
  };

  const handleCancel = async () => {
    if (!reason.trim()) {
      toast.error('Vui lòng nhập lý do huỷ');
      return;
    }
    try {
      await cancelBooking({ bookingId: booking.bookingId, reason: reason.trim() }).unwrap();
      done('Đã huỷ đơn đặt phòng');
    } catch (err) {
      toast.error(err?.data?.message || 'Không thể huỷ đơn');
    }
  };

  return (
    <Modal open={Boolean(booking)} onClose={onClose} title="Chi tiết đặt phòng" size="lg">
      <div className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2">
        <Info label="Mã đặt phòng">
          <span className="font-mono font-bold text-blue-600">
            {getBookingCode(booking.bookingId)}
          </span>
        </Info>
        <Info label="Loại phòng">{booking.roomType?.name || '—'}</Info>
        <Info label="Khách hàng">{booking.guestInfo?.fullName || '—'}</Info>
        <Info label="Số điện thoại">{booking.guestInfo?.phone || '—'}</Info>
        <Info label="Email">{booking.guestInfo?.email || 'Chưa cập nhật'}</Info>
        <Info label="Phòng đã gán">
          {booking.room?.roomNumber || 'Chưa gán'}
        </Info>
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
            label={PAYMENT_STATUS_LABELS[booking.paymentStatus] || booking.paymentStatus}
          />
        </Info>
        <Info label="Hình thức">
          {booking.paymentMethod === 'CASH' ? 'Tiền mặt' : 'Chuyển khoản (PayOS)'}
        </Info>
      </div>

      <div className="mt-6 rounded-xl border border-gray-100 bg-gray-50 p-4">
        <div className="space-y-1.5 text-sm">
          <RowLine label="Tiền phòng" value={formatCurrency(booking.roomAmount)} />
          {booking.lateCheckoutFee > 0 && (
            <RowLine
              label="Phụ thu trả muộn"
              value={formatCurrency(booking.lateCheckoutFee)}
            />
          )}
          {booking.discountAmount > 0 && (
            <RowLine
              label="Giảm giá"
              value={`- ${formatCurrency(booking.discountAmount)}`}
            />
          )}
          <RowLine label="Dịch vụ" value={formatCurrency(booking.serviceAmount)} />
          <RowLine label="VAT (8%)" value={formatCurrency(booking.vatAmount)} />
          <div className="flex justify-between border-t border-gray-200 pt-1.5 font-bold text-gray-900">
            <span>Tổng cộng</span>
            <span className="text-blue-600">{formatCurrency(booking.totalAmount)}</span>
          </div>
        </div>
      </div>

      {checkInMode && (
        <div className="mt-5 rounded-xl border border-gray-200 p-4">
          <h4 className="mb-3 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-gray-400">
            <DoorOpen size={14} /> Chọn phòng cho khách
          </h4>
          {booking.room?.roomId ? (
            <p className="rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-700">
              Đơn đã được gán phòng{' '}
              <span className="font-bold">{booking.room.roomNumber}</span> — bấm
              "Xác nhận nhận phòng" để hoàn tất.
            </p>
          ) : (
            <AvailableRoomPicker
              roomTypeId={booking.roomType?.roomTypeId}
              checkIn={booking.checkInDate}
              checkOut={booking.checkOutDate}
              selectedRoomId={selectedRoomId}
              onSelect={setSelectedRoomId}
            />
          )}
        </div>
      )}

      {cancelMode && (
        <div className="mt-5">
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-400">
            Lý do huỷ đơn
          </label>
          <textarea
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="VD: Khách yêu cầu huỷ, đặt nhầm ngày..."
            className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-end gap-3 border-t border-gray-100 pt-5">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50"
        >
          Đóng
        </button>

        {booking.status === 'CONFIRMED' && (
          <Action
            icon={LogIn}
            tone="bg-emerald-600 hover:bg-emerald-700"
            busy={checkingIn}
            disabled={
              busy || (checkInMode && !booking.room?.roomId && !selectedRoomId)
            }
            onClick={() => {
              if (checkInMode) {
                handleCheckIn();
                return;
              }
              setCancelMode(false);
              setCheckInMode(true);
            }}
          >
            {checkInMode ? 'Xác nhận nhận phòng' : 'Nhận phòng'}
          </Action>
        )}
        {booking.status === 'CHECKED_IN' && booking.room?.roomId && (
          <Action
            icon={LogOut}
            tone="bg-amber-500 hover:bg-amber-600"
            onClick={() =>
              navigate(
                `/admin/rooms/${booking.room.roomId}/checkout/${booking.bookingId}`,
              )
            }
          >
            Trả phòng
          </Action>
        )}
        {booking.status === 'PENDING' && (
          <Action
            icon={CheckCircle2}
            tone="bg-blue-600 hover:bg-blue-700"
            busy={confirming}
            onClick={handleConfirm}
          >
            Xác nhận đơn
          </Action>
        )}
        {canCancel &&
          (cancelMode ? (
            <Action
              icon={XCircle}
              tone="bg-red-600 hover:bg-red-700"
              busy={cancelling}
              onClick={handleCancel}
            >
              Xác nhận huỷ
            </Action>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setCheckInMode(false);
                setCancelMode(true);
              }}
              className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60"
            >
              <XCircle size={15} /> Huỷ đơn
            </button>
          ))}
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

function RowLine({ label, value }) {
  return (
    <div className="flex justify-between text-gray-600">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

// busy = đang gọi API (hiện spinner); disabled = chưa đủ điều kiện bấm (vd. chưa chọn
// phòng) — tách riêng để nút mờ đi mà không quay spinner gây hiểu nhầm là đang xử lý.
function Action({ icon: Icon, tone, busy, disabled, onClick, children }) {
  return (
    <button
      type="button"
      disabled={busy || disabled}
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors disabled:opacity-60 ${tone}`}
    >
      {busy ? <Loader2 size={15} className="animate-spin" /> : <Icon size={15} />}
      {children}
    </button>
  );
}
