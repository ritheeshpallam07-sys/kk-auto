import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIST_DIR = path.resolve(__dirname, '../dist');

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
].filter(Boolean);

function findBrowserExecutable() {
  for (const candidate of CHROME_CANDIDATES) {
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error('Could not find Chrome/Edge executable. Set CHROME_PATH environment variable.');
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

class CdpClient {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.nextId = 1;
    this.pending = new Map();
    this.events = [];
  }

  async connect() {
    await new Promise((resolve, reject) => {
      this.ws.addEventListener('open', resolve, { once: true });
      this.ws.addEventListener('error', reject, { once: true });
    });
    this.ws.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(`${msg.error.code}: ${msg.error.message}`));
        else resolve(msg.result);
      } else if (msg.method) {
        this.events.push(msg);
      }
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    try {
      this.ws.close();
    } catch {
      // Ignore close errors
    }
  }
}

async function waitFor(fn, { timeoutMs = 8000, intervalMs = 60, description = 'condition' } = {}) {
  const start = Date.now();
  let lastError = null;
  while (Date.now() - start < timeoutMs) {
    try {
      const value = await fn();
      if (value) return value;
    } catch (err) {
      lastError = err;
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`Timed out waiting for ${description}${lastError ? `: ${lastError.message}` : ''}`);
}

async function evalJs(cdp, expression) {
  const res = await cdp.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true
  });
  if (res.exceptionDetails) {
    throw new Error(`Page evaluation error: ${JSON.stringify(res.exceptionDetails.text || res.exceptionDetails)}`);
  }
  return res.result?.value;
}

async function setInputValue(cdp, selector, value) {
  const ok = await evalJs(
    cdp,
    `(() => {
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) return false;
      const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
      setter?.call(el, ${JSON.stringify(value)});
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    })()`
  );
  assert.strictEqual(ok, true, `Input element not found: ${selector}`);
}

async function clickButtonByText(cdp, text) {
  const ok = await evalJs(
    cdp,
    `(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const btn = buttons.find((b) => (b.textContent || '').includes(${JSON.stringify(text)}) && !b.disabled);
      if (!btn) return false;
      btn.click();
      return true;
    })()`
  );
  assert.strictEqual(ok, true, `Enabled button containing "${text}" not found`);
}

async function getBodyText(cdp) {
  return (await evalJs(cdp, `document.body?.innerText || ''`)) || '';
}

async function getPathname(cdp) {
  return await evalJs(cdp, `window.location.pathname`);
}

