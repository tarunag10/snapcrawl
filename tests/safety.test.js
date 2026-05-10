const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

const {
  interpolateEnv,
  isFileUrlContainedWithin,
  safeJoin,
} = require('../lib/safety');

test('safeJoin rejects absolute and traversal paths', () => {
  const root = path.join('/tmp', 'snapcrawl-output');

  assert.equal(safeJoin(root, 'screens/home.png'), path.join(root, 'screens', 'home.png'));
  assert.throws(() => safeJoin(root, '../secret.txt'), /unsafe path/i);
  assert.throws(() => safeJoin(root, '/etc/passwd'), /unsafe path/i);
  assert.throws(() => safeJoin(root, 'screens/../../secret.txt'), /unsafe path/i);
});

test('file URL containment uses path containment instead of string prefixes', () => {
  const root = '/tmp/site';

  assert.equal(isFileUrlContainedWithin('file:///tmp/site/index.html', root), true);
  assert.equal(isFileUrlContainedWithin('file:///tmp/site/nested/page.html', root), true);
  assert.equal(isFileUrlContainedWithin('file:///tmp/site-other/index.html', root), false);
  assert.equal(isFileUrlContainedWithin('https://example.com/index.html', root), false);
});

test('interpolateEnv replaces supported tokens without exposing secret values', () => {
  const env = {
    LOGIN_PASSWORD: 'p@ssw0rd',
    LOGIN_EMAIL: 'person@example.test',
  };

  assert.equal(interpolateEnv('${LOGIN_PASSWORD}', env), 'p@ssw0rd');
  assert.equal(interpolateEnv('email=${env:LOGIN_EMAIL}', env), 'email=person@example.test');
  assert.deepEqual(interpolateEnv({ password: '${LOGIN_PASSWORD}' }, env), { password: 'p@ssw0rd' });
  assert.throws(
    () => interpolateEnv('${MISSING_SECRET}', env),
    (error) => /MISSING_SECRET/.test(error.message) && !/p@ssw0rd/.test(error.message)
  );
});
