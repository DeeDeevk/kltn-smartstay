import { createApi } from '@reduxjs/toolkit/query/react';
import axiosBaseQuery from './axiosBaseQuery';

// Kho FAQ/chính sách khách sạn — nguồn dữ liệu cho RAG của trợ lý AI. Mỗi lần
// thêm/sửa/xoá, backend tự embed lại nên AI dùng được nội dung mới ngay.
export const faqApi = createApi({
  reducerPath: 'faqApi',
  baseQuery: axiosBaseQuery(),
  tagTypes: ['Faq'],
  endpoints: (builder) => ({
    // Admin: lấy cả FAQ đang ẩn.
    getAllFaqs: builder.query({
      query: () => ({ url: '/faqs/all', method: 'get' }),
      providesTags: ['Faq'],
    }),
    createFaq: builder.mutation({
      query: (payload) => ({ url: '/faqs', method: 'post', data: payload }),
      invalidatesTags: ['Faq'],
    }),
    updateFaq: builder.mutation({
      query: ({ faqId, data }) => ({ url: `/faqs/${faqId}`, method: 'patch', data }),
      invalidatesTags: ['Faq'],
    }),
    deleteFaq: builder.mutation({
      query: (faqId) => ({ url: `/faqs/${faqId}`, method: 'delete' }),
      invalidatesTags: ['Faq'],
    }),
    // Embed bù các FAQ chưa có vector (vd. lần embed trước bị lỗi mạng).
    reindexFaqs: builder.mutation({
      query: () => ({ url: '/faqs/reindex', method: 'post' }),
    }),
  }),
});

export const {
  useGetAllFaqsQuery,
  useCreateFaqMutation,
  useUpdateFaqMutation,
  useDeleteFaqMutation,
  useReindexFaqsMutation,
} = faqApi;
