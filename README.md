# Website Screenshot Capture Kit

Capture screenshots for an entire website automatically using Playwright.

## What This Does

- Bootstraps any project with screenshot tooling
- Optionally installs dependencies and Chromium
- Crawls internal pages from a starting URL
- Captures each page in multiple viewport sizes
- Supports one-time login/setup steps before crawling
- Generates `WORKFLOW.md` with capture details

## Quick Start

From this repository:

```bash
scripts/bootstrap-capture-kit.sh "/absolute/path/to/target-project" --install
```

Then in the target project:

1. Edit `capture-config.json`:
- Set `baseUrl` to your app URL
- Update `crawl.initialSteps` selectors/values if login is required
2. Run:

```bash
npm run capture:site
```

Output is written to `output/social/`.

## Board/Kiosk Mode (Copy-Paste Only)

Run these commands exactly.

### 1) Bootstrap target project

```bash
cd "/Users/tarunagarwal/Documents/1_App Developement - Tarun/set up configuration for screenshots"
scripts/bootstrap-capture-kit.sh "/absolute/path/to/target-project" --install
```

### 2) Open config in target project

```bash
cd "/absolute/path/to/target-project"
open capture-config.json
```

Set these fields:
- `baseUrl` (example: `https://your-app-domain.com/` or `http://localhost:3000/`)
- `crawl.initialSteps` (only if login is needed)

### 3) Run screenshots

```bash
npm run capture:site
```

### 4) Find output

```bash
open output/social
```

## Core Files

- `scripts/bootstrap-capture-kit.sh`: copies setup into another project
- `scripts/capture-from-config.js`: main Playwright capture runner
- `templates/capture-config.template.json`: default auto-crawl template
- `capture-config.example.json`: fuller example with login and filters
- `CAPTURE_CONFIG_GUIDE.md`: extended configuration guide

## Config Modes

### 1) Crawl Mode (Default)

Use:

```json
{
  "baseUrl": "http://localhost:3000/",
  "crawl": { "enabled": true }
}
```

This mode auto-discovers internal links and captures each page.

### 2) Scenario Mode (Optional)

If you need explicit page actions and fixed screenshot files, provide `scenarios` and leave crawl disabled.

## Typical Commands

```bash
# install browser binaries (inside target project)
npm run capture:install

# run capture
npm run capture:site
```

## Notes

- Keep `sameOrigin: true` for safe internal crawling.
- Use `excludePatterns` to skip logout, signout, or asset-like URLs.
- Increase `maxPages` if your site is large.
