import { BedDouble, Users } from 'lucide-react';
import formatCurrency from '../../../utils/formatCurrency';
import { ROOM_STATUS_META } from '../../../utils/roomStatusStyles';

// 1 ô phòng trên Sơ đồ phòng. `displayStatus` do trang cha quyết định (có thể là
// 'BOOKED' ảo khi đang lọc theo ngày), khác với room.status gốc.
// Phòng đang có khách / đã đặt (meta.muted) được làm xám để phân biệt rõ với phòng
// còn nhận được.
export default function RoomStatusCard({ room, displayStatus, onClick }) {
  const status = displayStatus ?? room.status;
  const meta = ROOM_STATUS_META[status] ?? ROOM_STATUS_META.AVAILABLE;
  const muted = Boolean(meta.muted);

  return (
    <button
      type="button"
      onClick={() => onClick(room)}
      className={`group relative flex flex-col rounded-2xl border p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${
        muted
          ? 'border-gray-200 bg-gray-100 hover:border-gray-300'
          : `bg-white hover:border-blue-300 ${meta.card}`
      }`}
    >
      <span
        className={`absolute right-3 top-3 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
          muted ? 'bg-gray-400 text-white' : meta.tag
        }`}
      >
        {meta.label}
      </span>

      <p
        className={`text-2xl font-extrabold leading-none ${
          muted ? 'text-gray-400' : 'text-gray-900'
        }`}
      >
        {room.roomNumber}
      </p>
      <p
        className={`mt-1 truncate text-sm font-medium ${
          muted ? 'text-gray-400' : 'text-gray-500'
        }`}
      >
        {room.roomType?.name || '—'}
      </p>

      <div
        className={`my-4 flex flex-1 items-center justify-center transition-colors ${
          muted
            ? 'text-gray-300'
            : 'text-gray-300 group-hover:text-blue-400'
        }`}
      >
        <BedDouble size={30} strokeWidth={1.5} />
      </div>

      {/* flex-wrap + whitespace-nowrap: khi ô hẹp (vd. mở rộng sidebar), giá tụt
          nguyên cụm xuống dòng dưới thay vì bị ngắt giữa chừng ("4.500.000 đ/" | "đêm"). */}
      <div className="flex flex-wrap items-end gap-x-2 gap-y-1">
        <span className="flex shrink-0 items-center gap-1 text-xs text-gray-400">
          <Users size={13} /> {room.roomType?.capacity ?? '—'}
        </span>
        {room.roomType?.basePrice != null && (
          <span
            className={`ml-auto whitespace-nowrap text-sm font-bold ${
              muted ? 'text-gray-400' : 'text-blue-600'
            }`}
          >
            {formatCurrency(room.roomType.basePrice)}
            <span className="ml-0.5 text-[11px] font-medium text-gray-400">
              /đêm
            </span>
          </span>
        )}
      </div>
    </button>
  );
}
