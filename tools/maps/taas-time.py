# -*- coding: utf-8 -*-
"""지금 이 시각 실제 사고(v0.10.120) — 서초 교차로 25곳 둘레의 TAAS 사고 10년(2016~2025)을 시간대로 묶는다.
입력: datamap data/taas10-seocho.json(100m 칸 · 해마다 · 6시간대 4 · 밤 · 보행자 · 주 법규위반 · 사망사고 한 건씩 연·월·요일·시)
      게임 data/intersections-seocho.json(실제 위경도)
출력: 게임 data/taas-time-seocho.json — 교차로마다 둘레 R m 안 칸 합(띠 4 · 10년 합 · 사망자 · 보행자 · 밤) · 주 법규위반(칸의 주 위반 × 그 건수 합 — 근사) · 사망사고(요일·시)
칸 가운데가 R 안이면 그 칸 전부를 센다(100m 칸이라 근사). 한 칸은 가장 가까운 교차로 하나에만 더한다(두 번 세지 않음)."""
import io, json, math, os
HERE = os.path.dirname(os.path.abspath(__file__)); GAME = os.path.normpath(os.path.join(HERE, '..', '..')); DM = os.path.normpath(os.path.join(GAME, '..', 'datamap'))
R = 150
def dist(a, b, c, d): return math.hypot((b - d) * 88800, (a - c) * 111000)
T = json.load(io.open(os.path.join(DM, 'data', 'taas10-seocho.json'), encoding='utf-8'))
X = json.load(io.open(os.path.join(GAME, 'data', 'intersections-seocho.json'), encoding='utf-8'))
nodes = [n for n in X['nodes'] if n.get('met', True)]
VN = T['dic'].get('v', {})
acc = {}
for n in nodes: acc[(n['i'], n['j'])] = {'i': n['i'], 'j': n['j'], 'name': n['name'], 'tot': 0, 'band': [0, 0, 0, 0], 'dead': 0, 'ser': 0, 'ped': 0, 'night': 0, 'viol': {}, 'fatal': []}
def near(lat, lon):
    b, bd = None, R
    for n in nodes:
        d = dist(lat, lon, n['lat'], n['lon'])
        if d <= bd: b, bd = n, d
    return b
for c in T['cells']:
    n = near(c[0], c[1])
    if not n: continue
    a = acc[(n['i'], n['j'])]
    a['tot'] += sum(c[2:12]); a['dead'] += c[12]; a['ser'] += c[13]; a['ped'] += c[14]; a['night'] += c[18]
    for k in range(4): a['band'][k] += c[19 + k]
    vc = c[23]
    if vc: a['viol'][vc] = a['viol'].get(vc, 0) + (c[24] or 0)
for f in T['fatal']:
    n = near(f[16], f[17])
    if not n: continue
    acc[(n['i'], n['j'])]['fatal'].append([f[0], f[2], f[3], f[5], f[6]])
out = []
for a in acc.values():
    v = sorted(a['viol'].items(), key=lambda kv: -kv[1])[:3]
    a['viol'] = [[VN.get(k, k), m] for k, m in v]
    out.append(a)
out.sort(key=lambda a: (a['i'], a['j']))
doc = {'schema': 'tg-taas-time/1', 'source': T['source'], 'years': '2016~2025', 'radius': R,
       'bands': ['0~6시', '6~12시', '12~18시', '18~24시'], 'dow': T['dow'], 'dic': {'t': T['dic'].get('t', {}), 'v': VN},
       'note': '교차로 둘레 ' + str(R) + 'm 안 100m 칸 합(칸 가운데 기준 · 한 칸은 가장 가까운 교차로 하나에만) — 근사. 주 법규위반은 칸마다 가장 많은 위반의 건수 합. 사망사고 [해, 요일(1 월…7 일), 시, 사고유형, 법규위반]. 개인정보 없음(원자료에서 이미 버림).',
       'nodes': out}
io.open(os.path.join(GAME, 'data', 'taas-time-seocho.json'), 'w', encoding='utf-8', newline='\n').write(json.dumps(doc, ensure_ascii=False, separators=(',', ':')))
for a in out: print(a['i'], a['j'], a['tot'], a['band'], a['dead'], len(a['fatal']), a['viol'][:1])
