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

// ---------------------------------------------------------------------------
// Khung giờ ca — phải khớp với backend (shift-assignment.service.ts). Phần dưới
// chỉ dùng để gợi ý trên giao diện (dựa vào giờ máy người dùng); backend vẫn là
// nơi kiểm tra chính thức khi bấm vô ca.
// ---------------------------------------------------------------------------

export const CHECK_IN_EARLY_GRACE_MINUTES = 30;

function normalizeTime(time) {
  return time && time.length === 5 ? `${time}:00` : time;
}

function formatHm(date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

// Ca kết thúc <= giờ bắt đầu (vd. Ca đêm 22:00-06:00) thì kết thúc vào ngày hôm sau.
export function buildShiftWindow(workDate, startTime, endTime) {
  const start = new Date(`${workDate}T${normalizeTime(startTime)}`);
  const end = new Date(`${workDate}T${normalizeTime(endTime)}`);
  if (end <= start) end.setDate(end.getDate() + 1);
  return { start, end };
}

// { allowed, reason } — reason dùng làm tooltip/chú thích khi chưa cho vô ca.
export function getCheckInAvailability(assignment, now = new Date()) {
  if (!assignment?.shiftType?.startTime || !assignment?.shiftType?.endTime) {
    return { allowed: false, reason: '' };
  }
  const { start, end } = buildShiftWindow(
    assignment.workDate,
    assignment.shiftType.startTime,
    assignment.shiftType.endTime,
  );
  const earliest = new Date(start.getTime() - CHECK_IN_EARLY_GRACE_MINUTES * 60_000);

  if (now < earliest) {
    return {
      allowed: false,
      reason: `Chưa đến giờ vô ca — ca bắt đầu lúc ${formatHm(start)}, được vô ca từ ${formatHm(earliest)}`,
    };
  }
  if (now > end) {
    return { allowed: false, reason: `Ca đã kết thúc lúc ${formatHm(end)}` };
  }
  return { allowed: true, reason: '' };
}
