# Snapcrawl — Universal Website Screenshot & Video Recorder

Plug-and-play toolkit to drop into any web app codebase and automatically capture multi-viewport screenshots and polished MP4 demo videos.

**What it does:**

- Crawls internal pages via BFS link discovery
- Captures screenshots at multiple viewports (desktop, tablet, mobile)
- Runs polished visual interactions (hover, smooth scroll, smart click exploration)
- Records the full journey as an MP4 video via Playwright
- Generates markdown reports of visited pages and interactions
- Avoids destructive actions (delete, logout, payment clicks) by default

## Quick Start

### 1) Bootstrap Into Any Project

From this toolkit folder:

```bash
scripts/bootstrap-capture-kit.sh "/absolute/path/to/your-target-project"
```

This auto-installs everything in the target project:

- `playwright` + `ffmpeg-static`
- Chromium browser binaries
- `scripts/record-workflow.js` (video recorder)
- `scripts/capture-from-config.js` (screenshot capture)
- `lib/shared.js` (shared utilities)
- Config files + npm scripts

### 2) Edit Config In Target Project

```bash
open workflow-recorder.config.json   # for video recording
open capture-config.json             # for screenshots
```

Minimum fields to check:

- `baseUrl` — your local app or hosted website URL
- `setupSteps` — optional login/setup flow

### 3) Run

```bash
npm run workflow:record          # Record MP4 demo video (headless)
npm run workflow:record:headful  # Record MP4 with visible browser
npm run capture:screenshots      # Capture multi-viewport screenshots
```

### Output

| Command | Output |
|---------|--------|
| `workflow:record` | `output/workflow-recorder/*.mp4`, `artifacts/WORKFLOW_REPORT.md`, `artifacts/crawl.json` |
| `capture:screenshots` | `output/social/*.png`, `WORKFLOW.md` |

### CLI Help

```bash
node scripts/record-workflow.js --help
node scripts/capture-from-config.js --help
```

## Core Files

```
lib/shared.js                              # Shared utilities (browser, crawl, steps)
scripts/record-workflow.js                 # MP4 workflow recorder
scripts/capture-from-config.js             # Multi-viewport screenshot capture
scripts/bootstrap-capture-kit.sh           # One-command project setup
templates/workflow-recorder.template.json  # Video recorder config template
templates/capture-config.template.json     # Screenshot config template
CAPTURE_CONFIG_GUIDE.md                    # Full config schema reference
```

## Supported Setup Step Types

Both scripts support these step types in `setupSteps` / `scenarios[].steps`:

| Type | Description | Example |
|------|-------------|---------|
| `goto` | Navigate to URL | `{ "type": "goto", "url": "https://..." }` |
| `fill` | Fill input field | `{ "type": "fill", "selector": "#email", "value": "demo@test.com" }` |
| `click` | Click element | `{ "type": "click", "selector": "button[type='submit']" }` |
| `press` | Press keyboard key | `{ "type": "press", "selector": "#input", "key": "Enter" }` |
| `check` | Toggle checkbox | `{ "type": "check", "selector": "#agree", "value": true }` |
| `scroll` | Scroll to position | `{ "type": "scroll", "x": 0, "y": 500 }` |
| `wait` | Wait milliseconds | `{ "type": "wait", "ms": 1000 }` |
| `waitForSelector` | Wait for element | `{ "type": "waitForSelector", "selector": ".loaded" }` |
| `evaluate` | Run JS in page | `{ "type": "evaluate", "script": "document.title" }` |
| `call` | Call window function | `{ "type": "call", "fn": "initApp", "args": [] }` |
| `setById` | Set element value by ID | `{ "type": "setById", "id": "name", "value": "Test" }` |

## Safety

- `allowRiskyActions: false` (default) avoids destructive or payment-like clicks
- Excludes paths like `/logout`, `/signout`, `/delete`, `/remove`, `/destroy`
- Filters button text containing: delete, remove, pay, purchase, checkout, etc.
- Set `allowRiskyActions: true` only when you explicitly want deep workflow traversal

---

## Roadmap: Planned Features

### Zero-Install Distribution

**Goal:** `npx snapcrawl` works instantly with no pre-install steps.

| Feature | Status | Description |
|---------|--------|-------------|
| System Chrome fallback | **Done** | Use `channel: 'chrome'` to skip Chromium download — uses already-installed Chrome/Edge |
| Single-file bundle | Planned | Bundle with `@vercel/ncc` or `esbuild` so `npx` downloads one small file, not a dependency tree |
| `npm create snapcrawl` | Planned | Interactive scaffolder (like `create-react-app`) to set up configs in any project |
| GitHub Action | Planned | `uses: snapcrawl/action@v1` for CI screenshot capture on every PR |
| Docker image | Planned | `docker run snapcrawl` with Playwright + Chrome pre-installed |
| Homebrew tap | Planned | `brew install snapcrawl` for macOS users |

