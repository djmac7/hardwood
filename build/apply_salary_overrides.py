#!/usr/bin/env python3
"""
Restore the source-verified salary corrections after a rebuild.

build/fetch_salaries.py rebuilds data/salaries.json from public open CSVs. Some of
those CSVs are inflation-adjusted (not nominal) for 2017-18 and 2020-21..2023-24, which
once inflated star salaries ~20%. Rather than trust the CSVs for those seasons, we freeze
the reconciled-against-Basketball-Reference values in build/salary-overrides.json and
re-apply them here, then recompute the derived structures. fetch_salaries.py calls this as
its last step, so re-running the pipeline can no longer re-introduce the inflation.

Overrides are keyed  pid -> { "season": salary }  and cover only the corrupted seasons.
"""
import json, os
from collections import defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "..", "data")
OVR = os.path.join(HERE, "salary-overrides.json")


def main():
    if not os.path.exists(OVR):
        print("no salary-overrides.json — nothing to apply")
        return
    sal = json.load(open(os.path.join(DATA, "salaries.json")))
    ovr = json.load(open(OVR))
    cpi = json.load(open(os.path.join(DATA, "cpi.json")))
    bp, bs = sal["byPlayer"], sal["bySeason"]

    applied = 0
    for pid, seasons in ovr.items():
        for ys, v in seasons.items():
            yr = int(ys)
            hit = False
            for pair in bp.get(pid, []):
                if pair[0] == yr:
                    if pair[1] != v:
                        pair[1] = v; applied += 1
                    hit = True
            if not hit:
                bp.setdefault(pid, []).append([yr, v]); bp[pid].sort()
            for row in bs.get(str(yr), []):
                if row[0] == pid:
                    row[3] = v
    print(f"salary overrides applied: {applied}")

    # recompute derived structures from corrected byPlayer / bySeason
    sal["careerEarn"] = {pid: sum(s for _, s in a) for pid, a in bp.items()}
    all_rows = [(pid, nm, ab, int(y), v) for y, rows in bs.items() for pid, nm, ab, v in rows]
    sal["topAllTime"] = [[p, n, a, s, v] for p, n, a, s, v in sorted(all_rows, key=lambda x: -x[4])[:60]]
    CPI, BSE = cpi["cpi"], cpi["base"]
    adj = lambda v, s: int(v * CPI[str(BSE)] / CPI[str(s)]) if CPI.get(str(s)) else v
    sal["topAllTimeReal"] = [[p, n, a, s, adj(v, s)] for p, n, a, s, v in sorted(all_rows, key=lambda x: -adj(x[4], x[3]))[:60]]
    tp, pr, pay = defaultdict(list), defaultdict(list), defaultdict(float)
    for pid, nm, ab, s, v in all_rows:
        if ab:
            pay[(ab, s)] += v
    for (ab, s), tot in pay.items():
        tp[ab].append([s, int(tot)]); pr[s].append([ab, int(tot)])
    for ab in tp:
        tp[ab].sort()
    for s in pr:
        pr[s].sort(key=lambda x: -x[1])
    sal["teamPayroll"] = tp
    sal["payrollRank"] = {str(k): v for k, v in pr.items()}
    for s in bs:
        bs[s].sort(key=lambda x: -x[3])

    json.dump(sal, open(os.path.join(DATA, "salaries.json"), "w"), separators=(",", ":"), ensure_ascii=False)
    print("rewrote data/salaries.json with overrides")


if __name__ == "__main__":
    main()
