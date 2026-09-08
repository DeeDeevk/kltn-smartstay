import { useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import {
  CalendarClock,
  ClipboardList,
  Loader2,
  LogOut,
  QrCode,
  RefreshCw,
  TrendingUp,
} from 'lucide-react';
import { useGetRoomMapQuery } from '../../../services/adminRoom';
import {
  ROOM_STATUS_META,
  resolveRoomDisplayStatus,
} from '../../../utils/roomStatusStyles';
import RoomStatusCard from './RoomStatusCard';
import RoomDetailModal from './RoomDetailModal';
import FloorSidebar from './FloorSidebar';
import RoomMapFilterBar from './RoomMapFilterBar';
import ShiftModal from './ShiftModal';
import QRScannerModal from '../Model/QRScannerModal';

const EMPTY_DRAFT = { checkIn: '', checkOut: '', roomType: '' };
const LEGEND_STATUSES = ['AVAILABLE', 'BOOKED', 'OCCUPIED', 'CLEANING', 'MAINTENANCE'];

export default function RoomMapPage() {
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [applied, setApplied] = useState(EMPTY_DRAFT);
  const [selectedFloor, setSelectedFloor] = useState('all');
  const [activeRoom, setActiveRoom] = useState(null);
  const [shiftMode, setShiftMode] = useState(null);
  const [scannerOpen, setScannerOpen] = useState(false);

  const hasRangeFilter = Boolean(applied.checkIn && applied.checkOut);

  const {
    data: rooms = [],
    isFetching,
    refetch,
  } = useGetRoomMapQuery({
    checkIn: applied.checkIn,
    checkOut: applied.checkOut,
  });

  const floors = useMemo(
    () => [...new Set(rooms.map((r) => r.floor))].sort((a, b) => a - b),
    [rooms],
  );
  const roomTypeNames = useMemo(
    () => [...new Set(rooms.map((r) => r.roomType?.name).filter(Boolean))],
    [rooms],
  );

  const filteredRooms = useMemo(
    () =>
      rooms
        .filter((r) => selectedFloor === 'all' || r.floor === selectedFloor)
        .filter((r) => !applied.roomType || r.roomType?.name === applied.roomType),
    [rooms, selectedFloor, applied.roomType],
  );

  const decorated = useMemo(
    () =>
      filteredRooms.map((room) => ({
        room,
        displayStatus: resolveRoomDisplayStatus(room, hasRangeFilter),
      })),
    [filteredRooms, hasRangeFilter],
  );

  const statusCounts = useMemo(() => {
    const counts = Object.fromEntries(
      Object.keys(ROOM_STATUS_META).map((s) => [s, 0]),
    );
    for (const { displayStatus } of decorated) {
      counts[displayStatus] = (counts[displayStatus] ?? 0) + 1;
    }
    return counts;
  }, [decorated]);

  const groupedByFloor = useMemo(() => {
    const groups = new Map();
    for (const entry of decorated) {
      if (!groups.has(entry.room.floor)) groups.set(entry.room.floor, []);
      groups.get(entry.room.floor).push(entry);
    }
    return [...groups.entries()].sort(([a], [b]) => a - b);
  }, [decorated]);

  const applyFilter = () => {
    if (Boolean(draft.checkIn) !== Boolean(draft.checkOut)) {
      toast.error('Vui lòng chọn cả ngày check-in và check-out');
      return;
    }
    if (draft.checkIn && draft.checkOut && draft.checkIn >= draft.checkOut) {
      toast.error('Ngày check-in phải trước ngày check-out');
      return;
    }
    setApplied(draft);
  };

  const resetFilter = () => {
    setDraft(EMPTY_DRAFT);
    setApplied(EMPTY_DRAFT);
  };

  const handleScanSuccess = (decodedText) => {
    setScannerOpen(false);
    toast.info(`Đã quét mã: ${decodedText.trim()}`);
  };

  return (
    <>
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sơ đồ phòng</h1>
          <p className="mt-1 text-sm text-gray-500">
            Xem và quản lý trạng thái phòng theo thời gian thực
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white p-1 shadow-sm">
            <GhostButton
              icon={ClipboardList}
              label="Danh sách ca"
              onClick={() => setShiftMode('list')}
            />
            <GhostButton
              icon={TrendingUp}
              label="Doanh thu"
              onClick={() => setShiftMode('revenue')}
            />
            <GhostButton
              icon={CalendarClock}
              label="Thông tin ca"
              onClick={() => setShiftMode('info')}
            />
          </div>

          <button
            type="button"
            onClick={() => setScannerOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
          >
            <QrCode size={16} /> Quét mã QR
          </button>

          <button
            type="button"
            onClick={() => setShiftMode('end')}
            className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-red-700"
          >
            <LogOut size={16} /> Kết ca
          </button>

          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            title="Làm mới"
            className="flex h-[42px] w-[42px] items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-500 shadow-sm transition-colors hover:bg-gray-50 disabled:opacity-60"
          >
            {isFetching ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <RefreshCw size={16} />
            )}
          </button>
        </div>
      </header>

      <div className="flex flex-col gap-6 lg:flex-row">
        <FloorSidebar
          floors={floors}
          selectedFloor={selectedFloor}
          onSelectFloor={setSelectedFloor}
          statusCounts={statusCounts}
          legendStatuses={LEGEND_STATUSES}
        />

        <div className="min-w-0 flex-1 space-y-5">
          <RoomMapFilterBar
            draft={draft}
            onDraftChange={setDraft}
            onApply={applyFilter}
            onReset={resetFilter}
            roomTypeNames={roomTypeNames}
            isFetching={isFetching}
          />

          {isFetching && rooms.length === 0 && (
            <div className="flex justify-center py-24 text-gray-300">
              <Loader2 className="animate-spin" size={32} />
            </div>
          )}

          {!isFetching && decorated.length === 0 && (
            <div className="rounded-2xl border border-dashed border-gray-200 bg-white py-16 text-center">
              <p className="text-sm text-gray-400">
                Không có phòng nào khớp bộ lọc hiện tại.
              </p>
            </div>
          )}

          <div className="space-y-8">
            {groupedByFloor.map(([floor, entries]) => (
              <section key={floor}>
                <h3 className="mb-3 inline-flex rounded-md bg-gray-100 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-gray-500">
                  Tầng {floor}
                </h3>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                  {entries.map(({ room, displayStatus }) => (
                    <RoomStatusCard
                      key={room.roomId}
                      room={room}
                      displayStatus={displayStatus}
                      onClick={setActiveRoom}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      </div>

      <RoomDetailModal room={activeRoom} onClose={() => setActiveRoom(null)} />
      <ShiftModal
        mode={shiftMode}
        open={shiftMode !== null}
        onClose={() => setShiftMode(null)}
        onShiftEnded={refetch}
      />
      <QRScannerModal
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScanSuccess={handleScanSuccess}
      />
    </>
  );
}

function GhostButton({ icon: Icon, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900"
    >
      <Icon size={15} className="text-gray-400" />
      {label}
    </button>
  );
}
