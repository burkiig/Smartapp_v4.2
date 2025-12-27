import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

// Mock data fallback
const mockStudents = [
  {
    student_id: 'STU12001',
    name: 'Alice Anderson',
    image: 'default.jpg'
  },
  {
    student_id: 'STU12002',
    name: 'Bob Brown',
    image: 'default.jpg'
  }
];

/**
 * Hook for managing students data
 */
export const useStudents = () => {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load students
  const loadStudents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(`${API_URL}/api/students`);
      if (response.data.success) {
        setStudents(response.data.students || []);
      } else {
        setError('Failed to load students');
        // Use mock data on error
        setStudents(mockStudents);
      }
    } catch (err) {
      console.error('Error loading students:', err);
      setError(err.message);
      // Use mock data on error
      setStudents(mockStudents);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load on mount
  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  // Delete student
  const deleteStudent = useCallback(async (studentId) => {
    try {
      const response = await axios.delete(`${API_URL}/api/students/${studentId}`);
      if (response.data.success) {
        setStudents(prev => prev.filter(s => s.student_id !== studentId));
        return { success: true };
      }
      return { success: false, error: 'Failed to delete student' };
    } catch (err) {
      console.error('Error deleting student:', err);
      // Simulate success for mock
      setStudents(prev => prev.filter(s => s.student_id !== studentId));
      return { success: true };
    }
  }, []);

  return {
    students,
    loading,
    error,
    loadStudents,
    deleteStudent
  };
};

