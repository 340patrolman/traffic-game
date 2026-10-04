# -*- coding: utf-8 -*-
# 계절 취약지 — 서울 전역판(v0.10.98 · 지역 자료 ⑤b) · 원본 tools/season-bake.py(v0.10.85)를 서울 상자·바탕 조각(data/base/t)으로 돌려 구마다 data/r/<구>/season.json 으로 나눈다.
# 서초 둘레 상자(126.935~127.135 · 37.395~37.535) 안은 기존 data/season-seocho.json 이 맡으므로 구 파일에서 뺀다(겹침 없음).
# 계절 취약지(v0.10.85) — 여름 침수 · 겨울 결빙 자료를 데이터 압축지도 한 파일로 굽는다(통신 없이 · 받은 파일만 읽음)
# 소유자(2026-10-04): 「침수 취약 도로/지하차도 통제 지점 레이어」 · 「겨울에는 결빙 여름에는 폭우 등 위험한 지역을 자동으로 데이터에 맞게」
# 입력(저장소 밖 07_API키/out/):
#   flood/x_f*/*.shp  서울시 침수흔적도 OA-15636(2010~2025 · 공공누리 1유형) — 받는 법 MAP2D.md §7 파일 받기(infId=OA-15636 · seq 4~13·30·31·32·103 · infSeq=1)
#   season/viAdvBase.json  제설함 위치 OA-22648(API viAdvBase · EPSG:5186 mm)
#   season/viSnArhd.json   제설전진기지 OA-22649(API viSnArhd)
#   season/tbNatureDangerLocal.json  자연재해위험개선지구 OA-21693
#   season/heat.csv        도로열선 설치현황 OA-22584(seq 4 · 공공누리 4유형 — 출처표시·비상업·변경금지: 값은 바꾸지 않고 그대로 싣는다)
#   traffic-game/data/base-seocho.json  OSM 도로(지하차도 · 열선 길 이름 맞추기)
import glob, json, os, re, math
import shapefile
from pyproj import CRS, Transformer
from shapely.geometry import LineString, Point
from shapely.strtree import STRtree
from shapely.ops import unary_union

KB = r'C:\Users\knpth\Desktop\지식베이스'
OUT = os.path.join(KB, '07_API키', 'out')
GAME = os.path.join(KB, 'traffic-game')
def P(lon, lat): return ((lon - 127.01) * 88800, -(lat - 37.49) * 111000)
LON0, LON1, LAT0, LAT1 = 126.76, 127.19, 37.41, 37.72   # 서울 상자
SB = (126.935, 127.135, 37.395, 37.535)   # 서초 판이 맡는 상자
def inbox(lon, lat): return LON0 <= lon <= LON1 and LAT0 <= lat <= LAT1

# ---------- 여름: 침수흔적 ----------
traces = []; causes = []; zones = []; CI = {}; ZI = {}
def idx(tab, m, v):
    v = (v or '').strip()
    if v not in m: m[v] = len(tab); tab.append(v)
    return m[v]
def yr_of(rec, path):
    for k in ('F_YR', 'INV_YR'):
        v = rec.get(k)
        if v and re.match(r'^\d{4}', str(v)): return int(str(v)[:4])
    m = re.search(r'(20\d\d)', os.path.basename(path)) or re.search(r'(20\d\d)', str(rec.get('F_DISA_NM') or ''))
    return int(m.group(1)) if m else 0
for shp in sorted(glob.glob(os.path.join(OUT, 'flood', 'x_f*', '*.shp'))):
    wkt = open(shp[:-4] + '.prj', encoding='latin1').read()
    tr = Transformer.from_crs(CRS.from_wkt(wkt), 4326, always_xy=True)
    # 글자는 칸마다 가린다 — 2025 파일은 .cpg 가 949 인데 실제 UTF-8 칸이 섞여 있다(latin1 로 읽어 바이트를 되살린 뒤 UTF-8 → cp949)
    r = shapefile.Reader(shp, encoding='latin1')
    def fx(v):
        if not isinstance(v, str): return v
        b = v.encode('latin1')
        try: return b.decode('utf-8')
        except UnicodeDecodeError: return b.decode('cp949', 'replace')
    flds = [fx(f[0]) for f in r.fields[1:]]
    n0 = len(traces)
    for sr in r.iterShapeRecords():
        if not sr.shape.points: continue
        rec = dict(zip(flds, [fx(v) for v in sr.record]))
        xs = [p[0] for p in sr.shape.points]; ys = [p[1] for p in sr.shape.points]
        lon, lat = tr.transform(sum(xs) / len(xs), sum(ys) / len(ys))
        if not inbox(lon, lat): continue
        x, z = P(lon, lat)
        dep = rec.get('F_SHIM'); dep = float(dep) if isinstance(dep, (int, float)) else 0
        date = str(rec.get('F_SAT_YMD') or rec.get('피해일시') or '')[:8]
        cause = rec.get('F_RSN_DTL') or rec.get('TYPE2') or ''
        zone = rec.get('F_ZONE_NM') or ''
        zone = ' '.join(str(zone).split()[:2])   # 「서초구 서초동」까지만(번지는 버림 — 무게·개인 집 주소)
        traces.append([round(x), round(z), yr_of(rec, shp), round(dep, 2), idx(causes, CI, str(cause)), idx(zones, ZI, zone), date])
    print(os.path.basename(shp), len(traces) - n0)
