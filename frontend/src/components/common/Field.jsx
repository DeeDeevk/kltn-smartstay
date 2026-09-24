// Nhãn nhỏ phía trên + ô nhập. Mọi ô trên cùng một hàng lọc nên bọc bằng Field để cùng
// cấu trúc "nhãn + ô", tránh lệch hàng khi icon đặt tuyệt đối trong một ô không có nhãn.
export default function Field({ label, children, className = '' }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-gray-400">
        {label}
      </span>
      {children}
    </label>
  );
}
