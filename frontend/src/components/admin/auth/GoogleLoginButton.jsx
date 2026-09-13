import { useEffect, useRef, useState } from 'react';

const GSI_SRC = 'https://accounts.google.com/gsi/client';
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

// Nạp script Google Identity Services đúng 1 lần cho cả app: component này có thể
// bị mount lại nhiều lần (chuyển qua lại /login, /register) nên phải kiểm tra cả
// trường hợp script đã có sẵn lẫn trường hợp đang tải dở.
function loadGsiScript() {
  if (window.google?.accounts?.id) {
    return Promise.resolve();
  }

  const existing = document.querySelector(`script[src="${GSI_SRC}"]`);
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('GSI script failed')));
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = GSI_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('GSI script failed'));
    document.head.appendChild(script);
  });
}

/**
 * Hiển thị nút "Đăng nhập bằng Google" chính chủ của Google.
 * Khi người dùng chọn tài khoản, Google trả về ID token qua callback và component
 * chuyển tiếp token đó ra ngoài qua prop `onCredential` để gọi API backend.
 */
export default function GoogleLoginButton({ onCredential, disabled = false }) {
  const containerRef = useRef(null);
  const callbackRef = useRef(onCredential);
  const [unavailable, setUnavailable] = useState(false);

  // Giữ callback mới nhất trong ref để không phải khởi tạo lại nút Google mỗi lần
  // component render (khởi tạo lại sẽ làm nút nhấp nháy).
  useEffect(() => {
    callbackRef.current = onCredential;
  }, [onCredential]);

  useEffect(() => {
    if (!CLIENT_ID) {
      console.warn('Thiếu VITE_GOOGLE_CLIENT_ID trong .env — ẩn nút đăng nhập Google');
      setUnavailable(true);
      return undefined;
    }

    let cancelled = false;

    loadGsiScript()
      .then(() => {
        if (cancelled || !containerRef.current) return;

        window.google.accounts.id.initialize({
          client_id: CLIENT_ID,
          callback: (response) => {
            if (response?.credential) {
              callbackRef.current?.(response.credential);
            }
          },
        });

        containerRef.current.innerHTML = '';
        window.google.accounts.id.renderButton(containerRef.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          shape: 'pill',
          text: 'continue_with',
          logo_alignment: 'center',
          locale: 'vi',
          width: containerRef.current.offsetWidth || 320,
        });
      })
      .catch(() => {
        if (!cancelled) setUnavailable(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (unavailable) return null;

  return (
    <div
      ref={containerRef}
      className={`flex min-h-[44px] justify-center ${disabled ? 'pointer-events-none opacity-60' : ''}`}
    />
  );
}
