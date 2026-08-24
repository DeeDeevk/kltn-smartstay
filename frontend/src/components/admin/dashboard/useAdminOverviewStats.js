import { useCallback, useEffect, useState } from 'react';
import apiClient from '../../../services/apiClient';

const BOOKING_STATUSES = ['PENDING', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED'];
const USER_ROLES = ['CUSTOMER', 'STAFF', 'ADMIN'];

const countByField = (rooms, field) =>
  rooms.reduce((acc, room) => {
    acc[room[field]] = (acc[room[field]] || 0) + 1;
    return acc;
  }, {});

// Không có endpoint thống kê tổng hợp riêng (thuộc phạm vi module /dashboard sau này),
// nên gom số liệu thật từ các endpoint list đã có sẵn (users/bookings/rooms/room-types)
// bằng các lệnh gọi limit=1 rẻ tiền để chỉ lấy "total", chạy song song.
export default function useAdminOverviewStats() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [
        usersTotalRes,
        ...userRoleResults
      ] = await Promise.all([
        apiClient.get('/users', { params: { limit: 1 } }),
        ...USER_ROLES.map((role) => apiClient.get('/users', { params: { role, limit: 1 } })),
      ]);

      const [bookingsTotalRes, ...bookingStatusResults] = await Promise.all([
        apiClient.get('/bookings', { params: { limit: 1 } }),
        ...BOOKING_STATUSES.map((status) =>
          apiClient.get('/bookings', { params: { status, limit: 1 } }),
        ),
      ]);

      const [roomsRes, roomTypesRes] = await Promise.all([
        apiClient.get('/rooms/map'),
        apiClient.get('/room-types'),
      ]);

      const rooms = roomsRes.data;
      const roomsByStatus = countByField(rooms, 'status');

      setStats({
        users: {
          total: usersTotalRes.data.total,
          byRole: Object.fromEntries(
            USER_ROLES.map((role, i) => [role, userRoleResults[i].data.total]),
          ),
        },
        bookings: {
          total: bookingsTotalRes.data.total,
          byStatus: Object.fromEntries(
            BOOKING_STATUSES.map((status, i) => [status, bookingStatusResults[i].data.total]),
          ),
        },
        rooms: {
          total: rooms.length,
          byStatus: roomsByStatus,
        },
        roomTypes: {
          total: roomTypesRes.data.length,
        },
      });
    } catch (err) {
      setError(err.message || 'Không thể tải số liệu tổng quan');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { stats, loading, error, reload: load };
}
