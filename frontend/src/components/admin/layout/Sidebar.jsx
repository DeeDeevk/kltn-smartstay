import React from 'react';
import { BedDouble, BarChart3, Settings, CalendarRange, Users } from 'lucide-react';
import { NavLink } from 'react-router-dom'; // 1. Import NavLink
import vikaLogo from '../../../assets/icon/icon.png';

// 2. Thêm đường dẫn (path) cho từng mục menu
// Bạn nhớ bỏ thuộc tính 'active' cứng đi, NavLink sẽ tự xử lý
const MENU_ITEMS = [
  { icon: BarChart3, label: 'Tổng quan', path: '/admin', ready: true },
  { icon: BedDouble, label: 'Sơ đồ phòng', path: '/admin/rooms', ready: false },
  { icon: Settings, label: 'Loại phòng', path: '/admin/room-types', ready: true },
  { icon: CalendarRange, label: 'Đặt phòng', path: '/admin/bookings', ready: false },
  { icon: Users, label: 'Quản lý tài khoản', path: '/admin/accounts', ready: true },
];

export default function Sidebar() {
  return (
    <aside className="w-64 bg-white border-r border-gray-200 h-screen flex flex-col fixed left-0 top-0">
      {/* Logo */}
      <div className="h-16 flex items-center gap-3 px-6 border-b border-gray-100">
        <img src={vikaLogo} alt="Vika Hotel" className="h-9 w-9 object-contain" />
        <span className="text-xl font-bold text-gray-900">VIKAHOTEL</span>
      </div>

      {/* Menu */}
      <nav className="flex-1 p-4 space-y-1">
        {MENU_ITEMS.map((item, index) =>
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

    </aside>
  );
}