# -*- coding: utf-8 -*-
# 데이터 압축지도 「지역 자료」 — 서울 25개 구 행정동 층(v0.10.91 · 소유자 「서울 전역으로 · 권고대로 모두 진행 · 제대로 하자」)
#   py -3.12 -X utf8 tools/region/dong-bake.py fetch   → 원자료를 받아 07_API키/out/region/ 에 모은다(다시 돌리면 받은 것은 건너뛴다)
#   py -3.12 -X utf8 tools/region/dong-bake.py build   → data/r/<구 5자리>/dong.json + data/r/index.json
# 한 구 한 파일 — 지도는 화면에 걸린 구만 받는다(통신은 지도 파일을 받을 때뿐 · 게임은 통신 0).
# 동 열쇠 = 행정동 코드 8자리(adm_cd2 앞 8 · 서울 생활인구·상권 ADSTRD_CD 와 같다). 동 이름은 구가 달라도 겹친다(신사동 · 강남/관악) — 이름으로 찾지 않는다.
# 출처 · 경계: 통계청 SGIS 행정동(vuski/admdongkor ver20260701 · 공공누리 1유형) · 주민: 행정안전부 주민등록 인구통계(jumin.mois.go.kr · 행정동별 연령별)
#   생활인구: 서울시 행정동 단위 생활인구(LOCAL_PEOPLE_DONG · 2026년 7월 · KT 통신 추정) · 카드 매출: 서울시 상권분석서비스 추정매출-행정동(VwsmAdstrdSelngW)
# 키는 07_API키/keys.json 에서만 읽는다(flow-bake.py 의 seoul()) — 이 파일·결과물에 키가 없다.
import json, os, sys, time, csv, io, zipfile, re, urllib.request, urllib.parse, importlib.util
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
KB = os.path.join(os.path.dirname(ROOT), '07_API키')
OUT = os.path.join(KB, 'out', 'region'); os.makedirs(OUT, exist_ok=True)
HJD = os.path.join(os.path.dirname(ROOT), '13_관할경계', '원자료', 'hjd20260701.geojson')
LPZ = os.path.join(KB, 'out', 'LOCAL_PEOPLE_DONG_202607.zip')
spec = importlib.util.spec_from_file_location('fb', os.path.join(ROOT, 'tools', 'flow-bake.py')); fb = importlib.util.module_from_spec(spec); spec.loader.exec_module(fb)
spec2 = importlib.util.spec_from_file_location('tb', os.path.join(ROOT, 'tools', 'trdar-bake.py')); tb = importlib.util.module_from_spec(spec2); spec2.loader.exec_module(tb)
seoul = fb.seoul
TB = ['00_06', '06_11', '11_14', '14_17', '17_21', '21_24']; DW = ['MON', 'TUES', 'WED', 'THUR', 'FRI', 'SAT', 'SUN']
BARS = {'호프-간이주점', '일반유흥주점', '노래방', '유흥주점', '단란주점'}   # trend-bake 와 같은 묶음
M = 1e4
JUMIN_YM = '202609'
# 행정동 바뀜(2024~2026) — 서울시 자료(생활인구 2026.7 · 상권 분기)는 옛 코드로 남아 있다
RENUM = {'11305590': '11305595', '11305600': '11305603', '11305606': '11305608', '11305610': '11305615', '11305620': '11305625', '11305630': '11305635',   # 강북구 번1~3·수유1~3동 코드만 바뀜
         '11680740': '11680675'}   # 강남구 일원2동 → 개포3동(이름 바뀜)
SPLIT = {'11230536': ('용신동', ['11230515', '11230533']),   # 동대문구 용신동 → 신설동·용두동
         '11740520': ('상일동', ['11740525', '11740526'])}   # 강동구 상일동 → 상일제1·2동

def jget(name):
    p = os.path.join(OUT, name)
    return json.load(open(p, encoding='utf-8')) if os.path.exists(p) else None
def jput(name, o):
    open(os.path.join(OUT, name), 'w', encoding='utf-8').write(json.dumps(o, ensure_ascii=False, separators=(',', ':')))

def seoul_gus():
    g = json.load(open(HJD, encoding='utf-8'))
    feats = [f for f in g['features'] if f['properties']['adm_cd2'].startswith('11')]
    gus = {}
    for f in feats: gus.setdefault(f['properties']['sgg'], f['properties']['sggnm'])
    return feats, gus

