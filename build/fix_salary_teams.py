#!/usr/bin/env python3
"""
Backfill missing team attribution in data/salaries.json from the player logs.

The upstream salary sources only carry team names for 2000–2020 and the manually
topped-up current seasons; the middle years (2021–2024) fall back to a team-less
source, so ~100 player-seasons each land with team=None and silently drop out of the
team-payroll totals (2024 alone was missing ~$700M). Every player log already records
the season's team, so this fills the gaps from that stint-accurate data and recomputes
teamPayroll / payrollRank so team totals reflect everyone who actually played there.

Runs on published data only (data/salaries.json + data/player/*.json) — no raw sources.
Idempotent. Re-run after any salary or player-data rebuild.

NOTE: this fixes ATTRIBUTION (which team a salary counts toward). It does NOT model cap
mechanics — a waived / bought-out / stretched player's full nominal salary still counts
toward his final team, so a team total is a nominal sum of its players' salaries, not a
cap-sheet figure. That's a property of the source data, surfaced honestly in the UI.
"""
import json, os, glob, re
from collections import defaultdict

HERE = os.path.dirname(__file__)
DATA = os.path.join(HERE, "..", "data")
SAL = os.path.join(DATA, "salaries.json")
MULTI = re.compile(r"^\d+TM$")
NON_TEAM = {"NBA", "ABA", "BAA", "TOT", ""}

# pid -> season(int) -> primary team (the team with the most games that season)
primary = {}
for f in glob.glob(os.path.join(DATA, "player", "*.json")):
    d = json.load(open(f))
    pid = d.get("id")
    best = {}
    for r in d.get("log", []):
        season, team, g = int(r[0]), r[2], (r[4] or 0)
        if not team or MULTI.match(str(team)) or team in NON_TEAM:
            continue
        if season not in best or g > best[season][1]:
            best[season] = (team, g)
    if best:
        primary[pid] = {s: t for s, (t, g) in best.items()}

sal = json.load(open(SAL))
by_season = sal["bySeason"]              # season(str) -> [[pid, name, team, salary], ...]

filled = still_missing = 0
for season, rows in by_season.items():
    yr = int(season)
    for r in rows:
        if not r[2]:                      # team is None/empty
            pid = r[0]
            t = primary.get(pid, {}).get(yr) if pid else None
            if t:
                r[2] = t
                filled += 1
            else:
                still_missing += 1

# keep topAllTime lists consistent (team at index 2; season at index 3)
for key in ("topAllTime", "topAllTimeReal"):
    for r in sal.get(key, []):
        if not r[2] and r[0]:
            t = primary.get(r[0], {}).get(int(r[3]))
            if t:
                r[2] = t

# recompute team totals from the (now better-attributed) per-player rows
team_pay = defaultdict(int)               # (ab, season) -> total
for season, rows in by_season.items():
    for r in rows:
        if r[2]:
            team_pay[(r[2], int(season))] += r[3]

team_payroll = defaultdict(list)
for (ab, s), tot in team_pay.items():
    team_payroll[ab].append([s, int(tot)])
for ab in team_payroll:
    team_payroll[ab].sort()

payroll_rank = defaultdict(list)
for (ab, s), tot in team_pay.items():
    payroll_rank[s].append([ab, int(tot)])
for s in payroll_rank:
    payroll_rank[s].sort(key=lambda x: -x[1])

sal["teamPayroll"] = team_payroll
sal["payrollRank"] = {str(s): v for s, v in payroll_rank.items()}
sal["note"] = ("Nominal salaries (not inflation-adjusted). Merged from public open datasets; "
               "team attribution backfilled from player logs. Team totals are nominal sums of "
               "each player's salary — a waived or bought-out player still counts toward his "
               "final team, so a total is not a cap-sheet figure.")

json.dump(sal, open(SAL, "w"), separators=(",", ":"), ensure_ascii=False)
print(f"filled {filled} missing team attributions · {still_missing} still unattributed "
      f"(no pid / no log season) · recomputed {len(team_payroll)} teams")
