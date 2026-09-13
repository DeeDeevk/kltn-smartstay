import React, { useState } from 'react';
import { Eye, EyeOff, Loader2, Mail } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../../context/AuthContext';
import { toast } from 'react-toastify';
import GoogleLoginButton from './GoogleLoginButton';
import useRedirectAfterLogin from './useRedirectAfterLogin';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 6;

function validateLoginForm({ email, password }, t) {
  if (!EMAIL_REGEX.test(email)) {
    return t('auth.errors.invalidEmail');
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return t('auth.errors.passwordMinLength', { count: MIN_PASSWORD_LENGTH });
  }
  return null;
}

function getLoginErrorMessage(err, t) {
  if (err.status === 401) {
    return t('auth.errors.loginFailed401');
  }
  if (err.status === 400) {
    return err.message || t('auth.errors.invalidLoginInfo');
  }
  return err.message || t('auth.errors.loginGenericError');
}

export default function LoginForm() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, loginWithGoogle } = useAuth();
  const { t } = useTranslation();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    rememberMe: false,
  });

  const redirectAfterLogin = useRedirectAfterLogin();

  const handleSubmit = async (e) => {
    e.preventDefault();

    const validationError = validateLoginForm(formData, t);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setLoading(true);
    try {
      const user = await login({
        email: formData.email,
        password: formData.password,
      });
      toast.success(t('auth.toasts.loginSuccess'));
      redirectAfterLogin(user);
    } catch (err) {
      console.error('Login error:', err);
      toast.error(getLoginErrorMessage(err, t));
    } finally {
      setLoading(false);
    }
  };

  // Google tra ve ID token qua callback cua GSI, doi lay phien dang nhap cua he thong.
  const handleGoogleCredential = async (idToken) => {
    setGoogleLoading(true);
    try {
      const user = await loginWithGoogle(idToken);
      toast.success(t('auth.toasts.loginSuccess'));
      redirectAfterLogin(user);
    } catch (err) {
      console.error('Google login error:', err);
      toast.error(err.message || t('auth.errors.googleLoginError'));
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="flex h-full w-full items-center justify-center px-6 py-12 lg:px-10">
      <div className="w-full max-w-[480px] rounded-[28px] border border-white/70 bg-white/90 p-8 shadow-[0_30px_80px_rgba(15,23,42,0.10)] backdrop-blur-xl md:p-10">
        <div className="mb-8 space-y-2">
          <h2 className="text-[2rem] font-bold tracking-tight text-slate-900 md:text-[2.25rem]">{t('auth.welcomeBack')}</h2>
          <p className="max-w-md text-[15px] leading-7 text-slate-500">
            {t('auth.loginSubtitle')}
          </p>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit} autoComplete="off">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">{t('auth.email')}</label>
            <div className="relative">
              <input
                type="email"
                name="login-email"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 pr-12 text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                placeholder="name@example.com"
              />
              <Mail className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">{t('auth.password')}</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                name="login-password"
                autoComplete="new-password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 pr-12 text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-600 focus:outline-none"
                aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 pt-1">
            <label className="flex cursor-pointer items-center gap-2 group">
              <input
                type="checkbox"
                checked={formData.rememberMe}
                onChange={(e) => setFormData({ ...formData, rememberMe: e.target.checked })}
                className="h-4 w-4 cursor-pointer rounded border-slate-300 accent-sky-500 focus:ring-sky-500"
              />
              <span className="text-sm leading-none text-slate-500 transition-colors group-hover:text-slate-700">{t('auth.rememberMe')}</span>
            </label>
            <button
              type="button"
              onClick={() => navigate('/forgot-password')}
              className="text-sm font-semibold text-blue-600 transition-colors hover:text-blue-500 hover:underline"
            >
              {t('auth.forgotPassword')}
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 font-bold text-white shadow-[0_18px_45px_rgba(37,99,235,0.28)] transition-all hover:brightness-105 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin" size={20} />
                {t('auth.loggingIn')}
              </>
            ) : (
              t('auth.login')
            )}
          </button>

          <div className="flex items-center gap-3 pt-1">
            <span className="h-px flex-1 bg-slate-200" />
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">{t('auth.orDivider')}</span>
            <span className="h-px flex-1 bg-slate-200" />
          </div>

          <GoogleLoginButton onCredential={handleGoogleCredential} disabled={loading || googleLoading} />

          <div className="text-center pt-2">
            <p className="text-sm text-slate-500">
              {t('auth.noAccount')}{' '}
              <button
                type="button"
                onClick={() => navigate('/register', { state: location.state })}
                className="font-bold text-blue-600 transition-colors hover:text-blue-500 hover:underline"
              >
                {t('auth.createNewAccount')}
              </button>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
