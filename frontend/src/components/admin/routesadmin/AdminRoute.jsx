import { Navigate } from "react-router-dom";
import { toast } from "react-toastify";

export default function AdminRoute({ children }) {
    const token = localStorage.getItem("access_token");

    if (!token) {
        return <Navigate to="/" replace />;
    }

    try {
        // Vai trò đọc từ hồ sơ user đã lưu (đến từ /auth/me qua AuthContext),
        // tránh tự decode JWT bằng tay — cách cũ so sánh "admin" (chữ thường) trong khi
        // backend trả role là "ADMIN" (enum UserRole), nên trước đây không ai vào được trang admin.
        const storedUser = JSON.parse(localStorage.getItem("auth_user") || "null");

        if (storedUser?.role === "ADMIN") {
            return children;
        }

        toast.error("Bạn không có quyền truy cập trang này");
        return <Navigate to="/" replace />;
    } catch (error) {
        console.error("Lỗi đọc thông tin phiên đăng nhập:", error);
        toast.error("Phiên đăng nhập không hợp lệ, vui lòng đăng nhập lại");
        return <Navigate to="/" replace />;
    }
}