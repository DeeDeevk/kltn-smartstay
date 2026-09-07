import { Users } from 'lucide-react';
import formatCurrency from '../../../utils/formatCurrency';
import { ROOM_STATUS_META } from '../../../utils/roomStatusStyles';

export default function RoomStatusCard({ room, onClick }) {
  const meta = ROOM_STATUS_META[room.status] ?? ROOM_STATUS_META.AVAILABLE;

  return (
    <button
      type="button"
      onClick={() => onClick(room)}
      className={`rounded-xl border border-gray-200 bg-white p-4 text-left shadow-sm ring-1 ring-inset transition-all hover:-translate-y-0.5 hover:shadow-md ${meta.ring}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-lg font-bold text-gray-900">{room.roomNumber}</p>
          <p className="truncate text-xs text-gray-500">{room.roomType?.name}</p>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold whitespace-nowrap ${meta.badge}`}>
          {meta.label}
        </span>
      </div>
      <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <Users size={12} /> {room.roomType?.capacity}
        </span>
        {room.roomType?.basePrice != null && (
          <span className="font-semibold text-gray-700">{formatCurrency(room.roomType.basePrice)}/đêm</span>
        )}
      </div>
    </button>
  );
}
