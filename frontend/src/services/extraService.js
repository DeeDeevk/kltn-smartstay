import { createApi, fakeBaseQuery } from "@reduxjs/toolkit/query/react";
import { sampleExtraServices } from "./mockData";

export const extraServiceApi = createApi({
  reducerPath: "extraServiceApi",
  baseQuery: fakeBaseQuery(),
  endpoints: (builder) => ({
    getAllExtraServices: builder.query({
      async queryFn() {
        return { data: { data: sampleExtraServices } };
      },
    }),
  }),
});

export const { useGetAllExtraServicesQuery } = extraServiceApi;
