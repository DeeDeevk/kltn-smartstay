import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import apiClient from '../services/apiClient'

const AuthContext = createContext(null)

const STORAGE_KEYS = {
  accessToken: 'access_token',
  refreshToken: 'refresh_token',
  user: 'auth_user',
}

const readStoredUser = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.user)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

const persistTokens = ({ accessToken, refreshToken }) => {
  localStorage.setItem(STORAGE_KEYS.accessToken, accessToken)
  localStorage.setItem(STORAGE_KEYS.refreshToken, refreshToken)
}

const clearSession = () => {
  localStorage.removeItem(STORAGE_KEYS.accessToken)
  localStorage.removeItem(STORAGE_KEYS.refreshToken)
  localStorage.removeItem(STORAGE_KEYS.user)
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => readStoredUser())

  // Khi app tải lại, lấy hồ sơ mới nhất từ backend thay vì tin vào bản lưu cũ trong localStorage.
  // Nếu access token đã hết hạn/không hợp lệ thì coi như đã đăng xuất.
  useEffect(() => {
    const token = localStorage.getItem(STORAGE_KEYS.accessToken)
    if (!token) return

    apiClient
      .get('/auth/me')
      .then(({ data }) => {
        const nextUser = { ...data, name: data.fullName }
        localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(nextUser))
        setUser(nextUser)
      })
      .catch(() => {
        clearSession()
        setUser(null)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Token endpoints (login/verify-otp) chỉ trả user rút gọn {userId, email, role}
  // nên sau khi lưu token, gọi thêm /auth/me để lấy đủ fullName, phone... ngay lập tức
  // thay vì phải đợi F5 lại trang mới có.
  const applySession = async (data) => {
    persistTokens(data)
    const { data: profile } = await apiClient.get('/auth/me')
    const nextUser = { ...profile, name: profile.fullName }
    localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(nextUser))
    setUser(nextUser)
    return nextUser
  }

  const login = async ({ email, password }) => {
    const { data } = await apiClient.post('/auth/login', { email, password })
    return applySession(data)
  }

  const register = async ({ fullName, email, phone, password }) => {
    const { data } = await apiClient.post('/auth/register', {
      fullName,
      email,
      phone,
      password,
    })
    return data
  }

  const verifyOtp = async ({ email, otp }) => {
    const { data } = await apiClient.post('/auth/verify-otp', { email, otp })
    return applySession(data)
  }

  const resendOtp = async (email) => {
    const { data } = await apiClient.post('/auth/resend-otp', { email })
    return data
  }

  // avatar chỉ lưu cục bộ (User entity ở backend không có cột này), các field còn lại
  // gửi lên backend qua PATCH /users/me để lưu thật.
  const updateProfile = async ({ name, phone, idNumber, address, avatar }) => {
    const { data } = await apiClient.patch('/users/me', {
      fullName: name,
      phone,
      idNumber,
      address,
    })
    const current = user || readStoredUser() || {}
    const nextUser = { ...data, name: data.fullName, avatar: avatar ?? current.avatar ?? '' }
    localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(nextUser))
    setUser(nextUser)
    return nextUser
  }

  const logout = async () => {
    try {
      await apiClient.post('/auth/logout')
    } catch {
      // Kể cả gọi backend thất bại vẫn xoá phiên cục bộ để user thoát ra được.
    }
    clearSession()
    setUser(null)
  }

  const value = useMemo(() => ({
    user,
    isAuthenticated: Boolean(user),
    login,
    register,
    verifyOtp,
    resendOtp,
    updateProfile,
    logout,
  }), [user])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
