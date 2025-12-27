import { useState, useEffect, useCallback } from 'react';
import { studentService } from '../services/studentService';

/**
 * Custom hook for managing students
 * @returns {Object} Students data and methods
 */
export const useStudents = () => {
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [refreshing, setRefreshing] = useState(false);

    /**
     * Fetch students from API
     */
    const fetchStudents = useCallback(async (isRefreshing = false) => {
        try {
            if (isRefreshing) {
                setRefreshing(true);
            } else {
                setLoading(true);
            }

            setError(null);
            const data = await studentService.getStudents();
            setStudents(data);
        } catch (err) {
            console.error('[useStudents] Fetch error:', err);
            setError(err.message || 'Failed to fetch students');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    /**
     * Refresh students (for pull-to-refresh)
     */
    const refresh = useCallback(() => {
        return fetchStudents(true);
    }, [fetchStudents]);

    /**
     * Add new student
     */
    const addStudent = useCallback(async (studentData) => {
        try {
            const result = await studentService.registerStudent(studentData);
            await fetchStudents(); // Refresh list
            return result;
        } catch (err) {
            console.error('[useStudents] Add error:', err);
            throw err;
        }
    }, [fetchStudents]);

    /**
     * Delete student
     */
    const deleteStudent = useCallback(async (studentId) => {
        try {
            await studentService.deleteStudent(studentId);
            // Update local state immediately
            setStudents(prev => prev.filter(s => s.student_id !== studentId));
        } catch (err) {
            console.error('[useStudents] Delete error:', err);
            throw err;
        }
    }, []);

    // Fetch on mount
    useEffect(() => {
        fetchStudents();
    }, [fetchStudents]);

    return {
        students,
        loading,
        error,
        refreshing,
        refresh,
        addStudent,
        deleteStudent,
        refetch: fetchStudents
    };
};
