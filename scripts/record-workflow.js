#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

let ffmpegStaticPath = null;
try {
  ffmpegStaticPath = require('ffmpeg-static');
} catch {
  ffmpegStaticPath = null;
}

const {
  launchBrowser,
  ensureDir,
  resolveUrl,
  sanitizeSegment,
  slugForUrl,
  compilePatterns,
  normalizeHref,
  sleep,
  runStep,
  collectPageLinks,
  deepMerge,
} = require('../lib/shared');

const DEFAULT_CONFIG = {
  projectName: 'Universal Workflow Recorder',
  baseUrl: 'http://localhost:3000/',
  outputDir: 'output/workflow-recorder',
  browser: 'chromium',
  headless: true,
  waitUntil: 'domcontentloaded',
  viewport: {
    width: 1512,
    height: 982,
  },
  recording: {
    width: 1920,
    height: 1080,
    keepRawVideo: false,
  },
  crawl: {
    enabled: true,
    maxPages: 35,
    maxDepth: 4,
    sameOrigin: true,
    includeQuery: false,
    waitAfterLoadMs: 500,
    includePatterns: [],
    excludePatterns: ['/logout', '/signout', '/sign-out', '/delete', '/remove', '/destroy'],
  },
  workflow: {
    enabled: true,
    includeHoverSweep: true,
    scrollPerPage: true,
    scrollSteps: 4,
    perPagePauseMs: 500,
    actionPauseMs: 450,
    interactionLimitPerPage: 6,
    allowRiskyActions: false,
  },
  setupSteps: [],
};

const RISKY_WORDS = [
  'delete',
  'remove',
  'logout',
  'log out',
  'sign out',
  'signout',
  'destroy',
  'pay',
  'purchase',
  'buy',
  'checkout',
  'confirm',
  'submit',
  'publish',
  'transfer',
  'send',
  'upgrade',
  'unsubscribe',
  'cancel subscription',
  'reset',
  'drop database',
  'erase',
];

/* ------------------------------------------------------------------ */
/*  CLI                                                                */
/* ------------------------------------------------------------------ */

function printHelp() {
  console.log(`
Usage: node record-workflow.js [options]

Record a polished MP4 demo video by crawling a website, performing smart
interactions (hover, scroll, click exploration), and capturing everything
via Playwright's video recording.

Options:
  --config <path>      Config file path (default: workflow-recorder.config.json)
  --output <dir>       Override outputDir from config
  --base-url <url>     Override baseUrl from config
  --headful            Show the browser window during recording
  --keep-raw-video     Keep the raw .webm file alongside the .mp4
  --help, -h           Show this help message
  `.trim());
}

function parseArgs(argv) {
  const args = {
    config: 'workflow-recorder.config.json',
    output: null,
    baseUrl: null,
    headful: false,
    keepRawVideo: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }

    if (arg === '--config' && argv[i + 1]) {
      args.config = argv[i + 1];
      i += 1;
      continue;
    }

    if (arg === '--output' && argv[i + 1]) {
      args.output = argv[i + 1];
      i += 1;
      continue;
    }

    if (arg === '--base-url' && argv[i + 1]) {
      args.baseUrl = argv[i + 1];
      i += 1;
      continue;
    }

    if (arg === '--headful') {
      args.headful = true;
      continue;
    }

    if (arg === '--keep-raw-video') {
      args.keepRawVideo = true;
      continue;
    }
  }

  return args;
}

/* ------------------------------------------------------------------ */
/*  Risky-action filter                                                */
/* ------------------------------------------------------------------ */

function looksRisky(label) {
  const normalized = String(label || '').toLowerCase();
  return RISKY_WORDS.some((word) => normalized.includes(word));
}

/* ------------------------------------------------------------------ */
/*  Workflow interactions                                               */
/* ------------------------------------------------------------------ */

async function scrollShowcase(page, config) {
  if (!config.workflow.scrollPerPage) return;

  const steps = Math.max(1, Number(config.workflow.scrollSteps || 4));
  const pause = Number(config.workflow.actionPauseMs || 400);

  const totalHeight = await page.evaluate(() =>
    Math.max(document.body.scrollHeight, document.documentElement.scrollHeight)
  );
  const viewportHeight = page.viewportSize() ? page.viewportSize().height : 900;
  const maxY = Math.max(0, totalHeight - viewportHeight);

  for (let i = 1; i <= steps; i += 1) {
    const y = Math.round((i / steps) * maxY);
    await page.evaluate(
      (value) => window.scrollTo({ top: value, left: 0, behavior: 'smooth' }),
      y
    );
    await sleep(pause);
  }

  await page.evaluate(() => window.scrollTo({ top: 0, left: 0, behavior: 'smooth' }));
  await sleep(pause);
}

