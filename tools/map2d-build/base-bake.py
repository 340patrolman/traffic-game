# -*- coding: utf-8 -*-
# 데이터 압축지도 바탕(OSM ODbL) — 도로 전부·물·녹지·철도·주차장을 미터(평면) 정수·차분으로 굽는다
import json
from shapely.geometry import LineString, Polygon, box
from shapely.ops import polygonize, unary_union
d = json.load(open('osm.json', encoding='utf-8'))
def P(lon, lat): return ((lon - 127.01) * 88800, -(lat - 37.49) * 111000)
# v0.10.82 — 서초구와 맞닿은 곳(세곡동·헌릉로 끝·과천·성남 수정구)까지 넓혔다. 서초 둘레(IN) 밖은 보행·자전거·단지길을 빼 무게를 줄인다
x0, z0 = P(126.935, 37.535); x1, z1 = P(127.135, 37.395)
BB = box(x0, z0, x1, z1)
ix0, iz0 = P(126.955, 37.525); ix1, iz1 = P(127.085, 37.425)
IN = box(ix0, iz0, ix1, iz1)
FINE = ('f', 'c', 'v')
RC = {'motorway': 'm', 'trunk': 'm', 'primary': 'p', 'secondary': 's', 'tertiary': 't', 'unclassified': 'r', 'residential': 'r', 'living_street': 'r',
      'motorway_link': 'l', 'trunk_link': 'l', 'primary_link': 'l', 'secondary_link': 'l', 'tertiary_link': 'l', 'service': 'v',
      'pedestrian': 'f', 'footway': 'f', 'cycleway': 'c', 'path': 'f', 'steps': 'f'}
TOL = {'m': 1.5, 'p': 1.5, 's': 1.5, 't': 1.5, 'r': 1.5, 'l': 1.5, 'v': 2, 'f': 2.5, 'c': 2, 'rail': 3, 'ww': 2, 'water': 2.5, 'green': 3, 'pk': 2}
names = []; NI = {}
def ni(n):
    if not n: return -1
    if n not in NI: NI[n] = len(names); names.append(n)
    return NI[n]
def enc(coords):
    out = []; px = pz = 0; first = True
    for (x, z) in coords:
        X, Z = int(round(x)), int(round(z))
        if not first and X == px and Z == pz: continue
        out += [X, Z] if first else [X - px, Z - pz]; px, pz = X, Z; first = False
    return out
def lines(geom):
    if geom.is_empty: return []
    if geom.geom_type == 'LineString': return [geom]
    return [g for g in getattr(geom, 'geoms', []) if g.geom_type == 'LineString']
def polys(geom):
    if geom.is_empty: return []
    if geom.geom_type == 'Polygon': return [geom]
    return [g for g in getattr(geom, 'geoms', []) if g.geom_type == 'Polygon']
def ringsOf(pg, tol):
    pg = pg.simplify(tol, preserve_topology=True); out = []
    for p in polys(pg):
        if p.area < 60: continue
        out.append([enc(list(p.exterior.coords)[:-1])] + [enc(list(h.coords)[:-1]) for h in p.interiors if Polygon(h).area > 60])
    return out
def GREEN(t):
    if t.get('leisure') in ('park', 'garden', 'playground', 'pitch', 'golf_course'): return t['leisure']
    if t.get('landuse') in ('forest', 'grass', 'recreation_ground', 'cemetery'): return t['landuse']
    if t.get('natural') in ('wood', 'scrub', 'grassland'): return t['natural']
    return None
