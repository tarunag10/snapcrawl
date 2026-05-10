# 03 - Feature Roadmap

Features ranked by **impact** (how much value it adds) vs **effort** (how hard to build).

---

## Tier 1: High Impact, Low-Medium Effort (Build First)

### 1. Proper CLI with `npx` support
**Impact: 10/10 | Effort: Medium**

This is THE most important change. Instead of copying scripts, users should run:

```bash
npx snapcrawl https://mysite.com
npx snapcrawl --config capture.json
npx snapcrawl record https://mysite.com --output demo.mp4
```

This requires:
- A `package.json` with a `bin` field
- A CLI entry point using `commander` or `yargs`
- Publishing to npm

**Why it matters:** Every successful dev tool (prettier, eslint, vite) is an npm package you run with `npx`. Nobody copies shell scripts anymore.

### 2. `npx snapcrawl init` - Interactive config generator
**Impact: 8/10 | Effort: Low**

Instead of editing JSON by hand, offer an interactive setup:

```
$ npx snapcrawl init
? Base URL: http://localhost:3000
? What do you want to capture?
  [x] Screenshots (multi-viewport)
  [x] Demo video (MP4)
  [ ] Visual diff (compare with baseline)
? Viewports:
  [x] Desktop (1440x900)
  [x] Mobile (430x932)
  [x] Tablet (768x1024)
? Does your app require login? (y/N)
? Max pages to crawl: 30

Created: snapcrawl.config.json
Run: npx snapcrawl
```

### 3. HTML Report with Thumbnail Gallery
**Impact: 9/10 | Effort: Medium**

Instead of just a markdown file, generate an HTML report:
- Thumbnail grid of all screenshots
- Click to expand full-size
- Filter by viewport (desktop/mobile/tablet)
- Side-by-side comparison of viewports
- Embedded video player for the MP4
- Page list with clickable links

This is a **killer feature** - no other free tool does this. Users can share the HTML file with clients, teammates, or stakeholders.

### 4. Visual Diff / Baseline Comparison
**Impact: 9/10 | Effort: Medium-High**

```bash
# First run: saves baseline
npx snapcrawl --baseline

# Later run: compares against baseline
npx snapcrawl --diff
```

Output: a diff report showing which pages changed, with pixel-diff overlays. This is what BackstopJS does, but your version includes auto-crawling (no manual URL lists).

### 5. Parallel Page Capture
**Impact: 7/10 | Effort: Medium**

Currently captures pages sequentially. Open multiple browser contexts and capture in parallel. For a 30-page site with 3 viewports, this could go from 90s to 20s.

---

## Tier 2: High Impact, High Effort (Build After v1)

### 6. GitHub Action
**Impact: 9/10 | Effort: Medium**

```yaml
# .github/workflows/screenshots.yml
- uses: yourusername/snapcrawl-action@v1
  with:
    url: http://localhost:3000
    config: snapcrawl.config.json
- uses: actions/upload-artifact@v4
  with:
    name: screenshots
    path: output/
```

Auto-capture screenshots on every PR. Upload as artifacts or post as PR comments. This is how Percy and Chromatic work, but free and self-hosted.

### 7. Watch Mode
**Impact: 7/10 | Effort: Medium**

```bash
npx snapcrawl --watch
```

Watches for file changes in the project, re-captures affected pages. Useful during development.

### 8. PDF Export
**Impact: 6/10 | Effort: Low**

```bash
npx snapcrawl --format pdf
```

Generate a PDF with all screenshots. Useful for client handoffs, documentation, and design reviews.

### 9. Authenticated Crawling (Cookie/Token)
**Impact: 8/10 | Effort: Medium**

Beyond the current `setupSteps`, add first-class support for:
- Cookie injection: `"auth": { "cookies": [{ "name": "session", "value": "abc123" }] }`
- Header injection: `"auth": { "headers": { "Authorization": "Bearer xyz" } }`
- `.env` variable interpolation in config: `"value": "${LOGIN_PASSWORD}"`

### 10. Sitemap.xml Integration
**Impact: 6/10 | Effort: Low**

```json
{
  "crawl": {
    "source": "sitemap",
    "sitemapUrl": "https://mysite.com/sitemap.xml"
  }
}
```

Instead of crawling links, read the sitemap for the URL list. Many production sites have sitemaps - this is faster and more complete.

---

## Tier 3: Medium Impact (Build for v2+)

### 11. Plugin System

Let users write plugins:
```javascript
// snapcrawl-plugin-lighthouse.js
module.exports = {
  afterCapture(page, url) {
    // run Lighthouse audit on each page
  }
}
```

Plugin ideas: Lighthouse scores, accessibility audit, SEO check, broken link detection, performance metrics.

### 12. Cloud Dashboard (SaaS Potential)

A web UI where users can:
- View screenshot history over time
- Compare visual changes across deploys
- Share reports with team/clients via link
- Set up scheduled captures

This is the monetization path (see `06-MONETIZATION.md`).

### 13. AI-Powered Interaction Discovery

Use an LLM to analyze the page and decide what to click, fill in forms intelligently, explore modals. Much smarter than the current heuristic-based approach.

### 14. Storybook Integration

Auto-capture every Storybook story. This directly competes with Chromatic (which charges $149+/month).

### 15. Figma Comparison

Upload screenshots and compare against Figma designs. Show pixel-diff between implementation and design files.

---

## Suggested Release Plan

| Version | Milestone | Key Features |
|---------|-----------|-------------|
| **v0.1** | "It Works" | npm package, CLI, `npx snapcrawl <url>`, config validation |
| **v0.2** | "It's Useful" | HTML report, `init` command, parallel capture |
| **v0.3** | "It's Professional" | Visual diff, watch mode, PDF export |
| **v1.0** | "It's a Product" | GitHub Action, auth support, sitemap integration |
| **v2.0** | "It's a Platform" | Plugin system, cloud dashboard, AI interactions |
