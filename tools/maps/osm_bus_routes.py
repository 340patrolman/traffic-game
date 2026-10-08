# -*- coding: utf-8 -*-
# 정류장마다 지나는 버스 노선 수 — OSM route=bus 관계의 정류장 구성원(stop·platform 노드)을 세어 근사한다(서울 버스 조회 API 승인이 없을 때).
#   py -3.12 -X utf8 tools/maps/osm_bus_routes.py <이름> <남> <서> <북> <동>
#   → ../07_API키/out/osm_<이름>/bus_routes.json  {nodes:{id:[lat,lon,name,ref]}, routes:{nodeId:[[ref, network, operator], ...]}}
import sys, os, json, osmium
PBF = 'C:/Users/knpth/osmwork/kr.pbf'
name, S, W, N, E = sys.argv[1], *map(float, sys.argv[2:6])
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))), '07_API키', 'out', 'osm_' + name)
os.makedirs(OUT, exist_ok=True)
nodes = {}
for o in osmium.FileProcessor(PBF, osmium.osm.NODE):
    t = o.tags
    if not (t.get('highway') == 'bus_stop' or t.get('public_transport') in ('platform', 'stop_position')): continue
    if not o.location.valid(): continue
    la, lo = o.location.lat, o.location.lon
    if S <= la <= N and W <= lo <= E: nodes[o.id] = [round(la, 7), round(lo, 7), t.get('name', ''), t.get('ref', '')]
print('정류장 노드', len(nodes), flush=True)
routes = {}
for o in osmium.FileProcessor(PBF, osmium.osm.RELATION):
    t = o.tags
    if t.get('type') != 'route' or t.get('route') != 'bus': continue
    for m in o.members:
        if m.type == 'n' and m.ref in nodes:
            routes.setdefault(str(m.ref), []).append([t.get('ref', ''), t.get('network', ''), t.get('operator', ''), t.get('name', '')])
json.dump({'pbf': PBF, 'nodes': {str(k): v for k, v in nodes.items()}, 'routes': routes}, open(os.path.join(OUT, 'bus_routes.json'), 'w', encoding='utf-8'), ensure_ascii=False)
print('노선이 붙은 정류장 노드', len(routes), '->', OUT)
