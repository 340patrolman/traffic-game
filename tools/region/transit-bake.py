# -*- coding: utf-8 -*-
# 데이터 압축지도 「지역 자료」 — 서울 버스 정류장·지하철역 시간대 승차·하차(v0.10.94 · 지역 자료 ④)
#   py -3.12 -X utf8 tools/region/transit-bake.py   → data/r/<구>/transit.json
# 버스: 서울시 버스노선별 정류장별 시간대별 승하차 인원(2026년 6월 · 교통카드 · 07_API키/out 의 CSV) — 노선을 정류장으로 합쳐 하루 평균(÷30)
#        정류장 자리 = 서울시 버스정류소 위치(07_API키/out/seoul_busstop_all.json · STOPS_NO = 표준버스정류장ID)
# 지하철: 서울시 지하철 호선별 역별 시간대별 승하차(CardSubwayTime · 2026년 6월 · 서울 열린데이터광장 API) — 역 이름으로 합쳐 하루 평균
#        역 자리 = 서울시 역사마스터(data/r/stations.json · 같은 이름이면 노선 자리의 가운데)
# 구 = 그 점이 든 행정동(SGIS 2026.7)의 구. 서초 파일과 같은 꼴 — 지도는 서초 정류장·역이 이미 있으면 건너뛴다.
import json, os, csv, time, importlib.util
from shapely.geometry import shape, Point
from shapely.strtree import STRtree
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
KB = os.path.join(os.path.dirname(ROOT), '07_API키')
HJD = os.path.join(os.path.dirname(ROOT), '13_관할경계', '원자료', 'hjd20260701.geojson')
spec = importlib.util.spec_from_file_location('fb', os.path.join(ROOT, 'tools', 'flow-bake.py')); fb = importlib.util.module_from_spec(spec); spec.loader.exec_module(fb)
BUSCSV = os.path.join(KB, 'out', '2026년_버스노선별_정류장별_시간대별_승하차_인원_정보(06월).csv')
YM = '202606'

def main():
    g = json.load(open(HJD, encoding='utf-8'))
    F = [(shape(f['geometry']), f['properties']['sgg']) for f in g['features'] if f['properties']['adm_cd2'].startswith('11')]
    tree = STRtree([f[0] for f in F])
    def gu_of(lon, lat):
        pt = Point(lon, lat)
        for i in tree.query(pt):
            if F[i][0].contains(pt): return F[i][1]
        return None
    stops = {s['STOPS_NO']: s for s in json.load(open(os.path.join(KB, 'out', 'seoul_busstop_all.json'), encoding='utf-8-sig'))}
    bus = {}
    with open(BUSCSV, encoding='cp949', newline='') as h:
        rd = csv.reader(h); next(rd)
        for row in rd:
            b = bus.setdefault(row[3], [[0] * 24, [0] * 24, row[5].split('(')[0]])
            for hr in range(24):
                b[0][hr] += int(row[6 + 2 * hr] or 0); b[1][hr] += int(row[7 + 2 * hr] or 0)
    out = {}; miss = 0
    for sid, b in bus.items():
        s = stops.get(sid)
        if not s or not s.get('XCRD'): miss += 1; continue
        lon, lat = float(s['XCRD']), float(s['YCRD']); gu = gu_of(lon, lat)
        if not gu: continue
        on, off = [round(x / 30) for x in b[0]], [round(x / 30) for x in b[1]]
        if sum(on) + sum(off) == 0: continue
        out.setdefault(gu, {'bus': [], 'sub': []})['bus'].append([sid, s['STOPS_NM'], round(lon, 5), round(lat, 5), on, off])
    print('bus stops', sum(len(v['bus']) for v in out.values()), 'no coord', miss)
    # 지하철
    rows = []
    for st in range(1, 2000, 1000):
        v = fb.seoul('json/CardSubwayTime/%d/%d/%s' % (st, st + 999, YM)).get('CardSubwayTime') or {}
        rows += v.get('row') or []
        if st + 999 >= (v.get('list_total_count') or 0): break
    sub = {}
    for r in rows:
        nm = r['STTN'].split('(')[0]
        s = sub.setdefault(nm, [[0] * 24, [0] * 24, []])
        if r['SBWY_ROUT_LN_NM'] not in s[2]: s[2].append(r['SBWY_ROUT_LN_NM'])
        for hr in range(24):
            k = hr if hr >= 4 else hr + 24
            for kk in ('HR_%d' % hr, 'HR_%d' % k):
                a = r.get(kk + '_GET_ON_NOPE')
                if a is not None: s[0][hr] += a; s[1][hr] += r.get(kk + '_GET_OFF_NOPE') or 0; break
    stn = {}
    for it in json.load(open(os.path.join(ROOT, 'data', 'r', 'stations.json'), encoding='utf-8'))['items']:
        stn.setdefault(it[0], []).append((it[2], it[3]))
    sm = 0
    for nm, s in sub.items():
        ps = stn.get(nm) or stn.get(nm.replace('역', ''))
        if not ps: sm += 1; continue
        lon, lat = sum(p[0] for p in ps) / len(ps), sum(p[1] for p in ps) / len(ps); gu = gu_of(lon, lat)
        if not gu: continue
        out.setdefault(gu, {'bus': [], 'sub': []})['sub'].append([nm, s[2], round(lon, 5), round(lat, 5), [round(x / 30) for x in s[0]], [round(x / 30) for x in s[1]]])
    print('subway', sum(len(v['sub']) for v in out.values()), 'no coord', sm)
    rp = os.path.join(ROOT, 'data', 'r', 'index.json'); R = json.load(open(rp, encoding='utf-8')); gb = {}
    for gu, v in out.items():
        pth = os.path.join(ROOT, 'data', 'r', gu, 'transit.json'); os.makedirs(os.path.dirname(pth), exist_ok=True)
        json.dump({'schema': 'tg-transit/1', 'gu': gu, 'ym': YM,
                   'source': {'bus': '서울시 버스노선별 정류장별 시간대별 승하차 인원(2026년 6월 · 교통카드) — 정류장으로 합친 하루 평균 · 자리: 서울시 버스정류소 위치',
                              'sub': '서울시 지하철 호선별 역별 시간대별 승하차 인원(CardSubwayTime · 2026년 6월) — 역 이름으로 합친 하루 평균 · 자리: 서울시 역사마스터'},
                   'fields': {'bus': '[정류장ID, 이름, 경도, 위도, 승차 24, 하차 24]', 'sub': '[역, 노선, 경도, 위도, 승차 24, 하차 24]'}, 'bus': v['bus'], 'sub': v['sub']},
                  open(pth, 'w', encoding='utf-8', newline='\n'), ensure_ascii=False, separators=(',', ':'))
        gb[gu] = os.path.getsize(pth)
    for gg in R['gus']:
        if gg['gu'] in gb: gg['bytes']['transit'] = gb[gg['gu']]
    R['layers']['transit'] = '버스 정류장·지하철역 시간대 승차·하차(2026년 6월 하루 평균)'
    json.dump(R, open(rp, 'w', encoding='utf-8', newline='\n'), ensure_ascii=False, separators=(',', ':'))
    print('bytes', sum(gb.values()))

if __name__ == '__main__': main()
