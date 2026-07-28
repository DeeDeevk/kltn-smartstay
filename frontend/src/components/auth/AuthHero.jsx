import React, { useEffect, useState } from 'react';

export default function AuthHero() {
  const heroSlides = [
    'https://images.unsplash.com/photo-1501117716987-c8e1ecb210c6?q=80&w=2070&auto=format&fit=crop',
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
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-white/12 p-3 shadow-2xl backdrop-blur-md ring-1 ring-white/15">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-white">
              <path d="M3 3v18h18" />
              <path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3" />
            </svg>
          </div>
          <div>
            <span className="block text-sm uppercase tracking-[0.35em] text-white/70">Welcome back</span>
            <span className="text-2xl font-bold tracking-tight">VIKA HOTEL</span>
          </div>
        </div>

        <div className="max-w-lg space-y-6">
          <span className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white/85 backdrop-blur-md">
            Quản lý lưu trú chuyên nghiệp
          </span>
          <h1 className="text-5xl font-bold leading-tight drop-shadow-[0_10px_35px_rgba(0,0,0,0.35)]">
            Trải nghiệm dịch vụ <br />
            <span className="text-sky-300">Đẳng cấp 5 Sao</span>
          </h1>
          <p className="max-w-md text-lg leading-relaxed text-white/80">
            Chào mừng bạn đến với không gian đăng nhập mang cảm giác khách sạn sang trọng, hiện đại và giàu tính chuyên nghiệp.
          </p>

          <div className="grid grid-cols-3 gap-3 pt-2 text-sm text-white/80">
            <div className="rounded-2xl border border-white/10 bg-white/8 px-4 py-3 backdrop-blur-md">
              <div className="text-xl font-bold text-white">24/7</div>
              <div>Hỗ trợ hệ thống</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/8 px-4 py-3 backdrop-blur-md">
              <div className="text-xl font-bold text-white">5★</div>
              <div>Trải nghiệm cao cấp</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/8 px-4 py-3 backdrop-blur-md">
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