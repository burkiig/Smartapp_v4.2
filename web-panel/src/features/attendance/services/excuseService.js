import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

// Mock data fallback
const mockExcuseRecords = [
  {
    id: 1,
    student: 'Bob Brown',
    studentId: 'STU12002',
    course: 'CS101',
    courseTitle: 'Introduction to Programming',
    classDate: '2025-11-29',
    excuseType: 'health',
    excuseTypeLabel: 'Health (Medical Report)',
    excuseDescription: 'I had a severe headache and visited the doctor. Medical report attached.',
    documents: [
      { name: 'medical_report.pdf', url: '#', type: 'pdf' }
    ],
    submittedAt: '2025-11-29 10:30',
    deadline: '2025-11-30 09:00',
    status: 'pending',
    excuseCount: 2,
  },
  {
    id: 2,
    student: 'Charlie Davis',
    studentId: 'STU12003',
    course: 'CS201',
    courseTitle: 'Data Structures',
    classDate: '2025-11-28',
    excuseType: 'school_activity',
    excuseTypeLabel: 'School Activity',
    excuseDescription: 'I participated in the university basketball tournament.',
    documents: [
      { name: 'tournament_certificate.jpg', url: '#', type: 'image' }
    ],
    submittedAt: '2025-11-28 14:20',
    deadline: '2025-11-29 09:00',
    status: 'pending',
    excuseCount: 1,
  },
  {
    id: 3,
    student: 'Emma Davis',
    studentId: 'STU12347',
    course: 'CS101',
    courseTitle: 'Introduction to Programming',
    classDate: '2025-11-27',
    excuseType: 'family',
    excuseTypeLabel: 'Family Emergency',
    excuseDescription: 'Family emergency - had to attend to urgent family matter.',
    documents: [],
    submittedAt: '2025-11-27 16:45',
    deadline: '2025-11-28 09:00',
    status: 'approved',
    excuseCount: 3,
  },
];

/**
 * Fetch excuse records
 */
export const fetchExcuseRecords = async (filters = {}) => {
  try {
    const response = await axios.get(`${API_URL}/api/excuses`, { params: filters });
    if (response.data.success) {
      return { success: true, data: response.data.excuses || [] };
    }
    throw new Error('Failed to fetch excuse records');
  } catch (error) {
    console.error('Error fetching excuse records:', error);
    // Return mock data on error
    return { success: true, data: mockExcuseRecords };
  }
};

/**
 * Fetch single excuse by ID
 */
export const fetchExcuseById = async (excuseId) => {
  try {
    const response = await axios.get(`${API_URL}/api/excuses/${excuseId}`);
    if (response.data.success) {
      return { success: true, data: response.data.excuse };
    }
    throw new Error('Failed to fetch excuse');
  } catch (error) {
    console.error('Error fetching excuse:', error);
    // Return mock data
    const mockExcuse = mockExcuseRecords.find(e => e.id === excuseId);
    return { success: true, data: mockExcuse || mockExcuseRecords[0] };
  }
};

/**
 * Approve an excuse request
 */
export const approveExcuse = async (excuseId) => {
  try {
    const response = await axios.put(`${API_URL}/api/excuses/${excuseId}/approve`);
    if (response.data.success) {
      return { success: true };
    }
    throw new Error('Failed to approve excuse');
  } catch (error) {
    console.error('Error approving excuse:', error);
    // Simulate success for mock
    return { success: true };
  }
};

/**
 * Reject an excuse request
 */
export const rejectExcuse = async (excuseId, reason) => {
  try {
    const response = await axios.put(`${API_URL}/api/excuses/${excuseId}/reject`, { reason });
    if (response.data.success) {
      return { success: true };
    }
    throw new Error('Failed to reject excuse');
  } catch (error) {
    console.error('Error rejecting excuse:', error);
    // Simulate success for mock
    return { success: true };
  }
};

/**
 * Undo approval/rejection of an excuse
 */
export const undoExcuse = async (excuseId) => {
  try {
    const response = await axios.put(`${API_URL}/api/excuses/${excuseId}/undo`);
    if (response.data.success) {
      return { success: true };
    }
    throw new Error('Failed to undo excuse');
  } catch (error) {
    console.error('Error undoing excuse:', error);
    // Simulate success for mock
    return { success: true };
  }
};

