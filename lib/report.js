const fs = require('fs');
const path = require('path');

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function toDate(value) {
  return value instanceof Date ? value : new Date(value || Date.now());
}

function pathToReportAsset(assetPath, baseDir) {
  const rawPath = String(assetPath || '');
  if (!rawPath) return '';
  if (/^(https?:)?\/\//i.test(rawPath) || rawPath.startsWith('data:')) return rawPath;

  const relative = path.isAbsolute(rawPath) && baseDir
    ? path.relative(baseDir, rawPath)
    : rawPath;

  return relative
    .split(path.sep)
    .join('/')
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/');
}

function captureFile(capture, baseDir) {
  return pathToReportAsset(capture.file || capture.path || capture.screenshotPath, baseDir);
}

function viewportLabel(capture) {
  if (capture.viewport && typeof capture.viewport === 'object') {
    const name = capture.viewport.name || capture.viewport.label;
    const dims = capture.viewport.width && capture.viewport.height
      ? `${capture.viewport.width}x${capture.viewport.height}`
      : '';
    return [name, dims].filter(Boolean).join(' ');
  }
  return capture.viewport || capture.size || '';
}

function pageKey(capture) {
  return capture.url || capture.page || capture.pageTitle || capture.name || 'Ungrouped';
}

function groupCaptures(captures) {
  const groups = new Map();
  for (const capture of captures) {
    const key = pageKey(capture);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(capture);
  }
  return Array.from(groups.entries());
}

function renderCaptureCard(capture, baseDir) {
  const file = escapeHtml(captureFile(capture, baseDir));
  const name = escapeHtml(capture.name || capture.title || capture.file || 'Capture');
  const size = escapeHtml(capture.size || '');
  const url = escapeHtml(capture.url || '');
  const viewport = escapeHtml(viewportLabel(capture));
  return `
        <article class="capture-card" data-size="${size}" data-viewport="${viewport}">
          <a href="${file}"><img src="${file}" alt="${name}" loading="lazy"></a>
          <div class="capture-meta">
            <strong>${name}</strong>
            ${viewport ? `<span>${viewport}</span>` : ''}
            ${size && size !== viewport ? `<span>${size}</span>` : ''}
            ${url ? `<small>${url}</small>` : ''}
          </div>
        </article>`;
}

function renderCaptureGroups(captures, baseDir) {
  return groupCaptures(captures).map(([key, group]) => `
      <section class="capture-group">
        <div class="group-heading">
          <h3>${escapeHtml(key)}</h3>
          <span>${group.length} ${group.length === 1 ? 'capture' : 'captures'}</span>
        </div>
        <div class="grid">${group.map((capture) => renderCaptureCard(capture, baseDir)).join('\n')}</div>
      </section>`).join('\n');
}

function generateReportHtml({
  projectName,
  mode,
  generatedAt = new Date(),
  captures = [],
  video = '',
  videoPath = '',
  summary = {},
  baseDir = '',
} = {}) {
  const generated = toDate(generatedAt);
  const groups = renderCaptureGroups(captures, baseDir);
  const videoSrc = pathToReportAsset(videoPath || video, baseDir);

  const videoBlock = videoSrc
    ? `<section class="video"><h2>Video</h2><video src="${escapeHtml(videoSrc)}" controls></video></section>`
    : '';

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(projectName || 'Snapcrawl Report')}</title>
  <style>
    body { margin: 0; font: 14px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #172026; background: #f7f8fa; }
    header { padding: 32px; background: #12202f; color: white; }
    main { padding: 24px 32px 40px; }
    h1, h2, h3 { margin: 0 0 8px; }
    .summary { display: flex; gap: 16px; flex-wrap: wrap; margin: 16px 0 0; }
    .summary span { background: rgba(255,255,255,.14); padding: 6px 10px; border-radius: 6px; }
    .capture-group { margin: 0 0 28px; }
    .group-heading { align-items: baseline; display: flex; gap: 12px; justify-content: space-between; margin: 0 0 12px; }
    .group-heading span { color: #607080; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 16px; }
    .capture-card { background: white; border: 1px solid #dce3ea; border-radius: 8px; overflow: hidden; }
    .capture-card img { width: 100%; height: 180px; object-fit: cover; display: block; background: #edf1f5; }
    .capture-meta { display: grid; gap: 4px; padding: 12px; }
    .capture-meta small { color: #607080; overflow-wrap: anywhere; }
    .video { margin: 0 0 24px; }
    video { width: min(100%, 960px); background: #111; border-radius: 8px; }
  </style>
</head>
<body>
  <header>
    <h1>${escapeHtml(projectName || 'Snapcrawl Report')}</h1>
    <p>${escapeHtml(mode || 'capture')} generated ${escapeHtml(generated.toISOString())}</p>
    <div class="summary">
      <span>${captures.length} captures</span>
      ${summary.pages !== undefined ? `<span>${escapeHtml(summary.pages)} pages</span>` : ''}
      ${summary.interactions !== undefined ? `<span>${escapeHtml(summary.interactions)} interactions</span>` : ''}
    </div>
  </header>
  <main>
    ${videoBlock}
    <section>
      <h2>Screenshots</h2>
      ${groups || '<p>No captures found.</p>'}
    </section>
  </main>
</body>
</html>
`;
}

function renderHtmlReport(data) {
  return generateReportHtml(data);
}

function writeHtmlReport(outputPathOrOptions, data) {
  if (typeof outputPathOrOptions === 'string') {
    fs.mkdirSync(path.dirname(outputPathOrOptions), { recursive: true });
    fs.writeFileSync(outputPathOrOptions, generateReportHtml(data), 'utf8');
    return outputPathOrOptions;
  }

  const options = outputPathOrOptions || {};
  const outputDir = options.outputDir || options.baseDir || process.cwd();
  const outputPath = options.reportPath || path.join(outputDir, 'report.html');
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, generateReportHtml({ ...options, baseDir: options.baseDir || outputDir }), 'utf8');
  return outputPath;
}

module.exports = {
  escapeHtml,
  generateReportHtml,
  renderHtmlReport,
  writeHtmlReport,
};
