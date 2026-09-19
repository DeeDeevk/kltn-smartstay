import React, { useEffect, useRef, useState } from 'react';
import { BotMessageSquare, X, Send, LogIn, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLazyGetAiHistoryQuery, useSendAiMessageMutation } from '../services/aiAgent';
import useDraggableWidget from '../hooks/useDraggableWidget';
import {
    buildMessagesFromHistory,
    clearStoredConversationId,
    readStoredConversationId,
    storeConversationId,
} from './aiChatHistory';
import {
    FormattedMessage,
    RoomCardList,
    PromotionList,
    PendingBookingCard,
    BookingConfirmedCard,
    BookingInfoForm,
} from './AiChatWidgets';

// Backend trả 429 ở 2 trường hợp: hết hạn mức trong ngày (kèm code + câu thông báo sẵn
// tiếng Việt) hoặc gửi quá nhanh (do @Throttle, không có thông báo dùng được cho khách).
const AI_DAILY_QUOTA_EXCEEDED = 'AI_DAILY_QUOTA_EXCEEDED';

function getSendErrorMessage(error) {
    if (error?.status === 429) {
        return error.data?.code === AI_DAILY_QUOTA_EXCEEDED
            ? error.data.message
            : 'Quý khách gửi tin nhắn quá nhanh, vui lòng chờ vài giây rồi thử lại.';
    }
    return 'Xin lỗi, trợ lý ảo đang gặp sự cố, quý khách vui lòng thử lại sau.';
}

