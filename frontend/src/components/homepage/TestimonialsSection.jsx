import { useTranslation } from 'react-i18next';
import { Star, Quote } from 'lucide-react';

const AVATAR_STYLES = [
  'bg-blue-50 text-blue-600',
  'bg-amber-50 text-amber-600',
  'bg-rose-50 text-rose-600',
];

const TESTIMONIALS = [
  { key: 'guest1', initials: 'MQ' },
  { key: 'guest2', initials: 'TH' },
  { key: 'guest3', initials: 'DL' },
];

export default function TestimonialsSection() {
  const { t } = useTranslation();

  return (
    <section className="py-20 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <span className="inline-block text-xs font-bold uppercase tracking-widest text-blue-600 mb-3">
            {t('home.testimonials.eyebrow')}
          </span>
          <h2 className="font-display text-3xl font-semibold text-gray-900 mb-3">{t('home.testimonials.title')}</h2>
          <p className="text-gray-500">{t('home.testimonials.subtitle')}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {TESTIMONIALS.map(({ key, initials }, index) => (
            <div
              key={key}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm p-7 flex flex-col"
            >
              <Quote size={28} className="text-blue-100 mb-3" fill="currentColor" />

              <div className="flex items-center gap-1 mb-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} size={15} className="text-amber-400" fill="currentColor" />
                ))}
              </div>

              <p className="text-gray-600 text-sm leading-relaxed italic flex-1">
                "{t(`home.testimonials.${key}.quote`)}"
              </p>

              <div className="flex items-center gap-3 mt-6 pt-6 border-t border-gray-100">
                <div
                  className={`w-11 h-11 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${AVATAR_STYLES[index]}`}
                >
                  {initials}
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-gray-900 text-sm truncate">{t(`home.testimonials.${key}.name`)}</p>
                  <p className="text-gray-400 text-xs">{t(`home.testimonials.${key}.trip`)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
