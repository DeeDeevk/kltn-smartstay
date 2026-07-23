import { createApi, fakeBaseQuery } from "@reduxjs/toolkit/query/react";
import { sampleReviews } from "./mockData";

export const reviewApi = createApi({
  reducerPath: "reviewApi",
  baseQuery: fakeBaseQuery(),
  endpoints: (builder) => ({
    getReviewsByRoomType: builder.query({
      async queryFn() {
        return { data: { data: sampleReviews } };
      },
    }),
    createReview: builder.mutation({
      async queryFn(payload) {
        return { data: { success: true, data: payload } };
      },
    }),
  }),
});

export const { useGetReviewsByRoomTypeQuery, useCreateReviewMutation } =
  reviewApi;
