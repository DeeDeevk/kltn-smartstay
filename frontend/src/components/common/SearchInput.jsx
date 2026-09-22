import { Search, X } from 'lucide-react';
import { inputClass } from './formStyles';

// Ô tìm kiếm có icon kính lúp căn giữa theo đúng ô nhập (khung relative chỉ bọc input) và
// nút xoá nhanh khi đã có chữ.
export default function SearchInput({ value, onChange, placeholder, className = '' }) {
  return (
    <div className={`relative ${className}`}>
      <Search
        size={16}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
      />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`${inputClass} pl-9 ${value ? 'pr-9' : ''}`}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Xoá nội dung tìm kiếm"
          className="anim-fade-in absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}
