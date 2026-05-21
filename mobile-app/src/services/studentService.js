import apiAdapter from '@/utils/apiAdapter';

/**
 * Student Service
 * Handles all student-related API calls
 */
export const studentService = {
    async getStudents() {
        try {
            const response = await apiAdapter.get('/api/v1/users?role=student');
            return Array.isArray(response) ? response : (response.users || []);
        } catch (error) {
            console.error('[StudentService] getStudents error:', error);
            throw error;
        }
    },

    async getStudent(studentId) {
        try {
            const response = await apiAdapter.get(`/api/v1/users/${studentId}`);
            return response;
        } catch (error) {
            console.error('[StudentService] getStudent error:', error);
            throw error;
        }
    },

    async registerStudent(studentData) {
        try {
            const response = await apiAdapter.post('/api/v1/users/', studentData);
            return response;
        } catch (error) {
            console.error('[StudentService] registerStudent error:', error);
            throw error;
        }
    },

    async deleteStudent(studentId) {
        try {
            const response = await apiAdapter.delete(`/api/v1/users/${studentId}`);
            return response;
        } catch (error) {
            console.error('[StudentService] deleteStudent error:', error);
            throw error;
        }
    }
};
