import { useState, useEffect } from 'react';
import axios from 'axios';

export const useDashboard = () => {
  const [stats, setStats] = useState({
    totalClasses: 0,
    avgAttendance: 0,
    autoAttendance: 0,
    manualReviews: 0,
    totalStudents: 0,
    presentToday: 0
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [studentsRes, recordsRes] = await Promise.all([
        axios.get('http://localhost:5000/api/students'),
        axios.get('http://localhost:5000/api/attendance/records')
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
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setError('Failed to load dashboard data');
      
      // Set mock data on error
      setStats({
        totalClasses: 45,
        avgAttendance: 87,
        autoAttendance: 95,
        manualReviews: 30,
        totalStudents: 120,
        presentToday: 95
      });
    } finally {
      setLoading(false);
    }
  };

  const refreshData = () => {
    fetchDashboardData();
  };

  return {
    stats,
    loading,
    error,
    refreshData
  };
};

