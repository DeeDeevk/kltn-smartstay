import { createApi } from '@reduxjs/toolkit/query/react';
import axiosBaseQuery from './axiosBaseQuery';

// Thông báo của chính khách đang đăng nhập (NotificationModule ở backend). Backend lấy
// userId từ token nên không ai xem được thông báo của người khác.
export const notificationApi = createApi({
  reducerPath: 'notificationApi',
  baseQuery: axiosBaseQuery(),
  tagTypes: ['Notification'],
  endpoints: (builder) => ({
    // Trả về { data, total } — mỗi trang 20 dòng cố định ở backend. Truyền { page }
    // (mặc định 1) và tuỳ chọn { isRead: true|false } để lọc.
    getMyNotifications: builder.query({
      query: (params) => ({ url: '/notifications', method: 'get', params }),
      providesTags: ['Notification'],
    }),
    // Trả về { count } — tách riêng để badge trên chuông không phải tải cả danh sách.
    getUnreadNotificationCount: builder.query({
      query: () => ({ url: '/notifications/unread-count', method: 'get' }),
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
  useGetUnreadNotificationCountQuery,
  useMarkNotificationReadMutation,
  useMarkAllNotificationsReadMutation,
} = notificationApi;
