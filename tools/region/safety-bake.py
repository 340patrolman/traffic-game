# -*- coding: utf-8 -*-
# 데이터 압축지도 「지역 자료」 ⑤ — 서울 단속 카메라 · 어린이보호구역 · 생활안전 시설(v0.10.95)
#   py -3.12 -X utf8 tools/region/safety-bake.py fetch → 07_API키/out/region/safe_*.json
#   py -3.12 -X utf8 tools/region/safety-bake.py build → data/r/<구>/safety.json
# 카메라: 전국무인교통단속카메라표준데이터(api.data.go.kr tn_pubr_public_unmanned_traffic_camera_api · ctprvnNm=서울특별시) — 서초 cameras-seocho.json 과 같은 꼴
# 보호구역: 전국어린이보호구역표준데이터(tn_pubr_public_child_prtc_zn_api · insttCode = 서울 각 구청 3000000~3240000) — 서초 schoolzone-seocho.json 의 zones 와 같은 꼴
# 생활안전: 서울 열린데이터광장 — 안심귀갓길 시설·서비스 · AED · 소방용수 · 견인차량보관소 · 공중화장실 · 안심택배함 · 치매안심센터(safety-bake.py 와 같은 칸 · 구 걸름 없이)
# 구 = 점이 든 SGIS 행정동의 구. 키는 07_API키/keys.json 에서만.
import json, os, sys, time, re, urllib.request, urllib.parse, importlib.util
from shapely.geometry import shape, Point
from shapely.strtree import STRtree
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
KB = os.path.join(os.path.dirname(ROOT), '07_API키')
OUT = os.path.join(KB, 'out', 'region'); os.makedirs(OUT, exist_ok=True)
HJD = os.path.join(os.path.dirname(ROOT), '13_관할경계', '원자료', 'hjd20260701.geojson')
spec = importlib.util.spec_from_file_location('fb', os.path.join(ROOT, 'tools', 'flow-bake.py')); fb = importlib.util.module_from_spec(spec); spec.loader.exec_module(fb)
seoul = fb.seoul
K = json.load(open(os.path.join(KB, 'keys.json'), encoding='utf-8-sig'))['data_go_kr']
def f6(x):   # 숫자 칸에 글이 섞인 줄이 있다(소방용수 등) — 그런 줄은 자리 없음으로
    try: return round(float(x), 6) if x not in (None, '') else None
    except (TypeError, ValueError): return None

def jget(n):
    p = os.path.join(OUT, n); return json.load(open(p, encoding='utf-8')) if os.path.exists(p) else None
def jput(n, o): open(os.path.join(OUT, n), 'w', encoding='utf-8').write(json.dumps(o, ensure_ascii=False, separators=(',', ':')))

def datago(ep, **kw):
    out, page = [], 1
    while True:
        q = urllib.parse.urlencode(dict(kw, pageNo=page, numOfRows=1000, type='json'), quote_via=urllib.parse.quote)
        for i in range(4):
            try: j = json.loads(urllib.request.urlopen('https://api.data.go.kr/openapi/%s?serviceKey=%s&%s' % (ep, K, q), timeout=120).read().decode('utf-8')); break
            except Exception: time.sleep(3 + 3 * i)
        b = j.get('body') or {}; it = (b.get('items') or {}).get('item') or b.get('items') or []
        if isinstance(it, dict): it = [it]
        out += it; tot = int(b.get('totalCount') or 0)
        if page * 1000 >= tot or not it: break
        page += 1
    return out

def rows(svc):
    out, st = [], 1
    while True:
        v = seoul('json/%s/%d/%d/' % (svc, st, st + 999)).get(svc) or {}
        rr = v.get('row') or []; tot = v.get('list_total_count') or 0
        out += rr; st += 1000
        if st > tot or not rr: break
    print(svc, len(out), flush=True); return out

