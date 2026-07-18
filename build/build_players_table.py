#!/usr/bin/env python3
"""
Build data/players_table.json — one compact row per player powering the filterable
Players table (Linear-style). Each row carries bio + career averages + current team/salary
so the whole table can be filtered/sorted client-side without touching per-player files.

Run:  python3 build/build_players_table.py   (after player files / salaries are built)
"""
import json, os, glob

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "..", "data")
meta = json.load(open(os.path.join(DATA, "meta.json")))
CUR = meta["current"]

# current-season (or most-recent) salary per player
sal = json.load(open(os.path.join(DATA, "salaries.json")))
cur_sal = {}
for pid, arr in sal["byPlayer"].items():
    paid = [(y, v) for y, v in arr if y <= CUR]
    if paid:
        cur_sal[pid] = max(paid)[1]  # value for the latest season up to current

def inches(ht):
    try:
        f, i = ht.split("-"); return int(f) * 12 + int(i)
    except Exception:
        return None

def pgroup(pos):
    if not pos: return None
    p = pos[0].upper()
    return {"G": "Guard", "F": "Forward", "C": "Center"}.get(p)

rows = []
for fp in glob.glob(os.path.join(DATA, "player", "*.json")):
    try:
        d = json.load(open(fp))
    except Exception:
        continue
    bio, car, cur = d.get("bio") or {}, d.get("career") or {}, d.get("cur") or {}
    pid = d["id"]
    frm, to = bio.get("from"), bio.get("to")
    row = {
        "i": pid, "n": d.get("name"),
        "p": bio.get("pos"), "pg": pgroup(bio.get("pos")),
        "t": (cur.get("team") or None),
        "f": frm, "e": to,
        "yr": (to - frm + 1) if (frm and to) else None,
        "act": 1 if to == CUR else 0,
        "hof": 1 if bio.get("hof") else 0,
        "col": bio.get("college"),
        "ht": inches(bio.get("ht")), "htx": bio.get("ht"),
        "g": car.get("g"),
        "pts": car.get("pts"), "trb": car.get("trb"), "ast": car.get("ast"),
        "stl": car.get("stl"), "blk": car.get("blk"),
        "fg": car.get("fg"), "tp": car.get("tp"), "ft": car.get("ft"),
        "sal": cur_sal.get(pid),
    }
    rows.append(row)

# stable, useful default order: most career points first (stars on top)
rows.sort(key=lambda r: (-(r.get("pts") or 0), r.get("n") or ""))
out = {"season": CUR, "count": len(rows), "rows": rows}
path = os.path.join(DATA, "players_table.json")
with open(path, "w") as f:
    json.dump(out, f, separators=(",", ":"), ensure_ascii=False)
print(f"wrote {path}: {len(rows)} players, {os.path.getsize(path)//1024} KB")
