import { useCallback, useEffect, useState } from 'react';
import apiClient from '../../../services/apiClient';

export default function useAdminOverviewStats() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get('/dashboard/overview');
      setStats(res.data);
    } catch (err) {
      // Don't leak the raw backend exception name (e.g. "ThrottlerException: Too Many
      // Requests") to the admin UI — show a friendly message instead for 429s.
      if (err.response?.status === 429) {
        setError('Hệ thống đang xử lý nhiều yêu cầu, vui lòng thử lại sau ít phút.');
      } else {
        setError(err.message || 'Không thể tải số liệu tổng quan');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { stats, loading, error, reload: load };
}