async function hoverSweep(page, config) {
  if (!config.workflow.includeHoverSweep) return;

  const points = await page.evaluate(() => {
    const nodes = Array.from(
      document.querySelectorAll('a, button, [role="button"], input, textarea, [role="tab"]')
    );

    return nodes
      .slice(0, 18)
      .map((el) => {
        const r = el.getBoundingClientRect();
        if (r.width < 8 || r.height < 8) return null;
        return {
          x: Math.round(r.left + r.width / 2),
          y: Math.round(r.top + r.height / 2),
          inView:
            r.bottom > 0 &&
            r.right > 0 &&
            r.left < window.innerWidth &&
            r.top < window.innerHeight,
        };
      })
      .filter(Boolean)
      .filter((item) => item.inView);
  });

  for (const point of points) {
    await page.mouse.move(point.x, point.y, { steps: 8 });
    await sleep(110);
  }
}

async function candidateInteractions(page) {
  return page.evaluate(() => {
    const selectors =
      'button, [role="button"], [role="tab"], [aria-expanded], details summary, [data-testid], [data-test]';
    const nodes = Array.from(document.querySelectorAll(selectors));

    const values = [];

    for (let idx = 0; idx < nodes.length; idx += 1) {
      const node = nodes[idx];
      const rect = node.getBoundingClientRect();
      if (rect.width < 10 || rect.height < 10) continue;
      if (rect.bottom <= 0 || rect.right <= 0) continue;
      if (rect.left >= window.innerWidth || rect.top >= window.innerHeight) continue;

      const text = (
        node.innerText ||
        node.getAttribute('aria-label') ||
        node.getAttribute('title') ||
        ''
      ).trim();

      values.push({
        index: idx,
        x: Math.round(rect.left + rect.width / 2),
        y: Math.round(rect.top + rect.height / 2),
        text,
      });

      if (values.length >= 40) break;
    }

    return values;
  });
}

async function clickByPoint(page, point, actionPauseMs) {
  await page.mouse.move(point.x, point.y, { steps: 10 });
  await sleep(120);
  await page.mouse.click(point.x, point.y, { delay: 50 });
  await sleep(actionPauseMs);
}

async function exploreInteractionsOnPage(page, config, pageUrl) {
  if (!config.workflow.enabled) return [];

  const visitedActions = [];
  const cap = Math.max(0, Number(config.workflow.interactionLimitPerPage || 6));
  if (cap === 0) return visitedActions;

  const actionPauseMs = Number(config.workflow.actionPauseMs || 400);
  const allowRisky = Boolean(config.workflow.allowRiskyActions);
  const beforeUrl = page.url();

  let candidates = [];

  try {
    candidates = await candidateInteractions(page);
  } catch {
    return visitedActions;
  }

  for (const point of candidates) {
    if (visitedActions.length >= cap) break;

    const label = (point.text || '').slice(0, 160);
    if (!allowRisky && looksRisky(label)) {
      continue;
    }

    try {
      await clickByPoint(page, point, actionPauseMs);

      const afterUrl = page.url();
      const changedUrl = afterUrl !== beforeUrl;

      visitedActions.push({
        action: 'click',
        label,
        page: pageUrl,
        navigated: changedUrl,
      });

      if (changedUrl) {
        await page.goBack({ waitUntil: config.waitUntil || 'domcontentloaded' }).catch(() => null);
        await sleep(actionPauseMs);
      }
    } catch {
      // Continue exploring; workflow discovery should be resilient.
    }
  }

  return visitedActions;
}

/* ------------------------------------------------------------------ */
/*  Crawler                                                            */
/* ------------------------------------------------------------------ */

