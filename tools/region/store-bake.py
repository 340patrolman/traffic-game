# -*- coding: utf-8 -*-
# 데이터 압축지도 「지역 자료」 — 서울 상가 점포 하나하나(v0.10.93 · 소유자 「상용 상권분석 프로그램만큼의 퍼포먼스」)
#   py -3.12 -X utf8 tools/region/store-bake.py fetch   → 07_API키/out/region/stores_<구>.json (받은 구는 건너뛴다)
#   py -3.12 -X utf8 tools/region/store-bake.py build   → data/r/<구>/stores.json + data/r/stores-index.json(업종 대·중·소 분류표)
# 소상공인시장진흥공단 상가(상권)정보 OpenAPI(공공데이터포털 · storeListInDong · divId=signguCd) — 키는 07_API키/keys.json 의 data_go_kr.
# 점포마다 [x, y(그 구 상자의 남서 끝에서 m), 소분류 번호, 층, 상호(지점)] — 영업 여부·매출은 이 자료에 없다(등록 정보 · 기준 연월은 stdrYm).
import json, os, sys, time, urllib.request, urllib.parse
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
KB = os.path.join(os.path.dirname(ROOT), '07_API키')
OUT = os.path.join(KB, 'out', 'region'); os.makedirs(OUT, exist_ok=True)
K = json.load(open(os.path.join(KB, 'keys.json'), encoding='utf-8-sig'))['data_go_kr']
API = 'https://apis.data.go.kr/B553077/api/open/sdsc2/storeListInDong'
GUS = ['11110', '11140', '11170', '11200', '11215', '11230', '11260', '11290', '11305', '11320', '11350', '11380', '11410', '11440', '11470', '11500', '11530', '11545', '11560', '11590', '11620', '11650', '11680', '11710', '11740']
KX, KY = 88800, 111000   # 서울 위도 평면 근사(지도와 같은 값)

def page(gu, n):
    q = urllib.parse.urlencode({'divId': 'signguCd', 'key': gu, 'numOfRows': 1000, 'pageNo': n, 'type': 'json'})
    for i in range(5):
        try:
            j = json.loads(urllib.request.urlopen(API + '?serviceKey=' + K + '&' + q, timeout=120).read().decode('utf-8'))
            return j
        except Exception as e:
            time.sleep(3 + i * 3)
    raise RuntimeError('page fail %s %d' % (gu, n))

def fetch():
    for gu in GUS:
        fn = os.path.join(OUT, 'stores_%s.json' % gu)
        if os.path.exists(fn): continue
        j = page(gu, 1); tot = j['body']['totalCount']; ym = j['header'].get('stdrYm'); items = j['body']['items']
        for n in range(2, tot // 1000 + 2):
            items += page(gu, n)['body']['items']; time.sleep(0.2)
        rows = [[s['bizesId'], s['bizesNm'], s.get('brchNm') or '', s['indsLclsCd'], s['indsLclsNm'], s['indsMclsCd'], s['indsMclsNm'], s['indsSclsCd'], s['indsSclsNm'],
                 s.get('lon'), s.get('lat'), s.get('flrNo') or '', s.get('bldNm') or '', s.get('adongCd') or ''] for s in items]
        json.dump({'gu': gu, 'stdrYm': ym, 'total': tot, 'rows': rows}, open(fn, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
        print('stores', gu, tot, len(rows), ym, flush=True)

def build():
    cls = {}   # 소분류 코드 → [대 코드, 대 이름, 중 코드, 중 이름, 소 이름]
    data = {}
    for gu in GUS:
        fn = os.path.join(OUT, 'stores_%s.json' % gu)
        if not os.path.exists(fn): print('없음', gu); continue
        data[gu] = json.load(open(fn, encoding='utf-8'))
        for r in data[gu]['rows']: cls.setdefault(r[7], [r[3], r[4], r[5], r[6], r[8]])
    codes = sorted(cls); ix = {c: i for i, c in enumerate(codes)}
    os.makedirs(os.path.join(ROOT, 'data', 'r'), exist_ok=True)
    idx = []
    for gu, d in data.items():
        seen, pts = set(), []
        lons = [r[9] for r in d['rows'] if r[9]]; lats = [r[10] for r in d['rows'] if r[10]]
        lo0, la0 = round(min(lons), 4) - 0.0001, round(min(lats), 4) - 0.0001
        for r in d['rows']:
            if r[0] in seen or not r[9] or not r[10]: continue
            seen.add(r[0])
            nm = r[1] + (' ' + r[2] if r[2] else '')
            pts.append([round((r[9] - lo0) * KX), round((r[10] - la0) * KY), ix[r[7]], r[11], nm])
        pth = os.path.join(ROOT, 'data', 'r', gu, 'stores.json'); os.makedirs(os.path.dirname(pth), exist_ok=True)
        json.dump({'schema': 'tg-stores/2', 'gu': gu, 'stdrYm': d['stdrYm'], 'o': [lo0, la0], 'k': [KX, KY], 'pts': pts}, open(pth, 'w', encoding='utf-8', newline='\n'), ensure_ascii=False, separators=(',', ':'))
        idx.append([gu, len(pts), os.path.getsize(pth)]); print(gu, len(pts), os.path.getsize(pth))
    json.dump({'schema': 'tg-storeidx/1', 'baked': time.strftime('%Y-%m-%d'), 'stdrYm': next(iter(data.values()))['stdrYm'] if data else '',
               'source': '소상공인시장진흥공단 상가(상권)정보(공공데이터포털 OpenAPI storeListInDong) — 등록된 상가업소 · 영업 여부·매출은 담지 않는다',
               'fields': '[x m, y m(그 구 파일의 o = 남서 끝 경위도에서 · k = m/도), 소분류 번호, 층, 상호(지점)]',
               'cls': [cls[c] + [c] for c in codes], 'gus': idx},
              open(os.path.join(ROOT, 'data', 'r', 'stores-index.json'), 'w', encoding='utf-8', newline='\n'), ensure_ascii=False, separators=(',', ':'))
    rp = os.path.join(ROOT, 'data', 'r', 'index.json'); R = json.load(open(rp, encoding='utf-8')); m = {x[0]: x for x in idx}
    for g in R['gus']:
        if g['gu'] in m: g['bytes']['stores'] = m[g['gu']][2]; g['nstores'] = m[g['gu']][1]
    R['layers']['stores'] = '상가 점포(소상공인 상가정보) — 반경 분석·경쟁점'
    json.dump(R, open(rp, 'w', encoding='utf-8', newline='\n'), ensure_ascii=False, separators=(',', ':'))
    print('total', sum(x[1] for x in idx), sum(x[2] for x in idx), 'cls', len(codes))

if __name__ == '__main__':
    (fetch if (sys.argv[1:] or ['build'])[0] == 'fetch' else build)()