### AI-Powered Screenshot Analysis

**Goal:** After capturing screenshots, optionally analyze them with vision AI to detect issues, generate descriptions, and audit accessibility — all from the CLI.

| Feature | Status | Description |
|---------|--------|-------------|
| `--ai-analyze` flag | Planned | Send each screenshot to a vision LLM (Claude, GPT-4o, Gemini) for automated analysis |
| UI issue detection | Planned | AI identifies broken layouts, overlapping elements, truncated text, missing images |
| Auto-generated alt text | Planned | AI writes descriptive alt text for every captured page |
| Accessibility audit | Planned | AI detects contrast issues, missing labels, keyboard traps, WCAG violations |
| Page descriptions | Planned | AI generates human-readable summaries of what each page shows |
| ARIA snapshot capture | Planned | Capture Playwright accessibility tree snapshots alongside screenshots for semantic regression testing |

### AI Visual Regression Testing

**Goal:** Replace brittle pixel-diff with AI-powered visual comparison that understands intent.

| Feature | Status | Description |
|---------|--------|-------------|
| `--diff` baseline comparison | Planned | Compare current screenshots against a saved baseline |
| AI-powered diff | Planned | Vision AI determines if changes are intentional (button moved 2px = OK) vs broken (checkout button missing = critical) |
| Baseline management | Planned | `snapcrawl baseline save` / `snapcrawl baseline update` workflow |
| CI integration | Planned | Fail PR checks when AI detects visual regressions |

### AI Smart Crawling

**Goal:** Go beyond BFS link discovery — use AI to understand SPAs, trigger interactive states, and capture more of the app.

| Feature | Status | Description |
|---------|--------|-------------|
| SPA-aware navigation | Planned | Detect React Router, Next.js, and framework-specific navigation that doesn't use `<a>` tags |
| Auto-detect interactive states | Planned | AI identifies dropdowns, modals, accordions, tabs and captures each state |
| Auto-generate setup steps | Planned | AI observes page structure and generates config steps for login flows, form fills, etc. |
| Playwright Test Agents | Planned | Leverage Playwright 1.56+ AI test agents for autonomous navigation with planner/generator/healer loops |

### AI Video Enhancements

**Goal:** Transform raw screen recordings into polished demo videos.

| Feature | Status | Description |
|---------|--------|-------------|
| AI highlight reel | Planned | Auto-trim boring scroll sections, keep key interactions |
| Auto-generated timestamps | Planned | AI creates chapter markers for each page/interaction in the video |
| Text summary of demo | Planned | AI generates a written walkthrough from the video content |

### Reporting & Output

| Feature | Status | Description |
|---------|--------|-------------|
| HTML report with thumbnails | Planned | Visual gallery report instead of markdown list |
| Playwright trace capture | Planned | Capture Playwright trace files alongside video for deep debugging |
| JSON + HTML diff reports | Planned | Structured output for CI pipelines and dashboards |

### Developer Experience

| Feature | Status | Description |
|---------|--------|-------------|
| Config validation with schema | Planned | JSON Schema validation with clear error messages for bad configs |
| Structured/colored CLI output | Planned | Progress bars, phase markers, colored summaries |
| Parallel page capture | Planned | Capture multiple pages concurrently for faster runs |
| Global timeout | Planned | `--timeout` flag to prevent infinite crawls on large sites |
| Windows support | Planned | Cross-platform bootstrap (replace bash-only script with Node.js) |

---

## Competitive Positioning

| Capability | Percy ($199/mo) | Chromatic ($149/mo) | Applitools (Enterprise) | **Snapcrawl (Free)** |
|-----------|----------------|--------------------|-----------------------|---------------------|
| Auto-crawl discovery | No | No | No | Yes |
| Multi-viewport screenshots | Yes | Yes | Yes | Yes |
| MP4 video recording | No | No | No | Yes |
| AI screenshot analysis | No | No | Partial | Planned |
| AI visual regression | No | No | Yes | Planned |
| Accessibility audit (AI+ARIA) | No | No | Partial | Planned |
| Zero-install CLI (`npx`) | No | No | No | Planned |
| Self-hosted / free | No | No | No | Yes |
| Config-driven, no code | No | No | No | Yes |

---

## License

MIT
