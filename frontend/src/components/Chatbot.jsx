import React, { useEffect, useRef, useState } from 'react';
import { Headset, X, Send, Loader2, LogIn, Paperclip } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import {
    useGetOrCreateConversationMutation,
    useGetMessagesQuery,
    useUploadChatAttachmentMutation,
} from '../services/chat';
import useDraggableWidget from '../hooks/useDraggableWidget';
import useExclusiveChatPanel from '../hooks/useExclusiveChatPanel';
import ImageLightbox from './common/ImageLightbox';
import { REQUEST_OPEN_EVENT, RECEPTION_WIDGET_ID } from '../utils/openReceptionChat';

// Khớp đúng giới hạn backend (ChatController.uploadAttachment) — chặn sớm ở form, backend
// vẫn là nơi kiểm tra thật sự.
const MAX_ATTACHMENT_SIZE_MB = 5;
const ACCEPTED_ATTACHMENT_TYPES = 'image/jpeg,image/png,image/webp';

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
    const [pendingAttachment, setPendingAttachment] = useState(null); // { file, previewUrl } | null
    const [lightboxSrc, setLightboxSrc] = useState(null);
    const messagesEndRef = useRef(null);
    const fileInputRef = useRef(null);

    const [getOrCreateConversation, { isLoading: isStarting }] =
        useGetOrCreateConversationMutation();
    const { data: history } = useGetMessagesQuery(conversationId, {
        skip: !conversationId,
    });
    const [uploadAttachment, { isLoading: isUploading }] = useUploadChatAttachmentMutation();

    const { buttonStyle, panelStyle, dragHandlers } = useDraggableWidget({
        initialBottom: 24,
        initialRight: 24,
    });

    // Lễ tân/admin trả lời khách ở /admin/chat riêng — widget nổi này chỉ dành cho
    // khách hàng, không hiện khi đang đăng nhập bằng tài khoản nhân sự.
    const isStaffAccount = user?.role === 'STAFF' || user?.role === 'ADMIN';

    // Cho phép nơi khác trong app (VD trang "Lịch sử đặt phòng", nhắc khách gửi ảnh QR xác
    // minh hoàn tiền) tự mở khung chat này ra — xem utils/openReceptionChat.js.
    useEffect(() => {
        const handleRequestOpen = (e) => {
            if (e.detail === RECEPTION_WIDGET_ID) setIsOpen(true);
        };
        window.addEventListener(REQUEST_OPEN_EVENT, handleRequestOpen);
        return () => window.removeEventListener(REQUEST_OPEN_EVENT, handleRequestOpen);
    }, [setIsOpen]);

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

    // Dọn URL preview tạm (object URL) khi đổi ảnh khác hoặc unmount — không dọn thì rò
    // rỉ bộ nhớ vì trình duyệt giữ blob cho tới khi tự revoke.
    useEffect(() => {
        return () => {
            if (pendingAttachment?.previewUrl) {
                URL.revokeObjectURL(pendingAttachment.previewUrl);
            }
        };
    }, [pendingAttachment]);

    const handleSelectFile = (e) => {
        const file = e.target.files?.[0];
        e.target.value = ''; // cho chọn lại đúng file đó lần nữa nếu cần
        if (!file) return;
        if (!ACCEPTED_ATTACHMENT_TYPES.split(',').includes(file.type)) {
            toast.error('Chỉ nhận ảnh định dạng JPG, PNG hoặc WEBP.');
            return;
        }
        if (file.size > MAX_ATTACHMENT_SIZE_MB * 1024 * 1024) {
            toast.error(`Ảnh vượt quá dung lượng cho phép (tối đa ${MAX_ATTACHMENT_SIZE_MB}MB).`);
            return;
        }
        setPendingAttachment({ file, previewUrl: URL.createObjectURL(file) });
    };

    const handleRemoveAttachment = () => {
        setPendingAttachment(null);
    };

    const handleSend = async (e) => {
        e.preventDefault();
        const content = inputStr.trim();
        if ((!content && !pendingAttachment) || !conversationId || isUploading) return;

        let attachmentUrl;
        let attachmentType;
        if (pendingAttachment) {
            try {
                const result = await uploadAttachment(pendingAttachment.file).unwrap();
                attachmentUrl = result.url;
                attachmentType = result.type;
            } catch (err) {
                toast.error(err?.data?.message || 'Không gửi được ảnh, vui lòng thử lại.');
                return;
            }
        }

        socket.emit('chat:message', { conversationId, content, attachmentUrl, attachmentType });
        setInputStr('');
        setPendingAttachment(null);
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
                                                {msg.attachmentUrl && (
                                                    <img
                                                        src={msg.attachmentUrl}
                                                        alt="Ảnh đính kèm"
                                                        onClick={() => setLightboxSrc(msg.attachmentUrl)}
                                                        className={`max-h-48 max-w-full cursor-zoom-in rounded-xl object-cover ${msg.content ? 'mb-2' : ''}`}
                                                    />
                                                )}
                                                {msg.content && (
                                                    <p className="text-[15px] leading-relaxed whitespace-pre-wrap">
                                                        {msg.content}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                                <div ref={messagesEndRef} />
                            </div>

                            <div className="border-t border-gray-100 bg-white">
                                {pendingAttachment && (
                                    <div className="flex items-center gap-2 px-3 pt-3">
                                        <div className="relative">
                                            <img
                                                src={pendingAttachment.previewUrl}
                                                alt="Ảnh sắp gửi"
                                                className="h-14 w-14 rounded-lg object-cover"
                                            />
                                            <button
                                                type="button"
                                                onClick={handleRemoveAttachment}
                                                aria-label="Bỏ ảnh"
                                                className="absolute -right-1.5 -top-1.5 rounded-full bg-gray-800 p-0.5 text-white shadow"
                                            >
                                                <X size={12} />
                                            </button>
                                        </div>
                                        {isUploading && (
                                            <Loader2 size={16} className="animate-spin text-gray-400" />
                                        )}
                                    </div>
                                )}
                                <form onSubmit={handleSend} className="flex items-center gap-2 p-3">
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept={ACCEPTED_ATTACHMENT_TYPES}
                                        onChange={handleSelectFile}
                                        className="hidden"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        disabled={!conversationId || isUploading}
                                        aria-label="Đính kèm ảnh"
                                        className="shrink-0 rounded-full p-2.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-[#1b6b50] disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        <Paperclip className="h-5 w-5" />
                                    </button>
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
                                        disabled={(!inputStr.trim() && !pendingAttachment) || !conversationId || isUploading}
                                        className="p-3 bg-[#1b6b50] text-white rounded-full hover:bg-[#14523d] disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-md"
                                    >
                                        {isUploading ? (
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                        ) : (
                                            <Send className="w-5 h-5 ml-0.5" />
                                        )}
                                    </button>
                                </form>
                            </div>
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

            <ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />
        </>
    );
};

export default Chatbot;
