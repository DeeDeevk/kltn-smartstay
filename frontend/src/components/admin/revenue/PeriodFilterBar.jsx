import { ChevronLeft, ChevronRight } from 'lucide-react';
import { PERIODS } from './periodUtils';

// Thanh lọc kỳ báo cáo dùng chung: chọn Ngày/Tuần/Tháng/Năm + lùi/tiến từng kỳ.
export default function PeriodFilterBar({
  period,
  onPeriodChange,
  offset,
  onOffsetChange,
  label,
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
      <div className="flex items-center gap-1 rounded-lg bg-gray-100 p-1">
        {PERIODS.map((p) => (
          <button
            key={p.value}
            type="button"
            onClick={() => {
              onPeriodChange(p.value);
              onOffsetChange(0);
            }}
            className={`rounded-md px-3 py-1.5 text-sm font-semibold transition-colors ${
              period === p.value
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onOffsetChange(offset - 1)}
          className="rounded-lg border border-gray-200 p-1.5 hover:bg-gray-50"
          aria-label="Kỳ trước"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="min-w-[170px] text-center text-sm font-semibold text-gray-700">
          {label}
        </span>
        <button
          type="button"
          onClick={() => onOffsetChange(offset + 1)}
          disabled={offset >= 0}
          className="rounded-lg border border-gray-200 p-1.5 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Kỳ sau"
        >
          <ChevronRight size={16} />
        </button>
        <button
          type="button"
          onClick={() => onOffsetChange(0)}
          disabled={offset === 0}
          className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-200 disabled:opacity-40"
        >
          Hiện tại
        </button>
      </div>
    </div>
  );
}
