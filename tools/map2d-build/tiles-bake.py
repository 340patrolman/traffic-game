# -*- coding: utf-8 -*-
# 바탕 지도 조각(v0.10.90) — 서울·경기(+사이에 낀 인천) OSM 을 8km 조각과 개관 1장으로 굽는다
# 소유자(2026-10-04): 「데이터 압축지도를 서울시 전역 경기도 전역으로 확대 · 조각조각 나누어 받게」
# 입력: C:\Users\knpth\osmwork\kr.pbf = Geofabrik south-korea-latest.osm.pbf (© OpenStreetMap contributors · ODbL)
#       07_API키/신호앱/data/cits_cross_2779_20260910.txt (서울 C-ITS 교차로 이름 — 서울특별시 교통빅데이터플랫폼)
# 출력: data/base/index.json · data/base/ov.json(개관: 고속·주간선·큰 물·큰 숲·철도) · data/base/t/<ix>_<iz>.json(조각: 모든 길·물·녹지·철도·주차장·교차로 이름)
# 좌표: 평면 m 정수 · x=(lon-127.01)×88800 · z=-(lat-37.49)×111000 · 선/고리는 첫 점 뒤 차분 — base-seocho.json(tg-base/1)과 같은 꼴
# 쓰는 법: py -3.12 -X utf8 tools/map2d-build/tiles-bake.py   (pyosmium · shapely 필요 · 수십 분)
import json, math, os, re, sys, time
import osmium
from shapely.geometry import LineString, Polygon, MultiPolygon, box
from shapely import wkb as swkb

KB = r'C:\Users\knpth\Desktop\지식베이스'
PBF = r'C:\Users\knpth\osmwork\kr.pbf'   # ⚠ libosmium 은 한글 경로를 못 연다(Windows) — 영문 경로에 둔다
OUTD = os.path.join(KB, 'traffic-game', 'data', 'base')
TS = 8000                                   # 조각 한 변(m)
LON0, LON1, LAT0, LAT1 = 126.36, 127.86, 36.89, 38.29   # 서울·경기(+인천 본토) 둘레
def P(lon, lat): return ((lon - 127.01) * 88800, -(lat - 37.49) * 111000)
X0, Z0 = P(LON0, LAT1); X1, Z1 = P(LON1, LAT0)

RC = {'motorway': 'm', 'trunk': 'm', 'primary': 'p', 'secondary': 's', 'tertiary': 't', 'unclassified': 'r', 'residential': 'r', 'living_street': 'r',
      'motorway_link': 'l', 'trunk_link': 'l', 'primary_link': 'l', 'secondary_link': 'l', 'tertiary_link': 'l', 'service': 'v',
      'pedestrian': 'f', 'footway': 'f', 'cycleway': 'c', 'path': 'f', 'steps': 'f'}
TOL = {'m': 1.5, 'p': 1.5, 's': 1.5, 't': 1.5, 'r': 1.5, 'l': 1.5, 'v': 2, 'f': 2.5, 'c': 2, 'rail': 3, 'ww': 2, 'water': 2.5, 'green': 3, 'pk': 2}
OVTOL = {'m': 25, 'p': 25, 'rail': 40, 'ww': 25, 'water': 30, 'green': 90}
OVL = {'m': [], 'p': [], 'rail': [], 'ww': []}   # 개관 선은 모아 두었다가 끝에 이어 붙인다(linemerge)
def GREEN(t):
    v = t.get('leisure')
    if v in ('park', 'garden', 'playground', 'pitch', 'golf_course'): return v
    v = t.get('landuse')
    if v in ('forest', 'grass', 'recreation_ground', 'cemetery'): return v
    v = t.get('natural')
    if v in ('wood', 'scrub', 'grassland'): return v
    return None
JR = re.compile(r'(사거리|삼거리|오거리|교차로|입구|네거리|IC|나들목|JC|분기점)$')

class Pack:
    def __init__(self): self.names = []; self.NI = {}; self.roads = {}; self.water = []; self.ww = []; self.green = []; self.rail = []; self.pk = []; self.jn = []
    def ni(self, n):
        if not n: return -1
        if n not in self.NI: self.NI[n] = len(self.names); self.names.append(n)
        return self.NI[n]
def enc(coords):
    out = []; px = pz = 0; first = True
    for (x, z) in coords:
        X, Z = int(round(x)), int(round(z))
        if not first and X == px and Z == pz: continue
        out += [X, Z] if first else [X - px, Z - pz]; px, pz = X, Z; first = False
    return out
def lines(g):
    if g.is_empty: return []
    if g.geom_type == 'LineString': return [g]
    return [x for x in getattr(g, 'geoms', []) if x.geom_type == 'LineString']
def polys(g):
    if g.is_empty: return []
    if g.geom_type == 'Polygon': return [g]
    return [x for x in getattr(g, 'geoms', []) if x.geom_type == 'Polygon']