# 20m 칸·같은 해로 묶는다 — [x, z, 해, 흔적 수, 최대 침수심, 원인(가장 많은 것), 동(zones)]
G = {}
for t in traces:
    k = (t[0] // 20, t[1] // 20, t[2]); g = G.get(k)
    if not g: G[k] = g = {'x': 0, 'z': 0, 'n': 0, 'd': 0, 'c': {}, 'zn': t[5]}
    g['x'] += t[0]; g['z'] += t[1]; g['n'] += 1; g['d'] = max(g['d'], t[3]); g['c'][t[4]] = g['c'].get(t[4], 0) + 1
traces_raw = traces
traces = [[round(g['x'] / g['n']), round(g['z'] / g['n']), k[2], g['n'], g['d'], max(g['c'], key=g['c'].get), g['zn']] for k, g in G.items()]
# 원본에 깨진 채 들어 있는 원인 글(UTF-8 을 cp949 로 한 번 잘못 읽어 저장된 것 · 한 바이트 빠짐)은 되살려 보고, 가장 가까운 기존 원인 이름으로 맞춘다
import difflib
for i, c in enumerate(causes):
    if re.search(r'[一-鿿]', c):
        g = c.encode('cp949', 'replace').decode('utf-8', 'replace').replace('�', '').replace('?', '')
        m = difflib.get_close_matches(g, [x for x in causes if not re.search(r'[一-鿿]', x)], 1, 0.5)
        causes[i] = (m[0] if m else g) + ' *'
years = sorted(set(t[2] for t in traces))
print('traces', len(traces), years)

# ---------- 도로(OSM base) 풀기 ----------
def dec(a):
    pts = []; x = z = 0
    for i in range(0, len(a), 2):
        if i == 0: x, z = a[0], a[1]
        else: x += a[i]; z += a[i + 1]
        pts.append((x, z))
    return pts
roads = []
bx0, bz1 = P(LON0, LAT0); bx1, bz0 = P(LON1, LAT1)
for fn in glob.glob(os.path.join(GAME, 'data', 'base', 't', '*.json')):
    ix, iz = [int(v) for v in os.path.basename(fn)[:-5].split('_')]
    if (ix + 1) * 8000 < bx0 or ix * 8000 > bx1 or (iz + 1) * 8000 < bz0 or iz * 8000 > bz1: continue
    base = json.load(open(fn, encoding='utf-8')); names = base['names']
    for c in ('m', 'p', 's', 't', 'l', 'r'):
        for e in base['roads'].get(c, []):
            pts = dec(e[2:])
            if len(pts) >= 2: roads.append((c, names[e[0]] if e[0] >= 0 else '', e[1], pts))
print('roads', len(roads))

# ---------- 침수 이력 도로: 트레이스 30m 안을 지나는 도로 조각(다른 해 수) ----------
tpts = [Point(t[0], t[1]) for t in traces]
tree = STRtree(tpts)
R = 30
froads = []
for c, nm, fl, pts in roads:
    if c == 'r' and not nm: continue
    ls = LineString(pts)
    hit = tree.query(ls.buffer(R))
    if len(hit) == 0: continue
    if c == 'r' and sum(traces[i][3] for i in hit) < 4: continue   # 주거 골목은 흔적 4곳 이상만
    ys = sorted(set(traces[i][2] for i in hit))
    maxd = max(traces[i][3] for i in hit)
    # 조각을 트레이스 둘레로 잘라 낸다
    near = ls.intersection(unary_union([tpts[i].buffer(R) for i in hit]))
    parts = [near] if near.geom_type == 'LineString' else [g for g in getattr(near, 'geoms', []) if g.geom_type == 'LineString']
    for g in parts:
        if g.length < 15: continue
        q = list(g.simplify(1.5).coords)
        a = [round(q[0][0]), round(q[0][1])]
        for i in range(1, len(q)): a += [round(q[i][0]) - round(q[i - 1][0]), round(q[i][1]) - round(q[i - 1][1])]
        froads.append([nm, c, len(ys), ys[-1], round(maxd, 2), sum(traces[i][3] for i in hit)] + a)
print('flood road pieces', len(froads))

# ---------- 지하차도(OSM 터널·지하 표시 · 간선) + 둘레 침수흔적 ----------
unders = []
for c, nm, fl, pts in roads:
    if not (fl & 2) or c not in ('p', 's', 't', 'l') or '터널' in nm: continue   # 산을 뚫는 터널·도시고속도로 지하 구간은 빼고 일반도로 지하차도만
    ls = LineString(pts)
    if ls.length < 40 or ls.length > 1000: continue
    hit = tree.query(ls.buffer(150))
    ys = sorted(set(traces[i][2] for i in hit))
    mid = ls.interpolate(0.5, normalized=True)
    unders.append([nm or '', c, round(mid.x), round(mid.y), round(ls.length), len(ys), (ys[-1] if ys else 0)])
# 같은 이름·가까운 조각(상하행) 합치기
U2 = []
for u in sorted(unders, key=lambda u: -u[4]):
    if any(v[0] == u[0] and math.hypot(v[2] - u[2], v[3] - u[3]) < 300 for v in U2): continue
    U2.append(u)
unders = U2
print('underpasses', len(unders), sum(1 for u in unders if u[5]))

# ---------- 겨울: 제설함 · 전진기지 · 열선 ----------
t5186 = Transformer.from_crs(5186, 4326, always_xy=True)
sbox = []
for r in json.load(open(os.path.join(OUT, 'season', 'viAdvBase.json'), encoding='utf-8')):
    lon, lat = t5186.transform(r['G2_XMIN'] / 1000, r['G2_YMIN'] / 1000)
    if not inbox(lon, lat): continue
    x, z = P(lon, lat); sbox.append([round(x), round(z), r.get('SBOX_NUM') or '', r.get('DETL_CN') or ''])
adv = []
for r in json.load(open(os.path.join(OUT, 'season', 'viSnArhd.json'), encoding='utf-8')):
    lon, lat = t5186.transform(r['G2_XMIN'] / 1000, r['G2_YMIN'] / 1000)
    if not inbox(lon, lat): continue
    x, z = P(lon, lat); adv.append([round(x), round(z), r.get('ADV_NM') or '', r.get('ADV_SE') or '', r.get('PC_CO') or '', r.get('MGC_NM') or ''])
print('sandbox', len(sbox), 'adv', len(adv))
# 열선 — 설치 위치 글의 맨 앞 길 이름을 OSM 길 이름에 맞춘다(같은 이름 길 전체를 그린다 · 근사)
import csv, io as _io
raw = open(os.path.join(OUT, 'season', 'heat.csv'), 'rb').read().decode('cp949')
heat = []; byname = {}
for c, nm, fl, pts in roads:
    if nm: byname.setdefault(nm, []).append(pts)
for row in csv.reader(_io.StringIO(raw)):
    if len(row) < 5 or row[0] == '연번': continue
    gu, yr, where, ln = row[1], row[2], row[3], row[4]
    if not gu.endswith('구'): continue
    m = re.match(r'\s*([가-힣0-9]+(?:로|길|대로)(?:\d+[가-힣]?길)?)', where)
    street = m.group(1) if m else ''
    lines = byname.get(street, [])
    if not lines: continue
    segs = []
    for pts in lines:
        a = [round(pts[0][0]), round(pts[0][1])]
        for i in range(1, len(pts)): a += [round(pts[i][0]) - round(pts[i - 1][0]), round(pts[i][1]) - round(pts[i - 1][1])]
        segs.append(a)
    heat.append([gu, yr, where, ln, street, segs])
print('heat streets matched', len(heat), 'of', raw.count('\n'))
danger = []
for r in json.load(open(os.path.join(OUT, 'season', 'tbNatureDangerLocal.json'), encoding='utf-8')):
    s = json.dumps(r, ensure_ascii=False)
    if True:
        danger.append({k: (str(v).strip() if v is not None else '') for k, v in r.items()})

out = {'schema': 'tg-season/1',
  'space': '평면 m · x = (lon-127.01)×88800 · z = -(lat-37.49)×111000 · 선은 첫 점 뒤 차분',
  'source': {
    'flood': '서울시 침수흔적도(OA-15636 · 서울특별시 물순환안전국 치수안전과 · 2010~2025 · 2015·2021 자료 없음 · 공공누리 1유형) — 침수된 건물·필지 범위의 가운데 점',
    'floodRoads': '침수흔적 30m 안을 지나는 OSM(ODbL) 도로 조각 — 이 앱이 계산한 근사(도로 자체 침수 기록이 아니다)',
    'under': 'OSM 지하차도·터널 표시(간선) + 150m 안 침수흔적 해 수 — 진입차단시설 위치·실시간 통제 정보는 공개 파일이 없다(서울시가 행안부 재난안전데이터 공유플랫폼으로 실시간 전송 · 이 지도는 통신 0)',
    'danger': '서울시 자연재해위험개선지구(OA-21693) — 좌표가 없어 글로만',
    'sbox': '서울시 제설함 위치정보(OA-22648 · 도로관리과 · 공공누리 1유형) — 제설함은 결빙 우려 경사로·교량 등에 둔다',
    'adv': '서울시 제설전진기지 위치정보(OA-22649)',
    'heat': '서울시 도로열선 설치현황(OA-22584 · 2026-05-31 · 공공누리 4유형: 출처표시·상업적 이용 금지·변경 금지) — 설치 위치 글은 원문 그대로, 선은 같은 이름 OSM 길 전체(근사)'},
  'years': years, 'causes': causes, 'zones': zones,
  'traceCols': ['x', 'z', '해', '흔적 수(20m 칸)', '최대 침수심(m)', '원인(causes)', '동(zones)'], 'traceRaw': len(traces_raw),
  'traces': traces,
  'roadCols': ['길 이름', '갈래', '침수 해 수', '마지막 해', '최대 침수심', '흔적 수', '선…'],
  'floodRoads': froads,
  'underCols': ['이름', '갈래', 'x', 'z', '길이 m', '150m 안 침수 해 수', '마지막 해'],
  'under': unders,
  'danger': danger,
  'sbox': sbox, 'adv': adv,
  'heatCols': ['관리기관', '설치연도', '설치 위치(원문)', '연장 m', '맞춘 길 이름', '선 묶음'],
  'heat': heat}
# ---------- 구마다 나누기(서초 상자 안은 빼고) ----------
from shapely.geometry import shape as _shape
from shapely.strtree import STRtree as _STR
_g = json.load(open(os.path.join(KB, '13_관할경계', '원자료', 'hjd20260701.geojson'), encoding='utf-8'))
_F = [(_shape(f['geometry']), f['properties']['sgg'], f['properties']['sggnm']) for f in _g['features'] if f['properties']['adm_cd2'].startswith('11')]
_T = _STR([f[0] for f in _F]); GN = {f[1]: f[2] for f in _F}
def ll(x, z): return (x / 88800 + 127.01, 37.49 - z / 111000)
def gu_xz(x, z):
    lon, lat = ll(x, z)
    if SB[0] <= lon <= SB[1] and SB[2] <= lat <= SB[3]: return None
    pt = Point(lon, lat)
    for i in _T.query(pt):
        if _F[i][0].contains(pt): return _F[i][1]
    return None
GO = {}
def put(gu, k, v):
    if gu: GO.setdefault(gu, {'traces': [], 'floodRoads': [], 'under': [], 'sbox': [], 'adv': [], 'heat': [], 'danger': []})[k].append(v)
for t in out['traces']: put(gu_xz(t[0], t[1]), 'traces', t)
for r in out['floodRoads']: put(gu_xz(r[6], r[7]), 'floodRoads', r)
for u in out['under']: put(gu_xz(u[2], u[3]), 'under', u)
for b in out['sbox']: put(gu_xz(b[0], b[1]), 'sbox', b)
for a in out['adv']: put(gu_xz(a[0], a[1]), 'adv', a)
NG = {v: k for k, v in GN.items()}
for h in out['heat']:
    if h[0] in ('서초구', '강남구', '동작구', '관악구'): continue   # 서초 판이 이미 가진 네 구
    put(NG.get(h[0]), 'heat', h)
rp = os.path.join(GAME, 'data', 'r', 'index.json'); IX = json.load(open(rp, encoding='utf-8')); gb = {}
for gu, v in GO.items():
    doc = {k: out[k] for k in ('schema', 'space', 'source', 'years', 'causes', 'zones', 'traceCols', 'roadCols', 'underCols', 'heatCols')}
    doc.update(v); doc['gu'] = gu; doc['note'] = '서초 둘레 상자 안은 data/season-seocho.json 이 맡는다(이 파일에서 뺐다). 원인·동 번호는 이 파일의 causes·zones 를 본다.'
    pth = os.path.join(GAME, 'data', 'r', gu, 'season.json'); os.makedirs(os.path.dirname(pth), exist_ok=True)
    open(pth, 'w', encoding='utf-8', newline='\n').write(json.dumps(doc, ensure_ascii=False, separators=(',', ':'))); gb[gu] = os.path.getsize(pth)
    print(gu, GN.get(gu), {k: len(x) for k, x in v.items()}, gb[gu])
for g in IX['gus']:
    if g['gu'] in gb: g['bytes']['season'] = gb[g['gu']]
IX['layers']['season'] = '계절 위험 — 침수 흔적·침수 이력 길·지하차도·제설함·전진기지·열선(서초 둘레 상자 밖)'
open(rp, 'w', encoding='utf-8', newline='\n').write(json.dumps(IX, ensure_ascii=False, separators=(',', ':')))
print('total', sum(gb.values()))
