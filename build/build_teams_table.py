#!/usr/bin/env python3
"""
Build data/teams_table.json — ONE row per current franchise (30 rows). Every historical
incarnation (relocations, renames, and the four ABA teams that merged into the NBA) is
absorbed into the modern franchise that officially holds its history. Franchises that
folded with no modern successor are dropped (and logged).

Aggregates the full lineage: seasons played, NBA championships, all-time W-L, playoff
appearances, best regular season. Championships are NBA titles only (ABA titles are not
NBA championships, matching official league records).

Run:  python3 build/build_teams_table.py
"""
import json, os, glob
from lineage import DEFUNCT, EARLY_CHAMPS, to_modern

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "..", "data")
meta = json.load(open(os.path.join(DATA, "meta.json")))
TEAMS = meta["teams"]
MODERN = set(TEAMS)
TO_MODERN = to_modern(MODERN)

agg = {ab: {"seasons": 0, "w": 0, "l": 0, "titles": 0, "po": 0, "found": 9999,
            "bestW": -1, "bestL": 0, "bestY": None, "titleYears": []} for ab in MODERN}
seen = set()
for fp in sorted(glob.glob(os.path.join(DATA, "season", "*.json"))):
    d = json.load(open(fp))
    yr = d.get("season") or int(os.path.basename(fp)[:-5])
    champ = ((d.get("champion") or {}).get("team")) or EARLY_CHAMPS.get(yr)
    if champ and champ not in {t["abbr"] for t in d.get("standings", [])}:
        raise SystemExit(f"champion {champ!r} not in {yr} standings")
    for t in d.get("standings", []):
        ab = t["abbr"]; seen.add(ab)
        if ab not in TO_MODERN:
            if ab in DEFUNCT:
                continue
            raise SystemExit(f"unclassified franchise abbr {ab!r} ({t.get('name')}, {yr}) — add to LINEAGE or DEFUNCT")
        m = TO_MODERN[ab]
        a = agg[m]
        w, l = t.get("w") or 0, t.get("l") or 0
        a["seasons"] += 1; a["w"] += w; a["l"] += l
        a["found"] = min(a["found"], yr)
        if t.get("po"): a["po"] += 1
        if w > a["bestW"]: a["bestW"], a["bestL"], a["bestY"] = w, l, yr
        if champ == ab:
            a["titles"] += 1; a["titleYears"].append(yr)

# assert full, disjoint partition of every abbr that appears in the data
unclassified = [ab for ab in seen if ab not in TO_MODERN and ab not in DEFUNCT]
if unclassified:
    raise SystemExit(f"unclassified abbrs: {unclassified}")

rows = []
for ab, a in agg.items():
    info = TEAMS[ab]
    tot = a["w"] + a["l"]
    rows.append({
        "i": ab, "n": info.get("full") or f'{info.get("city","")} {info.get("name","")}'.strip(),
        "conf": info.get("conf"), "found": a["found"], "seasons": a["seasons"],
        "titles": a["titles"], "lastTitle": (max(a["titleYears"]) if a["titleYears"] else None),
        "w": a["w"], "l": a["l"], "pct": round(a["w"] / tot, 3) if tot else None,
        "po": a["po"], "bestW": a["bestW"], "bestL": a["bestL"], "bestY": a["bestY"],
    })
rows.sort(key=lambda r: (-(r["pct"] or 0), -r["titles"]))
out = {"count": len(rows), "rows": rows}
path = os.path.join(DATA, "teams_table.json")
with open(path, "w") as f:
    json.dump(out, f, separators=(",", ":"), ensure_ascii=False)
dropped = sorted(ab for ab in seen if ab in DEFUNCT)
print(f"wrote {path}: {len(rows)} franchises, {os.path.getsize(path)//1024} KB")
print(f"dropped {len(dropped)} defunct (no modern successor): {', '.join(dropped)}")
