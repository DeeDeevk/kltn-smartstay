import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  AlertTriangle,
  CheckCircle2,
  DoorOpen,
  Loader2,
  LogOut,
  Receipt,
} from 'lucide-react';
import Modal from '../../common/Modal';
import BookingRoomSummary from '../../booking/BookingRoomSummary';
import BookingGuestInfoCard from '../../booking/BookingGuestInfoCard';
import BookingPriceSummary from '../../booking/BookingPriceSummary';
import {
  useGetBookingByIdQuery,
  useConfirmBookingMutation,
  useCheckInMutation,
} from '../../../services/booking';
import { useGetRoomMapQuery } from '../../../services/adminRoom';

function RoomOption({ room, selected, onSelect }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(room.roomId)}
      className={`flex items-center justify-between rounded-xl border px-4 py-3 text-left transition-colors ${
        selected
          ? 'border-blue-500 bg-blue-50'
          : 'border-gray-200 hover:bg-gray-50'
      }`}
    >
      <span className="font-bold text-gray-900">Phòng {room.roomNumber}</span>
      <span className="text-xs text-gray-500">Tầng {room.floor}</span>
    </button>
  );
}

// Quét QR ở Sơ đồ phòng -> modal này: xem thông tin đơn + tiền + trạng thái thanh toán,
// rồi chọn phòng trống và check-in (hoặc xác nhận đơn / check-out) — thay cho trang
// /admin/checkin cũ.
export default function QrCheckInModal({ bookingId, onClose }) {
  const navigate = useNavigate();
  const [selectedRoomId, setSelectedRoomId] = useState(null);

  const {
    data: booking,
    isFetching: loadingBooking,
    error: bookingError,
  } = useGetBookingByIdQuery(bookingId, { skip: !bookingId });
  const { data: rooms = [] } = useGetRoomMapQuery(undefined, {
    skip: !bookingId,
  });
  const [confirmBooking, { isLoading: confirming }] = useConfirmBookingMutation();
  const [checkIn, { isLoading: checkingIn }] = useCheckInMutation();

  const close = () => {
    setSelectedRoomId(null);
    onClose();
  };

  const goCheckout = () => {
    const rid = booking?.room?.roomId;
    close();
    if (rid) navigate(`/admin/rooms/${rid}/checkout/${booking.bookingId}`);
  };

  const matchingRooms = rooms.filter(
    (r) =>
      r.status === 'AVAILABLE' &&
      r.roomType?.roomTypeId === booking?.roomType?.roomTypeId,
  );

  // keepOpen: dùng cho "Xác nhận đơn" — sau khi xác nhận, đơn chuyển sang CONFIRMED và
  // modal tự render tiếp bước chọn phòng trống để check-in (không đóng modal).
  const run = async (action, successMsg, { keepOpen = false } = {}) => {
    try {
      await action().unwrap();
      toast.success(successMsg);
      if (!keepOpen) close();
    } catch (err) {
      toast.error(err?.data?.message || 'Thao tác không thành công');
    }
  };

  return (
    <Modal
      open={Boolean(bookingId)}
      onClose={close}
      title="Nhận / trả phòng theo mã QR"
      size="lg"
    >
      {loadingBooking && (
        <div className="flex justify-center py-20 text-gray-300">
          <Loader2 className="animate-spin" size={30} />
        </div>
      )}

      {!loadingBooking && bookingError && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-red-100 bg-red-50 py-14 text-center">
          <AlertTriangle className="text-red-500" size={26} />
          <p className="text-sm font-medium text-red-600">
            {bookingError?.data?.message ||
              'Không tìm thấy đơn đặt phòng ứng với mã QR này'}
          </p>
        </div>
      )}

      {booking && !loadingBooking && (
        <div className="space-y-5">
          <div className="rounded-2xl border border-gray-200 p-5">
            <BookingRoomSummary booking={booking} />
          </div>

          <BookingGuestInfoCard guestInfo={booking.guestInfo} />

          <div className="rounded-2xl border border-gray-200 p-5">
            <h4 className="mb-4 flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-gray-400">
              <Receipt size={14} />
              {booking.paymentStatus === 'PAID'
                ? 'Đã thanh toán'
                : `Chưa thanh toán — cần thu (${
                    booking.paymentMethod === 'CASH' ? 'tiền mặt' : 'online'
                  })`}
            </h4>
            <BookingPriceSummary
              roomAmount={booking.roomAmount}
              discountAmount={booking.discountAmount}
              serviceAmount={booking.serviceAmount}
              vatAmount={booking.vatAmount}
              totalAmount={booking.totalAmount}
            />
          </div>

          {booking.status === 'PENDING' ? (
            <div className="space-y-4 rounded-2xl border border-amber-100 bg-amber-50 p-5">
              <div className="flex items-center gap-3">
                <AlertTriangle
                  className="shrink-0 text-amber-500"
                  size={22}
                />
                <p className="text-sm font-medium text-amber-700">
                  Đơn đang chờ xác nhận — chỉ check-in được đơn đã xác nhận.{' '}
                  {booking.paymentMethod === 'CASH'
                    ? 'Bấm xác nhận sau khi khách đã thanh toán tại quầy.'
                    : 'Chỉ xác nhận tay nếu chắc chắn khách đã trả tiền.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  run(
                    () => confirmBooking(booking.bookingId),
                    'Đã xác nhận đơn — chọn phòng trống để check-in',
                    { keepOpen: true },
                  )
                }
                disabled={confirming}
                className="flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-amber-600 disabled:opacity-60"
              >
                {confirming ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <CheckCircle2 size={16} />
                )}
                Xác nhận đơn
              </button>
            </div>
          ) : booking.status === 'CHECKED_IN' ? (
            <div className="rounded-2xl border border-gray-200 p-5">
              <p className="mb-4 text-sm text-gray-600">
                Khách đang lưu trú tại phòng{' '}
                <span className="font-bold text-gray-900">
                  {booking.room?.roomNumber}
                </span>
                . Sang màn Check-out để đối chiếu chi phí và thu tiền.
              </p>
              <button
                type="button"
                onClick={goCheckout}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white transition-colors hover:bg-emerald-700"
              >
                <LogOut size={18} />
                Làm thủ tục trả phòng
              </button>
            </div>
          ) : booking.status !== 'CONFIRMED' ? (
            <div className="flex items-center gap-3 rounded-2xl border border-amber-100 bg-amber-50 p-5">
              <AlertTriangle className="shrink-0 text-amber-500" size={22} />
              <p className="text-sm font-medium text-amber-700">
                {`Đơn đang ở trạng thái "${booking.status}" — không thể nhận / trả phòng.`}
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border border-gray-200 p-5">
              <h4 className="mb-4 flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-gray-400">
                <DoorOpen size={14} /> Chọn phòng trống để gán (
                {booking.roomType?.name})
              </h4>

              {booking.room?.roomId ? (
                <p className="mb-4 rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-700">
                  Đơn đã được gán phòng{' '}
                  <span className="font-bold">{booking.room.roomNumber}</span> —
                  xác nhận nhận phòng cho khách.
                </p>
              ) : matchingRooms.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 py-8 text-center">
                  <p className="text-sm text-gray-400">
                    Hiện không còn phòng trống thuộc loại phòng này.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {matchingRooms.map((room) => (
                    <RoomOption
                      key={room.roomId}
                      room={room}
                      selected={selectedRoomId === room.roomId}
                      onSelect={setSelectedRoomId}
                    />
                  ))}
                </div>
              )}

              <button
                type="button"
                onClick={() =>
                  run(
                    () =>
                      checkIn({
                        bookingId: booking.bookingId,
                        roomId: booking.room?.roomId || selectedRoomId,
                      }),
                    `Đã check-in cho "${booking.guestInfo?.fullName}"`,
                  )
                }
                disabled={
                  (!booking.room?.roomId && !selectedRoomId) || checkingIn
                }
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-sm font-bold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {checkingIn ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <CheckCircle2 size={18} />
                )}
                Xác nhận check-in
              </button>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
