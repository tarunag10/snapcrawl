const fs = require('fs');
const path = require('path');
const { safeJoin } = require('./safety');

function readJsonFile(filePath, label) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid JSON in ${label}: ${error.message}`);
    }
    throw error;
  }
}

function resolveAuthFile(cwd, filePath, label) {
  if (!filePath) return null;
  return safeJoin(cwd || process.cwd(), filePath, label);
}

function normalizeBasicAuth(auth = {}) {
  const basic = auth.basic || auth.httpCredentials || null;
  if (!basic) return null;
  if (!basic.username || !basic.password) {
    throw new Error('auth.basic requires username and password');
  }
  return {
    username: String(basic.username),
    password: String(basic.password),
  };
}

function buildContextOptions(config = {}, options = {}) {
  const cwd = options.cwd || process.cwd();
  const auth = config.auth || {};
  const extraHTTPHeaders = { ...(auth.headers || {}) };

  if (auth.headersFile) {
    const headersPath = resolveAuthFile(cwd, auth.headersFile, 'auth.headersFile');
    Object.assign(extraHTTPHeaders, readJsonFile(headersPath, 'auth.headersFile'));
  }

  return {
    storageState: auth.storageState
      ? resolveAuthFile(cwd, auth.storageState, 'auth.storageState')
      : undefined,
    extraHTTPHeaders: Object.keys(extraHTTPHeaders).length ? extraHTTPHeaders : undefined,
    httpCredentials: normalizeBasicAuth(auth) || undefined,
  };
}

async function applyAuth(context, config = {}, options = {}) {
  const cwd = options.cwd || process.cwd();
  const auth = config.auth || {};
  const cookies = [];

  if (Array.isArray(auth.cookies)) {
    cookies.push(...auth.cookies);
  }

  if (auth.cookiesFile) {
    const cookiesPath = resolveAuthFile(cwd, auth.cookiesFile, 'auth.cookiesFile');
    const loaded = readJsonFile(cookiesPath, 'auth.cookiesFile');
    if (!Array.isArray(loaded)) throw new Error('auth.cookiesFile must contain a JSON array');
    cookies.push(...loaded);
  }

  if (cookies.length > 0) {
    await context.addCookies(cookies);
  }
}

function describeAuthConfig(config = {}) {
  const auth = config.auth || {};
  const methods = [];
  if (auth.storageState) methods.push('storageState');
  if (auth.cookies || auth.cookiesFile) methods.push('cookies');
  if (auth.headers || auth.headersFile) methods.push('headers');
  if (auth.basic || auth.httpCredentials) methods.push('basic');
  return {
    enabled: methods.length > 0,
    methods,
    redacted: methods.length > 0,
  };
}

module.exports = {
  applyAuth,
  buildContextOptions,
  describeAuthConfig,
  normalizeBasicAuth,
};
