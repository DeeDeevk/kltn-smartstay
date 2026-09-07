import { useMemo, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { useGetRoomMapQuery } from '../../../services/adminRoom';
import RoomStatusCard from './RoomStatusCard';
import { ROOM_STATUS_META } from '../../../utils/roomStatusStyles';
import RoomDetailModal from './RoomDetailModal';

export default function RoomMapPage() {
  const { data: rooms = [], isFetching, refetch } = useGetRoomMapQuery();
  const [selectedFloor, setSelectedFloor] = useState('all');
  const [selectedRoomType, setSelectedRoomType] = useState('');
  const [activeRoom, setActiveRoom] = useState(null);

  const floors = useMemo(
    () => [...new Set(rooms.map((r) => r.floor))].sort((a, b) => a - b),
    [rooms],
  );
  const roomTypeNames = useMemo(
    () => [...new Set(rooms.map((r) => r.roomType?.name).filter(Boolean))],
    [rooms],
  );

  const filteredRooms = useMemo(() => {
    return rooms
      .filter((r) => selectedFloor === 'all' || r.floor === selectedFloor)
      .filter((r) => !selectedRoomType || r.roomType?.name === selectedRoomType);
  }, [rooms, selectedFloor, selectedRoomType]);

  const statusCounts = useMemo(() => {
    const counts = {};
    for (const status of Object.keys(ROOM_STATUS_META)) counts[status] = 0;
    for (const room of filteredRooms) counts[room.status] = (counts[room.status] ?? 0) + 1;
    return counts;
  }, [filteredRooms]);

  const roomsByFloor = useMemo(() => {
    const groups = new Map();
    for (const room of filteredRooms) {
      if (!groups.has(room.floor)) groups.set(room.floor, []);
      groups.get(room.floor).push(room);
    }
    return [...groups.entries()].sort(([a], [b]) => a - b);
  }, [filteredRooms]);

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sơ đồ phòng</h1>
          <p className="mt-1 text-sm text-gray-500">Theo dõi trạng thái từng phòng, đổi trạng thái và xem lịch sử đặt phòng</p>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-600 shadow-sm transition-colors hover:bg-gray-50 disabled:opacity-60"
        >
          {isFetching ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
          Làm mới
        </button>
      </div>

      {/* Bộ lọc */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setSelectedFloor('all')}
          className={`rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors ${
            selectedFloor === 'all' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
          }`}
        >
          Tất cả tầng
        </button>
        {floors.map((floor) => (
          <button
            key={floor}
            type="button"
            onClick={() => setSelectedFloor(floor)}
            className={`rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors ${
              selectedFloor === floor ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            Tầng {floor}
          </button>
        ))}

        <select
          value={selectedRoomType}
          onChange={(e) => setSelectedRoomType(e.target.value)}
          className="ml-auto rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Tất cả loại phòng</option>
          {roomTypeNames.map((name) => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
      </div>

      {/* Chú giải trạng thái */}
      <div className="mb-6 flex flex-wrap items-center gap-4 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
        {Object.entries(ROOM_STATUS_META).map(([status, meta]) => (
          <span key={status} className="flex items-center gap-1.5 text-xs font-medium text-gray-600">
            <span className={`h-2.5 w-2.5 rounded-full ${meta.dot}`} />
            {meta.label} ({statusCounts[status] ?? 0})
          </span>
        ))}
      </div>

      {isFetching && rooms.length === 0 && (
        <div className="flex justify-center py-24 text-gray-400">
          <Loader2 className="animate-spin" size={32} />
        </div>
      )}

      {!isFetching && filteredRooms.length === 0 && (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white py-16 text-center">
          <p className="text-sm text-gray-400">Không có phòng nào khớp bộ lọc hiện tại.</p>
        </div>
      )}

      {selectedFloor === 'all' ? (
        <div className="space-y-8">
          {roomsByFloor.map(([floor, floorRooms]) => (
            <div key={floor}>
              <h3 className="mb-3 text-sm font-bold text-gray-500">Tầng {floor}</h3>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {floorRooms.map((room) => (
                  <RoomStatusCard key={room.roomId} room={room} onClick={setActiveRoom} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {filteredRooms.map((room) => (
            <RoomStatusCard key={room.roomId} room={room} onClick={setActiveRoom} />
          ))}
        </div>
      )}

      <RoomDetailModal room={activeRoom} onClose={() => setActiveRoom(null)} />
    </>
  );
}
