#!/usr/bin/env python3
"""
Build per-game box scores + season game indexes + per-player recent-game logs from
the modern Kaggle NBA dataset (six-spins/data/raw2). Outputs:

  data/games/<season>.json      index: every game (date, teams, score, type) for a season
  data/game/<gameId>.json       full detail: quarter scores, both box scores, officials, arena
  data/pgames/<bbrefId>.json    a player's most-recent 25 games (profile feed), newest first

Season = END year (2026 = 2025-26), from gameDate (month>=10 -> next year).

Usage:
  python3 build/build_games.py            # current season only (fast)
  python3 build/build_games.py all        # ALL seasons (~73k games, large)
  python3 build/build_games.py 2025 2024  # specific seasons

PlayerStatistics.csv is grouped by gameId (newest first), so we stream it and flush
each game as its id changes — memory stays bounded even for the full backfill. The
per-player feed keeps the first 25 games seen (= most recent, since newest-first).
"""
import csv, json, os, sys
from collections import defaultdict

HERE = os.path.dirname(__file__)
DATA = os.path.join(HERE, "..", "data")
RAW = "/Users/d/six-spins/data/raw2"
csv.field_size_limit(1 << 24)
args = sys.argv[1:]
ALL = args == ["all"]
SEASONS = None if ALL else (set(int(x) for x in args) or {json.load(open(os.path.join(DATA, "meta.json")))["current"]})
PG_LIMIT = 100

meta = json.load(open(os.path.join(DATA, "meta.json")))
search = json.load(open(os.path.join(DATA, "search.json")))
PID = {str(e[6]): e[0] for e in search if e[6]}
NAME_ABBR = {}
for ab, t in meta["teams"].items():
    NAME_ABBR[f"{t['city']} {t['name']}".lower()] = ab
    NAME_ABBR[t["full"].lower()] = ab
def team_abbr(city, name): return NAME_ABBR.get(f"{city} {name}".lower())
def season_of(date):
    y, m = int(date[:4]), int(date[5:7]); return y + 1 if m >= 10 else y
def num(v, cast=float):
    try: return cast(v)
    except (ValueError, TypeError): return None
def i(v):
    try: return int(round(float(v)))          # CSV mixes ints ("13") and float-strings ("3.0")
    except (ValueError, TypeError): return None
def keep(s): return ALL or s in SEASONS

os.makedirs(os.path.join(DATA, "game"), exist_ok=True)
os.makedirs(os.path.join(DATA, "games"), exist_ok=True)
os.makedirs(os.path.join(DATA, "pgames"), exist_ok=True)

# ---- 1) games index (Games.csv) ----
games = {}
index = defaultdict(list)
with open(os.path.join(RAW, "Games.csv"), newline="", encoding="utf-8") as f:
    for r in csv.DictReader(f):
        s = season_of(r["gameDate"])
        if not keep(s): continue
        ha, aa = team_abbr(r["hometeamCity"], r["hometeamName"]), team_abbr(r["awayteamCity"], r["awayteamName"])
        if not ha or not aa: continue
        gid = r["gameId"]
        hs, as_ = i(r["homeScore"]), i(r["awayScore"])
        label = " · ".join(x for x in [r.get("gameLabel"), r.get("gameSubLabel")] if x)
        games[gid] = {"id": gid, "date": r["gameDate"][:10], "season": s, "type": r.get("gameType", ""),
                      "label": label, "arena": r.get("arenaName", ""), "arenaCity": r.get("arenaCity", ""),
                      "attendance": i(r.get("attendance")), "officials": r.get("officials", ""),
                      "home": {"abbr": ha, "score": hs}, "away": {"abbr": aa, "score": as_}}
        index[s].append({"id": gid, "date": r["gameDate"][:10], "type": r.get("gameType", ""), "label": label,
                         "h": ha, "hs": hs, "a": aa, "as": as_})
GID = set(games)
print(f"games: {len(GID)} across {len(index)} season(s)")

