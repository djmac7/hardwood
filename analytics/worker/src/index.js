/* Vantage — Cloudflare Worker
 * Ingests tracker beacons into D1 and serves an aggregating stats API.
 * Endpoints:
 *   POST /e            — event ingest (called by v.js)
 *   GET  /api/stats    — aggregated metrics for the dashboard  ?site=&range=7d
 *   GET  /api/realtime — active visitors + last-30-min sparkline ?site=
 *   GET  /v.js         — serve the tracker script (optional convenience)
 */

const BOT = /bot|crawl|spider|slurp|bing|yandex|baidu|duckduckbot|preview|facebookexternal|headless|lighthouse|gtmetrix|pingdom|uptime|monitor|curl|wget|python-requests|axios|node-fetch/i;

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const cors = corsHeaders(req, env);

    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    try {
      if (url.pathname === '/e' && req.method === 'POST') return ingest(req, env, cors);
      if (url.pathname === '/api/stats') return stats(url, env, cors);
      if (url.pathname === '/api/realtime') return realtime(url, env, cors);
      if (url.pathname === '/v.js') return tracker(env, cors);
      if (url.pathname === '/') return json({ ok: true, service: 'vantage' }, cors);
    } catch (err) {
      return json({ error: String(err && err.message || err) }, cors, 500);
    }
    return new Response('Not found', { status: 404, headers: cors });
  }
};

/* ------------------------------------------------------------------ ingest */

async function ingest(req, env, cors) {
  const ua = req.headers.get('user-agent') || '';
  // Drop bots before they touch the database — they don't view ads.
  if (BOT.test(ua)) return new Response(null, { status: 202, headers: cors });

  let b;
  try { b = await req.json(); } catch { return json({ error: 'bad body' }, cors, 400); }
  if (!b || !b.s || !b.t) return json({ error: 'missing fields' }, cors, 400);

  const cf = req.cf || {};
  const ip = req.headers.get('cf-connecting-ip') || '';
  const now = Date.now();
  const path = normPath(b.u || '/');

  if (b.t === 'pv') {
    const uaInfo = parseUA(ua, b.w);
    const source = resolveSource(b.r || '', b.c || '');
    const visitor = await hashVisitor(ip, ua, b.s, env.SALT);
    await env.DB.prepare(
      `INSERT INTO events (ts,site,type,path,visitor,session,ref,source,utm,country,device,browser,os)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`
    ).bind(
      now, b.s, 'pv', path, visitor, b.ns ? 1 : 0,
      b.r || '', source, b.c || '', cf.country || '',
      uaInfo.device, uaInfo.browser, uaInfo.os
    ).run();
    return new Response(null, { status: 202, headers: cors });
  }

  if (b.t === 'end') {
    await env.DB.prepare(
      `INSERT INTO events (ts,site,type,path,engaged,depth,adblock,lcp,cls,inp)
       VALUES (?,?,?,?,?,?,?,?,?,?)`
    ).bind(
      now, b.s, 'end', path,
      int(b.e), int(b.d), b.ab ? 1 : 0,
      int(b.lcp), num(b.cls), int(b.inp)
    ).run();
    return new Response(null, { status: 202, headers: cors });
  }

  return json({ error: 'unknown type' }, cors, 400);
}

/* ------------------------------------------------------------------- stats */

