# -*- coding: utf-8 -*-
# 🚏 양재역 정밀 구역(1:1) 남쪽으로 두 줄 — 매헌로 · 양재대로 (v0.10.113 · 소유자 「권고대로 진행」 — 매헌시민의숲 중앙 정류장 넷)
#  기존 지도(격자 4줄·도로 자리·건물·정류장·사고 재현·교차로 이름)는 그대로 두고 남쪽만 더한다.
#  · 강남대로·논현로·342번길 형상: 기존 자료 끝(z) 너머만 새 OSM 으로 이어 붙인다(기존 점은 안 건드린다).
#  · 새 가로 도로 둘: 40m 칸 중앙값(sadang_build.py 와 같은 식) · 차로 수 설계값.
#  · 정류장 넷: 서울시 정류소 위치(중앙차로) · 교통카드 2026.6 승하차 · 노선 = 경기(10/7) ∪ OSM 관계(근사).
#  · 기존 정류장 s 를 새 변환으로 다시 재서 1m 넘게 바뀌면 멈춘다(북쪽이 흔들리면 안 된다).
#   py -3.12 -X utf8 tools/maps/yangjae_extend.py
import json, math, os, csv, statistics, collections, sys
G = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))); KB = os.path.dirname(G); D = os.path.join(G, 'data', 'maps')
OSMD = os.path.join(KB, '07_API키', 'out', 'osm_yangjae_s'); osm = json.load(open(os.path.join(OSMD, 'osm.json'), encoding='utf-8'))
M = json.load(open(os.path.join(D, 'yangjae-1to1.json'), encoding='utf-8')); RJ = json.load(open(os.path.join(D, 'yangjae-1to1-roads.json'), encoding='utf-8')); BJ = json.load(open(os.path.join(D, 'yangjae-1to1-buildings.json'), encoding='utf-8'))
if len(M['grid']['zs']) != 4: sys.exit('이미 늘린 지도다 — 원본(git) 으로 되돌린 뒤 돌릴 것')
W84 = M['wgs84']
def T(lat, lon): u, w = lon - W84['lon0'], lat - W84['lat0']; return (W84['x'][0] * u + W84['x'][1] * w + W84['x'][2], W84['z'][0] * u + W84['z'][1] * w + W84['z'][2])
def dense(pts, step=10):
    out = []
    for a, b in zip(pts, pts[1:]):
        d = math.hypot(b[0] - a[0], b[1] - a[1]); n = max(1, int(d // step))
        for k in range(n): t = k / n; out.append((a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t))
    if pts: out.append(pts[-1])
    return out
def binned(names, hws, ax, lo=-1e9, hi=1e9):
    pts = []
    for r in osm['roads']:
        if r['name'] in names and r['hw'] in hws: pts += dense([T(p[0], p[1]) for p in r['pts']])
    along = 1 if ax == 'v' else 0; cross = 1 - along
    bins = collections.defaultdict(list)
    for p in pts:
        if lo <= p[along] <= hi: bins[int(math.floor(p[along] / 40 + 0.5))].append(p[cross])
    rows = sorted((k * 40, statistics.median(v)) for k, v in bins.items() if len(v) >= 2)
    sm = []
    for i, (s, v) in enumerate(rows):
        nb = [rows[j][1] for j in range(max(0, i - 2), min(len(rows), i + 3))]
        if abs(v - statistics.median(nb)) <= 150: sm.append((s, round(statistics.median(nb), 1)))
    return [[v, s] if ax == 'v' else [s, v] for s, v in sm], len(pts)
# 1) 세로 도로 셋 — 기존 자료 끝 너머만 잇는다
ROADS = RJ['roads']; added = {}
for nm, osmn, hws in (('강남대로', ['강남대로'], ('primary',)), ('논현로', ['논현로'], ('primary',)), ('남부순환로342번길', ['남부순환로342번길'], ('tertiary', 'residential', 'unclassified'))):
    zmax = max(p[1] for p in ROADS[nm]['pts'])
    new, n = binned(osmn, hws, 'v', lo=zmax + 20)
    ROADS[nm]['pts'] += new; added[nm] = len(new)
# 2) 새 가로 도로 둘
#  매헌로 = 시민의숲 사거리(경찰청 #2963 「시민의숲」)를 만드는 길 — 동산로는 그보다 약 90m 남쪽에서 동쪽으로 갈라져 한 줄로 이으면 교차로가 사이로 떴다(첫 판 109m 어긋남).
#  매헌로는 강남대로 둘레(x 300~650) 실제 구간만 쓴다 — 서쪽 끝 다른 조각이 z 2826 으로 튀었다.
NEWH = [('매헌로', ['매헌로'], ('secondary',), 2, (300, 650)), ('양재대로', ['양재대로'], ('primary',), 3, (-1e9, 1e9))]
for nm, osmn, hws, ln, rg in NEWH:
    pts, n = binned(osmn, hws, 'h', rg[0], rg[1])
    ROADS[nm] = {'axis': 'h', 'median': round(statistics.median(p[1] for p in pts), 1), 'osmNodes': n, 'pts': pts}
OLDZS = list(M['grid']['zs']); XS = M['grid']['xs']
ZS = OLDZS + [ROADS[nm]['median'] for nm, _, _, _, _ in NEWH]
assert ZS == sorted(ZS), ZS
print('이어 붙인 칸', added, '새 zs', ZS)
# 3) 고무판 변환(js/warp.js 와 같은 식)
BLEND = 1500
def curve(pts, along, med):
    Pp = sorted(([p[0], p[1]] if along else [p[1], p[0]]) for p in pts)
    def f(s):
        if s <= Pp[0][0]: return Pp[0][1] + (med - Pp[0][1]) * min(1, (Pp[0][0] - s) / BLEND)
        if s >= Pp[-1][0]: e = Pp[-1]; return e[1] + (med - e[1]) * min(1, (s - e[0]) / BLEND)
        for k in range(1, len(Pp)):
            if s <= Pp[k][0]: t = (s - Pp[k - 1][0]) / ((Pp[k][0] - Pp[k - 1][0]) or 1); return Pp[k - 1][1] + t * (Pp[k][1] - Pp[k - 1][1])
        return Pp[-1][1]
    return f
def relax(lines, meds):
    r = 1
    for k in range(len(lines) - 1):
        g = meds[k + 1] - meds[k]
        if g > 0: r = min(r, (lines[k + 1] - lines[k]) / g)
    if r >= 0.5: return lines
    a = max(0, r / 0.5); return [meds[k] + a * (l - meds[k]) for k, l in enumerate(lines)]
def amap(v, lines, grid):
    n = len(lines)
    if v <= lines[0]: return grid[0] + (v - lines[0])
    if v >= lines[-1]: return grid[-1] + (v - lines[-1])
    for k in range(n - 1):
        if v <= lines[k + 1]: t = (v - lines[k]) / ((lines[k + 1] - lines[k]) or 1); return grid[k] + t * (grid[k + 1] - grid[k])
    return grid[-1]
def mkwarp(vnames, hnames, xs, zs, roads):
    VF = [curve(roads[n]['pts'], 0, roads[n]['median']) for n in vnames]; HF = [curve(roads[n]['pts'], 1, roads[n]['median']) for n in hnames]
    def w(X, Z):
        lv = relax([f(Z) for f in VF], xs); lh = relax([f(X) for f in HF], zs)
        for a in range(1, len(lv)):
            if lv[a] <= lv[a - 1]: lv[a] = lv[a - 1] + 1
        for b in range(1, len(lh)):
            if lh[b] <= lh[b - 1]: lh[b] = lh[b - 1] + 1
        return (amap(X, lv, xs), amap(Z, lh, zs))
    return w
OLDR = json.load(open(os.path.join(D, 'yangjae-1to1-roads.json'), encoding='utf-8'))['roads']
oldw = mkwarp(M['roadNamesV'], M['roadNamesH'], XS, OLDZS, OLDR)
HN = M['roadNamesH'] + [nm for nm, _, _, _, _ in NEWH]
neww = mkwarp(M['roadNamesV'], HN, XS, ZS, ROADS)
# 기존 정류장이 흔들리지 않는가
for st in M['brt']['stations']:
    a = oldw(*T(st['lat'], st['lon'])); b = neww(*T(st['lat'], st['lon']))
    print('기존', st['name'], 's', st['s'], '옛 변환', round(a[1]), '새 변환', round(b[1]))
    if abs(a[1] - b[1]) > 1 or abs(a[0] - b[0]) > 1: sys.exit('기존 정류장 자리가 바뀐다 — 멈춤')
# 4) 정류장 넷
stops = json.load(open(os.path.join(KB, '07_API키', 'out', 'seoul_busstop_all.json'), encoding='utf-8-sig')); stops = next(v for v in stops.values() if isinstance(v, list)) if isinstance(stops, dict) else stops
pub = {x['id']: x for x in json.load(open(os.path.join(KB, 'datamap', 'data', 'pubdata-seocho.json'), encoding='utf-8'))['bus']['items']}
gg = collections.defaultdict(set)
for r in csv.DictReader(open(os.path.join(KB, '07_API키', 'out', 'gg_scan405_20261007_1315.csv'), encoding='utf-8-sig')): gg[r['STOPS_NO']].add(r['routeName'])
try: BR = json.load(open(os.path.join(OSMD, 'bus_routes.json'), encoding='utf-8'))
except Exception: BR = {'nodes': {}, 'routes': {}}
IDX = 1; EXT = 4 * 3.5 + 1.5 + 4 + 4
have = {s['id'] for s in M['brt']['stations']}
GN = [q for r in osm['roads'] if r['name'] == '강남대로' and r['hw'] == 'primary' for q in dense([T(p[0], p[1]) for p in r['pts']])]
def side(lat, lon):   # 그 자리 실제 중심선(앞뒤 30m 강남대로 점의 중앙값)과 견준다 — 이 구간은 남서쪽으로 휘어 곧은 격자선과 견주면 상·하행이 한쪽으로 몰렸다
    X, Z = T(lat, lon); near = sorted(q[0] for q in GN if abs(q[1] - Z) < 30)
    return -1 if X < (near[len(near) // 2] if near else XS[IDX]) else 1
xing = [(neww(*T(c[0], c[1])), c[2]) for c in osm['crossings']]; exits = [(neww(*T(e[0], e[1])), e[2]) for e in osm['exits']]
NEW = []
for r in stops:
    if r.get('STOPS_TYPE') != '중앙차로' or r['STOPS_NO'] in have: continue
    lat, lon = float(r['YCRD']), float(r['XCRD']); X, Z = neww(*T(lat, lon))
    if abs(X - XS[IDX]) > 45 or not (OLDZS[-1] < Z <= ZS[-1] + EXT - 20): continue
    sx = side(lat, lon); d = 0 if sx < 0 else 2
    refs = set()
    for nid, v in BR['nodes'].items():
        if nid in BR['routes'] and math.hypot((v[1] - lon) * 88800, (v[0] - lat) * 111000) <= 35:
            if side(v[0], v[1]) == sx: refs |= {q[0] for q in BR['routes'][nid] if q[0]}
    ggs = gg.get(r['STOPS_NO'], set())
    st = {'ars': r['NODE_ID'], 'axis': 'v', 'd': d, 'id': r['STOPS_NO'], 'idx': IDX, 'lat': lat, 'lon': lon, 'name': r['STOPS_NM'], 's': round(Z),
          'routes': len(refs | ggs) or 13, 'wide': len(ggs),
          'routesSrc': ('근사 — 경기 노선(2026-10-07 수집) ' + str(len(ggs)) + ' ∪ OSM 노선 관계 ' + str(len(refs)) + '(서울 노선은 OSM 에 일부만 있어 실제보다 적을 수 있다)') if (refs or ggs) else '확인 필요 — 노선 자료 없음(설계값 13)'}
    pu = pub.get(r['STOPS_NO'])
    if pu: st['day'] = pu['day']; st['h'] = pu['h']
    xs_ = sorted(((abs(q[0][1] - Z), q) for q in xing if abs(q[0][0] - XS[IDX]) < 30 and abs(q[0][1] - Z) < 70), key=lambda t: t[0])
    if xs_: st['xw'] = round(xs_[0][1][0][1]); st['xwSig'] = xs_[0][1][1]
    ex = [[round(q[0][0]), round(q[0][1]), q[1]] for q in exits if math.hypot(q[0][0] - X, q[0][1] - Z) < 230]
    if ex: st['exits'] = ex
    NEW.append(st); print('새 정류장', st['name'], st['ars'], 's', st['s'], 'd', d, 'routes', st['routes'], st['routesSrc'], 'day', st.get('day'))
# 5) 신호 · 교차로 이름
tod = json.load(open(os.path.join(G, 'data', 'signal-tod-seocho.json'), encoding='utf-8'))['spots']
cyc = M['signals']['cycles']
for sp in tod:
    X, Z = neww(*T(sp['lat'], sp['lon']))
    best = None
    for i, x in enumerate(XS):
        for j in (4, 5):
            dd = math.hypot(X - x, Z - ZS[j])
            if dd < 70 and (best is None or dd < best[0]): best = (dd, i, j)
    if not best: continue
    plan = sp['plans'].get(sp['dow'].get('2', '1')) or next((v for v in sp['plans'].values() if v), None)
    if not plan: continue
    p = ([q for q in plan if q[0] <= '12:00'] or plan)[-1]
    cyc['%d,%d' % (best[1], best[2])] = {'phases': len([v for v in str(p[3]).split() if int(v) > 0]), 'sec': p[1], 'src': sp['name']}
def meet(vn, hn):
    pa = [T(p[0], p[1]) for r in osm['roads'] if r['name'] in vn for p in r['pts']][::2]
    pb = [T(p[0], p[1]) for r in osm['roads'] if r['name'] in hn for p in r['pts']][::2]
    return bool(pa and pb and min(math.hypot(x[0] - y[0], x[1] - y[1]) for x in pa for y in pb) < 60)
VO = {'남부순환로342번길': ['남부순환로342번길'], '강남대로': ['강남대로'], '논현로': ['논현로']}
NAMES = {'1,4': '시민의숲 사거리(매헌)', '1,5': '양재IC 부근 강남대로 · 양재대로'}
for i, vn in enumerate(M['roadNamesV']):
    for j, (hn, osmh, _, _) in zip((4, 5), [(h[0], h[1], h[2], h[3]) for h in NEWH]):
        k = '%d,%d' % (i, j); M['nodeNames'][k] = NAMES.get(k) or (('342번길' if i == 0 else vn) + ' · ' + hn + ('' if meet(VO[vn], osmh) else ' (실제로 안 만남)'))
# 6) 건물 — 옛 지도 남쪽 너머(z > 옛 끝 + 250) 만 더한다
ZOLD = OLDZS[-1] + 250; XMIN, XMAX, ZMAX = XS[0] - 250, XS[-1] + 250, ZS[-1] + 250
seen = {(b.get('n', ''), round(sum(q[0] for q in b['p']) / len(b['p'])), round(sum(q[1] for q in b['p']) / len(b['p']))) for b in BJ['buildings']}
nb = 0
for b in osm['buildings']:
    p = [[round(v, 1) for v in T(q[0], q[1])] for q in b['p']]
    xs = [q[0] for q in p]; zs = [q[1] for q in p]; cz = sum(zs) / len(zs)
    if cz <= ZOLD or cz > ZMAX or max(xs) < XMIN or min(xs) > XMAX: continue
    if max(xs) - min(xs) < 7 and max(zs) - min(zs) < 7: continue
    key = (b['n'], round(sum(xs) / len(xs)), round(cz))
    if key in seen: continue
    BJ['buildings'].append({'n': b['n'], 'lv': b['lv'], 'p': p}); nb += 1
BJ['counts']['kept'] = len(BJ['buildings']); BJ['counts']['south2026_10'] = nb
BJ['note'] += ' · 2026-10-09 남쪽 두 줄(매헌로 · 양재대로)을 더하며 그 너머 건물을 Geofabrik kr.pbf 2026-10-04 에서 더했다.'
# 7) 지도 파일
M['grid']['zs'] = ZS; M['grid']['lanesH'] = M['grid']['lanesH'] + [ln for _, _, _, ln, _ in NEWH]
M['grid']['lanesNote'] += ' 매헌로 편도 2 · 양재대로 편도 3 도 설계값(2026-10-09 더함).'
M['grid']['note'] += ' 2026-10-09 남쪽 두 줄(매헌로 · 양재대로)과 강남대로·논현로·342번길 남쪽 끝을 Geofabrik kr.pbf 2026-10-04 로 이어 붙였다(tools/maps/yangjae_extend.py).'
M['roadNamesH'] = HN
M['brt']['stations'] += NEW   # 기존 순서는 그대로 · 새 것은 뒤에
M['brt']['lanes'][0]['s1'] = round(ZS[-1] + EXT - 10)
M['brt']['note'] += ' · 2026-10-09 매헌시민의숲사거리 두 승강장 · 매헌시민의숲 두 승강장을 더했다(남쪽 두 줄).'
M['realness']['미구현'] = M['realness']['미구현'].replace(' · 말죽거리공원사거리 남쪽 양재IC 방향', '') + ' · 양재IC 램프·염곡 지하도로'
M['purpose'] += ' · 2026-10-09 소유자 「권고대로 진행」 — 남쪽 매헌시민의숲 중앙 정류장까지 늘렸다.'
open(os.path.join(D, 'yangjae-1to1.json'), 'w', encoding='utf-8', newline='\n').write(json.dumps(M, ensure_ascii=False, indent=3, separators=(',', ' : '), sort_keys=True) + '\n')   # 원본 모양(펄 JSON · 키 정렬 · 끝 줄바꿈) 그대로
RJ['roads'] = ROADS; RJ['collected'] += ' · 2026-10-09 남쪽 줄 Geofabrik kr.pbf 2026-10-04(상자 37.460~37.496, 127.018~127.052)'
json.dump(RJ, open(os.path.join(D, 'yangjae-1to1-roads.json'), 'w', encoding='utf-8', newline='\n'), ensure_ascii=False, separators=(',', ':'))
json.dump(BJ, open(os.path.join(D, 'yangjae-1to1-buildings.json'), 'w', encoding='utf-8', newline='\n'), ensure_ascii=False, separators=(',', ':'))
print('건물 +', nb, '신호', {k: v for k, v in cyc.items() if k.endswith(',4') or k.endswith(',5')}, '이름', {k: v for k, v in M['nodeNames'].items() if k.endswith(',4') or k.endswith(',5')})
