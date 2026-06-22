import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  MdPeople, MdSchool, MdWarning, MdTrendingUp, MdLogout, MdNotifications,
} from 'react-icons/md';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { LanguageSwitcher } from '../shared/components/LanguageSwitcher/LanguageSwitcher';
import apiClient from '../shared/services/apiClient';
import './LeadershipDashboardPage.css';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

function LeadershipDashboardPage({ user, onLogout }) {
  const { t } = useTranslation();
  const [overview, setOverview] = useState(null);
  const [chartData, setChartData] = useState(null);
  const [atRisk, setAtRisk] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const isRector = user?.role === 'rector';

  const handleForbidden = useCallback(async (err) => {
    if (err?.status === 403) {
      await onLogout();
      window.location.href = '/';
      return true;
    }
    return false;
  }, [onLogout]);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [overviewRes, deptRes, riskRes] = await Promise.all([
        apiClient.get('/leadership/overview'),
        apiClient.get('/leadership/departments'),
        apiClient.get('/leadership/at-risk', { params: { page: 1, page_size: 50 } }),
      ]);
      setOverview(overviewRes);
      setChartData(deptRes);
      setAtRisk(riskRes);
    } catch (err) {
      if (await handleForbidden(err)) return;
      setError(err.message || t('leadership.loadError'));
    } finally {
      setLoading(false);
    }
  }, [handleForbidden, t]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const barChart = useMemo(() => {
    if (!chartData?.items?.length) return null;

    const labels = chartData.view === 'departments'
      ? chartData.items.map((d) => d.department)
      : chartData.items.map((d) => d.course_code);

    const values = chartData.items.map((d) => d.attendance_rate);

    return {
      data: {
        labels,
        datasets: [{
          label: t('leadership.chartAttendance'),
          data: values,
          backgroundColor: 'rgba(37, 99, 235, 0.75)',
          borderRadius: 6,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          title: {
            display: true,
            text: chartData.view === 'departments'
              ? t('leadership.departmentComparison')
              : t('leadership.courseComparison'),
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            max: 100,
            ticks: { callback: (v) => `${v}%` },
          },
        },
      },
    };
  }, [chartData, t]);

  const notifyAdvisor = (studentName) => {
    setToast(t('leadership.notifySent', { name: studentName }));
    setTimeout(() => setToast(''), 3500);
  };

  const roleLabel = isRector ? t('leadership.roleRector') : t('leadership.roleDean');

  return (
    <div className="leadership-dashboard">
      <header className="leadership-header">
        <div>
          <h1>{t('leadership.title')}</h1>
          <p className="leadership-subtitle">
            {roleLabel}
            {user?.scope_value ? ` · ${user.scope_value}` : ''}
            {overview?.scope_department ? ` · ${overview.scope_department}` : ''}
          </p>
        </div>
        <div className="leadership-header-actions">
          <LanguageSwitcher />
          <button type="button" className="leadership-logout" onClick={onLogout}>
            <MdLogout /> {t('app.logout')}
          </button>
        </div>
      </header>

      {toast && <div className="leadership-toast" role="status">{toast}</div>}

      <main className="leadership-main">
        {loading && (
          <div className="leadership-loading">
            <div className="loading-spinner" />
            <p>{t('app.loading')}</p>
          </div>
        )}

        {!loading && error && (
          <div className="leadership-error">
            <p>{error}</p>
            <button type="button" onClick={loadDashboard}>{t('common.retry')}</button>
          </div>
        )}

        {!loading && !error && overview && (
          <>
            <section className="leadership-kpi-grid">
              <div className="leadership-kpi">
                <MdTrendingUp className="kpi-icon accent" />
                <div>
                  <span className="kpi-label">{t('leadership.avgAttendance')}</span>
                  <span className="kpi-value">{overview.average_attendance_rate}%</span>
                </div>
              </div>
              <div className="leadership-kpi">
                <MdPeople className="kpi-icon danger" />
                <div>
                  <span className="kpi-label">{t('leadership.atRiskCount')}</span>
                  <span className="kpi-value">{atRisk?.total ?? 0}</span>
                </div>
              </div>
              <div className="leadership-kpi">
                <MdSchool className="kpi-icon" />
                <div>
                  <span className="kpi-label">{t('leadership.activeCourses')}</span>
                  <span className="kpi-value">{overview.active_courses}</span>
                </div>
              </div>
              <div className="leadership-kpi">
                <MdWarning className="kpi-icon danger" />
                <div>
                  <span className="kpi-label">{t('leadership.flaggedRecords')}</span>
                  <span className="kpi-value">{overview.flagged_records}</span>
                </div>
              </div>
            </section>

            {barChart && (
              <section className="leadership-chart-card">
                <div className="leadership-chart-wrap">
                  <Bar data={barChart.data} options={barChart.options} />
                </div>
              </section>
            )}

            <section className="leadership-risk-section">
              <div className="leadership-section-header">
                <h2>{t('leadership.atRiskTitle')}</h2>
                <span className="leadership-risk-count">
                  {atRisk?.total ?? 0} {t('leadership.students')}
                  {atRisk?.min_attendance_rate != null && (
                    <> · {t('leadership.minRate')}: %{atRisk.min_attendance_rate}</>
                  )}
                </span>
              </div>

              {!atRisk?.items?.length ? (
                <p className="leadership-empty">{t('leadership.noAtRisk')}</p>
              ) : (
                <div className="leadership-table-wrap">
                  <table className="leadership-table">
                    <thead>
                      <tr>
                        <th>{t('leadership.colName')}</th>
                        <th>{t('leadership.colNumber')}</th>
                        <th>{t('leadership.colDepartment')}</th>
                        <th>{t('leadership.colRate')}</th>
                        <th>{t('leadership.colStreak')}</th>
                        <th>{t('leadership.colRisk')}</th>
                        <th>{t('leadership.colAction')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {atRisk.items.map((row) => (
                        <tr key={row.id}>
                          <td>{row.name}</td>
                          <td>{row.student_number || '—'}</td>
                          <td>{row.department}</td>
                          <td>{row.attendance_rate}%</td>
                          <td>{row.consecutive_absent}</td>
                          <td>
                            <span className={`risk-badge risk-${row.risk_level}`}>
                              {row.risk_level === 'critical'
                                ? t('leadership.riskCritical')
                                : t('leadership.riskPotential')}
                            </span>
                          </td>
                          <td>
                            <button
                              type="button"
                              className="leadership-notify-btn"
                              onClick={() => notifyAdvisor(row.name)}
                            >
                              <MdNotifications /> {t('leadership.notifyAdvisor')}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}

export default LeadershipDashboardPage;
