import React, { useState } from 'react';
import { Menu, X, User, History, LogOut } from 'lucide-react';
import { NAV_LINKS } from '../../data/mockData';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import logoIcon from '../../assets/icon/icon.png';
import UserMenu from './UserMenu';

export default function Header() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { user, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  // Highlight active link if needed, or just handle navigation
  const handleNavClick = (path) => {
    navigate(path);
    setIsMobileMenuOpen(false);
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
            {NAV_LINKS.map((item) => (
              <button
                key={item.label}
                onClick={() => navigate(item.to)}
                className="text-gray-600 hover:text-blue-600 font-medium text-sm transition-colors uppercase tracking-wide"
              >
                {item.label}
              </button>
            ))}
          </nav>

          {/* RIGHT: AUTH BUTTONS */}
          <div className="hidden md:flex items-center gap-4 flex-shrink-0">
            {isAuthenticated ? (
              <UserMenu />
            ) : (
              <>
                <button
                  onClick={() => navigate('/login')}
                  className="text-gray-600 hover:text-blue-600 font-medium text-sm"
                >
                  Đăng nhập
                </button>
                <button
                  onClick={() => navigate('/register')} // Update to /register if separate
                  className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-full font-bold text-sm transition-transform hover:scale-105 shadow-lg shadow-blue-200"
                >
                  Đăng ký
                </button>
              </>
            )}
          </div>

          {/* MOBILE MENU BUTTON */}
          <div className="md:hidden">
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
            {NAV_LINKS.map((item) => (
              <button
                key={item.label}
                onClick={() => handleNavClick(item.to)}
                className="block w-full text-left px-3 py-3 text-base font-medium text-gray-700 hover:bg-gray-50 rounded-md"
              >
                {item.label}
              </button>
            ))}
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
                  <User size={18} className="text-gray-400" /> Hồ sơ của tôi
                </button>
                <button
                  onClick={() => handleNavClick('/user/historybooking')}
                  className="w-full flex items-center gap-2.5 text-left px-3 py-3 text-base font-medium text-gray-700 hover:bg-gray-50 rounded-md"
                >
                  <History size={18} className="text-gray-400" /> Lịch sử đặt phòng
                </button>
                <button
                  onClick={logout}
                  className="w-full flex items-center gap-2.5 text-left px-3 py-3 mt-1 text-base font-bold text-red-600 hover:bg-red-50 rounded-md"
                >
                  <LogOut size={18} /> Đăng xuất
                </button>
              </div>
            ) : (
              <div className="mt-4 flex flex-col gap-3">
                <button onClick={() => handleNavClick('/login')} className="w-full text-center py-3 border border-gray-300 rounded-lg font-bold text-gray-700">Đăng nhập</button>
                <button onClick={() => handleNavClick('/login')} className="w-full text-center py-3 bg-blue-600 text-white rounded-lg font-bold">Đăng ký</button>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
