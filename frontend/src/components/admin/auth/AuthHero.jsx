import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import vikaLogo from '../../../assets/icon/icon.png';

export default function AuthHero() {
  const navigate = useNavigate();
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
          <div className="flex h-14 w-14 items-center justify-center rounded-[1.1rem] bg-white/10 shadow-2xl backdrop-blur-md ring-1 ring-white/15 transition-transform group-hover:scale-105">
            <img src={vikaLogo} alt="Vika Hotel" className="h-9 w-9 object-contain drop-shadow-[0_6px_18px_rgba(0,0,0,0.28)]" />
          </div>
          <div>
            <span className="block text-xs uppercase tracking-[0.45em] text-white/65">Chào mừng đến với</span>
            <span className="block text-2xl font-bold tracking-tight text-white drop-shadow-[0_8px_20px_rgba(0,0,0,0.28)]">VIKA HOTEL</span>
          </div>
        </button>

        <div className="max-w-lg space-y-5">
          <span className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white/85 backdrop-blur-md shadow-[0_12px_30px_rgba(0,0,0,0.16)]">
            Quản lý lưu trú chuyên nghiệp
          </span>
          <h1 className="font-display text-5xl font-semibold leading-[1.05] tracking-[-0.02em] drop-shadow-[0_10px_35px_rgba(0,0,0,0.45)]">
            Trải nghiệm dịch vụ <br />
            <span className="text-sky-300">Đẳng cấp 5 Sao</span>
          </h1>
          <p className="max-w-md text-lg leading-8 text-white/85 drop-shadow-md">
            Chào mừng bạn đến với không gian đăng nhập mang cảm giác khách sạn sang trọng, hiện đại và giàu tính chuyên nghiệp.
          </p>

          <div className="grid grid-cols-3 gap-4 pt-3 text-sm text-white/80">
            <div className="rounded-2xl border border-white/20 bg-white/10 px-4 py-3 backdrop-blur-md shadow-[0_16px_40px_rgba(0,0,0,0.16)]">
              <div className="text-xl font-bold text-white">24/7</div>
              <div>Hỗ trợ hệ thống</div>
            </div>
            <div className="rounded-2xl border border-white/20 bg-white/10 px-4 py-3 backdrop-blur-md shadow-[0_16px_40px_rgba(0,0,0,0.16)]">
              <div className="text-xl font-bold text-white">5★</div>
              <div>Trải nghiệm cao cấp</div>
            </div>
            <div className="rounded-2xl border border-white/20 bg-white/10 px-4 py-3 backdrop-blur-md shadow-[0_16px_40px_rgba(0,0,0,0.16)]">
              <div className="text-xl font-bold text-white">∞</div>
              <div>Đồng bộ dịch vụ</div>
            </div>
          </div>
        </div>

        <p className="text-sm text-white/55">&copy; 2026 Vika Hotel Group. All rights reserved.</p>
      </div>
    </div>
  );
}