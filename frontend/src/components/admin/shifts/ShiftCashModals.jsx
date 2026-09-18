import { useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'react-toastify';
import Modal from '../../common/Modal';
import formatCurrency from '../../../utils/formatCurrency';
import {
  useCheckInShiftAssignmentMutation,
  useCheckOutShiftAssignmentMutation,
  useGetMyShiftAssignmentsQuery,
  useGetShiftReportQuery,
} from '../../../services/shiftAssignment';
import { addDays, todayKey, toDateKey } from './dateUtils';

const METHOD_LABELS = { CASH: 'Tiền mặt', PAYOS: 'PayOS' };

// Ô nhập tiền: chỉ giữ chữ số, hiển thị có dấu chấm ngăn cách hàng nghìn.
function MoneyInput({ value, onChange, autoFocus }) {
  return (
    <div className="relative">
      <input
        type="text"
        inputMode="numeric"
        autoFocus={autoFocus}
        value={value === '' ? '' : Number(value).toLocaleString('vi-VN')}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, ''))}
        placeholder="0"
        className="w-full rounded-xl border border-gray-200 px-3 py-2.5 pr-8 text-right text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">đ</span>
    </div>
  );
}

function Row({ label, value, strong, hint }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2">
      <div>
        <p className={strong ? 'font-semibold text-gray-900' : 'text-gray-500'}>{label}</p>
        {hint && <p className="text-xs text-gray-400">{hint}</p>}
      </div>
      <p className={strong ? 'text-base font-bold text-gray-900' : 'font-semibold text-gray-700'}>{value}</p>
    </div>
  );
}

export function ShiftCheckInModal({ assignment, open, onClose }) {
  const [openingCash, setOpeningCash] = useState('');
  const [checkIn, { isLoading }] = useCheckInShiftAssignmentMutation();

  // Tiền kết ca của ca gần nhất — chỉ để hiện tham khảo khi nhân viên đếm tiền
  // thật trong két, KHÔNG tự điền vào ô nhập (phải tự đếm và tự gõ số, xem lý
  // do ở phần trao đổi trước đó: tránh sai số bị "chuyển tiếp" âm thầm qua ca).
  const lookbackFrom = toDateKey(addDays(new Date(), -14));
  const { data: recentAssignments = [] } = useGetMyShiftAssignmentsQuery(
    { from: lookbackFrom, to: todayKey() },
    { skip: !open },
  );
  const previousClosingCash = useMemo(() => {
    const closed = recentAssignments
      .filter(
        (a) =>
          a.shiftAssignmentId !== assignment?.shiftAssignmentId &&
          a.closingCash !== null &&
          a.checkOutAt,
      )
      .sort((a, b) => new Date(b.checkOutAt) - new Date(a.checkOutAt));
    return closed[0]?.closingCash ?? null;
  }, [recentAssignments, assignment]);

  const handleClose = () => {
    setOpeningCash('');
    onClose();
  };

  const handleSubmit = async () => {
    if (openingCash === '') {
      toast.error('Vui lòng nhập số tiền có trong két lúc vô ca');
      return;
    }
    try {
      await checkIn({
        shiftAssignmentId: assignment.shiftAssignmentId,
        openingCash: Number(openingCash),
      }).unwrap();
      toast.success(`Đã vô ca "${assignment.shiftType.name}"`);
      handleClose();
    } catch (err) {
      toast.error(err.message || 'Không thể vô ca');
    }
  };

  return (
    <Modal
      open={open && Boolean(assignment)}
      onClose={handleClose}
      title="Vô ca"
      footer={
        <>
          <button type="button" onClick={handleClose} className="rounded-xl px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100">
            Hủy
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isLoading}
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-70"
          >
            {isLoading && <Loader2 size={16} className="animate-spin" />}
            Xác nhận vô ca
          </button>
        </>
      }
    >
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <label className="block text-sm font-semibold text-gray-700">Tiền mặt có trong két lúc vô ca</label>
        {previousClosingCash !== null && (
          <span className="shrink-0 text-xs text-gray-400">
            Ca trước kết ca: <span className="font-semibold text-gray-500">{formatCurrency(previousClosingCash)}</span>
          </span>
        )}
      </div>
      <MoneyInput value={openingCash} onChange={setOpeningCash} autoFocus />
      <p className="mt-2 text-xs text-gray-500">
        Đếm tiền trong két trước khi nhận ca. Số này là mốc để chốt két lúc kết ca.
        {previousClosingCash !== null && ' Đối chiếu với số ca trước ở trên, nếu lệch nhiều hãy báo lại trước khi xác nhận.'}
      </p>
    </Modal>
  );
}

