# -*- coding: utf-8 -*-
# 데이터 압축지도 「흐름」 자료 굽기 — 서울 열린데이터광장(키는 이 PC 의 07_API키/keys.json 에서만 읽는다 · 저장소에 넣지 않는다)
#   python -X utf8 tools/flow-bake.py live     → data/live-seocho.json  (실시간 도시데이터 — 받은 시각 한 장)
#   python -X utf8 tools/flow-bake.py flow     → data/flow-seocho.json  (버스·지하철 시간대 승차/하차 · 행정동 카드 추정매출)
# 게임·지도는 통신 0 — 이 도구를 돌린 시각의 값이 파일에 박힌다. 다시 돌리면 갱신된다.
import json, sys, os, time, csv, io, urllib.request, urllib.parse
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KB = os.path.join(os.path.dirname(ROOT), '07_API키')
K = json.load(open(os.path.join(KB, 'keys.json'), encoding='utf-8-sig'))
def seoul(path, tries=3):
    for i in range(tries):
        try:
            u = 'http://openapi.seoul.go.kr:8088/' + K['seoul'] + '/' + path
            return json.loads(urllib.request.urlopen(u, timeout=90).read().decode('utf-8'))
        except Exception as e:
            if i == tries - 1: raise
            time.sleep(2)
def num(x):
    try: return float(x)
    except Exception: return None
BBOX = (126.955, 37.425, 127.085, 37.525)
LIVE_BBOX = (126.76, 37.41, 127.19, 37.72)   # v0.10.95 실시간 도시데이터는 서울 121장소 전부(지역 자료 ⑦)

