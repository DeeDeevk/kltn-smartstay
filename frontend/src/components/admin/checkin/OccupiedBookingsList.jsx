import { useState } from 'react';
import { BedDouble, CalendarDays, Loader2, LogOut } from 'lucide-react';
import { toast } from 'react-toastify';
import { useGetBookingsQuery, useCheckOutMutation } from '../../../services/booking';
import formatDate from '../../../utils/formatDate';

// Danh sách phòng đang có khách ở (status=CHECKED_IN) — cho phép check-out thẳng từ đây,
// không bắt buộc phải quét lại QR (khách có thể làm mất vé/hết pin điện thoại...).
export default function OccupiedBookingsList() {
  const { data, isFetching, error } = useGetBookingsQuery({ status: 'CHECKED_IN', limit: 50 });
  const [checkOut] = useCheckOutMutation();
  const [checkingOutId, setCheckingOutId] = useState(null);

  const bookings = data?.data ?? [];

  const handleCheckOut = async (booking) => {
    setCheckingOutId(booking.bookingId);
    try {
      await checkOut(booking.bookingId).unwrap();
      toast.success(`Đã check-out cho "${booking.guestInfo?.fullName}" — phòng chuyển sang trạng thái dọn dẹp`);
    } catch (err) {
      toast.error(err?.data?.message || 'Check-out thất bại, vui lòng thử lại');
    } finally {
      setCheckingOutId(null);
    }
  };

  return (
    <div className="mt-8">
      <h2 className="mb-4 flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-gray-400">
        <BedDouble size={14} /> Phòng đang có khách ở {bookings.length > 0 && `(${bookings.length})`}
      </h2>

      {isFetching && (
        <div className="flex justify-center py-10 text-gray-400">
          <Loader2 className="animate-spin" size={24} />
        </div>
      )}

      {!isFetching && error && (
        <div className="rounded-2xl border border-red-100 bg-red-50 p-5 text-center text-sm text-red-600">
          {error?.data?.message || 'Không thể tải danh sách phòng đang có khách ở'}
        </div>
      )}

      {!isFetching && !error && bookings.length === 0 && (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white py-10 text-center">
          <p className="text-sm text-gray-400">Hiện không có phòng nào đang có khách ở.</p>
        </div>
      )}

      {!isFetching && !error && bookings.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {bookings.map((booking) => (
            <div key={booking.bookingId} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-bold text-gray-900">Phòng {booking.room?.roomNumber}</p>
                  <p className="truncate text-xs text-gray-500">{booking.roomType?.name}</p>
                </div>
                <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-600">
                  Đang ở
                </span>
              </div>

              <p className="mt-3 truncate text-sm font-semibold text-gray-800">{booking.guestInfo?.fullName}</p>
              <p className="mt-1 flex items-center gap-1.5 text-xs text-gray-500">
                <CalendarDays size={12} /> Trả phòng: {formatDate(booking.checkOutDate)}
              </p>

              <button
                type="button"
                onClick={() => handleCheckOut(booking)}
                disabled={checkingOutId === booking.bookingId}
                className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-50 py-2 text-xs font-bold text-emerald-700 transition-colors hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {checkingOutId === booking.bookingId ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <LogOut size={14} />
                )}
                Check-out
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
