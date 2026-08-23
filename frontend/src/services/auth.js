import { createApi } from '@reduxjs/toolkit/query/react';
import apiClient from './apiClient';

const axiosBaseQuery =
  () =>
  async ({ url, method = 'get', data, params }) => {
    try {
      const result = await apiClient({ url, method, data, params });
      return { data: result.data };
    } catch (error) {
      return {
        error: {
          status: error.response?.status,
          data: error.response?.data,
          message: error.response?.data?.message || error.message,
        },
      };
    }
  };

export const authApi = createApi({
  reducerPath: 'authApi',
  baseQuery: axiosBaseQuery(),
  endpoints: (builder) => ({
    login: builder.mutation({
      query: (credentials) => ({ url: '/auth/login', method: 'post', data: credentials }),
    }),
    register: builder.mutation({
      query: (payload) => ({ url: '/auth/register', method: 'post', data: payload }),
    }),
    verifyOtp: builder.mutation({
      query: (payload) => ({ url: '/auth/verify-otp', method: 'post', data: payload }),
    }),
    resendOtp: builder.mutation({
      query: (email) => ({ url: '/auth/resend-otp', method: 'post', data: { email } }),
    }),
  }),
});

export const {
  useLoginMutation,
  useRegisterMutation,
  useVerifyOtpMutation,
  useResendOtpMutation,
} = authApi;
