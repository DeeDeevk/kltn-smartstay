import { useEffect, useMemo, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  CalendarClock,
  ClipboardList,
  Loader2,
  LogIn,
  LogOut,
  QrCode,
  RefreshCw,
} from 'lucide-react';
import { adminRoomApi, useGetRoomMapQuery } from '../../../services/adminRoom';
import { useSocket } from '../../../context/SocketContext';
import {
  useGetMyShiftAssignmentsQuery,
  useCheckInShiftAssignmentMutation,
  useCheckOutShiftAssignmentMutation,
} from '../../../services/shiftAssignment';
import { useAuth } from '../../../context/AuthContext';
import {
  ROOM_STATUS_META,
  resolveRoomDisplayStatus,
} from '../../../utils/roomStatusStyles';
import RoomStatusCard from './RoomStatusCard';
import FloorSidebar from './FloorSidebar';
import RoomMapFilterBar from './RoomMapFilterBar';
import QrCheckInModal from './QrCheckInModal';
import QRScannerModal from '../Model/QRScannerModal';
import Modal from '../../common/Modal';
import ConfirmModal from '../../common/ConfirmModal';
import { todayKey } from '../shifts/dateUtils';
import useCheckInAvailability from '../shifts/useCheckInAvailability';

const SHIFT_STATUS_LABELS = {
  SCHEDULED: 'Chưa vô ca',
  CHECKEDIN: 'Đang làm việc',
  CHECKEDOUT: 'Đã kết ca',
  ABSENT: 'Vắng mặt',
};

