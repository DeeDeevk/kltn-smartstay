import { createApi } from '@reduxjs/toolkit/query/react';
import axiosBaseQuery from './axiosBaseQuery';

// Báo cáo doanh thu (chỉ Admin). Tham số chung: { from, to, groupBy }
// với groupBy ∈ day | week | month | year.
export const revenueApi = createApi({
  reducerPath: 'revenueApi',
  baseQuery: axiosBaseQuery(),
  tagTypes: ['Revenue'],
  endpoints: (builder) => ({
    getRevenueSummary: builder.query({
      query: (params) => ({ url: '/revenue/summary', method: 'get', params }),
      providesTags: ['Revenue'],
    }),
    getRevenueByStaff: builder.query({
      query: (params) => ({ url: '/revenue/by-staff', method: 'get', params }),
      providesTags: ['Revenue'],
    }),
  }),
});

export const { useGetRevenueSummaryQuery, useGetRevenueByStaffQuery } = revenueApi;
