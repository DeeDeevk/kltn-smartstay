import { useEffect, useMemo, useState } from 'react';
import {
  BedDouble,
  BarChart3,
  Settings,
  CalendarRange,
  CalendarClock,
  CalendarDays,
  PartyPopper,
  Users,
  IdCard,
  Wallet,
  UserRoundCheck,
  MessageCircle,
  MapPin,
  CircleHelp,
  Star,
  TicketPercent,
  DoorOpen,
  Tag,
  LogOut,
  ChevronDown,
  ChevronLeft,
  X,
} from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import vikaLogo from '../../../assets/icon/icon.png';
import { useAuth } from '../../../context/AuthContext';
import ConfirmModal from '../../common/ConfirmModal';

// Đường dẫn (path) cho từng mục menu, kèm roles được thấy mục đó. NavLink tự xử lý
// trạng thái active nên không cần cờ 'active' cứng.
// Nhân viên (STAFF) chỉ làm việc trên Sơ đồ phòng; các mục quản lý còn lại chỉ Admin.
// Mục có `children` là nhóm gấp/mở được (không tự điều hướng đi đâu), còn lại là mục
// thường. Gom nhóm để danh sách cấp 1 đủ ngắn, không phải cuộn mới thấy hết menu.
const MENU_ITEMS = [
  { icon: BarChart3, label: 'Tổng quan', path: '/admin', roles: ['ADMIN'] },
  { icon: BedDouble, label: 'Sơ đồ phòng', path: '/admin/rooms', roles: ['ADMIN', 'STAFF'] },
  { icon: MessageCircle, label: 'Chat với khách', path: '/admin/chat', roles: ['STAFF'] },
  { icon: CalendarRange, label: 'Đặt phòng', path: '/admin/bookings', roles: ['ADMIN', 'STAFF'] },
  { icon: CalendarDays, label: 'Lịch làm việc', path: '/admin/schedule/me', roles: ['STAFF'] },
  {
    icon: DoorOpen,
    label: 'Phòng & giá',
    roles: ['ADMIN'],
    children: [
      { icon: Tag, label: 'Loại phòng', path: '/admin/room-types', roles: ['ADMIN'] },
      { icon: TicketPercent, label: 'Khuyến mãi', path: '/admin/promotions', roles: ['ADMIN'] },
      { icon: Star, label: 'Đánh giá của khách', path: '/admin/reviews', roles: ['ADMIN'] },
    ],
  },
  { icon: Users, label: 'Quản lý tài khoản', path: '/admin/accounts', roles: ['ADMIN'] },
  {
    icon: IdCard,
    label: 'Nhân viên',
    roles: ['ADMIN'],
    children: [
      { icon: IdCard, label: 'Quản lý nhân viên', path: '/admin/staff', roles: ['ADMIN'] },
      { icon: CalendarClock, label: 'Phân ca nhân viên', path: '/admin/schedule', roles: ['ADMIN'] },
    ],
  },
  {
    icon: Wallet,
    label: 'Doanh thu',
    roles: ['ADMIN'],
    children: [
      { icon: Wallet, label: 'Báo cáo doanh thu', path: '/admin/revenue', roles: ['ADMIN'] },
      { icon: UserRoundCheck, label: 'Doanh thu nhân viên', path: '/admin/revenue/staff', roles: ['ADMIN'] },
    ],
  },
  {
    icon: Settings,
    label: 'Cấu hình',
    roles: ['ADMIN'],
    children: [
      { icon: MapPin, label: 'Vị trí khách sạn', path: '/admin/settings/location', roles: ['ADMIN'] },
      { icon: PartyPopper, label: 'Sự kiện địa phương', path: '/admin/settings/local-events', roles: ['ADMIN'] },
      { icon: CircleHelp, label: 'FAQ trợ lý AI', path: '/admin/faqs', roles: ['ADMIN'] },
    ],
  },
];

// Mọi mục có đường dẫn, kể cả mục nằm trong nhóm — dùng để tính EXACT_MATCH_PATHS.
const LEAF_ITEMS = MENU_ITEMS.flatMap((item) => item.children ?? [item]);

