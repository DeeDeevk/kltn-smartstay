import React from 'react';
import { BedDouble, BarChart3, Settings, CalendarRange, Users, LogOut, QrCode } from 'lucide-react';
import { NavLink } from 'react-router-dom'; // 1. Import NavLink
import vikaLogo from '../../../assets/icon/icon.png';
import { useAuth } from '../../../context/AuthContext';

// 2. Thêm đường dẫn (path) cho từng mục menu, kèm roles được thấy mục đó
// Bạn nhớ bỏ thuộc tính 'active' cứng đi, NavLink sẽ tự xử lý
const MENU_ITEMS = [
  { icon: BarChart3, label: 'Tổng quan', path: '/admin', ready: true, roles: ['ADMIN', 'STAFF'] },
  { icon: QrCode, label: 'Check-in', path: '/admin/checkin', ready: true, roles: ['ADMIN', 'STAFF'] },
  { icon: BedDouble, label: 'Sơ đồ phòng', path: '/admin/rooms', ready: false, roles: ['ADMIN', 'STAFF'] },
  { icon: CalendarRange, label: 'Đặt phòng', path: '/admin/bookings', ready: false, roles: ['ADMIN', 'STAFF'] },
  { icon: Settings, label: 'Loại phòng', path: '/admin/room-types', ready: true, roles: ['ADMIN'] },
  { icon: Users, label: 'Quản lý tài khoản', path: '/admin/accounts', ready: true, roles: ['ADMIN'] },
];

const ROLE_LABELS = {
  ADMIN: 'Quản trị viên',
  STAFF: 'Nhân viên',
  CUSTOMER: 'Khách hàng',
};

export default function Sidebar() {
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
    <aside className="w-64 bg-white border-r border-gray-200 h-screen flex flex-col fixed left-0 top-0">
      {/* Logo */}
      <div className="h-16 flex items-center gap-3 px-6 border-b border-gray-100">
        <img src={vikaLogo} alt="Vika Hotel" className="h-9 w-9 object-contain" />
        <span className="text-xl font-bold text-gray-900">VIKAHOTEL</span>
      </div>

      {/* Menu */}
      <nav className="flex-1 p-4 space-y-1">
        {MENU_ITEMS.filter((item) => item.roles.includes(user?.role)).map((item, index) =>
          item.ready ? (
            <NavLink
              key={index}
              to={item.path}
              end={item.path === '/admin'}
              className={({ isActive }) =>
                `w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${isActive
                  ? 'bg-blue-50 text-blue-600' // Style khi đang ở trang này
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900' // Style khi bình thường
                }`
              }
            >
              <item.icon size={20} />
              {item.label}
            </NavLink>
          ) : (
            <div
              key={index}
              title="Sắp ra mắt"
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-gray-300 cursor-not-allowed"
            >
              <item.icon size={20} />
              {item.label}
            </div>
          ),
        )}
      </nav>

      {/* Tài khoản & đăng xuất */}
      <div className="border-t border-gray-100 p-4">
        <div className="flex items-center gap-3 mb-3 min-w-0">
          <img src={avatarUrl} alt={displayName} className="w-9 h-9 rounded-full object-cover shrink-0 ring-2 ring-white shadow-sm" />
          <div className="min-w-0">
            <p className="text-sm font-bold text-gray-900 truncate">{displayName}</p>
            <p className="text-xs text-gray-400 truncate">{ROLE_LABELS[user?.role] || user?.role}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-semibold text-red-600 hover:bg-red-50 transition-colors"
        >
          <LogOut size={18} />
          Đăng xuất
        </button>
      </div>
    </aside>
  );
}