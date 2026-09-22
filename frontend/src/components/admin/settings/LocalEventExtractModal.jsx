import { useState } from 'react';
import { Loader2, Sparkles, X } from 'lucide-react';
import { toast } from 'react-toastify';
import { useExtractLocalEventsMutation } from '../../../services/hotelConfig';

const TEXT_MAX_LENGTH = 20000;

// Modal cho tính năng "AI hỗ trợ nhập liệu": admin dán link hoặc đoạn text, backend gọi
// Gemini trích xuất sự kiện thành các bản nháp status='pending' — KHÔNG tự hiển thị cho
// khách cho tới khi admin duyệt riêng từng cái ở tab "Chờ duyệt" (xem
// LocalEventsSettingsPage). Cùng khung modal (drawer full-screen ở mobile) như
// LocalEventFormModal để đồng bộ giao diện.
export default function LocalEventExtractModal({ open, onClose, onExtracted }) {
    const [tab, setTab] = useState('url');
    const [url, setUrl] = useState('');
    const [text, setText] = useState('');
    const [extractLocalEvents, { isLoading }] = useExtractLocalEventsMutation();

    if (!open) return null;

    const isValid = tab === 'url' ? url.trim().length > 0 : text.trim().length > 0;

    const resetAndClose = () => {
        setUrl('');
        setText('');
        setTab('url');
        onClose();
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!isValid || isLoading) return;
        try {
            const payload = tab === 'url' ? { url: url.trim() } : { text: text.trim() };
            const result = await extractLocalEvents(payload).unwrap();
            toast.success(
                `Đã trích xuất được ${result.length} sự kiện, đang chờ bạn duyệt.`,
            );
            onExtracted?.();
            resetAndClose();
        } catch (err) {
            toast.error(
                err?.data?.message || 'Không trích xuất được sự kiện, vui lòng thử lại.',
            );
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 sm:items-center sm:p-4">
            <div className="flex h-full w-full flex-col overflow-hidden bg-white sm:h-auto sm:max-h-[90vh] sm:w-full sm:max-w-md sm:rounded-[20px] sm:shadow-2xl">
                <div className="flex shrink-0 items-center justify-between border-b border-[#E7E9F1] px-5 py-4">
                    <h2 className="flex items-center gap-2 text-base font-bold text-[#1C1B29]">
                        <Sparkles size={18} className="text-[#F59E0B]" /> Trích xuất từ nguồn
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
                            AI đọc nội dung bạn cung cấp và đề xuất các sự kiện có ngày/thời gian rõ
                            ràng — không tự tìm kiếm thêm trên internet. Sự kiện đề xuất cần bạn xem
                            lại và bấm "Duyệt" thì trợ lý AI mới dùng được.
                        </p>

                        <div className="grid grid-cols-2 gap-1 rounded-lg bg-[#F7F7FB] p-1">
                            {[
                                { value: 'url', label: 'Dán link' },
                                { value: 'text', label: 'Dán nội dung' },
                            ].map((t) => (
                                <button
                                    key={t.value}
                                    type="button"
                                    onClick={() => setTab(t.value)}
                                    className={`rounded-md px-3 py-1.5 text-sm font-semibold transition-colors ${
                                        tab === t.value
                                            ? 'bg-white text-[#4F46E5] shadow-sm'
                                            : 'text-[#6B7280] hover:text-[#1C1B29]'
                                    }`}
                                >
                                    {t.label}
                                </button>
                            ))}
                        </div>

                        {tab === 'url' ? (
                            <div>
                                <label className="mb-1 block text-sm font-medium text-[#1C1B29]">
                                    Link bài báo/mạng xã hội
                                </label>
                                <input
                                    type="url"
                                    value={url}
                                    onChange={(e) => setUrl(e.target.value)}
                                    placeholder="https://..."
                                    autoFocus
                                    className="w-full rounded-lg border border-[#E7E9F1] px-3 py-2 text-sm text-[#1C1B29] focus:outline-none focus:ring-2 focus:ring-[#4F46E5] focus:border-transparent"
                                />
                            </div>
                        ) : (
                            <div>
                                <label className="mb-1 block text-sm font-medium text-[#1C1B29]">
                                    Nội dung văn bản
                                </label>
                                <textarea
                                    value={text}
                                    onChange={(e) => setText(e.target.value.slice(0, TEXT_MAX_LENGTH))}
                                    rows={8}
                                    placeholder="Dán đoạn văn bản có chứa thông tin sự kiện..."
                                    autoFocus
                                    className="w-full resize-none rounded-lg border border-[#E7E9F1] px-3 py-2 text-sm text-[#1C1B29] focus:outline-none focus:ring-2 focus:ring-[#4F46E5] focus:border-transparent"
                                />
                                <p className="mt-1 text-right text-xs text-[#9AA0B4]">
                                    {text.length}/{TEXT_MAX_LENGTH}
                                </p>
                            </div>
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
                                <Sparkles size={16} />
                            )}
                            {isLoading ? 'Đang trích xuất...' : 'Trích xuất'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