export function ShiftCheckOutModal({ assignment, open, onClose }) {
  const [closingCash, setClosingCash] = useState('');
  const [checkOut, { isLoading }] = useCheckOutShiftAssignmentMutation();
  // Luôn lấy số mới khi mở modal — tiền thu trong ca thay đổi theo từng lần check-in/check-out khách.
  const { data, isFetching } = useGetShiftReportQuery(assignment?.shiftAssignmentId, {
    skip: !open || !assignment,
    refetchOnMountOrArgChange: true,
  });
  const report = data?.report;

  const difference = closingCash === '' || !report ? null : Number(closingCash) - report.expectedCash;

  const handleClose = () => {
    setClosingCash('');
    onClose();
  };

  const handleSubmit = async () => {
    if (closingCash === '') {
      toast.error('Vui lòng nhập số tiền đếm được trong két');
      return;
    }
    try {
      await checkOut({
        shiftAssignmentId: assignment.shiftAssignmentId,
        closingCash: Number(closingCash),
      }).unwrap();
      toast.success(`Đã kết ca "${assignment.shiftType.name}"`);
      handleClose();
    } catch (err) {
      toast.error(err.message || 'Không thể kết ca');
    }
  };

  return (
    <Modal
      open={open && Boolean(assignment)}
      onClose={handleClose}
      title="Kết ca & chốt két"
      size="lg"
      footer={
        <>
          <button type="button" onClick={handleClose} className="rounded-xl px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100">
            Hủy
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isLoading || isFetching}
            className="flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-sm font-bold text-white hover:bg-amber-600 disabled:opacity-70"
          >
            {isLoading && <Loader2 size={16} className="animate-spin" />}
            Xác nhận kết ca
          </button>
        </>
      }
    >
      {isFetching || !report ? (
        <div className="flex justify-center py-10 text-gray-300">
          <Loader2 className="animate-spin" size={24} />
        </div>
      ) : (
        <div className="space-y-5 text-sm">
          <div className="divide-y divide-gray-100 rounded-xl border border-gray-200 px-4">
            <Row label="Tiền đầu ca" value={formatCurrency(report.openingCash)} />
            <Row label="Tiền mặt thu trong ca" value={`+ ${formatCurrency(report.cashCollected)}`} />
            <Row label="Tiền dự kiến trong két" value={formatCurrency(report.expectedCash)} strong />
            <Row
              label="Chuyển khoản / PayOS trong ca"
              value={formatCurrency(report.transferCollected)}
              hint="Không vào két, không tính vào tiền dự kiến"
            />
          </div>

          <div>
            <p className="mb-2 font-semibold text-gray-700">Các khoản đã thu ({report.transactions.length})</p>
            {report.transactions.length === 0 ? (
              <p className="text-xs italic text-gray-400">Chưa thu khoản nào trong ca này.</p>
            ) : (
              <ul className="max-h-48 divide-y divide-gray-100 overflow-y-auto rounded-xl border border-gray-100">
                {report.transactions.map((t) => (
                  <li key={t.paymentTransactionId} className="flex items-center justify-between gap-3 px-3 py-2 text-xs">
                    <span className="text-gray-600">
                      {new Date(t.collectedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                      {' · '}
                      {t.roomNumber ? `Phòng ${t.roomNumber}` : 'Chưa gán phòng'}
                      {t.guestName ? ` · ${t.guestName}` : ''}
                    </span>
                    <span className="shrink-0 font-semibold text-gray-800">
                      {formatCurrency(t.amount)}{' '}
                      <span className="font-normal text-gray-400">({METHOD_LABELS[t.method] ?? t.method})</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <label className="mb-1.5 block font-semibold text-gray-700">Tiền đếm được thực tế trong két</label>
            <MoneyInput value={closingCash} onChange={setClosingCash} autoFocus />
            {difference !== null && (
              <p
                className={`mt-2 font-semibold ${
                  difference === 0 ? 'text-green-600' : difference > 0 ? 'text-amber-600' : 'text-red-600'
                }`}
              >
                {difference === 0
                  ? 'Khớp với tiền dự kiến'
                  : `${difference > 0 ? 'Thừa' : 'Thiếu'} ${formatCurrency(Math.abs(difference))} so với tiền dự kiến`}
              </p>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

// Dòng tóm tắt tiền đã thu của 1 ca (dùng trên thẻ "Ca hôm nay" / thông tin ca).
export function ShiftCashSummary({ assignment, className = '' }) {
  const enabled = assignment && assignment.status !== 'SCHEDULED' && assignment.status !== 'ABSENT';
  const { data } = useGetShiftReportQuery(assignment?.shiftAssignmentId, {
    skip: !enabled,
    refetchOnMountOrArgChange: true,
  });
  const report = data?.report;
  if (!enabled || !report) return null;

  return (
    <p className={`text-xs text-gray-500 ${className}`}>
      Đầu ca {formatCurrency(report.openingCash)} · Tiền mặt thu {formatCurrency(report.cashCollected)} · PayOS{' '}
      {formatCurrency(report.transferCollected)}
      {report.difference !== null && (
        <span className={report.difference === 0 ? 'text-green-600' : 'text-red-600'}>
          {' '}
          · {report.difference === 0 ? 'Két khớp' : `Lệch ${formatCurrency(report.difference)}`}
        </span>
      )}
    </p>
  );
}
