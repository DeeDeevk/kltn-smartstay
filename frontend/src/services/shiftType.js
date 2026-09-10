import { createApi } from '@reduxjs/toolkit/query/react';
import axiosBaseQuery from './axiosBaseQuery';

// Loại ca cố định (Ca sáng/chiều/đêm...) — Admin định nghĩa 1 lần, dùng lại khi
// phân ca cho nhân viên (xem services/shiftAssignment.js).
export const shiftTypeApi = createApi({
  reducerPath: 'shiftTypeApi',
  baseQuery: axiosBaseQuery(),
  tagTypes: ['ShiftType'],
  endpoints: (builder) => ({
    getShiftTypes: builder.query({
      query: () => ({ url: '/shift-types', method: 'get' }),
      providesTags: ['ShiftType'],
    }),
    createShiftType: builder.mutation({
      query: (payload) => ({ url: '/shift-types', method: 'post', data: payload }),
      invalidatesTags: ['ShiftType'],
    }),
    updateShiftType: builder.mutation({
      query: ({ shiftTypeId, data }) => ({
        url: `/shift-types/${shiftTypeId}`,
        method: 'patch',
        data,
      }),
      invalidatesTags: ['ShiftType'],
    }),
    deleteShiftType: builder.mutation({
      query: (shiftTypeId) => ({ url: `/shift-types/${shiftTypeId}`, method: 'delete' }),
      invalidatesTags: ['ShiftType'],
    }),
  }),
});

export const {
  useGetShiftTypesQuery,
  useCreateShiftTypeMutation,
  useUpdateShiftTypeMutation,
  useDeleteShiftTypeMutation,
} = shiftTypeApi;
