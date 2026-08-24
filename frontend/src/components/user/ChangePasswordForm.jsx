import { useState } from 'react';
import { Lock, Eye, EyeOff, Loader2, KeyRound } from 'lucide-react';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';
import { useChangePasswordMutation } from '../../services/user';

const MIN_PASSWORD_LENGTH = 8;
// Khớp rule mạnh của backend (ChangePasswordDto): tối thiểu 8 ký tự, có cả chữ và số.
const STRONG_PASSWORD_REGEX = /(?=.*[a-zA-Z])(?=.*[0-9])/;

function validate({ oldPassword, newPassword, confirmPassword }, t) {
  if (!oldPassword) {
    return t('profile.changePassword.errors.currentRequired');
  }
  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return t('profile.changePassword.errors.minLength', { count: MIN_PASSWORD_LENGTH });
  }
  if (!STRONG_PASSWORD_REGEX.test(newPassword)) {
    return t('profile.changePassword.errors.needsLetterAndNumber');
  }
  if (newPassword !== confirmPassword) {
    return t('profile.changePassword.errors.mismatch');
  }
  return null;
}

function getChangePasswordErrorMessage(err, t) {
  if (err.status === 401) {
    return t('profile.changePassword.errors.wrongCurrent');
  }
  return err.message || t('profile.changePassword.errors.generic');
}

export default function ChangePasswordForm() {
  const { t } = useTranslation();
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

    const validationError = validate(formData, t);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    try {
      await changePassword({
        oldPassword: formData.oldPassword,
        newPassword: formData.newPassword,
      }).unwrap();
      toast.success(t('profile.changePassword.success'));
      setFormData({ oldPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      toast.error(getChangePasswordErrorMessage(err, t));
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-6 space-y-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm md:p-8"
    >
      <div className="flex items-center gap-2">
        <KeyRound size={18} className="text-gray-500" />
        <h2 className="text-lg font-bold text-gray-900">{t('profile.changePassword.title')}</h2>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-gray-500">
            <Lock size={14} /> {t('profile.changePassword.currentPassword')}
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
            <Lock size={14} /> {t('profile.changePassword.newPassword')}
          </label>
          <input
            type={showPassword ? 'text' : 'password'}
            value={formData.newPassword}
            onChange={handleChange('newPassword')}
            className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder={t('profile.changePassword.newPasswordPlaceholder')}
          />
        </div>
        <div>
          <label className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-gray-500">
            <Lock size={14} /> {t('profile.changePassword.confirmNewPassword')}
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
          {showPassword ? t('profile.changePassword.hidePassword') : t('profile.changePassword.showPassword')}
        </button>

        <button
          type="submit"
          disabled={isLoading}
          className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 font-bold text-white transition-colors hover:bg-blue-700 disabled:opacity-70"
        >
          {isLoading && <Loader2 size={18} className="animate-spin" />}
          {isLoading ? t('profile.changePassword.processing') : t('profile.changePassword.submit')}
        </button>
      </div>
    </form>
  );
}
