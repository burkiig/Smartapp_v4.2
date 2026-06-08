import { useState, useEffect, useCallback } from 'react';
import apiClient from '../../../shared/services/apiClient';

export const useStudents = () => {
  const [students, setStudents] = useState([]);
  const [courses, setCourses] = useState([]);
  const [courseFilter, setCourseFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadCourses = useCallback(async () => {
    try {
      const data = await apiClient.get('/courses/');
      setCourses(Array.isArray(data) ? data : []);
    } catch {
      setCourses([]);
    }
  }, []);

  const loadStudents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = courseFilter
        ? await apiClient.get(`/courses/${courseFilter}/students`)
        : await apiClient.get('/users/students');
      setStudents(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error loading students:', err);
      setError(err.message);
      setStudents([]);
    } finally {
      setLoading(false);
    }
  }, [courseFilter]);

  useEffect(() => {
    loadCourses();
  }, [loadCourses]);

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

  return {
    students,
    courses,
    courseFilter,
    setCourseFilter,
    loading,
    error,
    loadStudents,
    deleteStudent,
  };
};
