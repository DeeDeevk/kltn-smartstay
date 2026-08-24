import { useState } from 'react';
import { Lock, Eye, EyeOff, Loader2, KeyRound } from 'lucide-react';
import { toast } from 'react-toastify';
import { useChangePasswordMutation } from '../../services/user';

const MIN_PASSWORD_LENGTH = 8;
// Khớp rule mạnh của backend (ChangePasswordDto): tối thiểu 8 ký tự, có cả chữ và số.
const STRONG_PASSWORD_REGEX = /(?=.*[a-zA-Z])(?=.*[0-9])/;

function validate({ oldPassword, newPassword, confirmPassword }) {
  if (!oldPassword) {
    return 'Vui lòng nhập mật khẩu hiện tại';
  }
  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return `Mật khẩu mới phải có ít nhất ${MIN_PASSWORD_LENGTH} ký tự`;
  }
  if (!STRONG_PASSWORD_REGEX.test(newPassword)) {
    return 'Mật khẩu mới phải chứa cả chữ và số';
  }
  if (newPassword !== confirmPassword) {
    return 'Mật khẩu mới nhập lại không khớp';
  }
  return null;
}

function getChangePasswordErrorMessage(err) {
  if (err.status === 401) {
    return 'Mật khẩu hiện tại không đúng';
  }
  return err.message || 'Không thể đổi mật khẩu, vui lòng thử lại';
}

export default function ChangePasswordForm() {
  const [changePassword, { isLoading }] = useChangePasswordMutation();
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const handleChange = (field) => (e) => {
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const validationError = validate(formData);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    try {
      await changePassword({
        oldPassword: formData.oldPassword,
        newPassword: formData.newPassword,
      }).unwrap();
      toast.success('Đổi mật khẩu thành công!');
      setFormData({ oldPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      toast.error(getChangePasswordErrorMessage(err));
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-6 space-y-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm md:p-8"
    >
      <div className="flex items-center gap-2">
        <KeyRound size={18} className="text-gray-500" />
        <h2 className="text-lg font-bold text-gray-900">Đổi mật khẩu</h2>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-gray-500">
            <Lock size={14} /> Mật khẩu hiện tại
          </label>
          <input
            type={showPassword ? 'text' : 'password'}
            value={formData.oldPassword}
            onChange={handleChange('oldPassword')}
            className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="••••••••"
          />
        </div>
        <div>
          <label className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-gray-500">
            <Lock size={14} /> Mật khẩu mới
          </label>
          <input
            type={showPassword ? 'text' : 'password'}
            value={formData.newPassword}
            onChange={handleChange('newPassword')}
            className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Ít nhất 8 ký tự, có chữ và số"
          />
        </div>
        <div>
          <label className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-gray-500">
            <Lock size={14} /> Nhập lại mật khẩu mới
          </label>
          <input
            type={showPassword ? 'text' : 'password'}
            value={formData.confirmPassword}
            onChange={handleChange('confirmPassword')}
            className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="••••••••"
          />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setShowPassword((prev) => !prev)}
          className="flex items-center gap-1.5 text-sm font-semibold text-gray-500 transition-colors hover:text-gray-700"
        >
          {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          {showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
        </button>

        <button
          type="submit"
          disabled={isLoading}
          className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 font-bold text-white transition-colors hover:bg-blue-700 disabled:opacity-70"
        >
          {isLoading && <Loader2 size={18} className="animate-spin" />}
          {isLoading ? 'Đang xử lý...' : 'Đổi mật khẩu'}
        </button>
      </div>
    </form>
  );
}
