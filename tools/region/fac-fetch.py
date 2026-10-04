# -*- coding: utf-8 -*-
# 데이터 압축지도 v0.10.100 — 동 현황 보강 원자료 받기(서울 열린데이터광장 · 키는 07_API키/keys.json 'seoul' 에서만 읽는다)
#   경로당(OdsnBuildingInfo · OA-15052) · 어린이집(ChildCareInfo · OA-20300 계열) · 상권변화지표-행정동(VwsmAdstrdIxQq · OA-15575) · 점포-행정동(VwsmAdstrdStorW · OA-22172)
#   py -3.12 -X utf8 tools/region/fac-fetch.py → 07_API키/out/region/fac/<서비스>.json (받은 것은 건너뜀)
import json, os, time, urllib.request
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
KB = os.path.join(os.path.dirname(ROOT), '07_API키')
OUT = os.path.join(KB, 'out', 'region', 'fac'); os.makedirs(OUT, exist_ok=True)
K = json.load(open(os.path.join(KB, 'keys.json'), encoding='utf-8-sig'))['seoul']
def get(svc, a, b):
    for i in range(5):
        try:
            j = json.loads(urllib.request.urlopen('http://openapi.seoul.go.kr:8088/%s/json/%s/%d/%d/' % (K, svc, a, b), timeout=90).read().decode('utf-8'))
            return j[svc]
        except Exception:
            time.sleep(3 + 3 * i)
    raise RuntimeError('fail %s %d' % (svc, a))
for svc in ('OdsnBuildingInfo', 'ChildCareInfo', 'VwsmAdstrdIxQq', 'VwsmAdstrdStorW'):
    fn = os.path.join(OUT, svc + '.json')
    if os.path.exists(fn): continue
    f = get(svc, 1, 1); n = f['list_total_count']; rows = []
    for a in range(1, n + 1, 1000):
        rows += get(svc, a, min(n, a + 999))['row']; time.sleep(0.1)
        if a % 50000 == 1: print(svc, a, n, flush=True)
    json.dump(rows, open(fn, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    print(svc, n, len(rows), flush=True)
