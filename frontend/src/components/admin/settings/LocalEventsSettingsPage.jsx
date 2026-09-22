import { useMemo, useState } from 'react';
import { AlertTriangle, Calendar, Check, Pencil, Plus, Sparkles, Trash2 } from 'lucide-react';
import { toast } from 'react-toastify';
import ConfirmModal from '../../common/ConfirmModal';
import LocalEventFormModal, { WEEKDAY_OPTIONS } from './LocalEventFormModal';
import LocalEventExtractModal from './LocalEventExtractModal';
import {
    useApproveLocalEventMutation,
    useDeleteLocalEventMutation,
    useGetLocalEventsQuery,
} from '../../../services/hotelConfig';

const WEEKDAY_LABEL_BY_VALUE = Object.fromEntries(
    WEEKDAY_OPTIONS.map((day) => [day.value, day.label]),
);

function formatVnDate(isoDate) {
    // specificDate là chuỗi "YYYY-MM-DD" thuần (cột kiểu date, không có giờ/múi giờ) — tách
    // chuỗi trực tiếp thay vì new Date(isoDate) để tránh bị lùi 1 ngày do trình duyệt hiểu
    // "YYYY-MM-DD" là nửa đêm UTC rồi tự quy đổi sang múi giờ local (UTC+7) lúc hiển thị.
    const [year, month, day] = isoDate.split('-');
    return `${day}/${month}/${year}`;
}

// Sự kiện AI trích xuất có thể còn thiếu ngày (nguồn text không đủ rõ ràng) — xem
// LocalEventExtractionService.sanitizeExtractedEvent ở backend: khi đó recurrence vẫn là
// ONCE nhưng specificDate = null, thay vì crash EventTypeBadge (event.specificDate.split
// trên null), phải kiểm tra trước khi hiển thị badge loại sự kiện bình thường.
function isEventDateComplete(event) {
    return event.recurrence === 'WEEKLY'
        ? event.dayOfWeek !== null && event.dayOfWeek !== undefined
        : Boolean(event.specificDate);
}

function EventTypeBadge({ event }) {
    if (!isEventDateComplete(event)) {
        return (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#FDE68A] bg-[#FFFBEB] px-2.5 py-1 text-xs font-semibold text-[#B45309]">
                <AlertTriangle size={12} /> Cần bổ sung ngày
            </span>
        );
    }
    if (event.recurrence === 'WEEKLY') {
        return (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#DDD6FE] bg-[#F5F3FF] px-2.5 py-1 text-xs font-semibold text-[#7C3AED]">
                Lặp lại · Mỗi {WEEKDAY_LABEL_BY_VALUE[event.dayOfWeek]}
            </span>
        );
    }
    return (
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#BFDBFE] bg-[#EFF6FF] px-2.5 py-1 text-xs font-semibold text-[#2563EB]">
            Một lần · {formatVnDate(event.specificDate)}
        </span>
    );
}

// sourceRef là URL gốc hoặc đoạn text admin dán vào — rút gọn để hiện gọn trong 1 dòng,
// đối chiếu nhanh khi duyệt chứ không cần xem đầy đủ tại đây.
function truncateSourceRef(sourceRef, max = 100) {
    if (!sourceRef) return null;
    return sourceRef.length > max ? `${sourceRef.slice(0, max)}…` : sourceRef;
}

const TABS = [
    { value: 'approved', label: 'Đã duyệt' },
    { value: 'pending', label: 'Chờ duyệt' },
];

