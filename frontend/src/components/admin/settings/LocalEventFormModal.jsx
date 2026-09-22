import { useEffect, useState } from 'react';
import { Loader2, Save, X } from 'lucide-react';
import { toast } from 'react-toastify';
import {
    useCreateLocalEventMutation,
    useUpdateLocalEventMutation,
} from '../../../services/hotelConfig';

// Thứ hiển thị THEO ĐÚNG THỨ TỰ "Thứ Hai -> Chủ Nhật" (yêu cầu UI), nhưng "value" của mỗi
// nút vẫn phải khớp quy ước cột dayOfWeek trong DB: 0 = Chủ Nhật ... 6 = Thứ Bảy (giống
// JS Date#getDay()) — KHÔNG dùng lại WEEKDAY_LABELS ở admin/shifts/dateUtils.js, mảng đó
// đánh số theo thứ tự hiển thị (index 0 = Thứ 2), lệch hẳn với quy ước Chủ-Nhật-là-0 ở đây.
const WEEKDAY_OPTIONS = [
    { value: 1, label: 'Thứ Hai' },
    { value: 2, label: 'Thứ Ba' },
    { value: 3, label: 'Thứ Tư' },
    { value: 4, label: 'Thứ Năm' },
    { value: 5, label: 'Thứ Sáu' },
    { value: 6, label: 'Thứ Bảy' },
    { value: 0, label: 'Chủ Nhật' },
];

const emptyForm = { title: '', description: '', type: 'once', specificDate: '', dayOfWeek: null };

function formToPayload(form) {
    const payload = {
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        recurrence: form.type === 'once' ? 'ONCE' : 'WEEKLY',
    };
    if (form.type === 'once') payload.specificDate = form.specificDate;
    else payload.dayOfWeek = form.dayOfWeek;
    return payload;
}

function eventToForm(event) {
    if (!event) return emptyForm;
    return {
        title: event.title ?? '',
        description: event.description ?? '',
        type: event.recurrence === 'WEEKLY' ? 'weekly' : 'once',
        specificDate: event.specificDate ?? '',
        dayOfWeek: event.dayOfWeek ?? null,
    };
}

