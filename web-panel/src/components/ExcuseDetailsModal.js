import React, { useState } from 'react';
import './ExcuseDetailsModal.css';

function ExcuseDetailsModal({ excuse, onClose, onApprove, onReject }) {
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);

  const handleApprove = () => {
    onApprove(excuse.id);
    onClose();
  };

  const handleReject = () => {
    if (rejectReason.trim()) {
      onReject(excuse.id, rejectReason);
      onClose();
    } else {
      alert('Please provide a reason for rejection');
    }
  };

  const getExcuseIcon = (type) => {
    const icons = {
      health: '🏥',
      school_activity: '🏆',
      family: '👨‍👩‍👧',
      technical: '🔧',
      other: '📝',
    };
    return icons[type] || '📝';
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="excuse-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="excuse-modal-header">
          <div>
            <h2>Excuse Request Details</h2>
            <p className="excuse-modal-subtitle">Review and approve or reject</p>
          </div>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        {/* Student Info */}
        <div className="excuse-section">
          <h3>Student Information</h3>
          <div className="excuse-info-grid">
            <div className="excuse-info-item">
              <span className="excuse-label">Name:</span>
              <span className="excuse-value">{excuse.student}</span>
            </div>
            <div className="excuse-info-item">
              <span className="excuse-label">Student ID:</span>
              <span className="excuse-value">{excuse.studentId}</span>
            </div>
            <div className="excuse-info-item">
              <span className="excuse-label">Course:</span>
              <span className="excuse-value">{excuse.course} - {excuse.courseTitle}</span>
            </div>
            <div className="excuse-info-item">
              <span className="excuse-label">Class Date:</span>
              <span className="excuse-value">{excuse.classDate}</span>
            </div>
          </div>
        </div>

        {/* Excuse Details */}
        <div className="excuse-section">
          <h3>Excuse Details</h3>
          <div className="excuse-type-badge">
            <span className="excuse-type-icon">{getExcuseIcon(excuse.excuseType)}</span>
            {excuse.excuseTypeLabel || excuse.excuseType}
          </div>
          <p className="excuse-description">{excuse.excuseDescription}</p>
        </div>

        {/* Documents */}
        {excuse.documents && excuse.documents.length > 0 && (
          <div className="excuse-section">
            <h3>Supporting Documents</h3>
            <div className="excuse-documents">
              {excuse.documents.map((doc, index) => (
                <div key={index} className="excuse-document-item">
                  <span className="doc-icon">
                    {doc.type === 'pdf' ? '📄' : '🖼️'}
                  </span>
                  <span className="doc-name">{doc.name}</span>
                  <a href={doc.url} target="_blank" rel="noopener noreferrer" className="doc-view-btn">
                    View
                  </a>
                  <a href={doc.url} download className="doc-download-btn">
                    Download
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Timeline */}
        <div className="excuse-section">
          <h3>Timeline</h3>
          <div className="excuse-timeline">
            <div className="timeline-item">
              <span className="timeline-label">Submitted:</span>
              <span className="timeline-value">{excuse.submittedAt}</span>
            </div>
            <div className="timeline-item">
              <span className="timeline-label">Deadline:</span>
              <span className="timeline-value">{excuse.deadline}</span>
            </div>
          </div>
        </div>

        {/* Statistics Warning */}
        {excuse.excuseCount >= 3 && (
          <div className="excuse-warning">
            ⚠️ This student has submitted {excuse.excuseCount} excuses this semester
          </div>
        )}

        {/* Actions */}
        {!showRejectInput ? (
          <div className="excuse-actions">
            <button className="excuse-btn approve-btn" onClick={handleApprove}>
              ✓ Approve Excuse
            </button>
            <button className="excuse-btn reject-btn" onClick={() => setShowRejectInput(true)}>
              ✗ Reject Excuse
            </button>
          </div>
        ) : (
          <div className="excuse-reject-section">
            <textarea
              className="reject-reason-input"
              placeholder="Please provide a reason for rejection..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
            />
            <div className="excuse-actions">
              <button className="excuse-btn secondary-btn" onClick={() => setShowRejectInput(false)}>
                Cancel
              </button>
              <button className="excuse-btn reject-btn" onClick={handleReject}>
                Confirm Rejection
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ExcuseDetailsModal;

