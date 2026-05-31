const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

function optionValue(args, name, fallback = null) {
  const index = args.indexOf(name);
  if (index === -1 || !args[index + 1]) return fallback;
  return args[index + 1];
}

function parseWatchArgs(args = []) {
  return {
    config: optionValue(args, '--config', 'capture-config.json'),
    dir: optionValue(args, '--dir', '.'),
    debounceMs: Number(optionValue(args, '--debounce', '500')),
    command: args.includes('--record') ? 'record' : 'capture',
  };
}

function shouldIgnoreWatchPath(filePath) {
  const normalized = String(filePath || '').split(path.sep).join('/');
  return (
    normalized.includes('/node_modules/') ||
    normalized.startsWith('node_modules/') ||
    normalized.includes('/.git/') ||
    normalized.startsWith('.git/') ||
    normalized.includes('/dist/') ||
    normalized.startsWith('dist/') ||
    normalized.includes('/output/') ||
    normalized.startsWith('output/') ||
    normalized.includes('/snapcrawl-output/') ||
    normalized.startsWith('snapcrawl-output/')
  );
}

function runSnapcrawlOnce({ command, config, scriptPath }) {
  return new Promise((resolve) => {
    const cli = scriptPath || path.join(__dirname, '..', 'scripts', 'snapcrawl.js');
    const child = spawn(process.execPath, [cli, command, '--config', config], {
      cwd: process.cwd(),
      stdio: 'inherit',
    });
    child.on('close', (code) => resolve(code));
  });
}

async function runWatch(args = []) {
  const parsed = { ...parseWatchArgs(args), scriptPath: arguments[1] && arguments[1].scriptPath };
  const watchDir = path.resolve(process.cwd(), parsed.dir);
  let timer = null;
  let running = false;
  let pending = false;

  async function trigger(reason) {
    if (running) {
      pending = true;
      return;
    }
    running = true;
    console.log(`[snapcrawl] ${reason}`);
    await runSnapcrawlOnce(parsed);
    running = false;
    if (pending) {
      pending = false;
      await trigger('Changes queued; re-running capture');
    }
  }

  await trigger('Initial capture');
  console.log(`[snapcrawl] Watching ${path.relative(process.cwd(), watchDir) || '.'}`);

  fs.watch(watchDir, { recursive: process.platform === 'darwin' || process.platform === 'win32' }, (event, filename) => {
    if (!filename || shouldIgnoreWatchPath(filename)) return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      trigger(`Change detected: ${filename}`).catch((error) => {
        console.error(error.message || error);
      });
    }, parsed.debounceMs);
  });
}

module.exports = {
  parseWatchArgs,
  runWatch,
  shouldIgnoreWatchPath,
};
