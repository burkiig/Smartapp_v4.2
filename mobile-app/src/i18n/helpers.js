import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

/** @returns {{ daysShort: string[], daysFull: string[], months: string[] }} */
export function useCalendar() {
  const { t } = useTranslation();
  return useMemo(() => ({
    daysShort: t('calendar.daysShort', { returnObjects: true }),
    daysFull: t('calendar.daysFull', { returnObjects: true }),
    months: t('calendar.months', { returnObjects: true }),
  }), [t]);
}

/** @returns {string[]} */
export function useCancelReasons() {
  const { t } = useTranslation();
  return useMemo(
    () => t('cancel.reasons', { returnObjects: true }),
    [t],
  );
}

/** Attendance status label by backend code */
export function useAttendanceStatusLabel() {
  const { t } = useTranslation();
  return (code) => {
    const key = `attendance.status.${code}`;
    const translated = t(key);
    return translated === key ? t('attendance.status.unknown') : translated;
  };
}