def fetch():
    if not jget('safe_cam.json'): jput('safe_cam.json', datago('tn_pubr_public_unmanned_traffic_camera_api', ctprvnNm='서울특별시')); print('cam')
    if not jget('safe_sz.json'):
        z = []
        for i in range(25): z += datago('tn_pubr_public_child_prtc_zn_api', insttCode=str(3000000 + i * 10000))
        jput('safe_sz.json', z); print('sz', len(z))
    if not jget('safe_cam_gg.json'): jput('safe_cam_gg.json', datago('tn_pubr_public_unmanned_traffic_camera_api', ctprvnNm='경기도')); print('cam gg')
    if not jget('safe_sz_all.json'):   # 보호구역은 시·도로 못 거른다 — 전국을 받아 경기 상자로 거른다(v0.10.99)
        z = datago('tn_pubr_public_child_prtc_zn_api'); jput('safe_sz_all.json', [r for r in z if 36.85 < (f6(r.get('latitude')) or 0) < 38.35 and 126.3 < (f6(r.get('longitude')) or 0) < 127.9]); print('sz all', len(z))
    for svc in ('tbSafeReturnItem', 'tbSafeReturnService', 'tbEmgcAedInfo', 'tbFireItem', 'TbTowCarsDepository', 'mgisToiletPoi', 'safeOpenBox', 'TbDementiaCenter'):
        if not jget('safe_%s.json' % svc): jput('safe_%s.json' % svc, rows(svc))

