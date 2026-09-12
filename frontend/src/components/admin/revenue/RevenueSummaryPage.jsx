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
import { BedDouble, Loader2, Percent, TrendingUp, Wallet } from 'lucide-react';
import formatCurrency from '../../../utils/formatCurrency';
import { useGetRevenueSummaryQuery } from '../../../services/revenue';
import PeriodFilterBar from './PeriodFilterBar';
import { formatCurrencyShort, resolvePeriod } from './periodUtils';

const PIE_COLORS = ['#2563eb', '#f59e0b', '#6366f1', '#10b981', '#f43f5e', '#06b6d4'];

function StatCard({ icon: Icon, label, value, hint, tone = 'text-gray-900' }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-gray-400">
        <Icon size={14} /> {label}
      </div>
      <p className={`text-xl font-bold ${tone}`}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-gray-400">{hint}</p>}
    </div>
  );
}

export default function RevenueSummaryPage() {
  const [period, setPeriod] = useState('month');
  const [offset, setOffset] = useState(0);

  const range = useMemo(() => resolvePeriod(period, offset), [period, offset]);
  const { data, isFetching, error } = useGetRevenueSummaryQuery({
    from: range.from,
    to: range.to,
    groupBy: range.groupBy,
  });

  const totals = data?.totals;
  const metrics = data?.metrics;
  const series = data?.series ?? [];
  const byRoomType = (data?.byRoomType ?? []).filter((r) => r.totalRevenue > 0);

  return (
    <>
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Báo cáo doanh thu</h1>

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
          {error.message || 'Không tải được báo cáo doanh thu'}
        </p>
      )}

      {!isFetching && !error && data && (
        <>
          <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              icon={Wallet}
              label="Tổng doanh thu"
              value={formatCurrency(totals.totalRevenue)}
              hint={`Tiền phòng ${formatCurrency(totals.roomRevenue)} · Dịch vụ ${formatCurrency(totals.serviceRevenue)}`}
              tone="text-blue-600"
            />
            <StatCard
              icon={BedDouble}
              label="Đêm phòng đã bán"
              value={totals.roomNightsSold.toLocaleString('vi-VN')}
              hint={`${totals.bookingCount} lượt đặt · ${metrics.totalRooms} phòng`}
            />
            <StatCard
              icon={Percent}
              label="Công suất phòng"
              value={`${(metrics.occupancyRate * 100).toFixed(1)}%`}
              hint={`${totals.roomNightsSold}/${metrics.availableRoomNights} đêm-phòng`}
              tone="text-emerald-600"
            />
            <StatCard
              icon={TrendingUp}
              label="ADR / RevPAR"
              value={`${formatCurrencyShort(metrics.adr)} / ${formatCurrencyShort(metrics.revpar)}`}
              hint="Giá bán TB mỗi phòng / doanh thu trên mỗi phòng hiện có"
              tone="text-indigo-600"
            />
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            {/* Biểu đồ cột: doanh thu theo thời gian */}
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm lg:col-span-2">
              <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-gray-500">
                Doanh thu theo thời gian
              </h2>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={series}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={formatCurrencyShort} tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(value, name) => [formatCurrency(value), name]}
                    labelFormatter={(l) => `Mốc: ${l}`}
                  />
                  <Legend />
                  <Bar dataKey="roomRevenue" name="Tiền phòng" stackId="a" fill="#2563eb" />
                  <Bar dataKey="serviceRevenue" name="Dịch vụ" stackId="a" fill="#f59e0b" />
                  <Bar dataKey="vatAmount" name="VAT" stackId="a" fill="#cbd5e1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Biểu đồ tròn: cơ cấu doanh thu theo loại phòng */}
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-gray-500">
                Cơ cấu theo loại phòng
              </h2>
              {byRoomType.length === 0 ? (
                <p className="py-16 text-center text-sm text-gray-400">
                  Chưa có doanh thu trong kỳ này.
                </p>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={230}>
                    <PieChart>
                      <Pie
                        data={byRoomType}
                        dataKey="totalRevenue"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={85}
                      >
                        {byRoomType.map((entry, index) => (
                          <Cell key={entry.roomTypeId} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => formatCurrency(value)} />
                    </PieChart>
                  </ResponsiveContainer>
                  <ul className="mt-2 space-y-1.5">
                    {byRoomType.map((entry, index) => (
                      <li key={entry.roomTypeId} className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-2 text-gray-600">
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ background: PIE_COLORS[index % PIE_COLORS.length] }}
                          />
                          {entry.name}
                        </span>
                        <span className="font-semibold text-gray-900">
                          {formatCurrency(entry.totalRevenue)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
