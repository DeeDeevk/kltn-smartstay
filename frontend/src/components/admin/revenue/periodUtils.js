// Bộ lọc kỳ báo cáo doanh thu: ngày / tuần / tháng / năm.
// Mỗi kỳ quy về 1 khoảng [from, to] + độ chi tiết trục thời gian (groupBy) gửi lên backend.

export const PERIODS = [
  { value: 'day', label: 'Ngày' },
  { value: 'week', label: 'Tuần' },
  { value: 'month', label: 'Tháng' },
  { value: 'year', label: 'Năm' },
];

export function toDateKey(date) {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDays(date, amount) {
  const d = new Date(date);
  d.setDate(d.getDate() + amount);
  return d;
}

function mondayOf(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0 = Chủ nhật
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  d.setHours(0, 0, 0, 0);
  return d;
}

// offset: 0 = kỳ hiện tại, -1 = kỳ trước, +1 = kỳ sau.
// Trả về { from, to, groupBy, label } — groupBy quyết định mỗi cột trên biểu đồ là gì.
export function resolvePeriod(period, offset = 0, today = new Date()) {
  const base = new Date(today);
  base.setHours(0, 0, 0, 0);

  if (period === 'day') {
    // 1 ngày -> vẫn chia cột theo giờ không khả thi (backend gom theo ngày),
    // nên hiển thị trọn ngày đó như 1 cột duy nhất.
    const d = addDays(base, offset);
    const key = toDateKey(d);
    return {
      from: key,
      to: key,
      groupBy: 'day',
      label: d.toLocaleDateString('vi-VN'),
    };
  }

  if (period === 'week') {
    const start = addDays(mondayOf(base), offset * 7);
    const end = addDays(start, 6);
    return {
      from: toDateKey(start),
      to: toDateKey(end),
      groupBy: 'day', // mỗi cột = 1 ngày trong tuần
      label: `${start.toLocaleDateString('vi-VN')} - ${end.toLocaleDateString('vi-VN')}`,
    };
  }

  if (period === 'month') {
    const start = new Date(base.getFullYear(), base.getMonth() + offset, 1);
    const end = new Date(base.getFullYear(), base.getMonth() + offset + 1, 0);
    return {
      from: toDateKey(start),
      to: toDateKey(end),
      groupBy: 'day', // mỗi cột = 1 ngày trong tháng
      label: `Tháng ${start.getMonth() + 1}/${start.getFullYear()}`,
    };
  }

  // year
  const year = base.getFullYear() + offset;
  return {
    from: `${year}-01-01`,
    to: `${year}-12-31`,
    groupBy: 'month', // mỗi cột = 1 tháng trong năm
    label: `Năm ${year}`,
  };
}

export function formatCurrencyShort(value) {
  const n = Number(value) || 0;
  if (Math.abs(n) >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)} tỷ`;
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} tr`;
  if (Math.abs(n) >= 1_000) return `${Math.round(n / 1_000)}k`;
  return String(n);
}