def build():
    g = json.load(open(HJD, encoding='utf-8'))
    F = [(shape(f['geometry']), f['properties']['sgg']) for f in g['features'] if f['properties']['adm_cd2'][:2] in ('11', '41')]
    tree = STRtree([x[0] for x in F])
    def gu_of(la, lo):
        if not la or not lo: return None
        pt = Point(lo, la)
        for i in tree.query(pt):
            if F[i][0].contains(pt): return F[i][1]
        return None
    G = {}
    def put(gu, k, v):
        if gu: G.setdefault(gu, {'cam': [], 'sz': [], 'items': {}}).setdefault('items', {})
        if gu: (G[gu][k] if k in ('cam', 'sz') else G[gu]['items'].setdefault(k, [])).append(v)
    for r in (jget('safe_cam.json') or []) + (jget('safe_cam_gg.json') or []):
        la, lo = f6(r.get('latitude')), f6(r.get('longitude'))
        put(gu_of(la, lo), 'cam', {'at': r.get('itlpc'), 'road': r.get('roadRouteNm'), 'lat': la, 'lon': lo, 'se': r.get('regltSe'), 'lim': int(r.get('lmttVe') or 0), 'zone': r.get('prtcareaType'), 'yr': r.get('installationYear'), 'sec': r.get('ovrspdRegltSctnLt') or ''})
    seen = set()
    for r in (jget('safe_sz.json') or []) + (jget('safe_sz_all.json') or []):
        la, lo = f6(r.get('latitude')), f6(r.get('longitude')); k = (r.get('trgetFcltyNm'), la)
        if k in seen or not la: continue
        seen.add(k)
        put(gu_of(la, lo), 'sz', {'name': r.get('trgetFcltyNm'), 'kind': r.get('fcltyKnd'), 'lat': la, 'lon': lo, 'addr': r.get('rdnmadr') or r.get('lnmadr'), 'police': r.get('cmptncPolcsttnNm'),
                                  'gu': (re.search(r'(\S+구)$', r.get('insttNm') or '') or [None, ''])[1] if re.search(r'(\S+구)$', r.get('insttNm') or '') else '',
                                  'cctv': (int(r['cctvNumber']) if (r.get('cctvNumber') or '').strip().isdigit() else -1) if r.get('cctvYn') == 'Y' else 0,
                                  'rw': float(r['prtcareaRw']) if (r.get('prtcareaRw') or '').replace('.', '', 1).isdigit() else None, 'ref': r.get('referenceDate')})
    def wkt(w):
        m = re.search(r'POINT\s*\(\s*([\d.]+)\s+([\d.]+)\s*\)', w or ''); return (round(float(m.group(2)), 6), round(float(m.group(1)), 6)) if m else (None, None)
    for r in jget('safe_tbSafeReturnItem.json') or []:
        la, lo = wkt(r.get('POINT_WKT')); put(gu_of(la, lo), 'srItem', [la, lo, r.get('FACI_CODE'), r.get('ASG_NM'), r.get('EMD_NM'), r.get('INSTL_CNT'), (r.get('REMARK') or '').strip(), r.get('INST_NM'), r.get('INST_TELNO')])
    for r in jget('safe_tbSafeReturnService.json') or []:
        la, lo = f6(r.get('LATITUDE')), f6(r.get('LONGITUDE')); put(gu_of(la, lo), 'srSvc', [la, lo, r.get('SISUL_CODE'), (r.get('REMARK') or '').strip(), r.get('DE_LOC'), r.get('INST_NM'), r.get('INST_TELNO'), r.get('WORK_DATE'), r.get('ASG_NM')])
    for r in jget('safe_tbEmgcAedInfo.json') or []:
        la, lo = f6(r.get('WGS84LAT')), f6(r.get('WGS84LON')); put(gu_of(la, lo), 'aed', [la, lo, r.get('ORG'), r.get('BUILDPLACE'), r.get('BUILDADDRESS'), r.get('CLERKTEL')])
    for r in jget('safe_tbFireItem.json') or []:
        la, lo = f6(r.get('LAT')), f6(r.get('LOT')); put(gu_of(la, lo), 'fire', [la, lo, r.get('FCLT_TYPE_CD'), 1 if (r.get('USE_PSBLTY_YN') or '').strip() == 'Y' else 0, ((r.get('CMPTNC_FRSTN_NM') or '').strip() + ' ' + (r.get('CMPTNC_FRSTN_TELNO') or '').strip()).strip()])
    for r in jget('safe_TbTowCarsDepository.json') or []:
        la, lo = f6(r.get('LAT')), f6(r.get('LOT')); put(gu_of(la, lo), 'tow', [la, lo, r.get('TRCT_VHCL_LCKR_NM'), r.get('LCTN_RD_NM_ADDR'), r.get('ARCH_TEL'), r.get('ARCH_CNT'), (r.get('TRCT_BSC_CRG') or '').replace('+', ' · ')])
    for r in jget('safe_mgisToiletPoi.json') or []:
        la, lo = f6(r.get('COORD_Y')), f6(r.get('COORD_X')); put(gu_of(la, lo), 'wc', [la, lo, r.get('CONTS_NAME'), r.get('ADDR_NEW') or r.get('ADDR_OLD'), (r.get('VALUE_01') or '').strip('| '), (r.get('VALUE_02') or '').strip('| '), (r.get('VALUE_04') or '').strip('| ')])
    for r in jget('safe_safeOpenBox.json') or []:
        la, lo = f6(r.get('WGSXPT')), f6(r.get('WGSYPT')); put(gu_of(la, lo), 'box', [la, lo, r.get('ANSIMINM'), r.get('ANSIMIADDR')])
    for r in jget('safe_TbDementiaCenter.json') or []:
        la, lo = f6(r.get('LATITUDE')), f6(r.get('LONGITUDE')); put(gu_of(la, lo), 'dem', [la, lo, r.get('CNTERNM'), r.get('RDNMADR'), r.get('OPERPHONENUMBER')])
    rp = os.path.join(ROOT, 'data', 'r', 'index.json'); R = json.load(open(rp, encoding='utf-8')); gb = {}
    for gu, v in G.items():
        pth = os.path.join(ROOT, 'data', 'r', gu, 'safety.json'); os.makedirs(os.path.dirname(pth), exist_ok=True)
        v.update({'schema': 'tg-rsafe/1', 'gu': gu, 'baked': time.strftime('%Y-%m-%d'),
                  'source': {'cam': '전국무인교통단속카메라표준데이터(공공데이터포털 · 행정안전부 표준데이터) — 서울 각 구', 'sz': '전국어린이보호구역표준데이터(공공데이터포털 15012891) — 서울 각 구청 · 자리는 대상 시설의 점',
                             'items': '서울 열린데이터광장 — 안심귀갓길 시설(OA-21696)·서비스(OA-21697) · AED(OA-20327) · 소방용수(OA-21306) · 견인차량보관소(OA-20439) · 공중화장실(OA-22586) · 안심택배함(OA-20922) · 치매안심센터(OA-20352) · fire 의 5번째 칸 = 관할 소방서 이름·전화'}})
        json.dump(v, open(pth, 'w', encoding='utf-8', newline='\n'), ensure_ascii=False, separators=(',', ':')); gb[gu] = os.path.getsize(pth)
        print(gu, len(v['cam']), len(v['sz']), {k: len(x) for k, x in v['items'].items()}, gb[gu])
    for gg in R['gus']:
        if gg['gu'] in gb: gg['bytes']['safety'] = gb[gg['gu']]
    R['layers']['safety'] = '단속 카메라 · 어린이보호구역 · 생활안전 시설'
    json.dump(R, open(rp, 'w', encoding='utf-8', newline='\n'), ensure_ascii=False, separators=(',', ':'))

if __name__ == '__main__':
    (fetch if (sys.argv[1:] or ['build'])[0] == 'fetch' else build)()
