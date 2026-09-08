import { Layers, ListFilter } from 'lucide-react';
import { ROOM_STATUS_META } from '../../../utils/roomStatusStyles';

// Panel trái của Sơ đồ phòng: điều hướng nhanh theo tầng + chú giải trạng thái
// kèm số lượng phòng đang khớp bộ lọc hiện tại.
export default function FloorSidebar({
  floors,
  selectedFloor,
  onSelectFloor,
  statusCounts,
  legendStatuses,
}) {
  return (
    <aside className="w-full shrink-0 space-y-4 lg:w-64">
      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
            <Layers size={18} />
          </span>
          <div>
            <p className="text-sm font-bold text-gray-900">Chọn tầng</p>
            <p className="text-xs text-gray-400">Điều hướng nhanh</p>
          </div>
        </div>

        <nav className="space-y-1">
          <FloorButton
            active={selectedFloor === 'all'}
            onClick={() => onSelectFloor('all')}
            label="Tất cả"
          />
          {floors.map((floor) => (
            <FloorButton
              key={floor}
              active={selectedFloor === floor}
              onClick={() => onSelectFloor(floor)}
              label={`Tầng ${floor}`}
            />
          ))}
        </nav>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-gray-400">
          <ListFilter size={13} /> Trạng thái
        </div>
        <ul className="space-y-2">
          {legendStatuses.map((status) => {
            const meta = ROOM_STATUS_META[status];
            return (
              <li
                key={status}
                className="flex items-center justify-between text-sm"
              >
                <span className="flex items-center gap-2 text-gray-600">
                  <span className={`h-2.5 w-2.5 rounded-full ${meta.dot}`} />
                  {meta.label}
                </span>
                <span className="font-semibold text-gray-900">
                  {statusCounts[status] ?? 0}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </aside>
  );
}

function FloorButton({ active, onClick, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
        active
          ? 'bg-blue-50 text-blue-600'
          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
      }`}
    >
      <Layers size={16} className={active ? 'text-blue-600' : 'text-gray-400'} />
      {label}
    </button>
  );
}
