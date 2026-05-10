const assert = require('node:assert/strict');
const test = require('node:test');

const { resolveConfigPathForTool } = require('../lib/mcp-utils');

test('resolveConfigPathForTool rejects traversal and absolute config paths', () => {
  assert.match(resolveConfigPathForTool('capture-config.json'), /capture-config\.json$/);
  assert.throws(() => resolveConfigPathForTool('../secret.json'), /unsafe path/i);
  assert.throws(() => resolveConfigPathForTool('/tmp/secret.json'), /unsafe path/i);
});
