# -*- coding: utf-8 -*-
# 데이터 압축지도 v0.10.103 — 교차로별 교통사고 10년(서울·경기 이름 있는 교차로 전부)
#   교차로 = 바탕 조각(data/base/t)의 교차로 이름 점(서울 C-ITS 신호 교차로 + OSM 이름 있는 교차로 · 연등 제외)
#   사고 = 구마다 data/r/<구>/taas10.json(TAAS 100m 칸 · 2016~2025 · 서초는 data/taas10-seocho.json)
#   칸 가운데가 어느 교차로에서 70m 안이면 가장 가까운 교차로 하나에만 더한다(두 번 세지 않음 · 근사 — 교차로 사고의 정의가 아니다)
#   py -3.12 -X utf8 tools/region/jct-bake.py → data/r/<구>/jct.json · r/index.json bytes.jct
import json, os, glob, math, collections, importlib.util
from shapely.geometry import shape, Point
from shapely.strtree import STRtree
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
R70 = 70
KX, KY = 88800, 111000
def XZ(lon, lat): return ((lon - 127.01) * KX, -(lat - 37.49) * KY)

def main():
    sp = importlib.util.spec_from_file_location('db', os.path.join(ROOT, 'tools', 'region', 'dong-bake.py')); DB = importlib.util.module_from_spec(sp); sp.loader.exec_module(DB)
    feats, _ = DB.seoul_gus(); gs = [shape(f['geometry']) for f in feats]; tr = STRtree(gs)
    def gu_of(lon, lat):
        q = Point(lon, lat)
        for i in tr.query(q):
            if gs[i].contains(q): return feats[i]['properties']['sgg']
        return None
    J = {}
    for f in glob.glob(os.path.join(ROOT, 'data', 'base', 't', '*.json')):
        for n, x, z in json.load(open(f, encoding='utf-8'))['junctions']:
            J[(n, x, z)] = 1
    J = list(J)
    grid = collections.defaultdict(list)
    for i, (n, x, z) in enumerate(J): grid[(int(x // 200), int(z // 200))].append(i)
    acc = {}
    def near(x, z):
        best, bd = None, R70
        for gx in (int(x // 200) - 1, int(x // 200), int(x // 200) + 1):
            for gz in (int(z // 200) - 1, int(z // 200), int(z // 200) + 1):
                for i in grid.get((gx, gz), []):
                    d = math.hypot(J[i][1] - x, J[i][2] - z)
                    if d < bd: best, bd = i, d
        return best
    files = glob.glob(os.path.join(ROOT, 'data', 'r', '*', 'taas10.json'))
    if not os.path.exists(os.path.join(ROOT, 'data', 'r', '11650', 'taas10.json')): files.append(os.path.join(ROOT, 'data', 'taas10-seocho.json'))
    DIC = {}; used = 0; total = 0
    for fn in files:
        T = json.load(open(fn, encoding='utf-8')); dv = (T.get('dic') or {}).get('v', {})
        for c in T['cells']:
            yrs = c[2:12]; total += sum(yrs)
            x, z = XZ(c[1], c[0]); i = near(x, z)
            if i is None: continue
            used += sum(yrs)
            a = acc.setdefault(i, {'y': [0] * 10, 'dead': 0, 'ser': 0, 'ped': 0, 'night': 0, 'v': collections.Counter()})
            for k in range(10): a['y'][k] += yrs[k]
            a['dead'] += c[12]; a['ser'] += c[13]; a['ped'] += c[14]; a['night'] += c[18]
            vn = dv.get(c[23], c[23]); a['v'][vn] += c[24]
    G = collections.defaultdict(list)
    for i, a in acc.items():
        n, x, z = J[i]; lon, lat = x / KX + 127.01, 37.49 - z / KY
        gu = gu_of(lon, lat)
        if not gu: continue
        top = a['v'].most_common(2)
        G[gu].append([n, round(x), round(z), a['y'], a['dead'], a['ser'], a['ped'], a['night'], [[k, v] for k, v in top]])
    rp = os.path.join(ROOT, 'data', 'r', 'index.json'); R = json.load(open(rp, encoding='utf-8')); gb = {}
    for gu, items in G.items():
        items.sort(key=lambda r: -sum(r[3]))
        doc = {'schema': 'tg-jct/1', 'gu': gu, 'space': '평면 m(x = (lon-127.01)×88800 · z = -(lat-37.49)×111000)',
               'source': '교차로 = 서울 C-ITS 신호 교차로 이름 + OpenStreetMap(ODbL) 이름 있는 교차로 · 사고 = 도로교통공단 TAAS GIS 2016~2025(100m 칸)',
               'note': '교차로 가운데에서 %dm 안에 든 100m 칸 사고를 가장 가까운 교차로 하나에만 더한 근사 — 경찰 통계의 「교차로 사고」 정의(교차로 안·부근)와 같지 않다. 칸이 100m 라 교차로에 붙은 단일로 사고가 섞일 수 있다.' % R70,
               'fields': '[이름, x, z, 2016…2025 해마다 건수(10), 사망자, 중상자, 보행자 피해, 밤(20~6시), 주 법규위반 상위 2(칸마다 주 위반의 합)]', 'items': items}
        fn = os.path.join(ROOT, 'data', 'r', gu, 'jct.json'); os.makedirs(os.path.dirname(fn), exist_ok=True)
        json.dump(doc, open(fn, 'w', encoding='utf-8', newline='\n'), ensure_ascii=False, separators=(',', ':')); gb[gu] = os.path.getsize(fn)
    for g in R['gus']:
        if g['gu'] in gb: g.setdefault('bytes', {})['jct'] = gb[g['gu']]
    R['layers']['jct'] = '교차로별 교통사고 10년(이름 있는 교차로 · 70m 안 100m 칸 근사)'
    json.dump(R, open(rp, 'w', encoding='utf-8', newline='\n'), ensure_ascii=False, separators=(',', ':'))
    print('junctions', len(J), 'with acc', len(acc), 'acc used', used, 'of', total, 'gus', len(gb), 'bytes', sum(gb.values()))

if __name__ == '__main__': main()
