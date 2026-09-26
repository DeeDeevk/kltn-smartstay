import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const SIZE_CLASSNAMES = {
  md: 'max-w-md',
  lg: 'max-w-2xl',
  // xl cho form nhiều trường (vd. khuyến mãi): rộng hơn -> xếp được 3 cột, bớt số
  // hàng nên đỡ phải cuộn.
  xl: 'max-w-4xl',
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
      {/* Chỉ phần thân cuộn, tiêu đề và footer đứng yên: nếu cả panel cuộn thì thanh
          cuộn của trình duyệt đè lên góc bo tròn và nút Lưu trôi mất khỏi màn hình. */}
      <div
        className={`flex w-full max-h-full flex-col overflow-hidden rounded-2xl bg-white shadow-xl ${
          closing ? 'modal-panel-out' : 'modal-panel-in'
        } ${SIZE_CLASSNAMES[size] ?? SIZE_CLASSNAMES.md}`}
      >
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-gray-100 px-6 py-4">
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
        <div className="modal-scroll min-h-0 flex-1 overflow-y-auto px-6 py-5">{shown.children}</div>
        {shown.footer && (
          <div className="flex shrink-0 justify-end gap-3 border-t border-gray-100 bg-gray-50/70 px-6 py-4">
            {shown.footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
