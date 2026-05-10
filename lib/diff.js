const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function fileHash(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function captureKey(capture) {
  return String(capture.key || capture.id || capture.file || capture.path || capture.screenshotPath || '');
}

function fileInfo(rootDir, relativeFile) {
  if (!relativeFile) return { exists: false, bytes: 0, size: 0, sha256: null, hash: null };
  const abs = path.resolve(rootDir, relativeFile);
  if (!fs.existsSync(abs)) return { exists: false, bytes: 0, size: 0, sha256: null, hash: null };
  const stat = fs.statSync(abs);
  const sha256 = fileHash(abs);
  return {
    exists: true,
    bytes: stat.size,
    size: stat.size,
    sha256,
    hash: sha256,
  };
}

function normalizeOptions(options = {}) {
  const rootDir = options.rootDir || options.outputDir || process.cwd();
  const baselinePath = options.baselinePath || path.join(rootDir, 'baseline.json');
  return { ...options, baselinePath, rootDir };
}

function saveBaseline(options = {}) {
  const {
    baselinePath,
    rootDir,
    captures = [],
    metadata = {},
    generatedAt = new Date().toISOString(),
  } = normalizeOptions(options);

  const entries = captures.map((capture) => ({
    ...capture,
    key: captureKey(capture),
    ...fileInfo(rootDir, capture.file || capture.path || capture.screenshotPath),
  }));
  const baseline = {
    version: 1,
    savedAt: generatedAt,
    generatedAt,
    rootDir,
    metadata,
    captures: entries,
  };
  fs.mkdirSync(path.dirname(baselinePath), { recursive: true });
  fs.writeFileSync(baselinePath, JSON.stringify(baseline, null, 2) + '\n', 'utf8');
  return baselinePath;
}

function summarizeCounts(results, baselineCount, currentCount) {
  const counts = {
    baseline: baselineCount,
    current: currentCount,
    added: 0,
    changed: 0,
    missing: 0,
    unchanged: 0,
  };
  for (const result of results) counts[result.status] += 1;
  return counts;
}

function compareToBaseline(options = {}) {
  const {
    baselinePath,
    rootDir,
    captures = [],
    generatedAt = new Date().toISOString(),
  } = normalizeOptions(options);
  const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
  const results = [];
  const baselineEntries = new Map();
  const currentEntries = new Map();

  for (const entry of baseline.captures || []) {
    baselineEntries.set(captureKey(entry), entry);
  }

  for (const capture of captures) {
    currentEntries.set(captureKey(capture), capture);
  }

  for (const [key, entry] of baselineEntries) {
    const currentCapture = currentEntries.get(key) || entry;
    const current = fileInfo(rootDir, currentCapture.file || currentCapture.path || currentCapture.screenshotPath);
    let status = 'unchanged';
    if (!current.exists) status = 'missing';
    else if (current.sha256 !== (entry.sha256 || entry.hash) || current.bytes !== (entry.bytes || entry.size)) {
      status = 'changed';
    }

    results.push({ key, file: entry.file, status, baseline: entry, current });
  }

  for (const [key, capture] of currentEntries) {
    if (baselineEntries.has(key)) continue;
    results.push({
      key,
      file: capture.file,
      status: 'added',
      baseline: null,
      current: {
        ...capture,
        key,
        ...fileInfo(rootDir, capture.file || capture.path || capture.screenshotPath),
      },
    });
  }

  const counts = summarizeCounts(results, baselineEntries.size, currentEntries.size);

  return {
    version: 1,
    generatedAt,
    baselinePath,
    rootDir,
    counts,
    summary: counts,
    results,
  };
}

function compareBaseline(options = {}) {
  const normalized = normalizeOptions(options);
  const baseline = JSON.parse(fs.readFileSync(normalized.baselinePath, 'utf8'));
  const captures = options.captures || baseline.captures || [];
  return compareToBaseline({ ...normalized, captures });
}

module.exports = {
  compareBaseline,
  compareToBaseline,
  captureKey,
  fileHash,
  fileInfo,
  saveBaseline,
};
