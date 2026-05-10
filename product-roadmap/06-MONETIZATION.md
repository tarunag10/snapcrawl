# 06 - Monetization

How to make money from this tool while keeping the core free and open source.

---

## Model: Open Core

The proven model for dev tools (GitLab, Sentry, PostHog, Supabase):

- **Free & open source:** CLI tool, screenshots, video, crawling, HTML reports
- **Paid:** Cloud features that require infrastructure

---

## Revenue Streams (Ranked by Feasibility)

### 1. Snapcrawl Cloud - Screenshot History & Sharing (SaaS)
**Revenue potential: $$$$ | Effort: High**

A web dashboard where users can:
- View screenshot history across deploys
- Share visual reports via link (no self-hosting)
- Get Slack/email alerts when pages change visually
- Team collaboration (comments on screenshots)
- Scheduled captures (daily/weekly)

**Pricing:**
| Tier | Price | Includes |
|------|-------|---------|
| Free | $0 | CLI only, local reports |
| Pro | $19/mo | Cloud history (30 days), sharing, 3 sites |
| Team | $49/mo | Unlimited sites, team access, 90-day history |
| Enterprise | $199/mo | SSO, audit log, 1-year history, priority support |

**Comparison:** Percy charges $99-399/mo. Chromatic charges $149+/mo. Undercut them significantly.

### 2. GitHub Action Marketplace (Usage-Based)
**Revenue potential: $$ | Effort: Medium**

Free for public repos. Charge for private repos or high-volume usage.

### 3. Consulting / Custom Setup
**Revenue potential: $$ | Effort: Low**

Offer paid setup for companies:
- "We'll configure snapcrawl for your app, including login flows, CI integration, and custom reports"
- $500-2000 per engagement

### 4. Sponsors & Donations
**Revenue potential: $ | Effort: Low**

- GitHub Sponsors
- Open Collective
- "Powered by Snapcrawl" badge in reports (links to your site)

### 5. Premium Plugins
**Revenue potential: $$ | Effort: Medium**

Free core + paid plugins:
- Lighthouse integration ($9/mo)
- Figma comparison ($19/mo)
- AI-powered testing ($29/mo)
- White-label reports (no branding) ($9/mo)

---

## Realistic First Steps

Don't build a SaaS on day one. Here's the order:

1. **Publish free CLI to npm** - build user base
2. **Add GitHub Sponsors** - low effort, some income
3. **Offer consulting** - learn what enterprise users need
4. **Build cloud dashboard** - only after 500+ GitHub stars and clear demand
5. **Charge for cloud** - freemium model

---

## Growth Metrics to Track

Before monetizing, you need:
- 100+ GitHub stars (credibility)
- 500+ weekly npm downloads (real usage)
- 10+ GitHub issues from real users (demand signal)
- 3+ companies using it in production (enterprise interest)

---

## Competitive Pricing Advantage

| Tool | Price | What You Get |
|------|-------|-------------|
| Percy | $99-399/mo | Cloud visual testing |
| Chromatic | $149+/mo | Storybook visual testing |
| Applitools | Custom pricing | AI visual testing |
| **Snapcrawl** | **Free** | Local screenshots + video + reports |
| **Snapcrawl Cloud** | **$19-49/mo** | + history, sharing, scheduling |

Your free tier already does more than most paid tools' base plans. That's a strong position.
