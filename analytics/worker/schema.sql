-- Vantage — D1 schema
-- Append-only event log. One row per beacon; the stats API aggregates on read.
-- At content-site scale (tens of thousands of pageviews/day) raw queries over an
-- indexed table are fine. See README for the daily-rollup path when you outgrow it.

CREATE TABLE IF NOT EXISTS events (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  ts       INTEGER NOT NULL,        -- unix ms, server-stamped
  site     TEXT    NOT NULL,        -- tenant id, e.g. 'dunkwise'
  type     TEXT    NOT NULL,        -- 'pv' | 'end'
  path     TEXT    NOT NULL,        -- normalized pathname
  visitor  TEXT,                    -- daily-rotating hash(ip+ua+site+salt); no cross-day tracking
  session  INTEGER DEFAULT 0,       -- 1 if this pv began a new session
  ref      TEXT,                    -- referrer host ('' = direct)
  source   TEXT,                    -- resolved channel: Direct / Google / utm / host
  utm      TEXT,
  country  TEXT,                    -- from Cloudflare edge (cf.country)
  device   TEXT,                    -- mobile | tablet | desktop (from UA + viewport)
  browser  TEXT,
  os       TEXT,
  -- engagement + vitals (populated by 'end' events)
  engaged  INTEGER,                 -- engaged ms
  depth    INTEGER,                 -- scroll depth %
  adblock  INTEGER,                 -- 1 = ad blocker detected
  lcp      INTEGER,                 -- Largest Contentful Paint (ms)
  cls      REAL,                    -- Cumulative Layout Shift
  inp      INTEGER                  -- Interaction to Next Paint (ms, approx)
);

CREATE INDEX IF NOT EXISTS idx_site_ts   ON events (site, ts);
CREATE INDEX IF NOT EXISTS idx_site_type ON events (site, type, ts);
CREATE INDEX IF NOT EXISTS idx_site_path ON events (site, path, ts);