async function crawlSite(page, config, rootHref) {
  const crawl = config.crawl || {};
  const maxPages = Math.max(1, Number(crawl.maxPages || 30));
  const maxDepth = Math.max(0, Number(crawl.maxDepth || 4));
  const sameOrigin = crawl.sameOrigin !== false;
  const includeQuery = Boolean(crawl.includeQuery);
  const waitAfterLoadMs = Number(crawl.waitAfterLoadMs || 400);

  const includePatterns = compilePatterns(crawl.includePatterns);
  const excludePatterns = compilePatterns(crawl.excludePatterns);

  await page.goto(rootHref, { waitUntil: config.waitUntil || 'domcontentloaded' });
  if (waitAfterLoadMs > 0) {
    await page.waitForTimeout(waitAfterLoadMs);
  }

  const rootUrl = new URL(page.url());
  const queue = [{ href: rootUrl.href, depth: 0 }];
  const enqueued = new Set([rootUrl.href]);
  const visited = [];
  const visitedSet = new Set();
  const actionLog = [];

  while (queue.length > 0 && visited.length < maxPages) {
    const current = queue.shift();
    if (!current || visitedSet.has(current.href)) continue;

    try {
      await page.goto(current.href, { waitUntil: config.waitUntil || 'domcontentloaded' });
      await sleep(waitAfterLoadMs);
    } catch {
      continue;
    }

    visitedSet.add(current.href);
    visited.push({ url: current.href, depth: current.depth });
    console.log(`  [visit] ${current.href}`);

    await hoverSweep(page, config);
    await scrollShowcase(page, config);

    const pageActions = await exploreInteractionsOnPage(page, config, current.href);
    actionLog.push(...pageActions);

    await sleep(Number(config.workflow.perPagePauseMs || 450));

    if (current.depth >= maxDepth) {
      continue;
    }

    let hrefs = [];
    try {
      hrefs = await collectPageLinks(page);
    } catch {
      hrefs = [];
    }

    for (const href of hrefs) {
      const normalized = normalizeHref(href, current.href, rootUrl, {
        sameOrigin,
        includeQuery,
        includePatterns,
        excludePatterns,
      });

      if (!normalized) continue;
      if (visitedSet.has(normalized) || enqueued.has(normalized)) continue;

      enqueued.add(normalized);
      queue.push({ href: normalized, depth: current.depth + 1 });
    }
  }

  return { visited, actionLog };
}

/* ------------------------------------------------------------------ */
/*  FFmpeg conversion                                                  */
/* ------------------------------------------------------------------ */

function resolveFfmpegBinary() {
  if (process.env.FFMPEG_BIN) {
    return process.env.FFMPEG_BIN;
  }

  if (ffmpegStaticPath) {
    return ffmpegStaticPath;
  }

  const check = spawnSync('ffmpeg', ['-version'], { encoding: 'utf8' });
  if (check.status === 0) {
    return 'ffmpeg';
  }

  throw new Error('FFmpeg not found. Install ffmpeg or add ffmpeg-static.');
}

function convertWebmToMp4(sourceWebmPath, targetMp4Path) {
  const ffmpegBinary = resolveFfmpegBinary();

  const result = spawnSync(
    ffmpegBinary,
    [
      '-y',
      '-i', sourceWebmPath,
      '-map', '0:v:0',
      '-map', '0:a?',
      '-c:v', 'libx264',
      '-preset', 'medium',
      '-crf', '22',
      '-pix_fmt', 'yuv420p',
      '-movflags', '+faststart',
      '-c:a', 'aac',
      '-b:a', '160k',
      targetMp4Path,
    ],
    { encoding: 'utf8' }
  );

  if (result.status !== 0) {
    throw new Error(`FFmpeg conversion failed: ${result.stderr || result.stdout || 'unknown error'}`);
  }
}

/* ------------------------------------------------------------------ */
/*  Report                                                             */
/* ------------------------------------------------------------------ */

function reportMarkdown(config, crawlResult, outputMp4Path, startedAt, endedAt, rootHref) {
  const lines = [];
  lines.push(`# ${config.projectName || 'Workflow Recorder'} Run`);
  lines.push('');
  lines.push(`- Started: ${startedAt.toISOString()}`);
  lines.push(`- Finished: ${endedAt.toISOString()}`);
  lines.push(`- Base URL: ${rootHref}`);
  lines.push(`- Pages visited: ${crawlResult.visited.length}`);
  lines.push(`- Smart interactions: ${crawlResult.actionLog.length}`);
  lines.push(`- MP4 output: \`${outputMp4Path}\``);
  lines.push('');
  lines.push('## Visited Pages');

  crawlResult.visited.forEach((item, idx) => {
    lines.push(`${idx + 1}. ${item.url}`);
  });

  lines.push('');
  lines.push('## Interaction Highlights');
  if (crawlResult.actionLog.length === 0) {
    lines.push('- No clickable candidates were safely executed on this run.');
  } else {
    for (const entry of crawlResult.actionLog.slice(0, 80)) {
      const label = entry.label ? ` :: ${entry.label}` : '';
      lines.push(`- ${entry.page}${label}`);
    }
  }

  lines.push('');
  lines.push('## Re-run');
  lines.push('```bash');
  lines.push('npm run workflow:record');
  lines.push('```');
  lines.push('');

  return `${lines.join('\n')}\n`;
}

