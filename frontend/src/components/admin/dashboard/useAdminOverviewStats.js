import { useCallback, useEffect, useState } from "react";
import apiClient from "../../../services/apiClient";
import { useSocket } from "../../../context/SocketContext";

// Các sự kiện làm đổi số đơn / trạng thái phòng / tiền thu — backend đã bắn sẵn vào
// phòng nhân viên (xem RealtimeGateway).
const REALTIME_EVENTS = [
  "booking:created",
  "booking:paid",
  "booking:cancelled",
  "room:status-changed",
];
// Check-out 1 lần có thể bắn vài sự kiện liền nhau -> gộp lại thành 1 lần gọi API.
const DEBOUNCE_MS = 1000;

export default function useAdminOverviewStats() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const socket = useSocket();

  // silent = true: tải ngầm khi có sự kiện realtime, không bật skeleton (đỡ nhấp nháy).
  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get("/dashboard/overview");
      setStats(res.data);
    } catch (err) {
      // Don't leak the raw backend exception name (e.g. "ThrottlerException: Too Many
      // Requests") to the admin UI — show a friendly message instead for 429s.
      if (err.response?.status === 429) {
        setError(
          "Hệ thống đang xử lý nhiều yêu cầu, vui lòng thử lại sau ít phút.",
        );
      } else {
        setError(err.message || "Không thể tải số liệu tổng quan");
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    let timer;
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => load({ silent: true }), DEBOUNCE_MS);
    };
    REALTIME_EVENTS.forEach((e) => socket.on(e, refresh));
    return () => {
      clearTimeout(timer);
      REALTIME_EVENTS.forEach((e) => socket.off(e, refresh));
    };
  }, [socket, load]);

  return { stats, loading, error, reload: load };
}
