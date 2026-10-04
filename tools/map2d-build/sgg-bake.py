# -*- coding: utf-8 -*-
# 시·군·구 경계(v0.10.90) — 서울 25 · 경기 31(+인천 10 · 지도 안내용) · 「📥 지역 받기」 기준
# 원자료: 13_관할경계/원자료/hjd20260701.geojson (통계청 SGIS 행정동 · vuski/admdongkor · 공공누리 1유형) — 행정동을 시·군·구로 합침
import json, os
from shapely.geometry import shape
from shapely.ops import unary_union
KB = r'C:\Users\knpth\Desktop\지식베이스'
def P(lon, lat): return ((lon - 127.01) * 88800, -(lat - 37.49) * 111000)
G = {}
for l in open(os.path.join(KB, '13_관할경계', '원자료', 'hjd20260701.geojson'), encoding='utf-8'):
    if '"adm_cd2"' not in l: continue
    try: f = json.loads(l.strip().rstrip(','))
    except Exception: continue
    pr = f['properties']
    if pr['sido'] not in ('11', '41', '28'): continue
    nm = pr['sggnm']
    # 경기 일반구는 시로 묶는다(수원시장안구 → 수원시) · 화면에는 시 이름
    if pr['sido'] == '41':
        import re
        m = re.match(r'^(\S+?시)\S*구$', nm)
        if m: nm = m.group(1)
    k = (pr['sidonm'], nm)
    G.setdefault(k, []).append(shape(f['geometry']).buffer(0))
out = []
for (sd, nm), gs in sorted(G.items()):
    u = unary_union(gs).buffer(0)
    polys = [u] if u.geom_type == 'Polygon' else list(u.geoms)
    rings = []
    for pg in sorted(polys, key=lambda g: -g.area):
        if pg.area < 3e-6: continue
        e = pg.simplify(0.0008).exterior
        rings.append([[round(x, 5), round(y, 5)] for x, y in e.coords])
    c = u.representative_point()
    b = u.bounds
    x0, z1 = P(b[0], b[1]); x1, z0 = P(b[2], b[3])
    out.append({'sido': sd, 'name': nm, 'c': [round(c.x, 5), round(c.y, 5)], 'box': [round(x0), round(z0), round(x1), round(z1)], 'rings': rings})
d = {'schema': 'tg-sgg/1', 'source': '통계청 SGIS 행정동 경계(가공 vuski/admdongkor ver20260701 · 공공누리 1유형) — 행정동을 시·군·구로 합침 · 경기 일반구는 시로', 'coords': 'wgs84 [lon, lat] · box = 평면 m', 'sgg': out}
s = json.dumps(d, ensure_ascii=False, separators=(',', ':'))
open(os.path.join(KB, 'traffic-game', 'data', 'base', 'sgg.json'), 'w', encoding='utf-8', newline='\n').write(s)
import collections
print(len(out), collections.Counter(o['sido'] for o in out), len(s.encode()))
