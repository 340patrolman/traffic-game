# -*- coding: utf-8 -*-
# 데이터 압축지도 「치안·생활안전 시설」 굽기(v0.10.78) — 서울 열린데이터광장 · 서초구만
#   python -X utf8 tools/safety-bake.py → data/safety-seocho.json
#   안심귀갓길 안전시설물(tbSafeReturnItem · OA-21696) · 안심귀갓길 서비스(tbSafeReturnService · OA-21697) · AED(tbEmgcAedInfo · OA-20327)
#   소방용수시설(tbFireItem · OA-21306) · 서초구 불법주정차 단속 CCTV(TbOpendataFixedcctvSC · OA-20493) · 견인차량보관소(TbTowCarsDepository · OA-20439)
#   공중화장실(mgisToiletPoi · OA-22586) · 안심택배함(safeOpenBox · OA-20922) · 치매안심센터(TbDementiaCenter · OA-20352)
import json, os, time, re, importlib.util
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
spec = importlib.util.spec_from_file_location('fb', os.path.join(ROOT, 'tools', 'flow-bake.py')); fb = importlib.util.module_from_spec(spec); spec.loader.exec_module(fb)
seoul = fb.seoul
def rows(svc, keep):
    out, st = [], 1
    while True:
        v = seoul('json/%s/%d/%d/' % (svc, st, st + 999)).get(svc) or {}
        rr = v.get('row') or []; tot = v.get('list_total_count') or 0
        out += [r for r in rr if keep(r)]; st += 1000
        if st > tot or not rr: break
    print(svc, len(out)); return out
f = lambda x: round(float(x), 6) if x not in (None, '') else None
inB = lambda la, lo: la and lo and 37.42 < la < 37.53 and 126.95 < lo < 127.09
S = {}
it = rows('tbSafeReturnItem', lambda r: r.get('SGG_CODE') == '1165000000')
def wkt(w):
    m = re.search(r'POINT\s*\(\s*([\d.]+)\s+([\d.]+)\s*\)', w or ''); return (round(float(m.group(2)), 6), round(float(m.group(1)), 6)) if m else (None, None)
S['srItem'] = [[wkt(r['POINT_WKT'])[0], wkt(r['POINT_WKT'])[1], r.get('FACI_CODE'), r.get('ASG_NM'), r.get('EMD_NM'), r.get('INSTL_CNT'), (r.get('REMARK') or '').strip(), r.get('INST_NM'), r.get('INST_TELNO')] for r in it]
sv = rows('tbSafeReturnService', lambda r: r.get('SGG_CODE') == '1165000000')
S['srSvc'] = [[f(r.get('LATITUDE')), f(r.get('LONGITUDE')), r.get('SISUL_CODE'), (r.get('REMARK') or '').strip(), r.get('DE_LOC'), r.get('INST_NM'), r.get('INST_TELNO'), r.get('WORK_DATE'), r.get('ASG_NM')] for r in sv]
aed = rows('tbEmgcAedInfo', lambda r: '서초구' in (r.get('BUILDADDRESS') or ''))
S['aed'] = [[f(r.get('WGS84LAT')), f(r.get('WGS84LON')), r.get('ORG'), r.get('BUILDPLACE'), r.get('BUILDADDRESS'), r.get('CLERKTEL')] for r in aed]
fi = rows('tbFireItem', lambda r: (r.get('SGG_NM') or '').strip() == '서초구')
S['fire'] = [[f(r.get('LAT')), f(r.get('LOT')), r.get('FCLT_NO'), r.get('FCLT_TYPE_CD'), (r.get('LCTN_ROAD_NM_ADDR') or r.get('LCTN_LOTNO_ADDR') or '').strip(), (r.get('USE_PSBLTY_YN') or '').strip(), (r.get('CMPTNC_FRSTN_NM') or '').strip(), (r.get('CMPTNC_FRSTN_TELNO') or '').strip()] for r in fi]
cc = rows('TbOpendataFixedcctvSC', lambda r: True)
S['pkcctv'] = [[f(r.get('LAT')), f(r.get('LOT')), r.get('CRDN_BRNCH_NM'), r.get('FIX_CCTV_ADDR'), r.get('GRNDS_SE')] for r in cc]
tw = rows('TbTowCarsDepository', lambda r: inB(f(r.get('LAT')), f(r.get('LOT'))))
S['tow'] = [[f(r.get('LAT')), f(r.get('LOT')), r.get('TRCT_VHCL_LCKR_NM'), r.get('LCTN_RD_NM_ADDR'), r.get('ARCH_TEL'), r.get('ARCH_CNT'), (r.get('TRCT_BSC_CRG') or '').replace('+', ' · ')] for r in tw]
wc = rows('mgisToiletPoi', lambda r: (r.get('GU_NAME') or '') == '서초구')
S['wc'] = [[f(r.get('COORD_Y')), f(r.get('COORD_X')), r.get('CONTS_NAME'), r.get('ADDR_NEW') or r.get('ADDR_OLD'), (r.get('VALUE_01') or '').strip('| '), (r.get('VALUE_02') or '').strip('| '), (r.get('VALUE_04') or '').strip('| ')] for r in wc]
bx = rows('safeOpenBox', lambda r: '서초' in (r.get('ADDRDETAIL') or ''))
S['box'] = [[f(r.get('WGSXPT')), f(r.get('WGSYPT')), r.get('ANSIMINM'), r.get('ANSIMIADDR')] for r in bx]
dm = rows('TbDementiaCenter', lambda r: '서초구' in (r.get('RDNMADR') or '') + (r.get('CNTERNM') or ''))
S['dem'] = [[f(r.get('LATITUDE')), f(r.get('LONGITUDE')), r.get('CNTERNM'), r.get('RDNMADR'), r.get('OPERPHONENUMBER')] for r in dm]
from collections import Counter
print('srItem codes', Counter(x[2] for x in S['srItem']), 'srSvc codes', Counter(x[2] for x in S['srSvc']), 'fire types', Counter(x[3] for x in S['fire']))
st = sorted(set(x[6] for x in S['fire'])); S['fireSt'] = [[n, next(x[7] for x in S['fire'] if x[6] == n)] for n in st]
S['fire'] = [[x[0], x[1], x[3], 1 if x[5] == 'Y' else 0, st.index(x[6])] for x in S['fire'] if x[0]]
CODES = {'srItem': {'301': '안심벨', '302': 'CCTV', '303': '안내표지판', '304': '노면표기', '305': '보안등', '306': '안심귀갓길 서비스 안내판', '307': '112 위치 신고 안내', '308': '기타(안심반사경 등)'}, 'srItemSrc': '서울시 「안심귀갓길_안전시설물(코드유형).xlsx」(OA-21696 첨부)',
         'srSvc': {'401': '안심 서비스(주민센터·공영주차장 등 — 코드 뜻은 대조 전)', '402': '편의점(여성안심지킴이집으로 보임 — 코드 뜻은 대조 전)'}}
