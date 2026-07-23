import { createApi, fakeBaseQuery } from "@reduxjs/toolkit/query/react";

export const paymentApi = createApi({
  reducerPath: "paymentApi",
  baseQuery: fakeBaseQuery(),
  endpoints: (builder) => ({
    createPayOSLink: builder.mutation({
      async queryFn(payload) {
        return {
          data: {
            success: true,
            paymentUrl: "https://payos.example.local/checkout",
            payload,
          },
        };
      },
    }),
  }),
});

export const { useCreatePayOSLinkMutation } = paymentApi;
