import { useEffect, useRef, useState } from 'react';
import { Loader2, Paperclip, X } from 'lucide-react';
import { toast } from 'react-toastify';
import Modal from '../../common/Modal';
import RefundPayerBankInfo from './RefundPayerBankInfo';
import { useUploadRefundProofMutation } from '../../../services/refundRequest';

// Khớp đúng giới hạn backend (RefundRequestController.uploadAttachment) — cùng pattern
// Chatbot.jsx (KAN-113).
const MAX_PROOF_SIZE_MB = 5;
const ACCEPTED_PROOF_TYPES = 'image/jpeg,image/png,image/webp';

// Dùng chung cho 2 hành động "Đánh dấu đã hoàn tiền" (adminNote không bắt buộc, VD số
// tham chiếu giao dịch chuyển khoản thủ công, kèm ảnh biên lai cũng không bắt buộc) và
// "Từ chối" (adminNote BẮT BUỘC — khách cần biết lý do, không có ảnh). Không dùng
// ConfirmModal vì cần thêm ô nhập liệu/upload, ConfirmModal chỉ có text.
export default function RefundActionModal({ open, mode, refund, loading, onConfirm, onClose }) {
    const [adminNote, setAdminNote] = useState('');
    const [proofImageUrl, setProofImageUrl] = useState(null);
    const fileInputRef = useRef(null);
    const [uploadProof, { isLoading: isUploading }] = useUploadRefundProofMutation();

    useEffect(() => {
        if (open) {
            setAdminNote('');
            setProofImageUrl(null);
        }
    }, [open, refund]);

    if (!refund) return null;
    const isReject = mode === 'reject';
    // Ảnh biên lai BẮT BUỘC khi đánh dấu đã hoàn tiền (trước đây tuỳ chọn) — reject() không
    // cần ảnh, chỉ cần adminNote như cũ.
    const isValid = isReject ? adminNote.trim().length > 0 : Boolean(proofImageUrl);

    const handleConfirmClick = () => {
        // Chặn thêm ở đây phòng trường hợp nút disable bị bypass (VD devtools) — disabled
        // trên nút đã đủ cho luồng bình thường, đây chỉ là lớp bảo vệ thứ 2.
        if (!isReject && !proofImageUrl) {
            toast.error('Vui lòng đính kèm ảnh biên lai trước khi xác nhận.');
            return;
        }
        onConfirm({ adminNote: adminNote.trim(), proofImageUrl });
    };

    const handleSelectProof = async (e) => {
        const file = e.target.files?.[0];
        e.target.value = ''; // cho chọn lại đúng file đó lần nữa nếu cần
        if (!file) return;
        if (!ACCEPTED_PROOF_TYPES.split(',').includes(file.type)) {
            toast.error('Chỉ nhận ảnh định dạng JPG, PNG hoặc WEBP.');
            return;
        }
        if (file.size > MAX_PROOF_SIZE_MB * 1024 * 1024) {
            toast.error(`Ảnh vượt quá dung lượng cho phép (tối đa ${MAX_PROOF_SIZE_MB}MB).`);
            return;
        }
        try {
            const result = await uploadProof(file).unwrap();
            setProofImageUrl(result.url);
        } catch (err) {
            toast.error(err?.data?.message || 'Không tải ảnh lên được, vui lòng thử lại.');
        }
    };

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
                        onClick={handleConfirmClick}
                        disabled={loading || !isValid || isUploading}
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
                {!isReject && (
                    <RefundPayerBankInfo payerBankInfo={refund.payerBankInfo} qrImageUrl={refund.qrImageUrl} />
                )}
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
                {!isReject && (
                    <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">
                            Ảnh biên lai/QR chuyển khoản <span className="text-red-500">(bắt buộc)</span>
                        </label>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept={ACCEPTED_PROOF_TYPES}
                            onChange={handleSelectProof}
                            className="hidden"
                        />
                        {proofImageUrl ? (
                            <div className="relative inline-block">
                                <img
                                    src={proofImageUrl}
                                    alt="Ảnh biên lai chuyển khoản"
                                    className="h-20 w-20 rounded-lg border border-gray-200 object-cover"
                                />
                                <button
                                    type="button"
                                    onClick={() => setProofImageUrl(null)}
                                    aria-label="Xoá ảnh"
                                    className="absolute -right-1.5 -top-1.5 rounded-full bg-gray-800 p-0.5 text-white shadow"
                                >
                                    <X size={12} />
                                </button>
                            </div>
                        ) : (
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isUploading}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {isUploading ? (
                                    <Loader2 size={13} className="animate-spin" />
                                ) : (
                                    <Paperclip size={13} />
                                )}
                                {isUploading ? 'Đang tải ảnh lên...' : 'Chọn ảnh'}
                            </button>
                        )}
                    </div>
                )}
            </div>
        </Modal>
    );
}
