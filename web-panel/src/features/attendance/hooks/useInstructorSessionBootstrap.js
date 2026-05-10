import { useState, useEffect, useCallback } from 'react';
import apiClient from '../../../shared/services/apiClient';

/** Shared course / room / active session loader for instructor QR and classroom flows. */
export function useInstructorSessionBootstrap() {
  const [courses, setCourses] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [activeSessions, setActiveSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async (options = {}) => {
    const silent = Boolean(options.silent);
    if (!silent) setLoading(true);
    try {
      const [c, s, r] = await Promise.allSettled([
        apiClient.get('/courses/'),
        apiClient.get('/sessions/active'),
        apiClient.get('/rooms/'),
      ]);
      if (c.status === 'fulfilled') setCourses(c.value || []);
      if (s.status === 'fulfilled') setActiveSessions(s.value || []);
      if (r.status === 'fulfilled') setRooms(r.value || []);
    } catch (err) {
      console.error('[useInstructorSessionBootstrap]', err);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return {
    courses,
    rooms,
    activeSessions,
    loading,
    reload,
  };
}
