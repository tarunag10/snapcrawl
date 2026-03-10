# Capture Config Guide

Use this setup in any project to auto-capture screenshots across an entire site (or run explicit scenarios), plus a workflow file, by editing only `capture-config.json`.

## One-Command Bootstrap For Other Projects

From this repository:

```bash
scripts/bootstrap-capture-kit.sh "/absolute/path/to/other-project"
```

With dependency install included:

```bash
scripts/bootstrap-capture-kit.sh "/absolute/path/to/other-project" --install
```

## Install Once Per Project

```bash
npm init -y
npm install --save-dev playwright
npx playwright install chromium
```

## Files to Copy to New Projects
- `scripts/capture-from-config.js`
- `capture-config.json` (customize per project)

Optional wrapper:
- `scripts/capture-social.js`

## Add npm Scripts

```json
{
  "scripts": {
    "capture:social": "node scripts/capture-from-config.js --config capture-config.json",
    "capture:site": "node scripts/capture-from-config.js --config capture-config.json",
    "capture:install": "npx playwright install chromium"
  }
}
```

## Minimal Auto-Crawl Config

```json
{
  "projectName": "My Website Auto Screenshots",
  "baseUrl": "http://localhost:3000/",
  "outputDir": "output/social",
  "browser": "chromium",
  "crawl": {
    "enabled": true,
    "maxPages": 40,
    "maxDepth": 4,
    "sameOrigin": true,
    "includeQuery": false,
    "waitAfterLoadMs": 200,
    "initialSteps": [
      { "type": "fill", "selector": "#email", "value": "demo@example.com" },
      { "type": "fill", "selector": "#password", "value": "password" },
      { "type": "click", "selector": "button[type='submit']" },
      { "type": "wait", "ms": 1200 }
    ],
    "viewports": [
      { "name": "desktop-full", "width": 1440, "height": 1800, "fullPage": true },
      { "name": "social-1200x627", "width": 1200, "height": 627, "fullPage": false }
    ]
  }
}
```

## Crawl Keys
- `enabled`: when true, crawler mode is used.
- `maxPages`: hard limit for discovered pages.
- `maxDepth`: how far link discovery goes from base page.
- `sameOrigin`: keep capture on same site only.
- `includeQuery`: include query strings in uniqueness.
- `includePatterns`: optional regex list to include URLs.
- `excludePatterns`: optional regex list to skip URLs.
- `initialSteps`: optional login/setup steps executed once before crawl.
- `viewports`: one screenshot is captured per page for each viewport.

## Step Types Supported
- `call`: call a page function on `window` with args.
- `setById`: set value/checkbox by element id; optional `triggerFn` or `dispatchEvent`.
- `fill`: type into input via selector.
- `check`: check or uncheck checkbox via selector.
- `click`: click element via selector.
- `scroll`: scroll to x/y.
- `wait`: wait in milliseconds.
- `waitForSelector`: wait until selector appears.
- `evaluate`: run JS expression string.

## Scenario Mode (Optional)
If you need exact scripted screenshots instead of auto-discovery, omit `crawl.enabled` and provide `scenarios` as before.

## Run

```bash
npm run capture:site
```

Output:
- PNG files in `output/social/`
- Auto-generated `output/social/WORKFLOW.md`
