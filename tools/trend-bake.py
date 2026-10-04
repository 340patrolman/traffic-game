# -*- coding: utf-8 -*-
# 데이터 압축지도 「여러 해」 자료 굽기(v0.10.77 · 소유자 「데이터의 범위를 최대 10년간으로 — 충분한 데이터면 더 좋지」)
#   python -X utf8 tools/trend-bake.py   → data/trend-seocho.json
#   ① 지하철 역별 시간대 승차/하차 — 해마다 6월(2017~2026, 10년) · 서울시 CardSubwayTime
#   ② 행정동 카드 추정매출 — 분기마다(2021년 1분기~지금 · 서울시가 이 앞은 내지 않는다) · VwsmAdstrdSelngW
# 키는 07_API키/keys.json 에서만 읽는다(저장소에 넣지 않는다).
import json, os, time, importlib.util
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
spec = importlib.util.spec_from_file_location('fb', os.path.join(ROOT, 'tools', 'flow-bake.py')); fb = importlib.util.module_from_spec(spec); spec.loader.exec_module(fb)
seoul = fb.seoul
pub = json.load(open(os.path.join(ROOT, 'data', 'pubdata-seocho.json'), encoding='utf-8'))
names = {s['name'] for s in pub['subway']['items']}
def days(ym):
    y, m = int(ym[:4]), int(ym[4:]); import calendar; return calendar.monthrange(y, m)[1]
sub = {}; years = []
for y in range(2017, 2027):
    ym = '%d06' % y; rows = []; st = 1
    while True:
        v = seoul('json/CardSubwayTime/%d/%d/%s' % (st, st + 999, ym)).get('CardSubwayTime') or {}
        rows += v.get('row') or []; tot = v.get('list_total_count') or 0
        st += 1000
        if st > tot: break
    if not rows: continue
    years.append(y); nd = days(ym)
    for r in rows:
        nm = r['STTN'].split('(')[0].strip()
        if nm not in names: continue
        s = sub.setdefault(nm, {})
        a = s.setdefault(str(y), [[0] * 24, [0] * 24])
        for h in range(24):
            on = r.get('HR_%d_GET_ON_NOPE'); off = r.get('HR_%d_GET_OFF_NOPE')
            on = r.get('HR_%d_GET_ON_NOPE' % h); off = r.get('HR_%d_GET_OFF_NOPE' % h)
            a[0][h] += on or 0; a[1][h] += off or 0
    for nm in sub:
        if str(y) in sub[nm]: sub[nm][str(y)] = [[round(x / nd) for x in sub[nm][str(y)][0]], [round(x / nd) for x in sub[nm][str(y)][1]]]
    print('sub', ym, len(rows))
# 매출 분기
qs = []
for y in range(2021, 2027):
    for q in range(1, 5):
        qq = '%d%d' % (y, q)
        v = seoul('json/VwsmAdstrdSelngW/1/1/%s' % qq).get('VwsmAdstrdSelngW') or {}
        rr = v.get('row') or []
        if rr and rr[0]['STDR_YYQU_CD'] == qq: qs.append((qq, v['list_total_count']))
TB = ['00_06', '06_11', '11_14', '14_17', '17_21', '21_24']
BAR = {'호프-간이주점', '일반유흥주점', '노래방', '유흥주점', '단란주점'}
sales = {}
for qq, tot in qs:
    for st in range(1, tot + 1, 1000):
        v = seoul('json/VwsmAdstrdSelngW/%d/%d/%s' % (st, min(st + 999, tot), qq)).get('VwsmAdstrdSelngW') or {}
        for r in v.get('row') or []:
            if not str(r['ADSTRD_CD']).startswith('11650'): continue
            nm = r['ADSTRD_CD_NM'].replace('.', '·')
            d = sales.setdefault(nm, {}).setdefault(qq, [0, 0, 0, 0, 0, 0, 0, 0])   # 매출 · 시간대 6 · 주점류
            a = r['THSMON_SELNG_AMT'] or 0; d[0] += a
            for i, t in enumerate(TB): d[1 + i] += r['TMZON_%s_SELNG_AMT' % t] or 0
            if r['SVC_INDUTY_CD_NM'] in BAR: d[7] += a
    print('sales', qq)
for nm in sales:
    for qq in sales[nm]: sales[nm][qq] = [round(x / 1e4) for x in sales[nm][qq]]
out = {'schema': 'tg-trend/1', 'baked': time.strftime('%Y-%m-%d %H:%M'),
       'subway': {'source': '서울시 지하철 호선별 역별 시간대별 승하차 인원(CardSubwayTime) — 해마다 6월 · 하루 평균 · [승차 24, 하차 24]', 'years': years, 'items': sub},
       'sales': {'source': '서울시 상권분석서비스 추정매출-행정동(VwsmAdstrdSelngW) — 분기 · 만원 · [매출, 시간대 6(0~6·6~11·11~14·14~17·17~21·21~24), 주점·노래방류] · 서울시가 2021년 1분기 앞은 내지 않는다', 'quarters': [q for q, _ in qs], 'items': sales}}
p = os.path.join(ROOT, 'data', 'trend-seocho.json')
open(p, 'w', encoding='utf-8', newline='\n').write(json.dumps(out, ensure_ascii=False, separators=(',', ':')))
print('wrote', os.path.getsize(p), 'years', years, 'quarters', len(qs), 'stations', len(sub), 'dongs', len(sales))
