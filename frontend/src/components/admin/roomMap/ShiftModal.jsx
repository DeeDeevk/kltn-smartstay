import { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import {
  Banknote,
  CalendarClock,
  Loader2,
  ReceiptText,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import Modal from '../../common/Modal';
import shiftAPI from '../../../services/shift';
import formatCurrency from '../../../utils/formatCurrency';

const TITLES = {
  list: 'Danh sách ca làm việc',
  info: 'Thông tin ca hiện tại',
  revenue: 'Doanh thu ca hiện tại',
  end: 'Kết ca',
};

function fmtTime(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Cụm "Ca" trong Sơ đồ phòng. Module /shifts thuộc phần của Khoa và backend chưa
// có -> tạm nối vào services/shift.js (mock). Khi có API thật chỉ cần đổi layer đó.
export default function ShiftModal({ mode, open, onClose, onShiftEnded }) {
  const [loading, setLoading] = useState(false);
  const [shifts, setShifts] = useState([]);
  const [report, setReport] = useState(null);
  const [actualCash, setActualCash] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const currentShift = useMemo(
    () => shifts.find((s) => s.status === 'open') ?? null,
    [shifts],
  );

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setLoading(true);
    setActualCash('');
    setNote('');

    (async () => {
      try {
        const list = await shiftAPI.getAllShifts();
        if (!alive) return;
        const rows = list?.data ?? [];
        setShifts(rows);

        if (mode !== 'list') {
          const openShift = rows.find((s) => s.status === 'open');
          if (openShift) {
            const res = await shiftAPI.getShiftReport(openShift.id);
            if (alive) setReport(res?.data ?? null);
          } else {
            setReport(null);
          }
        }
      } catch {
        if (alive) toast.error('Không tải được dữ liệu ca làm việc');
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [open, mode]);

  const expected = report?.revenue?.expected_cash_in_drawer ?? 0;
  const diff = actualCash === '' ? null : Number(actualCash) - expected;

  const handleEndShift = async (e) => {
    e.preventDefault();
    if (!currentShift) return;
    setSubmitting(true);
    try {
      await shiftAPI.endShift(currentShift.id, Number(actualCash || 0), note);
      toast.success('Chốt ca thành công');
      onShiftEnded?.();
      onClose();
    } catch {
      toast.error('Không thể kết ca');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={TITLES[mode] ?? 'Ca làm việc'}
      size="lg"
    >
      {loading ? (
        <div className="flex justify-center py-16 text-gray-400">
          <Loader2 className="animate-spin" size={28} />
        </div>
      ) : mode === 'list' ? (
        <ShiftList shifts={shifts} />
      ) : mode === 'end' ? (
        <EndShiftForm
          currentShift={currentShift}
          report={report}
          expected={expected}
          actualCash={actualCash}
          setActualCash={setActualCash}
          note={note}
          setNote={setNote}
          diff={diff}
          submitting={submitting}
          onSubmit={handleEndShift}
          onCancel={onClose}
        />
      ) : (
        <ShiftReport report={report} currentShift={currentShift} />
      )}
    </Modal>
  );
}

function ShiftList({ shifts }) {
  if (shifts.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-gray-400">
        Chưa có ca làm việc nào.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wider text-gray-400">
            <th className="py-2 pr-3 font-semibold">Nhân viên</th>
            <th className="py-2 pr-3 font-semibold">Bắt đầu</th>
            <th className="py-2 pr-3 font-semibold">Kết thúc</th>
            <th className="py-2 pr-3 text-right font-semibold">Tiền đầu ca</th>
            <th className="py-2 pr-3 text-right font-semibold">Tiền bàn giao</th>
            <th className="py-2 text-right font-semibold">Trạng thái</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {shifts.map((s) => (
            <tr key={s.id} className="text-gray-700">
              <td className="py-2.5 pr-3 font-medium capitalize">
                {s.staff_name}
              </td>
              <td className="py-2.5 pr-3 text-gray-500">
                {fmtTime(s.start_time)}
              </td>
              <td className="py-2.5 pr-3 text-gray-500">
                {fmtTime(s.end_time)}
              </td>
              <td className="py-2.5 pr-3 text-right">
                {formatCurrency(s.initial_cash ?? 0)}
              </td>
              <td className="py-2.5 pr-3 text-right">
                {s.actual_cash_handover != null
                  ? formatCurrency(s.actual_cash_handover)
                  : '—'}
              </td>
              <td className="py-2.5 text-right">
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                    s.status === 'open'
                      ? 'bg-emerald-50 text-emerald-600'
                      : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {s.status === 'open' ? 'Đang mở' : 'Đã đóng'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ShiftReport({ report, currentShift }) {
  if (!report || !currentShift) {
    return (
      <p className="py-10 text-center text-sm text-gray-400">
        Hiện không có ca nào đang mở.
      </p>
    );
  }
  const rev = report.revenue ?? {};
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-100 bg-gray-50 p-4">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <CalendarClock size={15} className="text-gray-400" />
          Mở lúc {fmtTime(report.shift_info?.start_time)}
        </div>
        <span className="text-sm font-semibold capitalize text-gray-800">
          {report.shift_info?.staff?.username ?? currentShift.staff_name}
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile
          icon={Wallet}
          label="Tiền đầu ca"
          value={formatCurrency(rev.start_cash ?? 0)}
          tone="text-gray-900"
        />
        <StatTile
          icon={TrendingUp}
          label="Doanh thu hệ thống"
          value={formatCurrency(rev.total_system_revenue ?? 0)}
          tone="text-emerald-600"
        />
        <StatTile
          icon={Banknote}
          label="Dự kiến trong két"
          value={formatCurrency(rev.expected_cash_in_drawer ?? 0)}
          tone="text-blue-600"
        />
      </div>

      <div className="flex items-center gap-2 rounded-xl border border-gray-100 p-4 text-sm text-gray-600">
        <ReceiptText size={15} className="text-gray-400" />
        {report.activities?.total_bookings ?? 0} lượt đặt phòng phát sinh trong ca.
      </div>
    </div>
  );
}

function EndShiftForm({
  currentShift,
  report,
  expected,
  actualCash,
  setActualCash,
  note,
  setNote,
  diff,
  submitting,
  onSubmit,
  onCancel,
}) {
  if (!currentShift) {
    return (
      <p className="py-10 text-center text-sm text-gray-400">
        Không có ca nào đang mở để kết.
      </p>
    );
  }
  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <StatTile
          icon={Wallet}
          label="Tiền đầu ca"
          value={formatCurrency(report?.revenue?.start_cash ?? 0)}
          tone="text-gray-900"
        />
        <StatTile
          icon={Banknote}
          label="Dự kiến trong két"
          value={formatCurrency(expected)}
          tone="text-blue-600"
        />
      </div>

      <label className="block">
        <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-400">
          Tiền mặt thực đếm
        </span>
        <input
          type="number"
          min="0"
          required
          value={actualCash}
          onChange={(e) => setActualCash(e.target.value)}
          placeholder="Nhập số tiền kiểm kê được"
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
        />
      </label>

      {diff !== null && (
        <div
          className={`rounded-lg px-3 py-2 text-sm font-medium ${
            diff === 0
              ? 'bg-emerald-50 text-emerald-600'
              : 'bg-amber-50 text-amber-700'
          }`}
        >
          {diff === 0
            ? 'Khớp với số dự kiến.'
            : `Chênh lệch ${diff > 0 ? '+' : ''}${formatCurrency(diff)} so với dự kiến.`}
        </div>
      )}

      <label className="block">
        <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-400">
          Ghi chú
        </span>
        <textarea
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Ghi chú bàn giao ca (không bắt buộc)"
          className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
        />
      </label>

      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50"
        >
          Huỷ
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
        >
          {submitting && <Loader2 size={15} className="animate-spin" />}
          Xác nhận kết ca
        </button>
      </div>
    </form>
  );
}

function StatTile({ icon: Icon, label, value, tone }) {
  return (
    <div className="rounded-xl border border-gray-100 p-3">
      <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-gray-400">
        <Icon size={13} /> {label}
      </div>
      <p className={`text-lg font-bold ${tone}`}>{value}</p>
    </div>
  );
}
