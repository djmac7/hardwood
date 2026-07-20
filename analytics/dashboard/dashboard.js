/* Vantage dashboard.
 * Set CONFIG.api to your deployed worker (e.g. "https://vantage.you.workers.dev")
 * to show live data. Left empty, the dashboard renders a realistic demo dataset
 * so the design is viewable before any collection is wired up. */
const CONFIG = {
  api: '',                              // '' = demo mode
  sites: { 'dunkwise': 'Dunkwise', 'six-spins': 'Six Spins' }
};

const $ = (s, r = document) => r.querySelector(s);
const state = { site: 'dunkwise', range: '7d', view: 'overview' };
const VIEWS = {
  overview:    { title: 'Overview',    sub: 'All traffic' },
  content:     { title: 'Content',     sub: 'Pages & engagement' },
  acquisition: { title: 'Acquisition', sub: 'Where visitors come from' },
  performance: { title: 'Performance', sub: 'Page speed & ad health' }
};
const RANGE_LABEL = { '24h': 'last 24 hours', '7d': 'last 7 days', '30d': 'last 30 days', '90d': 'last 90 days' };

/* ------------------------------------------------------------ formatting */
const fmtNum = n => {
  n = +n || 0;
  if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace(/\.0$/, '') + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(n >= 1e4 ? 0 : 1).replace(/\.0$/, '') + 'k';
  return String(Math.round(n));
};
const fmtFull = n => (+n || 0).toLocaleString('en-US');
const fmtDur = ms => {
  const s = Math.round((+ms || 0) / 1000);
  if (s < 60) return s + 's';
  const m = Math.floor(s / 60);
  return m + 'm ' + String(s % 60).padStart(2, '0') + 's';
};
const deltaChip = d => {
  d = +d || 0;
  const cls = d > 0.4 ? 'up' : d < -0.4 ? 'down' : 'flat';
  const arrow = d > 0.4 ? '▲' : d < -0.4 ? '▼' : '–';
  const v = Math.abs(d) >= 100 ? Math.round(Math.abs(d)) : Math.abs(d).toFixed(1);
  return `<span class="delta ${cls}">${arrow} ${v}%</span>`;
};
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* ---------------------------------------------------------------- fetch */
async function getStats() {
  if (CONFIG.api) {
    const r = await fetch(`${CONFIG.api}/api/stats?site=${state.site}&range=${state.range}`);
    if (!r.ok) throw new Error('stats ' + r.status);
    return r.json();
  }
  return demoStats(state.site, state.range);
}
async function getRealtime() {
  if (CONFIG.api) {
    const r = await fetch(`${CONFIG.api}/api/realtime?site=${state.site}`);
    if (r.ok) return r.json();
  }
  return demoRealtime(state.site);
}

/* ------------------------------------------------------------- rendering */
async function render() {
  const app = $('#app');
  const meta = VIEWS[state.view];
  $('#viewTitle').textContent = meta.title;
  $('#viewSub').textContent = `${meta.sub} · ${RANGE_LABEL[state.range]}`;
  app.innerHTML = '<div class="boot"><span class="spinner"></span></div>';

  let data, rt;
  try { [data, rt] = await Promise.all([getStats(), getRealtime()]); }
  catch (e) { app.innerHTML = `<div class="boot muted">Couldn’t load stats — ${esc(e.message)}</div>`; return; }

  updatePill(rt);
  app.innerHTML = ({
    overview: viewOverview,
    content: viewContent,
    acquisition: viewAcquisition,
    performance: viewPerformance
  }[state.view])(data, rt);
}

