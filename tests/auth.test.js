const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  buildContextOptions,
  describeAuthConfig,
  normalizeBasicAuth,
} = require('../lib/auth');

test('buildContextOptions supports storage state, headers file, and basic auth', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'snapcrawl-auth-'));
  fs.writeFileSync(path.join(dir, 'headers.json'), JSON.stringify({ 'x-demo': 'yes' }));

  const options = buildContextOptions({
    auth: {
      storageState: 'state.json',
      headers: { authorization: 'Bearer secret' },
      headersFile: 'headers.json',
      basic: { username: 'demo', password: 'password' },
    },
  }, { cwd: dir });

  assert.equal(options.storageState, path.join(dir, 'state.json'));
  assert.deepEqual(options.extraHTTPHeaders, {
    authorization: 'Bearer secret',
    'x-demo': 'yes',
  });
  assert.deepEqual(options.httpCredentials, { username: 'demo', password: 'password' });
});

test('auth summaries redact values but expose methods', () => {
  assert.deepEqual(describeAuthConfig({
    auth: {
      storageState: 'state.json',
      cookiesFile: 'cookies.json',
      headers: { authorization: 'Bearer secret' },
    },
  }), {
    enabled: true,
    methods: ['storageState', 'cookies', 'headers'],
    redacted: true,
  });

  assert.throws(() => normalizeBasicAuth({ basic: { username: 'demo' } }), /password/i);
});
