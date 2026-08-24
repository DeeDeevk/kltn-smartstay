import React, { useEffect, useRef, useState } from 'react';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import { vi, enUS } from 'date-fns/locale';
import { Calendar, Bed, Search, Loader2, Wifi, Waves, Sparkles, PlaneTakeoff, ChevronDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSearchAvailabilityMutation } from '../../services/availability';
import { toast } from 'react-toastify';

const highlights = [
  { icon: Wifi, labelKey: 'home.hero.highlight1' },
  { icon: Waves, labelKey: 'home.hero.highlight2' },
  { icon: Sparkles, labelKey: 'home.hero.highlight3' },
  { icon: PlaneTakeoff, labelKey: 'home.hero.highlight4' },
];

export default function HeroSection() {
  const { t, i18n } = useTranslation();
  const datePickerLocale = i18n.language === 'en' ? enUS : vi;
  const heroSlides = [
    {
      type: 'image',
      src: 'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?q=80&w=2069&auto=format&fit=crop',
      alt: 'Beach resort at sunset',
    },
    {
      type: 'image',
      src: 'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?q=80&w=2069&auto=format&fit=crop',
      alt: 'Luxury hotel pool',
    },
    {
      type: 'image',
      src: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?q=80&w=2069&auto=format&fit=crop',
      alt: 'Ocean view suite',
    },
    {
      type: 'video',
      src: 'https://assets.mixkit.co/videos/34613/34613-720.mp4',
      poster: 'https://assets.mixkit.co/videos/34613/34613-thumb-720-0.jpg',
      alt: 'Video giới thiệu hành lang khách sạn Vika Hotel',
    },
  ];

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  const dayAfterTomorrow = new Date();
  dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);

  const [startDate, setStartDate] = useState(tomorrow);
  const [endDate, setEndDate] = useState(dayAfterTomorrow);
  const [rooms, setRooms] = useState(1);
  const navigate = useNavigate();

  const minEndDate = new Date(startDate);
  minEndDate.setDate(minEndDate.getDate() + 1);

  const [searchAvailability, { isLoading }] = useSearchAvailabilityMutation();
  const [activeSlide, setActiveSlide] = useState(0);
  const videoRef = useRef(null);

  const goToNextSlide = () => {
    setActiveSlide((current) => (current + 1) % heroSlides.length);
  };

  useEffect(() => {
    // Video slides advance on their own via onEnded; only image slides use a timer.
    if (heroSlides[activeSlide].type === 'video') {
      const videoEl = videoRef.current;
      if (videoEl) {
        videoEl.currentTime = 0;
        videoEl.play().catch(() => {});
      }
      return;
    }

    const timeoutId = window.setTimeout(goToNextSlide, 6000);
    return () => window.clearTimeout(timeoutId);
  }, [activeSlide]);

  const handleSearch = async () => {
    try {
      const searchParams = {
        checkIn: startDate.toISOString(),
        checkOut: endDate.toISOString(),
        // rooms: parseInt(rooms)
      };

      const result = await searchAvailability(searchParams).unwrap();

      // Navigate to search results page with the data
      navigate('/searchrooms', { state: { results: result.availableRoomTypes, searchParams } });

    } catch (error) {
      console.error("Search Error:", error);
      toast.error(error?.data?.message || t('home.hero.searchError'));
    }
  };

  return (
    <div className="relative pt-20 overflow-hidden">
      {/* Background Hero */}
      <div className="hero-shell h-[680px] md:h-[760px] relative overflow-hidden">
        {heroSlides.map((slide, index) =>
          slide.type === 'video' ? (
            <video
              key={slide.src}
              ref={videoRef}
              src={slide.src}
              poster={slide.poster}
              muted
              playsInline
              onEnded={goToNextSlide}
              className={`hero-slide ${index === activeSlide ? 'hero-slide--active' : ''}`}
            />
          ) : (
            <img
              key={slide.src}
              src={slide.src}
              alt={slide.alt}
              className={`hero-slide ${index === activeSlide ? 'hero-slide--active' : ''}`}
            />
          )
        )}

        <div className="hero-overlay" />
        <div className="hero-orb hero-orb--one" />
        <div className="hero-orb hero-orb--two" />

        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center text-center px-4">
          <span className="text-white/90 text-xs md:text-sm uppercase tracking-[0.35em] mb-4 hero-kicker">
            {t('home.hero.kicker')}
          </span>
          <h1 className="font-display text-4xl md:text-6xl font-semibold text-white mb-6 leading-tight max-w-4xl drop-shadow-lg hero-title">
            {t('home.hero.title')}
          </h1>
          <p className="text-gray-100/90 text-base md:text-lg max-w-2xl mb-8 hidden md:block hero-subtitle">
            {t('home.hero.subtitle')}
          </p>

          <div className="hero-badge">
            <a
              href="#phong-nghi"
              className="inline-flex items-center gap-2 bg-white text-gray-900 hover:bg-gray-100 px-7 py-3 rounded-full font-bold text-sm md:text-base shadow-lg transition-transform hover:-translate-y-0.5"
            >
              {t('home.hero.exploreRooms')}
            </a>
          </div>
        </div>

        <ChevronDown
          size={28}
          className="hero-scroll-cue absolute bottom-6 left-1/2 -translate-x-1/2 z-10 text-white/70 hidden md:block"
        />
      </div>

      {/* Floating Search Bar */}
      <div className="max-w-6xl mx-auto px-4 relative -mt-16 z-20">
        <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl p-6 md:p-8 grid grid-cols-1 md:grid-cols-4 gap-4 items-end border border-white/70 hero-search-card">

          {/* Ngày nhận */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide flex items-center gap-1">
              <Calendar size={14} /> {t('home.hero.checkIn')}
            </label>
            <DatePicker
              selected={startDate}
              onChange={date => {
                setStartDate(date);
                if (endDate <= date) {
                  const nextDay = new Date(date);
                  nextDay.setDate(nextDay.getDate() + 1);
                  setEndDate(nextDay);
                }
              }}
              className="w-full border-b-2 border-gray-200 pb-2 text-gray-900 font-semibold focus:outline-none focus:border-blue-500 bg-transparent cursor-pointer"
              dateFormat="dd/MM/yyyy"
              minDate={tomorrow}
              locale={datePickerLocale}
            />
          </div>

          {/* Ngày trả */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide flex items-center gap-1">
              <Calendar size={14} /> {t('home.hero.checkOut')}
            </label>
            <DatePicker
              selected={endDate}
              onChange={date => setEndDate(date)}
              className="w-full border-b-2 border-gray-200 pb-2 text-gray-900 font-semibold focus:outline-none focus:border-blue-500 bg-transparent cursor-pointer"
              dateFormat="dd/MM/yyyy"
              minDate={minEndDate}
              locale={datePickerLocale}
            />
          </div>

          {/* Số phòng */}
          <div className="space-y-2">
            {/* <label className="text-xs font-bold text-gray-500 uppercase tracking-wide flex items-center gap-1">
              <Bed size={14} /> Số lượng phòng
            </label>
            <select
              value={rooms}
              onChange={(e) => setRooms(e.target.value)}
              className="w-full border-b-2 border-gray-200 pb-2 text-gray-900 font-semibold focus:outline-none focus:border-blue-500 bg-transparent cursor-pointer appearance-none"
            >
              {[1, 2, 3, 4, 5].map(num => (
                <option key={num} value={num}>{num} Phòng</option>
              ))}
            </select> */}
          </div>

          {/* Button Search */}
          <button
            onClick={handleSearch}
            disabled={isLoading}
            className="bg-blue-600 hover:bg-blue-700 text-white h-12 rounded-xl font-bold text-lg shadow-lg shadow-blue-200 transition-all flex items-center justify-center grid-[3-4] gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <Loader2 className="animate-spin" size={20} />
            ) : (
              <Search size={20} />
            )}
            {isLoading ? t('home.hero.searching') : t('home.hero.search')}
          </button>

        </div>

        <div className="mt-6 bg-white/90 backdrop-blur-md rounded-2xl shadow-lg border border-white/60 px-6 py-4 flex flex-wrap justify-center md:justify-between gap-x-8 gap-y-3">
          {highlights.map(({ icon: Icon, labelKey }) => (
            <div key={labelKey} className="flex items-center gap-2 text-gray-700">
              <span className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <Icon size={16} />
              </span>
              <span className="text-sm font-medium whitespace-nowrap">{t(labelKey)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
