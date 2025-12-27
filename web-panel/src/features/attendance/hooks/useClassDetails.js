import { useState, useCallback } from 'react';
import { fetchClassDetails } from '../services/attendanceService';

export const useClassDetails = () => {
  const [classData, setClassData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch class details
  const loadClassDetails = useCallback(async (classId) => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchClassDetails(classId);
      if (result.success) {
        setClassData(result.data);
        return { success: true, data: result.data };
      } else {
        setError('Failed to load class details');
        return { success: false, error: 'Failed to load class details' };
      }
    } catch (err) {
      setError(err.message);
      console.error('Error loading class details:', err);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, []);

  // Mark student attendance manually
  const markAttendance = useCallback(async (studentId, status) => {
    // This would typically call an API
    // For now, we'll just update local state if classData exists
    if (classData && classData.students) {
      setClassData(prev => ({
        ...prev,
        students: prev.students.map(student =>
          student.id === studentId ? { ...student, status } : student
        )
      }));
      return { success: true };
    }
    return { success: false, error: 'Class data not loaded' };
  }, [classData]);

  // Cancel class
  const cancelClass = useCallback(async (reason) => {
    // This would typically call an API
    if (classData) {
      setClassData(prev => ({
        ...prev,
        status: 'Cancelled',
        cancelReason: reason
      }));
      return { success: true };
    }
    return { success: false, error: 'Class data not loaded' };
  }, [classData]);

  return {
    classData,
    loading,
    error,
    loadClassDetails,
    markAttendance,
    cancelClass
  };
};

