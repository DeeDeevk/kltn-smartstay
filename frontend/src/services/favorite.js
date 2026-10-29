import { createApi } from "@reduxjs/toolkit/query/react";
import axiosBaseQuery from "./axiosBaseQuery";
import { normalizeRoomType } from "./roomType";

export const favoriteApi = createApi({
  reducerPath: "favoriteApi",
  baseQuery: axiosBaseQuery(),
  tagTypes: ["Favorite"],
  endpoints: (builder) => ({
    getMyFavorites: builder.query({
      query: () => ({ url: "/favorites/me", method: "get" }),
      transformResponse: (response) => response.map(normalizeRoomType),
      providesTags: ["Favorite"],
    }),
    addFavorite: builder.mutation({
      query: (roomTypeId) => ({
        url: `/favorites/${roomTypeId}`,
        method: "post",
      }),
      invalidatesTags: ["Favorite"],
    }),
    removeFavorite: builder.mutation({
      query: (roomTypeId) => ({
        url: `/favorites/${roomTypeId}`,
        method: "delete",
      }),
      invalidatesTags: ["Favorite"],
    }),
  }),
});
