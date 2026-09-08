import { Link } from 'react-router-dom';
import {
  Users,
  CalendarRange,
  BedDouble,
  LayoutGrid,
  BarChart3,
  Settings,
  RefreshCw,
  Loader2,
  ArrowRight,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import useAdminOverviewStats from './useAdminOverviewStats';

const BOOKING_STATUS_META = {
  PENDING: { label: 'Chờ xác nhận', dot: 'bg-amber-400' },
  CONFIRMED: { label: 'Đã xác nhận', dot: 'bg-blue-500' },
  CHECKED_IN: { label: 'Đang lưu trú', dot: 'bg-emerald-500' },
  CHECKED_OUT: { label: 'Đã trả phòng', dot: 'bg-slate-400' },
  CANCELLED: { label: 'Đã huỷ', dot: 'bg-red-500' },
};

const ROOM_STATUS_META = {
  AVAILABLE: { label: 'Trống', dot: 'bg-emerald-500' },
  OCCUPIED: { label: 'Đang sử dụng', dot: 'bg-blue-500' },
  RESERVED: { label: 'Đã giữ chỗ', dot: 'bg-violet-500' },
  CLEANING: { label: 'Đang dọn dẹp', dot: 'bg-amber-400' },
  MAINTENANCE: { label: 'Bảo trì', dot: 'bg-red-500' },
};

const ROLE_META = {
  CUSTOMER: { label: 'Khách hàng', dot: 'bg-blue-500' },
  STAFF: { label: 'Nhân viên', dot: 'bg-violet-500' },
  ADMIN: { label: 'Quản trị viên', dot: 'bg-slate-700' },
};

const QUICK_LINKS = [
  {
    label: 'Sơ đồ phòng & Check-in',
    description: 'Trạng thái từng phòng theo tầng, nhận / trả phòng, quét QR vé',
    path: '/admin/rooms',
    icon: BedDouble,
    ready: true,
    roles: ['ADMIN', 'STAFF'],
  },
  {
    label: 'Loại phòng',
    description: 'Quản lý danh mục loại phòng và giá',
    path: '/admin/room-types',
    icon: Settings,
    ready: true,
    roles: ['ADMIN'],
  },
  {
    label: 'Quản lý tài khoản',
    description: 'Danh sách, phân quyền, khoá/mở khoá tài khoản',
    path: '/admin/accounts',
    icon: Users,
    ready: true,
    roles: ['ADMIN'],
  },
  {
    label: 'Đặt phòng',
    description: 'Xử lý đặt phòng, check-in / check-out',
    icon: CalendarRange,
    ready: false,
    roles: ['ADMIN', 'STAFF'],
  },
  {
    label: 'Báo cáo doanh thu',
    description: 'Thống kê doanh thu, so sánh theo kỳ',
    icon: BarChart3,
    ready: false,
    roles: ['ADMIN'],
  },
];

function StatCard({ icon: Icon, label, value, iconBg, iconColor, loading }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-500">{label}</span>
        <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${iconBg}`}>
          <Icon size={20} className={iconColor} />
        </span>
      </div>
      <p className="mt-4 text-3xl font-bold text-gray-900">
        {loading ? <span className="inline-block h-8 w-16 animate-pulse rounded bg-gray-100" /> : value}
      </p>
    </div>
  );
}

function DistributionCard({ title, total, segments, loading }) {
  const visible = segments.filter((s) => s.value > 0);

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <h3 className="mb-4 text-sm font-bold text-gray-900">{title}</h3>

      {loading ? (
        <div className="space-y-3">
          <div className="h-2.5 w-full animate-pulse rounded-full bg-gray-100" />
          <div className="h-4 w-3/4 animate-pulse rounded bg-gray-100" />
          <div className="h-4 w-2/3 animate-pulse rounded bg-gray-100" />
        </div>
      ) : total === 0 ? (
        <p className="text-sm text-gray-400">Chưa có dữ liệu</p>
      ) : (
        <>
          <div className="mb-4 flex h-2.5 w-full gap-[2px] overflow-hidden rounded-full bg-gray-100">
            {visible.map((seg) => (
              <div
                key={seg.label}
                className={seg.dot}
                style={{ width: `${(seg.value / total) * 100}%` }}
                title={`${seg.label}: ${seg.value}`}
              />
            ))}
          </div>
          <ul className="space-y-2">
            {segments.map((seg) => (
              <li key={seg.label} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-gray-600">
                  <span className={`h-2.5 w-2.5 rounded-full ${seg.dot}`} />
                  {seg.label}
                </span>
                <span className="font-semibold text-gray-900">
                  {seg.value}
                  <span className="ml-1 font-normal text-gray-400">
                    ({total > 0 ? Math.round((seg.value / total) * 100) : 0}%)
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

export default function AdminDashboardPage() {
  const { user } = useAuth();
  const { stats, loading, error, reload } = useAdminOverviewStats();

  const bookingSegments = Object.entries(BOOKING_STATUS_META).map(([key, meta]) => ({
    label: meta.label,
    dot: meta.dot,
    value: stats?.bookings.byStatus[key] ?? 0,
  }));

  const roomSegments = Object.entries(ROOM_STATUS_META).map(([key, meta]) => ({
    label: meta.label,
    dot: meta.dot,
    value: stats?.rooms.byStatus[key] ?? 0,
  }));

  const roleSegments = Object.entries(ROLE_META).map(([key, meta]) => ({
    label: meta.label,
    dot: meta.dot,
    value: stats?.users.byRole[key] ?? 0,
  }));

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Chào {user?.name || 'Admin'} 👋
          </h1>
          <p className="mt-1 text-sm text-gray-500">Tổng quan hoạt động của Vika Hotel</p>
        </div>
        <button
          type="button"
          onClick={reload}
          disabled={loading}
          className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-600 shadow-sm transition-colors hover:bg-gray-50 disabled:opacity-60"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
          Làm mới
        </button>
      </div>

      {error && (
        <div className="mb-6 flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
          <AlertCircle size={18} />
          {error}
        </div>
      )}

      <div className="mb-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Users}
          label="Tổng người dùng"
          value={stats?.users.total ?? 0}
          iconBg="bg-blue-50"
          iconColor="text-blue-600"
          loading={loading}
        />
        <StatCard
          icon={CalendarRange}
          label="Tổng đặt phòng"
          value={stats?.bookings.total ?? 0}
          iconBg="bg-emerald-50"
          iconColor="text-emerald-600"
          loading={loading}
        />
        <StatCard
          icon={BedDouble}
          label="Phòng đang trống"
          value={stats?.rooms.byStatus.AVAILABLE ?? 0}
          iconBg="bg-amber-50"
          iconColor="text-amber-600"
          loading={loading}
        />
        <StatCard
          icon={LayoutGrid}
          label="Loại phòng"
          value={stats?.roomTypes.total ?? 0}
          iconBg="bg-violet-50"
          iconColor="text-violet-600"
          loading={loading}
        />
      </div>

      <div className="mb-8 grid grid-cols-1 gap-5 lg:grid-cols-3">
        <DistributionCard
          title="Trạng thái đặt phòng"
          total={stats?.bookings.total ?? 0}
          segments={bookingSegments}
          loading={loading}
        />
        <DistributionCard
          title="Trạng thái phòng"
          total={stats?.rooms.total ?? 0}
          segments={roomSegments}
          loading={loading}
        />
        <DistributionCard
          title="Người dùng theo vai trò"
          total={stats?.users.total ?? 0}
          segments={roleSegments}
          loading={loading}
        />
      </div>

      <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-gray-500">Truy cập nhanh</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {QUICK_LINKS.filter((link) => link.roles.includes(user?.role)).map((link) => {
          const content = (
            <>
              <div className="flex items-center justify-between">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100">
                  <link.icon size={20} className="text-gray-600" />
                </span>
                {link.ready ? (
                  <ArrowRight size={16} className="text-gray-300 transition-transform group-hover:translate-x-1 group-hover:text-blue-500" />
                ) : (
                  <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-bold text-gray-400">
                    Sắp ra mắt
                  </span>
                )}
              </div>
              <p className="mt-4 font-bold text-gray-900">{link.label}</p>
              <p className="mt-1 text-sm text-gray-500">{link.description}</p>
            </>
          );

          if (link.ready) {
            return (
              <Link
                key={link.label}
                to={link.path}
                className="group rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
              >
                {content}
              </Link>
            );
          }

          return (
            <div key={link.label} className="cursor-not-allowed rounded-2xl border border-gray-200 bg-white p-5 opacity-60 shadow-sm">
              {content}
            </div>
          );
        })}
      </div>
    </div>
  );
}
