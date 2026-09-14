import React, { useEffect, useRef, useState } from 'react';
import { Bot, X, Send, Loader2, LogIn, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSendAiMessageMutation } from '../services/aiAgent';
import useDraggableWidget from '../hooks/useDraggableWidget';
import {
    FormattedMessage,
    RoomCardList,
    PromotionList,
    PendingBookingCard,
    BookingConfirmedCard,
    BookingInfoForm,
} from './AiChatWidgets';

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

    const { buttonStyle, panelStyle, dragHandlers } = useDraggableWidget({
        initialBottom: 112,
        initialRight: 24,
        panelWidth: 420,
    });

    const isStaffAccount = user?.role === 'STAFF' || user?.role === 'ADMIN';

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isSending]);

    const sendText = async (content) => {
        if (!content || isSending) return;

        setMessages((prev) => [...prev, { role: 'USER', content }]);

        try {
            const result = await sendAiMessage({ conversationId, message: content }).unwrap();
            setConversationId(result.conversationId);
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
        } catch {
            setMessages((prev) => [
                ...prev,
                {
                    role: 'MODEL',
                    content: 'Xin lỗi, trợ lý ảo đang gặp sự cố, quý khách vui lòng thử lại sau.',
                },
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

    const handleConfirmBooking = () => {
        sendText('Tôi đồng ý đặt phòng theo thông tin trên.');
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
        setDismissedFormAt(msgIdx);
        sendText(parts.join(', ') + '.');
    };

    if (isStaffAccount) return null;

    return (
        <>
            {isOpen && (
                <div
                    style={panelStyle}
                    className="fixed z-50 bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-gray-100"
                >
                    <div className="bg-indigo-600 p-4 flex items-center justify-between text-white shadow-md z-10">
                        <div className="flex items-center gap-3">
                            <div className="bg-white p-1.5 rounded-full">
                                <Bot className="w-6 h-6 text-indigo-600" />
                            </div>
                            <div>
                                <h3 className="font-bold text-lg">Trợ lý ảo Vika Hotel</h3>
                                <p className="text-xs text-indigo-100 flex items-center gap-1">
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
                                className="inline-flex items-center gap-2 rounded-full bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-indigo-700 transition-colors"
                            >
                                <LogIn className="w-4 h-4" /> Đăng nhập
                            </button>
                        </div>
                    ) : (
                        <>
                            <div className="flex-1 min-h-0 overflow-y-auto p-4 bg-white/95 flex flex-col gap-4">
                                {messages.length === 0 && (
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
                                            className={`flex flex-col gap-2 ${isMine ? 'items-end' : 'items-start'}`}
                                        >
                                            <div
                                                className={`max-w-[85%] rounded-2xl px-4 py-2.5 shadow-sm
                                                ${isMine
                                                        ? 'bg-indigo-600 text-white rounded-tr-sm'
                                                        : 'bg-gray-100 text-gray-800 rounded-tl-sm border border-gray-200'
                                                    }`}
                                            >
                                                {!isMine && (
                                                    <p className="text-[11px] font-bold text-indigo-600 mb-0.5">
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
                                                    onConfirm={handleConfirmBooking}
                                                    onCancel={handleCancelBooking}
                                                />
                                            )}
                                            {!isMine && msg.booking && (
                                                <BookingConfirmedCard booking={msg.booking} />
                                            )}
                                            {!isMine && isLatest && msg.bookingFormRequest && dismissedFormAt !== idx && (
                                                <BookingInfoForm
                                                    request={msg.bookingFormRequest}
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
                                        <div className="rounded-2xl rounded-tl-sm px-4 py-2.5 bg-gray-100 border border-gray-200">
                                            <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
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
                                    className="flex-1 bg-gray-50 border border-gray-200 rounded-full px-5 py-3 text-[15px] focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                                    disabled={isSending}
                                />
                                <button
                                    type="submit"
                                    disabled={!inputStr.trim() || isSending}
                                    className="p-3 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-md"
                                >
                                    <Send className="w-5 h-5 ml-0.5" />
                                </button>
                            </form>
                        </>
                    )}
                </div>
            )}

            <button
                onPointerDown={dragHandlers.onPointerDown}
                onPointerMove={dragHandlers.onPointerMove}
                onPointerUp={(e) => dragHandlers.onPointerUp(e, () => setIsOpen((prev) => !prev))}
                style={buttonStyle}
                className={`fixed p-4 bg-indigo-600 text-white rounded-full shadow-2xl hover:bg-indigo-700 transition-shadow duration-200 z-50 cursor-grab active:cursor-grabbing select-none touch-none ${isOpen ? 'ring-4 ring-indigo-300' : ''}`}
            >
                <Bot className="w-8 h-8" />
            </button>
        </>
    );
};

export default AiChatbot;
