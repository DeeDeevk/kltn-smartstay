import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

// Guard dùng chung cho mọi route cần đăng nhập, có thể giới hạn thêm theo role.
// - Chưa đăng nhập -> về /login, nhớ lại trang đang muốn vào để quay lại sau khi login.
// - Đã đăng nhập nhưng role không nằm trong danh sách cho phép -> trang 403.
export default function ProtectedRoute({ children, roles }) {
  const { user, isAuthenticated } = useAuth()
  const location = useLocation()

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />
  }

  if (roles && !roles.includes(user?.role)) {
    return <Navigate to="/403" replace />
  }

  return children
}
