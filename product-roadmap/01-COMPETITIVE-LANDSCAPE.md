# 01 - Competitive Landscape

## Direct Competitors (with real numbers)

### Visual Regression / Screenshot Tools

| Tool | GitHub Stars | npm Weekly DLs | Distribution | Weakness vs. You |
|------|-------------|---------------|-------------|-----------------|
| **BackstopJS** | ~6,700 | ~50K | npm CLI | No video, no auto-crawling, requires manual URL list |
| **Pageres** (Sindre Sorhus) | ~9,600 | ~5-10K | npm CLI + API | No crawling, no video, no interactions, Puppeteer-based |
| **capture-website** (Sindre Sorhus) | ~1,800 | ~25K | npm CLI + API | Single URL at a time, no crawl, no video |
| **Percy** (BrowserStack) | ~400 (CLI) | ~130K | SaaS ($$$) | Paid cloud service, no local use, no demo video |
| **Chromatic** (Storybook) | ~300 (CLI) | ~450K | SaaS ($$$) | Storybook-only, no full-site crawl, paid |
| **Lost Pixel** | ~1,300 | ~2-3K | npm + GH Action | No auto-crawling, no video, manual URL list |
| **jest-image-snapshot** | ~3,800 | ~275K | npm library | Low-level primitive, requires writing Jest tests |
| **Loki** | ~1,800 | ~6K | npm | Storybook-only, no arbitrary URL support |
| **Playwright** (built-in) | ~68,000+ | ~6M+ | Library API | Requires writing code, no config-driven workflow |
| **Puppeteer** (built-in) | ~89,000+ | ~3.5M+ | Library API | Same - requires custom code for each screenshot |

### Video / Recording Tools

| Tool | GitHub Stars | Distribution | Weakness vs. You |
|------|-------------|-------------|-----------------|
| **rrweb** | ~17,000+ | npm library | DOM replay format (not MP4), must embed JS in target site |
| **Playwright Video** | (built-in) | Library API | Requires code, no smart interactions, outputs WebM only |
| **Cypress Video** | (built-in) | Built into Cypress | Only records test suites, no auto-crawl |
| **Sitespeed.io** | ~5,000+ | npm + Docker | Performance-focused, not UX showcase, complex setup |

### Site Crawling Tools (No Visual Capture)

| Tool | What It Does | Weakness vs. You |
|------|-------------|-----------------|
| **Sitemap generators** | Crawl and list URLs | No screenshots, no video |
| **Screaming Frog** | SEO crawling ($$$) | SEO-focused, no visual capture |
| **Lighthouse** (~28K stars) | Web quality audits | Single page, audit-focused, no crawl or interaction video |

---

## Your Unique Position

**No tool combines all three: auto-crawl + multi-viewport screenshots + demo video recording.**

```
                    Screenshots    Video    Auto-Crawl    Smart Interactions    Config-Driven    Free/Local
BackstopJS             yes          no         no              no                   yes             yes
Pageres                yes          no         no              no                   yes             yes
Percy                  yes          no         no              no                   yes (CI)        NO (SaaS)
Chromatic              yes          no         no              no                   yes (CI)        NO (SaaS)
Lost Pixel             yes          no         no              no                   yes             yes
rrweb                  no           replay     no              no                   no              yes
Sitespeed.io           yes          yes*       yes*            no                   yes             yes
YOUR TOOL              YES          YES        YES             YES                  YES             YES
```
*Sitespeed.io crawls for performance metrics, not UX showcase. Its video shows page load filmstrips, not interactive walkthroughs.

---

## 5 Market Gaps You Can Own

1. **Demo Video Generation** - "I need a polished walkthrough video of my app for investors/docs/marketing" - NOBODY does this automated
2. **Portfolio Screenshots** - "I need screenshots of my web project at every viewport for my portfolio" - Pageres is closest but Puppeteer-based and unmaintained
3. **QA Visual Audit** - "Show me every page of my app at desktop/tablet/mobile" - BackstopJS does this but requires manual URL lists
4. **Onboarding Docs** - "Auto-generate visual docs of every page in my app" - Zero tools do this
5. **CI Visual Snapshots** - "On every deploy, capture what the whole site looks like" - Percy does this but costs $99-399/mo

---

## Potential Threats

| Threat | Risk | Why |
|--------|------|-----|
| Playwright ships a crawl+screenshot CLI | Medium | Microsoft could, but they focus on test infra not turnkey tools |
| BackstopJS adds crawling | Low | Stable scope, unlikely to change direction |
| Percy/Chromatic go local-first | Low | Their business model depends on cloud |
| AI testing tools (Shortest, Momentic) | Medium-long | May eventually auto-explore sites, but focus on test generation |
| Someone wraps Playwright similarly | Medium | Low barrier, but your head start + feature combo matters |

---

## Key Insight

The paid tools (Percy $99-399/mo, Chromatic $149+/mo, Applitools custom pricing) charge per-seat/per-snapshot. Your tool is free, local, and privacy-respecting (no screenshots sent to cloud). That's a real advantage for:
- Indie developers
- Agencies managing many client sites
- Companies with sensitive/internal apps
- Open-source projects with no budget
