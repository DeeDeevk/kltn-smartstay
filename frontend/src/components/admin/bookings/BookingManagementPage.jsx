import { useState } from 'react';
import { toast } from 'react-toastify';
import {
  CalendarCheck2,
  CalendarDays,
  CheckCircle2,
  Clock,
  Eye,
  Loader2,
  MoonStar,
  RefreshCw,
  Search,
} from 'lucide-react';
import { useGetBookingsQuery } from '../../../services/booking';
import useAdminOverviewStats from '../dashboard/useAdminOverviewStats';
import BookingAdminDetailModal from './BookingAdminDetailModal';
import StatusPill from '../../booking/StatusPill';
import { BOOKING_STATUS_STYLES } from '../../../utils/bookingStatusStyles';
import formatCurrency from '../../../utils/formatCurrency';
import formatDate from '../../../utils/formatDate';
import getBookingCode from '../../../utils/bookingCode';

const BOOKING_STATUS_LABELS = {
  PENDING: 'Chờ xác nhận',
  CONFIRMED: 'Đã xác nhận',
  CHECKED_IN: 'Đang lưu trú',
  CHECKED_OUT: 'Đã hoàn thành',
  CANCELLED: 'Đã huỷ',
};

const TABS = [
  { key: 'all', label: 'Tất cả' },
  { key: 'pending', label: 'Chờ xác nhận', status: 'PENDING' },
  { key: 'confirmed', label: 'Đã xác nhận', status: 'CONFIRMED' },
  { key: 'staying', label: 'Đang lưu trú', status: 'CHECKED_IN' },
  { key: 'done', label: 'Hoàn thành', status: 'CHECKED_OUT' },
  { key: 'cancelled', label: 'Đã huỷ', status: 'CANCELLED' },
];

const EMPTY_SEARCH = { keyword: '', from: '', to: '' };
const PAGE_SIZE = 10;

function nights(a, b) {
  const d = (new Date(b) - new Date(a)) / 86_400_000;
  return d > 0 ? Math.round(d) : 1;
}

