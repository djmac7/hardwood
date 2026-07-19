#!/usr/bin/env python3
"""Precompute data/thisday.json — "On this day in NBA history" for the home page.

For every calendar day, find the most notable games played on that date across all seasons.
If a date has none (the offseason runs ~July–Sept), widen outward to the nearest dates so the
card is never empty — in July that surfaces mid-June Finals classics, labelled "around this
time of year". Prefers games we have a full box score for (so the link opens a real box).

Output: {"MM-DD": {"exact": bool, "games": [{id,date,h,hs,a,as,type,label,box}]}}
"""
import json, os, glob
from datetime import date

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "..", "data")
HAVE_BOX = {os.path.basename(f)[:-5] for f in glob.glob(os.path.join(DATA, "game", "*.json"))}

def weight(g):
    t = (g.get("type") or "").lower()
    lab = (g.get("label") or "").lower()
    w = 0
    if "final" in t or "finals" in lab: w += 100
    elif "conference" in lab or "semis" in lab: w += 60
    elif "playoff" in t or "round" in lab or "play-in" in lab: w += 40
    elif "regular" in t: w += 10
    else: w += 2                       # preseason / exhibition
    if g["id"] in HAVE_BOX: w += 25    # viewable box score
    try:
        tot = (g.get("hs") or 0) + (g.get("as") or 0)
        diff = abs((g.get("hs") or 0) - (g.get("as") or 0))
        if g.get("hs") and g.get("as"):
            if diff <= 3: w += 8       # nail-biter
            if tot >= 260: w += 5      # shootout
    except Exception:
        pass
    return w

# index every game by (month, day)
by_md = {}
for f in glob.glob(os.path.join(DATA, "games", "*.json")):
    d = json.load(open(f))
    for g in d.get("games", []):
        dt = g.get("date", "")
        if len(dt) != 10:
            continue
        md = dt[5:]
        rec = {"id": g["id"], "date": dt, "h": g.get("h"), "hs": g.get("hs"), "a": g.get("a"),
               "as": g.get("as"), "type": g.get("type"), "label": g.get("label"), "box": g["id"] in HAVE_BOX}
        by_md.setdefault(md, []).append(rec)

def md_of(n):  # day-number 0..365 -> "MM-DD" (2001 = non-leap reference year)
    d = date(2001, 1, 1).toordinal() + n
    return date.fromordinal(d).strftime("%m-%d")

order = [md_of(n) for n in range(365)]
pos = {md: i for i, md in enumerate(order)}

out = {}
for md in order:
    exact = sorted(by_md.get(md, []), key=weight, reverse=True)
    if len(exact) >= 3:
        # dedupe to distinct seasons for variety, keep top 4
        seen, picks = set(), []
        for g in exact:
            yr = g["date"][:4]
            if yr in seen: continue
            seen.add(yr); picks.append(g)
            if len(picks) == 4: break
        out[md] = {"exact": True, "games": picks or exact[:4]}
        continue
    # offseason / sparse day: widen outward until we find notable games
    best = list(exact)
    for r in range(1, 46):
        for step in (r, -r):
            nb = by_md.get(order[(pos[md] + step) % 365], [])
            best += nb
        if len([g for g in best if weight(g) >= 40]) >= 3:
            break
    best = sorted(best, key=weight, reverse=True)
    seen, picks = set(), []
    for g in best:
        if g["id"] in seen: continue
        seen.add(g["id"]); picks.append(g)
        if len(picks) == 4: break
    out[md] = {"exact": len(exact) > 0, "games": picks}

json.dump(out, open(os.path.join(DATA, "thisday.json"), "w"), separators=(",", ":"), ensure_ascii=False)
exact_days = sum(1 for v in out.values() if v["exact"])
print(f"thisday.json: {len(out)} days · {exact_days} with same-date games · "
      f"{sum(len(v['games']) for v in out.values())} game refs")
