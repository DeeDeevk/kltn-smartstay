import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import apiClient, { refreshAccessToken } from "../services/apiClient";
import { setAccessToken } from "../services/tokenStore";
import { resetApiCaches, store } from "../store";
import { authApi } from "../services/auth";

const AuthContext = createContext(null);

// Chỉ còn lưu thông tin hiển thị (tên, email...) để F5 hiện ngay tên người dùng —
// không phải bí mật. Token KHÔNG còn nằm trong localStorage: access token giữ trong bộ
// nhớ (tokenStore), refresh token nằm trong cookie httpOnly do backend đặt.
const STORAGE_KEYS = {
  user: "auth_user",
};

const readStoredUser = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.user);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

// Refresh token do backend đặt vào cookie httpOnly trong cùng response — ở đây chỉ
// giữ access token trong bộ nhớ.
const persistTokens = ({ accessToken }) => {
  setAccessToken(accessToken);
};

const clearSession = () => {
  setAccessToken(null);
  localStorage.removeItem(STORAGE_KEYS.user);
  // Dọn token còn sót lại từ phiên bản cũ (khi token còn lưu localStorage).
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => readStoredUser());

  // Sau F5 access token trong bộ nhớ đã mất -> dùng cookie refresh token lấy access
  // token mới, rồi tải hồ sơ mới nhất. Refresh thất bại (hết hạn/bị thu hồi/đã đăng xuất
  // ở tab khác) thì coi như đã đăng xuất. Chỉ thử khi lần trước đã đăng nhập (còn
  // auth_user) để khách vãng lai mở web không bắn 1 request /auth/refresh lỗi 401.
  useEffect(() => {
    if (!readStoredUser()) return;

    refreshAccessToken()
      .then(() => apiClient.get("/auth/me"))
      .then(({ data }) => {
        const nextUser = { ...data, name: data.fullName };
        localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(nextUser));
        setUser(nextUser);
      })
      .catch(() => {
        clearSession();
        setUser(null);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // apiClient tự xử lý refresh access token khi gặp 401 (xem apiClient.js); nếu
  // refresh token cũng không còn hợp lệ, nó xoá localStorage và bắn sự kiện này để
  // context đồng bộ lại state React (user/isAuthenticated) mà không cần import ngược.
  useEffect(() => {
    const handleSessionExpired = () => {
      resetApiCaches();
      setUser(null);
    };
    window.addEventListener("auth:session-expired", handleSessionExpired);
    return () =>
      window.removeEventListener("auth:session-expired", handleSessionExpired);
  }, []);

  // Token endpoints (login/verify-otp) chỉ trả user rút gọn {userId, email, role}
  // nên sau khi lưu token, gọi thêm /auth/me để lấy đủ fullName, phone... ngay lập tức
  // thay vì phải đợi F5 lại trang mới có.
  const applySession = async (data) => {
    persistTokens(data);
    const { data: profile } = await apiClient.get("/auth/me");
    const nextUser = { ...profile, name: profile.fullName };
    localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(nextUser));
    // Đăng nhập tài khoản khác mà chưa đăng xuất (cookie bị ghi đè) cũng phải bỏ
    // cache của tài khoản cũ.
    resetApiCaches();
    setUser(nextUser);
    return nextUser;
  };

  // Đăng nhập/đăng ký đi qua RTK Query mutation (authApi) thay vì gọi apiClient
  // trực tiếp, theo đúng Technical Notes của US-đăng ký/đăng nhập. Context vẫn giữ
  // nguyên API công khai (login/register/verifyOtp/resendOtp) để không phải sửa
  // các nơi khác đang dùng useAuth().
  const login = async ({ email, password, turnstileToken }) => {
    const data = await store
      .dispatch(
        authApi.endpoints.login.initiate({ email, password, turnstileToken }),
      )
      .unwrap();
    return applySession(data);
  };

  // Google Identity Services tra ve ID token o phia client; backend tu verify
  // token do voi Google roi cap cap token cua he thong nhu dang nhap thuong.
  const loginWithGoogle = async (idToken) => {
    const data = await store
      .dispatch(authApi.endpoints.googleLogin.initiate(idToken))
      .unwrap();
    return applySession(data);
  };

  const register = async ({ fullName, email, phone, password }) => {
    const data = await store
      .dispatch(
        authApi.endpoints.register.initiate({
          fullName,
          email,
          phone,
          password,
        }),
      )
      .unwrap();
    return data;
  };

  // Xác minh OTP chỉ để kích hoạt/tạo tài khoản. KHÔNG lưu token ở đây — người dùng
  // sẽ tự đăng nhập lại sau khi đăng ký thành công (xem RegisterForm.handleVerified).
  const verifyOtp = async ({ email, otp }) => {
    const data = await store
      .dispatch(authApi.endpoints.verifyOtp.initiate({ email, otp }))
      .unwrap();
    return data;
  };

  const resendOtp = async (email) => {
    const data = await store
      .dispatch(authApi.endpoints.resendOtp.initiate(email))
      .unwrap();
    return data;
  };

  // avatar chỉ lưu cục bộ (User entity ở backend không có cột này), các field còn lại
  // gửi lên backend qua PATCH /users/me để lưu thật.
  const updateProfile = async ({ name, phone, idNumber, address, avatar }) => {
    const { data } = await apiClient.patch("/users/me", {
      fullName: name,
      phone,
      idNumber,
      address,
    });
    const current = user || readStoredUser() || {};
    const nextUser = {
      ...data,
      name: data.fullName,
      avatar: avatar ?? current.avatar ?? "",
    };
    localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(nextUser));
    setUser(nextUser);
    return nextUser;
  };

  // Lấy lại hồ sơ mới nhất từ /auth/me mà KHÔNG cần đăng nhập lại — dùng sau khi
  // đổi mật khẩu bắt buộc (ForceChangePasswordModal) để gỡ cờ mustChangePassword
  // khỏi state hiện tại thay vì bắt người dùng F5 trang.
  const refreshUser = async () => {
    const { data: profile } = await apiClient.get("/auth/me");
    const current = user || readStoredUser() || {};
    const nextUser = {
      ...profile,
      name: profile.fullName,
      avatar: current.avatar ?? "",
    };
    localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(nextUser));
    setUser(nextUser);
    return nextUser;
  };

  const logout = async () => {
    try {
      await apiClient.post("/auth/logout");
    } catch {
      // Kể cả gọi backend thất bại vẫn xoá phiên cục bộ để user thoát ra được.
    }
    clearSession();
    resetApiCaches();
    setUser(null);
  };

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      login,
      loginWithGoogle,
      register,
      verifyOtp,
      resendOtp,
      updateProfile,
      refreshUser,
      logout,
    }),
    [user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};
