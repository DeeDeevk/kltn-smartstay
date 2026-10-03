import React from 'react';
import { Menu } from 'lucide-react';
import NotificationBell from '../../layout/NotificationBell';

export default function Header({ collapsed = false, onMenuClick }) {
  return (
    <header
      className={`fixed left-0 right-0 top-0 z-10 flex h-16 items-center justify-between border-b border-gray-200 bg-white px-4 transition-[left] duration-300 ease-out sm:px-6 lg:px-8 ${
        collapsed ? 'lg:left-20' : 'lg:left-64'
      }`}
    >
      {/* Nút mở menu — chỉ hiện dưới 1024px, khi sidebar là ngăn kéo */}
      <button
        type="button"
        onClick={onMenuClick}
        aria-label="Mở menu"
        className="press -ml-2 flex h-10 w-10 items-center justify-center rounded-lg text-gray-600 transition-colors hover:bg-gray-100 lg:hidden"
      >
        <Menu size={22} />
      </button>

      <div className="ml-auto flex items-center gap-4">
        {/* Có khách đặt phòng -> backend tạo thông báo cho từng admin/nhân viên và đẩy
            real-time, chuông tự cập nhật không cần F5. */}
        <NotificationBell viewAllPath="/admin/notifications" />
      </div>
    </header>
  );
}
