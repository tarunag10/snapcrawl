#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { createInterface } = require('readline');

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function ask(rl, question, fallback) {
  const suffix = fallback ? ` (${fallback})` : '';
  return new Promise((resolve) => {
    rl.question(`${question}${suffix}: `, (answer) => {
      resolve(answer.trim() || fallback || '');
    });
  });
}

function hostnameFrom(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'my-project';
  }
}

function fileExists(filePath) {
  try {
    fs.accessSync(filePath);
    return true;
  } catch {
    return false;
  }
}

function readPackageJson(cwd) {
  const packagePath = path.join(cwd, 'package.json');
  if (!fileExists(packagePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  } catch {
    return null;
  }
}

function detectProjectDefaults(cwd) {
  const pkg = readPackageJson(cwd);
  const scripts = pkg && pkg.scripts ? pkg.scripts : {};
  const scriptText = Object.values(scripts).join(' ');
  let baseUrl = 'http://localhost:3000';

  if (/vite|astro|storybook/i.test(scriptText)) baseUrl = 'http://localhost:5173';
  if (/next/i.test(scriptText)) baseUrl = 'http://localhost:3000';
  if (/remix/i.test(scriptText)) baseUrl = 'http://localhost:3000';
  if (/webpack-dev-server/i.test(scriptText)) baseUrl = 'http://localhost:8080';

  const hasStorybook = Boolean(
    scripts.storybook ||
    scripts['storybook:dev'] ||
    fileExists(path.join(cwd, '.storybook', 'main.js')) ||
    fileExists(path.join(cwd, '.storybook', 'main.ts'))
  );

  return {
    baseUrl,
    projectName: pkg && pkg.name ? pkg.name : hostnameFrom(baseUrl),
    hasPackageJson: Boolean(pkg),
    hasStorybook,
    devScript: scripts.dev ? 'npm run dev' : '',
    storybookUrl: 'http://localhost:6006',
  };
}

/* ------------------------------------------------------------------ */
/*  Config builders                                                    */
/* ------------------------------------------------------------------ */

const VIEWPORT_PRESETS = {
  desktop: { name: 'desktop-full', width: 1440, height: 1800, fullPage: true },
  mobile:  { name: 'mobile', width: 430, height: 932, fullPage: false },
  tablet:  { name: 'tablet', width: 768, height: 1024, fullPage: false },
};

function buildCaptureConfig({ projectName, baseUrl, outputDir, viewports }) {
  const vps = viewports.map((v) => VIEWPORT_PRESETS[v]).filter(Boolean);
  return {
    projectName,
    baseUrl,
    outputDir,
    browser: 'chromium',
    browserChannel: 'auto',
    waitUntil: 'load',
    crawl: {
      enabled: true,
      maxPages: 40,
      maxDepth: 4,
      sameOrigin: true,
      includeQuery: false,
      waitAfterLoadMs: 200,
      excludePatterns: ['/logout', '/signout'],
      viewports: vps,
    },
  };
}

function buildWorkflowConfig({ projectName, baseUrl, outputDir }) {
  return {
    projectName,
    baseUrl,
    outputDir: `${outputDir}/workflow-recorder`,
    browser: 'chromium',
    browserChannel: 'auto',
    headless: true,
    waitUntil: 'domcontentloaded',
    viewport: { width: 1512, height: 982 },
    recording: { width: 1920, height: 1080, keepRawVideo: false },
    crawl: {
      enabled: true,
      maxPages: 35,
      maxDepth: 4,
      sameOrigin: true,
      includeQuery: false,
      waitAfterLoadMs: 500,
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
    setupSteps: [{ type: 'wait', ms: 400 }],
  };
}

/* ------------------------------------------------------------------ */
/*  Main                                                               */
/* ------------------------------------------------------------------ */

async function main() {
  const cwd = process.cwd();

  console.log('\n  snapcrawl init — interactive config scaffolder\n');

  const rl = createInterface({ input: process.stdin, output: process.stdout });

  try {
    const detected = detectProjectDefaults(cwd);
    if (detected.hasPackageJson) {
      console.log(`  Detected project: ${detected.projectName}`);
      if (detected.devScript) console.log(`  Dev server script: ${detected.devScript}`);
      if (detected.hasStorybook) console.log('  Storybook detected');
      console.log('');
    }

    // 1. Base URL
    const baseUrl = await ask(rl, '  What\'s your website URL?', detected.baseUrl);

    // 2. Project name
    const defaultName = detected.projectName || hostnameFrom(baseUrl);
    const projectName = await ask(rl, '  Project name?', defaultName);

    // 3. Output directory
    const outputDir = await ask(rl, '  Where to save output?', 'output');

    // 4. Viewports
    const vpInput = await ask(rl, '  Which viewports? (desktop,mobile,tablet)', 'desktop,mobile,tablet');
    const viewports = vpInput.split(',').map((v) => v.trim().toLowerCase()).filter((v) => VIEWPORT_PRESETS[v]);
    if (viewports.length === 0) viewports.push('desktop', 'mobile', 'tablet');

    // 5. Video config
    const videoAnswer = await ask(rl, '  Also generate video recording config?', 'yes');
    const wantVideo = videoAnswer.toLowerCase().startsWith('y');

    const storybookAnswer = detected.hasStorybook
      ? await ask(rl, '  Also print Storybook capture command?', 'yes')
      : 'no';
    const wantStorybook = storybookAnswer.toLowerCase().startsWith('y');

    rl.close();

    console.log('');

    // Write capture config
    const captureFile = path.join(cwd, 'capture-config.json');
    if (fileExists(captureFile)) {
      const confirmRl = createInterface({ input: process.stdin, output: process.stdout });
      const overwrite = await ask(confirmRl, '  capture-config.json exists. Overwrite?', 'no');
      confirmRl.close();
      if (!overwrite.toLowerCase().startsWith('y')) {
        console.log('  Skipped capture-config.json');
      } else {
        const config = buildCaptureConfig({ projectName, baseUrl, outputDir, viewports });
        fs.writeFileSync(captureFile, JSON.stringify(config, null, 2) + '\n', 'utf8');
        console.log('  Created capture-config.json');
      }
    } else {
      const config = buildCaptureConfig({ projectName, baseUrl, outputDir, viewports });
      fs.writeFileSync(captureFile, JSON.stringify(config, null, 2) + '\n', 'utf8');
      console.log('  Created capture-config.json');
    }

    // Write workflow config
    if (wantVideo) {
      const workflowFile = path.join(cwd, 'workflow-recorder.config.json');
      if (fileExists(workflowFile)) {
        const confirmRl = createInterface({ input: process.stdin, output: process.stdout });
        const overwrite = await ask(confirmRl, '  workflow-recorder.config.json exists. Overwrite?', 'no');
        confirmRl.close();
        if (!overwrite.toLowerCase().startsWith('y')) {
          console.log('  Skipped workflow-recorder.config.json');
        } else {
          const config = buildWorkflowConfig({ projectName, baseUrl, outputDir });
          fs.writeFileSync(workflowFile, JSON.stringify(config, null, 2) + '\n', 'utf8');
          console.log('  Created workflow-recorder.config.json');
        }
      } else {
        const config = buildWorkflowConfig({ projectName, baseUrl, outputDir });
        fs.writeFileSync(workflowFile, JSON.stringify(config, null, 2) + '\n', 'utf8');
        console.log('  Created workflow-recorder.config.json');
      }
    }

    // Next steps
    console.log('\n  Next steps:');
    console.log('    npx snapcrawl --config capture-config.json');
    if (wantVideo) {
      console.log('    npx snapcrawl-record --config workflow-recorder.config.json');
    }
    if (wantStorybook) {
      console.log(`    npx snapcrawl storybook ${detected.storybookUrl} --output ${outputDir}/storybook`);
    }
    console.log('');
  } catch (err) {
    rl.close();
    throw err;
  }
}

module.exports = main;
module.exports.detectProjectDefaults = detectProjectDefaults;

if (require.main === module) {
  main().catch((err) => {
    console.error(err.message || err);
    process.exit(1);
  });
}