// Mục nào có path là tiền tố của một mục khác (vd. /admin/schedule là tiền tố của
// /admin/schedule/me) thì phải khớp CHÍNH XÁC, nếu không NavLink sẽ bật active cho
// cả hai khi đang ở trang con. Các mục còn lại vẫn khớp theo tiền tố để trang chi
// tiết (vd. /admin/rooms/:roomId) giữ sáng đúng mục cha của nó.
const EXACT_MATCH_PATHS = new Set(
  LEAF_ITEMS.filter((item) =>
    LEAF_ITEMS.some((other) => other !== item && other.path.startsWith(`${item.path}/`)),
  ).map((item) => item.path),
);

// Lặp lại đúng cách NavLink quyết định active, để tiêu đề nhóm sáng lên khi một mục
// con bên trong đang được mở (nhất là lúc nhóm đang gấp lại, không nhìn thấy mục con).
function isPathActive(path, pathname) {
  if (EXACT_MATCH_PATHS.has(path)) return pathname === path;
  return pathname === path || pathname.startsWith(`${path}/`);
}

const ROLE_LABELS = {
  ADMIN: 'Quản trị viên',
  STAFF: 'Nhân viên',
  CUSTOMER: 'Khách hàng',
};

// collapsed: chỉ áp dụng ở desktop (layout đã tự bỏ qua trên màn hình nhỏ).
// mobileOpen/onClose: dưới 1024px sidebar là ngăn kéo trượt từ mép trái.
export default function Sidebar({ collapsed = false, onToggle, mobileOpen = false, onClose }) {
  const { user, logout } = useAuth();
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [openGroups, setOpenGroups] = useState([]);

  const visibleItems = useMemo(
    () =>
      MENU_ITEMS.filter((item) => item.roles.includes(user?.role)).map((item) =>
        item.children
          ? { ...item, children: item.children.filter((c) => c.roles.includes(user?.role)) }
          : item,
      ),
    [user?.role],
  );

  // Tự mở nhóm chứa trang đang xem. Không có bước này thì vào thẳng /admin/revenue
  // (từ bookmark hoặc F5) sẽ thấy nhóm "Doanh thu" gấp lại, không rõ mình đang ở đâu.
  // Chỉ THÊM vào danh sách mở, không đóng nhóm khác — người dùng mở tay nhóm nào thì
  // nhóm đó cứ mở, chuyển trang không làm nó sập lại.
  useEffect(() => {
    const active = MENU_ITEMS.find((item) =>
      item.children?.some((child) => isPathActive(child.path, pathname)),
    );
    if (!active) return;
    setOpenGroups((prev) => (prev.includes(active.label) ? prev : [...prev, active.label]));
  }, [pathname]);

  const toggleGroup = (label) => {
    // Sidebar đang thu gọn thì không đủ chỗ hiện menu con — mở rộng sidebar ra trước,
    // rồi mở nhóm đó luôn để người dùng không phải bấm thêm lần nữa.
    if (collapsed) {
      onToggle?.();
      setOpenGroups((prev) => (prev.includes(label) ? prev : [...prev, label]));
      return;
    }
    setOpenGroups((prev) =>
      prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label],
    );
  };

  const displayName = user?.name || user?.username || 'Tài khoản';
  const avatarUrl = user?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=2563eb&color=fff`;

  // Không tự navigate('/login') ở đây — từng gây race với redirect tự động của
  // ProtectedRoute (isAuthenticated đổi -> tự nó điều hướng), khiến state.from bị
  // để lại sai giá trị và ảnh hưởng tới lượt đăng nhập tiếp theo của người khác.
  const handleLogout = () => {
    setConfirmLogout(true);
  };

  return (
    <>
    <aside
      className={`fixed left-0 top-0 z-30 flex h-screen w-64 flex-col border-r border-gray-200 bg-white transition-[transform,width,box-shadow] duration-300 ease-out lg:z-20 lg:translate-x-0 lg:shadow-none ${
        mobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
      } ${collapsed ? 'lg:w-20' : 'lg:w-64'}`}
    >
      {/* Nút thu gọn / mở rộng (chỉ desktop) — đặt ở hàng logo (top-5, cao đúng bằng h-16),
          KHÔNG đặt ở top-20 như trước: chỗ đó nằm trong vùng menu cuộn được (nav có
          overflow-y-auto), khi cửa sổ thấp thanh cuộn của menu hiện ra sát mép phải sidebar
          và bị nút đè lên. Mở rộng: nằm hẳn bên trong sidebar; thu gọn (sidebar chỉ rộng
          w-20, logo chiếm giữa): bám viền phải như cũ. */}
      <button
        type="button"
        onClick={onToggle}
        aria-label={collapsed ? 'Mở rộng menu' : 'Thu gọn menu'}
        title={collapsed ? 'Mở rộng menu' : 'Thu gọn menu'}
        className={`press absolute top-5 z-30 hidden h-6 w-6 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 shadow-sm transition-colors hover:bg-gray-50 hover:text-gray-800 lg:flex ${
          collapsed ? '-right-3' : 'right-3'
        }`}
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
        {/* Nút đóng ngăn kéo (chỉ dưới 1024px) */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Đóng menu"
          className="press ml-auto flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 lg:hidden"
        >
          <X size={20} />
        </button>
      </div>

      {/* Menu */}
      <nav className="flex-1 space-y-1 overflow-y-auto p-4">
        {visibleItems.map((item) => {
          const base = `group w-full flex items-center rounded-lg text-sm font-medium transition-colors duration-200 ${
            collapsed ? 'justify-center px-0 py-3' : 'gap-3 px-4 py-3'
          }`;

          if (!item.children) {
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={EXACT_MATCH_PATHS.has(item.path)}
                title={collapsed ? item.label : undefined}
                className={({ isActive }) =>
                  `${base} ${
                    isActive
                      ? 'bg-blue-50 text-blue-600'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`
                }
              >
                <item.icon
                  size={20}
                  className="shrink-0 transition-transform duration-200 group-hover:scale-110"
                />
                {!collapsed && item.label}
              </NavLink>
            );
          }

          const hasActiveChild = item.children.some((child) => isPathActive(child.path, pathname));
          const isOpen = !collapsed && openGroups.includes(item.label);

          return (
            <div key={item.label}>
              <button
                type="button"
                onClick={() => toggleGroup(item.label)}
                aria-expanded={isOpen}
                title={collapsed ? item.label : undefined}
                className={`${base} ${
                  // Nhóm đang gấp mà bên trong có trang đang mở thì tô đậm chữ để biết
                  // mình đang ở đâu; nhóm đang mở thì để nhạt, nhường màu xanh cho mục
                  // con đang active bên dưới.
                  hasActiveChild && !isOpen
                    ? 'bg-blue-50 text-blue-600'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <item.icon
                  size={20}
                  className="shrink-0 transition-transform duration-200 group-hover:scale-110"
                />
                {!collapsed && (
                  <>
                    <span className="flex-1 text-left">{item.label}</span>
                    <ChevronDown
                      size={16}
                      className={`shrink-0 text-gray-400 transition-transform duration-200 ${
                        isOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </>
                )}
              </button>

              {isOpen && (
                // Gạch dọc bên trái + thụt vào để thấy rõ đây là cấp con của nhóm trên.
                <div className="mt-1 ml-6 space-y-1 border-l border-gray-100 pl-2">
                  {item.children.map((child) => (
                    <NavLink
                      key={child.path}
                      to={child.path}
                      end={EXACT_MATCH_PATHS.has(child.path)}
                      className={({ isActive }) =>
                        `group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-200 ${
                          isActive
                            ? 'bg-blue-50 text-blue-600'
                            : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                        }`
                      }
                    >
                      <child.icon size={18} className="shrink-0" />
                      {child.label}
                    </NavLink>
                  ))}
                </div>
              )}
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

    <ConfirmModal
      open={confirmLogout}
      danger
      title={t('auth.logoutConfirmTitle')}
      message={t('auth.logoutConfirmMessage')}
      confirmLabel={t('auth.logout')}
      onConfirm={() => {
        setConfirmLogout(false);
        logout();
      }}
      onClose={() => setConfirmLogout(false)}
    />
    </>
  );
}
