// Access token chỉ sống trong bộ nhớ (mất khi F5 — app tự gọi /auth/refresh để lấy lại),
// không lưu localStorage để script lạ (XSS) không đọc được. Refresh token nằm trong
// cookie httpOnly do backend quản lý, JS phía trình duyệt không nhìn thấy.
let accessToken = null

export const getAccessToken = () => accessToken

export const setAccessToken = (token) => {
  accessToken = token || null
}