async function stats(url, env, cors) {
  const site = url.searchParams.get('site');
  if (!site) return json({ error: 'site required' }, cors, 400);
  const range = url.searchParams.get('range') || '7d';
  const { from, to, bucket, prevFrom } = window(range);
  const DB = env.DB;

  const q = (sql, ...args) => DB.prepare(sql).bind(...args);

  // Headline totals for the current and previous period (for deltas).
  const totalsSql =
    `SELECT COUNT(*) pv, COUNT(DISTINCT visitor) vis, SUM(session) sess
       FROM events WHERE site=? AND type='pv' AND ts>=? AND ts<?`;
  const engSql =
    `SELECT AVG(engaged) eng,
            AVG(adblock)*100 ab,
            AVG(CASE WHEN engaged<10000 AND depth<25 THEN 1 ELSE 0 END)*100 bounce
       FROM events WHERE site=? AND type='end' AND ts>=? AND ts<?`;

  const [cur, prev, eng, series, pages, sources, devices, countries, vitals] = await Promise.all([
    q(totalsSql, site, from, to).first(),
    q(totalsSql, site, prevFrom, from).first(),
    q(engSql, site, from, to).first(),
    q(`SELECT (ts/?) b, COUNT(*) pv, COUNT(DISTINCT visitor) vis
         FROM events WHERE site=? AND type='pv' AND ts>=? AND ts<?
         GROUP BY b ORDER BY b`, bucket, site, from, to).all(),
    q(`SELECT p.path, p.pv, e.eng FROM
         (SELECT path, COUNT(*) pv FROM events WHERE site=? AND type='pv' AND ts>=? AND ts<?
            GROUP BY path ORDER BY pv DESC LIMIT 12) p
         LEFT JOIN
         (SELECT path, AVG(engaged) eng FROM events WHERE site=? AND type='end' AND ts>=? AND ts<?
            GROUP BY path) e ON e.path=p.path
         ORDER BY p.pv DESC`, site, from, to, site, from, to).all(),
    q(`SELECT source, COUNT(DISTINCT visitor) vis FROM events
         WHERE site=? AND type='pv' AND ts>=? AND ts<?
         GROUP BY source ORDER BY vis DESC LIMIT 10`, site, from, to).all(),
    q(`SELECT device, COUNT(*) pv FROM events
         WHERE site=? AND type='pv' AND ts>=? AND ts<?
         GROUP BY device ORDER BY pv DESC`, site, from, to).all(),
    q(`SELECT country, COUNT(DISTINCT visitor) vis FROM events
         WHERE site=? AND type='pv' AND ts>=? AND ts<? AND country<>''
         GROUP BY country ORDER BY vis DESC LIMIT 8`, site, from, to).all()
      .catch(() => ({ results: [] })),
    p75Vitals(DB, site, from, to)
  ]);

  const pv = cur.pv || 0, prevPv = prev.pv || 0;
  return json({
    site, range,
    range_from: from, range_to: to, bucket,
    totals: {
      pageviews: pv,
      visitors: cur.vis || 0,
      sessions: cur.sess || 0,
      views_per_visit: cur.vis ? +(pv / cur.vis).toFixed(2) : 0,
      engaged_ms: Math.round(eng.eng || 0),
      bounce_rate: +(eng.bounce || 0).toFixed(1),
      adblock_rate: +(eng.ab || 0).toFixed(1)
    },
    deltas: {
      pageviews: pct(pv, prevPv),
      visitors: pct(cur.vis || 0, prev.vis || 0),
      sessions: pct(cur.sess || 0, prev.sess || 0)
    },
    series: fillSeries(series.results, from, to, bucket),
    top_pages: pages.results.map(r => ({ path: r.path, pageviews: r.pv, engaged_ms: Math.round(r.eng || 0) })),
    sources: sources.results.map(r => ({ source: r.source || 'Direct', visitors: r.vis })),
    devices: devices.results.map(r => ({ device: r.device || 'unknown', pageviews: r.pv })),
    countries: countries.results.map(r => ({ country: r.country, visitors: r.vis })),
    vitals
  }, cors);
}

async function p75Vitals(DB, site, from, to) {
  const one = async (col) => {
    const c = await DB.prepare(
      `SELECT COUNT(*) n FROM events WHERE site=? AND type='end' AND ${col}>0 AND ts>=? AND ts<?`
    ).bind(site, from, to).first();
    const n = c.n || 0;
    if (!n) return 0;
    const row = await DB.prepare(
      `SELECT ${col} v FROM events WHERE site=? AND type='end' AND ${col}>0 AND ts>=? AND ts<?
         ORDER BY ${col} LIMIT 1 OFFSET ?`
    ).bind(site, from, to, Math.floor(n * 0.75)).first();
    return row ? row.v : 0;
  };
  const [lcp, cls, inp] = await Promise.all([one('lcp'), one('cls'), one('inp')]);
  return { lcp, cls: +Number(cls).toFixed(3), inp };
}

/* ---------------------------------------------------------------- realtime */

async function realtime(url, env, cors) {
  const site = url.searchParams.get('site');
  if (!site) return json({ error: 'site required' }, cors, 400);
  const now = Date.now(), fiveMin = now - 5 * 60000, thirtyMin = now - 30 * 60000;

  const [active, spark, top] = await Promise.all([
    env.DB.prepare(`SELECT COUNT(DISTINCT visitor) n FROM events
       WHERE site=? AND type='pv' AND ts>=?`).bind(site, fiveMin).first(),
    env.DB.prepare(`SELECT (ts/60000) m, COUNT(*) n FROM events
       WHERE site=? AND type='pv' AND ts>=? GROUP BY m ORDER BY m`).bind(site, thirtyMin).all(),
    env.DB.prepare(`SELECT path, COUNT(*) n FROM events
       WHERE site=? AND type='pv' AND ts>=? GROUP BY path ORDER BY n DESC LIMIT 6`)
      .bind(site, fiveMin).all()
  ]);

  // Fill the 30 one-minute buckets.
  const startMin = Math.floor(thirtyMin / 60000);
  const map = new Map(spark.results.map(r => [r.m, r.n]));
  const sparkline = [];
  for (let i = 0; i < 30; i++) sparkline.push(map.get(startMin + i) || 0);

  return json({
    active: active.n || 0,
    sparkline,
    top_pages: top.results.map(r => ({ path: r.path, active: r.n }))
  }, cors);
}

/* ----------------------------------------------------------------- helpers */

