import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  fetchFlaggedRecords,
  approveFlaggedRecord,
  rejectFlaggedRecord,
  undoFlaggedRecord,
} from '../services/attendanceService';

export const useAttendance = () => {
  const { t } = useTranslation();
  const [flaggedRecords, setFlaggedRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('all');

  const loadFlaggedRecords = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchFlaggedRecords();
      if (result.success) {
        setFlaggedRecords(result.data);
      } else {
        setError(t('studentDashboard.attendance.flaggedLoadError') || 'Bayraklı kayıtlar yüklenemedi');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFlaggedRecords();
  }, [loadFlaggedRecords]);

  const approve = useCallback(async (recordId) => {
    try {
      const result = await approveFlaggedRecord(recordId);
      if (result.success) {
        setFlaggedRecords(prev =>
          prev.map(r => r.id === recordId ? { ...r, isFlagged: false, is_flagged: false, status: 'present' } : r)
        );
        return { success: true };
      }
      return { success: false, error: 'Kayıt onaylanamadı' };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }, []);

  const reject = useCallback(async (recordId) => {
    try {
      const result = await rejectFlaggedRecord(recordId);
      if (result.success) {
        setFlaggedRecords(prev =>
          prev.map(r => r.id === recordId ? { ...r, isFlagged: false, is_flagged: false, status: 'absent' } : r)
        );
        return { success: true };
      }
      return { success: false, error: 'Kayıt reddedilemedi' };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }, []);

  const undo = useCallback(async (recordId) => {
    try {
      const result = await undoFlaggedRecord(recordId);
      if (result.success) {
        setFlaggedRecords(prev =>
          prev.map(r => r.id === recordId ? { ...r, isFlagged: true, is_flagged: true, status: 'present' } : r)
        );
        return { success: true };
      }
      return { success: false, error: 'İşlem geri alınamadı' };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }, []);

  const filteredRecords = useMemo(() => {
    if (activeTab === 'all') return flaggedRecords;
    if (activeTab === 'flagged') return flaggedRecords.filter(r => r.isFlagged);
    if (activeTab === 'resolved') return flaggedRecords.filter(r => !r.isFlagged);
    return flaggedRecords;
  }, [flaggedRecords, activeTab]);

  const tabCounts = useMemo(() => ({
    all: flaggedRecords.length,
    flagged: flaggedRecords.filter(r => r.isFlagged).length,
    resolved: flaggedRecords.filter(r => !r.isFlagged).length,
  }), [flaggedRecords]);

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
    refresh: loadFlaggedRecords,
  };
};