def rings_of(pg, tol, minA=60):
    out = []
    for p in polys(pg.simplify(tol, preserve_topology=True)):
        if p.area < minA: continue
        out.append([enc(list(p.exterior.coords)[:-1])] + [enc(list(h.coords)[:-1]) for h in p.interiors if Polygon(h).area > minA])
    return out
TILES = {}; OV = Pack()
def tkey(ix, iz): return '%d_%d' % (ix, iz)
def tbox(ix, iz): return box(ix * TS, iz * TS, (ix + 1) * TS, (iz + 1) * TS)
def tiles_for(b):   # (minx, minz, maxx, maxz)
    for ix in range(int(math.floor(b[0] / TS)), int(math.floor(b[2] / TS)) + 1):
        for iz in range(int(math.floor(b[1] / TS)), int(math.floor(b[3] / TS)) + 1):
            yield ix, iz
def tile(ix, iz):
    k = tkey(ix, iz)
    if k not in TILES: TILES[k] = Pack()
    return TILES[k]
def inreg(b): return not (b[2] < X0 or b[0] > X1 or b[3] < Z0 or b[1] > Z1)

nm2_service = False
def add_line(kind, cls, nm, fl, geom):
    b = geom.bounds
    if not inreg(b): return
    for ix, iz in tiles_for(b):
        T = tile(ix, iz)
        for L in lines(geom.intersection(tbox(ix, iz))):
            a = enc(list(L.simplify(TOL[cls if kind == 'road' else kind]).coords))
            if len(a) < 4: continue
            if kind == 'road': T.roads.setdefault(cls, []).append([T.ni(nm), fl] + a)
            elif kind == 'ww': T.ww.append([T.ni(nm), cls, fl] + a)
            elif kind == 'rail': T.rail.append([T.ni(nm), cls, fl] + a)
    # 개관
    if kind == 'road' and cls in ('m', 'p') and not (fl & 2): OVL[cls].append((nm or '', geom))
    elif kind == 'ww' and cls == 1: OVL['ww'].append((nm or '', geom))
    elif kind == 'rail' and cls == 0 and not (fl & 2) and not nm2_service: OVL['rail'].append(('', geom))
def add_area(kind, gk, nm, pg):
    b = pg.bounds
    if not inreg(b): return
    for ix, iz in tiles_for(b):
        cl = pg.intersection(tbox(ix, iz))
        if cl.is_empty: continue
        T = tile(ix, iz)
        for rr in rings_of(cl, TOL[kind]):
            if kind == 'water': T.water.append([T.ni(nm), rr])
            elif kind == 'green': T.green.append([T.ni(nm), gk, rr])
            elif kind == 'pk': T.pk.append(rr)
    A = pg.area
    if kind == 'water' and (A > 200000 or (nm and re.search(r'(강|천|저수지|호수?)$', nm) and A > 30000)):
        for rr in rings_of(pg, OVTOL['water'], 5000): OV.water.append([OV.ni(nm), rr])
    if kind == 'green' and gk in ('forest', 'wood') and A > 4000000:
        for rr in rings_of(pg, OVTOL['green'], 1000000): OV.green.append([OV.ni(nm), gk, rr])

def to_xy_line(locs): return [P(l.lon, l.lat) for l in locs]
wkbf = osmium.geom.WKBFactory()
t0 = time.time(); n = 0
fp = osmium.FileProcessor(PBF).with_locations().with_areas().with_filter(osmium.filter.KeyFilter('highway', 'waterway', 'railway', 'natural', 'leisure', 'landuse', 'amenity', 'junction'))   # 이 열쇠가 없는 것은 Python 으로 안 올린다(빠르게)
for o in fp:
    n += 1
    if n % 2000000 == 0: print('..', n, round(time.time() - t0), 's', len(TILES), 'tiles', flush=True)
    try:
        if o.is_node():
            t = o.tags; nm = t.get('name')
            if not nm: continue
            if not (JR.search(nm) or t.get('highway') == 'traffic_signals' or 'junction' in t): continue
            lon, lat = o.location.lon, o.location.lat
            if not (LON0 <= lon <= LON1 and LAT0 <= lat <= LAT1): continue
            x, z = P(lon, lat); tile(int(math.floor(x / TS)), int(math.floor(z / TS))).jn.append([nm, round(x), round(z)])
        elif o.is_way():
            t = o.tags; hw = t.get('highway'); wwy = t.get('waterway'); rl = t.get('railway')
            if not (hw in RC or wwy in ('river', 'stream', 'drain', 'ditch', 'canal') or rl in ('rail', 'subway', 'light_rail')): continue
            nodes = o.nodes
            if len(nodes) < 2: continue
            lon = nodes[0].location.lon; lat = nodes[0].location.lat
            if not (LON0 - 0.2 <= lon <= LON1 + 0.2 and LAT0 - 0.2 <= lat <= LAT1 + 0.2): continue
            g = LineString([P(nd.location.lon, nd.location.lat) for nd in nodes])
            nm = t.get('name')
            if hw in RC:
                c = RC[hw]
                fl = (1 if t.get('bridge') else 0) | (2 if (t.get('tunnel') or str(t.get('layer', '0')).startswith('-')) else 0) | (4 if t.get('oneway') == 'yes' else 0)
                add_line('road', c, nm, fl, g)
            elif wwy:
                add_line('ww', 1 if wwy == 'river' else 0, nm, 2 if t.get('tunnel') else 0, g)
            else:
                nm2_service = bool(t.get('service'))
                add_line('rail', 1 if rl == 'subway' else 0, nm, 2 if (t.get('tunnel') or str(t.get('layer', '0')).startswith('-')) else 0, g)
        elif o.is_area():
            t = o.tags
            kind = 'water' if t.get('natural') == 'water' else ('green' if GREEN(t) else ('pk' if t.get('amenity') == 'parking' else None))
            if not kind: continue
            try: pg = swkb.loads(wkbf.create_multipolygon(o), hex=True)
            except Exception: continue
            b = pg.bounds   # 경위도
            if b[2] < LON0 or b[0] > LON1 or b[3] < LAT0 or b[1] > LAT1: continue
            from shapely.ops import transform
            pg = transform(lambda x, y, z=None: ((x - 127.01) * 88800, -(y - 37.49) * 111000), pg)
            if not pg.is_valid: pg = pg.buffer(0)
            add_area(kind, GREEN(t), t.get('name'), pg)
    except Exception as e:
        continue
