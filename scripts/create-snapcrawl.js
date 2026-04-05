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
    // 1. Base URL
    const baseUrl = await ask(rl, '  What\'s your website URL?', 'https://example.com');

    // 2. Project name
    const defaultName = hostnameFrom(baseUrl);
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
    console.log('');
  } catch (err) {
    rl.close();
    throw err;
  }
}

module.exports = main;

if (require.main === module) {
  main().catch((err) => {
    console.error(err.message || err);
    process.exit(1);
  });
}
