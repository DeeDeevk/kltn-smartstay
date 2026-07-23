import React, { useState } from 'react';
import { Mail, Eye, EyeOff, Loader2, User, Phone, Lock, Image as ImageIcon } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
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
        name: '',
        phone_number: '',
    });

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

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
        <div className="flex flex-col justify-center items-center w-full max-w-md mx-auto px-6 py-8 lg:px-8">
            {/* Header Form */}
            <div className="w-full mb-8">
                <h2 className="text-3xl font-bold text-gray-900 mb-3">Tạo tài khoản mới</h2>
                <p className="text-gray-500 text-sm">
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
                            className="w-full border border-gray-300 rounded-lg pl-4 pr-10 py-2.5 text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all font-sans"
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
    );
}
