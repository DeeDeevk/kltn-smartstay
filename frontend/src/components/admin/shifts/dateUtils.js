// Helpers thao tác ngày cho lưới lịch phân ca — dùng Date thuần (không thêm
// thư viện mới) để nhất quán với phần còn lại của admin panel.

export function getMonday(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0 = Chủ nhật .. 6 = Thứ 7
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function addDays(date, amount) {
  const d = new Date(date);
  d.setDate(d.getDate() + amount);
  return d;
}

// 'YYYY-MM-DD' theo giờ địa phương — dùng làm key và gửi lên API (khớp cột
// 'date' của ShiftAssignment.workDate).
export function toDateKey(date) {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export const WEEKDAY_LABELS = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'];

export function formatShortDate(date) {
  return new Date(date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
}

// Ngày hôm nay dạng 'YYYY-MM-DD' theo giờ địa phương.
export function todayKey() {
  return toDateKey(new Date());
}

// So sánh chuỗi 'YYYY-MM-DD' theo thứ tự từ điển = theo thứ tự thời gian.
// Hôm nay KHÔNG tính là quá khứ (vẫn cho phân/gỡ ca trong ngày).
export function isPastDateKey(key) {
  return key < todayKey();
}
