# Vantage

Cookieless, privacy-first analytics for **ad-monetized content sites** — built on the
Dunkwise design system. Where GA4 and Plausible center *pageviews*, Vantage centers the
metric an ad publisher actually lives on: **engaged audience and the things that leak ad
revenue** — adblock rate, Core Web Vitals (ad scripts wreck these, and Google demotes slow
pages), scroll depth, and views-per-visit.

No cookies → **no consent banner required**. No persistent device id: unique visitors are
derived from a daily-rotating salted hash of IP+UA+site that resets every day, so nothing
follows a visitor across days or between sites.

```
analytics/
├── tracker/v.js          # ~1KB script the site embeds
├── worker/               # Cloudflare Worker + D1 (ingest + stats API)
│   ├── src/index.js
│   ├── schema.sql
│   └── wrangler.toml
└── dashboard/            # sidebar dashboard (static; Dunkwise design tokens)
    ├── index.html        # shell: left sidebar + main column
    ├── dashboard.css
    └── dashboard.js      # views: Overview · Content · Acquisition · Performance
```

## What v1 measures

| Metric | Why it matters to an ad site |
| --- | --- |
| Pageviews, visitors, views/visit | Ad inventory. More pages per visit = more impressions monetized. |
| Traffic sources | Which channels bring monetizable traffic (organic search is gold). |
| Top content | Which pages/topics actually pull the audience. |
| **Adblock rate** | A direct, quantified revenue leak most owners never measure. |
| **Core Web Vitals (p75)** | Ad scripts blow up LCP/INP/CLS; Google demotes slow pages → less traffic → less revenue. |
| Engaged time, scroll depth | Proxy for viewability of lower ad slots. |
| Devices, countries | Fill rate and CPMs vary hugely by both. |

**Revenue/RPM is intentionally deferred to v2** — the schema and dashboard leave room for it
(manual daily entry, then ad-network APIs). See "Roadmap".

## Deploy (about 10 minutes)

### 1. Backend — Cloudflare Worker + D1

```bash
cd analytics/worker
npm i -g wrangler && wrangler login

# Create the database, then paste the printed database_id into wrangler.toml
wrangler d1 create vantage
wrangler d1 execute vantage --remote --file=./schema.sql

# Set a long random SALT and (optionally) lock ALLOWED_ORIGINS to your dashboard host
wrangler deploy
```

You'll get a URL like `https://vantage.<you>.workers.dev`.

### 2. Tracker — embed on each site

Host `tracker/v.js` anywhere (or from the worker) and add one tag to the site's `<head>`:

```html
<script defer
        data-site="dunkwise"
        data-api="https://vantage.<you>.workers.dev"
        src="/v.js"></script>
```

Use a distinct `data-site` per property (`dunkwise`, `six-spins`, …) — that's the tenant key.

### 3. Dashboard — point it at the worker

In `dashboard/dashboard.js`, set:

```js
const CONFIG = { api: 'https://vantage.<you>.workers.dev', /* … */ };
```

Then host the `dashboard/` folder as static files (GitHub Pages, the same worker, anywhere).
It links the shared tokens at `/ds/tokens.css` — keep that path resolvable, or copy the file
in. Left with `api: ''`, the dashboard renders a realistic **demo dataset** so you can see the
design before wiring collection.

Register a new site by adding it to `CONFIG.sites` and using its id as `data-site`.

## Design

A persistent left **sidebar** (brand · site switcher · report nav) with a main column whose
top bar carries the view title, a live "online now" pill, and the date-range control. Four
report views — **Overview, Content, Acquisition, Performance** — switch in place.

Restrained editorial, straight from the Dunkwise system: one accent (coral) used only on the
live element, the primary chart line, and active nav/controls; warm paper/ink ramp; flat
hairline cards; Schibsted Grotesk for display, Geist Mono for every label and datum; light +
dark via the shared tokens. No emoji, no rainbow categorical colors — semantic status colors
(good/warn/crit) appear only on Core Web Vitals and KPI deltas, where they carry meaning.

## Roadmap

- **v2 — revenue.** Manual daily RPM/revenue entry → per-content **session RPM** (pageviews ×
  RPM), the north-star for ad sites. Then AdSense/Ezoic/Mediavine API pulls.
- **Scale.** Raw-event queries in D1 are fine into the tens of thousands of pageviews/day. Past
  that, add a daily rollup table (Worker Cron) and query rollups for wide ranges.
- **UTM / campaign** drill-down, referrer paths, and an "ad-revenue at risk from CWV" callout.

## Privacy notes

No cookies or localStorage identifiers are used for tracking (sessionStorage holds only a
per-tab "new session" flag that dies with the tab). The tracker honors Do Not Track. Only a
path, referrer *host*, coarse device/country, and vitals are collected — no full URLs with
query strings, no PII. This is designed to run without a consent banner in most jurisdictions,
but confirm against your own legal requirements.