// Modal ở desktop, full-screen drawer ở mobile (< sm) — cùng 1 khối JSX, chỉ đổi class
// theo breakpoint, để khỏi phải bảo trì 2 bộ markup riêng cho 2 kiểu hiển thị.
export default function LocalEventFormModal({ open, event, onClose }) {
    const isEdit = Boolean(event);
    const [form, setForm] = useState(emptyForm);
    const [createLocalEvent, { isLoading: creating }] = useCreateLocalEventMutation();
    const [updateLocalEvent, { isLoading: updating }] = useUpdateLocalEventMutation();
    const saving = creating || updating;

    // Nạp lại form đúng dữ liệu mỗi lần mở (tạo mới hoặc sửa 1 sự kiện khác) — không dùng
    // "key" ép remount vì modal còn cần animation/scroll-lock nguyên trạng.
    useEffect(() => {
        if (open) setForm(eventToForm(event));
    }, [open, event]);

    if (!open) return null;

    const isValid =
        form.title.trim().length > 0 &&
        (form.type === 'once' ? Boolean(form.specificDate) : form.dayOfWeek !== null);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!isValid || saving) return;
        try {
            const payload = formToPayload(form);
            if (isEdit) {
                await updateLocalEvent({ eventId: event.eventId, ...payload }).unwrap();
                toast.success('Đã cập nhật sự kiện');
            } else {
                await createLocalEvent(payload).unwrap();
                toast.success('Đã thêm sự kiện');
            }
            onClose();
        } catch (err) {
            toast.error(err?.data?.message || 'Không thể lưu sự kiện, vui lòng thử lại.');
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 sm:items-center sm:p-4">
            <div className="flex h-full w-full flex-col overflow-hidden bg-white sm:h-auto sm:max-h-[90vh] sm:w-full sm:max-w-md sm:rounded-[20px] sm:shadow-2xl">
                <div className="flex shrink-0 items-center justify-between border-b border-[#E7E9F1] px-5 py-4">
                    <h2 className="text-base font-bold text-[#1C1B29]">
                        {isEdit ? 'Sửa sự kiện' : 'Thêm sự kiện'}
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

                <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
                    <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
                        <div>
                            <label className="mb-1 block text-sm font-medium text-[#1C1B29]">Tên sự kiện</label>
                            <input
                                type="text"
                                value={form.title}
                                maxLength={200}
                                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                                placeholder="VD: Chợ đêm phố đi bộ"
                                autoFocus
                                className="w-full rounded-lg border border-[#E7E9F1] px-3 py-2 text-sm text-[#1C1B29] focus:outline-none focus:ring-2 focus:ring-[#4F46E5] focus:border-transparent"
                            />
                        </div>

                        <div>
                            <label className="mb-1 block text-sm font-medium text-[#1C1B29]">
                                Mô tả <span className="font-normal text-[#9AA0B4]">(không bắt buộc)</span>
                            </label>
                            <textarea
                                value={form.description}
                                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                                rows={3}
                                placeholder="Mô tả ngắn để trợ lý AI giới thiệu cho khách..."
                                className="w-full resize-none rounded-lg border border-[#E7E9F1] px-3 py-2 text-sm text-[#1C1B29] focus:outline-none focus:ring-2 focus:ring-[#4F46E5] focus:border-transparent"
                            />
                        </div>

                        <div>
                            <label className="mb-1 block text-sm font-medium text-[#1C1B29]">Loại sự kiện</label>
                            {/* Đổi tab thì xoá trắng cả 2 trường bên dưới (specificDate/dayOfWeek) — tránh
                                gửi lên giá trị "sót" từ tab trước đó mà admin không để ý đang không hiện. */}
                            <div className="grid grid-cols-2 gap-1 rounded-lg bg-[#F7F7FB] p-1">
                                {[
                                    { value: 'once', label: 'Một lần' },
                                    { value: 'weekly', label: 'Lặp lại hàng tuần' },
                                ].map((tab) => (
                                    <button
                                        key={tab.value}
                                        type="button"
                                        onClick={() =>
                                            setForm((f) => ({ ...f, type: tab.value, specificDate: '', dayOfWeek: null }))
                                        }
                                        className={`rounded-md px-3 py-1.5 text-sm font-semibold transition-colors ${
                                            form.type === tab.value
                                                ? 'bg-white text-[#4F46E5] shadow-sm'
                                                : 'text-[#6B7280] hover:text-[#1C1B29]'
                                        }`}
                                    >
                                        {tab.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {form.type === 'once' ? (
                            <div>
                                <label className="mb-1 block text-sm font-medium text-[#1C1B29]">Ngày diễn ra</label>
                                <input
                                    type="date"
                                    value={form.specificDate}
                                    onChange={(e) => setForm((f) => ({ ...f, specificDate: e.target.value }))}
                                    className="w-full rounded-lg border border-[#E7E9F1] px-3 py-2 text-sm text-[#1C1B29] focus:outline-none focus:ring-2 focus:ring-[#4F46E5] focus:border-transparent"
                                />
                            </div>
                        ) : (
                            <div>
                                <label className="mb-1 block text-sm font-medium text-[#1C1B29]">Lặp lại vào</label>
                                <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-7">
                                    {WEEKDAY_OPTIONS.map((day) => (
                                        <button
                                            key={day.value}
                                            type="button"
                                            onClick={() => setForm((f) => ({ ...f, dayOfWeek: day.value }))}
                                            className={`rounded-lg border px-2 py-2 text-xs font-semibold transition-colors ${
                                                form.dayOfWeek === day.value
                                                    ? 'border-[#4F46E5] bg-[#4F46E5] text-white'
                                                    : 'border-[#E7E9F1] text-[#6B7280] hover:border-[#4F46E5] hover:text-[#4F46E5]'
                                            }`}
                                        >
                                            {day.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex shrink-0 gap-2 border-t border-[#E7E9F1] px-5 py-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-xl border border-[#E7E9F1] px-4 py-2.5 text-sm font-semibold text-[#6B7280] transition-colors hover:bg-gray-50"
                        >
                            Huỷ
                        </button>
                        <button
                            type="submit"
                            disabled={!isValid || saving}
                            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#4F46E5] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#4338CA] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                            Lưu
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export { WEEKDAY_OPTIONS };
