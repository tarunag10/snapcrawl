#!/usr/bin/env node

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} = require('@modelcontextprotocol/sdk/types.js');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

/* ------------------------------------------------------------------ */
/*  Config builders (reused from create-snapcrawl.js)                  */
/* ------------------------------------------------------------------ */

const VIEWPORT_PRESETS = {
  desktop: { name: 'desktop-full', width: 1440, height: 1800, fullPage: true },
  mobile:  { name: 'mobile', width: 430, height: 932, fullPage: false },
  tablet:  { name: 'tablet', width: 768, height: 1024, fullPage: false },
};

function buildCaptureConfig({ projectName, baseUrl, outputDir, viewports }) {
  const vps = viewports.map((v) => VIEWPORT_PRESETS[v]).filter(Boolean);
  if (vps.length === 0) {
    vps.push(VIEWPORT_PRESETS.desktop, VIEWPORT_PRESETS.mobile, VIEWPORT_PRESETS.tablet);
  }
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
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function hostnameFrom(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'my-project';
  }
}

/** Resolve the dist/ directory where bundled scripts live */
function distDir() {
  return path.resolve(__dirname, '..');
}

/** Spawn a child process and collect stdout + stderr */
function runScript(scriptPath, args) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [scriptPath, ...args], {
      cwd: process.cwd(),
      env: { ...process.env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const chunks = [];
    const errChunks = [];
    child.stdout.on('data', (d) => chunks.push(d));
    child.stderr.on('data', (d) => errChunks.push(d));
    child.on('close', (code) => {
      resolve({
        code,
        stdout: Buffer.concat(chunks).toString('utf8'),
        stderr: Buffer.concat(errChunks).toString('utf8'),
      });
    });
  });
}

/* ------------------------------------------------------------------ */
/*  Tool definitions                                                   */
/* ------------------------------------------------------------------ */

