const fs = require("fs");
const path = require("path");
const { chromium, firefox, webkit } = require("playwright");

function parseArgs(argv) {
  const args = { config: "capture-config.json", workflow: true };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--config" && argv[i + 1]) {
      args.config = argv[i + 1];
      i += 1;
    } else if (arg === "--no-workflow") {
      args.workflow = false;
    }
  }
  return args;
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function resolveUrl(inputUrl, cwd) {
  const expanded = inputUrl.replace(/\$\{cwd\}/g, cwd);
  if (expanded.startsWith("http://") || expanded.startsWith("https://") || expanded.startsWith("file://")) {
    return expanded;
  }
  return `file://${path.resolve(cwd, expanded).replace(/ /g, "%20")}`;
}

function getBrowser(name) {
  if (name === "firefox") return firefox;
  if (name === "webkit") return webkit;
  return chromium;
}

function compilePatterns(patterns) {
  if (!Array.isArray(patterns)) return [];
  return patterns
    .filter(Boolean)
    .map((p) => {
      try {
        return new RegExp(p);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function passesPatterns(text, includePatterns, excludePatterns) {
  if (includePatterns.length > 0 && !includePatterns.some((r) => r.test(text))) {
    return false;
  }
  if (excludePatterns.some((r) => r.test(text))) {
    return false;
  }
  return true;
}

function extension(pathname) {
  const match = pathname.toLowerCase().match(/\.([a-z0-9]+)$/);
  return match ? match[1] : "";
}

function isLikelyHtml(urlObj) {
  const nonHtml = new Set([
    "png",
    "jpg",
    "jpeg",
    "gif",
    "webp",
    "svg",
    "ico",
    "pdf",
    "zip",
    "css",
    "js",
    "mjs",
    "json",
    "xml",
    "txt",
    "woff",
    "woff2",
    "ttf",
    "eot",
    "mp4",
    "webm",
    "mp3",
    "wav",
  ]);
  const ext = extension(urlObj.pathname);
  return !ext || !nonHtml.has(ext);
}

function normalizeForQueue(rawHref, currentUrl, rootUrl, options) {
  if (!rawHref) return null;
  const href = rawHref.trim();
  if (!href || href.startsWith("#")) return null;
  if (href.startsWith("javascript:") || href.startsWith("mailto:") || href.startsWith("tel:")) return null;

  let candidate;
  try {
    candidate = new URL(href, currentUrl);
  } catch {
    return null;
  }

  if (!["http:", "https:", "file:"].includes(candidate.protocol)) return null;

  if (options.sameOrigin) {
    if (candidate.protocol === "file:" && rootUrl.protocol === "file:") {
      const rootDir = path.dirname(decodeURIComponent(rootUrl.pathname));
      const candPath = decodeURIComponent(candidate.pathname);
      if (!candPath.startsWith(rootDir)) return null;
    } else if (candidate.origin !== rootUrl.origin) {
      return null;
    }
  }

  if (!options.includeQuery) {
    candidate.search = "";
  }
  candidate.hash = "";

  if (!isLikelyHtml(candidate)) return null;

  const hrefToCheck = candidate.href;
  if (!passesPatterns(hrefToCheck, options.includePatterns, options.excludePatterns)) {
    return null;
  }

  return hrefToCheck;
}

function safeSegment(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function buildPageSlug(urlObj) {
  const segments = urlObj.pathname
    .split("/")
    .map((s) => safeSegment(s))
    .filter(Boolean);
  const base = segments.length > 0 ? segments.join("-") : "home";
  if (!urlObj.search) return base;
  const querySlug = safeSegment(urlObj.search.replace(/^\?/, ""));
  return querySlug ? `${base}-${querySlug}` : base;
}

function pad(n, width) {
  return String(n).padStart(width, "0");
}

function defaultViewportSet() {
  return [
    { name: "desktop-full", width: 1440, height: 1800, fullPage: true },
    { name: "social-1200x627", width: 1200, height: 627, fullPage: false },
    { name: "mobile", width: 430, height: 932, fullPage: false },
  ];
}

async function runStep(page, step) {
  if (step.type === "call") {
    await page.evaluate(({ fn, args }) => {
      if (typeof window[fn] !== "function") throw new Error(`Function not found: ${fn}`);
      window[fn](...(args || []));
    }, step);
    return;
  }

  if (step.type === "setById") {
    await page.evaluate((s) => {
      const el = document.getElementById(s.id);
      if (!el) throw new Error(`Element not found by id: ${s.id}`);
      if (el.type === "checkbox") {
        el.checked = Boolean(s.value);
      } else {
        el.value = String(s.value);
      }
      if (s.triggerFn) {
        if (typeof window[s.triggerFn] !== "function") throw new Error(`Trigger function not found: ${s.triggerFn}`);
        window[s.triggerFn](el);
      } else if (s.dispatchEvent) {
        el.dispatchEvent(new Event(s.dispatchEvent, { bubbles: true }));
      }
    }, step);
    return;
  }

  if (step.type === "fill") {
    await page.fill(step.selector, String(step.value ?? ""));
    return;
  }

  if (step.type === "check") {
    if (step.value === false) {
      await page.uncheck(step.selector);
    } else {
      await page.check(step.selector);
    }
    return;
  }

  if (step.type === "click") {
    await page.click(step.selector);
    return;
  }

  if (step.type === "scroll") {
    const x = Number(step.x || 0);
    const y = Number(step.y || 0);
    await page.evaluate(({ sx, sy }) => window.scrollTo(sx, sy), { sx: x, sy: y });
    return;
  }

  if (step.type === "evaluate") {
    await page.evaluate(step.script);
    return;
  }

  if (step.type === "wait") {
    await page.waitForTimeout(Number(step.ms || 200));
    return;
  }

  if (step.type === "waitForSelector") {
    await page.waitForSelector(step.selector, { timeout: Number(step.timeoutMs || 10000) });
    return;
  }

  throw new Error(`Unsupported step type: ${step.type}`);
}

async function collectLinks(page) {
  return page.$$eval("a[href]", (anchors) => anchors.map((a) => a.getAttribute("href")).filter(Boolean));
}

async function captureScenarioMode(page, config, outputDir, cwd) {
  const captures = [];

  for (const scenario of config.scenarios) {
    if (!scenario.file) throw new Error("Each scenario requires a file");
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
      mode: "scenario",
      name: scenario.name || scenario.file,
      file: scenario.file,
      size: `${scenario.viewport.width}x${scenario.viewport.height}`,
    });
    console.log(path.relative(cwd, outPath));
  }

  return captures;
}

async function captureCrawlMode(page, config, outputDir, cwd) {
  const crawl = config.crawl || {};
  const waitUntil = config.waitUntil || "load";
  const waitAfterLoadMs = Number(crawl.waitAfterLoadMs || 200);
  const maxPages = Number(crawl.maxPages || 40);
  const maxDepth = Number(crawl.maxDepth || 4);
  const includeQuery = Boolean(crawl.includeQuery);
  const sameOrigin = crawl.sameOrigin !== false;
  const includePatterns = compilePatterns(crawl.includePatterns);
  const excludePatterns = compilePatterns(crawl.excludePatterns);
  const rawViewports = Array.isArray(crawl.viewports) && crawl.viewports.length > 0 ? crawl.viewports : defaultViewportSet();
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
      console.warn(`Skipping (navigation failed): ${current.href} :: ${error.message}`);
      continue;
    }

    const currentUrl = new URL(current.href);
    const pageSlug = buildPageSlug(currentUrl);

    for (const vp of viewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });

      const file = `${pad(fileCounter, 3)}-${pageSlug}-${safeSegment(vp.name) || "view"}.png`;
      const outPath = path.join(outputDir, file);
      await page.screenshot({ path: outPath, fullPage: vp.fullPage });

      captures.push({
        mode: "crawl",
        name: `${current.href} [${vp.name}]`,
        file,
        size: `${vp.width}x${vp.height}`,
        url: current.href,
      });
      fileCounter += 1;
      console.log(path.relative(cwd, outPath));
    }

    if (current.depth >= maxDepth) {
      continue;
    }

    const hrefs = await collectLinks(page);
    for (const rawHref of hrefs) {
      const normalized = normalizeForQueue(rawHref, current.href, rootUrl, {
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

function workflowContent(config, captures, mode) {
  const lines = [];
  lines.push(`# ${config.projectName || "Capture"} Workflow`);
  lines.push("");
  lines.push(`Mode: ${mode}`);
  lines.push("");
  lines.push("## Files Generated");
  for (const c of captures) {
    lines.push(`- \`${c.file}\` (${c.size})`);
  }
  lines.push("");
  lines.push("## Capture Sequence");
  captures.forEach((c, i) => {
    if (c.url) {
      lines.push(`${i + 1}. ${c.name}`);
    } else {
      lines.push(`${i + 1}. ${c.name}`);
    }
  });
  lines.push("");
  lines.push("## Recreate");
  lines.push("Run from project root:");
  lines.push("");
  lines.push("```bash");
  lines.push(`node scripts/capture-from-config.js --config ${config._configFile}`);
  lines.push("```");
  lines.push("");
  lines.push("## Notes");
  lines.push("- Update only `capture-config.json` to reuse in other projects.");
  lines.push("- Crawl mode auto-discovers internal links from `baseUrl`.");
  lines.push("- Scenario mode runs your explicit sequence for each screenshot.");
  return `${lines.join("\n")}\n`;
}

function requireFields(config) {
  if (!config.baseUrl) throw new Error("Config missing required field: baseUrl");

  const crawlEnabled = Boolean(config.crawl && config.crawl.enabled);
  const scenariosOk = Array.isArray(config.scenarios) && config.scenarios.length > 0;

  if (!crawlEnabled && !scenariosOk) {
    throw new Error("Config requires at least one scenario, or set crawl.enabled=true");
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const cwd = process.cwd();
  const configPath = path.resolve(cwd, args.config);
  const raw = fs.readFileSync(configPath, "utf8");
  const config = JSON.parse(raw);
  config._configFile = path.relative(cwd, configPath);

  requireFields(config);

  const browserType = getBrowser(config.browser || "chromium");
  const browser = await browserType.launch({ headless: config.headless !== false });
  const page = await browser.newPage();

  const outputDir = path.resolve(cwd, config.outputDir || "output/social");
  ensureDir(outputDir);

  const crawlEnabled = Boolean(config.crawl && config.crawl.enabled);
  const mode = crawlEnabled ? "crawl" : "scenarios";

  if (!crawlEnabled) {
    const url = resolveUrl(config.baseUrl, cwd);
    await page.goto(url, { waitUntil: config.waitUntil || "load" });
  }

  const captures = crawlEnabled
    ? await captureCrawlMode(page, config, outputDir, cwd)
    : await captureScenarioMode(page, config, outputDir, cwd);

  if (args.workflow) {
    const workflowPath = path.join(outputDir, "WORKFLOW.md");
    fs.writeFileSync(workflowPath, workflowContent(config, captures, mode), "utf8");
    console.log(path.relative(cwd, workflowPath));
  }

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
