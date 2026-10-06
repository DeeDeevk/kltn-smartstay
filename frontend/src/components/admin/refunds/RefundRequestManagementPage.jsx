import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    ImageIcon,
    Loader2,
    MessageCircle,
    Info,
    Save,
    Settings,
} from 'lucide-react';
import { toast } from 'react-toastify';
import { useAuth } from '../../../context/AuthContext';
import RefundActionModal from './RefundActionModal';
import RefundPayerBankInfo from './RefundPayerBankInfo';
import ImageLightbox from '../../common/ImageLightbox';
import {
    useCompleteRefundRequestMutation,
    useGetRefundRequestsQuery,
    useRejectRefundRequestMutation,
} from '../../../services/refundRequest';
import { useGetHotelConfigQuery, useUpdateCancellationPolicyMutation } from '../../../services/hotelConfig';

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

function RefundRow({ refund }) {
    const navigate = useNavigate();
    const { user } = useAuth();
    // Chỉ STAFF xem được nội dung hội thoại (GET /chat/conversations/:id/messages chặn
    // ADMIN ở tầng service — xem ChatService.assertCanAccess, cố tình KHÔNG nới lỏng).
    // Trang này cho cả ADMIN lẫn STAFF vào, nên phải tự ẩn phần chỉ STAFF dùng được.
    const isStaff = user?.role === 'STAFF';
    const [actionModal, setActionModal] = useState(null); // 'complete' | 'reject' | null
    const [lightboxSrc, setLightboxSrc] = useState(null);
    const [completeRefund, { isLoading: completing }] = useCompleteRefundRequestMutation();
    const [rejectRefund, { isLoading: rejecting }] = useRejectRefundRequestMutation();

    const booking = refund.booking;
    const guestName = booking?.guestInfo?.fullName ?? booking?.user?.fullName ?? 'Khách hàng';

    const handleConfirmAction = async ({ adminNote, proofImageUrl }) => {
        try {
            if (actionModal === 'complete') {
                await completeRefund({
                    refundRequestId: refund.refundRequestId,
                    adminNote,
                    proofImageUrl,
                }).unwrap();
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
                                    // Gắn hội thoại giờ làm trong khung chat (StaffChatPage), không còn thao
                                    // tác gắn ở trang này nữa — chỉ hiện trạng thái.
                                    <span className="inline-flex items-center gap-1.5 text-xs italic text-gray-400">
                                        <Info size={13} />
                                        Chưa gắn hội thoại — gắn trong khung chat
                                    </span>
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
                        )}
                        {refund.status !== 'PENDING' && refund.adminNote && (
                            <p className="max-w-[220px] text-right text-xs text-gray-400">
                                Ghi chú: {refund.adminNote}
                            </p>
                        )}
                        {refund.status === 'COMPLETED' && refund.proofImageUrl && (
                            <button
                                type="button"
                                onClick={() => setLightboxSrc(refund.proofImageUrl)}
                                className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline"
                            >
                                <ImageIcon size={13} /> Xem biên lai
                            </button>
                        )}
                    </div>
                </div>

                <div className="mt-3 border-t border-gray-100 pt-3">
                    <RefundPayerBankInfo payerBankInfo={refund.payerBankInfo} qrImageUrl={refund.qrImageUrl} />
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
            <ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />
        </>
    );
}

