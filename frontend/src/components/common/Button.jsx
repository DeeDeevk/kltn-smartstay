import { Loader2 } from 'lucide-react';

const VARIANTS = {
  primary: 'bg-blue-600 text-white shadow-sm hover:bg-blue-700 active:bg-blue-800',
  secondary: 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:text-gray-800',
  ghost: 'text-gray-600 hover:bg-gray-100',
  danger: 'bg-red-600 text-white shadow-sm hover:bg-red-700 active:bg-red-800',
};

const SIZES = {
  md: 'h-10 px-4 text-sm',
  sm: 'h-8 px-3 text-xs',
};

// Nút dùng chung: có hiệu ứng nhấn xuống (.press), đổi màu mượt, và trạng thái loading
// tự khoá nút + hiện spinner. `icon` là component icon (vd. Search) hiện bên trái chữ.
export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon: Icon,
  type = 'button',
  className = '',
  disabled,
  children,
  ...props
}) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={`press inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-60 ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...props}
    >
      {loading ? <Loader2 size={15} className="animate-spin" /> : Icon && <Icon size={15} />}
      {children}
    </button>
  );
}
