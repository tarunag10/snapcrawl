# Workflow Recorder Config Guide

This config is designed to be reusable in any project and on any machine.

Main file in target project:
- `workflow-recorder.config.json`

## One-Command Setup For Any Codebase

From this toolkit folder:

```bash
scripts/bootstrap-capture-kit.sh "/absolute/path/to/target-project"
```

If you do not want dependency install:

```bash
scripts/bootstrap-capture-kit.sh "/absolute/path/to/target-project" --skip-install
```

## Run In Target Project

```bash
npm run workflow:record
```

## Config Schema

```json
{
  "projectName": "My App Full Workflow",
  "baseUrl": "http://localhost:3000/",
  "outputDir": "output/workflow-recorder",
  "browser": "chromium",
  "headless": true,
  "waitUntil": "domcontentloaded",
  "auth": {
    "storageState": ".auth/storage-state.json",
    "cookiesFile": ".auth/cookies.json",
    "headersFile": ".auth/headers.json",
    "basic": {
      "username": "${env:SNAPCRAWL_USER}",
      "password": "${env:SNAPCRAWL_PASSWORD}"
    }
  },
  "viewport": { "width": 1512, "height": 982 },
  "recording": { "width": 1920, "height": 1080, "keepRawVideo": false },
  "crawl": {
    "enabled": true,
    "maxPages": 35,
    "maxDepth": 4,
    "sameOrigin": true,
    "includeQuery": false,
    "waitAfterLoadMs": 500,
    "includePatterns": [],
    "excludePatterns": ["/logout", "/signout", "/delete"]
  },
  "workflow": {
    "enabled": true,
    "includeHoverSweep": true,
    "scrollPerPage": true,
    "scrollSteps": 4,
    "perPagePauseMs": 500,
    "actionPauseMs": 450,
    "interactionLimitPerPage": 6,
    "allowRiskyActions": false
  },
  "setupSteps": [
    { "type": "wait", "ms": 400 }
  ]
}
```

## `setupSteps` For Login / Initial State

Supported step types:
- `goto`
- `fill`
- `click`
- `press`
- `check`
- `wait`
- `waitForSelector`
- `evaluate`

Example login snippet:

```json
"setupSteps": [
  { "type": "fill", "selector": "#email", "value": "demo@example.com" },
  { "type": "fill", "selector": "#password", "value": "password" },
  { "type": "click", "selector": "button[type='submit']" },
  { "type": "wait", "ms": 1200 }
]
```

## Safety vs Coverage

- `allowRiskyActions: false` (default) avoids destructive or payment-like clicks.
- Set `allowRiskyActions: true` only when you explicitly want deep workflow traversal.
- `evaluate` and `call` steps require `--allow-script-steps`.
- Use `${env:NAME}` placeholders for secrets so configs stay commit-safe.

## CI Visual Review

```bash
npx snapcrawl ci --config capture-config.json --baseline snapcrawl-baseline.json
npx snapcrawl ci --config capture-config.json --baseline snapcrawl-baseline.json --threshold 2
npx snapcrawl ci --config capture-config.json --baseline snapcrawl-baseline.json --update-baseline
```

CI mode captures screenshots, compares them to the baseline, writes `ci-report.html`, and exits non-zero when changed/missing/added artifacts exceed the threshold.

## Storybook Subsets

```bash
npx snapcrawl storybook http://localhost:6006 --tag stable
npx snapcrawl storybook http://localhost:6006 --include button
npx snapcrawl storybook http://localhost:6006 --changed-from origin/main
```

Storybook capture can filter by tag, text, or stories whose `importPath` changed since a git ref.

## Output Files

- Final video: `output/workflow-recorder/*.mp4`
- Markdown run report: `output/workflow-recorder/artifacts/WORKFLOW_REPORT.md`
- Crawl + interaction JSON: `output/workflow-recorder/artifacts/crawl.json`
