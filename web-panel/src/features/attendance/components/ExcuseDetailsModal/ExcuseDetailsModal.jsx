import React, { useState } from 'react';
import './ExcuseDetailsModal.css';
import { fetchExcuseDocumentUrl } from '../../services/excuseService';

export const ExcuseDetailsModal = ({ excuse, onClose, onApprove, onReject }) => {
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [docLoading, setDocLoading] = useState(false);

  const handleApprove = async () => {
    if (!onApprove) return;
    setIsProcessing(true);
    try {
      const result = await onApprove(excuse.id);
      if (result?.success) {
        onClose();
      } else {
        alert(result?.error || 'Mazeret onaylanamadı');
      }
    } catch (error) {
      alert('Mazeret onaylanırken bir hata oluştu');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async (e) => {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    if (!rejectReason.trim()) {
      alert('Lütfen red gerekçesi yazın');
      return;
    }
    if (!onReject) return;
    setIsProcessing(true);
    try {
      const result = await onReject(excuse.id, rejectReason);
      if (result?.success) {
        onClose();
      } else {
        alert(result?.error || 'Mazeret reddedilemedi');
      }
    } catch (error) {
      alert('Mazeret reddedilirken bir hata oluştu: ' + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const getExcuseIcon = (type) => {
    const icons = {
      medical: '🏥', health: '🏥', school_activity: '🎓',
      family: '👨‍👩‍👧', transportation: '🚌', other: '📝',
    };
    return icons[type] || '📝';
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="excuse-modal" onClick={(e) => e.stopPropagation()}>
        <div className="excuse-modal-header">
          <div>
            <h2>Mazeret Detayları</h2>
            <p className="excuse-modal-subtitle">İnceleyin ve onaylayın ya da reddedin</p>
          </div>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="excuse-section">
          <h3>Öğrenci Bilgileri</h3>
          <div className="excuse-info-grid">
            <div className="excuse-info-item">
              <span className="excuse-label">Ad Soyad:</span>
              <span className="excuse-value">{excuse.studentName}</span>
            </div>
            <div className="excuse-info-item">
              <span className="excuse-label">Öğrenci No:</span>
              <span className="excuse-value">#{excuse.studentId}</span>
            </div>
            <div className="excuse-info-item">
              <span className="excuse-label">Ders:</span>
              <span className="excuse-value">{excuse.courseTitle}</span>
            </div>
            <div className="excuse-info-item">
              <span className="excuse-label">Devamsızlık Tarihi:</span>
              <span className="excuse-value">{excuse.classDate || excuse.sessionDate}</span>
            </div>
          </div>
        </div>

        <div className="excuse-section">
          <h3>Mazeret Bilgileri</h3>
          <div className="excuse-type-badge">
            <span className="excuse-type-icon">{getExcuseIcon(excuse.excuseType)}</span>
            {excuse.excuseTypeLabel || excuse.excuseType}
          </div>
          <p className="excuse-description">{excuse.excuseDescription || excuse.description}</p>
        </div>

        {excuse.documents && excuse.documents.length > 0 && (
          <div className="excuse-section">
            <h3>Destekleyici Belgeler</h3>
            <div className="excuse-documents">
              {excuse.documents.map((doc, index) => (
                <div key={index} className="excuse-document-item">
                  <span className="doc-icon">📄</span>
                  <span className="doc-name">{doc.name}</span>
                  <button
                    className="doc-view-btn"
                    disabled={docLoading}
                    onClick={async () => {
                      setDocLoading(true);
                      const result = await fetchExcuseDocumentUrl(doc.excuseId);
                      setDocLoading(false);
                      if (result.success) {
                        window.open(result.signedUrl, '_blank', 'noopener,noreferrer');
                      } else {
                        alert('Belge açılamadı: ' + result.error);
                      }
                    }}
                  >
                    {docLoading ? 'Yükleniyor...' : 'Görüntüle'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="excuse-section">
          <h3>Zaman Çizelgesi</h3>
          <div className="excuse-timeline">
            <div className="timeline-item">
              <span className="timeline-label">Gönderilme:</span>
              <span className="timeline-value">{excuse.submittedAt}</span>
            </div>
            {excuse.instructorNotes && (
              <div className="timeline-item">
                <span className="timeline-label">Öğretmen Notu:</span>
                <span className="timeline-value">{excuse.instructorNotes}</span>
              </div>
            )}
          </div>
        </div>

        {excuse.status === 'pending' && !showRejectInput ? (
          <div className="excuse-actions">
            <button className="excuse-btn approve-btn" onClick={handleApprove} disabled={isProcessing || !onApprove}>
              {isProcessing ? 'İşleniyor...' : '✓ Onayla'}
            </button>
            <button className="excuse-btn reject-btn" onClick={() => setShowRejectInput(true)} disabled={isProcessing}>
              ✗ Reddet
            </button>
          </div>
        ) : excuse.status === 'pending' && showRejectInput ? (
          <div className="excuse-reject-section">
            <textarea
              className="reject-reason-input"
              placeholder="Lütfen red gerekçesi yazın..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              disabled={isProcessing}
            />
            <div className="excuse-actions">
              <button className="excuse-btn secondary-btn" onClick={() => { setShowRejectInput(false); setRejectReason(''); }} disabled={isProcessing}>
                İptal
              </button>
              <button
                className="excuse-btn reject-btn"
                onClick={handleReject}
                disabled={isProcessing || !rejectReason.trim()}
                style={{ opacity: (!rejectReason.trim() || isProcessing) ? 0.5 : 1 }}
              >
                {isProcessing ? 'İşleniyor...' : 'Reddi Onayla'}
              </button>
            </div>
          </div>
        ) : (
          <div className="excuse-section">
            <div className={`excuse-status-badge ${excuse.status}`}>
              {excuse.status === 'approved' ? '✓ Onaylandı' : excuse.status === 'rejected' ? '✗ Reddedildi' : excuse.status}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
