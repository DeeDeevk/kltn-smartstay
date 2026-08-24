const CURRENCY_LOCALE_BY_LANGUAGE = {
  vi: 'vi-VN',
  en: 'en-US',
};

// vi-VN Intl formatting renders the currency sign as "₫"; the rest of the UI
// (design, invoices, QR ticket) standardizes on the "đ" abbreviation instead.
export default function formatCurrency(amount, language = 'vi') {
  const locale = CURRENCY_LOCALE_BY_LANGUAGE[language] ?? CURRENCY_LOCALE_BY_LANGUAGE.vi;
  const formatted = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'VND',
  }).format(Number(amount) || 0);

  return language === 'en' ? formatted : formatted.replace('₫', 'đ');
}
