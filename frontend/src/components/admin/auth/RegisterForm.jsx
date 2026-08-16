import React, { useState } from 'react';
import { Mail, Eye, EyeOff, Loader2, User, Phone, Lock } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { toast } from 'react-toastify';

const inputClass = "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 pr-12 text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100";
const labelClass = "mb-1.5 block text-sm font-semibold text-slate-700";
const iconClass = "absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none";

export default function RegisterForm() {
  const navigate = useNavigate();
  const location = useLocation();
  const { register, login } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    name: '',
    phone_number: '',
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (formData.password !== formData.confirmPassword) {
      setError('Mật khẩu nhập lại không khớp');
      return;
    }

    setLoading(true);

    // Prepare payload with default values
    const payload = {
      ...formData,
      role: 'user',
      is_active: true,
    };

    try {
      await register(payload);
      toast.success('Đăng ký tài khoản thành công!');

      // Auto login after registration
      await login({
        username: formData.username,
        password: formData.password
      });

      // Redirect directly to checkout or fallback to home/history
      const from = location.state?.from || '/';
      const checkoutState = location.state?.checkoutState;
      navigate(from, { state: checkoutState });
    } catch (err) {
      console.error('Registration error:', err);
      setError(err.message || 'Có lỗi xảy ra khi đăng ký');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  return (
    <div className="flex h-full w-full items-center justify-center px-6 py-8 lg:px-10">
      <div className="w-full max-w-[560px] rounded-[28px] border border-white/70 bg-white/90 p-8 shadow-[0_30px_80px_rgba(15,23,42,0.10)] backdrop-blur-xl md:p-10">
        <div className="mb-8 space-y-2">
          <h2 className="text-[2rem] font-bold tracking-tight text-slate-900 md:text-[2.25rem]">Tạo tài khoản mới</h2>
          <p className="max-w-md text-[15px] leading-7 text-slate-500">
            Tham gia cùng Vika Hotel để trải nghiệm những dịch vụ tốt nhất.
          </p>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit}>
          {/* Full Name */}
          <div>
            <label className={labelClass}>Họ và tên</label>
            <div className="relative">
              <input
                type="text"
                name="name"
                required
                value={formData.name}
                onChange={handleChange}
                className={inputClass}
                placeholder="Nguyễn Văn A"
              />
              <User className={iconClass} size={18} />
            </div>
          </div>

          {/* Phone + Email */}
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Số điện thoại</label>
              <div className="relative">
                <input
                  type="tel"
                  name="phone_number"
                  required
                  value={formData.phone_number}
                  onChange={handleChange}
                  className={inputClass}
                  placeholder="0912345678"
                />
                <Phone className={iconClass} size={18} />
              </div>
            </div>
            <div>
              <label className={labelClass}>Email</label>
              <div className="relative">
                <input
                  type="email"
                  name="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  className={inputClass}
                  placeholder="name@example.com"
                />
                <Mail className={iconClass} size={18} />
              </div>
            </div>
          </div>

          {/* Username */}
          <div>
            <label className={labelClass}>Tên đăng nhập</label>
            <div className="relative">
              <input
                type="text"
                name="username"
                required
                value={formData.username}
                onChange={handleChange}
                className={inputClass}
                placeholder="username123"
              />
              <User className={iconClass} size={18} />
            </div>
          </div>

          {/* Password + Confirm Password */}
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Mật khẩu</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  required
                  value={formData.password}
                  onChange={handleChange}
                  className={inputClass}
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
            <div>
              <label className={labelClass}>Nhập lại mật khẩu</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  name="confirmPassword"
                  required
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className={inputClass}
                  placeholder="••••••••"
                />
                <Lock className={iconClass} size={18} />
              </div>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
              {error}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 font-bold text-white shadow-[0_18px_45px_rgba(37,99,235,0.28)] transition-all hover:brightness-105 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin" size={20} />
                Đang đăng ký...
              </>
            ) : (
              'Đăng ký'
            )}
          </button>

          {/* Sign In Link */}
          <div className="text-center pt-2">
            <p className="text-sm text-slate-500">
              Đã có tài khoản?{' '}
              <button
                type="button"
                onClick={() => navigate('/login', { state: location.state })}
                className="font-bold text-blue-600 transition-colors hover:text-blue-500 hover:underline"
              >
                Đăng nhập ngay
              </button>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
