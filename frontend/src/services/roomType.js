import { createApi } from '@reduxjs/toolkit/query/react';
import axiosBaseQuery from './axiosBaseQuery';

// Chuẩn hoá RoomType từ backend thật sang các field/format mà UI (đang xây trên mock data)
// đã kỳ vọng sẵn: images dạng [{url}], cùng vài alias field (id, base_price, capacity_people)
// để không phải sửa lại toàn bộ component tiêu thụ. `amenities` giữ nguyên string[] như backend
// trả về — Redux store phải chỉ chứa dữ liệu serializable, nên việc quy đổi sang icon component
// (cho hiển thị) chỉ được làm ở tầng render (xem RoomAmenities.jsx), không ở đây.
function normalizeRoomType(roomType) {
  if (!roomType) return roomType;
  return {
    ...roomType,
    id: roomType.roomTypeId,
    base_price: roomType.basePrice,
    capacity_people: roomType.capacity,
    images: (roomType.images ?? []).map((url) => ({ url })),
  };
}

export const roomTypeApi = createApi({
  reducerPath: 'roomTypeApi',
  baseQuery: axiosBaseQuery(),
  tagTypes: ['RoomType'],
  endpoints: (builder) => ({
    getAllRoomTypes: builder.query({
      query: (params) => ({ url: '/room-types', method: 'get', params }),
      transformResponse: (response) => ({
        data: (response ?? []).map(normalizeRoomType),
      }),
      providesTags: (result) =>
        result?.data
          ? [
              ...result.data.map(({ id }) => ({ type: 'RoomType', id })),
              { type: 'RoomType', id: 'LIST' },
            ]
          : [{ type: 'RoomType', id: 'LIST' }],
    }),
    getRoomTypeById: builder.query({
      query: (id) => ({ url: `/room-types/${id}`, method: 'get' }),
      transformResponse: (response) => normalizeRoomType(response),
      providesTags: (result, error, id) => [{ type: 'RoomType', id }],
    }),
    createRoomType: builder.mutation({
      query: (data) => ({ url: '/room-types', method: 'post', data }),
      invalidatesTags: [{ type: 'RoomType', id: 'LIST' }],
    }),
    updateRoomType: builder.mutation({
      query: ({ roomTypeId, ...data }) => ({
        url: `/room-types/${roomTypeId}`,
        method: 'patch',
        data,
      }),
      invalidatesTags: (result, error, { roomTypeId }) => [
        { type: 'RoomType', id: roomTypeId },
        { type: 'RoomType', id: 'LIST' },
      ],
    }),
    deleteRoomType: builder.mutation({
      query: (roomTypeId) => ({ url: `/room-types/${roomTypeId}`, method: 'delete' }),
      invalidatesTags: [{ type: 'RoomType', id: 'LIST' }],
    }),
    uploadRoomTypeImage: builder.mutation({
      query: (file) => {
        const formData = new FormData();
        formData.append('file', file);
        return { url: '/uploads/image', method: 'post', data: formData };
      },
    }),
  }),
});

export const {
  useGetAllRoomTypesQuery,
  useGetRoomTypeByIdQuery,
  useCreateRoomTypeMutation,
  useUpdateRoomTypeMutation,
  useDeleteRoomTypeMutation,
  useUploadRoomTypeImageMutation,
} = roomTypeApi;
