const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
let server, browser, origin;
before(async () => {
  server = http.createServer((req, res) => {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    const file = path.join(root, pathname === '/' ? 'index.html' : pathname);
    try {
      const content = fs.readFileSync(file);
      const type = file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css'
        : file.endsWith('.jpg') ? 'image/jpeg' : 'text/html';
      res.writeHead(200, { 'Content-Type': type }); res.end(content);
    } catch { res.writeHead(404); res.end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = 'http://127.0.0.1:' + server.address().port;
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
    headless: true, args: ['--no-sandbox'] });
});
after(async () => { await browser?.close(); await new Promise(resolve => server.close(resolve)); });

// Simulated SDK only: no production Pixel events are emitted by these tests.
async function scenario(options = {}) {
  const context = await browser.newContext();
  const page = await context.newPage();
  if (options.initialConsent) {
    await page.addInitScript(() => {
      // Represents an existing CMP that already exposes the consent interface.
      window.FunnelConsent = { isMarketingGranted: () => true, subscribe: () => () => {} };
    });
  }
  const observed = { sdk: 0, events: [], delivered: [], errors: [] };
  page.on('pageerror', error => observed.errors.push(error.message));
  await page.route('https://analytics.tiktok.com/**', async route => {
    if (route.request().url().includes('/i18n/pixel/events.js')) {
      observed.sdk++;
      assert.equal(new URL(route.request().url()).searchParams.get('sdkid'), 'DBQPS3JC77U2EVIR1DHG');
      if (options.block) return route.abort('blockedbyclient');
      if (options.neverReady) return route.fulfill({ contentType: 'text/javascript', body: '// Simulated SDK that never becomes ready.' });
      await new Promise(resolve => setTimeout(resolve, options.sdkDelay || 0));
      return route.fulfill({ contentType: 'text/javascript', body: `
        (() => {
          const ttq = window.ttq;
          const queued = [...ttq]; ttq.length = 0;
          let allowed = false;
          const send = event => {
            if (!allowed) return;
            setTimeout(() => {
              if (allowed) fetch('https://analytics.tiktok.com/test-events', {
                method: 'POST', body: JSON.stringify({ event }), keepalive: true
              }).catch(() => {});
            }, 80);
          };
          ttq.page = () => send('PageView');
          ttq.track = event => send(event);
          ttq.ready = callback => callback();
          ttq.grantConsent = () => { allowed = true; };
          ttq.revokeConsent = () => { allowed = false; };
          for (const [method, ...args] of queued) ttq[method]?.(...args);
        })();` });
    }
    const event = JSON.parse(route.request().postData()).event;
    observed.events.push(event);
    await new Promise(resolve => setTimeout(resolve, 120));
    observed.delivered.push(event);
    return route.fulfill({ status: 200, headers: { 'Access-Control-Allow-Origin': '*' }, body: '{}' });
  });
  await page.route('https://www.stkstrck.com/**', route => route.fulfill({ contentType: 'text/html', body: '<h1>Offer destination</h1>' }));
  await page.goto(origin + '/index.html', { waitUntil: 'domcontentloaded' });
  return { page, context, observed };
}
async function grant(page) { await page.evaluate(() => window.FunnelConsent.setMarketingConsent(true)); }
async function finalCTA(page) {
  if (await page.locator('.consent-panel').isVisible()) {
    // Continuing without a consent decision must remain possible, without tracking.
    await page.getByRole('button', { name: 'Close privacy notice' }).click();
  }
  await page.locator('#next').click();
  await page.locator('#steps-read-confirmation').check();
  await page.locator('#go').click();
}

test('unknown consent sends nothing; offer still opens without pixel', async () => {
  const { page, context, observed } = await scenario();
  try {
    assert.equal(observed.sdk, 0);
    assert.equal(await page.evaluate(() => typeof window.ttq), 'undefined');
    await finalCTA(page);
    await page.waitForURL('https://www.stkstrck.com/**');
    assert.equal(observed.sdk, 0); assert.deepEqual(observed.events, []);
  } finally { await context.close(); }
});

test('existing granted consent is preserved and PageView starts on document load', async () => {
  const { page, context, observed } = await scenario({ initialConsent: true });
  try {
    await page.waitForTimeout(350);
    assert.equal(await page.evaluate(() => window.FunnelConsent.isMarketingGranted()), true);
    assert.equal(observed.sdk, 1); assert.deepEqual(observed.events, ['PageView']);
  } finally { await context.close(); }
});

test('late consent initializes once; conversion request completes before navigation', async () => {
  const { page, context, observed } = await scenario({ sdkDelay: 250 });
  try {
    await grant(page);
    await page.addScriptTag({ url: origin + '/tiktok-pixel.js' });
    await grant(page);
    await finalCTA(page);
    // Simulate a second submit while tracking is pending; it must not duplicate.
    if (!page.url().startsWith('https://www.stkstrck.com')) {
      await page.evaluate(() => {
        document.getElementById('steps-read-confirmation')?.dispatchEvent(new Event('change'));
        document.getElementById('intent-question')?.dispatchEvent(new Event('submit', { cancelable: true }));
      });
    }
    await page.waitForURL('https://www.stkstrck.com/**');
    assert.equal(observed.sdk, 1);
    assert.deepEqual(observed.events, ['PageView', 'CompleteRegistration']);
    assert.deepEqual(observed.delivered, ['PageView', 'CompleteRegistration']);
    assert.deepEqual(observed.errors, []);
  } finally { await context.close(); }
});

test('revocation before SDK loading finishes discards queued PageView', async () => {
  const { page, context, observed } = await scenario({ sdkDelay: 350 });
  try {
    await grant(page);
    await page.evaluate(() => window.FunnelConsent.setMarketingConsent(false));
    await page.waitForTimeout(650);
    assert.equal(observed.sdk, 1);
    assert.deepEqual(observed.events, []);
    await finalCTA(page); await page.waitForURL('https://www.stkstrck.com/**');
    assert.deepEqual(observed.events, []);
  } finally { await context.close(); }
});

test('regrant does not reload SDK or repeat a delivered PageView', async () => {
  const { page, context, observed } = await scenario();
  try {
    await grant(page); await page.waitForTimeout(350);
    await page.evaluate(() => window.FunnelConsent.setMarketingConsent(false));
    await grant(page); await page.waitForTimeout(250);
    assert.equal(observed.sdk, 1);
    assert.deepEqual(observed.events, ['PageView']);
  } finally { await context.close(); }
});

test('blocked SDK does not prevent offer navigation or invent delivered events', async () => {
  const { page, context, observed } = await scenario({ block: true });
  try {
    await grant(page); await finalCTA(page);
    await page.waitForURL('https://www.stkstrck.com/**');
    assert.equal(observed.sdk, 1); assert.deepEqual(observed.events, []);
    assert.deepEqual(observed.errors, []);
  } finally { await context.close(); }
});

test('SDK readiness timeout bounds the CTA wait instead of trapping the visitor', async () => {
  const { page, context, observed } = await scenario({ neverReady: true });
  try {
    await grant(page);
    const start = Date.now();
    await finalCTA(page);
    await page.waitForURL('https://www.stkstrck.com/**', { timeout: 4500 });
    assert(Date.now() - start >= 1800);
    assert.equal(observed.sdk, 1); assert.deepEqual(observed.delivered, []);
  } finally { await context.close(); }
});

test('QA mode and invalid destinations never emit CompleteRegistration', async () => {
  const { page, context, observed } = await scenario();
  try {
    await page.evaluate(() => history.replaceState(null, '', '?qa=receipt'));
    await grant(page); await finalCTA(page);
    assert.equal(await page.locator('#status').textContent(), 'Test mode: download blocked.');
    await page.evaluate(() => { history.replaceState(null, '', '?stage=steps'); window.FUNNEL_CONFIG.downloadUrl = 'javascript:alert(1)'; });
    await page.locator('#go').click();
    await page.waitForTimeout(300);
    assert(!observed.events.includes('CompleteRegistration'));
    assert.match(await page.locator('#status').textContent(), /unavailable/);
  } finally { await context.close(); }
});

test('popup entry sends PageView after consent, not conversion on Continue', async () => {
  const { page, context, observed } = await scenario();
  try {
    await page.goto(origin + '/popup.html');
    await grant(page); await page.waitForTimeout(350);
    assert(await page.locator('.card').isVisible());
    assert.deepEqual(observed.events, ['PageView']);
    await page.locator('#continue').click(); await page.waitForURL(origin + '/index.html');
    assert(!observed.events.includes('CompleteRegistration'));
  } finally { await context.close(); }
});

test('reject UI persists across funnel pages; privacy settings can reopen the choice', async () => {
  const { page, context, observed } = await scenario();
  try {
    assert(await page.getByRole('region', { name: 'Advertising privacy' }).isVisible());
    await page.getByRole('button', { name: 'Reject tracking', exact: true }).click();
    assert(await page.locator('.consent-panel').isHidden());
    await page.goto(origin + '/popup.html');
    assert(await page.locator('.consent-panel').isHidden());
    assert.equal(observed.sdk, 0);
    await page.getByRole('button', { name: 'Privacy settings', exact: true }).click();
    assert(await page.locator('.consent-panel').isVisible());
    await page.getByRole('button', { name: 'Reject tracking', exact: true }).click();
    await page.locator('#continue').click();
    await page.waitForURL(origin + '/index.html');
    await finalCTA(page); await page.waitForURL('https://www.stkstrck.com/**');
    assert.equal(observed.sdk, 0); assert.deepEqual(observed.events, []);
  } finally { await context.close(); }
});

test('accept UI enables each document once, and settings revocation suppresses conversion', async () => {
  const { page, context, observed } = await scenario();
  try {
    await page.getByRole('button', { name: 'Accept tracking', exact: true }).click();
    await page.waitForTimeout(350);
    assert.deepEqual(observed.events, ['PageView']);
    await page.goto(origin + '/popup.html');
    await page.waitForTimeout(350);
    assert(await page.locator('.consent-panel').isHidden());
    assert.equal(observed.sdk, 2);
    assert.deepEqual(observed.events, ['PageView', 'PageView']);
    await page.getByRole('button', { name: 'Privacy settings', exact: true }).click();
    await page.getByRole('button', { name: 'Reject tracking', exact: true }).click();
    assert.equal(await page.evaluate(() => window.FunnelConsent.isMarketingGranted()), false);
    await page.locator('#continue').click(); await page.waitForURL(origin + '/index.html');
    await finalCTA(page); await page.waitForURL('https://www.stkstrck.com/**');
    assert.equal(observed.sdk, 2);
    assert(!observed.events.includes('CompleteRegistration'));
  } finally { await context.close(); }
});

test('consent buttons fit a small phone viewport and storage failure does not break a choice', async () => {
  const { page, context, observed } = await scenario();
  try {
    await page.setViewportSize({ width: 320, height: 480 });
    for (const choice of ['Reject tracking', 'Accept tracking']) {
      const bounds = await page.getByRole('button', { name: choice, exact: true }).boundingBox();
      assert(bounds && bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= 320 && bounds.y + bounds.height <= 480);
    }
    await page.evaluate(() => { Storage.prototype.setItem = () => { throw new Error('Storage blocked'); }; });
    await page.getByRole('button', { name: 'Reject tracking', exact: true }).click();
    assert(await page.locator('.consent-panel').isHidden());
    assert.equal(observed.sdk, 0);
    await finalCTA(page); await page.waitForURL('https://www.stkstrck.com/**');
    assert.deepEqual(observed.errors, []);
  } finally { await context.close(); }
});

test('privacy notice does not cover the popup Continue button', async () => {
  const { page, context, observed } = await scenario();
  try {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(origin + '/popup.html');
    const notice = await page.locator('.consent-panel').boundingBox();
    const button = await page.locator('#continue').boundingBox();
    assert(notice.y + notice.height <= button.y);
    await page.locator('#continue').click(); await page.waitForURL(origin + '/index.html');
    assert.equal(observed.sdk, 0);
  } finally { await context.close(); }
});
