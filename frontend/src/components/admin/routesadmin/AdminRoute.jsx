import { Navigate } from "react-router-dom";

export default function AdminRoute({ children }) {
    // Lấy token từ localStorage
    const token = localStorage.getItem("access_token");

    if (!token) {
        // alert("Bạn chưa đăng nhập! Đang chuyển hướng về trang chủ...");
        return <Navigate to="/" replace />;
    }

    try {
        // Cắt phần Payload của JWT và giải mã bằng hàm atob
        const payloadBase64 = token.split('.')[1];
        const decodedToken = JSON.parse(atob(payloadBase64));

        // Kiểm tra quyền
        if (decodedToken.role === "admin") {
            return children;
        } else {
            // alert("Bạn không có quyền truy cập trang này! Đang chuyển hướng về trang chủ...");
            return <Navigate to="/" replace />;
        }
    } catch (error) {
        console.error("Lỗi giải mã token:", error);
        alert("Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại!");
        return <Navigate to="/" replace />;
    }
}