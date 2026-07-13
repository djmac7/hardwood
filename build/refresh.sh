#!/bin/bash
# Hardwood live-data refresh. Run on an interval (launchd/cron).
#  - every run: injuries, odds, scores, standings, news  (fast, always-current)
#  - ~once a day: rosters, contracts, draft              (heavier)
# Odds need a key: `export ODDS_API_KEY=...` here or in the launchd plist.
cd "$(dirname "$0")/.." || exit 1
PY=/usr/bin/python3
LOG="build/refresh.log"
# keep the log from growing forever
[ -f "$LOG" ] && [ "$(wc -l < "$LOG")" -gt 2000 ] && tail -n 500 "$LOG" > "$LOG.tmp" && mv "$LOG.tmp" "$LOG"

echo "=== $(date '+%Y-%m-%d %H:%M') live ===" >> "$LOG"
$PY build/fetch_live.py injuries odds scores standings >> "$LOG" 2>&1
$PY build/fetch_news.py >> "$LOG" 2>&1
$PY build/write_status.py >> "$LOG" 2>&1

MARK="build/.daily-stamp"
if [ ! -f "$MARK" ] || find "$MARK" -mmin +1200 2>/dev/null | grep -q .; then
  echo "=== $(date '+%Y-%m-%d %H:%M') daily ===" >> "$LOG"
  $PY build/fetch_live.py rosters contracts draft >> "$LOG" 2>&1
  touch "$MARK"
fi
