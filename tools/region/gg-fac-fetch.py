# -*- coding: utf-8 -*-
# 데이터 압축지도 v0.10.102 — 경기 어린이집(ChildHouse)·유치원(Kndrgrschoolstus) 받기(경기데이터드림 OpenAPI · 키는 07_API키/keys.json 'gyeonggi' 에서만)
#   ⚠ 경기 OpenAPI 는 브라우저 User-Agent 가 아니면 「보안 정책에 의해 차단」 HTML 을 준다.
import json, os, time, urllib.request
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
KB = os.path.join(os.path.dirname(ROOT), '07_API키'); OUT = os.path.join(KB, 'out', 'region', 'fac'); os.makedirs(OUT, exist_ok=True)
K = json.load(open(os.path.join(KB, 'keys.json'), encoding='utf-8-sig'))['gyeonggi']
UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36'
def get(svc, i, n):
    for t in range(5):
        try:
            d = json.loads(urllib.request.urlopen(urllib.request.Request('https://openapi.gg.go.kr/%s?KEY=%s&Type=json&pIndex=%d&pSize=%d' % (svc, K, i, n), headers={'User-Agent': UA}), timeout=90).read().decode('utf-8'))
            return d[svc]
        except Exception:
            time.sleep(3 + 3 * t)
    raise RuntimeError(svc)
for svc in ('ChildHouse', 'Kndrgrschoolstus'):
    fn = os.path.join(OUT, 'gg_' + svc + '.json')
    if os.path.exists(fn): continue
    tot = get(svc, 1, 1)[0]['head'][0]['list_total_count']; rows = []
    for i in range(1, tot // 1000 + 2):
        d = get(svc, i, 1000); rows += d[1]['row'] if len(d) > 1 else []; time.sleep(0.2)
    json.dump(rows, open(fn, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':')); print(svc, tot, len(rows), flush=True)
