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
    // Ca kết gần nhất của TOÀN khách sạn (không phải của riêng người đang đăng nhập) —
    // mốc để người vô ca đối chiếu tiền trong két. Trả null nếu chưa có ca nào kết.
    getLastClosedShift: builder.query({
      query: () => ({ url: '/shift-assignments/last-closed', method: 'get' }),
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
    // Nhân viên vô ca / kết ca cho đúng ca của chính mình, kèm tiền két đầu ca / cuối ca.
    checkInShiftAssignment: builder.mutation({
      query: ({ shiftAssignmentId, openingCash }) => ({
        url: `/shift-assignments/${shiftAssignmentId}/check-in`,
        method: 'post',
        data: { openingCash },
      }),
      invalidatesTags: ['ShiftAssignment'],
    }),
    checkOutShiftAssignment: builder.mutation({
      query: ({ shiftAssignmentId, closingCash }) => ({
        url: `/shift-assignments/${shiftAssignmentId}/check-out`,
        method: 'post',
        data: { closingCash },
      }),
      invalidatesTags: ['ShiftAssignment'],
    }),
    // Báo cáo chốt két của 1 ca: tiền đầu ca, tiền thu trong ca, tiền dự kiến, chênh lệch.
    getShiftReport: builder.query({
      query: (shiftAssignmentId) => ({
        url: `/shift-assignments/${shiftAssignmentId}/report`,
        method: 'get',
      }),
      providesTags: ['ShiftAssignment'],
    }),
  }),
});

export const {
  useGetShiftAssignmentsQuery,
  useGetMyShiftAssignmentsQuery,
  useGetLastClosedShiftQuery,
  useCreateShiftAssignmentMutation,
  useCopyShiftWeekMutation,
  useDeleteShiftAssignmentMutation,
  useCheckInShiftAssignmentMutation,
  useCheckOutShiftAssignmentMutation,
  useGetShiftReportQuery,
} = shiftAssignmentApi;
