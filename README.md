# Universal Playwright Workflow Recorder (MP4)

Plug-and-play toolkit to drop into any web app codebase and auto-record an end-to-end workflow video.

It will:
- crawl internal pages,
- run polished visual interactions (hover, smooth scroll, smart click exploration),
- record the full journey with Playwright,
- export a final `.mp4` file,
- write an artifact report of visited pages and interactions.

## 1) Bootstrap Into Any Project

From this toolkit folder, run:

```bash
scripts/bootstrap-capture-kit.sh "/absolute/path/to/your-target-project"
```

This command auto-installs everything required in the target project:
- `playwright`
- `ffmpeg-static`
- Chromium browser binaries
- recorder script + config + npm scripts

## 2) Edit Config In Target Project

In target project root, edit:

```bash
open workflow-recorder.config.json
```

Minimum fields to check:
- `baseUrl` (your local app or hosted website URL)
- `setupSteps` (optional login/setup flow)

## 3) Run Recording

In target project root:

```bash
npm run workflow:record
```

Output:
- `output/workflow-recorder/*.mp4`
- `output/workflow-recorder/artifacts/WORKFLOW_REPORT.md`
- `output/workflow-recorder/artifacts/crawl.json`

## Headful Recording (Visible Browser)

```bash
npm run workflow:record:headful
```

## Core Files In This Toolkit

- `scripts/bootstrap-capture-kit.sh`
- `scripts/record-workflow.js`
- `templates/workflow-recorder.template.json`
- `CAPTURE_CONFIG_GUIDE.md`

## Notes

- Default mode is safe and avoids risky actions (delete/logout/payment-like clicks).
- To be more aggressive, set `workflow.allowRiskyActions` to `true`.
- Works for local apps (`http://localhost:*`) and hosted websites.
