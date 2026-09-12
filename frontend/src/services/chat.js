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
  }),
});

export const {
  useGetOrCreateConversationMutation,
  useGetConversationsQuery,
  useGetMessagesQuery,
} = chatApi;
