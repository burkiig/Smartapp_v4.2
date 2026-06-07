import { useState, useEffect, useCallback } from 'react';
import { studentService } from '@/services/studentService';
import i18n from '@/i18n';

/**
 * Custom hook for managing students
 */
export const useStudents = () => {
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [refreshing, setRefreshing] = useState(false);

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
            setError(err.message || i18n.t('common.studentListFailed'));
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    const refresh = useCallback(() => {
        return fetchStudents(true);
    }, [fetchStudents]);

    const addStudent = useCallback(async (studentData) => {
        try {
            const result = await studentService.registerStudent(studentData);
            await fetchStudents();
            return result;
        } catch (err) {
            console.error('[useStudents] Add error:', err);
            throw err;
        }
    }, [fetchStudents]);

    const deleteStudent = useCallback(async (studentId) => {
        try {
            await studentService.deleteStudent(studentId);
            setStudents(prev => prev.filter(s => s.student_id !== studentId));
        } catch (err) {
            console.error('[useStudents] Delete error:', err);
            throw err;
        }
    }, []);

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
