import { useEffect, useState } from 'react';
import { getCheckInAvailability } from './dateUtils';

// Tính lại mỗi 30 giây để nút "Vô ca" tự bật lên đúng lúc tới giờ, không bắt
// người dùng phải F5 lại trang.
export default function useCheckInAvailability(assignment) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  return getCheckInAvailability(assignment, now);
}
