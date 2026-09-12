import { useMemo, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  FileText,
  Loader2,
  Plus,
  Settings2,
  X,
} from 'lucide-react';
import { toast } from 'react-toastify';
import ConfirmModal from '../../common/ConfirmModal';
import ShiftTypeManagerModal from './ShiftTypeManagerModal';
import AssignShiftModal from './AssignShiftModal';
import { useGetUsersQuery } from '../../../services/user';
import { useGetShiftTypesQuery } from '../../../services/shiftType';
import {
  useGetShiftAssignmentsQuery,
  useCopyShiftWeekMutation,
  useDeleteShiftAssignmentMutation,
} from '../../../services/shiftAssignment';
import {
  addDays,
  formatShortDate,
  getMonday,
  isPastDateKey,
  toDateKey,
  WEEKDAY_LABELS,
} from './dateUtils';

// Số nhân viên hiển thị mỗi trang trên lưới phân ca. Danh sách nhân viên được
// phân trang thật ở backend (GET /users?page=&limit=), không cắt phía client.
const PAGE_SIZE = 10;

// Bảng màu lặp lại theo thứ tự loại ca — chỉ để phân biệt trực quan trên lưới,
// không gắn cố định với 1 loại ca cụ thể nào.
const BADGE_COLORS = [
  'bg-blue-50 text-blue-700 border-blue-200',
  'bg-amber-50 text-amber-700 border-amber-200',
  'bg-indigo-50 text-indigo-700 border-indigo-200',
  'bg-emerald-50 text-emerald-700 border-emerald-200',
  'bg-rose-50 text-rose-700 border-rose-200',
];

