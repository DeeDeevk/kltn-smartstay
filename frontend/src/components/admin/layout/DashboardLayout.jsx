import React, { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import ForceChangePasswordModal from '../auth/ForceChangePasswordModal';
import { useAuth } from '../../../context/AuthContext';

const STORAGE_KEY = 'admin.sidebarCollapsed';

// Dùng làm layout route (children ngầm định là <Outlet/>) hoặc bọc trực tiếp một
// trang cụ thể bằng cách truyền children — cả hai cách đều giữ chung Sidebar/Header.
// Trạng thái thu gọn sidebar được nhớ trong localStorage cho các lần sau.
export default function DashboardLayout({ children }) {
  const { user } = useAuth();
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, collapsed ? '1' : '0');
    } catch {
      /* localStorage không khả dụng (private mode...) — bỏ qua */
    }
  }, [collapsed]);

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((v) => !v)} />
      <Header collapsed={collapsed} />
      <main
        className={`pt-16 transition-[padding] duration-200 ${
          collapsed ? 'pl-20' : 'pl-64'
        }`}
      >
        <div className="p-8">{children ?? <Outlet />}</div>
      </main>

      {user?.mustChangePassword && <ForceChangePasswordModal />}
    </div>
  );
}
