#!/usr/bin/env python3
"""
Fold each franchise's full lineage into its modern team file so the team page
(#/team/OKC) shows the whole franchise — Seattle's seasons under Oklahoma City,
Minneapolis under the Lakers, the ABA years under the Nets/Nuggets/Pacers/Spurs, etc.

For every current franchise with predecessors, this merges the predecessors' season
rows (each tagged with the abbreviation used that season, so per-season schedule/seed
lookups still resolve) and their reconstructed rosters into the modern team file. Also
emits data/franchise_map.json (historical abbr -> modern abbr) for URL redirects.

Idempotent: seasons are keyed by year and predecessors overlay their own years, so
re-running (even on an already-merged file) yields the same result.

Run:  python3 build/build_team_lineage.py   (after individual team files are built)
"""
import json, os, glob
from lineage import LINEAGE, EARLY_CHAMPS, to_modern

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "..", "data")
TEAMDIR = os.path.join(DATA, "team")
MODERN = set(json.load(open(os.path.join(DATA, "meta.json")))["teams"])

# era-accurate franchise name per (abbr, season) and the (abbr, season) that won the title
NAME = {}
CHAMP = set()
for fp in glob.glob(os.path.join(DATA, "season", "*.json")):
    d = json.load(open(fp))
    yr = d.get("season") or int(os.path.basename(fp)[:-5])
    for t in d.get("standings", []):
        if t.get("name"):
            NAME[(t["abbr"], yr)] = t["name"]
    champ = ((d.get("champion") or {}).get("team")) or EARLY_CHAMPS.get(yr)
    if champ:
        CHAMP.add((champ, yr))


def load(ab):
    p = os.path.join(TEAMDIR, f"{ab}.json")
    return json.load(open(p)) if os.path.exists(p) else None


merged_count = 0
for modern in sorted(MODERN):
    cur = load(modern)
    if not cur:
        continue
    def tag(s, ab, name):
        s = dict(s); s["ab"] = ab
        nm = NAME.get((ab, s["season"])) or name
        if nm:
            s["nm"] = nm            # era-accurate franchise name for this season
        if (ab, s["season"]) in CHAMP:
            s["champ"] = 1          # franchise won the NBA title this season
        return s

    preds = LINEAGE.get(modern, [])
    if not preds:
        # still tag own seasons with the era abbr + name, for a uniform shape
        cur["seasons"] = [tag(s, modern, cur.get("name")) for s in cur.get("seasons", [])]
        json.dump(cur, open(os.path.join(TEAMDIR, f"{modern}.json"), "w"), separators=(",", ":"), ensure_ascii=False)
        continue

    by_year = {}          # season year -> season row (predecessors overlay their own years)
    rbs = {}              # rostersBySeason merged across the lineage
    # start with the modern era (tagged as the modern franchise)
    for s in cur.get("seasons", []):
        by_year[s["season"]] = tag(s, modern, cur.get("name"))
    rbs.update(cur.get("rostersBySeason") or {})
    # overlay each predecessor's seasons + rosters (older, non-overlapping years)
    for pred in preds:
        pf = load(pred)
        if not pf:
            continue
        for s in pf.get("seasons", []):
            by_year[s["season"]] = tag(s, pred, pf.get("name"))
        for yr, r in (pf.get("rostersBySeason") or {}).items():
            rbs.setdefault(yr, r)

    cur["seasons"] = [by_year[y] for y in sorted(by_year, reverse=True)]   # newest-first (t.seasons[0] = latest)
    cur["rostersBySeason"] = rbs
    json.dump(cur, open(os.path.join(TEAMDIR, f"{modern}.json"), "w"), separators=(",", ":"), ensure_ascii=False)
    merged_count += 1
    print(f"  {modern}: {len(cur['seasons'])} seasons ({cur['seasons'][-1]['season']}–{cur['seasons'][0]['season']}) absorbing {', '.join(preds)}")

# historical abbr -> modern franchise, for client-side URL redirects
fmap = {ab: m for ab, m in to_modern(MODERN).items() if ab not in MODERN}
json.dump(fmap, open(os.path.join(DATA, "franchise_map.json"), "w"), separators=(",", ":"), ensure_ascii=False)
print(f"merged {merged_count} franchises; wrote franchise_map.json ({len(fmap)} aliases)")