print('read', n, round(time.time() - t0), 's tiles', len(TILES))

# 서울 C-ITS 교차로 이름(연등 제외)
for l in open(os.path.join(KB, '07_API키', '신호앱', 'data', 'cits_cross_2779_20260910.txt'), encoding='utf-8'):
    f = l.strip().split('|')
    if len(f) < 4 or '연등' in f[1]: continue
    x, z = P(float(f[3]), float(f[2])); tile(int(math.floor(x / TS)), int(math.floor(z / TS))).jn.insert(0, [f[1], round(x), round(z)])
def dedupe_j(js):
    out = []
    for j in js:
        if any((q[1] - j[1]) ** 2 + (q[2] - j[2]) ** 2 < 625 or (q[0] == j[0] and (q[1] - j[1]) ** 2 + (q[2] - j[2]) ** 2 < 22500) for q in out): continue
        out.append(j)
    return out

os.makedirs(os.path.join(OUTD, 't'), exist_ok=True)
SRC = '© OpenStreetMap contributors (ODbL) · Geofabrik south-korea-latest.osm.pbf(2026-10-03) · 교차로 이름 서울 C-ITS(서울특별시 교통빅데이터플랫폼)'
def pack_json(T, extra):
    d = {'schema': 'tg-base/1', 'source': SRC, 'space': '평면 m 정수 · x = (lon-127.01)×88800 · z = -(lat-37.49)×111000 · 선/고리는 첫 점 뒤로 차분(dx,dz)',
         'flags': '1 다리 · 2 지하차도/터널 · 4 일방', 'names': T.names, 'roads': T.roads, 'water': T.water, 'waterways': T.ww, 'green': T.green, 'rail': T.rail, 'parking': T.pk, 'junctions': dedupe_j(T.jn)}
    d.update(extra); return json.dumps(d, ensure_ascii=False, separators=(',', ':'))
idx = []; tot = 0
for k, T in TILES.items():
    if not (T.roads or T.water or T.green or T.ww or T.rail): continue
    ix, iz = map(int, k.split('_'))
    s = pack_json(T, {'tile': [ix, iz], 'size': TS})
    open(os.path.join(OUTD, 't', k + '.json'), 'w', encoding='utf-8', newline='\n').write(s)
    b = len(s.encode()); tot += b; idx.append([ix, iz, b])
from shapely.ops import linemerge
for cls in ('m', 'p', 'ww', 'rail'):
    byn = {}
    for nm, g in OVL[cls]: byn.setdefault(nm, []).append(g)
    for nm, gs in byn.items():
        mg = linemerge(gs)
        for L in lines(mg):
            a = enc(list(L.simplify(OVTOL[cls]).coords))
            if len(a) < 4 or L.length < (300 if cls != 'rail' else 500): continue
            if cls in ('m', 'p'): OV.roads.setdefault(cls, []).append([OV.ni(nm), 0] + a)
            elif cls == 'ww': OV.ww.append([OV.ni(nm), 1, 0] + a)
            else: OV.rail.append([-1, 0, 0] + a)
s = pack_json(OV, {'ov': True})
open(os.path.join(OUTD, 'ov.json'), 'w', encoding='utf-8', newline='\n').write(s)
idx.sort()
json.dump({'schema': 'tg-base-index/1', 'bake': time.strftime('%Y%m%d%H%M'), 'source': SRC, 'size': TS, 'region': [LON0, LAT0, LON1, LAT1], 'ov': len(s.encode()), 'tiles': idx, 'total': tot},
          open(os.path.join(OUTD, 'index.json'), 'w', encoding='utf-8', newline='\n'), ensure_ascii=False, separators=(',', ':'))
print('tiles', len(idx), 'total', tot, 'ov', len(s.encode()), 'max', max(i[2] for i in idx), round(time.time() - t0), 's')
