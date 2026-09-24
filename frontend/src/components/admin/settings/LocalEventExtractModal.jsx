import { useRef, useState } from 'react';
import { FileText, Loader2, Sparkles, Upload, X } from 'lucide-react';
import { toast } from 'react-toastify';
import {
    useExtractLocalEventsFromFileMutation,
    useExtractLocalEventsMutation,
} from '../../../services/hotelConfig';

const TEXT_MAX_LENGTH = 20000;
const MAX_FILE_SIZE_MB = 10;
// Khớp đúng SUPPORTED_FILE_EXTENSIONS ở LocalEventExtractionService (backend) — chỉ để
// gợi ý sớm cho admin, backend vẫn là nơi kiểm tra thật sự.
const ACCEPTED_FILE_TYPES = '.pdf,.docx,.txt';
const ACCEPTED_EXTENSIONS = ['.pdf', '.docx', '.txt'];

function getFileExtension(filename) {
    const idx = filename.lastIndexOf('.');
    return idx === -1 ? '' : filename.slice(idx).toLowerCase();
}

// Modal cho tính năng "AI hỗ trợ nhập liệu": admin dán link, dán text, hoặc tải file
// (.pdf/.docx/.txt) lên — backend gọi Gemini trích xuất sự kiện thành các bản nháp
// status='pending' — KHÔNG tự hiển thị cho khách cho tới khi admin duyệt riêng từng cái
// ở tab "Chờ duyệt" (xem LocalEventsSettingsPage). Cùng khung modal (drawer full-screen
// ở mobile) như LocalEventFormModal để đồng bộ giao diện.
export default function LocalEventExtractModal({ open, onClose, onExtracted }) {
    const [tab, setTab] = useState('url');
    const [url, setUrl] = useState('');
    const [text, setText] = useState('');
    const [file, setFile] = useState(null);
    const fileInputRef = useRef(null);
    const [extractLocalEvents, { isLoading: isExtractingText }] = useExtractLocalEventsMutation();
    const [extractLocalEventsFromFile, { isLoading: isExtractingFile }] =
        useExtractLocalEventsFromFileMutation();
    const isLoading = isExtractingText || isExtractingFile;

    if (!open) return null;

    const isValid =
        tab === 'url'
            ? url.trim().length > 0
            : tab === 'text'
              ? text.trim().length > 0
              : Boolean(file);

    const resetAndClose = () => {
        setUrl('');
        setText('');
        setFile(null);
        setTab('url');
        onClose();
    };

    const handleFileChange = (e) => {
        const selected = e.target.files?.[0];
        if (!selected) return;
        const ext = getFileExtension(selected.name);
        if (!ACCEPTED_EXTENSIONS.includes(ext)) {
            toast.error(`Chỉ nhận file ${ACCEPTED_FILE_TYPES.replaceAll(',', ', ')}.`);
            e.target.value = '';
            return;
        }
        if (selected.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
            toast.error(`File vượt quá dung lượng cho phép (tối đa ${MAX_FILE_SIZE_MB}MB).`);
            e.target.value = '';
            return;
        }
        setFile(selected);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!isValid || isLoading) return;
        try {
            const result =
                tab === 'url'
                    ? await extractLocalEvents({ url: url.trim() }).unwrap()
                    : tab === 'text'
                      ? await extractLocalEvents({ text: text.trim() }).unwrap()
                      : await extractLocalEventsFromFile(file).unwrap();
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

                        <div className="grid grid-cols-3 gap-1 rounded-lg bg-[#F7F7FB] p-1">
                            {[
                                { value: 'url', label: 'Dán link' },
                                { value: 'text', label: 'Dán nội dung' },
                                { value: 'file', label: 'Tải file lên' },
                            ].map((t) => (
                                <button
                                    key={t.value}
                                    type="button"
                                    onClick={() => setTab(t.value)}
                                    className={`rounded-md px-2 py-1.5 text-sm font-semibold transition-colors ${
                                        tab === t.value
                                            ? 'bg-white text-[#4F46E5] shadow-sm'
                                            : 'text-[#6B7280] hover:text-[#1C1B29]'
                                    }`}
                                >
                                    {t.label}
                                </button>
                            ))}
                        </div>

                        {tab === 'url' && (
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
                        )}

                        {tab === 'text' && (
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

                        {tab === 'file' && (
                            <div>
                                <label className="mb-1 block text-sm font-medium text-[#1C1B29]">
                                    File tài liệu
                                </label>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept={ACCEPTED_FILE_TYPES}
                                    onChange={handleFileChange}
                                    className="hidden"
                                />
                                {file ? (
                                    <div className="flex items-center gap-3 rounded-lg border border-[#E7E9F1] bg-[#F7F7FB] px-3 py-2.5">
                                        <FileText size={18} className="shrink-0 text-[#4F46E5]" />
                                        <span className="min-w-0 flex-1 truncate text-sm text-[#1C1B29]">
                                            {file.name}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setFile(null);
                                                if (fileInputRef.current) fileInputRef.current.value = '';
                                            }}
                                            aria-label="Bỏ chọn file"
                                            className="shrink-0 rounded-full p-1 text-[#9AA0B4] transition-colors hover:bg-white hover:text-red-600"
                                        >
                                            <X size={14} />
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        className="flex w-full flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-[#E7E9F1] px-3 py-6 text-center transition-colors hover:border-[#4F46E5] hover:bg-[#F5F3FF]"
                                    >
                                        <Upload size={20} className="text-[#9AA0B4]" />
                                        <span className="text-sm font-medium text-[#4F46E5]">
                                            Chọn file để tải lên
                                        </span>
                                        <span className="text-xs text-[#9AA0B4]">
                                            PDF, Word (.docx) hoặc .txt — tối đa {MAX_FILE_SIZE_MB}MB
                                        </span>
                                    </button>
                                )}
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
