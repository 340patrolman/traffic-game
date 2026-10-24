# -*- coding: utf-8 -*-
"""같은 자리 열쇠(v0.10.119) — 게임 교차로 25곳(격자 i,j)에 경찰 T-GIS 교차로 코드를 붙인다.
입력: 게임 data/intersections-seocho.json(실제 위경도) · datamap data/tgis-seocho.json(T-GIS 코드·위경도)
출력: 게임 data/intersections-seocho.json 의 각 노드에 tgis·tgisName·tgisM(거리 m) 칸
      datamap data/place-keys-seocho.json(지도 → 게임 「여기서 근무해 보기」가 읽는 작은 표)
규칙: 연등(종속 신호)이 아닌 신호 중 가장 가까운 것 · 80m 넘으면 붙이지 않는다(실제로 안 만나는 쌍 등)."""
import io, json, math, os
HERE = os.path.dirname(os.path.abspath(__file__))
GAME = os.path.normpath(os.path.join(HERE, '..', '..'))
DM = os.path.normpath(os.path.join(GAME, '..', 'datamap'))
def dist(a, b, c, d):
    return math.hypot((b - d) * 88800, (a - c) * 111000)
X = json.load(io.open(os.path.join(GAME, 'data', 'intersections-seocho.json'), encoding='utf-8'))
T = json.load(io.open(os.path.join(DM, 'data', 'tgis-seocho.json'), encoding='utf-8'))['items']
main = [t for t in T if not t[4] or t[4] == t[0]]
keys = []
for n in X['nodes']:
    best, bd = None, 1e9
    for t in main:
        d = dist(n['lat'], n['lon'], t[2], t[3])
        if d < bd: best, bd = t, d
    if best and bd <= 80 and n.get('met', True):
        n['tgis'] = best[0]; n['tgisName'] = best[1]; n['tgisM'] = round(bd)
    else:
        for k in ('tgis', 'tgisName', 'tgisM'): n.pop(k, None)
    keys.append({'i': n['i'], 'j': n['j'], 'name': n['name'], 'lat': n['lat'], 'lon': n['lon'], 'met': n.get('met', True), 'tgis': n.get('tgis'), 'cits': n.get('sigNo')})
X['keys'] = '격자 i,j ↔ 실제 위경도 ↔ T-GIS 교차로코드(tgis) ↔ C-ITS 신호번호(sigNo) — tools/maps/place-keys.py'
io.open(os.path.join(GAME, 'data', 'intersections-seocho.json'), 'w', encoding='utf-8', newline='\n').write(json.dumps(X, ensure_ascii=False, separators=(',', ':')))
out = {'schema': 'tg-place-keys/1', 'about': '게임 SEOUL PATROL 의 서초 간선 교차로 25곳 — 지도 카드에서 「🚓 여기서 근무해 보기」가 이 표로 가장 가까운 게임 교차로를 고른다(700m 안)',
       'game': 'https://340patrolman.github.io/traffic-game/', 'source': '게임 data/intersections-seocho.json(OSM·C-ITS) + 서울시 T-GIS 교차로', 'nodes': keys}
io.open(os.path.join(DM, 'data', 'place-keys-seocho.json'), 'w', encoding='utf-8', newline='\n').write(json.dumps(out, ensure_ascii=False, separators=(',', ':')))
print(sum(1 for k in keys if k['tgis']), '/', len(keys), 'T-GIS 붙음')
for k in keys: print(k['i'], k['j'], k['name'], k['tgis'], k['met'])
