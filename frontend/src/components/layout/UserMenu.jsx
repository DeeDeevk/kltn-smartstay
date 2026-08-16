import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, User, History, LogOut } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function UserMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
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
    logout();
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center gap-2 pl-1.5 pr-3 py-1.5 bg-gray-50 rounded-full border border-gray-200 hover:bg-gray-100 transition-colors"
      >
        <img src={avatarUrl} alt={displayName} className="w-7 h-7 rounded-full object-cover" />
        <span className="text-sm font-semibold text-gray-700 max-w-[120px] truncate">{displayName}</span>
        <ChevronDown size={14} className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl border border-gray-100 shadow-xl overflow-hidden z-50">
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="text-sm font-bold text-gray-900 truncate">{displayName}</p>
            {user?.email && <p className="text-xs text-gray-500 truncate mt-0.5">{user.email}</p>}
          </div>

          <div className="py-1">
            <button
              onClick={() => goTo('/user/profile')}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <User size={16} className="text-gray-400" /> Hồ sơ của tôi
            </button>
            <button
              onClick={() => goTo('/user/historybooking')}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <History size={16} className="text-gray-400" /> Lịch sử đặt phòng
            </button>
          </div>

          <div className="py-1 border-t border-gray-100">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 transition-colors"
            >
              <LogOut size={16} /> Đăng xuất
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
