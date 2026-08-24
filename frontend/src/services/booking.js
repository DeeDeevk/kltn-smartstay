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
  }),
});

export const {
  useCreateBookingMutation,
  useGetMyBookingsQuery,
  useGetBookingByIdQuery,
  useCancelBookingMutation,
} = bookingApi;
