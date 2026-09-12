import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronDown, User, History, LogOut } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import ConfirmModal from '../common/ConfirmModal';

const menuItems = [
  { path: '/user/profile', labelKey: 'userMenu.profile', icon: User },
  { path: '/user/historybooking', labelKey: 'userMenu.bookingHistory', icon: History },
];

export default function UserMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const menuRef = useRef(null);

  const displayName = user?.name || user?.username || 'Tài khoản';
  const avatarUrl = user?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=2563eb&color=fff`;

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const goTo = (path) => {
    setIsOpen(false);
    navigate(path);
  };

  const handleLogout = () => {
    setIsOpen(false);
    setConfirmLogout(true);
  };

  return (
    <>
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center gap-2 pl-1.5 pr-3 py-1.5 rounded-full border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-colors"
      >
        <img src={avatarUrl} alt={displayName} className="w-8 h-8 rounded-full object-cover ring-2 ring-white shadow-sm" />
        <span className="text-sm font-semibold text-gray-700 max-w-[120px] truncate">{displayName}</span>
        <ChevronDown size={14} className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="dropdown-menu-in absolute right-0 top-full mt-2 w-64 bg-white rounded-2xl border border-gray-100 shadow-xl overflow-hidden z-50">
          <div className="flex items-center gap-3 px-4 py-4 bg-gradient-to-br from-blue-50 to-white">
            <img src={avatarUrl} alt={displayName} className="w-11 h-11 rounded-full object-cover ring-2 ring-white shadow-sm shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-bold text-gray-900 truncate">{displayName}</p>
              {user?.email && <p className="text-xs text-gray-500 truncate mt-0.5">{user.email}</p>}
            </div>
          </div>

          <div className="p-1.5">
            {menuItems.map(({ path, labelKey, icon: Icon }) => (
              <button
                key={path}
                onClick={() => goTo(path)}
                className="w-full flex items-center gap-3 px-2.5 py-2.5 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <span className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                  <Icon size={16} />
                </span>
                {t(labelKey)}
              </button>
            ))}
          </div>

          <div className="p-1.5 border-t border-gray-100">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-2.5 py-2.5 rounded-xl text-sm font-semibold text-red-600 hover:bg-red-50 transition-colors"
            >
              <span className="w-8 h-8 rounded-full bg-red-50 text-red-600 flex items-center justify-center shrink-0">
                <LogOut size={16} />
              </span>
              {t('auth.logout')}
            </button>
          </div>
        </div>
      )}
    </div>

    <ConfirmModal
      open={confirmLogout}
      danger
      title={t('auth.logoutConfirmTitle')}
      message={t('auth.logoutConfirmMessage')}
      confirmLabel={t('auth.logout')}
      onConfirm={() => {
        setConfirmLogout(false);
        logout();
        navigate('/');
      }}
      onClose={() => setConfirmLogout(false)}
    />
    </>
  );
}