/* ---- views ---- */
function viewOverview(data, rt) {
  const t = data.totals, d = data.deltas;
  const cmp = 'vs prev period';
  return `<div class="stack">
    ${rtStrip(rt)}
    <div class="kpis k5">
      ${kpi('Pageviews', fmtNum(t.pageviews), '', d.pageviews, cmp)}
      ${kpi('Unique visitors', fmtNum(t.visitors), '', d.visitors, cmp)}
      ${kpi('Views / visit', (t.views_per_visit || 0).toFixed(2), '', null, 'per session')}
      ${kpi('Engaged time', fmtDur(t.engaged_ms), '', null, 'avg / view')}
      ${kpi('Adblock rate', (t.adblock_rate || 0).toFixed(0), '%', null, 'revenue leak')}
    </div>
    ${chartCard(data)}
    <div class="cols-2">
      ${contentCard(data.top_pages.slice(0, 6))}
      ${sourcesCard(data.sources.slice(0, 6))}
    </div>
  </div>`;
}
function viewContent(data) {
  const t = data.totals;
  return `<div class="stack">
    <div class="kpis k3">
      ${kpi('Pageviews', fmtNum(t.pageviews), '', data.deltas.pageviews, 'vs prev period')}
      ${kpi('Views / visit', (t.views_per_visit || 0).toFixed(2), '', null, 'per session')}
      ${kpi('Engaged time', fmtDur(t.engaged_ms), '', null, 'avg / view')}
    </div>
    ${chartCard(data)}
    ${contentCard(data.top_pages, 'All pages · by pageviews')}
  </div>`;
}
function viewAcquisition(data) {
  const t = data.totals, d = data.deltas;
  return `<div class="stack">
    <div class="kpis k2">
      ${kpi('Unique visitors', fmtNum(t.visitors), '', d.visitors, 'vs prev period')}
      ${kpi('Sessions', fmtNum(t.sessions || Math.round(t.pageviews / (t.views_per_visit || 1))), '', d.sessions, 'vs prev period')}
    </div>
    <div class="cols-2">
      ${sourcesCard(data.sources, 'Traffic sources · all channels')}
      ${countriesCard(data.countries)}
    </div>
  </div>`;
}
function viewPerformance(data) {
  const t = data.totals;
  return `<div class="stack">
    <div class="kpis k2">
      ${kpi('Adblock rate', (t.adblock_rate || 0).toFixed(0), '%', null, 'of pageviews — direct revenue leak')}
      ${kpi('Bounce rate', (t.bounce_rate || 0).toFixed(0), '%', null, 'left in <10s, <25% scrolled')}
    </div>
    <div class="card">
      <div class="card-h"><h3>Core Web Vitals</h3><span class="eyebrow">p75 · field</span></div>
      ${cwv(data.vitals)}
      <p class="cwv-note">Ad scripts are the usual cause of poor LCP, INP and CLS. Google factors these into
        Search rankings, so slow pages quietly cost you traffic — and the ad revenue that rides on it.</p>
    </div>
    ${devicesCard(data.devices)}
  </div>`;
}

/* ---- section builders ---- */
function chartCard(data) {
  return `<div class="card chart-card">
    <div class="chart-head">
      <span class="eyebrow">Pageviews over time</span>
      <div class="chart-legend">
        <span><i style="background:var(--accent)"></i>Pageviews</span>
        <span><i style="background:var(--ink-4)"></i>Visitors</span>
      </div>
    </div>
    ${chart(data.series)}
    <div class="chart-x">${xLabels(data.series, data.range)}</div>
  </div>`;
}
function contentCard(pages, label = 'by pageviews') {
  return `<div class="card">
    <div class="card-h"><h3>Top content</h3><span class="eyebrow">${esc(label)}</span></div>
    ${topContent(pages)}
  </div>`;
}
function sourcesCard(sources, label = 'by visitors') {
  return `<div class="card">
    <div class="card-h"><h3>Traffic sources</h3><span class="eyebrow">${esc(label)}</span></div>
    ${rankedList(sources.map(s => ({ name: s.source, val: s.visitors })), true)}
  </div>`;
}
function countriesCard(countries) {
  return `<div class="card">
    <div class="card-h"><h3>Countries</h3><span class="eyebrow">by visitors</span></div>
    ${rankedList(countries.map(x => ({ name: x.country, val: x.visitors, mark: x.country })), true)}
  </div>`;
}
function devicesCard(devices) {
  return `<div class="card">
    <div class="card-h"><h3>Devices</h3><span class="eyebrow">by pageviews</span></div>
    ${rankedList(devices.map(x => ({ name: cap(x.device), val: x.pageviews, mark: x.device.slice(0, 2).toUpperCase() })), true)}
  </div>`;
}

