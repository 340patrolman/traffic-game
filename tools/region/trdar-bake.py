# -*- coding: utf-8 -*-
# 데이터 압축지도 「지역 자료」 — 서울 상권 1,650곳(v0.10.92 · 소유자 「상권분석은 그 부분만 따로 써도 어떤 업종을 어디에 열어 할 수 있을 만큼 제대로」)
#   py -3.12 -X utf8 tools/region/trdar-bake.py fetch   → 07_API키/out/region/trdar_*.json (받은 것은 건너뛴다)
#   py -3.12 -X utf8 tools/region/trdar-bake.py build   → data/r/<구>/trdar.json(구의 상권 — 서초 trdar-seocho.json 과 같은 꼴)
#                                                        + data/r/biz/index.json(서울 상권 요약·업종 목록) + data/r/biz/<업종코드>.json(그 업종을 서울 모든 상권에서)
# 서울시 상권분석서비스(서울 열린데이터광장): 영역-상권(OA-15560 · 07_API키/out/seoul_trdar/trdar.shp · EPSG:5181) · 추정매출 VwsmTrdarSelngQq ·
#   점포 VwsmTrdarStorQq · 길단위유동 VwsmTrdarFlpopQq · 직장 VwsmTrdarWrcPopltnQq · 상주 VwsmTrdarRepopQq · 집객시설 VwsmTrdarFcltyQq · 상권변화지표 VwsmTrdarIxQq
# 1년 전 같은 분기(매출·점포)를 함께 받아 「성장」을 본다. 키는 07_API키/keys.json 에서만(flow-bake.seoul).
import json, os, sys, time, importlib.util
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
KB = os.path.join(os.path.dirname(ROOT), '07_API키')
OUT = os.path.join(KB, 'out', 'region'); os.makedirs(OUT, exist_ok=True)
SHP = os.path.join(KB, 'out', 'seoul_trdar', 'trdar')
spec = importlib.util.spec_from_file_location('tb', os.path.join(ROOT, 'tools', 'trdar-bake.py')); tb = importlib.util.module_from_spec(spec); spec.loader.exec_module(tb)
seoul, ind_row, latest = tb.seoul, tb.ind_row, tb.latest
TB, AG, DW, M = tb.TB, tb.AG, tb.DW, tb.M
BAR = tb.BAR
FC = [('VIATR_FCLTY_CO', '집객시설'), ('PBLOFC_CO', '관공서'), ('BANK_CO', '은행'), ('GEHSPT_CO', '종합병원'), ('GNRL_HSPTL_CO', '일반병원'), ('PARMACY_CO', '약국'), ('KNDRGR_CO', '유치원'), ('ELESCH_CO', '초등학교'), ('MSKUL_CO', '중학교'), ('HGSCHL_CO', '고등학교'), ('UNIV_CO', '대학'), ('DRTS_CO', '백화점'), ('SUPMK_CO', '슈퍼마켓'), ('THEAT_CO', '극장'), ('STAYNG_FCLTY_CO', '숙박'), ('SUBWAY_STATN_CO', '지하철역'), ('BUS_STTN_CO', '버스정류장'), ('BUS_TRMINL_CO', '버스터미널')]
g = lambda r, k: round(r.get(k) or 0)

def jget(n):
    p = os.path.join(OUT, n); return json.load(open(p, encoding='utf-8')) if os.path.exists(p) else None
def jput(n, o): open(os.path.join(OUT, n), 'w', encoding='utf-8').write(json.dumps(o, ensure_ascii=False, separators=(',', ':')))

def rows(svc, q):
    out, st = [], 1
    while True:
        v = seoul('json/%s/%d/%d/%s' % (svc, st, st + 999, q)).get(svc) or {}
        rr = v.get('row') or []; tot = v.get('list_total_count') or 0
        out += [r for r in rr if r.get('STDR_YYQU_CD') == q]
        st += 1000
        if st > tot or not rr: break
    return out

def prevq(q): return '%d%s' % (int(q[:4]) - 1, q[4])