def bake_live(areafile):
    import shapefile
    from shapely.geometry import shape, box
    r = shapefile.Reader(areafile, encoding='utf-8'); bb = box(*LIVE_BBOX); places = []
    for sr in r.shapeRecords():
        g = shape(sr.shape.__geo_interface__)
        if not g.intersects(bb): continue
        g = g.simplify(0.00002)
        polys = [g] if g.geom_type == 'Polygon' else list(g.geoms)
        rings = [[[round(x, 6), round(y, 6)] for x, y in p.exterior.coords][:-1] for p in polys]
        cd, cat, nm = sr.record[0], sr.record[1], sr.record[2]
        try: d = seoul('json/citydata/1/5/' + urllib.parse.quote(nm))['CITYDATA']
        except Exception as e: print('ER', nm, e); continue
        o = {'cd': cd, 'cat': cat, 'name': nm, 'rings': rings}
        lp = (d.get('LIVE_PPLTN_STTS') or [{}])[0]
        if lp:
            o['pop'] = {'lvl': lp.get('AREA_CONGEST_LVL'), 'msg': lp.get('AREA_CONGEST_MSG'), 'min': num(lp.get('AREA_PPLTN_MIN')), 'max': num(lp.get('AREA_PPLTN_MAX')),
                        'male': num(lp.get('MALE_PPLTN_RATE')), 'age': [num(lp.get('PPLTN_RATE_%d' % a)) for a in (0, 10, 20, 30, 40, 50, 60, 70)],
                        'resnt': num(lp.get('RESNT_PPLTN_RATE')), 'time': lp.get('PPLTN_TIME'),
                        'fcst': [[f.get('FCST_TIME'), f.get('FCST_CONGEST_LVL'), num(f.get('FCST_PPLTN_MIN')), num(f.get('FCST_PPLTN_MAX'))] for f in (lp.get('FCST_PPLTN') or [])]}
        cm = d.get('LIVE_CMRCL_STTS') or {}
        if isinstance(cm, dict) and cm.get('AREA_CMRCL_LVL'):
            o['card'] = {'lvl': cm.get('AREA_CMRCL_LVL'), 'cnt': num(cm.get('AREA_SH_PAYMENT_CNT')), 'amin': num(cm.get('AREA_SH_PAYMENT_AMT_MIN')), 'amax': num(cm.get('AREA_SH_PAYMENT_AMT_MAX')),
                         'male': num(cm.get('CMRCL_MALE_RATE')), 'age': [num(cm.get('CMRCL_%d_RATE' % a)) for a in (10, 20, 30, 40, 50, 60)], 'corp': num(cm.get('CMRCL_CORPORATION_RATE')), 'time': cm.get('CMRCL_TIME'),
                         'rsb': [[x.get('RSB_LRG_CTGR'), x.get('RSB_MID_CTGR'), x.get('RSB_PAYMENT_LVL'), num(x.get('RSB_SH_PAYMENT_CNT')), num(x.get('RSB_SH_PAYMENT_AMT_MIN')), num(x.get('RSB_SH_PAYMENT_AMT_MAX')), num(x.get('RSB_MCT_CNT'))] for x in (cm.get('CMRCL_RSB') or [])]}
        for key, nm2 in (('LIVE_BUS_PPLTN', 'bus'), ('LIVE_SUB_PPLTN', 'sub')):
            v = d.get(key)
            if isinstance(v, dict) and v:
                p = 'BUS' if nm2 == 'bus' else 'SUB'
                o[nm2] = {'acc': [num(v.get(p + '_ACML_GTON_PPLTN_MIN')), num(v.get(p + '_ACML_GTON_PPLTN_MAX')), num(v.get(p + '_ACML_GTOFF_PPLTN_MIN')), num(v.get(p + '_ACML_GTOFF_PPLTN_MAX'))],
                          'm30': [num(v.get(p + '_30WTHN_GTON_PPLTN_MIN')), num(v.get(p + '_30WTHN_GTON_PPLTN_MAX')), num(v.get(p + '_30WTHN_GTOFF_PPLTN_MIN')), num(v.get(p + '_30WTHN_GTOFF_PPLTN_MAX'))],
                          'n': num(v.get(p + '_STN_CNT'))}
        rt = d.get('ROAD_TRAFFIC_STTS') or {}
        if isinstance(rt, dict):
            a = rt.get('AVG_ROAD_DATA') or {}
            o['road'] = {'idx': a.get('ROAD_TRAFFIC_IDX'), 'spd': num(a.get('ROAD_TRAFFIC_SPD')), 'msg': a.get('ROAD_MSG'), 'time': a.get('ROAD_TRAFFIC_TIME'),
                         'links': [[x.get('ROAD_NM'), x.get('IDX'), num(x.get('SPD')), [[round(float(p.split('_')[0]), 6), round(float(p.split('_')[1]), 6)] for p in (x.get('XYLIST') or '').split('|') if '_' in p]] for x in (rt.get('ROAD_TRAFFIC_STTS') or [])]}
        o['acdnt'] = [[x.get('ACDNT_OCCR_DT'), x.get('ACDNT_TYPE'), x.get('ACDNT_DTYPE'), x.get('ACDNT_INFO'), num(x.get('ACDNT_X')), num(x.get('ACDNT_Y'))] for x in (d.get('ACDNT_CNTRL_STTS') or [])]
        o['event'] = [[x.get('EVENT_NM'), x.get('EVENT_PERIOD'), x.get('EVENT_PLACE')] for x in (d.get('EVENT_STTS') or [])][:6]
        o['prk'] = len(d.get('PRK_STTS') or [])
        w = (d.get('WEATHER_STTS') or [{}])[0]
        if w: o['wx'] = {'t': num(w.get('TEMP')), 'pcp': w.get('PRECPT_TYPE'), 'pm10': w.get('PM10_INDEX'), 'time': w.get('WEATHER_TIME')}
        places.append(o); print('OK', nm, (o.get('pop') or {}).get('lvl'), (o.get('card') or {}).get('lvl'), len((o.get('road') or {}).get('links') or []))
        time.sleep(0.3)
    out = {'schema': 'tg-live/1', 'baked': time.strftime('%Y-%m-%d %H:%M'),
           'source': '서울 열린데이터광장 「서울시 실시간 도시데이터」(OA-21285) · 장소 영역 「서울시 주요 121장소 영역」(OA-21778) — 받은 시각의 한 장(지도는 통신 0 · 다시 받으려면 tools/flow-bake.py live)',
           'note': '인구는 통신사 기지국 추정 범위 · 카드 결제는 신한카드 표본(최근 10분 · 장소 안 가맹점) · 도로 소통은 TOPIS 링크 속도. 예측(fcst)은 받은 시각부터 12시간.',
           'places': places}
    p = os.path.join(ROOT, 'data', 'live-seocho.json')
    open(p, 'w', encoding='utf-8', newline='\n').write(json.dumps(out, ensure_ascii=False, separators=(',', ':')))
    print('wrote', p, os.path.getsize(p), len(places))

