import { io } from 'socket.io-client'
import { getAccessToken } from './tokenStore'
import { refreshAccessToken } from './apiClient'

// Backend chạy socket.io trên cùng server HTTP, namespace mặc định — chỉ cần bỏ
// hậu tố '/api/v1' khỏi base URL REST (xem apiClient.js) là ra URL server cho socket.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api/v1'
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || API_BASE_URL.replace(/\/api\/v1\/?$/, '')

// autoConnect: false — SocketContext chủ động connect()/disconnect() theo trạng
// thái đăng nhập, không kết nối sẵn khi app vừa load lúc còn chưa biết auth state.
// auth dạng callback để mỗi lần (re)connect đều lấy access token mới nhất trong bộ nhớ
// (quan trọng sau khi login/logout hoặc access token vừa được refresh). Ngay sau F5 bộ
// nhớ còn trống (app chưa kịp refresh xong) -> tự refresh qua cookie rồi mới kết nối.
export const socket = io(SOCKET_URL, {
  autoConnect: false,
  auth: (cb) => {
    const token = getAccessToken()
    if (token) {
      cb({ token })
      return
    }
    refreshAccessToken()
      .then((newToken) => cb({ token: newToken }))
      .catch(() => cb({ token: null }))
  },
})

export default socket
