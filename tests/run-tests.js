const assert = require('assert');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Use a dedicated test database
const testDbPath = path.join(__dirname, 'test-attendance.db');
if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
process.env.DB_PATH = testDbPath;
process.env.JWT_SECRET = 'test-secret-key';
process.env.BCRYPT_ROUNDS = '4'; // Fast hashing for tests

const engine = require('../services/attendance-engine');
const app = require('../server');
const { close } = require('../database/db');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  PASS: ${name}`);
    passed++;
  } catch (err) {
    console.error(`  FAIL: ${name} -> ${err.message}`);
    failed++;
  }
}

async function asyncTest(name, fn) {
  try {
    await fn();
    console.log(`  PASS: ${name}`);
    passed++;
  } catch (err) {
    console.error(`  FAIL: ${name} -> ${err.message}`);
    failed++;
  }
}

function request(server, method, pathUrl, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const addr = server.address();
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const payload = body ? JSON.stringify(body) : null;
    if (payload) headers['Content-Length'] = Buffer.byteLength(payload);

    const req = http.request({
      hostname: '127.0.0.1',
      port: addr.port,
      path: pathUrl,
      method,
      headers
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data || '{}') });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function runAll() {
  console.log('\n--- Unit Tests: Attendance Calculation Engine ---');

  test('calculatePercentage computes exact percentage and handles zero total', () => {
    assert.strictEqual(engine.calculatePercentage(42, 50), 84);
    assert.strictEqual(engine.calculatePercentage(0, 0), 0);
  });

  test('calculateClassesNeeded computes consecutive classes to reach target', () => {
    // 28/40 = 70%, target 75% -> (28+x)/(40+x) >= 0.75 => 28+x >= 30+0.75x => 0.25x >= 2 => x = 8
    assert.strictEqual(engine.calculateClassesNeeded(28, 40, 75), 8);
    assert.strictEqual(engine.calculateClassesNeeded(18, 20, 75), 0);
    assert.strictEqual(engine.calculateClassesNeeded(10, 20, 100), -1);
  });

  test('calculateClassesCanMiss computes safe bunks and never returns negative', () => {
    // 17/20 = 85%, target 75% -> 17/(20+x) >= 0.75 => 17/0.75 - 20 = 22.66 - 20 = 2
    assert.strictEqual(engine.calculateClassesCanMiss(17, 20, 75), 2);
    assert.strictEqual(engine.calculateClassesCanMiss(10, 20, 75), 0);
  });

  test('predictFutureAttendance projects attendance accurately', () => {
    // 15/20 + 10 remaining with 2 planned absences => 23/30 = 76.666...%
    const proj = engine.predictFutureAttendance(15, 20, 10, 2);
    assert(Math.abs(proj - 76.6666) < 0.01);
  });

  test('calculateOverallAttendance uses weighted totals, not unweighted average', () => {
    // Subject A: 9/10 (90%), Subject B: 10/40 (25%). Weighted = 19/50 = 38% (unweighted would be 57.5%)
    const overall = engine.calculateOverallAttendance([
      { attended: 9, total: 10 },
      { attended: 10, total: 40 }
    ]);
    assert.strictEqual(overall, 38);
  });

  console.log('\n--- Integration Tests: API, Auth, Isolation & CRUD ---');

  const server = app.listen(0);
  let tokenA = '';
  let tokenB = '';
  let subjectId = '';
  let attendanceId = '';
  let deadlineId = '';
  let slotId = '';

  try {
    await asyncTest('GET /api/health and /api/v1/health return 200 ok', async () => {
      const res = await request(server, 'GET', '/api/health');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.status, 'ok');

      const v1 = await request(server, 'GET', '/api/v1/health');
      assert.strictEqual(v1.status, 200);
      assert.strictEqual(v1.body.apiVersion, '1.0.0');
    });

    await asyncTest('GET /api/system/version checks app version and update flags', async () => {
      const prevLatest = process.env.LATEST_APP_VERSION;
      const prevMin = process.env.MIN_SUPPORTED_APP_VERSION;
      process.env.LATEST_APP_VERSION = '1.2.0';
      process.env.MIN_SUPPORTED_APP_VERSION = '1.1.0';

      const oldClient = await request(server, 'GET', '/api/v1/system/version?currentVersion=1.0.0');
      assert.strictEqual(oldClient.status, 200);
      assert.strictEqual(oldClient.body.updateAvailable, true);
      assert.strictEqual(oldClient.body.forceUpdate, true);

      const currentClient = await request(server, 'GET', '/api/v1/system/version?currentVersion=1.2.0');
      assert.strictEqual(currentClient.body.updateAvailable, false);
      assert.strictEqual(currentClient.body.forceUpdate, false);

      process.env.LATEST_APP_VERSION = prevLatest || '1.0.0';
      process.env.MIN_SUPPORTED_APP_VERSION = prevMin || '1.0.0';
    });

    await asyncTest('Unauthenticated access to /api/subjects is rejected with 401', async () => {
      const res = await request(server, 'GET', '/api/subjects');
      assert.strictEqual(res.status, 401);
    });

    await asyncTest('User registration works and returns JWT + user without password_hash', async () => {
      const res = await request(server, 'POST', '/api/auth/register', {
        email: 'maya@example.com',
        password: 'Password123!',
        full_name: 'Maya Lin',
        student_id: 'CS-2025-01',
        semester: 4
      });
      assert.strictEqual(res.status, 201);
      assert(res.body.token);
      assert.strictEqual(res.body.user.email, 'maya@example.com');
      assert.strictEqual(res.body.user.password_hash, undefined);
      tokenA = res.body.token;
    });

    await asyncTest('Login rejects invalid credentials with 401', async () => {
      const res = await request(server, 'POST', '/api/auth/login', {
        email: 'maya@example.com',
        password: 'wrongpassword'
      });
      assert.strictEqual(res.status, 401);
    });

    await asyncTest('Login succeeds with valid credentials', async () => {
      const res = await request(server, 'POST', '/api/auth/login', {
        email: 'maya@example.com',
        password: 'Password123!'
      });
      assert.strictEqual(res.status, 200);
      assert(res.body.token);
    });

    await asyncTest('Create subject and verify initial stats', async () => {
      const res = await request(server, 'POST', '/api/subjects', {
        name: 'Data Structures',
        code: 'CS204',
        faculty_name: 'Dr. Torres',
        required_attendance: 75
      }, tokenA);
      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.body.code, 'CS204');
      assert.strictEqual(res.body.total, 0);
      subjectId = res.body.id;
    });

    await asyncTest('Record attendance and prevent duplicate for same date & time', async () => {
      const res1 = await request(server, 'POST', '/api/attendance', {
        subject_id: subjectId,
        date: '2026-11-24',
        start_time: '09:00:00',
        status: 'present'
      }, tokenA);
      assert.strictEqual(res1.status, 201);
      assert.strictEqual(res1.body.subject.percentage, 100);
      attendanceId = res1.body.record.id;

      const dup = await request(server, 'POST', '/api/attendance', {
        subject_id: subjectId,
        date: '2026-11-24',
        start_time: '09:00:00',
        status: 'absent'
      }, tokenA);
      assert.strictEqual(dup.status, 409);
    });

    await asyncTest('Edit attendance updates subject percentage dynamically', async () => {
      const res = await request(server, 'PUT', `/api/attendance/${attendanceId}`, {
        status: 'absent'
      }, tokenA);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.subject.percentage, 0);
      assert.strictEqual(res.body.subject.absent, 1);
    });

    await asyncTest('Dashboard reflects dynamic database calculations', async () => {
      const res = await request(server, 'GET', '/api/dashboard', null, tokenA);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.total_subjects, 1);
      assert.strictEqual(res.body.total_classes, 1);
      assert.strictEqual(res.body.overall_attendance, 0);
      assert.strictEqual(res.body.subjects_below_threshold.length, 1);
    });

    await asyncTest('Deadlines CRUD and completion toggle', async () => {
      const createRes = await request(server, 'POST', '/api/deadlines', {
        title: 'Midterm Exam',
        subject_id: subjectId,
        category: 'exam_quiz',
        due_date: '2026-12-01'
      }, tokenA);
      assert.strictEqual(createRes.status, 201);
      deadlineId = createRes.body.id;

      const compRes = await request(server, 'PUT', `/api/deadlines/${deadlineId}/complete`, {}, tokenA);
      assert.strictEqual(compRes.status, 200);
      assert.strictEqual(compRes.body.is_completed, 1);
    });

    await asyncTest('Timetable CRUD (including Lunch Break without subject) and settings update', async () => {
      const ttRes = await request(server, 'POST', '/api/timetable', {
        subject_id: subjectId,
        day_of_week: 1,
        start_time: '09:00',
        end_time: '10:30'
      }, tokenA);
      assert.strictEqual(ttRes.status, 201);
      slotId = ttRes.body.id;

      const lunchRes = await request(server, 'POST', '/api/timetable', {
        day_of_week: 1,
        start_time: '12:45',
        end_time: '13:30',
        session_type: 'lunch',
        room: 'Cafeteria'
      }, tokenA);
      assert.strictEqual(lunchRes.status, 201);
      assert.strictEqual(lunchRes.body.session_type, 'lunch');
      assert.strictEqual(lunchRes.body.subject_id, null);

      const breakRes = await request(server, 'POST', '/api/timetable', {
        day_of_week: 1,
        start_time: '10:30',
        end_time: '11:00',
        session_type: 'break'
      }, tokenA);
      assert.strictEqual(breakRes.status, 201);
      assert.strictEqual(breakRes.body.session_type, 'break');
      assert.strictEqual(breakRes.body.subject_id, null);

      const setRes = await request(server, 'PUT', '/api/settings', {
        min_attendance_threshold: 80
      }, tokenA);
      assert.strictEqual(setRes.status, 200);
      assert.strictEqual(setRes.body.min_attendance_threshold, 80);
    });

    await asyncTest('User data isolation: User B cannot view or modify User A subjects', async () => {
      const regB = await request(server, 'POST', '/api/auth/register', {
        email: 'other@example.com',
        password: 'Password123!',
        full_name: 'Other Student'
      });
      tokenB = regB.body.token;

      const getRes = await request(server, 'GET', `/api/subjects/${subjectId}`, null, tokenB);
      assert.strictEqual(getRes.status, 404);

      const delRes = await request(server, 'DELETE', `/api/subjects/${subjectId}`, null, tokenB);
      assert.strictEqual(delRes.status, 404);
    });

    await asyncTest('Account deletion removes User A and cascades data without affecting User B', async () => {
      const delAcc = await request(server, 'DELETE', '/api/auth/me', null, tokenA);
      assert.strictEqual(delAcc.status, 200);

      const meAfter = await request(server, 'GET', '/api/auth/me', null, tokenA);
      assert.strictEqual(meAfter.status, 404);

      const userBMe = await request(server, 'GET', '/api/auth/me', null, tokenB);
      assert.strictEqual(userBMe.status, 200);
      assert.strictEqual(userBMe.body.email, 'other@example.com');
    });
  } finally {
    server.close();
    close();
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
  }

  console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

runAll().catch(err => {
  console.error(err);
  process.exit(1);
});
