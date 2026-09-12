import React from 'react';
import { useTranslation } from 'react-i18next';

export default function PromoSection() {
  const { t } = useTranslation();
  return (
    <section id="uu-dai" className="py-20 bg-gray-900 text-white relative overflow-hidden scroll-mt-20">
      {/* Background Effect */}
      <div className="absolute top-0 right-0 w-1/2 h-full bg-blue-600/20 blur-3xl rounded-full translate-x-1/2"></div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <span className="bg-yellow-400 text-black text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
              {t('home.promo.badge')}
            </span>
            <h2 className="font-display text-4xl md:text-5xl font-semibold leading-tight">
              {t('home.promo.titleLine1')} <br/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">{t('home.promo.titleLine2')}</span>
            </h2>
            <p className="text-gray-300 text-lg">
              {t('home.promo.description')}
            </p>
            <button className="bg-white text-gray-900 hover:bg-gray-100 px-8 py-4 rounded-full font-bold text-lg shadow-lg transition-transform hover:-translate-y-1">
              {t('home.promo.cta')}
            </button>
          </div>

          <div className="relative">
             <div className="absolute -inset-4 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl blur-lg opacity-50"></div>
             <img
               src="https://images.unsplash.com/photo-1618773928121-c32242e63f39?q=80&w=2070&auto=format&fit=crop"
               alt="Phòng nghỉ sang trọng tại Vika Hotel"
               className="relative rounded-2xl shadow-2xl w-full object-cover transform rotate-2 hover:rotate-0 transition-all duration-500"
             />
          </div>
        </div>
      </div>
    </section>
  );
}