def fetch():
    q = latest('VwsmTrdarSelngQq'); print('quarter', q)
    # 최근 분기: 업종 줄 전부 · 1년 전: 업종별 [매출, 건수]
    if not jget('trdar_selng_%s.json' % q):
        d = {}
        for r in rows('VwsmTrdarSelngQq', q): d.setdefault(r['TRDAR_CD'], []).append([r['SVC_INDUTY_CD']] + ind_row(r))
        jput('trdar_selng_%s.json' % q, d); print('selng', q, len(d))
    p = prevq(q)
    if not jget('trdar_selngp_%s.json' % p):
        d = {}
        for r in rows('VwsmTrdarSelngQq', p): d.setdefault(r['TRDAR_CD'], {})[r['SVC_INDUTY_CD']] = [round(g(r, 'THSMON_SELNG_AMT') / M), g(r, 'THSMON_SELNG_CO')]
        jput('trdar_selngp_%s.json' % p, d); print('selngp', p, len(d))
    # 분기 추이(상권마다 [매출, 주점·유흥, 밤 21~6시])
    for y in range(2021, 2027):
        for qq in range(1, 5):
            qs = '%d%d' % (y, qq)
            if qs > q: break
            if jget('trdar_tr_%s.json' % qs): continue
            d = {}
            for r in rows('VwsmTrdarSelngQq', qs):
                t = d.setdefault(r['TRDAR_CD'], [0, 0, 0]); a = r.get('THSMON_SELNG_AMT') or 0; t[0] += a
                if BAR(r['SVC_INDUTY_CD_NM']): t[1] += a
                t[2] += (r.get('TMZON_21_24_SELNG_AMT') or 0) + (r.get('TMZON_00_06_SELNG_AMT') or 0)
            jput('trdar_tr_%s.json' % qs, {k: [round(x / M) for x in v] for k, v in d.items()}); print('tr', qs, len(d))
    # 점포(최근 · 1년 전)
    for qq, nm in ((q, 'trdar_stor_%s.json' % q), (p, 'trdar_storp_%s.json' % p)):
        if jget(nm): continue
        d = {}
        for r in rows('VwsmTrdarStorQq', qq):
            d.setdefault(r['TRDAR_CD'], []).append([r['SVC_INDUTY_CD'], r['SVC_INDUTY_CD_NM'], g(r, 'STOR_CO'), g(r, 'FRC_STOR_CO'), g(r, 'OPBIZ_STOR_CO'), g(r, 'CLSBIZ_STOR_CO'), g(r, 'SIMILR_INDUTY_STOR_CO')])
        jput(nm, d); print('stor', qq, len(d))
    # 사람·시설·변화지표(가장 최근 분기)
    one = {
        'flp': ('VwsmTrdarFlpopQq', lambda r: [g(r, 'TOT_FLPOP_CO'), g(r, 'ML_FLPOP_CO'), g(r, 'FML_FLPOP_CO')] + [g(r, 'AGRDE_%s_FLPOP_CO' % a) for a in AG] + [g(r, 'TMZON_%s_FLPOP_CO' % x) for x in TB] + [g(r, '%s_FLPOP_CO' % d) for d in DW]),
        'wrc': ('VwsmTrdarWrcPopltnQq', lambda r: [g(r, 'TOT_WRC_POPLTN_CO'), g(r, 'ML_WRC_POPLTN_CO'), g(r, 'FML_WRC_POPLTN_CO')] + [g(r, 'AGRDE_%s_WRC_POPLTN_CO' % a) for a in AG]),
        'rep': ('VwsmTrdarRepopQq', lambda r: [g(r, 'TOT_REPOP_CO'), g(r, 'ML_REPOP_CO'), g(r, 'FML_REPOP_CO')] + [g(r, 'AGRDE_%s_REPOP_CO' % a) for a in AG] + [g(r, 'TOT_HSHLD_CO'), g(r, 'APT_HSHLD_CO')]),
        'fac': ('VwsmTrdarFcltyQq', lambda r: [g(r, k) for k, _ in FC]),
        'ix': ('VwsmTrdarIxQq', lambda r: [r.get('TRDAR_CHNGE_IX_NM'), g(r, 'OPR_SALE_MT_AVRG'), g(r, 'CLS_SALE_MT_AVRG'), g(r, 'SU_OPR_SALE_MT_AVRG'), g(r, 'SU_CLS_SALE_MT_AVRG')]),
    }
    for k, (svc, f) in one.items():
        nm = 'trdar_%s.json' % k
        if jget(nm): continue
        qq = latest(svc) or q
        jput(nm, {'q': qq, 'd': {r['TRDAR_CD']: f(r) for r in rows(svc, qq)}}); print(k, qq)

