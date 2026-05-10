import React from 'react';
import { useTranslation } from 'react-i18next';
import './QRScan.css';

/**
 * Start-session form shared by QRScan and Classroom (sunum) flows.
 */
export function SessionStartForm({
  form,
  setForm,
  rooms,
  courses,
  onRoomChange,
  onSubmit,
  starting,
}) {
  const { t } = useTranslation();

  return (
    <div className="start-session-section">
      <h3>{t('qrScan.newSession')}</h3>
      <form onSubmit={onSubmit} className="session-form">
        <div className="form-row-qr">
          <div className="form-group-qr">
            <label>{t('qrScan.courseLabel')}</label>
            <select
              value={form.course_id}
              onChange={(e) => setForm((f) => ({ ...f, course_id: e.target.value }))}
              required
            >
              <option value="">{t('qrScan.coursePlaceholder')}</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.name}
                </option>
              ))}
            </select>
            {courses.length === 0 && <span className="hint-text">{t('qrScan.noCourses')}</span>}
          </div>
          <div className="form-group-qr">
            <label>{t('qrScan.dateLabel')}</label>
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
            />
          </div>
        </div>
        <div className="form-row-qr">
          <div className="form-group-qr">
            <label>{t('qrScan.startTime')}</label>
            <input
              type="time"
              value={form.start_time}
              onChange={(e) => setForm((f) => ({ ...f, start_time: e.target.value }))}
            />
          </div>
          <div className="form-group-qr">
            <label>{t('qrScan.endTime')}</label>
            <input
              type="time"
              value={form.end_time}
              onChange={(e) => setForm((f) => ({ ...f, end_time: e.target.value }))}
            />
          </div>
        </div>

        <div className="form-row-qr">
          <div className="form-group-qr form-group-full">
            <label>
              🏛 {t('qrScan.roomLabel')} <span className="hint-text">({t('qrScan.roomHint')})</span>
            </label>
            <select
              value={form.room_id}
              onChange={(e) => onRoomChange(e.target.value)}
            >
              <option value="">{t('qrScan.roomPlaceholder')}</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                  {r.latitude
                    ? ` (${Number(r.latitude).toFixed(4)}, ${Number(r.longitude).toFixed(4)})`
                    : ` — ${t('qrScan.noGps')}`}
                </option>
              ))}
            </select>
            {rooms.length === 0 && (
              <span className="hint-text hint-warn">{t('qrScan.noRooms')}</span>
            )}
            {form.room_id
              && !rooms.find((r) => String(r.id) === String(form.room_id))?.latitude && (
                <span className="hint-text hint-warn">{t('qrScan.roomNoGps')}</span>
              )}
          </div>
        </div>

        <div className="form-row-qr">
          <div className="form-group-qr">
            <label>{t('qrScan.latLabel')}</label>
            <input
              type="number"
              step="any"
              placeholder="41.015137"
              value={form.latitude}
              onChange={(e) => setForm((f) => ({ ...f, latitude: e.target.value }))}
              className={form.room_id && form.latitude ? 'input-auto-filled' : ''}
            />
          </div>
          <div className="form-group-qr">
            <label>{t('qrScan.lngLabel')}</label>
            <input
              type="number"
              step="any"
              placeholder="28.979530"
              value={form.longitude}
              onChange={(e) => setForm((f) => ({ ...f, longitude: e.target.value }))}
              className={form.room_id && form.longitude ? 'input-auto-filled' : ''}
            />
          </div>
        </div>
        <button type="submit" className="start-btn" disabled={starting}>
          {starting ? t('qrScan.startingBtn') : t('qrScan.startBtn')}
        </button>
      </form>
    </div>
  );
}
