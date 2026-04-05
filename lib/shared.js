/**
 * Shared utilities for the screenshot/workflow-recorder toolkit.
 * Both record-workflow.js and capture-from-config.js import from here
 * so that bug-fixes and enhancements only need to happen once.
 */

const fs = require('fs');
const path = require('path');

/* ------------------------------------------------------------------ */
/*  Browser helpers                                                    */
/* ------------------------------------------------------------------ */

let _playwright;

function requirePlaywright() {
  if (_playwright) return _playwright;
  try {
    _playwright = require('playwright');
  } catch {
    console.error(
      'Playwright is not installed.\n' +
      'Run:  npm install --save-dev playwright\n' +
      'Then: npx playwright install chromium'
    );
    process.exit(1);
  }
  return _playwright;
}

function browserFromName(name) {
  const pw = requirePlaywright();
  if (name === 'firefox') return pw.firefox;
  if (name === 'webkit') return pw.webkit;
  return pw.chromium;
}

/* ------------------------------------------------------------------ */
/*  Filesystem                                                         */
/* ------------------------------------------------------------------ */

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

/* ------------------------------------------------------------------ */
/*  URL helpers                                                        */
/* ------------------------------------------------------------------ */

function resolveUrl(inputUrl, cwd) {
  if (!inputUrl) return '';
  const expanded = String(inputUrl).replace(/\$\{cwd\}/g, cwd);
  if (
    expanded.startsWith('http://') ||
    expanded.startsWith('https://') ||
    expanded.startsWith('file://')
  ) {
    return expanded;
  }
  return `file://${path.resolve(cwd, expanded).replace(/ /g, '%20')}`;
}

