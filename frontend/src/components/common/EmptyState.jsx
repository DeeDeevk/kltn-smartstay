import { SearchX } from 'lucide-react';

// Trạng thái rỗng thống nhất: icon + tiêu đề + gợi ý (+ nút hành động tuỳ chọn).
export default function EmptyState({
  icon: Icon = SearchX,
  title,
  description,
  action,
  className = 'py-16',
}) {
  return (
    <div className={`anim-fade-up flex flex-col items-center gap-2 text-center ${className}`}>
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-50 text-gray-300">
        <Icon size={28} />
      </span>
      <p className="text-sm font-semibold text-gray-600">{title}</p>
      {description && <p className="max-w-sm text-xs text-gray-400">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
