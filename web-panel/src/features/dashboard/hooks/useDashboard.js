import { useState, useEffect, useCallback } from 'react';
import apiClient from '../../../shared/services/apiClient';

export const useDashboard = () => {
  const [stats, setStats] = useState(null);
  const [performance, setPerformance] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [statsData, perfData, activityData] = await Promise.allSettled([
        apiClient.get('/dashboard/stats'),
        apiClient.get('/dashboard/course-performance'),
        apiClient.get('/dashboard/recent-activity'),
      ]);

      if (statsData.status === 'fulfilled') {
        setStats(statsData.value);
      }
      if (perfData.status === 'fulfilled') {
        setPerformance(perfData.value || []);
      }
      if (activityData.status === 'fulfilled') {
        setRecentActivity(activityData.value?.activities || []);
      }
    } catch (err) {
      console.error('[useDashboard] Error:', err);
      setError('Dashboard verileri yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  return {
    stats,
    performance,
    recentActivity,
    loading,
    error,
    refreshData: fetchDashboardData,
  };
};
