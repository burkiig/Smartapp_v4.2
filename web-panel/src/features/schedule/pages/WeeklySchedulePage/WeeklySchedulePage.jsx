import React, { useState } from 'react';
import './WeeklySchedulePage.css';

export const WeeklySchedulePage = () => {
  const [currentWeek, setCurrentWeek] = useState(new Date());

  const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  const timeSlots = [
    '08:00', '09:00', '10:00', '11:00', '12:00', 
    '13:00', '14:00', '15:00', '16:00', '17:00'
  ];

  // Mock schedule data
  const schedule = {
    Monday: [
      { time: '09:00', course: 'CS101', room: 'A101', duration: 2 },
      { time: '14:00', course: 'CS102', room: 'B203', duration: 1 }
    ],
    Tuesday: [
      { time: '10:00', course: 'CS103', room: 'A102', duration: 2 }
    ],
    Wednesday: [
      { time: '09:00', course: 'CS101', room: 'A101', duration: 2 },
      { time: '13:00', course: 'CS104', room: 'C301', duration: 2 }
    ],
    Thursday: [
      { time: '11:00', course: 'CS102', room: 'B203', duration: 1 },
      { time: '15:00', course: 'CS103', room: 'A102', duration: 1 }
    ],
    Friday: [
      { time: '09:00', course: 'CS104', room: 'C301', duration: 2 }
    ]
  };

  const getWeekDates = () => {
    const curr = new Date(currentWeek);
    const first = curr.getDate() - curr.getDay() + 1;
    const dates = [];
    
    for (let i = 0; i < 5; i++) {
      const date = new Date(curr.setDate(first + i));
      dates.push(date);
    }
    
    return dates;
  };

  const weekDates = getWeekDates();

  const previousWeek = () => {
    const newDate = new Date(currentWeek);
    newDate.setDate(newDate.getDate() - 7);
    setCurrentWeek(newDate);
  };

  const nextWeek = () => {
    const newDate = new Date(currentWeek);
    newDate.setDate(newDate.getDate() + 7);
    setCurrentWeek(newDate);
  };

  const goToToday = () => {
    setCurrentWeek(new Date());
  };

  const formatDate = (date) => {
    return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
  };

  const isToday = (date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  return (
    <div className="weekly-schedule">
      <div className="schedule-header">
        <div className="header-left">
          <h1 className="page-title">Weekly Schedule</h1>
          <p className="page-subtitle">Haftalık Ders Programı</p>
        </div>
        <div className="header-right">
          <button className="nav-btn" onClick={previousWeek}>
            ← Previous
          </button>
          <button className="today-btn" onClick={goToToday}>
            Today
          </button>
          <button className="nav-btn" onClick={nextWeek}>
            Next →
          </button>
        </div>
      </div>

      <div className="schedule-container">
        <div className="schedule-grid">
          {/* Time column */}
          <div className="time-column">
            <div className="time-header"></div>
            {timeSlots.map(time => (
              <div key={time} className="time-slot">
                {time}
              </div>
            ))}
          </div>

          {/* Day columns */}
          {daysOfWeek.map((day, dayIndex) => (
            <div key={day} className="day-column">
              <div className={`day-header ${isToday(weekDates[dayIndex]) ? 'today' : ''}`}>
                <div className="day-name">{day}</div>
                <div className="day-date">{formatDate(weekDates[dayIndex])}</div>
              </div>
              
              <div className="day-slots">
                {timeSlots.map((time, timeIndex) => {
                  const classItem = schedule[day]?.find(item => item.time === time);
                  
                  return (
                    <div 
                      key={`${day}-${time}`} 
                      className={`schedule-slot ${classItem ? 'has-class' : ''}`}
                      style={classItem ? {
                        gridRow: `span ${classItem.duration}`,
                        background: '#3B82F6'
                      } : {}}
                    >
                      {classItem && (
                        <div className="class-info">
                          <div className="class-code">{classItem.course}</div>
                          <div className="class-room">📍 {classItem.room}</div>
                          <div className="class-time">
                            {classItem.time} - {parseInt(classItem.time) + classItem.duration}:00
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="schedule-legend">
        <div className="legend-item">
          <div className="legend-color" style={{background: '#3B82F6'}}></div>
          <span>Scheduled Class</span>
        </div>
        <div className="legend-item">
          <div className="legend-color" style={{background: '#34c759'}}></div>
          <span>Completed</span>
        </div>
        <div className="legend-item">
          <div className="legend-color" style={{background: '#ff9500'}}></div>
          <span>In Progress</span>
        </div>
        <div className="legend-item">
          <div className="legend-color" style={{background: '#ff3b30'}}></div>
          <span>Cancelled</span>
        </div>
      </div>

      <div className="schedule-summary">
        <h3>This Week Summary</h3>
        <div className="summary-stats">
          <div className="summary-item">
            <span className="summary-label">Total Classes</span>
            <span className="summary-value">12</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">Completed</span>
            <span className="summary-value">8</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">Upcoming</span>
            <span className="summary-value">4</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">Total Hours</span>
            <span className="summary-value">18h</span>
          </div>
        </div>
      </div>
    </div>
  );
};

