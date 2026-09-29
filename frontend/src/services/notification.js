import { createApi } from '@reduxjs/toolkit/query/react';
import axiosBaseQuery from './axiosBaseQuery';

// Thông báo của chính khách đang đăng nhập. Backend lấy userId từ token nên không có
// tham số nào ở đây — không ai xem được thông báo của người khác.
export const notificationApi = createApi({
  reducerPath: 'notificationApi',
  baseQuery: axiosBaseQuery(),
  tagTypes: ['Notification'],
  endpoints: (builder) => ({
    // Trả về { unreadCount, total, page, limit, items } — gộp trong một request để chuông
    // không phải gọi thêm một lượt chỉ để lấy số chưa đọc. Chuông gọi không tham số
    // (trang đầu), trang "Thông báo" truyền { page } để phân trang.
    getMyNotifications: builder.query({
      query: (params) => ({ url: '/notifications', method: 'get', params }),
      providesTags: ['Notification'],
    }),
    markNotificationRead: builder.mutation({
      query: (notificationId) => ({
        url: `/notifications/${notificationId}/read`,
        method: 'patch',
      }),
      invalidatesTags: ['Notification'],
    }),
    markAllNotificationsRead: builder.mutation({
      query: () => ({ url: '/notifications/read-all', method: 'patch' }),
      invalidatesTags: ['Notification'],
    }),
  }),
});

export const {
  useGetMyNotificationsQuery,
  useMarkNotificationReadMutation,
  useMarkAllNotificationsReadMutation,
} = notificationApi;
