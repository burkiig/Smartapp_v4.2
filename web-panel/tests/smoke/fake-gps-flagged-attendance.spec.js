const { test, expect, request } = require('@playwright/test');

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:8000/api/v1';
const STUDENT_LOGIN = process.env.SMOKE_STUDENT_LOGIN;
const STUDENT_PASSWORD = process.env.SMOKE_STUDENT_PASSWORD;
const INSTRUCTOR_LOGIN = process.env.SMOKE_INSTRUCTOR_LOGIN;
const INSTRUCTOR_PASSWORD = process.env.SMOKE_INSTRUCTOR_PASSWORD;

function requireEnv(name, value) {
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
}

async function apiLogin(api, login, password) {
  const response = await api.post('/auth/login', {
    data: { login, password },
  });
  expect(response.ok(), `Login failed for ${login}`).toBeTruthy();
}

test.describe('Fake GPS flagged attendance smoke', () => {
  test('marks pending_review and supports instructor review actions', async ({ page }) => {
    requireEnv('SMOKE_STUDENT_LOGIN', STUDENT_LOGIN);
    requireEnv('SMOKE_STUDENT_PASSWORD', STUDENT_PASSWORD);
    requireEnv('SMOKE_INSTRUCTOR_LOGIN', INSTRUCTOR_LOGIN);
    requireEnv('SMOKE_INSTRUCTOR_PASSWORD', INSTRUCTOR_PASSWORD);

    const studentApi = await request.newContext({
      baseURL: API_BASE_URL,
    });
    const instructorApi = await request.newContext({
      baseURL: API_BASE_URL,
    });

    await apiLogin(studentApi, STUDENT_LOGIN, STUDENT_PASSWORD);
    await apiLogin(instructorApi, INSTRUCTOR_LOGIN, INSTRUCTOR_PASSWORD);

    const meResponse = await studentApi.get('/auth/me');
    expect(meResponse.ok()).toBeTruthy();
    const student = await meResponse.json();
    const studentDisplayName = student.name || `Öğrenci #${student.id}`;

    const sessionsResp = await studentApi.get('/sessions/active');
    expect(sessionsResp.ok(), 'Could not fetch active sessions').toBeTruthy();
    const sessions = await sessionsResp.json();
    expect(Array.isArray(sessions) && sessions.length > 0, 'No active session exists for smoke test').toBeTruthy();
    const session = sessions[0];

    const scanResp = await studentApi.post('/attendance/scan-qr', {
      data: {
        session_id: session.id,
        qr_token: session.qr_token,
      },
    });
    expect(scanResp.ok(), 'scan-qr failed').toBeTruthy();

    // Minimal payload; when face engine is unavailable this still advances pipeline.
    const verifyFaceResp = await studentApi.post('/attendance/verify-face', {
      data: {
        session_id: session.id,
        image_base64: 'data:image/jpeg;base64,AA==',
      },
    });
    expect(verifyFaceResp.ok(), 'verify-face failed (ensure test student has valid face enrollment)').toBeTruthy();

    // Step 1 + 2: simulate mobile client calling verify-location with mocked GPS.
    const verifyLocationResp = await studentApi.post('/attendance/verify-location', {
      data: {
        session_id: session.id,
        latitude: session.latitude ?? 41.015137,
        longitude: session.longitude ?? 28.97953,
        accuracy: 5,
        is_mocked: true,
      },
    });
    expect(verifyLocationResp.ok(), 'verify-location failed').toBeTruthy();

    // Step 3 backend assertions from API response.
    const verifyLocationBody = await verifyLocationResp.json();
    expect(verifyLocationBody.status).toBe('pending_review');
    expect(verifyLocationBody.flag_reason).toBe('fake_gps_detected');
    expect(verifyLocationBody.is_flagged).toBe(true);

    // Login to instructor panel via UI.
    await page.goto('/');
    await page.getByPlaceholder('username veya email@örnek.com').fill(INSTRUCTOR_LOGIN);
    await page.getByPlaceholder('Şifrenizi girin').fill(INSTRUCTOR_PASSWORD);
    await page.getByRole('button', { name: 'Giriş Yap' }).click();

    const triageUrl = `/?tab=attendance&filter=flagged&session_id=${encodeURIComponent(String(session.id))}`;
    await page.goto(triageUrl);
    await expect(page.getByRole('heading', { name: 'Yoklama Yönetimi' })).toBeVisible();
    await expect(
      page.getByText(`Bildirimden geldiniz: Oturum ${String(session.id)} - Supheli Kayitlar Inceleniyor`)
    ).toBeVisible();

    // Triage filter: rendered records should only belong to the target session.
    const renderedSessionCells = page.locator('[data-session-id]');
    const renderedCount = await renderedSessionCells.count();
    for (let i = 0; i < renderedCount; i += 1) {
      await expect(renderedSessionCells.nth(i)).toHaveAttribute('data-session-id', String(session.id));
    }

    // Step 4a: ensure flagged list contains the record.
    await expect(page.getByText(studentDisplayName, { exact: false }).first()).toBeVisible();

    // Step 4b: ensure fake_gps_detected label is shown.
    await expect(page.getByText('fake_gps_detected').first()).toBeVisible();

    // Step 4c: ensure approve/reject action is possible and API call is sent.
    const focusedBefore = page.locator('.focused-student-name').first();
    const focusedBeforeText = (await focusedBefore.textContent())?.trim() || '';

    const approveRequestPromise = page.waitForRequest((requestItem) => {
      return (
        requestItem.method() === 'PATCH' &&
        requestItem.url().includes('/api/v1/attendance/') &&
        requestItem.url().endsWith('/review')
      );
    });
    const approveResponsePromise = page.waitForResponse((response) => {
      return (
        response.request().method() === 'PATCH' &&
        response.url().includes('/api/v1/attendance/') &&
        response.url().endsWith('/review')
      );
    });

    await page.getByRole('button', { name: 'Onayla' }).first().click();

    const approveRequest = await approveRequestPromise;
    const approvePayload = approveRequest.postDataJSON();
    expect(approvePayload).toMatchObject({
      is_flagged: false,
      status: 'present',
    });

    const approveResponse = await approveResponsePromise;
    expect(approveResponse.ok()).toBeTruthy();

    const focusedAfterLocator = page.locator('.focused-student-name');
    const focusedAfterCount = await focusedAfterLocator.count();
    if (focusedAfterCount > 0) {
      const focusedAfterText = ((await focusedAfterLocator.first().textContent()) || '').trim();
      expect(focusedAfterText).not.toBe(focusedBeforeText);
    }

    await studentApi.dispose();
    await instructorApi.dispose();
  });

  test('supports reject triage action with correct API payload', async ({ page }) => {
    requireEnv('SMOKE_INSTRUCTOR_LOGIN', INSTRUCTOR_LOGIN);
    requireEnv('SMOKE_INSTRUCTOR_PASSWORD', INSTRUCTOR_PASSWORD);

    const instructorApi = await request.newContext({
      baseURL: API_BASE_URL,
    });

    await apiLogin(instructorApi, INSTRUCTOR_LOGIN, INSTRUCTOR_PASSWORD);

    const flaggedResp = await instructorApi.get('/attendance/flagged');
    expect(flaggedResp.ok(), 'Could not fetch flagged records').toBeTruthy();
    const flaggedRecords = await flaggedResp.json();
    expect(Array.isArray(flaggedRecords) && flaggedRecords.length > 0, 'No flagged records available for reject smoke').toBeTruthy();
    const triageSessionId = String(flaggedRecords[0].session_id);

    await page.goto('/');
    await page.getByPlaceholder('username veya email@örnek.com').fill(INSTRUCTOR_LOGIN);
    await page.getByPlaceholder('Şifrenizi girin').fill(INSTRUCTOR_PASSWORD);
    await page.getByRole('button', { name: 'Giriş Yap' }).click();

    const triageUrl = `/?tab=attendance&filter=flagged&session_id=${encodeURIComponent(triageSessionId)}`;
    await page.goto(triageUrl);
    await expect(page.getByRole('heading', { name: 'Yoklama Yönetimi' })).toBeVisible();
    await expect(
      page.getByText(`Bildirimden geldiniz: Oturum ${triageSessionId} - Supheli Kayitlar Inceleniyor`)
    ).toBeVisible();

    const renderedSessionCells = page.locator('[data-session-id]');
    const renderedCount = await renderedSessionCells.count();
    for (let i = 0; i < renderedCount; i += 1) {
      await expect(renderedSessionCells.nth(i)).toHaveAttribute('data-session-id', triageSessionId);
    }

    const focusedBefore = page.locator('.focused-student-name').first();
    const focusedBeforeText = (await focusedBefore.textContent())?.trim() || '';

    const rejectRequestPromise = page.waitForRequest((requestItem) => {
      return (
        requestItem.method() === 'PATCH' &&
        requestItem.url().includes('/api/v1/attendance/') &&
        requestItem.url().endsWith('/review')
      );
    });
    const rejectResponsePromise = page.waitForResponse((response) => {
      return (
        response.request().method() === 'PATCH' &&
        response.url().includes('/api/v1/attendance/') &&
        response.url().endsWith('/review')
      );
    });

    await page.getByRole('button', { name: 'Reddet' }).first().click();

    const rejectRequest = await rejectRequestPromise;
    const rejectPayload = rejectRequest.postDataJSON();
    expect(rejectPayload).toMatchObject({
      is_flagged: false,
      status: 'absent',
    });

    const rejectResponse = await rejectResponsePromise;
    expect(rejectResponse.ok()).toBeTruthy();

    const focusedAfterLocator = page.locator('.focused-student-name');
    const focusedAfterCount = await focusedAfterLocator.count();
    if (focusedAfterCount > 0) {
      const focusedAfterText = ((await focusedAfterLocator.first().textContent()) || '').trim();
      expect(focusedAfterText).not.toBe(focusedBeforeText);
    }

    await instructorApi.dispose();
  });
});
