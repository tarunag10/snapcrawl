const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { compareToBaseline, saveBaseline } = require('../lib/diff');

test('saveBaseline writes capture metadata with size and hash fingerprints', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'snapcrawl-baseline-'));
  fs.writeFileSync(path.join(dir, 'home.png'), 'first-image');

  const baselinePath = saveBaseline({
    outputDir: dir,
    captures: [{ name: 'Home', file: 'home.png', size: '1440x900' }],
    metadata: { projectName: 'Demo' },
    generatedAt: '2026-05-10T00:00:00.000Z',
  });

  const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
  assert.equal(baseline.version, 1);
  assert.equal(baseline.metadata.projectName, 'Demo');
  assert.equal(baseline.captures.length, 1);
  assert.equal(baseline.captures[0].exists, true);
  assert.equal(baseline.captures[0].bytes, 11);
  assert.match(baseline.captures[0].sha256, /^[a-f0-9]{64}$/);
});

test('compareToBaseline reports unchanged, changed, missing, and added captures', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'snapcrawl-diff-'));
  fs.writeFileSync(path.join(dir, 'same.png'), 'same');
  fs.writeFileSync(path.join(dir, 'changed.png'), 'before');
  fs.writeFileSync(path.join(dir, 'missing.png'), 'gone');

  const baselinePath = saveBaseline({
    outputDir: dir,
    baselinePath: path.join(dir, 'baseline.json'),
    captures: [
      { name: 'Same', file: 'same.png' },
      { name: 'Changed', file: 'changed.png' },
      { name: 'Missing', file: 'missing.png' },
    ],
    generatedAt: '2026-05-10T00:00:00.000Z',
  });

  fs.writeFileSync(path.join(dir, 'changed.png'), 'after');
  fs.unlinkSync(path.join(dir, 'missing.png'));
  fs.writeFileSync(path.join(dir, 'added.png'), 'new');

  const summary = compareToBaseline({
    outputDir: dir,
    baselinePath,
    captures: [
      { name: 'Same', file: 'same.png' },
      { name: 'Changed', file: 'changed.png' },
      { name: 'Added', file: 'added.png' },
    ],
    generatedAt: '2026-05-10T00:01:00.000Z',
  });

  assert.equal(summary.counts.baseline, 3);
  assert.equal(summary.counts.current, 3);
  assert.equal(summary.counts.unchanged, 1);
  assert.equal(summary.counts.changed, 1);
  assert.equal(summary.counts.missing, 1);
  assert.equal(summary.counts.added, 1);
  assert.deepEqual(
    summary.results.map((item) => [item.key, item.status]),
    [
      ['same.png', 'unchanged'],
      ['changed.png', 'changed'],
      ['missing.png', 'missing'],
      ['added.png', 'added'],
    ]
  );
});
