const DATE_LOCALE_BY_LANGUAGE = {
  vi: 'vi-VN',
  en: 'en-US',
};

export default function formatDate(value, language = 'vi') {
  const locale = DATE_LOCALE_BY_LANGUAGE[language] ?? DATE_LOCALE_BY_LANGUAGE.vi;
  return new Date(value).toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' });
}
