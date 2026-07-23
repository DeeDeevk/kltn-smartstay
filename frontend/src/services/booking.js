import { createApi, fakeBaseQuery } from "@reduxjs/toolkit/query/react";
import { sampleBookings } from "./mockData";

export const bookingApi = createApi({
  reducerPath: "bookingApi",
  baseQuery: fakeBaseQuery(),
  endpoints: (builder) => ({
    createBooking: builder.mutation({
      async queryFn(payload) {
        return {
          data: {
            success: true,
            data: {
              id: Date.now(),
              booking_code: `BK-${Date.now()}`,
              ...payload,
            },
          },
        };
      },
    }),
  }),
});

export const { useCreateBookingMutation } = bookingApi;

const bookingService = {
  async updateRoomStatus(bookingId, status, allocationId) {
    return Promise.resolve({
      message: "Cập nhật trạng thái phòng thành công",
      data: { bookingId, status, allocationId },
    });
  },
  async createBooking(payload) {
    return Promise.resolve({
      data: {
        id: Date.now(),
        booking_code: `BK-${Date.now()}`,
        ...payload,
      },
    });
  },
  async getAllBookings() {
    return Promise.resolve({ data: sampleBookings });
  },
};

export default bookingService;