function sanitizeSegment(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function slugForUrl(inputUrl) {
  try {
    const url = new URL(inputUrl);
    const joined = [url.pathname, url.search].filter(Boolean).join('-');
    return sanitizeSegment(joined) || 'home';
  } catch {
    return sanitizeSegment(inputUrl) || 'home';
  }
}

/* ------------------------------------------------------------------ */
/*  Pattern matching                                                   */
/* ------------------------------------------------------------------ */

function compilePatterns(patterns) {
  if (!Array.isArray(patterns)) return [];
  return patterns
    .filter(Boolean)
    .map((item) => {
      try {
        return new RegExp(item);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function matchesFilters(urlValue, includePatterns, excludePatterns) {
  if (includePatterns.length > 0 && !includePatterns.some((rx) => rx.test(urlValue))) {
    return false;
  }
  if (excludePatterns.some((rx) => rx.test(urlValue))) {
    return false;
  }
  return true;
}

/* ------------------------------------------------------------------ */
/*  Document detection                                                 */
/* ------------------------------------------------------------------ */

const NON_DOC_EXTENSIONS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico',
  'pdf', 'zip', 'css', 'js', 'mjs', 'json', 'xml', 'txt',
  'woff', 'woff2', 'ttf', 'eot', 'mp4', 'webm', 'mp3', 'wav',
]);

function isLikelyDocument(urlObject) {
  const ext = path.extname(urlObject.pathname || '').replace(/^\./, '').toLowerCase();
  return !ext || !NON_DOC_EXTENSIONS.has(ext);
}

/* ------------------------------------------------------------------ */
/*  Href normalisation (used by crawlers in both scripts)              */
/* ------------------------------------------------------------------ */

function normalizeHref(rawHref, currentUrl, rootUrl, options) {
  if (!rawHref || typeof rawHref !== 'string') return null;

  const href = rawHref.trim();
  if (!href || href.startsWith('#')) return null;
  if (href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:')) {
    return null;
  }

  let candidate;
  try {
    candidate = new URL(href, currentUrl);
  } catch {
    return null;
  }

  if (!['http:', 'https:', 'file:'].includes(candidate.protocol)) {
    return null;
  }

  if (options.sameOrigin) {
    if (candidate.protocol === 'file:' && rootUrl.protocol === 'file:') {
      const rootDir = path.dirname(decodeURIComponent(rootUrl.pathname));
      const candidatePath = decodeURIComponent(candidate.pathname);
      if (!candidatePath.startsWith(rootDir)) return null;
    } else if (candidate.origin !== rootUrl.origin) {
      return null;
    }
  }

  if (!options.includeQuery) {
    candidate.search = '';
  }
  candidate.hash = '';

  if (!isLikelyDocument(candidate)) {
    return null;
  }

  if (!matchesFilters(candidate.href, options.includePatterns, options.excludePatterns)) {
    return null;
  }

  return candidate.href;
}

/* ------------------------------------------------------------------ */
/*  Timing                                                             */
/* ------------------------------------------------------------------ */

async function sleep(ms) {
  if (!ms || ms <= 0) return;
  await new Promise((resolve) => setTimeout(resolve, ms));
}

/* ------------------------------------------------------------------ */
/*  Step runner (unified — supports every step type from both scripts) */
/* ------------------------------------------------------------------ */

async function runStep(page, step) {
  if (!step || typeof step !== 'object') return;

  switch (step.type) {
    case 'goto':
      await page.goto(step.url, { waitUntil: step.waitUntil || 'domcontentloaded' });
      return;

    case 'fill':
      await page.fill(step.selector, String(step.value ?? ''));
      return;

    case 'click':
      await page.click(step.selector);
      return;

    case 'press':
      await page.press(step.selector, step.key || 'Enter');
      return;

    case 'check':
      if (step.value === false) {
        await page.uncheck(step.selector);
      } else {
        await page.check(step.selector);
      }
      return;

    case 'scroll':
      await page.evaluate(
        ({ sx, sy }) => window.scrollTo(sx, sy),
        { sx: Number(step.x || 0), sy: Number(step.y || 0) }
      );
      return;

    case 'wait':
      await page.waitForTimeout(Number(step.ms || 300));
      return;

    case 'waitForSelector':
      await page.waitForSelector(step.selector, {
        timeout: Number(step.timeoutMs || 15000),
      });
      return;

    case 'evaluate':
      await page.evaluate(step.script);
      return;

    case 'call':
      await page.evaluate(({ fn, args }) => {
        if (typeof window[fn] !== 'function') throw new Error(`Function not found: ${fn}`);
        window[fn](...(args || []));
      }, step);
      return;

    case 'setById':
      await page.evaluate((s) => {
        const el = document.getElementById(s.id);
        if (!el) throw new Error(`Element not found by id: ${s.id}`);
        if (el.type === 'checkbox') {
          el.checked = Boolean(s.value);
        } else {
          el.value = String(s.value);
        }
        if (s.triggerFn) {
          if (typeof window[s.triggerFn] !== 'function') {
            throw new Error(`Trigger function not found: ${s.triggerFn}`);
          }
          window[s.triggerFn](el);
        } else if (s.dispatchEvent) {
          el.dispatchEvent(new Event(s.dispatchEvent, { bubbles: true }));
        }
      }, step);
      return;

    default:
      throw new Error(`Unsupported step type: ${step.type}`);
  }
}

/* ------------------------------------------------------------------ */
/*  Link collection                                                    */
/* ------------------------------------------------------------------ */

async function collectPageLinks(page) {
  return page.$$eval('a[href]', (anchors) =>
    anchors.map((a) => a.getAttribute('href')).filter(Boolean)
  );
}

/* ------------------------------------------------------------------ */
/*  Slug builder (used by capture-from-config)                         */
/* ------------------------------------------------------------------ */

function buildPageSlug(urlObj) {
  const segments = urlObj.pathname
    .split('/')
    .map((s) => sanitizeSegment(s))
    .filter(Boolean);
  const base = segments.length > 0 ? segments.join('-') : 'home';
  if (!urlObj.search) return base;
  const querySlug = sanitizeSegment(urlObj.search.replace(/^\?/, ''));
  return querySlug ? `${base}-${querySlug}` : base;
}

function pad(n, width) {
  return String(n).padStart(width, '0');
}

/* ------------------------------------------------------------------ */
/*  Config helpers                                                     */
/* ------------------------------------------------------------------ */

function deepMerge(base, patch) {
  if (Array.isArray(base) || Array.isArray(patch)) {
    return patch !== undefined ? patch : base;
  }
  if (typeof base !== 'object' || base === null) {
    return patch !== undefined ? patch : base;
  }

  const out = { ...base };
  const keys = new Set([...Object.keys(base), ...Object.keys(patch || {})]);

  for (const key of keys) {
    const baseValue = base[key];
    const patchValue = patch ? patch[key] : undefined;

    if (patchValue === undefined) {
      out[key] = baseValue;
      continue;
    }

    if (
      typeof baseValue === 'object' &&
      baseValue !== null &&
      !Array.isArray(baseValue) &&
      typeof patchValue === 'object' &&
      patchValue !== null &&
      !Array.isArray(patchValue)
    ) {
      out[key] = deepMerge(baseValue, patchValue);
    } else {
      out[key] = patchValue;
    }
  }

  return out;
}

module.exports = {
  requirePlaywright,
  browserFromName,
  ensureDir,
  resolveUrl,
  sanitizeSegment,
  slugForUrl,
  compilePatterns,
  matchesFilters,
  isLikelyDocument,
  normalizeHref,
  sleep,
  runStep,
  collectPageLinks,
  buildPageSlug,
  pad,
  deepMerge,
};
