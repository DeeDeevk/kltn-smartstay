import { useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useSearchParams } from 'react-router-dom';
import { MessageCircle, Send, Paperclip, X, Loader2 } from 'lucide-react';
import { toast } from 'react-toastify';
import { useAuth } from '../../../context/AuthContext';
import { useSocket } from '../../../context/SocketContext';
import {
  chatApi,
  useGetConversationsQuery,
  useGetMessagesQuery,
  useUploadChatAttachmentMutation,
} from '../../../services/chat';
import ImageLightbox from '../../common/ImageLightbox';

// Khớp đúng giới hạn backend (ChatController.uploadAttachment).
const MAX_ATTACHMENT_SIZE_MB = 5;
const ACCEPTED_ATTACHMENT_TYPES = 'image/jpeg,image/png,image/webp';

// Danh sách hội thoại đang mở (trái) + khung chat (phải) để lễ tân/admin trả lời
// khách hàng real-time — đối xứng với widget Chatbot.jsx phía khách.
export default function StaffChatPage() {
  const { user } = useAuth();
  const socket = useSocket();
  const dispatch = useDispatch();
  const [searchParams, setSearchParams] = useSearchParams();

  const { data: conversations = [] } = useGetConversationsQuery();
  // Nút "Xem hội thoại" từ trang /admin/refund-requests điều hướng tới
  // /admin/chat?conversationId=... — mở sẵn đúng hội thoại đó thay vì để lễ tân tự tìm
  // trong danh sách bên trái.
  const [selectedId, setSelectedId] = useState(() => searchParams.get('conversationId'));
  const [messages, setMessages] = useState([]);
  const [inputStr, setInputStr] = useState('');
  const [pendingAttachment, setPendingAttachment] = useState(null); // { file, previewUrl } | null
  const [lightboxSrc, setLightboxSrc] = useState(null);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const [uploadAttachment, { isLoading: isUploading }] = useUploadChatAttachmentMutation();

  // Đã áp dụng xong conversationId từ URL -> xoá khỏi URL, không để link cũ ghi đè lựa
  // chọn thủ công sau này của lễ tân khi quay lại trang (VD bấm Back).
  useEffect(() => {
    if (searchParams.get('conversationId')) {
      setSearchParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedConversation = useMemo(
    () => conversations.find((c) => c.conversationId === selectedId) ?? null,
    [conversations, selectedId],
  );

  const { data: history } = useGetMessagesQuery(selectedId, { skip: !selectedId });

  useEffect(() => {
    if (history) setMessages(history);
  }, [history]);

  useEffect(() => {
    if (!selectedId) return;
    socket.emit('chat:join', { conversationId: selectedId });

    const handleIncoming = (message) => {
      if (message.conversationId !== selectedId) return;
      setMessages((prev) => [...prev, message]);
    };
    socket.on('chat:message', handleIncoming);
    return () => socket.off('chat:message', handleIncoming);
  }, [selectedId, socket]);

  // Có khách mới nhắn (chưa ai nhận) -> tự làm mới danh sách hội thoại bên trái.
  useEffect(() => {
    const handleNewConversation = () => {
      dispatch(chatApi.util.invalidateTags([{ type: 'Conversation', id: 'LIST' }]));
    };
    socket.on('chat:new-conversation', handleNewConversation);
    return () => socket.off('chat:new-conversation', handleNewConversation);
  }, [socket, dispatch]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    return () => {
      if (pendingAttachment?.previewUrl) {
        URL.revokeObjectURL(pendingAttachment.previewUrl);
      }
    };
  }, [pendingAttachment]);

  const handleSelectFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
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

  const handleSend = async (e) => {
    e.preventDefault();
    const content = inputStr.trim();
    if ((!content && !pendingAttachment) || !selectedId || isUploading) return;

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

    socket.emit('chat:message', { conversationId: selectedId, content, attachmentUrl, attachmentType });
    setInputStr('');
    setPendingAttachment(null);
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-4">
      <aside className="w-80 shrink-0 overflow-y-auto rounded-2xl border border-gray-200 bg-white">
        <div className="border-b border-gray-100 p-4">
          <h2 className="font-bold text-gray-900">Hội thoại đang mở</h2>
        </div>
        {conversations.length === 0 ? (
          <p className="p-4 text-sm text-gray-400">Chưa có khách nào chat.</p>
        ) : (
          conversations.map((c) => (
            <button
              key={c.conversationId}
              onClick={() => setSelectedId(c.conversationId)}
              className={`flex w-full items-center gap-3 border-b border-gray-50 px-4 py-3 text-left transition-colors hover:bg-gray-50 ${
                selectedId === c.conversationId ? 'bg-blue-50' : ''
              }`}
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#1b6b50]/10 text-[#1b6b50]">
                <MessageCircle size={18} />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-gray-900">
                  {c.customer?.fullName || 'Khách hàng'}
                </p>
                <p className="truncate text-xs text-gray-400">
                  {c.staff ? `Đang hỗ trợ: ${c.staff.fullName}` : 'Chưa ai nhận'}
                </p>
              </div>
            </button>
          ))
        )}
      </aside>

      <section className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white">
        {!selectedConversation ? (
          <div className="flex flex-1 items-center justify-center text-gray-400">
            Chọn 1 hội thoại để bắt đầu trả lời
          </div>
        ) : (
          <>
            <div className="border-b border-gray-100 p-4">
              <p className="font-bold text-gray-900">
                {selectedConversation.customer?.fullName || 'Khách hàng'}
              </p>
              <p className="text-xs text-gray-400">{selectedConversation.customer?.email}</p>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto p-4">
              {messages.map((msg) => {
                const isMine = msg.senderId === user?.userId;
                return (
                  <div key={msg.messageId} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[70%] rounded-2xl px-4 py-2.5 shadow-sm ${
                        isMine
                          ? 'rounded-tr-sm bg-[#1b6b50] text-white'
                          : 'rounded-tl-sm border border-gray-200 bg-gray-100 text-gray-800'
                      }`}
                    >
                      {!isMine && (
                        <p className="mb-0.5 text-[11px] font-bold text-[#1b6b50]">{msg.senderName}</p>
                      )}
                      {msg.attachmentUrl && (
                        <img
                          src={msg.attachmentUrl}
                          alt="Ảnh đính kèm"
                          onClick={() => setLightboxSrc(msg.attachmentUrl)}
                          className={`max-h-56 max-w-full cursor-zoom-in rounded-xl object-cover ${msg.content ? 'mb-2' : ''}`}
                        />
                      )}
                      {msg.content && (
                        <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{msg.content}</p>
                      )}
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {pendingAttachment && (
              <div className="flex items-center gap-2 border-t border-gray-100 px-4 pt-3">
                <div className="relative">
                  <img
                    src={pendingAttachment.previewUrl}
                    alt="Ảnh sắp gửi"
                    className="h-14 w-14 rounded-lg object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => setPendingAttachment(null)}
                    aria-label="Bỏ ảnh"
                    className="absolute -right-1.5 -top-1.5 rounded-full bg-gray-800 p-0.5 text-white shadow"
                  >
                    <X size={12} />
                  </button>
                </div>
                {isUploading && <Loader2 size={16} className="animate-spin text-gray-400" />}
              </div>
            )}

            <form
              onSubmit={handleSend}
              className={`flex items-center gap-2 p-3 ${pendingAttachment ? '' : 'border-t border-gray-100'}`}
            >
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
                disabled={isUploading}
                aria-label="Đính kèm ảnh"
                className="shrink-0 rounded-full p-2.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-[#1b6b50] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Paperclip className="h-5 w-5" />
              </button>
              <input
                type="text"
                value={inputStr}
                onChange={(e) => setInputStr(e.target.value)}
                placeholder="Nhập trả lời..."
                className="flex-1 rounded-full border border-gray-200 bg-gray-50 px-5 py-3 text-[15px] focus:outline-none focus:ring-2 focus:ring-[#1b6b50]"
              />
              <button
                type="submit"
                disabled={(!inputStr.trim() && !pendingAttachment) || isUploading}
                className="rounded-full bg-[#1b6b50] p-3 text-white transition-colors hover:bg-[#14523d] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Send className="ml-0.5 h-5 w-5" />
              </button>
            </form>
          </>
        )}
      </section>

      <ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />
    </div>
  );
}
