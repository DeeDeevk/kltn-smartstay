import React, { useEffect, useState } from 'react';
import { ArrowLeft, Eye, EyeOff, Loader2, Lock, Mail, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import {
  useForgotPasswordMutation,
  useVerifyResetOtpMutation,
  useResetPasswordMutation,
} from '../../../services/auth';

const inputClass = "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 pr-12 text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100";
const labelClass = "mb-1.5 block text-sm font-semibold text-slate-700";
const iconClass = "absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none";
const submitClass = "flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 font-bold text-white shadow-[0_18px_45px_rgba(37,99,235,0.28)] transition-all hover:brightness-105 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 6;
const RESEND_COOLDOWN_SECONDS = 30;

function getOtpErrorMessage(err, t) {
  if (err.status === 400 || err.status === 401) {
    return t('auth.errors.invalidOtp');
  }
  return err.message || t('auth.errors.otpGenericError');
}

export default function ForgotPasswordForm() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  // 'email' -> nhập email | 'otp' -> nhập mã | 'password' -> đặt mật khẩu mới
  const [step, setStep] = useState('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const [forgotPassword, { isLoading: sending }] = useForgotPasswordMutation();
  const [verifyResetOtp, { isLoading: verifying }] = useVerifyResetOtpMutation();
  const [resetPassword, { isLoading: resetting }] = useResetPasswordMutation();

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((s) => s - 1), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleSendOtp = async (e) => {
    e.preventDefault();
    if (!EMAIL_REGEX.test(email)) {
      toast.error(t('auth.errors.invalidEmail'));
      return;
    }
    try {
      await forgotPassword(email).unwrap();
      toast.success(t('auth.toasts.resetOtpSent'));
      setCooldown(RESEND_COOLDOWN_SECONDS);
      setStep('otp');
    } catch (err) {
      toast.error(err.message || t('auth.errors.forgotPasswordError'));
    }
  };

  // Gửi lại mã phải gọi ĐÚNG /auth/forgot-password. Endpoint /auth/resend-otp
  // dùng key Redis khác (dành cho luồng đăng ký) nên mã sẽ không bao giờ khớp.
  const handleResend = async () => {
    try {
      await forgotPassword(email).unwrap();
      toast.success(t('auth.toasts.otpResent'));
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      toast.error(err.message || t('auth.errors.resendOtpError'));
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    try {
      await verifyResetOtp({ email, otp }).unwrap();
      setStep('password');
    } catch (err) {
      toast.error(getOtpErrorMessage(err, t));
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (password.length < MIN_PASSWORD_LENGTH) {
      toast.error(t('auth.errors.passwordMinLength', { count: MIN_PASSWORD_LENGTH }));
      return;
    }
    if (password !== confirmPassword) {
      toast.error(t('auth.errors.passwordMismatch'));
      return;
    }
    try {
      await resetPassword({ email, otp, newPassword: password }).unwrap();
      toast.success(t('auth.toasts.resetPasswordSuccess'));
      navigate('/login');
    } catch (err) {
      // 401 ở bước này nghĩa là OTP đã hết hạn giữa chừng, hoặc tài khoản đăng
      // nhập bằng Google — message từ backend đã đủ rõ nên ưu tiên hiển thị.
      toast.error(err.message || t('auth.errors.resetPasswordError'));
    }
  };

  const titles = {
    email: { title: t('auth.forgotPasswordTitle'), subtitle: t('auth.forgotPasswordSubtitle') },
    otp: { title: t('auth.resetOtpTitle'), subtitle: t('auth.resetOtpSubtitle') },
    password: { title: t('auth.newPasswordTitle'), subtitle: t('auth.newPasswordSubtitle') },
  };

  return (
    <div className="flex h-full w-full items-center justify-center px-6 py-12 lg:px-10">
      <div className="w-full max-w-[480px] rounded-[28px] border border-white/70 bg-white/90 p-8 shadow-[0_30px_80px_rgba(15,23,42,0.10)] backdrop-blur-xl md:p-10">
        <div className="mb-8 space-y-2">
          <h2 className="text-[2rem] font-bold tracking-tight text-slate-900 md:text-[2.25rem]">
            {titles[step].title}
          </h2>
          <p className="max-w-md text-[15px] leading-7 text-slate-500">
            {titles[step].subtitle}
          </p>
        </div>

        {step === 'email' && (
          <form className="space-y-5" onSubmit={handleSendOtp}>
            <div>
              <label className={labelClass}>{t('auth.email')}</label>
              <div className="relative">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputClass}
                  placeholder="name@example.com"
                />
                <Mail className={iconClass} size={18} />
              </div>
            </div>

            <button type="submit" disabled={sending} className={submitClass}>
              {sending ? (
                <>
                  <Loader2 className="animate-spin" size={20} />
                  {t('auth.sending')}
                </>
              ) : (
                t('auth.sendOtp')
              )}
            </button>
          </form>
        )}

        {step === 'otp' && (
          <form className="space-y-5" onSubmit={handleVerifyOtp}>
            <div>
              <label className={labelClass}>{t('auth.otpCode')}</label>
              <div className="relative">
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  required
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  className={`${inputClass} tracking-[0.4em] text-center font-bold`}
                  placeholder="------"
                />
                <ShieldCheck className={iconClass} size={18} />
              </div>
              <p className="mt-2 text-sm text-slate-500">
                {t('auth.otpSentTo')} <span className="font-semibold text-slate-700">{email}</span>, {t('auth.resetOtpValidity')}
              </p>
            </div>

            <button type="submit" disabled={verifying || otp.length !== 6} className={submitClass}>
              {verifying ? (
                <>
                  <Loader2 className="animate-spin" size={20} />
                  {t('auth.verifying')}
                </>
              ) : (
                t('auth.continue')
              )}
            </button>

            <div className="text-center pt-1">
              <button
                type="button"
                onClick={handleResend}
                disabled={cooldown > 0 || sending}
                className="text-sm font-semibold text-blue-600 transition-colors hover:text-blue-500 hover:underline disabled:cursor-not-allowed disabled:text-slate-400 disabled:no-underline"
              >
                {sending ? t('auth.resending') : cooldown > 0 ? t('auth.resendIn', { seconds: cooldown }) : t('auth.resendOtp')}
              </button>
            </div>
          </form>
        )}

        {step === 'password' && (
          <form className="space-y-5" onSubmit={handleResetPassword}>
            <div>
              <label className={labelClass}>{t('auth.newPassword')}</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputClass}
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

            <div>
              <label className={labelClass}>{t('auth.confirmNewPassword')}</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={inputClass}
                  placeholder="••••••••"
                />
                <Lock className={iconClass} size={18} />
              </div>
            </div>

            <button type="submit" disabled={resetting} className={submitClass}>
              {resetting ? (
                <>
                  <Loader2 className="animate-spin" size={20} />
                  {t('auth.resetting')}
                </>
              ) : (
                t('auth.resetPassword')
              )}
            </button>
          </form>
        )}

        <div className="text-center pt-5">
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 transition-colors hover:text-blue-600"
          >
            <ArrowLeft size={16} /> {t('auth.backToLogin')}
          </button>
        </div>
      </div>
    </div>
  );
}
