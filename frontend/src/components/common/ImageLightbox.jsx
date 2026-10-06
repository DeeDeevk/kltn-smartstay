import { X } from 'lucide-react';

// Modal đơn giản phóng to 1 ảnh — dùng chung cho Chatbot.jsx (khách) và StaffChatPage.jsx
// (lễ tân) để xem ảnh đính kèm trong chat (KAN-113), tránh viết lặp lại 2 nơi. Không dùng
// thư viện lightbox ngoài vì chỉ cần xem đúng 1 ảnh, không cần điều hướng nhiều ảnh/zoom.
export default function ImageLightbox({ src, onClose }) {
    if (!src) return null;
    return (
        <div
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 p-4"
            onClick={onClose}
        >
            <button
                type="button"
                onClick={onClose}
                aria-label="Đóng"
                className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20"
            >
                <X size={22} />
            </button>
            <img
                src={src}
                alt="Ảnh đính kèm phóng to"
                onClick={(e) => e.stopPropagation()}
                className="max-h-full max-w-full rounded-lg object-contain shadow-2xl"
            />
        </div>
    );
}
