import { createApi } from '@reduxjs/toolkit/query/react';
import axiosBaseQuery from './axiosBaseQuery';
import { normalizeRoomType } from './roomType';

// Dùng builder.query (không phải mutation) vì đây bản chất là một thao tác đọc (GET),
// giúp RTK Query tự cache theo query params (checkIn/checkOut/guests) như yêu cầu kỹ
// thuật của tính năng tìm phòng — gọi lại với cùng bộ tham số sẽ lấy từ cache thay vì
// bắn request mới. Component kích hoạt tìm kiếm qua useLazySearchAvailabilityQuery.
export const availabilityApi = createApi({
  reducerPath: 'availabilityApi',
  baseQuery: axiosBaseQuery(),
  endpoints: (builder) => ({
    searchAvailability: builder.query({
      query: ({ checkIn, checkOut, guests }) => ({
        url: '/rooms/availability',
        method: 'get',
        params: { checkIn, checkOut, guests },
      }),
      transformResponse: (response) => ({
        availableRoomTypes: (response ?? []).map(normalizeRoomType),
      }),
    }),
  }),
});

export const { useLazySearchAvailabilityQuery } = availabilityApi;
