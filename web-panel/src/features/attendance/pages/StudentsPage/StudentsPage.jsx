import React, { useState, useMemo } from 'react';
import { useStudents } from '../../hooks/useStudents';
import './StudentsPage.css';

export const StudentsPage = ({ onManualAttendance }) => {
  const { students, loading, error, loadStudents, deleteStudent } = useStudents();
  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');

  const handleDelete = async (userId) => {
    if (!window.confirm('Bu öğrenciyi silmek istediğinizden emin misiniz?')) return;
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
        <h2>Öğrenciler</h2>
        <div className="loading">Yükleniyor...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="students-page-container">
        <h2>Öğrenciler</h2>
        <div className="error-message">Hata: {error}</div>
        <button className="btn btn-primary" onClick={loadStudents}>Tekrar Dene</button>
      </div>
    );
  }

  return (
    <div className="students-page-container">
      <div className="header-with-button">
        <div>
          <h2>Öğrenciler</h2>
          <p className="subtitle">Toplam {students.length} öğrenci</p>
        </div>
        <button className="btn btn-primary" onClick={loadStudents}>Yenile</button>
      </div>

      <div className="search-box" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="Ad, kullanıcı adı, e-posta, numara veya bölüm..."
          className="search-input"
          style={{ flex: 1, minWidth: 200 }}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        {departments.length > 0 && (
          <select
            className="search-input"
            style={{ minWidth: 160 }}
            value={departmentFilter}
            onChange={e => setDepartmentFilter(e.target.value)}
          >
            <option value="">Tüm Bölümler</option>
            {departments.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        )}
      </div>

      {filteredStudents.length === 0 ? (
        <div className="empty-state">
          <p>{searchTerm ? 'Arama sonucu bulunamadı' : 'Henüz kayıtlı öğrenci yok'}</p>
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="students-table">
            <thead>
              <tr>
                <th>Ad Soyad</th>
                <th>Kullanıcı Adı</th>
                <th>E-posta</th>
                <th>Öğrenci No</th>
                <th>Bölüm</th>
                <th>Durum</th>
                <th>İşlem</th>
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
                      {student.is_active ? 'Aktif' : 'Pasif'}
                    </span>
                  </td>
                  <td>
                    {onManualAttendance && (
                      <button
                        className="btn btn-primary btn-sm"
                        style={{ marginRight: '6px' }}
                        onClick={() => onManualAttendance(student)}
                      >
                        Manuel Yoklama
                      </button>
                    )}
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => handleDelete(student.id)}
                    >
                      Sil
                    </button>
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
