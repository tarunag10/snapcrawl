const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { PNG } = require('pngjs');

const { comparePngFiles, writeVisualDiffReport } = require('../lib/visual-diff');

function writePng(filePath, pixels) {
  const png = new PNG({ width: 2, height: 1 });
  pixels.forEach((pixel, index) => {
    const offset = index * 4;
    png.data[offset] = pixel[0];
    png.data[offset + 1] = pixel[1];
    png.data[offset + 2] = pixel[2];
    png.data[offset + 3] = pixel[3] ?? 255;
  });
  fs.writeFileSync(filePath, PNG.sync.write(png));
}

test('comparePngFiles writes an overlay and reports changed pixel counts', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'snapcrawl-visual-diff-'));
  const before = path.join(dir, 'before.png');
  const after = path.join(dir, 'after.png');
  const overlay = path.join(dir, 'diff.png');

  writePng(before, [[255, 255, 255], [0, 0, 0]]);
  writePng(after, [[255, 255, 255], [255, 0, 0]]);

  const result = comparePngFiles(before, after, overlay);

  assert.equal(result.status, 'changed');
  assert.equal(result.changedPixels, 1);
  assert.equal(result.totalPixels, 2);
  assert.equal(result.ratio, 0.5);
  assert.equal(fs.existsSync(overlay), true);
});

test('writeVisualDiffReport enriches changed captures with overlay paths', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'snapcrawl-visual-report-'));
  fs.mkdirSync(path.join(dir, 'baseline'));
  fs.mkdirSync(path.join(dir, 'current'));
  writePng(path.join(dir, 'baseline', 'home.png'), [[255, 255, 255], [0, 0, 0]]);
  writePng(path.join(dir, 'current', 'home.png'), [[255, 255, 255], [255, 0, 0]]);

  const result = writeVisualDiffReport({
    baselineRoot: path.join(dir, 'baseline'),
    currentRoot: path.join(dir, 'current'),
    outputDir: path.join(dir, 'current', 'diff'),
    results: [{ key: 'home.png', file: 'home.png', status: 'changed' }],
  });

  assert.equal(result.results[0].status, 'changed');
  assert.equal(result.results[0].pixelDiff.changedPixels, 1);
  assert.equal(result.results[0].diffFile, 'diff/home.diff.png');
  assert.equal(fs.existsSync(path.join(dir, 'current', 'diff', 'home.diff.png')), true);
});
