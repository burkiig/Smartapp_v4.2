import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import './ExcuseDetailsModal.css';
import { fetchExcuseDocumentUrl } from '../../services/excuseService';

export const ExcuseDetailsModal = ({ excuse, onClose, onApprove, onReject }) => {
  const { t } = useTranslation();
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
        alert(result?.error || t('excuseModal.approveError'));
      }
    } catch (error) {
      alert(t('excuseModal.approveErrorGeneric'));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async (e) => {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    if (!rejectReason.trim()) {
      alert(t('excuseModal.rejectReasonRequired'));
      return;
    }
    if (!onReject) return;
    setIsProcessing(true);
    try {
      const result = await onReject(excuse.id, rejectReason);
      if (result?.success) {
        onClose();
      } else {
        alert(result?.error || t('excuseModal.rejectError'));
      }
    } catch (error) {
      alert(t('excuseModal.rejectErrorGeneric') + ': ' + error.message);
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
            <h2>{t('excuseModal.title')}</h2>
            <p className="excuse-modal-subtitle">{t('excuseModal.subtitle')}</p>
          </div>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="excuse-section">
          <h3>{t('excuseModal.studentInfo')}</h3>
          <div className="excuse-info-grid">
            <div className="excuse-info-item">
              <span className="excuse-label">{t('excuseModal.fullName')}:</span>
              <span className="excuse-value">{excuse.studentName}</span>
            </div>
            <div className="excuse-info-item">
              <span className="excuse-label">{t('excuseModal.studentNo')}:</span>
              <span className="excuse-value">#{excuse.studentId}</span>
            </div>
            <div className="excuse-info-item">
              <span className="excuse-label">{t('excuseModal.course')}:</span>
              <span className="excuse-value">{excuse.courseTitle}</span>
            </div>
            <div className="excuse-info-item">
              <span className="excuse-label">{t('excuseModal.absenceDate')}:</span>
              <span className="excuse-value">{excuse.classDate || excuse.sessionDate}</span>
            </div>
          </div>
        </div>

        <div className="excuse-section">
          <h3>{t('excuseModal.excuseInfo')}</h3>
          <div className="excuse-type-badge">
            <span className="excuse-type-icon">{getExcuseIcon(excuse.excuseType)}</span>
            {excuse.excuseTypeLabel || excuse.excuseType}
          </div>
          <p className="excuse-description">{excuse.excuseDescription || excuse.description}</p>
        </div>

        {(excuse.hasDocument || (excuse.documents && excuse.documents.length > 0)) && (
          <div className="excuse-section">
            <h3>{t('excuseModal.documents')}</h3>
            <div className="excuse-documents">
              {(excuse.documents && excuse.documents.length > 0
                ? excuse.documents
                : [{ name: 'Belge', excuseId: excuse.id }]
              ).map((doc, index) => (
                <div key={index} className="excuse-document-item">
                  <span className="doc-icon">📄</span>
                  <span className="doc-name">{doc.name || t('excuseModal.document')}</span>
                  <button
                    className="doc-view-btn"
                    disabled={docLoading}
                    onClick={async () => {
                      setDocLoading(true);
                      const result = await fetchExcuseDocumentUrl(doc.excuseId ?? excuse.id);
                      setDocLoading(false);
                      if (result.success) {
                        window.open(result.signedUrl, '_blank', 'noopener,noreferrer');
                      } else {
                        alert(t('excuseModal.docOpenError') + ': ' + result.error);
                      }
                    }}
                  >
                    {docLoading ? t('common.loading') : `🔍 ${t('excuseModal.view')}`}
                  </button>
                  <button
                    className="doc-download-btn"
                    disabled={docLoading}
                    title={t('excuseModal.downloadDocument')}
                    onClick={async () => {
                      setDocLoading(true);
                      const result = await fetchExcuseDocumentUrl(doc.excuseId ?? excuse.id);
                      setDocLoading(false);
                      if (result.success) {
                        const a = document.createElement('a');
                        a.href = result.signedUrl;
                        a.download = doc.name || 'mazeret-belgesi';
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                      } else {
                        alert(t('excuseModal.docDownloadError') + ': ' + result.error);
                      }
                    }}
                  >
                    ⬇ {t('excuseModal.download')}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="excuse-section">
          <h3>{t('excuseModal.timeline')}</h3>
          <div className="excuse-timeline">
            <div className="timeline-item">
              <span className="timeline-label">{t('excuseModal.submitted')}:</span>
              <span className="timeline-value">{excuse.submittedAt}</span>
            </div>
            {excuse.instructorNotes && (
              <div className="timeline-item">
                <span className="timeline-label">{t('excuseModal.instructorNote')}:</span>
                <span className="timeline-value">{excuse.instructorNotes}</span>
              </div>
            )}
          </div>
        </div>

        {excuse.status === 'pending' && !showRejectInput ? (
          <div className="excuse-actions">
            <button className="excuse-btn approve-btn" onClick={handleApprove} disabled={isProcessing || !onApprove}>
              {isProcessing ? t('common.processing') : `✓ ${t('common.approve')}`}
            </button>
            <button className="excuse-btn reject-btn" onClick={() => setShowRejectInput(true)} disabled={isProcessing}>
              ✗ {t('common.reject')}
            </button>
          </div>
        ) : excuse.status === 'pending' && showRejectInput ? (
          <div className="excuse-reject-section">
            <textarea
              className="reject-reason-input"
              placeholder={t('excuseModal.rejectReasonPlaceholder')}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              disabled={isProcessing}
            />
            <div className="excuse-actions">
              <button className="excuse-btn secondary-btn" onClick={() => { setShowRejectInput(false); setRejectReason(''); }} disabled={isProcessing}>
                {t('common.cancel')}
              </button>
              <button
                className="excuse-btn reject-btn"
                onClick={handleReject}
                disabled={isProcessing || !rejectReason.trim()}
                style={{ opacity: (!rejectReason.trim() || isProcessing) ? 0.5 : 1 }}
              >
                {isProcessing ? t('common.processing') : t('excuseModal.confirmReject')}
              </button>
            </div>
          </div>
        ) : (
          <div className="excuse-section">
            <div className={`excuse-status-badge ${excuse.status}`}>
              {excuse.status === 'approved' ? `✓ ${t('excuses.statusApproved')}` : excuse.status === 'rejected' ? `✗ ${t('excuses.statusRejected')}` : excuse.status}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
