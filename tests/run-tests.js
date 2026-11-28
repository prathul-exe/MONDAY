const assert = require('assert');
const http = require('http');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// Load .env first so configured DATABASE_URL is visible to the safety guard.
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

// Default to an isolated SQLite test database even if .env sets DB_CLIENT=postgres or DATABASE_URL.
// PostgreSQL testing requires explicit opt-in via TEST_DB_CLIENT=postgres and TEST_DATABASE_URL.
const testDbPath = path.join(__dirname, 'test-attendance.db');
const usePostgresTests = (process.env.TEST_DB_CLIENT || '').trim().toLowerCase() === 'postgres';
const configuredDatabaseUrl = (process.env.DATABASE_URL || '').trim();

if (usePostgresTests) {
  const testUrl = (process.env.TEST_DATABASE_URL || '').trim();
  if (!testUrl) {
    console.error('ERROR: TEST_DB_CLIENT=postgres requires TEST_DATABASE_URL to be set.');
    process.exit(1);
  }
  if (configuredDatabaseUrl && testUrl === configuredDatabaseUrl) {
    console.error('ERROR: TEST_DATABASE_URL matches DATABASE_URL. Refusing to run tests against production.');
    process.exit(1);
  }
  let parsedTestUrl;
  try {
    parsedTestUrl = new URL(testUrl);
  } catch {
    console.error('ERROR: TEST_DATABASE_URL is not a valid URL.');
    process.exit(1);
  }
  const expectedProjectRef = 'ojnyrezxiodvjdvojjid';
  const uriUser = decodeURIComponent(parsedTestUrl.username || '');
  const isExpectedPooler = uriUser === `postgres.${expectedProjectRef}`;
  const isExpectedDirect = parsedTestUrl.hostname === `db.${expectedProjectRef}.supabase.co` && uriUser === 'postgres';
  if (!isExpectedPooler && !isExpectedDirect) {
    console.error(`ERROR: TEST_DATABASE_URL does not match expected project reference (${expectedProjectRef}). Refusing to run.`);
    process.exit(1);
  }
  process.env.DB_CLIENT = 'postgres';
  process.env.DATABASE_URL = testUrl;
} else {
  if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
  process.env.DB_CLIENT = 'sqlite';
  process.env.DB_PATH = testDbPath;
}
process.env.JWT_SECRET = 'test-secret-key';
process.env.BCRYPT_ROUNDS = '4'; // Fast hashing for tests

