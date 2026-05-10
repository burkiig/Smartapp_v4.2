/**
 * Full URL for the secondary "projector" window (same origin, shared auth cookie).
 */
export function getProjectorAttendanceUrl(sessionId) {
  const base = (process.env.PUBLIC_URL || '').replace(/\/$/, '');
  return `${window.location.origin}${base}/present/attendance/${sessionId}`;
}

export function openProjectorAttendanceWindow(sessionId) {
  window.open(
    getProjectorAttendanceUrl(sessionId),
    'smartapp_projector',
    'noopener,noreferrer',
  );
}
