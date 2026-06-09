const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { listArtifactFiles, parseCiArgs, runCi } = require('../lib/ci');
const { saveBaseline } = require('../lib/diff');

test('parseCiArgs reads baseline, threshold, output, and flags', () => {
  const args = parseCiArgs([
    '--config', 'capture-config.json',
    '--baseline', 'baseline.json',
    '--dir', 'out',
    '--threshold', '2',
    '--skip-capture',
  ]);

  assert.equal(args.config, 'capture-config.json');
  assert.equal(args.baseline, 'baseline.json');
  assert.equal(args.outputDir, 'out');
  assert.equal(args.threshold, 2);
  assert.equal(args.skipCapture, true);
});

test('listArtifactFiles returns screenshot files recursively', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'snapcrawl-ci-files-'));
  fs.mkdirSync(path.join(dir, 'nested'));
  fs.writeFileSync(path.join(dir, 'home.png'), 'a');
  fs.writeFileSync(path.join(dir, 'nested', 'about.webp'), 'b');
  fs.writeFileSync(path.join(dir, 'report.html'), 'html');

  const files = listArtifactFiles(dir).map((file) => path.relative(dir, file)).sort();
  assert.deepEqual(files, ['home.png', 'nested/about.webp']);
});

test('runCi compares existing artifacts when capture is skipped', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'snapcrawl-ci-'));
  const outputDir = path.join(dir, 'out');
  fs.mkdirSync(outputDir);
  fs.writeFileSync(path.join(outputDir, 'home.png'), 'v1');

  saveBaseline({
    baselinePath: path.join(dir, 'baseline.json'),
    rootDir: outputDir,
    captures: [{ file: 'home.png' }],
  });

  assert.equal(runCi([
    '--skip-capture',
    '--baseline', 'baseline.json',
    '--dir', 'out',
  ], { cwd: dir, scriptPath: 'unused.js' }), 0);

  fs.writeFileSync(path.join(outputDir, 'home.png'), 'v2');
  assert.equal(runCi([
    '--skip-capture',
    '--baseline', 'baseline.json',
    '--dir', 'out',
  ], { cwd: dir, scriptPath: 'unused.js' }), 1);
});
