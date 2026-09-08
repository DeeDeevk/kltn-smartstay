import { createApi } from '@reduxjs/toolkit/query/react';
import axiosBaseQuery from './axiosBaseQuery';
import { adminRoomApi } from './adminRoom';

// Các thao tác đổi trạng thái phòng gián tiếp (check-in -> OCCUPIED, check-out ->
// CLEANING, walk-in/huỷ -> gán/bỏ phòng) nằm ở slice booking, nên phải chủ động
// làm mới cache Sơ đồ phòng (slice adminRoomApi) sau khi mutation thành công.
const refreshRoomMap = async (_arg, { dispatch, queryFulfilled }) => {
  try {
    await queryFulfilled;
    dispatch(
      adminRoomApi.util.invalidateTags([{ type: 'AdminRoom', id: 'LIST' }]),
    );
  } catch {
    /* mutation lỗi -> giữ nguyên cache sơ đồ phòng */
  }
};

export const bookingApi = createApi({
  reducerPath: 'bookingApi',
  baseQuery: axiosBaseQuery(),
  tagTypes: ['Booking'],
  endpoints: (builder) => ({
    createBooking: builder.mutation({
      query: (data) => ({ url: '/bookings', method: 'post', data }),
      invalidatesTags: [{ type: 'Booking', id: 'MY_LIST' }],
    }),
    // Lễ tân/Admin đặt phòng hộ khách vãng lai cho 1 phòng cụ thể (từ trang Sơ đồ phòng).
    createWalkInBooking: builder.mutation({
      query: (data) => ({ url: '/bookings/walk-in', method: 'post', data }),
      invalidatesTags: [{ type: 'Booking', id: 'STAFF_LIST' }],
      onQueryStarted: refreshRoomMap,
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
    // Hoá đơn xem trước khi trả phòng (phụ thu trả muộn + dịch vụ đã ghi nhận).
    getCheckoutPreview: builder.query({
      query: (bookingId) => ({
        url: `/bookings/${bookingId}/checkout-preview`,
        method: 'get',
      }),
      providesTags: (result, error, bookingId) => [
        { type: 'Booking', id: bookingId },
      ],
    }),
    // Danh sách dịch vụ / minibar đang cung cấp (dùng ở màn Check-out).
    getServices: builder.query({
      query: (params) => ({ url: '/services', method: 'get', params }),
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
        { type: 'Booking', id: 'STAFF_LIST' },
      ],
      onQueryStarted: refreshRoomMap,
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
      onQueryStarted: refreshRoomMap,
    }),
    // Trả phòng: kèm dịch vụ tiêu dùng thêm, phương thức thanh toán và cờ đã thu đủ.
    checkOut: builder.mutation({
      query: ({ bookingId, ...body }) => ({
        url: `/bookings/${bookingId}/check-out`,
        method: 'post',
        data: body,
      }),
      invalidatesTags: (result, error, { bookingId }) => [
        { type: 'Booking', id: bookingId },
        { type: 'Booking', id: 'STAFF_LIST' },
        { type: 'Booking', id: 'MY_LIST' },
      ],
      onQueryStarted: refreshRoomMap,
    }),
  }),
});

export const {
  useCreateBookingMutation,
  useCreateWalkInBookingMutation,
  useGetMyBookingsQuery,
  useGetBookingsQuery,
  useGetBookingByIdQuery,
  useGetCheckoutPreviewQuery,
  useGetServicesQuery,
  useCancelBookingMutation,
  useConfirmBookingMutation,
  useCheckInMutation,
  useCheckOutMutation,
} = bookingApi;
