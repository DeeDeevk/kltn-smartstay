import { useMemo, useState } from 'react';
import {
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  LogIn,
  LogOut,
  Loader2,
} from 'lucide-react';
import { toast } from 'react-toastify';
import ConfirmModal from '../../common/ConfirmModal';
import {
  useGetMyShiftAssignmentsQuery,
  useCheckInShiftAssignmentMutation,
  useCheckOutShiftAssignmentMutation,
} from '../../../services/shiftAssignment';
import { addDays, formatShortDate, getMonday, todayKey, toDateKey, WEEKDAY_LABELS } from './dateUtils';
import useCheckInAvailability from './useCheckInAvailability';

const STATUS_LABELS = {
  SCHEDULED: 'Chưa vô ca',
  CHECKEDIN: 'Đang làm việc',
  CHECKEDOUT: 'Đã kết ca',
  ABSENT: 'Vắng mặt',
};

const STATUS_BADGE_CLASS = {
  SCHEDULED: 'bg-gray-100 text-gray-600',
  CHECKEDIN: 'bg-green-50 text-green-700',
  CHECKEDOUT: 'bg-blue-50 text-blue-700',
  ABSENT: 'bg-red-50 text-red-600',
};

function formatTime(dateTimeString) {
  if (!dateTimeString) return null;
  return new Date(dateTimeString).toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Thẻ 1 ca của hôm nay — cho vô ca (SCHEDULED) / kết ca (CHECKEDIN) / chỉ hiện
// trạng thái nếu đã kết ca hoặc bị đánh dấu vắng mặt.
function TodayShiftCard({ assignment, onCheckIn, onRequestCheckOut, isSubmitting }) {
  // Chưa tới giờ ca thì không cho bấm "Vô ca" (backend vẫn chặn lại lần nữa).
  const checkInAvailability = useCheckInAvailability(assignment);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
      <div>
        <p className="flex items-center gap-2 font-bold text-gray-900">
          <CalendarClock size={16} className="text-blue-500" />
          {assignment.shiftType.name}
          <span className="font-normal text-gray-400">
            ({assignment.shiftType.startTime?.slice(0, 5)}-{assignment.shiftType.endTime?.slice(0, 5)})
          </span>
        </p>
        <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
          <span className={`rounded-full px-2 py-0.5 font-semibold ${STATUS_BADGE_CLASS[assignment.status]}`}>
            {STATUS_LABELS[assignment.status] ?? assignment.status}
          </span>
          {assignment.checkInAt && <span>Vô ca lúc {formatTime(assignment.checkInAt)}</span>}
          {assignment.checkOutAt && <span>· Kết ca lúc {formatTime(assignment.checkOutAt)}</span>}
        </div>
      </div>

      {assignment.status === 'SCHEDULED' && (
        <div className="flex flex-col items-end gap-1">
          <button
            type="button"
            onClick={() => onCheckIn(assignment)}
            disabled={isSubmitting || !checkInAvailability.allowed}
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />}
            Vô ca
          </button>
          {!checkInAvailability.allowed && checkInAvailability.reason && (
            <span className="text-right text-xs text-amber-600">
              {checkInAvailability.reason}
            </span>
          )}
        </div>
      )}
      {assignment.status === 'CHECKEDIN' && (
        <button
          type="button"
          onClick={() => onRequestCheckOut(assignment)}
          disabled={isSubmitting}
          className="flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <LogOut size={16} />}
          Kết ca
        </button>
      )}
    </div>
  );
}

