import React, { useState } from 'react';
import { Eye, EyeOff, Loader2, User } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { toast } from 'react-toastify';

export default function LoginForm() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    rememberMe: false,
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await login({
        username: formData.username,
        password: formData.password,
      });
      toast.success('Đăng nhập thành công!');

      const from = location.state?.from || '/';
      const checkoutState = location.state?.checkoutState;
      navigate(from, { state: checkoutState });
    } catch (err) {
      console.error('Login error:', err);
      setError(err.message || 'Có lỗi xảy ra khi đăng nhập');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-full w-full items-center justify-center px-6 py-12 lg:px-10">
      <div className="w-full max-w-[480px] rounded-[28px] border border-white/70 bg-white/90 p-8 shadow-[0_30px_80px_rgba(15,23,42,0.10)] backdrop-blur-xl md:p-10">
        <div className="mb-8 space-y-2">
          <h2 className="text-[2rem] font-bold tracking-tight text-slate-900 md:text-[2.25rem]">Chào mừng trở lại</h2>
          <p className="max-w-md text-[15px] leading-7 text-slate-500">
            Đăng nhập để tiếp tục đặt phòng và quản lý các đặt phòng của bạn tại Vika Hotel.
          </p>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Tên đăng nhập</label>
            <div className="relative">
              <input
                type="text"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 pr-12 text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                placeholder="Nhập tên đăng nhập của bạn"
              />
              <User className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Mật khẩu</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 pr-12 text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-600 focus:outline-none"
                aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <label className="flex cursor-pointer items-center gap-2 group pt-1">
            <input
              type="checkbox"
              checked={formData.rememberMe}
              onChange={(e) => setFormData({ ...formData, rememberMe: e.target.checked })}
              className="h-4 w-4 cursor-pointer rounded border-slate-300 accent-sky-500 focus:ring-sky-500"
            />
            <span className="text-sm leading-none text-slate-500 transition-colors group-hover:text-slate-700">Ghi nhớ đăng nhập</span>
          </label>

          {error && (
            <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 font-bold text-white shadow-[0_18px_45px_rgba(37,99,235,0.28)] transition-all hover:brightness-105 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin" size={20} />
                Đang đăng nhập...
              </>
            ) : (
              'Đăng nhập'
            )}
          </button>

          <div className="text-center pt-2">
            <p className="text-sm text-slate-500">
              Chưa có tài khoản?{' '}
              <button
                type="button"
                onClick={() => navigate('/register', { state: location.state })}
                className="font-bold text-blue-600 transition-colors hover:text-blue-500 hover:underline"
              >
                Đăng ký tài khoản mới
              </button>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}