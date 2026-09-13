import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api/v1'

// 401 từ các endpoint này là kết quả cuối cùng của chính chúng (sai mật khẩu, refresh
// token không hợp lệ, OTP sai...), không phải do access token hết hạn, nên không nên
// thử refresh + retry cho các request này.
const SKIP_REFRESH_URLS = ['/auth/login', '/auth/register', '/auth/refresh', '/auth/verify-otp', '/auth/resend-otp', '/auth/forgot-password', '/auth/verify-reset-otp', '/auth/reset-password']

const apiClient = axios.create({
  baseURL: BASE_URL,
})

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

function clearSessionAndNotify() {
  localStorage.removeItem('access_token')
  localStorage.removeItem('refresh_token')
  localStorage.removeItem('auth_user')
  // AuthContext lắng nghe sự kiện này để đồng bộ lại state React (user/isAuthenticated)
  // mà không cần apiClient (module thuần) phải import ngược vào React context.
  window.dispatchEvent(new Event('auth:session-expired'))
}

// Nhiều request có thể cùng nhận 401 một lúc (vd. gọi song song); dùng chung một
// promise refresh để chỉ có đúng 1 lần gọi /auth/refresh, tránh refresh token bị
// rotate (thu hồi) bởi lần gọi đầu khiến lần gọi thứ hai thất bại oan.
let refreshPromise = null

async function refreshAccessToken() {
  const refreshToken = localStorage.getItem('refresh_token')
  if (!refreshToken) {
    throw new Error('Không có refresh token')
  }
  // Dùng axios gốc (không phải apiClient) để không đi qua interceptor này lần nữa
  // và không tự gắn access token cũ (đã hết hạn) vào request refresh.
  const { data } = await axios.post(`${BASE_URL}/auth/refresh`, { refreshToken })
  localStorage.setItem('access_token', data.accessToken)
  localStorage.setItem('refresh_token', data.refreshToken)
  return data.accessToken
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { config, response } = error

    const canRetryWithRefresh =
      response?.status === 401 &&
      config &&
      !config._retry &&
      !SKIP_REFRESH_URLS.some((url) => config.url?.includes(url)) &&
      Boolean(localStorage.getItem('refresh_token'))

    if (canRetryWithRefresh) {
      config._retry = true
      try {
        refreshPromise = refreshPromise || refreshAccessToken()
        const newAccessToken = await refreshPromise
        config.headers.Authorization = `Bearer ${newAccessToken}`
        return apiClient(config)
      } catch {
        clearSessionAndNotify()
        error.message = 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại'
        return Promise.reject(error)
      } finally {
        refreshPromise = null
      }
    }

    error.message = error.response?.data?.message || error.message
    return Promise.reject(error)
  },
)

export default apiClient
