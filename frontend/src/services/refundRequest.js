import { createApi } from '@reduxjs/toolkit/query/react';
import axiosBaseQuery from './axiosBaseQuery';

// Yêu cầu hoàn tiền (KAN-114) — tạo TỰ ĐỘNG khi admin/nhân viên huỷ 1 đơn đã thanh toán
// (xem BookingService.cancel() ở backend). Quy trình BÁN TỰ ĐỘNG: hệ thống chỉ ghi nhận,
// việc chuyển khoản thật do nhân viên tự làm thủ công sau khi xác minh qua chat.
export const refundRequestApi = createApi({
  reducerPath: 'refundRequestApi',
  baseQuery: axiosBaseQuery(),
  tagTypes: ['RefundRequest'],
  endpoints: (builder) => ({
    getRefundRequests: builder.query({
      query: ({ status, page = 1, limit = 20 } = {}) => ({
        url: '/refund-requests',
        method: 'get',
        params: { status: status || undefined, page, limit },
      }),
      providesTags: (result) =>
        result?.items
          ? [
              ...result.items.map(({ refundRequestId }) => ({
                type: 'RefundRequest',
                id: refundRequestId,
              })),
              { type: 'RefundRequest', id: 'LIST' },
            ]
          : [{ type: 'RefundRequest', id: 'LIST' }],
    }),
    completeRefundRequest: builder.mutation({
      query: ({ refundRequestId, adminNote }) => ({
        url: `/refund-requests/${refundRequestId}/complete`,
        method: 'patch',
        data: { adminNote },
      }),
      invalidatesTags: (result, error, { refundRequestId }) => [
        { type: 'RefundRequest', id: refundRequestId },
        { type: 'RefundRequest', id: 'LIST' },
      ],
    }),
    rejectRefundRequest: builder.mutation({
      query: ({ refundRequestId, adminNote }) => ({
        url: `/refund-requests/${refundRequestId}/reject`,
        method: 'patch',
        data: { adminNote },
      }),
      invalidatesTags: (result, error, { refundRequestId }) => [
        { type: 'RefundRequest', id: refundRequestId },
        { type: 'RefundRequest', id: 'LIST' },
      ],
    }),
    linkRefundRequestConversation: builder.mutation({
      query: ({ refundRequestId, conversationId }) => ({
        url: `/refund-requests/${refundRequestId}/conversation`,
        method: 'patch',
        data: { conversationId },
      }),
      invalidatesTags: (result, error, { refundRequestId }) => [
        { type: 'RefundRequest', id: refundRequestId },
        { type: 'RefundRequest', id: 'LIST' },
      ],
    }),
  }),
});

export const {
  useGetRefundRequestsQuery,
  useCompleteRefundRequestMutation,
  useRejectRefundRequestMutation,
  useLinkRefundRequestConversationMutation,
} = refundRequestApi;
