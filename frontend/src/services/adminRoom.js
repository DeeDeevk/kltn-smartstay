import { createApi } from '@reduxjs/toolkit/query/react';
import axiosBaseQuery from './axiosBaseQuery';

// Slice RTK Query riêng cho thao tác quản trị trên entity Room (POST /rooms...),
// tách khỏi services/room.js (mock timeline phòng, chưa nối API thật) để không đụng
// vào tính năng khác đang dùng file đó.
export const adminRoomApi = createApi({
  reducerPath: 'adminRoomApi',
  baseQuery: axiosBaseQuery(),
  tagTypes: ['AdminRoom'],
  endpoints: (builder) => ({
    createRoom: builder.mutation({
      query: (data) => ({ url: '/rooms', method: 'post', data }),
      invalidatesTags: [{ type: 'AdminRoom', id: 'LIST' }],
    }),
    // Toàn bộ phòng vật lý (mọi tầng) — dùng cho Sơ đồ phòng và lọc phòng trống lúc check-in.
    // Nhận { roomTypeId, checkIn, checkOut }: khi có đủ checkIn/checkOut, mỗi phòng trả về
    // kèm rangeStatus ('AVAILABLE' | 'BOOKED') + rangeGuestName theo lịch đặt trong khoảng.
    getRoomMap: builder.query({
      query: (params = {}) => {
        const clean = Object.fromEntries(
          Object.entries(params).filter(([, v]) => v !== '' && v != null),
        );
        return { url: '/rooms/map', method: 'get', params: clean };
      },
      providesTags: (result) => [
        { type: 'AdminRoom', id: 'LIST' },
        ...(result ?? []).map((r) => ({ type: 'AdminRoom', id: r.roomId })),
      ],
    }),
    updateRoomStatus: builder.mutation({
      query: ({ roomId, status }) => ({
        url: `/rooms/${roomId}/status`,
        method: 'patch',
        data: { status },
      }),
      invalidatesTags: [{ type: 'AdminRoom', id: 'LIST' }],
    }),
  }),
});

export const { useCreateRoomMutation, useGetRoomMapQuery, useUpdateRoomStatusMutation } = adminRoomApi;
