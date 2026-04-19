import { useState, useEffect, useCallback } from 'react';
import apiClient from '../../../shared/services/apiClient';

export const useStudents = () => {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadStudents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.get('/users/students');
      setStudents(data || []);
    } catch (err) {
      console.error('Error loading students:', err);
      setError(err.message);
      setStudents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  const deleteStudent = useCallback(async (userId) => {
    try {
      await apiClient.delete(`/users/${userId}`);
      setStudents(prev => prev.filter(s => s.id !== userId));
      return { success: true };
    } catch (err) {
      console.error('Error deleting student:', err);
      return { success: false, error: err.message };
    }
  }, []);

  return { students, loading, error, loadStudents, deleteStudent };
};
