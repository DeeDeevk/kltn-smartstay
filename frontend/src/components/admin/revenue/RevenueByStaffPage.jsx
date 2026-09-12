import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Loader2 } from 'lucide-react';
import formatCurrency from '../../../utils/formatCurrency';
import { useGetRevenueByStaffQuery } from '../../../services/revenue';
import PeriodFilterBar from './PeriodFilterBar';
import { formatCurrencyShort, resolvePeriod } from './periodUtils';

const STAFF_COLORS = [
  '#2563eb',
  '#f59e0b',
  '#10b981',
  '#6366f1',
  '#f43f5e',
  '#06b6d4',
  '#a855f7',
  '#84cc16',
];

export default function RevenueByStaffPage() {
  const [period, setPeriod] = useState('month');
  const [offset, setOffset] = useState(0);

  const range = useMemo(() => resolvePeriod(period, offset), [period, offset]);
  const { data, isFetching, error } = useGetRevenueByStaffQuery({
    from: range.from,
    to: range.to,
    groupBy: range.groupBy,
  });

  const staff = data?.staff ?? [];
  const totals = data?.totals;

  // Chuyển series (mỗi mốc có mảng items) sang dạng phẳng cho biểu đồ cột nhóm:
  // { label, '<staffId>': doanhThu, ... }
  const chartData = useMemo(
    () =>
      (data?.series ?? []).map((bucket) => {
        const row = { label: bucket.label };
        for (const item of bucket.items) {
          row[item.staffId ?? 'unassigned'] = item.totalRevenue;
        }
        return row;
      }),
    [data],
  );

  const pieData = staff.filter((s) => s.totalRevenue > 0);

  return (
    <>
      <h1 className="mb-6 text-2xl font-bold text-gray-900">
        Doanh thu theo nhân viên
      </h1>

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
              <p className="text-xl font-bold text-blue-600">
                {formatCurrency(totals.totalRevenue)}
              </p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-medium text-gray-400">Số nhân viên có doanh thu</p>
              <p className="text-xl font-bold text-gray-900">{totals.staffCount}</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-medium text-gray-400">Lượt đặt / đêm phòng</p>
              <p className="text-xl font-bold text-gray-900">
                {totals.bookingCount} / {totals.roomNightsSold}
              </p>
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            {/* Biểu đồ cột nhóm: doanh thu từng nhân viên theo mốc thời gian */}
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm lg:col-span-2">
              <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-gray-500">
                Doanh thu từng nhân viên theo thời gian
              </h2>
              {staff.length === 0 ? (
                <p className="py-16 text-center text-sm text-gray-400">
                  Chưa có doanh thu trong kỳ này.
                </p>
              ) : (
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={formatCurrencyShort} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(value, name) => [formatCurrency(value), name]} />
                    <Legend />
                    {staff.map((s, index) => (
                      <Bar
                        key={s.staffId ?? 'unassigned'}
                        dataKey={s.staffId ?? 'unassigned'}
                        name={s.fullName}
                        fill={STAFF_COLORS[index % STAFF_COLORS.length]}
                        radius={[4, 4, 0, 0]}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Biểu đồ tròn: tỉ trọng đóng góp của từng nhân viên */}
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-gray-500">
                Tỉ trọng đóng góp
              </h2>
              {pieData.length === 0 ? (
                <p className="py-16 text-center text-sm text-gray-400">
                  Chưa có dữ liệu.
                </p>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="totalRevenue"
                      nameKey="fullName"
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={90}
                    >
                      {pieData.map((entry, index) => (
                        <Cell
                          key={entry.staffId ?? 'unassigned'}
                          fill={STAFF_COLORS[index % STAFF_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatCurrency(value)} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Bảng chi tiết */}
          <div className="mt-5 overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-gray-50 text-xs font-bold uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3">Nhân viên</th>
                  <th className="px-4 py-3 text-right">Tiền phòng</th>
                  <th className="px-4 py-3 text-right">Dịch vụ</th>
                  <th className="px-4 py-3 text-right">VAT</th>
                  <th className="px-4 py-3 text-right">Tổng doanh thu</th>
                  <th className="px-4 py-3 text-right">Đêm phòng</th>
                  <th className="px-4 py-3 text-right">Lượt đặt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {staff.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-gray-400">
                      Không có dữ liệu trong kỳ này.
                    </td>
                  </tr>
                )}
                {staff.map((s, index) => (
                  <tr key={s.staffId ?? 'unassigned'} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-semibold text-gray-900">
                      <span className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ background: STAFF_COLORS[index % STAFF_COLORS.length] }}
                        />
                        {s.fullName}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">
                      {formatCurrency(s.roomRevenue)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">
                      {formatCurrency(s.serviceRevenue)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-400">
                      {formatCurrency(s.vatAmount)}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-blue-600">
                      {formatCurrency(s.totalRevenue)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">{s.roomNights}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{s.bookingCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