def build():
    import shapefile
    from shapely.geometry import shape
    from shapely.ops import transform
    from pyproj import Transformer
    tr = Transformer.from_crs('EPSG:5181', 'EPSG:4326', always_xy=True)
    sel = sorted(f for f in os.listdir(OUT) if f.startswith('trdar_selng_'))[-1]; q = sel[12:17]; p = prevq(q)
    S, SP = jget(sel), jget('trdar_selngp_%s.json' % p) or {}
    ST, STP = jget('trdar_stor_%s.json' % q) or {}, jget('trdar_storp_%s.json' % p) or {}
    TRQ = sorted(f[9:14] for f in os.listdir(OUT) if f.startswith('trdar_tr_')); TR = {qq: jget('trdar_tr_%s.json' % qq) for qq in TRQ}
    ONE = {k: jget('trdar_%s.json' % k) or {'q': q, 'd': {}} for k in ('flp', 'wrc', 'rep', 'fac', 'ix')}
    rd = shapefile.Reader(SHP, encoding='utf-8'); byGu = {}; meta = []; inds = {}
    for sr in rd.shapeRecords():
        rec = sr.record; cd = rec[2]
        gm = shape(sr.shape.__geo_interface__)
        c = gm.representative_point(); cll = tr.transform(c.x, c.y)
        gs = transform(lambda x, y, z=None: tr.transform(x, y), gm.simplify(2.0))
        polys = [gs] if gs.geom_type == 'Polygon' else list(gs.geoms)
        t = {'cd': cd, 'se': rec[1], 'name': rec[3], 'gu': rec[6], 'guName': rec[7], 'dong': rec[9], 'area': rec[10],
             'rings': [[[round(x, 6), round(y, 6)] for x, y in pg.exterior.coords][:-1] for pg in polys]}
        if cd in S: t['ind'] = [r[1:] for r in S[cd]]
        if cd in SP: t['indp'] = {r[1]: SP[cd][r[0]] for r in S.get(cd, []) if r[0] in SP[cd]}   # 1년 전 같은 분기 [매출, 건수] — 지금 있는 업종만
        trq = {qq: TR[qq][cd] for qq in TRQ if cd in TR[qq]}
        if trq: t['tr'] = trq
        for k in ('flp', 'wrc', 'rep', 'fac', 'ix'):
            if cd in ONE[k]['d']: t[k] = ONE[k]['d'][cd]
        if cd in ST: t['stor'] = [[s[1], s[2], s[3], s[4], s[5], s[6]] for s in ST[cd] if s[2] or s[4] or s[5]]
        sp = {s[0]: s[2] for s in STP.get(cd, [])}
        if sp: t['storp'] = {s[1]: sp[s[0]] for s in ST.get(cd, []) if s[0] in sp and (s[2] or sp[s[0]])}
        byGu.setdefault(rec[6], []).append(t)
        # 창업 자리 찾기 — 상권 요약 한 줄
        i = len(meta)
        meta.append([cd, rec[3], rec[1], rec[6], round(cll[0], 5), round(cll[1], 5), rec[10],
                     (t.get('flp') or [0])[0], (t.get('wrc') or [0])[0], (t.get('rep') or [0])[0],
                     (t.get('ix') or [''])[0], (t.get('ix') or [0, 0])[1], (t.get('ix') or [0, 0, 0])[2],
                     sum(r[1] for r in t.get('ind', [])), sum(s[1] for s in t.get('stor', []))])
        # 업종별 — [상권 번호, 매출, 건수, 점포, 프랜차이즈, 개업, 폐업, 1년 전 매출, 1년 전 점포, 시간대 매출 6, 연령 매출 6, 주말 매출]
        sr2 = {s[0]: s for s in ST.get(cd, [])}; spp = sp
        rowsBy = {r[0]: r for r in S.get(cd, [])}
        for code in set(rowsBy) | set(sr2):
            r = rowsBy.get(code); s = sr2.get(code)
            if not r and not (s and (s[2] or s[5])): continue
            nm = (r[1] if r else s[1])
            I = inds.setdefault(code, {'name': nm, 'rows': []})
            amt, co = (r[2], r[3]) if r else (0, 0)
            pa = (SP.get(cd, {}).get(code) or [None])[0]
            I['rows'].append([i, amt, co, s[2] if s else 0, s[3] if s else 0, s[4] if s else 0, s[5] if s else 0, pa, spp.get(code)] +
                             (r[4:10] + r[10:16] + [r[23] + r[24]] if r else [0] * 13))
    os.makedirs(os.path.join(ROOT, 'data', 'r', 'biz'), exist_ok=True)
    src = ('서울시 상권분석서비스(서울 열린데이터광장) — 영역-상권(OA-15560) · 추정매출 %s(카드사 결제 추정 · 1년 전 %s) · 점포 · 길단위유동인구(%s) · 직장인구(%s) · 상주인구(%s) · 집객시설(%s) · 상권변화지표(%s)'
           % (q, p, ONE['flp']['q'], ONE['wrc']['q'], ONE['rep']['q'], ONE['fac']['q'], ONE['ix']['q']))
    fields = {'ind': '[업종, 매출(만원), 건수, 시간대 매출 6(0~6·6~11·11~14·14~17·17~21·21~24), 연령 매출 6(10·20·30·40·50·60+), 남, 여, 요일 매출 7(월~일), 시간대 건수 6, 연령 건수 6]',
              'indp': '{업종: [1년 전 같은 분기 매출(만원), 건수]}', 'tr': '{분기: [매출, 주점·유흥 매출, 밤(21~24 + 0~6) 매출]} 만원', 'flp': '[계, 남, 여, 연령 6, 시간대 6, 요일 7] 분기 유동인구',
              'wrc': '[계, 남, 여, 연령 6] 직장인구', 'rep': '[계, 남, 여, 연령 6, 가구, 아파트 가구] 상주인구', 'stor': '[업종, 점포, 프랜차이즈, 개업, 폐업, 유사업종 포함 점포]', 'storp': '{업종: 1년 전 점포}',
              'fac': [n for _, n in FC], 'ix': '[상권변화지표, 운영 평균 개월, 폐업 평균 개월, 서울 운영 평균, 서울 폐업 평균]'}
    note = '매출은 카드사 결제 자료로 추정한 값(현금 제외) — 업종 × 연령과 업종 × 시간대는 있지만 업종 × 연령 × 시간대 셋을 동시에 나눈 값은 공개되지 않는다. 분기 자료다.'
    idx = []
    for gu, L in sorted(byGu.items()):
        d = os.path.join(ROOT, 'data', 'r', gu); os.makedirs(d, exist_ok=True); pth = os.path.join(d, 'trdar.json')
        open(pth, 'w', encoding='utf-8', newline='\n').write(json.dumps({'schema': 'tg-trdar/2', 'gu': gu, 'quarter': q, 'prev': p, 'source': src, 'fields': fields, 'note': note, 'trdar': L}, ensure_ascii=False, separators=(',', ':')))
        idx.append([gu, os.path.getsize(pth), len(L)]); print(gu, len(L), os.path.getsize(pth))
    # 창업 자리 찾기 — 업종마다 한 파일
    il = []
    for code, I in sorted(inds.items(), key=lambda kv: -sum(r[1] for r in kv[1]['rows'])):
        pth = os.path.join(ROOT, 'data', 'r', 'biz', code + '.json')
        open(pth, 'w', encoding='utf-8', newline='\n').write(json.dumps({'schema': 'tg-biz/1', 'code': code, 'name': I['name'], 'quarter': q, 'prev': p, 'rows': I['rows']}, ensure_ascii=False, separators=(',', ':')))
        il.append([code, I['name'], len(I['rows']), sum(r[1] for r in I['rows']), sum(r[3] for r in I['rows']), os.path.getsize(pth)])
    bi = {'schema': 'tg-bizidx/1', 'baked': time.strftime('%Y-%m-%d'), 'quarter': q, 'prev': p, 'source': src, 'note': note,
          'meta': '[상권코드, 이름, 갈래, 구, 경도, 위도, 넓이㎡, 분기 유동, 직장, 상주, 변화지표, 운영 평균 개월, 폐업 평균 개월, 한 달 매출 계(만원), 점포 계]',
          'row': '[상권 번호, 매출(만원), 건수, 점포, 프랜차이즈, 개업, 폐업, 1년 전 매출, 1년 전 점포, 시간대 매출 6, 연령 매출 6, 주말 매출]',
          'trdar': meta, 'inds': il, 'gus': idx}
    open(os.path.join(ROOT, 'data', 'r', 'biz', 'index.json'), 'w', encoding='utf-8', newline='\n').write(json.dumps(bi, ensure_ascii=False, separators=(',', ':')))
    print('trdar', len(meta), 'inds', len(il), 'biz', sum(x[5] for x in il), 'idx', os.path.getsize(os.path.join(ROOT, 'data', 'r', 'biz', 'index.json')))
    # 지역 목록에 상권 바이트를 더한다
    rp = os.path.join(ROOT, 'data', 'r', 'index.json'); R = json.load(open(rp, encoding='utf-8'))
    m = {x[0]: x for x in idx}
    for gg in R['gus']:
        if gg['gu'] in m: gg['bytes']['trdar'] = m[gg['gu']][1]; gg['ntrdar'] = m[gg['gu']][2]
    R['layers']['trdar'] = '상권(서울시 상권분석서비스) — 서초 trdar-seocho.json 과 같은 꼴 + 1년 전 매출·점포'
    R['layers']['biz'] = '창업 자리 찾기 — data/r/biz/index.json(상권 요약) + <업종코드>.json(그 업종을 서울 모든 상권에서)'
    open(rp, 'w', encoding='utf-8', newline='\n').write(json.dumps(R, ensure_ascii=False, separators=(',', ':')))

if __name__ == '__main__':
    (fetch if (sys.argv[1:] or ['build'])[0] == 'fetch' else build)()
