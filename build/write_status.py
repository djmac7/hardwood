#!/usr/bin/env python3
"""Write data/status.json with the current UTC time. Run as the final step of
every refresh so the site can show when live data was last updated."""
import json, os, datetime

DATA = os.path.join(os.path.dirname(__file__), "..", "data")
now = datetime.datetime.now(datetime.timezone.utc).replace(microsecond=0).isoformat()
with open(os.path.join(DATA, "status.json"), "w") as f:
    json.dump({"refreshed": now}, f)
print(f"status.json -> {now}")
