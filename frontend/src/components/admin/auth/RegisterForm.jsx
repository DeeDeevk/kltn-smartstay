import React, { useState } from 'react';
import { Mail, Eye, EyeOff, Loader2, User, Phone, Lock } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { toast } from 'react-toastify';

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
      <div className="w-full max-w-[480px] rounded-[28px] border border-white/70 bg-white/90 p-8 shadow-[0_30px_80px_rgba(15,23,42,0.10)] backdrop-blur-xl md:p-10">
        <div className="mb-8 space-y-2">
          <h2 className="text-[2rem] font-bold tracking-tight text-slate-900 md:text-[2.25rem]">Tạo tài khoản mới</h2>
          <p className="max-w-md text-[15px] leading-7 text-slate-500">
            Tham gia cùng Vika Hotel để trải nghiệm những dịch vụ tốt nhất.
          </p>
        </div>

        <form className="w-full space-y-4" onSubmit={handleSubmit}>
          {/* Full Name Field */}
          <div className="space-y-1">
            <label className="text-sm font-semibold text-gray-700 block">Họ và tên</label>
            <div className="relative">
              <input
                type="text"
                name="name"
                required
                value={formData.name}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg pl-4 pr-10 py-2.5 text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                placeholder="Nguyễn Văn A"
              />
              <User className="absolute right-3 top-2.5 text-gray-400" size={20} />
            </div>
          </div>

          {/* Username Field */}
          <div className="space-y-1">
            <label className="text-sm font-semibold text-gray-700 block">Tên đăng nhập</label>
            <div className="relative">
              <input
                type="text"
                name="username"
                required
                value={formData.username}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg pl-4 pr-10 py-2.5 text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                placeholder="username123"
              />
              <User className="absolute right-3 top-2.5 text-gray-400" size={20} />
            </div>
          </div>

          {/* Email Field */}
          <div className="space-y-1">
            <label className="text-sm font-semibold text-gray-700 block">Email</label>
            <div className="relative">
              <input
                type="email"
                name="email"
                required
                value={formData.email}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg pl-4 pr-10 py-2.5 text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                placeholder="name@example.com"
              />
              <Mail className="absolute right-3 top-2.5 text-gray-400" size={20} />
            </div>
          </div>

          {/* Phone Number Field */}
          <div className="space-y-1">
            <label className="text-sm font-semibold text-gray-700 block">Số điện thoại</label>
            <div className="relative">
              <input
                type="tel"
                name="phone_number"
                required
                value={formData.phone_number}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg pl-4 pr-10 py-2.5 text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                placeholder="0912345678"
              />
              <Phone className="absolute right-3 top-2.5 text-gray-400" size={20} />
            </div>
          </div>

          {/* Password Field */}
          <div className="space-y-1">
            <label className="text-sm font-semibold text-gray-700 block">Mật khẩu</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                required
                value={formData.password}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg pl-4 pr-10 py-2.5 text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 focus:outline-none"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          {/* Confirm Password Field */}
          <div className="space-y-1">
            <label className="text-sm font-semibold text-gray-700 block">Nhập lại mật khẩu</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                name="confirmPassword"
                required
                value={formData.confirmPassword}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg pl-4 pr-10 py-2.5 text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                placeholder="••••••••"
              />
              <Lock className="absolute right-3 top-2.5 text-gray-400" size={20} />
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm font-medium">
              {error}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg shadow-sm shadow-blue-200 transition-all transform active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed mt-4"
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
          <div className="text-center mt-6">
            <p className="text-sm text-gray-500">
              Đã có tài khoản?{' '}
              <button
                type="button"
                onClick={() => navigate('/login', { state: location.state })}
                className="font-bold text-blue-600 hover:text-blue-500 hover:underline"
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
