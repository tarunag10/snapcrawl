const assert = require('node:assert/strict');
const test = require('node:test');

const {
  validateCaptureConfig,
  validateRecordConfig,
} = require('../lib/config');

test('validateCaptureConfig accepts a minimal crawl config', () => {
  const config = validateCaptureConfig({
    baseUrl: 'https://example.com',
    waitUntil: 'load',
    crawl: {
      enabled: true,
      maxPages: 5,
      maxDepth: 2,
      waitAfterLoadMs: 250,
      viewports: [
        { name: 'desktop', width: 1440, height: 900 },
      ],
    },
  });

  assert.equal(config.baseUrl, 'https://example.com');
});

test('validateCaptureConfig reports baseUrl, protocol, numeric, waitUntil, step, and path failures', () => {
  assert.throws(() => validateCaptureConfig({ crawl: { enabled: true } }), /baseUrl/i);
  assert.throws(
    () => validateCaptureConfig({ baseUrl: 'ftp://example.com', crawl: { enabled: true } }),
    /protocol/i
  );
  assert.throws(
    () => validateCaptureConfig({ baseUrl: 'https://example.com', crawl: { enabled: true, maxPages: 0 } }),
    /maxPages/i
  );
  assert.throws(
    () => validateCaptureConfig({ baseUrl: 'https://example.com', waitUntil: 'paint', crawl: { enabled: true } }),
    /waitUntil/i
  );
  assert.throws(
    () => validateCaptureConfig({
      baseUrl: 'https://example.com',
      scenarios: [
        { file: 'screens/home.png', viewport: { width: 1200, height: 800 }, steps: [{ type: 'tap' }] },
      ],
    }),
    /step type/i
  );
  assert.throws(
    () => validateCaptureConfig({
      baseUrl: 'https://example.com',
      scenarios: [
        { file: '../outside.png', viewport: { width: 1200, height: 800 } },
      ],
    }),
    /unsafe path/i
  );
});

test('validateRecordConfig validates viewport, recording, workflow waits, and setup steps', () => {
  assert.doesNotThrow(() => validateRecordConfig({
    baseUrl: 'file:///tmp/site/index.html',
    waitUntil: 'domcontentloaded',
    viewport: { width: 1280, height: 720 },
    recording: { width: 1920, height: 1080 },
    crawl: { maxPages: 3, maxDepth: 1, waitAfterLoadMs: 100 },
    workflow: { scrollSteps: 2, perPagePauseMs: 50, actionPauseMs: 50, interactionLimitPerPage: 1 },
    setupSteps: [{ type: 'wait', ms: 10 }],
  }));

  assert.throws(
    () => validateRecordConfig({ baseUrl: 'https://example.com', viewport: { width: 0, height: 720 } }),
    /viewport.width/i
  );
  assert.throws(
    () => validateRecordConfig({ baseUrl: 'https://example.com', setupSteps: [{ type: 'evaluate', script: '' }] }),
    /script/i
  );
});

test('validation interpolates env placeholders before checking required values', () => {
  const config = validateRecordConfig(
    { baseUrl: '${env:SNAPCRAWL_BASE_URL}' },
    { env: { SNAPCRAWL_BASE_URL: 'https://example.com/login' } }
  );

  assert.equal(config.baseUrl, 'https://example.com/login');
});
