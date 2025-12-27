import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { config } from '../../../shared/config/env';
import { ClassDetails } from '../../attendance/components/ClassDetails';
import './DashboardView.css';

function DashboardView() {
    const [stats, setStats] = useState({
        totalClasses: 0,
        avgAttendance: 0,
        autoAttendance: 0,
        manualReviews: 0,
        totalStudents: 0,
        presentToday: 0
    });

    const [loading, setLoading] = useState(true);
    const [selectedClass, setSelectedClass] = useState(null);

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const fetchDashboardData = async () => {
        try {
            setLoading(true);
            const [studentsRes, recordsRes] = await Promise.all([
                axios.get(`${config.API_URL}/api/students`),
                axios.get(`${config.API_URL}/api/attendance/records`)
            ]);

            const students = studentsRes.data.students || [];
            const records = recordsRes.data.records || [];

            // Calculate statistics
            const totalStudents = students.length;
            const uniqueDates = [...new Set(records.map(r => r.timestamp.split('T')[0]))];
            const totalClasses = uniqueDates.length;

            // Calculate average attendance
            const avgAttendance = totalClasses > 0
                ? Math.round((records.length / (totalClasses * totalStudents)) * 100)
                : 0;

            // Today's attendance
            const today = new Date().toISOString().split('T')[0];
            const presentToday = records.filter(r => r.timestamp.startsWith(today)).length;

            setStats({
                totalClasses,
                avgAttendance: isNaN(avgAttendance) ? 0 : avgAttendance,
                autoAttendance: 95, // Mock data
                manualReviews: 30, // Mock data
                totalStudents,
                presentToday
            });
        } catch (error) {
            console.error('Error fetching dashboard data:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="dashboard-loading">
                <div className="spinner"></div>
                <p>Yükleniyor...</p>
            </div>
        );
    }

    const todaySchedule = [
        {
            id: 1,
            course: 'CS101',
            title: 'Introduction to Programming',
            time: '09:00 - 10:30',
            room: 'Room 401',
            status: 'upcoming',
            autoEnabled: true
        },
        {
            id: 2,
            course: 'CS201',
            title: 'Data Structures',
            time: '14:00 - 15:30',
            room: 'Lab 204',
            status: 'upcoming',
            autoEnabled: true
        },
        {
            id: 3,
            course: 'CS301',
            title: 'Database Systems',
            time: '16:00 - 17:30',
            room: 'Room 405',
            status: 'upcoming',
            autoEnabled: true
        }
    ];

    const activeSessions = [
        {
            id: 1,
            course: 'CS201',
            title: 'Data Structures',
            students: '42 of 45 students marked',
            status: 'active',
            startedAt: '15:16'
        }
    ];

    const pendingReviews = [
        {
            id: 1,
            student: 'Sarah Johnson',
            course: 'CS101',
            time: '09:05',
            reason: 'Face verification failed'
        },
        {
            id: 2,
            student: 'Michael Chen',
            course: 'CS201',
            time: '14:12',
            reason: 'GPS unstable'
        },
        {
            id: 3,
            student: 'Emma Davis',
            course: 'CS101',
            time: '09:08',
            reason: 'Device integrity warning'
        }
    ];

    // If a class is selected, show ClassDetails
    if (selectedClass) {
        return <ClassDetails classData={selectedClass} onBack={() => setSelectedClass(null)} />;
    }

    return (
        <div className="dashboard">
            <div className="dashboard-header">
                <div className="header-left">
                    <h1 className="page-title">Dashboard</h1>
                    <p className="page-subtitle">Monday, December 8, 2025</p>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="stats-grid-top">
                <div className="stat-card-small">
                    <div className="stat-icon blue">📋</div>
                    <div className="stat-content">
                        <div className="stat-value">{stats.totalClasses || 3}</div>
                        <div className="stat-label">Classes Today</div>
                    </div>
                </div>

                <div className="stat-card-small">
                    <div className="stat-icon green">✓</div>
                    <div className="stat-content">
                        <div className="stat-value">{stats.presentToday || 2}</div>
                        <div className="stat-label">Completed Today</div>
                    </div>
                </div>

                <div className="stat-card-small">
                    <div className="stat-icon orange">⚠</div>
                    <div className="stat-content">
                        <div className="stat-value">1</div>
                        <div className="stat-label">Active Sessions</div>
                    </div>
                </div>

                <div className="stat-card-small">
                    <div className="stat-icon yellow">⚡</div>
                    <div className="stat-content">
                        <div className="stat-value">3</div>
                        <div className="stat-label">Need Review</div>
                    </div>
                </div>
            </div>

            {/* Main Content Grid */}
            <div className="dashboard-grid">
                {/* Today's Schedule */}
                <div className="dashboard-section schedule-section">
                    <h2 className="section-title">Today's Schedule</h2>
                    <div className="schedule-list">
                        {todaySchedule.map(item => (
                            <div
                                key={item.id}
                                className="schedule-item clickable"
                                onClick={() => setSelectedClass(item)}
                            >
                                <div className="schedule-time">
                                    <span className="time-icon">🕐</span>
                                    <span>{item.time}</span>
                                </div>
                                <div className="schedule-details">
                                    <div className="schedule-course">{item.course} - {item.title}</div>
                                    <div className="schedule-meta">
                                        <span className="schedule-room">📍 {item.room}</span>
                                        {item.autoEnabled && (
                                            <span className="auto-badge">● Auto-enabled</span>
                                        )}
                                    </div>
                                </div>
                                <div className="schedule-status">
                                    <span className={`status-dot ${item.status}`}></span>
                                    <span className="status-text">{item.status === 'upcoming' ? 'Upcoming' : 'Completed'}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Right Column */}
                <div className="dashboard-right-column">
                    {/* Active Sessions */}
                    <div className="dashboard-section active-sessions">
                        <h2 className="section-title">Active Sessions</h2>
                        {activeSessions.length > 0 ? (
                            <div className="active-session-card">
                                <div className="session-header">
                                    <div>
                                        <div className="session-course">{activeSessions[0].course} - {activeSessions[0].title}</div>
                                        <div className="session-status">
                                            <span className="status-dot-green">●</span> Active
                                        </div>
                                    </div>
                                </div>
                                <div className="session-progress">
                                    <div className="progress-text">{activeSessions[0].students}</div>
                                    <div className="session-time">Session started at {activeSessions[0].startedAt}</div>
                                </div>
                            </div>
                        ) : (
                            <div className="empty-sessions">
                                <p>No active sessions</p>
                            </div>
                        )}
                    </div>

                    {/* Pending Manual Reviews */}
                    <div className="dashboard-section pending-reviews">
                        <div className="section-header-with-badge">
                            <h2 className="section-title">Pending Manual Reviews</h2>
                            <span className="count-badge">{pendingReviews.length}</span>
                        </div>
                        <div className="reviews-list">
                            {pendingReviews.map(review => (
                                <div key={review.id} className="review-item">
                                    <div className="review-student">{review.student}</div>
                                    <div className="review-details">
                                        <span className="review-course">{review.course}</span>
                                        <span className="review-time">{review.time}</span>
                                    </div>
                                    <div className="review-reason">{review.reason}</div>
                                </div>
                            ))}
                        </div>
                        <button className="view-all-btn">View All Flagged</button>
                    </div>

                    {/* Quick Actions */}
                    <div className="dashboard-section quick-actions">
                        <h2 className="section-title">Quick Actions</h2>
                        <div className="quick-actions-grid">
                            <button className="quick-action-btn">
                                <span>📊</span>
                                <span>Download Today's Report</span>
                            </button>
                            <button className="quick-action-btn">
                                <span>👥</span>
                                <span>View All Classes</span>
                            </button>
                            <button className="quick-action-btn">
                                <span>📄</span>
                                <span>Export Monthly Data</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default DashboardView;
