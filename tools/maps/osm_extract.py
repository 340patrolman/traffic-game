# -*- coding: utf-8 -*-
# 정밀 구역 지도용 OSM 뽑기 — 로컬 kr.pbf(Geofabrik south-korea)에서 상자 안 간선·버스길·건물·지하철 출입구·횡단보도를 뽑는다(네트워크 0).
#   py -3.12 -X utf8 tools/maps/osm_extract.py <이름> <남위도> <서경도> <북위도> <동경도>
#   → ../07_API키/out/osm_<이름>/osm.json  {roads:[{name,hw,lanes,oneway,pts:[[lat,lon]..]}], buildings:[{n,lv,p:[[lat,lon]..]}], exits:[[lat,lon,ref]], crossings:[[lat,lon,signals]]}
import sys, os, json, osmium
PBF = 'C:/Users/knpth/osmwork/kr.pbf'
name, S, W, N, E = sys.argv[1], *map(float, sys.argv[2:6])
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))), '07_API키', 'out', 'osm_' + name)
os.makedirs(OUT, exist_ok=True)
HW = {'trunk', 'primary', 'secondary', 'tertiary', 'trunk_link', 'primary_link', 'secondary_link', 'busway', 'unclassified', 'residential'}
def inb(la, lo): return S <= la <= N and W <= lo <= E
roads, bld, exits, xing = [], [], [], []
fp = osmium.FileProcessor(PBF).with_locations()
for o in fp:
    if o.is_node():
        t = o.tags
        if not o.location.valid() or not inb(o.location.lat, o.location.lon): continue
        if t.get('railway') == 'subway_entrance': exits.append([round(o.location.lat, 7), round(o.location.lon, 7), t.get('ref', '')])
        elif t.get('highway') == 'crossing': xing.append([round(o.location.lat, 7), round(o.location.lon, 7), 1 if t.get('crossing') == 'traffic_signals' else 0])
        continue
    if not o.is_way(): continue
    t = o.tags
    try: pts = [[round(n.location.lat, 7), round(n.location.lon, 7)] for n in o.nodes]
    except Exception: continue
    if not pts or not any(inb(p[0], p[1]) for p in pts): continue
    if t.get('highway') in HW:
        roads.append({'id': o.id, 'name': t.get('name', ''), 'hw': t.get('highway'), 'lanes': t.get('lanes', ''), 'oneway': t.get('oneway', ''), 'pts': pts})
    elif 'building' in t:
        lv = t.get('building:levels', '')
        try: lv = int(float(lv))
        except Exception: lv = 0
        bld.append({'n': t.get('name', ''), 'lv': lv, 'p': pts})
json.dump({'bbox': [S, W, N, E], 'pbf': PBF, 'roads': roads, 'buildings': bld, 'exits': exits, 'crossings': xing}, open(os.path.join(OUT, 'osm.json'), 'w', encoding='utf-8'), ensure_ascii=False)
print('roads', len(roads), 'buildings', len(bld), 'exits', len(exits), 'crossings', len(xing), '->', OUT)
