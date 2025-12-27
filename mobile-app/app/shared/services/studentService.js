import api from '../utils/apiAdapter';

/**
 * Student Service
 * Handles all student-related API calls
 */
export const studentService = {
    /**
     * Get all students
     * @returns {Promise<Array>} List of students
     */
    async getStudents() {
        try {
            const response = await api.get('/api/students');
            return response.students || [];
        } catch (error) {
            console.error('[StudentService] getStudents error:', error);
            throw error;
        }
    },

    /**
     * Get single student by ID
     * @param {string} studentId - Student ID
     * @returns {Promise<Object>} Student data
     */
    async getStudent(studentId) {
        try {
            const response = await api.get(`/api/students/${studentId}`);
            return response.student;
        } catch (error) {
            console.error('[StudentService] getStudent error:', error);
            throw error;
        }
    },

    /**
     * Register new student
     * @param {Object} studentData - Student data with image
     * @returns {Promise<Object>} Registration result
     */
    async registerStudent(studentData) {
        try {
            const response = await api.post('/api/register', studentData);
            return response;
        } catch (error) {
            console.error('[StudentService] registerStudent error:', error);
            throw error;
        }
    },

    /**
     * Delete student
     * @param {string} studentId - Student ID
     * @returns {Promise<Object>} Deletion result
     */
    async deleteStudent(studentId) {
        try {
            const response = await api.delete(`/api/students/${studentId}`);
            return response;
        } catch (error) {
            console.error('[StudentService] deleteStudent error:', error);
            throw error;
        }
    }
};
