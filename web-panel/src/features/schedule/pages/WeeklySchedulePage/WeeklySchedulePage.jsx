import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import apiClient from '../../../../shared/services/apiClient';
import './WeeklySchedulePage.css';

const DAYS_EN = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
// JS getDay(): 0=Sun,1=Mon,...,6=Sat → Mon=1 → index 0
const TODAY_INDEX = (() => { const d = new Date().getDay(); return d === 0 ? 6 : d - 1; })();
const TIME_SLOTS = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'];
const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4'];

export const WeeklySchedulePage = () => {
  const { t } = useTranslation();
  const DAYS_TR = [
    t('schedule.monday'), t('schedule.tuesday'), t('schedule.wednesday'),
    t('schedule.thursday'), t('schedule.friday'),
  ];
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCourse, setSelectedCourse] = useState(null);

  const formatDays = (schedule) => {
    if (!schedule) return '—';
    if (Array.isArray(schedule.slots) && schedule.slots.length > 0) {
      return schedule.slots.map((slot) => slot.day).join(', ');
    }
    if (Array.isArray(schedule.days) && schedule.days.length > 0) {
      return schedule.days.join(', ');
    }
    return '—';
  };

  const formatTimes = (schedule) => {
    if (!schedule) return '—';
    if (Array.isArray(schedule.slots) && schedule.slots.length > 0) {
      return schedule.slots
        .map((slot) => `${slot.day}: ${slot.start_time || '--:--'} - ${slot.end_time || '--:--'}`)
        .join(' | ');
    }
    if (schedule.start_time || schedule.end_time) {
      return `${schedule.start_time || '--:--'} - ${schedule.end_time || '--:--'}`;
    }
    return '—';
  };

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

  const dayHourToClassesMap = useMemo(() => {
    const byDayHour = Object.fromEntries(DAYS_EN.map((day) => [day, {}]));

    const pushClass = (dayName, item) => {
      if (!byDayHour[dayName]) return;
      const hour = parseInt((item.start_time || '00:00').split(':')[0], 10);
      if (!Number.isFinite(hour)) return;
      if (!byDayHour[dayName][hour]) byDayHour[dayName][hour] = [];
      byDayHour[dayName][hour].push(item);
    };

    courses.forEach((course, idx) => {
      const sched = course.schedule;
      if (!sched) return;

      const color = COLORS[idx % COLORS.length];
      const instructors = course.instructor_names?.length ? course.instructor_names : [];
      const baseItem = {
        id: course.id,
        code: course.code,
        name: course.name,
        color,
        instructors,
        schedule: sched,
        department: course.department || null,
      };

      if (Array.isArray(sched.slots)) {
        sched.slots.forEach((slot) => {
          pushClass(slot.day, {
            ...baseItem,
            start_time: slot.start_time || '09:00',
            end_time: slot.end_time || '10:00',
          });
        });
        return;
      }

      if (Array.isArray(sched.days)) {
        sched.days.forEach((dayName) => {
          pushClass(dayName, {
            ...baseItem,
            start_time: sched.start_time || '09:00',
            end_time: sched.end_time || '10:00',
          });
        });
      }
    });

    return byDayHour;
  }, [courses]);

  return (
    <div className="weekly-schedule">
      <div className="schedule-header">
        <div className="header-left">
          <h1 className="page-title">{t('schedule.title')}</h1>
          <p className="page-subtitle">{t('schedule.subtitle')}</p>
        </div>
      </div>

      {loading ? (
        <div className="schedule-loading">{t('common.loading')}</div>
      ) : courses.length === 0 ? (
        <div className="schedule-empty">
          <div style={{ textAlign: 'center', padding: '60px', color: '#6b7280' }}>
            <h3>{t('schedule.noSchedule')}</h3>
            <p>{t('schedule.noScheduleHint')}</p>
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
              const isToday = dayIndex === TODAY_INDEX;
              return (
                <div key={day} className="day-column">
                  <div className={`day-header ${isToday ? 'today' : ''}`}>
                    <div className="day-name">{DAYS_TR[dayIndex]}</div>
                    {isToday && <div className="today-badge">{t('schedule.today')}</div>}
                  </div>
                  <div className="day-slots">
                    {TIME_SLOTS.map(time => {
                      const slotHour = parseInt(time.split(':')[0], 10);
                      const classItems = dayHourToClassesMap[day]?.[slotHour] || [];
                      return (
                        <div key={`${day}-${time}`} className={`schedule-slot ${classItems.length > 0 ? 'has-class' : ''}`}>
                          {classItems.map((classItem, ci) => (
                            <button
                              key={ci}
                              type="button"
                              className="class-info"
                              style={{ background: classItem.color }}
                              onClick={() => setSelectedCourse(classItem)}
                            >
                              <div className="class-code">{classItem.code}</div>
                              <div className="class-name">{classItem.name}</div>
                              <div className="class-time">{classItem.start_time} – {classItem.end_time}</div>
                              {classItem.instructors?.length > 0 && (
                                <div className="class-instructors">
                                  👤 {classItem.instructors.join(' · ')}
                                </div>
                              )}
                            </button>
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
        <div className="legend-item"><div className="legend-color" style={{ background: '#3B82F6' }}></div><span>{t('schedule.scheduled')}</span></div>
      </div>

      {selectedCourse && (
        <div className="course-detail-overlay" onClick={() => setSelectedCourse(null)}>
          <div className="course-detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="course-detail-header">
              <h3>{t('schedule.courseDetailTitle', 'Ders Detayı')}</h3>
              <button type="button" className="course-detail-close" onClick={() => setSelectedCourse(null)}>
                {t('common.close')}
              </button>
            </div>
            <div className="course-detail-body">
              <p><strong>{t('schedule.courseCode', 'Ders Kodu')}:</strong> {selectedCourse.code}</p>
              <p><strong>{t('schedule.courseName', 'Ders Adı')}:</strong> {selectedCourse.name}</p>
              <p><strong>{t('schedule.days', 'Günler')}:</strong> {formatDays(selectedCourse.schedule)}</p>
              <p><strong>{t('schedule.timeRange', 'Saat')}:</strong> {formatTimes(selectedCourse.schedule)}</p>
              <p><strong>{t('schedule.instructors', 'Öğretmenler')}:</strong> {selectedCourse.instructors?.length ? selectedCourse.instructors.join(' · ') : '—'}</p>
              {selectedCourse.department && (
                <p><strong>{t('schedule.department', 'Bölüm')}:</strong> {selectedCourse.department}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
