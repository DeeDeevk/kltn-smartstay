import { useEffect, useRef, useState } from 'react';

// Số đếm tăng dần tới giá trị đích (ease-out cubic) mỗi khi `value` đổi — dùng cho thẻ
// thống kê. Bắt đầu từ giá trị đang hiển thị nên nếu số đổi giữa chừng vẫn mượt, không
// nhảy về 0. Tự tắt hiệu ứng khi hệ điều hành bật "giảm chuyển động".
export default function AnimatedNumber({ value, duration = 700 }) {
  const target = Number(value) || 0;
  const [display, setDisplay] = useState(0);
  const currentRef = useRef(0);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      currentRef.current = target;
      setDisplay(target);
      return undefined;
    }

    const from = currentRef.current;
    const start = performance.now();
    let frame;
    const tick = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - (1 - progress) ** 3;
      currentRef.current = from + (target - from) * eased;
      setDisplay(currentRef.current);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);

  return <>{Math.round(display).toLocaleString('vi-VN')}</>;
}