// Trợ lý ảo AI (khác widget Chatbot.jsx là chat thật với lễ tân) — REST thuần,
// mỗi lượt gửi tin nhắn nhận ngay câu trả lời trong response, không qua socket.
const AiChatbot = () => {
    const { isAuthenticated, user } = useAuth();
    const navigate = useNavigate();

    const [isOpen, setIsOpen] = useState(false);
    const [conversationId, setConversationId] = useState(null);
    const [messages, setMessages] = useState([]);
    const [inputStr, setInputStr] = useState('');
    const [dismissedFormAt, setDismissedFormAt] = useState(-1);
    const messagesEndRef = useRef(null);

    const [sendAiMessage, { isLoading: isSending }] = useSendAiMessageMutation();
    const [loadHistory, { isFetching: isLoadingHistory }] = useLazyGetAiHistoryQuery();

    // Chỉ theo dõi userId (không phải cả object user) — object user đổi mỗi lần cập
    // nhật hồ sơ, nhưng như vậy vẫn là cùng một người, không được xoá khung chat.
    const userId = user?.userId ?? null;
    // Luôn trỏ tới user hiện tại, để các request trả về muộn (sau khi đã đổi tài
    // khoản) biết mình đã lỗi thời và bỏ qua, không ghi đè khung chat của user mới.
    const currentUserIdRef = useRef(userId);
    currentUserIdRef.current = userId;
    // User đã được nạp lịch sử (dùng ref thay vì state để việc đánh dấu không kích
    // hoạt lại effect nạp lịch sử).
    const historyLoadedForRef = useRef(null);

    const { buttonStyle, panelStyle, dragHandlers } = useDraggableWidget({
        initialBottom: 112,
        initialRight: 24,
        panelWidth: 420,
    });

    const isStaffAccount = user?.role === 'STAFF' || user?.role === 'ADMIN';

    // Widget được gắn 1 lần ở gốc app nên không tự unmount khi đăng xuất/đổi tài khoản
    // — phải chủ động xoá sạch khung chat, nếu không user mới sẽ thấy tin nhắn (tên,
    // SĐT, thông tin đặt phòng) của user trước và gửi kèm conversationId không phải
    // của mình (backend trả 403).
    useEffect(() => {
        setMessages([]);
        setConversationId(null);
        setDismissedFormAt(-1);
        setInputStr('');
        historyLoadedForRef.current = null;
    }, [userId]);

    // Nạp lại cuộc hội thoại gần nhất của user khi mở widget lần đầu (VD sau F5).
    useEffect(() => {
        if (!isOpen || !userId || historyLoadedForRef.current === userId) return;
        historyLoadedForRef.current = userId;

        const storedId = readStoredConversationId(userId);
        if (!storedId) return;

        loadHistory(storedId)
            .unwrap()
            .then((history) => {
                if (currentUserIdRef.current !== userId) return;
                setConversationId(storedId);
                setMessages(buildMessagesFromHistory(history));
            })
            .catch(() => {
                // Hội thoại không còn tồn tại/không thuộc user này -> bắt đầu hội thoại mới.
                clearStoredConversationId(userId);
            });
    }, [isOpen, userId, loadHistory]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isSending]);

    const sendText = async (content, extra = {}) => {
        if (!content || isSending || isLoadingHistory) return;
        const sentForUserId = userId;

        setMessages((prev) => [...prev, { role: 'USER', content }]);

        try {
            const result = await sendAiMessage({ conversationId, message: content, ...extra }).unwrap();
            if (currentUserIdRef.current !== sentForUserId) return;
            setConversationId(result.conversationId);
            if (sentForUserId) storeConversationId(sentForUserId, result.conversationId);
            setMessages((prev) => [
                ...prev,
                {
                    role: 'MODEL',
                    content: result.reply,
                    rooms: result.rooms,
                    promotions: result.promotions,
                    pendingBooking: result.pendingBooking,
                    booking: result.booking,
                    bookingFormRequest: result.bookingFormRequest,
                },
            ]);
        } catch (error) {
            if (currentUserIdRef.current !== sentForUserId) return;
            // conversationId đang giữ không còn hợp lệ (bị xoá / không thuộc user này) ->
            // bỏ đi để lần gửi tiếp theo backend tạo hội thoại mới.
            if (error?.status === 403 || error?.status === 404) {
                setConversationId(null);
                if (sentForUserId) clearStoredConversationId(sentForUserId);
            }
            setMessages((prev) => [
                ...prev,
                { role: 'MODEL', content: getSendErrorMessage(error) },
            ]);
        }
    };

    const handleSend = (e) => {
        e.preventDefault();
        const content = inputStr.trim();
        if (!content) return;
        setInputStr('');
        sendText(content);
    };

    const handleSelectRoom = (room) => {
        sendText(`Tôi muốn đặt phòng ${room.name}`);
    };

    // Gửi kèm proposalId của đúng thẻ khách bấm — backend dùng mã này để tạo booking
    // thay vì phải đoán ý khách qua câu chữ, và từ chối nếu đề xuất đã bị thay thế.
    const handleConfirmBooking = (pendingBooking) => {
        sendText(
            'Tôi đồng ý đặt phòng theo thông tin trên.',
            pendingBooking?.proposalId ? { confirmProposalId: pendingBooking.proposalId } : {},
        );
    };

    const handleCancelBooking = () => {
        sendText('Tôi không đồng ý, vui lòng huỷ đề xuất này.');
    };

    const handleSubmitBookingForm = (formData, request, msgIdx) => {
        const roomPart = request?.roomTypeName ? `phòng ${request.roomTypeName}` : 'phòng đã chọn';
        const parts = [
            `Tôi muốn đặt ${roomPart}`,
            `nhận phòng ngày ${formData.checkIn}`,
            `trả phòng ngày ${formData.checkOut}`,
            `${formData.guests} khách`,
            `họ tên ${formData.fullName}`,
            `số điện thoại ${formData.phone}`,
        ];
        if (formData.email) parts.push(`email ${formData.email}`);
        parts.push(
            `thanh toán bằng ${formData.paymentMethod === 'PAYOS' ? 'chuyển khoản' : 'tiền mặt'}`,
        );
        setDismissedFormAt(msgIdx);
        sendText(parts.join(', ') + '.');
    };

    if (isStaffAccount) return null;

    return (
        <>
            {isOpen && (
                <div
                    style={panelStyle}
                    className="anim-pop-in origin-bottom-right fixed z-50 bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-gray-100"
                >
                    <div className="bg-gradient-to-r from-blue-600 via-violet-600 to-blue-600 p-4 flex items-center justify-between text-white shadow-md z-10">
                        <div className="flex items-center gap-3">
                            <div className="bg-white p-1.5 rounded-full">
                                <BotMessageSquare className="w-6 h-6 text-blue-600" />
                            </div>
                            <div>
                                <h3 className="font-bold text-lg">Trợ lý ảo Vika Hotel</h3>
                                <p className="text-xs text-blue-100 flex items-center gap-1">
                                    <Sparkles className="w-3 h-3" />
                                    Hỏi về phòng, đặt phòng, chính sách...
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => setIsOpen(false)}
                            className="p-2 hover:bg-white/20 rounded-full transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {!isAuthenticated ? (
                        <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center">
                            <p className="text-gray-600">Đăng nhập để trò chuyện với trợ lý ảo Vika Hotel.</p>
                            <button
                                onClick={() => {
                                    setIsOpen(false);
                                    navigate('/login');
                                }}
                                className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-700 transition-colors"
                            >
                                <LogIn className="w-4 h-4" /> Đăng nhập
                            </button>
                        </div>
                    ) : (
                        <>
                            <div className="flex-1 min-h-0 overflow-y-auto p-4 bg-white/95 flex flex-col gap-4">
                                {isLoadingHistory && messages.length === 0 && (
                                    <p role="status" className="text-center text-sm text-gray-400">
                                        Đang tải lịch sử trò chuyện...
                                    </p>
                                )}
                                {!isLoadingHistory && messages.length === 0 && (
                                    <div className="flex justify-start">
                                        <div className="max-w-[80%] rounded-2xl rounded-tl-sm px-4 py-2.5 shadow-sm bg-gray-100 text-gray-800 border border-gray-200">
                                            <p className="text-[15px] leading-relaxed">
                                                Xin chào! Tôi là trợ lý ảo Vika Hotel, tôi có thể giúp quý khách tìm phòng,
                                                tra cứu khuyến mãi và giải đáp chính sách đặt phòng.
                                            </p>
                                        </div>
                                    </div>
                                )}
                                {messages.map((msg, idx) => {
                                    const isMine = msg.role === 'USER';
                                    const isLatest = idx === messages.length - 1;
                                    return (
                                        <div
                                            key={idx}
                                            className={`anim-fade-up flex flex-col gap-2 ${isMine ? 'items-end' : 'items-start'}`}
                                        >
                                            <div
                                                className={`max-w-[85%] rounded-2xl px-4 py-2.5 shadow-sm
                                                ${isMine
                                                        ? 'bg-blue-600 text-white rounded-tr-sm'
                                                        : 'bg-gray-100 text-gray-800 rounded-tl-sm border border-gray-200'
                                                    }`}
                                            >
                                                {!isMine && (
                                                    <p className="text-[11px] font-bold text-blue-600 mb-0.5">
                                                        Trợ lý ảo
                                                    </p>
                                                )}
                                                {isMine ? (
                                                    <p className="text-[15px] leading-relaxed whitespace-pre-wrap">
                                                        {msg.content}
                                                    </p>
                                                ) : (
                                                    <div className="text-[15px]">
                                                        <FormattedMessage text={msg.content} />
                                                    </div>
                                                )}
                                            </div>

                                            {!isMine && msg.rooms && msg.rooms.length > 0 && (
                                                <RoomCardList rooms={msg.rooms} onSelect={handleSelectRoom} />
                                            )}
                                            {!isMine && msg.promotions && msg.promotions.length > 0 && (
                                                <PromotionList promotions={msg.promotions} />
                                            )}
                                            {!isMine && isLatest && msg.pendingBooking && (
                                                <PendingBookingCard
                                                    pendingBooking={msg.pendingBooking}
                                                    onConfirm={() => handleConfirmBooking(msg.pendingBooking)}
                                                    onCancel={handleCancelBooking}
                                                    disabled={isSending}
                                                />
                                            )}
                                            {!isMine && msg.booking && (
                                                <BookingConfirmedCard booking={msg.booking} />
                                            )}
                                            {!isMine && isLatest && msg.bookingFormRequest && dismissedFormAt !== idx && (
                                                <BookingInfoForm
                                                    request={msg.bookingFormRequest}
                                                    user={user}
                                                    onSubmit={(formData) =>
                                                        handleSubmitBookingForm(formData, msg.bookingFormRequest, idx)
                                                    }
                                                    onCancel={() => setDismissedFormAt(idx)}
                                                />
                                            )}
                                        </div>
                                    );
                                })}
                                {isSending && (
                                    <div className="flex justify-start">
                                        <div
                                            role="status"
                                            aria-label="Trợ lý ảo đang soạn tin nhắn"
                                            className="rounded-2xl rounded-tl-sm px-4 py-3 bg-gray-100 border border-gray-200"
                                        >
                                            <div className="flex items-center gap-1" aria-hidden="true">
                                                {[-0.3, -0.15, 0].map((delay) => (
                                                    <span
                                                        key={delay}
                                                        className="w-2 h-2 rounded-full bg-blue-500 animate-bounce"
                                                        style={{
                                                            animationDelay: `${delay}s`,
                                                            animationDuration: '0.9s',
                                                        }}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}
                                <div ref={messagesEndRef} />
                            </div>

                            <form
                                onSubmit={handleSend}
                                className="p-3 bg-white border-t border-gray-100 flex items-center gap-2"
                            >
                                <input
                                    type="text"
                                    value={inputStr}
                                    onChange={(e) => setInputStr(e.target.value)}
                                    placeholder="Nhập tin nhắn..."
                                    className="flex-1 bg-gray-50 border border-gray-200 rounded-full px-5 py-3 text-[15px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                    disabled={isSending || isLoadingHistory}
                                />
                                <button
                                    type="submit"
                                    disabled={!inputStr.trim() || isSending || isLoadingHistory}
                                    className="press p-3 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-md"
                                >
                                    <Send className="w-5 h-5 ml-0.5" />
                                </button>
                            </form>
                        </>
                    )}
                </div>
            )}

            {/* w-16 h-16 (64px) phải khớp đúng BUTTON_SIZE trong useDraggableWidget.js —
                hook đó tính vị trí kéo-thả và vị trí bảng chat dựa trên hằng số 64px này,
                đổi kích thước nút ở đây mà không đổi theo sẽ làm lệch bảng chat. */}
            <button
                onPointerDown={dragHandlers.onPointerDown}
                onPointerMove={dragHandlers.onPointerMove}
                onPointerUp={(e) => dragHandlers.onPointerUp(e, () => setIsOpen((prev) => !prev))}
                style={buttonStyle}
                className={`fixed w-16 h-16 flex items-center justify-center rounded-full z-50 cursor-grab active:cursor-grabbing select-none touch-none bg-gradient-to-br from-blue-500 via-violet-500 to-blue-600 text-white shadow-2xl shadow-blue-500/40 hover:shadow-blue-500/60 hover:scale-105 active:scale-95 transition-[transform,box-shadow] duration-200 ${isOpen ? 'ring-4 ring-blue-200' : ''}`}
            >
                {!isOpen && (
                    <span className="absolute inset-0 rounded-full bg-blue-400 opacity-60 animate-ping" />
                )}
                <BotMessageSquare className="w-7 h-7 relative" />
                <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center w-5 h-5 rounded-full bg-amber-400 text-blue-900 ring-2 ring-white">
                    <Sparkles className="w-3 h-3" />
                </span>
            </button>
        </>
    );
};

export default AiChatbot;
