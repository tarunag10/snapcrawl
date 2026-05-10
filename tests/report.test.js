const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { escapeHtml, generateReportHtml, writeHtmlReport } = require('../lib/report');

test('escapeHtml escapes text and attribute-sensitive characters', () => {
  assert.equal(
    escapeHtml('<script>alert("x")</script> & user\'s page'),
    '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; user&#39;s page'
  );
});

test('generateReportHtml renders escaped static report with capture groups and video', () => {
  const html = generateReportHtml({
    projectName: 'Snap <Crawl>',
    generatedAt: '2026-05-10T00:00:00.000Z',
    baseDir: '/tmp/snapcrawl',
    videoPath: '/tmp/snapcrawl/demo video.mp4',
    captures: [
      {
        name: 'Home <Desktop>',
        file: 'home-desktop.png',
        url: 'https://example.test/?q=<bad>',
        size: '1440x900',
        viewport: { name: 'desktop', width: 1440, height: 900 },
      },
      {
        name: 'Home Mobile',
        file: 'home-mobile.png',
        url: 'https://example.test/?q=<bad>',
        size: '430x932',
        viewport: { name: 'mobile', width: 430, height: 932 },
      },
    ],
  });

  assert.match(html, /<!doctype html>/i);
  assert.match(html, /Snap &lt;Crawl&gt;/);
  assert.match(html, /Home &lt;Desktop&gt;/);
  assert.doesNotMatch(html, /Home <Desktop>/);
  assert.match(html, /https:\/\/example\.test\/\?q=&lt;bad&gt;/);
  assert.match(html, /src="home-desktop\.png"/);
  assert.match(html, /src="home-mobile\.png"/);
  assert.match(html, /src="demo%20video\.mp4"/);
  assert.match(html, /2 captures/);
});

test('writeHtmlReport writes report.html beside local assets', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'snapcrawl-report-'));
  fs.writeFileSync(path.join(dir, 'capture.png'), 'png-data');

  const reportPath = writeHtmlReport({
    outputDir: dir,
    projectName: 'Local Report',
    captures: [{ name: 'Capture', file: 'capture.png', size: '1200x627' }],
  });

  assert.equal(reportPath, path.join(dir, 'report.html'));
  const html = fs.readFileSync(reportPath, 'utf8');
  assert.match(html, /Local Report/);
  assert.match(html, /capture\.png/);
});
