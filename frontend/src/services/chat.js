import { createApi, fakeBaseQuery } from "@reduxjs/toolkit/query/react";

export const chatApi = createApi({
  reducerPath: "chatApi",
  baseQuery: fakeBaseQuery(),
  endpoints: (builder) => ({
    sendMessage: builder.mutation({
      async queryFn(payload) {
        const message = payload?.message || "";
        return {
          data: {
            output: `Tôi đã nhận được: ${message}`,
            text: `Tôi đã nhận được: ${message}`,
          },
        };
      },
    }),
  }),
});

export const { useSendMessageMutation } = chatApi;
