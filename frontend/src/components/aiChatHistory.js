// Tiện ích cho lịch sử trò chuyện với trợ lý ảo: nhớ conversationId theo từng user
// (để F5 vẫn mở lại đúng cuộc hội thoại cũ) và dựng lại danh sách tin nhắn + thẻ
// phòng/khuyến mãi/đặt phòng từ dữ liệu GET /ai-agent/conversations/:id.

// Key gắn theo userId — user khác đăng nhập trên cùng trình duyệt sẽ không đọc
// được conversationId của người trước.
const storageKey = (userId) => `vika-ai-conversation:${userId}`;

// localStorage có thể bị chặn (chế độ riêng tư, trình duyệt tắt site data...) —
// lỗi ở đây chỉ làm mất tính năng nhớ hội thoại, không được làm hỏng khung chat.
export function readStoredConversationId(userId) {
    try {
        return localStorage.getItem(storageKey(userId));
    } catch {
        return null;
    }
}

export function storeConversationId(userId, conversationId) {
    try {
        localStorage.setItem(storageKey(userId), conversationId);
    } catch {
        // bỏ qua
    }
}

export function clearStoredConversationId(userId) {
    try {
        localStorage.removeItem(storageKey(userId));
    } catch {
        // bỏ qua
    }
}

// Backend lưu tin nhắn theo thứ tự USER -> TOOL (0..n) -> MODEL cho mỗi lượt. Các thẻ
// hiển thị kèm câu trả lời (phòng, khuyến mãi, đặt phòng...) không lưu trên tin MODEL
// mà nằm trong kết quả các lượt TOOL ngay trước nó — gom lại rồi gắn vào tin MODEL,
// khớp với cách AiAgentService dựng response lúc chat trực tiếp.
export function buildMessagesFromHistory(history) {
    const messages = [];
    let widgets = {};
    // Đề xuất đặt phòng đang chờ xác nhận tồn tại xuyên suốt nhiều lượt (response
    // lúc chat trực tiếp luôn trả conversation.pendingBooking) cho tới khi booking
    // được tạo — nên giữ riêng thay vì reset theo từng lượt như widgets.
    let activePendingBooking = null;

    for (const message of history ?? []) {
        if (message.role === 'USER') {
            widgets = {};
            messages.push({ role: 'USER', content: message.content ?? '' });
            continue;
        }

        if (message.role === 'TOOL') {
            const result = message.toolResult;
            if (!result?.success) continue;
            switch (message.toolName) {
                case 'search_rooms':
                    if (Array.isArray(result.data)) widgets.rooms = result.data;
                    break;
                case 'check_availability':
                    if (result.data) widgets.rooms = [result.data];
                    break;
                case 'get_promotions':
                    if (Array.isArray(result.data)) widgets.promotions = result.data;
                    break;
                case 'propose_booking':
                    activePendingBooking = result.data ?? null;
                    break;
                case 'create_booking':
                    widgets.booking = result.data;
                    activePendingBooking = null;
                    break;
                case 'request_booking_form':
                    widgets.bookingFormRequest = result.data;
                    break;
                default:
                    break;
            }
            continue;
        }

        if (message.role === 'MODEL') {
            messages.push({
                role: 'MODEL',
                content: message.content ?? '',
                ...widgets,
                pendingBooking: activePendingBooking,
            });
            widgets = {};
        }
    }

    return messages;
}
