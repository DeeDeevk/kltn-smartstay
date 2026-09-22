import { createApi } from '@reduxjs/toolkit/query/react';
import axiosBaseQuery from './axiosBaseQuery';

// Cấu hình vị trí khách sạn (single-row) + sự kiện địa phương — phục vụ trang Cài đặt
// vị trí (bản đồ) và tính năng "gợi ý địa điểm ăn/chơi quanh khách sạn" của trợ lý AI.
export const hotelConfigApi = createApi({
  reducerPath: 'hotelConfigApi',
  baseQuery: axiosBaseQuery(),
  tagTypes: ['HotelConfig', 'LocalEvent'],
  endpoints: (builder) => ({
    getHotelConfig: builder.query({
      query: () => ({ url: '/hotel-config', method: 'get' }),
      providesTags: ['HotelConfig'],
    }),
    updateHotelLocation: builder.mutation({
      query: (data) => ({ url: '/hotel-config/location', method: 'patch', data }),
      invalidatesTags: ['HotelConfig'],
    }),
    getLocalEvents: builder.query({
      query: () => ({ url: '/local-events', method: 'get' }),
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ eventId }) => ({ type: 'LocalEvent', id: eventId })),
              { type: 'LocalEvent', id: 'LIST' },
            ]
          : [{ type: 'LocalEvent', id: 'LIST' }],
    }),
    createLocalEvent: builder.mutation({
      query: (data) => ({ url: '/local-events', method: 'post', data }),
      invalidatesTags: [{ type: 'LocalEvent', id: 'LIST' }],
    }),
    updateLocalEvent: builder.mutation({
      query: ({ eventId, ...data }) => ({
        url: `/local-events/${eventId}`,
        method: 'patch',
        data,
      }),
      invalidatesTags: (result, error, { eventId }) => [
        { type: 'LocalEvent', id: eventId },
        { type: 'LocalEvent', id: 'LIST' },
      ],
    }),
    deleteLocalEvent: builder.mutation({
      query: (eventId) => ({ url: `/local-events/${eventId}`, method: 'delete' }),
      invalidatesTags: [{ type: 'LocalEvent', id: 'LIST' }],
    }),
    // AI-assisted extraction: body is { url } hoặc { text } (đúng 1 trong 2, backend tự
    // validate). Trả về mảng sự kiện vừa tạo, đều source='ai_suggested' status='pending'.
    extractLocalEvents: builder.mutation({
      query: (data) => ({ url: '/local-events/extract', method: 'post', data }),
      invalidatesTags: [{ type: 'LocalEvent', id: 'LIST' }],
    }),
    approveLocalEvent: builder.mutation({
      query: (eventId) => ({
        url: `/local-events/${eventId}/approve`,
        method: 'patch',
      }),
      invalidatesTags: (result, error, eventId) => [
        { type: 'LocalEvent', id: eventId },
        { type: 'LocalEvent', id: 'LIST' },
      ],
    }),
    // Tải file .pdf/.docx/.txt lên để AI trích xuất — cùng kiểu FormData như
    // uploadRoomTypeImage bên roomType.js.
    extractLocalEventsFromFile: builder.mutation({
      query: (file) => {
        const formData = new FormData();
        formData.append('file', file);
        return { url: '/local-events/extract-file', method: 'post', data: formData };
      },
      invalidatesTags: [{ type: 'LocalEvent', id: 'LIST' }],
    }),
  }),
});

export const {
  useGetHotelConfigQuery,
  useUpdateHotelLocationMutation,
  useGetLocalEventsQuery,
  useCreateLocalEventMutation,
  useUpdateLocalEventMutation,
  useDeleteLocalEventMutation,
  useExtractLocalEventsMutation,
  useApproveLocalEventMutation,
  useExtractLocalEventsFromFileMutation,
} = hotelConfigApi;
