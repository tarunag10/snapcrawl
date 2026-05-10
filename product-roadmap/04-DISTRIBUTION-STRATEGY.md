# 04 - Distribution Strategy

How to go from "scripts I copy into projects" to "a tool developers install and recommend."

---

## Phase 1: npm Package (Do This First)

### Target Architecture

```
snapcrawl/
  package.json          # name: "snapcrawl" (or chosen name)
  bin/
    cli.js              # #!/usr/bin/env node - CLI entry point
  lib/
    crawler.js          # Core crawl engine
    capturer.js         # Screenshot capture logic
    recorder.js         # Video recording logic
    reporter.js         # HTML + MD report generation
    config.js           # Config loading, validation, defaults
    steps.js            # Setup step runner
    browser.js          # Browser management
  templates/
    report.html         # HTML report template
    config.json         # Default config template
  README.md
  LICENSE
  CHANGELOG.md
```

### CLI Design

```bash
# Zero-config quick capture
npx snapcrawl https://example.com

# With config file
npx snapcrawl --config snapcrawl.config.json

# Subcommands
npx snapcrawl capture https://example.com     # Screenshots only
npx snapcrawl record https://example.com      # Video only
npx snapcrawl init                            # Interactive config setup
npx snapcrawl diff                            # Compare with baseline

# Common flags
--output, -o <dir>        # Output directory
--viewport, -v <preset>   # desktop | mobile | tablet | all
--format <type>           # png | jpg | webp | pdf
--headful                 # Show browser
--config, -c <path>       # Config file
--baseline                # Save as baseline for diff
--parallel <n>            # Number of parallel captures
--timeout <ms>            # Page load timeout
--auth-cookie <value>     # Quick auth
--verbose                 # Detailed logging
--json                    # Output results as JSON (for CI)
--quiet                   # Suppress output except errors
```

### Publishing to npm

```bash
# 1. Pick a name (check availability)
npm search snapcrawl

# 2. Create npm account
npm adduser

# 3. Publish
npm publish

# 4. Users can now run:
npx snapcrawl https://mysite.com
```

**Name availability matters.** Check npm for your chosen name before building. See `05-NAMING-AND-BRANDING.md`.

---

## Phase 2: GitHub Action

Create a GitHub Action so users can capture screenshots in CI:

```yaml
name: Visual Snapshots
on: [pull_request]

jobs:
  screenshots:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Start app
        run: npm start &

      - name: Wait for app
        run: npx wait-on http://localhost:3000

      - name: Capture screenshots
        uses: yourusername/snapcrawl-action@v1
        with:
          url: http://localhost:3000
          viewports: desktop,mobile
          max-pages: 20

      - name: Upload screenshots
        uses: actions/upload-artifact@v4
        with:
          name: screenshots-${{ github.sha }}
          path: output/

      - name: Comment on PR
        uses: actions/github-script@v7
        with:
          script: |
            // Post screenshot gallery as PR comment
```

**Publish on GitHub Marketplace** for discoverability.

---

## Phase 3: Additional Distribution Channels

### VS Code Extension

A VS Code extension that:
- Adds a "Capture Screenshots" command
- Shows screenshot preview in sidebar
- Auto-detects running dev server and offers to capture
- Inline config editing with autocomplete (JSON Schema)

### Docker Image

```bash
docker run --rm -v $(pwd)/output:/output snapcrawl https://example.com
```

Useful for CI environments that don't have Node.js or for capturing external sites.

### Homebrew (macOS)

```bash
brew install snapcrawl
```

Not critical but adds credibility and convenience for macOS users.

---

## Phase 4: Community & Growth

### Documentation Site

Use Astro, Docusaurus, or VitePress to build a docs site:
- Getting Started guide
- Config reference
- Recipes (login flow, SPA capture, CI setup)
- API reference (for programmatic use)
- Examples gallery

Host on GitHub Pages or Vercel (free).

### Example Gallery

Show real captures from popular open-source sites. This is both documentation and marketing:
- "Here's what snapcrawl produces for the Tailwind CSS docs"
- "Here's a 30-second demo video of a Next.js app"

### GitHub Stars Strategy

1. Post on Hacker News (Show HN)
2. Post on Reddit: r/webdev, r/javascript, r/node
3. Post on Twitter/X with demo GIF
4. Submit to awesome-nodejs lists
5. Write a blog post: "I built a free alternative to Percy"

---

## Programmatic API (For Advanced Users)

```javascript
const { capture, record } = require('snapcrawl');

// Screenshot capture
const result = await capture({
  url: 'https://example.com',
  viewports: ['desktop', 'mobile'],
  maxPages: 10,
  outputDir: './screenshots',
});

console.log(result.pages);       // [{ url, screenshots: [...] }]
console.log(result.reportPath);  // './screenshots/report.html'

// Video recording
const video = await record({
  url: 'https://example.com',
  outputPath: './demo.mp4',
  duration: 60,
});
```

This lets other tools build on top of yours (Webpack plugins, Vite plugins, testing frameworks).