# ---------- 받기 ----------
def fetch_jumin(gus):
    name = 'jumin_%s.json' % JUMIN_YM
    have = jget(name) or {}
    y, m = JUMIN_YM[:4], JUMIN_YM[4:]
    for gu in sorted(gus):
        if gu in have: continue
        body = ('tableChart=T&sltOrgType=2&sltOrgLvl1=1100000000&sltOrgLvl2=%s00000&sltUndefType=&nowYear=%s&searchYearMonth=month&searchYearStart=%s&searchMonthStart=%s'
                '&searchYearEnd=%s&searchMonthEnd=%s&sum=sum&sltArgTypes=10&sltArgTypeA=0&sltArgTypeB=100') % (gu, y, y, m, y, m)
        t = urllib.request.urlopen(urllib.request.Request('https://jumin.mois.go.kr/ageStatMonth.do', data=body.encode(), headers={'User-Agent': 'Mozilla/5.0'}), timeout=60).read().decode('utf-8', 'replace')
        rows = {}
        for r in re.findall(r'<tr[^>]*>(.*?)</tr>', t, re.S):
            c = [re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', '', x)).strip() for x in re.findall(r'<t[dh][^>]*>(.*?)</t[dh]>', r, re.S)]
            if len(c) >= 15 and re.fullmatch(r'\d{10}', c[0]):
                n = [int(x.replace(',', '') or 0) for x in c[2:15]]
                rows[c[0]] = {'name': c[1], 'tot': n[0], 'age': n[2:12], 'a100': n[12]}
        have[gu] = rows; jput(name, have); print('jumin', gu, gus[gu], len(rows)); time.sleep(0.5)
    return have

def quarters():
    qs = []
    for y in range(2021, 2027):
        for q in range(1, 5):
            qq = '%d%d' % (y, q)
            v = seoul('json/VwsmAdstrdSelngW/1/1/%s' % qq).get('VwsmAdstrdSelngW') or {}
            rr = v.get('row') or []
            if rr and rr[0]['STDR_YYQU_CD'] == qq: qs.append((qq, v['list_total_count']))
    return qs

def fetch_sales(qs):
    # 분기마다 동 열쇠(8) → 추이 [매출, 시간대 6, 주점류] · 마지막 분기는 업종 줄(ind_row)까지
    last = qs[-1][0]
    for qq, tot in qs:
        name = 'sales_%s.json' % qq
        if jget(name): continue
        agg, ind = {}, {}
        for st in range(1, tot + 1, 1000):
            v = seoul('json/VwsmAdstrdSelngW/%d/%d/%s' % (st, min(st + 999, tot), qq)).get('VwsmAdstrdSelngW') or {}
            for r in v.get('row') or []:
                k = str(r['ADSTRD_CD'])[:8]
                d = agg.setdefault(k, [0] * 8); a = r['THSMON_SELNG_AMT'] or 0; d[0] += a
                for i, t in enumerate(TB): d[1 + i] += r['TMZON_%s_SELNG_AMT' % t] or 0
                if r['SVC_INDUTY_CD_NM'] in BARS: d[7] += a
                if qq == last:
                    x = ind.setdefault(k, {'nm': r['ADSTRD_CD_NM'], 'cnt': 0, 'dw': [0] * 7, 'rows': []})
                    x['cnt'] += r['THSMON_SELNG_CO'] or 0
                    for i, w in enumerate(DW): x['dw'][i] += r['%s_SELNG_AMT' % w] or 0
                    x['rows'].append(tb.ind_row(r))
        jput(name, {'q': qq, 'agg': agg, 'ind': ind if qq == last else None}); print('sales', qq, len(agg))

def fetch_live():
    name = 'live_202607.json'
    if jget(name): return
    import datetime
    z = zipfile.ZipFile(LPZ); f = io.TextIOWrapper(z.open(z.namelist()[0]), encoding='utf-8-sig')
    rd = csv.reader(f); hd = next(rd)
    s = {}; days = {}
    for r in rd:
        d = r[0]; h = int(r[1]); k = r[2][:8]; v = float(r[3] or 0)
        we = datetime.date(int(d[:4]), int(d[4:6]), int(d[6:])).weekday() >= 5
        days.setdefault(we, set()).add(d)
        a = s.setdefault(k, [[0.0] * 24, [0.0] * 24]); a[1 if we else 0][h] += v
    nwd, nwe = len(days.get(False, ())), len(days.get(True, ()))
    out = {k: {'wd': [round(x / nwd) for x in a[0]], 'we': [round(x / nwe) for x in a[1]]} for k, a in s.items()}
    jput(name, {'days': [nwd, nwe], 'dong': out}); print('live', len(out), nwd, nwe)

# ---------- 굽기 ----------
def build():
    import shapely
    from shapely.geometry import shape, mapping
    feats, gus = seoul_gus()
    jum = jget('jumin_%s.json' % JUMIN_YM) or {}
    live = (jget('live_202607.json') or {}).get('dong', {})
    qfiles = sorted(f for f in os.listdir(OUT) if f.startswith('sales_'))
    sales = [jget(f) for f in qfiles]; QS = [s['q'] for s in sales]; last = sales[-1]
    # 원자료(2026.7 생활인구 · 분기 매출)가 옛 행정동 코드로 남은 곳 — 이름만 바뀐 곳은 새 코드로 옮기고, 나뉜 곳은 옛 동 값을 따로(old) 붙인다(나눠 지어내지 않는다)
    def remap(dct):
        for a, b in RENUM.items():
            if a in dct and b not in dct: dct[b] = dct.pop(a)
    remap(live)
    for sd in sales:
        remap(sd['agg'])
        if sd.get('ind'): remap(sd['ind'])
    geoms = [shape(f['geometry']) for f in feats]
    simp = shapely.coverage_simplify(geoms, 0.00004)   # 공유 변을 함께 단순화(틈 없음) · 약 4m
    os.makedirs(os.path.join(ROOT, 'data', 'r'), exist_ok=True)
    idx = []; miss = {'jumin': 0, 'live': 0, 'sales': 0}
    for gu in sorted(gus):
        J = jum.get(gu, {}); jn = {v['name']: v for v in J.values()}
        out = []; ext = {}; box = [999, 999, -999, -999]
        for f, g in zip(feats, simp):
            p = f['properties']
            if p['sgg'] != gu: continue
            k = p['adm_cd2'][:8]; nm = p['adm_nm'].split(' ')[-1]
            polys = [g] if g.geom_type == 'Polygon' else list(g.geoms)
            P = [[[[round(x, 6), round(y, 6)] for x, y in pg.exterior.coords]] + [[[round(x, 6), round(y, 6)] for x, y in r.coords] for r in pg.interiors] for pg in polys]
            for pg in polys:
                b = pg.bounds; box = [min(box[0], b[0]), min(box[1], b[1]), max(box[2], b[2]), max(box[3], b[3])]
            o = {'k': k, 'name': nm, 'polys': P}
            jp = J.get(p['adm_cd2']) or jn.get(nm)
            if jp: o['pop'] = {'tot': jp['tot'], 'age': jp['age']}
            else: miss['jumin'] += 1
            if k in live: o['live'] = live[k]
            else: miss['live'] += 1
            for ok, (onm, kids) in SPLIT.items():
                if k in kids:
                    od = {'name': onm, 'k': ok}
                    if ok in live: od['live'] = live[ok]
                    lo = (last.get('ind') or {}).get(ok)
                    if lo:
                        a0 = last['agg'][ok]; rr = sorted(lo['rows'], key=lambda r: -r[1])
                        od['sales'] = {'amt': round(a0[0] / M), 'cnt': round(lo['cnt']), 'tb': [round(v / M) for v in a0[1:7]], 'dw': [round(v / M) for v in lo['dw']], 'top': [[r[0], r[1]] + r[3:9] for r in rr[:10]]}
                    o['old'] = od
            x = (last.get('ind') or {}).get(k)
            if x:
                a = last['agg'][k]; rows = sorted(x['rows'], key=lambda r: -r[1])
                o['sales'] = {'amt': round(a[0] / M), 'cnt': round(x['cnt']), 'tb': [round(v / M) for v in a[1:7]], 'dw': [round(v / M) for v in x['dw']],
                              'top': [[r[0], r[1]] + r[3:9] for r in rows[:10]]}
                ext.setdefault(k, {})['ind'] = rows
            else: miss['sales'] += 1
            tr = [[round(v / M) for v in s['agg'][k]] if k in s['agg'] else None for s in sales]
            if any(tr): ext.setdefault(k, {})['tr'] = tr
            big = max(polys, key=lambda q: q.area).representative_point()
            o['c'] = [round(big.x, 5), round(big.y, 5)]   # 이름 자리(동 안 · 찾기에도)
            out.append(o)
        doc = {'schema': 'tg-rdong/1', 'gu': gu, 'name': gus[gu], 'baked': time.strftime('%Y-%m-%d'),
               'quarter': QS[-1], 'quarters': QS, 'tb': ['0~6시', '6~11시', '11~14시', '14~17시', '17~21시', '21~24시'],
               'source': {'경계': '통계청 SGIS 행정동 경계(vuski/admdongkor HangJeongDong_ver20260701 · 공공누리 제1유형) · 공유 변 함께 약 4m 단순화',
                          '주민': '행정안전부 주민등록 인구통계 · 행정동별 연령별 인구(jumin.mois.go.kr) · %s년 %s월 · 10세 구간(100세 이상 제외)' % (JUMIN_YM[:4], int(JUMIN_YM[4:])),
                          '생활인구': '서울시 행정동 단위 생활인구(LOCAL_PEOPLE_DONG) 2026년 7월 — 평일·주말 시간대 평균(명) · KT 통신 자료로 추정한 「그 시각 그 동에 있는 사람 수」',
                          '매출': '서울시 상권분석서비스 추정매출-행정동(VwsmAdstrdSelngW) %s년 %s분기 — 카드사 결제로 추정한 매출(만원)' % (QS[-1][:4], QS[-1][4]),
                          '업종 줄': '[이름, 매출, 건수, 시간대 금액 6, 연령 금액 6, 남, 여, 요일 금액 7, 시간대 건수 6, 연령 건수 6] — dongx.json',
                          '추이': '같은 자료 분기마다(%s~%s) — [매출, 시간대 6, 주점·노래방류] 만원' % (QS[0], QS[-1])},
               'dong': out}
        d = os.path.join(ROOT, 'data', 'r', gu); os.makedirs(d, exist_ok=True)
        pth = os.path.join(d, 'dong.json'); pth2 = os.path.join(d, 'dongx.json')
        open(pth, 'w', encoding='utf-8', newline='\n').write(json.dumps(doc, ensure_ascii=False, separators=(',', ':')))
        open(pth2, 'w', encoding='utf-8', newline='\n').write(json.dumps({'schema': 'tg-rdongx/1', 'gu': gu, 'quarters': QS, 'dong': ext}, ensure_ascii=False, separators=(',', ':')))
        idx.append({'gu': gu, 'name': gus[gu], 'box': [round(v, 5) for v in box], 'n': len(out), 'd': [[o['name']] + o['c'] for o in out], 'bytes': {'dong': os.path.getsize(pth), 'dongx': os.path.getsize(pth2)}})
        print(gu, gus[gu], len(out), os.path.getsize(pth), os.path.getsize(pth2))
    try:   # 다른 굽기(상권·점포·승하차·안전)가 적어 둔 바이트·층은 남긴다
        old = json.load(open(os.path.join(ROOT, 'data', 'r', 'index.json'), encoding='utf-8')); om = {g['gu']: g for g in old.get('gus', [])}
        for e in idx:
            o2 = om.get(e['gu']) or {}
            for k, v in (o2.get('bytes') or {}).items():
                if k not in e['bytes']: e['bytes'][k] = v
            for k in ('ntrdar', 'nstores'):
                if k in o2: e[k] = o2[k]
        oldL = old.get('layers', {})
    except Exception: oldL = {}
    ix = {'schema': 'tg-rindex/1', 'baked': time.strftime('%Y-%m-%d'), 'layers': {'dong': '행정동 — 경계·주민 연령·생활인구·카드 매출 요약', 'dongx': '행정동 카드에서만 — 업종 줄(업종×연령·시간대)·분기 추이'},
          'note': '서울 25개 구 — 한 구 한 파일. 지도는 화면에 걸린 구만 받는다. 서초구(11650)는 기존 서초 자료가 그대로 우선이다.', 'gus': idx}
    for k, v in oldL.items(): ix['layers'].setdefault(k, v)
    open(os.path.join(ROOT, 'data', 'r', 'index.json'), 'w', encoding='utf-8', newline='\n').write(json.dumps(ix, ensure_ascii=False, separators=(',', ':')))
    print('miss', miss, 'total', sum(i['bytes']['dong'] for i in idx), sum(i['bytes']['dongx'] for i in idx))

if __name__ == '__main__':
    st = sys.argv[1] if len(sys.argv) > 1 else 'build'
    if st == 'fetch':
        feats, gus = seoul_gus()
        fetch_jumin(gus); fetch_live()
        qs = quarters(); print('quarters', [q for q, _ in qs]); fetch_sales(qs)
    else:
        build()
