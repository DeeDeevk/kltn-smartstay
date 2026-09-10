import { createApi } from '@reduxjs/toolkit/query/react';
import axiosBaseQuery from './axiosBaseQuery';

// Phân ca: 1 nhân viên + 1 loại ca + 1 ngày làm việc cụ thể.
export const shiftAssignmentApi = createApi({
  reducerPath: 'shiftAssignmentApi',
  baseQuery: axiosBaseQuery(),
  tagTypes: ['ShiftAssignment'],
  endpoints: (builder) => ({
    // Admin xem lịch phân ca của mọi nhân viên trong 1 khoảng ngày (thường là 1 tuần).
    getShiftAssignments: builder.query({
      query: (params) => ({ url: '/shift-assignments', method: 'get', params }),
      providesTags: ['ShiftAssignment'],
    }),
    // Nhân viên xem lịch của chính mình.
    getMyShiftAssignments: builder.query({
      query: (params) => ({ url: '/shift-assignments/me', method: 'get', params }),
      providesTags: ['ShiftAssignment'],
    }),
    createShiftAssignment: builder.mutation({
      query: (payload) => ({ url: '/shift-assignments', method: 'post', data: payload }),
      invalidatesTags: ['ShiftAssignment'],
    }),
    // Sao chép lịch phân ca 1 tuần sang tuần khác (payload: { sourceWeekStart, targetWeekStart }).
    copyShiftWeek: builder.mutation({
      query: (payload) => ({
        url: '/shift-assignments/copy-week',
        method: 'post',
        data: payload,
      }),
      invalidatesTags: ['ShiftAssignment'],
    }),
    deleteShiftAssignment: builder.mutation({
      query: (shiftAssignmentId) => ({
        url: `/shift-assignments/${shiftAssignmentId}`,
        method: 'delete',
      }),
      invalidatesTags: ['ShiftAssignment'],
    }),
  }),
});

export const {
  useGetShiftAssignmentsQuery,
  useGetMyShiftAssignmentsQuery,
  useCreateShiftAssignmentMutation,
  useCopyShiftWeekMutation,
  useDeleteShiftAssignmentMutation,
} = shiftAssignmentApi;
