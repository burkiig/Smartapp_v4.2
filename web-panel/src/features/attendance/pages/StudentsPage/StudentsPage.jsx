import React, { useState } from 'react';
import { useStudents } from '../../hooks/useStudents';
import { Table } from '../../../../shared/components/ui/Table';
import './StudentsPage.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

export const StudentsPage = () => {
  const { students, loading, error, loadStudents, deleteStudent } = useStudents();
  const [searchTerm, setSearchTerm] = useState('');

  const handleDelete = async (studentId) => {
    if (!window.confirm('Bu öğrenciyi silmek istediğinizden emin misiniz?')) {
      return;
    }
    await deleteStudent(studentId);
  };

  // Filter students based on search term
  const filteredStudents = students.filter(student => {
    const searchLower = searchTerm.toLowerCase();
    return (
      student.name.toLowerCase().includes(searchLower) ||
      student.student_id.toLowerCase().includes(searchLower)
    );
  });

  // Prepare table data
  const tableColumns = [
    { key: 'student_id', label: 'Student ID' },
    { key: 'name', label: 'Name' },
    { 
      key: 'image', 
      label: 'Image',
      render: (value, row) => (
        <img
          src={`${API_URL}/static/faces/${row.image}`}
          alt={row.name}
          className="student-table-image"
          onError={(e) => {
            e.target.src = 'https://via.placeholder.com/50';
          }}
        />
      )
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (value, row) => (
        <button
          className="btn btn-danger btn-sm"
          onClick={() => handleDelete(row.student_id)}
        >
          Sil
        </button>
      )
    }
  ];

  if (loading) {
    return (
      <div className="students-page-container">
        <h2>Kayıtlı Öğrenciler</h2>
        <div className="loading">Yükleniyor...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="students-page-container">
        <h2>Kayıtlı Öğrenciler</h2>
        <div className="error-message">Hata: {error}</div>
      </div>
    );
  }

  return (
    <div className="students-page-container">
      <div className="header-with-button">
        <div>
          <h2>Students</h2>
          <p className="subtitle">
            Toplam {students.length} öğrenci kayıtlı
          </p>
        </div>
        <button className="btn btn-primary" onClick={loadStudents}>
          🔄 Yenile
        </button>
      </div>

      {/* Search Input */}
      <div className="search-box">
        <input
          type="text"
          placeholder="Öğrenci adı veya numarası ile ara..."
          className="search-input"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {filteredStudents.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">👥</div>
          <p>
            {searchTerm ? 'Arama sonucu bulunamadı' : 'Henüz kayıtlı öğrenci yok'}
          </p>
        </div>
      ) : (
        <Table columns={tableColumns} data={filteredStudents} />
      )}
    </div>
  );
};

