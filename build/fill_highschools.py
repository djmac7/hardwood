#!/usr/bin/env python3
"""Add bio.highSchool for players who were drafted straight out of high school
(no college). Curated + well-documented list — the player page shows the high
school in the College/From slot when there is no college. Re-runnable/idempotent."""
import json, os

DATA = os.path.join(os.path.dirname(__file__), "..", "data")

HS = {
    "garneke01": "Farragut Career Academy",
    "bryanko01": "Lower Merion",
    "onealje01": "Eau Claire",
    "mcgratr01": "Mount Zion Christian Academy",
    "harrial01": "St. Patrick",
    "lewisra02": "Alief Elsik",
    "brownkw01": "Glynn Academy",
    "chandty01": "Dominguez",
    "curryed01": "Thornwood",
    "stoudam01": "Cypress Creek",
    "jamesle01": "St. Vincent–St. Mary",
    "perkike01": "Ozen",
    "howardw01": "Southwest Atlanta Christian Academy",
    "livinsh01": "Peoria Central",
    "telfase01": "Abraham Lincoln",
    "jeffeal01": "Prentiss",
    "smithjo03": "Oak Hill Academy",
    "smithjr01": "Saint Benedict's Prep",
    "bynuman01": "St. Joseph",
    "greenge01": "Gulf Shores Academy",
    "ellismo01": "Lanier",
    "willilo02": "South Gwinnett",
    "johnsam01": "Westchester",
    "milesda01": "East St. Louis",
    "diopde01":  "Oak Hill Academy",
    "bendejo01": "Picayune Memorial",
    "malonmo01": "Petersburg",
    "dawkida01": "Maynard Evans",
    "willobi01": "Dwight Morrow",
}

n = 0
for pid, school in HS.items():
    path = os.path.join(DATA, "player", pid + ".json")
    if not os.path.exists(path):
        print("  skip (missing):", pid); continue
    d = json.load(open(path))
    d.setdefault("bio", {})["highSchool"] = school
    with open(path, "w") as f:
        json.dump(d, f, separators=(",", ":"), ensure_ascii=False)
    n += 1
print(f"high schools set on {n} players")
