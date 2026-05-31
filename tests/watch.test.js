const assert = require('node:assert/strict');
const test = require('node:test');

const { parseWatchArgs, shouldIgnoreWatchPath } = require('../lib/watch');

test('parseWatchArgs defaults to capture command and preserves useful flags', () => {
  const parsed = parseWatchArgs(['--config', 'snapcrawl.json', '--dir', 'src', '--debounce', '750', '--record']);

  assert.equal(parsed.config, 'snapcrawl.json');
  assert.equal(parsed.dir, 'src');
  assert.equal(parsed.debounceMs, 750);
  assert.equal(parsed.command, 'record');
});

test('shouldIgnoreWatchPath skips generated and dependency paths', () => {
  assert.equal(shouldIgnoreWatchPath('node_modules/playwright/index.js'), true);
  assert.equal(shouldIgnoreWatchPath('output/social/home.png'), true);
  assert.equal(shouldIgnoreWatchPath('src/App.jsx'), false);
});
