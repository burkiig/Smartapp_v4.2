// API Base URL - .env dosyasından gelecek
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000';

// Mock data - Backend olmadan test için
const MOCK_UPCOMING_CLASSES = [
    {
        id: 1,
        course: 'CS101',
        title: 'Introduction to Programming',
        date: new Date(Date.now() + 86400000).toISOString().split('T')[0], // Tomorrow
        time: '09:00 - 10:30',
        room: 'Room 401',
        status: 'scheduled',
        students_enrolled: 45
    },
    {
        id: 2,
        course: 'CS201',
        title: 'Data Structures',
        date: new Date(Date.now() + 86400000).toISOString().split('T')[0], // Tomorrow
        time: '14:00 - 15:30',
        room: 'Lab 204',
        status: 'scheduled',
        students_enrolled: 38
    },
    {
        id: 3,
        course: 'CS301',
        title: 'Algorithms',
        date: new Date(Date.now() + 172800000).toISOString().split('T')[0], // 2 days
        time: '16:00 - 17:30',
        room: 'Room 405',
        status: 'scheduled',
        students_enrolled: 32
    },
    {
        id: 4,
        course: 'CS102',
        title: 'Advanced Programming',
        date: new Date(Date.now() + 259200000).toISOString().split('T')[0], // 3 days
        time: '10:00 - 11:30',
        room: 'Lab 301',
        status: 'scheduled',
        students_enrolled: 40
    },
];

/**
 * Gelecek tarihli dersleri getir
 * @param {string} instructorId - Instructor ID
 * @returns {Promise} API response
 */
export const getUpcomingClasses = async (instructorId) => {
    try {
        // Mock data döndür - Backend olmadan çalışması için
        console.log('Using mock data for upcoming classes');

        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 500));

        return {
            success: true,
            classes: MOCK_UPCOMING_CLASSES
        };

        /* Backend hazır olduğunda bu kodu kullan:
        const response = await fetch(
          `${API_BASE_URL}/api/classes/upcoming?instructor_id=${instructorId}`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        return data;
        */
    } catch (error) {
        console.error('Get upcoming classes error:', error);
        throw error;
    }
};

/**
 * Dersi iptal et
 * @param {number} classId - Class ID
 * @param {string} reason - İptal sebebi
 * @param {string} instructorId - Instructor ID
 * @returns {Promise} API response
 */
export const cancelClass = async (classId, reason, instructorId) => {
    try {
        // Mock response döndür - Backend olmadan çalışması için
        console.log(`Mock: Cancelling class ${classId} with reason: ${reason}`);

        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 800));

        return {
            success: true,
            message: 'Ders başarıyla iptal edildi',
            cancellation: {
                class_id: classId,
                reason: reason,
                instructor_id: instructorId,
                cancelled_at: new Date().toISOString(),
                status: 'cancelled'
            }
        };

        /* Backend hazır olduğunda bu kodu kullan:
        const response = await fetch(
          `${API_BASE_URL}/api/classes/cancel`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              class_id: classId,
              reason: reason,
              instructor_id: instructorId,
              timestamp: new Date().toISOString()
            })
          }
        );
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        return data;
        */
    } catch (error) {
        console.error('Cancel class error:', error);
        throw error;
    }
};
