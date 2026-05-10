const assert = require('node:assert/strict');
const test = require('node:test');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const cli = path.join(__dirname, '..', 'scripts', 'snapcrawl.js');

test('snapcrawl cli exposes core commands in help', () => {
  const result = spawnSync(process.execPath, [cli, '--help'], { encoding: 'utf8' });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /capture/);
  assert.match(result.stdout, /record/);
  assert.match(result.stdout, /baseline save/);
  assert.match(result.stdout, /diff/);
});
