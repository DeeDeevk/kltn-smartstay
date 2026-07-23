import { createApi, fakeBaseQuery } from "@reduxjs/toolkit/query/react";
import { sampleRoomTypes } from "./mockData";

export const roomTypeApi = createApi({
  reducerPath: "roomTypeApi",
  baseQuery: fakeBaseQuery(),
  endpoints: (builder) => ({
    getAllRoomTypes: builder.query({
      async queryFn() {
        return { data: { data: sampleRoomTypes } };
      },
    }),
  }),
});
