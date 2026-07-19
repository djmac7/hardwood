#!/usr/bin/env python3
"""Merge build/player_bio.json (BBR-sourced jersey numbers + nicknames) into the player
records: bio.num (primary/most-worn number), bio.numbers (all NBA numbers worn), bio.nickname.

Idempotent; re-run after build_data.py (which rebuilds player files from the source CSVs and
would otherwise drop these fields). Same pattern as fill_highschools.py."""
import json, os

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "..", "data")
BIO = os.path.join(HERE, "player_bio.json")

if not os.path.exists(BIO):
    print("no player_bio.json — nothing to apply"); raise SystemExit

bio = json.load(open(BIO))
n = miss = 0
for pid, info in bio.items():
    path = os.path.join(DATA, "player", pid + ".json")
    if not os.path.exists(path):
        miss += 1; continue
    d = json.load(open(path))
    b = d.setdefault("bio", {})
    if info.get("nickname"):
        b["nickname"] = info["nickname"]
    if info.get("num"):
        b["num"] = info["num"]
        nums = info.get("numbers") or [info["num"]]
        if len(nums) > 1:
            b["numbers"] = nums
    with open(path, "w") as f:
        json.dump(d, f, separators=(",", ":"), ensure_ascii=False)
    n += 1
print(f"applied bio (jersey/nickname) to {n} players · {miss} missing")
