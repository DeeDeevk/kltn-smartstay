import React, { useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
    BedDouble,
    Users,
    CheckCircle2,
    Tag,
    CalendarDays,
    User,
    Phone,
    Mail,
    Download,
    Banknote,
    QrCode,
    Loader2,
    Clock,
} from 'lucide-react';
import downloadQrPng from '../utils/downloadQr';
import getBookingCode from '../utils/bookingCode';
import getBookingQrPayload from '../utils/bookingQrPayload';
import { useSyncPayOSStatusQuery } from '../services/payment';

const PAYOS_POLL_INTERVAL_MS = 5000;

const PAYMENT_METHOD_LABEL = {
    CASH: 'Tiền mặt tại quầy',
    PAYOS: 'Chuyển khoản (quét mã QR)',
};

export const formatVnd = (value) => {
    if (typeof value !== 'number') return '';
    return new Intl.NumberFormat('vi-VN').format(value) + ' đ';
};

const renderInlineBold = (text, keyPrefix = '') => {
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) =>
        part.startsWith('**') && part.endsWith('**') ? (
            <strong key={`${keyPrefix}${i}`}>{part.slice(2, -2)}</strong>
        ) : (
            <React.Fragment key={`${keyPrefix}${i}`}>{part}</React.Fragment>
        ),
    );
};

// Link markdown [text](https://...) hoặc URL trần https://... — chỉ nhận http(s) để
// không render được link javascript:. URL dài (vd. link PayOS) không có khoảng trắng
// nên phải cho ngắt giữa chừng (break-all), nếu không sẽ tràn khỏi bong bóng chat.
const LINK_PATTERN = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s)]+)/g;

const renderInline = (text) => {
    const nodes = [];
    let lastIndex = 0;
    let match;
    LINK_PATTERN.lastIndex = 0;
    while ((match = LINK_PATTERN.exec(text)) !== null) {
        if (match.index > lastIndex) {
            nodes.push(...renderInlineBold(text.slice(lastIndex, match.index), `t${match.index}-`));
        }
        const [, label, labeledUrl, bareUrl] = match;
        const url = labeledUrl ?? bareUrl;
        nodes.push(
            <a
                key={`a${match.index}`}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className={`font-semibold text-blue-600 underline hover:text-blue-800 ${label ? '' : 'break-all'}`}
            >
                {label ?? url}
            </a>,
        );
        lastIndex = match.index + match[0].length;
    }
    if (lastIndex < text.length) {
        nodes.push(...renderInlineBold(text.slice(lastIndex), 'end-'));
    }
    return nodes;
};

// Trả lời của AI dùng markdown tối giản (**in đậm**, gạch đầu dòng, danh sách số,
// link) — dựng riêng thay vì thêm thư viện markdown vì chỉ cần đúng vài cú pháp này.
export const FormattedMessage = ({ text }) => {
    const lines = (text ?? '').split('\n');
    const blocks = [];
    let currentList = [];

    const flushList = () => {
        if (currentList.length === 0) return;
        blocks.push(
            <ul key={`ul-${blocks.length}`} className="list-disc pl-5 space-y-0.5">
                {currentList.map((item, i) => (
                    <li key={i}>{renderInline(item)}</li>
                ))}
            </ul>,
        );
        currentList = [];
    };

    lines.forEach((line, idx) => {
        const trimmed = line.trim();
        const bulletMatch = trimmed.match(/^[-*]\s+(.*)/);
        const numberedMatch = trimmed.match(/^\d+[.)]\s+(.*)/);
        if (bulletMatch) {
            currentList.push(bulletMatch[1]);
            return;
        }
        if (numberedMatch) {
            currentList.push(numberedMatch[1]);
            return;
        }
        flushList();
        if (trimmed !== '') {
            // System prompt tells the model not to use markdown headings in chat replies,
            // but strip a stray leading #/##/### defensively anyway — otherwise it would
            // leak into the bubble as literal "#" characters (the parser below has no
            // concept of headings, only bold/bullets/links).
            const headingMatch = trimmed.match(/^#{1,6}\s+(.*)/);
            const content = headingMatch ? headingMatch[1] : line;
            blocks.push(
                <p key={idx} className="leading-relaxed">
                    {renderInline(content)}
                </p>,
            );
        }
    });
    flushList();

    // wrap-anywhere: chốt chặn cuối cho mọi chuỗi dài không có khoảng trắng khác.
    return <div className="space-y-1.5 wrap-anywhere">{blocks}</div>;
};

