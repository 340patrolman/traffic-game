# -*- coding: utf-8 -*-
# 데이터 압축지도 v0.10.103 — 다발지 10년을 서울·경기 전체로(도로교통공단 교통사고정보 개방시스템 다발지역 OpenAPI frequentzone)
#   py -3.12 -X utf8 tools/region/hot10-bake.py fetch → 07_API키/out/region/hot10/<갈래>_<해>_<시도><시군구>.json (받은 것은 건너뜀)
#   py -3.12 -X utf8 tools/region/hot10-bake.py build → data/r/<구>/hot10.json (서초는 기존 data/hot10-seocho.json 이 맡는다)
#   키 = 07_API키/keys.json 'koroad' · ⚠ 브라우저 User-Agent 가 없으면 「Request Blocked」 400
#   같은 자리(120m 안)의 여러 해·여러 갈래를 한 점으로 묶는다(서초 판과 같은 규칙) · 점은 그 자리가 든 시군구 경계(SGIS)로 나눈다
import json, os, sys, time, math, urllib.request, collections, importlib.util
from concurrent.futures import ThreadPoolExecutor
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
KB = os.path.join(os.path.dirname(ROOT), '07_API키'); OUT = os.path.join(KB, 'out', 'region', 'hot10b'); os.makedirs(OUT, exist_ok=True)
K = json.load(open(os.path.join(KB, 'keys.json'), encoding='utf-8-sig'))['koroad']
UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36'
TYPES = {'pedstrians': '보행자', 'oldman': '보행노인', 'child': '보행어린이', 'bicycle': '자전거', 'motorcycle': '이륜차', 'truck': '화물차', 'lg': '지자체별', 'freezing': '결빙'}
YEARS = range(2016, 2026)
SEOUL = ['110', '140', '170', '200', '215', '230', '260', '290', '305', '320', '350', '380', '410', '440', '470', '500', '530', '545', '560', '590', '620', '650', '680', '710', '740']
GG = ['110', '111', '113', '115', '117', '130', '131', '133', '135', '150', '170', '171', '173', '190', '192', '194', '195', '196', '197', '199', '210', '220', '250', '270', '271', '273', '280', '281', '285', '287', '290', '310', '360', '370', '390', '410', '430', '450', '460', '461', '463', '465', '480', '500', '550', '570', '590', '591', '593', '595', '597', '610', '630', '650', '670', '800', '820', '830']

def one(t, y, sd, gg):
    fn = os.path.join(OUT, '%s_%d_%s%s.json' % (t, y, sd, gg))
    if os.path.exists(fn): return 0
    items = []; page = 1
    while True:
        u = 'https://opendata.koroad.or.kr/data/rest/frequentzone/%s?authKey=%s&searchYearCd=%d&siDo=%s&guGun=%s&type=json&numOfRows=100&pageNo=%d' % (t, K, y, sd, gg, page)
        for i in range(4):
            try:
                d = json.loads(urllib.request.urlopen(urllib.request.Request(u, headers={'User-Agent': UA}), timeout=60).read().decode('utf-8')); break
            except Exception:
                time.sleep(2 + 3 * i); d = None
        if d is None: return -1
        it = (d.get('items') or {}).get('item') or []
        items += it
        if len(it) < 100: break
        page += 1
    json.dump(items, open(fn, 'w', encoding='utf-8'), ensure_ascii=False); time.sleep(0.6); return len(items)

def fetch():
    jobs = [(t, y, '11', g) for t in TYPES for y in YEARS for g in SEOUL] + [(t, y, '41', g) for t in TYPES for y in YEARS for g in GG]
    with ThreadPoolExecutor(1) as ex:   # 8개 동시에 부르면 서버가 이 PC 를 한동안 막는다(2026-10-04 · 21초 무응답)
        res = list(ex.map(lambda a: one(*a), jobs))
    print('jobs', len(jobs), 'items', sum(r for r in res if r > 0), 'fail', sum(1 for r in res if r < 0))

