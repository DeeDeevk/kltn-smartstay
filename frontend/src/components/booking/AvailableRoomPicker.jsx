import { Loader2 } from 'lucide-react';
import { useGetRoomMapQuery } from '../../services/adminRoom';

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

// Chọn 1 phòng vật lý trống để gán cho đơn lúc check-in. Khách đặt online chỉ chọn
// LOẠI phòng, phòng cụ thể do lễ tân gán khi khách tới quầy — nên bước này là bắt
// buộc trong mọi luồng nhận phòng.
//
// Truyền checkIn/checkOut vào /rooms/map là điểm mấu chốt: backend khi đó trả thêm
// rangeStatus theo lịch đặt trong khoảng ngày. Nếu chỉ lọc theo `status === AVAILABLE`
// thì một phòng đang trống hôm nay nhưng đã có đơn khác đặt vào đêm mai vẫn được đề
// xuất, gán vào là đụng lịch của đơn kia.
export default function AvailableRoomPicker({
  roomTypeId,
  checkIn,
  checkOut,
  selectedRoomId,
  onSelect,
}) {
  const { data: rooms = [], isFetching } = useGetRoomMapQuery(
    { roomTypeId, checkIn, checkOut },
    { skip: !roomTypeId },
  );

  const availableRooms = rooms.filter(
    (room) => room.status === 'AVAILABLE' && room.rangeStatus !== 'BOOKED',
  );

  if (isFetching && rooms.length === 0) {
    return (
      <div className="flex justify-center py-8 text-gray-300">
        <Loader2 className="animate-spin" size={24} />
      </div>
    );
  }

  if (availableRooms.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 py-8 text-center">
        <p className="text-sm text-gray-400">
          Không còn phòng trống thuộc loại phòng này trong khoảng ngày của đơn.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {availableRooms.map((room) => (
        <RoomOption
          key={room.roomId}
          room={room}
          selected={selectedRoomId === room.roomId}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}
