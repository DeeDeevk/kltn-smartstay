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
    // Khách tự xem yêu cầu hoàn tiền của CHÍNH MÌNH — trang "Lịch sử đặt phòng" dùng để
    // hiện trạng thái (PENDING/COMPLETED/REJECTED) cho từng đơn đã huỷ.
    getMyRefundRequests: builder.query({
      query: () => ({ url: '/refund-requests/mine', method: 'get' }),
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ refundRequestId }) => ({
                type: 'RefundRequest',
                id: refundRequestId,
              })),
              { type: 'RefundRequest', id: 'MINE' },
            ]
          : [{ type: 'RefundRequest', id: 'MINE' }],
    }),
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
    // Ảnh biên lai/QR chuyển khoản (không bắt buộc) — upload trước lấy URL, rồi gửi kèm
    // adminNote vào completeRefundRequest bên dưới. Cùng pattern useUploadChatAttachmentMutation.
    uploadRefundProof: builder.mutation({
      query: (file) => {
        const formData = new FormData();
        formData.append('file', file);
        return { url: '/refund-requests/attachments', method: 'post', data: formData };
      },
    }),
    completeRefundRequest: builder.mutation({
      query: ({ refundRequestId, adminNote, proofImageUrl }) => ({
        url: `/refund-requests/${refundRequestId}/complete`,
        method: 'patch',
        data: { adminNote, proofImageUrl },
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
  useGetMyRefundRequestsQuery,
  useGetRefundRequestsQuery,
  useUploadRefundProofMutation,
  useCompleteRefundRequestMutation,
  useRejectRefundRequestMutation,
  useLinkRefundRequestConversationMutation,
} = refundRequestApi;