// Trang "Phân ca nhân viên" — lưới lịch tuần (nhân viên × 7 ngày), Admin bấm vào
// ô để phân ca, bấm vào badge đã phân để gỡ. Ô của ngày đã qua ở chế độ chỉ xem.
// Đây là Phase 1: chỉ xếp lịch, chưa làm chấm công/check-in thực tế.
export default function ShiftSchedulePage() {
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()));
  const [page, setPage] = useState(1);
  const [assignTarget, setAssignTarget] = useState(null); // { staff, workDate }
  const [removeTarget, setRemoveTarget] = useState(null); // shiftAssignment
  const [managingTypes, setManagingTypes] = useState(false);
  const [copyConfirmOpen, setCopyConfirmOpen] = useState(false);

  const weekDates = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );
  const fromKey = toDateKey(weekDates[0]);
  const toKey = toDateKey(weekDates[6]);
  const prevWeekStart = useMemo(() => toDateKey(addDays(weekStart, -7)), [weekStart]);

  const { data: staffData, isFetching: isFetchingStaff } = useGetUsersQuery({
    role: 'STAFF',
    page,
    limit: PAGE_SIZE,
  });
  const staffList = staffData?.data ?? [];
  const totalStaff = staffData?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalStaff / PAGE_SIZE));

  const { data: shiftTypes = [] } = useGetShiftTypesQuery();
  const shiftTypeColor = useMemo(() => {
    const map = {};
    shiftTypes.forEach((st, index) => {
      map[st.shiftTypeId] = BADGE_COLORS[index % BADGE_COLORS.length];
    });
    return map;
  }, [shiftTypes]);

  const { data: assignments = [], isFetching: isFetchingAssignments } =
    useGetShiftAssignmentsQuery({ from: fromKey, to: toKey });
  const [deleteShiftAssignment, { isLoading: isRemoving }] =
    useDeleteShiftAssignmentMutation();
  const [copyShiftWeek, { isLoading: isCopying }] = useCopyShiftWeekMutation();

  const assignmentsByCell = useMemo(() => {
    const map = {};
    for (const assignment of assignments) {
      const key = `${assignment.staff.userId}_${assignment.workDate}`;
      if (!map[key]) map[key] = [];
      map[key].push(assignment);
    }
    return map;
  }, [assignments]);

  const isLoading = isFetchingStaff || isFetchingAssignments;

  // Danh sách nhân viên không đổi theo tuần -> đổi tuần không cần reset trang.
  const goToWeek = (deltaDays) => setWeekStart((prev) => addDays(prev, deltaDays));

  const handleConfirmRemove = async () => {
    if (!removeTarget) return;
    try {
      await deleteShiftAssignment(removeTarget.shiftAssignmentId).unwrap();
      toast.success('Đã gỡ lịch phân ca');
      setRemoveTarget(null);
    } catch (err) {
      toast.error(err.message || 'Không thể gỡ lịch phân ca');
    }
  };

  const handleConfirmCopy = async () => {
    try {
      const res = await copyShiftWeek({
        sourceWeekStart: prevWeekStart,
        targetWeekStart: fromKey,
      }).unwrap();
      toast.success(
        `Đã sao chép ${res.created} ca` +
          (res.skipped ? ` (bỏ qua ${res.skipped} ca trùng hoặc quá khứ)` : ''),
      );
      setCopyConfirmOpen(false);
    } catch (err) {
      toast.error(err.message || 'Không thể sao chép lịch tuần trước');
    }
  };

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Phân ca nhân viên</h1>
        <button
          type="button"
          onClick={() => setManagingTypes(true)}
          className="flex items-center gap-2 rounded-xl bg-gray-100 px-4 py-2.5 text-sm font-bold text-gray-700 transition-colors hover:bg-gray-200"
        >
          <Settings2 size={16} /> Quản lý loại ca
        </button>
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => goToWeek(-7)}
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
            onClick={() => goToWeek(7)}
            className="rounded-lg border border-gray-200 p-1.5 hover:bg-gray-50"
            aria-label="Tuần sau"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCopyConfirmOpen(true)}
            disabled={isCopying}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-60"
          >
            {isCopying ? <Loader2 size={14} className="animate-spin" /> : <Copy size={14} />}
            Sao chép tuần trước
          </button>
          <button
            type="button"
            onClick={() => setWeekStart(getMonday(new Date()))}
            className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-200"
          >
            Tuần này
          </button>
        </div>
      </div>

      {shiftTypes.length === 0 && (
        <p className="mb-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-700">
          Chưa có loại ca nào — bấm "Quản lý loại ca" để thêm trước khi phân ca cho nhân viên.
        </p>
      )}

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full min-w-[900px] table-fixed text-left text-sm">
          <thead className="bg-gray-50 text-xs font-bold uppercase tracking-wide text-gray-500">
            <tr>
              <th className="w-40 px-4 py-3">Nhân viên</th>
              {weekDates.map((date, index) => {
                const past = isPastDateKey(toDateKey(date));
                return (
                  <th
                    key={toDateKey(date)}
                    className={`px-2 py-3 text-center ${past ? 'text-gray-300' : ''}`}
                  >
                    <div>{WEEKDAY_LABELS[index]}</div>
                    <div
                      className={`font-normal normal-case ${past ? 'text-gray-300' : 'text-gray-400'}`}
                    >
                      {formatShortDate(date)}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-gray-400">
                  <Loader2 className="mx-auto animate-spin" size={22} />
                </td>
              </tr>
            )}

            {!isLoading && staffList.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-gray-400">
                  Chưa có nhân viên nào — thêm nhân viên ở mục "Quản lý nhân viên" trước.
                </td>
              </tr>
            )}

            {!isLoading &&
              staffList.map((staff) => (
                <tr key={staff.userId}>
                  <td className="px-4 py-3 align-top font-semibold text-gray-900">
                    {staff.fullName}
                  </td>
                  {weekDates.map((date) => {
                    const dateKey = toDateKey(date);
                    const past = isPastDateKey(dateKey);
                    const cellAssignments =
                      assignmentsByCell[`${staff.userId}_${dateKey}`] ?? [];
                    return (
                      <td
                        key={dateKey}
                        className={`px-2 py-2 align-top ${past ? 'bg-gray-50/70' : ''}`}
                      >
                        <div className="flex min-h-[2.5rem] flex-col gap-1">
                          {cellAssignments.map((assignment) => (
                            <span
                              key={assignment.shiftAssignmentId}
                              title={assignment.note || undefined}
                              className={`flex items-center justify-between gap-1 rounded-lg border px-2 py-1 text-xs font-semibold ${
                                shiftTypeColor[assignment.shiftType.shiftTypeId] ??
                                'border-gray-200 bg-gray-50 text-gray-600'
                              } ${past ? 'opacity-70' : ''}`}
                            >
                              <span className="flex min-w-0 items-center gap-1">
                                {assignment.note && (
                                  <FileText size={11} className="shrink-0 opacity-70" />
                                )}
                                <span className="truncate">{assignment.shiftType.name}</span>
                              </span>
                              {!past && (
                                <button
                                  type="button"
                                  onClick={() => setRemoveTarget(assignment)}
                                  className="shrink-0 opacity-60 hover:opacity-100"
                                  aria-label="Gỡ ca này"
                                >
                                  <X size={12} />
                                </button>
                              )}
                            </span>
                          ))}
                          {past
                            ? cellAssignments.length === 0 && (
                                <span className="py-1 text-center text-xs text-gray-300">—</span>
                              )
                            : (
                              <button
                                type="button"
                                onClick={() => setAssignTarget({ staff, workDate: dateKey })}
                                className="flex items-center justify-center gap-1 rounded-lg border border-dashed border-gray-200 py-1 text-xs text-gray-400 transition-colors hover:border-blue-300 hover:text-blue-600"
                              >
                                <Plus size={12} /> Phân ca
                              </button>
                            )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
        <span>Tổng {totalStaff} nhân viên</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="rounded-lg border border-gray-200 p-1.5 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft size={16} />
          </button>
          <span>
            Trang {page}/{totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="rounded-lg border border-gray-200 p-1.5 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <AssignShiftModal
        open={Boolean(assignTarget)}
        staff={assignTarget?.staff}
        workDate={assignTarget?.workDate}
        shiftTypes={shiftTypes}
        onClose={() => setAssignTarget(null)}
      />

      <ShiftTypeManagerModal open={managingTypes} onClose={() => setManagingTypes(false)} />

      <ConfirmModal
        open={Boolean(removeTarget)}
        danger
        title="Gỡ lịch phân ca"
        message={
          removeTarget
            ? `Gỡ ${removeTarget.staff.fullName} khỏi ca "${removeTarget.shiftType.name}" ngày ${new Date(
                removeTarget.workDate,
              ).toLocaleDateString('vi-VN')}?`
            : ''
        }
        confirmLabel="Gỡ ca"
        loading={isRemoving}
        onConfirm={handleConfirmRemove}
        onClose={() => setRemoveTarget(null)}
      />

      <ConfirmModal
        open={copyConfirmOpen}
        title="Sao chép lịch tuần trước"
        message={`Sao chép toàn bộ ca của tuần ${formatShortDate(
          addDays(weekStart, -7),
        )} - ${formatShortDate(addDays(weekStart, -1))} vào tuần ${formatShortDate(
          weekDates[0],
        )} - ${formatShortDate(weekDates[6])}? Các ca trùng hoặc rơi vào ngày đã qua sẽ được bỏ qua.`}
        confirmLabel="Sao chép"
        loading={isCopying}
        onConfirm={handleConfirmCopy}
        onClose={() => setCopyConfirmOpen(false)}
      />
    </>
  );
}
