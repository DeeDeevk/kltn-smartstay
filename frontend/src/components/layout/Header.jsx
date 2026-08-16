import React, { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { NAV_LINKS } from '../../data/mockData';
import { useAuth } from '../../context/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import logoIcon from '../../assets/icon/icon.png';
import UserMenu from './UserMenu';

export default function Header() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

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
                key={item}
                onClick={() => navigate('/')}
                className="text-gray-600 hover:text-blue-600 font-medium text-sm transition-colors uppercase tracking-wide"
              >
                {item}
              </button>
            ))}
            {/* Thêm link Lịch sử cho Dashboard */}
            {isAuthenticated && (
              <button
                onClick={() => navigate('/user/historybooking')}
                className={`font-medium text-sm transition-colors uppercase tracking-wide ${location.pathname === '/user/historybooking' ? 'text-blue-600 font-bold' : 'text-gray-600 hover:text-blue-600'}`}
              >
                Lịch sử
              </button>
            )}
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
                key={item}
                onClick={() => handleNavClick('/')}
                className="block w-full text-left px-3 py-3 text-base font-medium text-gray-700 hover:bg-gray-50 rounded-md"
              >
                {item}
              </button>
            ))}
            {isAuthenticated && (
              <>
                <button
                  onClick={() => handleNavClick('/user/profile')}
                  className="block w-full text-left px-3 py-3 text-base font-medium text-gray-700 hover:bg-gray-50 rounded-md"
                >
                  Hồ sơ của tôi
                </button>
                <button
                  onClick={() => handleNavClick('/user/historybooking')}
                  className="block w-full text-left px-3 py-3 text-base font-medium text-gray-700 hover:bg-gray-50 rounded-md"
                >
                  Lịch sử đặt phòng
                </button>
              </>
            )}
            {!isAuthenticated && (
              <div className="mt-4 flex flex-col gap-3">
                <button onClick={() => handleNavClick('/login')} className="w-full text-center py-3 border border-gray-300 rounded-lg font-bold text-gray-700">Đăng nhập</button>
                <button onClick={() => handleNavClick('/login')} className="w-full text-center py-3 bg-blue-600 text-white rounded-lg font-bold">Đăng ký</button>
              </div>
            )}
            {isAuthenticated && (
              <button
                onClick={logout}
                className="w-full text-center py-3 mt-2 text-red-600 font-bold border border-red-100 rounded-lg"
              >
                Đăng xuất
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
