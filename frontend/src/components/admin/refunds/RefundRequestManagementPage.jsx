import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Link2, MessageCircle, Info } from 'lucide-react';
import { toast } from 'react-toastify';
import { useAuth } from '../../../context/AuthContext';
import RefundActionModal from './RefundActionModal';
import {
    useCompleteRefundRequestMutation,
    useGetRefundRequestsQuery,
    useLinkRefundRequestConversationMutation,
    useRejectRefundRequestMutation,
} from '../../../services/refundRequest';

const PAGE_LIMIT = 10;

// Mặc định "Đang chờ xử lý" lên trước — backend (RefundRequestService.findAll) đã tự sắp
// PENDING lên đầu bất kể lọc theo status nào, FE chỉ cần giữ tab 'PENDING' làm mặc định.
const TABS = [
    { value: 'PENDING', label: 'Đang chờ xử lý' },
    { value: '', label: 'Tất cả' },
    { value: 'COMPLETED', label: 'Đã hoàn tiền' },
    { value: 'REJECTED', label: 'Đã từ chối' },
];

const STATUS_STYLES = {
    PENDING: 'border-amber-200 bg-amber-50 text-amber-700',
    COMPLETED: 'border-green-200 bg-green-50 text-green-700',
    REJECTED: 'border-red-200 bg-red-50 text-red-700',
};
const STATUS_LABELS = {
    PENDING: 'Đang chờ xử lý',
    COMPLETED: 'Đã hoàn tiền',
    REJECTED: 'Đã từ chối',
};