/* ---- realtime ---- */
function updatePill(rt) {
  const pill = $('#rtPill'); if (!pill) return;
  pill.querySelector('b').textContent = rt.active;
}
function rtStrip(rt) {
  const max = Math.max(1, ...rt.sparkline);
  const bars = rt.sparkline.map((n, i) => {
    const h = Math.max(6, Math.round(n / max * 100));
    const hot = i >= rt.sparkline.length - 3 && n > 0;
    return `<i class="${hot ? 'hot' : ''}" style="height:${h}%"></i>`;
  }).join('');
  const top = rt.top_pages.slice(0, 3).map(p => `<span><b>${p.active}</b> ${esc(p.path)}</span>`).join('');
  return `<div class="card realtime">
    <div class="rt-strip-lead"><b>${rt.active}</b><span>ONLINE NOW</span></div>
    <div class="rt-spark" title="pageviews · last 30 min">${bars}</div>
    <div class="rt-top">${top}</div>
  </div>`;
}

function kpi(label, val, unit, delta, cmp) {
  const chip = delta == null ? '' : deltaChip(delta);
  return `<div class="kpi">
    <span class="eyebrow">${label}</span>
    <div class="val">${val}${unit ? `<span class="u">${unit}</span>` : ''}</div>
    <div class="foot">${chip}<span class="cmp">${esc(cmp)}</span></div>
  </div>`;
}

function rankedList(items, pct) {
  const total = items.reduce((s, x) => s + x.val, 0) || 1;
  const max = Math.max(1, ...items.map(x => x.val));
  return `<div class="rows">${items.map(x => {
    const w = Math.round(x.val / max * 100);
    const p = (x.val / total * 100);
    return `<div class="row">
      <div class="lbl">${x.mark ? `<span class="mark">${esc(x.mark)}</span>` : ''}<span class="name">${esc(x.name)}</span></div>
      <div class="num">${fmtNum(x.val)}${pct ? `<span class="pctv">${p.toFixed(0)}%</span>` : ''}</div>
      <div class="bar"><i style="width:${w}%"></i></div>
    </div>`;
  }).join('')}</div>`;
}

function topContent(pages) {
  const max = Math.max(1, ...pages.map(p => p.pageviews));
  return `<table class="tbl"><thead><tr>
      <th>Page</th><th>Views</th><th>Avg&nbsp;time</th>
    </tr></thead><tbody>${pages.map(p => {
      const w = Math.round(p.pageviews / max * 160);
      return `<tr>
        <td class="pvcell"><span class="path" title="${esc(p.path)}">${esc(p.path)}</span>
          <span class="pvbar" style="width:${w}px"></span></td>
        <td class="num">${fmtFull(p.pageviews)}</td>
        <td class="num">${fmtDur(p.engaged_ms)}</td>
      </tr>`;
    }).join('')}</tbody></table>`;
}

