const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { compareToBaseline } = require('./diff');
const { writeHtmlReport } = require('./report');

function optionValue(args, name, fallback = null) {
  const index = args.indexOf(name);
  if (index === -1 || !args[index + 1]) return fallback;
  return args[index + 1];
}

function hasFlag(args, name) {
  return args.includes(name);
}

function parseCiArgs(args = []) {
  return {
    config: optionValue(args, '--config', 'capture-config.json'),
    baseline: optionValue(args, '--baseline', 'snapcrawl-baseline.json'),
    outputDir: optionValue(args, '--dir', optionValue(args, '--output', null)),
    threshold: Number(optionValue(args, '--threshold', '0')),
    updateBaseline: hasFlag(args, '--update-baseline'),
    skipCapture: hasFlag(args, '--skip-capture'),
    visual: hasFlag(args, '--visual'),
    extraCaptureArgs: args.filter((arg, index) => {
      const previous = args[index - 1];
      return ![
        '--baseline',
        '--threshold',
        '--dir',
        '--output',
        '--config',
      ].includes(arg) && ![
        '--baseline',
        '--threshold',
        '--dir',
        '--output',
        '--config',
      ].includes(previous) && ![
        '--update-baseline',
        '--skip-capture',
        '--visual',
      ].includes(arg);
    }),
  };
}

function listArtifactFiles(rootDir) {
  if (!fs.existsSync(rootDir)) return [];
  const entries = fs.readdirSync(rootDir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const fullPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) return listArtifactFiles(fullPath);
    return /\.(png|jpe?g|webp)$/i.test(fullPath) ? [fullPath] : [];
  });
}

function loadOutputDir(cwd, configPath, explicitOutputDir) {
  if (explicitOutputDir) return path.resolve(cwd, explicitOutputDir);
  const fullConfigPath = path.resolve(cwd, configPath);
  if (!fs.existsSync(fullConfigPath)) return path.resolve(cwd, 'output/social');
  const config = JSON.parse(fs.readFileSync(fullConfigPath, 'utf8'));
  return path.resolve(cwd, config.outputDir || 'output/social');
}

function runCapture({ cwd, scriptPath, config, outputDir, extraCaptureArgs }) {
  const args = [scriptPath, 'capture', '--config', config, '--no-html-report', ...extraCaptureArgs];
  if (outputDir) args.push('--output', outputDir);
  const result = spawnSync(process.execPath, args, { cwd, stdio: 'inherit' });
  return result.status === null ? 1 : result.status;
}

function runCi(args = [], options = {}) {
  const parsed = parseCiArgs(args);
  const cwd = options.cwd || process.cwd();
  const scriptPath = options.scriptPath || path.join(__dirname, '..', 'scripts', 'snapcrawl.js');
  const outputDir = loadOutputDir(cwd, parsed.config, parsed.outputDir);
  const baselinePath = path.resolve(cwd, parsed.baseline);

  if (!parsed.skipCapture) {
    const status = runCapture({
      cwd,
      scriptPath,
      config: parsed.config,
      outputDir: parsed.outputDir,
      extraCaptureArgs: parsed.extraCaptureArgs,
    });
    if (status !== 0) return status;
  }

  const captures = listArtifactFiles(outputDir).map((file) => ({
    file: path.relative(outputDir, file),
  }));

  if (parsed.updateBaseline || !fs.existsSync(baselinePath)) {
    const { saveBaseline } = require('./diff');
    saveBaseline({ baselinePath, rootDir: outputDir, captures });
    console.log(`[snapcrawl] Saved baseline: ${path.relative(cwd, baselinePath)}`);
    return 0;
  }

  const diff = compareToBaseline({ baselinePath, rootDir: outputDir, captures });
  const changed = diff.counts.changed + diff.counts.missing + diff.counts.added;
  const reportPath = path.join(outputDir, 'ci-report.html');
  writeHtmlReport(reportPath, {
    projectName: 'Snapcrawl CI',
    mode: 'ci',
    captures,
    diff,
  });

  console.log(`[snapcrawl] CI diff: ${changed} changed/missing/added artifact(s)`);
  console.log(`[snapcrawl] Report: ${path.relative(cwd, reportPath)}`);
  return changed > parsed.threshold ? 1 : 0;
}

module.exports = {
  listArtifactFiles,
  parseCiArgs,
  runCi,
};
