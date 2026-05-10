const path = require('path');
const { fileURLToPath } = require('url');

const ENV_TOKEN = /\$\{(?:env:)?([A-Za-z_][A-Za-z0-9_]*)\}/g;

function isPathInside(baseDir, candidatePath) {
  const base = path.resolve(baseDir);
  const candidate = path.resolve(candidatePath);
  const relative = path.relative(base, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function safeJoin(baseDir, userPath, label = 'path') {
  if (!userPath || typeof userPath !== 'string') {
    throw new Error(`Unsafe ${label}: expected a relative path`);
  }
  if (userPath.includes('\0') || path.isAbsolute(userPath) || path.win32.isAbsolute(userPath)) {
    throw new Error(`Unsafe path for ${label}: absolute paths are not allowed`);
  }
  if (userPath.split(/[\\/]+/).includes('..')) {
    throw new Error(`Unsafe path for ${label}: path traversal is not allowed`);
  }
  const target = path.resolve(baseDir, userPath);
  if (!isPathInside(baseDir, target)) {
    throw new Error(`Unsafe path for ${label}: path traversal is not allowed`);
  }
  return target;
}

function isFileUrlInsideRoot(candidateUrl, rootUrl) {
  if (candidateUrl.protocol !== 'file:' || rootUrl.protocol !== 'file:') return false;
  const rootDir = path.dirname(decodeURIComponent(rootUrl.pathname));
  const candidatePath = decodeURIComponent(candidateUrl.pathname);
  return isPathInside(rootDir, candidatePath);
}

function isFileUrlContainedWithin(fileUrl, rootPath) {
  let parsed;
  try {
    parsed = new URL(fileUrl);
  } catch {
    return false;
  }

  if (parsed.protocol !== 'file:') return false;

  try {
    return isPathInside(rootPath, fileURLToPath(parsed));
  } catch {
    return false;
  }
}

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

  return value.replace(ENV_TOKEN, (_, name) => {
    if (!Object.prototype.hasOwnProperty.call(env, name)) {
      throw new Error(`Missing environment variable: ${name}`);
    }
    return env[name];
  });
}

module.exports = {
  interpolateEnv,
  isPathInside,
  safeJoin,
  isFileUrlInsideRoot,
  isFileUrlContainedWithin,
};