/* Core Web Vitals thresholds (Google's "good / needs improvement / poor"). */
const CWV_T = { lcp: [2500, 4000], inp: [200, 500], cls: [0.1, 0.25] };
function cwvRow(key, label, value, unit, fmt) {
  const [g, p] = CWV_T[key];
  const status = value <= g ? 'good' : value <= p ? 'warn' : 'crit';
  const txt = { good: 'Good', warn: 'Needs work', crit: 'Poor' }[status];
  const frac = Math.min(1, value / (p * 1.25));
  return `<div class="cwv-row">
    <span class="k">${label}</span>
    <span class="cwv-track"><i class="is-${status}" style="width:${Math.round(frac * 100)}%"></i></span>
    <span class="v">${fmt(value)}<span class="u">${unit}</span></span>
    <span class="pill ${status}">${txt}</span>
  </div>`;
}
function cwv(v) {
  return `<div class="cwv">
    ${cwvRow('lcp', 'LCP', v.lcp, 's', x => (x / 1000).toFixed(2))}
    ${cwvRow('inp', 'INP', v.inp, 'ms', x => Math.round(x))}
    ${cwvRow('cls', 'CLS', v.cls, '', x => x.toFixed(3))}
  </div>`;
}

/* ------------------------------------------------------------------ chart
 * Responsive line+area with non-scaling strokes, so it stretches to any width
 * without distorting line weight. Two series: pageviews (accent), visitors (faint). */
