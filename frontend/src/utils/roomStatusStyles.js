// Meta hiển thị cho trạng thái phòng vật lý (RoomStatus của backend) + trạng thái
// "BOOKED" ảo chỉ xuất hiện trên Sơ đồ phòng khi lọc theo khoảng ngày check-in/out.
export const ROOM_STATUS_META = {
  AVAILABLE: {
    label: 'Trống',
    dot: 'bg-emerald-500',
    badge: 'bg-emerald-50 text-emerald-600',
    ring: 'ring-emerald-100',
    tag: 'bg-emerald-500 text-white',
    card: 'border-emerald-200',
  },
  OCCUPIED: {
    label: 'Đang ở',
    dot: 'bg-blue-500',
    badge: 'bg-blue-50 text-blue-600',
    ring: 'ring-blue-100',
    tag: 'bg-blue-600 text-white',
    card: 'border-blue-200',
  },
  RESERVED: {
    label: 'Đã giữ chỗ',
    dot: 'bg-violet-500',
    badge: 'bg-violet-50 text-violet-600',
    ring: 'ring-violet-100',
    tag: 'bg-violet-600 text-white',
    card: 'border-violet-200',
  },
  CLEANING: {
    label: 'Đang dọn dẹp',
    dot: 'bg-amber-400',
    badge: 'bg-amber-50 text-amber-600',
    ring: 'ring-amber-100',
    tag: 'bg-amber-500 text-white',
    card: 'border-amber-200',
  },
  MAINTENANCE: {
    label: 'Bảo trì',
    dot: 'bg-red-500',
    badge: 'bg-red-50 text-red-600',
    ring: 'ring-red-100',
    tag: 'bg-red-600 text-white',
    card: 'border-red-200',
  },
  BOOKED: {
    label: 'Đã đặt',
    dot: 'bg-slate-500',
    badge: 'bg-slate-100 text-slate-600',
    ring: 'ring-slate-200',
    tag: 'bg-slate-600 text-white',
    card: 'border-slate-300',
  },
};

// Trạng thái hiển thị trên 1 card phòng: khi đang lọc theo ngày thì ưu tiên
// rangeStatus (BOOKED/AVAILABLE), ngoài ra phòng bảo trì/dọn dẹp vẫn giữ nguyên.
export function resolveRoomDisplayStatus(room, isRangeFilter) {
  if (
    isRangeFilter &&
    (room.status === 'AVAILABLE' || room.status === 'OCCUPIED')
  ) {
    return room.rangeStatus === 'BOOKED' ? 'BOOKED' : 'AVAILABLE';
  }
  return room.status;
}
