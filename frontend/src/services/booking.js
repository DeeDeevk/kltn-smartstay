import { createApi } from '@reduxjs/toolkit/query/react';
import axiosBaseQuery from './axiosBaseQuery';

export const bookingApi = createApi({
  reducerPath: 'bookingApi',
  baseQuery: axiosBaseQuery(),
  tagTypes: ['Booking'],
  endpoints: (builder) => ({
    createBooking: builder.mutation({
      query: (data) => ({ url: '/bookings', method: 'post', data }),
      invalidatesTags: [{ type: 'Booking', id: 'MY_LIST' }],
    }),
    getMyBookings: builder.query({
      query: (params) => ({ url: '/bookings/my', method: 'get', params }),
      providesTags: [{ type: 'Booking', id: 'MY_LIST' }],
    }),
    // Lễ tân/Admin xem toàn bộ đơn theo trạng thái (VD status=CHECKED_IN để liệt kê
    // phòng đang có khách ở, phục vụ check-out không cần quét lại QR).
    getBookings: builder.query({
      query: (params) => ({ url: '/bookings', method: 'get', params }),
      providesTags: (result) => [
        { type: 'Booking', id: 'STAFF_LIST' },
        ...(result?.data ?? []).map((b) => ({ type: 'Booking', id: b.bookingId })),
      ],
    }),
    getBookingById: builder.query({
      query: (id) => ({ url: `/bookings/${id}`, method: 'get' }),
      providesTags: (result, error, id) => [{ type: 'Booking', id }],
    }),
    cancelBooking: builder.mutation({
      query: ({ bookingId, reason }) => ({
        url: `/bookings/${bookingId}/cancel`,
        method: 'patch',
        data: { reason },
      }),
      invalidatesTags: (result, error, { bookingId }) => [
        { type: 'Booking', id: bookingId },
        { type: 'Booking', id: 'MY_LIST' },
      ],
    }),
    // Xác nhận thủ công 1 booking đang PENDING (VD: đơn CASH sẽ không bao giờ tự chuyển
    // CONFIRMED như đơn PayOS thanh toán thành công — lễ tân phải xác nhận tay).
    confirmBooking: builder.mutation({
      query: (bookingId) => ({
        url: `/bookings/${bookingId}/confirm`,
        method: 'patch',
      }),
      invalidatesTags: (result, error, bookingId) => [
        { type: 'Booking', id: bookingId },
        { type: 'Booking', id: 'STAFF_LIST' },
      ],
    }),
    // Lễ tân check-in: gán phòng vật lý cụ thể (roomId) cho 1 booking đã CONFIRMED.
    checkIn: builder.mutation({
      query: ({ bookingId, roomId }) => ({
        url: `/bookings/${bookingId}/check-in`,
        method: 'post',
        data: { roomId },
      }),
      invalidatesTags: (result, error, { bookingId }) => [
        { type: 'Booking', id: bookingId },
        { type: 'Booking', id: 'STAFF_LIST' },
      ],
    }),
    // Khách trả phòng — hoặc quét lại QR, hoặc chọn thẳng từ danh sách phòng đang có khách.
    checkOut: builder.mutation({
      query: (bookingId) => ({
        url: `/bookings/${bookingId}/check-out`,
        method: 'post',
      }),
      invalidatesTags: (result, error, bookingId) => [
        { type: 'Booking', id: bookingId },
        { type: 'Booking', id: 'STAFF_LIST' },
      ],
    }),
  }),
});

export const {
  useCreateBookingMutation,
  useGetMyBookingsQuery,
  useGetBookingsQuery,
  useGetBookingByIdQuery,
  useCancelBookingMutation,
  useConfirmBookingMutation,
  useCheckInMutation,
  useCheckOutMutation,
} = bookingApi;