const TOOLS = [
  {
    name: 'snapcrawl_init',
    description:
      'Generate snapcrawl config files programmatically. Creates capture-config.json and optionally workflow-recorder.config.json in the current working directory.',
    inputSchema: {
      type: 'object',
      properties: {
        baseUrl: {
          type: 'string',
          description: 'The website URL to capture (e.g. https://example.com)',
        },
        projectName: {
          type: 'string',
          description: 'Human-friendly project name (defaults to hostname)',
        },
        outputDir: {
          type: 'string',
          description: 'Directory for output files (default: output)',
        },
        viewports: {
          type: 'array',
          items: { type: 'string', enum: ['desktop', 'mobile', 'tablet'] },
          description: 'Viewport presets to use (default: all three)',
        },
        includeVideo: {
          type: 'boolean',
          description: 'Also generate workflow-recorder.config.json (default: true)',
        },
      },
      required: ['baseUrl'],
    },
  },
  {
    name: 'snapcrawl_capture',
    description:
      'Run screenshot capture using a config file. Crawls the website and takes multi-viewport screenshots.',
    inputSchema: {
      type: 'object',
      properties: {
        configPath: {
          type: 'string',
          description: 'Path to capture config JSON (default: capture-config.json)',
        },
      },
    },
  },
  {
    name: 'snapcrawl_record',
    description:
      'Run video workflow recording using a config file. Crawls the website, interacts with UI elements, and records an MP4 video.',
    inputSchema: {
      type: 'object',
      properties: {
        configPath: {
          type: 'string',
          description: 'Path to workflow recorder config JSON (default: workflow-recorder.config.json)',
        },
      },
    },
  },
  {
    name: 'snapcrawl_status',
    description:
      'Check what snapcrawl config files exist in the current directory and summarize their settings.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
];

/* ------------------------------------------------------------------ */
/*  Tool handlers                                                      */
/* ------------------------------------------------------------------ */

async function handleInit(args) {
  const baseUrl = args.baseUrl;
  const projectName = args.projectName || hostnameFrom(baseUrl);
  const outputDir = args.outputDir || 'output';
  const viewports = args.viewports || ['desktop', 'mobile', 'tablet'];
  const includeVideo = args.includeVideo !== false;

  const cwd = process.cwd();
  const created = [];

  // Write capture config
  const captureFile = path.join(cwd, 'capture-config.json');
  const captureConfig = buildCaptureConfig({ projectName, baseUrl, outputDir, viewports });
  fs.writeFileSync(captureFile, JSON.stringify(captureConfig, null, 2) + '\n', 'utf8');
  created.push(captureFile);

  // Write workflow config
  if (includeVideo) {
    const workflowFile = path.join(cwd, 'workflow-recorder.config.json');
    const workflowConfig = buildWorkflowConfig({ projectName, baseUrl, outputDir });
    fs.writeFileSync(workflowFile, JSON.stringify(workflowConfig, null, 2) + '\n', 'utf8');
    created.push(workflowFile);
  }

  return {
    content: [
      {
        type: 'text',
        text: [
          `Created config files for "${projectName}" (${baseUrl}):`,
          ...created.map((f) => `  - ${f}`),
          '',
          'Next steps:',
          `  npx snapcrawl --config capture-config.json`,
          includeVideo ? `  npx snapcrawl-record --config workflow-recorder.config.json` : '',
        ]
          .filter(Boolean)
          .join('\n'),
      },
    ],
  };
}

async function handleCapture(args) {
  const configPath = args.configPath || 'capture-config.json';
  const absConfig = path.resolve(process.cwd(), configPath);

  if (!fs.existsSync(absConfig)) {
    return {
      content: [{ type: 'text', text: `Config file not found: ${absConfig}\nRun snapcrawl_init first to generate one.` }],
      isError: true,
    };
  }

  const script = path.join(distDir(), 'dist', 'capture-from-config.js');
  if (!fs.existsSync(script)) {
    return {
      content: [{ type: 'text', text: `Bundled script not found: ${script}\nRun "npm run build" in the snapcrawl directory first.` }],
      isError: true,
    };
  }

  const result = await runScript(script, ['--config', absConfig]);

  if (result.code !== 0) {
    return {
      content: [{ type: 'text', text: `Capture failed (exit code ${result.code}):\n${result.stderr || result.stdout}` }],
      isError: true,
    };
  }

  return {
    content: [{ type: 'text', text: result.stdout || 'Capture completed successfully.' }],
  };
}

async function handleRecord(args) {
  const configPath = args.configPath || 'workflow-recorder.config.json';
  const absConfig = path.resolve(process.cwd(), configPath);

  if (!fs.existsSync(absConfig)) {
    return {
      content: [{ type: 'text', text: `Config file not found: ${absConfig}\nRun snapcrawl_init first to generate one.` }],
      isError: true,
    };
  }

  const script = path.join(distDir(), 'dist', 'record-workflow.js');
  if (!fs.existsSync(script)) {
    return {
      content: [{ type: 'text', text: `Bundled script not found: ${script}\nRun "npm run build" in the snapcrawl directory first.` }],
      isError: true,
    };
  }

  const result = await runScript(script, ['--config', absConfig]);

  if (result.code !== 0) {
    return {
      content: [{ type: 'text', text: `Recording failed (exit code ${result.code}):\n${result.stderr || result.stdout}` }],
      isError: true,
    };
  }

  return {
    content: [{ type: 'text', text: result.stdout || 'Recording completed successfully.' }],
  };
}

async function handleStatus() {
  const cwd = process.cwd();
  const configs = [
    { name: 'capture-config.json', type: 'Screenshot Capture' },
    { name: 'workflow-recorder.config.json', type: 'Video Recording' },
  ];

  const lines = ['Snapcrawl status:', ''];

  for (const { name, type } of configs) {
    const filePath = path.join(cwd, name);
    if (fs.existsSync(filePath)) {
      try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        lines.push(`${type} (${name}): FOUND`);
        if (data.baseUrl) lines.push(`  Base URL: ${data.baseUrl}`);
        if (data.projectName) lines.push(`  Project: ${data.projectName}`);
        if (data.outputDir) lines.push(`  Output: ${data.outputDir}`);
        if (data.crawl) {
          lines.push(`  Crawl: maxPages=${data.crawl.maxPages || '?'}, maxDepth=${data.crawl.maxDepth || '?'}`);
          if (data.crawl.viewports) {
            lines.push(`  Viewports: ${data.crawl.viewports.map((v) => v.name).join(', ')}`);
          }
        }
        if (data.workflow) {
          lines.push(`  Workflow: ${data.workflow.enabled ? 'enabled' : 'disabled'}`);
        }
        if (data.recording) {
          lines.push(`  Recording: ${data.recording.width}x${data.recording.height}`);
        }
      } catch (err) {
        lines.push(`${type} (${name}): FOUND (parse error: ${err.message})`);
      }
    } else {
      lines.push(`${type} (${name}): NOT FOUND`);
    }
    lines.push('');
  }

  return {
    content: [{ type: 'text', text: lines.join('\n') }],
  };
}

/* ------------------------------------------------------------------ */
/*  Server setup                                                       */
/* ------------------------------------------------------------------ */

const server = new Server(
  { name: 'snapcrawl', version: '0.1.0' },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS,
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;

  switch (name) {
    case 'snapcrawl_init':
      return handleInit(args);
    case 'snapcrawl_capture':
      return handleCapture(args);
    case 'snapcrawl_record':
      return handleRecord(args);
    case 'snapcrawl_status':
      return handleStatus();
    default:
      return {
        content: [{ type: 'text', text: `Unknown tool: ${name}` }],
        isError: true,
      };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error('MCP server failed to start:', err);
  process.exit(1);
});