export default function LocalEventsSettingsPage() {
    const { data: events, isLoading } = useGetLocalEventsQuery();
    const [deleteLocalEvent, { isLoading: deleting }] = useDeleteLocalEventMutation();
    const [approveLocalEvent, { isLoading: approving }] = useApproveLocalEventMutation();

    const [activeTab, setActiveTab] = useState('approved');
    const [formState, setFormState] = useState({ open: false, event: null });
    const [extractOpen, setExtractOpen] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState(null);

    // events ?? [] không đưa vào useMemo deps được: mỗi render mà events vẫn undefined (đang
    // loading) sẽ tạo 1 mảng rỗng mới, khiến deps đổi liên tục — dùng thẳng `events` (tham
    // chiếu ổn định từ RTK Query khi có dữ liệu, và y hệt `undefined` khi chưa có) làm dep.
    const approvedList = useMemo(
        () => (events ?? []).filter((e) => e.status !== 'pending'),
        [events],
    );
    const pendingList = useMemo(
        () => (events ?? []).filter((e) => e.status === 'pending'),
        [events],
    );
    const visibleList = activeTab === 'pending' ? pendingList : approvedList;

    const handleConfirmDelete = async () => {
        if (!deleteTarget) return;
        try {
            await deleteLocalEvent(deleteTarget.eventId).unwrap();
            toast.success(deleteTarget.status === 'pending' ? 'Đã từ chối đề xuất' : 'Đã xoá sự kiện');
            setDeleteTarget(null);
        } catch (err) {
            toast.error(err?.data?.message || 'Không thể xoá sự kiện, vui lòng thử lại.');
        }
    };

    const handleApprove = async (event) => {
        try {
            await approveLocalEvent(event.eventId).unwrap();
            toast.success('Đã duyệt sự kiện');
        } catch (err) {
            toast.error(err?.data?.message || 'Không thể duyệt sự kiện, vui lòng thử lại.');
        }
    };

    return (
        <>
            <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h1 className="mb-1 text-2xl font-bold text-[#1C1B29]">Sự kiện địa phương</h1>
                    <p className="text-sm text-[#6B7280]">
                        Các sự kiện này được trợ lý AI dùng để gợi ý cho khách khi họ hỏi về hoạt động
                        trong khu vực.
                    </p>
                </div>
                <div className="flex shrink-0 gap-2">
                    <button
                        type="button"
                        onClick={() => setExtractOpen(true)}
                        className="inline-flex items-center gap-2 rounded-xl border border-[#DDD6FE] bg-[#F5F3FF] px-4 py-2.5 text-sm font-semibold text-[#7C3AED] transition-colors hover:bg-[#EDE9FE]"
                    >
                        <Sparkles size={16} /> Trích xuất từ nguồn
                    </button>
                    <button
                        type="button"
                        onClick={() => setFormState({ open: true, event: null })}
                        className="inline-flex items-center gap-2 rounded-xl bg-[#4F46E5] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#4338CA]"
                    >
                        <Plus size={16} /> Thêm sự kiện
                    </button>
                </div>
            </div>

            <div className="mb-4 flex gap-1 rounded-lg bg-[#F7F7FB] p-1 sm:w-fit">
                {TABS.map((t) => (
                    <button
                        key={t.value}
                        type="button"
                        onClick={() => setActiveTab(t.value)}
                        className={`inline-flex items-center gap-1.5 rounded-md px-4 py-1.5 text-sm font-semibold transition-colors ${
                            activeTab === t.value
                                ? 'bg-white text-[#4F46E5] shadow-sm'
                                : 'text-[#6B7280] hover:text-[#1C1B29]'
                        }`}
                    >
                        {t.label}
                        {t.value === 'pending' && pendingList.length > 0 && (
                            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-bold text-white">
                                {pendingList.length}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {isLoading ? (
                <div className="space-y-3">
                    {[0, 1, 2].map((i) => (
                        <div key={i} className="h-24 animate-pulse rounded-2xl bg-[#F7F7FB]" />
                    ))}
                </div>
            ) : visibleList.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-[#E7E9F1] bg-white px-6 py-16 text-center">
                    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#F7F7FB]">
                        <Calendar size={22} className="text-[#9AA0B4]" />
                    </div>
                    {activeTab === 'pending' ? (
                        <p className="text-sm font-bold text-[#1C1B29]">
                            Chưa có sự kiện nào chờ duyệt. Dùng nút "Trích xuất từ nguồn" để AI hỗ trợ
                            bạn thêm sự kiện nhanh hơn.
                        </p>
                    ) : (
                        <>
                            <p className="text-sm font-bold text-[#1C1B29]">Chưa có sự kiện nào được thiết lập</p>
                            <button
                                type="button"
                                onClick={() => setFormState({ open: true, event: null })}
                                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#4F46E5] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#4338CA]"
                            >
                                <Plus size={16} /> Thêm sự kiện đầu tiên
                            </button>
                        </>
                    )}
                </div>
            ) : (
                <div className="space-y-3">
                    {visibleList.map((event) =>
                        event.status === 'pending' ? (
                            <div
                                key={event.eventId}
                                className="flex flex-col gap-3 rounded-2xl border border-[#FDE68A] bg-[#FFFBEB]/60 p-4 sm:flex-row sm:items-start sm:justify-between"
                            >
                                <div className="min-w-0 flex-1">
                                    <div className="mb-1.5 flex flex-wrap items-center gap-2">
                                        <h3 className="font-bold text-[#1C1B29]">{event.title}</h3>
                                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#F59E0B] px-2 py-0.5 text-[11px] font-bold text-white">
                                            <Sparkles size={11} /> AI đề xuất
                                        </span>
                                    </div>
                                    <EventTypeBadge event={event} />
                                    {event.description && (
                                        <p className="mt-2 line-clamp-2 text-sm text-[#6B7280]">{event.description}</p>
                                    )}
                                    {event.sourceRef && (
                                        <p className="mt-2 truncate text-xs text-[#9AA0B4]">
                                            Nguồn: {truncateSourceRef(event.sourceRef)}
                                        </p>
                                    )}
                                </div>
                                <div className="flex shrink-0 flex-wrap items-center gap-1.5 self-end sm:self-start">
                                    <button
                                        type="button"
                                        onClick={() => setFormState({ open: true, event })}
                                        className="inline-flex items-center gap-1 rounded-lg border border-[#E7E9F1] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#6B7280] transition-colors hover:bg-[#F7F7FB] hover:text-[#1C1B29]"
                                    >
                                        <Pencil size={13} /> Sửa
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleApprove(event)}
                                        disabled={approving || !isEventDateComplete(event)}
                                        title={
                                            isEventDateComplete(event)
                                                ? undefined
                                                : 'Bổ sung ngày trước khi duyệt'
                                        }
                                        className="inline-flex items-center gap-1 rounded-lg bg-green-600 px-2.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        <Check size={13} /> Duyệt
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setDeleteTarget(event)}
                                        className="inline-flex items-center gap-1 rounded-lg border border-[#E7E9F1] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#6B7280] transition-colors hover:bg-red-50 hover:text-red-600"
                                    >
                                        <Trash2 size={13} /> Từ chối
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div
                                key={event.eventId}
                                className="flex flex-col gap-3 rounded-2xl border border-[#E7E9F1] bg-white p-4 sm:flex-row sm:items-start sm:justify-between"
                            >
                                <div className="min-w-0 flex-1">
                                    <div className="mb-1.5 flex flex-wrap items-center gap-2">
                                        <h3 className="font-bold text-[#1C1B29]">{event.title}</h3>
                                        {event.source === 'ai_suggested' && (
                                            <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#E7E9F1] bg-[#F7F7FB] px-2 py-0.5 text-[11px] font-semibold text-[#6B7280]">
                                                <Sparkles size={11} /> Do AI đề xuất
                                            </span>
                                        )}
                                    </div>
                                    <EventTypeBadge event={event} />
                                    {event.description && (
                                        <p className="mt-2 line-clamp-2 text-sm text-[#6B7280]">{event.description}</p>
                                    )}
                                </div>
                                <div className="flex shrink-0 gap-1.5 self-end sm:self-start">
                                    <button
                                        type="button"
                                        onClick={() => setFormState({ open: true, event })}
                                        aria-label="Sửa sự kiện"
                                        className="rounded-lg p-2 text-[#6B7280] transition-colors hover:bg-[#F7F7FB] hover:text-[#4F46E5]"
                                    >
                                        <Pencil size={16} />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setDeleteTarget(event)}
                                        aria-label="Xoá sự kiện"
                                        className="rounded-lg p-2 text-[#6B7280] transition-colors hover:bg-red-50 hover:text-red-600"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        ),
                    )}
                </div>
            )}

            <LocalEventFormModal
                open={formState.open}
                event={formState.event}
                onClose={() => setFormState({ open: false, event: null })}
            />

            <LocalEventExtractModal
                open={extractOpen}
                onClose={() => setExtractOpen(false)}
                onExtracted={() => setActiveTab('pending')}
            />

            <ConfirmModal
                open={Boolean(deleteTarget)}
                title={deleteTarget?.status === 'pending' ? 'Từ chối đề xuất' : 'Xoá sự kiện'}
                message={
                    deleteTarget?.status === 'pending'
                        ? `Từ chối đề xuất "${deleteTarget?.title}"? Sự kiện này sẽ bị xoá hẳn, không lưu lại.`
                        : `Xoá sự kiện "${deleteTarget?.title}"? Trợ lý AI sẽ không còn gợi ý sự kiện này cho khách nữa.`
                }
                confirmLabel={deleteTarget?.status === 'pending' ? 'Từ chối' : 'Xoá'}
                danger
                loading={deleting}
                onConfirm={handleConfirmDelete}
                onClose={() => setDeleteTarget(null)}
            />
        </>
    );
}
