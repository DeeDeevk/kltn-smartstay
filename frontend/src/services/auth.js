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
    googleLogin: builder.mutation({
      query: (idToken) => ({ url: '/auth/google', method: 'post', data: { idToken } }),
    }),
    verifyOtp: builder.mutation({
      query: (payload) => ({ url: '/auth/verify-otp', method: 'post', data: payload }),
    }),
    resendOtp: builder.mutation({
      query: (email) => ({ url: '/auth/resend-otp', method: 'post', data: { email } }),
    }),
    // Quen mat khau: gui OTP -> xac thuc OTP -> dat lai mat khau
    forgotPassword: builder.mutation({
      query: (email) => ({ url: '/auth/forgot-password', method: 'post', data: { email } }),
    }),
    verifyResetOtp: builder.mutation({
      query: (payload) => ({ url: '/auth/verify-reset-otp', method: 'post', data: payload }),
    }),
    resetPassword: builder.mutation({
      query: (payload) => ({ url: '/auth/reset-password', method: 'post', data: payload }),
    }),
  }),
});

export const {
  useLoginMutation,
  useRegisterMutation,
  useGoogleLoginMutation,
  useVerifyOtpMutation,
  useResendOtpMutation,
  useForgotPasswordMutation,
  useVerifyResetOtpMutation,
  useResetPasswordMutation,
} = authApi;