# ---- 2) team quarter lines (TeamStatistics.csv) ----
with open(os.path.join(RAW, "TeamStatistics.csv"), newline="", encoding="utf-8") as f:
    for r in csv.DictReader(f):
        g = games.get(r["gameId"])
        if not g: continue
        side = "home" if r.get("home") == "1" else "away"
        q = [i(r.get("q1Points")), i(r.get("q2Points")), i(r.get("q3Points")), i(r.get("q4Points"))]
        ot = i(r.get("otAllPoints"))
        if ot: q.append(ot)
        gs = g[side]
        gs["q"] = [x for x in q if x is not None]
        gs["fg"] = num(r.get("fieldGoalsPercentage")); gs["reb"] = i(r.get("reboundsTotal")); gs["ast"] = i(r.get("assists"))
        gs["paint"] = i(r.get("pointsInThePaint")); gs["fast"] = i(r.get("pointsFastBreak"))

# ---- 3) player box scores (stream + flush per game; PlayerStatistics is grouped, newest-first) ----
pgames = defaultdict(list)
written = 0
flushed = set()
def flush(gid, box):
    global written
    g = games.get(gid)
    if not g: return
    for side in ("home", "away"):
        box[side].sort(key=lambda x: -(x["pts"] or 0))
    g["box"] = box
    json.dump(g, open(os.path.join(DATA, "game", f"{gid}.json"), "w"), separators=(",", ":"), ensure_ascii=False)
    flushed.add(gid); written += 1
    if written % 5000 == 0: print(f"  ...{written} game files")

cur_gid, cur_box = None, {"home": [], "away": []}
with open(os.path.join(RAW, "PlayerStatistics.csv"), newline="", encoding="utf-8") as f:
    for r in csv.DictReader(f):
        gid = r["gameId"]
        if gid not in GID: continue
        if gid != cur_gid:
            if cur_gid is not None: flush(cur_gid, cur_box)
            cur_gid, cur_box = gid, {"home": [], "away": []}
        pid = PID.get(r["personId"])
        side = "home" if r.get("home") == "1" else "away"
        mins = num(r.get("numMinutes"))
        row = {"pid": pid, "name": f"{r['firstName']} {r['lastName']}".strip(),
               "min": round(mins) if mins is not None else None,
               "pts": i(r.get("points")), "reb": i(r.get("reboundsTotal")), "ast": i(r.get("assists")),
               "stl": i(r.get("steals")), "blk": i(r.get("blocks")), "tov": i(r.get("turnovers")),
               "fgm": i(r.get("fieldGoalsMade")), "fga": i(r.get("fieldGoalsAttempted")),
               "tpm": i(r.get("threePointersMade")), "tpa": i(r.get("threePointersAttempted")),
               "ftm": i(r.get("freeThrowsMade")), "fta": i(r.get("freeThrowsAttempted")),
               "pm": i(r.get("plusMinusPoints")), "start": bool(r.get("startingPosition"))}
        cur_box[side].append(row)
        if pid and mins and len(pgames[pid]) < PG_LIMIT:   # newest-first -> first 25 are most recent
            g = games[gid]
            opp = g["away"]["abbr"] if side == "home" else g["home"]["abbr"]
            us, them = g[side]["score"], g["away" if side == "home" else "home"]["score"]
            pgames[pid].append({"id": gid, "date": g["date"], "opp": opp, "home": side == "home",
                                "w": (us or 0) > (them or 0), "us": us, "them": them, "min": row["min"],
                                "pts": row["pts"], "reb": row["reb"], "ast": row["ast"], "pm": row["pm"]})
    if cur_gid is not None: flush(cur_gid, cur_box)

# games with no box-score rows (older seasons) still get a detail page: score + line, empty box
for gid, g in games.items():
    if gid in flushed: continue
    g["box"] = {"home": [], "away": []}
    json.dump(g, open(os.path.join(DATA, "game", f"{gid}.json"), "w"), separators=(",", ":"), ensure_ascii=False)
    written += 1
print(f"  filled {written - len(flushed)} score-only games (no box on record)")

# ---- 4) write season indexes + player feeds ----
for s, rows in index.items():
    rows.sort(key=lambda x: x["date"])
    json.dump({"season": s, "games": rows}, open(os.path.join(DATA, "games", f"{s}.json"), "w"),
              separators=(",", ":"), ensure_ascii=False)
for pid, rows in pgames.items():
    rows.sort(key=lambda x: x["date"], reverse=True)
    json.dump(rows[:PG_LIMIT], open(os.path.join(DATA, "pgames", f"{pid}.json"), "w"),
              separators=(",", ":"), ensure_ascii=False)
print(f"wrote {written} game files, {len(index)} season index(es), {len(pgames)} player game-logs")
