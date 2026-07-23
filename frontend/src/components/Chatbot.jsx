import React, { useState, useRef, useEffect } from 'react';
import { Bot, X, Send, Loader2 } from 'lucide-react';
import { useSendMessageMutation } from '../services/chat';

const Chatbot = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([
        { role: 'ai', content: 'Xin chào! Tôi là trợ lý ảo của Vika Hotel. Tôi có thể giúp gì cho bạn?' }
    ]);
    const [inputStr, setInputStr] = useState('');
    const [sendMessageAPI, { isLoading: isTyping }] = useSendMessageMutation();
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isTyping]);

    const handleSend = async (e) => {
        e.preventDefault();
        if (!inputStr.trim()) return;

        const userMessage = inputStr.trim();
        setInputStr('');
        setMessages(prev => [...prev, { role: 'user', content: userMessage }]);

        try {
            const response = await sendMessageAPI({ message: userMessage }).unwrap();
            const aiReply = response?.output || response?.text || response || "Xin lỗi, tôi chưa hiểu rõ yêu cầu.";

            setMessages(prev => [...prev, { role: 'ai', content: typeof aiReply === 'string' ? aiReply : JSON.stringify(aiReply) }]);
        } catch (error) {
            console.error('Error sending message to AI:', error);
            setMessages(prev => [...prev, { role: 'ai', content: 'Xin lỗi, hệ thống đang bận. Vui lòng thử lại sau.' }]);
        }
    };

    return (
        <div className="fixed bottom-6 right-6 z-50">
            {/* Khung chat */}
            {isOpen && (
                <div className="absolute bottom-16 right-0 w-[380px] h-[550px] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-gray-100 transition-all duration-300 transform origin-bottom-right">
                    {/* Header */}
                    <div className="bg-[#1b6b50] p-4 flex items-center justify-between text-white shadow-md z-10">
                        <div className="flex items-center gap-3">
                            <div className="bg-white p-1.5 rounded-full">
                                <Bot className="w-6 h-6 text-[#1b6b50]" />
                            </div>
                            <div>
                                <h3 className="font-bold text-lg">Vika AI Assistant</h3>
                                <p className="text-xs text-green-100 flex items-center gap-1">
                                    <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                                    Đang hoạt động
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

                    {/* Messages Area (Background màu trắng như yêu cầu) */}
                    <div className="flex-1 overflow-y-auto p-4 bg-white/95 flex flex-col gap-4">
                        {messages.map((msg, idx) => (
                            <div
                                key={idx}
                                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                            >
                                <div
                                    className={`max-w-[80%] rounded-2xl px-4 py-2.5 shadow-sm 
                                    ${msg.role === 'user'
                                            ? 'bg-[#1b6b50] text-white rounded-tr-sm'
                                            : 'bg-gray-100 text-gray-800 rounded-tl-sm border border-gray-200'
                                        }`}
                                >
                                    <p className="text-[15px] leading-relaxed whitespace-pre-wrap">
                                        {msg.content.split(/(\[.*?\]\(.*?\))/g).map((part, i) => {
                                            const match = part.match(/\[(.*?)\]\((.*?)\)/);
                                            if (match) {
                                                return (
                                                    <a
                                                        key={i}
                                                        href={match[2]}
                                                        className="text-rose-600 font-bold hover:underline underline-offset-4"
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                    >
                                                        {match[1]}
                                                    </a>
                                                );
                                            }
                                            return part;
                                        })}
                                    </p>
                                </div>
                            </div>
                        ))}

                        {/* Typing Indicator */}
                        {isTyping && (
                            <div className="flex justify-start">
                                <div className="bg-gray-100 border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm flex gap-1 items-center">
                                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input Area */}
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
                            disabled={isTyping}
                        />
                        <button
                            type="submit"
                            disabled={!inputStr.trim() || isTyping}
                            className="p-3 bg-[#1b6b50] text-white rounded-full hover:bg-[#14523d] disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-md"
                        >
                            {isTyping ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5 ml-0.5" />}
                        </button>
                    </form>
                </div>
            )}

            {/* Floating Toggle Button (Hình robot) */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`p-4 bg-[#1b6b50] text-white rounded-full shadow-2xl hover:bg-[#14523d] hover:scale-110 transition-all duration-300 z-50 absolute bottom-0 right-0 ${isOpen ? 'rotate-90 scale-0 opacity-0' : 'rotate-0 scale-100 opacity-100'}`}
                style={{ visibility: isOpen ? 'hidden' : 'visible' }} // Ẩn khi đang mở khung chat
            >
                <Bot className="w-8 h-8" />
            </button>

            {/* Nút thoát phụ khi hộp thoại đang mở (Nếu muốn có icon X ở ngoài, nhưng hộp thoại đã có nút X ở header rồi nên mình ẩn nút xanh đi) */}
        </div>
    );
};

export default Chatbot;
