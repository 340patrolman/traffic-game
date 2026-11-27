# 🛣 실제 교차로 여건 굽기(v0.10.162) — 서울시 교통안전시설물(서울열린데이터광장 · 서울특별시 교통운영과 · 이용허락 제한 없음)
#  소유자(2026-11-28): 「달리다 보면 실제 도로 교차로 여건 등이 너무 차이가 난다. T-GIS 의 지도 검색·확대를 하면 도로 모양·시설물·차로 등이 다 나온다 — 참고해서 반영하자」.
#  T-GIS 화면은 손으로 옮기지 않는다. 같은 원자료(교통안전시설물 테이블)가 서울열린데이터광장에 shp 로 공개돼 있다:
#   A058_L 차선(OA-15537) · A055_P 방향표시(OA-15536 · 노면 화살표) · A004_A 횡단보도(OA-15554). 좌표 EPSG:5186.
#  지도마다 격자 교차로의 접근로(진행 방향 d)별로 잰다:
#   use  — 정지선 앞 노면 화살표를 차로별로(1차로부터) 「L·S·R·U」 묶음 — 예 ['U','L','L','S','S','S','SR']
#   stop — 교차로 가운데에서 정지선까지(m) · cw — 횡단보도 가운데까지(m)
#   (구간 가운데 차로 수는 단면 하나로 못 믿어 이번 판은 굽지 않는다 — 중앙분리대·버스차로·곁길이 섞인다)
#  쓰는 법: py -3.12 -X utf8 tools/tgis-bake.py <원자료 폴더> <지도 id>...   → data/maps/<id>.json 의 "tgis" 칸을 다시 쓴다.
#  원자료 폴더 = 위 세 zip 을 푼 곳(A058_L/A058_L.shp · A055/A055_P.shp · A004_A_횡단보도/A004_A.shp). 저장소에는 원자료를 넣지 않는다.
#  ⚠ 차선·횡단보도 자료의 마지막 기록은 2021 년이다(방향표시는 2026-09) — 그 뒤 바뀐 곳은 T-GIS 화면과 맞대 고친다(fix 칸).
import sys, os, json, math, site
sys.path.append(site.getusersitepackages())
import shapefile
from pyproj import Transformer
from collections import Counter

SRC, IDS = sys.argv[1], sys.argv[2:]
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
T = Transformer.from_crs(5186, 4326, always_xy=True)
INV = Transformer.from_crs(4326, 5186, always_xy=True)
KIND = {'005': 'L', '006': 'R', '007': 'S', '008': 'SL', '009': 'SR', '010': 'U', '011': 'LU', '013': 'LR', '014': 'SLR', '015': 'SU', '020': 'U'}
LANE_K = {'001', '002', '005', '006', '007', '008', '017'}   # 중앙선·가변·버스(가로)·차선·가장자리·진로변경제한·버스(중앙)


def load(path, keep, bb):
    r = shapefile.Reader(path, encoding='cp949')
    names = [f[0] for f in r.fields[1:]]
    out = []
    for sr in r.iterShapeRecords(bbox=bb):
        d = dict(zip(names, sr.record))
        if d.get('EVE_CDE', '001') not in ('001', '') or not keep(d):   # 지상만(고가·지하 제외) · 교차로 점(A008)에는 이 칸이 없다
            continue
        pts = sr.shape.points
        pp = list(getattr(sr.shape, 'parts', []) or [0]) + [len(pts)]
        out.append((d, [pts[pp[k]:pp[k + 1]] for k in range(len(pp) - 1)]))
    return out


