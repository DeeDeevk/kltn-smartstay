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
  useSyncPayOSStatusQuery,
  useLazySyncPayOSStatusQuery,
} = paymentApi;
