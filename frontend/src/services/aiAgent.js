import { createApi } from '@reduxjs/toolkit/query/react';
import axiosBaseQuery from './axiosBaseQuery';

// Trợ lý ảo AI (khác với chat thật tới lễ tân ở chat.js) — REST thuần: gửi tin nhắn
// nhận ngay câu trả lời trong response, không qua socket.
export const aiAgentApi = createApi({
  reducerPath: 'aiAgentApi',
  baseQuery: axiosBaseQuery(),
  tagTypes: ['AiConversation'],
  endpoints: (builder) => ({
    sendAiMessage: builder.mutation({
      query: ({ conversationId, message }) => ({
        url: '/ai-agent/chat',
        method: 'post',
        data: { conversationId, message },
      }),
    }),
    getAiHistory: builder.query({
      query: (conversationId) => ({
        url: `/ai-agent/conversations/${conversationId}`,
        method: 'get',
      }),
      providesTags: (result, error, conversationId) => [
        { type: 'AiConversation', id: conversationId },
      ],
    }),
  }),
});

export const { useSendAiMessageMutation, useGetAiHistoryQuery } = aiAgentApi;
