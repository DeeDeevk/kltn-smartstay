import { io } from 'socket.io-client'

// Backend chạy socket.io trên cùng server HTTP, namespace mặc định — chỉ cần bỏ
// hậu tố '/api/v1' khỏi base URL REST (xem apiClient.js) là ra URL server cho socket.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api/v1'
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || API_BASE_URL.replace(/\/api\/v1\/?$/, '')

// autoConnect: false — SocketContext chủ động connect()/disconnect() theo trạng
// thái đăng nhập, không kết nối sẵn khi app vừa load lúc còn chưa biết auth state.
// auth dạng callback để mỗi lần (re)connect đều lấy token mới nhất trong localStorage
// (quan trọng sau khi login/logout hoặc access token vừa được refresh).
export const socket = io(SOCKET_URL, {
  autoConnect: false,
  auth: (cb) => cb({ token: localStorage.getItem('access_token') }),
})

export default socket
