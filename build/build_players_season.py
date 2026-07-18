#!/usr/bin/env python3
"""
Build data/players_season/{year}.json — per-season, per-player rows powering the
Players table's season toggle (Career ↔ a specific season). Sourced from each player
file's `log` (per-season per-game averages). One row per player per season (the
season aggregate; mid-season traded-stint duplicate rows, flag==2, are dropped).

Run:  python3 build/build_players_season.py
"""
import json, os, glob

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "..", "data")
OUT = os.path.join(DATA, "players_season")
os.makedirs(OUT, exist_ok=True)
meta = json.load(open(os.path.join(DATA, "meta.json")))

# salary per (player, season)
sal = json.load(open(os.path.join(DATA, "salaries.json")))
salmap = {}
for pid, arr in sal["byPlayer"].items():
    for y, v in arr:
        salmap[(pid, y)] = v

def pgroup(pos):
    if not pos: return None
    return {"G": "Guard", "F": "Forward", "C": "Center"}.get(pos[0].upper())

buckets = {}  # year -> [rows]
for fp in glob.glob(os.path.join(DATA, "player", "*.json")):
    try:
        d = json.load(open(fp))
    except Exception:
        continue
    pid, name = d["id"], d.get("name")
    pos = (d.get("bio") or {}).get("pos")
    pg = pgroup(pos)
    for r in d.get("log", []):
        # r = [season, league, team, age, g, mpg, fg%, 3p%, ft%, trb, ast, stl, blk, pts, per, ts, flag]
        if len(r) < 16 or r[1] != "NBA" or (len(r) > 16 and r[16] == 2):
            continue
        yr = r[0]
        buckets.setdefault(yr, []).append({
            "i": pid, "n": name, "p": pos, "pg": pg, "t": r[2],
            "age": r[3], "g": r[4], "mpg": r[5],
            "pts": r[13], "trb": r[9], "ast": r[10], "stl": r[11], "blk": r[12],
            "fg": r[6], "tp": r[7], "ft": r[8], "per": r[14], "ts": r[15],
            "sal": salmap.get((pid, yr)),
        })

total = 0
for yr, rows in buckets.items():
    rows.sort(key=lambda x: (-(x.get("pts") or 0), x.get("n") or ""))
    out = {"season": yr, "count": len(rows), "rows": rows}
    with open(os.path.join(OUT, f"{yr}.json"), "w") as f:
        json.dump(out, f, separators=(",", ":"), ensure_ascii=False)
    total += len(rows)

years = sorted(buckets, reverse=True)
print(f"wrote {len(years)} season files ({years[-1]}–{years[0]}), {total} player-seasons")
