import { useState } from 'react';
import { QrCode, DoorOpen, RotateCcw, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { toast } from 'react-toastify';
import QRScannerModal from '../Model/QRScannerModal';
import BookingRoomSummary from '../../booking/BookingRoomSummary';
import BookingGuestInfoCard from '../../booking/BookingGuestInfoCard';
import { useGetBookingByIdQuery, useCheckInMutation } from '../../../services/booking';
import { useGetRoomMapQuery } from '../../../services/adminRoom';

// UUID v4 dạng chuẩn — QR của khách chỉ mã hoá đúng bookingId (xem utils/bookingQrPayload),
// nên quét ra chuỗi không đúng dạng này coi như mã QR không hợp lệ (ảnh khác, QR hỏng...).
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function RoomOption({ room, selected, onSelect }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(room.roomId)}
      className={`flex items-center justify-between rounded-xl border px-4 py-3 text-left transition-colors ${
        selected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
      }`}
    >
      <span className="font-bold text-gray-900">Phòng {room.roomNumber}</span>
      <span className="text-xs text-gray-500">Tầng {room.floor}</span>
    </button>
  );
}

export default function CheckInPage() {
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannedId, setScannedId] = useState(null);
  const [selectedRoomId, setSelectedRoomId] = useState(null);

  const {
    data: booking,
    isFetching: isLoadingBooking,
    error: bookingError,
  } = useGetBookingByIdQuery(scannedId, { skip: !scannedId });
  const { data: rooms = [] } = useGetRoomMapQuery(undefined, { skip: !scannedId });
  const [checkIn, { isLoading: isCheckingIn }] = useCheckInMutation();

  const reset = () => {
    setScannedId(null);
    setSelectedRoomId(null);
  };

  const handleScanSuccess = (decodedText) => {
    setScannerOpen(false);
    const value = decodedText.trim();
    if (!UUID_PATTERN.test(value)) {
      toast.error('Mã QR không hợp lệ — không phải vé đặt phòng của Vika Hotel');
      return;
    }
    setSelectedRoomId(null);
    setScannedId(value);
  };

  const handleConfirmCheckIn = async () => {
    if (!selectedRoomId) return;
    try {
      await checkIn({ bookingId: booking.bookingId, roomId: selectedRoomId }).unwrap();
      toast.success(`Đã check-in thành công cho "${booking.guestInfo?.fullName}"`);
      reset();
    } catch (err) {
      toast.error(err?.data?.message || 'Check-in thất bại, vui lòng thử lại');
    }
  };

  const matchingRooms = rooms.filter(
    (r) => r.status === 'AVAILABLE' && r.roomType?.roomTypeId === booking?.roomType?.roomTypeId,
  );

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Check-in</h1>
          <p className="mt-1 text-sm text-gray-500">Quét mã QR vé đặt phòng của khách để nhận phòng</p>
        </div>
        {scannedId && (
          <button
            type="button"
            onClick={reset}
            className="flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-50"
          >
            <RotateCcw size={16} /> Quét mã khác
          </button>
        )}
      </div>

      {!scannedId && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-white py-24 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 text-blue-600">
            <QrCode size={30} />
          </div>
          <p className="mb-5 max-w-sm text-sm text-gray-500">
            Bấm nút bên dưới, đưa mã QR trên vé đặt phòng (bản in hoặc trên điện thoại của khách) vào khung hình camera.
          </p>
          <button
            type="button"
            onClick={() => setScannerOpen(true)}
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-blue-700"
          >
            <QrCode size={18} /> Quét mã QR
          </button>
        </div>
      )}

      {scannedId && isLoadingBooking && (
        <div className="flex justify-center py-24 text-gray-400">
          <Loader2 className="animate-spin" size={32} />
        </div>
      )}

      {scannedId && !isLoadingBooking && bookingError && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-red-100 bg-red-50 py-16 text-center">
          <AlertTriangle className="text-red-500" size={28} />
          <p className="text-sm font-medium text-red-600">
            {bookingError?.data?.message || 'Không tìm thấy đơn đặt phòng ứng với mã QR này'}
          </p>
        </div>
      )}

      {booking && !isLoadingBooking && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <BookingRoomSummary booking={booking} />
          </div>
          <BookingGuestInfoCard guestInfo={booking.guestInfo} />

          {booking.status !== 'CONFIRMED' ? (
            <div className="flex items-center gap-3 rounded-2xl border border-amber-100 bg-amber-50 p-5">
              <AlertTriangle className="shrink-0 text-amber-500" size={22} />
              <p className="text-sm font-medium text-amber-700">
                {booking.status === 'CHECKED_IN'
                  ? 'Đơn này đã check-in trước đó, không thể check-in lại.'
                  : `Đơn đang ở trạng thái "${booking.status}" — chỉ check-in được đơn đã xác nhận (CONFIRMED).`}
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <h4 className="mb-4 flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-gray-400">
                <DoorOpen size={14} /> Chọn phòng trống để gán ({booking.roomType?.name})
              </h4>

              {matchingRooms.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 py-8 text-center">
                  <p className="text-sm text-gray-400">Hiện không còn phòng trống thuộc loại phòng này.</p>
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
                onClick={handleConfirmCheckIn}
                disabled={!selectedRoomId || isCheckingIn}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3.5 text-sm font-bold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isCheckingIn ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
                {isCheckingIn ? 'Đang xác nhận...' : 'Xác nhận Check-in'}
              </button>
            </div>
          )}
        </div>
      )}

      <QRScannerModal
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScanSuccess={handleScanSuccess}
      />
    </>
  );
}
