import { useEffect, useMemo, useState } from 'react';
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

// Key localStorage cho toggle "Ẩn sự kiện đã qua" — chỉ ảnh hưởng tab "Đã duyệt".
const HIDE_PAST_STORAGE_KEY = 'vika-local-events-hide-past';

function formatVnDate(isoDate) {
    // specificDate là chuỗi "YYYY-MM-DD" thuần (cột kiểu date, không có giờ/múi giờ) — tách
    // chuỗi trực tiếp thay vì new Date(isoDate) để tránh bị lùi 1 ngày do trình duyệt hiểu
    // "YYYY-MM-DD" là nửa đêm UTC rồi tự quy đổi sang múi giờ local (UTC+7) lúc hiển thị.
    const [year, month, day] = isoDate.split('-');
    return `${day}/${month}/${year}`;
}

// "Hôm nay" dạng "YYYY-MM-DD" theo ngày của trình duyệt (không phải UTC) — so sánh trực
// tiếp bằng string với specificDate (cũng "YYYY-MM-DD" thuần) để tránh mọi lệch múi giờ
// mà new Date() có thể gây ra.
function todayDateStr() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
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

// Chỉ sự kiện "Một lần" mới có khái niệm đã qua — "Lặp lại" diễn ra hàng tuần nên không
// bao giờ được coi là đã qua, dù dayOfWeek đó "đã trôi qua" trong tuần này đi nữa.
function isEventPast(event, today) {
    return (
        event.recurrence !== 'WEEKLY' &&
        Boolean(event.specificDate) &&
        event.specificDate < today
    );
}

function EventTypeBadge({ event, isPast = false }) {
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
    if (isPast) {
        return (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#E5E7EB] bg-[#F3F4F6] px-2.5 py-1 text-xs font-semibold text-[#6B7280]">
                Một lần · {formatVnDate(event.specificDate)} · Đã qua
            </span>
        );
    }
    return (
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#BFDBFE] bg-[#EFF6FF] px-2.5 py-1 text-xs font-semibold text-[#2563EB]">
            Một lần · {formatVnDate(event.specificDate)}
        </span>
    );
}

