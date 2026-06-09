const fs = require('fs');
const path = require('path');

function buildAnalysisPrompt(capture = {}) {
  return [
    'You are reviewing a website screenshot for UI quality, accessibility, and visual regressions.',
    'Return strict JSON with this shape: {"summary":"...","findings":[{"severity":"low|medium|high","category":"layout|mobile|contrast|content|interaction|accessibility|performance","title":"...","description":"...","recommendation":"...","ownerHint":"design|frontend|content|qa"}]}.',
    'Look for overlapping elements, clipped text, missing images, unreadable contrast, broken responsive layout, confusing empty states, and likely WCAG issues.',
    'Make recommendations concrete enough for a developer or designer to act on during review.',
    `Capture file: ${capture.file || 'unknown'}`,
    capture.url ? `Page URL: ${capture.url}` : '',
  ].filter(Boolean).join('\n');
}

function mimeFor(filePath) {
  if (/\.jpe?g$/i.test(filePath)) return 'image/jpeg';
  if (/\.webp$/i.test(filePath)) return 'image/webp';
  return 'image/png';
}

function buildOpenAIRequest({ model = 'gpt-4.1-mini', capture = {}, screenshotPath }) {
  const image = fs.readFileSync(screenshotPath).toString('base64');
  return {
    model,
    temperature: 0.1,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: buildAnalysisPrompt(capture) },
          {
            type: 'image_url',
            image_url: { url: `data:${mimeFor(screenshotPath)};base64,${image}` },
          },
        ],
      },
    ],
  };
}

function parseJsonResult(rawText) {
  try {
    return JSON.parse(rawText);
  } catch {
    return {
      summary: rawText || '',
      findings: [],
    };
  }
}

function normalizeSeverity(value) {
  const severity = String(value || 'medium').toLowerCase();
  return ['low', 'medium', 'high'].includes(severity) ? severity : 'medium';
}

function normalizeCategory(value) {
  const category = String(value || 'layout').toLowerCase();
  return [
    'layout',
    'mobile',
    'contrast',
    'content',
    'interaction',
    'accessibility',
    'performance',
  ].includes(category) ? category : 'layout';
}

function normalizeAnalysisResult({ capture = {}, rawText = '' }) {
  const parsed = parseJsonResult(rawText);
  const findings = Array.isArray(parsed.findings) ? parsed.findings : [];
  return {
    file: capture.file,
    url: capture.url,
    summary: String(parsed.summary || ''),
    findings: findings.map((finding) => ({
      file: capture.file,
      url: capture.url,
      severity: normalizeSeverity(finding.severity),
      category: normalizeCategory(finding.category),
      title: String(finding.title || 'UI finding'),
      description: String(finding.description || ''),
      recommendation: String(finding.recommendation || ''),
      ownerHint: String(finding.ownerHint || ''),
    })),
    rawText,
  };
}

async function analyzeCaptureWithOpenAI({ apiKey, model, capture, screenshotPath, fetchImpl = fetch }) {
  if (!apiKey) throw new Error('OPENAI_API_KEY is required for --ai-analyze');
  const response = await fetchImpl('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(buildOpenAIRequest({ model, capture, screenshotPath })),
  });
  if (!response.ok) {
    throw new Error(`AI analysis failed: ${response.status} ${response.statusText}`);
  }
  const json = await response.json();
  const rawText = json.choices && json.choices[0] && json.choices[0].message
    ? json.choices[0].message.content
    : '';
  return normalizeAnalysisResult({ capture, rawText });
}

async function analyzeCaptures(options = {}) {
  const outputDir = options.outputDir || process.cwd();
  const captures = options.captures || [];
  const limit = Math.max(1, Number(options.limit || captures.length || 1));
  const results = [];
  for (const capture of captures.slice(0, limit)) {
    const file = capture.file || capture.path || capture.screenshotPath;
    if (!file || !/\.(png|jpe?g|webp)$/i.test(file)) continue;
    const screenshotPath = path.isAbsolute(file) ? file : path.join(outputDir, file);
    if (!fs.existsSync(screenshotPath)) continue;
    results.push(await analyzeCaptureWithOpenAI({
      apiKey: options.apiKey || process.env.OPENAI_API_KEY,
      model: options.model,
      capture,
      screenshotPath,
      fetchImpl: options.fetchImpl,
    }));
  }
  return writeAnalysisReport({ outputDir, results });
}

function writeAnalysisReport({ outputDir, results = [] }) {
  const reportPath = path.join(outputDir, 'analysis.json');
  const findings = results.flatMap((result) => result.findings || []);
  const report = {
    version: 1,
    generatedAt: new Date().toISOString(),
    results,
    findings,
  };
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n', 'utf8');
  return reportPath;
}

module.exports = {
  analyzeCaptures,
  analyzeCaptureWithOpenAI,
  buildAnalysisPrompt,
  buildOpenAIRequest,
  normalizeAnalysisResult,
  writeAnalysisReport,
};
