#!/usr/bin/env python3
"""
Static SEO pre-render for Hardwood.

The site itself is a hash-routed SPA (index.html + app.js), which Google cannot
index per-entity — the #fragment never reaches the crawler, so every player and
team collapses to a single URL. This script emits real, crawlable, self-contained
HTML pages for every player and team at stable paths:

    /players/<id>.html      e.g. /players/jamesle01.html
    /teams/<abbr>.html      e.g. /teams/BOS.html

Each page ships full server-rendered content (bio, career stats, a season-by-season
table, contract/earnings), a query-matched <title> ("<Player> Stats, Contract &
Career"), meta description, Open Graph/Twitter tags, and JSON-LD — everything the
research flagged as bbref's structural SEO moat. Pages progressively link into the
interactive SPA via "View interactive →". Also writes sitemap.xml and robots.txt.

Run:  python3 build/build_seo.py            (from the project root)
Set the canonical host:  SITE_URL=https://yourdomain.com python3 build/build_seo.py
"""
import json, os, sys, html
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
SITE_URL = os.environ.get("SITE_URL", "").rstrip("/")  # e.g. https://hardwood.app ; empty -> relative canonicals

# ---------- formatting helpers (mirror app.js) ----------
def esc(s): return html.escape(str(s), quote=True)
def one(v): return f"{v:.1f}" if isinstance(v, (int, float)) else "—"
def pctf(v):
    if not isinstance(v, (int, float)): return "—"
    return f"{v:.3f}".lstrip("0") if 0 < v < 1 else f"{v:.3f}"
def season_label(s):  # 2004 -> "2003-04"
    return f"{s-1}-{str(s)[2:]}" if s else "—"
def money(n):
    if not n: return "—"
    if n >= 1e9: return f"${n/1e9:.1f}B"
    if n >= 1e6: return f"${n/1e6:.1f}M"
    if n >= 1e3: return f"${n/1e3:.0f}K"
    return f"${n:,}"
def money_full(n): return f"${n:,}" if n else "—"

def canonical(path): return (SITE_URL + path) if SITE_URL else path

META = json.load(open(DATA / "meta.json"))
TEAMS = META["teams"]
try:
    SAL = json.load(open(DATA / "salaries.json"))
except FileNotFoundError:
    SAL = {"byPlayer": {}, "careerEarn": {}}

def tname(ab): return TEAMS.get(ab, {}).get("full", ab)
def is_real_team(ab): return ab in TEAMS

# ---------- shared page shell ----------
def page(title, desc, canon, body, jsonld=None, og_type="website"):
    ld = f'<script type="application/ld+json">{json.dumps(jsonld)}</script>' if jsonld else ""
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<title>{esc(title)} — Hardwood</title>
<meta name="description" content="{esc(desc)}" />
<link rel="canonical" href="{esc(canon)}" />
<meta name="theme-color" content="#faf9f5" media="(prefers-color-scheme: light)" />
<meta name="theme-color" content="#1f1e1c" media="(prefers-color-scheme: dark)" />
<meta property="og:site_name" content="Hardwood" />
<meta property="og:type" content="{og_type}" />
<meta property="og:title" content="{esc(title)} — Hardwood" />
<meta property="og:description" content="{esc(desc)}" />
<meta property="og:url" content="{esc(canon)}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="{esc(title)} — Hardwood" />
<meta name="twitter:description" content="{esc(desc)}" />
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=Schibsted+Grotesk:wght@400;500;600;700&family=Geist+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
<link rel="stylesheet" href="/ds/tokens.css" />
<link rel="stylesheet" href="/styles.css?v=29" />
{ld}
</head>
<body>
<aside class="ad-rail ad-rail-l" aria-hidden="true"><div class="slot">Ad</div></aside>
<aside class="ad-rail ad-rail-r" aria-hidden="true"><div class="slot">Ad</div></aside>
<header class="topbar"><div class="wrap">
  <a href="/" class="brand"><span class="dot"></span> Hardwood</a>
  <nav class="mainnav">
    <a href="/#/players">Players</a><a href="/#/teams">Teams</a><a href="/#/leaders">Leaders</a>
    <a href="/#/standings">Standings</a><a href="/#/salaries">Salaries</a>
  </nav>
