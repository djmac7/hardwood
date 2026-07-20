#!/usr/bin/env python3
"""Stamp each player's ALL-TIME career rank onto their record (d["ranks"]), for the rank badges
on the player page ("1st all-time · Points"). Ranks are over career totals (ctot); only the top
150 in a category are kept so a badge always means genuine all-time standing. Re-runnable."""
import json, os, glob

DATA = os.path.join(os.path.dirname(__file__), "..", "data")
# counting categories where a high total is an honour (skip turnovers)
CATS = ["pts", "trb", "ast", "stl", "blk", "x3p", "g", "ws"]
TOPN = 150

players = {}
for f in glob.glob(os.path.join(DATA, "player", "*.json")):
    d = json.load(open(f))
    players[d["id"]] = d

rank = {c: {} for c in CATS}
for c in CATS:
    vals = [(pid, (d.get("ctot") or {}).get(c)) for pid, d in players.items()]
    vals = [(pid, v) for pid, v in vals if isinstance(v, (int, float)) and v > 0]
    vals.sort(key=lambda x: -x[1])
    for i, (pid, v) in enumerate(vals[:TOPN]):
        rank[c][pid] = i + 1

n = 0
for pid, d in players.items():
    r = {c: rank[c][pid] for c in CATS if pid in rank[c]}
    if r:
        d["ranks"] = r
        with open(os.path.join(DATA, "player", pid + ".json"), "w") as fh:
            json.dump(d, fh, separators=(",", ":"), ensure_ascii=False)
        n += 1
    elif "ranks" in d:                      # player fell out of top-150 on a rebuild — clear it
        d.pop("ranks")
        with open(os.path.join(DATA, "player", pid + ".json"), "w") as fh:
            json.dump(d, fh, separators=(",", ":"), ensure_ascii=False)
print(f"stamped all-time ranks on {n} players (top {TOPN} per category: {', '.join(CATS)})")
