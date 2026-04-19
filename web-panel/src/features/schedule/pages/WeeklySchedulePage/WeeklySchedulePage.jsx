import React, { useState, useEffect } from 'react';
import apiClient from '../../../../shared/services/apiClient';
import './WeeklySchedulePage.css';

const DAYS_TR = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma'];
const DAYS_EN = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const TIME_SLOTS = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'];

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4'];

export const WeeklySchedulePage = () => {
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCourses = async () => {
      setLoading(true);
      try {
        const data = await apiClient.get('/courses/');
        setCourses(data || []);
      } catch (err) {
        console.error('Error loading courses:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchCourses();
  }, []);

  const getWeekDates = () => {
    const curr = new Date(currentWeek);
    const day = curr.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const monday = new Date(curr);
    monday.setDate(curr.getDate() + diff);
    return DAYS_EN.map((_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return d;
    });
  };

  const weekDates = getWeekDates();

  const getScheduleForDay = (dayName) => {
    return courses.flatMap((c, idx) => {
      const sched = c.schedule;
      if (!sched) return [];
      const color = COLORS[idx % COLORS.length];
      // New format: { slots: [{day, start_time, end_time}] }
      if (Array.isArray(sched.slots)) {
        return sched.slots
          .filter(slot => slot.day === dayName)
          .map(slot => ({
            code: c.code,
            name: c.name,
            start_time: slot.start_time || '09:00',
            end_time: slot.end_time || '10:00',
            color,
          }));
      }
      // Old format: { days: [...], start_time, end_time }
      if (Array.isArray(sched.days) && sched.days.includes(dayName)) {
        return [{
          code: c.code,
          name: c.name,
          start_time: sched.start_time || '09:00',
          end_time: sched.end_time || '10:00',
          color,
        }];
      }
      return [];
    });
  };

  const formatDate = (date) => date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
  const isToday = (date) => date.toDateString() === new Date().toDateString();

  const prevWeek = () => {
    const d = new Date(currentWeek);
    d.setDate(d.getDate() - 7);
    setCurrentWeek(d);
  };

  const nextWeek = () => {
    const d = new Date(currentWeek);
    d.setDate(d.getDate() + 7);
    setCurrentWeek(d);
  };

  return (
    <div className="weekly-schedule">
      <div className="schedule-header">
        <div className="header-left">
          <h1 className="page-title">Haftalık Program</h1>
          <p className="page-subtitle">Ders Takvimi</p>
        </div>
        <div className="header-right">
          <button className="nav-btn" onClick={prevWeek}>← Önceki</button>
          <button className="today-btn" onClick={() => setCurrentWeek(new Date())}>Bugün</button>
          <button className="nav-btn" onClick={nextWeek}>Sonraki →</button>
        </div>
      </div>

      {loading ? (
        <div className="schedule-loading">Yükleniyor...</div>
      ) : courses.length === 0 ? (
        <div className="schedule-empty">
          <div style={{ textAlign: 'center', padding: '60px', color: '#6b7280' }}>
            <h3>Henüz ders programı yok</h3>
            <p>Ders eklendiğinde burada görünecek</p>
          </div>
        </div>
      ) : (
        <div className="schedule-container">
          <div className="schedule-grid">
            <div className="time-column">
              <div className="time-header"></div>
              {TIME_SLOTS.map(t => <div key={t} className="time-slot">{t}</div>)}
            </div>

            {DAYS_EN.map((day, dayIndex) => {
              const daySchedule = getScheduleForDay(day);
              return (
                <div key={day} className="day-column">
                  <div className={`day-header ${isToday(weekDates[dayIndex]) ? 'today' : ''}`}>
                    <div className="day-name">{DAYS_TR[dayIndex]}</div>
                    <div className="day-date">{formatDate(weekDates[dayIndex])}</div>
                  </div>
                  <div className="day-slots">
                    {TIME_SLOTS.map(time => {
                      const slotHour = parseInt(time.split(':')[0], 10);
                      const classItems = daySchedule.filter(c => {
                        const ch = parseInt(c.start_time.split(':')[0], 10);
                        return ch === slotHour;
                      });
                      return (
                        <div
                          key={`${day}-${time}`}
                          className={`schedule-slot ${classItems.length > 0 ? 'has-class' : ''}`}
                        >
                          {classItems.map((classItem, ci) => (
                            <div key={ci} className="class-info" style={{ background: classItem.color }}>
                              <div className="class-code">{classItem.code}</div>
                              <div className="class-name">{classItem.name}</div>
                              <div className="class-time">{classItem.start_time} – {classItem.end_time}</div>
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="schedule-legend">
        {DAYS_TR.map((_, i) => null)}
        <div className="legend-item"><div className="legend-color" style={{ background: '#3B82F6' }}></div><span>Planlandı</span></div>
        <div className="legend-item"><div className="legend-color" style={{ background: '#34c759' }}></div><span>Tamamlandı</span></div>
        <div className="legend-item"><div className="legend-color" style={{ background: '#ff3b30' }}></div><span>İptal</span></div>
      </div>
    </div>
  );
};
