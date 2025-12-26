import { useState, useEffect, useCallback } from 'react';
import {
  fetchExcuseRecords,
  fetchExcuseById,
  approveExcuse,
  rejectExcuse,
  undoExcuse
} from '../services/excuseService';

export const useExcuses = () => {
  const [excuseRecords, setExcuseRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch excuse records
  const loadExcuseRecords = useCallback(async (filters = {}) => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchExcuseRecords(filters);
      if (result.success) {
        setExcuseRecords(result.data);
      } else {
        setError('Failed to load excuse records');
      }
    } catch (err) {
      setError(err.message);
      console.error('Error loading excuse records:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load on mount
  useEffect(() => {
    loadExcuseRecords();
  }, [loadExcuseRecords]);

  // Fetch single excuse
  const getExcuseById = useCallback(async (excuseId) => {
    try {
      const result = await fetchExcuseById(excuseId);
      if (result.success) {
        return { success: true, data: result.data };
      }
      return { success: false, error: 'Failed to fetch excuse' };
    } catch (err) {
      console.error('Error fetching excuse:', err);
      return { success: false, error: err.message };
    }
  }, []);

  // Approve excuse
  const approve = useCallback(async (excuseId) => {
    try {
      const result = await approveExcuse(excuseId);
      if (result.success) {
        setExcuseRecords(prev =>
          prev.map(record =>
            record.id === excuseId ? { ...record, status: 'approved' } : record
          )
        );
        return { success: true };
      }
      return { success: false, error: 'Failed to approve excuse' };
    } catch (err) {
      console.error('Error approving excuse:', err);
      return { success: false, error: err.message };
    }
  }, []);

  // Reject excuse
  const reject = useCallback(async (excuseId, reason) => {
    try {
      const result = await rejectExcuse(excuseId, reason);
      if (result.success) {
        setExcuseRecords(prev =>
          prev.map(record =>
            record.id === excuseId 
              ? { ...record, status: 'rejected', rejectReason: reason } 
              : record
          )
        );
        return { success: true };
      }
      return { success: false, error: 'Failed to reject excuse' };
    } catch (err) {
      console.error('Error rejecting excuse:', err);
      return { success: false, error: err.message };
    }
  }, []);

  // Undo excuse
  const undo = useCallback(async (excuseId) => {
    try {
      const result = await undoExcuse(excuseId);
      if (result.success) {
        setExcuseRecords(prev =>
          prev.map(record =>
            record.id === excuseId ? { ...record, status: 'pending' } : record
          )
        );
        return { success: true };
      }
      return { success: false, error: 'Failed to undo excuse' };
    } catch (err) {
      console.error('Error undoing excuse:', err);
      return { success: false, error: err.message };
    }
  }, []);

  // Get pending count
  const pendingCount = excuseRecords.filter(r => r.status === 'pending').length;

  return {
    excuseRecords,
    loading,
    error,
    pendingCount,
    approve,
    reject,
    undo,
    getExcuseById,
    refresh: loadExcuseRecords
  };
};

