# -*- coding: utf-8 -*-
"""도로 구간(교차로 사이 단일로)별 실제 사고(ROADMAP 「③ 지표 = 분자÷분모」 셋째 판 · v0.10.133)

구간: 서초 간선 10개(OSM 중심선 · data/maps/seocho-full-roads.json)를 교차로 25곳(data/intersections-seocho.json 실제 위경도) 사이로 자른 40구간.
분자: TAAS 2016~2025 100m 칸(../datamap/data/r/<구>/taas10.json — 서초·강남·동작·관악 · 같은 칸은 한 번만)의 칸 가운데가
      어느 간선에서 60m 안이면 가장 가까운 간선 하나에 붙이고, 그 간선 위 자리(길이 좌표)가 교차로에서 80m 넘게 떨어진 것만 단일로 구간에 넣는다
      (교차로 둘레 80m 안은 교차로 몫 · 교차로 지표(150m)와 기준이 다르다).
분모: 구간 길이(교차로 둘레 80m 씩 뺀 단일로 길이) · 교통량 조사가 있는 도로는 그 조사 지점이 붙은 교차로의 두 구간에만 하루 교통량(평일 · 두 방향 합).
나오는 값: 한 해 평균 · 단일로 1km 당 한 해 · 사망자 · 중상자 · 보행자 · 밤 · 해마다 · 주 법규위반 · (교통량 있으면) 100만 대·km 당.

⚠ 칸 가운데 기준이라 도로에서 50m 안팎 칸은 근사 · 나란한 이면도로 사고가 섞일 수 있다 · 사고 자료는 시뮬 입력에 쓰지 않는다(교정의 답).
출력: data/seg-risk-seocho.json (schema tg-seg-risk/1)
"""
import io, json, math, os

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DM = os.path.join(os.path.dirname(ROOT), 'datamap', 'data')
GUS = ['11650', '11680', '11590', '11620']
NEAR = 60.0       # 칸 가운데 ↔ 간선 중심선 (m)
CUT = 80.0        # 교차로 둘레 (m) — 단일로에서 뺌
MINKM = 0.3       # 단일로가 이보다 짧으면 1km 당 값을 내지 않는다(작은 분모에 흔들린다)


def m_of(lat, lon):
    return ((lon - 127.0077) * 88800 + 2438, -(lat - 37.4917) * 111000 + 1743)


def proj(pts, cum, x, z):
    """폴리라인 위 가장 가까운 점 — (거리, 길이 좌표)"""
    best = (1e18, 0.0)
    for k in range(len(pts) - 1):
        ax, az = pts[k]; bx, bz = pts[k + 1]
        dx, dz = bx - ax, bz - az; L2 = dx * dx + dz * dz
        t = 0.0 if L2 == 0 else max(0.0, min(1.0, ((x - ax) * dx + (z - az) * dz) / L2))
        px, pz = ax + dx * t, az + dz * t
        d = math.hypot(x - px, z - pz)
        if d < best[0]:
            best = (d, cum[k] + t * math.sqrt(L2))
    return best


