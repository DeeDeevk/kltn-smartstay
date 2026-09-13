import { useMemo, useState } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ArrowDown, ArrowUp, Info, Loader2, Search, X } from 'lucide-react';
import formatCurrency from '../../../utils/formatCurrency';
import { useGetRevenueByStaffQuery } from '../../../services/revenue';
import PeriodFilterBar from './PeriodFilterBar';
import { formatCurrencyShort, resolvePeriod } from './periodUtils';

// Chỉ nhân viên đang được chọn để so sánh mới có màu riêng, nên số màu không phụ
// thuộc số lượng nhân viên.
const MAX_SELECTED = 3;
const SELECTED_COLORS = ['#2563eb', '#f59e0b', '#10b981'];
const TOTAL_LINE_COLOR = '#94a3b8';

const TABLE_COLUMNS = [
  { key: 'fullName', label: 'Nhân viên', align: 'left' },
  { key: 'roomRevenue', label: 'Tiền phòng' },
  { key: 'serviceRevenue', label: 'Dịch vụ' },
  { key: 'vatAmount', label: 'VAT' },
  { key: 'totalRevenue', label: 'Tổng doanh thu' },
  { key: 'roomNights', label: 'Đêm phòng' },
  { key: 'bookingCount', label: 'Lượt đặt' },
];

