# -*- coding: utf-8 -*-
# 데이터 압축지도 「상권분석」 굽기(v0.10.78 · 소유자 「상권분석과 똑같이 · 어떤 업종에서 어떤 연령대가 카드를 어떻게 쓰는지 — 음주운전 예방 · 지역을 세세하게」)
#   python -X utf8 tools/trdar-bake.py <상권 영역 shp 경로(확장자 없이)>  → data/trdar-seocho.json
#   서울시 상권분석서비스: 영역-상권(OA-15560, Korea 2000 중부 · FN 500000 = EPSG:5181) · 추정매출(VwsmTrdarSelngQq · 업종 × 시간대/연령/성별/요일 — 금액·건수)
#   길단위유동인구(VwsmTrdarFlpopQq) · 직장인구(VwsmTrdarWrcPopltnQq) · 상주인구(VwsmTrdarRepopQq) · 점포(VwsmTrdarStorQq) · 집객시설(VwsmTrdarFcltyQq) · 상권변화지표(VwsmTrdarIxQq)
#   + 행정동 추정매출(VwsmAdstrdSelngW)도 업종 × 시간대/연령/성별/요일로. 키는 07_API키/keys.json 에서만 읽는다.
import json, os, sys, time, importlib.util
import shapefile
from shapely.geometry import shape
from shapely.ops import transform
from pyproj import Transformer
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
spec = importlib.util.spec_from_file_location('fb', os.path.join(ROOT, 'tools', 'flow-bake.py')); fb = importlib.util.module_from_spec(spec); spec.loader.exec_module(fb)
seoul = fb.seoul
TB = ['00_06', '06_11', '11_14', '14_17', '17_21', '21_24']; AG = ['10', '20', '30', '40', '50', '60_ABOVE']; DW = ['MON', 'TUES', 'WED', 'THUR', 'FRI', 'SAT', 'SUN']
BAR = lambda n: ('주점' in n) or ('유흥' in n)
M = 1e4
def allrows(svc, q, keep):
    rows, st = [], 1
    while True:
        v = seoul('json/%s/%d/%d/%s' % (svc, st, st + 999, q)).get(svc) or {}
        rr = v.get('row') or []; tot = v.get('list_total_count') or 0
        rows += [r for r in rr if keep(r)]
        st += 1000
        if st > tot or not rr: break
    return rows
def latest(svc):
    for q in ('20263', '20262', '20261', '20254'):
        v = seoul('json/%s/1/1/%s' % (svc, q)).get(svc) or {}
        rr = v.get('row') or []
        if rr and rr[0].get('STDR_YYQU_CD') == q: return q
    return None
def ind_row(r):   # 업종 한 줄 → [이름, 매출, 건수, 시간대 금액 6, 연령 금액 6, 남, 여, 요일 금액 7, 시간대 건수 6, 연령 건수 6]
    g = lambda k: r.get(k) or 0
    return [r['SVC_INDUTY_CD_NM'], round(g('THSMON_SELNG_AMT') / M), round(g('THSMON_SELNG_CO'))] + \
        [round(g('TMZON_%s_SELNG_AMT' % t) / M) for t in TB] + [round(g('AGRDE_%s_SELNG_AMT' % a) / M) for a in AG] + \
        [round(g('ML_SELNG_AMT') / M), round(g('FML_SELNG_AMT') / M)] + [round(g('%s_SELNG_AMT' % d) / M) for d in DW] + \
        [round(g('TMZON_%s_SELNG_CO' % t)) for t in TB] + [round(g('AGRDE_%s_SELNG_CO' % a)) for a in AG]

