import React, { Suspense, useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import PageLoader from '../../common/PageLoader';
import Sidebar from './Sidebar';
import Header from './Header';
import ForceChangePasswordModal from '../auth/ForceChangePasswordModal';
import { useAuth } from '../../../context/AuthContext';
import useAdminRealtimeNotifications from '../../../hooks/useAdminRealtimeNotifications';
import useMediaQuery from '../../../hooks/useMediaQuery';

const STORAGE_KEY = 'admin.sidebarCollapsed';

// Dùng làm layout route (children ngầm định là <Outlet/>) hoặc bọc trực tiếp một
// trang cụ thể bằng cách truyền children — cả hai cách đều giữ chung Sidebar/Header.
// Trạng thái thu gọn sidebar được nhớ trong localStorage cho các lần sau.
//
// Từ 1024px trở lên: sidebar cố định bên trái (thu gọn được). Dưới 1024px: sidebar là
// ngăn kéo trượt ra từ mép trái, mở bằng nút menu ở Header, đóng khi bấm nền mờ, bấm Esc
// hoặc chuyển trang.
export default function DashboardLayout({ children }) {
  const { user } = useAuth();
  const location = useLocation();
  useAdminRealtimeNotifications();
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const [mobileOpen, setMobileOpen] = useState(false);
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

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!mobileOpen) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setMobileOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mobileOpen]);

  // Trạng thái "thu gọn" chỉ có nghĩa ở desktop; ngăn kéo trên màn hình nhỏ luôn hiện đủ chữ.
  const compact = collapsed && isDesktop;

  return (
    // Không dùng min-h-screen ở đây: nó ép khung nền xám luôn cao tối thiểu bằng 1 màn
    // hình dù nội dung trang ngắn hơn nhiều (VD trang Sơ đồ phòng, Đặt phòng lúc còn ít
    // dữ liệu) — tạo ra khoảng trắng thừa kèm thanh cuộn không cần thiết bên dưới nội
    // dung thật, xuất hiện đồng loạt trên mọi trang admin vì đây là layout dùng chung.
    // Sidebar/Header đã "fixed h-screen"/"fixed" riêng nên không phụ thuộc div này.
    <div className="bg-gray-50 font-sans">
      <Sidebar
        collapsed={compact}
        onToggle={() => setCollapsed((v) => !v)}
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
      />
      {mobileOpen && (
        <div
          className="anim-fade-in fixed inset-0 z-20 bg-black/40 lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}
      <Header collapsed={compact} onMenuClick={() => setMobileOpen(true)} />
      <main
        className={`pt-16 transition-[padding] duration-300 ease-out ${
          compact ? 'lg:pl-20' : 'lg:pl-64'
        }`}
      >
        <div className="p-4 sm:p-6 lg:p-8">
          {/* Suspense riêng để chuyển giữa các trang admin (lazy) vẫn giữ Sidebar/Header.
              key theo đường dẫn để mỗi lần chuyển trang nội dung mới trượt nhẹ vào. */}
          <Suspense fallback={<PageLoader />}>
            <div key={location.pathname} className="anim-fade-up">
              {children ?? <Outlet />}
            </div>
          </Suspense>
        </div>
      </main>

      {user?.mustChangePassword && <ForceChangePasswordModal />}
    </div>
  );
}