const jwt = require('jsonwebtoken');
const { DatabaseSync } = require('node:sqlite');
const engine = require('../services/attendance-engine');
const app = require('../server');
const { authenticate, generateToken } = require('../middleware/auth');
const { close, getDatabase, getDbClient, isPostgres, emptyToNull } = require('../database/db');
const { convertPlaceholders, transformSqlForPostgres } = require('../database/pg');
const { TABLES, valuesMatch, findRowMismatches, verifyData, runMigration } = require('../scripts/migrate-sqlite-to-pg');

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

  test('DB_CLIENT defaults to sqlite even when DATABASE_URL is set', () => {
    const prevClient = process.env.DB_CLIENT;
    const prevUrl = process.env.DATABASE_URL;
    try {
      delete process.env.DB_CLIENT;
      process.env.DATABASE_URL = 'postgres://user:pass@localhost:5432/db';
      assert.strictEqual(getDbClient(), 'sqlite');
      assert.strictEqual(isPostgres(), false);

      process.env.DB_CLIENT = 'postgres';
      assert.strictEqual(getDbClient(), 'postgres');
      assert.strictEqual(isPostgres(), true);
    } finally {
      if (prevClient === undefined) delete process.env.DB_CLIENT;
      else process.env.DB_CLIENT = prevClient;
      if (prevUrl === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = prevUrl;
    }
  });

  test('PostgreSQL SQL transformer converts placeholders and boolean literals safely', () => {
    assert.strictEqual(
      convertPlaceholders("SELECT * FROM users WHERE email = ? AND note = 'why?' AND id = ?"),
      "SELECT * FROM users WHERE email = $1 AND note = 'why?' AND id = $2"
    );
    assert.strictEqual(
      convertPlaceholders("SELECT 'it''s ?' AS q, \"col?\" FROM tbl WHERE a = ? -- comment?\n/* nested /* ? */ ? */ AND b = ?"),
      "SELECT 'it''s ?' AS q, \"col?\" FROM tbl WHERE a = $1 -- comment?\n/* nested /* ? */ ? */ AND b = $2"
    );
    assert.strictEqual(
      convertPlaceholders("SELECT $$hello ?$$, $tag$world ?$tag$ WHERE id = ?"),
      "SELECT $$hello ?$$, $tag$world ?$tag$ WHERE id = $1"
    );
    assert.strictEqual(
      transformSqlForPostgres("SELECT * FROM subjects WHERE user_id = ? AND is_active = 1 AND note = 'is_active = 1' -- is_active = 0\n"),
      "SELECT * FROM subjects WHERE user_id = $1 AND is_active = TRUE AND note = 'is_active = 1' -- is_active = 0\n"
    );
    assert.strictEqual(
      transformSqlForPostgres('UPDATE deadlines SET is_completed = 0 WHERE id = ? AND is_completed = 1'),
      'UPDATE deadlines SET is_completed = FALSE WHERE id = $1 AND is_completed = TRUE'
    );
  });

  test('emptyToNull normalizes empty and whitespace strings to null', () => {
    assert.strictEqual(emptyToNull(''), null);
    assert.strictEqual(emptyToNull('   '), null);
    assert.strictEqual(emptyToNull(undefined), null);
    assert.strictEqual(emptyToNull(null), null);
    assert.strictEqual(emptyToNull(0), 0);
    assert.strictEqual(emptyToNull('09:00'), '09:00');
  });

  test('JWT generation and verification enforce HS256 algorithm', () => {
    const token = generateToken({ id: '11111111-1111-4111-8111-111111111111', email: 'hs256@example.com' });
    const decoded = jwt.decode(token, { complete: true });
    assert.strictEqual(decoded.header.alg, 'HS256');

    const verifiedReq = { headers: { authorization: `Bearer ${token}` } };
    let nextCalled = false;
    authenticate(verifiedReq, { status: () => ({ json: () => {} }) }, () => { nextCalled = true; });
    assert.strictEqual(nextCalled, true);
    assert.strictEqual(verifiedReq.user.email, 'hs256@example.com');

    // Reject alg=none unsigned token
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({ id: '11111111-1111-4111-8111-111111111111', email: 'hs256@example.com' })).toString('base64url');
    const unsignedToken = `${header}.${payload}.`;
    let rejectedStatus = 0;
    authenticate(
      { headers: { authorization: `Bearer ${unsignedToken}` } },
      { status: (code) => ({ json: () => { rejectedStatus = code; } }) },
      () => { throw new Error('Should not accept alg=none'); }
    );
    assert.strictEqual(rejectedStatus, 401);
  });

  await asyncTest('Frontend API.request preserves auth 401 errors and expires session only on protected endpoints', async () => {
    const apiSource = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'services', 'api.js'), 'utf8');
    let nextResponse = null;
    let reloaded = false;
    let removedCount = 0;
    const store = new Map([['monday_token', 'existing-token']]);

    const sandbox = {
      fetch: async () => nextResponse,
      localStorage: {
        getItem: (k) => store.get(k) || null,
        removeItem: (k) => { store.delete(k); }
      },
      TokenStorage: {
        getSync: () => store.get('monday_token') || null,
        remove: async () => { removedCount++; store.delete('monday_token'); }
      },
      window: {
        location: {
          reload: () => { reloaded = true; }
        }
      },
      AppConfig: {
        APP_VERSION: '1.0.0',
        isNative: () => false,
        getApiBaseUrl: () => '/api/v1'
      }
    };

    vm.runInNewContext(`${apiSource}\nthis.API = API;`, sandbox);
    const { API } = sandbox;

    // 1. /auth/login 401 must surface backend error without clearing token or reloading
    nextResponse = {
      status: 401,
      ok: false,
      json: async () => ({ error: 'Invalid email or password' })
    };
    await assert.rejects(() => API.post('/auth/login', { email: 'a@b.com', password: 'bad' }), /Invalid email or password/);
    assert.strictEqual(reloaded, false);
    assert.strictEqual(removedCount, 0);
    assert.strictEqual(store.get('monday_token'), 'existing-token');

    // 2. /auth/register 401/409 must not trigger Session expired
    nextResponse = {
      status: 401,
      ok: false,
      json: async () => ({ error: 'Registration not allowed' })
    };
    await assert.rejects(() => API.post('/auth/register', { email: 'a@b.com' }), /Registration not allowed/);
    assert.strictEqual(reloaded, false);
    assert.strictEqual(removedCount, 0);

    // 3. Protected endpoint 401 must clear token, reload, and throw Session expired
    nextResponse = {
      status: 401,
      ok: false,
      json: async () => ({ error: 'Authentication required' })
    };
    await assert.rejects(() => API.get('/subjects'), /Session expired/);
    assert.strictEqual(reloaded, true);
    assert.strictEqual(removedCount, 1);
    assert.strictEqual(store.has('monday_token'), false);
  });

  test('DashboardComponent.renderSubjects does not duplicate cards across repeated renders', () => {
    const dashSource = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'components', 'dashboard.js'), 'utf8');
    const container = { innerHTML: '', querySelectorAll: () => [] };
    const sandbox = {
      document: {
        getElementById: (id) => (id === 'subjects-list-container' ? container : null)
      },
      App: { currentUser: { full_name: 'Maya', semester: 4 } },
      NavigationComponent: { renderHeader: () => '', renderDock: () => '' },
      AttendanceCalc: {
        getStatus: () => ({ status: 'safe', label: 'Safe', color: '#4D7E5C', bgColor: '#E8F3EB', strokeColor: '#4D7E5C' })
      },
      Helpers: {
        escapeHtml: (v) => String(v ?? ''),
        loadingSpinner: () => '',
        getGreeting: () => 'Hello'
      },
      AttendanceCalc: {
        getStatus: () => ({ status: 'safe', label: 'Safe', color: '#4D7E5C', bgColor: '#E8F3EB' })
      },
      Router: { navigate: () => {} },
      API: {}
    };
    vm.runInNewContext(`${dashSource}\nthis.DashboardComponent = DashboardComponent;`, sandbox);
    const { DashboardComponent } = sandbox;
    DashboardComponent.data = {
      subjects: [
        { id: 'sub-1', name: 'Data Science', code: 'DS301', total: 0, attended: 0, percentage: 0, required_attendance: 75, classes_needed: 0, classes_can_miss: 0 },
        { id: 'sub-1', name: 'Data Science', code: 'DS301', total: 0, attended: 0, percentage: 0, required_attendance: 75, classes_needed: 0, classes_can_miss: 0 }
      ]
    };
    DashboardComponent.renderSubjects();
    DashboardComponent.renderSubjects();
    const matches = container.innerHTML.match(/class="subject-card /g) || [];
    assert.strictEqual(matches.length, 1);
  });

  await asyncTest('DashboardComponent quick-mark lock prevents duplicate rapid submissions and recovers after error', async () => {
    const dashSource = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'components', 'dashboard.js'), 'utf8');
    const createBtn = (quickMark) => {
      const listeners = {};
      return {
        dataset: { subjectId: 'sub-1', quickMark },
        disabled: false,
        addEventListener(evt, fn) { listeners[evt] = fn; },
        click() { return listeners.click?.({ stopPropagation: () => {} }); }
      };
    };
    const presentBtn = createBtn('present');
    const absentBtn = createBtn('absent');
    const container = {
      innerHTML: '',
      querySelectorAll: (sel) => {
        if (sel === '.quick-mark-btn') return [presentBtn, absentBtn];
        return [];
      }
    };
    const toasts = [];
    let postCalls = 0;
    let rejectPending;
    let resolvePending;
    let shouldFail = true;

    const sandbox = {
      document: {
        getElementById: (id) => (id === 'subjects-list-container' ? container : null)
      },
      App: { currentUser: { full_name: 'Maya', semester: 4 } },
      NavigationComponent: { renderHeader: () => '', renderDock: () => '' },
      AttendanceCalc: {
        getStatus: () => ({ status: 'safe', label: 'Safe', color: '#4D7E5C', bgColor: '#E8F3EB', strokeColor: '#4D7E5C' })
      },
      Helpers: {
        escapeHtml: (v) => String(v ?? ''),
        loadingSpinner: () => '',
        getGreeting: () => 'Hello',
        showToast: (msg, type = 'success') => toasts.push({ msg, type })
      },
      AttendanceCalc: {
        getStatus: () => ({ status: 'safe', label: 'Safe', color: '#4D7E5C', bgColor: '#E8F3EB' })
      },
      Router: { navigate: () => {} },
      API: {
        post: () => {
          postCalls += 1;
          return new Promise((resolve, reject) => {
            if (shouldFail) rejectPending = reject;
            else resolvePending = resolve;
          });
        }
      }
    };
    vm.runInNewContext(`${dashSource}\nthis.DashboardComponent = DashboardComponent;`, sandbox);
    const { DashboardComponent } = sandbox;
    DashboardComponent.loadDashboard = async () => {};
    DashboardComponent.data = {
      subjects: [
        { id: 'sub-1', name: 'Data Science', code: 'DS301', total: 0, attended: 0, percentage: 0, required_attendance: 75, classes_needed: 0, classes_can_miss: 0 }
      ]
    };
    DashboardComponent.renderSubjects();

    const firstClick = presentBtn.click();
    const secondClick = absentBtn.click();
    await secondClick;

    assert.strictEqual(postCalls, 1);
    assert.strictEqual(DashboardComponent.isMarkingAttendance, true);
    assert.strictEqual(presentBtn.disabled, true);
    assert.strictEqual(absentBtn.disabled, true);

    rejectPending(new Error('Network error'));
    await firstClick;

    assert.strictEqual(DashboardComponent.isMarkingAttendance, false);
    assert.strictEqual(presentBtn.disabled, false);
    assert.strictEqual(absentBtn.disabled, false);
    assert(toasts.some((t) => t.type === 'error' && t.msg.includes('Network error')));

    shouldFail = false;
    const retryClick = presentBtn.click();
    assert.strictEqual(postCalls, 2);
    resolvePending({ ok: true });
    await retryClick;
    assert.strictEqual(DashboardComponent.isMarkingAttendance, false);
    assert.strictEqual(presentBtn.disabled, false);
  });

  await asyncTest('SubjectDetailComponent attendance locks prevent rapid duplicate requests and recover after error', async () => {
    const detailSource = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'components', 'subject-detail.js'), 'utf8');
    const elements = {
      'sd-mark-present': { disabled: false },
      'sd-mark-absent': { disabled: false },
      'att-modal-save': { disabled: false },
      'att-edit-id': { value: '' },
      'att-date': { value: '2026-11-28' },
      'att-time': { value: '10:00' },
      'att-session-type': { value: 'lecture' },
      'att-notes': { value: '' },
      'attendance-modal': { classList: { add: () => {}, remove: () => {} } },
      'att-entry-form': {
        listeners: {},
        addEventListener(evt, fn) { this.listeners[evt] = fn; }
      }
    };
    const toasts = [];
    let postCalls = 0;
    let rejectPending;
    let resolvePending;
    let shouldFail = true;

    const sandbox = {
      document: {
        getElementById: (id) => elements[id] || null,
        querySelectorAll: () => []
      },
      NavigationComponent: { renderHeader: () => '', renderDock: () => '' },
      AttendanceCalc: {
        getStatus: () => ({ status: 'safe', label: 'Safe', color: '#4D7E5C', bgColor: '#E8F3EB', strokeColor: '#4D7E5C' })
      },
      Helpers: {
        escapeHtml: (v) => String(v ?? ''),
        loadingSpinner: () => '',
        showToast: (msg, type = 'success') => toasts.push({ msg, type })
      },
      API: {
        post: () => {
          postCalls += 1;
          return new Promise((resolve, reject) => {
            if (shouldFail) rejectPending = reject;
            else resolvePending = resolve;
          });
        }
      }
    };
    vm.runInNewContext(`${detailSource}\nthis.SubjectDetailComponent = SubjectDetailComponent;`, sandbox);
    const { SubjectDetailComponent } = sandbox;
    SubjectDetailComponent.subjectId = 'sub-1';
    SubjectDetailComponent.loadData = async () => {};

    const firstQuick = SubjectDetailComponent.quickMark('present');
    await SubjectDetailComponent.quickMark('absent');

    assert.strictEqual(postCalls, 1);
    assert.strictEqual(SubjectDetailComponent.isSubmittingAttendance, true);
    assert.strictEqual(elements['sd-mark-present'].disabled, true);
    assert.strictEqual(elements['sd-mark-absent'].disabled, true);

    rejectPending(new Error('Save failed'));
    await firstQuick;

    assert.strictEqual(SubjectDetailComponent.isSubmittingAttendance, false);
    assert.strictEqual(elements['sd-mark-present'].disabled, false);
    assert.strictEqual(elements['sd-mark-absent'].disabled, false);
    assert(toasts.some((t) => t.type === 'error' && t.msg.includes('Save failed')));

    SubjectDetailComponent.attachModalEvents();
    shouldFail = false;
    const submitEvent = { preventDefault: () => {} };
    const firstSubmit = elements['att-entry-form'].listeners.submit(submitEvent);
    await elements['att-entry-form'].listeners.submit(submitEvent);

    assert.strictEqual(postCalls, 2);
    assert.strictEqual(elements['att-modal-save'].disabled, true);
    resolvePending({ ok: true });
    await firstSubmit;
    assert.strictEqual(SubjectDetailComponent.isSubmittingAttendance, false);
    assert.strictEqual(elements['att-modal-save'].disabled, false);
  });

  await asyncTest('DeadlinesComponent deduplicates renders, locks rapid submits, supports custom tasks/editing, and omits grade %', async () => {
    const dlSource = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'components', 'deadlines.js'), 'utf8');
    const makeClassList = (initial = []) => {
      const set = new Set(initial);
      return {
        add: (...cls) => cls.forEach((c) => set.add(c)),
        remove: (...cls) => cls.forEach((c) => set.delete(c)),
        toggle: (c, force) => (force === undefined ? (set.has(c) ? set.delete(c) : set.add(c)) : (force ? set.add(c) : set.delete(c))),
        contains: (c) => set.has(c)
      };
    };
    const catButtons = ['assignment', 'custom'].map((cat) => {
      const listeners = {};
      return {
        dataset: { cat },
        classList: makeClassList(cat === 'assignment' ? ['bg-secondary-container'] : []),
        addEventListener(evt, fn) { listeners[evt] = fn; },
        click() { return listeners.click?.(); }
      };
    });
    const elements = {
      'deadlines-content': { innerHTML: '', querySelectorAll: () => [] },
      'add-task-modal': { classList: makeClassList(['hidden']) },
      'dl-modal-title': { textContent: '' },
      'dl-submit-label': { textContent: '' },
      'dl-submit-btn': { disabled: false },
      'dl-title': { value: '' },
      'dl-subject': { value: '' },
      'dl-date': { value: '2026-12-01' },
      'dl-time': { value: '23:59' },
      'dl-custom-name-wrap': { classList: makeClassList(['hidden']) },
      'dl-custom-name': { value: '', focus: () => {} },
      'dl-create-form': {
        listeners: {},
        reset() {},
        addEventListener(evt, fn) { this.listeners[evt] = fn; }
      }
    };
    const toasts = [];
    const requests = [];
    let resolvePending;

    const sandbox = {
      document: {
        getElementById: (id) => elements[id] || null,
        querySelectorAll: (sel) => (sel === '.dl-cat-btn' ? catButtons : [])
      },
      NavigationComponent: { renderHeader: () => '', renderDock: () => '' },
      AttendanceCalc: {
        getStatus: () => ({ status: 'safe', label: 'Safe', color: '#4D7E5C', bgColor: '#E8F3EB', strokeColor: '#4D7E5C' })
      },
      Helpers: {
        escapeHtml: (v) => String(v ?? ''),
        loadingSpinner: () => '',
        formatDateShort: (d) => d,
        formatTime: (t) => t || '23:59',
        showToast: (msg, type = 'success') => toasts.push({ msg, type })
      },
      API: {
        post: (url, body) => {
          requests.push({ method: 'POST', url, body });
          return new Promise((resolve) => { resolvePending = resolve; });
        },
        put: (url, body) => {
          requests.push({ method: 'PUT', url, body });
          return Promise.resolve({ id: 'dl-1', ...body });
        }
      }
    };
    vm.runInNewContext(`${dlSource}\nthis.DeadlinesComponent = DeadlinesComponent;`, sandbox);
    const { DeadlinesComponent } = sandbox;
    DeadlinesComponent.loadData = async () => {};

    // 7. Grade percentage and Platform UI removed from modal and cards
    const renderedModal = DeadlinesComponent.render();
    assert.strictEqual(renderedModal.includes('dl-weight'), false);
    assert.strictEqual(renderedModal.includes('Grade %'), false);
    assert.strictEqual(renderedModal.includes('dl-platform'), false);
    assert.strictEqual(renderedModal.includes('Moodle Portal'), false);
    assert.strictEqual(renderedModal.includes('Platform'), false);
    const cardHtml = DeadlinesComponent.renderCard({
      id: 'dl-card-1',
      title: 'Seminar Talk',
      category: 'custom',
      description: 'Viva',
      due_date: '2026-12-01',
      due_time: '10:00',
      grade_weight: 25,
      platform: 'In-Person / Hall'
    }, false);
    assert(cardHtml.includes('Viva'));
    assert.strictEqual(cardHtml.includes('25% Weight'), false);
    assert.strictEqual(cardHtml.includes('In-Person / Hall'), false);
    assert.strictEqual(cardHtml.includes('Local Task'), false);

    // 2. Duplicate rendering prevention
    DeadlinesComponent.deadlines = [
      { id: 'dl-dup', title: 'Lab 1', category: 'assignment', due_date: '2026-12-01', is_completed: 0 },
      { id: 'dl-dup', title: 'Lab 1', category: 'assignment', due_date: '2026-12-01', is_completed: 0 }
    ];
    DeadlinesComponent.renderList();
    assert.strictEqual((elements['deadlines-content'].innerHTML.match(/Lab 1/g) || []).length, 1);

    // 3 & 4. Custom button toggles input and rejects empty custom task name
    DeadlinesComponent.attachEvents();
    catButtons[1].click();
    assert.strictEqual(elements['dl-custom-name-wrap'].classList.contains('hidden'), false);
    elements['dl-title'].value = 'Oral Defense';
    elements['dl-custom-name'].value = '   ';
    await elements['dl-create-form'].listeners.submit({ preventDefault: () => {}, target: elements['dl-create-form'] });
    assert.strictEqual(requests.length, 0);
    assert(toasts.some((t) => t.type === 'error' && t.msg.includes('custom task name')));

    // 1 & 3. Valid custom task submit + rapid duplicate submit lock
    elements['dl-custom-name'].value = 'Viva';
    const submitEvt = { preventDefault: () => {}, target: elements['dl-create-form'] };
    const firstSubmit = elements['dl-create-form'].listeners.submit(submitEvt);
    await elements['dl-create-form'].listeners.submit(submitEvt);
    assert.strictEqual(requests.length, 1);
    assert.strictEqual(requests[0].body.category, 'custom');
    assert.strictEqual(requests[0].body.description, 'Viva');
    assert.strictEqual('grade_weight' in requests[0].body, false);
    assert.strictEqual('platform' in requests[0].body, false);
    assert.strictEqual(elements['dl-submit-btn'].disabled, true);
    resolvePending({ id: 'dl-1' });
    await firstSubmit;
    assert.strictEqual(DeadlinesComponent.isSubmitting, false);
    assert.strictEqual(elements['dl-submit-btn'].disabled, false);

    // 5. Editing an existing custom task pre-fills custom name and calls PUT
    DeadlinesComponent.openModal({
      id: 'dl-1',
      title: 'Oral Defense',
      subject_id: '',
      category: 'custom',
      description: 'Viva',
      due_date: '2026-12-01',
      due_time: '14:00'
    });
    assert.strictEqual(elements['dl-custom-name-wrap'].classList.contains('hidden'), false);
    assert.strictEqual(elements['dl-custom-name'].value, 'Viva');
    elements['dl-custom-name'].value = 'Thesis Viva';
    await elements['dl-create-form'].listeners.submit(submitEvt);
    assert.strictEqual(requests[1].method, 'PUT');
    assert.strictEqual(requests[1].url, '/deadlines/dl-1');
    assert.strictEqual(requests[1].body.description, 'Thesis Viva');
    assert.strictEqual('platform' in requests[1].body, false);

    // 5b. Editing a predefined task omits description so existing DB description is preserved
    DeadlinesComponent.openModal({
      id: 'dl-pre-1',
      title: 'Midterm Study',
      subject_id: '',
      category: 'assignment',
      description: 'Chapters 1-4',
      due_date: '2026-12-03',
      due_time: '18:00'
    });
    elements['dl-title'].value = 'Midterm Study Revised';
    await elements['dl-create-form'].listeners.submit(submitEvt);
    assert.strictEqual(requests[2].method, 'PUT');
    assert.strictEqual(requests[2].url, '/deadlines/dl-pre-1');
    assert.strictEqual('description' in requests[2].body, false);

    // 5c. Switching a Custom task to a predefined category sends description: null to clear old custom name
    DeadlinesComponent.openModal({
      id: 'dl-custom-to-pre',
      title: 'Seminar',
      subject_id: '',
      category: 'custom',
      description: 'Viva',
      due_date: '2026-12-04',
      due_time: '12:00'
    });
    catButtons[0].click(); // switch from custom -> assignment
    await elements['dl-create-form'].listeners.submit(submitEvt);
    assert.strictEqual(requests[3].method, 'PUT');
    assert.strictEqual(requests[3].url, '/deadlines/dl-custom-to-pre');
    assert.strictEqual(requests[3].body.category, 'assignment');
    assert.strictEqual(requests[3].body.description, null);
  });

  test('OnboardingComponent displays v1.0.0, password-recovery notices, and SVG arrows without raw icon text', () => {
    const onboardingSource = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'components', 'onboarding.js'), 'utf8');
    const navSource = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'components', 'navigation.js'), 'utf8');
    const sandbox = {
      document: { getElementById: () => null },
      App: { currentUser: { full_name: 'Maya' } },
      Helpers: { escapeHtml: (v) => String(v ?? '') },
      AuthService: {},
      API: {}
    };
    vm.runInNewContext(`${onboardingSource}\n${navSource}\nthis.OnboardingComponent = OnboardingComponent;\nthis.NavigationComponent = NavigationComponent;`, sandbox);
    const { OnboardingComponent, NavigationComponent } = sandbox;

    // Welcome screen: v1.0.0, SVG forward arrow, no raw arrow_forward
    OnboardingComponent.view = 'welcome';
    const welcomeHtml = OnboardingComponent.render();
    assert(welcomeHtml.includes('v1.0.0'));
    assert.strictEqual(welcomeHtml.includes('v2.4 Core'), false);
    assert(welcomeHtml.includes('<svg aria-hidden="true"'));
    assert.strictEqual(welcomeHtml.includes('arrow_forward'), false);

    // Login screen: static forgot-password notice, no clickable Forgot button, SVG back arrow
    OnboardingComponent.view = 'login';
    const loginHtml = OnboardingComponent.render();
    assert(loginHtml.includes('Forgot password? Password recovery is not available in this version. Please keep your password safe.'));
    assert.strictEqual(loginHtml.includes('btn-forgot-pw'), false);
    assert.strictEqual(loginHtml.includes('arrow_back'), false);

    // Sign-up Page 2: password reminder notice, SVG arrows, no raw icon text
    OnboardingComponent.view = 'register';
    const registerHtml = OnboardingComponent.render();
    assert(registerHtml.includes('Important: Password recovery is not available in this version. Please keep your password safe.'));
    assert.strictEqual(registerHtml.includes('arrow_back'), false);
    assert.strictEqual(registerHtml.includes('arrow_forward'), false);

    // Navigation header back arrow uses SVG, not raw arrow_back text
    const headerHtml = NavigationComponent.renderHeader('Subject Detail', true, true, true);
    assert(headerHtml.includes('<svg aria-hidden="true"'));
    assert.strictEqual(headerHtml.includes('arrow_back'), false);
  });

  await asyncTest('Router handles normal, Back/Forward, rapid, repeated, and parameterized navigation safely', async () => {
    const routerSource = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'router.js'), 'utf8');
    const listeners = {};
    const historyStack = ['#dashboard'];
    let historyIdx = 0;

    const dispatchHashChange = (oldUrl, newUrl) => {
      const event = { oldURL: oldUrl, newURL: newUrl };
      (listeners.hashchange || []).forEach((fn) => fn(event));
    };

    const locationObj = {
      _hash: '#dashboard',
      get hash() { return this._hash; },
      set hash(val) {
        const next = val.startsWith('#') ? val : `#${val}`;
        if (next === this._hash) return;
        const oldUrl = `https://app.local/${this._hash}`;
        const newUrl = `https://app.local/${next}`;
        this._hash = next;
        historyStack.splice(historyIdx + 1);
        historyStack.push(next);
        historyIdx = historyStack.length - 1;
        queueMicrotask(() => dispatchHashChange(oldUrl, newUrl));
      }
    };

    const simulateHistoryStep = (delta) => {
      const targetIdx = historyIdx + delta;
      const oldUrl = `https://app.local/${locationObj._hash}`;
      historyIdx = targetIdx;
      locationObj._hash = historyStack[targetIdx];
      const newUrl = `https://app.local/${locationObj._hash}`;
      dispatchHashChange(oldUrl, newUrl);
    };

    const handled = [];
    const sandbox = {
      window: {
        location: locationObj,
        addEventListener: (evt, fn) => {
          listeners[evt] = listeners[evt] || [];
          listeners[evt].push(fn);
        }
      },
      document: { getElementById: () => ({ innerHTML: '' }) },
      AuthService: { isAuthenticated: () => true },
      DashboardComponent: { render: () => '<div>dash</div>', init: () => {} },
      SubjectDetailComponent: { render: (id) => `<div>subj:${id}</div>`, init: () => {} },
      DeadlinesComponent: { render: () => '<div>dl</div>', init: () => {} },
      SettingsComponent: { render: () => '<div>settings</div>', init: () => {} },
      requestAnimationFrame: (fn) => fn()
    };
    vm.runInNewContext(`${routerSource}\nthis.Router = Router;`, sandbox);
    const { Router } = sandbox;

    const origHandle = Router.handleRoute.bind(Router);
    Router.handleRoute = (params = {}) => {
      handled.push({ hash: locationObj.hash, params });
      return origHandle(params);
    };

    Router.init();
    Router.init();
    assert.strictEqual((listeners.hashchange || []).length, 1);
    assert.strictEqual((listeners.popstate || []).length, 0);

    // 1. Normal navigation
    Router.navigate('deadlines');
    await new Promise((r) => setTimeout(r, 0));
    assert.strictEqual(handled.length, 1);
    assert.strictEqual(handled[0].hash, '#deadlines');

    // 2. Two consecutive calls to the same destination do not duplicate-render
    Router.navigate('deadlines');
    await new Promise((r) => setTimeout(r, 0));
    assert.strictEqual(handled.length, 1);

    // 3. Browser Back and Forward
    simulateHistoryStep(-1);
    assert.strictEqual(handled.length, 2);
    assert.strictEqual(handled[1].hash, '#dashboard');
    simulateHistoryStep(1);
    assert.strictEqual(handled.length, 3);
    assert.strictEqual(handled[2].hash, '#deadlines');

    // 4 & 5. Two rapid navigate() calls to different destinations deliver params only to the final destination
    handled.length = 0;
    Router.navigate('subject/sub-1', { from: 'stale' });
    Router.navigate('settings', { section: 'profile' });
    await new Promise((r) => setTimeout(r, 0));
    assert.strictEqual(handled.length, 1);
    assert.strictEqual(handled[0].hash, '#settings');
    assert.strictEqual(JSON.stringify(handled[0].params), JSON.stringify({ section: 'profile' }));

    // 6. Browser history change occurring while navigation is pending does not steal pending params
    handled.length = 0;
    Router._pendingNavigation = { hash: 'settings', params: { section: 'security' } };
    simulateHistoryStep(-1); // history moves from #settings -> #subject/sub-1 while settings nav is pending
    assert.strictEqual(handled.length, 1);
    assert.strictEqual(handled[0].hash, '#subject/sub-1');
    assert.strictEqual(JSON.stringify(handled[0].params), '{}');
    assert.strictEqual(JSON.stringify(Router._pendingNavigation), JSON.stringify({ hash: 'settings', params: { section: 'security' } }));
  });

  await asyncTest('Logout from #settings clears hash/router state and re-login navigates to dashboard', async () => {
    const routerSource = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'router.js'), 'utf8');
    const authSource = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'services', 'auth.js'), 'utf8');
    const appSource = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'app.js'), 'utf8');

    const listeners = {};
    const appEl = { innerHTML: '' };
    const locationObj = {
      pathname: '/',
      search: '',
      _hash: '#settings',
      get hash() { return this._hash; },
      set hash(val) {
        const next = val ? (val.startsWith('#') ? val : `#${val}`) : '';
        if (next === this._hash) return;
        const oldUrl = `https://localhost/${this._hash}`;
        const newUrl = `https://localhost/${next}`;
        this._hash = next;
        queueMicrotask(() => (listeners.hashchange || []).forEach((fn) => fn({ oldURL: oldUrl, newURL: newUrl })));
      }
    };

    let storedToken = 'initial-jwt';
    const sandbox = {
      window: {
        location: locationObj,
        addEventListener: (evt, fn) => {
          listeners[evt] = listeners[evt] || [];
          listeners[evt].push(fn);
        }
      },
      history: {
        replaceState: (_state, _title, url) => {
          const idx = String(url).indexOf('#');
          locationObj._hash = idx === -1 ? '' : String(url).slice(idx);
        }
      },
      document: {
        getElementById: (id) => (id === 'app' ? appEl : null),
        addEventListener: () => {}
      },
      TokenStorage: {
        getSync: () => storedToken,
        set: async (t) => { storedToken = t; },
        remove: async () => { storedToken = null; }
      },
      localStorage: {
        getItem: () => 'light',
        setItem: () => {},
        removeItem: () => {}
      },
      API: {
        post: async (url) => (url === '/auth/login' ? { token: 'fresh-jwt', user: { id: 'u1', full_name: 'Maya' } } : {})
      },
      OnboardingComponent: {
        view: 'welcome',
        render: () => '<div id="onboarding-login">Login View</div>',
        attachEvents: () => {}
      },
      DashboardComponent: {
        render: () => '<div id="dashboard-root">Dashboard Loaded</div>',
        init: () => {}
      },
      SettingsComponent: {
        render: () => '<div id="settings-root">Settings Loaded</div>',
        init: () => {}
      },
      requestAnimationFrame: (fn) => fn()
    };

    vm.runInNewContext(`${routerSource}\n${authSource}\n${appSource}\nthis.Router = Router;\nthis.AuthService = AuthService;\nthis.App = App;\nthis.OnboardingComponent = OnboardingComponent;`, sandbox);
    const { Router, AuthService, App, OnboardingComponent } = sandbox;

    // 1. User is authenticated and viewing #settings
    App.showApp();
    await new Promise((r) => setTimeout(r, 0));
    assert(appEl.innerHTML.includes('Settings Loaded'));
    assert.strictEqual(Router._activeHash, 'settings');

    // 2. User logs out from #settings
    await AuthService.logout();
    assert.strictEqual(storedToken, null);
    assert.strictEqual(locationObj.hash, '');
    assert.strictEqual(Router._activeHash, null);
    assert.strictEqual(OnboardingComponent.view, 'login');
    assert(appEl.innerHTML.includes('Login View'));

    // 3. User signs back in and App.showApp() runs
    await AuthService.login('maya@example.com', 'secret123');
    App.showApp();
    await new Promise((r) => setTimeout(r, 0));
    assert.strictEqual(locationObj.hash, '#dashboard');
    assert.strictEqual(Router._activeHash, 'dashboard');
    assert(appEl.innerHTML.includes('Dashboard Loaded'));
  });

  await asyncTest('SubjectDetailComponent edits credits/frequency_per_week and guards failed or repeated deletion', async () => {
    const detailSource = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'components', 'subject-detail.js'), 'utf8');
    const makeClassList = () => ({ add: () => {}, remove: () => {} });
    const elements = {
      'edit-subject-modal': { classList: makeClassList() },
      'es-name': { value: '' },
      'es-code': { value: '' },
      'es-req': { value: '' },
      'es-credits': { value: '' },
      'es-freq': { value: '' },
      'es-faculty': { value: '' },
      'es-room': { value: '' },
      'es-save-btn': { disabled: false },
      'es-delete-btn': {
        disabled: false,
        listeners: {},
        addEventListener(evt, fn) { this.listeners[evt] = fn; }
      },
      'edit-subj-form': {
        listeners: {},
        addEventListener(evt, fn) { this.listeners[evt] = fn; }
      }
    };
    const putCalls = [];
    const deleteCalls = [];
    const navigatedTo = [];
    const toasts = [];
    let rejectDelete;

    const sandbox = {
      document: {
        getElementById: (id) => elements[id] || null,
        querySelectorAll: () => []
      },
      NavigationComponent: { renderHeader: () => '', renderDock: () => '' },
      AttendanceCalc: {
        getStatus: () => ({ status: 'safe', label: 'Safe', color: '#4D7E5C', bgColor: '#E8F3EB', strokeColor: '#4D7E5C' })
      },
      Helpers: {
        escapeHtml: (v) => String(v ?? ''),
        loadingSpinner: () => '',
        confirm: async () => true,
        showToast: (msg, type = 'success') => toasts.push({ msg, type })
      },
      Router: { navigate: (dest) => navigatedTo.push(dest) },
      API: {
        put: async (url, body) => {
          putCalls.push({ url, body });
          return body;
        },
        delete: (url) => {
          deleteCalls.push(url);
          return new Promise((_, reject) => { rejectDelete = reject; });
        }
      }
    };
    vm.runInNewContext(`${detailSource}\nthis.SubjectDetailComponent = SubjectDetailComponent;`, sandbox);
    const { SubjectDetailComponent } = sandbox;
    SubjectDetailComponent.subjectId = 'sub-ml-3';
    SubjectDetailComponent.subject = {
      id: 'sub-ml-3',
      name: 'Machine Learning Level 3',
      code: 'ML303',
      required_attendance: 80,
      credits: 4.5,
      frequency_per_week: 5,
      faculty_name: 'Dr. Rao',
      room: 'AI-2'
    };
    SubjectDetailComponent.loadData = async () => {};

    const modalHtml = SubjectDetailComponent.render('sub-ml-3');
    assert(modalHtml.includes('id="es-credits"'));
    assert(modalHtml.includes('id="es-freq"'));

    SubjectDetailComponent.openEditSubjectModal();
    assert.strictEqual(elements['es-credits'].value, 4.5);
    assert.strictEqual(elements['es-freq'].value, 5);

    elements['es-credits'].value = '5';
    elements['es-freq'].value = '6';
    SubjectDetailComponent.attachModalEvents();
    await elements['edit-subj-form'].listeners.submit({ preventDefault: () => {} });
    assert.strictEqual(putCalls.length, 1);
    assert.strictEqual(putCalls[0].url, '/subjects/sub-ml-3');
    assert.strictEqual(putCalls[0].body.credits, 5);
    assert.strictEqual(putCalls[0].body.frequency_per_week, 6);

    // Rapid repeated delete clicks only send one DELETE, and failed delete does not navigate away
    const firstDelete = elements['es-delete-btn'].listeners.click();
    await new Promise((r) => setTimeout(r, 0));
    await elements['es-delete-btn'].listeners.click();
    assert.strictEqual(deleteCalls.length, 1);
    assert.strictEqual(elements['es-delete-btn'].disabled, true);
    assert.strictEqual(SubjectDetailComponent.isDeletingSubject, true);

    rejectDelete(new Error('Delete failed'));
    await firstDelete;
    assert.strictEqual(navigatedTo.length, 0);
    assert.strictEqual(SubjectDetailComponent.isDeletingSubject, false);
    assert.strictEqual(elements['es-delete-btn'].disabled, false);
    assert(toasts.some((t) => t.type === 'error' && t.msg.includes('Delete failed')));

    // Zero-credit display and edit support
    SubjectDetailComponent.subject = {
      id: 'sub-zero',
      name: 'Audit Seminar',
      code: 'AS001',
      required_attendance: 75,
      credits: 0,
      frequency_per_week: 2,
      attended: 0,
      absent: 0,
      excused: 0,
      total: 0,
      percentage: 0,
      status: 'safe',
      status_label: 'Safe',
      status_color: '#4D7E5C',
      status_bg_color: '#E8F3EB',
      classes_can_miss: 0,
      classes_needed: 0
    };
    SubjectDetailComponent.records = [];
    SubjectDetailComponent.subjectId = 'sub-zero';
    let detailBodyHtml = '';
    sandbox.document.getElementById = (id) => (id === 'subject-detail-body' ? { set innerHTML(v) { detailBodyHtml = v; }, querySelectorAll: () => [] } : (elements[id] || null));
    SubjectDetailComponent.renderBody();
    assert(detailBodyHtml.includes('>0<'));
    assert.strictEqual(detailBodyHtml.includes('>3<'), false);

    SubjectDetailComponent.openEditSubjectModal();
    assert.strictEqual(elements['es-credits'].value, 0);
    elements['es-credits'].value = '0';
    await elements['edit-subj-form'].listeners.submit({ preventDefault: () => {} });
    assert.strictEqual(putCalls[1].body.credits, 0);
  });

  await asyncTest('TimetableComponent separates Edit/Delete actions, validates time range, and preserves entries on failure', async () => {
    const ttSource = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'components', 'timetable.js'), 'utf8');
    const helpersSource = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'utils', 'helpers.js'), 'utf8');
    const helpersSandbox = { document: { createElement: () => ({}), getElementById: () => null, body: { appendChild: () => {} } }, window: {} };
    vm.runInNewContext(`${helpersSource}\nthis.Helpers = Helpers;`, helpersSandbox);
    const realFormatTime = helpersSandbox.Helpers.formatTime.bind(helpersSandbox.Helpers);
    assert.strictEqual(realFormatTime('00:00'), '12:00 AM');
    assert.strictEqual(realFormatTime('12:00'), '12:00 PM');
    assert.strictEqual(realFormatTime('15:05'), '3:05 PM');
    const makeClassList = (initial = []) => {
      const s = new Set(initial);
      return {
        add: (...c) => c.forEach((x) => s.add(x)),
        remove: (...c) => c.forEach((x) => s.delete(x)),
        toggle: (c, f) => (f === undefined ? (s.has(c) ? s.delete(c) : s.add(c)) : (f ? s.add(c) : s.delete(c))),
        contains: (c) => s.has(c)
      };
    };
    const editButtons = [];
    const delButtons = [];
    const container = {
      _html: '',
      get innerHTML() { return this._html; },
      set innerHTML(val) {
        this._html = val;
        editButtons.length = 0;
        delButtons.length = 0;
        const editMatches = val.match(/data-edit-slot="([^"]+)"/g) || [];
        const delMatches = val.match(/data-del-slot="([^"]+)"/g) || [];
        editMatches.forEach((m) => {
          const id = m.match(/"([^"]+)"/)[1];
          const listeners = {};
          editButtons.push({ dataset: { editSlot: id }, disabled: false, addEventListener(e, fn) { listeners[e] = fn; }, click() { return listeners.click?.({ stopPropagation: () => {} }); } });
        });
        delMatches.forEach((m) => {
          const id = m.match(/"([^"]+)"/)[1];
          const listeners = {};
          delButtons.push({ dataset: { delSlot: id }, disabled: false, addEventListener(e, fn) { listeners[e] = fn; }, click() { return listeners.click?.({ stopPropagation: () => {} }); } });
        });
      },
      querySelectorAll: (sel) => (sel === '[data-edit-slot]' ? editButtons : sel === '[data-del-slot]' ? delButtons : [])
    };
    const elements = {
      'timetable-matrix-container': container,
      'add-slot-modal': { classList: makeClassList(['hidden']) },
      'slot-modal-title': { textContent: '' },
      'slot-submit-btn': { textContent: '', disabled: false },
      'slot-subject': { value: 'sub-1', disabled: false, required: true, classList: makeClassList() },
      'slot-subject-label': { textContent: '' },
      'slot-day': { value: '1' },
      'slot-type': { value: 'lecture', addEventListener: () => {} },
      'slot-start': { value: '09:00' },
      'slot-end': { value: '10:30' },
      'slot-room': { value: '', placeholder: '' },
      'add-slot-form': {
        listeners: {},
        reset() {},
        addEventListener(e, fn) { this.listeners[e] = fn; }
      }
    };
    const requests = [];
    const toasts = [];
    let shouldFailDelete = true;

    const sandbox = {
      document: {
        getElementById: (id) => elements[id] || null,
        querySelector: () => ({ hidden: false })
      },
      NavigationComponent: { renderHeader: () => '', renderDock: () => '' },
      AttendanceCalc: {
        getStatus: () => ({ status: 'safe', label: 'Safe', color: '#4D7E5C', bgColor: '#E8F3EB', strokeColor: '#4D7E5C' })
      },
      Helpers: {
        escapeHtml: (v) => String(v ?? ''),
        loadingSpinner: () => '',
        dayNameShort: (d) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d],
        formatTime: realFormatTime,
        confirm: async () => true,
        showToast: (msg, type = 'success') => toasts.push({ msg, type })
      },
      API: {
        put: async (url, body) => {
          requests.push({ method: 'PUT', url, body });
          return body;
        },
        delete: async (url) => {
          requests.push({ method: 'DELETE', url });
          if (shouldFailDelete) throw new Error('Delete failed');
          return { message: 'Deleted' };
        }
      }
    };
    vm.runInNewContext(`${ttSource}\nthis.TimetableComponent = TimetableComponent;`, sandbox);
    const { TimetableComponent } = sandbox;
    TimetableComponent.entries = [
      { id: 'slot-1', subject_id: 'sub-1', subject_code: 'CS101', subject_name: 'Algorithms', day_of_week: 1, start_time: '09:00', end_time: '10:30', session_type: 'lecture', room: 'LH-1' },
      { id: 'slot-break', subject_id: null, day_of_week: 1, start_time: '12:00', end_time: '12:45', session_type: 'lunch', room: 'Cafeteria' },
      { id: 'slot-sun', subject_id: 'sub-1', subject_code: 'CS101', subject_name: 'Algorithms', day_of_week: 0, start_time: '15:05', end_time: '16:00', session_type: 'lecture', room: 'Sun-Room' }
    ];
    TimetableComponent.subjects = [{ id: 'sub-1', code: 'CS101', name: 'Algorithms' }];
    TimetableComponent.loadData = async () => {};
    TimetableComponent.attachEvents();
    TimetableComponent.renderMatrix();

    assert(container.innerHTML.includes('>Sun<'));
    assert(container.innerHTML.includes('Sun-Room'));
    assert(container.innerHTML.includes('9:00 AM – 10:30 AM'));
    assert(container.innerHTML.includes('12:00 PM – 12:45 PM • Cafeteria'));
    assert(container.innerHTML.includes('3:05 PM – 4:00 PM'));
    assert.strictEqual(editButtons.length, 3);
    assert.strictEqual(delButtons.length, 3);

    // Clicking Edit on Sunday opens modal populated with 24h HH:mm input values and never triggers Delete
    editButtons[2].click();
    assert.strictEqual(requests.length, 0);
    assert.strictEqual(TimetableComponent.editingSlotId, 'slot-sun');
    assert.strictEqual(elements['slot-day'].value, '0');
    assert.strictEqual(elements['slot-start'].value, '15:05');
    assert.strictEqual(elements['slot-end'].value, '16:00');
    assert.strictEqual(elements['slot-room'].value, 'Sun-Room');

    // Clicking Edit on Monday opens modal populated with Monday entry and never triggers Delete
    editButtons[0].click();
    assert.strictEqual(requests.length, 0);
    assert.strictEqual(TimetableComponent.editingSlotId, 'slot-1');
    assert.strictEqual(elements['slot-room'].value, 'LH-1');

    // Invalid time range (end <= start) is rejected before PUT
    elements['slot-start'].value = '11:00';
    elements['slot-end'].value = '10:00';
    await elements['add-slot-form'].listeners.submit({ preventDefault: () => {} });
    assert.strictEqual(requests.length, 0);
    assert(toasts.some((t) => t.type === 'error' && t.msg.includes('End time')));

    // Valid edit calls PUT /timetable/slot-1
    elements['slot-start'].value = '10:00';
    elements['slot-end'].value = '11:30';
    elements['slot-room'].value = 'LH-2';
    await elements['add-slot-form'].listeners.submit({ preventDefault: () => {} });
    assert.strictEqual(requests.length, 1);
    assert.strictEqual(requests[0].method, 'PUT');
    assert.strictEqual(requests[0].url, '/timetable/slot-1');
    assert.strictEqual(requests[0].body.start_time, '10:00');
    assert.strictEqual(requests[0].body.end_time, '11:30');
    assert.strictEqual(requests[0].body.room, 'LH-2');

    // Failed deletion does not remove entry from TimetableComponent.entries
    await delButtons[2].click();
    assert.strictEqual(requests.length, 2);
    assert.strictEqual(requests[1].method, 'DELETE');
    assert.strictEqual(requests[1].url, '/timetable/slot-sun');
    assert.strictEqual(TimetableComponent.entries.length, 3);
    assert.strictEqual(delButtons[2].disabled, false);
  });

  await asyncTest('Migration script dry-run, verification, and conflict detection work with mocks', async () => {
    assert.strictEqual(valuesMatch('2026-11-25 10:00:00', new Date('2026-11-25T10:00:00.000Z'), 'created_at', []), true);
    assert.strictEqual(valuesMatch(1, true, 'is_active', ['is_active']), true);
    assert.strictEqual(valuesMatch('09:00', '09:00:00', 'start_time', []), true);

    const fixtureDbPath = path.join(__dirname, 'temp-migrate-fixture.db');
    if (fs.existsSync(fixtureDbPath)) fs.unlinkSync(fixtureDbPath);
    const schemaSql = fs.readFileSync(path.join(__dirname, '..', 'database', 'schema.sql'), 'utf8');
    const setupDb = new DatabaseSync(fixtureDbPath);
    setupDb.exec(schemaSql);
    setupDb.prepare(`
      INSERT INTO users (id, email, password_hash, full_name, semester)
      VALUES (?, ?, ?, ?, ?)
    `).run('11111111-1111-1111-1111-111111111111', 'fixture@example.com', 'hash123', 'Fixture User', 3);
    setupDb.close();

    const roDb = new DatabaseSync(fixtureDbPath, { readOnly: true });
    try {
      const executed = [];
      const emptyPgClient = {
        async query(sql) {
          executed.push(sql);
          return { rows: [] };
        }
      };
      const dryRes = await runMigration(roDb, emptyPgClient, { dryRun: true });
      assert.strictEqual(dryRes.insertedTotal, 1);
      assert(executed.includes('BEGIN'));
      assert(executed.includes('ROLLBACK'));
      assert(!executed.some((q) => q.startsWith('INSERT ')));

      // Matching PG data passes verifyData
      const matchingPgClient = {
        async query(sql) {
          if (sql.includes('FROM public.users')) {
            return {
              rows: [{
                id: '11111111-1111-1111-1111-111111111111',
                email: 'fixture@example.com',
                password_hash: 'hash123',
                full_name: 'Fixture User',
                student_id: null,
                department: null,
                semester: 3,
                profile_image: null,
                created_at: new Date(),
                updated_at: new Date()
              }]
            };
          }
          return { rows: [] };
        }
      };
      // Check findRowMismatches detects password_hash conflict
      const usersTable = TABLES.find((t) => t.name === 'users');
      const diffs = findRowMismatches(
        roDb.prepare('SELECT * FROM users').get(),
        { ...(await matchingPgClient.query('FROM public.users')).rows[0], password_hash: 'different-hash' },
        usersTable
      );
      assert(diffs.some((d) => d.field === 'password_hash'));

      // Conflict aborts runMigration
      const conflictPgClient = {
        async query(sql) {
          if (sql.includes('FROM public.users')) {
            return {
              rows: [{
                id: '11111111-1111-1111-1111-111111111111',
                email: 'other-email@example.com',
                password_hash: 'hash123',
                full_name: 'Fixture User',
                student_id: null,
                department: null,
                semester: 3,
                profile_image: null,
                created_at: new Date(),
                updated_at: new Date()
              }]
            };
          }
          return { rows: [] };
        }
      };
      await assert.rejects(() => runMigration(roDb, conflictPgClient, { dryRun: true }), /conflicting existing IDs/);
      await assert.rejects(() => verifyData(roDb, emptyPgClient), /Verification failed/);
    } finally {
      roDb.close();
      if (fs.existsSync(fixtureDbPath)) fs.unlinkSync(fixtureDbPath);
    }
  });

  console.log('\n--- Integration Tests: API, Auth, Isolation & CRUD ---');

  const server = app.listen(0);
  const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const emailA = `maya-${runId}@example.com`;
  const emailB = `other-${runId}@example.com`;
  const createdUserIds = [];

  let tokenA = '';
  let tokenB = '';
  let subjectId = '';
  let attendanceId = '';
  let deadlineId = '';
  let slotId = '';
  let lunchSlotId = '';
  let holidayId = '';
  let notifId = '';

  try {
    await asyncTest('Database connection initializes and db.transaction rolls back on error', async () => {
      const db = getDatabase();
      assert.strictEqual(db.client, isPostgres() ? 'postgres' : 'sqlite');
      if (isPostgres()) {
        const row = await db.get('SELECT current_database() AS db_name');
        assert.strictEqual(row.db_name, 'postgres');
      }

      const txUserId = '99999999-9999-4999-8999-999999999999';
      const txEmail = `rollback-${runId}@example.com`;
      await assert.rejects(
        () => db.transaction(async (tx) => {
          await tx.run(
            'INSERT INTO users (id, email, password_hash, full_name) VALUES (?, ?, ?, ?)',
            txUserId, txEmail, 'hash', 'Rollback Test'
          );
          throw new Error('Intentional rollback test');
        }),
        /Intentional rollback test/
      );

      const persisted = await db.get('SELECT id FROM users WHERE id = ?', txUserId);
      assert.strictEqual(persisted, undefined);
    });

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
        email: emailA,
        password: 'Password123!',
        full_name: 'Maya Lin',
        student_id: 'CS-2025-01',
        semester: 4
      });
      assert.strictEqual(res.status, 201);
      assert(res.body.token);
      assert.strictEqual(res.body.user.email, emailA);
      assert.strictEqual(res.body.user.password_hash, undefined);
      tokenA = res.body.token;
      createdUserIds.push(res.body.user.id);
    });

    await asyncTest('Login rejects invalid credentials with 401', async () => {
      const res = await request(server, 'POST', '/api/auth/login', {
        email: emailA,
        password: 'wrongpassword'
      });
      assert.strictEqual(res.status, 401);
    });

    await asyncTest('Login succeeds with valid credentials', async () => {
      const res = await request(server, 'POST', '/api/auth/login', {
        email: emailA,
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

      // Legitimate second lecture on the same day with a different start_time succeeds
      const secondLecture = await request(server, 'POST', '/api/attendance', {
        subject_id: subjectId,
        date: '2026-11-24',
        start_time: '11:00:00',
        status: 'present'
      }, tokenA);
      assert.strictEqual(secondLecture.status, 201);
      assert.strictEqual(secondLecture.body.subject.total, 2);

      const db = getDatabase();
      const firstAuditRows = await db.all(
        'SELECT action FROM attendance_audit_log WHERE record_id = ?',
        attendanceId
      );
      assert.strictEqual(firstAuditRows.length, 1);

      const secondAuditRows = await db.all(
        'SELECT action FROM attendance_audit_log WHERE record_id = ?',
        secondLecture.body.record.id
      );
      assert.strictEqual(secondAuditRows.length, 1);

      // Clean up the second lecture so downstream dashboard assertions see 1 record
      const cleanup = await request(server, 'DELETE', `/api/attendance/${secondLecture.body.record.id}`, null, tokenA);
      assert.strictEqual(cleanup.status, 200);
    });

    await asyncTest('Edit attendance updates subject percentage dynamically and logs exact audit trail', async () => {
      const editRes = await request(server, 'PUT', `/api/attendance/${attendanceId}`, {
        status: 'absent',
        start_time: ''
      }, tokenA);
      assert.strictEqual(editRes.status, 200);
      assert.strictEqual(editRes.body.subject.percentage, 0);
      assert.strictEqual(editRes.body.subject.absent, 1);

      const db = getDatabase();
      const auditRows = await db.all(
        'SELECT action, old_status, new_status FROM attendance_audit_log WHERE record_id = ?',
        attendanceId
      );
      assert.strictEqual(auditRows.length, 2);
      const insertRow = auditRows.find((r) => r.action === 'INSERT');
      const updateRow = auditRows.find((r) => r.action === 'UPDATE');
      assert(insertRow, 'Expected INSERT audit row');
      assert(updateRow, 'Expected UPDATE audit row');
      assert.strictEqual(insertRow.new_status, 'present');
      assert.strictEqual(updateRow.old_status, 'present');
      assert.strictEqual(updateRow.new_status, 'absent');
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

      // Duplicate task submission returns 409
      const dupTaskRes = await request(server, 'POST', '/api/deadlines', {
        title: 'midterm exam',
        subject_id: subjectId,
        category: 'exam_quiz',
        due_date: '2026-12-01'
      }, tokenA);
      assert.strictEqual(dupTaskRes.status, 409);

      // Empty custom task name is rejected with 400
      const emptyCustomRes = await request(server, 'POST', '/api/deadlines', {
        title: 'Oral Review',
        category: 'custom',
        description: '   ',
        due_date: '2026-12-02'
      }, tokenA);
      assert.strictEqual(emptyCustomRes.status, 400);

      // Valid custom task creation and editing preserves task fields
      const customRes = await request(server, 'POST', '/api/deadlines', {
        title: 'Oral Review',
        subject_id: subjectId,
        category: 'custom',
        description: 'Viva',
        due_date: '2026-12-02',
        due_time: '15:00'
      }, tokenA);
      assert.strictEqual(customRes.status, 201);
      assert.strictEqual(customRes.body.category, 'custom');
      assert.strictEqual(customRes.body.description, 'Viva');

      const editCustomRes = await request(server, 'PUT', `/api/deadlines/${customRes.body.id}`, {
        title: 'Oral Review Updated',
        category: 'custom',
        description: 'Final Viva'
      }, tokenA);
      assert.strictEqual(editCustomRes.status, 200);
      assert.strictEqual(editCustomRes.body.description, 'Final Viva');
      assert.strictEqual(editCustomRes.body.due_date, '2026-12-02');
      assert.strictEqual(editCustomRes.body.subject_id, subjectId);

      // Switching custom task to predefined category clears old custom name
      const clearCustomRes = await request(server, 'PUT', `/api/deadlines/${customRes.body.id}`, {
        category: 'assignment',
        description: null
      }, tokenA);
      assert.strictEqual(clearCustomRes.status, 200);
      assert.strictEqual(clearCustomRes.body.category, 'assignment');
      assert.strictEqual(clearCustomRes.body.description, null);

      const delCustomRes = await request(server, 'DELETE', `/api/deadlines/${customRes.body.id}`, null, tokenA);
      assert.strictEqual(delCustomRes.status, 200);

      // Editing predefined task without description preserves existing description
      const preWithDesc = await request(server, 'POST', '/api/deadlines', {
        title: 'Lab Notes',
        subject_id: subjectId,
        category: 'tp_lab',
        description: 'Bring safety goggles',
        due_date: '2026-12-05'
      }, tokenA);
      assert.strictEqual(preWithDesc.status, 201);
      const preEdited = await request(server, 'PUT', `/api/deadlines/${preWithDesc.body.id}`, {
        title: 'Lab Notes Updated',
        category: 'tp_lab'
      }, tokenA);
      assert.strictEqual(preEdited.status, 200);
      assert.strictEqual(preEdited.body.description, 'Bring safety goggles');
      await request(server, 'DELETE', `/api/deadlines/${preWithDesc.body.id}`, null, tokenA);

      const compRes = await request(server, 'PUT', `/api/deadlines/${deadlineId}/complete`, {}, tokenA);
      assert.strictEqual(compRes.status, 200);
      assert.strictEqual(compRes.body.is_completed, isPostgres() ? true : 1);

      const emptyPutRes = await request(server, 'PUT', `/api/deadlines/${deadlineId}`, {
        due_date: '',
        due_time: '',
        grade_weight: ''
      }, tokenA);
      assert.strictEqual(emptyPutRes.status, 200);
      assert.strictEqual(emptyPutRes.body.due_date, '2026-12-01');

      const uncompRes = await request(server, 'PUT', `/api/deadlines/${deadlineId}/uncomplete`, {}, tokenA);
      assert.strictEqual(uncompRes.status, 200);
      assert.strictEqual(uncompRes.body.is_completed, isPostgres() ? false : 0);
      assert.strictEqual(uncompRes.body.completed_at, null);
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
      lunchSlotId = lunchRes.body.id;

      const lunchUpdateRes = await request(server, 'PUT', `/api/timetable/${lunchSlotId}`, {
        room: 'Main Hall'
      }, tokenA);
      assert.strictEqual(lunchUpdateRes.status, 200);
      assert.strictEqual(lunchUpdateRes.body.subject_id, null);
      assert.strictEqual(lunchUpdateRes.body.room, 'Main Hall');

      const lunchDelRes = await request(server, 'DELETE', `/api/timetable/${lunchSlotId}`, null, tokenA);
      assert.strictEqual(lunchDelRes.status, 200);

      const breakRes = await request(server, 'POST', '/api/timetable', {
        day_of_week: 1,
        start_time: '10:30',
        end_time: '11:00',
        session_type: 'break'
      }, tokenA);
      assert.strictEqual(breakRes.status, 201);
      assert.strictEqual(breakRes.body.session_type, 'break');
      assert.strictEqual(breakRes.body.subject_id, null);

      // Invalid time range and overlapping slot rejection
      const badTimeRes = await request(server, 'POST', '/api/timetable', {
        subject_id: subjectId,
        day_of_week: 2,
        start_time: '12:00',
        end_time: '11:00'
      }, tokenA);
      assert.strictEqual(badTimeRes.status, 400);

      const overlapRes = await request(server, 'POST', '/api/timetable', {
        subject_id: subjectId,
        day_of_week: 1,
        start_time: '09:30',
        end_time: '10:15'
      }, tokenA);
      assert.strictEqual(overlapRes.status, 409);

      // Edit existing slot (excluding self from overlap check) and verify persistence
      const editSlotRes = await request(server, 'PUT', `/api/timetable/${slotId}`, {
        day_of_week: 2,
        start_time: '09:30',
        end_time: '11:00',
        room: 'Lab-204'
      }, tokenA);
      assert.strictEqual(editSlotRes.status, 200);
      assert.strictEqual(editSlotRes.body.day_of_week, 2);
      assert.strictEqual(editSlotRes.body.room, 'Lab-204');

      // Cannot edit slot to overlap with break slot on day 1
      const overlapEditRes = await request(server, 'PUT', `/api/timetable/${slotId}`, {
        day_of_week: 1,
        start_time: '10:30',
        end_time: '11:30'
      }, tokenA);
      assert.strictEqual(overlapEditRes.status, 409);

      const ttAfterEdit = await request(server, 'GET', '/api/timetable', null, tokenA);
      const editedSlot = ttAfterEdit.body.entries.find((e) => e.id === slotId);
      assert(editedSlot);
      assert.strictEqual(editedSlot.day_of_week, 2);
      assert.strictEqual(editedSlot.room, 'Lab-204');

      const setRes = await request(server, 'PUT', '/api/settings', {
        min_attendance_threshold: 80
      }, tokenA);
      assert.strictEqual(setRes.status, 200);
      assert.strictEqual(setRes.body.min_attendance_threshold, 80);
    });

    await asyncTest('User data isolation: User B cannot view or modify User A subjects', async () => {
      const regB = await request(server, 'POST', '/api/auth/register', {
        email: emailB,
        password: 'Password123!',
        full_name: 'Other Student'
      });
      assert.strictEqual(regB.status, 201);
      tokenB = regB.body.token;
      createdUserIds.push(regB.body.user.id);

      const getRes = await request(server, 'GET', `/api/subjects/${subjectId}`, null, tokenB);
      assert.strictEqual(getRes.status, 404);

      const delRes = await request(server, 'DELETE', `/api/subjects/${subjectId}`, null, tokenB);
      assert.strictEqual(delRes.status, 404);

      const ttPutB = await request(server, 'PUT', `/api/timetable/${slotId}`, { room: 'Hacked' }, tokenB);
      assert.strictEqual(ttPutB.status, 404);

      const ttDelB = await request(server, 'DELETE', `/api/timetable/${slotId}`, null, tokenB);
      assert.strictEqual(ttDelB.status, 404);
    });

    await asyncTest('Academic calendar and holidays CRUD with ownership isolation', async () => {
      const putCal1 = await request(server, 'PUT', '/api/calendar', {
        semester_name: 'Fall 2026',
        semester_number: 5,
        start_date: '2026-08-15',
        end_date: '2026-12-15'
      }, tokenA);
      assert.strictEqual(putCal1.status, 201);
      assert.strictEqual(putCal1.body.semester_name, 'Fall 2026');
      assert.strictEqual(putCal1.body.is_current, isPostgres() ? true : 1);

      const putCal2 = await request(server, 'PUT', '/api/calendar', {
        semester_name: 'Fall 2026 Updated',
        semester_number: 5,
        start_date: '2026-08-15',
        end_date: '2026-12-20'
      }, tokenA);
      assert.strictEqual(putCal2.status, 200);
      assert.strictEqual(putCal2.body.semester_name, 'Fall 2026 Updated');

      const holCreate = await request(server, 'POST', '/api/calendar/holidays', {
        name: 'Winter Break',
        date: '2026-12-10'
      }, tokenA);
      assert.strictEqual(holCreate.status, 201);
      assert.strictEqual(holCreate.body.date, '2026-12-10');
      holidayId = holCreate.body.id;

      const getCalA = await request(server, 'GET', '/api/calendar', null, tokenA);
      assert.strictEqual(getCalA.status, 200);
      assert.strictEqual(getCalA.body.calendar.semester_name, 'Fall 2026 Updated');
      assert.strictEqual(getCalA.body.holidays.length, 1);

      const getCalB = await request(server, 'GET', '/api/calendar', null, tokenB);
      assert.strictEqual(getCalB.status, 200);
      assert.strictEqual(getCalB.body.calendar, null);
      assert.strictEqual(getCalB.body.holidays.length, 0);

      const delHolB = await request(server, 'DELETE', `/api/calendar/holidays/${holidayId}`, null, tokenB);
      assert.strictEqual(delHolB.status, 404);

      const delHolA = await request(server, 'DELETE', `/api/calendar/holidays/${holidayId}`, null, tokenA);
      assert.strictEqual(delHolA.status, 200);

      const getCalAAfter = await request(server, 'GET', '/api/calendar', null, tokenA);
      assert.strictEqual(getCalAAfter.body.holidays.length, 0);

      // Input validation checks on calendar and holidays
      const badCalDate = await request(server, 'PUT', '/api/calendar', {
        semester_name: 'Bad Dates',
        start_date: '2026-02-30',
        end_date: '2026-12-01'
      }, tokenA);
      assert.strictEqual(badCalDate.status, 400);

      const badCalOrder = await request(server, 'PUT', '/api/calendar', {
        semester_name: 'Reversed Dates',
        start_date: '2026-12-15',
        end_date: '2026-08-15'
      }, tokenA);
      assert.strictEqual(badCalOrder.status, 400);

      const badHolDate = await request(server, 'POST', '/api/calendar/holidays', {
        name: 'Invalid Holiday',
        date: 'not-a-date'
      }, tokenA);
      assert.strictEqual(badHolDate.status, 400);
    });

    await asyncTest('Notifications generation, deduplication, read state and isolation', async () => {
      const list1 = await request(server, 'GET', '/api/notifications', null, tokenA);
      assert.strictEqual(list1.status, 200);
      assert.strictEqual(list1.body.length, 1);
      assert.strictEqual(list1.body[0].type, 'attendance_shortage');
      assert.strictEqual(list1.body[0].is_read, isPostgres() ? false : 0);
      notifId = list1.body[0].id;

      // Fetching again while unread must not create a duplicate notification
      const list2 = await request(server, 'GET', '/api/notifications', null, tokenA);
      assert.strictEqual(list2.status, 200);
      assert.strictEqual(list2.body.length, 1);

      const unread1 = await request(server, 'GET', '/api/notifications/unread-count', null, tokenA);
      assert.strictEqual(unread1.status, 200);
      assert.strictEqual(unread1.body.count, 1);

      const readB = await request(server, 'PUT', `/api/notifications/${notifId}/read`, {}, tokenB);
      assert.strictEqual(readB.status, 404);

      const readA = await request(server, 'PUT', `/api/notifications/${notifId}/read`, {}, tokenA);
      assert.strictEqual(readA.status, 200);

      const unread2 = await request(server, 'GET', '/api/notifications/unread-count', null, tokenA);
      assert.strictEqual(unread2.body.count, 0);

      const readAll = await request(server, 'PUT', '/api/notifications/read-all', {}, tokenA);
      assert.strictEqual(readAll.status, 200);

      const delNotif = await request(server, 'DELETE', `/api/notifications/${notifId}`, null, tokenA);
      assert.strictEqual(delNotif.status, 200);
    });

    await asyncTest('User settings booleans and attendance reset isolation', async () => {
      const getSet = await request(server, 'GET', '/api/settings', null, tokenA);
      assert.strictEqual(getSet.status, 200);
      assert.strictEqual(getSet.body.min_attendance_threshold, 80);

      const putSet = await request(server, 'PUT', '/api/settings', {
        smart_buffer_warnings: false,
        critical_shortage_alert: false,
        morning_rundown: true,
        notification_enabled: false
      }, tokenA);
      assert.strictEqual(putSet.status, 200);
      assert.strictEqual(putSet.body.smart_buffer_warnings, isPostgres() ? false : 0);
      assert.strictEqual(putSet.body.critical_shortage_alert, isPostgres() ? false : 0);
      assert.strictEqual(putSet.body.morning_rundown, isPostgres() ? true : 1);
      assert.strictEqual(putSet.body.notification_enabled, isPostgres() ? false : 0);

      // Input validation checks on settings
      const badTheme = await request(server, 'PUT', '/api/settings', { theme: 'neon' }, tokenA);
      assert.strictEqual(badTheme.status, 400);

      const lowThresh = await request(server, 'PUT', '/api/settings', { min_attendance_threshold: -5 }, tokenA);
      assert.strictEqual(lowThresh.status, 400);

      const highThresh = await request(server, 'PUT', '/api/settings', { min_attendance_threshold: 105 }, tokenA);
      assert.strictEqual(highThresh.status, 400);

      const highWarn = await request(server, 'PUT', '/api/settings', { warning_threshold: 120 }, tokenA);
      assert.strictEqual(highWarn.status, 400);

      // Create subject + attendance for User B to ensure User A reset does not touch User B
      const subB = await request(server, 'POST', '/api/subjects', {
        name: 'Linear Algebra',
        code: 'MATH201'
      }, tokenB);
      assert.strictEqual(subB.status, 201);

      const attB = await request(server, 'POST', '/api/attendance', {
        subject_id: subB.body.id,
        date: '2026-11-24',
        start_time: '11:00:00',
        status: 'present'
      }, tokenB);
      assert.strictEqual(attB.status, 201);

      const resetA = await request(server, 'POST', '/api/settings/reset-attendance', {}, tokenA);
      assert.strictEqual(resetA.status, 200);
      assert.strictEqual(resetA.body.deleted, 1);

      const attAAfter = await request(server, 'GET', '/api/attendance', null, tokenA);
      assert.strictEqual(attAAfter.status, 200);
      assert.strictEqual(attAAfter.body.length, 0);

      const attBAfter = await request(server, 'GET', '/api/attendance', null, tokenB);
      assert.strictEqual(attBAfter.status, 200);
      assert.strictEqual(attBAfter.body.length, 1);

      // User A's unrelated data (subjects) remains intact after attendance reset
      const subAAfter = await request(server, 'GET', `/api/subjects/${subjectId}`, null, tokenA);
      assert.strictEqual(subAAfter.status, 200);
    });

    await asyncTest('Invalid UUID / ID format returns 404 instead of 500', async () => {
      const r1 = await request(server, 'GET', '/api/subjects/not-a-valid-uuid', null, tokenA);
      assert.strictEqual(r1.status, 404);

      const r2 = await request(server, 'PUT', '/api/attendance/not-a-valid-uuid', { status: 'present' }, tokenA);
      assert.strictEqual(r2.status, 404);

      const r3 = await request(server, 'DELETE', '/api/calendar/holidays/not-a-valid-uuid', null, tokenA);
      assert.strictEqual(r3.status, 404);

      const r4 = await request(server, 'PUT', '/api/notifications/not-a-valid-uuid/read', {}, tokenA);
      assert.strictEqual(r4.status, 404);
    });

    await asyncTest('Calendar projection, subjects CRUD, deadlines isolation, attendance delete audit, and profile update', async () => {
      // 1. Calendar projection & date-boundary behaviour
      const projA = await request(server, 'GET', `/api/calendar/projection/${subjectId}?plannedAbsences=1`, null, tokenA);
      assert.strictEqual(projA.status, 200);
      assert.strictEqual(projA.body.has_semester_dates, true);
      assert.strictEqual(projA.body.has_timetable, true);
      assert.strictEqual(projA.body.is_estimate, true);
      assert.strictEqual(typeof projA.body.projected_percentage, 'number');

      const projBForbidden = await request(server, 'GET', `/api/calendar/projection/${subjectId}`, null, tokenB);
      assert.strictEqual(projBForbidden.status, 404);

      // Date boundary: past semester end_date yields classesRemaining = 0
      const pastCal = await request(server, 'PUT', '/api/calendar', {
        semester_name: 'Past Semester',
        semester_number: 4,
        start_date: '2025-01-01',
        end_date: '2025-05-01'
      }, tokenA);
      assert.strictEqual(pastCal.status, 200);
      const projPast = await request(server, 'GET', `/api/calendar/projection/${subjectId}`, null, tokenA);
      assert.strictEqual(projPast.status, 200);
      assert.strictEqual(projPast.body.classesRemaining, 0);

      // 2. Subjects update, delete, and ownership isolation
      const updSub = await request(server, 'PUT', `/api/subjects/${subjectId}`, {
        name: 'Advanced Data Structures',
        credits: ''
      }, tokenA);
      assert.strictEqual(updSub.status, 200);
      assert.strictEqual(updSub.body.name, 'Advanced Data Structures');
      assert.strictEqual(updSub.body.credits, 3);

      const updSubB = await request(server, 'PUT', `/api/subjects/${subjectId}`, { name: 'Hacked' }, tokenB);
      assert.strictEqual(updSubB.status, 404);

      const tempSub = await request(server, 'POST', '/api/subjects', { name: 'Temp Sub', code: 'TMP101' }, tokenA);
      assert.strictEqual(tempSub.status, 201);
      const delTempSub = await request(server, 'DELETE', `/api/subjects/${tempSub.body.id}`, null, tokenA);
      assert.strictEqual(delTempSub.status, 200);
      const getDeletedSub = await request(server, 'GET', `/api/subjects/${tempSub.body.id}`, null, tokenA);
      assert.strictEqual(getDeletedSub.status, 404);

      // 2b. Duplicate subject prevention (per user) & cross-user same-name support
      const ds1 = await request(server, 'POST', '/api/subjects', {
        name: 'Data Science',
        code: 'DS301'
      }, tokenA);
      assert.strictEqual(ds1.status, 201);

      const dsDupName = await request(server, 'POST', '/api/subjects', {
        name: 'data science',
        code: 'DS302'
      }, tokenA);
      assert.strictEqual(dsDupName.status, 409);

      const dsDupCode = await request(server, 'POST', '/api/subjects', {
        name: 'Applied Data Science',
        code: 'ds301'
      }, tokenA);
      assert.strictEqual(dsDupCode.status, 409);

      // Different user (User B) can independently create Data Science
      const dsUserB = await request(server, 'POST', '/api/subjects', {
        name: 'Data Science',
        code: 'DS301'
      }, tokenB);
      assert.strictEqual(dsUserB.status, 201);

      // Attendance recorded on User A's Data Science stays associated with ds1
      const dsAtt = await request(server, 'POST', '/api/attendance', {
        subject_id: ds1.body.id,
        date: '2026-11-26',
        start_time: '10:00:00',
        status: 'present'
      }, tokenA);
      assert.strictEqual(dsAtt.status, 201);
      assert.strictEqual(dsAtt.body.subject.attended, 1);

      const listA = await request(server, 'GET', '/api/subjects', null, tokenA);
      const dsMatchesA = listA.body.filter((s) => s.name === 'Data Science');
      assert.strictEqual(dsMatchesA.length, 1);
      assert.strictEqual(dsMatchesA[0].attended, 1);

      // 2c. Edit credits and frequency_per_week, verify persistence & attendance preservation
      const editDs = await request(server, 'PUT', `/api/subjects/${ds1.body.id}`, {
        name: 'Data Science',
        code: 'DS301',
        credits: 4.5,
        frequency_per_week: 5
      }, tokenA);
      assert.strictEqual(editDs.status, 200);
      assert.strictEqual(Number(editDs.body.credits), 4.5);
      assert.strictEqual(Number(editDs.body.frequency_per_week), 5);
      assert.strictEqual(editDs.body.attended, 1);

      const getDsAfterEdit = await request(server, 'GET', `/api/subjects/${ds1.body.id}`, null, tokenA);
      assert.strictEqual(getDsAfterEdit.status, 200);
      assert.strictEqual(Number(getDsAfterEdit.body.credits), 4.5);
      assert.strictEqual(Number(getDsAfterEdit.body.frequency_per_week), 5);
      assert.strictEqual(getDsAfterEdit.body.attended, 1);

      const badCredits = await request(server, 'PUT', `/api/subjects/${ds1.body.id}`, {
        credits: 25
      }, tokenA);
      assert.strictEqual(badCredits.status, 400);

      // 2d. Soft-archive preserves attendance, deadlines, and timetable; explicit restore restores original ID
      const dsDeadline = await request(server, 'POST', '/api/deadlines', {
        title: 'DS Project',
        subject_id: ds1.body.id,
        category: 'project',
        due_date: '2026-12-10'
      }, tokenA);
      assert.strictEqual(dsDeadline.status, 201);

      const dsSlot = await request(server, 'POST', '/api/timetable', {
        subject_id: ds1.body.id,
        day_of_week: 3,
        start_time: '14:00',
        end_time: '15:30',
        room: 'DS-Lab'
      }, tokenA);
      assert.strictEqual(dsSlot.status, 201);

      const delDs1 = await request(server, 'DELETE', `/api/subjects/${ds1.body.id}`, null, tokenA);
      assert.strictEqual(delDs1.status, 200);

      // Archived subject cannot be fetched or edited as active
      const getArchivedAsActive = await request(server, 'GET', `/api/subjects/${ds1.body.id}`, null, tokenA);
      assert.strictEqual(getArchivedAsActive.status, 404);
      const putArchived = await request(server, 'PUT', `/api/subjects/${ds1.body.id}`, { room: 'X' }, tokenA);
      assert.strictEqual(putArchived.status, 404);

      // Recreating a genuinely new subject succeeds (201) and does NOT auto-reassign archived records
      const dsRecreated = await request(server, 'POST', '/api/subjects', {
        name: 'Data Science',
        code: 'DS301',
        credits: 0,
        frequency_per_week: 4
      }, tokenA);
      assert.strictEqual(dsRecreated.status, 201);
      assert.strictEqual(Number(dsRecreated.body.credits), 0);
      assert.strictEqual(dsRecreated.body.attended, 0);
      assert.notStrictEqual(dsRecreated.body.id, ds1.body.id);

      // Zero-credit subject persists on GET and can be archived to test multiple identical archived subjects
      const getZeroCredit = await request(server, 'GET', `/api/subjects/${dsRecreated.body.id}`, null, tokenA);
      assert.strictEqual(getZeroCredit.status, 200);
      assert.strictEqual(Number(getZeroCredit.body.credits), 0);

      // Cannot restore archived ds1 while active dsRecreated conflicts by name/code (409)
      const restoreConflict = await request(server, 'POST', `/api/subjects/${ds1.body.id}/restore`, {}, tokenA);
      assert.strictEqual(restoreConflict.status, 409);

      // Archive dsRecreated too -> now two archived subjects share the same name/code
      await request(server, 'DELETE', `/api/subjects/${dsRecreated.body.id}`, null, tokenA);
      const archivedListA = await request(server, 'GET', '/api/subjects/archived', null, tokenA);
      assert.strictEqual(archivedListA.status, 200);
      assert.strictEqual(archivedListA.body.filter((s) => s.code === 'DS301').length, 2);

      // User B cannot restore User A's archived subject
      const restoreB = await request(server, 'POST', `/api/subjects/${ds1.body.id}/restore`, {}, tokenB);
      assert.strictEqual(restoreB.status, 404);

      // Restoration fails atomically (409) if an active timetable slot conflicts with an archived slot
      const conflictingActiveSlot = await request(server, 'POST', '/api/timetable', {
        subject_id: subjectId,
        day_of_week: 3,
        start_time: '14:30',
        end_time: '16:00',
        room: 'Conflict-Room'
      }, tokenA);
      assert.strictEqual(conflictingActiveSlot.status, 201);

      const restoreTtConflict = await request(server, 'POST', `/api/subjects/${ds1.body.id}/restore`, {}, tokenA);
      assert.strictEqual(restoreTtConflict.status, 409);

      // Verify ds1 remains archived and dsSlot remains inactive (no partial restore)
      const ds1StillArchived = await request(server, 'GET', `/api/subjects/${ds1.body.id}`, null, tokenA);
      assert.strictEqual(ds1StillArchived.status, 404);
      const ttDuringConflict = await request(server, 'GET', '/api/timetable', null, tokenA);
      assert.strictEqual(ttDuringConflict.body.entries.some((e) => e.id === dsSlot.body.id), false);

      // Remove the conflicting slot and retry restoration -> succeeds with original ID & records
      await request(server, 'DELETE', `/api/timetable/${conflictingActiveSlot.body.id}`, null, tokenA);

      // Explicitly restore ds1 by its original ID -> attendance, deadline, and timetable slot are all intact
      const restoreDs1 = await request(server, 'POST', `/api/subjects/${ds1.body.id}/restore`, {}, tokenA);
      assert.strictEqual(restoreDs1.status, 200);
      assert.strictEqual(restoreDs1.body.id, ds1.body.id);
      assert.strictEqual(restoreDs1.body.attended, 1);

      const dlAfterRestore = await request(server, 'GET', '/api/deadlines', null, tokenA);
      const restoredDl = dlAfterRestore.body.find((d) => d.id === dsDeadline.body.id);
      assert(restoredDl);
      assert.strictEqual(restoredDl.subject_id, ds1.body.id);
      assert.strictEqual(restoredDl.subject_code, 'DS301');

      const ttAfterRestore = await request(server, 'GET', '/api/timetable', null, tokenA);
      const restoredSlot = ttAfterRestore.body.entries.find((e) => e.id === dsSlot.body.id);
      assert(restoredSlot);
      assert.strictEqual(restoredSlot.subject_id, ds1.body.id);

      // Clean up test deadline, slot, archived subjects, and dsUserB
      await request(server, 'DELETE', `/api/deadlines/${dsDeadline.body.id}`, null, tokenA);
      await request(server, 'DELETE', `/api/timetable/${dsSlot.body.id}`, null, tokenA);
      await request(server, 'DELETE', `/api/subjects/${ds1.body.id}`, null, tokenA);
      await request(server, 'DELETE', `/api/subjects/${dsUserB.body.id}`, null, tokenB);

      // 3. Deadlines ownership isolation and delete
      const dlB1 = await request(server, 'PUT', `/api/deadlines/${deadlineId}`, { title: 'Hacked' }, tokenB);
      assert.strictEqual(dlB1.status, 404);
      const dlB2 = await request(server, 'PUT', `/api/deadlines/${deadlineId}/complete`, {}, tokenB);
      assert.strictEqual(dlB2.status, 404);
      const dlB3 = await request(server, 'DELETE', `/api/deadlines/${deadlineId}`, null, tokenB);
      assert.strictEqual(dlB3.status, 404);

      const delDlA = await request(server, 'DELETE', `/api/deadlines/${deadlineId}`, null, tokenA);
      assert.strictEqual(delDlA.status, 200);

      // 4. Attendance delete, audit log DELETE entry, and isolation
      const tempAtt = await request(server, 'POST', '/api/attendance', {
        subject_id: subjectId,
        date: '2026-11-25',
        start_time: '14:00:00',
        status: 'present'
      }, tokenA);
      assert.strictEqual(tempAtt.status, 201);
      const tempAttId = tempAtt.body.record.id;

      const delAttB = await request(server, 'DELETE', `/api/attendance/${tempAttId}`, null, tokenB);
      assert.strictEqual(delAttB.status, 404);

      const delAttA = await request(server, 'DELETE', `/api/attendance/${tempAttId}`, null, tokenA);
      assert.strictEqual(delAttA.status, 200);

      const db = getDatabase();
      const delAudit = await db.all(
        'SELECT action, old_status, new_status FROM attendance_audit_log WHERE record_id = ?',
        tempAttId
      );
      assert.strictEqual(delAudit.length, 2);
      const delInsertRow = delAudit.find((r) => r.action === 'INSERT');
      const delDeleteRow = delAudit.find((r) => r.action === 'DELETE');
      assert(delInsertRow, 'Expected INSERT audit row');
      assert(delDeleteRow, 'Expected DELETE audit row');
      assert.strictEqual(delInsertRow.new_status, 'present');
      assert.strictEqual(delDeleteRow.old_status, 'present');

      // 5. Profile update and isolation
      const profA = await request(server, 'PUT', '/api/auth/me', {
        full_name: 'Maya Lin Updated',
        department: 'Computer Science'
      }, tokenA);
      assert.strictEqual(profA.status, 200);
      assert.strictEqual(profA.body.full_name, 'Maya Lin Updated');
      assert.strictEqual(profA.body.department, 'Computer Science');

      const profB = await request(server, 'GET', '/api/auth/me', null, tokenB);
      assert.strictEqual(profB.status, 200);
      assert.strictEqual(profB.body.full_name, 'Other Student');
    });

    await asyncTest('Account deletion removes User A and cascades data without affecting User B', async () => {
      const delAcc = await request(server, 'DELETE', '/api/auth/me', null, tokenA);
      assert.strictEqual(delAcc.status, 200);

      const meAfter = await request(server, 'GET', '/api/auth/me', null, tokenA);
      assert.strictEqual(meAfter.status, 404);

      const userBMe = await request(server, 'GET', '/api/auth/me', null, tokenB);
      assert.strictEqual(userBMe.status, 200);
      assert.strictEqual(userBMe.body.email, emailB);
    });
  } finally {
    try {
      const db = getDatabase();
      for (const uid of createdUserIds) {
        await db.run('DELETE FROM users WHERE id = ?', uid);
      }
    } catch (cleanupErr) {
      console.error('Test cleanup error:', cleanupErr.message);
    }
    server.close();
    await close();
    if (!isPostgres() && fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
  }

  console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

runAll().catch(err => {
  console.error(err);
  process.exit(1);
});