export default function RevenueByStaffPage() {
  const [period, setPeriod] = useState('month');
  const [offset, setOffset] = useState(0);
  const [selectedIds, setSelectedIds] = useState([]);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState({ key: 'totalRevenue', dir: 'desc' });

  const range = useMemo(() => resolvePeriod(period, offset), [period, offset]);
  const { data, isFetching, error } = useGetRevenueByStaffQuery({
    from: range.from,
    to: range.to,
    groupBy: range.groupBy,
  });

  const totals = data?.totals;
  // staffId = null là nhóm đơn chưa có nhân viên phụ trách (khách đặt online, chưa
  // check-in) — tách riêng, không xếp hạng chung với nhân viên thật.
  const staff = useMemo(() => (data?.staff ?? []).filter((s) => s.staffId), [data]);
  const unassigned = useMemo(() => (data?.staff ?? []).find((s) => !s.staffId), [data]);

  // Bỏ các lựa chọn không còn trong kỳ đang xem (vd. đổi sang tháng khác).
  const activeSelected = selectedIds.filter((id) => staff.some((s) => s.staffId === id));
  const colorOf = (staffId) => SELECTED_COLORS[activeSelected.indexOf(staffId)];

  const toggleSelected = (staffId) => {
    setSelectedIds((prev) => {
      const current = prev.filter((id) => staff.some((s) => s.staffId === id));
      if (current.includes(staffId)) return current.filter((id) => id !== staffId);
      if (current.length >= MAX_SELECTED) return current;
      return [...current, staffId];
    });
  };

  const chartData = useMemo(
    () =>
      (data?.series ?? []).map((bucket) => {
        const row = {
          label: bucket.label,
          total: bucket.items.reduce((sum, item) => sum + item.totalRevenue, 0),
        };
        for (const item of bucket.items) {
          if (item.staffId) row[item.staffId] = item.totalRevenue;
        }
        return row;
      }),
    [data],
  );

  const maxRevenue = Math.max(0, ...staff.map((s) => s.totalRevenue));

  const tableRows = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    const rows = keyword
      ? staff.filter((s) => s.fullName.toLowerCase().includes(keyword))
      : staff;
    return [...rows].sort((a, b) => {
      const av = a[sort.key];
      const bv = b[sort.key];
      const result = typeof av === 'string' ? av.localeCompare(bv, 'vi') : av - bv;
      return sort.dir === 'asc' ? result : -result;
    });
  }, [staff, search, sort]);

  const handleSort = (key) => {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: key === 'fullName' ? 'asc' : 'desc' },
    );
  };

  return (
    <>
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Doanh thu theo nhân viên</h1>

      <PeriodFilterBar
        period={period}
        onPeriodChange={setPeriod}
        offset={offset}
        onOffsetChange={setOffset}
        label={range.label}
      />

      {isFetching && (
        <div className="flex justify-center py-20 text-gray-300">
          <Loader2 className="animate-spin" size={30} />
        </div>
      )}

      {!isFetching && error && (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
          {error.message || 'Không tải được báo cáo doanh thu theo nhân viên'}
        </p>
      )}

      {!isFetching && !error && data && (
        <>
          <div className="mb-5 grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-medium text-gray-400">Tổng doanh thu kỳ này</p>
              <p className="text-xl font-bold text-blue-600">{formatCurrency(totals.totalRevenue)}</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-medium text-gray-400">Số nhân viên có doanh thu</p>
              <p className="text-xl font-bold text-gray-900">{staff.length}</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-medium text-gray-400">Lượt đặt / đêm phòng</p>
              <p className="text-xl font-bold text-gray-900">
                {totals.bookingCount} / {totals.roomNightsSold}
              </p>
            </div>
          </div>

          {unassigned && unassigned.totalRevenue > 0 && (
            <p className="mb-5 flex items-start gap-2 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500">
              <Info size={16} className="mt-0.5 shrink-0" />
              <span>
                Đơn chưa có nhân viên phụ trách (khách đặt online, chưa check-in):{' '}
                <span className="font-semibold text-gray-700">{formatCurrency(unassigned.totalRevenue)}</span>{' '}
                · {unassigned.bookingCount} lượt đặt. Khoản này có trong tổng doanh thu nhưng không tính cho nhân viên nào.
              </span>
            </p>
          )}

          <div className="grid gap-5 lg:grid-cols-5">
            {/* Theo thời gian: đường tổng + tối đa 3 nhân viên được chọn */}
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm lg:col-span-3">
              <h2 className="mb-1 text-sm font-bold uppercase tracking-wide text-gray-500">
                Doanh thu theo thời gian
              </h2>
              <p className="mb-3 text-xs text-gray-400">
                Chọn tối đa {MAX_SELECTED} nhân viên ở bảng xếp hạng để so sánh với tổng doanh thu.
              </p>

              {activeSelected.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-2">
                  {activeSelected.map((id) => {
                    const s = staff.find((item) => item.staffId === id);
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => toggleSelected(id)}
                        className="flex items-center gap-1.5 rounded-full border border-gray-200 px-2.5 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                      >
                        <span className="h-2 w-2 rounded-full" style={{ background: colorOf(id) }} />
                        {s?.fullName}
                        <X size={12} className="text-gray-400" />
                      </button>
                    );
                  })}
                </div>
              )}

              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={formatCurrencyShort} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(value, name) => [formatCurrency(value), name]} />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="total"
                    name="Tổng doanh thu"
                    stroke={TOTAL_LINE_COLOR}
                    strokeWidth={3}
                    dot={false}
                  />
                  {activeSelected.map((id) => (
                    <Line
                      key={id}
                      type="monotone"
                      dataKey={id}
                      name={staff.find((s) => s.staffId === id)?.fullName}
                      stroke={colorOf(id)}
                      strokeWidth={2}
                      dot={{ r: 2 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Xếp hạng: thanh ngang 1 màu, số lượng nhân viên nhiều chỉ làm danh sách dài thêm */}
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm lg:col-span-2">
              <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-gray-500">
                Xếp hạng nhân viên
              </h2>
              {staff.length === 0 ? (
                <p className="py-16 text-center text-sm text-gray-400">
                  Chưa có nhân viên nào có doanh thu trong kỳ này.
                </p>
              ) : (
                <ol className="max-h-[340px] space-y-1 overflow-y-auto pr-1">
                  {staff.map((s, index) => {
                    const selected = activeSelected.includes(s.staffId);
                    const disabled = !selected && activeSelected.length >= MAX_SELECTED;
                    const width = maxRevenue ? (s.totalRevenue / maxRevenue) * 100 : 0;
                    const share = totals.totalRevenue ? (s.totalRevenue / totals.totalRevenue) * 100 : 0;
                    return (
                      <li key={s.staffId}>
                        <button
                          type="button"
                          onClick={() => toggleSelected(s.staffId)}
                          disabled={disabled}
                          title={disabled ? `Chỉ chọn được tối đa ${MAX_SELECTED} nhân viên` : 'Bấm để so sánh trên biểu đồ'}
                          className={`w-full rounded-lg px-2 py-1.5 text-left transition-colors ${
                            selected ? 'bg-blue-50' : 'hover:bg-gray-50'
                          } disabled:cursor-not-allowed disabled:opacity-60`}
                        >
                          <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                            <span className="flex min-w-0 items-center gap-1.5 font-semibold text-gray-800">
                              <span className="w-5 shrink-0 text-gray-400">{index + 1}.</span>
                              {selected && (
                                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: colorOf(s.staffId) }} />
                              )}
                              <span className="truncate">{s.fullName}</span>
                            </span>
                            <span className="shrink-0 font-bold text-gray-900">
                              {formatCurrencyShort(s.totalRevenue)}
                              <span className="ml-1 font-normal text-gray-400">{share.toFixed(0)}%</span>
                            </span>
                          </div>
                          <div className="ml-6 h-2 rounded-full bg-gray-100">
                            <div className="h-2 rounded-full bg-blue-500" style={{ width: `${width}%` }} />
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>
          </div>

          {/* Bảng chi tiết: sắp xếp theo cột + tìm theo tên */}
          <div className="mt-5 rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3">
              <Search size={16} className="text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm nhân viên..."
                className="w-full text-sm outline-none placeholder:text-gray-400"
              />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="bg-gray-50 text-xs font-bold uppercase tracking-wide text-gray-500">
                  <tr>
                    {TABLE_COLUMNS.map((col) => (
                      <th key={col.key} className={`px-4 py-3 ${col.align === 'left' ? '' : 'text-right'}`}>
                        <button
                          type="button"
                          onClick={() => handleSort(col.key)}
                          className={`inline-flex items-center gap-1 uppercase hover:text-gray-800 ${
                            sort.key === col.key ? 'text-gray-800' : ''
                          }`}
                        >
                          {col.label}
                          {sort.key === col.key &&
                            (sort.dir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {tableRows.length === 0 && (
                    <tr>
                      <td colSpan={TABLE_COLUMNS.length} className="px-4 py-10 text-center text-gray-400">
                        {search ? 'Không tìm thấy nhân viên phù hợp.' : 'Không có dữ liệu trong kỳ này.'}
                      </td>
                    </tr>
                  )}
                  {tableRows.map((s) => (
                    <tr key={s.staffId} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-semibold text-gray-900">{s.fullName}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{formatCurrency(s.roomRevenue)}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{formatCurrency(s.serviceRevenue)}</td>
                      <td className="px-4 py-3 text-right text-gray-400">{formatCurrency(s.vatAmount)}</td>
                      <td className="px-4 py-3 text-right font-bold text-blue-600">{formatCurrency(s.totalRevenue)}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{s.roomNights}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{s.bookingCount}</td>
                    </tr>
                  ))}
                  {unassigned && !search && (
                    <tr className="bg-gray-50/60 text-gray-400">
                      <td className="px-4 py-3 italic">Chưa có nhân viên phụ trách</td>
                      <td className="px-4 py-3 text-right">{formatCurrency(unassigned.roomRevenue)}</td>
                      <td className="px-4 py-3 text-right">{formatCurrency(unassigned.serviceRevenue)}</td>
                      <td className="px-4 py-3 text-right">{formatCurrency(unassigned.vatAmount)}</td>
                      <td className="px-4 py-3 text-right font-semibold">{formatCurrency(unassigned.totalRevenue)}</td>
                      <td className="px-4 py-3 text-right">{unassigned.roomNights}</td>
                      <td className="px-4 py-3 text-right">{unassigned.bookingCount}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </>
  );
}
