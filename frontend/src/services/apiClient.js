import axios from 'axios'
import { getAccessToken, setAccessToken } from './tokenStore'

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api/v1'

// 401 từ các endpoint này là kết quả cuối cùng của chính chúng (sai mật khẩu, refresh
// token không hợp lệ, OTP sai...), không phải do access token hết hạn, nên không nên
// thử refresh + retry cho các request này.
const SKIP_REFRESH_URLS = ['/auth/login', '/auth/register', '/auth/refresh', '/auth/verify-otp', '/auth/resend-otp', '/auth/forgot-password', '/auth/verify-reset-otp', '/auth/reset-password']

const apiClient = axios.create({
  baseURL: BASE_URL,
  // Gửi kèm cookie refresh_token (httpOnly) — cần cho /auth/refresh và /auth/logout.
  withCredentials: true,
})

apiClient.interceptors.request.use((config) => {
  const token = getAccessToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

function clearSessionAndNotify() {
  setAccessToken(null)
  localStorage.removeItem('auth_user')
  // AuthContext lắng nghe sự kiện này để đồng bộ lại state React (user/isAuthenticated)
  // mà không cần apiClient (module thuần) phải import ngược vào React context.
  window.dispatchEvent(new Event('auth:session-expired'))
}

// Nhiều request có thể cùng nhận 401 một lúc (vd. gọi song song); dùng chung một
// promise refresh để chỉ có đúng 1 lần gọi /auth/refresh, tránh refresh token bị
// rotate (thu hồi) bởi lần gọi đầu khiến lần gọi thứ hai thất bại oan.
let refreshPromise = null

// Export để AuthContext (khôi phục phiên sau F5) và socket dùng chung. Refresh token
// nằm trong cookie httpOnly nên không cần (và không thể) đọc nó ở đây — trình duyệt
// tự gửi kèm nhờ withCredentials.
export function refreshAccessToken() {
  if (!refreshPromise) {
    // Dùng axios gốc (không phải apiClient) để không đi qua interceptor này lần nữa
    // và không tự gắn access token cũ (đã hết hạn) vào request refresh.
    refreshPromise = axios
      .post(`${BASE_URL}/auth/refresh`, {}, { withCredentials: true })
      .then(({ data }) => {
        setAccessToken(data.accessToken)
        return data.accessToken
      })
      .finally(() => {
        refreshPromise = null
      })
  }
  return refreshPromise
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { config, response } = error

    const canRetryWithRefresh =
      response?.status === 401 &&
      config &&
      !config._retry &&
      !SKIP_REFRESH_URLS.some((url) => config.url?.includes(url))

    if (canRetryWithRefresh) {
      config._retry = true
      try {
        const newAccessToken = await refreshAccessToken()
        config.headers.Authorization = `Bearer ${newAccessToken}`
        return apiClient(config)
      } catch {
        clearSessionAndNotify()
        error.message = 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại'
        return Promise.reject(error)
      }
    }

    error.message = error.response?.data?.message || error.message
    return Promise.reject(error)
  },
)

export default apiClient
