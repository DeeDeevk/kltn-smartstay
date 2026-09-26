import { createApi } from '@reduxjs/toolkit/query/react';
import axiosBaseQuery from './axiosBaseQuery';

// Đánh giá của khách sau khi trả phòng. Đánh giá gắn với BOOKING (không gắn thẳng vào
// loại phòng) nên chỉ người đã thật sự lưu trú mới viết được — backend tự kiểm tra.
export const reviewApi = createApi({
  reducerPath: 'reviewApi',
  baseQuery: axiosBaseQuery(),
  tagTypes: ['Review'],
  endpoints: (builder) => ({
    // Công khai — trang chi tiết phòng. roomTypeId bỏ trống = lấy tất cả.
    getReviewsByRoomType: builder.query({
      query: (roomTypeId) => ({
        url: '/reviews',
        method: 'get',
        params: roomTypeId ? { roomTypeId } : undefined,
      }),
      providesTags: ['Review'],
    }),
    // Admin — toàn bộ đánh giá của mọi loại phòng. Bảng đánh giá rất nhỏ nên lấy hết
    // rồi lọc/thống kê ở client, không cần thêm endpoint lọc riêng ở backend.
    getAllReviews: builder.query({
      query: () => ({ url: '/reviews', method: 'get' }),
      providesTags: ['Review'],
    }),
    // Công khai — khu "Cảm nhận khách hàng" ngoài trang chủ.
    getFeaturedReviews: builder.query({
      query: (limit = 3) => ({ url: '/reviews/featured', method: 'get', params: { limit } }),
      providesTags: ['Review'],
    }),
    // Đánh giá của chính mình — để biết đơn nào đã đánh giá rồi mà ẩn nút đi.
    getMyReviews: builder.query({
      query: () => ({ url: '/reviews/me', method: 'get' }),
      providesTags: ['Review'],
    }),
    createReview: builder.mutation({
      query: (payload) => ({ url: '/reviews', method: 'post', data: payload }),
      invalidatesTags: ['Review'],
    }),
    // Chạy bù hàng loạt cho các đánh giá chưa phân tích. Trả về { analyzed, failed, remaining }.
    analyzeAllReviews: builder.mutation({
      query: () => ({ url: '/reviews/analyze-all', method: 'post' }),
      invalidatesTags: ['Review'],
    }),
    replyReview: builder.mutation({
      query: ({ reviewId, reply }) => ({
        url: `/reviews/${reviewId}/reply`,
        method: 'patch',
        data: { reply },
      }),
      invalidatesTags: ['Review'],
    }),
  }),
});

export const {
  useGetReviewsByRoomTypeQuery,
  useGetAllReviewsQuery,
  useGetFeaturedReviewsQuery,
  useGetMyReviewsQuery,
  useCreateReviewMutation,
  useAnalyzeAllReviewsMutation,
  useReplyReviewMutation,
} = reviewApi;
