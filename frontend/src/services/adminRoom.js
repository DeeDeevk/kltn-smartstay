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
    // Toàn bộ phòng vật lý (mọi tầng) — dùng để lọc phòng trống cùng loại phòng lúc check-in.
    getRoomMap: builder.query({
      query: () => ({ url: '/rooms/map', method: 'get' }),
      providesTags: [{ type: 'AdminRoom', id: 'LIST' }],
    }),
  }),
});

export const { useCreateRoomMutation, useGetRoomMapQuery } = adminRoomApi;
