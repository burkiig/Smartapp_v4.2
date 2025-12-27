import React, { useState } from 'react';
import { StatsCard } from '../../../../shared/components/ui/StatsCard';
import { Table } from '../../../../shared/components/ui/Table';
import { Badge } from '../../../../shared/components/ui/Badge';
import './RecordsPage.css';

export const RecordsPage = () => {
  const [dateRange, setDateRange] = useState('This Month');
  const [course, setCourse] = useState('All Courses');
  const [attendanceMethod, setAttendanceMethod] = useState('All Methods');

  const stats = {
    totalClasses: 66,
    avgAttendance: 92,
    autoAttendance: 95,
    manualReviews: 30
  };

  const coursePerformance = [
    {
      course: 'CS101',
      classes: 24,
      avgAttendance: 94,
      trend: 'up',
      methods: { face: 95, qr: 95 }
    },
    {
      course: 'CS201',
      classes: 22,
      avgAttendance: 89,
      trend: 'down',
      methods: { face: 93, qr: 93 }
    },
    {
      course: 'CS301',
      classes: 20,
      avgAttendance: 92,
      trend: 'up',
      methods: { face: 94, qr: 94 }
    }
  ];

  const failureReasons = [
    { reason: 'Face verification failed', count: 12, percentage: 40, color: '#F59E0B' },
    { reason: 'GPS unstable', count: 9, percentage: 30, color: '#F59E0B' },
    { reason: 'Device integrity warning', count: 6, percentage: 20, color: '#F59E0B' },
    { reason: 'Network issue', count: 3, percentage: 10, color: '#F59E0B' }
  ];

  const exportPDF = () => {
    alert('Exporting as PDF...');
  };

  const exportExcel = () => {
    alert('Exporting as Excel...');
  };

  const scheduleReport = () => {
    alert('Schedule Report...');
  };

  // Prepare course performance table
  const courseTableColumns = [
    { key: 'course', label: 'Course' },
    { key: 'classes', label: 'Classes' },
    { 
      key: 'avgAttendance', 
      label: 'Avg Attendance',
      render: (value, row) => (
        <div className="attendance-cell">
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{width: `${row.avgAttendance}%`}}
            ></div>
          </div>
          <span className="attendance-value">{row.avgAttendance}%</span>
        </div>
      )
    },
    { 
      key: 'trend', 
      label: 'Trend',
      render: (value) => (
        <span className={`trend-icon ${value}`}>
          {value === 'up' ? '↑' : '↓'}
        </span>
      )
    },
    {
      key: 'methods',
      label: 'Methods',
      render: (value) => (
        <div className="methods-badges">
          <Badge variant="info" size="small" style={{ marginRight: '8px' }}>
            face {value.face}%
          </Badge>
          <Badge variant="info" size="small">
            QR {value.qr}%
          </Badge>
        </div>
      )
    }
  ];

  return (
    <div className="records-page-container">
      {/* Header */}
      <div className="records-header">
        <div>
          <h1 className="page-title">Reports & Analytics</h1>
          <p className="page-subtitle">View attendance insights and export data</p>
        </div>
      </div>

      {/* Filters Section */}
      <div className="filters-section">
        <div className="filters-left">
          <span className="filter-icon">🔍</span>
          <span className="filter-label">Filters</span>
        </div>
        <div className="filters-right">
          <div className="filter-group">
            <label>Date Range</label>
            <select 
              value={dateRange} 
              onChange={(e) => setDateRange(e.target.value)}
              className="filter-select"
            >
              <option>This Month</option>
              <option>Last Month</option>
              <option>This Year</option>
              <option>Custom</option>
            </select>
          </div>

          <div className="filter-group">
            <label>Course</label>
            <select 
              value={course} 
              onChange={(e) => setCourse(e.target.value)}
              className="filter-select"
            >
              <option>All Courses</option>
              <option>Computer Science</option>
              <option>Mathematics</option>
              <option>Physics</option>
            </select>
          </div>

          <div className="filter-group">
            <label>Attendance Method</label>
            <select 
              value={attendanceMethod} 
              onChange={(e) => setAttendanceMethod(e.target.value)}
              className="filter-select"
            >
              <option>All Methods</option>
              <option>Face Recognition</option>
              <option>QR Code</option>
              <option>Manual</option>
            </select>
          </div>

          <button className="export-btn" onClick={exportPDF}>
            📥 Export Report
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="stats-grid">
        <StatsCard
          icon="📚"
          title="Total Classes"
          value={stats.totalClasses}
          trend="up"
          trendValue="+8% from last month"
          color="blue"
        />
        <StatsCard
          icon="📊"
          title="Avg Attendance"
          value={`${stats.avgAttendance}%`}
          trend="up"
          trendValue="+2% from last month"
          color="green"
        />
        <StatsCard
          icon="🤖"
          title="Auto Attendance"
          value={`${stats.autoAttendance}%`}
          subtitle="Face ID + QR"
          color="purple"
        />
        <StatsCard
          icon="👤"
          title="Manual Reviews"
          value={stats.manualReviews}
          subtitle="This month"
          color="orange"
        />
      </div>

      {/* Main Content Grid */}
      <div className="content-grid">
        {/* Course Performance */}
        <div className="content-section">
          <h2 className="section-title">Course Performance</h2>
          <Table 
            columns={courseTableColumns} 
            data={coursePerformance}
            emptyMessage="No course data available"
          />
        </div>

        {/* Common Failure Reasons */}
        <div className="content-section">
          <h2 className="section-title">Common Failure Reasons</h2>
          <div className="failure-reasons">
            {failureReasons.map((item, index) => (
              <div key={index} className="failure-item">
                <div className="failure-header">
                  <span className="failure-reason">{item.reason}</span>
                  <span className="failure-count">{item.count}</span>
                </div>
                <div className="failure-bar-container">
                  <div 
                    className="failure-bar" 
                    style={{
                      width: `${item.percentage}%`,
                      background: item.color
                    }}
                  ></div>
                </div>
                <div className="failure-percentage">{item.percentage}%</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Export Options */}
      <div className="export-section">
        <h2 className="section-title">Export Options</h2>
        <div className="export-buttons">
          <button className="export-option-btn" onClick={exportPDF}>
            <span className="export-icon">📄</span>
            <span>Export as PDF</span>
          </button>
          <button className="export-option-btn" onClick={exportExcel}>
            <span className="export-icon">📊</span>
            <span>Export as Excel</span>
          </button>
          <button className="export-option-btn" onClick={scheduleReport}>
            <span className="export-icon">📅</span>
            <span>Schedule Report</span>
          </button>
        </div>
      </div>
    </div>
  );
};