/* ------------------------------------------------------------------ */
/*  Main                                                               */
/* ------------------------------------------------------------------ */

async function main() {
  const startedAt = new Date();
  const args = parseArgs(process.argv.slice(2));
  const cwd = process.cwd();

  const configPath = path.resolve(cwd, args.config);
  if (!fs.existsSync(configPath)) {
    throw new Error(`Config file not found: ${configPath}`);
  }

  const loadedConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const config = deepMerge(DEFAULT_CONFIG, loadedConfig);

  if (args.baseUrl) config.baseUrl = args.baseUrl;
  if (args.output) config.outputDir = args.output;
  if (args.headful) config.headless = false;
  if (args.keepRawVideo) config.recording.keepRawVideo = true;

  if (!config.baseUrl) {
    throw new Error('Config requires `baseUrl`.');
  }

  const outputDir = path.resolve(cwd, config.outputDir || DEFAULT_CONFIG.outputDir);
  const artifactsDir = path.join(outputDir, 'artifacts');
  ensureDir(outputDir);
  ensureDir(artifactsDir);

  const recordingDir = fs.mkdtempSync(path.join(os.tmpdir(), 'workflow-recorder-'));

  const browser = await launchBrowser(config);

  const context = await browser.newContext({
    viewport: {
      width: Number(config.viewport.width || 1512),
      height: Number(config.viewport.height || 982),
    },
    recordVideo: {
      dir: recordingDir,
      size: {
        width: Number(config.recording.width || 1920),
        height: Number(config.recording.height || 1080),
      },
    },
  });

  const page = await context.newPage();
  const rootHref = resolveUrl(config.baseUrl, cwd);

  console.log(`\nRecording: ${config.projectName || 'workflow'}`);
  console.log(`  URL: ${rootHref}`);
  console.log('');

  await page.goto(rootHref, { waitUntil: config.waitUntil || 'domcontentloaded' });

  for (const step of config.setupSteps || []) {
    await runStep(page, step);
  }

  const crawlResult =
    config.crawl && config.crawl.enabled !== false
      ? await crawlSite(page, config, page.url())
      : { visited: [{ url: page.url(), depth: 0 }], actionLog: [] };

  await sleep(600);

  // FIX BUG #1: Capture video path BEFORE closing context.
  // Playwright finalises the video file on context close, but the path
  // must be read while the page object is still alive.
  const rawVideoPath = await page.video().path();

  await context.close();
  await browser.close();

  const baseName = `${sanitizeSegment(config.projectName || 'workflow') || 'workflow'}-${slugForUrl(rootHref)}`;
  const mp4Path = path.join(outputDir, `${baseName}.mp4`);

  console.log('\nConverting to MP4...');
  convertWebmToMp4(rawVideoPath, mp4Path);

  if (config.recording.keepRawVideo) {
    const rawTarget = path.join(outputDir, `${baseName}.webm`);
    fs.copyFileSync(rawVideoPath, rawTarget);
  }

  const endedAt = new Date();
  const reportPath = path.join(artifactsDir, 'WORKFLOW_REPORT.md');
  fs.writeFileSync(
    reportPath,
    reportMarkdown(config, crawlResult, path.relative(cwd, mp4Path), startedAt, endedAt, rootHref),
    'utf8'
  );

  const crawlJsonPath = path.join(artifactsDir, 'crawl.json');
  fs.writeFileSync(crawlJsonPath, JSON.stringify(crawlResult, null, 2) + '\n', 'utf8');

  console.log(`\nDone! Output files:`);
  console.log(`  Video:    ${path.relative(cwd, mp4Path)}`);
  console.log(`  Report:   ${path.relative(cwd, reportPath)}`);
  console.log(`  Crawl:    ${path.relative(cwd, crawlJsonPath)}`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
