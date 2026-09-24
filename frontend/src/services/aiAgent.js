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
      // confirmProposalId: chỉ gửi khi khách bấm nút "Xác nhận đặt phòng" — là
      // proposalId của đúng bản đề xuất đang hiển thị trên thẻ.
      query: ({ conversationId, message, confirmProposalId }) => ({
        url: '/ai-agent/chat',
        method: 'post',
        data: { conversationId, message, confirmProposalId },
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

export const {
  useSendAiMessageMutation,
  useGetAiHistoryQuery,
  useLazyGetAiHistoryQuery,
} = aiAgentApi;