def main():
    roads = json.load(io.open(os.path.join(ROOT, 'data', 'maps', 'seocho-full-roads.json'), encoding='utf-8'))['roads']
    ints = json.load(io.open(os.path.join(ROOT, 'data', 'intersections-seocho.json'), encoding='utf-8'))
    grid = json.load(io.open(os.path.join(ROOT, 'data', 'maps', 'seocho-full.json'), encoding='utf-8'))
    rnV = grid.get('roadNamesV') or ['동작대로', '방배로', '반포대로', '서초중앙로', '강남대로']
    rnH = grid.get('roadNamesH') or ['신반포로', '사평대로', '서초대로', '효령로', '남부순환로']
    vol = json.load(io.open(os.path.join(ROOT, 'data', 'traffic-vol-seocho.json'), encoding='utf-8'))
    node = {}
    for n in ints['nodes']:
        node[(n['i'], n['j'])] = n
    R = {}
    for nm, r in roads.items():
        pts = r['pts']; cum = [0.0]
        for k in range(1, len(pts)):
            cum.append(cum[-1] + math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]))
        R[nm] = {'pts': pts, 'cum': cum}
    # 구간
    segs = []
    for axis, names in (('v', rnV), ('h', rnH)):
        for idx, nm in enumerate(names):
            if nm not in R:
                continue
            rr = R[nm]; ss = []
            for k in range(5):
                a = node[(idx, k)] if axis == 'v' else node[(k, idx)]
                x, z = m_of(a['lat'], a['lon'])
                d, s = proj(rr['pts'], rr['cum'], x, z)
                ss.append((s, d, a))
            for k in range(4):
                s0, d0, a = ss[k]; s1, d1, b = ss[k + 1]
                lo, hi = min(s0, s1), max(s0, s1)
                segs.append({'id': axis + str(idx) + '-' + str(k), 'axis': axis, 'idx': idx, 'k': k, 'road': nm,
                             'from': a['name'], 'to': b['name'], 'lo': lo, 'hi': hi,
                             'lenM': round(hi - lo), 'netM': round(max(0.0, hi - lo - 2 * CUT)),
                             'snapM': round(max(d0, d1)), 'acc': 0, 'y': [0] * 10, 'dead': 0, 'sev': 0, 'ped': 0,
                             'night': 0, 'moto': 0, 'bike': 0, 'pm': 0, '_v': {}})
    byRoad = {}
    for s in segs:
        byRoad.setdefault(s['road'], []).append(s)
    # 칸
    seen = set(); cells = []; dicv = {}
    for g in GUS:
        p = os.path.join(DM, 'r', g, 'taas10.json')
        if not os.path.exists(p):
            continue
        t = json.load(io.open(p, encoding='utf-8'))
        dicv.update(t['dic']['v'])
        for c in t['cells']:
            cells.append(c)   # 구마다 그 구(법정동)에서 난 사고만 — 경계에 걸친 칸은 두 파일에 나뉘어 있으므로 더한다
    used = 0; usedN = 0
    for c in cells:
        x, z = m_of(c[0], c[1])
        best = None
        for nm, rr in R.items():
            d, s = proj(rr['pts'], rr['cum'], x, z)
            if d <= NEAR and (best is None or d < best[0]):
                best = (d, s, nm)
        if not best:
            continue
        d, s, nm = best
        for sg in byRoad.get(nm, []):
            if sg['lo'] + CUT < s < sg['hi'] - CUT:
                n = sum(c[2:12]); sg['acc'] += n; used += n; usedN += 1
                for k in range(10):
                    sg['y'][k] += c[2 + k]
                sg['dead'] += c[12]; sg['sev'] += c[13]; sg['ped'] += c[14]; sg['bike'] += c[15]; sg['pm'] += c[16]; sg['moto'] += c[17]; sg['night'] += c[18]
                if c[23]:
                    sg['_v'][c[23]] = sg['_v'].get(c[23], 0) + c[24]
                break
    # 교통량 — 조사 지점이 붙은 교차로의 두 구간
    for sp in vol['spots']:
        if str(sp.get('outside')) in ('True', 'true', '1'):
            continue
        ij = json.loads(sp['node']) if isinstance(sp['node'], str) else sp['node']
        wd = json.loads(sp['wd']) if isinstance(sp['wd'], str) else sp['wd']
        day = sum(a + b for a, b in wd)
        k0 = ij[1] if sp['axis'] == 'v' else ij[0]
        for sg in segs:
            if sg['axis'] == sp['axis'] and sg['idx'] == int(sp['idx']) and sg['k'] in (k0 - 1, k0):
                sg['vol'] = day; sg['volSpot'] = sp['name']
    out = []
    for sg in segs:
        vv = sorted(sg.pop('_v').items(), key=lambda q: -q[1])
        sg['viol'] = [[dicv.get(k, k), n] for k, n in vv if dicv.get(k, '기타') != '기타'][:3]
        yr = sg['acc'] / 10.0
        sg['perYr'] = round(yr, 1)
        km = sg['netM'] / 1000.0
        sg['perKm'] = round(yr / km, 1) if km >= MINKM else None
        sg['approx'] = sg['snapM'] > NEAR
        if sg.get('vol') and km >= MINKM:
            sg['mvk'] = round(yr * 1e6 / (sg['vol'] * 365 * km), 2)
        sg['lo'] = round(sg['lo']); sg['hi'] = round(sg['hi'])
        out.append(sg)
    rk = sorted([s for s in out if s['perKm'] is not None], key=lambda s: -s['perKm'])
    for i, s in enumerate(rk):
        s['rank'] = i + 1
    res = {
        'schema': 'tg-seg-risk/1',
        'source': {
            'acc': 'TAAS 교통사고분석시스템 GIS 사고분석 2016~2025(서초·강남·동작·관악 100m 칸 · ../datamap/data/r/<구>/taas10.json)',
            'road': 'OpenStreetMap(ODbL) 간선 중심선 · data/maps/seocho-full-roads.json',
            'node': '교차로 실제 위경도 · data/intersections-seocho.json',
            'vol': '서울시 교통량 조사(평일 2026-09-15·16 평균 · 두 방향 합) · data/traffic-vol-seocho.json',
        },
        'years': '2016~2025', 'near': NEAR, 'cut': CUT,
        'method': '칸 가운데가 간선 %dm 안이면 가장 가까운 간선 하나에 · 교차로 둘레 %dm 는 빼고 단일로 구간에 · 한 해 = 10년 ÷ 10 · 1km 당 = 한 해 ÷ 단일로 길이 · 100만 대·km 당 = 한 해 × 100만 ÷ (하루 교통량 × 365 × 단일로 km)' % (NEAR, CUT),
        'note': '끝 교차로가 실제로 간선과 안 만나면(approx) 구간 끝은 가장 가까운 간선 위 점 · 단일로 300m 미만은 1km 당 값을 내지 않는다 · 칸 가운데 기준 근사(나란한 이면도로 사고가 섞일 수 있음) · 교통량은 조사 지점이 붙은 교차로의 두 구간에만 · 교차로 지표(둘레 150m)와 기준이 다르다 · 인과가 아니라 먼저 볼 순서 · 공식 위험도 아님 · 시뮬 입력에 쓰지 않는다',
        'cellsUsed': usedN, 'accUsed': used, 'ranked': len(rk),
        'segs': out,
    }
    io.open(os.path.join(ROOT, 'data', 'seg-risk-seocho.json'), 'w', encoding='utf-8', newline='\n').write(json.dumps(res, ensure_ascii=False, separators=(',', ':')) + '\n')
    print('segs', len(out), 'ranked', len(rk), 'cells', usedN, 'acc', used)
    for s in rk[:12]:
        print(s['rank'], s['road'], s['from'], '-', s['to'], s['netM'], s['perYr'], s['perKm'], s.get('mvk'), s['snapM'], s['viol'][:2])
    for s in out:
        if s['perKm'] is None:
            print('짧음', s['road'], s['from'], '-', s['to'], s['lenM'], s['snapM'])


if __name__ == '__main__':
    main()
