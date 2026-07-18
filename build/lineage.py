#!/usr/bin/env python3
"""
Single source of truth for NBA franchise lineage — which historical abbreviations
(relocations, renames, and the four ABA teams that merged into the NBA) belong to
each of the 30 current franchises, and which clubs folded with no modern successor.

Imported by build_teams_table.py (aggregate franchise table) and build_team_lineage.py
(merges each franchise's full history into its modern team file). Keep changes here only.
"""

# modern franchise abbr -> historical abbrs whose history it holds (excludes the modern abbr itself)
LINEAGE = {
    "ATL": ["TRI", "MLH", "STL"],                 # Tri-Cities → Milwaukee → St. Louis → Atlanta Hawks
    "BKN": ["NJA", "NYA", "NYN", "NJN"],           # NJ Americans/NY Nets (ABA) → NY/NJ Nets → Brooklyn
    "CHA": ["CHH"],                                # 1988–2002 Hornets history reclaimed by Charlotte in 2014
    "DEN": ["DNR", "DNA"],                         # Denver Rockets/Nuggets (ABA) → Denver Nuggets
    "DET": ["FTW"],                                # Fort Wayne Pistons → Detroit
    "GSW": ["PHW", "SFW"],                         # Philadelphia → San Francisco → Golden State Warriors
    "HOU": ["SDR"],                                # San Diego Rockets → Houston
    "IND": ["INA"],                                # Indiana Pacers (ABA) → NBA
    "LAC": ["BUF", "SDC"],                         # Buffalo Braves → San Diego → LA Clippers
    "LAL": ["MNL"],                                # Minneapolis → Los Angeles Lakers
    "MEM": ["VAN"],                                # Vancouver → Memphis Grizzlies
    "NOP": ["NOH", "NOK"],                         # New Orleans/OKC Hornets → New Orleans Pelicans
    "OKC": ["SEA"],                                # Seattle SuperSonics → Oklahoma City Thunder
    "PHI": ["SYR"],                                # Syracuse Nationals → Philadelphia 76ers
    "SAC": ["ROC", "CIN", "KCO", "KCK"],           # Rochester → Cincinnati → KC-Omaha → KC → Sacramento Kings
    "SAS": ["DLC", "TEX", "SAA"],                  # Dallas/Texas Chaparrals → San Antonio Spurs (ABA → NBA)
    "UTA": ["NOJ"],                                # New Orleans Jazz → Utah Jazz
    "WAS": ["CHP", "CHZ", "BAL", "CAP", "WSB"],    # Chi Packers/Zephyrs → Baltimore → Capital → Bullets/Wizards
}

# clubs that folded with no modern successor (kept explicit so the partition is auditable)
DEFUNCT = {
    # BAA / early-NBA
    "CHS", "CLR", "DTF", "PIT", "PRO", "STB", "TRH", "WSC", "BLB", "INJ", "AND", "DNN", "INO", "SHE", "WAT",
    # ABA teams that folded (did not merge into the NBA)
    "ANA", "LAS", "UTS", "HSM", "KEN", "MNM", "MMF", "FLO", "NOB", "MMP", "MMT", "MMS",
    "OAK", "WSA", "VIR", "PTP", "MNP", "PTC", "CAR", "SSL", "SDA", "SDS",
}


# NBA/BAA champions before Finals MVP existed (1969), which the season files don't carry.
# Historically verified; builds assert each abbr is present in that season's standings.
EARLY_CHAMPS = {
    1947: "PHW", 1948: "BLB", 1949: "MNL", 1950: "MNL", 1951: "ROC", 1952: "MNL",
    1953: "MNL", 1954: "MNL", 1955: "SYR", 1956: "PHW", 1957: "BOS", 1958: "STL",
    1959: "BOS", 1960: "BOS", 1961: "BOS", 1962: "BOS", 1963: "BOS", 1964: "BOS",
    1965: "BOS", 1966: "BOS", 1967: "PHI", 1968: "BOS",
}


def to_modern(modern_abbrs):
    """Return {any abbr -> modern franchise abbr} for the given set of 30 current abbrs."""
    m = {ab: ab for ab in modern_abbrs}
    for modern, hist in LINEAGE.items():
        for h in hist:
            m[h] = modern
    return m