function chart(series) {
  const W = 1000, H = 220, padT = 14, padB = 10;
  const n = series.length;
  const maxV = Math.max(1, ...series.map(s => s.pageviews));
  const nice = niceMax(maxV);
  const x = i => (n <= 1 ? 0 : (i / (n - 1)) * W);
  const y = v => padT + (1 - v / nice) * (H - padT - padB);

  const pts = key => series.map((s, i) => [x(i), y(s[key])]);
  const line = key => smooth(pts(key));
  const pvLine = line('pageviews');
  const area = `${pvLine} L${W} ${H - padB} L0 ${H - padB} Z`;
  const grid = [0, .25, .5, .75, 1].map(f => {
    const yy = padT + f * (H - padT - padB);
    return `<line x1="0" y1="${yy.toFixed(1)}" x2="${W}" y2="${yy.toFixed(1)}"
      stroke="var(--line-soft)" stroke-width="1" vector-effect="non-scaling-stroke"/>`;
  }).join('');

  return `<svg class="chart-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Pageviews over time">
    <defs><linearGradient id="vgFill" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="var(--accent)" stop-opacity="0.20"/>
      <stop offset="1" stop-color="var(--accent)" stop-opacity="0"/>
    </linearGradient></defs>
    ${grid}
    <path d="${area}" fill="url(#vgFill)"/>
    <path d="${line('visitors')}" fill="none" stroke="var(--ink-4)" stroke-width="1.5"
      stroke-dasharray="3 3" vector-effect="non-scaling-stroke" opacity="0.8"/>
    <path d="${pvLine}" fill="none" stroke="var(--accent)" stroke-width="2.25"
      stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>
    <text x="6" y="${(padT + 3)}" font-family="var(--mono)" font-size="11" fill="var(--ink-4)">${fmtNum(nice)}</text>
  </svg>`;
}
/* Catmull-Rom → cubic Bézier, for a smooth line through every data point. */
function smooth(p) {
  if (p.length < 2) return p.length ? `M${p[0][0]} ${p[0][1]}` : '';
  let d = `M${p[0][0].toFixed(1)} ${p[0][1].toFixed(1)}`;
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[i - 1] || p[i], p1 = p[i], p2 = p[i + 1], p3 = p[i + 2] || p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C${c1x.toFixed(1)} ${c1y.toFixed(1)} ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d;
}
function niceMax(v) {
  const mag = Math.pow(10, Math.floor(Math.log10(v)));
  const f = v / mag;
  const nf = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
  return nf * mag;
}
function xLabels(series, range) {
  const n = series.length;
  if (!n) return '';
  const count = Math.min(6, n);
  const out = [];
  for (let i = 0; i < count; i++) {
    const idx = Math.round(i / (count - 1) * (n - 1));
    out.push(`<span>${fmtTick(series[idx].t, range)}</span>`);
  }
  return out.join('');
}
function fmtTick(ts, range) {
  const d = new Date(ts);
  if (range === '24h') return String(d.getHours()).padStart(2, '0') + ':00';
  if (range === '7d') return d.toLocaleDateString('en-US', { weekday: 'short' });
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;

/* --------------------------------------------------------------- demo data */
function rangeWindow(range) {
  const DAY = 864e5, HOUR = 36e5, to = Date.now();
  const cfg = { '24h': [DAY, HOUR], '7d': [7 * DAY, 6 * HOUR], '30d': [30 * DAY, DAY], '90d': [90 * DAY, DAY] }[range];
  return { from: to - cfg[0], to, bucket: cfg[1] };
}
function demoStats(site, range) {
  const big = site === 'dunkwise';
  const { from, to, bucket } = rangeWindow(range);
  const perBucket = (big ? 42000 : 9000) * (bucket / 864e5); // scale to bucket size
  const series = [];
  let pvTotal = 0, visTotal = 0;
  for (let ts = Math.floor(from / bucket) * bucket; ts < to; ts += bucket) {
    const h = new Date(ts).getHours();
    const daily = 0.78 + 0.30 * Math.sin((h - 7) / 24 * Math.PI * 2) ** 2; // gentle evening peak
    const noise = 0.90 + Math.random() * 0.22;
    const pv = Math.round(perBucket * daily * noise);
    const vis = Math.round(pv * (0.60 + Math.random() * 0.06));
    series.push({ t: ts, pageviews: pv, visitors: vis });
    pvTotal += pv; visTotal += vis;
  }
  const sources = big
    ? [['Google', .58], ['Direct', .17], ['Google News', .08], ['Bing', .05], ['X', .045], ['Reddit', .035], ['Facebook', .03], ['DuckDuckGo', .02]]
    : [['Direct', .34], ['Google', .29], ['X', .12], ['Reddit', .1], ['Facebook', .07], ['Bing', .05], ['Discord', .03]];
  const pages = big
    ? [['/player/jokicni01', .09], ['/', .085], ['/standings', .07], ['/player/doncilu01', .055], ['/leaders', .05], ['/team/NYK', .045], ['/games', .04], ['/player/embiijo01', .035], ['/player/gilgesh01', .03], ['/salaries', .028]]
    : [['/', .42], ['/archive', .18], ['/leaderboard', .12], ['/how-to-play', .07], ['/stats', .05]];
  const devices = big ? [['mobile', .63], ['desktop', .31], ['tablet', .06]] : [['mobile', .71], ['desktop', .23], ['tablet', .06]];
  const countries = [['US', .52], ['GB', .09], ['CA', .08], ['AU', .05], ['PH', .045], ['IN', .04], ['DE', .03], ['BR', .028]];
  const mk = (arr, total, key1, key2) => arr.map(([name, f]) => {
    const val = Math.round(total * f);
    return key2 ? { [key1]: name, [key2]: val } : { [key1]: name, val };
  });

  return {
    site, range, series,
    totals: {
      pageviews: pvTotal,
      visitors: visTotal,
      views_per_visit: +(pvTotal / (visTotal / (big ? 1.55 : 1.7))).toFixed(2),
      engaged_ms: (big ? 71000 : 128000) + Math.round(Math.random() * 16000),
      bounce_rate: +( (big ? 44 : 33) + Math.random() * 6).toFixed(1),
      adblock_rate: +((big ? 27 : 19) + Math.random() * 4).toFixed(1)
    },
    deltas: {
      pageviews: +(-4 + Math.random() * 22).toFixed(1),
      visitors: +(-3 + Math.random() * 20).toFixed(1),
      sessions: +(-5 + Math.random() * 18).toFixed(1)
    },
    top_pages: pages.map(([path, f]) => ({ path, pageviews: Math.round(pvTotal * f), engaged_ms: 30000 + Math.round(Math.random() * 140000) })),
    sources: sources.map(([source, f]) => ({ source, visitors: Math.round(visTotal * f) })),
    devices: devices.map(([device, f]) => ({ device, pageviews: Math.round(pvTotal * f) })),
    countries: countries.map(([country, f]) => ({ country, visitors: Math.round(visTotal * f) })),
    vitals: big
      ? { lcp: 2350 + Math.round(Math.random() * 400), cls: +(0.07 + Math.random() * 0.05).toFixed(3), inp: 165 + Math.round(Math.random() * 60) }
      : { lcp: 1850 + Math.round(Math.random() * 300), cls: +(0.03 + Math.random() * 0.04).toFixed(3), inp: 120 + Math.round(Math.random() * 50) }
  };
}
function demoRealtime(site) {
  const big = site === 'dunkwise';
  const base = big ? 180 : 34;
  const sparkline = Array.from({ length: 30 }, (_, i) =>
    Math.round(base * (0.6 + 0.5 * Math.sin(i / 4) + Math.random() * 0.5)));
  const pages = big
    ? [['/player/jokicni01'], ['/standings'], ['/'], ['/leaders'], ['/games'], ['/team/NYK']]
    : [['/'], ['/leaderboard'], ['/archive']];
  return {
    active: base + Math.round(Math.random() * base * 0.4),
    sparkline,
    top_pages: pages.map(([path]) => ({ path, active: 1 + Math.round(Math.random() * (big ? 40 : 8)) }))
  };
}

/* -------------------------------------------------------------- controls */
function wire() {
  $('#viewNav').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    state.view = b.dataset.view;
    setOn('#viewNav', b); render();
  });
  $('#rangeCtl').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    state.range = b.dataset.range;
    setOn('#rangeCtl', b); render();
  });

  // Workspace (site) switcher menu
  menu('#wsBtn', '#siteMenu', it => setSite(it.dataset.site));
  // Account menu → appearance
  menu('#acctBtn', '#acctMenu', it => setTheme(it.dataset.theme));
  markTheme(localStorage.getItem('vg-theme') || 'system');
}

