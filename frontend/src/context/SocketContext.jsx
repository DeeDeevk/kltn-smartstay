import { createContext, useContext, useEffect } from 'react'
import socket from '../services/socketClient'
import { useAuth } from './AuthContext'

const SocketContext = createContext(socket)

// Chỉ giữ 1 kết nối socket duy nhất cho cả app, bật/tắt theo trạng thái đăng
// nhập — không kết nối khi chưa đăng nhập (gateway BE sẽ từ chối token rỗng).
export function SocketProvider({ children }) {
  const { isAuthenticated } = useAuth()

  useEffect(() => {
    if (isAuthenticated) {
      socket.connect()
    } else {
      socket.disconnect()
    }
  }, [isAuthenticated])

  return <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>
}

export const useSocket = () => useContext(SocketContext)
