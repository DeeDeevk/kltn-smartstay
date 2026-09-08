import React from 'react';
import {
  BedDouble,
  BarChart3,
  Settings,
  CalendarRange,
  Users,
  LogOut,
  ChevronLeft,
} from 'lucide-react';
import { NavLink } from 'react-router-dom';
import vikaLogo from '../../../assets/icon/icon.png';
import { useAuth } from '../../../context/AuthContext';

// Đường dẫn (path) cho từng mục menu, kèm roles được thấy mục đó. NavLink tự xử lý
// trạng thái active nên không cần cờ 'active' cứng.
const MENU_ITEMS = [
  { icon: BarChart3, label: 'Tổng quan', path: '/admin', ready: true, roles: ['ADMIN', 'STAFF'] },
  { icon: BedDouble, label: 'Sơ đồ phòng', path: '/admin/rooms', ready: true, roles: ['ADMIN', 'STAFF'] },
  { icon: CalendarRange, label: 'Đặt phòng', path: '/admin/bookings', ready: false, roles: ['ADMIN', 'STAFF'] },
  { icon: Settings, label: 'Loại phòng', path: '/admin/room-types', ready: true, roles: ['ADMIN'] },
  { icon: Users, label: 'Quản lý tài khoản', path: '/admin/accounts', ready: true, roles: ['ADMIN'] },
];

const ROLE_LABELS = {
  ADMIN: 'Quản trị viên',
  STAFF: 'Nhân viên',
  CUSTOMER: 'Khách hàng',
};

export default function Sidebar({ collapsed = false, onToggle }) {
  const { user, logout } = useAuth();

  const displayName = user?.name || user?.username || 'Tài khoản';
  const avatarUrl = user?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=2563eb&color=fff`;

  // Không tự navigate('/login') ở đây — từng gây race với redirect tự động của
  // ProtectedRoute (isAuthenticated đổi -> tự nó điều hướng), khiến state.from bị
  // để lại sai giá trị và ảnh hưởng tới lượt đăng nhập tiếp theo của người khác.
  const handleLogout = () => {
    logout();
  };

  return (
    <aside
      className={`fixed left-0 top-0 z-20 flex h-screen flex-col border-r border-gray-200 bg-white transition-[width] duration-200 ${
        collapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* Nút thu gọn / mở rộng — nổi trên viền phải của sidebar */}
      <button
        type="button"
        onClick={onToggle}
        aria-label={collapsed ? 'Mở rộng menu' : 'Thu gọn menu'}
        title={collapsed ? 'Mở rộng menu' : 'Thu gọn menu'}
        className="absolute -right-3 top-20 z-30 flex h-6 w-6 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 shadow-sm transition-colors hover:bg-gray-50 hover:text-gray-800"
      >
        <ChevronLeft
          size={14}
          className={`transition-transform duration-200 ${collapsed ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Logo */}
      <div className={`flex h-16 items-center border-b border-gray-100 ${collapsed ? 'justify-center px-2' : 'gap-3 px-6'}`}>
        <img src={vikaLogo} alt="Vika Hotel" className="h-9 w-9 shrink-0 object-contain" />
        {!collapsed && <span className="text-xl font-bold text-gray-900">VIKAHOTEL</span>}
      </div>

      {/* Menu */}
      <nav className="flex-1 space-y-1 p-4">
        {MENU_ITEMS.filter((item) => item.roles.includes(user?.role)).map((item, index) => {
          const base = `w-full flex items-center rounded-lg text-sm font-medium transition-colors ${
            collapsed ? 'justify-center px-0 py-3' : 'gap-3 px-4 py-3'
          }`;
          return item.ready ? (
            <NavLink
              key={index}
              to={item.path}
              end={item.path === '/admin'}
              title={collapsed ? item.label : undefined}
              className={({ isActive }) =>
                `${base} ${
                  isActive
                    ? 'bg-blue-50 text-blue-600'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`
              }
            >
              <item.icon size={20} className="shrink-0" />
              {!collapsed && item.label}
            </NavLink>
          ) : (
            <div
              key={index}
              title={collapsed ? `${item.label} — sắp ra mắt` : 'Sắp ra mắt'}
              className={`${base} cursor-not-allowed text-gray-300`}
            >
              <item.icon size={20} className="shrink-0" />
              {!collapsed && item.label}
            </div>
          );
        })}
      </nav>

      {/* Tài khoản & đăng xuất */}
      <div className="border-t border-gray-100 p-4">
        <div className={`mb-3 flex items-center ${collapsed ? 'justify-center' : 'gap-3'} min-w-0`}>
          <img
            src={avatarUrl}
            alt={displayName}
            title={collapsed ? displayName : undefined}
            className="h-9 w-9 shrink-0 rounded-full object-cover ring-2 ring-white shadow-sm"
          />
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-gray-900">{displayName}</p>
              <p className="truncate text-xs text-gray-400">{ROLE_LABELS[user?.role] || user?.role}</p>
            </div>
          )}
        </div>
        <button
          onClick={handleLogout}
          title={collapsed ? 'Đăng xuất' : undefined}
          className={`flex w-full items-center rounded-lg text-sm font-semibold text-red-600 transition-colors hover:bg-red-50 ${
            collapsed ? 'justify-center px-0 py-2.5' : 'gap-3 px-4 py-2.5'
          }`}
        >
          <LogOut size={18} className="shrink-0" />
          {!collapsed && 'Đăng xuất'}
        </button>
      </div>
    </aside>
  );
}
