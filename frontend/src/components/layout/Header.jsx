import React, { useState } from 'react';
import { Menu, X, User, History, LogOut } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { NAV_LINKS } from '../../data/mockData';
import { useAuth } from '../../context/AuthContext';
import { useLocation, useNavigate } from 'react-router-dom';
import logoIcon from '../../assets/icon/icon.png';
import UserMenu from './UserMenu';
import LanguageSwitcher from './LanguageSwitcher';
import ConfirmModal from '../common/ConfirmModal';

const NAV_LABEL_KEYS = {
  'Trang chủ': 'nav.home',
  'Phòng nghỉ': 'nav.rooms',
  'Ưu đãi': 'nav.promotions',
  'Liên hệ': 'nav.contact',
};

// Trang con vẫn được tính là thuộc mục menu tương ứng: đang xem chi tiết một phòng
// (/rooms/:id) thì mục "Phòng nghỉ" vẫn sáng.
const NAV_EXTRA_MATCH = {
  '/searchrooms': ['/rooms'],
};

export default function Header() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const { user, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();

  const handleNavClick = (path) => {
    navigate(path);
    setIsMobileMenuOpen(false);
  };

  // "Ưu đãi" và "Liên hệ" là hai khu vực trên chính trang chủ (/#uu-dai, /#lien-he)
  // nên phải so khớp cả hash, nếu không "Trang chủ" sẽ sáng cùng lúc với chúng.
  const isNavActive = (to) => {
    const [rawPath, hash] = to.split('#');
    const path = rawPath || '/';

    if (hash) {
      return location.pathname === path && location.hash === `#${hash}`;
    }
    if (path === '/') {
      return location.pathname === '/' && !location.hash;
    }
    if (location.pathname === path || location.pathname.startsWith(`${path}/`)) {
      return true;
    }
    return (NAV_EXTRA_MATCH[path] || []).some(
      (prefix) => location.pathname === prefix || location.pathname.startsWith(`${prefix}/`),
    );
  };

  return (
    <header className="fixed top-0 left-0 right-0 bg-white/95 backdrop-blur-md z-50 shadow-sm transition-all border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">

          {/* LEFT: LOGO */}
          <div className="flex-shrink-0 flex items-center cursor-pointer group" onClick={() => navigate('/')}>
            <img
              src={logoIcon}
              alt="Vika Hotel Logo"
              className="h-25 w-25 object-contain transition-transform group-hover:scale-110"
            />
            {/* <span className="text-xl font-bold text-blue-600 tracking-tight font-poppins">VIKA HOTEL</span> */}
          </div>

          {/* CENTER: NAVIGATION */}
          <nav className="hidden md:flex space-x-8 items-center justify-center flex-1">
            {NAV_LINKS.map((item) => {
              const active = isNavActive(item.to);
              return (
                <button
                  key={item.label}
                  onClick={() => navigate(item.to)}
                  aria-current={active ? 'page' : undefined}
                  className={`relative font-medium text-sm transition-colors uppercase tracking-wide ${
                    active ? 'text-blue-600' : 'text-gray-600 hover:text-blue-600'
                  }`}
                >
                  {t(NAV_LABEL_KEYS[item.label] ?? item.label)}
                  {active && (
                    <span className="absolute -bottom-2 left-0 right-0 h-0.5 rounded-full bg-blue-600" />
                  )}
                </button>
              );
            })}
          </nav>

          {/* RIGHT: AUTH BUTTONS */}
          <div className="hidden md:flex items-center gap-3 flex-shrink-0">
            {isAuthenticated ? (
              <UserMenu />
            ) : (
              <>
                <button
                  onClick={() => navigate('/login')}
                  className="text-gray-600 hover:text-blue-600 font-medium text-sm"
                >
                  {t('auth.login')}
                </button>
                <button
                  onClick={() => navigate('/register')} // Update to /register if separate
                  className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-full font-bold text-sm transition-transform hover:scale-105 shadow-lg shadow-blue-200"
                >
                  {t('auth.register')}
                </button>
              </>
            )}
            <LanguageSwitcher />
          </div>

          {/* MOBILE MENU BUTTON */}
          <div className="md:hidden flex items-center gap-3">
            <LanguageSwitcher />
            <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="text-gray-600">
              {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </div>

      {/* MOBILE MENU DROPDOWN */}
      {isMobileMenuOpen && (
        <div className="md:hidden bg-white border-t border-gray-100 absolute w-full shadow-lg">
          <div className="px-4 pt-2 pb-6 space-y-2">
            {NAV_LINKS.map((item) => {
              const active = isNavActive(item.to);
              return (
                <button
                  key={item.label}
                  onClick={() => handleNavClick(item.to)}
                  aria-current={active ? 'page' : undefined}
                  className={`block w-full text-left px-3 py-3 text-base rounded-md transition-colors ${
                    active
                      ? 'bg-blue-50 font-semibold text-blue-600'
                      : 'font-medium text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {t(NAV_LABEL_KEYS[item.label] ?? item.label)}
                </button>
              );
            })}
            {isAuthenticated ? (
              <div className="pt-2 mt-2 border-t border-gray-100">
                <div className="flex items-center gap-3 px-3 py-3">
                  <img
                    src={user?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || user?.username || 'Tài khoản')}&background=2563eb&color=fff`}
                    alt={user?.name || user?.username}
                    className="w-11 h-11 rounded-full object-cover shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-gray-900 truncate">{user?.name || user?.username}</p>
                    {user?.email && <p className="text-xs text-gray-500 truncate">{user.email}</p>}
                  </div>
                </div>

                <button
                  onClick={() => handleNavClick('/user/profile')}
                  className="w-full flex items-center gap-2.5 text-left px-3 py-3 text-base font-medium text-gray-700 hover:bg-gray-50 rounded-md"
                >
                  <User size={18} className="text-gray-400" /> {t('userMenu.profile')}
                </button>
                <button
                  onClick={() => handleNavClick('/user/historybooking')}
                  className="w-full flex items-center gap-2.5 text-left px-3 py-3 text-base font-medium text-gray-700 hover:bg-gray-50 rounded-md"
                >
                  <History size={18} className="text-gray-400" /> {t('userMenu.bookingHistory')}
                </button>
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    setConfirmLogout(true);
                  }}
                  className="w-full flex items-center gap-2.5 text-left px-3 py-3 mt-1 text-base font-bold text-red-600 hover:bg-red-50 rounded-md"
                >
                  <LogOut size={18} /> {t('auth.logout')}
                </button>
              </div>
            ) : (
              <div className="mt-4 flex flex-col gap-3">
                <button onClick={() => handleNavClick('/login')} className="w-full text-center py-3 border border-gray-300 rounded-lg font-bold text-gray-700">{t('auth.login')}</button>
                <button onClick={() => handleNavClick('/login')} className="w-full text-center py-3 bg-blue-600 text-white rounded-lg font-bold">{t('auth.register')}</button>
              </div>
            )}
          </div>
        </div>
      )}

      <ConfirmModal
        open={confirmLogout}
        danger
        title={t('auth.logoutConfirmTitle')}
        message={t('auth.logoutConfirmMessage')}
        confirmLabel={t('auth.logout')}
        onConfirm={async () => {
          setConfirmLogout(false);
          await logout();
          navigate('/login');
        }}
        onClose={() => setConfirmLogout(false)}
      />
    </header>
  );
}
