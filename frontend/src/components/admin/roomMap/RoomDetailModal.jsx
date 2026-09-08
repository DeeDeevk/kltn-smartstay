import { CalendarDays, History, Loader2, Users } from 'lucide-react';
import { toast } from 'react-toastify';
import Modal from '../../common/Modal';
import StatusPill from '../../booking/StatusPill';
import { BOOKING_STATUS_STYLES } from '../../../utils/bookingStatusStyles';
import formatDate from '../../../utils/formatDate';
import formatCurrency from '../../../utils/formatCurrency';
import { useGetBookingsQuery } from '../../../services/booking';
import { useUpdateRoomStatusMutation } from '../../../services/adminRoom';
import { ROOM_STATUS_META } from '../../../utils/roomStatusStyles';

const STATUS_OPTIONS = Object.keys(ROOM_STATUS_META);

export default function RoomDetailModal({ room, onClose }) {
  const [updateStatus, { isLoading: isUpdatingStatus }] = useUpdateRoomStatusMutation();
  const { data, isFetching } = useGetBookingsQuery({ roomId: room?.roomId, limit: 20 }, { skip: !room });
  const bookings = data?.data ?? [];

  if (!room) return null;

  const handleStatusChange = async (status) => {
    if (status === room.status) return;
    try {
      await updateStatus({ roomId: room.roomId, status }).unwrap();
      toast.success(`Đã đổi phòng ${room.roomNumber} sang "${ROOM_STATUS_META[status].label}"`);
    } catch (err) {
      toast.error(err?.data?.message || 'Không thể đổi trạng thái phòng');
    }
  };

  return (
    <Modal open={Boolean(room)} onClose={onClose} title={`Phòng ${room.roomNumber}`} size="lg">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-100 bg-gray-50 p-4">
          <div>
            <p className="font-bold text-gray-900">{room.roomType?.name}</p>
            <p className="mt-0.5 flex items-center gap-3 text-xs text-gray-500">
              <span className="flex items-center gap-1"><Users size={12} /> {room.roomType?.capacity} khách</span>
              <span>Tầng {room.floor}</span>
              {room.roomType?.basePrice != null && <span>{formatCurrency(room.roomType.basePrice)}/đêm</span>}
            </p>
          </div>
        </div>

        <div>
          <h4 className="mb-2 text-xs font-bold uppercase tracking-widest text-gray-400">Đổi trạng thái phòng</h4>
          <div className="flex flex-wrap gap-2">
            {STATUS_OPTIONS.map((status) => {
              const meta = ROOM_STATUS_META[status];
              const isActive = status === room.status;
              return (
                <button
                  key={status}
                  type="button"
                  onClick={() => handleStatusChange(status)}
                  disabled={isUpdatingStatus || isActive}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition-colors disabled:cursor-not-allowed ${
                    isActive ? `${meta.badge} ring-1 ring-inset ${meta.ring}` : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
                  {meta.label}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <h4 className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-gray-400">
            <History size={13} /> Lịch sử đặt phòng
          </h4>

          {isFetching && (
            <div className="flex justify-center py-6 text-gray-400">
              <Loader2 className="animate-spin" size={20} />
            </div>
          )}

          {!isFetching && bookings.length === 0 && (
            <p className="py-4 text-center text-sm text-gray-400">Phòng này chưa có lịch sử đặt phòng nào.</p>
          )}

          {!isFetching && bookings.length > 0 && (
            <ul className="max-h-64 divide-y divide-gray-100 overflow-y-auto">
              {bookings.map((booking) => (
                <li key={booking.bookingId} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-gray-800">{booking.guestInfo?.fullName}</p>
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-gray-500">
                      <CalendarDays size={11} /> {formatDate(booking.checkInDate)} – {formatDate(booking.checkOutDate)}
                    </p>
                  </div>
                  <StatusPill value={booking.status} styles={BOOKING_STATUS_STYLES} label={booking.status} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  );
}