def bake_flow():
    pub = json.load(open(os.path.join(ROOT, 'data', 'pubdata-seocho.json'), encoding='utf-8'))
    ids = {b['id'] for b in pub['bus']['items']}
    bus = {i: [[0] * 24, [0] * 24] for i in ids}
    f = os.path.join(KB, 'out', '2026년_버스노선별_정류장별_시간대별_승하차_인원_정보(06월).csv')
    with open(f, encoding='cp949', newline='') as h:
        rd = csv.reader(h); next(rd)
        for row in rd:
            b = bus.get(row[3])
            if not b: continue
            for hr in range(24):
                b[0][hr] += int(row[6 + 2 * hr] or 0); b[1][hr] += int(row[7 + 2 * hr] or 0)
    busOut = {i: [[round(x / 30) for x in v[0]], [round(x / 30) for x in v[1]]] for i, v in bus.items() if sum(v[0]) + sum(v[1]) > 0}
    # 지하철 시간대(2026년 6월 — 버스와 같은 달)
    names = {s['name'] for s in pub['subway']['items']}
    sub = {}
    rows = []
    for st in range(1, 1300, 1000):
        v = seoul('json/CardSubwayTime/%d/%d/202606' % (st, st + 999)).get('CardSubwayTime') or {}
        rows += v.get('row') or []
        if st + 999 >= (v.get('list_total_count') or 0): break
    for r in rows:
        nm = r['STTN'].split('(')[0]
        if nm not in names: continue
        s = sub.setdefault(nm, [[0] * 24, [0] * 24, []])
        if r['SBWY_ROUT_LN_NM'] not in s[2]: s[2].append(r['SBWY_ROUT_LN_NM'])
        for hr in range(24):
            k = hr if hr >= 4 else hr + 24   # 자료는 4시~다음날 3시(HR_24..27 이 0~3시가 아닐 수 있어 둘 다 본다)
            for kk in ('HR_%d' % hr, 'HR_%d' % k):
                on = r.get(kk + '_GET_ON_NOPE'); off = r.get(kk + '_GET_OFF_NOPE')
                if on is not None:
                    s[0][hr] += on; s[1][hr] += off; break
    subOut = {k: [[round(x / 30) for x in v[0]], [round(x / 30) for x in v[1]], v[2]] for k, v in sub.items()}
    # 행정동 카드 추정매출(서울시 상권분석서비스 · 가장 최근 분기)
    q = None
    for cand in ('20263', '20262', '20261', '20254'):
        v = seoul('json/VwsmAdstrdSelngW/1/2/%s' % cand).get('VwsmAdstrdSelngW') or {}
        rr = v.get('row') or []
        if rr and rr[0]['STDR_YYQU_CD'] == cand: q = cand; tot = v['list_total_count']; break
    rows = []
    for st in range(1, tot + 1, 1000):
        v = seoul('json/VwsmAdstrdSelngW/%d/%d/%s' % (st, min(st + 999, tot), q)).get('VwsmAdstrdSelngW') or {}
        rows += [r for r in (v.get('row') or []) if str(r['ADSTRD_CD']).startswith('11650')]
    TB = ['00_06', '06_11', '11_14', '14_17', '17_21', '21_24']
    DW = ['MON', 'TUES', 'WED', 'THUR', 'FRI', 'SAT', 'SUN']
    dong = {}
    for r in rows:
        nm = r['ADSTRD_CD_NM'].replace('.', '·')
        dd = dong.setdefault(nm, {'amt': 0, 'cnt': 0, 'tb': [0] * 6, 'dw': [0] * 7, 'ind': {}})
        a = r['THSMON_SELNG_AMT'] or 0
        dd['amt'] += a; dd['cnt'] += r['THSMON_SELNG_CO'] or 0
        for i, t in enumerate(TB): dd['tb'][i] += r['TMZON_%s_SELNG_AMT' % t] or 0
        for i, w in enumerate(DW): dd['dw'][i] += r['%s_SELNG_AMT' % w] or 0
        ind = dd['ind'].setdefault(r['SVC_INDUTY_CD_NM'], [0] + [0] * 6)
        ind[0] += a
        for i, t in enumerate(TB): ind[1 + i] += r['TMZON_%s_SELNG_AMT' % t] or 0
    M = 1e4   # 만원 단위
    salesOut = {}
    for nm, dd in dong.items():
        top = sorted(dd['ind'].items(), key=lambda kv: -kv[1][0])[:10]
        salesOut[nm] = {'amt': round(dd['amt'] / M), 'cnt': round(dd['cnt']), 'tb': [round(x / M) for x in dd['tb']], 'dw': [round(x / M) for x in dd['dw']],
                        'top': [[k, round(v[0] / M)] + [round(x / M) for x in v[1:]] for k, v in top]}
    out = {'schema': 'tg-flow/1', 'baked': time.strftime('%Y-%m-%d %H:%M'),
           'bus': {'source': '서울시 버스노선별 정류장별 시간대별 승하차 인원(2026년 6월 · 교통카드) — 하루 평균 · [승차 24, 하차 24] · 정류장 id = 표준버스정류장ID', 'items': busOut},
           'subway': {'source': '서울시 지하철 호선별 역별 시간대별 승하차 인원(CardSubwayTime · 2026년 6월 · 교통카드) — 하루 평균 · [승차 24, 하차 24, 노선]', 'items': subOut},
           'sales': {'source': '서울시 상권분석서비스(추정매출-행정동 · VwsmAdstrdSelngW) %s년 %s분기 — 카드사 결제 자료로 추정한 매출(만원) · 시간대 6구간(00~06·06~11·11~14·14~17·17~21·21~24) · 요일 월~일' % (q[:4], q[4]),
                     'quarter': q, 'tb': ['0~6시', '6~11시', '11~14시', '14~17시', '17~21시', '21~24시'], 'items': salesOut}}
    p = os.path.join(ROOT, 'data', 'flow-seocho.json')
    open(p, 'w', encoding='utf-8', newline='\n').write(json.dumps(out, ensure_ascii=False, separators=(',', ':')))
    print('wrote', p, os.path.getsize(p), 'bus', len(busOut), 'sub', len(subOut), 'sales', len(salesOut), q)

if __name__ == '__main__':
    w = sys.argv[1] if len(sys.argv) > 1 else 'flow'
    if w == 'live': bake_live(sys.argv[2])
    else: bake_flow()