out = {'schema': 'tg-safety/1', 'baked': time.strftime('%Y-%m-%d %H:%M'), 'source': {
  'srItem': '서울시 안심귀갓길 안전시설물(OA-21696 · tbSafeReturnItem · 기준 2022-11) — [위도, 경도, 시설코드, 안심귀갓길, 동, 설치 수, 비고, 관리기관, 전화]',
  'srSvc': '서울시 안심귀갓길 서비스(OA-21697 · tbSafeReturnService) — [위도, 경도, 시설코드, 이름(비고), 주소, 기관, 전화, 운영시간, 안심귀갓길]',
  'aed': '서울시 자동심장충격기(AED) 설치 현황(OA-20327 · tbEmgcAedInfo) — [위도, 경도, 기관, 설치 자리, 주소, 전화]',
  'fire': '서울시 소방용수시설(OA-21306 · tbFireItem · 기준 2022-06) — [위도, 경도, 종류코드, 사용 가능(1), 관할 소방서 번호(fireSt)]',
  'pkcctv': '서울시 서초구 불법주정차 단속 CCTV(OA-20493 · TbOpendataFixedcctvSC) — [위도, 경도, 단속 지점, 주소, 구분]',
  'tow': '서울시 견인차량보관소(OA-20439 · TbTowCarsDepository) — [위도, 경도, 이름, 주소, 전화, 보관 대수, 견인료]',
  'wc': '서울시 공중화장실(OA-22586 · mgisToiletPoi) — [위도, 경도, 이름, 주소, 구분, 개방시간, 남녀]',
  'box': '서울시 안심택배함(OA-20922 · safeOpenBox) — [위도, 경도, 자리, 주소]',
  'dem': '서울시 치매안심센터(OA-20352 · TbDementiaCenter) — [위도, 경도, 이름, 주소, 전화]'}, 'codes': CODES, 'items': S}
p = os.path.join(ROOT, 'data', 'safety-seocho.json')
open(p, 'w', encoding='utf-8', newline='\n').write(json.dumps(out, ensure_ascii=False, separators=(',', ':')))
print('wrote', os.path.getsize(p), {k: len(v) for k, v in S.items()})
