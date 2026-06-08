import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useStudents } from '../../hooks/useStudents';
import { useAuth } from '../../../../features/auth/context/AuthContext';
import './StudentsPage.css';

export const StudentsPage = ({ onManualAttendance }) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const {
    students, courses, courseFilter, setCourseFilter,
    loading, error, loadStudents, deleteStudent,
  } = useStudents();
  const canDelete = user?.role === 'admin';
  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');

  const handleDelete = async (userId) => {
    if (!window.confirm(t('students.deleteConfirm'))) return;
    await deleteStudent(userId);
  };

  // Unique departments for the dropdown
  const departments = useMemo(() => {
    const deps = [...new Set(students.map(s => s.department).filter(Boolean))].sort();
    return deps;
  }, [students]);

  const filteredStudents = students.filter(student => {
    const q = searchTerm.toLowerCase();
    const matchesSearch = (
      (student.name || '').toLowerCase().includes(q) ||
      (student.username || '').toLowerCase().includes(q) ||
      (student.student_number || '').toLowerCase().includes(q) ||
      (student.email || '').toLowerCase().includes(q) ||
      (student.department || '').toLowerCase().includes(q)
    );
    const matchesDept = !departmentFilter || student.department === departmentFilter;
    return matchesSearch && matchesDept;
  });

  if (loading) {
    return (
      <div className="students-page-container">
        <h2>{t('students.title')}</h2>
        <div className="loading">{t('common.loading')}</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="students-page-container">
        <h2>{t('students.title')}</h2>
        <div className="error-message">{t('common.error')}: {error}</div>
        <button className="btn btn-primary" onClick={loadStudents}>{t('common.retry')}</button>
      </div>
    );
  }

  return (
    <div className="students-page-container">
      <div className="header-with-button">
        <div>
          <h2>{t('students.title')}</h2>
          <p className="subtitle">{t('students.subtitle', { count: filteredStudents.length })}</p>
        </div>
        <button className="btn btn-primary" onClick={loadStudents}>{t('common.refresh')}</button>
      </div>

      <div className="search-box" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder={t('students.searchPlaceholder')}
          className="search-input"
          style={{ flex: 1, minWidth: 200 }}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        {courses.length > 0 && (
          <select
            className="search-input"
            style={{ minWidth: 200 }}
            value={courseFilter}
            onChange={e => setCourseFilter(e.target.value)}
          >
            <option value="">{t('students.allCourses')}</option>
            {courses.map(c => (
              <option key={c.id} value={String(c.id)}>
                {c.code} — {c.name}
                {c.enrolled_count != null ? ` (${c.enrolled_count})` : ''}
              </option>
            ))}
          </select>
        )}
        {departments.length > 0 && (
          <select
            className="search-input"
            style={{ minWidth: 160 }}
            value={departmentFilter}
            onChange={e => setDepartmentFilter(e.target.value)}
          >
            <option value="">{t('students.allDepartments')}</option>
            {departments.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        )}
      </div>

      {filteredStudents.length === 0 ? (
        <div className="empty-state">
          <p>
            {searchTerm || departmentFilter
              ? t('students.noSearchResults')
              : courseFilter
                ? t('students.noStudentsInCourse')
                : t('students.noStudents')}
          </p>
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="students-table">
            <thead>
              <tr>
                <th>{t('students.fullName')}</th>
                <th>{t('students.username')}</th>
                <th>{t('students.email')}</th>
                <th>{t('students.studentNo')}</th>
                <th>{t('students.department')}</th>
                <th>{t('students.status')}</th>
                <th>{t('students.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.map(student => (
                <tr key={student.id}>
                  <td>
                    <div className="student-cell">
                      <div className="student-avatar">
                        {(student.name || 'U').charAt(0).toUpperCase()}
                      </div>
                      <span>{student.name || '—'}</span>
                    </div>
                  </td>
                  <td>{student.username || '—'}</td>
                  <td>{student.email || '—'}</td>
                  <td>{student.student_number || '—'}</td>
                  <td>{student.department || '—'}</td>
                  <td>
                    <span className={`status-badge ${student.is_active ? 'active' : 'inactive'}`}>
                      {student.is_active ? t('students.active') : t('students.inactive')}
                    </span>
                  </td>
                  <td>
                    {onManualAttendance && (
                      <button
                        className="btn btn-primary btn-sm"
                        style={{ marginRight: '6px' }}
                        onClick={() => onManualAttendance(student)}
                      >
                        {t('students.manualAttendance')}
                      </button>
                    )}
                    {canDelete && (
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDelete(student.id)}
                      >
                        {t('common.delete')}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
