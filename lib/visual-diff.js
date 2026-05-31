const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');
const { sanitizeSegment } = require('./shared');

function readPng(filePath) {
  return PNG.sync.read(fs.readFileSync(filePath));
}

function changedPixel(a, b, threshold) {
  return (
    Math.abs(a[0] - b[0]) > threshold ||
    Math.abs(a[1] - b[1]) > threshold ||
    Math.abs(a[2] - b[2]) > threshold ||
    Math.abs(a[3] - b[3]) > threshold
  );
}

function comparePngFiles(baselinePath, currentPath, diffPath, options = {}) {
  const threshold = Number(options.threshold ?? 0);
  const baseline = readPng(baselinePath);
  const current = readPng(currentPath);

  if (baseline.width !== current.width || baseline.height !== current.height) {
    return {
      status: 'changed',
      changedPixels: null,
      totalPixels: null,
      ratio: 1,
      reason: `dimension mismatch: ${baseline.width}x${baseline.height} vs ${current.width}x${current.height}`,
    };
  }

  const diff = new PNG({ width: current.width, height: current.height });
  let changedPixels = 0;

  for (let i = 0; i < current.data.length; i += 4) {
    const before = [
      baseline.data[i],
      baseline.data[i + 1],
      baseline.data[i + 2],
      baseline.data[i + 3],
    ];
    const after = [
      current.data[i],
      current.data[i + 1],
      current.data[i + 2],
      current.data[i + 3],
    ];
    const changed = changedPixel(before, after, threshold);
    if (changed) changedPixels += 1;

    if (changed) {
      diff.data[i] = 255;
      diff.data[i + 1] = 48;
      diff.data[i + 2] = 48;
      diff.data[i + 3] = 255;
    } else {
      const gray = Math.round((after[0] + after[1] + after[2]) / 3);
      diff.data[i] = gray;
      diff.data[i + 1] = gray;
      diff.data[i + 2] = gray;
      diff.data[i + 3] = 120;
    }
  }

  fs.mkdirSync(path.dirname(diffPath), { recursive: true });
  fs.writeFileSync(diffPath, PNG.sync.write(diff));

  const totalPixels = current.width * current.height;
  return {
    status: changedPixels > 0 ? 'changed' : 'unchanged',
    changedPixels,
    totalPixels,
    ratio: totalPixels ? changedPixels / totalPixels : 0,
  };
}

function outputNameFor(file) {
  const parsed = path.parse(file || 'capture.png');
  return `${sanitizeSegment(path.join(parsed.dir, parsed.name)) || 'capture'}.diff.png`;
}

function writeVisualDiffReport(options = {}) {
  const baselineRoot = options.baselineRoot;
  const currentRoot = options.currentRoot;
  const outputDir = options.outputDir || path.join(currentRoot, 'diff');
  const threshold = Number(options.threshold ?? 0);
  const results = (options.results || []).map((result) => {
    if (result.status !== 'changed' || !result.file || !/\.png$/i.test(result.file)) {
      return result;
    }

    const baselinePath = path.join(baselineRoot, result.file);
    const currentPath = path.join(currentRoot, result.file);
    if (!fs.existsSync(baselinePath) || !fs.existsSync(currentPath)) return result;

    const diffFileName = outputNameFor(result.file);
    const diffPath = path.join(outputDir, diffFileName);
    const pixelDiff = comparePngFiles(baselinePath, currentPath, diffPath, { threshold });
    return {
      ...result,
      diffFile: path.relative(currentRoot, diffPath).split(path.sep).join('/'),
      pixelDiff,
    };
  });

  const report = {
    version: 1,
    generatedAt: new Date().toISOString(),
    baselineRoot,
    currentRoot,
    outputDir,
    results,
  };
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, 'visual-diff.json'), JSON.stringify(report, null, 2) + '\n', 'utf8');
  return report;
}

module.exports = {
  comparePngFiles,
  writeVisualDiffReport,
};
