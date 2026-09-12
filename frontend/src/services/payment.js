import { createApi } from '@reduxjs/toolkit/query/react';
import axiosBaseQuery from './axiosBaseQuery';

export const paymentApi = createApi({
  reducerPath: 'paymentApi',
  baseQuery: axiosBaseQuery(),
  endpoints: (builder) => ({
    createPayOSLink: builder.mutation({
      query: (bookingId) => ({
        url: `/payments/payos/${bookingId}/link`,
        method: 'post',
      }),
    }),
    // Lễ tân tạo QR PayOS thu phần còn lại lúc trả phòng (amount = số tiền màn Check-out tính).
    createCheckoutPayosLink: builder.mutation({
      query: ({ bookingId, amount }) => ({
        url: `/payments/payos/${bookingId}/checkout-link`,
        method: 'post',
        data: { amount },
      }),
    }),
    // Nút "Kiểm tra" ở màn Check-out — hỏi PayOS link vừa tạo đã được thanh toán chưa.
    checkoutPayosStatus: builder.query({
      query: (bookingId) => ({
        url: `/payments/payos/${bookingId}/checkout-sync`,
        method: 'get',
      }),
    }),
    // Localhost không nhận được webhook thật từ PayOS, nên trang kết quả thanh
    // toán chủ động gọi endpoint này để backend tự hỏi PayOS trạng thái mới nhất.
    syncPayOSStatus: builder.query({
      query: (bookingId) => ({
        url: `/payments/payos/${bookingId}/sync`,
        method: 'get',
      }),
    }),
  }),
});

export const {
  useCreatePayOSLinkMutation,
  useCreateCheckoutPayosLinkMutation,
  useLazyCheckoutPayosStatusQuery,
  useSyncPayOSStatusQuery,
  useLazySyncPayOSStatusQuery,
} = paymentApi;