// Trang "Lịch làm việc của tôi" cho Nhân viên. Có 2 phần:
// 1. "Ca hôm nay" — vô ca/kết ca ngay tại đây, không phụ thuộc tuần đang xem ở lưới bên dưới.
// 2. Lưới cả tuần — chỉ xem, không sửa được (Admin mới có quyền phân/gỡ ca ở ShiftSchedulePage).
export default function MySchedulePage() {
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()));
  const [checkOutTarget, setCheckOutTarget] = useState(null);

  const weekDates = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );
  const fromKey = toDateKey(weekDates[0]);
  const toKey = toDateKey(weekDates[6]);

  const { data: assignments = [], isFetching } = useGetMyShiftAssignmentsQuery({
    from: fromKey,
    to: toKey,
  });
  const { data: todayAssignments = [], isFetching: isFetchingToday } =
    useGetMyShiftAssignmentsQuery({ from: todayKey(), to: todayKey() });

  const [checkIn, { isLoading: isCheckingIn }] = useCheckInShiftAssignmentMutation();
  const [checkOut, { isLoading: isCheckingOut }] = useCheckOutShiftAssignmentMutation();
  const isSubmitting = isCheckingIn || isCheckingOut;

  const assignmentsByDate = useMemo(() => {
    const map = {};
    for (const assignment of assignments) {
      if (!map[assignment.workDate]) map[assignment.workDate] = [];
      map[assignment.workDate].push(assignment);
    }
    return map;
  }, [assignments]);

  const handleCheckIn = async (assignment) => {
    try {
      await checkIn(assignment.shiftAssignmentId).unwrap();
      toast.success(`Đã vô ca "${assignment.shiftType.name}"`);
    } catch (err) {
      toast.error(err.message || 'Không thể vô ca');
    }
  };

  const handleConfirmCheckOut = async () => {
    if (!checkOutTarget) return;
    try {
      await checkOut(checkOutTarget.shiftAssignmentId).unwrap();
      toast.success(`Đã kết ca "${checkOutTarget.shiftType.name}"`);
      setCheckOutTarget(null);
    } catch (err) {
      toast.error(err.message || 'Không thể kết ca');
    }
  };

  return (
    <>
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Lịch làm việc của tôi</h1>

      <div className="mb-6">
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-gray-500">Ca hôm nay</h2>
        {isFetchingToday && (
          <div className="flex justify-center py-6 text-gray-400">
            <Loader2 className="animate-spin" size={20} />
          </div>
        )}
        {!isFetchingToday && todayAssignments.length === 0 && (
          <p className="rounded-xl border border-dashed border-gray-200 bg-white px-4 py-3 text-sm text-gray-400">
            Bạn không có ca làm việc nào hôm nay.
          </p>
        )}
        {!isFetchingToday && todayAssignments.length > 0 && (
          <div className="space-y-2">
            {todayAssignments.map((assignment) => (
              <TodayShiftCard
                key={assignment.shiftAssignmentId}
                assignment={assignment}
                onCheckIn={handleCheckIn}
                onRequestCheckOut={setCheckOutTarget}
                isSubmitting={isSubmitting}
              />
            ))}
          </div>
        )}
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setWeekStart((prev) => addDays(prev, -7))}
            className="rounded-lg border border-gray-200 p-1.5 hover:bg-gray-50"
            aria-label="Tuần trước"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm font-semibold text-gray-700">
            {formatShortDate(weekDates[0])} - {formatShortDate(weekDates[6])}
          </span>
          <button
            type="button"
            onClick={() => setWeekStart((prev) => addDays(prev, 7))}
            className="rounded-lg border border-gray-200 p-1.5 hover:bg-gray-50"
            aria-label="Tuần sau"
          >
            <ChevronRight size={16} />
          </button>
        </div>
        <button
          type="button"
          onClick={() => setWeekStart(getMonday(new Date()))}
          className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-200"
        >
          Tuần này
        </button>
      </div>

      {isFetching && (
        <div className="flex justify-center py-10 text-gray-400">
          <Loader2 className="animate-spin" size={22} />
        </div>
      )}

      {!isFetching && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {weekDates.map((date, index) => {
            const dateKey = toDateKey(date);
            const dayAssignments = assignmentsByDate[dateKey] ?? [];
            return (
              <div key={dateKey} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-wide text-gray-400">
                  {WEEKDAY_LABELS[index]}
                </p>
                <p className="mb-3 text-sm font-semibold text-gray-900">{formatShortDate(date)}</p>

                {dayAssignments.length === 0 ? (
                  <p className="text-xs italic text-gray-300">Không có ca</p>
                ) : (
                  <div className="space-y-2">
                    {dayAssignments.map((assignment) => (
                      <div
                        key={assignment.shiftAssignmentId}
                        className="rounded-lg bg-blue-50 px-2.5 py-2 text-xs text-blue-700"
                      >
                        <div className="flex items-center gap-2 font-semibold">
                          <CalendarClock size={14} className="shrink-0" />
                          <span>
                            {assignment.shiftType.name} ({assignment.shiftType.startTime?.slice(0, 5)}-
                            {assignment.shiftType.endTime?.slice(0, 5)})
                          </span>
                        </div>
                        <p className="mt-1 pl-6 text-blue-600/80">
                          {STATUS_LABELS[assignment.status] ?? assignment.status}
                        </p>
                        {assignment.note && (
                          <p className="mt-0.5 pl-6 text-blue-600/80">Ghi chú: {assignment.note}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <ConfirmModal
        open={Boolean(checkOutTarget)}
        title="Kết ca"
        message={
          checkOutTarget
            ? `Kết thúc ca "${checkOutTarget.shiftType.name}" hôm nay? Sau khi kết ca sẽ không vô ca lại được cho ca này.`
            : ''
        }
        confirmLabel="Kết ca"
        loading={isCheckingOut}
        onConfirm={handleConfirmCheckOut}
        onClose={() => setCheckOutTarget(null)}
      />
    </>
  );
}
