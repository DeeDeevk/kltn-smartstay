// Khối xám có dải sáng chạy ngang (.skeleton) — dùng thay spinner để người dùng thấy
// trước "hình dạng" của nội dung sắp hiện, cảm giác tải nhanh và mượt hơn.
export function Skeleton({ className = 'h-4 w-full' }) {
  return <div className={`skeleton rounded-md ${className}`} />;
}

// Các dòng giả trong <tbody> khi bảng đang tải lần đầu. `widths` (class Tailwind) đặt
// độ rộng khác nhau cho từng cột để trông giống dữ liệu thật hơn.
const DEFAULT_WIDTHS = ['w-24', 'w-40', 'w-32', 'w-16', 'w-20', 'w-24', 'w-8'];

export function TableSkeletonRows({ rows = 6, cols = 6, widths = DEFAULT_WIDTHS }) {
  return Array.from({ length: rows }, (_, r) => (
    <tr key={r} className="anim-fade-in" style={{ animationDelay: `${r * 40}ms` }}>
      {Array.from({ length: cols }, (_, c) => (
        <td key={c} className="px-4 py-4">
          <Skeleton className={`h-4 ${widths[c % widths.length]}`} />
        </td>
      ))}
    </tr>
  ));
}