</div></header>
<main id="app">{body}</main>
</body>
</html>
"""

# ---------- player pages ----------
def render_player(p):
    pid, name, b, cur = p["id"], p["name"], p.get("bio", {}), p.get("cur", {})
    cr = p.get("career", {})
    log = p.get("log", [])
    acc = p.get("acc", [])
    team = cur.get("team", "")
    pos = cur.get("pos") or b.get("pos") or ""
    yrs = f"{season_label(b.get('from') or (log[0][0] if log else None))}–{season_label(b.get('to') or cur.get('season'))}"
    seasons = len({r[0] for r in log})
    career_line = f"{one(cr.get('pts'))} PPG, {one(cr.get('trb'))} RPG, {one(cr.get('ast'))} APG"
    top_acc = ", ".join(a["t"] for a in acc if a.get("g"))[:120]

    sal_rows = SAL.get("byPlayer", {}).get(pid) or []
    sal_line = ""
    if sal_rows:
        ls = sal_rows[-1]
        sal_line = f" Latest tracked salary {money_full(ls[1])} ({season_label(ls[0])}); career earnings {money(SAL.get('careerEarn', {}).get(pid))}."

    desc = (f"{name} career stats, contract & salary — "
            f"{pos + ' ' if pos else ''}{'for the ' + tname(team) + '. ' if is_real_team(team) else ''}"
            f"{career_line} across {seasons} season{'s' if seasons != 1 else ''} ({yrs})."
            f"{' ' + top_acc + '.' if top_acc else ''}{sal_line}")

    # per-game season table (crawlable)
    def prow(r):
        st = len(r) > 16 and r[16] == 2
        return ("<tr>"
                f"<td>{'' if st else esc(season_label(r[0]))}</td>"
                f"<td>{esc(r[2])}</td><td>{r[3] if r[3] is not None else '—'}</td><td>{r[4]}</td>"
                f"<td>{one(r[5])}</td><td>{pctf(r[6])}</td><td>{pctf(r[7])}</td><td>{pctf(r[8])}</td>"
                f"<td>{one(r[9])}</td><td>{one(r[10])}</td><td>{one(r[11])}</td><td>{one(r[12])}</td>"
                f"<td>{one(r[13])}</td><td>{one(r[14])}</td><td>{pctf(r[15])}</td></tr>")
    thead = ("<thead><tr><th>Season</th><th>Tm</th><th>Age</th><th>GP</th><th>MPG</th><th>FG%</th><th>3P%</th>"
             "<th>FT%</th><th>REB</th><th>AST</th><th>STL</th><th>BLK</th><th>PTS</th><th>PER</th><th>TS%</th></tr></thead>")
    stat_table = (f'<div class="tbl-wrap"><table class="ref" style="min-width:760px">{thead}'
                  f'<tbody>{"".join(prow(r) for r in log)}</tbody></table></div>')

    # contract table
    contract = ""
    if sal_rows:
        rows = "".join(f'<tr><td>{esc(season_label(s))}</td><td class="hi">{money_full(a)}</td></tr>' for s, a in sal_rows)
        contract = (f'<h2>Contract & salary</h2><p class="muted">Nominal salaries; tracked coverage is limited to '
                    f'seasons in the current dataset.</p><div class="tbl-wrap"><table class="ref" style="min-width:0">'
                    f'<thead><tr><th>Season</th><th>Salary</th></tr></thead><tbody>{rows}'
                    f'<tr class="total"><td>Career earnings</td><td class="hi">{money_full(SAL.get("careerEarn", {}).get(pid))}</td></tr>'
                    f'</tbody></table></div>')

    team_link = (f'<a href="/teams/{esc(team)}.html">{esc(tname(team))}</a>' if is_real_team(team) else esc(team))
    acc_html = "".join(f'<span class="chip {"gold" if a.get("g") else ""}">{"★ " if a.get("g") else ""}{esc(a["t"])}</span>' for a in acc)

    body = f"""
    <div class="wrap page">
      <nav class="crumb" aria-label="Breadcrumb"><a href="/">Home</a><span class="sep">/</span><a href="/#/players">Players</a><span class="sep">/</span><span>{esc(name)}</span></nav>
      <h1>{esc(name)}</h1>
      <p class="pos">{esc(pos)} · {team_link}</p>
      <p class="muted">Seasons {esc(yrs)} · {seasons} on record{' · Ht ' + esc(b['ht']) if b.get('ht') else ''}{' · b. ' + esc(b['born'][:4]) if b.get('born') else ''}</p>
      <div class="chip-row">{acc_html}</div>
      <p style="margin:14px 0"><a class="btn" href="/#/player/{esc(pid)}">View interactive stats & charts →</a></p>
      <h2>Career averages</h2>
      <p><strong>{esc(career_line)}</strong> · {cr.get('g','—')} games · {pctf(cr.get('fg'))} FG% · {pctf(cr.get('tp'))} 3P%.</p>
      <h2>Stats by season — per game</h2>
      {stat_table}
      {contract}
    </div>"""

    ld = {"@context": "https://schema.org", "@type": "Person", "name": name,
          "jobTitle": "Basketball player", "url": canonical(f"/players/{pid}.html")}
    if b.get("ht"): ld["height"] = b["ht"]
    if b.get("born"): ld["birthDate"] = b["born"]
    if b.get("college"): ld["alumniOf"] = b["college"]
    if is_real_team(team): ld["affiliation"] = {"@type": "SportsTeam", "name": tname(team), "sport": "Basketball"}

    return page(f"{name} Stats, Contract & Career", desc, canonical(f"/players/{pid}.html"), body, ld, "profile")

# ---------- team pages ----------
def render_team(ab, t):
    latest = t["seasons"][0] if t.get("seasons") else None
    m = TEAMS.get(ab, {})
    conf = m.get("conf")
    net = (latest["o"] - latest["d"]) if latest and latest.get("o") is not None and latest.get("d") is not None else None
    rec = ""
    if latest:
        wl = f"{latest['w']}–{latest['l']}"
        rec = f"{season_label(latest['season'])} record {wl}" + (f", {'+' if net >= 0 else ''}{net:.1f} net rating" if net is not None else "") + "."
    span = f"{season_label(t['seasons'][-1]['season'])}" if t.get("seasons") else ""
    desc = (f"{t['name']} roster, record, standings and stats. {rec} "
            f"{conf + 'ern Conference. ' if conf else ''}Franchise since {span} — {len(t.get('seasons', []))} seasons on record.")

    roster = t.get("roster", [])
    r_rows = "".join(
        f'<tr><td><a href="/players/{esc(r[0])}.html">{esc(r[1])}</a></td><td>{esc(r[2])}</td>'
        f'<td>{r[3]}</td><td>{one(r[4])}</td><td>{one(r[5])}</td><td class="hi">{one(r[6])}</td></tr>'
        for r in roster)
    roster_tbl = (f'<div class="tbl-wrap"><table class="ref"><thead><tr><th>Player</th><th>Pos</th><th>GP</th>'
                  f'<th>REB</th><th>AST</th><th>PTS</th></tr></thead><tbody>{r_rows}</tbody></table></div>') if roster else ""

    s_rows = "".join(
        f'<tr><td>{esc(season_label(s["season"]))}</td><td>{s["w"]}–{s["l"]}</td>'
        f'<td>{("+" if (s.get("srs") or 0) >= 0 else "") + one(s["srs"]) if s.get("srs") is not None else "—"}</td></tr>'
        for s in t.get("seasons", [])[:30])
    season_tbl = (f'<div class="tbl-wrap"><table class="ref"><thead><tr><th>Season</th><th>Record</th><th>SRS</th></tr>'
                  f'</thead><tbody>{s_rows}</tbody></table></div>')

    body = f"""
    <div class="wrap page">
      <nav class="crumb" aria-label="Breadcrumb"><a href="/">Home</a><span class="sep">/</span><a href="/#/teams">Teams</a><span class="sep">/</span><span>{esc(t['name'])}</span></nav>
      <h1>{esc(t['name'])}</h1>
      <p class="muted">{esc(conf + 'ern Conference' if conf else '')} · {rec}</p>
      <p style="margin:14px 0"><a class="btn" href="/#/team/{esc(ab)}">View interactive team page →</a></p>
      {'<h2>Current roster leaders</h2>' + roster_tbl if roster_tbl else ''}
      <h2>Season-by-season</h2>
      {season_tbl}
    </div>"""

    ld = {"@context": "https://schema.org", "@type": "SportsTeam", "name": t["name"],
          "sport": "Basketball", "url": canonical(f"/teams/{ab}.html")}
    if conf: ld["memberOf"] = {"@type": "SportsOrganization", "name": conf + "ern Conference"}
    return page(f"{t['name']} — Roster, Record & Stats", desc, canonical(f"/teams/{ab}.html"), body, ld)

# ---------- game box-score pages (the high-traffic SEO surface: "[team] vs [team] box score") ----------
_MO = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
def date_pretty(d):
    try: y, m, day = d.split("-"); return f"{_MO[int(m) - 1]} {int(day)}, {y}"
    except Exception: return d

def render_game(g):
    h, a = g["home"], g["away"]
    ht, at = tname(h["abbr"]), tname(a["abbr"])
    dp = date_pretty(g["date"])
    lbl = f" · {g['label']}" if g.get("label") else (f" · {g['type']}" if g.get("type") and g["type"] != "Regular Season" else "")
    ncols = max(len(h.get("q", [])), len(a.get("q", [])))
    cols = ["1", "2", "3", "4"] + [f"OT{i+1}" if ncols - 4 > 1 else "OT" for i in range(max(0, ncols - 4))]
    def line(side):
        s = g[side]
        qs = "".join(f"<td>{s['q'][i] if s.get('q') and i < len(s['q']) else '—'}</td>" for i in range(len(cols)))
        return f"<tr><td class='l'>{esc(tname(s['abbr']))}</td>{qs}<td class='hi'>{s.get('score','—')}</td></tr>"
    def prow(p):
        nm = esc(p["name"])
        who = f'<a href="/players/{p["pid"]}.html">{nm}</a>' if p.get("pid") else nm
        pm = ("+" + str(p["pm"]) if (p.get("pm") or 0) > 0 else str(p["pm"])) if p.get("pm") is not None else "—"
        return (f"<tr><td class='l'>{who}</td><td>{p.get('min','—')}</td><td class='hi'>{p.get('pts','—')}</td>"
                f"<td>{p.get('reb','—')}</td><td>{p.get('ast','—')}</td><td>{p.get('stl','—')}</td><td>{p.get('blk','—')}</td>"
                f"<td>{p.get('fgm','—')}-{p.get('fga','—')}</td><td>{p.get('tpm','—')}-{p.get('tpa','—')}</td><td>{pm}</td></tr>")
    def box(side):
        s = g[side]
        rows = "".join(prow(p) for p in g["box"][side] if p.get("min") is not None)
        return (f"<h2>{esc(tname(s['abbr']))} · {s.get('score','')}</h2><div class='tbl-wrap'><table class='ref' style='min-width:600px'>"
                f"<thead><tr><th class='l'>Player</th><th>MIN</th><th>PTS</th><th>REB</th><th>AST</th><th>STL</th><th>BLK</th><th>FG</th><th>3P</th><th>+/−</th></tr></thead>"
                f"<tbody>{rows}</tbody></table></div>")
    title = f"{at} vs {ht}, {dp} — Box Score"
    desc = (f"{at} {a.get('score','')}, {ht} {h.get('score','')} — {dp}{lbl.replace(' · ', ', ')}. "
            f"Full box score with quarter scores, points, rebounds, assists and plus-minus for every player.")
    body = f"""
    <div class="wrap page">
      <nav class="crumb" aria-label="Breadcrumb"><a href="/">Home</a><span class="sep">/</span><a href="/#/games">Games</a><span class="sep">/</span><span>{esc(a['abbr'])} @ {esc(h['abbr'])}</span></nav>
      <h1>{esc(at)} vs {esc(ht)}</h1>
      <p class="pos">{esc(dp)}{esc(lbl)} · Final: {esc(at)} {a.get('score','')}, {esc(ht)} {h.get('score','')}</p>
      <p style="margin:14px 0"><a class="btn" href="/#/game/{esc(g['id'])}">View interactive box score →</a></p>
      <div class="tbl-wrap"><table class="ref" style="min-width:0"><thead><tr><th class="l">Team</th>{''.join(f'<th>{c}</th>' for c in cols)}<th>T</th></tr></thead>
        <tbody>{line('away')}{line('home')}</tbody></table></div>
      {box('away')}{box('home')}
      {'<p class="muted" style="margin-top:14px">' + esc(g.get('arena','')) + (' · ' + esc(g['arenaCity']) if g.get('arenaCity') else '') + '</p>' if g.get('arena') else ''}
    </div>"""
    winner = ht if (h.get("score") or 0) > (a.get("score") or 0) else at
    ld = {"@context": "https://schema.org", "@type": "SportsEvent", "name": f"{at} vs {ht}",
          "startDate": g["date"], "sport": "Basketball", "url": canonical(f"/game/{g['id']}.html"),
          "competitor": [{"@type": "SportsTeam", "name": at}, {"@type": "SportsTeam", "name": ht}]}
    if g.get("arena"): ld["location"] = {"@type": "Place", "name": g["arena"]}
    return page(title, desc, canonical(f"/game/{g['id']}.html"), body, ld)

# ---------- driver ----------
def main():
    limit = int(sys.argv[1]) if len(sys.argv) > 1 else 0  # optional: build only N players (for testing)
    (ROOT / "players").mkdir(exist_ok=True)
    (ROOT / "teams").mkdir(exist_ok=True)
    urls = ["/"]  # only crawlable URLs belong in the sitemap; SPA #hash routes collapse to "/"

    pfiles = sorted((DATA / "player").glob("*.json"))
    if limit: pfiles = pfiles[:limit]
    for i, f in enumerate(pfiles):
        p = json.load(open(f))
        (ROOT / "players" / f"{p['id']}.html").write_text(render_player(p), encoding="utf-8")
        urls.append(f"/players/{p['id']}.html")
    print(f"players: {len(pfiles)}")

    tfiles = sorted((DATA / "team").glob("*.json"))
    for f in tfiles:
        t = json.load(open(f))
        (ROOT / "teams" / f"{t['abbr']}.html").write_text(render_team(t["abbr"], t), encoding="utf-8")
        urls.append(f"/teams/{t['abbr']}.html")
    print(f"teams: {len(tfiles)}")

    # game box-score pages — the biggest long-tail SEO surface. Scoped to recent seasons for size;
    # override with GAME_SEASONS="2026,2025,..." (or "all"). Default: last 4 seasons.
    cur = META["current"]
    gs_env = os.environ.get("GAME_SEASONS", "")
    if gs_env == "all":
        game_seasons = None
    elif gs_env:
        game_seasons = set(int(x) for x in gs_env.split(","))
    else:
        game_seasons = set(range(cur - 3, cur + 1))
    (ROOT / "game").mkdir(exist_ok=True)
    ng = 0
    for idxf in sorted((DATA / "games").glob("*.json")):
        season = int(idxf.stem)
        if game_seasons is not None and season not in game_seasons:
            continue
        for row in json.load(open(idxf))["games"]:
            gf = DATA / "game" / f"{row['id']}.json"
            if not gf.exists():
                continue
            g = json.load(open(gf))
            if not g.get("box") or not (g["box"]["home"] or g["box"]["away"]):
                continue   # skip score-only games (no box) — thin for SEO
            (ROOT / "game" / f"{row['id']}.html").write_text(render_game(g), encoding="utf-8")
            urls.append(f"/game/{row['id']}.html")
            ng += 1
    print(f"game box scores: {ng}")

    loc = lambda u: (SITE_URL + u) if SITE_URL else u
    sm = ['<?xml version="1.0" encoding="UTF-8"?>',
          '<urlset xmlns="http://www.sitemap.org/schemas/sitemap/0.9">'.replace("www.sitemap.org", "www.sitemaps.org")]
    for u in urls:
        sm.append(f"  <url><loc>{esc(loc(u))}</loc></url>")
    sm.append("</urlset>")
    (ROOT / "sitemap.xml").write_text("\n".join(sm), encoding="utf-8")

    robots = f"User-agent: *\nAllow: /\nSitemap: {loc('/sitemap.xml')}\n"
    (ROOT / "robots.txt").write_text(robots, encoding="utf-8")
    print(f"sitemap.xml: {len(urls)} urls · robots.txt written")

if __name__ == "__main__":
    main()