function StatusBadge({ status }) {
    return (
        <span
            className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[status] ?? 'border-gray-200 bg-gray-50 text-gray-600'}`}
        >
            {STATUS_LABELS[status] ?? status}
        </span>
    );
}

function formatDateTime(value) {
    return new Date(value).toLocaleString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function PayerBankInfo({ value }) {
    if (!value) {
        return (
            <p className="text-xs italic text-amber-600">
                Chưa có thông tin tài khoản — vui lòng liên hệ khách qua chat hoặc số điện thoại để
                xác nhận trước khi chuyển khoản.
            </p>
        );
    }
    if (typeof value === 'object') {
        return (
            <div className="space-y-0.5 text-xs text-gray-600">
                {Object.entries(value).map(([key, val]) => (
                    <p key={key}>
                        <span className="font-medium">{key}:</span> {String(val)}
                    </p>
                ))}
            </div>
        );
    }
    return <p className="text-xs text-gray-600">{String(value)}</p>;
}

// Admin không tham gia chat trực tiếp (GET /chat/conversations chỉ dành cho STAFF — xem
// chat.controller.ts) nên không dựng được dropdown chọn hội thoại ở đây; cho nhập tay ID
// đã có qua kênh khác (lễ tân cung cấp) — đơn giản, không phá ranh giới quyền đã thiết lập
// của hệ thống chat.
function LinkConversationInline({ refundRequestId }) {
    const [value, setValue] = useState('');
    const [linkConversation, { isLoading }] = useLinkRefundRequestConversationMutation();

    const handleLink = async () => {
        const conversationId = value.trim();
        if (!conversationId) return;
        try {
            await linkConversation({ refundRequestId, conversationId }).unwrap();
            toast.success('Đã gắn hội thoại');
            setValue('');
        } catch (err) {
            toast.error(err?.data?.message || 'Không gắn được hội thoại, kiểm tra lại ID.');
        }
    };

    return (
        <div className="flex items-center gap-1.5">
            <input
                type="text"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="Dán ID hội thoại..."
                className="w-40 rounded-lg border border-gray-200 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
                type="button"
                onClick={handleLink}
                disabled={!value.trim() || isLoading}
                className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-gray-200 px-2 py-1.5 text-xs font-semibold text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
                <Link2 size={12} /> Gắn
            </button>
        </div>
    );
}

function RefundRow({ refund }) {
    const navigate = useNavigate();
    const { user } = useAuth();
    // Chỉ STAFF xem được nội dung hội thoại (GET /chat/conversations/:id/messages chặn
    // ADMIN ở tầng service — xem ChatService.assertCanAccess, cố tình KHÔNG nới lỏng).
    // Trang này cho cả ADMIN lẫn STAFF vào, nên phải tự ẩn phần chỉ STAFF dùng được.
    const isStaff = user?.role === 'STAFF';
    const [actionModal, setActionModal] = useState(null); // 'complete' | 'reject' | null
    const [completeRefund, { isLoading: completing }] = useCompleteRefundRequestMutation();
    const [rejectRefund, { isLoading: rejecting }] = useRejectRefundRequestMutation();

    const booking = refund.booking;
    const guestName = booking?.guestInfo?.fullName ?? booking?.user?.fullName ?? 'Khách hàng';

    const handleConfirmAction = async (adminNote) => {
        try {
            if (actionModal === 'complete') {
                await completeRefund({ refundRequestId: refund.refundRequestId, adminNote }).unwrap();
                toast.success('Đã đánh dấu hoàn tiền thành công');
            } else {
                await rejectRefund({ refundRequestId: refund.refundRequestId, adminNote }).unwrap();
                toast.success('Đã từ chối yêu cầu hoàn tiền');
            }
            setActionModal(null);
        } catch (err) {
            toast.error(err?.data?.message || 'Không xử lý được yêu cầu, vui lòng thử lại.');
        }
    };

    return (
        <>
            <div className="rounded-2xl border border-gray-200 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                            <h3 className="font-bold text-gray-900">{guestName}</h3>
                            <StatusBadge status={refund.status} />
                        </div>
                        <p className="text-sm text-gray-500">
                            {booking?.roomType?.name} · Nhận phòng {booking?.checkInDate} · Mã đơn{' '}
                            {booking?.bookingId?.slice(0, 8)}
                        </p>
                        <p className="mt-1 text-xl font-bold text-gray-900">
                            {refund.amount?.toLocaleString('vi-VN')}đ
                            {typeof refund.refundPercent === 'number' && refund.refundPercent < 100 && (
                                <span className="ml-1.5 text-sm font-semibold text-orange-500">
                                    (hoàn {refund.refundPercent}%)
                                </span>
                            )}
                        </p>
                        {refund.reason && (
                            <p className="mt-1 text-sm text-gray-500">Lý do huỷ: {refund.reason}</p>
                        )}
                        <p className="mt-1 text-xs text-gray-400">{formatDateTime(refund.createdAt)}</p>
                    </div>

                    <div className="flex shrink-0 flex-col items-end gap-2">
                        <div className="flex gap-1.5">
                            {isStaff ? (
                                refund.conversation ? (
                                    <button
                                        type="button"
                                        onClick={() =>
                                            navigate(`/admin/chat?conversationId=${refund.conversation.conversationId}`)
                                        }
                                        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 transition-colors hover:bg-gray-50"
                                    >
                                        <MessageCircle size={13} /> Xem hội thoại
                                    </button>
                                ) : (
                                    <LinkConversationInline refundRequestId={refund.refundRequestId} />
                                )
                            ) : (
                                // Admin không xem được nội dung chat (chỉ STAFF) — chỉ báo trạng thái liên
                                // kết, không hiện nút dẫn tới trang họ không vào được.
                                <span className="inline-flex items-center gap-1.5 text-xs italic text-gray-400">
                                    <Info size={13} />
                                    {refund.conversation ? 'Đã liên kết hội thoại' : 'Nhân viên xác minh qua chat'}
                                </span>
                            )}
                        </div>
                        {refund.status === 'PENDING' && (
                            <>
                                <p className="max-w-[220px] text-right text-[11px] text-gray-400">
                                    Lưu ý: đối chiếu tên trên ảnh QR với tên khách đặt phòng trước khi xác nhận,
                                    tránh hoàn nhầm tài khoản.
                                </p>
                                <div className="flex gap-1.5">
                                <button
                                    type="button"
                                    onClick={() => setActionModal('reject')}
                                    className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50"
                                >
                                    Từ chối
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setActionModal('complete')}
                                    className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-green-700"
                                >
                                    Đánh dấu đã hoàn tiền
                                </button>
                                </div>
                            </>
                        )}
                        {refund.status !== 'PENDING' && refund.adminNote && (
                            <p className="max-w-[220px] text-right text-xs text-gray-400">
                                Ghi chú: {refund.adminNote}
                            </p>
                        )}
                    </div>
                </div>

                <div className="mt-3 border-t border-gray-100 pt-3">
                    <PayerBankInfo value={refund.payerBankInfo} />
                </div>
            </div>

            <RefundActionModal
                open={Boolean(actionModal)}
                mode={actionModal}
                refund={refund}
                loading={completing || rejecting}
                onConfirm={handleConfirmAction}
                onClose={() => setActionModal(null)}
            />
        </>
    );
}

export default function RefundRequestManagementPage() {
    const [status, setStatus] = useState('PENDING');
    const [page, setPage] = useState(1);
    const { data, isLoading } = useGetRefundRequestsQuery({ status, page, limit: PAGE_LIMIT });

    const items = data?.items ?? [];
    const total = data?.total ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_LIMIT));

    const handleTabChange = (value) => {
        setStatus(value);
        setPage(1);
    };

    return (
        <>
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900">Yêu cầu hoàn tiền</h1>
                <p className="mt-1 text-sm text-gray-500">
                    Tự động ghi nhận khi huỷ đơn đã thanh toán — quy trình bán tự động, nhân viên tự
                    chuyển khoản sau khi xác minh thông tin qua chat.
                </p>
            </div>

            <div className="mb-5 inline-flex flex-wrap gap-1 rounded-lg border border-gray-200 bg-white p-1">
                {TABS.map((tab) => (
                    <button
                        key={tab.value}
                        type="button"
                        onClick={() => handleTabChange(tab.value)}
                        className={`rounded-md px-3 py-1.5 text-sm font-semibold transition-colors ${
                            status === tab.value ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {isLoading ? (
                <div className="space-y-3">
                    {[0, 1, 2].map((i) => (
                        <div key={i} className="h-32 animate-pulse rounded-2xl bg-gray-100" />
                    ))}
                </div>
            ) : items.length === 0 ? (
                <div className="rounded-2xl border border-gray-200 bg-white p-12 text-center text-gray-400">
                    Không có yêu cầu hoàn tiền nào.
                </div>
            ) : (
                <div className="space-y-3">
                    {items.map((refund) => (
                        <RefundRow key={refund.refundRequestId} refund={refund} />
                    ))}
                </div>
            )}

            {totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
                    <span>Tổng {total} yêu cầu</span>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            disabled={page <= 1}
                            className="rounded-lg border border-gray-200 p-1.5 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            <ChevronLeft size={16} />
                        </button>
                        <span>
                            Trang {page}/{totalPages}
                        </span>
                        <button
                            type="button"
                            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                            disabled={page >= totalPages}
                            className="rounded-lg border border-gray-200 p-1.5 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            <ChevronRight size={16} />
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}