async function startMockServer(getScenario) {
  const server = http.createServer(async (req, res) => {
    const reqUrl = new URL(req.url || '/', 'http://127.0.0.1');
    const pathname = reqUrl.pathname;

    if (pathname.startsWith('/api/')) {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const rawBody = Buffer.concat(chunks).toString('utf8');
      let body = {};
      if (rawBody) {
        try {
          body = JSON.parse(rawBody);
        } catch {
          body = {};
        }
      }

      const handler = getScenario();
      const result = await handler({ method: req.method, pathname, query: reqUrl.searchParams, headers: req.headers, body });
      const status = result?.status || 200;
      const responseHeaders = {
        'Content-Type': 'application/json',
        ...(result?.headers || {})
      };
      if (result?.setCookies) {
        responseHeaders['Set-Cookie'] = result.setCookies;
      }
      res.writeHead(status, responseHeaders);
      res.end(JSON.stringify(result?.body ?? { success: true }));
      return;
    }

    // Serve static files from client/dist with SPA index.html fallback
    const safeRel = path.normalize(pathname === '/' ? '/index.html' : pathname).replace(/^(\.\.[/\\])+/, '');
    let filePath = path.join(DIST_DIR, safeRel);
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      filePath = path.join(DIST_DIR, 'index.html');
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  return { server, baseUrl: `http://127.0.0.1:${address.port}` };
}

async function runTests() {
  assert.ok(fs.existsSync(path.join(DIST_DIR, 'index.html')), 'client/dist must be built before running E2E tests');

  let scenarioHandler = async () => ({ status: 200, body: { success: true } });
  const { server, baseUrl } = await startMockServer(() => scenarioHandler);

  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kk-auto-cdp-'));
  const chromeExe = findBrowserExecutable();
  const chromeProc = spawn(
    chromeExe,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      '--remote-debugging-port=0',
      `--user-data-dir=${userDataDir}`,
      'about:blank'
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] }
  );

  let cdp;
  try {
    const wsDebugUrl = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Chrome DevTools did not start in time')), 10000);
      const onData = (buf) => {
        const text = buf.toString('utf8');
        const match = text.match(/DevTools listening on (ws:\/\/[^\s]+)/);
        if (match) {
          clearTimeout(timeout);
          resolve(match[1]);
        }
      };
      chromeProc.stderr.on('data', onData);
      chromeProc.stdout.on('data', onData);
      chromeProc.once('exit', (code) => {
        clearTimeout(timeout);
        reject(new Error(`Chrome exited early with code ${code}`));
      });
    });

    const parsedDebug = new URL(wsDebugUrl);
    const listResp = await fetch(`http://127.0.0.1:${parsedDebug.port}/json/list`);
    const targets = await listResp.json();
    const pageTarget = targets.find((t) => t.type === 'page') || targets[0];
    assert.ok(pageTarget?.webSocketDebuggerUrl, 'Must have a Chrome page target');

    cdp = new CdpClient(pageTarget.webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Network.enable');

    // Emulate mobile viewport (390x844) matching mobile Clik2Go usage
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      mobile: true
    });

    async function resetBrowserState(pathAndQuery = '/') {
      await cdp.send('Network.clearBrowserCookies');
      await cdp.send('Page.navigate', { url: 'about:blank' });
      await waitFor(async () => (await evalJs(cdp, `window.location.href === 'about:blank'`)), {
        description: 'about:blank navigation'
      });
      await cdp.send('Page.navigate', { url: `${baseUrl}${pathAndQuery}` });
      await waitFor(async () => (await getBodyText(cdp)).trim().length > 0, {
        description: `initial render of ${pathAndQuery}`
      });
      await evalJs(
        cdp,
        `(() => {
          try { sessionStorage.setItem('kk_splash_seen', 'true'); } catch {}
          window.__kkPageErrors = [];
          window.addEventListener('error', (e) => window.__kkPageErrors.push(String(e.message || e.error)));
          window.addEventListener('unhandledrejection', (e) => window.__kkPageErrors.push(String(e.reason)));
        })()`
      );
      if (pathAndQuery !== '/') {
        await cdp.send('Page.reload', { ignoreCache: true });
        await waitFor(async () => (await getBodyText(cdp)).trim().length > 0, {
          description: `reload without splash on ${pathAndQuery}`
        });
      }
    }

    // =========================================================================
    // E2E 1: Login verifies /api/auth/me; blocked cookie shows clean error & does not log in
    // =========================================================================
    let cookieAllowed = false;
    let meCalls = 0;
    const sampleCustomer = {
      id: 101,
      name: 'Test Rider',
      email: 'rider@test.com',
      mobile: '9876543210',
      role: 'customer',
      terms_version: '1.0'
    };

    scenarioHandler = async ({ method, pathname, headers }) => {
      if (pathname === '/api/auth/csrf-token') {
        return {
          body: { success: true, csrfToken: 'csrf-e2e' },
          setCookies: ['kk_csrf=csrf-e2e; Path=/']
        };
      }
      if (pathname === '/api/auth/login' && method === 'POST') {
        return {
          body: { success: true, data: { user: sampleCustomer } },
          setCookies: cookieAllowed ? ['kk_token=e2e-session; Path=/; HttpOnly'] : []
        };
      }
      if (pathname === '/api/auth/me') {
        meCalls++;
        const hasSessionCookie = String(headers.cookie || '').includes('kk_token=e2e-session');
        if (cookieAllowed && hasSessionCookie) {
          return { body: { success: true, data: sampleCustomer } };
        }
        return { status: 401, body: { success: false, error: 'Authentication Required.' } };
      }
      if (pathname === '/api/auth/logout') {
        return { body: { success: true } };
      }
      return { body: { success: true, data: [] } };
    };

    await resetBrowserState('/login');
    await waitFor(async () => (await getBodyText(cdp)).includes('Welcome back'), {
      description: 'LoginPage heading'
    });
    await setInputValue(cdp, 'input[placeholder="name@email.com or 9876543210"]', 'rider@test.com');
    await setInputValue(cdp, 'input[placeholder="Enter password"]', 'Password123!');
    const beforeCalls = meCalls;
    await clickButtonByText(cdp, 'Login');

    await waitFor(async () => (await getBodyText(cdp)).includes('blocked the login session cookie'), {
      description: 'cookie-blocked error message after login'
    });
    assert.ok(meCalls > beforeCalls, 'login must verify session with /api/auth/me');
    assert.strictEqual(await getPathname(cdp), '/login', 'Failed cookie verification must keep user on /login');

    // Now allow session cookie and verify login succeeds and navigates to /
    cookieAllowed = true;
    await clickButtonByText(cdp, 'Login');
    await waitFor(async () => (await getPathname(cdp)) === '/', {
      description: 'navigation to / after confirmed /api/auth/me'
    });
    console.log('✅ PASS E2E 1: Login verifies /api/auth/me; cookie-blocked login fails cleanly without false logged-in state');

    // =========================================================================
    // E2E 2: Booking submission returning 401 clears auth state and redirects to /login
    // =========================================================================
    let bookingAuthed = true;
    scenarioHandler = async ({ method, pathname }) => {
      if (pathname === '/api/auth/csrf-token') {
        return { body: { success: true, csrfToken: 'csrf-e2e' }, setCookies: ['kk_csrf=csrf-e2e; Path=/'] };
      }
      if (pathname === '/api/auth/me') {
        if (bookingAuthed) return { body: { success: true, data: sampleCustomer } };
        return { status: 401, body: { success: false, error: 'Authentication Required. Please log in.' } };
      }
      if (pathname === '/api/auth/logout') {
        bookingAuthed = false;
        return { body: { success: true } };
      }
      if (pathname === '/api/bookings/locations') {
        return { body: { success: true, data: ['Main Market', 'Railway Station', 'RTC Bus Stand'] } };
      }
      if (pathname === '/api/bookings/fare-estimate' && method === 'POST') {
        return {
          body: {
            success: true,
            data: {
              available: true,
              from: 'Main Market',
              to: 'Railway Station',
              distanceKm: 3.4,
              estimatedFare: 50,
              baseFare: 30,
              perKmRate: 12,
              fareSource: 'standard',
              etaMinutes: 9
            }
          }
        };
      }
      if (pathname === '/api/bookings' && method === 'POST') {
        bookingAuthed = false;
        return { status: 401, body: { success: false, error: 'Authentication Required. Please log in.' } };
      }
      return { body: { success: true, data: [] } };
    };

    await resetBrowserState('/book');
    await waitFor(
      async () => Boolean(await evalJs(cdp, `Boolean(document.querySelector('input[placeholder*="pickup address"]'))`)),
      { description: 'BookingFormPage pickup input' }
    );
    await setInputValue(cdp, 'input[placeholder*="pickup address"]', 'Main Market');
    await setInputValue(cdp, 'input[placeholder*="destination address"]', 'Railway Station');
    await waitFor(
      async () =>
        Boolean(
          await evalJs(
            cdp,
            `(() => {
              const btn = Array.from(document.querySelectorAll('button')).find((b) => (b.textContent || '').includes('Confirm Ride'));
              return Boolean(btn && !btn.disabled);
            })()`
          )
        ),
      { description: 'Confirm Ride button enabled after fare estimate' }
    );
    await clickButtonByText(cdp, 'Confirm Ride');
    await waitFor(async () => (await getPathname(cdp)) === '/login', {
      description: 'redirect to /login after booking 401'
    });
    console.log('✅ PASS E2E 2: Booking submission 401 clears auth state and redirects cleanly to /login');

    // =========================================================================
    // E2E 3: Email OTP verification refreshes AuthContext before navigating to /accept-terms
    // =========================================================================
    let otpVerifiedCookieSet = false;
    const unacceptedTermsCustomer = { ...sampleCustomer, terms_version: null };
    scenarioHandler = async ({ method, pathname }) => {
      if (pathname === '/api/auth/csrf-token') {
        return { body: { success: true, csrfToken: 'csrf-e2e' }, setCookies: ['kk_csrf=csrf-e2e; Path=/'] };
      }
      if (pathname === '/api/auth/me') {
        if (otpVerifiedCookieSet) return { body: { success: true, data: unacceptedTermsCustomer } };
        return { status: 401, body: { success: false, error: 'Not logged in' } };
      }
      if (pathname === '/api/auth/verify-email-otp' && method === 'POST') {
        otpVerifiedCookieSet = true;
        return { body: { success: true, data: { message: 'Email verified successfully' } } };
      }
      return { body: { success: true, data: {} } };
    };

    // Also test OTP success when /api/auth/me returns 401 (blocked cookie): shows clear error & does not navigate
    otpVerifiedCookieSet = false;
    let blockOtpCookie = true;
    scenarioHandler = async ({ method, pathname }) => {
      if (pathname === '/api/auth/csrf-token') {
        return { body: { success: true, csrfToken: 'csrf-e2e' }, setCookies: ['kk_csrf=csrf-e2e; Path=/'] };
      }
      if (pathname === '/api/auth/me') {
        if (!blockOtpCookie && otpVerifiedCookieSet) return { body: { success: true, data: unacceptedTermsCustomer } };
        return { status: 401, body: { success: false, error: 'Not logged in' } };
      }
      if (pathname === '/api/auth/verify-email-otp' && method === 'POST') {
        otpVerifiedCookieSet = true;
        return { body: { success: true, data: { message: 'Email verified successfully' } } };
      }
      return { body: { success: true, data: {} } };
    };
    await resetBrowserState('/verify-email?email=rider%40test.com');
    await waitFor(async () => (await getBodyText(cdp)).includes('Verify Your Email'), {
      description: 'VerifyEmailPage heading (cookie-blocked check)'
    });
    await setInputValue(cdp, 'input[placeholder="123456"]', '123456');
    await clickButtonByText(cdp, 'Verify OTP & Continue');
    await waitFor(async () => (await getBodyText(cdp)).includes('blocked the session cookie'), {
      description: 'VerifyEmailPage cookie-blocked error'
    });
    assert.strictEqual(await getPathname(cdp), '/verify-email');

    blockOtpCookie = false;
    await clickButtonByText(cdp, 'Verify OTP & Continue');
    await waitFor(async () => (await getPathname(cdp)) === '/accept-terms', {
      description: 'navigation to /accept-terms after OTP verification'
    });
    await waitFor(async () => (await getBodyText(cdp)).includes('Terms & Privacy Policy'), {
      description: 'TermsAcceptancePage renders (AuthContext hydrated, not Login Required)'
    });
    console.log('✅ PASS E2E 3: VerifyEmailPage refreshes AuthContext (blocks false redirect if cookie blocked) and renders TermsAcceptancePage');

    // =========================================================================
    // E2E 4: ResetPasswordPage accepts top-level { success: true, valid: true }
    // =========================================================================
    const validHexToken = 'a'.repeat(64);
    scenarioHandler = async ({ pathname }) => {
      if (pathname === '/api/auth/csrf-token') {
        return { body: { success: true, csrfToken: 'csrf-e2e' }, setCookies: ['kk_csrf=csrf-e2e; Path=/'] };
      }
      if (pathname === '/api/auth/verify-reset-token') {
        return { body: { success: true, valid: true } };
      }
      if (pathname === '/api/auth/me') {
        return { status: 401, body: { success: false } };
      }
      return { body: { success: true } };
    };

    await resetBrowserState(`/reset-password?token=${validHexToken}`);
    await waitFor(async () => (await getBodyText(cdp)).includes('New Password'), {
      description: 'ResetPasswordPage password form with top-level valid:true'
    });
    const scrubbedSearch = await evalJs(cdp, `window.location.search`);
    assert.strictEqual(scrubbedSearch, '', 'Reset token must be scrubbed from URL search bar');
    console.log('✅ PASS E2E 4: ResetPasswordPage renders form when backend returns top-level { success: true, valid: true }');

    // =========================================================================
    // E2E 5: ResetPasswordPage invalid/expired token renders clear error UI (never blank)
    // =========================================================================
    scenarioHandler = async ({ pathname }) => {
      if (pathname === '/api/auth/csrf-token') {
        return { body: { success: true, csrfToken: 'csrf-e2e' }, setCookies: ['kk_csrf=csrf-e2e; Path=/'] };
      }
      if (pathname === '/api/auth/verify-reset-token') {
        return { status: 400, body: { success: false, error: 'Invalid or expired password reset link.' } };
      }
      return { status: 401, body: { success: false } };
    };

    await resetBrowserState(`/reset-password?token=${'b'.repeat(64)}`);
    await waitFor(async () => (await getBodyText(cdp)).includes('Recovery Link Expired or Invalid'), {
      description: 'ResetPasswordPage expired/invalid error state'
    });
    console.log('✅ PASS E2E 5: ResetPasswordPage invalid/expired token renders clear recovery error UI');

    // =========================================================================
    // E2E 6: Storage-throwing WebView renders /, /login, and /reset-password without blank page
    // =========================================================================
    scenarioHandler = async ({ pathname }) => {
      if (pathname === '/api/auth/csrf-token') {
        return { body: { success: true, csrfToken: 'csrf-e2e' }, setCookies: ['kk_csrf=csrf-e2e; Path=/'] };
      }
      if (pathname === '/api/auth/verify-reset-token') {
        return { body: { success: true, valid: true } };
      }
      return { status: 401, body: { success: false } };
    };

    const { identifier: scriptId } = await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
      source: `
        const throwStorage = () => { throw new DOMException('Storage disabled in WebView', 'SecurityError'); };
        Object.defineProperty(window, 'localStorage', { configurable: true, get: throwStorage });
        Object.defineProperty(window, 'sessionStorage', { configurable: true, get: throwStorage });
        window.__kkCapturedErrors = [];
        window.addEventListener('error', (e) => window.__kkCapturedErrors.push(e.message || 'error'));
      `
    });

    try {
      for (const route of ['/', '/login', `/reset-password?token=${validHexToken}`]) {
        await cdp.send('Page.navigate', { url: `${baseUrl}${route}` });
        await waitFor(
          async () => {
            const text = await getBodyText(cdp);
            return text.trim().length > 20;
          },
          { description: `non-blank render under throwing storage on ${route}` }
        );
        const errs = await evalJs(cdp, `window.__kkCapturedErrors`);
        assert.deepStrictEqual(errs, [], `Expected zero uncaught errors on ${route} with blocked storage`);
      }
      await waitFor(async () => (await getBodyText(cdp)).includes('New Password'), {
        description: 'ResetPasswordPage form renders even with blocked WebView storage'
      });
    } finally {
      await cdp.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: scriptId });
    }
    console.log('✅ PASS E2E 6: Storage-throwing WebView safely renders /, /login, and /reset-password without blank screens');

    // =========================================================================
    // E2E 7: Trailing slash /reset-password/ resolves cleanly
    // =========================================================================
    await resetBrowserState(`/reset-password/?token=${validHexToken}`);
    await waitFor(async () => (await getBodyText(cdp)).includes('New Password'), {
      description: 'ResetPasswordPage render on /reset-password/ trailing slash'
    });
    console.log('✅ PASS E2E 7: Trailing slash /reset-password/ resolves correctly');

    // =========================================================================
    // E2E 8-11: DriverDashboard 401, 500+Retry, APPROVED, and PENDING
    // =========================================================================
    const sampleDriverUser = {
      id: 202,
      name: 'Driver Partner',
      email: 'driver@test.com',
      mobile: '9888888888',
      role: 'driver',
      terms_version: '1.0'
    };

    const makeDriverProfile = (approvalStatus) => ({
      id: 11,
      user_id: 202,
      name: 'Driver Partner',
      email: 'driver@test.com',
      mobile: '9888888888',
      auto_number: 'AP-01-XX-1111',
      auto_model: 'Bajaj RE',
      license_number: 'DL-TEST-01',
      payout_upi: 'driver@okicici',
      approval_status: approvalStatus,
      availability_status: approvalStatus === 'APPROVED' ? 'available' : 'offline'
    });

    let driverProfileMode = '401'; // '401' | '500' | 'APPROVED' | 'PENDING'
    scenarioHandler = async ({ pathname }) => {
      if (pathname === '/api/auth/csrf-token') {
        return { body: { success: true, csrfToken: 'csrf-e2e' }, setCookies: ['kk_csrf=csrf-e2e; Path=/'] };
      }
      if (pathname === '/api/auth/me') {
        return { body: { success: true, data: sampleDriverUser } };
      }
      if (pathname === '/api/auth/logout') {
        return { body: { success: true } };
      }
      if (pathname === '/api/drivers/me') {
        if (driverProfileMode === '401') {
          return { status: 401, body: { success: false, error: 'Driver session expired.' } };
        }
        if (driverProfileMode === '500') {
          return { status: 500, body: { success: false, error: 'Temporary database outage.' } };
        }
        return { body: { success: true, data: makeDriverProfile(driverProfileMode) } };
      }
      if (pathname === '/api/drivers/earnings') {
        return { body: { success: true, data: { totalEarnings: 500, completedRidesCount: 3, pendingSettlement: 0 } } };
      }
      if (pathname === '/api/drivers/requests' || pathname === '/api/bookings') {
        return { body: { success: true, data: [] } };
      }
      return { body: { success: true, data: [] } };
    };

    // E2E 8: 401 shows authentication screen (NOT Account Pending Verification)
    driverProfileMode = '401';
    await resetBrowserState('/driver');
    await waitFor(async () => (await getBodyText(cdp)).includes('Session Verification Required'), {
      description: 'DriverDashboard 401 auth error screen'
    });
    const body401 = await getBodyText(cdp);
    assert.ok(!body401.toUpperCase().includes('ACCOUNT PENDING VERIFICATION'), 'Driver 401 must NEVER render Pending Verification');
    await clickButtonByText(cdp, 'Sign In Again');
    await waitFor(async () => (await getPathname(cdp)) === '/login', {
      description: 'Driver Sign In Again button navigates to /login'
    });
    console.log('✅ PASS E2E 8: DriverDashboard 401 shows Session Verification Required (not PENDING) and Sign In Again redirects cleanly');

    // E2E 9 & 10: 500 shows Retry (not PENDING), and Retry recovers to APPROVED profile
    driverProfileMode = '500';
    await resetBrowserState('/driver');
    await waitFor(async () => (await getBodyText(cdp)).includes('Unable to Load Driver Profile'), {
      description: 'DriverDashboard 500 error screen'
    });
    const body500 = await getBodyText(cdp);
    assert.ok(!body500.toUpperCase().includes('ACCOUNT PENDING VERIFICATION'), 'Driver 500 must NEVER render Pending Verification');

    driverProfileMode = 'APPROVED';
    await clickButtonByText(cdp, 'Retry');
    await waitFor(
      async () => {
        const text = await getBodyText(cdp);
        return text.includes('APPROVED') || text.includes('Online');
      },
      { description: 'DriverDashboard recovers after Retry into APPROVED profile' }
    );
    const bodyApprovedAfterRetry = await getBodyText(cdp);
    assert.ok(!bodyApprovedAfterRetry.toUpperCase().includes('ACCOUNT PENDING VERIFICATION'), 'APPROVED driver must not see Pending Verification banner');
    console.log('✅ PASS E2E 9 & 10: DriverDashboard 500 shows Retry (not PENDING) and recovers into APPROVED console');

    // E2E 11: Genuinely PENDING driver shows Account Pending Verification
    driverProfileMode = 'PENDING';
    await resetBrowserState('/driver');
    await waitFor(async () => (await getBodyText(cdp)).toUpperCase().includes('ACCOUNT PENDING VERIFICATION'), {
      description: 'Genuinely PENDING driver renders Account Pending Verification banner'
    });
    console.log('✅ PASS E2E 11: DriverDashboard genuinely PENDING profile renders Account Pending Verification');

    console.log('\n🎉 ALL 11 FRONTEND CDP E2E SCENARIOS (MOBILE VIEWPORT 390x844) PASSED!');
  } finally {
    if (cdp) cdp.close();
    chromeProc.kill('SIGKILL');
    server.close();
    try {
      fs.rmSync(userDataDir, { recursive: true, force: true });
    } catch {
      // Ignore Windows handle release timing
    }
  }
}

runTests().catch((err) => {
  console.error('❌ E2E failure:', err);
  process.exit(1);
});
