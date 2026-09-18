import React, { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import ForceChangePasswordModal from '../auth/ForceChangePasswordModal';
import { useAuth } from '../../../context/AuthContext';
import useAdminRealtimeNotifications from '../../../hooks/useAdminRealtimeNotifications';

const STORAGE_KEY = 'admin.sidebarCollapsed';

// Dùng làm layout route (children ngầm định là <Outlet/>) hoặc bọc trực tiếp một
// trang cụ thể bằng cách truyền children — cả hai cách đều giữ chung Sidebar/Header.
// Trạng thái thu gọn sidebar được nhớ trong localStorage cho các lần sau.
export default function DashboardLayout({ children }) {
  const { user } = useAuth();
  useAdminRealtimeNotifications();
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
    // Không dùng min-h-screen ở đây: nó ép khung nền xám luôn cao tối thiểu bằng 1 màn
    // hình dù nội dung trang ngắn hơn nhiều (VD trang Sơ đồ phòng, Đặt phòng lúc còn ít
    // dữ liệu) — tạo ra khoảng trắng thừa kèm thanh cuộn không cần thiết bên dưới nội
    // dung thật, xuất hiện đồng loạt trên mọi trang admin vì đây là layout dùng chung.
    // Sidebar/Header đã "fixed h-screen"/"fixed" riêng nên không phụ thuộc div này.
    <div className="bg-gray-50 font-sans">
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
