import { useState } from 'react';
import { CheckCircle2, ChevronLeft, ChevronRight, ExternalLink, History, X, XCircle } from 'lucide-react';
import { useGetScanRunsQuery } from '../../../services/hotelConfig';
import { formatDateOnly } from '../../../utils/formatDate';

const PAGE_LIMIT = 10;

function formatVnDateTime(isoDateTime) {
    return new Date(isoDateTime).toLocaleString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function StatusBadge({ status }) {
    if (status === 'SUCCESS') {
        return (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#BBF7D0] bg-[#F0FDF4] px-2.5 py-1 text-xs font-semibold text-[#15803D]">
                <CheckCircle2 size={12} /> Thành công
            </span>
        );
    }
    return (
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#FECACA] bg-[#FEF2F2] px-2.5 py-1 text-xs font-semibold text-[#B91C1C]">
            <XCircle size={12} /> Lỗi
        </span>
    );
}

function TriggerBadge({ triggeredBy }) {
    return (
        <span className="inline-flex shrink-0 items-center rounded-full border border-[#E7E9F1] bg-[#F7F7FB] px-2.5 py-1 text-xs font-semibold text-[#6B7280]">
            {triggeredBy === 'CRON' ? 'Tự động' : 'Admin thủ công'}
        </span>
    );
}

// Modal xem chi tiết 1 lượt quét — hiển thị "Nguồn trích dẫn" (các URL/tiêu đề Gemini đã
// dùng để tổng hợp câu trả lời) chứ KHÔNG phải lịch sử duyệt web, xem chú thích ở
// generateWithSearch() (backend/gemini.provider.ts) để biết vì sao cần phân biệt thuật ngữ
// này rõ ràng với admin.
function ScanRunDetailModal({ run, onClose }) {
    if (!run) return null;
    return (
        <div className="fixed inset-0 z-[110] flex items-end justify-center bg-black/40 sm:items-center sm:p-4">
            <div className="flex h-full w-full flex-col overflow-hidden bg-white sm:h-auto sm:max-h-[85vh] sm:w-full sm:max-w-lg sm:rounded-[20px] sm:shadow-2xl">
                <div className="flex shrink-0 items-center justify-between border-b border-[#E7E9F1] px-5 py-4">
                    <h2 className="flex items-center gap-2 text-base font-bold text-[#1C1B29]">
                        <History size={18} className="text-[#4F46E5]" /> Chi tiết lượt quét
                    </h2>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-full p-1.5 text-[#9AA0B4] transition-colors hover:bg-[#F7F7FB] hover:text-[#1C1B29]"
                        aria-label="Đóng"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
                    <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge status={run.status} />
                        <TriggerBadge triggeredBy={run.triggeredBy} />
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                            <p className="text-[#9AA0B4]">Thời điểm quét</p>
                            <p className="font-medium text-[#1C1B29]">{formatVnDateTime(run.createdAt)}</p>
                        </div>
                        <div>
                            <p className="text-[#9AA0B4]">Khoảng ngày quét</p>
                            <p className="font-medium text-[#1C1B29]">
                                {formatDateOnly(run.fromDate)} – {formatDateOnly(run.toDate)}
                            </p>
                        </div>
                        <div>
                            <p className="text-[#9AA0B4]">Sự kiện mới tạo</p>
                            <p className="font-medium text-[#1C1B29]">{run.createdEventsCount}</p>
                        </div>
                        <div>
                            <p className="text-[#9AA0B4]">Trùng lặp, đã bỏ qua</p>
                            <p className="font-medium text-[#1C1B29]">{run.skippedDuplicateCount}</p>
                        </div>
                    </div>

                    {run.status === 'FAILED' && (
                        <div className="rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-3 py-2.5 text-sm text-[#B91C1C]">
                            {run.errorMessage}
                        </div>
                    )}

                    <div>
                        <p className="mb-2 text-sm font-semibold text-[#1C1B29]">Nguồn trích dẫn</p>
                        {run.citations?.length > 0 ? (
                            <ul className="space-y-2">
                                {run.citations.map((c, idx) => (
                                    <li key={`${c.url}-${idx}`}>
                                        <a
                                            href={c.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-start gap-2 rounded-lg border border-[#E7E9F1] px-3 py-2 text-sm text-[#4F46E5] transition-colors hover:bg-[#F5F3FF]"
                                        >
                                            <ExternalLink size={14} className="mt-0.5 shrink-0" />
                                            <span className="min-w-0 break-words">{c.title}</span>
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-sm text-[#9AA0B4]">Không có nguồn trích dẫn nào.</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

// Tab "Lịch sử quét" — danh sách EventScanRun, mới nhất lên trước (backend sort sẵn theo
// createdAt DESC). Bấm vào 1 dòng mở chi tiết ngay bằng dữ liệu đã có trong danh sách
// (EventScanRun trả về đủ cả citations), không cần gọi lại GET /scan-runs/:id.
export default function LocalEventScanHistorySection() {
    const [page, setPage] = useState(1);
    const [selectedRun, setSelectedRun] = useState(null);
    const { data, isLoading } = useGetScanRunsQuery({ page, limit: PAGE_LIMIT });

    const items = data?.items ?? [];
    const total = data?.total ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_LIMIT));

    if (isLoading) {
        return (
            <div className="space-y-3">
                {[0, 1, 2].map((i) => (
                    <div key={i} className="h-20 animate-pulse rounded-2xl bg-[#F7F7FB]" />
                ))}
            </div>
        );
    }

    if (items.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-[#E7E9F1] bg-white px-6 py-16 text-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#F7F7FB]">
                    <History size={22} className="text-[#9AA0B4]" />
                </div>
                <p className="text-sm font-bold text-[#1C1B29]">Chưa có lượt quét nào</p>
                <p className="mt-1 text-sm text-[#6B7280]">
                    Dùng nút "Quét sự kiện gần đây" để AI tự tìm sự kiện quanh khách sạn.
                </p>
            </div>
        );
    }

    return (
        <>
            <div className="space-y-3">
                {items.map((run) => (
                    <button
                        key={run.scanRunId}
                        type="button"
                        onClick={() => setSelectedRun(run)}
                        className="flex w-full flex-col gap-2 rounded-2xl border border-[#E7E9F1] bg-white p-4 text-left transition-colors hover:bg-[#F7F7FB] sm:flex-row sm:items-center sm:justify-between"
                    >
                        <div className="min-w-0 flex-1">
                            <div className="mb-1.5 flex flex-wrap items-center gap-2">
                                <span className="font-bold text-[#1C1B29]">
                                    {formatVnDateTime(run.createdAt)}
                                </span>
                                <StatusBadge status={run.status} />
                                <TriggerBadge triggeredBy={run.triggeredBy} />
                            </div>
                            <p className="text-sm text-[#6B7280]">
                                Khoảng quét: {formatDateOnly(run.fromDate)} – {formatDateOnly(run.toDate)}
                            </p>
                        </div>
                        <div className="shrink-0 text-sm font-semibold text-[#4F46E5]">
                            {run.status === 'SUCCESS'
                                ? `${run.createdEventsCount} sự kiện mới`
                                : 'Xem chi tiết lỗi'}
                        </div>
                    </button>
                ))}
            </div>

            {totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between text-sm text-[#6B7280]">
                    <span>Tổng {total} lượt quét</span>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            disabled={page <= 1}
                            className="rounded-lg border border-[#E7E9F1] p-1.5 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            <ChevronLeft size={16} />
                        </button>
                        <span>
                            Trang {page}/{totalPages}
                        </span>
                        <button
                            type="button"
                            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                            disabled={page >= totalPages}
                            className="rounded-lg border border-[#E7E9F1] p-1.5 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            <ChevronRight size={16} />
                        </button>
                    </div>
                </div>
            )}

            <ScanRunDetailModal run={selectedRun} onClose={() => setSelectedRun(null)} />
        </>
    );
}
