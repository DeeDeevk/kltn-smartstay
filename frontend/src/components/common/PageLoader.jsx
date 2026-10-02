import { Loader2 } from 'lucide-react';

// Fallback của Suspense khi một trang lazy-load đang tải chunk JS.
export default function PageLoader({ className = 'min-h-[60vh]' }) {
  return (
    <div className={`flex items-center justify-center text-gray-400 ${className}`}>
      <Loader2 className="h-8 w-8 animate-spin" />
    </div>
  );
}