export const RoomCard = ({ room, onSelect, index = 0 }) => {
    const image = Array.isArray(room.images) && room.images.length > 0 ? room.images[0] : null;
    return (
        <div
            style={{ animationDelay: `${Math.min(index, 6) * 60}ms` }}
            className="anim-fade-up lift w-full rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm"
        >
            <div className="h-28 bg-gradient-to-br from-blue-100 to-blue-50 flex items-center justify-center overflow-hidden">
                {image ? (
                    <img loading="lazy" src={image} alt={room.name} className="w-full h-full object-cover" />
                ) : (
                    <BedDouble className="w-9 h-9 text-blue-300" />
                )}
            </div>
            <div className="p-3 space-y-1.5">
                <p className="font-bold text-gray-800 text-sm leading-snug">{room.name}</p>
                <div className="flex items-center gap-3 text-xs text-gray-500">
                    {room.capacity && (
                        <span className="flex items-center gap-1">
                            <Users className="w-3.5 h-3.5" /> {room.capacity} khách
                        </span>
                    )}
                    {typeof room.availableCount === 'number' && (
                        <span className="text-green-600 font-medium">
                            Còn {room.availableCount} phòng
                        </span>
                    )}
                </div>
                <div className="flex items-center justify-between pt-1">
                    <span className="text-blue-600 font-bold text-sm">
                        {formatVnd(room.basePrice)}
                        <span className="text-gray-400 font-normal">/đêm</span>
                    </span>
                    <button
                        onClick={() => onSelect(room)}
                        className="text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-full px-3 py-1.5 transition-colors"
                    >
                        Chọn phòng này
                    </button>
                </div>
            </div>
        </div>
    );
};

export const RoomCardList = ({ rooms, onSelect }) => {
    if (!Array.isArray(rooms) || rooms.length === 0) return null;
    return (
        <div className="grid grid-cols-2 gap-2 w-full">
            {rooms.map((room, index) => (
                <RoomCard key={room.roomTypeId} room={room} onSelect={onSelect} index={index} />
            ))}
        </div>
    );
};

export const PromotionList = ({ promotions }) => {
    if (!Array.isArray(promotions) || promotions.length === 0) return null;
    return (
        <div className="w-full space-y-2">
            {promotions.map((promo) => (
                <div
                    key={promo.code}
                    className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2"
                >
                    <Tag className="w-4 h-4 text-amber-500 shrink-0" />
                    <div className="text-xs text-gray-700">
                        <span className="font-bold text-amber-700">{promo.code}</span>
                        {' — giảm '}
                        {promo.discountType === 'PERCENT'
                            ? `${promo.discountValue}%`
                            : formatVnd(promo.discountValue)}
                    </div>
                </div>
            ))}
        </div>
    );
};

// disabled: khoá 2 nút trong lúc đang gửi — tránh khách bấm "Xác nhận" 2 lần liên tiếp.
export const PendingBookingCard = ({ pendingBooking, onConfirm, onCancel, disabled = false }) => {
    if (!pendingBooking) return null;
    return (
        <div className="w-full rounded-xl border-2 border-blue-200 bg-blue-50/70 p-4 space-y-2">
            <p className="font-bold text-blue-700 text-sm">Xác nhận đặt phòng</p>
            <div className="text-sm text-gray-700 space-y-1">
                <p>
                    <span className="text-gray-500">Loại phòng:</span>{' '}
                    <b>{pendingBooking.roomTypeName}</b>
                </p>
                <p>
                    <span className="text-gray-500">Nhận phòng:</span> {pendingBooking.checkIn}
                    {'  →  '}
                    <span className="text-gray-500">Trả phòng:</span> {pendingBooking.checkOut}{' '}
                    <span className="text-gray-400">({pendingBooking.nights} đêm)</span>
                </p>
                {pendingBooking.guestInfo?.fullName && (
                    <p>
                        <span className="text-gray-500">Khách:</span>{' '}
                        {pendingBooking.guestInfo.fullName} · {pendingBooking.guestInfo.phone}
                    </p>
                )}
                {pendingBooking.discountAmount > 0 && (
                    <p className="text-green-600">
                        Giảm giá: -{formatVnd(pendingBooking.discountAmount)}
                    </p>
                )}
                {pendingBooking.paymentMethod && (
                    <p>
                        <span className="text-gray-500">Thanh toán:</span>{' '}
                        {PAYMENT_METHOD_LABEL[pendingBooking.paymentMethod] ?? pendingBooking.paymentMethod}
                    </p>
                )}
                <p className="text-base font-bold text-blue-700 pt-1">
                    Tổng tiền: {formatVnd(pendingBooking.totalAmount)}
                </p>
            </div>
            <div className="flex gap-2 pt-1">
                <button
                    onClick={onConfirm}
                    disabled={disabled}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-full py-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Xác nhận đặt phòng
                </button>
                <button
                    onClick={onCancel}
                    disabled={disabled}
                    className="flex-1 bg-white border border-gray-300 text-gray-600 hover:bg-gray-50 text-sm font-semibold rounded-full py-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Huỷ
                </button>
            </div>
        </div>
    );
};

