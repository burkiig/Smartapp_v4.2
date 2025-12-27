// Mock users database
const mockUsers = {
  instructor1: {
    username: 'instructor1',
    password: 'pass123',
    role: 'instructor',
    name: 'Dr. Robert Chen',
    department: 'Computer Science',
    email: 'robert.chen@university.edu'
  },
  student1: {
    username: 'student1',
    password: 'pass123',
    role: 'student',
    name: 'John Doe',
    student_id: '2021001',
    email: 'john.doe@student.edu'
  },
  admin: {
    username: 'admin',
    password: 'admin123',
    role: 'admin',
    name: 'System Administrator',
    email: 'admin@attendance.com'
  }
};

/**
 * Mock login service
 * @param {string} username 
 * @param {string} password 
 * @param {string} role 
 * @returns {Promise<{success: boolean, user?: object, error?: string}>}
 */
export const loginUser = async (username, password, role) => {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 1000));

  const user = mockUsers[username];

  if (!user) {
    return {
      success: false,
      error: 'User not found'
    };
  }

  if (user.password !== password) {
    return {
      success: false,
      error: 'Invalid password'
    };
  }

  if (user.role !== role) {
    return {
      success: false,
      error: `This account is not registered as ${role}`
    };
  }

  // Remove password from response
  const { password: _, ...userWithoutPassword } = user;

  return {
    success: true,
    user: userWithoutPassword
  };
};

/**
 * Mock register service
 * @param {object} userData 
 * @returns {Promise<{success: boolean, message: string}>}
 */
export const registerUser = async (userData) => {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 1500));

  // Mock validation
  if (!userData.studentId || !userData.name || !userData.image) {
    return {
      success: false,
      message: 'All fields are required'
    };
  }

  // Mock success
  return {
    success: true,
    message: 'Registration successful! You can now login.'
  };
};

/**
 * Logout service
 */
export const logoutUser = async () => {
  try {
    await fetch('http://localhost:5000/api/logout', {
      method: 'POST',
    });
  } catch (error) {
    console.error('Logout error:', error);
  }
};