function formatShiftTime(dateTimeString) {
  if (!dateTimeString) return null;
  return new Date(dateTimeString).toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

const EMPTY_DRAFT = { checkIn: '', checkOut: '', roomType: '' };
// Chú giải mặc định theo trạng thái phòng thật; khi lọc theo khoảng ngày thì thay
// RESERVED/OCCUPIED bằng "BOOKED" ảo (phòng có lịch đè trong khoảng đó).
const LEGEND_STATUSES = [
  'AVAILABLE',
  'RESERVED',
  'OCCUPIED',
  'CLEANING',
  'MAINTENANCE',
];
const LEGEND_STATUSES_RANGE = [
  'AVAILABLE',
  'BOOKED',
  'CLEANING',
  'MAINTENANCE',
];
// Vé đặt phòng chỉ mã hoá bookingId (UUID) — xem utils/bookingQrPayload.
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function RoomMapPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  // "Danh sách ca" (xem/phân ca cho mọi nhân viên) là chức năng quản lý -> chỉ
  // Admin. "Thông tin ca" / "Vô ca" / "Kết ca" là thao tác trực quầy của chính
  // người đang đăng nhập nên cả Admin lẫn nhân viên đều thấy.
  const isAdmin = user?.role === 'ADMIN';
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [applied, setApplied] = useState(EMPTY_DRAFT);
  const [selectedFloor, setSelectedFloor] = useState('all');
  const [shiftInfoOpen, setShiftInfoOpen] = useState(false);
  const [checkOutConfirmOpen, setCheckOutConfirmOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannedBookingId, setScannedBookingId] = useState(null);

  const openRoom = (room) => navigate(`/admin/rooms/${room.roomId}`);

  // Ca làm việc hôm nay của chính người đang đăng nhập — dùng đúng dữ liệu
  // thật từ ShiftAssignment (không còn dữ liệu giả lập).
  const todayKeyValue = todayKey();
  const { data: todayAssignments = [] } = useGetMyShiftAssignmentsQuery({
    from: todayKeyValue,
    to: todayKeyValue,
  });
  // Ưu tiên hiện ca đang CHECKEDIN (cần kết ca), rồi tới ca SCHEDULED sớm nhất
  // (cần vô ca); nếu mọi ca hôm nay đã CHECKEDOUT thì lấy ca đầu để hiện trạng thái.
  const activeAssignment =
    todayAssignments.find((a) => a.status === 'CHECKEDIN') ??
    todayAssignments.find((a) => a.status === 'SCHEDULED') ??
    todayAssignments[0] ??
    null;

  // Chưa tới giờ ca thì nút "Vô ca" bị mờ kèm lý do (backend vẫn chặn lại lần nữa).
  const checkInAvailability = useCheckInAvailability(activeAssignment);

  const [checkIn, { isLoading: isCheckingIn }] = useCheckInShiftAssignmentMutation();
  const [checkOut, { isLoading: isCheckingOut }] = useCheckOutShiftAssignmentMutation();

  const handleCheckIn = async () => {
    if (!activeAssignment) return;
    try {
      await checkIn(activeAssignment.shiftAssignmentId).unwrap();
      toast.success(`Đã vô ca "${activeAssignment.shiftType.name}"`);
    } catch (err) {
      toast.error(err.message || 'Không thể vô ca');
    }
  };

  const handleConfirmCheckOut = async () => {
    if (!activeAssignment) return;
    try {
      await checkOut(activeAssignment.shiftAssignmentId).unwrap();
      toast.success(`Đã kết ca "${activeAssignment.shiftType.name}"`);
      setCheckOutConfirmOpen(false);
    } catch (err) {
      toast.error(err.message || 'Không thể kết ca');
    }
  };

  const hasRangeFilter = Boolean(applied.checkIn && applied.checkOut);

  const {
    data: rooms = [],
    isFetching,
    refetch,
  } = useGetRoomMapQuery({
    checkIn: applied.checkIn,
    checkOut: applied.checkOut,
  });

  // Phòng đổi trạng thái ở tab/máy khác (check-in, check-out, đổi trạng thái tay...)
  // -> bắn cache 'LIST' để mọi admin/staff đang mở Sơ đồ phòng tự thấy, khỏi bấm
  // "Làm mới" thủ công.
  const dispatch = useDispatch();
  const socket = useSocket();
  useEffect(() => {
    const handleRoomStatusChanged = () => {
      dispatch(adminRoomApi.util.invalidateTags([{ type: 'AdminRoom', id: 'LIST' }]));
    };
    socket.on('room:status-changed', handleRoomStatusChanged);
    return () => socket.off('room:status-changed', handleRoomStatusChanged);
  }, [socket, dispatch]);

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
    const id = decodedText.trim();
    if (!UUID_PATTERN.test(id)) {
      toast.error('Mã QR không hợp lệ — không phải vé đặt phòng của Vika Hotel');
      return;
    }
    setScannedBookingId(id);
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
            {isAdmin && (
              <GhostButton
                icon={ClipboardList}
                label="Phân ca nhân viên"
                onClick={() => navigate('/admin/schedule')}
              />
            )}
            <GhostButton
              icon={CalendarClock}
              label="Thông tin ca"
              onClick={() => setShiftInfoOpen(true)}
            />
          </div>

          <button
            type="button"
            onClick={() => setScannerOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
          >
            <QrCode size={16} /> Quét mã QR
          </button>

          {activeAssignment?.status === 'SCHEDULED' && (
            // Bọc span để tooltip vẫn hiện được khi nút đang bị disable.
            <span
              className="inline-flex"
              title={checkInAvailability.reason || undefined}
            >
              <button
                type="button"
                onClick={handleCheckIn}
                disabled={isCheckingIn || !checkInAvailability.allowed}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isCheckingIn ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />}
                Vô ca
              </button>
            </span>
          )}
          {activeAssignment?.status === 'CHECKEDIN' && (
            <button
              type="button"
              onClick={() => setCheckOutConfirmOpen(true)}
              disabled={isCheckingOut}
              className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isCheckingOut ? <Loader2 size={16} className="animate-spin" /> : <LogOut size={16} />}
              Kết ca
            </button>
          )}
          {activeAssignment?.status === 'CHECKEDOUT' && (
            <span className="inline-flex items-center gap-1.5 rounded-xl bg-gray-100 px-4 py-2.5 text-sm font-semibold text-gray-500">
              Đã kết ca lúc {formatShiftTime(activeAssignment.checkOutAt)}
            </span>
          )}
          {!activeAssignment && (
            <span className="inline-flex items-center gap-1.5 rounded-xl bg-gray-50 px-4 py-2.5 text-sm text-gray-400">
              Không có ca hôm nay
            </span>
          )}

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
          legendStatuses={
            hasRangeFilter ? LEGEND_STATUSES_RANGE : LEGEND_STATUSES
          }
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
                <div className="grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-4">
                  {entries.map(({ room, displayStatus }) => (
                    <RoomStatusCard
                      key={room.roomId}
                      room={room}
                      displayStatus={displayStatus}
                      onClick={openRoom}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      </div>

      <Modal open={shiftInfoOpen} onClose={() => setShiftInfoOpen(false)} title="Thông tin ca">
        {!activeAssignment ? (
          <p className="py-6 text-center text-sm text-gray-400">
            Bạn không có ca làm việc nào hôm nay.
          </p>
        ) : (
          <div className="divide-y divide-gray-100 text-sm">
            <div className="flex items-center justify-between py-2.5">
              <span className="text-gray-500">Loại ca</span>
              <span className="font-semibold text-gray-900">
                {activeAssignment.shiftType.name} (
                {activeAssignment.shiftType.startTime?.slice(0, 5)}-
                {activeAssignment.shiftType.endTime?.slice(0, 5)})
              </span>
            </div>
            <div className="flex items-center justify-between py-2.5">
              <span className="text-gray-500">Trạng thái</span>
              <span className="font-semibold text-gray-900">
                {SHIFT_STATUS_LABELS[activeAssignment.status] ?? activeAssignment.status}
              </span>
            </div>
            <div className="flex items-center justify-between py-2.5">
              <span className="text-gray-500">Vô ca lúc</span>
              <span className="font-semibold text-gray-900">
                {formatShiftTime(activeAssignment.checkInAt) ?? '—'}
              </span>
            </div>
            <div className="flex items-center justify-between py-2.5">
              <span className="text-gray-500">Kết ca lúc</span>
              <span className="font-semibold text-gray-900">
                {formatShiftTime(activeAssignment.checkOutAt) ?? '—'}
              </span>
            </div>
            {activeAssignment.note && (
              <div className="py-2.5">
                <span className="text-gray-500">Ghi chú: </span>
                <span className="text-gray-900">{activeAssignment.note}</span>
              </div>
            )}
          </div>
        )}
      </Modal>

      <ConfirmModal
        open={checkOutConfirmOpen}
        title="Kết ca"
        message={
          activeAssignment
            ? `Kết thúc ca "${activeAssignment.shiftType.name}" hôm nay? Sau khi kết ca sẽ không vô ca lại được cho ca này.`
            : ''
        }
        confirmLabel="Kết ca"
        loading={isCheckingOut}
        onConfirm={handleConfirmCheckOut}
        onClose={() => setCheckOutConfirmOpen(false)}
      />

      <QrCheckInModal
        bookingId={scannedBookingId}
        onClose={() => setScannedBookingId(null)}
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
