import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  CheckCircle2,
  DoorOpen,
  Loader2,
  LogIn,
  LogOut,
  XCircle,
} from 'lucide-react';
import Modal from '../../common/Modal';
import ImageLightbox from '../../common/ImageLightbox';
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
  useGetBookingByIdQuery,
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
// Nhãn/màu riêng cho trạng thái RefundRequest trong khối "Hoàn tiền" (KAN-121) — khác chữ
// dùng ở trang /admin/refund-requests (VD "Đang chờ xử lý") vì ngữ cảnh ở đây là 1 dòng phụ
// trong modal chi tiết đơn, cần rõ ràng ngay là "đang chờ HOÀN TIỀN".
const REFUND_STATUS_META = {
  PENDING: { label: 'Đang chờ hoàn tiền', className: 'border-amber-200 bg-amber-50 text-amber-700' },
  COMPLETED: { label: 'Đã hoàn tiền', className: 'border-green-200 bg-green-50 text-green-700' },
  REJECTED: { label: 'Đã từ chối', className: 'border-red-200 bg-red-50 text-red-700' },
};

export default function BookingAdminDetailModal({ booking: bookingProp, onClose, onChanged }) {
  const navigate = useNavigate();
  const [confirmBooking, { isLoading: confirming }] = useConfirmBookingMutation();
  const [cancelBooking, { isLoading: cancelling }] = useCancelBookingMutation();
  const [checkIn, { isLoading: checkingIn }] = useCheckInMutation();
  const [cancelMode, setCancelMode] = useState(false);
  const [reason, setReason] = useState('');
  const [lightboxSrc, setLightboxSrc] = useState(null);
  // Trang cha chỉ truyền lại đúng dòng đã có từ danh sách (GET /bookings — cố tình KHÔNG
  // kèm refundRequest ở đó để khỏi tốn 1 query phụ cho mọi dòng danh sách, xem KAN-121 ở
  // backend). Tự gọi riêng GET /bookings/:id khi modal mở để lấy thêm refundRequest, đè lên
  // bookingProp — các field khác vẫn khớp vì cùng 1 nguồn dữ liệu.
  const { data: detail } = useGetBookingByIdQuery(bookingProp?.bookingId, {
    skip: !bookingProp?.bookingId,
  });
  // bookingProp === null nghĩa là trang cha đã đóng modal (setDetail(null)) — PHẢI ưu tiên
  // đóng ngay, không được để `detail` (RTK Query) "che" mất ý định đó: khi skip chuyển
  // thành true, hook không trả undefined ngay trong CÙNG lần render mà còn giữ nguyên data
  // cũ của bookingId trước đó thêm vài lần render nữa — nếu viết `detail ?? bookingProp`,
  // `booking` vẫn còn giá trị cũ (khác null) trong lúc đó, khiến `if (!booking) return null`
  // bên dưới KHÔNG BAO GIỜ chạy -> Modal không unmount -> nút X/"Đóng" bấm không có tác
  // dụng (bug đã xác nhận bằng Playwright, xảy ra với MỌI đơn, không riêng đơn có
  // RefundRequest — chỉ là dễ gặp hơn vì fetch đã kịp trả dữ liệu).
  const bookingData = bookingProp ? (detail ?? bookingProp) : null;
  // Giữ lại dữ liệu đơn của lần render cuối còn mở, để nội dung modal không biến mất
  // đột ngột trong lúc Modal.jsx đang chạy animation đóng (EXIT_MS) — khớp với cơ chế
  // `lastOpenContent` mà Modal.jsx tự dùng cho chính nó. Nếu dùng trực tiếp `bookingData`
  // (về null ngay khi đóng) thì `if (!booking) return null` ngay dưới sẽ unmount toàn bộ
  // cây, kể cả <Modal>, khiến modal "tắt phựt" thay vì mờ dần như mọi modal khác.
  const lastBookingRef = useRef(bookingData);
  if (bookingData) lastBookingRef.current = bookingData;
  const booking = bookingData ?? lastBookingRef.current;
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
    setLightboxSrc(null);
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
    <>
    <Modal open={Boolean(bookingData)} onClose={onClose} title="Chi tiết đặt phòng" size="lg">
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

      {/* Chỉ đọc — xử lý hoàn tiền (đánh dấu đã hoàn/từ chối) tập trung ở đúng 1 nơi là
          trang /admin/refund-requests + RefundActionModal, tránh trùng logic 2 chỗ. */}
      {booking.refundRequest && (
        <div className="mt-6 rounded-xl border border-gray-100 bg-gray-50 p-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400">
              Hoàn tiền
            </h4>
            <span
              className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${
                REFUND_STATUS_META[booking.refundRequest.status]?.className ??
                'border-gray-200 bg-gray-50 text-gray-600'
              }`}
            >
              {REFUND_STATUS_META[booking.refundRequest.status]?.label ?? booking.refundRequest.status}
            </span>
          </div>
          <div className="space-y-1.5 text-sm text-gray-700">
            <p>
              Số tiền hoàn:{' '}
              <span className="font-semibold">{formatCurrency(booking.refundRequest.amount)}</span>
              {booking.refundRequest.refundPercent !== 100 && (
                <span className="text-gray-500">
                  {' '}
                  ({booking.refundRequest.refundPercent}% — huỷ cận giờ nhận phòng)
                </span>
              )}
            </p>
            {booking.refundRequest.reason && <p>Lý do huỷ: {booking.refundRequest.reason}</p>}
            {booking.refundRequest.adminNote && (
              <p>Ghi chú admin: {booking.refundRequest.adminNote}</p>
            )}
            {booking.refundRequest.proofImageUrl && (
              <button
                type="button"
                onClick={() => setLightboxSrc(booking.refundRequest.proofImageUrl)}
                className="pt-1"
              >
                <img
                  src={booking.refundRequest.proofImageUrl}
                  alt="Ảnh biên lai chuyển khoản"
                  className="h-16 w-16 cursor-zoom-in rounded-lg border border-gray-200 object-cover"
                />
              </button>
            )}
            {/* Ảnh VietQR thật (KAN-123) — chỉ hiện khi tra được đủ bankBin + accountNumber
                từ payerBankInfo, không kèm phần text chi tiết tài khoản (đã có đủ ở trang
                /admin/refund-requests, modal này chỉ cần tiện cho admin quét nhanh). */}
            {booking.refundRequest.qrImageUrl && (
              <div className="w-[200px] pt-2">
                <img
                  src={booking.refundRequest.qrImageUrl}
                  alt="Mã VietQR chuyển khoản"
                  width={200}
                  height={240}
                  className="rounded-lg border border-gray-200"
                />
                <p className="mt-1.5 text-[11px] leading-snug text-amber-600">
                  QR này ứng với tài khoản đã thanh toán — nếu khách yêu cầu nhận vào tài khoản
                  khác, vui lòng dùng ảnh QR khách gửi qua chat (nếu có) và đối chiếu kỹ trước khi
                  quét.
                </p>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => navigate('/admin/refund-requests')}
            className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline"
          >
            Quản lý tại trang Yêu cầu hoàn tiền →
          </button>
        </div>
      )}

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
    <ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />
    </>
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