def main(shp):
    tr = Transformer.from_crs('EPSG:5181', 'EPSG:4326', always_xy=True)
    rd = shapefile.Reader(shp, encoding='utf-8'); T = {}
    for sr in rd.shapeRecords():
        rec = sr.record
        if rec[6] != '11650': continue
        g = shape(sr.shape.__geo_interface__).simplify(2.0)
        g = transform(lambda x, y, z=None: tr.transform(x, y), g)
        polys = [g] if g.geom_type == 'Polygon' else list(g.geoms)
        T[rec[2]] = {'cd': rec[2], 'se': rec[1], 'name': rec[3], 'dong': rec[9], 'area': rec[10],
                     'rings': [[[round(x, 6), round(y, 6)] for x, y in p.exterior.coords][:-1] for p in polys]}
    print('trdar', len(T))
    inT = lambda r: r.get('TRDAR_CD') in T
    q = latest('VwsmTrdarSelngQq'); print('quarter', q)
    for r in allrows('VwsmTrdarSelngQq', q, inT): T[r['TRDAR_CD']].setdefault('ind', []).append(ind_row(r))
    # 매출 추이(분기 · 매출 · 주점류 · 밤 21~06시)
    for y in range(2021, 2027):
        for qq in range(1, 5):
            qs = '%d%d' % (y, qq)
            if qs > q: break
            for r in allrows('VwsmTrdarSelngQq', qs, inT):
                t = T[r['TRDAR_CD']].setdefault('tr', {}).setdefault(qs, [0, 0, 0])
                a = r.get('THSMON_SELNG_AMT') or 0; t[0] += a
                if BAR(r['SVC_INDUTY_CD_NM']): t[1] += a
                t[2] += (r.get('TMZON_21_24_SELNG_AMT') or 0) + (r.get('TMZON_00_06_SELNG_AMT') or 0)
            print('trend', qs)
    for t in T.values():
        for k in list(t.get('tr', {})): t['tr'][k] = [round(x / M) for x in t['tr'][k]]
    def one(svc, f):
        qq = latest(svc) or q
        for r in allrows(svc, qq, lambda r: inT(r) and r.get('STDR_YYQU_CD') == qq): f(T[r['TRDAR_CD']], r)
        return qq
    g = lambda r, k: round(r.get(k) or 0)
    qf = one('VwsmTrdarFlpopQq', lambda t, r: t.__setitem__('flp', [g(r, 'TOT_FLPOP_CO'), g(r, 'ML_FLPOP_CO'), g(r, 'FML_FLPOP_CO')] + [g(r, 'AGRDE_%s_FLPOP_CO' % a) for a in AG] + [g(r, 'TMZON_%s_FLPOP_CO' % x) for x in TB] + [g(r, '%s_FLPOP_CO' % d) for d in DW]))
    qw = one('VwsmTrdarWrcPopltnQq', lambda t, r: t.__setitem__('wrc', [g(r, 'TOT_WRC_POPLTN_CO'), g(r, 'ML_WRC_POPLTN_CO'), g(r, 'FML_WRC_POPLTN_CO')] + [g(r, 'AGRDE_%s_WRC_POPLTN_CO' % a) for a in AG]))
    qr = one('VwsmTrdarRepopQq', lambda t, r: t.__setitem__('rep', [g(r, 'TOT_REPOP_CO'), g(r, 'ML_REPOP_CO'), g(r, 'FML_REPOP_CO')] + [g(r, 'AGRDE_%s_REPOP_CO' % a) for a in AG] + [g(r, 'TOT_HSHLD_CO'), g(r, 'APT_HSHLD_CO')]))
    qs = one('VwsmTrdarStorQq', lambda t, r: t.setdefault('stor', []).append([r['SVC_INDUTY_CD_NM'], g(r, 'STOR_CO'), g(r, 'FRC_STOR_CO'), g(r, 'OPBIZ_STOR_CO'), g(r, 'CLSBIZ_STOR_CO')]))
    FC = [('VIATR_FCLTY_CO', '집객시설'), ('PBLOFC_CO', '관공서'), ('BANK_CO', '은행'), ('GEHSPT_CO', '종합병원'), ('GNRL_HSPTL_CO', '일반병원'), ('PARMACY_CO', '약국'), ('KNDRGR_CO', '유치원'), ('ELESCH_CO', '초등학교'), ('MSKUL_CO', '중학교'), ('HGSCHL_CO', '고등학교'), ('UNIV_CO', '대학'), ('DRTS_CO', '백화점'), ('SUPMK_CO', '슈퍼마켓'), ('THEAT_CO', '극장'), ('STAYNG_FCLTY_CO', '숙박'), ('SUBWAY_STATN_CO', '지하철역'), ('BUS_STTN_CO', '버스정류장'), ('BUS_TRMINL_CO', '버스터미널')]
    qc = one('VwsmTrdarFcltyQq', lambda t, r: t.__setitem__('fac', [g(r, k) for k, _ in FC]))
    qi = one('VwsmTrdarIxQq', lambda t, r: t.__setitem__('ix', [r.get('TRDAR_CHNGE_IX_NM'), g(r, 'OPR_SALE_MT_AVRG'), g(r, 'CLS_SALE_MT_AVRG')]))
    # 행정동: 업종 × 시간대/연령/성별/요일
    dong = {}
    tot = (seoul('json/VwsmAdstrdSelngW/1/1/%s' % q).get('VwsmAdstrdSelngW') or {}).get('list_total_count') or 0
    for r in allrows('VwsmAdstrdSelngW', q, lambda r: str(r['ADSTRD_CD']).startswith('11650')):
        dong.setdefault(r['ADSTRD_CD_NM'].replace('.', '·'), []).append(ind_row(r))
    out = {'schema': 'tg-trdar/1', 'baked': time.strftime('%Y-%m-%d %H:%M'),
           'source': '서울시 상권분석서비스(서울 열린데이터광장) — 영역-상권(OA-15560) · 추정매출(카드사 결제 자료로 추정 · %s) · 길단위유동인구(%s) · 직장인구(%s) · 상주인구(%s) · 점포(%s) · 집객시설(%s) · 상권변화지표(%s)' % (q, qf, qw, qr, qs, qc, qi),
           'quarter': q, 'fields': {'ind': '[업종, 매출(만원), 건수, 시간대 매출 6(0~6·6~11·11~14·14~17·17~21·21~24), 연령 매출 6(10·20·30·40·50·60+), 남, 여, 요일 매출 7(월~일), 시간대 건수 6, 연령 건수 6]',
             'tr': '{분기: [매출, 주점·유흥 매출, 밤(21~24 + 0~6) 매출]} 만원', 'flp': '[계, 남, 여, 연령 6, 시간대 6, 요일 7] 분기 유동인구',
             'wrc': '[계, 남, 여, 연령 6] 직장인구', 'rep': '[계, 남, 여, 연령 6, 가구, 아파트 가구] 상주인구', 'stor': '[업종, 점포, 프랜차이즈, 개업, 폐업]', 'fac': [n for _, n in FC], 'ix': '[상권변화지표, 운영 평균 개월, 폐업 평균 개월]'},
           'note': '매출은 카드사 결제 자료로 추정한 값(현금 제외) — 업종 × 연령과 업종 × 시간대는 있지만 업종 × 연령 × 시간대 셋을 동시에 나눈 값은 공개되지 않는다. 분기 자료다.',
           'trdar': list(T.values()), 'dong': dong}
    p = os.path.join(ROOT, 'data', 'trdar-seocho.json')
    open(p, 'w', encoding='utf-8', newline='\n').write(json.dumps(out, ensure_ascii=False, separators=(',', ':')))
    print('wrote', os.path.getsize(p), len(T), 'with sales', sum(1 for t in T.values() if t.get('ind')), 'dongs', len(dong))

if __name__ == '__main__': main(sys.argv[1])
