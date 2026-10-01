import { useState } from 'react';
import { Loader2, Search, X } from 'lucide-react';
import { toast } from 'react-toastify';
import { useTriggerAutoScanMutation } from '../../../services/hotelConfig';

// Khớp MIN_RANGE_DAYS/MAX_RANGE_DAYS ở LocalEventAutoScanService (backend) — chỉ để chặn
// sớm ở form, backend vẫn là nơi kiểm tra thật sự.
const MIN_RANGE_DAYS = 1;
const MAX_RANGE_DAYS = 60;

function toDateStr(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function addDays(date, days) {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
}

function endOfMonth(date) {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

// Tính số ngày giữa 2 chuỗi "YYYY-MM-DD" bằng Date.UTC — tránh lệch ngày do giờ mùa hè/múi
// giờ như khi dùng phép trừ Date thường, cùng nguyên tắc với assertValidRange() ở backend.
function diffDays(fromStr, toStr) {
    const [fy, fm, fd] = fromStr.split('-').map(Number);
    const [ty, tm, td] = toStr.split('-').map(Number);
    const fromUtc = Date.UTC(fy, fm - 1, fd);
    const toUtc = Date.UTC(ty, tm - 1, td);
    return Math.round((toUtc - fromUtc) / 86400000);
}

const QUICK_OPTIONS = [
    { value: '7d', label: '7 ngày tới' },
    { value: '14d', label: '2 tuần tới' },
    { value: 'month', label: 'Tháng này' },
    { value: 'custom', label: 'Tuỳ chỉnh' },
];

function computeQuickRange(quick) {
    const today = new Date();
    const fromDate = toDateStr(today);
    if (quick === '7d') return { fromDate, toDate: toDateStr(addDays(today, 7)) };
    if (quick === '14d') return { fromDate, toDate: toDateStr(addDays(today, 14)) };
    if (quick === 'month') return { fromDate, toDate: toDateStr(endOfMonth(today)) };
    return null;
}

// Modal "Quét sự kiện gần đây": khác LocalEventExtractModal (admin tự dán link/text/file),
// ở đây Gemini TỰ tìm kiếm trên web thật (search-grounding) trong khoảng ngày admin chọn —
// kết quả vẫn luôn ở trạng thái 'pending', không khác gì về độ an toàn so với luồng trích
// xuất thủ công (xem chú thích đầu local-event-auto-scan.service.ts ở backend).
export default function LocalEventScanModal({ open, onClose, onScanned }) {
    const [quick, setQuick] = useState('7d');
    const [customFrom, setCustomFrom] = useState('');
    const [customTo, setCustomTo] = useState('');
    const [triggerAutoScan, { isLoading }] = useTriggerAutoScanMutation();

    if (!open) return null;

    const range = quick === 'custom' ? { fromDate: customFrom, toDate: customTo } : computeQuickRange(quick);
    const hasRange = Boolean(range?.fromDate && range?.toDate);
    const rangeDays = hasRange ? diffDays(range.fromDate, range.toDate) : 0;
    const isValid = hasRange && rangeDays >= MIN_RANGE_DAYS && rangeDays <= MAX_RANGE_DAYS;
    const rangeError = !hasRange
        ? null
        : rangeDays <= 0
          ? 'Ngày kết thúc phải sau ngày bắt đầu.'
          : rangeDays > MAX_RANGE_DAYS
            ? `Khoảng ngày quét tối đa ${MAX_RANGE_DAYS} ngày.`
            : null;

    const resetAndClose = () => {
        setQuick('7d');
        setCustomFrom('');
        setCustomTo('');
        onClose();
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!isValid || isLoading) return;
        try {
            const run = await triggerAutoScan(range).unwrap();
            if (run.status === 'SUCCESS') {
                toast.success(
                    `Tìm thấy ${run.createdEventsCount} sự kiện mới (${run.skippedDuplicateCount} trùng, đã bỏ qua).`,
                );
            } else {
                toast.error(run.errorMessage || 'Không quét được sự kiện lúc này.');
            }
            onScanned?.(run);
            resetAndClose();
        } catch (err) {
            if (err?.status === 429) {
                toast.error('Bạn thao tác quá nhanh, vui lòng chờ một chút rồi thử lại.');
                return;
            }
            toast.error(err?.data?.message || 'Không thể bắt đầu quét, vui lòng thử lại.');
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 sm:items-center sm:p-4">
            <div className="flex h-full w-full flex-col overflow-hidden bg-white sm:h-auto sm:max-h-[90vh] sm:w-full sm:max-w-md sm:rounded-[20px] sm:shadow-2xl">
                <div className="flex shrink-0 items-center justify-between border-b border-[#E7E9F1] px-5 py-4">
                    <h2 className="flex items-center gap-2 text-base font-bold text-[#1C1B29]">
                        <Search size={18} className="text-[#4F46E5]" /> Quét sự kiện gần đây
                    </h2>
                    <button
                        type="button"
                        onClick={resetAndClose}
                        className="rounded-full p-1.5 text-[#9AA0B4] transition-colors hover:bg-[#F7F7FB] hover:text-[#1C1B29]"
                        aria-label="Đóng"
                    >
                        <X size={18} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
                    <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
                        <p className="text-sm text-[#6B7280]">
                            AI tự tìm kiếm trên web các sự kiện, lễ hội đang diễn ra gần khách sạn trong
                            khoảng ngày bạn chọn. Kết quả vẫn ở trạng thái "Chờ duyệt", bạn xem lại và
                            duyệt từng cái trước khi trợ lý AI dùng được. Quá trình quét mất khoảng
                            10-20 giây.
                        </p>

                        <div>
                            <label className="mb-1.5 block text-sm font-medium text-[#1C1B29]">
                                Khoảng ngày quét
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                                {QUICK_OPTIONS.map((opt) => (
                                    <button
                                        key={opt.value}
                                        type="button"
                                        onClick={() => setQuick(opt.value)}
                                        className={`rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
                                            quick === opt.value
                                                ? 'border-[#4F46E5] bg-[#F5F3FF] text-[#4F46E5]'
                                                : 'border-[#E7E9F1] text-[#6B7280] hover:bg-[#F7F7FB]'
                                        }`}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {quick === 'custom' && (
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="mb-1 block text-sm font-medium text-[#1C1B29]">
                                        Từ ngày
                                    </label>
                                    <input
                                        type="date"
                                        value={customFrom}
                                        onChange={(e) => setCustomFrom(e.target.value)}
                                        className="w-full rounded-lg border border-[#E7E9F1] px-3 py-2 text-sm text-[#1C1B29] focus:outline-none focus:ring-2 focus:ring-[#4F46E5] focus:border-transparent"
                                    />
                                </div>
                                <div>
                                    <label className="mb-1 block text-sm font-medium text-[#1C1B29]">
                                        Đến ngày
                                    </label>
                                    <input
                                        type="date"
                                        value={customTo}
                                        onChange={(e) => setCustomTo(e.target.value)}
                                        className="w-full rounded-lg border border-[#E7E9F1] px-3 py-2 text-sm text-[#1C1B29] focus:outline-none focus:ring-2 focus:ring-[#4F46E5] focus:border-transparent"
                                    />
                                </div>
                            </div>
                        )}

                        {hasRange && rangeError && (
                            <p className="text-sm font-medium text-red-600">{rangeError}</p>
                        )}
                    </div>

                    <div className="flex shrink-0 gap-2 border-t border-[#E7E9F1] px-5 py-4">
                        <button
                            type="button"
                            onClick={resetAndClose}
                            className="rounded-xl border border-[#E7E9F1] px-4 py-2.5 text-sm font-semibold text-[#6B7280] transition-colors hover:bg-gray-50"
                        >
                            Huỷ
                        </button>
                        <button
                            type="submit"
                            disabled={!isValid || isLoading}
                            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#4F46E5] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#4338CA] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {isLoading ? (
                                <Loader2 size={16} className="animate-spin" />
                            ) : (
                                <Search size={16} />
                            )}
                            {isLoading ? 'Đang quét...' : 'Quét ngay'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
