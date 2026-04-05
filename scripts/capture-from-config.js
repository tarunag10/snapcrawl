#!/usr/bin/env node

/* Route `snapcrawl init` to the interactive scaffolder */
if (process.argv.includes('init')) {
  require('./create-snapcrawl')().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
  /* prevent the rest of the script from executing */
  return;
}

const fs = require('fs');
const path = require('path');

const {
  launchBrowser,
  ensureDir,
  resolveUrl,
  sanitizeSegment,
  compilePatterns,
  normalizeHref,
  runStep,
  collectPageLinks,
  buildPageSlug,
  pad,
} = require('../lib/shared');

/* ------------------------------------------------------------------ */
/*  CLI                                                                */
/* ------------------------------------------------------------------ */

function printHelp() {
  console.log(`
Usage: node capture-from-config.js [options]

Crawl a website (or run manual scenarios) and capture multi-viewport
screenshots (desktop, mobile, tablet).

Options:
  --config <path>   Config file path (default: capture-config.json)
  --no-workflow     Skip generating the WORKFLOW.md report
  --help, -h        Show this help message
  `.trim());
}

function parseArgs(argv) {
  const args = { config: 'capture-config.json', workflow: true };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    } else if (arg === '--config' && argv[i + 1]) {
      args.config = argv[i + 1];
      i += 1;
    } else if (arg === '--no-workflow') {
      args.workflow = false;
    }
  }
  return args;
}

/* ------------------------------------------------------------------ */
/*  Defaults                                                           */
/* ------------------------------------------------------------------ */

function defaultViewportSet() {
  return [
    { name: 'desktop-full', width: 1440, height: 1800, fullPage: true },
    { name: 'social-1200x627', width: 1200, height: 627, fullPage: false },
    { name: 'mobile', width: 430, height: 932, fullPage: false },
  ];
}

/* ------------------------------------------------------------------ */
/*  Scenario mode                                                      */
/* ------------------------------------------------------------------ */

async function captureScenarioMode(page, config, outputDir, cwd) {
  const captures = [];

  for (const scenario of config.scenarios) {
    if (!scenario.file) throw new Error('Each scenario requires a file');
    if (!scenario.viewport || !scenario.viewport.width || !scenario.viewport.height) {
      throw new Error(`Scenario ${scenario.file} is missing viewport width/height`);
    }

    await page.setViewportSize({
      width: Number(scenario.viewport.width),
      height: Number(scenario.viewport.height),
    });

    const steps = scenario.steps || [];
    for (const step of steps) {
      await runStep(page, step);
    }

    const outPath = path.join(outputDir, scenario.file);
    await page.screenshot({
      path: outPath,
      fullPage: Boolean(scenario.fullPage),
    });

    captures.push({
      mode: 'scenario',
      name: scenario.name || scenario.file,
      file: scenario.file,
      size: `${scenario.viewport.width}x${scenario.viewport.height}`,
    });
    console.log(`  ${path.relative(cwd, outPath)}`);
  }

  return captures;
}

/* ------------------------------------------------------------------ */
/*  Crawl mode                                                         */
/* ------------------------------------------------------------------ */

async function captureCrawlMode(page, config, outputDir, cwd) {
  const crawl = config.crawl || {};
  const waitUntil = config.waitUntil || 'load';
  const waitAfterLoadMs = Number(crawl.waitAfterLoadMs || 200);
  const maxPages = Number(crawl.maxPages || 40);
  const maxDepth = Number(crawl.maxDepth || 4);
  const includeQuery = Boolean(crawl.includeQuery);
  const sameOrigin = crawl.sameOrigin !== false;
  const includePatterns = compilePatterns(crawl.includePatterns);
  const excludePatterns = compilePatterns(crawl.excludePatterns);
  const rawViewports =
    Array.isArray(crawl.viewports) && crawl.viewports.length > 0
      ? crawl.viewports
      : defaultViewportSet();
  const viewports = rawViewports.map((v, index) => ({
    name: v.name || `view-${index + 1}`,
    width: Number(v.width || 1440),
    height: Number(v.height || 900),
    fullPage: Boolean(v.fullPage),
  }));

  const rootHref = resolveUrl(config.baseUrl, cwd);
  await page.goto(rootHref, { waitUntil });
  const initialSteps = Array.isArray(crawl.initialSteps) ? crawl.initialSteps : [];
  for (const step of initialSteps) {
    await runStep(page, step);
  }
  if (waitAfterLoadMs > 0) {
    await page.waitForTimeout(waitAfterLoadMs);
  }

  const startHref = page.url();
  const rootUrl = new URL(startHref);

  const queue = [{ href: rootUrl.href, depth: 0 }];
  const enqueued = new Set([rootUrl.href]);
  const visited = new Set();
  const captures = [];
  let fileCounter = 1;

  while (queue.length > 0 && visited.size < maxPages) {
    const current = queue.shift();
    if (!current || visited.has(current.href)) continue;

    visited.add(current.href);

    try {
      await page.goto(current.href, { waitUntil });
      if (waitAfterLoadMs > 0) {
        await page.waitForTimeout(waitAfterLoadMs);
      }
    } catch (error) {
      console.warn(`  Skipping (navigation failed): ${current.href} :: ${error.message}`);
      continue;
    }

    const currentUrl = new URL(current.href);
    const pageSlug = buildPageSlug(currentUrl);

    for (const vp of viewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });

      const file = `${pad(fileCounter, 3)}-${pageSlug}-${sanitizeSegment(vp.name) || 'view'}.png`;
      const outPath = path.join(outputDir, file);
      await page.screenshot({ path: outPath, fullPage: vp.fullPage });

      captures.push({
        mode: 'crawl',
        name: `${current.href} [${vp.name}]`,
        file,
        size: `${vp.width}x${vp.height}`,
        url: current.href,
      });
      fileCounter += 1;
      console.log(`  ${path.relative(cwd, outPath)}`);
    }

    if (current.depth >= maxDepth) {
      continue;
    }

    const hrefs = await collectPageLinks(page);
    for (const rawHref of hrefs) {
      const normalized = normalizeHref(rawHref, current.href, rootUrl, {
        sameOrigin,
        includeQuery,
        includePatterns,
        excludePatterns,
      });

      if (!normalized) continue;
      if (visited.has(normalized) || enqueued.has(normalized)) continue;

      enqueued.add(normalized);
      queue.push({ href: normalized, depth: current.depth + 1 });
    }
  }

  return captures;
}

