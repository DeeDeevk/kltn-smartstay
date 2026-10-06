// Mở hộ khung chat lễ tân (Chatbot.jsx) từ bất kỳ đâu trong app — VD trang "Lịch sử đặt
// phòng" cần nhắc khách gửi ảnh QR xác minh hoàn tiền. Chatbot.jsx tự quản lý trạng thái
// đóng/mở qua useExclusiveChatPanel, nên không expose state ra ngoài — dùng sự kiện window
// riêng (nhẹ hơn Context chỉ cho 1 hành động "mở hộ tôi" hiếm khi dùng).
const REQUEST_OPEN_EVENT = 'chat-widget:request-open';
const RECEPTION_WIDGET_ID = 'reception';

export default function openReceptionChat() {
    window.dispatchEvent(new CustomEvent(REQUEST_OPEN_EVENT, { detail: RECEPTION_WIDGET_ID }));
}

export { REQUEST_OPEN_EVENT, RECEPTION_WIDGET_ID };
