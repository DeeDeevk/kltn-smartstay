import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const SIZE_CLASSNAMES = {
  md: 'max-w-md',
  lg: 'max-w-2xl',
};

// Modal dùng chung cho toàn app (thay cho window.confirm()/alert()) — chỉ lo phần
// khung/backdrop, nội dung và hành động do component gọi nó quyết định qua children/footer.
// size="lg" dành cho form nhiều trường/ảnh (vd. RoomTypeFormModal) cần bề ngang rộng hơn.
export default function Modal({ open, onClose, title, children, footer, size = 'md' }) {
  const { t } = useTranslation();
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-8"
      onClick={onClose}
    >
      <div
        className={`w-full max-h-full overflow-y-auto rounded-2xl bg-white p-6 shadow-xl ${SIZE_CLASSNAMES[size] ?? SIZE_CLASSNAMES.md}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 transition-colors hover:text-gray-600"
            aria-label={t('common.close')}
          >
            <X size={20} />
          </button>
        </div>
        <div>{children}</div>
        {footer && <div className="mt-6 flex justify-end gap-3">{footer}</div>}
      </div>
    </div>
  );
}
