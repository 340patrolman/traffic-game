# -*- coding: utf-8 -*-
# v0.10.76 관할 다시 굽기 — 소유자 현장 지식(2026-10-04): 반포본동·반포2동 = 방배서 · 반포4동은 반포대로 기준 반포2동·반포본동 쪽 = 방배서
import json, math
from shapely.geometry import shape, LineString, Polygon, MultiPolygon, mapping
from shapely.ops import split, unary_union, transform
GJ = r'C:\Users\knpth\Desktop\지식베이스\13_관할경계\원자료\hjd20260701.geojson'
ROADS = r'C:\Users\knpth\Desktop\지식베이스\traffic-game\data\maps\seocho-full-roads.json'
OUT = r'C:\Users\knpth\Desktop\지식베이스\traffic-game\data\jur-seocho.json'
dongs = {}
for line in open(GJ, encoding='utf-8'):
    if '"sgg": "11650"' not in line: continue
    ft = json.loads(line.strip().rstrip(','))
    nm = ft['properties']['adm_nm'].split('서초구 ')[-1]
    dongs[nm] = shape(ft['geometry'])
print(sorted(dongs))
# 반포대로 중심선(서초구 1:1 미터 → 위경도)
rd = json.load(open(ROADS, encoding='utf-8'))['roads']['반포대로']['pts']
ll = [((x - 2438) / 88800 + 127.0077, -(z - 1743) / 111000 + 37.4917) for x, z in rd]
# 양 끝을 1km 늘인다(동 경계를 다 가르게)
def ext(a, b, k=0.012):
    dx, dy = a[0] - b[0], a[1] - b[1]; L = math.hypot(dx, dy) or 1; return (a[0] + dx / L * k, a[1] + dy / L * k)
line = LineString([ext(ll[0], ll[1])] + ll + [ext(ll[-1], ll[-2])])
b4 = dongs['반포4동']
parts = list(split(b4, line).geoms)
print('pieces', len(parts), [round(p.area * 1e8) for p in parts])
def touch(p, nm): return p.boundary.intersection(dongs[nm].boundary.buffer(1e-6)).length
for p in parts: print(round(p.area*1e8), 'b2', round(touch(p,'반포2동')*1e5), 'bb', round(touch(p,'반포본동')*1e5), 'b1', round(touch(p,'반포1동')*1e5), 'b3', round(touch(p,'반포3동')*1e5), 'x', round(p.centroid.x,5))
json.dump({'pieces': [mapping(p) for p in parts]}, open(r'C:\Users\knpth\AppData\Local\Temp\b4pieces.json','w'))
# T-GIS 교차로의 관할 칸(NW_PE 340 서초서 · 380 방배서)으로 맞대 본다
from shapely.geometry import Point
tg = json.load(open(r'C:\Users\knpth\Desktop\지식베이스\traffic-game\data\tgis-seocho.json', encoding='utf-8'))
items = tg['items']
west = max(parts, key=lambda p: touch(p, '반포2동') - touch(p, '반포1동') - touch(p, '반포3동'))
print('west x', round(west.centroid.x, 5))
from collections import Counter
for nm in ['반포본동','반포1동','반포2동','반포3동','반포4동','방배본동','서초1동','잠원동']:
    g = dongs[nm]; c = Counter()
    for it in items:
        if g.contains(Point(it[3], it[2])):
            side = ''
            if nm == '반포4동': side = 'W' if west.buffer(1e-7).contains(Point(it[3], it[2])) else 'E'
            c[str(it[5]) + side] += 1
    print(nm, dict(c))
print('--- 반포4동 · 반포2동 340 · 반포3동 380 상세(반포대로까지 m)')
for it in items:
    pt = Point(it[3], it[2])
    for nm in ['반포4동','반포2동','반포3동']:
        if dongs[nm].contains(pt):
            if nm=='반포2동' and it[5]!=340: continue
            if nm=='반포3동' and it[5]!=380: continue
            d = line.distance(pt) * 100000
            side = 'W' if west.buffer(1e-7).contains(pt) else 'E'
            print(nm, side if nm=='반포4동' else '', it[5], it[1], round(d), 'm')
