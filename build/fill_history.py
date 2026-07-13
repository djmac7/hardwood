#!/usr/bin/env python3
"""Fill the historical-champion gap (1947-1968) in meta.json's `history`, and
the projected 2025-26 MVP / ROY. Champions carry an era-accurate display name
(`champ_name`) plus a franchise abbreviation (`champ`) for the logo, so a 1950
Minneapolis Lakers title never shows as 'Los Angeles Lakers'. Franchises with no
modern continuity (1948 Baltimore Bullets) get a name and no logo.
Re-runnable / idempotent."""
import json, os

DATA = os.path.join(os.path.dirname(__file__), "..", "data")

# season-end year -> (franchise abbr for logo | None, era-accurate name | None)
# name is only set when it differs from the modern franchise name.
CHAMPS = {
    1947: ("GSW", "Philadelphia Warriors"),
    1948: (None,  "Baltimore Bullets"),          # original BAA franchise, defunct 1954
    1949: ("LAL", "Minneapolis Lakers"),
    1950: ("LAL", "Minneapolis Lakers"),
    1951: ("SAC", "Rochester Royals"),
    1952: ("LAL", "Minneapolis Lakers"),
    1953: ("LAL", "Minneapolis Lakers"),
    1954: ("LAL", "Minneapolis Lakers"),
    1955: ("PHI", "Syracuse Nationals"),
    1956: ("GSW", "Philadelphia Warriors"),
    1957: ("BOS", None),
    1958: ("ATL", "St. Louis Hawks"),
    1959: ("BOS", None), 1960: ("BOS", None), 1961: ("BOS", None), 1962: ("BOS", None),
    1963: ("BOS", None), 1964: ("BOS", None), 1965: ("BOS", None), 1966: ("BOS", None),
    1967: ("PHI", None),                          # Philadelphia 76ers
    1968: ("BOS", None),
}

# Projected 2025-26 individual awards (season already complete in the dataset:
# champion crowned, Finals MVP + DPOY set — completed here for MVP + ROY).
PROJECTED = {
    2026: {"mvp": ("Luka Dončić", "doncilu01"), "roy": ("Cooper Flagg", "flaggco01")},
}

path = os.path.join(DATA, "meta.json")
m = json.load(open(path))
champ_filled = mvp_filled = roy_filled = 0
for h in m["history"]:
    yr = h.get("season")
    if yr in CHAMPS and not h.get("champ"):
        ab, nm = CHAMPS[yr]
        h["champ"] = ab
        if nm:
            h["champ_name"] = nm
        champ_filled += 1
    p = PROJECTED.get(yr)
    if p:
        if not h.get("mvp") and p.get("mvp"):
            h["mvp"], h["mvp_id"] = p["mvp"]; mvp_filled += 1
        if not h.get("roy") and p.get("roy"):
            h["roy"], h["roy_id"] = p["roy"]; roy_filled += 1

with open(path, "w") as f:
    json.dump(m, f, separators=(",", ":"), ensure_ascii=False)
print(f"champions filled: {champ_filled} | 2026 mvp: {mvp_filled} | 2026 roy: {roy_filled}")
