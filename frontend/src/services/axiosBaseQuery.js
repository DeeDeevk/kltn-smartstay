import apiClient from './apiClient';

// baseQuery dùng chung cho các RTK Query slice gọi backend thật (qua apiClient),
// khác với các slice mock (fakeBaseQuery + sampleData) có sẵn trong repo.
export default function axiosBaseQuery() {
  return async ({ url, method = 'get', data, params }) => {
    try {
      const result = await apiClient({ url, method, data, params });
      return { data: result.data };
    } catch (error) {
      return {
        error: {
          status: error.response?.status,
          data: error.response?.data,
          message: error.response?.data?.message || error.message,
        },
      };
    }
  };
}
