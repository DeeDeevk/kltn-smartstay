import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Clock, Star, ShieldCheck } from 'lucide-react';
import vikaLogo from '../../../assets/icon/icon.png';

const trustPoints = [
  { icon: Clock, labelKey: 'auth.hero.support247' },
  { icon: Star, labelKey: 'auth.hero.fiveStarExperience' },
  { icon: ShieldCheck, labelKey: 'auth.hero.secureBooking' },
];

export default function AuthHero() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const heroSlides = [
    'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?q=80&w=2070&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?q=80&w=2070&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1571896349842-33c89424de2d?q=80&w=2070&auto=format&fit=crop',
  ];

  const [activeSlide, setActiveSlide] = useState(0);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setActiveSlide((current) => (current + 1) % heroSlides.length);
    }, 6500);

    return () => window.clearInterval(intervalId);
  }, [heroSlides.length]);

  return (
    <div className="hidden lg:flex lg:col-span-1 relative overflow-hidden bg-slate-950 text-white">
      <img
        key={heroSlides[activeSlide]}
        src={heroSlides[activeSlide]}
        alt="Hotel lobby"
        className="absolute inset-0 h-full w-full object-cover auth-hero-image"
      />

      <div className="absolute inset-0 auth-hero-overlay" />
      <div className="auth-hero-orb auth-hero-orb--one" />
      <div className="auth-hero-orb auth-hero-orb--two" />

      <div className="relative z-10 flex h-full w-full flex-col justify-between p-12">
        <button onClick={() => navigate('/')} className="flex items-center gap-4 text-left group">
          <div className="flex h-14 w-14 items-center justify-center rounded-[1.1rem] bg-white shadow-2xl ring-1 ring-white/20 p-1.5 transition-transform group-hover:scale-105">
            <img src={vikaLogo} alt="Vika Hotel" className="h-full w-full object-contain" />
          </div>
          <div>
            <span className="block text-xs uppercase tracking-[0.45em] text-white/65">{t('auth.hero.welcomeTo')}</span>
            <span className="block text-2xl font-bold tracking-tight text-white drop-shadow-[0_8px_20px_rgba(0,0,0,0.28)]">VIKA HOTEL</span>
          </div>
        </button>

        <div className="max-w-lg space-y-5">
          <span className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white/85 backdrop-blur-md shadow-[0_12px_30px_rgba(0,0,0,0.16)]">
            {t('auth.hero.platform')}
          </span>
          <h1 className="font-display text-5xl font-semibold leading-[1.05] tracking-[-0.02em] drop-shadow-[0_10px_35px_rgba(0,0,0,0.45)]">
            {t('auth.hero.titleLine1')} <br />
            <span className="text-sky-300">{t('auth.hero.titleHighlight')}</span>
          </h1>
          <p className="max-w-md text-lg leading-8 text-white/85 drop-shadow-md">
            {t('auth.hero.subtitle')}
          </p>

          <div className="grid grid-cols-3 gap-4 pt-3">
            {trustPoints.map(({ icon: Icon, labelKey }) => (
              <div
                key={labelKey}
                className="flex flex-col items-start gap-2.5 rounded-2xl border border-white/20 bg-white/10 px-4 py-3.5 backdrop-blur-md shadow-[0_16px_40px_rgba(0,0,0,0.16)]"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-sky-300">
                  <Icon size={16} />
                </span>
                <span className="text-sm font-medium leading-tight text-white/85">{t(labelKey)}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-sm text-white/55">{t('auth.hero.copyright')}</p>
      </div>
    </div>
  );
}
