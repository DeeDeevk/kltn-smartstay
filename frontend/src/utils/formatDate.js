const DATE_LOCALE_BY_LANGUAGE = {
  vi: 'vi-VN',
  en: 'en-US',
};

export default function formatDate(value, language = 'vi') {
  const locale = DATE_LOCALE_BY_LANGUAGE[language] ?? DATE_LOCALE_BY_LANGUAGE.vi;
  return new Date(value).toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// Dành riêng cho chuỗi "YYYY-MM-DD" THUẦN (cột kiểu date, không có giờ/múi giờ) — VD
// LocalEvent.specificDate, EventScanRun.fromDate/toDate. Tách chuỗi trực tiếp thay vì
// new Date(value).toLocaleDateString() (hàm formatDate() ở trên) để tránh bị lệch ngày do
// trình duyệt hiểu "YYYY-MM-DD" là nửa đêm UTC rồi tự quy đổi sang múi giờ local lúc hiển
// thị — trước đây bị chép lặp lại y hệt ở nhiều nơi (LocalEventsSettingsPage.jsx,
// LocalEventScanHistorySection.jsx), nay gộp về 1 hàm dùng chung.
export function formatDateOnly(isoDate) {
  const [year, month, day] = isoDate.split('-');
  return `${day}/${month}/${year}`;
}
