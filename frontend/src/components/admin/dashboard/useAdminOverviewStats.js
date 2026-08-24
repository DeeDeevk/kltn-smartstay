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
