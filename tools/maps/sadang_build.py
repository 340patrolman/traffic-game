# -*- coding: utf-8 -*-
# 🚏 사당역 정밀 구역(1:1) 지도 굽기 — 양재역 정밀 구역(v0.10.69)과 같은 틀(그때 도구 yj/build.pl·mkmap.pl 은 임시 폴더에 있다가 사라졌다 → 이번엔 저장소에 둔다).
#  소유자 2026-10-08 「신반포로·강남대로·동작대로 중앙버스전용차로와 정류장」 → 서초구 1:1 격자는 남부순환로(사당역 사거리)에서 끝나
#  그 남쪽 사당역 중앙 정류장 두 곳·사당자동차학원 정류장이 밖이었다. 이 구역만 따로 실제 크기로 만든다.
#  입력(모두 로컬 · 네트워크 0):
#   · ../07_API키/out/osm_sadang/osm.json        (tools/maps/osm_extract.py — kr.pbf 2026-10-04 Geofabrik)
#   · ../07_API키/out/osm_sadang/bus_routes.json (tools/maps/osm_bus_routes.py — OSM route=bus 관계, 서울 노선 수 근사)
#   · ../07_API키/out/seoul_busstop_all.json      (서울시 버스정류소 위치 · STOPS_TYPE 중앙차로)
#   · ../07_API키/out/gg_scan405_20261007_1315.csv (중앙 정류장 405곳을 지나는 경기 노선 — 10/7 수집)
#   · ../datamap/data/pubdata-seocho.json          (서울시 교통카드 2026.6 정류장별 시간대 승하차 하루 평균)
#   · data/signal-tod-seocho.json · data/intersections-seocho.json (경찰청 신호 계획 · 교차로 이름)
#  출력: data/maps/sadang-1to1.json · -roads.json · -buildings.json (index.json 은 손으로 한 줄)
#   py -3.12 -X utf8 tools/maps/sadang_build.py
import json, math, os, csv, statistics, collections
G = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
KB = os.path.dirname(G); OSMD = os.path.join(KB, '07_API키', 'out', 'osm_sadang')
osm = json.load(open(os.path.join(OSMD, 'osm.json'), encoding='utf-8'))

# ---------- 좌표: 동작대로·과천대로가 세로축이 되게 돌린 미터 좌표 · 원점 사당역 사거리(경찰청 신호 65 자리 근처 · C-ITS 교차로 표) ----------
LAT0, LON0, X0, Z0 = 37.47643, 126.98176, 1000.0, 1100.0
KX, KZ = 88800.0, 111000.0
def raw(lat, lon): return ((lon - LON0) * KX, -(lat - LAT0) * KZ)
P = [raw(p[0], p[1]) for r in osm['roads'] if r['name'] in ('동작대로', '과천대로') and r['hw'] == 'primary' for p in r['pts']]
mx = sum(p[0] for p in P) / len(P); mz = sum(p[1] for p in P) / len(P)
sxx = sum((p[0] - mx) ** 2 for p in P); szz = sum((p[1] - mz) ** 2 for p in P); sxz = sum((p[0] - mx) * (p[1] - mz) for p in P)
ANG = 0.5 * math.atan2(2 * sxz, sxx - szz); TH = math.pi / 2 - ANG
C, S = math.cos(TH), math.sin(TH)
A = [round(KX * C), round(KZ * S)]; B = [round(KX * S), round(-KZ * C)]   # x = A0·u + A1·w + X0 · z = B0·u + B1·w + Z0 (u = 경도−LON0, w = 위도−LAT0)
def T(lat, lon): u, w = lon - LON0, lat - LAT0; return (A[0] * u + A[1] * w + X0, B[0] * u + B[1] * w + Z0)