// Card cho tab "Đã duyệt" — tách riêng khỏi component trang để tự tính isPast dựa trên
// ngày hiện tại của trình duyệt tại thời điểm render, không cần truyền lại từ ngoài.
// Nút Sửa/Xoá KHÔNG bị disable dù card đã xám — sự kiện qua rồi vẫn cần sửa lại ngày
// hoặc xoá được bình thường.
function EventCard({ event, onEdit, onDelete }) {
    const isPast = isEventPast(event, todayDateStr());
    return (
        <div
            className={`flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-start sm:justify-between ${
                isPast ? 'border-[#E5E7EB] bg-[#FAFAFA]' : 'border-[#E7E9F1] bg-white'
            }`}
        >
            <div className="min-w-0 flex-1">
                <div className="mb-1.5 flex flex-wrap items-center gap-2">
                    <h3 className={`font-bold ${isPast ? 'text-[#6B7280]' : 'text-[#1C1B29]'}`}>
                        {event.title}
                    </h3>
                    {event.source === 'ai_suggested' && (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#E7E9F1] bg-[#F7F7FB] px-2 py-0.5 text-[11px] font-semibold text-[#6B7280]">
                            <Sparkles size={11} /> Do AI đề xuất
                        </span>
                    )}
                </div>
                <EventTypeBadge event={event} isPast={isPast} />
                {event.description && (
                    <p className="mt-2 line-clamp-2 text-sm text-[#6B7280]">{event.description}</p>
                )}
            </div>
            <div className="flex shrink-0 gap-1.5 self-end sm:self-start">
                <button
                    type="button"
                    onClick={onEdit}
                    aria-label="Sửa sự kiện"
                    className="rounded-lg p-2 text-[#6B7280] transition-colors hover:bg-[#F7F7FB] hover:text-[#4F46E5]"
                >
                    <Pencil size={16} />
                </button>
                <button
                    type="button"
                    onClick={onDelete}
                    aria-label="Xoá sự kiện"
                    className="rounded-lg p-2 text-[#6B7280] transition-colors hover:bg-red-50 hover:text-red-600"
                >
                    <Trash2 size={16} />
                </button>
            </div>
        </div>
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

// localStorage có thể bị chặn (chế độ riêng tư...) — lỗi ở đây chỉ làm mất tính năng nhớ
// lựa chọn ẩn/hiện, không được làm hỏng cả trang (theo đúng cách xử lý localStorage đã
// dùng ở aiChatHistory.js/AiChatbot.jsx).
function readStoredHidePast() {
    try {
        return localStorage.getItem(HIDE_PAST_STORAGE_KEY) === 'true';
    } catch {
        return false;
    }
}

export default function LocalEventsSettingsPage() {
    const { data: events, isLoading } = useGetLocalEventsQuery();
    const [deleteLocalEvent, { isLoading: deleting }] = useDeleteLocalEventMutation();
    const [approveLocalEvent, { isLoading: approving }] = useApproveLocalEventMutation();

    const [activeTab, setActiveTab] = useState('approved');
    const [formState, setFormState] = useState({ open: false, event: null });
    const [extractOpen, setExtractOpen] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [hidePast, setHidePast] = useState(readStoredHidePast);

    useEffect(() => {
        try {
            localStorage.setItem(HIDE_PAST_STORAGE_KEY, String(hidePast));
        } catch {
            // bỏ qua — chỉ mất tính năng nhớ lựa chọn, không ảnh hưởng phần còn lại
        }
    }, [hidePast]);

    // events ?? [] không đưa vào useMemo deps được: mỗi render mà events vẫn undefined (đang
    // loading) sẽ tạo 1 mảng rỗng mới, khiến deps đổi liên tục — dùng thẳng `events` (tham
    // chiếu ổn định từ RTK Query khi có dữ liệu, và y hệt `undefined` khi chưa có) làm dep.
    //
    // Sắp xếp: sự kiện lặp lại + sự kiện một lần CHƯA qua lên trước (một lần sắp theo ngày
    // gần nhất trước), sự kiện một lần ĐÃ qua xuống cuối (mới qua gần đây hiện trước — tức
    // ngày giảm dần). Không dùng lại thứ tự "dayOfWeek NULLS LAST" của backend vì ở đây cần
    // thêm hẳn 1 nhóm "đã qua" mà backend không có khái niệm.
    const approvedList = useMemo(() => {
        const today = todayDateStr();
        const list = (events ?? []).filter((e) => e.status !== 'pending');
        return [...list].sort((a, b) => {
            const aPast = isEventPast(a, today);
            const bPast = isEventPast(b, today);
            if (aPast !== bPast) return aPast ? 1 : -1;

            const aIsWeekly = a.recurrence === 'WEEKLY';
            const bIsWeekly = b.recurrence === 'WEEKLY';
            if (aIsWeekly !== bIsWeekly) return aIsWeekly ? -1 : 1;
            if (aIsWeekly && bIsWeekly) return (a.dayOfWeek ?? 99) - (b.dayOfWeek ?? 99);

            // Cả 2 đều là "Một lần": nhóm chưa qua sắp ngày gần nhất trước (tăng dần),
            // nhóm đã qua sắp mới-qua-gần-đây trước (giảm dần).
            const aDate = a.specificDate ?? '';
            const bDate = b.specificDate ?? '';
            return aPast ? bDate.localeCompare(aDate) : aDate.localeCompare(bDate);
        });
    }, [events]);

    const visibleApprovedList = useMemo(() => {
        if (!hidePast) return approvedList;
        const today = todayDateStr();
        return approvedList.filter((e) => !isEventPast(e, today));
    }, [approvedList, hidePast]);

    const pendingList = useMemo(
        () => (events ?? []).filter((e) => e.status === 'pending'),
        [events],
    );
    const visibleList = activeTab === 'pending' ? pendingList : visibleApprovedList;
    // Riêng cho thông báo trống "đã lọc hết" — phân biệt với "vốn dĩ chưa có sự kiện nào".
    const hidingAllPast =
        activeTab === 'approved' &&
        hidePast &&
        approvedList.length > 0 &&
        visibleApprovedList.length === 0;

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

            {activeTab === 'approved' && (
                <label className="mb-4 flex w-fit cursor-pointer items-center gap-2 text-sm text-[#6B7280]">
                    <input
                        type="checkbox"
                        checked={hidePast}
                        onChange={(e) => setHidePast(e.target.checked)}
                        className="h-4 w-4 rounded border-[#D1D5DB] text-[#4F46E5] focus:ring-[#4F46E5]"
                    />
                    Ẩn sự kiện đã qua
                </label>
            )}

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
                    ) : hidingAllPast ? (
                        <>
                            <p className="text-sm font-bold text-[#1C1B29]">
                                Toàn bộ sự kiện hiện có đều đã qua và đang bị ẩn.
                            </p>
                            <button
                                type="button"
                                onClick={() => setHidePast(false)}
                                className="mt-4 inline-flex items-center gap-2 rounded-xl border border-[#E7E9F1] bg-white px-4 py-2.5 text-sm font-semibold text-[#4F46E5] transition-colors hover:bg-[#F7F7FB]"
                            >
                                Tắt "Ẩn sự kiện đã qua"
                            </button>
                        </>
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
                            <EventCard
                                key={event.eventId}
                                event={event}
                                onEdit={() => setFormState({ open: true, event })}
                                onDelete={() => setDeleteTarget(event)}
                            />
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
