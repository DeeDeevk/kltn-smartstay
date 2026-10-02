import { createApi } from '@reduxjs/toolkit/query/react';
import axiosBaseQuery from './axiosBaseQuery';

// Khuyến mãi (mã giảm giá). Trạng thái EXPIRED do backend suy ra lúc đọc — không có
// trong DB — nên sau khi sửa ngày kết thúc phải refetch mới thấy trạng thái mới.
export const promotionApi = createApi({
  reducerPath: 'promotionApi',
  baseQuery: axiosBaseQuery(),
  tagTypes: ['Promotion'],
  endpoints: (builder) => ({
    // Admin: lấy cả mã đã tạm ngưng / hết hạn.
    getPromotions: builder.query({
      query: () => ({ url: '/promotions', method: 'get' }),
      providesTags: ['Promotion'],
    }),
    createPromotion: builder.mutation({
      query: (payload) => ({ url: '/promotions', method: 'post', data: payload }),
      invalidatesTags: ['Promotion'],
    }),
    updatePromotion: builder.mutation({
      query: ({ promotionId, data }) => ({
        url: `/promotions/${promotionId}`,
        method: 'patch',
        data,
      }),
      invalidatesTags: ['Promotion'],
    }),
    togglePromotion: builder.mutation({
      query: (promotionId) => ({
        url: `/promotions/${promotionId}/toggle`,
        method: 'patch',
      }),
      invalidatesTags: ['Promotion'],
    }),
    deletePromotion: builder.mutation({
      query: (promotionId) => ({ url: `/promotions/${promotionId}`, method: 'delete' }),
      invalidatesTags: ['Promotion'],
    }),
    // Khách thử mã ở bước đặt phòng. Tiền phòng được backend tính lại từ loại phòng +
    // số đêm, nên ở đây chỉ gửi ngữ cảnh đơn, không gửi số tiền.
    validatePromotion: builder.query({
      query: ({ code, roomTypeId, checkIn, checkOut, serviceAmount }) => ({
        url: `/promotions/${encodeURIComponent(code)}/validate`,
        method: 'get',
        params: { roomTypeId, checkIn, checkOut, serviceAmount },
      }),
    }),
  }),
});

export const {
  useGetPromotionsQuery,
  useCreatePromotionMutation,
  useUpdatePromotionMutation,
  useTogglePromotionMutation,
  useDeletePromotionMutation,
  useLazyValidatePromotionQuery,
} = promotionApi;
