import i18n from '@/i18n';
import { getDateLocale } from '@/i18n/format';

/**
 * Check if a student can still submit an excuse for a given class date
 * @param {string} classDate - The date of the class (e.g., '2025-11-29')
 * @returns {boolean} - True if within 24 hours, false otherwise
 */
export const canSubmitExcuse = (classDate) => {
  const now = new Date();
  const classDateTime = new Date(classDate);
  const hoursDiff = (now - classDateTime) / (1000 * 60 * 60);
  return hoursDiff <= 24 && hoursDiff >= 0;
};

/**
 * Get the deadline for excuse submission
 * @param {string} classDate - The date of the class
 * @returns {string} - Formatted deadline string
 */
export const getExcuseDeadline = (classDate) => {
  const classDateTime = new Date(classDate);
  const deadline = new Date(classDateTime.getTime() + 24 * 60 * 60 * 1000);
  return deadline.toLocaleString(getDateLocale(), {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/**
 * Get excuse status color configuration
 * @param {string} status - The excuse status ('pending', 'approved', 'rejected', null)
 * @returns {object} - Color configuration object
 */
export const getExcuseStatusColor = (status) => {
  switch (status) {
    case 'pending':
      return {
        bg: '#FEF3C7',
        text: '#92400E',
        label: i18n.t('excuse.statusPending'),
        icon: 'time',
      };
    case 'approved':
      return {
        bg: '#D1FAE5',
        text: '#065F46',
        label: i18n.t('excuse.statusApproved'),
        icon: 'checkmark-circle',
      };
    case 'rejected':
      return {
        bg: '#FEE2E2',
        text: '#991B1B',
        label: i18n.t('excuse.statusRejected'),
        icon: 'close-circle',
      };
    default:
      return {
        bg: '#F3F4F6',
        text: '#6B7280',
        label: i18n.t('excuse.statusNone'),
        icon: 'alert-circle',
      };
  }
};

/**
 * Get excuse type display information
 * @param {string} type - The excuse type
 * @returns {object} - Display information
 */
export const getExcuseTypeInfo = (type) => {
  const types = {
    health: { label: i18n.t('excuse.typeHealth'), icon: '🏥', color: '#EF4444' },
    medical: { label: i18n.t('excuse.typeHealth'), icon: '🏥', color: '#EF4444' },
    school_activity: { label: i18n.t('excuse.typeSchoolActivity'), icon: '🏆', color: '#F59E0B' },
    family: { label: i18n.t('excuse.typeFamilyEmergency'), icon: '👨‍👩‍👧', color: '#8B5CF6' },
    technical: { label: i18n.t('excuse.typeTechnical'), icon: '🔧', color: '#6B7280' },
    other: { label: i18n.t('excuse.typeOther'), icon: '📝', color: '#3B82F6' },
  };
  return types[type] || types.other;
};

/**
 * Format excuse submission time
 * @param {string} timestamp - ISO timestamp
 * @returns {string} - Formatted time string
 */
export const formatExcuseTime = (timestamp) => {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return i18n.t('common.justNow');
  if (diffMins < 60) return i18n.t('common.minutesAgo', { count: diffMins });
  if (diffHours < 24) return i18n.t('common.hoursAgo', { count: diffHours });
  if (diffDays < 7) return i18n.t('common.daysAgo', { count: diffDays });

  return date.toLocaleDateString(getDateLocale(), {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};
