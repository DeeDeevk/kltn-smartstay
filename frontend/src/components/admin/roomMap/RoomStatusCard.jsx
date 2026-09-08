import { BedDouble, Users } from 'lucide-react';
import formatCurrency from '../../../utils/formatCurrency';
import { ROOM_STATUS_META } from '../../../utils/roomStatusStyles';

// 1 ô phòng trên Sơ đồ phòng. `displayStatus` do trang cha quyết định (có thể là
// 'BOOKED' ảo khi đang lọc theo ngày), khác với room.status gốc.
export default function RoomStatusCard({ room, displayStatus, onClick }) {
  const status = displayStatus ?? room.status;
  const meta = ROOM_STATUS_META[status] ?? ROOM_STATUS_META.AVAILABLE;

  return (
    <button
      type="button"
      onClick={() => onClick(room)}
      className={`group relative flex flex-col rounded-2xl border bg-white p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md ${meta.card}`}
    >
      <span
        className={`absolute right-3 top-3 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${meta.tag}`}
      >
        {meta.label}
      </span>

      <p className="text-2xl font-extrabold leading-none text-gray-900">
        {room.roomNumber}
      </p>
      <p className="mt-1 truncate text-sm font-medium text-gray-500">
        {room.roomType?.name || '—'}
      </p>

      <div className="my-4 flex flex-1 items-center justify-center text-gray-300 transition-colors group-hover:text-blue-400">
        <BedDouble size={30} strokeWidth={1.5} />
      </div>

      <div className="flex items-end justify-between">
        <span className="flex items-center gap-1 text-xs text-gray-400">
          <Users size={13} /> {room.roomType?.capacity ?? '—'}
        </span>
        {room.roomType?.basePrice != null && (
          <span className="text-sm font-bold text-blue-600">
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