/* Generic dropdown: toggle, outside-click close, item select. */
function menu(btnSel, menuSel, onSelect) {
  const btn = $(btnSel), m = $(menuSel);
  const close = () => { m.hidden = true; btn.setAttribute('aria-expanded', 'false'); };
  btn.addEventListener('click', e => {
    e.stopPropagation();
    const willOpen = m.hidden;
    document.querySelectorAll('.menu').forEach(x => { x.hidden = true; });
    document.querySelectorAll('[aria-haspopup="menu"]').forEach(b => b.setAttribute('aria-expanded', 'false'));
    m.hidden = !willOpen;
    btn.setAttribute('aria-expanded', String(willOpen));
  });
  m.addEventListener('click', e => {
    const it = e.target.closest('.menu-item'); if (!it) return;
    onSelect(it); close();
  });
  document.addEventListener('click', close);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
}

function setSite(site) {
  state.site = site;
  const label = CONFIG.sites[site] || site;
  $('#wsName').textContent = label;
  $('#wsAvatar').textContent = label[0];
  $('#siteMenu').querySelectorAll('.menu-item').forEach(it =>
    it.classList.toggle('on', it.dataset.site === site));
  render();
}
function setTheme(t) {
  if (t === 'system') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', t);
  try { localStorage.setItem('vg-theme', t); } catch {}
  markTheme(t);
}
function markTheme(t) {
  $('#acctMenu').querySelectorAll('.menu-item').forEach(it =>
    it.classList.toggle('on', it.dataset.theme === t));
}
function setOn(sel, btn) { $(sel).querySelectorAll('button').forEach(b => b.classList.toggle('on', b === btn)); }

wire();
render();
// Refresh the realtime pill (and the overview strip if visible) periodically.
setInterval(() => {
  if (document.hidden) return;
  getRealtime().then(rt => {
    updatePill(rt);
    const strip = document.querySelector('.realtime');
    if (strip && state.view === 'overview') strip.outerHTML = rtStrip(rt);
  });
}, 15000);
