import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'

const AuthContext = createContext(null)

const STORAGE_KEYS = {
  token: 'access_token',
  user: 'auth_user',
}

const base64UrlEncode = (value) =>
  btoa(unescape(encodeURIComponent(JSON.stringify(value))))

const createMockToken = ({ username, role }) => {
  const header = base64UrlEncode({ alg: 'HS256', typ: 'JWT' })
  const payload = base64UrlEncode({ username, role })
  return `${header}.${payload}.mock-signature`
}

const readStoredUser = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.user)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => readStoredUser())

  useEffect(() => {
    const token = localStorage.getItem(STORAGE_KEYS.token)
    if (token && !user) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]))
        setUser({ username: payload.username, role: payload.role })
      } catch {
        localStorage.removeItem(STORAGE_KEYS.token)
        localStorage.removeItem(STORAGE_KEYS.user)
      }
    }
  }, [user])

  const login = async ({ username, password }) => {
    if (!username || !password) {
      throw new Error('Vui lòng nhập đầy đủ thông tin đăng nhập')
    }

    const role = username.toLowerCase().includes('admin') ? 'admin' : 'user'
    // Preserve any profile data (name, email, phone, avatar) already stored for this username
    // instead of resetting it, so logging back in doesn't wipe out a previously saved profile.
    const existing = readStoredUser()
    const nextUser = {
      ...(existing?.username === username ? existing : {}),
      username,
      role,
    }
    localStorage.setItem(STORAGE_KEYS.token, createMockToken(nextUser))
    localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(nextUser))
    setUser(nextUser)
    return nextUser
  }

  const register = async (payload) => {
    if (!payload?.username || !payload?.password) {
      throw new Error('Vui lòng nhập đầy đủ thông tin đăng ký')
    }

    const nextUser = {
      username: payload.username,
      role: payload.role || 'user',
      name: payload.name || '',
      email: payload.email || '',
      phone: payload.phone_number || payload.phone || '',
      avatar: '',
    }
    localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(nextUser))
    return nextUser
  }

  const updateProfile = async (updates) => {
    const current = user || readStoredUser() || {}
    const nextUser = { ...current, ...updates }
    localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(nextUser))
    setUser(nextUser)
    return nextUser
  }

  const logout = async () => {
    localStorage.removeItem(STORAGE_KEYS.token)
    localStorage.removeItem(STORAGE_KEYS.user)
    setUser(null)
  }

  const value = useMemo(() => ({
    user,
    isAuthenticated: Boolean(user),
    login,
    register,
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