export default function BookingManagementPage() {
  const [tab, setTab] = useState('all');
  const [draft, setDraft] = useState(EMPTY_SEARCH);
  const [applied, setApplied] = useState(EMPTY_SEARCH);
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState(null);

  const { stats, reload: reloadStats } = useAdminOverviewStats();
  const activeStatus = TABS.find((t) => t.key === tab)?.status;

  const { data, isFetching, refetch } = useGetBookingsQuery({
    status: activeStatus,
    search: applied.keyword || undefined,
    checkIn: applied.from || undefined,
    checkOut: applied.to || undefined,
    page,
    limit: PAGE_SIZE,
  });

  const rows = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const byStatus = stats?.bookings?.byStatus ?? {};

  const applySearch = () => {
    if (Boolean(draft.from) !== Boolean(draft.to)) {
      toast.error('Chọn cả từ ngày và đến ngày');
      return;
    }
    setPage(1);
    setApplied(draft);
  };

  const resetSearch = () => {
    setDraft(EMPTY_SEARCH);
    setApplied(EMPTY_SEARCH);
    setPage(1);
  };

  const refreshAll = () => {
    refetch();
    reloadStats();
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <CalendarDays size={24} className="text-blue-600" /> Quản lý đặt phòng
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Xem, tìm kiếm và xử lý toàn bộ lịch sử đặt phòng của khách sạn
          </p>
        </div>
        <button
          type="button"
          onClick={refreshAll}
          disabled={isFetching}
          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-600 shadow-sm transition-colors hover:bg-gray-50 disabled:opacity-60"
        >
          {isFetching ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <RefreshCw size={16} />
          )}
          Làm mới
        </button>
      </header>

      <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-5">
        <StatCard
          icon={CalendarDays}
          label="Tổng đơn đặt"
          value={stats?.bookings?.total ?? 0}
          tone="text-gray-900"
          bg="bg-blue-50 text-blue-600"
        />
        <StatCard
          icon={Clock}
          label="Chờ xác nhận"
          value={byStatus.PENDING ?? 0}
          tone="text-amber-600"
          bg="bg-amber-50 text-amber-600"
        />
        <StatCard
          icon={CheckCircle2}
          label="Đã xác nhận"
          value={byStatus.CONFIRMED ?? 0}
          tone="text-blue-600"
          bg="bg-blue-50 text-blue-600"
        />
        <StatCard
          icon={MoonStar}
          label="Đang lưu trú"
          value={byStatus.CHECKED_IN ?? 0}
          tone="text-emerald-600"
          bg="bg-emerald-50 text-emerald-600"
        />
        <StatCard
          icon={CalendarCheck2}
          label="Đã hoàn thành"
          value={byStatus.CHECKED_OUT ?? 0}
          tone="text-gray-700"
          bg="bg-gray-100 text-gray-500"
        />
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            applySearch();
          }}
          className="grid gap-3 lg:grid-cols-[1fr_170px_170px_auto]"
        >
          <div className="relative">
            <Search
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              value={draft.keyword}
              onChange={(e) => setDraft({ ...draft, keyword: e.target.value })}
              placeholder="Tìm mã đặt, tên khách hàng, SĐT, email..."
              className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
          </div>
          <Field label="Từ ngày">
            <input
              type="date"
              value={draft.from}
              max={draft.to || undefined}
              onChange={(e) => setDraft({ ...draft, from: e.target.value })}
              className={inputCls}
            />
          </Field>
          <Field label="Đến ngày">
            <input
              type="date"
              value={draft.to}
              min={draft.from || undefined}
              onChange={(e) => setDraft({ ...draft, to: e.target.value })}
              className={inputCls}
            />
          </Field>
          <div className="flex items-end gap-2">
            <button
              type="submit"
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 lg:flex-none"
            >
              <Search size={15} /> Tìm
            </button>
            <button
              type="button"
              onClick={resetSearch}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-500 hover:bg-gray-50"
            >
              Xoá lọc
            </button>
          </div>
        </form>

        <div className="mt-4 flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs font-bold uppercase tracking-wider text-gray-400">
            Trạng thái:
          </span>
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => {
                setTab(t.key);
                setPage(1);
              }}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
                tab === t.key
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        {isFetching && rows.length === 0 ? (
          <div className="flex justify-center py-20 text-gray-300">
            <Loader2 className="animate-spin" size={28} />
          </div>
        ) : rows.length === 0 ? (
          <p className="py-20 text-center text-sm text-gray-400">
            Không có đơn đặt phòng nào khớp bộ lọc.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wider text-gray-400">
                  <th className="px-4 py-3 font-semibold">Mã đặt</th>
                  <th className="px-4 py-3 font-semibold">Khách hàng</th>
                  <th className="px-4 py-3 font-semibold">Ngày ở</th>
                  <th className="px-4 py-3 font-semibold">Phòng</th>
                  <th className="px-4 py-3 text-right font-semibold">Tổng tiền</th>
                  <th className="px-4 py-3 font-semibold">Trạng thái</th>
                  <th className="px-4 py-3 text-right font-semibold">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {rows.map((b) => (
                  <tr key={b.bookingId} className="text-gray-700">
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs font-bold text-blue-600">
                        {getBookingCode(b.bookingId)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-gray-900">
                        {b.guestInfo?.fullName || '—'}
                      </p>
                      <p className="text-xs text-gray-400">
                        {b.guestInfo?.phone || 'Không có SĐT'}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1.5 text-gray-600">
                        <CalendarDays size={13} className="text-gray-400" />
                        {formatDate(b.checkInDate)} → {formatDate(b.checkOutDate)}
                      </span>
                      <span className="text-xs text-gray-400">
                        {nights(b.checkInDate, b.checkOutDate)} đêm
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {b.room?.roomNumber ? (
                        <span className="rounded-md bg-blue-50 px-2 py-0.5 text-xs font-bold text-blue-600">
                          {b.room.roomNumber}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">Chưa gán</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-gray-900">
                      {formatCurrency(b.totalAmount)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill
                        value={b.status}
                        styles={BOOKING_STATUS_STYLES}
                        label={BOOKING_STATUS_LABELS[b.status] || b.status}
                      />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setDetail(b)}
                        title="Xem chi tiết"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition-colors hover:border-blue-300 hover:text-blue-600"
                      >
                        <Eye size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3 text-sm">
            <span className="text-gray-500">
              Trang {page}/{totalPages} · {total} đơn
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="rounded-lg border border-gray-200 px-3 py-1.5 font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-40"
              >
                Trước
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-lg border border-gray-200 px-3 py-1.5 font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-40"
              >
                Sau
              </button>
            </div>
          </div>
        )}
      </div>

      <BookingAdminDetailModal
        booking={detail}
        onClose={() => setDetail(null)}
        onChanged={refreshAll}
      />
    </div>
  );
}

const inputCls =
  'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100';

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-gray-400">
        {label}
      </span>
      {children}
    </label>
  );
}

function StatCard({ icon: Icon, label, value, tone, bg }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
          {label}
        </p>
        <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${bg}`}>
          <Icon size={16} />
        </span>
      </div>
      <p className={`mt-2 text-2xl font-extrabold ${tone}`}>{value}</p>
    </div>
  );
}
