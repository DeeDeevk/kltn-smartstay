import { useNavigate, useLocation } from 'react-router-dom';

// STAFF (lễ tân) và ADMIN đều vào chung khu quản trị /admin — Sidebar tự lọc menu theo
// role, còn các trang riêng của Admin (quản lý tài khoản, loại phòng...) tự chặn ở route.
const ADMIN_AREA_ROLES = ['ADMIN', 'STAFF'];
const ADMIN_LANDING_PATH = '/admin';

// Dieu huong sau khi dang nhap thanh cong - dung chung cho dang nhap bang mat khau,
// dang nhap bang Google va dang ky bang Google.
export default function useRedirectAfterLogin() {
  const navigate = useNavigate();
  const location = useLocation();

  return (user) => {
    if (ADMIN_AREA_ROLES.includes(user?.role)) {
      navigate(ADMIN_LANDING_PATH, { replace: true });
      return;
    }
    // "from" có thể là trang trước đó của MỘT NGƯỜI KHÁC (vd. admin bị đăng xuất
    // khỏi /admin rồi để lại state.from='/admin' trên /login) — không được tin
    // mù quáng, kẻo tài khoản khách vừa đăng nhập bị đưa thẳng vào trang admin
    // và dính 403.
    const rawFrom = location.state?.from || '/';
    const from = rawFrom.startsWith('/admin') ? '/' : rawFrom;
    const checkoutState = location.state?.checkoutState;
    navigate(from, { state: checkoutState });
  };
}
