# -*- coding: utf-8 -*-
"""교차로 활동량(v0.10.125 · T3 첫 판) — 서초 간선 교차로 25곳마다 실제 「사람·차가 얼마나 다니나」를 공공자료로 잰다.
⚠ 사고 자료는 쓰지 않는다 — 📏 게임↔실제 사고 순위 검사(E5)의 답이라, 넣으면 답을 미리 베끼는 셈이 된다.
입력: datamap data/pubdata-seocho.json(서울시 버스 정류장별 시간대 승하차 · 지하철 역별 승하차 2026.6 하루 평균)
      게임 data/traffic-vol-seocho.json(서울시 교통량 조사 7곳 — 도로별) · data/intersections-seocho.json(실제 위경도)
출력: 게임 data/node-activity-seocho.json — 교차로마다 bus(300m 안 정류장 승하차 합) · sub(500m 안 역 승하차 합) · veh(그 교차로 두 도로의 조사 교통량 평균 · 조사 지점 없는 도로는 빈칸)
      + pedK · vehK(서초 25곳 가운데값 대비 · 제곱근으로 누름 · pedK 0.5~2.0 · vehK 0.7~1.5 — 게임 설계값)."""
import io, json, math, os
HERE = os.path.dirname(os.path.abspath(__file__)); GAME = os.path.normpath(os.path.join(HERE, '..', '..')); DM = os.path.normpath(os.path.join(GAME, '..', 'datamap'))
def dist(a, b, c, d): return math.hypot((b - d) * 88800, (a - c) * 111000)
P = json.load(io.open(os.path.join(DM, 'data', 'pubdata-seocho.json'), encoding='utf-8'))
V = json.load(io.open(os.path.join(GAME, 'data', 'traffic-vol-seocho.json'), encoding='utf-8'))
X = json.load(io.open(os.path.join(GAME, 'data', 'intersections-seocho.json'), encoding='utf-8'))
road = {}
for s in V['spots']:
    if s.get('outside') or not s.get('wd'): continue
    day = sum(sum(h) for h in s['wd'])
    road.setdefault((s['axis'], s['idx']), []).append(day)
road = {k: sum(v) / len(v) for k, v in road.items()}
out = []
for n in X['nodes']:
    bus = sum(b.get('day', 0) for b in P['bus']['items'] if dist(n['lat'], n['lon'], b['lat'], b['lon']) <= 300)
    sub = sum((s.get('on', 0) + s.get('off', 0)) for s in P['subway']['items'] if dist(n['lat'], n['lon'], s['lat'], s['lon']) <= 500)
    vv = [road[k] for k in (('v', n['i']), ('h', n['j'])) if k in road]
    out.append({'i': n['i'], 'j': n['j'], 'name': n['name'], 'met': n.get('met', True), 'bus': round(bus), 'sub': round(sub), 'veh': round(sum(vv) / len(vv)) if vv else None})
def med(a): a = sorted(a); return a[len(a) // 2] if a else 1
mp = med([o['bus'] + o['sub'] for o in out if o['met']]) or 1
mv = med([o['veh'] for o in out if o['met'] and o['veh']]) or 1
for o in out:
    o['pedK'] = round(min(2.0, max(0.5, math.sqrt(max(1, o['bus'] + o['sub']) / mp))), 2)
    o['vehK'] = round(min(1.5, max(0.7, math.sqrt(o['veh'] / mv))), 2) if o['veh'] else 1.0
doc = {'schema': 'tg-node-activity/1', 'source': P['bus']['source'] + ' · ' + P['subway']['source'] + ' · ' + V.get('source', ''),
       'note': '사고 자료는 쓰지 않는다(E5 검사의 답). bus = 교차로 300m 안 정류장 하루 승하차 합 · sub = 500m 안 지하철역 하루 승하차 합 · veh = 그 교차로 두 도로의 교통량 조사 하루 합 평균(조사 지점 없는 도로는 빠짐). pedK·vehK = 서초 25곳 가운데값 대비 제곱근(게임 설계값).',
       'medPeople': mp, 'medVeh': mv, 'nodes': out}
io.open(os.path.join(GAME, 'data', 'node-activity-seocho.json'), 'w', encoding='utf-8', newline='\n').write(json.dumps(doc, ensure_ascii=False, separators=(',', ':')))
for o in out: print(o['i'], o['j'], o['name'], o['bus'], o['sub'], o['veh'], o['pedK'], o['vehK'])