def build():
    from shapely.geometry import shape, Point
    from shapely.strtree import STRtree
    sp = importlib.util.spec_from_file_location('db', os.path.join(ROOT, 'tools', 'region', 'dong-bake.py')); DB = importlib.util.module_from_spec(sp); sp.loader.exec_module(DB)
    feats, _ = DB.seoul_gus(); gs = [shape(f['geometry']) for f in feats]; tr = STRtree(gs)
    def gu_of(lon, lat):
        q = Point(lon, lat)
        for i in tr.query(q):
            if gs[i].contains(q): return feats[i]['properties']['sgg']
        return None
    recs = []
    for fn in os.listdir(OUT):
        t, y = fn.split('_')[0], int(fn.split('_')[1])
        for it in json.load(open(os.path.join(OUT, fn), encoding='utf-8')):
            try: lo, la = float(it['lo_crd']), float(it['la_crd'])
            except (KeyError, TypeError, ValueError): continue
            recs.append((lo, la, it.get('spot_nm', ''), TYPES[t], y, it.get('occrrnc_cnt', 0), it.get('caslt_cnt', 0), it.get('dth_dnv_cnt', 0), it.get('se_dnv_cnt', 0), it.get('sl_dnv_cnt', 0)))
    seen = set(); uniq = []
    for r in recs:   # 같은 갈래·같은 해·같은 자리(예: 옛 부천 190 과 새 192 가 같은 점을 줄 때)는 한 번만
        k = (r[3], r[4], round(r[0], 5), round(r[1], 5))
        if k not in seen: seen.add(k); uniq.append(r)
    G = collections.defaultdict(list)
    for r in uniq:
        gu = gu_of(r[0], r[1])
        if gu and gu != '11650': G[gu].append(r)
    rp = os.path.join(ROOT, 'data', 'r', 'index.json'); R = json.load(open(rp, encoding='utf-8')); gb = {}; tot = 0
    for gu, rs in G.items():
        spots = []
        for r in sorted(rs, key=lambda r: r[4]):
            for s in spots:
                if math.hypot((s['lo'] - r[0]) * 88800, (s['la'] - r[1]) * 111000) < 120: s['rec'].append([r[3], r[4], r[5], r[6], r[7], r[8], r[9]]); break
            else: spots.append({'n': r[2], 'lo': round(r[0], 6), 'la': round(r[1], 6), 'rec': [[r[3], r[4], r[5], r[6], r[7], r[8], r[9]]]})
        doc = {'schema': 'tg-hot10/1', 'gu': gu, 'source': '도로교통공단 교통사고정보 개방시스템 다발지역 OpenAPI(frequentzone — 보행자·보행노인·보행어린이·자전거·이륜차·화물차·결빙·지자체별) · 공표 2016~2025 · %s 수집' % time.strftime('%Y-%m-%d'),
               'note': '같은 자리(120m 안)의 여러 해·여러 갈래를 한 점으로 묶었다. 공표 연도는 그 해 기준 다발지 선정(앞 해 사고 자료) — 「선정 안 됨」이 사고 0건은 아니다.', 'spots': spots}
        fn = os.path.join(ROOT, 'data', 'r', gu, 'hot10.json'); os.makedirs(os.path.dirname(fn), exist_ok=True)
        json.dump(doc, open(fn, 'w', encoding='utf-8', newline='\n'), ensure_ascii=False, separators=(',', ':')); gb[gu] = os.path.getsize(fn); tot += len(spots)
    for g in R['gus']:
        if g['gu'] in gb: g.setdefault('bytes', {})['hot10'] = gb[g['gu']]
    R['layers']['hot10'] = '다발지 10년(도로교통공단 다발지역 공표 2016~2025)'
    json.dump(R, open(rp, 'w', encoding='utf-8', newline='\n'), ensure_ascii=False, separators=(',', ':'))
    print('records', len(recs), 'uniq', len(uniq), 'gus', len(gb), 'spots', tot, 'bytes', sum(gb.values()))

if __name__ == '__main__':
    (fetch if (sys.argv[1:] or ['build'])[0] == 'fetch' else build)()