# ---- 굽기
import shapely
east = unary_union([p for p in parts if p is not west and touch(p,'반포2동') <= touch(p,'반포1동') + touch(p,'반포3동')])
westU = unary_union([p for p in parts if p not in ([q for q in parts if q is not west and touch(q,'반포2동') <= touch(q,'반포1동') + touch(q,'반포3동')])])
SEO = ['서초1동','서초2동','서초3동','서초4동','잠원동','양재1동','양재2동','내곡동','반포1동','반포3동']
BAN = ['방배본동','방배1동','방배2동','방배3동','방배4동','반포본동','반포2동']
gs = unary_union([dongs[n] for n in SEO] + [east])
gb = unary_union([dongs[n] for n in BAN] + [westU])
cov = shapely.coverage_simplify([gs, gb], 2.3e-5)
def rings(g):
    polys = [g] if g.geom_type == 'Polygon' else list(g.geoms)
    out = []
    for p in polys:
        if p.area < 1e-9: continue
        out.append([[round(x, 6), round(y, 6)] for x, y in p.exterior.coords][:-1])
        assert len(p.interiors) == 0, 'hole'
    out.sort(key=lambda r: -len(r)); return out
sl = line.intersection(b4.buffer(2e-4))
sl = [sl] if sl.geom_type == 'LineString' else list(sl.geoms)
SRC = '현장 지식(소유자 2026-10-04) — T-GIS 교차로 관할 칸(NW_PE 340·380)과 맞대 봄: 반포대로에서 300m 넘게 떨어진 반포4동 교차로 7곳(서쪽 서래마을입구·프랑스학교·방배중학교앞 = 방배서 · 동쪽 고속터미널·삼호가든·궁전가든·반포쇼핑타운 = 서초서) 모두 일치'
zones = [
 {'id':'seocho','name':'서울서초경찰서','dongs':SEO+['반포4동(반포대로 동쪽)'],
  'note':'별표2: 내곡·신원·서초·양재·염곡·우면·잠원동 + 반포동 일부(강남대로·신반포로 쪽 번지 약 760곳) — 행정동으로는 반포1동·반포3동과 반포4동 반포대로 동쪽',
  'rings':rings(cov[0])},
 {'id':'bangbae','name':'서울방배경찰서','dongs':BAN+['반포4동(반포대로 서쪽)'],
  'note':'별표2: 방배동(서초서 관할 번지 28곳 제외) + 반포동(서초서 관할 번지 제외) — 행정동으로는 반포본동·반포2동과 반포4동 반포대로 서쪽(서래마을 쪽)',
  'rings':rings(cov[1])}]
d = {'schema':'tg-jur/2','area':'서울 서초구 — 경찰서 관할(서울서초경찰서·서울방배경찰서)','coords':'wgs84 [lon, lat]',
 'law':'「경찰청과 그 소속기관 직제 시행규칙」 별표2(행정안전부령 제640호, 2026.8.31 시행 · 국가법령정보 DRF MST=289159)',
 'boundary':'통계청 SGIS 행정동 경계(가공 vuski/admdongkor ver20260701 · 공공누리 1유형 · CC BY 4.0) — 행정동을 관할로 묶어 바깥 테두리만 남김 · 공유 변을 지키며 2.5m 단순화 · 반포4동은 반포대로 중심선(OSM ODbL)으로 가름',
 'method':'별표2 는 반포동을 번지로 나눈다(경계선 공개 자료 없음). 반포동 다섯 행정동을 어느 서가 맡는지는 소유자 현장 지식(2026-10-04)으로 정하고 T-GIS 교차로 관할 칸으로 맞대 봤다. 방배동 28곳 등 번지로 섞인 곳은 여전히 선으로 못 긋는다.',
 'src':SRC,
 'split':[{'dong':'반포4동','road':'반포대로','west':'bangbae','east':'seocho','line':[[[round(x,6),round(y,6)] for x,y in g.coords] for g in sl]}],
 'stations':[{'name':'서울서초경찰서','lat':37.4957,'lon':127.0052,'addr':'서초구 반포대로 179'},{'name':'서울방배경찰서','lat':37.4818,'lon':126.9828,'addr':'서초구 동작대로 204'}],
 'zones':zones}
s = json.dumps(d, ensure_ascii=False, separators=(',', ':'))
open(OUT, 'w', encoding='utf-8', newline='\n').write(s)
print('wrote', len(s.encode('utf-8')), [ (z['id'], len(z['rings']), [len(r) for r in z['rings']]) for z in zones])
