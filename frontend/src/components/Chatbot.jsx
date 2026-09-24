import React, { useEffect, useRef, useState } from 'react';
import { Headset, X, Send, Loader2, LogIn } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import {
    useGetOrCreateConversationMutation,
    useGetMessagesQuery,
} from '../services/chat';
import useDraggableWidget from '../hooks/useDraggableWidget';
import useExclusiveChatPanel from '../hooks/useExclusiveChatPanel';

// Chat thật 2 chiều với lễ tân (trước đây là bot giả echo lại tin nhắn). Chỉ
// khách đã đăng nhập mới chat được — khách vãng lai được mời đăng nhập trước.
const Chatbot = () => {
    const { isAuthenticated, user } = useAuth();
    const navigate = useNavigate();
    const socket = useSocket();

    const [isOpen, setIsOpen] = useExclusiveChatPanel('reception');
    const [conversationId, setConversationId] = useState(null);
    const [messages, setMessages] = useState([]);
    const [inputStr, setInputStr] = useState('');
    const messagesEndRef = useRef(null);

    const [getOrCreateConversation, { isLoading: isStarting }] =
        useGetOrCreateConversationMutation();
    const { data: history } = useGetMessagesQuery(conversationId, {
        skip: !conversationId,
    });

    const { buttonStyle, panelStyle, dragHandlers } = useDraggableWidget({
        initialBottom: 24,
        initialRight: 24,
    });

    // Lễ tân/admin trả lời khách ở /admin/chat riêng — widget nổi này chỉ dành cho
    // khách hàng, không hiện khi đang đăng nhập bằng tài khoản nhân sự.
    const isStaffAccount = user?.role === 'STAFF' || user?.role === 'ADMIN';

    // Mở khung chat lần đầu (đã đăng nhập) -> lấy/tạo hội thoại của khách rồi join
    // room socket tương ứng để nhận tin nhắn real-time.
    useEffect(() => {
        if (!isOpen || !isAuthenticated || conversationId) return;
        getOrCreateConversation()
            .unwrap()
            .then((conversation) => setConversationId(conversation.conversationId))
            .catch(() => {});
    }, [isOpen, isAuthenticated, conversationId, getOrCreateConversation]);

    useEffect(() => {
        if (history) setMessages(history);
    }, [history]);

    useEffect(() => {
        if (!conversationId) return;
        socket.emit('chat:join', { conversationId });

        const handleIncoming = (message) => {
            if (message.conversationId !== conversationId) return;
            setMessages((prev) => [...prev, message]);
        };
        socket.on('chat:message', handleIncoming);
        return () => socket.off('chat:message', handleIncoming);
    }, [conversationId, socket]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = (e) => {
        e.preventDefault();
        const content = inputStr.trim();
        if (!content || !conversationId) return;
        socket.emit('chat:message', { conversationId, content });
        setInputStr('');
    };

    if (isStaffAccount) return null;

    return (
        <>
            {isOpen && (
                <div
                    style={panelStyle}
                    className="fixed z-50 bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-gray-100"
                >
                    <div className="bg-[#1b6b50] p-4 flex items-center justify-between text-white shadow-md z-10">
                        <div className="flex items-center gap-3">
                            <div className="bg-white p-1.5 rounded-full">
                                <Headset className="w-6 h-6 text-[#1b6b50]" />
                            </div>
                            <div>
                                <h3 className="font-bold text-lg">Hỗ trợ Vika Hotel</h3>
                                <p className="text-xs text-green-100 flex items-center gap-1">
                                    <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                                    Lễ tân trực tuyến
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
                            <p className="text-gray-600">Đăng nhập để chat trực tiếp với lễ tân Vika Hotel.</p>
                            <button
                                onClick={() => {
                                    setIsOpen(false);
                                    navigate('/login');
                                }}
                                className="inline-flex items-center gap-2 rounded-full bg-[#1b6b50] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#14523d] transition-colors"
                            >
                                <LogIn className="w-4 h-4" /> Đăng nhập
                            </button>
                        </div>
                    ) : (
                        <>
                            <div className="flex-1 min-h-0 overflow-y-auto p-4 bg-white/95 flex flex-col gap-4">
                                {isStarting && !conversationId && (
                                    <div className="flex items-center justify-center py-8 text-gray-400">
                                        <Loader2 className="w-6 h-6 animate-spin" />
                                    </div>
                                )}
                                {messages.map((msg) => {
                                    const isMine = msg.senderId === user?.userId;
                                    return (
                                        <div
                                            key={msg.messageId}
                                            className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
                                        >
                                            <div
                                                className={`max-w-[80%] rounded-2xl px-4 py-2.5 shadow-sm
                                                ${isMine
                                                        ? 'bg-[#1b6b50] text-white rounded-tr-sm'
                                                        : 'bg-gray-100 text-gray-800 rounded-tl-sm border border-gray-200'
                                                    }`}
                                            >
                                                {!isMine && (
                                                    <p className="text-[11px] font-bold text-[#1b6b50] mb-0.5">
                                                        Nhân viên hỗ trợ
                                                    </p>
                                                )}
                                                <p className="text-[15px] leading-relaxed whitespace-pre-wrap">
                                                    {msg.content}
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })}
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
                                    className="flex-1 bg-gray-50 border border-gray-200 rounded-full px-5 py-3 text-[15px] focus:outline-none focus:ring-2 focus:ring-[#1b6b50] focus:border-transparent transition-all"
                                    disabled={!conversationId}
                                />
                                <button
                                    type="submit"
                                    disabled={!inputStr.trim() || !conversationId}
                                    className="p-3 bg-[#1b6b50] text-white rounded-full hover:bg-[#14523d] disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-md"
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
                title="Chat với lễ tân"
                aria-label="Chat với lễ tân"
                className={`fixed p-4 bg-[#1b6b50] text-white rounded-full shadow-2xl hover:bg-[#14523d] transition-shadow duration-200 z-50 cursor-grab active:cursor-grabbing select-none touch-none ${isOpen ? 'ring-4 ring-green-300' : ''}`}
            >
                <Headset className="w-8 h-8" />
            </button>
        </>
    );
};

export default Chatbot;
