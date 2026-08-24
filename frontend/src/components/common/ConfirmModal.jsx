import Modal from './Modal';

// Dialog xác nhận dùng chung, xây trên Modal — dùng cho mọi hành động cần xác nhận
// trước khi thực thi (khoá/mở khoá tài khoản, xoá dữ liệu...) thay cho window.confirm().
export default function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = 'Xác nhận',
  danger = false,
  loading = false,
  onConfirm,
  onClose,
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-xl px-4 py-2 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-100 disabled:opacity-70"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`rounded-xl px-4 py-2 text-sm font-bold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-70 ${
              danger ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {loading ? 'Đang xử lý...' : confirmLabel}
          </button>
        </>
      }
    >
      <p className="text-sm leading-6 text-gray-600">{message}</p>
    </Modal>
  );
}
