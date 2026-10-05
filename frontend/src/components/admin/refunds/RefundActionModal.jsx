import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import Modal from '../../common/Modal';

// Dùng chung cho 2 hành động "Đánh dấu đã hoàn tiền" (adminNote không bắt buộc, VD số
// tham chiếu giao dịch chuyển khoản thủ công) và "Từ chối" (adminNote BẮT BUỘC — khách cần
// biết lý do). Không dùng ConfirmModal vì cần thêm 1 ô nhập liệu, ConfirmModal chỉ có text.
export default function RefundActionModal({ open, mode, refund, loading, onConfirm, onClose }) {
    const [adminNote, setAdminNote] = useState('');

    useEffect(() => {
        if (open) setAdminNote('');
    }, [open, refund]);

    if (!refund) return null;
    const isReject = mode === 'reject';
    const isValid = isReject ? adminNote.trim().length > 0 : true;

    return (
        <Modal
            open={open}
            onClose={onClose}
            title={isReject ? 'Từ chối yêu cầu hoàn tiền' : 'Đánh dấu đã hoàn tiền'}
            footer={
                <>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={loading}
                        className="rounded-xl px-4 py-2 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-100 disabled:opacity-70"
                    >
                        Huỷ
                    </button>
                    <button
                        type="button"
                        onClick={() => onConfirm(adminNote.trim())}
                        disabled={loading || !isValid}
                        className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-70 ${
                            isReject ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'
                        }`}
                    >
                        {loading && <Loader2 size={14} className="animate-spin" />}
                        {isReject ? 'Từ chối' : 'Xác nhận đã hoàn tiền'}
                    </button>
                </>
            }
        >
            <div className="space-y-3">
                <p className="text-sm text-gray-600">
                    Đơn <span className="font-semibold">{refund.booking?.roomType?.name}</span> —{' '}
                    {refund.booking?.guestInfo?.fullName ?? refund.booking?.user?.fullName} — số tiền{' '}
                    <span className="font-semibold">{refund.amount?.toLocaleString('vi-VN')}đ</span>
                </p>
                <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                        Ghi chú {isReject && <span className="text-red-500">(bắt buộc)</span>}
                    </label>
                    <textarea
                        value={adminNote}
                        onChange={(e) => setAdminNote(e.target.value)}
                        rows={3}
                        placeholder={
                            isReject
                                ? 'VD: Không xác minh được thông tin chuyển khoản...'
                                : 'VD: Đã chuyển khoản, mã GD 123456...'
                        }
                        className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
            </div>
        </Modal>
    );
}
