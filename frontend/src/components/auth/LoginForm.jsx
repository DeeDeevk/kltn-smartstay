import React, { useState } from 'react';
import { Eye, EyeOff, Loader2, ShieldCheck, User } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
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
            Vui lòng nhập thông tin để truy cập hệ thống quản lý Vika Hotel.
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

          <div className="flex items-center justify-between gap-4 pt-1">
            <label className="flex cursor-pointer items-center gap-2 group">
              <input
                type="checkbox"
                checked={formData.rememberMe}
                onChange={(e) => setFormData({ ...formData, rememberMe: e.target.checked })}
                className="h-4 w-4 cursor-pointer rounded border-slate-300 accent-sky-500 focus:ring-sky-500"
              />
              <span className="text-sm leading-none text-slate-500 transition-colors group-hover:text-slate-700">Ghi nhớ đăng nhập</span>
            </label>
            <a href="#" className="text-sm font-semibold leading-none text-blue-600 transition-colors hover:text-blue-500 hover:underline">
              Quên mật khẩu?
            </a>
          </div>

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
              <>
                <ShieldCheck size={18} />
                Đăng nhập
              </>
            )}
          </button>

          <div className="relative flex items-center justify-center py-2">
            <div className="absolute inset-x-0 top-1/2 h-px bg-slate-200" />
            <span className="relative z-10 bg-white px-4 text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">Hoặc</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button type="button" className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white py-3 font-semibold text-slate-700 shadow-sm transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50 hover:shadow-sm">
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.09z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              Google
            </button>

            <button type="button" className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white py-3 font-semibold text-slate-700 shadow-sm transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50 hover:shadow-sm">
              <svg className="h-5 w-5 fill-current text-blue-600" viewBox="0 0 24 24">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
              </svg>
              Facebook
            </button>
          </div>

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