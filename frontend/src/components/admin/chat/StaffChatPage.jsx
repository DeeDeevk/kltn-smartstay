import { useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch } from 'react-redux';
import { MessageCircle, Send } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { useSocket } from '../../../context/SocketContext';
import {
  chatApi,
  useGetConversationsQuery,
  useGetMessagesQuery,
} from '../../../services/chat';

// Danh sách hội thoại đang mở (trái) + khung chat (phải) để lễ tân/admin trả lời
// khách hàng real-time — đối xứng với widget Chatbot.jsx phía khách.
export default function StaffChatPage() {
  const { user } = useAuth();
  const socket = useSocket();
  const dispatch = useDispatch();

  const { data: conversations = [] } = useGetConversationsQuery();
  const [selectedId, setSelectedId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputStr, setInputStr] = useState('');
  const messagesEndRef = useRef(null);

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

  const handleSend = (e) => {
    e.preventDefault();
    const content = inputStr.trim();
    if (!content || !selectedId) return;
    socket.emit('chat:message', { conversationId: selectedId, content });
    setInputStr('');
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
                      <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{msg.content}</p>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSend} className="flex items-center gap-2 border-t border-gray-100 p-3">
              <input
                type="text"
                value={inputStr}
                onChange={(e) => setInputStr(e.target.value)}
                placeholder="Nhập trả lời..."
                className="flex-1 rounded-full border border-gray-200 bg-gray-50 px-5 py-3 text-[15px] focus:outline-none focus:ring-2 focus:ring-[#1b6b50]"
              />
              <button
                type="submit"
                disabled={!inputStr.trim()}
                className="rounded-full bg-[#1b6b50] p-3 text-white transition-colors hover:bg-[#14523d] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Send className="ml-0.5 h-5 w-5" />
              </button>
            </form>
          </>
        )}
      </section>
    </div>
  );
}