// Sau khi đặt phòng thành công có 2 mã QR khác nhau, không được gộp làm một:
// 1. Mã QR thanh toán PayOS — chỉ có khi đơn chọn chuyển khoản, backend đã tạo sẵn kèm
//    booking (createLinkForBooking).
// 2. "Vé đặt phòng" — mã hoá bookingId, dùng để lễ tân quét lúc khách nhận phòng
//    (QRScannerModal tra GET /bookings/:id). Tái dùng đúng getBookingCode/
//    getBookingQrPayload như trang đặt phòng thường (BookingSuccess ở AppRoutes.jsx)
//    để 2 nơi ra cùng 1 QR cho cùng 1 booking.
//
// Với đơn chuyển khoản: chỉ đưa vé check-in SAU KHI đã xác nhận thanh toán thành công —
// đưa vé trước khi khách thực sự chuyển khoản dễ hiểu nhầm là đã xong, nên khi còn
// UNPAID chỉ hiện QR thanh toán, tự poll trạng thái (giống trang checkout thường) và
// chỉ lộ vé QR khi PayOS báo đã nhận tiền. Đơn tiền mặt không cần chờ gì, hiện vé ngay.
export const BookingConfirmedCard = ({ booking }) => {
    const ticketQrRef = useRef(null);
    const paymentQrRef = useRef(null);
    const isPayos = booking?.paymentMethod === 'PAYOS';
    const isExpired = isPayos && booking?.expiredAt && Date.now() / 1000 > booking.expiredAt;

    // Dữ liệu booking trong tin nhắn là ảnh chụp lúc vừa tạo đơn (luôn UNPAID) — phải hỏi
    // trạng thái thật từ server mỗi lần thẻ hiển thị, KỂ CẢ khi QR đã hết hạn: khách có
    // thể đã chuyển khoản xong rồi mới quay lại xem lịch sử chat. Chỉ poll liên tục khi QR
    // còn hạn và chưa thanh toán; hết hạn thì hỏi 1 lần là đủ.
    const { data: syncResult, isLoading: isCheckingPayment } = useSyncPayOSStatusQuery(
        booking?.bookingId,
        { skip: !isPayos || !booking?.bookingId, refetchOnMountOrArgChange: true },
    );
    const isPaid = syncResult?.paymentStatus === 'PAID';
    useSyncPayOSStatusQuery(booking?.bookingId, {
        skip: !isPayos || !booking?.qrCode || isPaid || isExpired,
        pollingInterval: PAYOS_POLL_INTERVAL_MS,
    });

    if (!booking) return null;

    const bookingCode = getBookingCode(booking.bookingId);
    const showTicket = !isPayos || isPaid;
    // Đơn chuyển khoản chưa thanh toán thì KHÔNG được gọi là "thành công" — booking phía
    // server vẫn ở trạng thái PENDING/UNPAID, nói "thành công" ngay dễ khiến khách tưởng
    // xong việc rồi bỏ qua bước chuyển khoản. Chỉ đổi sang trạng thái thành công thật sự
    // (icon xanh) khi đã thanh toán hoặc là đơn tiền mặt (vốn không cần chờ gì thêm).
    const awaitingPayment = isPayos && !isPaid;

    const handleSaveTicketQr = () => {
        downloadQrPng(ticketQrRef.current?.querySelector('svg'), `vika-qr-${bookingCode}.png`);
    };
    const handleSavePaymentQr = () => {
        downloadQrPng(paymentQrRef.current?.querySelector('svg'), `vika-payos-${bookingCode}.png`);
    };

    return (
        <div
            className={`w-full rounded-xl border-2 p-4 space-y-3 ${
                awaitingPayment ? 'border-amber-200 bg-amber-50' : 'border-green-200 bg-green-50'
            }`}
        >
            <div className="flex items-start gap-3">
                {awaitingPayment ? (
                    <Clock className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
                ) : (
                    <CheckCircle2 className="w-6 h-6 text-green-600 shrink-0 mt-0.5" />
                )}
                <div className="text-sm text-gray-700">
                    <p className={`font-bold ${awaitingPayment ? 'text-amber-700' : 'text-green-700'}`}>
                        {awaitingPayment ? 'Đã ghi nhận đặt phòng — chờ thanh toán' : 'Đặt phòng thành công!'}
                    </p>
                    <p className="text-gray-500 text-xs mt-0.5">Mã đặt phòng: {bookingCode}</p>
                    <p className={`font-bold mt-1 ${awaitingPayment ? 'text-amber-700' : 'text-green-700'}`}>
                        Tổng tiền: {formatVnd(booking.totalAmount)}
                    </p>
                </div>
            </div>

            {isPayos && !isPaid && (
                <>
                    {isExpired && isCheckingPayment ? (
                        <p className="text-xs text-gray-500 flex items-center gap-1.5 px-1">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Đang kiểm tra trạng thái thanh toán...
                        </p>
                    ) : isExpired ? (
                        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                            Mã QR thanh toán đã hết hạn, quý khách vui lòng vào mục "Đơn đặt phòng của tôi" để tạo lại link thanh toán.
                        </p>
                    ) : booking.qrCode ? (
                        <div className="rounded-lg border border-amber-200 bg-white p-3 flex flex-col items-center gap-2">
                            <p className="text-xs font-semibold text-amber-700 flex items-center gap-1">
                                <QrCode className="w-3.5 h-3.5" /> Quét mã để thanh toán chuyển khoản
                            </p>
                            <div ref={paymentQrRef} className="rounded-lg border border-gray-100 bg-white p-2">
                                <QRCodeSVG value={booking.qrCode} size={160} level="M" />
                            </div>
                            <div className="flex gap-2 w-full pt-1">
                                <button
                                    type="button"
                                    onClick={handleSavePaymentQr}
                                    className="flex-1 flex items-center justify-center gap-1.5 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 text-xs font-semibold rounded-full py-2 transition-colors"
                                >
                                    <Download className="w-3.5 h-3.5" /> Lưu mã QR
                                </button>
                                {booking.checkoutUrl && (
                                    <a
                                        href={booking.checkoutUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="flex-1 text-center bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-full py-2 transition-colors"
                                    >
                                        Mở trang thanh toán
                                    </a>
                                )}
                            </div>
                            <p className="text-[11px] text-gray-400 flex items-center gap-1 pt-0.5">
                                <Loader2 className="w-3 h-3 animate-spin" /> Đang chờ xác nhận thanh toán, vé đặt phòng sẽ hiện ra ngay khi nhận được tiền...
                            </p>
                        </div>
                    ) : (
                        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                            Không tạo được mã QR thanh toán lúc này, quý khách vui lòng vào mục "Đơn đặt phòng của tôi" để lấy lại mã hoặc liên hệ lễ tân.
                        </p>
                    )}
                </>
            )}

            {showTicket && (
                <div className="rounded-lg border border-green-200 bg-white p-3 flex flex-col items-center gap-2">
                    {isPayos && (
                        <p className="text-xs font-semibold text-green-700 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Đã nhận được thanh toán chuyển khoản
                        </p>
                    )}
                    <p className="text-xs font-semibold text-gray-600">Vé đặt phòng — xuất trình khi nhận phòng</p>
                    <div ref={ticketQrRef} className="rounded-lg border border-gray-100 bg-white p-2">
                        <QRCodeSVG value={getBookingQrPayload(booking)} size={160} level="M" />
                    </div>
                    <button
                        type="button"
                        onClick={handleSaveTicketQr}
                        className="flex items-center justify-center gap-1.5 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 text-xs font-semibold rounded-full px-4 py-2 transition-colors"
                    >
                        <Download className="w-3.5 h-3.5" /> Lưu vé QR
                    </button>
                </div>
            )}

            {!isPayos && (
                <p className="text-xs text-gray-600 flex items-center gap-1.5">
                    <Banknote className="w-3.5 h-3.5 text-green-600" /> Quý khách vui lòng thanh toán tiền mặt tại quầy lễ tân khi nhận phòng.
                </p>
            )}
        </div>
    );
};

const inputClass =
    'w-full bg-white border border-gray-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all';

// Biểu mẫu cho khách điền trực tiếp thông tin đặt phòng thay vì phải trả lời từng câu
// hỏi bằng chữ — hiển thị khi model gọi tool request_booking_form. Nộp form sẽ gộp
// thành 1 tin nhắn văn bản gửi đi, agent xử lý tiếp bằng propose_booking như bình thường.
//
// Họ tên/SĐT/email tự điền sẵn từ hồ sơ tài khoản đang đăng nhập (`user`) — đúng nghiệp
// vụ đa số khách đặt cho chính mình — nhưng vẫn là input thường, khách sửa lại thoải mái
// nếu đặt hộ người khác.
export const BookingInfoForm = ({ request, user, onSubmit, onCancel }) => {
    const [checkIn, setCheckIn] = useState(request?.checkIn ?? '');
    const [checkOut, setCheckOut] = useState(request?.checkOut ?? '');
    const [guests, setGuests] = useState(request?.guests ?? 2);
    const [fullName, setFullName] = useState(user?.fullName ?? '');
    const [phone, setPhone] = useState(user?.phone ?? '');
    const [email, setEmail] = useState(user?.email ?? '');
    const [paymentMethod, setPaymentMethod] = useState(null);

    const canSubmit =
        checkIn && checkOut && guests > 0 && fullName.trim() && phone.trim() && paymentMethod;

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!canSubmit) return;
        onSubmit({
            checkIn,
            checkOut,
            guests,
            fullName: fullName.trim(),
            phone: phone.trim(),
            email: email.trim(),
            paymentMethod,
        });
    };

    return (
        <form
            onSubmit={handleSubmit}
            className="w-full rounded-xl border-2 border-blue-200 bg-blue-50/70 p-4 space-y-3"
        >
            <p className="font-bold text-blue-700 text-sm">
                Thông tin đặt phòng
                {request?.roomTypeName ? ` — ${request.roomTypeName}` : ''}
            </p>

            <div className="grid grid-cols-2 gap-2">
                <div className="relative">
                    <CalendarDays className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                        type="date"
                        value={checkIn}
                        onChange={(e) => setCheckIn(e.target.value)}
                        className={inputClass}
                        required
                    />
                </div>
                <div className="relative">
                    <CalendarDays className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                        type="date"
                        value={checkOut}
                        onChange={(e) => setCheckOut(e.target.value)}
                        className={inputClass}
                        required
                    />
                </div>
            </div>

            <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-gray-400 shrink-0" />
                <span className="text-xs text-gray-500 shrink-0">Số khách</span>
                <div className="flex items-center gap-2 ml-auto">
                    <button
                        type="button"
                        onClick={() => setGuests((g) => Math.max(1, g - 1))}
                        className="w-7 h-7 rounded-full bg-white border border-gray-300 text-gray-600 hover:bg-gray-50"
                    >
                        −
                    </button>
                    <span className="w-5 text-center text-sm font-semibold">{guests}</span>
                    <button
                        type="button"
                        onClick={() => setGuests((g) => Math.min(20, g + 1))}
                        className="w-7 h-7 rounded-full bg-white border border-gray-300 text-gray-600 hover:bg-gray-50"
                    >
                        +
                    </button>
                </div>
            </div>

            <div className="relative">
                <User className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Họ và tên"
                    className={inputClass}
                    required
                />
            </div>
            <div className="relative">
                <Phone className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Số điện thoại"
                    className={inputClass}
                    required
                />
            </div>
            <div className="relative">
                <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email (không bắt buộc)"
                    className={inputClass}
                />
            </div>

            <div className="space-y-1.5">
                <span className="text-xs text-gray-500">Phương thức thanh toán</span>
                <div className="grid grid-cols-2 gap-2">
                    <button
                        type="button"
                        onClick={() => setPaymentMethod('CASH')}
                        className={`flex items-center justify-center gap-1.5 rounded-lg border py-2 text-xs font-semibold transition-colors ${
                            paymentMethod === 'CASH'
                                ? 'border-blue-500 bg-blue-600 text-white'
                                : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50'
                        }`}
                    >
                        <Banknote className="w-3.5 h-3.5" /> Tiền mặt tại quầy
                    </button>
                    <button
                        type="button"
                        onClick={() => setPaymentMethod('PAYOS')}
                        className={`flex items-center justify-center gap-1.5 rounded-lg border py-2 text-xs font-semibold transition-colors ${
                            paymentMethod === 'PAYOS'
                                ? 'border-blue-500 bg-blue-600 text-white'
                                : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50'
                        }`}
                    >
                        <QrCode className="w-3.5 h-3.5" /> Chuyển khoản (QR)
                    </button>
                </div>
            </div>

            <div className="flex gap-2 pt-1">
                <button
                    type="submit"
                    disabled={!canSubmit}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-full py-2 transition-colors"
                >
                    Xác nhận thông tin
                </button>
                <button
                    type="button"
                    onClick={onCancel}
                    className="flex-1 bg-white border border-gray-300 text-gray-600 hover:bg-gray-50 text-sm font-semibold rounded-full py-2 transition-colors"
                >
                    Huỷ
                </button>
            </div>
        </form>
    );
};
