import { useState } from 'react';
import { Calendar, Pencil, Plus, Sparkles, Trash2 } from 'lucide-react';
import { toast } from 'react-toastify';
import ConfirmModal from '../../common/ConfirmModal';
import LocalEventFormModal, { WEEKDAY_OPTIONS } from './LocalEventFormModal';
import {
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

function EventTypeBadge({ event }) {
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

export default function LocalEventsSettingsPage() {
    const { data: events, isLoading } = useGetLocalEventsQuery();
    const [deleteLocalEvent, { isLoading: deleting }] = useDeleteLocalEventMutation();

    const [formState, setFormState] = useState({ open: false, event: null });
    const [deleteTarget, setDeleteTarget] = useState(null);

    const list = events ?? [];

    const handleConfirmDelete = async () => {
        if (!deleteTarget) return;
        try {
            await deleteLocalEvent(deleteTarget.eventId).unwrap();
            toast.success('Đã xoá sự kiện');
            setDeleteTarget(null);
        } catch (err) {
            toast.error(err?.data?.message || 'Không thể xoá sự kiện, vui lòng thử lại.');
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
                <button
                    type="button"
                    onClick={() => setFormState({ open: true, event: null })}
                    className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-[#4F46E5] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#4338CA]"
                >
                    <Plus size={16} /> Thêm sự kiện
                </button>
            </div>

            {isLoading ? (
                <div className="space-y-3">
                    {[0, 1, 2].map((i) => (
                        <div key={i} className="h-24 animate-pulse rounded-2xl bg-[#F7F7FB]" />
                    ))}
                </div>
            ) : list.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-[#E7E9F1] bg-white px-6 py-16 text-center">
                    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#F7F7FB]">
                        <Calendar size={22} className="text-[#9AA0B4]" />
                    </div>
                    <p className="text-sm font-bold text-[#1C1B29]">Chưa có sự kiện nào được thiết lập</p>
                    <button
                        type="button"
                        onClick={() => setFormState({ open: true, event: null })}
                        className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#4F46E5] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#4338CA]"
                    >
                        <Plus size={16} /> Thêm sự kiện đầu tiên
                    </button>
                </div>
            ) : (
                <div className="space-y-3">
                    {list.map((event) => (
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
                    ))}
                </div>
            )}

            <LocalEventFormModal
                open={formState.open}
                event={formState.event}
                onClose={() => setFormState({ open: false, event: null })}
            />

            <ConfirmModal
                open={Boolean(deleteTarget)}
                title="Xoá sự kiện"
                message={`Xoá sự kiện "${deleteTarget?.title}"? Trợ lý AI sẽ không còn gợi ý sự kiện này cho khách nữa.`}
                confirmLabel="Xoá"
                danger
                loading={deleting}
                onConfirm={handleConfirmDelete}
                onClose={() => setDeleteTarget(null)}
            />
        </>
    );
}
