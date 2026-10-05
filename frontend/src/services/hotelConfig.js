import { createApi } from '@reduxjs/toolkit/query/react';
import axiosBaseQuery from './axiosBaseQuery';

// Cấu hình vị trí khách sạn (single-row) + sự kiện địa phương — phục vụ trang Cài đặt
// vị trí (bản đồ) và tính năng "gợi ý địa điểm ăn/chơi quanh khách sạn" của trợ lý AI.
export const hotelConfigApi = createApi({
  reducerPath: 'hotelConfigApi',
  baseQuery: axiosBaseQuery(),
  tagTypes: ['HotelConfig', 'LocalEvent', 'ScanRun', 'LocalPlace'],
  endpoints: (builder) => ({
    getHotelConfig: builder.query({
      query: () => ({ url: '/hotel-config', method: 'get' }),
      providesTags: ['HotelConfig'],
    }),
    updateHotelLocation: builder.mutation({
      query: (data) => ({ url: '/hotel-config/location', method: 'patch', data }),
      invalidatesTags: ['HotelConfig'],
    }),
    // Chính sách hoàn tiền theo thời điểm huỷ (KAN-117) — xem RefundRequestService.
    // computeRefundPreview() ở backend.
    updateCancellationPolicy: builder.mutation({
      query: (data) => ({ url: '/hotel-config/cancellation-policy', method: 'patch', data }),
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
    // Gemini tự tìm kiếm trên web (search-grounding) sự kiện quanh khách sạn trong
    // [fromDate, toDate] — khác extractLocalEvents() ở trên vì admin không cần tự tìm link,
    // nhưng kết quả vẫn luôn là status='pending', không khác gì về độ an toàn. Trả về
    // EventScanRun vừa tạo (kể cả khi status='failed').
    triggerAutoScan: builder.mutation({
      query: (data) => ({ url: '/local-events/auto-scan', method: 'post', data }),
      invalidatesTags: [
        { type: 'LocalEvent', id: 'LIST' },
        { type: 'ScanRun', id: 'LIST' },
      ],
    }),
    getScanRuns: builder.query({
      query: ({ page = 1, limit = 20 } = {}) => ({
        url: '/local-events/scan-runs',
        method: 'get',
        params: { page, limit },
      }),
      providesTags: (result) =>
        result?.items
          ? [
              ...result.items.map(({ scanRunId }) => ({ type: 'ScanRun', id: scanRunId })),
              { type: 'ScanRun', id: 'LIST' },
            ]
          : [{ type: 'ScanRun', id: 'LIST' }],
    }),
    getScanRunById: builder.query({
      query: (scanRunId) => ({ url: `/local-events/scan-runs/${scanRunId}`, method: 'get' }),
      providesTags: (result, error, scanRunId) => [{ type: 'ScanRun', id: scanRunId }],
    }),
    // Địa điểm tham quan/vui chơi/ăn uống — nguồn dữ liệu RIÊNG với LocalEvent, phục vụ
    // trang /admin/settings/local-places. Cùng pattern status='pending'/'approved' và
    // source='manual'/'ai_suggested' như local-events.
    getLocalPlaces: builder.query({
      query: () => ({ url: '/local-places', method: 'get' }),
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ placeId }) => ({ type: 'LocalPlace', id: placeId })),
              { type: 'LocalPlace', id: 'LIST' },
            ]
          : [{ type: 'LocalPlace', id: 'LIST' }],
    }),
    createLocalPlace: builder.mutation({
      query: (data) => ({ url: '/local-places', method: 'post', data }),
      invalidatesTags: [{ type: 'LocalPlace', id: 'LIST' }],
    }),
    updateLocalPlace: builder.mutation({
      query: ({ placeId, ...data }) => ({
        url: `/local-places/${placeId}`,
        method: 'patch',
        data,
      }),
      invalidatesTags: (result, error, { placeId }) => [
        { type: 'LocalPlace', id: placeId },
        { type: 'LocalPlace', id: 'LIST' },
      ],
    }),
    deleteLocalPlace: builder.mutation({
      query: (placeId) => ({ url: `/local-places/${placeId}`, method: 'delete' }),
      invalidatesTags: [{ type: 'LocalPlace', id: 'LIST' }],
    }),
    approveLocalPlace: builder.mutation({
      query: (placeId) => ({
        url: `/local-places/${placeId}/approve`,
        method: 'patch',
      }),
      invalidatesTags: (result, error, placeId) => [
        { type: 'LocalPlace', id: placeId },
        { type: 'LocalPlace', id: 'LIST' },
      ],
    }),
    // AI-assisted extraction: body là { url } hoặc { text } (đúng 1 trong 2). Trả về mảng
    // địa điểm vừa tạo, đều source='AI_SUGGESTED' status='PENDING', address=null.
    extractLocalPlaces: builder.mutation({
      query: (data) => ({ url: '/local-places/extract', method: 'post', data }),
      invalidatesTags: [{ type: 'LocalPlace', id: 'LIST' }],
    }),
  }),
});

export const {
  useGetHotelConfigQuery,
  useUpdateHotelLocationMutation,
  useUpdateCancellationPolicyMutation,
  useGetLocalEventsQuery,
  useCreateLocalEventMutation,
  useUpdateLocalEventMutation,
  useDeleteLocalEventMutation,
  useExtractLocalEventsMutation,
  useApproveLocalEventMutation,
  useExtractLocalEventsFromFileMutation,
  useTriggerAutoScanMutation,
  useGetScanRunsQuery,
  useGetScanRunByIdQuery,
  useGetLocalPlacesQuery,
  useCreateLocalPlaceMutation,
  useUpdateLocalPlaceMutation,
  useDeleteLocalPlaceMutation,
  useApproveLocalPlaceMutation,
  useExtractLocalPlacesMutation,
} = hotelConfigApi;
