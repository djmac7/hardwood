/* ============================================================
   Hardwood — SPA over the historical NBA dataset (1947–2026)
   Async data access; official-CDN logos/headshots with fallbacks.
   ============================================================ */
(function () {
  const V = "34";
  const app = document.getElementById("app");
  const tt = document.getElementById("tt");
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  /* ---------- data store ---------- */
  const cache = {};
  const j = (url) => (cache[url] || (cache[url] = fetch(url).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })));
  // Live files (injuries/odds/scores/standings/news) are refreshed on a schedule by the
  // GitHub Action, so they bypass the versioned cache with a rolling 5-minute buster —
  // clients pick up new data without an app redeploy. Historical files stay ?v-cached.
  const LIVE = Math.floor(Date.now() / 300000);
  const jl = (path) => j(`${path}?t=${LIVE}`);
  const getMeta = () => j(`data/meta.json?v=${V}`);
  const getSearch = () => j(`data/search.json?v=${V}`);
  const getSeason = (y) => (+y === (META && META.current) ? jl(`data/season/${y}.json`) : j(`data/season/${y}.json?v=${V}`));
  const getPlayer = (id) => j(`data/player/${id}.json?v=${V}`);
  const getTeam = (ab) => j(`data/team/${ab}.json?v=${V}`);
  const getAlltime = () => j(`data/alltime.json?v=${V}`);
  const getAwards = () => j(`data/awards.json?v=${V}`);
  const getDraft = (y) => j(`data/draft/${y}.json?v=${V}`);
  const getNews = () => jl(`data/news.json`);
  const getSalaries = () => j(`data/salaries.json?v=${V}`);
  const getCPI = () => j(`data/cpi.json?v=${V}`);
  const getGamesIdx = (s) => (+s === (META && META.current) ? jl(`data/games/${s}.json`) : j(`data/games/${s}.json?v=${V}`));
  const getGame = (id) => j(`data/game/${id}.json?v=${V}`);
  const getPGames = (pid) => j(`data/pgames/${pid}.json?v=${V}`);
  const getTwoK = () => j(`data/twok.json?v=${V}`);
  const getInjuries = () => jl(`data/injuries.json`);
  const getStatus = () => jl(`data/status.json`);
  const getOdds = () => jl(`data/odds.json`);

  let META, SEARCH, SMAP = {};

  /* ---------- format ---------- */
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const one = (v) => (v == null ? "—" : (+v).toFixed(1));
  const pct = (v) => (v == null ? "—" : "." + String(Math.round(v * 1000)).padStart(3, "0").replace(/^0+(?=\d)/, "") ).replace(/^\.$/, "—");
  const pctf = (v) => (v == null ? "—" : "." + Math.round(v * 1000));
  const winpct = (w, l) => (w + l === 0 ? "—" : "." + String(Math.round((w / (w + l)) * 1000)).padStart(3, "0"));
  const seasonLabel = (y) => `${y - 1}-${String(y).slice(2)}`;
  const intOr = (v) => (v == null ? "—" : v);
  const intc = (v) => (v == null ? "—" : (+v).toLocaleString("en-US"));
  const ws48 = (v) => (v == null ? "—" : (+v).toFixed(3).replace(/^0(?=\.)/, ""));
  const signed = (v, nd = 1) => (v == null ? "—" : (v >= 0 ? "+" : "") + (+v).toFixed(nd));
  const money = (v) => (v == null ? "—" : v >= 1e6 ? "$" + (v / 1e6).toFixed(1) + "M" : "$" + Math.round(v / 1e3) + "K");
  const moneyFull = (v) => (v == null ? "—" : "$" + (+v).toLocaleString("en-US"));
  // restate a nominal salary from a given season in base-year dollars
  let CPI = null;   // {cpi:{year:idx}, base:year} — loaded lazily
  const inflate = (amt, season) => {
    if (!CPI || amt == null) return amt;
    const c = CPI.cpi[season];
    return c ? amt * CPI.cpi[CPI.base] / c : amt;
  };
  const initials = (nm) => nm.split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  function timeAgo(iso) {
    if (!iso) return "";
    const s = (Date.now() - new Date(iso).getTime()) / 1000;
    if (s < 3600) return Math.max(1, Math.round(s / 60)) + "m";
    if (s < 86400) return Math.round(s / 3600) + "h";
    return Math.round(s / 86400) + "d";
  }
  function relTime(iso) {
    const s = (Date.now() - new Date(iso).getTime()) / 1000;
    if (s < 0 || s < 90) return "just now";
    if (s < 3600) return Math.round(s / 60) + " min ago";
    if (s < 7200) return "an hour ago";
    if (s < 86400) return Math.round(s / 3600) + " hours ago";
    if (s < 172800) return "yesterday";
    return Math.round(s / 86400) + " days ago";
  }
  async function showDataRefreshed() {
    try {
      const st = await getStatus();
      const el = document.getElementById("dataRefreshed"), txt = document.getElementById("dataRefreshedText");
      if (!st || !st.refreshed || !el || !txt) return;
      txt.textContent = "Live data refreshed " + relTime(st.refreshed);
      el.hidden = false;
    } catch (e) {}
  }
  const NEWS_DOMAIN = { "ESPN": "espn.com", "CBS Sports": "cbssports.com", "Yahoo Sports": "sports.yahoo.com",
    "Bleacher Report": "bleacherreport.com", "r/nba": "reddit.com", "Sporting News": "sportingnews.com", "The Athletic": "nytimes.com" };
  const pubLogo = (source) => { const d = NEWS_DOMAIN[source]; return d
    ? `<img class="pub-logo" src="https://www.google.com/s2/favicons?domain=${d}&sz=64" alt="" loading="lazy" onerror="this.style.display='none'">` : ""; };
  const playerTags = (players) => (players && players.length)
    ? `<span class="ptags">${players.map((p) => `<a class="ptag" href="#/player/${p[0]}">${headshot(p[0], p[1], "", "xs")}${esc(p[1])}</a>`).join("")}</span>` : "";
  // compact list (home rail) — links in-site to the article reader
  function newsList(items, n) {
    return items.slice(0, n).map((it, i) => `<a class="news-item" href="#/article/${i}">
      <span class="news-src">${pubLogo(it.source)}<span class="txt">${esc(it.source)}</span></span><span class="news-title">${esc(it.title)}</span>
      <span class="news-time">${timeAgo(it.ts)}</span></a>`).join("");
  }
  // rich card (news page grid)
  function newsCard(it, i) {
    return `<article class="ncard">
      <a class="ncard-main ${it.img ? "" : "noimg"}" href="#/article/${i}">
        ${it.img ? `<span class="ncard-img" style="background-image:url('${esc(it.img)}')"></span>` : ""}
        <span class="ncard-body">
          <span class="ncard-src">${pubLogo(it.source)}<span>${esc(it.source)}</span><span class="dot">·</span>${timeAgo(it.ts)}</span>
          <span class="ncard-title">${esc(it.title)}</span>
          ${it.summary ? `<span class="ncard-sum">${esc(it.summary)}</span>` : ""}
        </span>
      </a>
      ${playerTags(it.players)}
    </article>`;
  }
  async function renderArticle(idx) {
    let news; try { news = await getNews(); } catch { news = null; }
    const items = (news && news.items) || [], it = items[+idx];
    if (!it) return notFound("article");
    const rel = items.filter((x, i) => i !== +idx && x.players && it.players && x.players.some((p) => it.players.some((q) => q[0] === p[0]))).slice(0, 4);
    app.innerHTML = `<div class="wrap page article">
      <div class="crumb"><a href="#/">Home</a><span class="sep">/</span><a href="#/news">News</a><span class="sep">/</span><span>${esc(it.source)}</span></div>
      <div class="art-head">
        <div class="art-src">${pubLogo(it.source)}<span>${esc(it.source)}</span>${it.ts ? `<span class="dot">·</span><span>${timeAgo(it.ts)} ago</span>` : ""}</div>
        <h1>${esc(it.title)}</h1>
        ${playerTags(it.players)}
      </div>
      ${it.img ? `<div class="art-img"><img src="${esc(it.img)}" alt="" loading="lazy" onerror="this.parentNode.style.display='none'"></div>` : ""}
      ${it.summary ? `<p class="art-sum">${esc(it.summary)}</p>` : ""}
      <a class="btn art-read" href="${esc(it.url)}" target="_blank" rel="noopener noreferrer">Read the full story at ${esc(it.source)} →</a>
      <p class="news-foot art-attr">Hardwood aggregates NBA headlines. Summary and image are provided by the publisher's feed for syndication; full articles, photos and rights remain with <b>${esc(it.source)}</b> — the link above opens the original.</p>
      ${rel.length ? `<div class="section-title" style="margin-top:26px"><h2>Related</h2></div>
        <div class="ncard-grid">${rel.map((r) => newsCard(r, items.indexOf(r))).join("")}</div>` : ""}
    </div>`;
  }
  // News tied to a player (uses the pre-tagged players[] on each headline).
  async function playerNews(pid) {
    let news; try { news = await getNews(); } catch { return ""; }
    const items = (news && news.items) || [];
    const rel = items.map((it, i) => [it, i]).filter(([it]) => (it.players || []).some((p) => p[0] === pid));
    if (!rel.length) return "";
    return `<div class="section-title" style="margin-top:26px"><div><h2>In the news</h2></div><a class="link" href="#/news">All NBA news →</a></div>
      <div class="ncard-grid">${rel.slice(0, 4).map(([it, i]) => newsCard(it, i)).join("")}</div>`;
  }
  // News tied to a team — matched on the distinctive nickname / full name in the headline.
  async function teamNews(ab) {
    let news; try { news = await getNews(); } catch { return ""; }
    const items = (news && news.items) || [], m = tMeta(ab);
    if (!m) return "";
    const needles = [m.name, m.full].filter(Boolean).map((s) => s.toLowerCase());
    const rel = items.map((it, i) => [it, i]).filter(([it]) => { const t = ((it.title || "") + " " + (it.summary || "")).toLowerCase(); return needles.some((n) => t.includes(n)); });
    if (!rel.length) return "";
    return `<div class="section-title" style="margin-top:26px"><div><h2>${esc(m.name)} news</h2></div><a class="link" href="#/news">All NBA news →</a></div>
      <div class="ncard-grid">${rel.slice(0, 4).map(([it, i]) => newsCard(it, i)).join("")}</div>`;
  }
  function textOn(hex) {
    const h = (hex || "#888").replace("#", ""); const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.62 ? "#1A1915" : "#ffffff";
  }
  const ord = (i) => i + (["th", "st", "nd", "rd"][(i % 100 >> 3 ^ 1) && i % 10 < 4 ? i % 10 : 0]);

  /* ---------- team helpers ---------- */
  const tMeta = (ab) => (META.teams[ab] || null);
  const tName = (ab) => (META.names[ab] || ab);
  const tColor = (ab) => (tMeta(ab) ? tMeta(ab).color : "#6C7683");
  const tConf = (ab) => (tMeta(ab) ? tMeta(ab).conf : null);
  const isRealTeam = (ab) => ab && !/^\d?TM$|^TOT$/.test(ab) && !!META.names[ab];
  const nbaOf = (id) => (SMAP[id] ? SMAP[id][6] : null);

  window.__imgfail = function (img) { img.style.display = "none"; const m = img.parentNode && img.parentNode.querySelector(".ava-mono"); if (m) m.style.opacity = 1; };

  function teamLogo(ab, size = "md") {
    const m = tMeta(ab), color = tColor(ab), mono = `<span class="ava-mono" style="background:${color};color:${textOn(color)}">${esc(ab)}</span>`;
    if (m && m.logo) return `<span class="ava logo ${size}"><img src="${m.logo}" alt="" loading="lazy" onerror="__imgfail(this)"><span class="ava-mono" style="opacity:0;background:${color};color:${textOn(color)}">${esc(ab)}</span></span>`;
    return `<span class="ava logo ${size}">${mono}</span>`;
  }
  function headshot(id, name, team, size = "md") {
    const nba = nbaOf(id), color = tColor(team), init = initials(name);
    const mono = `<span class="ava-mono" style="background:${color};color:${textOn(color)}">${esc(init)}</span>`;
    if (nba) return `<span class="ava shot ${size}"><img src="${META.headshotBase}${nba}.png" alt="" loading="lazy" onerror="__imgfail(this)"><span class="ava-mono" style="opacity:0;background:${color};color:${textOn(color)}">${esc(init)}</span></span>`;
    return `<span class="ava shot ${size}">${mono}</span>`;
  }
  function teamTag(ab, withLogo = false) {
    if (!ab) return "";
    if (!isRealTeam(ab)) return `<span class="tm-tag muted">${esc(ab)}</span>`;
    const dot = withLogo ? teamLogo(ab, "xs") : `<span class="b" style="background:${tColor(ab)}"></span>`;
    return `<a href="#/team/${ab}" class="tm-tag">${dot}${esc(ab)}</a>`;
  }
  const pLink = (id, name) => `<a href="#/player/${id}">${esc(name)}</a>`;

  /* ---------- tooltip ---------- */
  const COARSE = !!(window.matchMedia && (matchMedia("(pointer:coarse)").matches || matchMedia("(hover:none)").matches));
  let ttTimer;
  function forceHideTT() { clearTimeout(ttTimer); tt.classList.remove("on"); }
  function showTT(html, x, y) {
    tt.innerHTML = html; tt.classList.add("on");
    const w = tt.offsetWidth, h = tt.offsetHeight; let nx, ny;
    if (COARSE) {
      // touch: center over the tap point, clamp inside the viewport, auto-dismiss
      nx = Math.min(Math.max(8, x - w / 2), innerWidth - w - 8);
      ny = y - h - 14; if (ny < 8) ny = y + 20;
      clearTimeout(ttTimer); ttTimer = setTimeout(forceHideTT, 2600);
    } else {
      nx = x + 16; ny = y - h - 10;
      if (nx + w > innerWidth - 8) nx = x - w - 16; if (ny < 8) ny = y + 18;
    }
    // clamp both axes so a fixed tooltip can never push the page wider than the viewport
    tt.style.left = Math.min(Math.max(8, nx), innerWidth - w - 8) + "px"; tt.style.top = ny + "px";
  }
  // On touch, pointerleave fires the instant a finger lifts and would flash the tip
  // away — so ignore hover-hide on coarse pointers and rely on the auto-dismiss timer
  // plus a capture-phase tap-away (which runs before a trigger re-shows its own tip).
  const hideTT = () => { if (!COARSE) tt.classList.remove("on"); };
  if (COARSE) document.addEventListener("pointerdown", forceHideTT, true);

  /* ---------- per-route SEO (title, description, canonical, Open Graph, JSON-LD) ---------- */
  const SITE = "Hardwood";
  function metaTag(sel, attr, key, val) {
    let el = document.head.querySelector(sel);
    if (!el) { el = document.createElement("meta"); el.setAttribute(attr, key); document.head.appendChild(el); }
    el.setAttribute("content", val);
  }
  function setSEO(title, desc, jsonld) {
    const full = title ? `${title} — ${SITE}` : `${SITE} — NBA Stats & History`;
    document.title = full;
    if (desc) {
      metaTag('meta[name="description"]', "name", "description", desc);
      metaTag('meta[property="og:description"]', "property", "og:description", desc);
      metaTag('meta[name="twitter:description"]', "name", "twitter:description", desc);
    }
    metaTag('meta[property="og:title"]', "property", "og:title", full);
    metaTag('meta[name="twitter:title"]', "name", "twitter:title", full);
    metaTag('meta[property="og:type"]', "property", "og:type", "website");
    // canonical — mirrors the hash route so shared/bookmarked deep links resolve
    let can = document.head.querySelector('link[rel="canonical"]');
    if (!can) { can = document.createElement("link"); can.rel = "canonical"; document.head.appendChild(can); }
    can.href = location.href;
    metaTag('meta[property="og:url"]', "property", "og:url", location.href);
    // structured data
    let ld = document.getElementById("ld-route");
    if (jsonld) {
      if (!ld) { ld = document.createElement("script"); ld.type = "application/ld+json"; ld.id = "ld-route"; document.head.appendChild(ld); }
      ld.textContent = JSON.stringify(jsonld);
    } else if (ld) { ld.remove(); }
  }

  /* ---------- leaders ---------- */
  const LEAD_CATS = [
    ["pts", "Points", "PPG", one], ["trb", "Rebounds", "RPG", one], ["ast", "Assists", "APG", one],
    ["stl", "Steals", "SPG", one], ["blk", "Blocks", "BPG", one], ["per", "PER", "PER", one],
    ["ts_percent", "True shooting", "TS%", pctf], ["fg_percent", "Field goal", "FG%", pctf],
    ["x3p_percent", "3-point", "3P%", pctf], ["ft_percent", "Free throw", "FT%", pctf],
  ];
  const CATMAP = Object.fromEntries(LEAD_CATS.map((c) => [c[0], c]));
  function leaderList(S, cat, n = 10) {
    const rows = (S.leaders[cat] || []).slice(0, n), fmt = CATMAP[cat][3];
    if (!rows.length) return `<p class="muted" style="font-size:13px;padding:8px 0">Not tracked this season.</p>`;
    const max = Math.max(...rows.map((r) => r[3]));
    return `<ul class="rank rank-bar">${rows.map((r, i) => `<li class="${i === 0 ? "top" : ""}" style="--b:${(r[3] / max).toFixed(3)}">
      <span class="rk">${i + 1}</span>
      <span class="who">${headshot(r[0], r[1], r[2], "xs")}<a class="nm" href="#/player/${r[0]}">${esc(r[1])}</a> ${teamTag(r[2])}</span>
      <span class="val">${fmt(r[3])}</span></li>`).join("")}</ul>`;
  }
  function leaderCard(S, cat) {
    return `<div class="card pad"><div class="card-h"><h3>${CATMAP[cat][1]}</h3><span class="hint">${CATMAP[cat][2]}</span></div>${leaderList(S, cat)}</div>`;
  }

  /* ---------- player card ---------- */
  function playerCardDoc(p) {
    const t = p.cur.team;
    return `<a href="#/player/${p.id}" class="pcard">
      <span class="accentbar" style="background:${tColor(t)}"></span>
      ${headshot(p.id, p.name, t, "lg")}
      <div class="pc-body">
        <div class="pos">${esc(p.cur.pos || p.bio.pos || "")} · ${esc(t)}</div>
        <div class="nm">${esc(p.name)}</div>
        <div class="line">
          <div class="s"><div class="v">${one(p.cur.pts)}</div><div class="k">PPG</div></div>
          <div class="s"><div class="v">${one(p.cur.trb)}</div><div class="k">RPG</div></div>
          <div class="s"><div class="v">${one(p.cur.ast)}</div><div class="k">APG</div></div>
        </div>
      </div></a>`;
  }
  async function playerCards(ids) {
    const docs = await Promise.all(ids.map((id) => getPlayer(id).catch(() => null)));
    return docs.filter(Boolean).map(playerCardDoc).join("");
  }

  /* ---------- standings helpers ---------- */
  function splitConf(rows) {
    const e = [], w = [], u = [];
    rows.forEach((t) => { const c = tConf(t.abbr); if (c === "East") e.push(t); else if (c === "West") w.push(t); else u.push(t); });
    return e.length && w.length ? { East: e, West: w } : { League: rows };
  }
  function miniStanding(rows) {
    return `<table><tbody>${rows.slice(0, 8).map((t, i) => `<tr onclick="location.hash='#/team/${t.abbr}'" style="cursor:pointer">
      <td class="seed">${i + 1}</td>
      <td class="tm">${teamLogo(t.abbr, "xs")}<span class="tnm">${esc(tName(t.abbr))}</span>${i < 6 ? '<span class="clinch">✓</span>' : (i < 8 ? '<span class="clinch play">play-in</span>' : "")}</td>
      <td class="rec">${t.w}–${t.l}</td><td class="pct">${winpct(t.w, t.l)}</td></tr>`).join("")}</tbody></table>`;
  }

  /* ---------- team efficiency scatter ---------- */
  function drawScatter(mountId, rows) {
    const pts = rows.filter((r) => r.o != null && r.d != null);
    if (!pts.length) { $("#" + mountId).innerHTML = ""; return; }
    const W = 900, H = 470, m = { t: 26, r: 26, b: 48, l: 54 }, iw = W - m.l - m.r, ih = H - m.t - m.b;
    const oq = pts.map((p) => p.o), dq = pts.map((p) => p.d);
    const pad = 1.5, xmin = Math.min(...oq) - pad, xmax = Math.max(...oq) + pad, ymin = Math.min(...dq) - pad, ymax = Math.max(...dq) + pad;
    const sx = (v) => m.l + (v - xmin) / (xmax - xmin) * iw, sy = (v) => m.t + (v - ymin) / (ymax - ymin) * ih;
    const lgO = oq.reduce((a, b) => a + b, 0) / oq.length, lgD = dq.reduce((a, b) => a + b, 0) / dq.length;
    const wq = pts.map((p) => p.w), wmax = Math.max(...wq), wmin = Math.min(...wq);
    let g = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Team offensive vs defensive rating">`;
    const step = (xmax - xmin > 12) ? 4 : 2;
    for (let v = Math.ceil(xmin / step) * step; v < xmax; v += step) { const x = sx(v); g += `<line class="grid" x1="${x}" y1="${m.t}" x2="${x}" y2="${m.t + ih}"/><text x="${x}" y="${H - 18}" text-anchor="middle">${v}</text>`; }
    for (let v = Math.ceil(ymin / step) * step; v < ymax; v += step) { const y = sy(v); g += `<line class="grid" x1="${m.l}" y1="${y}" x2="${m.l + iw}" y2="${y}"/><text x="${m.l - 10}" y="${y + 4}" text-anchor="end">${v}</text>`; }
    g += `<line class="axis" x1="${sx(lgO)}" y1="${m.t}" x2="${sx(lgO)}" y2="${m.t + ih}" stroke-dasharray="3 4"/><line class="axis" x1="${m.l}" y1="${sy(lgD)}" x2="${m.l + iw}" y2="${sy(lgD)}" stroke-dasharray="3 4"/>`;
    g += `<text class="qlabel" x="${m.l + iw - 4}" y="${m.t + 13}" text-anchor="end">Two-way elite ↗</text>`;
    g += `<text x="${m.l + iw / 2}" y="${H - 3}" text-anchor="middle" fill="var(--ink-2)" style="font-size:11px">Offensive rating — points scored / 100 poss. →</text>`;
    g += `<text transform="translate(15 ${m.t + ih / 2}) rotate(-90)" text-anchor="middle" fill="var(--ink-2)" style="font-size:11px">← better defense · Defensive rating</text>`;
    pts.forEach((t) => {
      const x = sx(t.o), y = sy(t.d), r = 7 + (wmax === wmin ? 4 : (t.w - wmin) / (wmax - wmin) * 9);
      const elite = t.o > lgO && t.d < lgD, label = t.w >= (wmin + (wmax - wmin) * 0.62);
      g += `<g class="sdot" data-ab="${t.abbr}" data-o="${t.o}" data-d="${t.d}" data-w="${t.w}" data-l="${t.l}">
        <circle cx="${x}" cy="${y}" r="${r.toFixed(1)}" fill="${tColor(t.abbr)}" fill-opacity="${elite ? 0.92 : 0.5}" stroke="var(--panel)" stroke-width="1.5"/>
        ${label ? `<text x="${x}" y="${(y - r - 5).toFixed(1)}" text-anchor="middle">${esc(t.abbr)}</text>` : ""}</g>`;
    });
    g += `</svg>`;
    $("#" + mountId).innerHTML = g;
    $$("#" + mountId + " .sdot").forEach((d) => {
      const show = (e) => showTT(`<div class="h">${esc(tName(d.dataset.ab))}</div>
        <div class="r"><span>Offense</span><span>${(+d.dataset.o).toFixed(1)}</span></div>
        <div class="r"><span>Defense</span><span>${(+d.dataset.d).toFixed(1)}</span></div>
        <div class="r"><span>Net · Record</span><span>${(d.dataset.o - d.dataset.d >= 0 ? "+" : "") + (d.dataset.o - d.dataset.d).toFixed(1)} · ${d.dataset.w}-${d.dataset.l}</span></div>`, e.clientX, e.clientY);
      d.addEventListener("pointerdown", show);   // touch tap / mouse press
      d.addEventListener("pointermove", show);   // mouse hover / touch drag
      d.addEventListener("pointerleave", hideTT);
      d.addEventListener("pointercancel", hideTT);
      d.addEventListener("click", () => (location.hash = "#/team/" + d.dataset.ab));
    });
  }

  /* ================= HOME ================= */
  async function renderHome() {
    const cur = META.current;
    const [S, news, gidx] = await Promise.all([getSeason(cur), getNews().catch(() => null), getGamesIdx(cur).catch(() => null)]);
    const st = S.standings, top = st[0], L = S.leaders;
    const champAb = S.champion && S.champion.team;
    const featIds = (L.pts || []).slice(0, 6).map((r) => r[0]);
    const recent = gidx && gidx.games ? gidx.games.slice(-5).reverse() : [];
    app.innerHTML = `
    <section class="hero2 reveal">
      <div class="wrap">
        <h1 class="sr-only">Hardwood — NBA stats &amp; history</h1>
        <div class="mast-search hero-search">
          <svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
          <input id="mastSearch" type="text" placeholder="Search any player or team…" aria-label="Search" autocomplete="off" spellcheck="false" />
          <div class="results" id="mastResults"></div>
        </div>
        <div class="quick-chips">
          <a href="#/leaders/all"><b>All-time leaders</b></a>
          <a href="#/compare">Compare players</a>
          <a href="#/awards">Awards</a>
          <a href="#/salaries">Salaries</a>
          <a href="#/draft">Draft</a>
          <a href="#/standings">Standings</a>
        </div>
      </div>
    </section>

    <div class="wrap">
      ${recent.length ? `<section class="reveal home-scores">
        <div class="section-title small"><h2>Recent scores</h2><a class="link" href="#/games">All scores →</a></div>
        <div class="mfeed home-mfeed">${recent.map(matchRow).join("")}</div>
      </section>` : ""}

      <div class="trend-strip reveal">
        <div class="section-title small"><h2>Trending · ${seasonLabel(cur)} scoring leaders</h2><a class="link" href="#/leaders">Leaders →</a></div>
        <div class="pcards" id="featured"></div>
      </div>

      <div class="home-grid2">
        <div class="card big pad reveal" id="newsCard">
          <div class="card-h"><h3>Around the league</h3><a class="hint" href="#/news" style="color:var(--ink-3)">More news →</a></div>
          ${news && news.items && news.items.length ? `<div class="newsfeed">${newsList(news.items, 9)}</div>
            <div class="news-foot">Headlines from ESPN, CBS, Yahoo &amp; Sporting News · updated ${timeAgo(news.fetched)} ago</div>` :
            `<p class="muted" style="font-size:14px">News feed unavailable. Run <code>build/fetch_news.py</code> to populate.</p>`}
        </div>
        <div class="stack">
          <div class="card big pad reveal" id="standHome"></div>
          <div class="card big pad reveal" id="leadersHome"></div>
        </div>
      </div>

      <div class="reveal" style="margin-top:22px">
        <div class="card big pad">
          <div class="card-h"><h3>All-time scoring leaders</h3><a class="hint" href="#/leaders/all" style="color:var(--ink-3)">All-time →</a></div>
          <ol class="rank rank-2col">${(await getAlltime()).career.pts.slice(0, 8).map((r, i) => `<li class="${i === 0 ? "top" : ""}">
            <span class="rk">${i + 1}</span><span class="who">${headshot(r[0], r[1], r[2], "xs")}<a class="nm" href="#/player/${r[0]}">${esc(r[1])}</a>
            <span class="yr-span">${String(r[4]).slice(2)}–${String(r[5]).slice(2)}</span></span><span class="val">${intc(r[3])}</span></li>`).join("")}</ol>
          <div class="news-foot">Career points · all-time</div>
        </div>
      </div>

    </div>`;

    $("#leadersHome").innerHTML = `<div class="card-h"><h3>${seasonLabel(cur)} leaders</h3>
      <div class="tabs" role="tablist" data-leadtabs>${["pts", "trb", "ast", "per"].map((k, i) => `<button role="tab" data-k="${k}" aria-selected="${i === 0}">${CATMAP[k][1]}</button>`).join("")}</div></div>
      <div data-leadbody>${leaderList(S, "pts", 6)}</div>`;
    wireLeadTabs($("#leadersHome"), S, 6);

    const conf = splitConf(st), keys = Object.keys(conf);
    $("#standHome").innerHTML = `<div class="card-h"><h3>Standings</h3>
      ${keys.length > 1 ? `<div class="tabs" data-conf>${keys.map((k, i) => `<button data-k="${k}" aria-selected="${i === 0}">${k}</button>`).join("")}</div>` : ""}</div>
      <div class="mini-stand" id="miniStand">${miniStanding(conf[keys[0]])}</div>
      <div style="margin-top:14px"><a class="link" href="#/standings">Full standings →</a></div>`;
    if (keys.length > 1) $$("#standHome [data-conf] button").forEach((b) => b.addEventListener("click", () => {
      $$("#standHome [data-conf] button").forEach((x) => x.setAttribute("aria-selected", "false"));
      b.setAttribute("aria-selected", "true"); $("#miniStand").innerHTML = miniStanding(conf[b.dataset.k]);
    }));

    $("#featured").innerHTML = await playerCards(featIds);
    wireSearch($("#mastSearch"), $("#mastResults"));
  }
  const leagueTile = (k, big, lab) => `<div class="c"><div class="lk">${k}</div><div class="big">${big}</div><div class="lab">${lab}</div></div>`;
  const leagueStatTile = (rows, k, unit) => {
    if (!rows || !rows.length) return leagueTile(k, "—", "");
    const r = rows[0];
    return `<div class="c"><div class="lk">${k}</div><div class="big">${one(r[3])}</div><div class="lab">${headshot(r[0], r[1], r[2], "xs")} ${pLink(r[0], r[1])}</div></div>`;
  };
  function wireLeadTabs(scope, S, n = 10) {
    const tabs = $("[data-leadtabs]", scope), body = $("[data-leadbody]", scope);
    $$("button", tabs).forEach((b) => b.addEventListener("click", () => {
      $$("button", tabs).forEach((x) => x.setAttribute("aria-selected", "false"));
      b.setAttribute("aria-selected", "true"); body.innerHTML = leaderList(S, b.dataset.k, n);
    }));
  }

  /* ================= NEWS ================= */
  /* ================= BETTING / SLATE ================= */
  async function renderBetting() {
    let gidx; try { gidx = await getGamesIdx(META.current); } catch { return notFound("games"); }
    const S = await getSeason(META.current).catch(() => null);
    const injD = await getInjuries().catch(() => null);
    const oddsD = await getOdds().catch(() => null);
    const byTeam = (injD && injD.byTeam) || {}, byPlayer = (injD && injD.byPlayer) || {};
    const oddsBy = (oddsD && oddsD.byGame) || {}, oddsBook = (oddsD && oddsD.book) || "";
    const ml = (v) => (v == null ? "—" : v > 0 ? "+" + v : "" + v);
    const oddsLive = oddsBook && oddsBook !== "sample";   // never show placeholder lines as if real
    const oddsLine = (g) => { const o = oddsBy[`${g.a}@${g.h}`]; if (!o || !oddsLive) return "";
      return `<div class="bh-odds">${o.spread != null ? `<span class="oc">${g.h} <b>${o.spread > 0 ? "+" + o.spread : o.spread}</b></span>` : ""}${o.total != null ? `<span class="oc">O/U <b>${o.total}</b></span>` : ""}${o.mlA != null ? `<span class="oc">${g.a} ML <b>${ml(o.mlA)}</b> · ${g.h} <b>${ml(o.mlH)}</b></span>` : ""}<span class="obk">${esc(oddsBook)}</span></div>`; };
    const rec = {}; ((S && S.standings) || []).forEach((r) => (rec[r.abbr] = r));
    const lastNm = (n) => (n || "").split(" ").slice(-1)[0];
    const injLine = (ab) => { const list = byTeam[ab] || []; if (!list.length) return ""; const out = list.filter((x) => x.status === "Out"), dtd = list.length - out.length;
      return `<span class="bh-inj"><b>${ab}</b>${out.length ? ` <span class="inj-out">OUT ${esc(out.slice(0, 3).map((x) => lastNm(x.name)).join(", "))}${out.length > 3 ? " +" + (out.length - 3) : ""}</span>` : ""}${dtd ? ` <span class="inj-dtd">${dtd} day-to-day</span>` : ""}</span>`; };
    const games = gidx.games.filter((g) => g.hs != null && g.as != null);
    const byDate = {}; games.forEach((g) => (byDate[g.date] = byDate[g.date] || []).push(g));
    const slateDate = Object.keys(byDate).sort().pop();
    const slate = byDate[slateDate] || [];
    const trend = (ab) => {
      const gs = games.filter((g) => g.h === ab || g.a === ab).sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 10);
      if (!gs.length) return null;
      let w = 0, pf = 0, pa = 0, tot = 0, marg = 0;
      const form = gs.map((g) => { const home = g.h === ab, us = home ? g.hs : g.as, them = home ? g.as : g.hs; if (us > them) w++; pf += us; pa += them; tot += us + them; marg += us - them; return us > them; });
      const n = gs.length; return { n, w, l: n - w, pf: pf / n, pa: pa / n, tot: tot / n, marg: marg / n, form };
    };
    const teamRow = (ab) => { const t = trend(ab), r = rec[ab] || {};
      const form = t ? t.form.slice(0, 5).map((wn) => `<span class="bf ${wn ? "w" : "l"}">${wn ? "W" : "L"}</span>`).join("") : "";
      return `<div class="bh-team"><a class="bh-id" href="#/team/${ab}">${teamLogo(ab, "sm")}<span class="ab">${ab}</span></a>
        <span class="bh-rec">${r.w != null ? r.w + "–" + r.l : "—"}</span><span class="bh-form">${form}</span>
        <span class="bh-stat">${t ? one(t.pf) : "—"}<small>PF/g</small></span><span class="bh-stat">${t ? one(t.pa) : "—"}<small>PA/g</small></span></div>`;
    };
    const gameCard = (g) => { const ta = trend(g.a), th = trend(g.h);
      const projTotal = ta && th ? Math.round((ta.tot + th.tot) / 2) : null;
      const edge = ta && th ? (ta.marg > th.marg ? g.a : g.h) : null;
      return `<div class="card pad bhcard"><div class="bh-head"><span class="bh-match"><a href="#/team/${g.a}">${g.a}</a> <span class="at">@</span> <a href="#/team/${g.h}">${g.h}</a></span><a class="link" href="#/game/${g.id}">Box score →</a></div>
        ${teamRow(g.a)}${teamRow(g.h)}
        ${oddsLine(g)}
        ${(byTeam[g.a] || byTeam[g.h]) ? `<div class="bh-injs">${injLine(g.a)}${injLine(g.h)}</div>` : ""}
        <div class="bh-trend">${projTotal ? `<span class="bh-chip">Combined total <b>~${projTotal}</b></span>` : ""}${edge ? `<span class="bh-chip">Recent edge <b>${edge}</b></span>` : ""}${ta && th ? `<span class="bh-chip">Form <b>${g.a} ${ta.w}-${ta.l}</b> · <b>${g.h} ${th.w}-${th.l}</b></span>` : ""}</div></div>`;
    };
    const props = ((S && S.leaders && S.leaders.pts) || []).slice(0, 6);
    setSEO("Today's Slate — Matchups & Trends", "NBA matchup trends, recent form and player prop context for today's slate.");
    app.innerHTML = `<div class="wrap page">
      <div class="crumb"><a href="#/">Home</a><span class="sep">/</span><span>Betting</span></div>
      <div class="section-title"><div><span class="eyebrow">Matchups & trends · ${slateDate ? fmtDate(slateDate, true) : "latest"}</span><h2>Today's slate</h2></div></div>
      <div class="rg-note">Trends are informational only and not betting advice. 21+. Gambling problem? Call <b>1-800-GAMBLER</b>.</div>
      <div class="ad-inline"><span class="lbl">Sponsored</span><div class="slot">Sportsbook placement · 728×90</div></div>
      <div class="bhgrid">${slate.length ? slate.map(gameCard).join("") : `<p class="muted">No games on the current slate — the season is between dates.</p>`}</div>
      ${props.length ? `<div class="section-title small" style="margin-top:26px"><div><h2>Player props to watch</h2></div><span class="hint">season leaders · tap for trends</span></div>
        <div class="ptiles">${props.map((r) => { const ij = byPlayer[r[0]]; return `<a class="ptile" href="#/player/${r[0]}"><span class="ptile-mark">${esc(initials(r[1]))}</span><span class="ptile-body"><span class="ptile-tag">${esc(r[2])} · ${one(r[3])} PPG${ij ? ` <span class="inj-tag ${ij.status === "Out" ? "out" : "dtd"}">${ij.status === "Out" ? "OUT" : "GTD"}</span>` : ""}</span><b>${esc(r[1])}</b><span class="ptile-d">Points, rebounds & assists trends</span></span><span class="ptile-go">→</span></a>`; }).join("")}</div>` : ""}
    </div>`;
  }

  /* ================= SETTINGS ================= */
  /* ---------- Settings (modal overlay, not a page) ---------- */
  let _setModal = null;
  const _setSeg = (name, cur, opts) => `<div class="seg-toggle set-seg" data-set="${name}">${opts.map((o) => `<button data-v="${o[0]}" aria-pressed="${o[0] === cur}">${o[1]}</button>`).join("")}</div>`;
  function _setEsc(e) { if (e.key === "Escape") closeSettings(); }
  function openSettings() {
    if (!_setModal) {
      _setModal = document.createElement("div");
      _setModal.className = "smodal"; _setModal.hidden = true;
      document.body.appendChild(_setModal);
      _setModal.addEventListener("click", (e) => {
        if (e.target.closest(".smodal-backdrop") || e.target.closest(".smodal-x")) { closeSettings(); return; }
        if (e.target.closest("a")) { closeSettings(); return; }          // let legal links navigate
        const b = e.target.closest(".set-seg button"); if (!b) return;
        const set = b.closest(".set-seg").dataset.set;
        if (set === "theme") applyTheme(b.dataset.v, true); else if (set === "density") applyDensity(b.dataset.v, true);
        b.closest(".set-seg").querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      });
    }
    _setModal.innerHTML = `<div class="smodal-backdrop"></div>
      <div class="smodal-panel" role="dialog" aria-modal="true" aria-label="Settings">
        <div class="smodal-head"><h2>Settings</h2><button class="smodal-x" aria-label="Close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>
        <div class="set-card">
          <div class="set-row"><div class="set-l"><b>Appearance</b><span>Light, dark, or match your device.</span></div>${_setSeg("theme", themeMode(), [["system", "System"], ["light", "Light"], ["dark", "Dark"]])}</div>
          <div class="set-row"><div class="set-l"><b>Table density</b><span>Comfortable, or compact for more per screen.</span></div>${_setSeg("density", curDensity(), [["comfortable", "Comfortable"], ["compact", "Compact"]])}</div>
        </div>
        <p class="smodal-note">Stored on this device only. <a class="link" href="#/terms">Terms</a> · <a class="link" href="#/privacy">Privacy</a></p>
      </div>`;
    _setModal.hidden = false; document.body.classList.add("cmdk-open");
    document.addEventListener("keydown", _setEsc);
  }
  function closeSettings() { if (_setModal) _setModal.hidden = true; document.body.classList.remove("cmdk-open"); document.removeEventListener("keydown", _setEsc); }

  /* ================= LEGAL ================= */
  function legalPage(title, sub, sections) {
    setSEO(title, sub);
    app.innerHTML = `<div class="wrap page" style="max-width:760px">
      <div class="crumb"><a href="#/">Home</a><span class="sep">/</span><span>${esc(title)}</span></div>
      <div class="section-title"><div><span class="eyebrow">${esc(sub)}</span><h2>${esc(title)}</h2></div></div>
      <div class="legal">${sections.map((s) => `<h3>${esc(s[0])}</h3><p>${s[1]}</p>`).join("")}
        <p class="legal-foot">Last updated ${seasonLabel(META.current).slice(0, 4)}. Questions about this policy can be sent through the contact options in the app.</p></div>
    </div>`;
  }
  function renderTerms() {
    legalPage("Terms of Service", "The rules for using this site", [
      ["Acceptance of terms", "By accessing or using this website you agree to these Terms of Service. If you do not agree, please do not use the site."],
      ["Use of the site", "This site is provided for personal, non-commercial reference and entertainment. You may browse, search, and share links to pages. You agree not to scrape, resell, or redistribute the data in bulk, disrupt the service, or attempt to gain unauthorized access to any part of it."],
      ["Content and accuracy", "Statistics, ratings, and other information are compiled from public datasets and provided on an “as is” basis for informational purposes. We make no warranty that the content is complete, accurate, or current, and it should not be relied upon for wagering, financial, or other consequential decisions."],
      ["Intellectual property", "Team names, logos, player likenesses, and league marks are the property of their respective owners and are used here for identification and reference only. This site is an independent project and is not affiliated with, endorsed by, or sponsored by any professional league or team."],
      ["Games and puzzles", "Interactive games are provided for entertainment only. There is no entry fee, prize, or wager of any kind."],
      ["Limitation of liability", "To the fullest extent permitted by law, the site and its operators are not liable for any indirect, incidental, or consequential damages arising from your use of the site."],
      ["Changes", "We may update these terms from time to time. Continued use of the site after changes take effect constitutes acceptance of the revised terms."],
    ]);
  }
  function renderPrivacy() {
    legalPage("Privacy Policy", "How we handle your information", [
      ["Overview", "We aim to collect as little personal information as possible. This site is a reference and entertainment tool and does not require you to create an account."],
      ["Information we store", "Your display preferences — such as theme, table density, recent searches, and game progress — are stored locally in your browser using local storage. This information stays on your device and is not transmitted to us."],
      ["Analytics", "We may collect aggregate, non-identifying usage statistics (such as which pages are viewed) to understand how the site is used and to improve it. This data is not used to identify individual visitors."],
      ["Advertising", "Pages may display advertising. Where third-party ad services are used, they may set their own cookies subject to their own policies; we do not share personal information with them."],
      ["Cookies and local storage", "We use local storage for your preferences and, where applicable, cookies for basic functionality and measurement. You can clear this data at any time through your browser settings."],
      ["Children", "The site is intended for a general audience and is not directed at children under 13, and we do not knowingly collect personal information from them."],
      ["Your choices", "You can clear stored preferences by clearing your browser data. You can also use your browser or device privacy controls to limit tracking."],
      ["Changes", "We may update this policy periodically. Material changes will be reflected by updating the date on this page."],
    ]);
  }

  /* ================= PLAY / PUZZLES ================= */
  const GRID_POOL = ["LAL", "BOS", "GSW", "CHI", "MIA", "NYK", "PHI", "DAL", "DEN", "MIL", "PHX", "SAS", "HOU", "CLE", "TOR", "ATL", "MEM", "OKC", "MIN", "SAC", "IND", "POR", "WAS", "DET", "ORL", "NOP", "CHA", "UTA", "BKN", "LAC"];
  const mulberry = (a) => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  function daySeed(dateStr) { const d = dateStr || new Date().toISOString().slice(0, 10); let h = 2166136261; for (const c of d) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
  // Every date the Daily NBA Grid has a board for: from launch (Jul 4 2026) through today, newest first.
  const GRID_START = "2026-07-04";
  function gridDates() {
    const today = new Date().toISOString().slice(0, 10);
    const cur = today >= GRID_START ? today : GRID_START;
    const start = new Date(GRID_START + "T00:00:00Z");
    const out = []; let d = new Date(cur + "T00:00:00Z");
    while (d >= start && out.length < 400) { out.push(d.toISOString().slice(0, 10)); d.setUTCDate(d.getUTCDate() - 1); }
    return out;
  }
  const gridDone = () => { try { return JSON.parse(localStorage.getItem("hw-grid-done") || "[]"); } catch (e) { return []; } };
  const markGridDone = (date) => { try { const s = new Set(gridDone()); s.add(date); localStorage.setItem("hw-grid-done", JSON.stringify([...s])); } catch (e) {} };
  // franchise-relocation aliases so career-team checks count e.g. Sonics as OKC
  const FRANCHISE = { OKC: ["OKC", "SEA"], WAS: ["WAS", "WSB"], UTA: ["UTA", "NOJ"], SAC: ["SAC", "KCK"], BKN: ["BKN", "NJN"], NOP: ["NOP", "NOH", "NOK"], MEM: ["MEM", "VAN"], LAC: ["LAC", "SDC", "BUF"], CHA: ["CHA", "CHH"], HOU: ["HOU", "SDR"], GSW: ["GSW", "SFW", "PHW"], DET: ["DET", "FTW"], ATL: ["ATL", "STL", "MLH"], PHI: ["PHI", "SYR"], LAL: ["LAL", "MNL"] };
  const teamAliases = (ab) => new Set(FRANCHISE[ab] || [ab]);

  // Launcher hub — restrained, editorial: monogram marks, one accent, no clutter.
  async function renderPlay() {
    setSEO("Play — NBA Games & Puzzles", "NBA games and puzzles: the Daily NBA Grid, Stat Duel, Buzzer Beater and Six Spins.");
    const games = [
      { t: "Daily NBA Grid", d: "Fill every square with a player who suited up for both teams. New board every day.", tag: "New board daily", href: "#/play/grid", live: true },
      { t: "Stat Duel", d: "Higher or lower — pick the player with the bigger career number. Build a streak.", tag: "Endless", href: "#/play/duel", live: true },
      { t: "Buzzer Beater", d: "Time your release in the sweet spot and sink as many as you can before the miss meter fills.", tag: "Arcade", href: "#/play/buzzer" },
      { t: "Six Spins", d: "A continuous build — keep spinning to draft attributes toward a 99-overall player.", tag: "Continuous", href: "#/play/sixspins" },
    ];
    const mono = (t) => (t.replace(/[^A-Za-z0-9 ]/g, "").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("") || t.slice(0, 2)).toUpperCase();
    const tile = (g) => `<a class="ptile${g.live ? " live" : ""}" href="${g.href}" ${g.ext ? 'target="_blank" rel="noopener noreferrer"' : ""}>
      <span class="ptile-mark">${mono(g.t)}</span>
      <span class="ptile-body"><span class="ptile-tag">${g.live ? '<span class="ptile-dot"></span>' : ""}${g.tag}</span><b>${esc(g.t)}</b><span class="ptile-d">${esc(g.d)}</span></span>
      <span class="ptile-go">${g.ext ? "↗" : "→"}</span></a>`;
    app.innerHTML = `<div class="wrap page">
      <div class="crumb"><a href="#/">Home</a><span class="sep">/</span><span>Play</span></div>
      <div class="section-title"><div><span class="eyebrow">NBA games &amp; puzzles</span><h2>Play</h2></div></div>
      <a class="ss-hero" href="#/play/grid">
        <div class="ss-hero-l"><span class="eyebrow">Featured · Daily NBA Grid</span>
          <h3>One new grid, every day.</h3>
          <p>Name a player who suited up for both the row's and column's team in each of the nine squares. Come back tomorrow for a fresh board — or dig through the archive.</p>
          <span class="ss-hero-cta">Play today's grid <span>→</span></span></div>
        <div class="ss-hero-mark"><span>NBA</span><span>GRID</span></div>
      </a>
      <div class="section-title small" style="margin-top:26px"><div><h2>All games</h2></div></div>
      <div class="ptiles">${games.map(tile).join("")}</div>
    </div>`;
  }

  // Six Spins embedded in-site (keeps players on Hardwood; framing is allowed).
  function renderSixSpins() {
    setSEO("Six Spins — Play", "Play Six Spins — a continuous NBA game where you spin clues to build a 99-overall player.");
    app.innerHTML = `<div class="wrap page">
      <div class="crumb"><a href="#/">Home</a><span class="sep">/</span><a href="#/play">Play</a><span class="sep">/</span><span>Six Spins</span></div>
      <div class="section-title"><div><span class="eyebrow">Continuous build · embedded</span><h2>Six Spins</h2></div><a class="link" href="https://sixspins.com" target="_blank" rel="noopener noreferrer">Open full ↗</a></div>
      <div class="embed-frame"><iframe src="https://sixspins.com" title="Six Spins — build a 99-overall NBA player" loading="lazy" allow="fullscreen"></iframe></div>
    </div>`;
  }

  // Daily NBA Grid — a new board every day, with an archive back to launch.
  async function renderPlayGrid(dateStr) {
    const dates = gridDates();
    const date = (dateStr && dates.includes(dateStr)) ? dateStr : dates[0];
    const isToday = date === dates[0];
    const done = new Set(gridDone());
    const [r0, r1, r2, c0, c1, c2] = (() => { const rnd = mulberry(daySeed(date)), a = GRID_POOL.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a.slice(0, 6); })();
    const rows = [r0, r1, r2], cols = [c0, c1, c2];
    const head = (ab) => `<div class="gg-head">${teamLogo(ab, "sm")}<span>${ab}</span></div>`;
    const dayLabel = (d) => (d === dates[0] ? "Today" : fmtDate(d, true));
    setSEO("Daily NBA Grid — Play", "Name a player who played for both teams in each square. A new NBA grid every day, with a full archive.");
    app.innerHTML = `<div class="wrap page">
      <div class="crumb"><a href="#/">Home</a><span class="sep">/</span><a href="#/play">Play</a><span class="sep">/</span><span>Daily NBA Grid</span></div>
      <div class="section-title"><div><span class="eyebrow">${isToday ? "Today's board" : "Archive · " + fmtDate(date, true)}</span><h2>Daily NBA Grid</h2></div>
        <label class="season-select"><span>Board</span><select id="gridSel">${dates.map((d) => `<option value="${d}" ${d === date ? "selected" : ""}>${dayLabel(d)}${done.has(d) ? " ✓" : ""}</option>`).join("")}</select></label></div>
      <span class="hint gg-scoreline" id="ggScore">0 / 9 filled</span>
      <div class="grid-game" id="ggBoard">
        <div class="gg-corner"><span class="gg-corner-mark">NBA</span></div>
        ${cols.map(head).join("")}
        ${rows.map((rab) => `${head(rab)}${cols.map((cab) => `<button class="gg-cell" data-r="${rab}" data-c="${cab}" aria-label="${rab} and ${cab}"><span class="gg-plus">+</span></button>`).join("")}`).join("")}
      </div>
      <p class="news-foot" style="margin-top:14px">Tap a square and name a player who suited up for <b>both</b> that row's and column's team (all-time). A new grid unlocks every day — past boards stay in the archive. <a class="link" href="#/play">← All games</a></p>
    </div>`;
    const sel = $("#gridSel");
    if (sel) sel.addEventListener("change", (e) => { const v = e.target.value; location.hash = v === dates[0] ? "#/play/grid" : "#/play/grid/" + v; });
    wireGrid(rows, cols, date);
  }

  function wireGrid(rows, cols, date) {
    let filled = 0;
    const modal = document.createElement("div");
    modal.className = "gg-modal"; modal.hidden = true;
    modal.innerHTML = `<div class="gg-backdrop"></div><div class="gg-panel"><div class="gg-prompt" id="ggPrompt"></div>
      <input id="ggInput" type="text" placeholder="Name a player…" autocomplete="off" spellcheck="false"><div class="gg-msg" id="ggMsg"></div><div class="gg-results" id="ggResults"></div></div>`;
    document.body.appendChild(modal);
    const input = modal.querySelector("#ggInput"), results = modal.querySelector("#ggResults"), msg = modal.querySelector("#ggMsg"), prompt = modal.querySelector("#ggPrompt");
    let active = null;
    const close = () => { modal.hidden = true; document.body.classList.remove("cmdk-open"); active = null; };
    modal.querySelector(".gg-backdrop").addEventListener("click", close);
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !modal.hidden) close(); });
    const render = (q) => {
      const query = q.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
      if (!query) { results.innerHTML = ""; return; }
      const hits = SEARCH.filter((e) => e[1].toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").includes(query)).slice(0, 6);
      results.innerHTML = hits.map((e) => `<button class="gg-opt" data-pid="${e[0]}" data-nm="${esc(e[1])}">${headshot(e[0], e[1], e[5], "xs")}<span class="nm">${esc(e[1])}</span><span class="sub">${esc(e[4].split("-")[0])} · ${seasonLabel(e[2])}–${String(e[3]).slice(2)}</span></button>`).join("");
    };
    input.addEventListener("input", () => render(input.value));
    results.addEventListener("click", async (e) => {
      const opt = e.target.closest(".gg-opt"); if (!opt || !active) return;
      const pid = opt.dataset.pid, nm = opt.dataset.nm;
      msg.textContent = "Checking…"; msg.className = "gg-msg";
      let ok = false;
      try { const p = await getPlayer(pid); const teams = new Set(p.log.map((r) => r[2])); const rA = teamAliases(active.r), cA = teamAliases(active.c); ok = [...rA].some((t) => teams.has(t)) && [...cA].some((t) => teams.has(t)); } catch (er) {}
      if (ok) {
        active.cell.classList.add("done"); active.cell.innerHTML = `${headshot(pid, nm, "", "sm")}<span class="gg-nm">${esc(nm)}</span>`;
        active.cell.onclick = null; filled++; $("#ggScore").textContent = `${filled} / 9 filled`;
        close();
        if (filled === 9) { markGridDone(date); setTimeout(() => showGridWin(date), 260); }
      } else { msg.textContent = `${nm} didn't play for both — try again.`; msg.className = "gg-msg bad"; }
    });
    $$("#ggBoard .gg-cell").forEach((cell) => cell.addEventListener("click", () => {
      if (cell.classList.contains("done")) return;
      active = { r: cell.dataset.r, c: cell.dataset.c, cell };
      prompt.innerHTML = `Played for <b>${tName(active.r)}</b> <span class="gg-x">×</span> <b>${tName(active.c)}</b>`;
      msg.textContent = ""; input.value = ""; results.innerHTML = "";
      modal.hidden = false; document.body.classList.add("cmdk-open");
      requestAnimationFrame(() => input.focus());
    }));
  }

  // Achievement screen shown when a grid is completed 9/9.
  function showGridWin(date) {
    const ds = gridDates(), today = ds[0];
    const el = document.createElement("div");
    el.className = "gg-win";
    el.innerHTML = `<div class="gg-win-backdrop"></div>
      <div class="gg-win-card" role="dialog" aria-modal="true" aria-label="Grid complete">
        <div class="gg-win-badge"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7"/></svg></div>
        <span class="eyebrow">Grid complete</span>
        <h2>Nine for nine.</h2>
        <p>You filled every square on the ${date === today ? "today's" : fmtDate(date, true)} board. A fresh grid unlocks each day — the archive keeps the rest.</p>
        <div class="gg-win-cta">
          <button class="btn primary" id="ggWinAnother">Play another board</button>
          <a class="btn" href="#/play">All games</a>
        </div>
      </div>`;
    document.body.appendChild(el);
    document.body.classList.add("cmdk-open");
    const close = () => { el.remove(); document.body.classList.remove("cmdk-open"); };
    el.querySelector(".gg-win-backdrop").addEventListener("click", close);
    el.querySelector("#ggWinAnother").addEventListener("click", () => {
      close(); const i = ds.indexOf(date), next = ds[i + 1] || ds[Math.max(0, i - 1)] || ds[0];
      location.hash = next === ds[0] ? "#/play/grid" : "#/play/grid/" + next;
    });
    requestAnimationFrame(() => el.classList.add("show"));
  }

  // ---- Stat Duel — higher-or-lower on all-time career totals ----
  async function renderStatDuel() {
    let A; try { A = await getAlltime(); } catch { return notFound("game"); }
    const CATS = { pts: "points", trb: "rebounds", ast: "assists", stl: "steals", blk: "blocks", x3p: "three-pointers made", g: "games played" };
    const keys = Object.keys(CATS).filter((k) => (A.career[k] || []).length >= 8);
    let streak = 0, best = +(localStorage.getItem("hw-duel-best") || 0), locked = false, cur = null;
    setSEO("Stat Duel — Play", "Higher or lower — pick the NBA player with the bigger career number, and build a streak.");
    const pickPair = () => {
      const cat = keys[Math.floor(Math.random() * keys.length)], pool = A.career[cat];
      let i = Math.floor(Math.random() * pool.length), j;
      do { j = Math.floor(Math.random() * pool.length); } while (j === i || pool[j][3] === pool[i][3]);
      return { cat, a: pool[i], b: pool[j] };
    };
    const card = (p, side) => `<button class="duel-card" data-side="${side}">
      ${headshot(p[0], p[1], p[2], "hero")}<span class="duel-nm">${esc(p[1])}</span>
      <span class="duel-tm">${esc(p[2])} · ${p[4] - 1}–${p[5]}</span>
      <span class="duel-val" aria-hidden="true">?</span></button>`;
    app.innerHTML = `<div class="wrap page">
      <div class="crumb"><a href="#/">Home</a><span class="sep">/</span><a href="#/play">Play</a><span class="sep">/</span><span>Stat Duel</span></div>
      <div class="section-title"><div><span class="eyebrow">Higher or lower · career totals</span><h2>Stat Duel</h2></div>
        <span class="hint"><span id="duelStreak">0</span> streak · best <span id="duelBest">${best}</span></span></div>
      <div class="duel" id="duelArena"></div>
      <p class="news-foot" style="margin-top:14px">Tap the player with the bigger career total. One wrong pick ends the run. <a class="link" href="#/play">← All games</a></p>
    </div>`;
    const arena = $("#duelArena");
    function draw() {
      cur = pickPair();
      arena.innerHTML = `<div class="duel-q">Who logged more career <b>${CATS[cur.cat]}</b>?</div>
        <div class="duel-row">${card(cur.a, "a")}<span class="duel-vs">VS</span>${card(cur.b, "b")}</div>`;
      locked = false;
      $$(".duel-card", arena).forEach((c) => c.addEventListener("click", () => choose(c.dataset.side)));
    }
    function choose(side) {
      if (locked) return; locked = true;
      const win = cur.a[3] >= cur.b[3] ? "a" : "b";
      $$(".duel-card", arena).forEach((c) => {
        const p = c.dataset.side === "a" ? cur.a : cur.b;
        c.querySelector(".duel-val").textContent = p[3].toLocaleString();
        c.classList.add(c.dataset.side === win ? "win" : "lose");
      });
      if (side === win) {
        streak++; $("#duelStreak").textContent = streak;
        if (streak > best) { best = streak; localStorage.setItem("hw-duel-best", best); $("#duelBest").textContent = best; }
        setTimeout(draw, 1150);
      } else {
        setTimeout(() => duelOver(), 1200);
      }
    }
    function duelOver() {
      arena.innerHTML = `<div class="duel-over">
        <span class="eyebrow">Run over</span><div class="duel-over-score">${streak}</div>
        <p>${streak === best && streak > 0 ? "A new best streak!" : "Best streak: " + best}</p>
        <button class="btn primary" id="duelAgain">Play again</button></div>`;
      streak = 0; $("#duelStreak").textContent = 0;
      $("#duelAgain").addEventListener("click", draw);
    }
    draw();
  }

  // ---- Buzzer Beater — timing-bar arcade shooting ----
  async function renderBuzzer() {
    setSEO("Buzzer Beater — Play", "Time your release in the sweet spot and sink as many NBA buckets as you can.");
    const best = +(localStorage.getItem("hw-buzzer-best") || 0);
    app.innerHTML = `<div class="wrap page">
      <div class="crumb"><a href="#/">Home</a><span class="sep">/</span><a href="#/play">Play</a><span class="sep">/</span><span>Buzzer Beater</span></div>
      <div class="section-title"><div><span class="eyebrow">Arcade · timing</span><h2>Buzzer Beater</h2></div>
        <span class="hint"><span id="bzScore">0</span> made · best <span id="bzBest">${best}</span></span></div>
      <div class="buzzer" id="bzArena">
        <div class="bz-court">
          <svg class="bz-hoop" viewBox="0 0 120 80" aria-hidden="true"><rect x="52" y="6" width="16" height="26" rx="2" fill="none" stroke="currentColor" stroke-width="2.5"/><line x1="44" y1="34" x2="76" y2="34" stroke="var(--accent)" stroke-width="3"/><path d="M46 35 L50 48 M74 35 L70 48 M54 35 L56 50 M66 35 L64 50 M60 35 L60 51" stroke="var(--accent-deep)" stroke-width="1.4" fill="none" opacity=".8"/></svg>
          <div class="bz-ball" id="bzBall"></div>
        </div>
        <div class="bz-track" id="bzTrack"><div class="bz-zone" id="bzZone"></div><div class="bz-marker" id="bzMarker"></div></div>
        <button class="btn primary bz-shoot" id="bzShoot">Shoot</button>
        <div class="bz-lives" id="bzLives"></div>
      </div>
      <p class="news-foot" style="margin-top:14px">Tap <b>Shoot</b> (or press Space) when the marker is inside the green zone. It gets faster and tighter as you go — three misses and it's over. <a class="link" href="#/play">← All games</a></p>
    </div>`;
    const marker = $("#bzMarker"), zoneEl = $("#bzZone"), ball = $("#bzBall"), livesEl = $("#bzLives");
    let pos = 0, dir = 1, spd = 0.85, zone = 0.26, score = 0, misses = 0, over = false, raf = 0, last = performance.now();
    const setLives = () => { livesEl.innerHTML = [0, 1, 2].map((i) => `<span class="bz-life${i < 3 - misses ? " on" : ""}"></span>`).join(""); };
    const setZone = () => { const c = 0.5; zoneEl.style.left = ((c - zone / 2) * 100) + "%"; zoneEl.style.width = (zone * 100) + "%"; };
    setLives(); setZone();
    function loop(t) {
      if (over || !document.body.contains(marker)) return;
      const dt = Math.min(0.05, (t - last) / 1000); last = t;
      pos += dir * spd * dt; if (pos > 1) { pos = 1; dir = -1; } else if (pos < 0) { pos = 0; dir = 1; }
      marker.style.left = (pos * 100) + "%";
      raf = requestAnimationFrame(loop);
    }
    raf = requestAnimationFrame(loop);
    function shoot() {
      if (over) return;
      const made = Math.abs(pos - 0.5) <= zone / 2;
      ball.classList.remove("make", "miss"); void ball.offsetWidth;
      if (made) {
        score++; $("#bzScore").textContent = score; ball.classList.add("make");
        spd = Math.min(2.4, spd + 0.09); zone = Math.max(0.09, zone - 0.012); setZone();
        if (score > best) { localStorage.setItem("hw-buzzer-best", score); $("#bzBest").textContent = score; }
      } else {
        misses++; ball.classList.add("miss"); setLives();
        if (misses >= 3) return bzOver();
      }
    }
    function bzOver() {
      over = true; cancelAnimationFrame(raf);
      $("#bzArena").innerHTML = `<div class="duel-over"><span class="eyebrow">Final buzzer</span>
        <div class="duel-over-score">${score}</div><p>buckets made${score >= best && score > 0 ? " · new best!" : " · best " + best}</p>
        <button class="btn primary" id="bzAgain">Shoot again</button></div>`;
      $("#bzAgain").addEventListener("click", renderBuzzer);
    }
    $("#bzShoot").addEventListener("click", shoot);
    const keyh = (e) => { if (e.key === " " || e.code === "Space") { e.preventDefault(); shoot(); } };
    document.addEventListener("keydown", keyh);
    // stop listening once the arena is gone
    const obs = setInterval(() => { if (!document.body.contains(marker)) { document.removeEventListener("keydown", keyh); cancelAnimationFrame(raf); clearInterval(obs); } }, 1000);
  }

  async function renderNews() {
    let news; try { news = await getNews(); } catch { news = null; }
    const items = (news && news.items) || [];
    const bySource = {};
    items.forEach((it) => { (bySource[it.source] = bySource[it.source] || []).push(it); });
    app.innerHTML = `<div class="wrap page">
      <div class="crumb"><a href="#/">Home</a><span class="sep">/</span><span>News</span></div>
      <div class="section-title"><div><span class="eyebrow">${items.length} headlines · updated ${news ? timeAgo(news.fetched) + " ago" : "—"}</span><h2>Around the league</h2></div></div>
      ${items.length ? `<div class="ncard-grid">${items.map((it, i) => newsCard(it, i)).join("")}</div>
        <p class="news-foot" style="margin-top:16px">Aggregated NBA headlines from ESPN, CBS Sports, Yahoo and Sporting News, with player tags detected automatically. Each item opens an in-site summary that links to the full story at its source. Re-run <code>build/fetch_news.py</code> to refresh.</p>` :
        `<p class="muted">No news loaded yet — run <code>build/fetch_news.py</code> to populate the feed.</p>`}
    </div>`;
  }

  /* ================= GAMES ================= */
  const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const MO = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function fmtDate(d, withYear) {   // "2026-06-13" -> "Sat, Jun 13"
    const [y, m, day] = d.split("-").map(Number);
    const wd = WD[new Date(Date.UTC(y, m - 1, day)).getUTCDay()];
    return `${wd}, ${MO[m - 1]} ${day}${withYear ? ", " + y : ""}`;
  }
  const gameTypeBadge = (t, label) => label ? `<span class="gbadge po">${esc(label)}</span>` : (t && t !== "Regular Season" ? `<span class="gbadge">${esc(t)}</span>` : "");

  // OP.GG-style match row: dense, winner-emphasised, score-share bar + a
  // competitiveness tag (Clutch/Close/Blowout) colour-coded on the left rail.
  function matchRow(g) {
    const hw = (g.hs || 0) > (g.as || 0), aw = !hw && g.hs != null;
    const margin = Math.abs((g.hs || 0) - (g.as || 0));
    const played = g.hs != null && g.as != null;
    const comp = !played ? "tbd" : margin <= 3 ? "clutch" : margin <= 8 ? "close" : margin >= 20 ? "blowout" : "normal";
    const total = (g.hs || 0) + (g.as || 0) || 1, aPct = Math.round((g.as || 0) / total * 100);
    const tag = comp === "clutch" ? "Clutch" : comp === "close" ? "Close" : played ? "+" + margin : "";
    return `<a class="mrow c-${comp}" href="#/game/${g.id}">
      <span class="mr-team a ${aw ? "win" : ""}">${teamLogo(g.a, "sm")}<span class="ab">${g.a}</span></span>
      <span class="mr-mid">
        <span class="mr-sc ${aw ? "win" : ""}">${g.as ?? "—"}</span>
        <span class="mr-bar"><i class="${aw ? "win" : ""}" style="width:${aPct}%"></i><i class="${hw ? "win" : ""}" style="width:${100 - aPct}%"></i></span>
        <span class="mr-sc ${hw ? "win" : ""}">${g.hs ?? "—"}</span>
      </span>
      <span class="mr-team h ${hw ? "win" : ""}"><span class="ab">${g.h}</span>${teamLogo(g.h, "sm")}</span>
      <span class="mr-tag t-${comp}">${tag}</span>
      <span class="mr-badge">${gameTypeBadge(g.type, g.label)}</span></a>`;
  }

  async function renderGames(season) {
    const cur = META.current, s = +season || cur;
    let idx; try { idx = await getGamesIdx(s); } catch { return notFound("games"); }
    const sel = `<select class="mini-select" id="gmSeasonSel">${META.seasons.map((y) => `<option value="${y}" ${y === s ? "selected" : ""}>${seasonLabel(y)}</option>`).join("")}</select>`;
    // newest first, grouped by date; the whole season is rendered in scroll-loaded batches
    const games = idx.games.slice().reverse();
    const byDate = [];
    const seen = {};
    for (const g of games) { if (!seen[g.date]) { seen[g.date] = []; byDate.push([g.date, seen[g.date]]); } seen[g.date].push(g); }
    const dayHtml = ([date, gs2]) => `<div class="gday"><h3 class="gday-h">${fmtDate(date, true)}<span class="gday-n">${gs2.length} game${gs2.length > 1 ? "s" : ""}</span></h3>
      <div class="mfeed">${gs2.map(matchRow).join("")}</div></div>`;
    const BATCH = 12;
    app.innerHTML = `<div class="wrap page">
      <div class="crumb"><a href="#/">Home</a><span class="sep">/</span><span>Scores</span></div>
      <div class="section-title"><div><span class="eyebrow">${idx.games.length} games · ${byDate.length} game-days · ${seasonLabel(s)}</span><h2>Scores</h2></div>${sel}</div>
      <div class="slate-legend"><span class="ll">Game quality</span><span><i class="lg clutch"></i>Clutch ≤3</span><span><i class="lg close"></i>Close ≤8</span><span><i class="lg blowout"></i>Blowout ≥20</span></div>
      <div id="gmFeed">${byDate.slice(0, BATCH).map(dayHtml).join("")}</div>
      <div class="gm-more" id="gmMore"></div>
    </div>`;
    let shown = Math.min(BATCH, byDate.length);
    const feed = $("#gmFeed"), more = $("#gmMore");
    let io = null;
    const loadMore = () => {
      const next = byDate.slice(shown, shown + BATCH);
      feed.insertAdjacentHTML("beforeend", next.map(dayHtml).join(""));
      shown += next.length; sync();
    };
    const sync = () => {
      if (shown >= byDate.length) {
        if (io) { io.disconnect(); io = null; }
        more.innerHTML = `<p class="news-foot" style="margin:8px 0 0">All ${idx.games.length} games shown · ${seasonLabel(s)}. Box scores, quarter lines and plus-minus come from the public game dataset (<code>build/build_games.py</code>).</p>`;
      } else {
        more.innerHTML = `<button class="btn load-more" id="gmLoadBtn">Load more game-days <span class="muted">· ${byDate.length - shown} left</span></button>`;
        $("#gmLoadBtn").addEventListener("click", loadMore);
      }
    };
    sync();
    if ("IntersectionObserver" in window && shown < byDate.length) {
      io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting) && io && shown < byDate.length) loadMore(); }, { rootMargin: "700px 0px" });
      io.observe(more);
    }
    const gs = $("#gmSeasonSel"); if (gs) gs.addEventListener("change", () => (location.hash = `#/games/${gs.value}`));
  }

  async function renderGame(id) {
    let g; try { g = await getGame(id); } catch { return notFound("game"); }
    const hw = (g.home.score || 0) > (g.away.score || 0);
    const nOT = Math.max((g.home.q || []).length, (g.away.q || []).length) - 4;
    const cols = ["1", "2", "3", "4", ...Array.from({ length: Math.max(0, nOT) }, (_, i) => "OT" + (nOT > 1 ? i + 1 : ""))];
    const nz = (v) => (v == null ? "—" : v);
    const frac = (m, a) => (m == null && a == null ? "—" : `${nz(m)}-${nz(a)}`);
    const margin = Math.abs((g.home.score || 0) - (g.away.score || 0));
    // game leaders across both benches — the "who won it" glance box
    const roster = [...g.box.away.map((p) => ({ ...p, ab: g.away.abbr })), ...g.box.home.map((p) => ({ ...p, ab: g.home.abbr }))].filter((p) => p.min != null && p.pid);
    const leaderOf = (key) => roster.filter((p) => p[key] != null).sort((a, b) => b[key] - a[key])[0];
    const teamTop = (side) => g.box[side].filter((p) => p.pts != null && p.pid).sort((a, b) => b.pts - a.pts)[0];
    const glCard = (cat, key, unit) => { const L = leaderOf(key); if (!L || !L[key]) return ""; return `<div class="gl" onclick="location.hash='#/player/${L.pid}'">${headshot(L.pid, L.name, L.ab, "sm")}<div class="who2"><div class="cat">${cat}</div><div class="nm">${esc(L.name)} · ${L.ab}</div></div><div class="val">${L[key]}<small>${unit}</small></div></div>`; };
    const glCards = [glCard("Points", "pts", "pts"), glCard("Rebounds", "reb", "reb"), glCard("Assists", "ast", "ast")].filter(Boolean);
    const leadersStrip = glCards.length ? `<div class="gleaders">${glCards.join("")}</div>` : "";
    const topLine = (side) => { const t = teamTop(side); return t ? `<div class="gh-lead"><span><b>${esc(t.name)}</b> ${t.pts} PTS</span></div>` : ""; };

    const lineRow = (side) => `<tr class="${(side === "home" ? hw : !hw) ? "win" : ""}"><td class="l grow">${teamLogo(g[side].abbr, "xs")} <a href="#/team/${g[side].abbr}">${esc(tName(g[side].abbr))}</a></td>
      ${cols.map((_, i) => `<td>${g[side].q && g[side].q[i] != null ? g[side].q[i] : "—"}</td>`).join("")}<td class="hi">${g[side].score ?? "—"}</td></tr>`;
    const boxTable = (side) => {
      const players = g.box[side].filter((p) => p.min != null);
      const maxPts = Math.max(1, ...players.map((p) => p.pts || 0));
      const topPts = Math.max(-1, ...players.map((p) => (p.pts == null ? -1 : p.pts)));
      const hasStarters = players.some((p) => p.start);
      const ordered = hasStarters ? [...players.filter((p) => p.start), ...players.filter((p) => !p.start)] : players;
      const firstBench = hasStarters ? players.filter((p) => p.start).length : -1;
      const prow = (p, i) => `<tr class="${p.pid ? "clickable" : ""}${p.start ? " starter" : ""}${i === firstBench ? " benchsep" : ""}" ${p.pid ? `onclick="location.hash='#/player/${p.pid}'"` : ""}>
        <td class="l grow"><span class="who">${p.pid ? headshot(p.pid, p.name, g[side].abbr, "xs") : ""}${p.pid ? `<a href="#/player/${p.pid}">${esc(p.name)}</a>` : `<span class="nm">${esc(p.name)}</span>`}</span></td>
        <td>${nz(p.min)}</td><td class="hi bar${p.pts != null && p.pts === topPts && topPts > 0 ? " peak" : ""}" style="--b:${((p.pts || 0) / maxPts).toFixed(3)}">${nz(p.pts)}</td><td>${nz(p.reb)}</td><td>${nz(p.ast)}</td><td>${nz(p.stl)}</td><td>${nz(p.blk)}</td><td>${nz(p.tov)}</td>
        <td>${frac(p.fgm, p.fga)}</td><td>${frac(p.tpm, p.tpa)}</td><td>${frac(p.ftm, p.fta)}</td><td class="${p.pm > 0 ? "pos" : p.pm < 0 ? "neg" : ""}">${p.pm == null ? "—" : p.pm > 0 ? "+" + p.pm : p.pm}</td></tr>`;
      const win = (side === "home" ? hw : !hw);
      return `<div class="card pad" style="min-width:0"><div class="card-h"><h3>${teamLogo(g[side].abbr, "sm")} ${esc(tName(g[side].abbr))}</h3><span class="hint">${win ? "Win" : "Loss"} · ${g[side].score ?? "—"} pts${g[side].fg != null ? " · " + pctf(g[side].fg) + " FG" : ""}</span></div>
        <div class="tbl-wrap"><table class="ref" style="min-width:640px"><thead><tr><th class="l grow">Player</th><th>MIN</th><th>PTS</th><th>REB</th><th>AST</th><th>STL</th><th>BLK</th><th>TOV</th><th>FG</th><th>3P</th><th>FT</th><th>+/−</th></tr></thead>
        <tbody>${ordered.map(prow).join("")}</tbody></table></div></div>`;
    };
    app.innerHTML = `<div class="wrap page">
      <div class="crumb"><a href="#/">Home</a><span class="sep">/</span><a href="#/games">Games</a><span class="sep">/</span><span>${g.away.abbr} @ ${g.home.abbr}</span></div>
      <div class="game-head">
        <div class="gh-team ${hw ? "" : "win"}">${teamLogo(g.away.abbr, "hero")}<div><div class="gh-ab"><a href="#/team/${g.away.abbr}">${esc(tName(g.away.abbr))}</a></div><div class="gh-score">${g.away.score ?? "—"}</div>${topLine("away")}</div></div>
        <div class="gh-mid"><div class="gh-final">FINAL${nOT > 0 ? "/OT" + (nOT > 1 ? nOT : "") : ""}</div><div class="gh-meta">${fmtDate(g.date, true)}</div>${gameTypeBadge(g.type, g.label)}${margin ? `<div class="gh-rec">Won by ${margin}</div>` : ""}</div>
        <div class="gh-team ${hw ? "win" : ""}"><div class="r"><div class="gh-ab"><a href="#/team/${g.home.abbr}">${esc(tName(g.home.abbr))}</a></div><div class="gh-score">${g.home.score ?? "—"}</div>${topLine("home")}</div>${teamLogo(g.home.abbr, "hero")}</div>
      </div>
      ${leadersStrip}
      <div class="card pad" style="margin-bottom:20px"><div class="tbl-wrap"><table class="ref" style="min-width:0"><thead><tr><th class="l grow">Team</th>${cols.map((c) => `<th>${c}</th>`).join("")}<th>T</th></tr></thead><tbody>${lineRow("away")}${lineRow("home")}</tbody></table></div>
        ${g.arena ? `<p class="news-foot" style="margin-top:12px;border:0;padding:0">${esc(g.arena)}${g.arenaCity ? " · " + esc(g.arenaCity) : ""}${g.attendance ? " · " + g.attendance.toLocaleString() + " att." : ""}${g.officials ? " · Officials: " + esc(g.officials) : ""}</p>` : ""}</div>
      <div class="ad-inline"><span class="lbl">Advertisement</span><div class="slot">Ad · 728×90</div></div>
      <div class="col2grid">${boxTable("away")}${boxTable("home")}</div>
      <div id="relGames"></div>
    </div>`;
    setSEO(`${tName(g.away.abbr)} vs ${tName(g.home.abbr)} — ${fmtDate(g.date, true)}`,
      `${tName(g.away.abbr)} ${g.away.score ?? ""}, ${tName(g.home.abbr)} ${g.home.score ?? ""} — box score, quarter scores and player stats from ${fmtDate(g.date, true)}${g.type && g.type !== "Regular Season" ? " (" + g.type + ")" : ""}.`);
    relatedGames(g).then((html) => { const el = $("#relGames"); if (el && html) el.innerHTML = html; });
  }

  // Related internal links for a game — season series + same-day slate.
  async function relatedGames(g) {
    let idx; try { idx = await getGamesIdx(g.season); } catch (e) { return ""; }
    const A = g.away.abbr, H = g.home.abbr, cards = [];
    const grow = (x) => `<a href="#/game/${x.id}"><span class="nm">${x.a} @ ${x.h}</span><span class="meta"><b>${x.as ?? "—"}–${x.hs ?? "—"}</b> · ${fmtDate(x.date)}</span></a>`;
    const series = idx.games.filter((x) => x.id !== g.id && ((x.a === A && x.h === H) || (x.a === H && x.h === A)));
    if (series.length) cards.push(`<div class="rel-card"><div class="rh"><b>Season series</b><span class="hint">${A} vs ${H}</span></div>
      <div class="rel-list">${series.slice(0, 6).map(grow).join("")}</div></div>`);
    const sameDay = idx.games.filter((x) => x.id !== g.id && x.date === g.date);
    if (sameDay.length) cards.push(`<div class="rel-card"><div class="rh"><b>Same day</b><span class="hint">${fmtDate(g.date)}</span></div>
      <div class="rel-list">${sameDay.slice(0, 6).map(grow).join("")}</div></div>`);
    if (!cards.length) return "";
    return `<div class="section-title" style="margin-top:26px"><div><h2>Related games</h2></div><a class="link" href="#/games/${g.season}">All ${seasonLabel(g.season)} games →</a></div><div class="rel-grid">${cards.join("")}</div>`;
  }

  // recent-games feed for a player profile (returns the card only, "" if none)
  async function recentGamesCard(pid) {
    let rows; try { rows = await getPGames(pid); } catch { return ""; }
    if (!rows || !rows.length) return "";
    const N = 12, extra = rows.length > N;
    const rowHtml = (r, i) => `<tr class="clickable${i >= N ? " gl-extra" : ""}" onclick="location.hash='#/game/${r.id}'">
      <td class="l grow season">${fmtDate(r.date)}</td>
      <td class="l"><span class="ha">${r.home ? "" : "@"}</span>${teamTag(r.opp)}</td>
      <td class="l"><span class="pill ${r.w ? "w" : "l"}">${r.w ? "W" : "L"}</span> <span class="muted">${r.us}–${r.them}</span></td>
      <td>${r.min ?? "—"}</td><td class="hi">${r.pts ?? "—"}</td><td>${r.reb ?? "—"}</td><td>${r.ast ?? "—"}</td>
      <td class="${r.pm > 0 ? "pos" : r.pm < 0 ? "neg" : ""}">${r.pm == null ? "—" : r.pm > 0 ? "+" + r.pm : r.pm}</td></tr>`;
    return `<div class="card pad" style="min-width:0"><div class="card-h"><h3>Game log</h3><span class="hint">${rows.length} games</span></div>
      <div class="tbl-wrap"><table class="ref gl-table${extra ? " gl-collapsed" : ""}" style="min-width:520px">
        <thead><tr><th class="l grow">Date</th><th class="l">Opp</th><th class="l">Result</th><th>MIN</th><th>PTS</th><th>REB</th><th>AST</th><th>+/−</th></tr></thead>
        <tbody>${rows.map(rowHtml).join("")}</tbody></table></div>
      ${extra ? `<button class="btn gl-toggle" style="margin-top:12px;width:100%;justify-content:center" onclick="const t=this.closest('.card').querySelector('.gl-table');t.classList.toggle('gl-collapsed');this.textContent=t.classList.contains('gl-collapsed')?'Show all ${rows.length} games':'Show fewer';">Show all ${rows.length} games</button>` : ""}</div>`;
  }

  // Prop trends (betting angle): recent PTS/REB/AST vs season average, hit-rate + sparkline.
  async function propTrendsCard(pid) {
    let rows; try { rows = await getPGames(pid); } catch { return ""; }
    const played = (rows || []).filter((r) => r.min != null && r.pts != null);
    if (played.length < 5) return "";
    const stat = (key, label) => {
      const vals = played.map((r) => r[key] ?? 0);
      const line = +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1);
      const l10 = vals.slice(0, 10);
      const overL10 = l10.filter((v) => v > line).length, overAll = vals.filter((v) => v > line).length;
      const spark = l10.slice().reverse(), mx = Math.max(...spark, 1);
      const bars = spark.map((v) => `<span class="pt-bar${v > line ? " over" : ""}" style="height:${Math.max(10, v / mx * 100).toFixed(0)}%" title="${v}"></span>`).join("");
      return `<div class="pt-row"><div class="pt-h"><span class="pt-lab">${label}</span><span class="pt-line">avg <b>${line}</b></span></div>
        <div class="pt-spark">${bars}</div>
        <div class="pt-hit"><b>${overL10}/10</b> over, last 10 · <span class="muted">${Math.round(overAll / vals.length * 100)}% season</span></div></div>`;
    };
    // vs-opponent scoring (bettors' key matchup lookup)
    const byOpp = {};
    played.forEach((r) => { if (isRealTeam(r.opp)) (byOpp[r.opp] = byOpp[r.opp] || []).push(r); });
    const opps = Object.entries(byOpp).map(([opp, gs]) => ({ opp, n: gs.length, pts: gs.reduce((a, g) => a + (g.pts || 0), 0) / gs.length }))
      .sort((a, b) => b.pts - a.pts).slice(0, 8);
    const vsOpp = opps.length ? `<div class="pt-vs"><div class="pt-vs-h">Points by opponent</div><div class="pt-vs-grid">${opps.map((o) => `<a class="pt-vs-cell" href="#/team/${o.opp}">${teamLogo(o.opp, "xs")}<span class="pt-vs-pts">${one(o.pts)}</span><span class="pt-vs-n">${o.n}g</span></a>`).join("")}</div></div>` : "";
    return `<div class="card pad" style="min-width:0"><div class="card-h"><h3>Prop trends</h3><span class="hint">vs season avg · last ${played.length}</span></div>
      ${stat("pts", "Points")}${stat("reb", "Rebounds")}${stat("ast", "Assists")}${vsOpp}</div>`;
  }

  // Related internal links for a player — teammates + verified draft class.
  // More on-page links → more pages/session and denser internal linking for SEO.
  async function relatedPlayers(p) {
    const c = p.cur, id = p.id, cards = [];
    if (isRealTeam(c.team)) {
      try {
        const t = await getTeam(c.team);
        const mates = (t.roster || []).filter((r) => r[0] && r[0] !== id).slice(0, 7);
        if (mates.length) cards.push(`<div class="rel-card"><div class="rh"><b>Teammates</b><a href="#/team/${c.team}">${esc(tName(c.team))} →</a></div>
          <div class="rel-list">${mates.map((r) => `<a href="#/player/${r[0]}">${headshot(r[0], r[1], c.team, "xs")}<span class="nm">${esc(r[1])}</span><span class="meta"><b>${one(r[4])}</b> ppg</span></a>`).join("")}</div></div>`);
      } catch (e) {}
    }
    // draft class: verify membership across the plausible debut-lag years, so the link is never wrong
    const from = (p.bio && p.bio.from) || (p.log[0] && p.log[0][0]);
    if (from) {
      let cls = null, dyear = null;
      for (const y of [from - 1, from - 2, from]) {
        try { const d = await getDraft(y); if ((d.picks || []).some((pk) => pk[3] === id)) { cls = d; dyear = y; break; } } catch (e) {}
      }
      if (cls) {
        const mates = cls.picks.filter((pk) => pk[3] && pk[3] !== id).slice(0, 7);
        if (mates.length) cards.push(`<div class="rel-card"><div class="rh"><b>Draft class of ${dyear}</b><a href="#/draft/${dyear}">Full draft →</a></div>
          <div class="rel-list">${mates.map((pk) => `<a href="#/player/${pk[3]}"><span class="nm">${esc(pk[4])}</span><span class="meta">#${pk[0]}${isRealTeam(pk[2]) ? " · " + pk[2] : ""}</span></a>`).join("")}</div></div>`);
      }
    }
    if (!cards.length) return "";
    return `<div class="section-title" style="margin-top:26px"><div><h2>Related players</h2></div></div><div class="rel-grid">${cards.join("")}</div>`;
  }

  // Resolve a player's own draft slot (year / round / overall / team), verified by
  // membership across the plausible debut-lag years. Returns {undrafted:true} if none.
  async function draftInfo(p) {
    const from = (p.bio && p.bio.from) || (p.log[0] && p.log[0][0]);
    if (!from) return null;
    const yrs = [from - 1, from - 2, from];
    const files = await Promise.all(yrs.map((y) => getDraft(y).catch(() => null)));
    for (let i = 0; i < files.length; i++) {
      const d = files[i]; if (!d) continue;
      const pk = (d.picks || []).find((x) => x[3] === p.id);
      if (pk) return { year: yrs[i], overall: pk[0], round: pk[1], team: pk[2] };
    }
    return { undrafted: true };
  }

  // Light up a rank pip on a stat tile when the player is top-10 in the league for
  // that stat in their current/last season (season leaders are top-10 lists).
  async function fillRanks(p) {
    let S; try { S = await getSeason(p.cur.season); } catch (e) { return; }
    const L = S.leaders || {};
    $$("#app .tile[data-stat]").forEach((t) => {
      const key = t.dataset.stat; if (!key || !L[key]) return;
      const idx = L[key].findIndex((x) => x[0] === p.id);
      if (idx >= 0) { const v = t.querySelector(".v"); if (v) v.insertAdjacentHTML("afterend", `<span class="trank" title="${ord(idx + 1)} in the NBA · ${seasonLabel(p.cur.season)}">${ord(idx + 1)}</span>`); }
    });
  }

  // Recent-form splits (last 10 / home / away / in wins / in losses) from the game log.
  async function splitsCard(pid) {
    let rows; try { rows = await getPGames(pid); } catch (e) { return ""; }
    if (!rows || rows.length < 4) return "";
    const agg = (rs) => { if (!rs.length) return null; const n = rs.length, s = (k) => rs.reduce((a, r) => a + (r[k] || 0), 0); return { g: n, mpg: s("min") / n, ppg: s("pts") / n, rpg: s("reb") / n, apg: s("ast") / n }; };
    // rest splits — gap to the previous (older) game; ≤1 day = back-to-back/short rest
    const dd = (a, b) => { const [y1, m1, d1] = a.split("-").map(Number), [y2, m2, d2] = b.split("-").map(Number); return Math.round((Date.UTC(y1, m1 - 1, d1) - Date.UTC(y2, m2 - 1, d2)) / 86400000); };
    const rested = [], shortR = [];
    for (let i = 0; i < rows.length; i++) { const nx = rows[i + 1]; if (!nx) { rested.push(rows[i]); continue; } (dd(rows[i].date, nx.date) <= 1 ? shortR : rested).push(rows[i]); }
    const defs = [["Last 10", rows.slice(0, 10)], ["Home", rows.filter((r) => r.home)], ["Away", rows.filter((r) => !r.home)], ["On rest (2+ d)", rested], ["Short rest (≤1 d)", shortR], ["In wins", rows.filter((r) => r.w)], ["In losses", rows.filter((r) => !r.w)]];
    const line = (lab, a) => a ? `<tr><td class="l">${lab}</td><td>${a.g}</td><td>${a.mpg.toFixed(1)}</td><td class="hi">${a.ppg.toFixed(1)}</td><td>${a.rpg.toFixed(1)}</td><td>${a.apg.toFixed(1)}</td></tr>` : "";
    return `<div class="card pad" style="min-width:0"><div class="card-h"><h3>Recent splits</h3><span class="hint">last ${rows.length} games</span></div>
      <div class="tbl-wrap"><table class="ref" style="min-width:0;width:100%"><thead><tr><th class="l">Split</th><th>G</th><th>MPG</th><th>PPG</th><th>RPG</th><th>APG</th></tr></thead>
      <tbody>${defs.map(([lab, rs]) => line(lab, agg(rs))).join("")}</tbody></table></div></div>`;
  }

  // NBA 2K rating card — OVR badge + six attribute-category bars (dense by design).
  async function twoKCard(pid) {
    let d; try { d = await getTwoK(); } catch (e) { return ""; }
    const r = d && d.ratings && d.ratings[pid];
    if (!r) return "";
    const avg = (keys) => { const vs = keys.map((k) => r[k]).filter((v) => v != null); return vs.length ? Math.round(vs.reduce((a, b) => a + b, 0) / vs.length) : null; };
    const cats = [
      ["Outside", avg(["closeShot", "midRangeShot", "threePointShot", "freeThrow"])],
      ["Inside", avg(["layup", "drivingDunk", "standingDunk", "postControl"])],
      ["Playmaking", avg(["passAccuracy", "ballHandle", "speedWithBall", "passVision"])],
      ["Defense", avg(["interiorDefense", "perimeterDefense", "steal", "block", "helpDefenseIQ"])],
      ["Athleticism", avg(["speed", "agility", "strength", "vertical", "stamina"])],
      ["Rebounding", avg(["offensiveRebound", "defensiveRebound"])],
    ].filter((c) => c[1] != null);
    const ovr = r.ovr || 0;
    const tier = ovr >= 95 ? "Legend" : ovr >= 90 ? "Superstar" : ovr >= 85 ? "All-Star" : ovr >= 80 ? "Starter" : ovr >= 75 ? "Rotation" : "Reserve";
    const bar = (lab, v) => `<div class="tk-attr"><div class="tk-lab">${lab}</div><div class="tk-meter"><i style="width:${v}%"></i></div><div class="tk-val">${v}</div></div>`;
    return `<div class="section-title" style="margin-top:26px"><div><h2>NBA 2K rating</h2></div><span class="hint">${esc(d.edition)}</span></div>
      <div class="card pad twok">
        <div class="tk-badge"><div class="tk-ovr">${ovr}</div><div class="tk-ovr-l">Overall</div><div class="tk-tier">${tier}</div></div>
        <div class="tk-attrs">${cats.map(([l, v]) => bar(l, v)).join("")}</div>
      </div>`;
  }

  // Sticky in-page section nav (ESPN-style tabs, but everything stays on one
  // crawlable page). Smooth-scrolls to sections, highlights the active one, and
  // prunes links whose async section never filled.
  function wireJumpNav() {
    const nav = $("#jumpNav"); if (!nav) return;
    const links = $$("a", nav);
    links.forEach((a) => a.addEventListener("click", (e) => { e.preventDefault(); const el = document.getElementById(a.dataset.tgt); if (el) el.scrollIntoView({ behavior: "smooth", block: "start" }); }));
    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver((es) => es.forEach((en) => { if (en.isIntersecting) links.forEach((a) => a.classList.toggle("on", a.dataset.tgt === en.target.id)); }), { rootMargin: "-118px 0px -72% 0px", threshold: 0 });
      links.forEach((a) => { const el = document.getElementById(a.dataset.tgt); if (el) io.observe(el); });
    }
    const prune = () => {
      links.forEach((a) => { const el = document.getElementById(a.dataset.tgt); if (el && !el.textContent.trim() && !el.querySelector("svg,img,canvas,table")) a.remove(); });
      if ($$("a", nav).length <= 1) nav.style.display = "none";
    };
    setTimeout(prune, 500); setTimeout(prune, 1400);
  }

  /* ================= PLAYER ================= */
  async function renderPlayer(id) {
    let p; try { p = await getPlayer(id); } catch { return notFound("player"); }
    const sal = await getSalaries().catch(() => null);
    if (sal) CPI = CPI || await getCPI().catch(() => null);
    const salRows = (sal && sal.byPlayer[id]) || null;
    // season -> team from the player's own game log (fills teams the salary source lacks)
    const salTeam = {};
    p.log.forEach((r) => { if (r[16] !== 2 && isRealTeam(r[2])) salTeam[r[0]] = r[2]; });
    const teamForSeason = (yr) => salTeam[yr] || ((sal && sal.bySeason[yr] || []).find((x) => x[0] === id) || [])[2] || "";
    const b = p.bio, c = p.cur, col = tColor(c.team), curSeasonNo = c.season;
    const age = b.born ? curSeasonNo - (+b.born.slice(0, 4)) : null;
    const spanTeams = [...new Set(p.log.map((r) => r[2]))].filter(isRealTeam);
    const draft = await draftInfo(p).catch(() => null);
    const nSeasons = new Set(p.log.filter((r) => r[16] !== 2).map((r) => r[0])).size;
    const tiles = [["PPG", one(c.pts), "pts", 1], ["RPG", one(c.trb), "trb"], ["APG", one(c.ast), "ast"], ["FG%", pctf(c.fg), "fg_percent"], ["3P%", pctf(c.tp), "x3p_percent"], ["TS%", pctf(c.ts), "ts_percent"], ["PER", one(c.per), "per"]];

    // per-column context: scale the PTS bar to the player's own career-high season,
    // and pip the single best scoring season (turns the table into a scannable arc).
    const logRows = p.log.filter((r) => r[16] !== 2);
    const maxPts = Math.max(1, ...logRows.map((r) => r[13] || 0));
    const peakYr = (logRows.slice().sort((a, b) => (b[13] || 0) - (a[13] || 0))[0] || [])[0];
    const row = (r) => { const st = r[16] === 2; return `<tr class="${st ? "stint" : "clickable"}" ${st ? "" : `onclick="location.hash='#/pseason/${p.id}/${r[0]}'"`}>
      <td class="l season">${st ? "" : seasonLabel(r[0])}</td><td class="l">${teamTag(r[2])}</td>
      <td>${r[3] ?? "—"}</td><td>${r[4]}</td><td>${one(r[5])}</td>
      <td>${pctf(r[6])}</td><td>${pctf(r[7])}</td><td>${pctf(r[8])}</td>
      <td>${one(r[9])}</td><td>${one(r[10])}</td><td>${one(r[11])}</td><td>${one(r[12])}</td>
      <td class="hi bar${!st && r[0] === peakYr ? " peak" : ""}" style="--b:${((r[13] || 0) / maxPts).toFixed(3)}">${one(r[13])}</td><td>${one(r[14])}</td><td>${pctf(r[15])}</td></tr>`; };
    const cr = p.career || {}, ct = p.ctot || {};
    const careerRow = `<tr class="total">
      <td class="l">Career</td><td class="l muted">${p.log.length} yr</td><td>—</td><td>${cr.g ?? "—"}</td><td>—</td>
      <td>${pctf(cr.fg)}</td><td>${pctf(cr.tp)}</td><td>${pctf(cr.ft)}</td>
      <td>${one(cr.trb)}</td><td>${one(cr.ast)}</td><td>${one(cr.stl)}</td><td>${one(cr.blk)}</td>
      <td class="hi">${one(cr.pts)}</td><td>—</td><td>—</td></tr>`;
    const totRow = (r) => { const st = r[19] === 2; return `<tr class="${st ? "stint" : ""}">
      <td class="l season">${st ? "" : seasonLabel(r[0])}</td><td class="l">${teamTag(r[1])}</td>
      <td>${intOr(r[2])}</td><td>${intOr(r[3])}</td><td>${intc(r[4])}</td><td>${intc(r[5])}</td><td>${intc(r[6])}</td><td>${pctf(r[7])}</td>
      <td>${intOr(r[8])}</td><td>${intOr(r[9])}</td><td>${intOr(r[10])}</td><td>${intOr(r[11])}</td>
      <td>${intOr(r[12])}</td><td>${intOr(r[13])}</td><td>${intOr(r[14])}</td><td>${intOr(r[15])}</td><td>${intOr(r[16])}</td><td class="hi">${intc(r[17])}</td></tr>`; };
    const totCareer = `<tr class="total"><td class="l">Career</td><td class="l muted">${p.log.length} yr</td>
      <td>${intOr(ct.g)}</td><td>—</td><td>—</td><td>${intc(ct.fg)}</td><td>${intc(ct.fga)}</td><td>${pctf(ct.fg && ct.fga ? ct.fg / ct.fga : null)}</td>
      <td>${intOr(ct.x3p)}</td><td>${intOr(ct.x3pa)}</td><td>${intOr(ct.ft)}</td><td>${intOr(ct.fta)}</td>
      <td>${intOr(ct.trb)}</td><td>${intOr(ct.ast)}</td><td>${intOr(ct.stl)}</td><td>${intOr(ct.blk)}</td><td>${intOr(ct.tov)}</td><td class="hi">${intc(ct.pts)}</td></tr>`;
    // Per-36-minutes view (bbref parity): counting stats normalised to 36 min from the totals.
    const p36 = (v, mp) => (mp && v != null ? one(v / mp * 36) : "—");
    const per36Row = (r) => { const st = r[19] === 2, mp = r[4]; return `<tr class="${st ? "stint" : ""}">
      <td class="l season">${st ? "" : seasonLabel(r[0])}</td><td class="l">${teamTag(r[1])}</td>
      <td>${intOr(r[2])}</td><td>${mp && r[2] ? one(mp / r[2]) : "—"}</td>
      <td>${p36(r[5], mp)}</td><td>${p36(r[6], mp)}</td><td>${pctf(r[7])}</td>
      <td>${p36(r[8], mp)}</td><td>${p36(r[9], mp)}</td><td>${p36(r[10], mp)}</td><td>${p36(r[11], mp)}</td>
      <td>${p36(r[12], mp)}</td><td>${p36(r[13], mp)}</td><td>${p36(r[14], mp)}</td><td>${p36(r[15], mp)}</td><td>${p36(r[16], mp)}</td><td class="hi">${p36(r[17], mp)}</td></tr>`; };
    const p36Career = (() => {
      const rs = p.tot.filter((r) => r[19] !== 2), sc = (i) => rs.reduce((a, r) => a + (r[i] || 0), 0), mp = sc(4), g = sc(2);
      const c = (i) => (mp ? one(sc(i) / mp * 36) : "—");
      return `<tr class="total"><td class="l">Career</td><td class="l muted">${p.log.length} yr</td>
        <td>${intOr(g)}</td><td>${mp && g ? one(mp / g) : "—"}</td>
        <td>${c(5)}</td><td>${c(6)}</td><td>${pctf(sc(6) ? sc(5) / sc(6) : null)}</td>
        <td>${c(8)}</td><td>${c(9)}</td><td>${c(10)}</td><td>${c(11)}</td>
        <td>${c(12)}</td><td>${c(13)}</td><td>${c(14)}</td><td>${c(15)}</td><td>${c(16)}</td><td class="hi">${c(17)}</td></tr>`;
    })();
    const advRow = (r) => { const st = r[15] === 2; return `<tr class="${st ? "stint" : ""}">
      <td class="l season">${st ? "" : seasonLabel(r[0])}</td><td class="l">${teamTag(r[1])}</td>
      <td>${intOr(r[2])}</td><td>${intc(r[3])}</td><td>${one(r[4])}</td><td>${pctf(r[5])}</td><td>${one(r[6])}</td>
      <td>${one(r[7])}</td><td>${one(r[8])}</td><td class="hi">${one(r[9])}</td><td>${ws48(r[10])}</td>
      <td>${signed(r[11])}</td><td>${signed(r[12])}</td><td>${signed(r[13])}</td><td>${signed(r[14])}</td></tr>`; };
    const advCareer = `<tr class="total"><td class="l">Career</td><td class="l muted">${p.log.length} yr</td>
      <td>${intOr(ct.g)}</td><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td><td class="hi">${one(ct.ws)}</td><td>—</td><td>—</td><td>—</td><td>—</td><td>${one(ct.vorp)}</td></tr>`;
    const poRow = (r) => `<tr><td class="l season">${seasonLabel(r[0])}</td><td>${r[1]}</td><td class="hi">${one(r[2])}</td><td>${pctf(r[3])}</td></tr>`;
    const H = (arr) => `<thead><tr>${arr.map((h, i) => `<th class="${i < 2 ? "l" : ""}">${h}</th>`).join("")}</tr></thead>`;
    function statTable(view) {
      if (view === "tot") return `<div class="tbl-wrap"><table class="ref" style="min-width:840px">${H(["Season", "Tm", "G", "GS", "MP", "FG", "FGA", "FG%", "3P", "3PA", "FT", "FTA", "REB", "AST", "STL", "BLK", "TOV", "PTS"])}<tbody>${p.tot.map(totRow).join("")}${totCareer}</tbody></table></div>`;
      if (view === "p36") return `<div class="tbl-wrap"><table class="ref" style="min-width:820px">${H(["Season", "Tm", "G", "MPG", "FG", "FGA", "FG%", "3P", "3PA", "FT", "FTA", "REB", "AST", "STL", "BLK", "TOV", "PTS"])}<tbody>${p.tot.map(per36Row).join("")}${p36Career}</tbody></table><p class="news-foot" style="border:0;padding:8px 2px 0;margin:0">Per-36-minute rates — counting stats scaled to a per-36 pace.</p></div>`;
      if (view === "adv") return `<div class="tbl-wrap"><table class="ref" style="min-width:720px">${H(["Season", "Tm", "G", "MP", "PER", "TS%", "USG%", "OWS", "DWS", "WS", "WS/48", "OBPM", "DBPM", "BPM", "VORP"])}<tbody>${p.adv.map(advRow).join("")}${advCareer}</tbody></table></div>`;
      if (view === "po" && p.po) return `<div class="tbl-wrap"><table class="ref" style="min-width:0">${H(["Season", "G", "PPG", "TS%"])}<tbody>${p.po.log.map(poRow).join("")}<tr class="total"><td class="l">Career</td><td>${p.po.g}</td><td class="hi">${one(p.po.ppg)}</td><td>${pctf(p.po.ts)}</td></tr></tbody></table></div>`;
      return `<div class="tbl-wrap"><table class="ref" style="min-width:760px">${H(["Season", "Tm", "Age", "GP", "MPG", "FG%", "3P%", "FT%", "REB", "AST", "STL", "BLK", "PTS", "PER", "TS%"])}<tbody>${p.log.map(row).join("")}${careerRow}</tbody></table></div>`;
    }

    app.innerHTML = `
    <div class="wrap page">
      <div class="crumb"><a href="#/">Home</a><span class="sep">/</span><a href="#/players">Players</a><span class="sep">/</span><span>${esc(p.name)}</span></div>
      <div class="phead">
        <div class="band" style="background:${col}"></div>
        <div class="inner">
          ${headshot(p.id, p.name, c.team, "hero")}
          <div class="ph-main">
            <div class="pos">${esc(c.pos || b.pos || "")}</div>
            <h1>${esc(p.name)}</h1>
            <div class="bio">
              ${bioItem("Seasons", `${seasonLabel(b.from || p.log[0][0])} – ${seasonLabel(b.to || curSeasonNo)}`)}
              ${bioItem("Experience", nSeasons <= 1 ? "Rookie" : nSeasons + " seasons")}
              ${b.ht ? bioItem("Ht / Wt", `${b.ht}${b.wt ? " · " + b.wt + " lb" : ""}`) : ""}
              ${age ? bioItem("Age", `${age}${b.born ? " · b. " + b.born.slice(0, 4) : ""}`) : ""}
              ${draft ? (draft.undrafted ? bioItem("Draft", "Undrafted") : bioItem("Draft", `${draft.year} · Rd ${draft.round}, Pk ${draft.overall}${isRealTeam(draft.team) ? " · " + draft.team : ""}`)) : ""}
              ${b.college ? bioItem("College", esc(b.college)) : ""}
            </div>
            <div class="chip-row">${p.acc.length ? p.acc.map((a) => { const d = accDetail(a.t, p.accy) || accDesc(a.t); return `<span class="chip ${a.g ? "gold" : ""} has-detail" data-acc="${esc(a.t)}" data-years="${esc(d)}">${a.g ? "★ " : ""}${esc(a.t)}</span>`; }).join("") : `<span class="muted" style="font-size:13px">${esc(p.name)} played ${p.log.length} season${p.log.length > 1 ? "s" : ""} in the ${p.log[0][1]}.</span>`}</div>
            <div id="playerInjury"></div>
          </div>
        </div>
      </div>

      <div class="tilerow">${tiles.map(([k, v, sk, a]) => `<div class="tile ${a ? "accent" : ""}" data-stat="${sk || ""}"><div class="k">${k}</div><div class="v">${v}</div></div>`).join("")}
        <div class="tile"><div class="k">Season</div><div class="v" style="font-size:22px">${seasonLabel(curSeasonNo)}</div></div></div>

      <nav class="jumpnav" id="jumpNav">${[["Stats", "sec-stats"], ["Shooting", "sec-shooting"], ["2K", "sec-2k"], ["Recent", "recentForm"], ["News", "playerNews"], (salRows && salRows.length ? ["Salary", "sec-salary"] : null), ["Related", "relPlayers"]].filter(Boolean).map(([lab, t]) => `<a href="#" data-tgt="${t}">${lab}</a>`).join("")}</nav>

      <div class="card pad" id="sec-stats" style="min-width:0;margin-bottom:22px">
        <div class="card-h"><div style="display:flex;align-items:baseline;gap:14px;min-width:0"><h3>Career stats</h3></div>
          <div class="tabs" id="statTabs">
            <button data-v="perg" aria-selected="true">Per Game</button>
            <button data-v="tot" aria-selected="false">Totals</button>
            <button data-v="p36" aria-selected="false">Per 36</button>
            <button data-v="adv" aria-selected="false">Advanced</button>
            ${p.po ? `<button data-v="po" aria-selected="false">Playoffs</button>` : ""}
          </div></div>
        <div id="statBody">${statTable("perg")}</div>
      </div>

      <div class="col2grid" id="sec-shooting">
        <div class="card pad">
          <div class="card-h"><h3>Career shooting</h3><span class="hint">splits</span></div>
          <div class="splits">${[["Field goal", cr.fg], ["Three-point", cr.tp], ["Free throw", cr.ft]].map(([lab, v]) =>
            `<div class="sr"><div class="lab">${lab}</div><div class="meter"><i style="width:${v ? Math.min(100, v * 100) : 0}%"></i></div><div class="pct">${pctf(v)}</div></div>`).join("")}</div>
        </div>
        <div class="card pad">
          <div class="card-h"><h3>Scoring trend</h3><span class="hint">PPG · hover for detail</span></div>
          <div class="trend" id="trend"></div>
        </div>
      </div>
      <div id="sec-2k"></div>
      <div class="ad-inline"><span class="lbl">Advertisement</span><div class="slot">Ad · 728×90</div></div>
      <div id="shotProfile"></div>
      <div id="recentForm"></div>
      <div id="playerNews"></div>
      <div id="relPlayers"></div>
      ${salRows && salRows.length ? `<div class="section-title" id="sec-salary" style="margin-top:26px"><h2>Contracts &amp; salary</h2><a class="link" href="#/salaries">Salary hub →</a></div>
        <div class="col2grid">
          <div class="card pad" style="min-width:0">
            <div class="card-h"><h3>Salary by season</h3>${CPI ? `<div class="tabs" id="pSalToggle"><button data-adj="0" aria-selected="true">Nominal</button><button data-adj="1" aria-selected="false">${seasonLabel(CPI.base)} $</button></div>` : `<span class="hint">tap a row → salaries</span>`}</div>
            <div class="tbl-wrap"><table class="ref" style="min-width:0">
              <thead><tr><th class="l grow">Season</th><th class="l">Team</th><th>Salary</th></tr></thead>
              <tbody>${salRows.map((r) => { const tm = teamForSeason(r[0]); return `<tr class="clickable" onclick="location.hash='#/salaries/${r[0]}'"><td class="l season grow">${seasonLabel(r[0])}</td><td class="l muted">${tm ? teamTag(tm) : "—"}</td><td class="hi pSal" data-sal="${r[1]}" data-season="${r[0]}">${moneyFull(r[1])}</td></tr>`; }).join("")}
                <tr class="total"><td class="l grow">Tracked total</td><td class="l">—</td><td class="hi pSalTotal" data-sal="${sal.careerEarn[id]}">${moneyFull(sal.careerEarn[id])}</td></tr></tbody></table></div>
          </div>
          <div class="card pad">
            <div class="card-h"><h3>Earnings</h3><span class="hint">${sal.range ? seasonLabel(sal.range[0]).slice(0, 4) + "–" + String(sal.range[1]).slice(2) : ""}</span></div>
            <div class="tilerow" style="margin-bottom:14px">
              <div class="tile accent"><div class="k">Tracked earnings</div><div class="v">${money(sal.careerEarn[id])}</div></div>
              <div class="tile"><div class="k">Peak season</div><div class="v">${money(Math.max.apply(null, salRows.map((r) => r[1])))}</div></div>
            </div>
            <p class="news-foot" style="border:0;margin:0;padding:0">Nominal salaries (not inflation-adjusted), merged from public open datasets. Coverage is ${sal.range ? seasonLabel(sal.range[0]) + " through " + seasonLabel(sal.range[1]) : "historical"}; the current season reflects players under contract at last update.</p>
          </div>
        </div>` : ""}
      ${spanTeams.length ? `<div class="section-title" style="margin-top:26px"><h2>Teams</h2></div><div class="chip-row">${spanTeams.map((ab) => `<a href="#/team/${ab}" class="team-pill">${teamLogo(ab, "sm")} ${esc(tName(ab))}</a>`).join("")}</div>` : ""}
    </div>`;
    // ---- SEO: title + description targeting "[player] stats / contract / salary" ----
    (function () {
      const posName = c.pos || b.pos || "", teamName = isRealTeam(c.team) ? tName(c.team) : c.team;
      const yrs = `${seasonLabel(b.from || p.log[0][0])}–${seasonLabel(b.to || curSeasonNo)}`;
      const careerLine = `${one(cr.pts)} PPG, ${one(cr.trb)} RPG, ${one(cr.ast)} APG`;
      const topAcc = (p.acc || []).filter((a) => a.g).slice(0, 2).map((a) => a.t).join(", ");
      let salLine = "";
      if (salRows && salRows.length) {
        const latest = salRows[salRows.length - 1];
        salLine = ` Latest tracked salary ${moneyFull(latest[1])} (${seasonLabel(latest[0])}); career earnings ${money(sal.careerEarn[id])}.`;
      }
      const desc = `${p.name} career stats, contract & salary — ${posName ? posName + " " : ""}${isRealTeam(c.team) ? "for the " + teamName + ". " : ""}${careerLine} across ${p.log.length} season${p.log.length > 1 ? "s" : ""} (${yrs}).${topAcc ? " " + topAcc + "." : ""}${salLine}`;
      const ld = { "@context": "https://schema.org", "@type": "Person", name: p.name, jobTitle: "Basketball player", url: location.href };
      if (b.ht) ld.height = b.ht;
      if (b.born) ld.birthDate = b.born;
      if (b.college) ld.alumniOf = b.college;
      if (isRealTeam(c.team)) ld.affiliation = { "@type": "SportsTeam", name: teamName, sport: "Basketball" };
      setSEO(`${p.name} Stats, Contract & Career`, desc, ld);
    })();
    drawTrend(p);
    const tabs = $("#statTabs"), body = $("#statBody");
    $$("button", tabs).forEach((b) => b.addEventListener("click", () => {
      $$("button", tabs).forEach((x) => x.setAttribute("aria-selected", "false"));
      b.setAttribute("aria-selected", "true"); body.innerHTML = statTable(b.dataset.v);
    }));
    const pTg = $("#pSalToggle");
    if (pTg) $$("button", pTg).forEach((btn) => btn.addEventListener("click", () => {
      const adj = btn.dataset.adj === "1";
      $$("button", pTg).forEach((x) => x.setAttribute("aria-selected", "false")); btn.setAttribute("aria-selected", "true");
      $$(".pSal").forEach((td) => { td.textContent = moneyFull(Math.round(adj ? inflate(+td.dataset.sal, +td.dataset.season) : +td.dataset.sal)); });
      const tt = $(".pSalTotal");
      if (tt) tt.textContent = moneyFull(Math.round(salRows.reduce((s, r) => s + (adj ? inflate(r[1], r[0]) : r[1]), 0)));
    }));
    Promise.all([recentGamesCard(id), splitsCard(id), propTrendsCard(id)]).then(([games, splits, props]) => {
      const el = $("#recentForm"); if (!el || (!games && !splits && !props)) return;
      const right = (splits || "") + (props || "");
      el.innerHTML = `<div class="section-title" style="margin-top:26px"><div><h2>Recent form</h2></div><a class="link" href="#/games">All games →</a></div>
        <div class="two-col">${games || ""}${right ? `<div class="stack">${right}</div>` : ""}</div>`;
    });
    fillRanks(p);
    twoKCard(id).then((html) => { const el = $("#sec-2k"); if (el && html) el.innerHTML = html; });
    wireJumpNav();
    getInjuries().then((inj) => { const r = inj && inj.byPlayer && inj.byPlayer[id]; const el = $("#playerInjury"); if (el && r) el.innerHTML = `<div class="inj-badge ${r.status === "Out" ? "out" : "dtd"}"><span class="inj-status">${esc(r.status)}</span>${r.note ? `<span class="inj-note">${esc(r.note)}</span>` : ""}</div>`; }).catch(() => {});
    playerNews(id).then((html) => { const el = $("#playerNews"); if (el && html) el.innerHTML = html; });
    relatedPlayers(p).then((html) => { const el = $("#relPlayers"); if (el && html) el.innerHTML = html; });
    drawShotProfile(p);
    wireAccHover(app);
  }

  function seasonAccolades(accy, yr) {
    if (!accy) return [];
    const out = [];
    if ((accy.allstar || []).includes(yr)) out.push({ t: "All-Star", g: true });
    const nba = (accy.allnba || []).find((x) => x[0] === yr); if (nba) out.push({ t: `All-NBA${nba[1] ? " (" + nba[1] + ")" : ""}`, g: true });
    const def = (accy.alldef || []).find((x) => x[0] === yr); if (def) out.push({ t: `All-Defense${def[1] ? " (" + def[1] + ")" : ""}`, g: false });
    if ((accy.mvp || []).includes(yr)) out.push({ t: "MVP", g: true });
    if ((accy.dpoy || []).includes(yr)) out.push({ t: "Defensive Player of the Year", g: true });
    if ((accy.roy || []).includes(yr)) out.push({ t: "Rookie of the Year", g: true });
    if ((accy.smoy || []).includes(yr)) out.push({ t: "Sixth Man of the Year", g: true });
    if ((accy.mip || []).includes(yr)) out.push({ t: "Most Improved Player", g: true });
    const rook = (accy.allrookie || []).find((x) => x[0] === yr); if (rook) out.push({ t: `All-Rookie${rook[1] ? " (" + rook[1] + ")" : ""}`, g: false });
    return out;
  }

  async function renderPlayerSeason(pid, y) {
    let p; try { p = await getPlayer(pid); } catch { return notFound("player"); }
    const yr = +y;
    const lr = (p.log || []).find((r) => r[0] === yr && r[16] !== 2);
    if (!lr) return notFound("season");
    const ar = (p.adv || []).find((r) => r[0] === yr && r[15] !== 2);
    const team = lr[2], col = tColor(team), age = lr[3];
    const acc = seasonAccolades(p.accy, yr);
    const tile = (k, v, a) => `<div class="tile ${a ? "accent" : ""}"><div class="k">${k}</div><div class="v">${v}</div></div>`;
    const tiles = [["PPG", one(lr[13]), 1], ["RPG", one(lr[9])], ["APG", one(lr[10])], ["SPG", one(lr[11])], ["BPG", one(lr[12])],
      ["FG%", pctf(lr[6])], ["3P%", pctf(lr[7])], ["FT%", pctf(lr[8])], ["MPG", one(lr[5])], ["PER", one(lr[14])], ["TS%", pctf(lr[15])]];
    const advTiles = ar ? [["USG%", pctf(ar[6] / 100)], ["BPM", signed(ar[13])], ["OBPM", signed(ar[11])], ["DBPM", signed(ar[12])], ["Win Shares", one(ar[9])], ["WS/48", ws48(ar[10])], ["VORP", signed(ar[14])], ["Games", ar[2]]] : [];
    setSEO(`${p.name} — ${seasonLabel(yr)} Season`, `${p.name}'s ${seasonLabel(yr)} season stats${isRealTeam(team) ? " with the " + tName(team) : ""}: ${one(lr[13])} PPG, ${one(lr[9])} RPG, ${one(lr[10])} APG.${acc.length ? " " + acc.map((a) => a.t).join(", ") + "." : ""}`);
    app.innerHTML = `<div class="wrap page">
      <div class="crumb"><a href="#/">Home</a><span class="sep">/</span><a href="#/player/${p.id}">${esc(p.name)}</a><span class="sep">/</span><span>${seasonLabel(yr)}</span></div>
      <div class="phead"><div class="band" style="background:${col}"></div>
        <div class="inner">${headshot(p.id, p.name, team, "hero")}
          <div class="ph-main">
            <div class="pos">${seasonLabel(yr)}${isRealTeam(team) ? " · " : ""}${isRealTeam(team) ? `<a href="#/team/${team}/${yr}">${esc(tName(team))}</a>` : esc(team)}</div>
            <h1><a href="#/player/${p.id}" style="color:inherit">${esc(p.name)}</a></h1>
            <div class="bio">${bioItem("Games", lr[4])}${age ? bioItem("Age", age) : ""}${bioItem("Minutes", one(lr[5]) + " /g")}</div>
            ${acc.length ? `<div class="chip-row">${acc.map((a) => `<span class="chip ${a.g ? "gold" : ""}">${a.g ? "★ " : ""}${esc(a.t)}</span>`).join("")}</div>` : ""}
          </div></div></div>
      <div class="tilerow">${tiles.map(([k, v, a]) => tile(k, v, a)).join("")}</div>
      ${advTiles.length ? `<div class="section-title" style="margin-top:26px"><h2>Advanced</h2></div>
        <div class="tilerow">${advTiles.map(([k, v]) => tile(k, v)).join("")}</div>` : ""}
      <div id="psGames"></div>
      <div class="actionbar" style="margin-top:22px"><a class="btn" href="#/player/${p.id}"><span class="ic-swap">←</span> Full career</a></div>
    </div>`;
    // game log for this season (only built for the current season)
    if (yr === META.current) {
      getPGames(pid).then((rows) => {
        if (!rows || !rows.length) return;
        const el = $("#psGames");
        el.innerHTML = `<div class="section-title" style="margin-top:26px"><div><h2>${seasonLabel(yr)} game log</h2></div><a class="link" href="#/games">All games →</a></div>
          <div class="card"><div class="tbl-wrap"><table class="ref" style="min-width:560px">
            <thead><tr><th class="l grow">Date</th><th class="l">Opp</th><th class="l">Result</th><th>MIN</th><th>PTS</th><th>REB</th><th>AST</th><th>+/−</th></tr></thead>
            <tbody>${rows.map((r) => `<tr class="clickable" onclick="location.hash='#/game/${r.id}'">
              <td class="l grow season">${fmtDate(r.date)}</td><td class="l"><span class="ha">${r.home ? "" : "@"}</span>${teamTag(r.opp)}</td>
              <td class="l"><span class="pill ${r.w ? "w" : "l"}">${r.w ? "W" : "L"}</span> <span class="muted">${r.us}–${r.them}</span></td>
              <td>${r.min ?? "—"}</td><td class="hi">${r.pts ?? "—"}</td><td>${r.reb ?? "—"}</td><td>${r.ast ?? "—"}</td>
              <td class="${r.pm > 0 ? "pos" : r.pm < 0 ? "neg" : ""}">${r.pm == null ? "—" : r.pm > 0 ? "+" + r.pm : r.pm}</td></tr>`).join("")}</tbody></table></div></div>`;
      });
    }
  }
  const bioItem = (k, v) => `<div class="b"><div class="k">${k}</div><div class="v">${v}</div></div>`;
  // accolade -> the specific seasons it was earned (for hover detail on chips)
  function accDetail(title, accy) {
    if (!accy) return "";
    const t = title.toLowerCase();
    const yrs = (arr) => (arr || []).map((y) => seasonLabel(y)).join(" · ");
    const tl = (arr) => (arr || []).map(([y, tm]) => `${seasonLabel(y)}${tm ? " (" + tm + ")" : ""}`).join(" · ");
    if (t.includes("all-star")) return yrs(accy.allstar);
    if (t.includes("all-nba")) return tl(accy.allnba);
    if (t.includes("all-defense")) return tl(accy.alldef);
    if (t.includes("all-rookie")) return tl(accy.allrookie);
    if (t.includes("finals mvp")) return "";           // not in this dataset
    if (t.includes("mvp")) return yrs(accy.mvp);
    if (t.includes("rookie of the year")) return yrs(accy.roy);
    if (t.includes("defensive player")) return yrs(accy.dpoy);
    if (t.includes("sixth man")) return yrs(accy.smoy);
    if (t.includes("most improved")) return yrs(accy.mip);
    return "";
  }
  // Fallback tooltip text so EVERY accolade chip has a tooltip, even without year data.
  function accDesc(title) {
    const t = title.toLowerCase();
    if (t.includes("finals mvp")) return "Most Valuable Player of the NBA Finals.";
    if (t.includes("mvp")) return "Regular-season Most Valuable Player.";
    if (t.includes("all-star")) return "Selected to the NBA All-Star Game.";
    if (t.includes("all-nba")) return "All-NBA Team — the league's best players by position.";
    if (t.includes("all-defensive") || t.includes("all-defense")) return "All-Defensive Team selection.";
    if (t.includes("all-rookie")) return "All-Rookie Team selection.";
    if (t.includes("rookie of the year")) return "Best first-year player.";
    if (t.includes("defensive player")) return "Defensive Player of the Year.";
    if (t.includes("sixth man")) return "Best player primarily off the bench.";
    if (t.includes("most improved")) return "Most Improved Player of the year.";
    if (t.includes("scoring")) return "Led the NBA in points per game.";
    if (t.includes("champion")) return "NBA champion.";
    if (t.includes("hall of fame") || t.includes("hof")) return "Naismith Memorial Basketball Hall of Fame.";
    return "Career honor.";
  }
  function wireAccHover(scope) {
    $$(".chip.has-detail", scope).forEach((c) => {
      const show = (e) => showTT(`<div class="h">${esc(c.dataset.acc)}</div><div class="acc-years">${esc(c.dataset.years)}</div>`, e.clientX, e.clientY);
      c.addEventListener("pointerenter", show);
      c.addEventListener("pointermove", show);
      c.addEventListener("pointerleave", hideTT);
      c.addEventListener("pointercancel", hideTT);
    });
  }

  /* ---------- shot tendencies (distance-zone half-court, sequential by frequency) ---------- */
  const SHOT_ZONES = [   // data label -> court band radius (px, 10px/ft) + short name; ordered rim->out
    { z: "0-3 ft", ri: 0, ro: 34, name: "At the rim", sub: "0–3 ft", lr: 20 },
    { z: "3-10 ft", ri: 34, ro: 100, name: "In the paint", sub: "3–10 ft", lr: 67 },
    { z: "10-16 ft", ri: 100, ro: 160, name: "Mid-range", sub: "10–16 ft", lr: 130 },
    { z: "16 ft-3P", ri: 160, ro: 236, name: "Long two", sub: "16 ft–3P", lr: 198 },
    { z: "3-pointers", ri: 236, ro: 480, name: "Three-pointers", sub: "beyond arc", lr: 300 },
  ];
  // sequential single-hue ramp keyed to a zone's share of shots (frequency = magnitude)
  const shotFill = (pct, maxPct) => `color-mix(in srgb, var(--accent-deep) ${Math.round(20 + (pct / (maxPct || 1)) * 74)}%, var(--accent-wash))`;
  function drawShotChart(mountId, s) {
    const cx = 250, cy = 452, W = 500, H = 500;   // hoop low + tall viewBox so the rim zone never clips
    const rows = SHOT_ZONES.map((zn) => ({ ...zn, d: (s.ranges || []).find((r) => r.z === zn.z) })).filter((r) => r.d);
    if (!rows.length) { $("#" + mountId).innerHTML = ""; return; }
    const maxPct = Math.max(...rows.map((r) => r.d.pct));
    const band = (ri, ro) => ri <= 0
      ? `M ${cx - ro} ${cy} A ${ro} ${ro} 0 0 1 ${cx + ro} ${cy} Z`
      : `M ${cx - ro} ${cy} A ${ro} ${ro} 0 0 1 ${cx + ro} ${cy} L ${cx + ri} ${cy} A ${ri} ${ri} 0 0 0 ${cx - ri} ${cy} Z`;
    let g = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Shot frequency and field-goal percentage by distance zone" class="shotsvg">
      <defs><clipPath id="ct-${mountId}"><rect x="0" y="0" width="${W}" height="${cy}"/></clipPath></defs>
      <g clip-path="url(#ct-${mountId})">`;
    rows.slice().reverse().forEach((r) => {           // outer first so inner bands paint on top
      g += `<path class="szone" d="${band(r.ri, r.ro)}" fill="${shotFill(r.d.pct, maxPct)}" stroke="var(--panel)" stroke-width="2.5"
        data-name="${esc(r.name)}" data-sub="${esc(r.sub)}" data-pct="${r.d.pct}" data-fg="${r.d.fg == null ? "" : r.d.fg}"/>`;
    });
    g += `</g>`;
    // one recessive court cue only: the 3-point arc + hoop (no busy paint/FT clutter)
    g += `<path d="M ${cx - 236} ${cy} A 236 236 0 0 1 ${cx + 236} ${cy}" fill="none" stroke="var(--ink-4)" stroke-width="1.5" opacity=".5" stroke-dasharray="2 5"/>
      <circle cx="${cx}" cy="${cy}" r="7" fill="none" stroke="var(--panel)" stroke-width="2"/>`;
    // FG% in a high-contrast chip at each zone's centroid (always legible over any fill)
    rows.forEach((r) => {
      const y = cy - r.lr;
      g += `<g pointer-events="none"><rect class="schip" x="${cx - 27}" y="${y - 13}" width="54" height="25" rx="7"/>
        <text class="schip-t" x="${cx}" y="${y + 5}" text-anchor="middle">${r.d.fg == null ? "—" : pctf(r.d.fg)}</text></g>`;
    });
    g += `</svg>`;
    $("#" + mountId).innerHTML = g;
    $$("#" + mountId + " .szone").forEach((z) => {
      const show = (e) => showTT(`<div class="h">${esc(z.dataset.name)}<span style="opacity:.6"> · ${esc(z.dataset.sub)}</span></div>
        <div class="r"><span>Share of shots</span><span>${Math.round(z.dataset.pct * 100)}%</span></div>
        <div class="r"><span>Field-goal %</span><span>${z.dataset.fg ? pctf(+z.dataset.fg) : "—"}</span></div>`, e.clientX, e.clientY);
      z.addEventListener("pointerdown", show); z.addEventListener("pointermove", show);
      z.addEventListener("pointerleave", hideTT); z.addEventListener("pointercancel", hideTT);
    });
  }
  function drawShotProfile(p) {
    const mount = $("#shotProfile"); if (!mount || !p.shot) return;
    const years = Object.keys(p.shot).map(Number).sort((a, b) => b - a);
    const draw = (yr) => {
      const s = p.shot[yr];
      const rows = SHOT_ZONES.map((zn) => ({ ...zn, d: (s.ranges || []).find((r) => r.z === zn.z) })).filter((r) => r.d);
      const maxPct = Math.max(...rows.map((r) => r.d.pct));
      const top = rows.reduce((a, b) => (b.d.pct > a.d.pct ? b : a), rows[0]);
      const extras = [s.avgDist != null ? ["Avg. shot distance", s.avgDist.toFixed(1) + " ft"] : null,
        s.dunk != null ? ["Dunks", Math.round(s.dunk * 100) + "% of FGA"] : null,
        s.corner3 != null ? ["Corner 3s", Math.round(s.corner3 * 100) + "% of 3PA"] : null].filter(Boolean);
      // shot distribution as one 100% stacked bar (part-to-whole), coloured to match the court zones
      const seg = rows.map((r) => `<span class="seg" style="flex-grow:${Math.max(r.d.pct, 0.004)};background:${shotFill(r.d.pct, maxPct)}"
        data-name="${esc(r.name)}" data-sub="${esc(r.sub)}" data-pct="${r.d.pct}" data-fg="${r.d.fg == null ? "" : r.d.fg}"></span>`).join("");
      const key = rows.map((r) => `<div class="kr">
        <span class="sw" style="background:${shotFill(r.d.pct, maxPct)}"></span>
        <span class="knm">${r.name}</span>
        <span class="kmeta"><b>${Math.round(r.d.pct * 100)}%</b><span class="ks">of shots</span><span class="kdot">·</span>${r.d.fg == null ? "—" : pctf(r.d.fg)}<span class="ks">FG</span></span></div>`).join("");
      mount.innerHTML = `<div class="section-title" style="margin-top:26px"><div><span class="eyebrow">Frequency &amp; efficiency by distance</span><h2>Shot tendencies</h2></div>
        <label class="season-select"><span>Season</span><select class="mini-select" id="shotSeasonSel">${years.map((y) => `<option value="${y}" ${y === yr ? "selected" : ""}>${seasonLabel(y)}</option>`).join("")}</select></label></div>
        <div class="card pad shot-card">
          <p class="shot-lead">Took the most shots <b>${top.name.toLowerCase()}</b> — ${Math.round(top.d.pct * 100)}% of attempts. On the court, darker means more frequent and the label is FG% from that range.</p>
          <div class="shot-grid">
            <div class="shot-court-wrap">
              <div class="shot-court" id="shotCourt"></div>
              <div class="shot-legend"><span>Fewer shots</span><i class="ramp"></i><span>More</span></div>
            </div>
            <div class="shot-side">
              <div class="sd-title">Shot distribution</div>
              <div class="sd-stack" role="img" aria-label="Share of shots by distance zone">${seg}</div>
              <div class="sd-key">${key}</div>
              ${extras.length ? `<div class="shot-extras">${extras.map(([k, v]) => `<div class="se"><div class="k">${k}</div><div class="v">${v}</div></div>`).join("")}</div>` : ""}
            </div>
          </div></div>`;
      drawShotChart("shotCourt", s);
      $$(".sd-stack .seg", mount).forEach((z) => {
        const show = (e) => showTT(`<div class="h">${esc(z.dataset.name)}<span style="opacity:.6"> · ${esc(z.dataset.sub)}</span></div>
          <div class="r"><span>Share of shots</span><span>${Math.round(z.dataset.pct * 100)}%</span></div>
          <div class="r"><span>Field-goal %</span><span>${z.dataset.fg ? pctf(+z.dataset.fg) : "—"}</span></div>`, e.clientX, e.clientY);
        z.addEventListener("pointerdown", show); z.addEventListener("pointermove", show);
        z.addEventListener("pointerleave", hideTT); z.addEventListener("pointercancel", hideTT);
      });
      const sel = $("#shotSeasonSel"); if (sel) sel.addEventListener("change", () => draw(+sel.value));
    };
    draw(years[0]);
  }

  function drawTrend(p) {
    const rows = p.log.filter((r) => r[13] != null && r[16] !== 2); // exclude traded-stint rows
    const vals = rows.map((r) => r[13]), seas = rows.map((r) => r[0]), yrs = rows.map((r) => String(r[0]).slice(2));
    if (vals.length < 2) { $("#trend").innerHTML = `<p class="muted" style="font-size:13px">One season on record.</p>`; return; }
    const W = 340, H = 138, m = { t: 20, r: 14, b: 24, l: 14 }, iw = W - m.l - m.r, ih = H - m.t - m.b;
    const peak = Math.max(...vals), mn = Math.min(...vals) - 2, mx = peak + 2;
    const sx = (i) => m.l + (i / (vals.length - 1)) * iw, sy = (v) => m.t + ih - (v - mn) / (mx - mn) * ih;
    const P = vals.map((v, i) => [sx(i), sy(v)]);
    const line = P.map((q, i) => (i ? "L" : "M") + q[0].toFixed(1) + " " + q[1].toFixed(1)).join(" ");
    const area = `M${P[0][0].toFixed(1)} ${m.t + ih} ` + P.map((q) => "L" + q[0].toFixed(1) + " " + q[1].toFixed(1)).join(" ") + ` L${P[P.length - 1][0].toFixed(1)} ${m.t + ih} Z`;
    const showEvery = Math.ceil(vals.length / 8);
    let g = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Scoring trend, hover for detail">
      <line class="cross" id="tCross" x1="0" y1="${m.t}" x2="0" y2="${m.t + ih}" style="opacity:0"/>
      <path class="area" d="${area}"/><path class="ln" d="${line}"/>`;
    P.forEach((pt, i) => {
      const edge = i === 0 || i === vals.length - 1 || vals[i] === peak;
      g += `<circle class="dot" cx="${pt[0].toFixed(1)}" cy="${pt[1].toFixed(1)}" r="${edge ? 4 : 2.5}"/>`;
      if (edge) g += `<text class="val" x="${pt[0].toFixed(1)}" y="${(pt[1] - 9).toFixed(1)}" text-anchor="middle">${vals[i].toFixed(1)}</text>`;
      if (i % showEvery === 0 || i === vals.length - 1) g += `<text class="lbl" x="${pt[0].toFixed(1)}" y="${H - 8}" text-anchor="middle">’${yrs[i]}</text>`;
    });
    // transparent hover targets
    P.forEach((pt, i) => { g += `<circle class="hit" data-i="${i}" cx="${pt[0].toFixed(1)}" cy="${pt[1].toFixed(1)}" r="12" fill="transparent"/>`; });
    $("#trend").innerHTML = g + "</svg>";
    const cross = $("#tCross");
    $$("#trend .hit").forEach((h) => {
      const i = +h.dataset.i, pt = P[i];
      const show = (e) => {
        cross.setAttribute("x1", pt[0]); cross.setAttribute("x2", pt[0]); cross.style.opacity = 1;
        showTT(`<div class="h">${seasonLabel(seas[i])}</div><div class="r"><span>Points</span><span>${vals[i].toFixed(1)} PPG</span></div>`, e.clientX, e.clientY);
      };
      const hide = () => { cross.style.opacity = 0; hideTT(); };
      h.addEventListener("pointerdown", show);   // touch tap / mouse press
      h.addEventListener("pointermove", show);   // mouse hover / touch drag
      h.addEventListener("pointerleave", hide);
      h.addEventListener("pointercancel", hide);
    });
  }

  /* ================= TEAM ================= */
  async function renderTeam(ab, y) {
    let t; try { t = await getTeam(ab); } catch { return notFound("team"); }
    const sal = await getSalaries().catch(() => null);
    const pay = sal && sal.teamPayroll[ab] ? Object.fromEntries(sal.teamPayroll[ab]) : {};
    const hasPay = Object.keys(pay).length > 0;
    const m = tMeta(ab), color = tColor(ab);
    const latest = (y && t.seasons.find((s) => s.season === +y)) || t.seasons[0];   // selected season drives header/contracts
    const conf = m ? m.conf : null;
    const teamSel = `<label class="season-select"><span>Season</span><select class="mini-select" id="tmSeasonSel">${t.seasons.map((s) => `<option value="${s.season}" ${s.season === latest.season ? "selected" : ""}>${seasonLabel(s.season)}</option>`).join("")}</select></label>`;
    // contracts for the selected season (from salary data, filtered to this team)
    const contracts = sal ? (sal.bySeason[latest.season] || []).filter((r) => r[2] === ab) : [];
    const payroll = contracts.reduce((a, r) => a + r[3], 0);
    let seed = null;
    if (latest) { try { const S = await getSeason(latest.season); const cs = splitConf(S.standings); const grp = m && cs[m.conf] ? cs[m.conf] : (cs.League || []); const idx = grp.findIndex((x) => x.abbr === ab); if (idx > -1) seed = idx + 1; } catch {} }
    const net = latest && latest.o != null ? latest.o - latest.d : null;
    const tiles = latest ? [
      latest.o != null ? ["Offense", latest.o.toFixed(1)] : null,
      latest.d != null ? ["Defense", latest.d.toFixed(1)] : null,
      net != null ? ["Net rating", (net >= 0 ? "+" : "") + net.toFixed(1)] : null,
      latest.srs != null ? ["SRS", (latest.srs >= 0 ? "+" : "") + latest.srs.toFixed(1)] : null,
      ["Win %", winpct(latest.w, latest.l)],
    ].filter(Boolean) : [];

    (function () {
      const rec = latest ? `${seasonLabel(latest.season)} record ${latest.w}–${latest.l} (${winpct(latest.w, latest.l)})${net != null ? ", " + (net >= 0 ? "+" : "") + net.toFixed(1) + " net rating" : ""}.` : "";
      const desc = `${t.name} roster, record, standings and stats. ${rec} ${conf ? conf + "ern Conference. " : ""}Franchise since ${seasonLabel(t.seasons[t.seasons.length - 1].season)} — ${t.seasons.length} seasons on record.`;
      const ld = { "@context": "https://schema.org", "@type": "SportsTeam", name: t.name, sport: "Basketball", url: location.href };
      if (conf) ld.memberOf = { "@type": "SportsOrganization", name: conf + "ern Conference" };
      setSEO(`${t.name} — Roster, Record & Stats`, desc, ld);
    })();
    app.innerHTML = `
    <div class="wrap page">
      <div class="crumb"><a href="#/">Home</a><span class="sep">/</span><a href="#/teams">Teams</a><span class="sep">/</span><span>${esc(t.name)}</span></div>
      <div class="thead"><div class="band" style="background:${color}"></div>
        <div class="inner">
          <div class="th-id">${teamLogo(ab, "hero")}
            <div><div class="pos">${conf ? conf + "ern Conference" : (latest ? latest.season >= 1971 ? "" : "" : "")}${seed ? " · " + ord(seed) + " seed" : ""}</div>
              <h1>${esc(t.name)}</h1>
              <div class="meta">${bioItem("Franchise span", `${seasonLabel(t.seasons[t.seasons.length - 1].season)} – ${seasonLabel(latest.season)}`)}
                ${bioItem("Seasons", t.seasons.length)}${conf ? bioItem("Conference", conf) : ""}</div></div></div>
          ${latest ? `<div class="recordbig"><div class="r">${latest.w}–${latest.l}</div><div class="s">${seasonLabel(latest.season)} · ${winpct(latest.w, latest.l)}${net != null ? " · " + (net >= 0 ? "+" : "") + net.toFixed(1) + " net" : ""}</div>${teamSel}</div>` : ""}
        </div>
      </div>
      ${tiles.length ? `<div class="tilerow">${tiles.map(([k, v]) => `<div class="tile"><div class="k">${k}</div><div class="v">${v}</div></div>`).join("")}</div>` : ""}
      <nav class="jumpnav" id="jumpNav">${[(contracts.length ? ["Contracts", "sec-contracts"] : null), ["Roster & history", "sec-tables"], ["News", "teamNews"]].filter(Boolean).map(([lab, t]) => `<a href="#" data-tgt="${t}">${lab}</a>`).join("")}</nav>
      ${contracts.length ? `<div class="section-title" id="sec-contracts" style="margin-top:26px"><div><span class="eyebrow">Nominal · ${contracts.length} on the books · ${money(payroll)} total</span><h2>${seasonLabel(latest.season)} contracts</h2></div><a class="link" href="#/salaries/${latest.season}">Salary hub →</a></div>
        <div class="card" style="margin-bottom:24px"><div class="tbl-wrap"><table class="ref" style="min-width:420px">
          <thead><tr><th class="num">#</th><th class="l grow">Player</th><th>Salary</th><th>% of payroll</th></tr></thead>
          <tbody>${contracts.map((r, i) => `<tr class="${r[0] ? "clickable" : ""}" ${r[0] ? `onclick="location.hash='#/player/${r[0]}'"` : ""}>
            <td class="num">${i + 1}</td>
            <td class="l grow"><span class="who">${headshot(r[0], r[1], ab, "xs")}${r[0] ? `<a href="#/player/${r[0]}">${esc(r[1])}</a>` : `<span class="nm">${esc(r[1])}</span>`}</span></td>
            <td class="hi">${moneyFull(r[3])}</td><td><span class="barpct"><i style="width:${(r[3] / (contracts[0][3] || 1)) * 100}%"></i></span>${(r[3] / payroll * 100).toFixed(1)}%</td></tr>`).join("")}
            <tr class="total"><td></td><td class="l grow">Total payroll</td><td class="hi">${moneyFull(payroll)}</td><td>100%</td></tr></tbody></table></div></div>` : ""}
      <div class="two-col" id="sec-tables">
        <div class="card pad" style="min-width:0">
          <div class="card-h"><h3>${latest ? seasonLabel(latest.season) + " roster leaders" : "Roster"}</h3><span class="hint">per game</span></div>
          ${t.roster && t.roster.length ? `<div class="tbl-wrap"><table class="ref">
            <thead><tr><th class="l">Player</th><th class="l">Pos</th><th>GP</th><th>REB</th><th>AST</th><th>PTS</th></tr></thead>
            <tbody>${t.roster.map((r) => `<tr><td class="l"><span class="who">${headshot(r[0], r[1], ab, "xs")}<a href="#/player/${r[0]}">${esc(r[1])}</a></span></td>
              <td class="l muted">${esc((r[2] || "").split("-")[0])}</td><td>${r[3]}</td><td>${one(r[5])}</td><td>${one(r[6])}</td><td class="hi">${one(r[4])}</td></tr>`).join("")}</tbody>
          </table></div>` : `<p class="muted" style="font-size:14px">No roster on record.</p>`}
        </div>
        <div class="card pad" style="min-width:0">
          <div class="card-h"><h3>Franchise history</h3><span class="hint">by season${hasPay ? " · payroll ’00–20" : ""}</span></div>
          <div class="tbl-wrap"><table class="ref" style="min-width:0">
            <thead><tr><th class="l">Season</th><th>W</th><th>L</th><th>PCT</th><th>ORtg</th><th>DRtg</th>${hasPay ? "<th>Payroll</th>" : ""}<th></th></tr></thead>
            <tbody>${t.seasons.map((s) => `<tr onclick="location.hash='#/season/${s.season}'" style="cursor:pointer">
              <td class="l season">${seasonLabel(s.season)}</td><td>${s.w}</td><td>${s.l}</td><td>${winpct(s.w, s.l)}</td>
              <td>${s.o != null ? s.o.toFixed(1) : "—"}</td><td>${s.d != null ? s.d.toFixed(1) : "—"}</td>
              ${hasPay ? `<td>${pay[s.season] ? money(pay[s.season]) : "—"}</td>` : ""}
              <td class="l">${s.po ? '<span class="pill w">Playoffs</span>' : ""}</td></tr>`).join("")}</tbody></table></div>
        </div>
      </div>
      <div id="teamNews"></div>
    </div>`;
    const ts = $("#tmSeasonSel"); if (ts) ts.addEventListener("change", () => (location.hash = `#/team/${ab}/${ts.value}`));
    wireJumpNav();
    teamNews(ab).then((html) => { const el = $("#teamNews"); if (el && html) el.innerHTML = html; });
  }

  /* ================= SALARIES / CONTRACTS ================= */
  async function renderSalaries(y) {
    let sal; try { sal = await getSalaries(); } catch { return notFound("salary data"); }
    CPI = CPI || await getCPI().catch(() => null);
    const [lo, hi] = sal.range, yr = Math.min(hi, Math.max(lo, +y || hi));
    const sel = `<label class="season-select"><span>Season</span><select id="salSel">${Array.from({ length: hi - lo + 1 }, (_, i) => hi - i).map((v) => `<option value="${v}" ${v === yr ? "selected" : ""}>${seasonLabel(v)}</option>`).join("")}</select></label>`;
    const paid = sal.bySeason[yr] || [];               // [pid, name, abbr, salary]
    const payr = sal.payrollRank[yr] || [];            // [abbr, total]
    const pmax = paid.length ? paid[0][3] : 1, tmax = payr.length ? payr[0][1] : 1;
    const nameCell = (pid, nm, ab) => `${headshot(pid, nm, ab, "xs")}${pid ? `<a class="nm" href="#/player/${pid}">${esc(nm)}</a>` : `<span class="nm">${esc(nm)}</span>`} ${ab ? teamTag(ab) : ""}`;
    app.innerHTML = `<div class="wrap page">
      <div class="crumb"><a href="#/">Home</a><span class="sep">/</span><span>Salaries</span></div>
      <div class="section-title"><div><span class="eyebrow">Nominal salaries · ${seasonLabel(lo)} to ${seasonLabel(hi)}</span><h2>Contracts &amp; salaries</h2></div>${sel}</div>
      <div class="col2grid">
        <div class="card pad"><div class="card-h"><h3>Highest-paid · ${seasonLabel(yr)}</h3><span class="hint">cap hit</span></div>
          <ol class="rank">${paid.slice(0, 12).map((r, i) => `<li class="${i === 0 ? "top" : ""}"><span class="rk">${i + 1}</span>
            <span class="who">${nameCell(r[0], r[1], r[2])}</span>
            <span class="val"><span class="mini"><i style="width:${(r[3] / pmax) * 100}%"></i></span>${money(r[3])}</span></li>`).join("")}</ol></div>
        <div class="card pad"><div class="card-h"><h3>Team payroll · ${seasonLabel(yr)}</h3><span class="hint">total</span></div>
          <ol class="rank">${payr.map((r, i) => `<li class="${i === 0 ? "top" : ""}"><span class="rk">${i + 1}</span>
            <span class="who">${teamLogo(r[0], "xs")}<a class="nm" href="#/team/${r[0]}">${esc(tName(r[0]))}</a></span>
            <span class="val"><span class="mini"><i style="width:${(r[1] / tmax) * 100}%"></i></span>${money(r[1])}</span></li>`).join("")}</ol></div>
      </div>
      <div class="section-title" style="margin-top:26px"><div><span class="eyebrow" id="allSalCount"></span><h2>All salaries · ${seasonLabel(yr)}</h2></div>
        <label class="season-select"><span>Team</span><select class="mini-select" id="salTeamSel"><option value="">All teams</option>${
          [...new Set(paid.map((r) => r[2]).filter(Boolean))].sort((a, b) => tName(a).localeCompare(tName(b))).map((ab) => `<option value="${ab}">${esc(tName(ab))}</option>`).join("")}</select></label></div>
      <div class="card" id="allSalCard"></div>
      <div class="section-title" style="margin-top:26px"><div><span class="eyebrow" id="allTimeEyebrow"></span><h2>Highest single-season salaries, all-time</h2></div>
        ${CPI ? `<div class="tabs" id="inflToggle"><button data-adj="0" aria-selected="true">Nominal</button><button data-adj="1" aria-selected="false">${seasonLabel(CPI.base)} dollars</button></div>` : ""}</div>
      <div class="card" id="allTimeCard"></div>
      <p class="news-foot" style="margin-top:14px" id="allTimeFoot"></p>
    </div>`;
    const s = $("#salSel"); if (s) s.addEventListener("change", () => (location.hash = `#/salaries/${s.value}`));
    // full salary list for the season, filterable by team
    const drawAllSal = (team) => {
      const list = team ? paid.filter((r) => r[2] === team) : paid;
      $("#allSalCount").textContent = `${list.length} player${list.length === 1 ? "" : "s"}${team ? " · " + tName(team) : ""} · ${seasonLabel(yr)}`;
      $("#allSalCard").innerHTML = `<div class="tbl-wrap"><table class="ref" style="min-width:460px">
        <thead><tr><th class="num">#</th><th class="l grow">Player</th><th class="l">Team</th><th>Salary</th></tr></thead>
        <tbody>${list.map((r, i) => `<tr class="${r[0] ? "clickable" : ""}" ${r[0] ? `onclick="location.hash='#/player/${r[0]}'"` : ""}>
          <td class="num">${i + 1}</td>
          <td class="l grow"><span class="who">${headshot(r[0], r[1], r[2], "xs")}${r[0] ? `<a href="#/player/${r[0]}">${esc(r[1])}</a>` : `<span class="nm">${esc(r[1])}</span>`}</span></td>
          <td class="l">${r[2] ? teamTag(r[2], true) : "—"}</td><td class="hi">${moneyFull(r[3])}</td></tr>`).join("")}</tbody></table></div>`;
    };
    drawAllSal("");
    const tsel = $("#salTeamSel"); if (tsel) tsel.addEventListener("change", () => drawAllSal(tsel.value));
    const drawAllTime = (adj) => {
      const list = adj ? sal.topAllTimeReal : sal.topAllTime;
      $("#allTimeEyebrow").textContent = adj ? `Restated in ${CPI.base}-season dollars` : "Nominal · not inflation-adjusted";
      $("#allTimeCard").innerHTML = `<div class="tbl-wrap"><table class="ref" style="min-width:520px">
        <thead><tr><th class="num">#</th><th class="l grow">Player</th><th class="l">Season</th><th class="l">Team</th><th>${adj ? "Adj. salary" : "Salary"}</th></tr></thead>
        <tbody>${list.slice(0, 30).map((r, i) => `<tr class="${r[0] ? "clickable" : ""}" ${r[0] ? `onclick="location.hash='#/player/${r[0]}'"` : ""}>
          <td class="num">${i + 1}</td>
          <td class="l grow"><span class="who">${headshot(r[0], r[1], r[2], "xs")}${r[0] ? `<a href="#/player/${r[0]}">${esc(r[1])}</a>` : `<span class="nm">${esc(r[1])}</span>`}</span></td>
          <td class="l season">${seasonLabel(r[3])}</td><td class="l">${r[2] ? teamTag(r[2], true) : "—"}</td>
          <td class="hi">${moneyFull(r[4])}</td></tr>`).join("")}</tbody></table></div>`;
      $("#allTimeFoot").innerHTML = adj
        ? `Restated in ${seasonLabel(CPI.base)} dollars via US CPI-U (recent-season CPI estimated). This surfaces past megadeals — e.g. the 2020-21 supermaxes — that nominal figures bury.`
        : `Salary data covers ${seasonLabel(lo)}–${hi} in nominal dollars. Because figures aren't inflation-adjusted, recent seasons dominate — toggle <b>${CPI ? CPI.base + " dollars" : "adjusted"}</b> to compare fairly across eras.`;
    };
    drawAllTime(0);
    const tg = $("#inflToggle");
    if (tg) $$("button", tg).forEach((btn) => btn.addEventListener("click", () => {
      $$("button", tg).forEach((x) => x.setAttribute("aria-selected", "false")); btn.setAttribute("aria-selected", "true");
      drawAllTime(btn.dataset.adj === "1");
    }));
  }

  /* ================= LEADERS ================= */
  const leadModeTabs = (mode, yr) => `<div class="tabs seg-lg" id="leadMode">
    <button ${mode === "season" ? 'aria-selected="true"' : ""} onclick="location.hash='#/leaders/${yr || META.current}'">Single season</button>
    <button ${mode === "all" ? 'aria-selected="true"' : ""} onclick="location.hash='#/leaders/all'">All-time</button></div>`;

  async function renderLeaders(y) {
    if (y === "all") return renderAlltime();
    const yr = +y || META.current, S = await getSeason(yr);
    app.innerHTML = `<div class="wrap page">
      <div class="crumb"><a href="#/">Home</a><span class="sep">/</span><span>League leaders</span></div>
      <div class="section-title"><div><span class="eyebrow">Per game · qualified players</span><h2>${seasonLabel(yr)} league leaders</h2></div>
        <div class="lead-controls">${leadModeTabs("season", yr)}${seasonSelect(yr, "leaders")}</div></div>
      <div class="cardgrid">${LEAD_CATS.map((c) => leaderCard(S, c[0])).join("")}</div>
    </div>`;
    wireSeasonSelect();
  }

  async function renderAlltime() {
    const A = await getAlltime();
    const CAREER = [["pts", "Points", intc], ["trb", "Rebounds", intc], ["ast", "Assists", intc], ["stl", "Steals", intc], ["blk", "Blocks", intc], ["x3p", "Three-pointers", intc], ["g", "Games played", intc], ["tov", "Turnovers", intc]];
    const SEASONREC = [["pts", "Points per game", one], ["trb", "Rebounds per game", one], ["ast", "Assists per game", one], ["stl", "Steals per game", one], ["blk", "Blocks per game", one]];
    const careerCard = ([k, label, fmt]) => `<div class="card pad"><div class="card-h"><h3>${label}</h3><span class="hint">career</span></div>
      <ol class="rank">${A.career[k].slice(0, 12).map((r, i) => `<li class="${i === 0 ? "top" : ""}">
        <span class="rk">${i + 1}</span><span class="who">${headshot(r[0], r[1], r[2], "xs")}<a class="nm" href="#/player/${r[0]}">${esc(r[1])}</a>
        <span class="yr-span">${String(r[4]).slice(2)}–${String(r[5]).slice(2)}</span></span><span class="val">${fmt(r[3])}</span></li>`).join("")}</ol></div>`;
    const seasonCard = ([k, label, fmt]) => `<div class="card pad"><div class="card-h"><h3>${label}</h3><span class="hint">single season</span></div>
      <ol class="rank">${A.season[k].slice(0, 12).map((r, i) => `<li class="${i === 0 ? "top" : ""}">
        <span class="rk">${i + 1}</span><span class="who">${headshot(r[0], r[1], r[2], "xs")}<a class="nm" href="#/player/${r[0]}">${esc(r[1])}</a>
        <span class="yr-span">${seasonLabel(r[3])}</span></span><span class="val">${fmt(r[4])}</span></li>`).join("")}</ol></div>`;
    app.innerHTML = `<div class="wrap page">
      <div class="crumb"><a href="#/">Home</a><span class="sep">/</span><span>All-time leaders</span></div>
      <div class="section-title"><div><span class="eyebrow">Every player, 1947–${seasonLabel(META.current).slice(0, 4) * 1 + 1}</span><h2>All-time leaders</h2></div>
        <div class="lead-controls">${leadModeTabs("all")}</div></div>
      <h3 class="conf-h">Career totals</h3>
      <div class="cardgrid">${CAREER.map(careerCard).join("")}</div>
      <h3 class="conf-h" style="margin-top:30px">Single-season records</h3>
      <div class="cardgrid">${SEASONREC.map(seasonCard).join("")}</div>
    </div>`;
  }

  /* ================= STANDINGS ================= */
  async function renderStandings(y) {
    const yr = +y || META.current, S = await getSeason(yr);
    const conf = splitConf(S.standings), keys = Object.keys(conf);
    const block = (title, rows) => {
      const lead = rows[0];
      return `<div class="card pad" style="min-width:0"><div class="card-h"><h3>${title}</h3><span class="hint">${seasonLabel(yr)}</span></div>
        <div class="tbl-wrap"><table class="ref" style="min-width:560px">
          <thead><tr><th></th><th class="l">Team</th><th>W</th><th>L</th><th>PCT</th><th>GB</th><th>ORtg</th><th>DRtg</th><th>NET</th></tr></thead>
          <tbody>${rows.map((t, i) => {
            const gb = ((lead.w - t.w) + (t.l - lead.l)) / 2, net = t.o != null ? t.o - t.d : null;
            return `<tr onclick="location.hash='#/team/${t.abbr}'" style="cursor:pointer">
              <td class="muted">${i + 1}${i === 5 && keys.length > 1 ? '<span style="color:var(--line-strong)"> ┈</span>' : ""}</td>
              <td class="l"><span class="tm-tag">${teamLogo(t.abbr, "xs")}${esc(tName(t.abbr))}</span>${t.po ? "" : ""}</td>
              <td>${t.w}</td><td>${t.l}</td><td>${winpct(t.w, t.l)}</td><td>${gb === 0 ? "—" : gb.toFixed(1)}</td>
              <td>${t.o != null ? t.o.toFixed(1) : "—"}</td><td>${t.d != null ? t.d.toFixed(1) : "—"}</td>
              <td class="${net != null && net >= 0 ? "hi" : ""}">${net != null ? (net >= 0 ? "+" : "") + net.toFixed(1) : "—"}</td></tr>`;
          }).join("")}</tbody></table></div>
        ${keys.length > 1 ? `<p class="muted mono" style="font-size:11.5px;margin:12px 2px 0">Top 6 clinch a playoff berth · seeds 7–10 enter the play-in.</p>` : ""}</div>`;
    };
    app.innerHTML = `<div class="wrap page">
      <div class="crumb"><a href="#/">Home</a><span class="sep">/</span><span>Standings</span></div>
      <div class="section-title"><div><span class="eyebrow">${S.lg} · final</span><h2>${seasonLabel(yr)} standings</h2></div>${seasonSelect(yr, "standings")}</div>
      <div class="col2grid">${keys.map((k) => block(k === "League" ? "League" : k + "ern Conference", conf[k])).join("")}</div>
    </div>`;
    wireSeasonSelect();
  }

  /* ================= SEASON OVERVIEW ================= */
  async function renderSeason(y) {
    const yr = +y; let S; try { S = await getSeason(yr); } catch { return notFound("season"); }
    const hist = (META.history || []).find((h) => h.season === yr) || {};
    const champAb = (S.champion && S.champion.team) || hist.champ, st = S.standings, top = st[0];
    const champNm = (S.champion && S.champion.team) ? tName(S.champion.team) : (hist.champ_name || (hist.champ && tName(hist.champ)) || "");
    const champFmvp = (S.champion && S.champion.fmvp) || hist.fmvp, champFmvpId = (S.champion && S.champion.fmvp_id) || hist.fmvp_id;
    app.innerHTML = `<div class="wrap page">
      <div class="crumb"><a href="#/">Home</a><span class="sep">/</span><a href="#/seasons">Seasons</a><span class="sep">/</span><span>${seasonLabel(yr)}</span></div>
      <div class="section-title"><div><span class="eyebrow">${S.lg} Season</span><h2>${seasonLabel(yr)} season</h2></div>${seasonSelect(yr, "season")}</div>
      <div class="season-top">
        ${(champAb || champNm) ? `<div class="card big season-champ" style="--tc:${champAb ? tColor(champAb) : "var(--accent)"}">
          <span class="eyebrow">Champions</span>
          <div class="sc-team">${champAb ? teamLogo(champAb, "hero") : ""}<div><h3>${champAb ? `<a href="#/team/${champAb}">${esc(champNm)}</a>` : esc(champNm)}</h3>
            ${champFmvp ? `<div class="sub">Finals MVP · <a href="#/player/${champFmvpId}">${esc(champFmvp)}</a></div>` : ""}</div></div></div>` : ""}
        ${S.mvp ? `<div class="card big pad season-mvp"><span class="eyebrow">Most Valuable Player</span>
          <a class="sm-link" href="#/player/${S.mvp.id}">${headshot(S.mvp.id, S.mvp.name, champAb || (top && top.abbr), "lg")}<div><div class="n">${esc(S.mvp.name)}</div></div></a></div>` : ""}
        ${top ? `<div class="card big pad season-best"><span class="eyebrow">Best record</span>
          <div class="sb"><div class="rr">${top.w}–${top.l}</div><div>${teamTag(top.abbr, true)}<div class="muted" style="font-size:12px;margin-top:2px">${winpct(top.w, top.l)}</div></div></div></div>` : ""}
      </div>
      <div class="section-title" style="margin-top:26px"><h2>Leaders</h2><a class="link" href="#/leaders/${yr}">All categories →</a></div>
      <div class="cardgrid">${["pts", "trb", "ast", "per"].map((c) => leaderCard(S, c)).join("")}</div>
      ${honorsBlock(S.honors)}
      <div class="section-title" style="margin-top:26px"><h2>Standings</h2><a class="link" href="#/standings/${yr}">Full table →</a></div>
      <div class="card big pad scatter-card"><div class="chart-hint"><span class="dotpulse"></span>Hover a team · click to open</div><figure id="scatterSeason" style="margin:0"></figure></div>
      ${META.draftYears.includes(yr - 1) ? `<div class="section-title" style="margin-top:26px"><h2>Draft class</h2><a class="link" href="#/draft/${yr - 1}">${yr - 1} draft →</a></div>
        <p class="muted" style="font-size:14px">See who entered the league in the <a href="#/draft/${yr - 1}" style="color:var(--accent-deep)">${yr - 1} NBA Draft</a>.</p>` : ""}
    </div>`;
    drawScatter("scatterSeason", st);
    wireSeasonSelect();
  }

  function playerChip(id, name, team) {
    return `<a href="#/player/${id}" class="p-chip">${headshot(id, name, team, "xs")}${esc(name)}</a>`;
  }
  function honorsBlock(h) {
    if (!h) return "";
    const nba = h.allNBA || {}, hasTeams = nba["1st"];
    const teamRow = (label, ids) => ids ? `<div class="honor-row"><span class="honor-lbl">${label}</span><div class="chip-row">${ids.map((x) => playerChip(x[0], x[1], (SMAP[x[0]] || [])[5])).join("")}</div></div>` : "";
    const votingHtml = (h.mvpVote && h.mvpVote.length) ? `<div class="card pad"><div class="card-h"><h3>MVP voting</h3><span class="hint">top ${h.mvpVote.length}</span></div>
      <ol class="rank">${h.mvpVote.map((v, i) => `<li class="${i === 0 ? "top" : ""}"><span class="rk">${i + 1}</span>
        <span class="who">${headshot(v[0], v[1], (SMAP[v[0]] || [])[5], "xs")}<a class="nm" href="#/player/${v[0]}">${esc(v[1])}</a></span>
        <span class="val">${v[2] != null ? (v[2] * 100).toFixed(0) + "%" : ""}</span></li>`).join("")}</ol></div>` : "";
    const teamsHtml = hasTeams ? `<div class="card pad"><div class="card-h"><h3>All-NBA teams</h3></div>
      ${["1st", "2nd", "3rd"].map((t) => teamRow(t + " Team", nba[t])).join("")}
      ${h.allDef && h.allDef["1st"] ? `<div class="card-h" style="margin:16px 0 4px"><h3 style="font-size:15px">All-Defense</h3></div>${["1st", "2nd"].map((t) => teamRow(t, h.allDef[t])).join("")}` : ""}</div>` : "";
    const starHtml = (h.allStar && h.allStar.length) ? `<div class="card pad" style="grid-column:1/-1"><div class="card-h"><h3>All-Stars</h3><span class="hint">${h.allStar.length} selected</span></div>
      <div class="chip-row">${h.allStar.map((x) => playerChip(x[0], x[1], (SMAP[x[0]] || [])[5])).join("")}</div></div>` : "";
    if (!teamsHtml && !votingHtml && !starHtml) return "";
    return `<div class="section-title" style="margin-top:26px"><h2>Honors</h2></div>
      <div class="honors-grid">${teamsHtml}${votingHtml}${starHtml}</div>`;
  }

  /* ================= SEASONS INDEX ================= */
  function renderSeasons() {
    app.innerHTML = `<div class="wrap page">
      <div class="crumb"><a href="#/">Home</a><span class="sep">/</span><span>Seasons</span></div>
      <div class="section-title"><div><span class="eyebrow">${META.history.length} seasons · 1947–${META.current}</span><h2>Every NBA season</h2></div></div>
      <div class="card"><div class="tbl-wrap"><table class="ref" style="min-width:920px">
        <thead><tr><th class="l">Season</th><th class="l">Champion</th><th class="l">Finals MVP</th><th class="l">MVP</th><th class="l">Rookie of Year</th><th class="l">Defensive POY</th><th class="l">Scoring</th></tr></thead>
        <tbody>${META.history.map((h) => { const pl = (id, nm) => (nm ? `<a href="#/player/${id}">${esc(nm)}</a>` : "—"); return `<tr onclick="location.hash='#/season/${h.season}'" style="cursor:pointer">
          <td class="l season">${seasonLabel(h.season)}</td>
          <td class="l">${(h.champ || h.champ_name) ? `<span class="tm-tag">${h.champ ? teamLogo(h.champ, "xs") : ""}${esc(h.champ_name || tName(h.champ))}</span>` : "—"}</td>
          <td class="l">${pl(h.fmvp_id, h.fmvp)}</td>
          <td class="l">${pl(h.mvp_id, h.mvp)}</td>
          <td class="l">${pl(h.roy_id, h.roy)}</td>
          <td class="l">${pl(h.dpoy_id, h.dpoy)}</td>
          <td class="l muted">${h.pts_leader ? esc(h.pts_leader) : "—"}</td></tr>`; }).join("")}</tbody>
      </table></div></div>
    </div>`;
  }

  /* ================= TEAMS INDEX ================= */
  async function renderTeamsIndex() {
    const S = await getSeason(META.current), byAb = Object.fromEntries(S.standings.map((t) => [t.abbr, t]));
    const cards = (conf) => Object.keys(META.teams).filter((ab) => META.teams[ab].conf === conf)
      .sort((a, b) => (byAb[b] ? byAb[b].w : 0) - (byAb[a] ? byAb[a].w : 0))
      .map((ab) => { const t = byAb[ab]; return `<a href="#/team/${ab}" class="tcard"><span class="accentbar" style="background:${tColor(ab)}"></span>
        ${teamLogo(ab, "lg")}<div class="tc-body"><div class="nm">${esc(tName(ab))}</div>
        <div class="rec">${t ? `${t.w}–${t.l} · ${winpct(t.w, t.l)}` : "—"}</div></div></a>`; }).join("");
    app.innerHTML = `<div class="wrap page">
      <div class="crumb"><a href="#/">Home</a><span class="sep">/</span><span>Teams</span></div>
      <div class="section-title"><div><span class="eyebrow">${seasonLabel(META.current)} · 30 teams</span><h2>Teams</h2></div><a class="link" href="#/standings">Standings →</a></div>
      <h3 class="conf-h">Eastern Conference</h3><div class="tcards">${cards("East")}</div>
      <h3 class="conf-h">Western Conference</h3><div class="tcards">${cards("West")}</div>
      <div class="section-title" style="margin-top:26px"><h2>Offense against defense</h2></div>
      <div class="card big pad scatter-card"><div class="chart-hint"><span class="dotpulse"></span>Hover a team · click to open</div><figure id="scatterTeams" style="margin:0"></figure></div>
    </div>`;
    drawScatter("scatterTeams", S.standings);
  }

  /* ================= PLAYERS INDEX ================= */
  async function renderPlayersIndex() {
    const S = await getSeason(META.current);
    const ids = (S.leaders.pts || []).slice(0, 3).map((r) => r[0]);
    app.innerHTML = `<div class="wrap page">
      <div class="crumb"><a href="#/">Home</a><span class="sep">/</span><span>Players</span></div>
      <div class="section-title"><div><span class="eyebrow">${SEARCH.length.toLocaleString()} players · 1947–${META.current}</span><h2>Players</h2></div></div>
      <div class="mast-search" style="max-width:520px;margin-bottom:26px">
        <svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
        <input id="pgSearch" type="text" placeholder="Search all ${SEARCH.length.toLocaleString()} players…" autocomplete="off" spellcheck="false" />
        <div class="results" id="pgResults"></div>
      </div>
      <div class="section-title"><h2>${seasonLabel(META.current)} scoring leaders</h2></div>
      <div class="pcards" id="pgCards"></div>`;
    $("#pgCards").innerHTML = await playerCards((S.leaders.pts || []).slice(0, 12).map((r) => r[0]));
    wireSearch($("#pgSearch"), $("#pgResults"));
  }

  /* ================= AWARDS ================= */
  async function renderAwards(key) {
    const AW = await getAwards();
    const TABS = [["mvp", "MVP"], ["fmvp", "Finals MVP"], ["dpoy", "Defensive POY"], ["roy", "Rookie of the Year"], ["smoy", "Sixth Man"], ["mip", "Most Improved"], ["clutch", "Clutch POY"]];
    const k = AW[key] ? key : "mvp";
    const table = (rows) => `<thead><tr><th class="l">Season</th><th class="l">Player</th><th class="l">Team</th></tr></thead>
      <tbody>${rows.map((r) => `<tr onclick="location.hash='#/player/${r[1]}'" style="cursor:pointer">
        <td class="l season">${seasonLabel(r[0])}</td>
        <td class="l"><span class="who">${headshot(r[1], r[2], r[3], "xs")}<a href="#/player/${r[1]}">${esc(r[2])}</a></span></td>
        <td class="l">${r[3] ? teamTag(r[3], true) : "—"}</td></tr>`).join("")}</tbody>`;
    app.innerHTML = `<div class="wrap page">
      <div class="crumb"><a href="#/">Home</a><span class="sep">/</span><span>Awards</span></div>
      <div class="section-title"><div><span class="eyebrow">Every winner · 1947–${META.current}</span><h2>Awards &amp; honors</h2></div></div>
      <div class="tabs seg-lg awtabs" id="awTabs">${TABS.map(([t, l]) => `<button data-k="${t}" aria-selected="${t === k}">${l}</button>`).join("")}</div>
      <div class="card" style="margin-top:18px"><div class="tbl-wrap"><table class="ref" style="min-width:0" id="awTable">${table(AW[k])}</table></div></div>
    </div>`;
    $$("#awTabs button").forEach((b) => b.addEventListener("click", () => {
      $$("#awTabs button").forEach((x) => x.setAttribute("aria-selected", "false"));
      b.setAttribute("aria-selected", "true"); $("#awTable").innerHTML = table(AW[b.dataset.k]);
    }));
  }

  /* ================= DRAFT ================= */
  async function renderDraft(y) {
    const yr = +y || META.draftYears[0];
    let D; try { D = await getDraft(yr); } catch { return notFound("draft"); }
    const hasCollege = D.picks.some((p) => p[5]);   // future/projected drafts have no college yet — hide the empty column
    app.innerHTML = `<div class="wrap page">
      <div class="crumb"><a href="#/">Home</a><span class="sep">/</span><span>Draft</span></div>
      <div class="section-title"><div><span class="eyebrow">Every pick on record</span><h2>${yr} NBA Draft</h2></div>
        <label class="season-select"><span>Draft</span><select id="draftSel">${META.draftYears.map((v) => `<option value="${v}" ${v === yr ? "selected" : ""}>${v}</option>`).join("")}</select></label></div>
      <div class="card"><div class="tbl-wrap"><table class="ref" style="min-width:${hasCollege ? 560 : 0}px">
        <thead><tr><th class="num">Pick</th><th class="num">Rd</th><th class="l">Team</th><th class="l${hasCollege ? "" : " grow"}">Player</th>${hasCollege ? `<th class="l grow">College / From</th>` : ""}</tr></thead>
        <tbody>${D.picks.map((p) => `<tr class="${p[3] ? "clickable" : ""}" ${p[3] ? `onclick="location.hash='#/player/${p[3]}'"` : ""}>
          <td class="num">${p[0] ?? "—"}</td><td class="num">${p[1] ?? "—"}</td>
          <td class="l">${p[2] ? teamTag(p[2], true) : "—"}</td>
          <td class="l${hasCollege ? "" : " grow"}">${p[3] ? `<span class="who">${headshot(p[3], p[4], p[2], "xs")}<a href="#/player/${p[3]}">${esc(p[4])}</a></span>` : `<span class="muted">${esc(p[4])}</span>`}</td>
          ${hasCollege ? `<td class="l muted grow">${p[5] ? esc(p[5]) : "—"}</td>` : ""}</tr>`).join("")}</tbody>
      </table></div></div></div>`;
    $("#draftSel").addEventListener("change", (e) => (location.hash = `#/draft/${e.target.value}`));
  }

  /* ================= COMPARE ================= */
  // stats for a player on a given basis: "career" or a season year (as string/number)
  function statsFor(p, basis) {
    if (basis === "career" || basis == null) {
      const cr = p.career || {}, ct = p.ctot || {};
      const ts = ct.pts && (ct.fga || ct.fta) ? ct.pts / (2 * ((ct.fga || 0) + 0.44 * (ct.fta || 0))) : null;
      const advR = (p.adv || []).filter((r) => r[15] !== 2);   // exclude traded-stint dup rows
      let mp = 0, perW = 0, bpmW = 0;
      advR.forEach((r) => { const m = r[3] || 0; mp += m; perW += (r[4] || 0) * m; bpmW += (r[13] || 0) * m; });
      return { basis: "career", label: "Career",
        ppg: cr.pts, rpg: cr.trb, apg: cr.ast, spg: cr.stl, bpg: cr.blk, fg: cr.fg, tp: cr.tp, ft: cr.ft,
        per: mp ? perW / mp : null, ts, bpm: mp ? bpmW / mp : null, ws: ct.ws, vorp: ct.vorp, g: ct.g };
    }
    const y = +basis;
    const lr = (p.log || []).find((r) => r[0] === y && r[16] !== 2);
    const ar = (p.adv || []).find((r) => r[0] === y && r[15] !== 2);
    return { basis: y, label: seasonLabel(y),
      ppg: lr && lr[13], rpg: lr && lr[9], apg: lr && lr[10], spg: lr && lr[11], bpg: lr && lr[12],
      fg: lr && lr[6], tp: lr && lr[7], ft: lr && lr[8], per: lr && lr[14], ts: lr && lr[15],
      bpm: ar && ar[13], ws: ar && ar[9], vorp: ar && ar[14], g: lr && lr[4] };
  }
  const CMP_ROWS = [
    ["PPG", "ppg", one], ["RPG", "rpg", one], ["APG", "apg", one], ["SPG", "spg", one], ["BPG", "bpg", one],
    ["FG%", "fg", pctf], ["3P%", "tp", pctf], ["FT%", "ft", pctf],
    ["PER", "per", one], ["TS%", "ts", pctf], ["BPM · box +/−", "bpm", signed], ["Win shares", "ws", one], ["VORP", "vorp", signed], ["Games", "g", intc],
  ];
  const cmpBasis = { A: "career", B: "career" };   // per-slot basis state
  function basisSelect(p, which) {
    const yrs = [...new Set(p.log.map((r) => r[0]))].sort((x, y) => y - x);
    return `<select class="cmp-basis mini-select" data-slot="${which}">
      <option value="career" ${cmpBasis[which] === "career" ? "selected" : ""}>Career averages</option>
      ${yrs.map((y) => `<option value="${y}" ${String(cmpBasis[which]) === String(y) ? "selected" : ""}>${seasonLabel(y)} season</option>`).join("")}</select>`;
  }
  async function renderCompare(a, b) {
    const load = (id) => (id ? getPlayer(id).catch(() => null) : Promise.resolve(null));
    const [pa, pb] = await Promise.all([load(a), load(b)]);
    if (!pa) cmpBasis.A = "career"; if (!pb) cmpBasis.B = "career";
    const slot = (p, which) => {
      const other = which === "A" ? (b || "") : (a || "");
      if (p) return `<div class="cmp-head" style="--tc:${tColor(p.cur.team)}">
        ${headshot(p.id, p.name, p.cur.team, "hero")}
        <div class="cmp-id"><a class="nm" href="#/player/${p.id}">${esc(p.name)}</a>
          <div class="sub">${esc(p.cur.pos || "")} · ${p.log.length} season${p.log.length > 1 ? "s" : ""}</div>
          ${basisSelect(p, which)}</div>
        <div class="cmp-search"><input class="cmpSearch" data-slot="${which}" data-other="${other}" placeholder="Change…" autocomplete="off" spellcheck="false"><div class="results"></div></div></div>`;
      return `<div class="cmp-head empty">
        <div class="cmp-search big"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
        <input class="cmpSearch" data-slot="${which}" data-other="${other}" placeholder="Search player ${which}…" autocomplete="off" spellcheck="false"><div class="results"></div></div></div>`;
    };
    app.innerHTML = `<div class="wrap page">
      <div class="crumb"><a href="#/">Home</a><span class="sep">/</span><span>Compare</span></div>
      <div class="section-title"><div><span class="eyebrow">Head to head</span><h2>Compare players</h2></div></div>
      <div class="compare-grid">${slot(pa, "A")}${slot(pb, "B")}</div>
      <div id="cmpBody">${pa && pb ? compareTable(pa, pb) : `<p class="muted" style="margin-top:22px;font-size:15px">Pick two players, then set each to career averages or any single season.</p>`}</div>
    </div>`;
    wireCompareSearch();
    $$(".cmp-basis").forEach((sel) => sel.addEventListener("change", () => {
      cmpBasis[sel.dataset.slot] = sel.value;
      if (pa && pb) $("#cmpBody").innerHTML = compareTable(pa, pb);
    }));
  }
  function compareTable(pa, pb) {
    const sa = statsFor(pa, cmpBasis.A), sb = statsFor(pb, cmpBasis.B);
    const rowH = ([label, key, fmt]) => {
      const av = sa[key], bv = sb[key], a = av == null ? null : +av, b = bv == null ? null : +bv;
      const aw = a != null && b != null && a > b, bw = a != null && b != null && b > a;
      return `<tr><td class="cmp-v ${aw ? "win" : ""}">${av == null ? "—" : fmt(av)}</td><td class="cmp-m">${label}</td><td class="cmp-v ${bw ? "win" : ""}">${bv == null ? "—" : fmt(bv)}</td></tr>`;
    };
    return `<div class="card" style="margin-top:20px">
      <div class="cmp-basis-row"><span>${esc(sa.label)}</span><span class="mid">basis</span><span>${esc(sb.label)}</span></div>
      <table class="cmp-table">${CMP_ROWS.map(rowH).join("")}
        <tr><td class="cmp-v ${pa.acc.filter((x) => x.g).length > pb.acc.filter((x) => x.g).length ? "win" : ""}">${pa.acc.filter((x) => x.g).length}</td><td class="cmp-m">Major awards <span class="tiny">(career)</span></td><td class="cmp-v ${pb.acc.filter((x) => x.g).length > pa.acc.filter((x) => x.g).length ? "win" : ""}">${pb.acc.filter((x) => x.g).length}</td></tr>
      </table></div>`;
  }
  function wireCompareSearch() {
    $$(".cmpSearch").forEach((input) => {
      const box = input.parentElement.querySelector(".results");
      const go = (id) => {
        const slot = input.dataset.slot, other = input.dataset.other;
        const A = slot === "A" ? id : other, B = slot === "B" ? id : other;
        location.hash = `#/compare/${A || "_"}/${B || "_"}`.replace(/\/_$/, "");
      };
      input.addEventListener("input", () => {
        const q = input.value.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
        if (!q) { box.classList.remove("on"); return; }
        const hits = SEARCH.filter((e) => e[1].toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").includes(q)).sort((x, y) => y[3] - x[3]).slice(0, 6);
        box.innerHTML = hits.map((e) => `<a data-id="${e[0]}">${headshot(e[0], e[1], e[5], "xs")}<span class="nm">${esc(e[1])}</span><span class="sub">${seasonLabel(e[2])}–${String(e[3]).slice(2)}</span></a>`).join("") || `<div class="empty">No match.</div>`;
        box.classList.add("on");
        $$("a", box).forEach((a) => a.addEventListener("click", () => go(a.dataset.id)));
      });
      input.addEventListener("focus", () => { if (input.value) input.dispatchEvent(new Event("input")); });
      document.addEventListener("click", (e) => { if (!input.parentElement.contains(e.target)) box.classList.remove("on"); });
    });
  }

  /* ---------- season selector ---------- */
  function seasonSelect(cur, base) {
    return `<label class="season-select"><span>Season</span><select data-season-base="${base}">
      ${META.seasons.map((y) => `<option value="${y}" ${y === +cur ? "selected" : ""}>${seasonLabel(y)}</option>`).join("")}</select></label>`;
  }
  function wireSeasonSelect() {
    const s = $("[data-season-base]"); if (!s) return;
    s.addEventListener("change", () => { location.hash = `#/${s.dataset.seasonBase}/${s.value}`; });
  }

  /* ================= SEARCH ================= */
  function wireSearch(input, box) {
    if (!input) return;
    let active = -1;
    box.setAttribute("role", "listbox");
    input.setAttribute("role", "combobox");
    input.setAttribute("aria-autocomplete", "list");
    input.setAttribute("aria-expanded", "false");
    if (box.id) input.setAttribute("aria-controls", box.id);
    const setActive = (i, links) => {
      active = i;
      links.forEach((l, k) => l.setAttribute("aria-selected", k === i ? "true" : "false"));
      links.forEach((l, k) => l.classList.toggle("active", k === i));
      if (i >= 0 && links[i]) { input.setAttribute("aria-activedescendant", links[i].id); links[i].scrollIntoView({ block: "nearest" }); }
      else input.removeAttribute("aria-activedescendant");
    };
    const RK = "hw-recent";
    const getRec = () => { try { return JSON.parse(localStorage.getItem(RK) || "[]"); } catch (e) { return []; } };
    const saveRec = (a) => { if (!a || !a.dataset || !a.dataset.id) return; const it = { t: a.dataset.t, id: a.dataset.id, nm: a.dataset.nm, tm: a.dataset.tm, sub: a.dataset.sub }; try { let arr = getRec().filter((x) => !(x.t === it.t && x.id === it.id)); arr.unshift(it); localStorage.setItem(RK, JSON.stringify(arr.slice(0, 6))); } catch (e) {} };
    const recRow = (it, i, u) => it.t === "t"
      ? `<a href="#/team/${it.id}" data-nav role="option" id="${u}${i}" aria-selected="false" data-t="t" data-id="${it.id}" data-nm="${esc(it.nm)}" data-sub="${esc(it.sub || "")}">${teamLogo(it.id, "xs")}<span class="nm">${esc(it.nm)}</span><span class="sub">${esc(it.sub || "")}</span></a>`
      : `<a href="#/player/${it.id}" data-nav role="option" id="${u}${i}" aria-selected="false" data-t="p" data-id="${it.id}" data-nm="${esc(it.nm)}" data-tm="${esc(it.tm || "")}" data-sub="${esc(it.sub || "")}">${headshot(it.id, it.nm, it.tm, "xs")}<span class="nm">${esc(it.nm)}</span><span class="sub">${esc(it.sub || "")}</span></a>`;
    const showRecents = () => {
      const r = getRec(); if (!r.length) { box.classList.remove("on"); input.setAttribute("aria-expanded", "false"); return; }
      const u = (box.id || "sr") + "-o";
      box.innerHTML = `<div class="grp grp-recent" role="presentation"><span>Recent</span><button type="button" class="sr-clear">Clear</button></div>` + r.map((it, i) => recRow(it, i, u)).join("");
      box.classList.add("on"); input.setAttribute("aria-expanded", "true"); active = -1;
    };
    const render = (q) => {
      const query = q.trim().toLowerCase(); if (!query) { showRecents(); return; }
      const qn = query.normalize("NFD").replace(/[̀-ͯ]/g, "");
      const scored = [];
      for (const e of SEARCH) {
        const nm = e[1].toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
        const idx = nm.indexOf(qn); if (idx < 0) continue;
        scored.push([idx === 0 ? 0 : 1, -(e[3]), e]); // startsWith first, then most recent
      }
      scored.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
      const players = scored.slice(0, 7).map((s) => s[2]);
      const teamHits = Object.keys(META.teams).filter((ab) => META.teams[ab].full.toLowerCase().includes(query)).slice(0, 4);
      active = -1; input.removeAttribute("aria-activedescendant");
      const uid = (box.id || "sr") + "-o";
      if (!players.length && !teamHits.length) { box.innerHTML = `<div class="empty">No players or teams match “${esc(q)}”.</div>`; box.classList.add("on"); input.setAttribute("aria-expanded", "true"); return; }
      let html = "", oi = 0;
      if (players.length) html += `<div class="grp" role="presentation">Players</div>` + players.map((e) => `<a href="#/player/${e[0]}" data-nav role="option" id="${uid}${oi++}" aria-selected="false" data-t="p" data-id="${e[0]}" data-nm="${esc(e[1])}" data-tm="${esc(e[5] || "")}" data-sub="${esc(e[4].split("-")[0])}${e[5] ? " · " + esc(e[5]) : ""}">
        ${headshot(e[0], e[1], e[5], "xs")}<span class="nm">${esc(e[1])}</span><span class="sub">${esc(e[4].split("-")[0])} · ${seasonLabel(e[2])}–${String(e[3]).slice(2)}</span></a>`).join("");
      if (teamHits.length) html += `<div class="grp" role="presentation">Teams</div>` + teamHits.map((ab) => `<a href="#/team/${ab}" data-nav role="option" id="${uid}${oi++}" aria-selected="false" data-t="t" data-id="${ab}" data-nm="${esc(META.teams[ab].full)}" data-sub="${esc(META.teams[ab].conf)}">
        ${teamLogo(ab, "xs")}<span class="nm">${esc(META.teams[ab].full)}</span><span class="sub">${META.teams[ab].conf}</span></a>`).join("");
      box.innerHTML = html; box.classList.add("on"); input.setAttribute("aria-expanded", "true");
    };
    const close = () => { box.classList.remove("on"); input.setAttribute("aria-expanded", "false"); input.removeAttribute("aria-activedescendant"); };
    input.addEventListener("input", () => render(input.value));
    input.addEventListener("focus", () => render(input.value));
    input.addEventListener("keydown", (e) => {
      const links = $$("a", box);
      if (e.key === "ArrowDown") { e.preventDefault(); if (!links.length) return; setActive(Math.min(active + 1, links.length - 1), links); }
      else if (e.key === "ArrowUp") { e.preventDefault(); if (!links.length) return; setActive(Math.max(active - 1, 0), links); }
      else if (e.key === "Enter" && links[active]) { saveRec(links[active]); location.hash = links[active].getAttribute("href").slice(1); input.blur(); close(); return; }
      else if (e.key === "Escape") { input.blur(); close(); return; }
    });
    document.addEventListener("click", (e) => { if (!box.contains(e.target) && e.target !== input) close(); });
    box.addEventListener("click", (e) => {
      if (e.target.closest(".sr-clear")) { e.preventDefault(); try { localStorage.removeItem(RK); } catch (er) {} close(); input.focus(); return; }
      const a = e.target.closest("a[data-id]"); if (a) saveRec(a);
      setTimeout(close, 0);
    });
  }

  /* ---------- not found ---------- */
  function notFound(kind) {
    app.innerHTML = `<div class="wrap page"><div class="crumb"><a href="#/">Home</a></div>
      <h2 style="font-size:28px">That ${kind} isn't in the reference.</h2>
      <p class="muted" style="margin-top:8px">Try the <a href="#/players" style="color:var(--accent-deep)">players</a>, <a href="#/teams" style="color:var(--accent-deep)">teams</a> or <a href="#/seasons" style="color:var(--accent-deep)">seasons</a> index.</p></div>`;
  }

  /* ---------- reveal ---------- */
  function revealInit() {
    const els = $$(".reveal"); if (!("IntersectionObserver" in window)) { els.forEach((el) => el.classList.add("in")); return; }
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { threshold: 0.06, rootMargin: "0px 0px -4% 0px" });
    requestAnimationFrame(() => els.forEach((el) => { if (el.getBoundingClientRect().top < innerHeight * 0.96) el.classList.add("in"); else io.observe(el); }));
    setTimeout(() => els.forEach((el) => el.classList.add("in")), 1200);
  }

  /* ---------- skeleton loaders (replace the boot spinner: structure-matching
     shimmer → less layout shift, faster perceived load, healthier CLS) ---------- */
  const DETAIL_SEGS = new Set(["player", "pseason", "team", "game", "season"]);
  function skeleton(seg) {
    const tableCard = `<div class="sk-card"><div style="display:flex;flex-direction:column;gap:14px">
      <div class="sk sk-row" style="width:38%;height:18px"></div>
      ${Array.from({ length: 8 }, () => `<div class="sk sk-row" style="width:100%"></div>`).join("")}
    </div></div>`;
    if (DETAIL_SEGS.has(seg)) {
      return `<div class="wrap page skel" aria-busy="true">
        <div class="sk sk-crumb"></div>
        <div class="sk-hero"><div class="sk sk-ava"></div><div class="sk-lines">
          <div class="sk sk-row" style="width:52%;height:26px"></div>
          <div class="sk sk-row" style="width:36%"></div>
          <div class="sk sk-row" style="width:62%;height:12px"></div></div></div>
        <div class="sk-tiles">${Array.from({ length: 6 }, () => `<div class="sk"></div>`).join("")}</div>
        ${tableCard}</div>`;
    }
    return `<div class="wrap page skel" aria-busy="true">
      <div class="sk sk-crumb"></div>
      <div style="display:flex;justify-content:space-between;gap:16px;margin-bottom:18px">
        <div class="sk sk-row" style="width:230px;height:26px"></div>
        <div class="sk sk-row" style="width:130px;height:20px"></div></div>
      ${tableCard}</div>`;
  }

  /* ================= ROUTER ================= */
  const NAV = { "": "home", players: "players", player: "players", pseason: "players", teams: "teams", team: "teams", leaders: "leaders", standings: "standings", seasons: "seasons", season: "seasons", awards: "awards", draft: "seasons", compare: "players", news: "news", article: "news", salaries: "salaries", games: "games", game: "games", play: "play", betting: "betting", settings: "settings", terms: "", privacy: "" };
  const SECTION_SEO = {
    "": [null, "Look up any player or team in NBA history — stats, contracts, standings, leaders and awards from 1947 to today."],
    players: ["All Players", "Browse every player in NBA history — career stats, contracts and accolades for 5,000+ players."],
    teams: ["All Teams", "Every NBA franchise — rosters, records, standings and history."],
    leaders: ["NBA Leaders", "Season and all-time leaders in points, rebounds, assists, PER, true shooting and more."],
    standings: ["NBA Standings", "Conference standings by season, from 1947 to today."],
    seasons: ["NBA Seasons", "Every NBA season — champions, standings, leaders and awards."],
    awards: ["NBA Awards", "MVP, Defensive Player, Rookie of the Year, Finals MVP and All-NBA voting through history."],
    draft: ["NBA Draft", "Every NBA Draft class — picks, teams and career outcomes."],
    salaries: ["NBA Salaries", "Player contracts and salaries by season, plus career earnings."],
    compare: ["Compare Players", "Compare any two NBA players head-to-head across career stats."],
    news: ["NBA News", "Latest NBA headlines."],
  };
  async function route() {
    const h = location.hash.replace(/^#\/?/, ""), parts = h.split("/"), seg = parts[0], arg = parts[1];
    hideTT(); closeMenu(); closeMore();
    app.innerHTML = skeleton(seg);
    setSEO(SECTION_SEO[seg] ? SECTION_SEO[seg][0] : null, SECTION_SEO[seg] ? SECTION_SEO[seg][1] : "A modern NBA reference — every player and team, all-time leaders, standings, awards, salaries and history from 1947 to today.");
    try {
      if (seg === "" ) await renderHome();
      else if (seg === "player") await renderPlayer(arg);
      else if (seg === "pseason") await renderPlayerSeason(arg, parts[2]);
      else if (seg === "players") await renderPlayersIndex();
      else if (seg === "team") await renderTeam(arg, parts[2]);
      else if (seg === "teams") await renderTeamsIndex();
      else if (seg === "leaders") await renderLeaders(arg);
      else if (seg === "standings") await renderStandings(arg);
      else if (seg === "season") await renderSeason(arg);
      else if (seg === "seasons") renderSeasons();
      else if (seg === "awards") await renderAwards(arg);
      else if (seg === "draft") await renderDraft(arg);
      else if (seg === "compare") await renderCompare(arg === "_" ? null : arg, parts[2] === "_" ? null : parts[2]);
      else if (seg === "news") await renderNews();
      else if (seg === "play") await (arg === "grid" ? renderPlayGrid(parts[2]) : arg === "sixspins" ? renderSixSpins() : arg === "duel" ? renderStatDuel() : arg === "buzzer" ? renderBuzzer() : renderPlay());
      else if (seg === "betting") await renderBetting();
      else if (seg === "settings") { await renderHome(); openSettings(); }
      else if (seg === "terms") renderTerms();
      else if (seg === "privacy") renderPrivacy();
      else if (seg === "article") await renderArticle(arg);
      else if (seg === "games") await renderGames(arg);
      else if (seg === "game") await renderGame(arg);
      else if (seg === "salaries") await renderSalaries(arg);
      else await renderHome();
    } catch (err) {
      console.error(err);
      app.innerHTML = `<div class="wrap page"><h2 style="font-size:26px">Something went wrong loading this view.</h2><p class="muted" style="margin-top:8px">${esc(err.message || err)}</p><p style="margin-top:12px"><a href="#/" style="color:var(--accent-deep)">← Home</a></p></div>`;
    }
    $$(".mainnav a, .mobile-menu a").forEach((a) => a.classList.toggle("on", a.dataset.route === (NAV[seg] || "home")));
    const mb = $("#moreBtn"); if (mb) mb.classList.toggle("on", !!$(".navmore-menu a.on"));
    window.scrollTo(0, 0);
    revealInit();
  }

  /* ---------- mobile menu ---------- */
  const menu = $("#mobileMenu"), menuBtn = $("#menuBtn");
  function closeMenu() { menu.hidden = true; menuBtn.setAttribute("aria-expanded", "false"); }
  menuBtn.addEventListener("click", () => { const open = menu.hidden; menu.hidden = !open; menuBtn.setAttribute("aria-expanded", String(open)); });
  // Settings opens as a modal from anywhere (top bar, menu, footer) without navigating away.
  document.addEventListener("click", (e) => { const s = e.target.closest("[data-settings]"); if (s) { e.preventDefault(); closeMenu(); openSettings(); } });
  // Collapsible groups in the mobile menu (nested nav).
  $$("#mobileMenu .mm-group").forEach((btn) => btn.addEventListener("click", () => {
    const sub = btn.nextElementSibling, open = sub.hidden;
    btn.setAttribute("aria-expanded", String(open)); sub.hidden = !open;
  }));

  /* ---------- "More" nav dropdown ---------- */
  const moreBtn = $("#moreBtn"), moreMenu = $("#moreMenu");
  function closeMore() { if (moreMenu) { moreMenu.hidden = true; moreBtn.setAttribute("aria-expanded", "false"); } }
  if (moreBtn) {
    moreBtn.addEventListener("click", (e) => { e.stopPropagation(); const open = moreMenu.hidden; moreMenu.hidden = !open; moreBtn.setAttribute("aria-expanded", String(open)); });
    document.addEventListener("click", (e) => { if (!moreMenu.hidden && !e.target.closest(".navmore")) closeMore(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeMore(); });
    moreMenu.addEventListener("click", () => closeMore());
  }

  /* ---------- theme + density (persisted; managed on the Settings page) ---------- */
  const curTheme = () => document.documentElement.getAttribute("data-theme") || (matchMedia("(prefers-color-scheme:dark)").matches ? "dark" : "light");
  const themeMode = () => { try { return localStorage.getItem("hw-theme") || "system"; } catch (e) { return "system"; } };
  function applyTheme(mode, persist) {
    if (mode === "system") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", mode);
    if (persist) { try { localStorage.setItem("hw-theme", mode); } catch (e) {} }
  }
  function toggleTheme() { applyTheme(curTheme() === "dark" ? "light" : "dark", true); }   // used by ⌘K
  const curDensity = () => document.documentElement.getAttribute("data-density") || "comfortable";
  function applyDensity(d, persist) {
    if (d === "compact") document.documentElement.setAttribute("data-density", "compact");
    else document.documentElement.removeAttribute("data-density");
    if (persist) { try { localStorage.setItem("hw-density", d); } catch (e) {} }
  }
  applyTheme(themeMode(), false);
  applyDensity((() => { try { return localStorage.getItem("hw-density") || "comfortable"; } catch (e) { return "comfortable"; } })(), false);

  /* ================= BOOT ================= */
  // ---- click-to-sort for every reference table (delegated, so dynamic tables work too) ----
  function sortTableByHeader(th) {
    const table = th.closest("table"), tbody = table && table.tBodies[0];
    if (!tbody) return;
    const idx = th.cellIndex, heads = [...th.parentElement.cells];
    const cellVal = (r) => {
      const c = r.cells[idx]; if (!c) return { t: "", n: null };
      const pick = c.querySelector("a,.nm,.season") || c;
      const t = pick.textContent.trim(), clean = t.replace(/[,$%\s]/g, "");
      const isNum = clean !== "" && /^[-+]?[0-9]*\.?[0-9]+$/.test(clean);
      return { t, n: isNum ? parseFloat(clean) : null };
    };
    const rows = [...tbody.rows], totals = rows.filter((r) => r.classList.contains("total"));
    const body = rows.filter((r) => !r.classList.contains("total"));
    // Multi-team seasons render as a primary season row followed by indented ".stint"
    // sub-rows (blank season cell). Group each stint under its parent so sorting keeps
    // them together and sorts by the parent's (combined-season) value.
    const groups = [];
    body.forEach((r) => {
      if (r.classList.contains("stint") && groups.length) groups[groups.length - 1].kids.push(r);
      else groups.push({ head: r, kids: [] });
    });
    const numeric = groups.some((g) => cellVal(g.head).n !== null);
    const dir = th.classList.contains("sorted") ? (th.classList.contains("asc") ? "desc" : "asc") : (numeric ? "desc" : "asc");
    heads.forEach((h) => h.classList.remove("sorted", "asc", "desc"));
    th.classList.add("sorted", dir);
    groups.sort((a, b) => {
      const va = cellVal(a.head), vb = cellVal(b.head);
      if (va.n === null && vb.n === null) { const c = va.t.localeCompare(vb.t, undefined, { numeric: true }); return dir === "asc" ? c : -c; }
      if (va.n === null) return 1;      // blanks always sink to the bottom
      if (vb.n === null) return -1;
      return dir === "asc" ? va.n - vb.n : vb.n - va.n;
    });
    groups.forEach((g) => { tbody.appendChild(g.head); g.kids.forEach((k) => tbody.appendChild(k)); });
    totals.forEach((r) => tbody.appendChild(r));
  }
  document.addEventListener("click", (e) => {
    const th = e.target.closest("table.ref thead th");
    if (th && th.closest("table").tBodies[0] && th.closest("table").tBodies[0].rows.length > 2) sortTableByHeader(th);
  });

  /* ================= ⌘K COMMAND PALETTE ================= */
  let cmdkOpen = () => {};
  function initCmdK() {
    const RK = "hw-recent";
    const getRec = () => { try { return JSON.parse(localStorage.getItem(RK) || "[]"); } catch (e) { return []; } };
    const pushRec = (it) => { try { const rec = { t: it.k === "team" ? "t" : "p", id: it.id, nm: it.label, tm: it.tm || "", sub: it.sub || "" }; let a = getRec().filter((x) => !(x.t === rec.t && x.id === rec.id)); a.unshift(rec); localStorage.setItem(RK, JSON.stringify(a.slice(0, 6))); } catch (e) {} };
    const norm = (s) => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    const ACTIONS = [
      { k: "nav", label: "Players", sub: "Browse all players", hash: "#/players" },
      { k: "nav", label: "Teams", sub: "All franchises", hash: "#/teams" },
      { k: "nav", label: "Scores", sub: "Recent games & box scores", hash: "#/games" },
      { k: "nav", label: "Standings", sub: "Conference standings", hash: "#/standings" },
      { k: "nav", label: "Leaders", sub: "Season stat leaders", hash: "#/leaders" },
      { k: "nav", label: "All-time leaders", sub: "Career records", hash: "#/leaders/all" },
      { k: "nav", label: "News", sub: "Around the league", hash: "#/news" },
      { k: "nav", label: "Seasons", sub: "Every season", hash: "#/seasons" },
      { k: "nav", label: "Awards", sub: "MVP, DPOY, ROY & more", hash: "#/awards" },
      { k: "nav", label: "Salaries", sub: "Contracts & earnings", hash: "#/salaries" },
      { k: "nav", label: "Draft", sub: "Draft classes", hash: "#/draft" },
      { k: "nav", label: "Compare players", sub: "Head to head", hash: "#/compare" },
      { k: "act", label: "Toggle theme", sub: "Light / dark", act: "theme" },
      { k: "act", label: "Toggle table density", sub: "Comfortable / compact", act: "density" },
    ];
    const el = document.createElement("div");
    el.className = "cmdk"; el.hidden = true;
    el.innerHTML = `<div class="cmdk-backdrop"></div>
      <div class="cmdk-panel" role="dialog" aria-modal="true" aria-label="Command menu">
        <div class="cmdk-top"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
          <input id="cmdkInput" type="text" placeholder="Search players, teams, or jump to…" autocomplete="off" spellcheck="false" aria-label="Command menu" aria-controls="cmdkList" role="combobox" aria-expanded="true">
          <span class="cmdk-esc">esc</span></div>
        <div class="cmdk-list" id="cmdkList" role="listbox"></div></div>`;
    document.body.appendChild(el);
    const input = el.querySelector("#cmdkInput"), list = el.querySelector("#cmdkList");
    let items = [], sel = 0;
    const recItem = (r) => r.t === "t" ? { k: "team", id: r.id, label: r.nm, sub: r.sub || "Team", hash: "#/team/" + r.id } : { k: "player", id: r.id, label: r.nm, sub: r.sub || "Player", tm: r.tm, hash: "#/player/" + r.id };
    const ico = (it) => it.k === "player" ? headshot(it.id, it.label, it.tm, "xs") : it.k === "team" ? teamLogo(it.id, "xs") : `<span class="cmdk-ic">${it.k === "act" ? "⌘" : "→"}</span>`;
    function build(q) {
      const query = norm(q.trim()); items = [];
      if (!query) {
        getRec().slice(0, 4).forEach((r) => items.push(recItem(r)));
        ACTIONS.forEach((a) => items.push(a));
      } else {
        const scored = [];
        for (const e of SEARCH) { const nm = norm(e[1]); const i = nm.indexOf(query); if (i < 0) continue; scored.push([i === 0 ? 0 : 1, -(e[3]), e]); }
        scored.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
        scored.slice(0, 6).forEach((s) => { const e = s[2]; items.push({ k: "player", id: e[0], label: e[1], sub: (e[4].split("-")[0]) + (e[5] ? " · " + e[5] : ""), tm: e[5], hash: "#/player/" + e[0] }); });
        Object.keys(META.teams).filter((ab) => norm(META.teams[ab].full).includes(query)).slice(0, 3).forEach((ab) => items.push({ k: "team", id: ab, label: META.teams[ab].full, sub: META.teams[ab].conf + "ern Conference", hash: "#/team/" + ab }));
        ACTIONS.filter((a) => norm(a.label).includes(query) || norm(a.sub).includes(query)).forEach((a) => items.push(a));
      }
      sel = 0; renderList();
    }
    function renderList() {
      if (!items.length) { list.innerHTML = `<div class="cmdk-empty">No matches — try a player or team name.</div>`; return; }
      let last = "";
      list.innerHTML = items.map((it, i) => {
        const grp = it.k === "player" ? "Players" : it.k === "team" ? "Teams" : it.k === "act" ? "Actions" : "Jump to";
        const hdr = grp !== last ? `<div class="cmdk-grp">${grp}</div>` : ""; last = grp;
        return `${hdr}<div class="cmdk-item ${i === sel ? "on" : ""}" data-i="${i}" role="option" aria-selected="${i === sel}">${ico(it)}<span class="cmdk-lbl">${esc(it.label)}</span><span class="cmdk-sub">${esc(it.sub || "")}</span><span class="cmdk-go">↵</span></div>`;
      }).join("");
      const on = list.querySelector(".cmdk-item.on"); if (on) on.scrollIntoView({ block: "nearest" });
    }
    function activate(it) {
      if (!it) return;
      close();
      if (it.act === "theme") return toggleTheme();
      if (it.act === "density") return applyDensity(curDensity() === "compact" ? "comfortable" : "compact", true);
      if (it.k === "player" || it.k === "team") pushRec(it);
      if (it.hash) location.hash = it.hash;
    }
    function open() { if (!el.hidden) return; el.hidden = false; document.body.classList.add("cmdk-open"); input.value = ""; build(""); requestAnimationFrame(() => input.focus()); }
    function close() { el.hidden = true; document.body.classList.remove("cmdk-open"); }
    cmdkOpen = open;
    input.addEventListener("input", () => build(input.value));
    input.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown") { e.preventDefault(); sel = Math.min(sel + 1, items.length - 1); renderList(); }
      else if (e.key === "ArrowUp") { e.preventDefault(); sel = Math.max(sel - 1, 0); renderList(); }
      else if (e.key === "Enter") { e.preventDefault(); activate(items[sel]); }
      else if (e.key === "Escape") { e.preventDefault(); close(); }
    });
    list.addEventListener("mousemove", (e) => { const d = e.target.closest(".cmdk-item"); if (d && +d.dataset.i !== sel) { sel = +d.dataset.i; renderList(); } });
    list.addEventListener("click", (e) => { const d = e.target.closest(".cmdk-item"); if (d) activate(items[+d.dataset.i]); });
    el.querySelector(".cmdk-backdrop").addEventListener("click", close);
    document.addEventListener("keydown", (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); el.hidden ? open() : close(); }
      else if (e.key === "/" && el.hidden && !/^(INPUT|TEXTAREA|SELECT)$/.test((e.target.tagName || "")) && !e.metaKey && !e.ctrlKey) { e.preventDefault(); open(); }
    });
    const openBtn = $("#cmdkBtn");
    if (openBtn) { if (!/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)) openBtn.textContent = "Ctrl K"; openBtn.addEventListener("click", open); }
  }

  (async function boot() {
    try {
      [META, SEARCH] = await Promise.all([getMeta(), getSearch()]);
      SMAP = {}; SEARCH.forEach((e) => (SMAP[e[0]] = e));
      initCmdK();
      // The top-bar search is a trigger for the ⌘K palette, not an inline text box.
      const ts = $("#topSearch");
      if (ts) {
        ts.readOnly = true; ts.setAttribute("role", "button"); ts.setAttribute("aria-label", "Search (opens command menu)");
        ts.addEventListener("pointerdown", (e) => { e.preventDefault(); cmdkOpen(); });
        ts.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " " || e.key === "/") { e.preventDefault(); cmdkOpen(); } });
        ts.addEventListener("focus", () => cmdkOpen());
      }
      addEventListener("hashchange", route);
      await route();
      showDataRefreshed();
    } catch (err) {
      app.innerHTML = `<div class="wrap page"><h2 style="font-size:26px">Couldn't load the dataset.</h2><p class="muted" style="margin-top:8px">${esc(err.message || err)}</p></div>`;
    }
  })();
})();
