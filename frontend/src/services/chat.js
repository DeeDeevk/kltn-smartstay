import { createApi } from '@reduxjs/toolkit/query/react';
import axiosBaseQuery from './axiosBaseQuery';

// Chat thật giữa khách hàng và lễ tân (thay bot echo giả trước đây) — nội dung tin
// nhắn gửi/nhận qua socket (xem Chatbot.jsx, StaffChatPage.jsx), slice này chỉ lo
// phần REST: lấy/tạo hội thoại và tải lịch sử tin nhắn.
export const chatApi = createApi({
  reducerPath: 'chatApi',
  baseQuery: axiosBaseQuery(),
  tagTypes: ['Conversation'],
  endpoints: (builder) => ({
    getOrCreateConversation: builder.mutation({
      query: () => ({ url: '/chat/conversations', method: 'post' }),
    }),
    getConversations: builder.query({
      query: () => ({ url: '/chat/conversations', method: 'get' }),
      providesTags: [{ type: 'Conversation', id: 'LIST' }],
    }),
    getMessages: builder.query({
      query: (conversationId) => ({
        url: `/chat/conversations/${conversationId}/messages`,
        method: 'get',
      }),
      providesTags: (result, error, conversationId) => [
        { type: 'Conversation', id: conversationId },
      ],
    }),
    // Yêu cầu hoàn tiền PENDING của khách trong hội thoại này, CHƯA gắn hội thoại nào — lễ
    // tân dùng để tự chọn gắn ngay trong khung chat (KAN-117), thay vì ADMIN gõ tay id.
    getUnlinkedRefundRequests: builder.query({
      query: (conversationId) => ({
        url: `/chat/conversations/${conversationId}/refund-requests`,
        method: 'get',
      }),
    }),
    // Upload ảnh TRƯỚC (cùng kiểu FormData như uploadRoomTypeImage/extractLocalEventsFromFile),
    // lấy url rồi tự gửi tin nhắn kèm attachmentUrl qua socket (xem Chatbot.jsx/
    // StaffChatPage.jsx) — ảnh không gửi trực tiếp qua socket vì multipart cần HTTP.
    uploadChatAttachment: builder.mutation({
      query: (file) => {
        const formData = new FormData();
        formData.append('file', file);
        return { url: '/chat/attachments', method: 'post', data: formData };
      },
    }),
  }),
});

export const {
  useGetOrCreateConversationMutation,
  useGetConversationsQuery,
  useGetMessagesQuery,
  useGetUnlinkedRefundRequestsQuery,
  useUploadChatAttachmentMutation,
} = chatApi;