# ---------- 격자 도로(OSM 이름 → 지도 이름) ----------
VDEF = [('남현길', ['남현길'], ('tertiary',)), ('동작대로 · 과천대로', ['동작대로', '과천대로'], ('primary',)), ('도구로', ['도구로'], ('tertiary',))]
HDEF = [('사당로 · 서초대로', ['사당로', '서초대로'], ('primary',)), ('남부순환로', ['남부순환로'], ('primary',)), ('강남순환로', ['강남순환로'], ('trunk',))]
LANESV = [1, 4, 1]; LANESH = [3, 4, 3]
def dense(pts, step=10):
    out = []
    for a, b in zip(pts, pts[1:]):
        d = math.hypot(b[0] - a[0], b[1] - a[1]); n = max(1, int(d // step))
        for k in range(n): t = k / n; out.append((a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t))
    if pts: out.append(pts[-1])
    return out
def road(names, hws, ax):
    pts = []
    for r in osm['roads']:
        if r['name'] in names and r['hw'] in hws: pts += dense([T(p[0], p[1]) for p in r['pts']])
    along = 1 if ax == 'v' else 0; cross = 1 - along
    bins = collections.defaultdict(list)
    for p in pts: bins[int(math.floor(p[along] / 40 + 0.5))].append(p[cross])
    rows = sorted((k * 40, statistics.median(v)) for k, v in bins.items() if len(v) >= 2)
    sm = []
    for i, (s, v) in enumerate(rows):
        nb = [rows[j][1] for j in range(max(0, i - 2), min(len(rows), i + 3))]
        if abs(v - statistics.median(nb)) <= 150: sm.append((s, round(statistics.median(nb), 1)))
    med = round(statistics.median([v for s, v in sm]), 1)
    P2 = [[v, s] if ax == 'v' else [s, v] for s, v in sm]   # 늘 [x, z]
    return {'axis': ax, 'median': med, 'osmNodes': len(pts), 'pts': P2}
ROADS = {}
for nm, osmn, hw in VDEF: ROADS[nm] = road(osmn, hw, 'v')
for nm, osmn, hw in HDEF: ROADS[nm] = road(osmn, hw, 'h')
XS = [ROADS[n]['median'] for n, _, _ in VDEF]; ZS = [ROADS[n]['median'] for n, _, _ in HDEF]
assert XS == sorted(XS) and ZS == sorted(ZS), (XS, ZS)
print('xs', XS, 'zs', ZS)

# ---------- 고무판 변환(js/warp.js 와 같은 식 · unit m → BLEND 1500) ----------
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
VF = [curve(ROADS[n]['pts'], 0, ROADS[n]['median']) for n, _, _ in VDEF]; HF = [curve(ROADS[n]['pts'], 1, ROADS[n]['median']) for n, _, _ in HDEF]
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
def warp(X, Z):
    lv = relax([f(Z) for f in VF], XS); lh = relax([f(X) for f in HF], ZS)
    for a in range(1, len(lv)):
        if lv[a] <= lv[a - 1]: lv[a] = lv[a - 1] + 1
    for b in range(1, len(lh)):
        if lh[b] <= lh[b - 1]: lh[b] = lh[b - 1] + 1
    return (amap(X, lv, XS), amap(Z, lh, ZS))
def W(lat, lon): return warp(*T(lat, lon))

# ---------- 건물(돌린 미터 좌표 그대로 — 게임이 읽을 때 고무판 변환) ----------
XMIN, XMAX, ZMIN, ZMAX = XS[0] - 250, XS[-1] + 250, ZS[0] - 250, ZS[-1] + 250
bld = []; cnt = collections.Counter()
for b in osm['buildings']:
    p = [list(map(lambda v: round(v, 1), T(q[0], q[1]))) for q in b['p']]; cnt['osm'] += 1
    xs = [q[0] for q in p]; zs = [q[1] for q in p]
    if max(xs) < XMIN or min(xs) > XMAX or max(zs) < ZMIN or min(zs) > ZMAX: cnt['outside'] += 1; continue
    if max(xs) - min(xs) < 7 and max(zs) - min(zs) < 7: cnt['small'] += 1; continue
    bld.append({'n': b['n'], 'lv': b['lv'], 'p': p}); cnt['kept'] += 1

# ---------- 중앙 정류장 ----------
stops = json.load(open(os.path.join(KB, '07_API키', 'out', 'seoul_busstop_all.json'), encoding='utf-8-sig'))
stops = next(v for v in stops.values() if isinstance(v, list)) if isinstance(stops, dict) else stops
pub = {x['id']: x for x in json.load(open(os.path.join(KB, 'datamap', 'data', 'pubdata-seocho.json'), encoding='utf-8'))['bus']['items']}
gg = collections.defaultdict(set)
for r in csv.DictReader(open(os.path.join(KB, '07_API키', 'out', 'gg_scan405_20261007_1315.csv'), encoding='utf-8-sig')): gg[r['STOPS_NO']].add(r['routeName'])
try: BR = json.load(open(os.path.join(OSMD, 'bus_routes.json'), encoding='utf-8'))
except Exception: BR = {'nodes': {}, 'routes': {}}
ROAD_IDX = 1   # 동작대로 · 과천대로
FULL = {x['ars']: x for x in json.load(open(os.path.join(G, 'data', 'maps', 'seocho-full.json'), encoding='utf-8'))['brt']['stations']}
EXT = max([LANESV[i] * 3.5 + 1.5 for i in range(3)] + [LANESH[j] * 3.5 + 1.5 for j in range(3)]) + 4 + 4   # city.EXT 근사(반폭+보도+4)
def osm_routes(lat, lon, side_x):
    refs = set()
    for nid, v in BR['nodes'].items():
        if nid not in BR['routes']: continue
        d = math.hypot((v[1] - lon) * KX, (v[0] - lat) * KZ)
        if d > 35: continue
        X, Z = W(v[0], v[1])
        if (X - XS[ROAD_IDX]) * side_x < -0.5: continue   # 반대 방향 승강장의 노드는 뺀다
        for r in BR['routes'][nid]:
            if r[0]: refs.add(r[0])
    return refs
xing = [(W(c[0], c[1]), c[2]) for c in osm['crossings']]
exits = [(W(e[0], e[1]), e[2]) for e in osm['exits']]
ST = []
for r in stops:
    if r.get('STOPS_TYPE') != '중앙차로': continue
    lat, lon = float(r['YCRD']), float(r['XCRD'])
    X, Z = W(lat, lon)
    if abs(X - XS[ROAD_IDX]) > 45 or not (ZS[0] - EXT + 20 <= Z <= ZS[-1] + EXT - 20): continue
    sx = -1 if X < XS[ROAD_IDX] else 1
    d = 0 if sx < 0 else 2   # 남행(+z) 버스는 서쪽 반(오른쪽 통행) · 북행은 동쪽 반 — 양재역 지도와 같은 판정
    pu = pub.get(r['STOPS_NO'])
    ggs = gg.get(r['STOPS_NO'], set()); osr = osm_routes(lat, lon, sx)
    routes = len(osr | ggs) if (osr or ggs) else None
    st = {'ars': r['NODE_ID'], 'axis': 'v', 'd': d, 'id': r['STOPS_NO'], 'idx': ROAD_IDX, 'lat': lat, 'lon': lon, 'name': r['STOPS_NM'], 's': round(Z),
          'routes': routes if routes is not None else 13, 'wide': len(ggs), 'routesSrc': ('근사 — 경기 노선(2026-10-07 수집) ' + str(len(ggs)) + ' ∪ OSM 노선 관계 ' + str(len(osr)) + '(서울 노선은 OSM 에 일부만 있어 실제보다 적을 수 있다)') if routes is not None else '확인 필요 — 노선 자료 없음(설계값 13)'}
    if r['NODE_ID'] in FULL:   # 서초구 1:1 에 이미 있는 승강장 — 그때(2026-09-29) 서울시 버스도착정보로 받은 값을 그대로
        st['routes'] = FULL[r['NODE_ID']]['routes']; st['wide'] = FULL[r['NODE_ID']].get('wide', st['wide']); st['routesSrc'] = '서울시 버스도착정보 getLowArrInfoByStId(2026-09-29 · 서초구 1:1 과 같은 값)'
    if pu: st['day'] = pu['day']; st['h'] = pu['h']
    xs_ = sorted(((abs(q[0][1] - Z), q) for q in xing if abs(q[0][0] - XS[ROAD_IDX]) < 30 and abs(q[0][1] - Z) < 70), key=lambda t: t[0])
    if xs_: st['xw'] = round(xs_[0][1][0][1]); st['xwSig'] = xs_[0][1][1]
    ex = [[round(q[0][0]), round(q[0][1]), q[1]] for q in exits if math.hypot(q[0][0] - X, q[0][1] - Z) < 230]
    if ex: st['exits'] = ex
    ST.append(st)
ST.sort(key=lambda s: s['s'])
for s in ST: print('정류장', s['name'], s['ars'], 's', s['s'], 'd', s['d'], 'routes', s['routes'], s['routesSrc'], 'day', s.get('day'))

# ---------- 신호(경찰청 계획) · 교차로 이름 ----------
tod = json.load(open(os.path.join(G, 'data', 'signal-tod-seocho.json'), encoding='utf-8'))['spots']
cyc = {}
for sp in tod:
    X, Z = W(sp['lat'], sp['lon'])
    best = None
    for i, x in enumerate(XS):
        for j, z in enumerate(ZS):
            dd = math.hypot(X - x, Z - z)
            if dd < 70 and (best is None or dd < best[0]): best = (dd, i, j)
    if not best: continue
    plan = (sp['plans'].get(sp['dow'].get('2', '1')) or list(sp['plans'].values())[0])
    row = [p for p in plan if p[0] <= '12:00'] or plan
    p = row[-1]; ph = len([v for v in str(p[3]).split() if int(v) > 0])
    key = '%d,%d' % (best[1], best[2])
    if key not in cyc or best[0] < cyc[key]['_d']: cyc[key] = {'phases': ph, 'sec': p[1], 'src': sp['name'], '_d': best[0]}
for v in cyc.values(): v.pop('_d', None)
def meet(a, b):   # 두 실제 도로가 30m 안으로 만나는가
    pa = [T(p[0], p[1]) for r in osm['roads'] if r['name'] in a[1] for p in r['pts']]
    pb = [T(p[0], p[1]) for r in osm['roads'] if r['name'] in b[1] for p in r['pts']]
    pa = pa[::3] or pa; pb = pb[::3] or pb
    return min(math.hypot(x[0] - y[0], x[1] - y[1]) for x in pa for y in pb) < 60 if pa and pb else False
NAMES = {'1,0': '이수역 교차로', '1,1': '사당역 사거리', '1,2': '과천대로 · 강남순환로 사당IC(실제는 입체 — 게임은 평면 교차)'}
NN = {}
for i, v in enumerate(VDEF):
    for j, h in enumerate(HDEF):
        k = '%d,%d' % (i, j)
        NN[k] = NAMES.get(k) or (v[0] + ' · ' + h[0] + ('' if meet(v, h) else ' (실제로 안 만남)'))

# ---------- 지도 파일 ----------
BRTNAME = '동작대로 · 과천대로 중앙버스전용차로'
M = {
  'beta': True,
  'brt': {'lanes': [{'axis': 'v', 'idx': ROAD_IDX, 'name': BRTNAME, 's0': round(ZS[0] - EXT + 10), 's1': round(ZS[-1] + EXT - 10)}],
          'note': '사당역 두 승강장(남행·북행) · 사당자동차학원 · 북쪽 이수역·사당동우체국앞·방배노인종합복지관(서초구 1:1 에도 있다). 격자 도로 폭이 고정이라 승강장(1.9m)이 2차로 안쪽을 차지한다.',
          'source': '구간 = OSM highway=busway 동작대로·과천대로(kr.pbf 2026-10-04) · 승강장 = 서울시 버스정류소 위치(STOPS_TYPE 중앙차로) 고무판 변환 · 승하차 = 서울시 교통카드 2026.6 하루 평균 · 노선 수 = OSM route=bus 관계(서울 노선 근사) ∪ 경기 노선(2026-10-07 수집) — 서울시 버스도착정보 조회는 키 승인이 없어 쓰지 못했다(routesSrc 에 칸마다 밝힘)',
          'stations': ST},
  'buildings': 'data/maps/sadang-1to1-buildings.json',
  'dataAffine': json.load(open(os.path.join(G, 'data', 'maps', 'yangjae-1to1.json'), encoding='utf-8'))['dataAffine'],
  'dataAffineNote': 'TAAS 사고 사례(gx·gz)는 축약 지도의 아핀 공간으로 구워져 있다 — 그 식을 거꾸로 풀어 위경도로 되돌린 뒤 이 지도로 옮긴다(js/warp.js fromData).',
  'grid': {'lanesH': LANESH, 'lanesV': LANESV,
           'lanesNote': '동작대로·과천대로 편도 4 · 남부순환로 편도 4 · 사당로·서초대로 편도 3 · 강남순환로 편도 3 · 남현길·도구로 편도 1 은 **설계값**이다(OSM lanes 태그가 드물다).',
           'note': '**실제 미터.** OSM 간선 6개(data/maps/sadang-1to1-roads.json)의 40m 칸 중앙값에서 도로별 가로 좌표 중앙값.',
           'source': 'OpenStreetMap contributors (ODbL) · Geofabrik south-korea 2026-10-04', 'xs': XS, 'zs': ZS},
  'id': 'sadang-1to1', 'landmarkBlocks': {}, 'monuments': [],
  'name': '사당역 정밀 구역 (1:1)',
  'nodeNames': NN,
  'nodeNamesNote': '사당역 사거리·이수역 교차로는 C-ITS·경찰청 신호 이름(사당역 #65 · 이수역 #1552). 강남순환로는 사당IC 로 입체 교차한다 — 곧은 격자라 게임에서는 평면 교차로가 된다. 「실제로 안 만남」은 두 도로가 60m 안으로 다가가지 않는 자리다.',
  'note': '**1 unit = 1 m** · 동작대로·과천대로를 세로축으로 돌린 좌표(이 지도의 「북쪽」은 이수역 쪽 동작대로다 — 실제 북쪽에서 약 %.0f° 돌아 있다). 격자 = OSM 간선 6개 중심선의 중앙값, 건물·정류장·사고 자리는 고무판 변환(js/warp.js)으로 맞춘다.' % abs(math.degrees(TH)),
  'parkBlock': {'i': -1, 'j': -1},
  'purpose': '소유자 2026-10-08 「신반포로 강남대로 동작대로 중앙버스전용차로를 만들고 정류장도」 → 「계속 진행」. 서초구 1:1 격자는 남부순환로(사당역 사거리)에서 끝나 그 남쪽의 사당역 중앙 정류장 두 곳·사당자동차학원 정류장을 담지 못한다 — 사당역은 서울·경기 광역버스가 몰리는 환승 거점이라 이 구역만 따로 실제 크기로 만든다.',
  'realBuildings': True,
  'realness': {'미구현': '도로 곡선·교차각(격자는 곧다 — 고무판 변환이 자리를 맞춘다) · 이면도로 · 사당고가차도 · 강남순환로 입체 교차 · 남태령 쪽', '설계값': '차로 수 · 신호 남북·동서 배분 · 이용객 동선의 갈래 · OSM 노선 관계로 센 서울 노선 수(근사)', '실측': '도로 자리(OSM 간선 6개 중심선) · 건물 윤곽(OSM) · 사당역·이수역 · 중앙 정류장 자리 · 승하차(교통카드) · 경기 노선 · 신호 주기(경찰청)'},
  'region': {'guGun': '650', 'name': '서울특별시 동작구 사당동 · 관악구 남현동 · 서초구 방배동', 'siDo': '11'},
  'roadNamesH': [h[0] for h in HDEF], 'roadNamesV': [v[0] for v in VDEF],
  'scale1to1': True, 'schema': 'tg-map/1',
  'schoolBlock': {'i': 0, 'j': 0}, 'schoolNote': '이 구역 간선(격자 도로 6개)에 정문 주소를 둔 초등학교를 두지 않았다(확인 필요 — 남성초·사당초는 이면도로 쪽).', 'schoolSides': [],
  'schoolZones': 'data/schoolzone-seocho.json', 'signalTod': 'data/signal-tod-seocho.json',
  'signals': {'cycleDefault': 160, 'cycleDefaultNote': '서울 주요 교차로 주간(07~20시) 운영계획 5,901행의 주기 중앙값 160초.', 'cycles': cyc,
              'missing': '격자 교차로 중 경찰청 계획 개방 목록과 70m 안으로 맞는 것만 실측 주기 · 나머지는 추정값.', 'note': '주기는 경찰청 계획값(평일 정오 계획). 남북·동서 배분은 게임 설계값이다.',
              'source': '경찰청_교차로계획정보서비스 · 공공데이터포털(data.go.kr) · 2026-09-10 01:00 갱신분'},
  'subways': [{'i': 1, 'j': 1, 'lines': ['2', '4'], 'name': '사당역', 'side': 1}, {'i': 1, 'j': 0, 'lines': ['4', '7'], 'name': '총신대입구(이수)역', 'side': 1}],
  'subwaysNote': '사당역(2·4호선) · 총신대입구(이수)역(4·7호선). 출입구 자리는 OSM 출입구 점으로 동선에 쓴다(js/brt.js).',
  'taasFatal': 'data/taas-fatal-seocho.json', 'twin': True,
  'wgs84': {'lat0': LAT0, 'lon0': LON0, 'note': '1:1 · 동작대로 방향으로 돌린 좌표 — x = %d(lon−%.5f) + %d(lat−%.5f) + %d · z = %d(lon−%.5f) %+d(lat−%.5f) + %d(서울 위도 기준 미터 근사: 경도 88,800m · 위도 111,000m 를 돌렸다).' % (A[0], LON0, A[1], LAT0, X0, B[0], LON0, B[1], LAT0, Z0),
            'x': [A[0], A[1], X0], 'z': [B[0], B[1], Z0]}
}
D = os.path.join(G, 'data', 'maps')
json.dump(M, open(os.path.join(D, 'sadang-1to1.json'), 'w', encoding='utf-8', newline='\n'), ensure_ascii=False, indent=1)
json.dump({'attribution': '© OpenStreetMap contributors — ODbL. 화면에 출처를 표시한다.', 'collected': 'Geofabrik south-korea kr.pbf 2026-10-04 · highway=trunk/primary/tertiary · 상자 37.463~37.490, 126.968~126.999',
           'method': '도로별 OSM 노드를 10m 간격으로 촘촘히 한 뒤 이 좌표로 옮기고 주축 40m 칸마다 가로 좌표의 중앙값 · 표본 1개 칸 버림 · 이웃 다섯 중앙값에서 150m 넘게 어긋난 칸 버림. 「동작대로 · 과천대로」·「사당로 · 서초대로」는 한 줄로 이었다(사당역·이수역에서 만난다).',
           'roads': ROADS, 'schema': 'tg-roads/1', 'space': '미터(1 unit = 1 m) · 동작대로를 세로축으로 돌린 좌표 · 원점 사당역 사거리(%.5f, %.5f) = (%d, %d)' % (LAT0, LON0, X0, Z0), 'unit': 'm', 'use': 'js/warp.js 고무판 변환'},
          open(os.path.join(D, 'sadang-1to1-roads.json'), 'w', encoding='utf-8', newline='\n'), ensure_ascii=False)
json.dump({'transform': M['wgs84']['note'], 'schema': 'tg-buildings/1', 'source': 'OpenStreetMap contributors (ODbL) · Geofabrik kr.pbf 2026-10-04', 'buildings': bld, 'counts': dict(cnt), 'map': 'sadang-1to1',
           'note': '사당역 정밀 구역 1:1. 윤곽은 OSM 그대로(이 지도의 돌린 미터 좌표)이고 게임이 읽을 때 고무판 변환(js/warp.js)으로 격자에 맞춘다. 층수(lv)가 없으면 0 — 게임이 바닥 넓이로 어림한다(설계값). 가로·세로 모두 7m 미만은 뺐다.'},
          open(os.path.join(D, 'sadang-1to1-buildings.json'), 'w', encoding='utf-8', newline='\n'), ensure_ascii=False, separators=(',', ':'))
print('건물', dict(cnt), '신호', cyc, '\n이름', NN, '\nangle', round(math.degrees(TH), 2), 'A', A, 'B', B)
