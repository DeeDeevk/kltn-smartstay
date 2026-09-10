import { useMemo, useState } from 'react';
import { CalendarClock, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { useGetMyShiftAssignmentsQuery } from '../../../services/shiftAssignment';
import { addDays, formatShortDate, getMonday, toDateKey, WEEKDAY_LABELS } from './dateUtils';

// Trang "Lịch làm việc của tôi" cho Nhân viên — chỉ xem, không sửa được (Admin
// mới có quyền phân/gỡ ca ở ShiftSchedulePage).
export default function MySchedulePage() {
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()));

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

  const assignmentsByDate = useMemo(() => {
    const map = {};
    for (const assignment of assignments) {
      if (!map[assignment.workDate]) map[assignment.workDate] = [];
      map[assignment.workDate].push(assignment);
    }
    return map;
  }, [assignments]);

  return (
    <>
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Lịch làm việc của tôi</h1>

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
                        {assignment.note && (
                          <p className="mt-1 pl-6 text-blue-600/80">Ghi chú: {assignment.note}</p>
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
    </>
  );
}
