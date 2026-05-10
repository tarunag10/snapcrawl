#!/usr/bin/env node

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = __dirname;

function printHelp() {
  console.log(`
Usage:
  snapcrawl <url> [options]
  snapcrawl capture [url] [options]
  snapcrawl record [url] [options]
  snapcrawl init
  snapcrawl status
  snapcrawl baseline save [--output <path>] [--dir <dir>]
  snapcrawl diff [--baseline <path>] [--dir <dir>]

Commands:
  capture        Capture multi-viewport screenshots
  record         Record a crawl-driven MP4 workflow
  init           Scaffold Snapcrawl config files
  status         Show local config and artifact status
  baseline save  Save hashes for captured artifacts
  diff           Compare artifacts against a saved baseline

Options:
  --config <path>   Use an existing config file
  --output <dir>    Override output directory for commands that support it
  --headful         Show the browser for record
  --help, -h        Show this help message
  `.trim());
}

function printRecordHelp() {
  console.log(`
Usage:
  snapcrawl record [url] [options]

Record a polished MP4 demo video by crawling a website with the existing
workflow recorder.

Options:
  --config <path>      Config file path (default: workflow-recorder.config.json)
  --output <dir>       Override outputDir from config
  --base-url <url>     Override baseUrl from config
  --headful            Show the browser window during recording
  --keep-raw-video     Keep the raw .webm file alongside the .mp4
  --help, -h           Show this help message
  `.trim());
}

function isUrl(value) {
  return /^https?:\/\//i.test(value || '') || /^file:\/\//i.test(value || '');
}

function optionValue(args, name, fallback = null) {
  const index = args.indexOf(name);
  if (index === -1 || !args[index + 1]) return fallback;
  return args[index + 1];
}

function withoutUrl(args, url) {
  if (!url) return args;
  const index = args.indexOf(url);
  if (index === -1) return args;
  return [...args.slice(0, index), ...args.slice(index + 1)];
}

function runScript(script, args) {
  const scriptPath = path.join(ROOT, script);
  const result = spawnSync(process.execPath, [scriptPath, ...args], { stdio: 'inherit' });
  process.exit(result.status === null ? 1 : result.status);
}

function tempCaptureConfig(url, args) {
  const outputDir = optionValue(args, '--output', 'snapcrawl-output');
  const config = {
    projectName: new URL(url).hostname || 'snapcrawl-capture',
    baseUrl: url,
    outputDir,
    browser: 'chromium',
    browserChannel: 'auto',
    waitUntil: 'load',
    crawl: {
      enabled: true,
      maxPages: 1,
      maxDepth: 0,
      sameOrigin: true,
      includeQuery: false,
      waitAfterLoadMs: 200,
      viewports: [
        { name: 'desktop-full', width: 1440, height: 1800, fullPage: true },
        { name: 'mobile', width: 430, height: 932, fullPage: false },
      ],
    },
  };

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'snapcrawl-'));
  const file = path.join(dir, 'capture-config.json');
  fs.writeFileSync(file, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
  return file;
}

function capture(args) {
  const explicitConfig = optionValue(args, '--config');
  const url = args.find((arg) => isUrl(arg));
  const passThrough = withoutUrl(args, url);

  if (url && !explicitConfig) {
    const config = tempCaptureConfig(url, args);
    runScript('capture-from-config.js', ['--config', config]);
  }

  runScript('capture-from-config.js', passThrough);
}

function record(args) {
  if (args.includes('--help') || args.includes('-h')) {
    printRecordHelp();
    return;
  }

  const url = args.find((arg) => isUrl(arg));
  const passThrough = withoutUrl(args, url);

  if (url && !passThrough.includes('--base-url')) {
    passThrough.push('--base-url', url);
  }

  runScript('record-workflow.js', passThrough);
}

function status() {
  const cwd = process.cwd();
  const files = [
    'capture-config.json',
    'workflow-recorder.config.json',
    'output',
    'snapcrawl-output',
  ];

  console.log('Snapcrawl status');
  for (const file of files) {
    const fullPath = path.join(cwd, file);
    console.log(`  ${fs.existsSync(fullPath) ? 'yes' : 'no '}  ${file}`);
  }
}

function listFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return listFiles(fullPath);
    return [fullPath];
  });
}

function artifactFiles(dir) {
  return listFiles(dir).filter((file) => /\.(png|jpe?g|webp|mp4|webm)$/i.test(file));
}

function saveBaseline(args) {
  const { saveBaseline: saveBaselineFile } = require('../lib/diff');
  const rootDir = path.resolve(process.cwd(), optionValue(args, '--dir', 'output'));
  const output = path.resolve(process.cwd(), optionValue(args, '--output', 'snapcrawl-baseline.json'));
  const captures = artifactFiles(rootDir).map((file) => ({ file: path.relative(rootDir, file) }));
  const baselinePath = saveBaselineFile({ baselinePath: output, rootDir, captures });

  console.log(`Saved baseline: ${path.relative(process.cwd(), baselinePath) || baselinePath}`);
  console.log(`Files: ${captures.length}`);
}

function diff(args) {
  const { compareToBaseline } = require('../lib/diff');
  const baselinePath = path.resolve(process.cwd(), optionValue(args, '--baseline', 'snapcrawl-baseline.json'));
  const rootDir = path.resolve(process.cwd(), optionValue(args, '--dir', 'output'));

  if (!fs.existsSync(baselinePath)) {
    throw new Error(`Baseline not found: ${baselinePath}`);
  }

  const captures = artifactFiles(rootDir).map((file) => ({ file: path.relative(rootDir, file) }));
  const result = compareToBaseline({ baselinePath, rootDir, captures });
  console.log(`Diff: ${result.counts.unchanged} unchanged, ${result.counts.changed} changed, ${result.counts.missing} missing, ${result.counts.added} added`);
  process.exit(result.counts.changed || result.counts.missing || result.counts.added ? 1 : 0);
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === '--help' || command === '-h') {
    printHelp();
    return;
  }

  if (isUrl(command)) {
    capture(args);
    return;
  }

  if (command === 'capture') return capture(args.slice(1));
  if (command === 'record') return record(args.slice(1));
  if (command === 'init') return runScript('create-snapcrawl.js', args.slice(1));
  if (command === 'status') return status();
  if (command === 'baseline' && args[1] === 'save') return saveBaseline(args.slice(2));
  if (command === 'diff') return diff(args.slice(1));

  console.error(`Unknown command: ${command}`);
  printHelp();
  process.exit(1);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
