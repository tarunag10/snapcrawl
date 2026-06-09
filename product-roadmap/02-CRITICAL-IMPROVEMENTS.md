# 02 - Critical Improvements

This document tracks what still blocks Snapcrawl from feeling like a serious developer tool. Earlier gaps such as package metadata, config validation, tests, HTML reports, visual diffing, Storybook capture, AI analysis, and a GitHub Action now exist in the repo.

---

## Current P0: Keep the Core Trustworthy

### 1. Keep CI green before feature work

The stable verification path is:

```bash
npm test
npm run build
npm audit --omit=dev
```

Any new feature should include focused unit coverage around CLI parsing, config validation, report output, or file-safety behavior.

### 2. Treat duplicate files as release blockers

Finder-style copies such as `lib/report 2.js` and `tests/report.test 2.js` create ambiguity about the real source of truth. Remove byte-identical duplicates before implementing behavior changes.

### 3. Maintain safe defaults

The product should remain safe for real apps:

- Risky clicks are off by default.
- Script steps require `--allow-script-steps`.
- Auth values are redacted in reports.
- Config paths go through safe path checks.

---

## Current P1: Product Depth

### 4. Make CI review mode the default team workflow

`snapcrawl ci` now captures, diffs, writes `ci-report.html`, and exits with a threshold-aware status. Next improvements:

- Publish GitHub Action annotations.
- Upload reports as workflow artifacts.
- Add PR comment summaries.

### 5. Make reports feel like a review workspace

Reports now show review summaries, visual diffs, auth method summaries, and categorized AI findings. Next improvements:

- Add side-by-side before/current/diff panes.
- Add collapsible page groups.
- Add reviewer notes export.

### 6. Improve authenticated capture ergonomics

Capture and record configs support storage state, cookies files, headers files, and basic credentials. Next improvements:

- Add a `snapcrawl auth login` helper to save Playwright storage state.
- Add provider recipes for common auth setups.
- Add secret linting for accidentally committed auth files.

### 7. Deepen Storybook support

Storybook capture now supports text, tag, and changed-file filters. Next improvements:

- Capture only stories affected by changed component imports and dependencies.
- Add per-story metadata to reports.
- Add component-level baseline naming.

---

## Current P2: Packaging Polish

### 8. Type and API surface

The package now has engine, repository, exports, and basic declaration metadata. Next improvements:

- Introduce a small public programmatic API.
- Move shared types into generated declarations if the repo migrates to TypeScript.
- Add examples that import the API directly.

### 9. Changelog and release discipline

Before publishing:

- Add a changelog entry per release.
- Run `npm pack --dry-run`.
- Verify package files contain only intended runtime assets and docs.
