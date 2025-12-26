import { useState, useEffect, useCallback } from 'react';
import {
  fetchFlaggedRecords,
  approveFlaggedRecord,
  rejectFlaggedRecord,
  undoFlaggedRecord
} from '../services/attendanceService';

export const useAttendance = () => {
  const [flaggedRecords, setFlaggedRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('all');

  // Fetch flagged records
  const loadFlaggedRecords = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchFlaggedRecords();
      if (result.success) {
        setFlaggedRecords(result.data);
      } else {
        setError('Failed to load flagged records');
      }
    } catch (err) {
      setError(err.message);
      console.error('Error loading flagged records:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load on mount
  useEffect(() => {
    loadFlaggedRecords();
  }, [loadFlaggedRecords]);

  // Approve record
  const approve = useCallback(async (recordId) => {
    try {
      const result = await approveFlaggedRecord(recordId);
      if (result.success) {
        setFlaggedRecords(prev =>
          prev.map(record =>
            record.id === recordId ? { ...record, status: 'approved' } : record
          )
        );
        return { success: true };
      }
      return { success: false, error: 'Failed to approve record' };
    } catch (err) {
      console.error('Error approving record:', err);
      return { success: false, error: err.message };
    }
  }, []);

  // Reject record
  const reject = useCallback(async (recordId) => {
    try {
      const result = await rejectFlaggedRecord(recordId);
      if (result.success) {
        setFlaggedRecords(prev =>
          prev.map(record =>
            record.id === recordId ? { ...record, status: 'rejected' } : record
          )
        );
        return { success: true };
      }
      return { success: false, error: 'Failed to reject record' };
    } catch (err) {
      console.error('Error rejecting record:', err);
      return { success: false, error: err.message };
    }
  }, []);

  // Undo record
  const undo = useCallback(async (recordId) => {
    try {
      const result = await undoFlaggedRecord(recordId);
      if (result.success) {
        setFlaggedRecords(prev =>
          prev.map(record =>
            record.id === recordId ? { ...record, status: 'pending' } : record
          )
        );
        return { success: true };
      }
      return { success: false, error: 'Failed to undo record' };
    } catch (err) {
      console.error('Error undoing record:', err);
      return { success: false, error: err.message };
    }
  }, []);

  // Filter records by active tab
  const filteredRecords = flaggedRecords.filter(record => {
    if (activeTab === 'all') return true;
    return record.status === activeTab;
  });

  // Get tab counts
  const tabCounts = {
    all: flaggedRecords.length,
    pending: flaggedRecords.filter(r => r.status === 'pending').length,
    approved: flaggedRecords.filter(r => r.status === 'approved').length,
    rejected: flaggedRecords.filter(r => r.status === 'rejected').length
  };

  return {
    flaggedRecords,
    filteredRecords,
    loading,
    error,
    activeTab,
    setActiveTab,
    tabCounts,
    approve,
    reject,
    undo,
    refresh: loadFlaggedRecords
  };
};

