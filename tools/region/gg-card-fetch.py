# -*- coding: utf-8 -*-
# 데이터 압축지도 v0.10.103 — 경기 행정동 카드 매출(경기데이터드림 TB25BPTCARDDONGM — 기준연월·행정동·중분류업종·매출금액 · 175만 줄)
#   키 = 07_API키/keys.json 'gyeonggi' · 브라우저 User-Agent 필요 · 1,000줄씩 페이지(받은 쪽은 건너뜀)
import json, os, sys, time, urllib.request
from concurrent.futures import ThreadPoolExecutor
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
KB = os.path.join(os.path.dirname(ROOT), '07_API키'); OUT = os.path.join(KB, 'out', 'region', 'ggcard'); os.makedirs(OUT, exist_ok=True)
K = json.load(open(os.path.join(KB, 'keys.json'), encoding='utf-8-sig'))['gyeonggi']
UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36'
SVC = sys.argv[1] if len(sys.argv) > 1 else 'TB25BPTCARDDONGM'
def get(i, n=1000):
    for t in range(6):
        try:
            d = json.loads(urllib.request.urlopen(urllib.request.Request('https://openapi.gg.go.kr/%s?KEY=%s&Type=json&pIndex=%d&pSize=%d' % (SVC, K, i, n), headers={'User-Agent': UA}), timeout=120).read().decode('utf-8'))
            return d[SVC]
        except Exception:
            time.sleep(3 + 4 * t)
    return None
def page(i):
    fn = os.path.join(OUT, '%s_%05d.json' % (SVC, i))
    if os.path.exists(fn): return 1
    d = get(i)
    if not d: return 0
    rows = d[1]['row'] if len(d) > 1 else []
    json.dump([[r[k] for k in r] for r in rows], open(fn, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    if i == 1: json.dump(list(rows[0].keys()), open(os.path.join(OUT, SVC + '_cols.json'), 'w'))
    return 1
tot = get(1, 1)[0]['head'][0]['list_total_count']; N = tot // 1000 + 1
page(1)
with ThreadPoolExecutor(4) as ex: ok = sum(ex.map(page, range(1, N + 1)))
print(SVC, tot, 'pages', N, 'ok', ok, flush=True)