def bake(mid):
    path = os.path.join(ROOT, 'data', 'maps', mid + '.json')
    M = json.load(open(path, encoding='utf-8'))
    W = M['wgs84']
    def G(e, n):
        lon, lat = T.transform(e, n)
        return W['x'][0] * (lon - W['lon0']) + W['x'][1] * (lat - W['lat0']) + W['x'][2], W['z'][0] * (lon - W['lon0']) + W['z'][1] * (lat - W['lat0']) + W['z'][2]
    def back(x, z):   # 게임 → 5186 (이 두 지도의 변환은 축이 나뉘어 있다)
        lon = (x - W['x'][2]) / W['x'][0] + W['lon0']; lat = (z - W['z'][2]) / W['z'][1] + W['lat0']
        return INV.transform(lon, lat)
    g = M['grid']; xs, zs = g['xs'], g['zs']
    c = [back(x, z) for x in (xs[0] - 400, xs[-1] + 400) for z in (zs[0] - 400, zs[-1] + 400)]
    bb = (min(p[0] for p in c), min(p[1] for p in c), max(p[0] for p in c), max(p[1] for p in c))
    conv = lambda items: [(d, [[G(e, n) for e, n in part] for part in parts]) for d, parts in items]
    lanes = conv(load(os.path.join(SRC, 'A058_L', 'A058_L'), lambda d: d['A058_KND_C'] in LANE_K, bb))
    stops = conv(load(os.path.join(SRC, 'A058_L', 'A058_L'), lambda d: d['A058_KND_C'] == '004', bb))
    arrows = conv(load(os.path.join(SRC, 'A055', 'A055_P'), lambda d: d['A055_KND_C'] in KIND, bb))
    walks = conv(load(os.path.join(SRC, 'A004_A_횡단보도', 'A004_A'), lambda d: True, bb))
    segs = []
    for d, parts in lanes:
        for part in parts:
            for i in range(len(part) - 1):
                segs.append((d['A058_KND_C'], part[i], part[i + 1]))
    CELL = 40; grid = {}
    for s in segs:
        (x1, z1), (x2, z2) = s[1], s[2]
        for cx in range(int(min(x1, x2) // CELL), int(max(x1, x2) // CELL) + 1):
            for cz in range(int(min(z1, z2) // CELL), int(max(z1, z2) // CELL) + 1):
                grid.setdefault((cx, cz), []).append(s)

    def near(x, z, r):
        out = set()
        for cx in range(int((x - r) // CELL), int((x + r) // CELL) + 1):
            for cz in range(int((z - r) // CELL), int((z + r) // CELL) + 1):
                out.update(grid.get((cx, cz), []))
        return out

    def tangent(x, z, ax, sgn):
        # 그 쪽 팔(20~90m)의 차선 방향을 모은다(축에서 ±40° 안 · 길이 무게) → 바깥쪽을 향한 단위 벡터
        base = (0, sgn) if ax == 'v' else (sgn, 0)
        sx = sz = 0
        for k, a, b in near(x + base[0] * 55, z + base[1] * 55, 45):
            mx, mz = (a[0] + b[0]) / 2 - x, (a[1] + b[1]) / 2 - z
            al = mx * base[0] + mz * base[1]
            if not (20 < al < 90) or abs(mx * base[1] - mz * base[0]) > 30:
                continue
            dx, dz = b[0] - a[0], b[1] - a[1]; L = math.hypot(dx, dz)
            if L < 1:
                continue
            if dx * base[0] + dz * base[1] < 0:
                dx, dz = -dx, -dz
            if (dx * base[0] + dz * base[1]) / L < math.cos(math.radians(40)):
                continue
            sx += dx; sz += dz
        L = math.hypot(sx, sz)
        return (sx / L, sz / L) if L > 5 else base

    def crossing(px, pz, tg, half=26):
        # 점 p 를 지나는 단면(tg 에 수직)과 차선의 교차 — (가로 위치, 종류) · 가로 + = 오른쪽(tg 가 진행 방향일 때)
        rgt = (-tg[1], tg[0])
        ax_, az_ = px - rgt[0] * half, pz - rgt[1] * half
        bx, bz = px + rgt[0] * half, pz + rgt[1] * half
        out = []
        for k, a, b in near(px, pz, half + 5):
            rx, rz, sx, sz = bx - ax_, bz - az_, b[0] - a[0], b[1] - a[1]
            den = rx * sz - rz * sx
            if abs(den) < 1e-9:
                continue
            t = ((a[0] - ax_) * sz - (a[1] - az_) * sx) / den
            u = ((a[0] - ax_) * rz - (a[1] - az_) * rx) / den
            if 0 <= t <= 1 and 0 <= u <= 1:
                L = math.hypot(sx, sz) or 1
                if abs((sx * tg[0] + sz * tg[1]) / L) < 0.75:
                    continue
                out.append((t * 2 * half - half, k))
        return sorted(out)

    def perdir(px, pz, tg):
        # tg 방향으로 달리는 쪽(오른쪽)의 차로 수: 중앙선(없으면 0 근처 가장 넓은 틈)에서 바깥으로 2.4~4.6m 칸
        cs = crossing(px, pz, tg)
        if not cs:
            return None
        ctr = [o for o, k in cs if k == '001' and abs(o) < 12]
        c0 = min(ctr, key=abs) if ctr else 0.0
        right = [o for o, k in cs if o > c0 + 0.3]
        n, prev = 0, c0
        for o in right:
            gp = o - prev
            if gp < 0.8:
                prev = o; continue
            if 2.4 <= gp <= 4.6:
                n += 1; prev = o; continue
            if gp <= 5.5 and n == 0:   # 중앙분리대 쪽 첫 칸이 넓은 곳
                n += 1; prev = o; continue
            break
        return n or None

    def centroid(parts):
        p = [q for part in parts for q in part]
        return sum(q[0] for q in p) / len(p), sum(q[1] for q in p) / len(p)
    AR = [(centroid(p), d) for d, p in arrows]
    WK = [centroid(p) for d, p in walks]
    ST = [(centroid(p), p) for d, p in stops]
    # 실제 교차로 자리 — 격자는 곧고 실제 길은 굽어서, 격자 교차로 자리에는 실제 교차로가 없다(서초역 1:1 은 9곳 중 1곳만 맞았다).
    #  ① 두 길 이름이 서초구 1:1 도로 파일(OSM 중심선)에 있으면 그 둘이 만나는 곳 ② 없으면 격자 자리 ③ 둘 다 T-GIS 교차로 점(A008_P) 60m 안이면 그 점에 붙인다.
    RF = json.load(open(os.path.join(ROOT, 'data', 'maps', 'seocho-full-roads.json'), encoding='utf-8'))['roads']
    FW = json.load(open(os.path.join(ROOT, 'data', 'maps', 'seocho-full.json'), encoding='utf-8'))['wgs84']
    def f2m(px, pz):   # 서초구 1:1 좌표 → 이 지도 좌표(둘 다 축이 나뉜 1차 변환)
        lon = (px - FW['x'][2]) / FW['x'][0] + FW['lon0']; lat = (pz - FW['z'][2]) / FW['z'][1] + FW['lat0']
        return W['x'][0] * (lon - W['lon0']) + W['x'][1] * (lat - W['lat0']) + W['x'][2], W['z'][0] * (lon - W['lon0']) + W['z'][1] * (lat - W['lat0']) + W['z'][2]
    RL = {n: [f2m(p[0], p[1]) for p in r['pts']] for n, r in RF.items()}
    def onroad(n, ax, v):   # 길 n 위에서 주축 값 v 인 점
        q = sorted(RL[n], key=lambda p: p[1] if ax == 'v' else p[0]); k = 1 if ax == 'v' else 0
        for a, b in zip(q, q[1:]):
            if a[k] <= v <= b[k]:
                t = (v - a[k]) / ((b[k] - a[k]) or 1)
                return a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t
        return None
    A8 = []
    for d, parts in load(os.path.join(SRC, 'A008', 'A008_P'), lambda d: True, bb):
        e, n = parts[0][0]
        A8.append((G(e, n), d.get('CSS_NAM', '')))
    import re
    core = lambda t: re.sub(r'\s|사거리|교차로|삼거리|\(.*?\)', '', t or '')
    A8N = {}
    for (q, nm) in A8:
        if '(' in nm:
            continue
        A8N.setdefault(core(nm), []).append(q)
    VN, HN = M.get('roadNamesV', []), M.get('roadNamesH', [])
    NN = M.get('nodeNames', {})
    RN = {}
    for i, x0 in enumerate(xs):
        for j, z0 in enumerate(zs):
            if '안 만남' in NN.get('%d,%d' % (i, j), ''):
                continue
            x, z, how = x0, z0, 'grid'
            vn, hn = (VN[i] if i < len(VN) else None), (HN[j] if j < len(HN) else None)
            if vn in RL and hn in RL:
                for _ in range(12):
                    a = onroad(vn, 'v', z); b = a and onroad(hn, 'h', a[0])
                    if not b:
                        break
                    x, z, how = a[0], b[1], 'osm'
            nmk = core(NN.get('%d,%d' % (i, j), ''))
            hits = A8N.get(nmk, []) if nmk and '·' not in NN.get('%d,%d' % (i, j), '') else []
            if hits:   # 같은 이름이 여럿이면(구 밖 같은 이름) 지금 어림 자리에 가장 가까운 것
                q = min(hits, key=lambda q: math.hypot(q[0] - x, q[1] - z))
                if math.hypot(q[0] - x, q[1] - z) < 1500:
                    RN[(i, j)] = (q[0], q[1], 'name', nmk)
                    continue
            if how == 'grid':   # 이름도 두 중심선도 못 찾은 격자 자리 — 가까운 아무 신호 교차로에 붙이면 엉뚱한 곳이 된다(서초역 1:1 에서 실측) · 굽지 않는다
                continue
            best = min(A8, key=lambda q: math.hypot(q[0][0] - x, q[0][1] - z)) if A8 else None
            if best and math.hypot(best[0][0] - x, best[0][1] - z) < 60:
                x, z, how = best[0][0], best[0][1], how + '+tgis'
            RN[(i, j)] = (x, z, how, best[1] if best else '')
    out = {'nodes': {}, 'midV': [], 'midH': []}
    for i, x0 in enumerate(xs):
        for j, z0 in enumerate(zs):
            if (i, j) not in RN:
                continue
            x, z, how, tname = RN[(i, j)]
            node = {'real': [round(x - x0, 1), round(z - z0, 1)], 'how': how, 'tgis': tname}
            for d in range(4):
                # 진행 방향 d(0 남·1 동·2 북·3 서)로 오는 차 = 반대쪽 팔에 있다
                ax = 'v' if d in (0, 2) else 'h'
                sgn = {0: -1, 2: 1, 1: -1, 3: 1}[d]
                tg = tangent(x, z, ax, sgn)              # 팔 바깥쪽
                hd = (-tg[0], -tg[1]); rgt = (-hd[1], hd[0])
                lat = []
                for (axx, azz), r in AR:
                    dx, dz = axx - x, azz - z
                    al = dx * tg[0] + dz * tg[1]; la = dx * rgt[0] + dz * rgt[1]
                    try:
                        th = math.radians(float(r['DRN']))
                    except Exception:
                        continue
                    dv = (math.cos(th), -math.sin(th))
                    if 12 < al < 85 and -3 < la < 26 and dv[0] * hd[0] + dv[1] * hd[1] > 0.77:
                        lat.append((la, KIND[r['A055_KND_C']]))
                lat.sort()
                cl = []
                for v, k in lat:
                    if cl and v - cl[-1][0] < 1.9:
                        cl[-1][1].append(k); cl[-1][0] = (cl[-1][0] * (len(cl[-1][1]) - 1) + v) / len(cl[-1][1])
                    else:
                        cl.append([v, [k]])
                use = []
                for k2, (v, ks) in enumerate(cl):     # 바깥으로 이어진 차로만(6m 넘게 끊기면 다른 길 · 곁길)
                    if k2 and v - cl[k2 - 1][0] > 6.0:
                        break
                    use.append(Counter(ks).most_common(1)[0][0])
                st = [al for (mx, mz), p in ST for al, la in [((mx - x) * tg[0] + (mz - z) * tg[1], (mx - x) * rgt[0] + (mz - z) * rgt[1])] if 6 < al < 60 and -3 < la < 24]
                cw = [al for wx, wz in WK for al, la in [((wx - x) * tg[0] + (wz - z) * tg[1], (wx - x) * rgt[0] + (wz - z) * rgt[1])] if 4 < al < 50 and abs(la) < 24]
                ent = {'use': use if len(use) >= 2 else None, 'stop': round(min(st), 1) if st else None, 'cw': round(min(cw), 1) if cw else None,
                       'bear': round(math.degrees(math.atan2(tg[0], tg[1])) % 360)}
                node[str(d)] = ent
            out['nodes']['%d,%d' % (i, j)] = node
    # 구간 가운데 편도 차로 수(30·50·70% 세 단면의 가운데 값) — [구간][방향 +, 방향 -]
    def segmid(p, q, ax):
        r = []
        for f in (0.3, 0.5, 0.7):
            px, pz = p[0] + (q[0] - p[0]) * f, p[1] + (q[1] - p[1]) * f
            L = math.hypot(q[0] - p[0], q[1] - p[1]) or 1
            tg = ((q[0] - p[0]) / L, (q[1] - p[1]) / L)
            a = perdir(px, pz, tg); b = perdir(px, pz, (-tg[0], -tg[1]))
            r.append((a, b))
        md = lambda vals: sorted(v for v in vals if v)[len([v for v in vals if v]) // 2] if any(vals) else None
        return [md([a for a, b in r]), md([b for a, b in r])]
    P = lambda i, j: RN[(i, j)][:2] if (i, j) in RN else None
    for i, x0 in enumerate(xs):
        out['midV'].append([segmid(P(i, j), P(i, j + 1), 'v') if P(i, j) and P(i, j + 1) else [None, None] for j in range(len(zs) - 1)])
    for j, z0 in enumerate(zs):
        out['midH'].append([segmid(P(i, j), P(i + 1, j), 'h') if P(i, j) and P(i + 1, j) else [None, None] for i in range(len(xs) - 1)])
    old = M.get('tgis', {})
    M['tgis'] = {
        'source': '서울특별시 교통안전시설물(서울 열린데이터광장 · 교통운영과) — 차선 A058_L(OA-15537) · 방향표시 A055_P(OA-15536) · 횡단보도 A004_A(OA-15554)',
        'license': '이용허락범위 제한 없음(서울 열린데이터광장 표기) — 출처 표시',
        'collected': '2026-11-28 · 차선·횡단보도 마지막 기록 2021 · 방향표시 2026-09',
        'note': '격자 교차로 접근로(진행 방향 d: 0 남·1 동·2 북·3 서)마다 use = 정지선 앞 노면 화살표(1차로부터) · stop/cw = 교차로 가운데에서 m · bear = 실제 팔 방위(도) · midV/midH = 구간 가운데 편도 차로 수 [+방향, -방향]. 실제 교차로는 격자처럼 곧지 않다 — 이 값은 격자 교차로에 대응하는 실제 자리에서 잰 것이다.',
        'fix': old.get('fix', {}),
        'nodes': out['nodes']}
    # 지도 파일의 다른 칸은 손대지 않는다(손으로 맞춘 들여쓰기 그대로) — 맨 끝 "tgis" 칸만 갈아 끼운다. 교차로 하나가 한 줄.
    T0 = M['tgis']
    head = {k: v for k, v in T0.items() if k != 'nodes'}
    blk = '  "tgis": {\n' + ''.join('    %s: %s,\n' % (json.dumps(k, ensure_ascii=False), json.dumps(v, ensure_ascii=False)) for k, v in head.items())
    blk += '    "nodes": {\n' + ',\n'.join('      %s: %s' % (json.dumps(k), json.dumps(v, ensure_ascii=False, separators=(',', ':'))) for k, v in T0['nodes'].items()) + '\n    }\n  }'
    raw = open(path, encoding='utf-8', newline='').read()   # 줄 끝(CRLF 가 섞인 파일)도 그대로 둔다
    NL = '\r\n' if '\r\n' in raw else '\n'
    blk = blk.replace('\n', NL)
    k0 = raw.rfind(',' + NL + '  "tgis": {')
    if k0 >= 0:
        raw = raw[:k0] + NL + '}'
    raw = raw.rstrip()
    assert raw.endswith('}')
    raw = raw[:-1].rstrip() + ',' + NL + blk + NL + '}' + NL
    json.loads(raw)
    open(path, 'w', encoding='utf-8', newline='').write(raw)
    print(mid, 'nodes', len(out['nodes']))
    for k, v in out['nodes'].items():
        print(' ', k, v['how'], v['tgis'], v['real'], ' | '.join('%s:%s st%s cw%s b%s' % (d, ''.join('[' + u + ']' for u in (e['use'] or [])) or '-', e['stop'], e['cw'], e['bear']) for d, e in v.items() if d in '0123'))


for mid in IDS:
    bake(mid)