/* ------------------------------------------------------------------ */
/*  Report                                                             */
/* ------------------------------------------------------------------ */

function workflowContent(config, captures, mode) {
  const lines = [];
  lines.push(`# ${config.projectName || 'Capture'} Workflow`);
  lines.push('');
  lines.push(`Mode: ${mode}`);
  lines.push('');
  lines.push('## Files Generated');
  for (const c of captures) {
    lines.push(`- \`${c.file}\` (${c.size})`);
  }
  lines.push('');
  lines.push('## Capture Sequence');
  captures.forEach((c, i) => {
    const extra = c.url ? ` — ${c.url}` : '';
    lines.push(`${i + 1}. ${c.name}${extra}`);
  });
  lines.push('');
  lines.push('## Recreate');
  lines.push('Run from project root:');
  lines.push('');
  lines.push('```bash');
  lines.push(`node scripts/capture-from-config.js --config ${config._configFile}`);
  lines.push('```');
  lines.push('');
  lines.push('## Notes');
  lines.push('- Update only `capture-config.json` to reuse in other projects.');
  lines.push('- Crawl mode auto-discovers internal links from `baseUrl`.');
  lines.push('- Scenario mode runs your explicit sequence for each screenshot.');
  return `${lines.join('\n')}\n`;
}

/* ------------------------------------------------------------------ */
/*  Validation                                                         */
/* ------------------------------------------------------------------ */

function requireFields(config) {
  if (!config.baseUrl) throw new Error('Config missing required field: baseUrl');

  const crawlEnabled = Boolean(config.crawl && config.crawl.enabled);
  const scenariosOk = Array.isArray(config.scenarios) && config.scenarios.length > 0;

  if (!crawlEnabled && !scenariosOk) {
    throw new Error('Config requires at least one scenario, or set crawl.enabled=true');
  }
}

/* ------------------------------------------------------------------ */
/*  Main                                                               */
/* ------------------------------------------------------------------ */

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const cwd = process.cwd();
  const configPath = path.resolve(cwd, args.config);
  const raw = fs.readFileSync(configPath, 'utf8');
  const config = JSON.parse(raw);
  config._configFile = path.relative(cwd, configPath);

  requireFields(config);

  const browser = await launchBrowser(config);
  const page = await browser.newPage();

  const outputDir = path.resolve(cwd, config.outputDir || 'output/social');
  ensureDir(outputDir);

  const crawlEnabled = Boolean(config.crawl && config.crawl.enabled);
  const mode = crawlEnabled ? 'crawl' : 'scenarios';

  console.log(`\nCapturing: ${config.projectName || 'screenshots'}`);
  console.log(`  Mode: ${mode}`);
  console.log('');

  if (!crawlEnabled) {
    const url = resolveUrl(config.baseUrl, cwd);
    await page.goto(url, { waitUntil: config.waitUntil || 'load' });
  }

  const captures = crawlEnabled
    ? await captureCrawlMode(page, config, outputDir, cwd)
    : await captureScenarioMode(page, config, outputDir, cwd);

  if (args.workflow) {
    const workflowPath = path.join(outputDir, 'WORKFLOW.md');
    fs.writeFileSync(workflowPath, workflowContent(config, captures, mode), 'utf8');
    console.log(`  ${path.relative(cwd, workflowPath)}`);
  }

  await browser.close();

  console.log(`\nDone! ${captures.length} screenshot(s) captured.`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