// Chính sách hoàn tiền theo thời điểm huỷ (KAN-117) — chuyển từ trang "Vị trí khách sạn"
// sang đây vì đây mới là nơi admin thực sự cần xem/chỉnh nó (gắn trực tiếp với luồng xử lý
// refund), dù cả 2 nhóm field vẫn cùng nằm trên 1 bản ghi HotelConfig ở backend. Thu gọn
// mặc định để không che nội dung chính của trang (danh sách yêu cầu) — admin ít khi cần
// đổi chính sách này, chỉ thỉnh thoảng mới mở ra.
function CancellationPolicyPanel() {
    const [isOpen, setIsOpen] = useState(false);
    const { data: config } = useGetHotelConfigQuery();
    const [updateCancellationPolicy, { isLoading: savingPolicy }] = useUpdateCancellationPolicyMutation();
    const [freeCancellationHours, setFreeCancellationHours] = useState(48);
    const [partialRefundPercent, setPartialRefundPercent] = useState(50);
    const [refundProcessingSlaHours, setRefundProcessingSlaHours] = useState(24);

    useEffect(() => {
        if (!config) return;
        setFreeCancellationHours(config.freeCancellationHours ?? 48);
        setPartialRefundPercent(config.partialRefundPercent ?? 50);
        setRefundProcessingSlaHours(config.refundProcessingSlaHours ?? 24);
    }, [config]);

    const isPolicyValid =
        Number.isFinite(freeCancellationHours) &&
        freeCancellationHours >= 0 &&
        Number.isFinite(partialRefundPercent) &&
        partialRefundPercent >= 0 &&
        partialRefundPercent <= 100 &&
        Number.isFinite(refundProcessingSlaHours) &&
        refundProcessingSlaHours >= 1;

    const isPolicyDirty =
        Boolean(config) &&
        (freeCancellationHours !== (config.freeCancellationHours ?? 48) ||
            partialRefundPercent !== (config.partialRefundPercent ?? 50) ||
            refundProcessingSlaHours !== (config.refundProcessingSlaHours ?? 24));

    const handleCancelPolicy = () => {
        setFreeCancellationHours(config?.freeCancellationHours ?? 48);
        setPartialRefundPercent(config?.partialRefundPercent ?? 50);
        setRefundProcessingSlaHours(config?.refundProcessingSlaHours ?? 24);
    };

    const handleSavePolicy = async () => {
        if (!isPolicyValid) {
            toast.error('Số giờ phải >= 0, % hoàn phải trong khoảng 0-100, SLA xử lý phải >= 1 giờ');
            return;
        }
        try {
            await updateCancellationPolicy({
                freeCancellationHours,
                partialRefundPercent,
                refundProcessingSlaHours,
            }).unwrap();
            toast.success('Đã lưu chính sách hoàn tiền');
        } catch (err) {
            toast.error(err?.data?.message || 'Không thể lưu chính sách hoàn tiền');
        }
    };

    return (
        <div className="mb-5 rounded-2xl border border-gray-200 bg-white">
            <button
                type="button"
                onClick={() => setIsOpen((prev) => !prev)}
                className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
            >
                <span className="flex items-center gap-2 text-sm font-bold text-gray-900">
                    <Settings size={16} className="text-gray-500" />
                    Cấu hình chính sách hoàn tiền
                </span>
                <ChevronDown
                    size={18}
                    className={`shrink-0 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                />
            </button>
            {isOpen && (
                <div className="border-t border-gray-100 p-4">
                    <p className="mb-4 text-sm text-gray-500">
                        Áp dụng cho mọi đơn đã thanh toán bị huỷ, chung cho toàn khách sạn (không phân biệt
                        theo loại phòng).
                    </p>
                    <div className="grid gap-4 sm:grid-cols-3">
                        <div className="space-y-1.5">
                            <label className="text-[13px] font-bold text-gray-500">
                                Hoàn 100% nếu huỷ trước (giờ)
                            </label>
                            <input
                                type="number"
                                min={0}
                                value={Number.isNaN(freeCancellationHours) ? '' : freeCancellationHours}
                                onChange={(e) =>
                                    setFreeCancellationHours(e.target.value === '' ? NaN : Number(e.target.value))
                                }
                                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <p className="text-xs text-gray-400">
                                Huỷ trước giờ nhận phòng ít nhất số giờ này thì hoàn 100% tiền đã thanh toán.
                            </p>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[13px] font-bold text-gray-500">% hoàn nếu huỷ muộn hơn</label>
                            <input
                                type="number"
                                min={0}
                                max={100}
                                value={Number.isNaN(partialRefundPercent) ? '' : partialRefundPercent}
                                onChange={(e) =>
                                    setPartialRefundPercent(e.target.value === '' ? NaN : Number(e.target.value))
                                }
                                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <p className="text-xs text-gray-400">
                                Huỷ sau mốc trên nhưng vẫn trước giờ nhận phòng thì hoàn theo % này. Huỷ sau giờ
                                nhận phòng (no-show) thì không hoàn gì.
                            </p>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[13px] font-bold text-gray-500">
                                Thời hạn xử lý hoàn tiền (giờ)
                            </label>
                            <input
                                type="number"
                                min={1}
                                value={Number.isNaN(refundProcessingSlaHours) ? '' : refundProcessingSlaHours}
                                onChange={(e) =>
                                    setRefundProcessingSlaHours(
                                        e.target.value === '' ? NaN : Number(e.target.value),
                                    )
                                }
                                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <p className="text-xs text-gray-400">
                                Nếu quá thời gian này mà chưa xử lý, khách sẽ thấy nút liên hệ lễ tân.
                            </p>
                        </div>
                    </div>
                    <div className="mt-4 flex justify-end gap-2">
                        <button
                            type="button"
                            onClick={handleCancelPolicy}
                            disabled={!isPolicyDirty || savingPolicy}
                            className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            Huỷ thay đổi
                        </button>
                        <button
                            type="button"
                            onClick={handleSavePolicy}
                            disabled={!isPolicyDirty || savingPolicy || !isPolicyValid}
                            className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {savingPolicy ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                            Lưu chính sách
                        </button>
                    </div>
                </div>
            )}
        </div>
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

            <CancellationPolicyPanel />

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

            {status === 'PENDING' && !isLoading && items.length > 0 && (
                <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                    <Info size={16} className="mt-0.5 shrink-0" />
                    <p>
                        Trước khi đánh dấu đã hoàn tiền, hãy đối chiếu tên trên ảnh QR khách gửi với tên
                        người đặt phòng để tránh hoàn nhầm tài khoản.
                    </p>
                </div>
            )}

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
