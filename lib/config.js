const fs = require('fs');
const path = require('path');
const { safeJoin } = require('./safety');

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:', 'file:']);
const ALLOWED_WAIT_UNTIL = new Set(['load', 'domcontentloaded', 'networkidle', 'commit']);
const SCRIPT_STEP_TYPES = new Set(['evaluate', 'call']);
const STEP_TYPES = new Set([
  'goto',
  'fill',
  'click',
  'press',
  'check',
  'scroll',
  'wait',
  'waitForSelector',
  'evaluate',
  'call',
  'setById',
]);

function interpolateEnv(value, env = process.env) {
  if (Array.isArray(value)) {
    return value.map((item) => interpolateEnv(item, env));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, interpolateEnv(item, env)])
    );
  }
  if (typeof value !== 'string') return value;
  return value.replace(/\$\{(?:env:)?([A-Z0-9_]+)\}/gi, (_, name) => {
    if (!Object.prototype.hasOwnProperty.call(env, name)) {
      throw new Error(`Missing environment variable: ${name}`);
    }
    return env[name];
  });
}

function loadJsonConfig(filePath, options = {}) {
  const absPath = path.resolve(options.cwd || process.cwd(), filePath);
  if (!fs.existsSync(absPath)) {
    throw new Error(`Config file not found: ${absPath}`);
  }
  try {
    return interpolateEnv(JSON.parse(fs.readFileSync(absPath, 'utf8')), options.env || process.env);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid JSON in config file ${absPath}: ${error.message}`);
    }
    throw error;
  }
}

function validateUrl(value, label = 'baseUrl') {
  if (!value || typeof value !== 'string') {
    throw new Error(`${label} is required`);
  }
  let parsed;
  try {
    parsed = /^[a-z][a-z0-9+.-]*:/i.test(value)
      ? new URL(value)
      : new URL(`file://${path.resolve(value)}`);
  } catch {
    throw new Error(`${label} must be a valid http, https, file, or local path URL`);
  }
  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
    throw new Error(`${label} must use http, https, or file protocol`);
  }
  return true;
}

function validateNumber(value, label, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  if (value === undefined || value === null) return;
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) {
    throw new Error(`${label} must be a number between ${min} and ${max}`);
  }
}

function validateWaitUntil(value) {
  if (value !== undefined && !ALLOWED_WAIT_UNTIL.has(value)) {
    throw new Error(`waitUntil must be one of: ${Array.from(ALLOWED_WAIT_UNTIL).join(', ')}`);
  }
}

function validateSteps(steps = [], options = {}) {
  if (!Array.isArray(steps)) throw new Error('steps must be an array');
  for (const step of steps) {
    if (!step || typeof step !== 'object') throw new Error('step must be an object');
    if (!STEP_TYPES.has(step.type)) throw new Error(`Unsupported step type: ${step.type}`);
    if (SCRIPT_STEP_TYPES.has(step.type) && !options.allowScriptSteps) {
      throw new Error(`Unsafe script step "${step.type}" requires allowScriptSteps`);
    }
    validateWaitUntil(step.waitUntil);
    if (step.type === 'goto' && step.url) validateUrl(step.url, 'step url');
    if (step.type === 'wait') validateNumber(step.ms, 'wait.ms', { min: 0, max: 120000 });
    if (step.type === 'waitForSelector') {
      validateNumber(step.timeoutMs, 'waitForSelector.timeoutMs', { min: 0, max: 120000 });
    }
    if (step.type === 'evaluate' && (typeof step.script !== 'string' || step.script.trim() === '')) {
      throw new Error('evaluate script is required');
    }
    if (step.type === 'call' && (typeof step.fn !== 'string' || step.fn.trim() === '')) {
      throw new Error('call fn is required');
    }
  }
}

function validateViewports(viewports = []) {
  if (!Array.isArray(viewports)) throw new Error('viewports must be an array');
  for (const viewport of viewports) {
    validateNumber(viewport.width, 'viewport.width', { min: 100, max: 10000 });
    validateNumber(viewport.height, 'viewport.height', { min: 100, max: 10000 });
  }
}

function validateCrawl(crawl = {}, options = {}) {
  validateNumber(crawl.maxPages, 'crawl.maxPages', { min: 1, max: 1000 });
  validateNumber(crawl.maxDepth, 'crawl.maxDepth', { min: 0, max: 50 });
  validateNumber(crawl.waitAfterLoadMs, 'crawl.waitAfterLoadMs', { min: 0, max: 120000 });
  validateSteps(crawl.initialSteps || [], options);
  if (crawl.viewports) validateViewports(crawl.viewports);
  if (crawl.sitemapUrl) validateUrl(crawl.sitemapUrl, 'crawl.sitemapUrl');
}

function validateScenarios(scenarios = [], options = {}) {
  if (!Array.isArray(scenarios)) throw new Error('scenarios must be an array');
  for (const scenario of scenarios) {
    if (!scenario.file) throw new Error('Each scenario requires a file');
    safeJoin(options.outputDir || process.cwd(), scenario.file, 'scenario file');
    validateViewports([scenario.viewport || {}]);
    validateSteps(scenario.steps || [], options);
  }
}

function validateAuth(auth = {}) {
  if (!auth || typeof auth !== 'object') return;
  if (auth.storageState && typeof auth.storageState !== 'string') {
    throw new Error('auth.storageState must be a path string');
  }
  if (auth.cookies && !Array.isArray(auth.cookies)) throw new Error('auth.cookies must be an array');
  if (auth.headers && (typeof auth.headers !== 'object' || Array.isArray(auth.headers))) {
    throw new Error('auth.headers must be an object');
  }
}

function validateCaptureConfig(config, options = {}) {
  const prepared = interpolateEnv(config, options.env || process.env);

  validateUrl(prepared.baseUrl);
  validateWaitUntil(prepared.waitUntil);
  validateAuth(prepared.auth);
  if (prepared.outputDir) safeJoin(options.cwd || process.cwd(), prepared.outputDir, 'outputDir');
  validateCrawl(prepared.crawl || {}, options);

  const crawlEnabled = Boolean(prepared.crawl && prepared.crawl.enabled);
  const scenariosOk = Array.isArray(prepared.scenarios) && prepared.scenarios.length > 0;
  if (!crawlEnabled && !scenariosOk) {
    throw new Error('Config requires at least one scenario, or set crawl.enabled=true');
  }
  if (scenariosOk) validateScenarios(prepared.scenarios, options);
  return prepared;
}

function validateRecordConfig(config, options = {}) {
  const prepared = interpolateEnv(config, options.env || process.env);

  validateUrl(prepared.baseUrl);
  validateWaitUntil(prepared.waitUntil);
  validateAuth(prepared.auth);
  if (prepared.outputDir) safeJoin(options.cwd || process.cwd(), prepared.outputDir, 'outputDir');
  validateCrawl(prepared.crawl || {}, options);
  validateSteps(prepared.setupSteps || [], options);
  validateNumber(prepared.viewport && prepared.viewport.width, 'viewport.width', { min: 1, max: 10000 });
  validateNumber(prepared.viewport && prepared.viewport.height, 'viewport.height', { min: 1, max: 10000 });
  validateNumber(prepared.recording && prepared.recording.width, 'recording.width', { min: 1, max: 10000 });
  validateNumber(prepared.recording && prepared.recording.height, 'recording.height', { min: 1, max: 10000 });
  return prepared;
}

module.exports = {
  interpolateEnv,
  loadJsonConfig,
  validateCaptureConfig,
  validateRecordConfig,
  validateSteps,
};
