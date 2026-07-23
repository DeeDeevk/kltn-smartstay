import { createApi, fakeBaseQuery } from "@reduxjs/toolkit/query/react";
import { sampleRoomTypes } from "./mockData";

export const availabilityApi = createApi({
  reducerPath: "availabilityApi",
  baseQuery: fakeBaseQuery(),
  endpoints: (builder) => ({
    searchAvailability: builder.mutation({
      async queryFn(params) {
        return {
          data: {
            availableRoomTypes: sampleRoomTypes,
            searchParams: params,
          },
        };
      },
    }),
  }),
});

export const { useSearchAvailabilityMutation } = availabilityApi;