R = {}; W = []; WA = []; G = []; RL = []; PK = []
for e in d['elements']:
    t = e.get('tags', {})
    if e['type'] == 'way':
        g = [P(q['lon'], q['lat']) for q in e.get('geometry', [])]
        if len(g) < 2: continue
        hw = t.get('highway')
        if hw in RC:
            c = RC[hw]
            fl = (1 if t.get('bridge') else 0) | (2 if (t.get('tunnel') or t.get('layer', '0').startswith('-')) else 0) | (4 if t.get('oneway') == 'yes' else 0)
            for L in lines(LineString(g).intersection(IN if c in FINE else BB)):
                a = enc(list(L.simplify(TOL[c]).coords))
                if len(a) >= 4: R.setdefault(c, []).append([ni(t.get('name')), fl] + a)
            continue
        if t.get('waterway') in ('river', 'stream', 'drain', 'ditch', 'canal'):
            for L in lines(LineString(g).intersection(BB)):
                a = enc(list(L.simplify(TOL['ww']).coords))
                if len(a) >= 4: W.append([ni(t.get('name')), 1 if t['waterway'] == 'river' else 0, 2 if t.get('tunnel') else 0] + a)
            continue
        if t.get('railway') in ('rail', 'subway', 'light_rail'):
            for L in lines(LineString(g).intersection(BB)):
                a = enc(list(L.simplify(TOL['rail']).coords))
                if len(a) >= 4: RL.append([ni(t.get('name')), 1 if t['railway'] == 'subway' else 0, 2 if (t.get('tunnel') or t.get('layer', '0').startswith('-')) else 0] + a)
            continue
        if not (len(g) >= 4 and g[0] == g[-1]): continue
        pg = Polygon(g)
        if not pg.is_valid: pg = pg.buffer(0)
        pg = pg.intersection(BB)
        if t.get('natural') == 'water':
            for rr in ringsOf(pg, TOL['water']): WA.append([ni(t.get('name')), rr])
        elif GREEN(t):
            for rr in ringsOf(pg, TOL['green']): G.append([ni(t.get('name')), GREEN(t), rr])
        elif t.get('amenity') == 'parking':
            for rr in ringsOf(pg, TOL['pk']): PK.append(rr)
    elif e['type'] == 'relation':
        outer = [LineString([P(q['lon'], q['lat']) for q in m['geometry']]) for m in e.get('members', []) if m.get('type') == 'way' and m.get('geometry') and m.get('role') != 'inner']
        inner = [LineString([P(q['lon'], q['lat']) for q in m['geometry']]) for m in e.get('members', []) if m.get('type') == 'way' and m.get('geometry') and m.get('role') == 'inner']
        if not outer: continue
        pg = unary_union(list(polygonize(unary_union(outer))))
        if inner: pg = pg.difference(unary_union(list(polygonize(unary_union(inner)))))
        pg = pg.buffer(0).intersection(BB)
        if t.get('natural') == 'water':
            for rr in ringsOf(pg, TOL['water']): WA.append([ni(t.get('name')), rr])
        elif GREEN(t):
            for rr in ringsOf(pg, TOL['green']): G.append([ni(t.get('name')), GREEN(t), rr])
# 교차로 이름 — 서울 C-ITS(연등 제외) 먼저, 그다음 OSM 이름 있는 교차로·신호 노드(과천·성남은 OSM 만). 같은 이름 150m · 다른 이름 25m 안은 하나
JN = []
def jadd(nm, lon, lat):
    nm = (nm or '').strip()
    if not nm or '연등' in nm: return
    x, z = P(lon, lat)
    if not (x0 <= x <= x1 and z0 <= z <= z1): return
    for q in JN:
        dd = (q[1] - x) ** 2 + (q[2] - z) ** 2
        if dd < 625 or (q[0] == nm and dd < 22500): return
    JN.append([nm, int(round(x)), int(round(z))])
for l in open(r'C:\Users\knpth\Desktop\지식베이스\07_API키\신호앱\data\cits_cross_2779_20260910.txt', encoding='utf-8'):
    f = l.strip().split('|')
    if len(f) >= 4: jadd(f[1], float(f[3]), float(f[2]))
nC = len(JN)
for e in json.load(open('junc.json', encoding='utf-8'))['elements']:
    jadd(e.get('tags', {}).get('name'), e['lon'], e['lat'])
out = {'schema': 'tg-base/1', 'source': '© OpenStreetMap contributors (ODbL) · Overpass 2026-10-04 수집',
       'space': '평면 m 정수 · x = (lon-127.01)×88800 · z = -(lat-37.49)×111000 · 선/고리는 첫 점 뒤로 차분(dx,dz)',
       'roadClass': {'m': '고속·도시고속', 'p': '주간선', 's': '보조간선', 't': '집산', 'r': '국지·주거', 'l': '연결로', 'v': '단지·서비스', 'f': '보행', 'c': '자전거'},
       'flags': '1 다리 · 2 지하차도/터널 · 4 일방',
       'names': names, 'roads': R, 'junctions': JN,
       'junctionsNote': '교차로 이름 — 서울 C-ITS 교차로 지도정보(서울특별시 교통빅데이터플랫폼 · 2026-09-10 · 연등 제외) + OSM 이름 있는 교차로·신호 노드(Overpass 2026-10-04) — 서초·강남·동작·관악·과천·성남 수정구(과천·성남은 OSM 만)',
       'extent': '위도 37.395~37.535 · 경도 126.935~127.135 — 서초 둘레(위도 37.425~37.525 · 경도 126.955~127.085) 밖은 보행·자전거·단지길 없음', 'water': WA, 'waterways': W, 'green': G, 'rail': RL, 'parking': PK}
s = json.dumps(out, ensure_ascii=False, separators=(',', ':'))
open(r'C:\Users\knpth\Desktop\지식베이스\traffic-game\data\base-seocho.json', 'w', encoding='utf-8', newline='\n').write(s)
print(len(s.encode()), {k: len(v) for k, v in R.items()}, 'water', len(WA), 'ww', len(W), 'green', len(G), 'rail', len(RL), 'pk', len(PK), 'names', len(names), 'junctions', nC, len(JN) - nC)
