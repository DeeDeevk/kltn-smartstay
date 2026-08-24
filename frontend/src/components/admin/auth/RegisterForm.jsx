import React, { useEffect, useState } from 'react';
import { Mail, Eye, EyeOff, Loader2, User, Phone, Lock, ShieldCheck } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../../context/AuthContext';
import { toast } from 'react-toastify';

const inputClass = "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 pr-12 text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100";
const labelClass = "mb-1.5 block text-sm font-semibold text-slate-700";
const iconClass = "absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none";

const RESEND_COOLDOWN_SECONDS = 30;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 6;

function validateRegisterForm({ name, phone_number, email, password, confirmPassword }, t) {
  if (!name.trim()) {
    return t('auth.errors.nameRequired');
  }
  if (!phone_number.trim()) {
    return t('auth.errors.phoneRequired');
  }
  if (!EMAIL_REGEX.test(email)) {
    return t('auth.errors.invalidEmail');
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return t('auth.errors.passwordMinLength', { count: MIN_PASSWORD_LENGTH });
  }
  if (password !== confirmPassword) {
    return t('auth.errors.passwordMismatch');
  }
  return null;
}

function getRegisterErrorMessage(err, t) {
  if (err.status === 409) {
    return t('auth.errors.emailInUse');
  }
  if (err.status === 400) {
    return err.message || t('auth.errors.invalidRegisterInfo');
  }
  return err.message || t('auth.errors.registerGenericError');
}

function getOtpErrorMessage(err, t) {
  if (err.status === 400 || err.status === 401) {
    return t('auth.errors.invalidOtp');
  }
  return err.message || t('auth.errors.otpGenericError');
}

function OtpStep({ email, onVerified }) {
  const { t } = useTranslation();
  const { verifyOtp, resendOtp } = useAuth();
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((s) => s - 1), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleVerify = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await verifyOtp({ email, otp });
      onVerified();
    } catch (err) {
      toast.error(getOtpErrorMessage(err, t));
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    try {
      await resendOtp(email);
      toast.success(t('auth.toasts.otpResent'));
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      toast.error(err.message || t('auth.errors.resendOtpError'));
    } finally {
      setResending(false);
    }
  };

  return (
    <form className="space-y-5" onSubmit={handleVerify}>
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
          {t('auth.otpSentTo')} <span className="font-semibold text-slate-700">{email}</span>, {t('auth.otpValidity')}
        </p>
      </div>

      <button
        type="submit"
        disabled={loading || otp.length !== 6}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 font-bold text-white shadow-[0_18px_45px_rgba(37,99,235,0.28)] transition-all hover:brightness-105 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70"
      >
        {loading ? (
          <>
            <Loader2 className="animate-spin" size={20} />
            {t('auth.verifying')}
          </>
        ) : (
          t('auth.verifyAccount')
        )}
      </button>

      <div className="text-center pt-1">
        <button
          type="button"
          onClick={handleResend}
          disabled={cooldown > 0 || resending}
          className="text-sm font-semibold text-blue-600 transition-colors hover:text-blue-500 hover:underline disabled:cursor-not-allowed disabled:text-slate-400 disabled:no-underline"
        >
          {resending ? t('auth.resending') : cooldown > 0 ? t('auth.resendIn', { seconds: cooldown }) : t('auth.resendOtp')}
        </button>
      </div>
    </form>
  );
}

export default function RegisterForm() {
  const navigate = useNavigate();
  const location = useLocation();
  const { register } = useAuth();
  const { t } = useTranslation();
  const [step, setStep] = useState('form'); // 'form' | 'otp'
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    name: '',
    phone_number: '',
  });

  const handleSubmit = async (e) => {
    e.preventDefault();

    const validationError = validateRegisterForm(formData, t);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setLoading(true);
    try {
      await register({
        fullName: formData.name,
        email: formData.email,
        phone: formData.phone_number,
        password: formData.password,
      });
      toast.success(t('auth.toasts.otpSent'));
      setStep('otp');
    } catch (err) {
      console.error('Registration error:', err);
      toast.error(getRegisterErrorMessage(err, t));
    } finally {
      setLoading(false);
    }
  };

  const handleVerified = () => {
    toast.success(t('auth.toasts.registerSuccess'));
    const from = location.state?.from || '/';
    const checkoutState = location.state?.checkoutState;
    navigate(from, { state: checkoutState });
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  return (
    <div className="flex h-full w-full items-center justify-center px-6 py-8 lg:px-10">
      <div className="w-full max-w-[560px] rounded-[28px] border border-white/70 bg-white/90 p-8 shadow-[0_30px_80px_rgba(15,23,42,0.10)] backdrop-blur-xl md:p-10">
        <div className="mb-8 space-y-2">
          <h2 className="text-[2rem] font-bold tracking-tight text-slate-900 md:text-[2.25rem]">
            {step === 'form' ? t('auth.createAccount') : t('auth.verifyEmail')}
          </h2>
          <p className="max-w-md text-[15px] leading-7 text-slate-500">
            {step === 'form' ? t('auth.registerSubtitle') : t('auth.otpSubtitle')}
          </p>
        </div>

        {step === 'otp' ? (
          <OtpStep email={formData.email} onVerified={handleVerified} />
        ) : (
        <form className="space-y-5" onSubmit={handleSubmit}>
          {/* Full Name */}
          <div>
            <label className={labelClass}>{t('auth.fullName')}</label>
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
              <label className={labelClass}>{t('auth.phone')}</label>
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
              <label className={labelClass}>{t('auth.email')}</label>
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

          {/* Password + Confirm Password */}
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className={labelClass}>{t('auth.password')}</label>
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
                  aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <div>
              <label className={labelClass}>{t('auth.confirmPassword')}</label>
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

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 font-bold text-white shadow-[0_18px_45px_rgba(37,99,235,0.28)] transition-all hover:brightness-105 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin" size={20} />
                {t('auth.registering')}
              </>
            ) : (
              t('auth.register')
            )}
          </button>

          {/* Sign In Link */}
          <div className="text-center pt-2">
            <p className="text-sm text-slate-500">
              {t('auth.haveAccount')}{' '}
              <button
                type="button"
                onClick={() => navigate('/login', { state: location.state })}
                className="font-bold text-blue-600 transition-colors hover:text-blue-500 hover:underline"
              >
                {t('auth.loginNow')}
              </button>
            </p>
          </div>
        </form>
        )}
      </div>
    </div>
  );
}
