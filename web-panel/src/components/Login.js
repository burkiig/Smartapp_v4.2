import React, { useState, useEffect } from 'react';
import './Login.css';

function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState('instructor');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [logoLoaded, setLogoLoaded] = useState(false);

  useEffect(() => {
    // Trigger animations after component mounts
    setTimeout(() => setLogoLoaded(true), 100);
  }, []);

  const roles = [
    { id: 'instructor', name: 'Instructor', icon: '👨‍🏫', color: '#4f46e5' },
    { id: 'student', name: 'Student', icon: '🎓', color: '#059669' },
    { id: 'admin', name: 'Admin', icon: '⚙️', color: '#dc2626' }
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Şimdilik backend olmadan mock login
    setTimeout(() => {
      // Mock kullanıcı verileri
      const mockUsers = {
        instructor1: {
          username: 'instructor1',
          role: 'instructor',
          name: 'Dr. Robert Chen',
          department: 'Computer Science',
          email: 'robert.chen@university.edu'
        },
        student1: {
          username: 'student1',
          role: 'student',
          name: 'John Doe',
          student_id: '2021001',
          email: 'john.doe@student.edu'
        },
        admin: {
          username: 'admin',
          role: 'admin',
          name: 'System Administrator',
          email: 'admin@attendance.com'
        }
      };

      const user = mockUsers[username];

      if (user && user.role === selectedRole) {
        onLogin(user);
      } else if (user && user.role !== selectedRole) {
        setError(`Bu kullanıcı ${selectedRole} değil. Lütfen doğru rol seçin.`);
      } else {
        setError('Kullanıcı adı veya şifre hatalı');
      }
      
      setLoading(false);
    }, 500);

    /* Backend ile çalışmak için bu kodu kullanın:
    try {
      const response = await fetch('http://localhost:5000/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (data.success) {
        if (data.user.role !== selectedRole) {
          setError(`Bu kullanıcı ${selectedRole} değil. Lütfen doğru rol seçin.`);
          setLoading(false);
          return;
        }
        onLogin(data.user);
      } else {
        setError(data.message || 'Giriş başarısız');
      }
    } catch (err) {
      setError('Bağlantı hatası. Lütfen backend sunucusunun çalıştığından emin olun.');
    } finally {
      setLoading(false);
    }
    */
  };

  const getDemoCredentials = () => {
    const credentials = {
      instructor: { username: 'instructor1', password: 'instructor123' },
      student: { username: 'student1', password: 'student123' },
      admin: { username: 'admin', password: 'admin123' }
    };
    return credentials[selectedRole];
  };

  const fillDemoCredentials = () => {
    const demo = getDemoCredentials();
    setUsername(demo.username);
    setPassword(demo.password);
  };

  return (
    <div className="login-container">
      <div className="login-background">
        <div className="login-shape shape-1"></div>
        <div className="login-shape shape-2"></div>
        <div className="login-shape shape-3"></div>
      </div>

      <div className="login-card">
        <div className="login-header">
          <div className={`login-logo ${logoLoaded ? 'logo-loaded' : ''}`}>
            <div className="logo-shimmer-wrapper">
              <div className="logo-icon-container">
                <span className="logo-icon">🎓</span>
              </div>
              <div className="shimmer-effect"></div>
            </div>
            <div className="logo-text-container">
              <span className="logo-text">Smart Attendance</span>
            </div>
          </div>
          <h1 className="login-title">Smart Attendance System</h1>
          <p className="login-subtitle">Web Panel Login</p>
        </div>

        <div className="role-selector">
          {roles.map((role) => (
            <button
              key={role.id}
              type="button"
              className={`role-button ${selectedRole === role.id ? 'active' : ''}`}
              onClick={() => setSelectedRole(role.id)}
              style={{
                '--role-color': role.color
              }}
            >
              <span className="role-icon">{role.icon}</span>
              <span className="role-name">{role.name}</span>
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          {error && (
            <div className="error-message">
              <span className="error-icon">⚠️</span>
              <span>{error}</span>
            </div>
          )}

          <div className="form-group">
            <label htmlFor="username" className="form-label">
              <span className="label-icon">👤</span>
              Username
            </label>
            <input
              type="text"
              id="username"
              className="form-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password" className="form-label">
              <span className="label-icon">🔒</span>
              Password
            </label>
            <input
              type="password"
              id="password"
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
            />
          </div>

          <button
            type="submit"
            className="login-button"
            disabled={loading}
            style={{
              '--role-color': roles.find(r => r.id === selectedRole)?.color
            }}
          >
            {loading ? (
              <>
                <span className="spinner"></span>
                Logging in...
              </>
            ) : (
              <>
                <span>Login as {roles.find(r => r.id === selectedRole)?.name}</span>
                <span className="login-arrow">→</span>
              </>
            )}
          </button>

          <button
            type="button"
            className="demo-button"
            onClick={fillDemoCredentials}
          >
            <span className="demo-icon">🎯</span>
            Use Demo Credentials
          </button>
        </form>

        <div className="login-footer">
          <div className="demo-info">
            <p className="demo-title">Demo Credentials:</p>
            <div className="demo-credentials">
              <div className="demo-credential">
                <strong>Instructor:</strong> instructor1 / instructor123
              </div>
              <div className="demo-credential">
                <strong>Student:</strong> student1 / student123
              </div>
              <div className="demo-credential">
                <strong>Admin:</strong> admin / admin123
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;

