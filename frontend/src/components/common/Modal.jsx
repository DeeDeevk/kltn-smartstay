import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const SIZE_CLASSNAMES = {
  md: 'max-w-md',
  lg: 'max-w-2xl',
};

// Thời gian giữ modal trong DOM sau khi đóng để chạy xong animation thoát (khớp với
// .modal-backdrop-out / .modal-panel-out trong index.css).
const EXIT_MS = 160;

// Modal dùng chung cho toàn app (thay cho window.confirm()/alert()) — chỉ lo phần
// khung/backdrop, nội dung và hành động do component gọi nó quyết định qua children/footer.
// size="lg" dành cho form nhiều trường/ảnh (vd. RoomTypeFormModal) cần bề ngang rộng hơn.
export default function Modal({ open, onClose, title, children, footer, size = 'md' }) {
  const { t } = useTranslation();
  const [mounted, setMounted] = useState(open);

  useEffect(() => {
    if (open) {
      setMounted(true);
      return undefined;
    }
    const timer = setTimeout(() => setMounted(false), EXIT_MS);
    return () => clearTimeout(timer);
  }, [open]);

  // Khi đóng, nơi gọi thường xoá dữ liệu ngay (vd. setSelected(null)) khiến nội dung
  // nháy sang trạng thái trống/đang tải trong lúc modal còn đang mờ dần. Giữ lại nội
  // dung của lần render cuối cùng lúc còn mở để phần thoát trông liền mạch.
  const lastOpenContent = useRef({ title, children, footer });
  if (open) lastOpenContent.current = { title, children, footer };

  if (!open && !mounted) return null;
  const closing = !open;
  const shown = lastOpenContent.current;

  // Render qua portal ra thẳng document.body: nếu để nguyên trong cây DOM, một
  // ancestor có backdrop-filter/transform (vd. <header> có backdrop-blur) sẽ trở
  // thành containing block khiến "fixed inset-0" bị co lại theo ancestor đó.
  //
  // Cố tình KHÔNG đóng modal khi bấm ra ngoài (backdrop) — dễ mất dữ liệu đang
  // nhập dở trong form (vd. "Thêm loại ca"). Chỉ đóng qua nút X hoặc nút hành
  // động rõ ràng (Hủy/Đóng) do nơi gọi Modal tự quyết định.
  return createPortal(
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-8 ${
        closing ? 'modal-backdrop-out pointer-events-none' : 'modal-backdrop-in'
      }`}
    >
      <div
        className={`w-full max-h-full overflow-y-auto rounded-2xl bg-white p-6 shadow-xl ${
          closing ? 'modal-panel-out' : 'modal-panel-in'
        } ${SIZE_CLASSNAMES[size] ?? SIZE_CLASSNAMES.md}`}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900">{shown.title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
            aria-label={t('common.close')}
          >
            <X size={20} />
          </button>
        </div>
        <div>{shown.children}</div>
        {shown.footer && (
          <div className="mt-6 flex justify-end gap-3">{shown.footer}</div>
        )}
      </div>
    </div>,
    document.body,
  );
}
