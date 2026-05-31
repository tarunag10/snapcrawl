# 02 - Critical Improvements to Current Code

These are issues that would prevent developers from taking the tool seriously. Fix these before adding new features.

---

## P0: Must Fix

### 1. No package.json in the toolkit itself

Your toolkit has no `package.json`. Users can't `npm install` it. There's no dependency management, no version number, no entry point.

**Fix:** Add a proper `package.json` with:
- `name`, `version`, `description`, `license`, `repository`
- `bin` field pointing to a CLI entry point
- `dependencies` listing `playwright` and `ffmpeg-static`
- `engines` field requiring Node >= 18

### 2. No error handling for missing dependencies

If a user runs `capture-from-config.js` without Playwright installed, they get a raw Node.js `MODULE_NOT_FOUND` error. Same for `ffmpeg-static`.

**Fix:** Add a dependency check at the top of each script:
```javascript
try {
  require.resolve('playwright');
} catch {
  console.error('Missing dependency: playwright. Run: npm install playwright');
  process.exit(1);
}
```

### 3. No config validation / schema

If a user puts an invalid value in the JSON config (e.g., `"maxPages": "banana"`), the tool silently does something weird instead of telling them.

**Fix:** Add JSON Schema validation or at minimum a `validateConfig()` function that checks types, ranges, required fields, and prints clear errors.

### 4. Two separate scripts with duplicated logic

`capture-from-config.js` and `record-workflow.js` share ~60% of their logic (URL normalization, pattern matching, crawling, step running) but are completely separate files. This makes maintenance painful.

**Fix:** Extract shared logic into a `lib/` folder:
```
lib/
  crawler.js       # URL normalization, link collection, crawl loop
  steps.js         # Step runner (fill, click, wait, etc.)
  config.js        # Config loading, validation, merging
  browser.js       # Browser launch, viewport management
  reporter.js      # Markdown report generation
```

### 5. No `--help` flag

Running `node scripts/capture-from-config.js --help` does nothing. Running with no args gives a confusing JSON parse error.

**Fix:** Add `--help` that prints usage, available flags, and example commands.

### 6. Console output is unstructured

Output is just raw file paths printed to stdout. No progress indicators, no summary, no timing.

**Fix:** Add structured output:
```
[snapcrawl] Starting capture of http://localhost:3000
[snapcrawl] Crawling... found 12 pages
[snapcrawl] Capturing page 1/12: /home (3 viewports)
[snapcrawl] Capturing page 2/12: /about (3 viewports)
...
[snapcrawl] Done! 36 screenshots saved to output/social/
[snapcrawl] Report: output/social/WORKFLOW.md
[snapcrawl] Completed in 24.3s
```

---

## P1: Should Fix

### 7. No TypeScript / JSDoc types

The entire codebase is untyped JavaScript. For a dev tool, this hurts credibility and makes contributing harder.

**Fix (lightweight):** Add JSDoc type annotations to all functions. This gives type checking in VS Code without needing a build step.

**Fix (full):** Migrate to TypeScript. This is the standard for serious dev tools in 2025+.

### 8. No tests

Zero tests. A dev tool with no tests tells potential users "this might break at any time."

**Fix:** Add tests for the core logic:
- URL normalization
- Pattern matching (include/exclude)
- Config validation
- Step runner (mock page object)
- Crawl queue logic

Use Playwright's own test runner or Vitest.

### 9. Bootstrap script is bash-only

`bootstrap-capture-kit.sh` won't work on Windows. This cuts out a huge chunk of developers.

**Fix:** Rewrite as a Node.js script (`bootstrap.js`) or provide both. Better yet, make the tool an npm package so bootstrap isn't needed at all.

### 10. Hardcoded file naming conventions

Screenshot filenames like `001-home-desktop-full.png` are rigid. Users can't customize the naming pattern.

**Fix:** Add a `fileNamePattern` config option:
```json
{
  "fileNamePattern": "{index}-{slug}-{viewport}"
}
```

### 11. No progress callback / event system

The scripts just print to console. There's no way to integrate them into other tools, CI pipelines, or UIs.

**Fix:** Export the core functions as a module and emit events:
```javascript
const capture = require('snapcrawl');
capture.on('page', (info) => { /* update progress bar */ });
capture.on('screenshot', (info) => { /* process image */ });
capture.on('done', (summary) => { /* send report */ });
```

---

## P2: Nice to Fix

### 12. No `.editorconfig` or linting

No consistent code style enforcement.

### 13. No LICENSE file

No license = legally unusable for most companies.

### 14. `.gitignore` is minimal

Missing common patterns: `*.log`, `.env`, `dist/`, `coverage/`, etc.

### 15. No CHANGELOG

Users need to know what changed between versions.
