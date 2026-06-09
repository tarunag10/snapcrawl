# Product Roadmap: From Config Kit to Dev Tool

## What You Have Today

A **plug-and-play website screenshot + workflow recording toolkit** with a packaged CLI:

1. **snapcrawl capture** - Crawl-based multi-viewport screenshot capture
2. **snapcrawl record** - Full MP4 workflow video recording with smart interactions
3. **snapcrawl ci** - Baseline-aware visual review for CI
4. **snapcrawl storybook** - Storybook iframe capture with filters
5. **snapcrawl init** - Interactive config scaffolding

**Current strengths:**
- Config-driven (JSON) - no code to write
- Crawl + scenario dual modes
- Safety system (risky action filtering)
- Video recording with FFmpeg conversion
- npm package metadata and CLI binaries
- Authenticated capture via storage state, cookies, headers, and basic credentials
- Shareable HTML reports with visual diff and AI findings
- Smart interactions (hover sweep, scroll showcase, click exploration)

---

## How to Turn This Into a Real Dev Tool

Read each document in this folder:

| File | What It Covers |
|------|---------------|
| `01-COMPETITIVE-LANDSCAPE.md` | What exists, where you fit, gaps to exploit |
| `02-CRITICAL-IMPROVEMENTS.md` | Current trust, CI, report, auth, Storybook, and packaging priorities |
| `03-FEATURE-ROADMAP.md` | New features ranked by impact |
| `04-DISTRIBUTION-STRATEGY.md` | npm package, CLI, GitHub Actions, VS Code extension |
| `05-NAMING-AND-BRANDING.md` | Name ideas, positioning, tagline |
| `06-MONETIZATION.md` | How to make money from this |

---

## The One-Line Pitch

Your tool fills a gap: **zero-config website demo generation**. No existing tool auto-crawls a site, interacts with it intelligently, AND produces both screenshots + polished demo videos from a single JSON config.

BackstopJS does visual regression. Percy does cloud visual testing. Pageres does screenshots. But NONE of them produce demo videos with smart interactions. That's your niche.