function normPath(p) {
  try { p = decodeURI(p); } catch {}
  p = (p || '/').split('#')[0].split('?')[0];
  if (p.length > 1) p = p.replace(/\/+$/, '');
  return p.slice(0, 300) || '/';
}

function resolveSource(refHost, utm) {
  if (utm) return cap(utm);
  if (!refHost) return 'Direct';
  const h = refHost.replace(/^www\./, '');
  if (/(^|\.)google\./.test(h)) return 'Google';
  if (/(^|\.)bing\.com$/.test(h)) return 'Bing';
  if (/duckduckgo\.com$/.test(h)) return 'DuckDuckGo';
  if (/(^|\.)(twitter\.com|x\.com|t\.co)$/.test(h)) return 'X';
  if (/facebook\.com$/.test(h) || h === 'l.facebook.com') return 'Facebook';
  if (/reddit\.com$/.test(h)) return 'Reddit';
  if (/(^|\.)youtube\.com$/.test(h)) return 'YouTube';
  if (/news\.google/.test(refHost)) return 'Google News';
  return h;
}

function parseUA(ua, vw) {
  let device = 'desktop';
  if (/iPad|Tablet|PlayBook|Silk|(Android(?!.*Mobile))/.test(ua)) device = 'tablet';
  else if (/Mobi|iPhone|iPod|Android.*Mobile|Windows Phone/.test(ua)) device = 'mobile';
  else if (vw && vw < 768) device = 'mobile';

  let browser = 'Other';
  if (/Edg\//.test(ua)) browser = 'Edge';
  else if (/OPR\/|Opera/.test(ua)) browser = 'Opera';
  else if (/SamsungBrowser/.test(ua)) browser = 'Samsung';
  else if (/Firefox\//.test(ua)) browser = 'Firefox';
  else if (/Chrome\//.test(ua)) browser = 'Chrome';
  else if (/Safari\//.test(ua)) browser = 'Safari';

  let os = 'Other';
  if (/Windows/.test(ua)) os = 'Windows';
  else if (/iPhone|iPad|iPod/.test(ua)) os = 'iOS';
  else if (/Mac OS X/.test(ua)) os = 'macOS';
  else if (/Android/.test(ua)) os = 'Android';
  else if (/Linux/.test(ua)) os = 'Linux';

  return { device, browser, os };
}

async function hashVisitor(ip, ua, site, salt) {
  // Daily-rotating hash: the same person gets a different id tomorrow.
  const day = new Date().toISOString().slice(0, 10);
  const data = new TextEncoder().encode(`${ip}|${ua}|${site}|${salt || ''}|${day}`);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(buf)].slice(0, 12).map(b => b.toString(16).padStart(2, '0')).join('');
}

function window(range) {
  const to = Date.now();
  const DAY = 86400000, HOUR = 3600000;
  let span, bucket;
  switch (range) {
    case '24h': span = DAY;       bucket = HOUR; break;
    case '30d': span = 30 * DAY;  bucket = DAY;  break;
    case '90d': span = 90 * DAY;  bucket = DAY;  break;
    case '7d':
    default:    span = 7 * DAY;   bucket = 6 * HOUR; break;
  }
  const from = to - span;
  return { from, to, bucket, prevFrom: from - span };
}

function fillSeries(rows, from, to, bucket) {
  const map = new Map(rows.map(r => [r.b, r]));
  const out = [];
  const start = Math.floor(from / bucket), end = Math.floor((to - 1) / bucket);
  for (let b = start; b <= end; b++) {
    const r = map.get(b);
    out.push({ t: b * bucket, pageviews: r ? r.pv : 0, visitors: r ? r.vis : 0 });
  }
  return out;
}

const int = v => (v == null ? null : Math.round(+v) || 0);
const num = v => (v == null ? null : +v || 0);
const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
function pct(a, b) { if (!b) return a > 0 ? 100 : 0; return +(((a - b) / b) * 100).toFixed(1); }

function corsHeaders(req, env) {
  const origin = req.headers.get('origin') || '';
  const allow = (env.ALLOWED_ORIGINS || '*');
  const ok = allow === '*' || allow.split(',').map(s => s.trim()).includes(origin);
  return {
    'access-control-allow-origin': allow === '*' ? '*' : (ok ? origin : ''),
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'content-type',
    'access-control-max-age': '86400'
  };
}

function json(obj, cors, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...cors }
  });
}

// Serve the tracker from the worker so sites can embed a single origin.
const TRACKER = null; // populated at deploy time if you inline v.js; otherwise host it as a static asset.
function tracker(env, cors) {
  if (!TRACKER) return new Response('// deploy v.js as a static asset or inline it here', {
    status: 200, headers: { 'content-type': 'application/javascript', ...cors }
  });
  return new Response(TRACKER, { headers: { 'content-type': 'application/javascript', 'cache-control': 'public,max-age=3600', ...cors } });
}
