const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  buildAnalysisPrompt,
  buildOpenAIRequest,
  normalizeAnalysisResult,
  writeAnalysisReport,
} = require('../lib/ai-analysis');

test('buildOpenAIRequest creates a vision request without leaking local absolute paths', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'snapcrawl-ai-'));
  const screenshot = path.join(dir, 'home.png');
  fs.writeFileSync(screenshot, 'fake-image');

  const request = buildOpenAIRequest({
    model: 'gpt-4.1-mini',
    capture: { file: 'home.png', url: 'https://example.test/home' },
    screenshotPath: screenshot,
  });

  const serialized = JSON.stringify(request);
  assert.equal(request.model, 'gpt-4.1-mini');
  assert.match(serialized, /data:image\/png;base64/);
  assert.match(serialized, /https:\/\/example\.test\/home/);
  assert.doesNotMatch(serialized, new RegExp(dir.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});

test('normalizeAnalysisResult produces stable finding records from model JSON', () => {
  const result = normalizeAnalysisResult({
    capture: { file: 'home.png', url: 'https://example.test/' },
    rawText: JSON.stringify({
      summary: 'Dashboard page with layout issues.',
      findings: [
        { severity: 'high', title: 'Clipped CTA', description: 'Button text is clipped.' },
      ],
    }),
  });

  assert.equal(result.file, 'home.png');
  assert.equal(result.summary, 'Dashboard page with layout issues.');
  assert.deepEqual(result.findings, [
    {
      file: 'home.png',
      url: 'https://example.test/',
      severity: 'high',
      title: 'Clipped CTA',
      description: 'Button text is clipped.',
    },
  ]);
});

test('writeAnalysisReport persists summaries and flattened findings', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'snapcrawl-analysis-'));
  const output = writeAnalysisReport({
    outputDir: dir,
    results: [
      {
        file: 'home.png',
        summary: 'Home page',
        findings: [{ file: 'home.png', severity: 'medium', title: 'Low contrast', description: 'Text is faint.' }],
      },
    ],
  });

  const report = JSON.parse(fs.readFileSync(output, 'utf8'));
  assert.equal(report.results.length, 1);
  assert.equal(report.findings.length, 1);
  assert.match(buildAnalysisPrompt({ file: 'home.png' }), /accessibility/i);
});
