import React, { useState } from 'react';
import './ExcuseDetailsModal.css';

export const ExcuseDetailsModal = ({ excuse, onClose, onApprove, onReject }) => {
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Props validation
  if (!onApprove || !onReject) {
    console.error('ExcuseDetailsModal: onApprove or onReject props are missing!', {
      onApprove: !!onApprove,
      onReject: !!onReject
    });
  }

  const handleApprove = async () => {
    console.log('🔵 Approve button clicked for excuse ID:', excuse.id);
    
    if (!onApprove) {
      console.error('❌ onApprove function is not provided!');
      alert('Error: Approve function is not available');
      return;
    }

    setIsProcessing(true);
    try {
      console.log('⏳ Calling onApprove...');
      const result = await onApprove(excuse.id);
      console.log('✅ onApprove result:', result);
      
      if (result && result.success) {
        console.log('✅ Approve successful, closing modal');
        onClose();
      } else {
        console.warn('⚠️ Approve returned unsuccessful result:', result);
        alert(result?.error || 'Failed to approve excuse');
      }
    } catch (error) {
      console.error('❌ Error in handleApprove:', error);
      alert('An error occurred while approving the excuse');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    console.log('🔴 handleReject called for excuse ID:', excuse.id);
    console.log('📝 Current rejectReason:', rejectReason);
    console.log('🔧 onReject type:', typeof onReject);
    console.log('🔧 onReject value:', onReject);
    
    if (!rejectReason || !rejectReason.trim()) {
      console.warn('⚠️ Reject reason is empty');
      alert('Please provide a reason for rejection');
      return;
    }

    if (!onReject) {
      console.error('❌ onReject function is not provided!');
      console.error('❌ Props received:', { excuse: !!excuse, onClose: !!onClose, onApprove: !!onApprove, onReject: !!onReject });
      alert('Error: Reject function is not available. Please check console for details.');
      return;
    }

    setIsProcessing(true);
    try {
      console.log('⏳ Calling onReject with ID:', excuse.id, 'and reason:', rejectReason);
      const result = await onReject(excuse.id, rejectReason);
      console.log('✅ onReject returned result:', result);
      
      if (result && result.success) {
        console.log('✅ Reject successful, closing modal');
        onClose();
      } else {
        console.warn('⚠️ Reject returned unsuccessful result:', result);
        const errorMsg = result?.error || 'Failed to reject excuse';
        alert(errorMsg);
        console.error('❌ Reject failed with error:', errorMsg);
      }
    } catch (error) {
      console.error('❌ Error in handleReject:', error);
      console.error('❌ Error stack:', error.stack);
      alert('An error occurred while rejecting the excuse: ' + error.message);
    } finally {
      setIsProcessing(false);
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
            <button 
              className="excuse-btn approve-btn" 
              onClick={handleApprove}
              disabled={isProcessing || !onApprove}
            >
              {isProcessing ? '⏳ Processing...' : '✓ Approve Excuse'}
            </button>
            <button 
              className="excuse-btn reject-btn" 
              onClick={() => setShowRejectInput(true)}
              disabled={isProcessing}
            >
              ✗ Reject Excuse
            </button>
          </div>
        ) : (
          <div className="excuse-reject-section">
            <textarea
              className="reject-reason-input"
              placeholder="Please provide a reason for rejection..."
              value={rejectReason}
              onChange={(e) => {
                const value = e.target.value;
                console.log('📝 Reject reason changed:', value);
                setRejectReason(value);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.ctrlKey && rejectReason.trim() && !isProcessing) {
                  e.preventDefault();
                  handleReject(e);
                }
              }}
              rows={3}
              disabled={isProcessing}
            />
            <div className="excuse-actions">
              <button 
                className="excuse-btn secondary-btn" 
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowRejectInput(false);
                  setRejectReason('');
                }}
                disabled={isProcessing}
              >
                Cancel
              </button>
              <button 
                className="excuse-btn reject-btn" 
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  console.log('🔴 Confirm Rejection button clicked');
                  console.log('📝 Reject reason value:', rejectReason);
                  console.log('📝 Reject reason trimmed:', rejectReason.trim());
                  console.log('📝 Reject reason length:', rejectReason.trim().length);
                  console.log('🔧 onReject function exists:', !!onReject);
                  console.log('🔧 onReject type:', typeof onReject);
                  console.log('⏳ isProcessing:', isProcessing);
                  
                  if (!rejectReason.trim()) {
                    console.warn('⚠️ Cannot reject: reason is empty');
                    alert('Please provide a reason for rejection');
                    return;
                  }
                  
                  if (!onReject) {
                    console.error('❌ Cannot reject: onReject is not provided');
                    alert('Error: Reject function is not available');
                    return;
                  }
                  
                  handleReject(e);
                }}
                disabled={isProcessing}
                style={{ 
                  opacity: (!rejectReason.trim() || isProcessing) ? 0.5 : 1,
                  cursor: (!rejectReason.trim() || isProcessing) ? 'not-allowed' : 'pointer'
                }}
              >
                {isProcessing ? '⏳ Processing...' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

