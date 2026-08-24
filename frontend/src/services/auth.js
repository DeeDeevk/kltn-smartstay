import { createApi } from '@reduxjs/toolkit/query/react';
import axiosBaseQuery from './axiosBaseQuery';

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
