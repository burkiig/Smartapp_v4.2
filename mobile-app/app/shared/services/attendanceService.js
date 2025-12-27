import api from '../utils/apiAdapter';

/**
 * Attendance Service
 * Handles all attendance-related API calls
 */
export const attendanceService = {
    /**
     * Get attendance records
     * @param {string} date - Optional date filter (YYYY-MM-DD)
     * @returns {Promise<Array>} Attendance records
     */
    async getRecords(date) {
        try {
            const params = date ? `?date=${date}` : '';
            const response = await api.get(`/api/attendance/records${params}`);
            return response.records || [];
        } catch (error) {
            console.error('[AttendanceService] getRecords error:', error);
            throw error;
        }
    },

    /**
     * Mark attendance with face recognition
     * @param {string} imageData - Base64 encoded image
     * @returns {Promise<Object>} Attendance result
     */
    async markAttendance(imageData) {
        try {
            const response = await api.post('/api/attendance', {
                image: imageData
            });
            return response;
        } catch (error) {
            console.error('[AttendanceService] markAttendance error:', error);
            throw error;
        }
    },

    /**
     * Get attendance by student ID
     * @param {string} studentId - Student ID
     * @returns {Promise<Array>} Student's attendance records
     */
    async getByStudent(studentId) {
        try {
            const response = await api.get(`/api/attendance/student/${studentId}`);
            return response.records || [];
        } catch (error) {
            console.error('[AttendanceService] getByStudent error:', error);
            throw error;
        }
    },

    /**
     * Get dashboard stats
     * @returns {Promise<Object>} Dashboard statistics
     */
    async getDashboardStats() {
        try {
            const response = await api.get('/api/dashboard/stats');
            return response.stats || {};
        } catch (error) {
            console.error('[AttendanceService] getDashboardStats error:', error);
            throw error;
        }
    }
};
