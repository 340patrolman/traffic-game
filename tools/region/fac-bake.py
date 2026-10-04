# -*- coding: utf-8 -*-
# 데이터 압축지도 v0.10.100 — 동 현황 보강(소유자 2026-10-04 「동별 남녀 · 경로당·어린이집·유치원·입시학원 · 상권이 살아나는지 죽는지」)
#   입력(07_API키/out/region/ — fac-fetch.py · dong-bake.py fetch 가 받은 것):
#     jumin_202609g.json — 행안부 주민등록 행정동별 연령별 · 남녀(서울·경기)
#     fac/ChildCareInfo.json — 서울시 어린이집 정보(인가일·폐지일·정원·현원·좌표) → 지금 운영 중인 곳 점 + 동별 해마다(2016~2026) 운영 수
#     fac/school_ll.csv — 서울특별시교육청 연도별 학교 위도 경도(공공데이터포털 15152021 · 2014~2025) → 유치원 점 + 동별 해마다 유치원 수 · 초중고 수
#     fac/OdsnBuildingInfo.json — 서울시 경로당 정보(주소만) + /c/Users/knpth/osmwork/addr_scan.json(OSM 건물 도로명주소 → 좌표 · ODbL) → 주소가 맞은 경로당만 점
#     fac/VwsmAdstrdIxQq.json — 상권분석서비스 상권변화지표-행정동(분기 · 다이나믹/상권확장/정체/상권축소 · 운영·폐업 평균 개월)
#     fac/VwsmAdstrdStorW.json — 상권분석서비스 점포-행정동(분기 · 업종 합 점포·개업·폐업)
#     data/r/<구>/stores.json — 소상공인 상가정보 입시·교과학원(P10501) 점 + 학원 전체 수
#   py -3.12 -X utf8 tools/region/fac-bake.py → data/r/<구>/fac.json · r/index.json 에 bytes.fac
import json, os, re, csv, collections, importlib.util
from shapely.geometry import shape, Point
from shapely.strtree import STRtree
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
REG = os.path.join(os.path.dirname(ROOT), '07_API키', 'out', 'region'); FAC = os.path.join(REG, 'fac')
ADDR = r'C:/Users/knpth/osmwork/addr_scan.json'
sp = importlib.util.spec_from_file_location('db', os.path.join(ROOT, 'tools', 'region', 'dong-bake.py')); DB = importlib.util.module_from_spec(sp); sp.loader.exec_module(DB)
DEFAULT_LL = {('37.566470', '126.977963')}   # 어린이집 자료에서 좌표를 모를 때 넣은 값(서울시청) — 버린다
YRS = list(range(2016, 2027))   # 어린이집 해마다(그해 12월 31일 — 2026은 받은 날 기준 운영 중)
YRSG = list(range(2016, 2026))   # 경기 어린이집(자료 기준일 2025.7 — 2025 = 지금)
EDUF = r'C:/Users/knpth/osmwork/edu_scan.json'
def jl(n): return json.load(open(os.path.join(FAC, n), encoding='utf-8'))

def main():
    feats, gus = DB.seoul_gus()
    geoms = [shape(f['geometry']) for f in feats]; tree = STRtree(geoms)
    def dong_of(lon, lat):
        p = Point(lon, lat)
        for i in tree.query(p):
            if geoms[i].contains(p): return feats[i]['properties']
        return None
    D = collections.defaultdict(dict)   # 8자리 → 요약
    PTS = collections.defaultdict(lambda: collections.defaultdict(list))   # 구 → 층 → 점
    def put(lon, lat, layer, row):
        p = dong_of(lon, lat)
        if not p: return None
        PTS[p['sgg']][layer].append([round(lat, 6), round(lon, 6)] + row); return p
    # 남녀
    jum = json.load(open(os.path.join(REG, 'jumin_202609g.json'), encoding='utf-8'))
    for f in feats:
        p = f['properties']; k = p['adm_cd2'][:8]; nm = p['adm_nm'].split(' ')[-1]
        J = jum.get(p['sgg'], {}); jp = J.get(p['adm_cd2']) or {v['name']: v for v in J.values()}.get(nm)
        D[k]['name'] = nm
        if jp and 'mage' in jp: D[k]['sex'] = [jp['m'], jp['f'], jp['mage'], jp['fage']]
    # 어린이집
    cc = jl('ChildCareInfo.json'); nocc = 0
    for r in cc:
        if not r['LA'] or (r['LA'], r['LO']) in DEFAULT_LL: nocc += 1; continue
        lon, lat = float(r['LO']), float(r['LA']); st = r['CRSTATUSNAME']
        p = dong_of(lon, lat)
        if not p: nocc += 1; continue
        k = p['adm_cd2'][:8]; a = D[k].setdefault('ccy', [0] * len(YRS))
        y0 = int(r['CRCNFMDT'][:4]) if r['CRCNFMDT'][:4].isdigit() else 0
        y1 = int(r['CRABLDT'][:4]) if r['CRABLDT'][:4].isdigit() else 9999
        for i, y in enumerate(YRS):
            if y0 and y0 <= y < y1 and not (y == 2026 and st == '폐지'): a[i] += 1
        if st in ('정상', '재개'):
            cap = int(r['CRCAPAT'] or 0); cnt = int(r['CRCHCNT'] or 0)
            PTS[p['sgg']]['cc'].append([round(lat, 6), round(lon, 6), r['CRNAME'], r['CRTYPENAME'], cap, cnt])
            c = D[k].setdefault('cc', [0, 0, 0]); c[0] += 1; c[1] += cap; c[2] += cnt
    print('어린이집 좌표 없음', nocc)
    # 학교(교육청 2014~2025)
    rows = list(csv.reader(open(os.path.join(FAC, 'school_ll.csv'), encoding='cp949')))[1:]
    KY = list(range(2014, 2026)); lv = {'유치원': 'kg', '초등학교': 'e', '중학교': 'm', '고등학교': 'h'}
    for r in rows:
        y, kind = int(r[0]), r[3]
        if kind not in lv or not r[8]: continue
        lat, lon = float(r[8]), float(r[9]); p = dong_of(lon, lat)
        if not p: continue
        k = p['adm_cd2'][:8]
        if kind == '유치원':
            a = D[k].setdefault('kgy', [0] * len(KY)); a[KY.index(y)] += 1
            if y == 2025: PTS[p['sgg']]['kg'].append([round(lat, 6), round(lon, 6), r[5], r[4]])
        elif y == 2025:
            s = D[k].setdefault('sch', {'e': 0, 'm': 0, 'h': 0}); s[lv[kind]] += 1
    # 경로당(주소 → OSM 도로명주소)
    kyr = jl('OdsnBuildingInfo.json'); hit = 0
    AS = json.load(open(ADDR, encoding='utf-8')) if os.path.exists(ADDR) else {'addr': {}, 'kyr': []}; A = AS['addr']
    OK = collections.defaultdict(list)   # OSM 이름에 경로당이 든 점 — 구별로
    for n, lon, lat, st, hn in AS['kyr']:
        p = dong_of(lon, lat)
        if p: OK[p['sggnm']].append((re.sub(r'\s|경로당|노인정|경로회관', '', n), lon, lat))
    ST = collections.defaultdict(list)   # 길 이름 → [(본번, 부번, 경도, 위도)] — 같은 길 가까운 번호로 근사할 때
    for key, q in A.items():
        st, _, hn = key.rpartition(' '); mm = re.match(r'(\d+)(?:-(\d+))?$', hn)
        if mm: ST[st].append((int(mm.group(1)), int(mm.group(2) or 0), q[0], q[1]))
    hit2 = 0
    for r in kyr:
        gu = r['SIGUN_NM']; k8 = None
        ad = re.sub(r'\s+', ' ', (r['ADDRESS'] or '').replace(' ', ' ')).strip()
        ad = re.sub(r'^(?:서울(?:특별시)?\s*)?(?:\S+구\s+)?', '', ad)
        m = re.match(r'(\S+?(?:로|길))\s*(\d+[가-힣]?(?:번?가?길))?\s*(\d+)(?:-(\d+))?', ad)
        if m:
            st = m.group(1) + (m.group(2) or ''); n1, n2 = int(m.group(3)), int(m.group(4) or 0)
            q = A.get(st + ' ' + str(n1) + ('-' + str(n2) if n2 else '')); how = '주소'
            if not q and n2: q = A.get(st + ' ' + str(n1))
            if not q and ST.get(st):
                c = sorted(ST[st], key=lambda x: (abs(x[0] - n1), x[0] % 2 != n1 % 2))
                if abs(c[0][0] - n1) <= 20: q = [c[0][2], c[0][3]]; how = '근사'
            if q:
                p = dong_of(q[0], q[1])
                if p and p['sggnm'] == gu:
                    PTS[p['sgg']]['kyr'].append([q[1], q[0], r['SISUL_NM'], (r['ADDRESS'] or '').strip(), how]); hit += 1; hit2 += how == '근사'; k8 = p['adm_cd2'][:8]
                    D[k8]['kyr'] = D[k8].get('kyr', 0) + 1
        if not k8:
            nm = re.sub(r'\s|경로당|노인정|경로회관', '', r['SISUL_NM'] or '')
            c = [o for o in OK.get(gu, []) if nm and len(nm) >= 2 and (o[0] == nm or (len(o[0]) >= 3 and (o[0] in nm or nm in o[0])))]
            if len(c) == 1:
                p = dong_of(c[0][1], c[0][2]); PTS[p['sgg']]['kyr'].append([c[0][2], c[0][1], r['SISUL_NM'], r['ADDRESS'].strip(), '이름']); hit += 1; k8 = p['adm_cd2'][:8]
                D[k8]['kyr'] = D[k8].get('kyr', 0) + 1
        if not k8:
            g = [f['properties']['sgg'] for f in feats if f['properties']['sggnm'] == gu and f['properties']['adm_cd2'][:2] == '11']
            if g: c = D['G' + g[0]]; c['kyrNo'] = c.get('kyrNo', 0) + 1
    print('경로당', len(kyr), '자리 맞음', hit, '그중 근사', hit2)
    # 상권변화지표 · 점포(행정동)
    for r in jl('VwsmAdstrdIxQq.json'):
        D[r['ADSTRD_CD']].setdefault('ix', []).append([r['STDR_YYQU_CD'], r['TRDAR_CHNGE_IX'], r['OPR_SALE_MT_AVRG'], r['CLS_SALE_MT_AVRG']])
    S = collections.defaultdict(lambda: [0, 0, 0])
    for r in jl('VwsmAdstrdStorW.json'):
        s = S[(r['ADSTRD_CD'], r['STDR_YYQU_CD'])]; s[0] += r['STOR_CO'] or 0; s[1] += r['OPBIZ_STOR_CO'] or 0; s[2] += r['CLSBIZ_STOR_CO'] or 0
    for (k, q), v in S.items(): D[k].setdefault('st', []).append([q] + [int(x) for x in v])
    for k in D:
        for f in ('ix', 'st'):
            if f in D[k]: D[k][f].sort()
    # 입시·교과학원 · 학원 전체(상가정보)
    idx = json.load(open(os.path.join(ROOT, 'data', 'r', 'stores-index.json'), encoding='utf-8'))
    cls = idx['cls']; ACA = {i for i, c in enumerate(cls) if c[5] == 'P10501'}; ALL = {i for i, c in enumerate(cls) if c[2] in ('P105', 'P106')}
    for gu in gus:
        fn = os.path.join(ROOT, 'data', 'r', gu, 'stores.json')
        if not os.path.exists(fn): continue
        sj = json.load(open(fn, encoding='utf-8')); o, kk = sj['o'], sj['k']
        for q in sj['pts']:
            if q[2] not in ALL: continue
            lon, lat = q[0] / kk[0] + o[0], q[1] / kk[1] + o[1]
            p = dong_of(lon, lat)
            if not p: continue
            k = p['adm_cd2'][:8]; D[k]['acaAll'] = D[k].get('acaAll', 0) + 1
            if q[2] in ACA:
                D[k]['aca'] = D[k].get('aca', 0) + 1; PTS[p['sgg']]['aca'].append([round(lat, 6), round(lon, 6), q[4]])
    # v0.10.102 경기 어린이집(경기데이터드림 ChildHouse · 인가일·폐지일 · 좌표) — 서울처럼 해마다 그해 말 운영 수(2025 = 자료 기준일 2025.7 현재)
    def norm(n): return re.sub(r'\s|\(.*?\)', '', n or '')
    gfn = os.path.join(FAC, 'gg_ChildHouse.json')
    if os.path.exists(gfn):
        for r in json.load(open(gfn, encoding='utf-8')):
            if not r.get('WGS84_LAT'): continue
            lon, lat = float(r['WGS84_LOGT']), float(r['WGS84_LAT']); p = dong_of(lon, lat)
            if not p or p['adm_cd2'][:2] != '41': continue
            k = p['adm_cd2'][:8]; a = D[k].setdefault('ccy', [0] * len(YRSG))
            y0 = int(str(r.get('TEMP_CONT01') or '')[:4]) if str(r.get('TEMP_CONT01') or '')[:4].isdigit() else 0
            y1 = int(str(r.get('TEMP_CONT04') or '')[:4]) if str(r.get('TEMP_CONT04') or '')[:4].isdigit() else 9999
            for i, y in enumerate(YRSG):
                if y0 and y0 <= y < y1: a[i] += 1
            if y1 == 9999:
                cap = int(r.get('PSN_CAPA_CNT') or 0)
                PTS[p['sgg']]['cc'].append([round(lat, 6), round(lon, 6), r['KIDGARTN_NM'], r['KIDGARTN_DIV_NM'], cap, None])
                c = D[k].setdefault('cc', [0, 0, -1]); c[0] += 1; c[1] += cap
    # 학교·유치원·경로당 OSM 점(edu_scan.json) + 보호구역 대상 시설(유치원·초등·특수 — 표준데이터 · 좌표)
    EDU = json.load(open(EDUF, encoding='utf-8')) if os.path.exists(EDUF) else []
    def lvl(n, a):
        if a in ('university', 'college') or re.search(r'(대학교|대학|대학원)$', n): return '대학'
        if '초등학교' in n and '병설' not in n: return '초'
        if re.search(r'중학교$', n): return '중'
        if re.search(r'고등학교$|고$', n) and a == 'school': return '고'
        if '특수학교' in n or re.search(r'(학교)$', n) and a == 'school' and not re.search(r'초등|중학|고등|대학', n): return '기타'
        return None
    seen = set(); SCHN = collections.defaultdict(list)   # 학교 이름 → 점(병설유치원 자리 잡기)
    PLACED = collections.defaultdict(list); NEAR = collections.defaultdict(list)   # 같은 이름이 1.5km 안 · 같은 갈래가 150m 안이면 같은 학교(교육청·보호구역·OSM 이 따로 찍은 것)
    CITY = sorted({re.match(r'(.+?)(시|군)', f['properties']['sggnm']).group(1) for f in feats if f['properties']['adm_cd2'][:2] == '41'} | {'경기', '서울'}, key=len, reverse=True)
    def norm2(n):
        n = norm(n).replace('초등학교', '초').replace('분교장', '분교').replace('중학교', '중').replace('고등학교', '고')
        for c in CITY:
            if n.startswith(c) and len(n) > len(c) + 2: n = n[len(c):]; break
        return n
    def put_edu(lat, lon, name, lv, src, sido):
        nn = norm2(name); SCHN[norm(name)].append((lat, lon, src)); SCHN[nn].append((lat, lon, src))
        if any(abs(lat - a) < 0.0135 and abs(lon - b) < 0.017 for a, b in PLACED[nn]): return
        if src != '교육청' and any(abs(lat - a) < 0.0014 and abs(lon - b) < 0.0017 and s2 not in (src, '교육청') for a, b, s2 in NEAR[lv]): return
        p = dong_of(lon, lat)
        if not p or p['adm_cd2'][:2] not in sido: return
        PLACED[nn].append((lat, lon)); NEAR[lv].append((lat, lon, src))
        k = p['adm_cd2'][:8]; PTS[p['sgg']]['edu'].append([round(lat, 6), round(lon, 6), name, lv, src])
        s2 = D[k].setdefault('edu', {}); s2[lv] = s2.get(lv, 0) + 1
    for r in rows:   # 서울 = 교육청 2025(공식)
        if int(r[0]) == 2025 and r[3] in ('초등학교', '중학교', '고등학교', '특수학교') and r[8]:
            put_edu(float(r[8]), float(r[9]), r[5], {'초등학교': '초', '중학교': '중', '고등학교': '고', '특수학교': '기타'}[r[3]], '교육청', ('11',))
    kgc = collections.defaultdict(list); kyr2 = 0
    for n, a, lon, lat, lv in EDU:
        L = lvl(n, a)
        if L == '대학': put_edu(lat, lon, n, L, 'OSM', ('11', '41'))
        elif L: put_edu(lat, lon, n, L, 'OSM', ('41',))
        if '유치원' in n: kgc[norm(n)].append((lat, lon, 'OSM'))
        if any(w in n for w in ('경로당', '노인정', '경로회관')):
            p = dong_of(lon, lat)
            if p and p['adm_cd2'][:2] == '41':
                PTS[p['sgg']]['kyr'].append([round(lat, 6), round(lon, 6), n, '', 'OSM']); k = p['adm_cd2'][:8]; D[k]['kyr'] = D[k].get('kyr', 0) + 1; kyr2 += 1
    for r in json.load(open(os.path.join(REG, 'safe_sz_all.json'), encoding='utf-8')):
        if r.get('fcltyKnd') == '유치원' and r.get('latitude'):
            kgc[norm(r['trgetFcltyNm'])].insert(0, (float(r['latitude']), float(r['longitude']), '보호구역'))
        if r.get('fcltyKnd') in ('초등학교', '특수학교') and r.get('latitude'):
            put_edu(float(r['latitude']), float(r['longitude']), r['trgetFcltyNm'], '초' if r['fcltyKnd'] == '초등학교' else '기타', '보호구역', ('41',))
    # 경기 유치원(경기도교육청 공시 Kndrgrschoolstus — 좌표·주소 없음) → 같은 이름의 보호구역·OSM 점이 경기 안에 하나일 때만
    kfn = os.path.join(FAC, 'gg_Kndrgrschoolstus.json'); kgok = kgno = 0
    GGC = {re.match(r'(.+?)(시|군)', f['properties']['sggnm']).group(1) for f in feats if f['properties']['adm_cd2'][:2] == '41'}
    if os.path.exists(kfn):
        for r in json.load(open(kfn, encoding='utf-8')):
            office = (r.get('EDU_SPORT_ADMT_NM') or '').replace('교육지원청', ''); cts = []
            for ct in sorted(GGC, key=len, reverse=True):
                if ct in office: cts.append(ct); office = office.replace(ct, '')
            def pick(cands, src2=None):
                c = []
                for q in cands:
                    p = dong_of(q[1], q[0])
                    if not p or p['adm_cd2'][:2] != '41': continue
                    if cts and re.match(r'(.+?)(시|군)', p['sggnm']).group(1) not in cts: continue
                    if all(abs(q[0] - x[0]) > 0.002 or abs(q[1] - x[1]) > 0.002 for x in c): c.append((q[0], q[1], src2 or q[2]))
                return c
            c = pick(kgc.get(norm(r['KDGT_NM']), []))
            if not c and '병설' in r['KDGT_NM']: c = pick(SCHN.get(norm(r['KDGT_NM'].split('병설')[0]), []), '병설 학교')
            if len(c) != 1: kgno += 1; continue
            q = c[0]; p = dong_of(q[1], q[0]); k = p['adm_cd2'][:8]; kgok += 1
            PTS[p['sgg']]['kg'].append([round(q[0], 6), round(q[1], 6), r['KDGT_NM'], r['FNDN_TYPE'], q[2]]); D[k]['kgN'] = D[k].get('kgN', 0) + 1
    print('경기 유치원 자리', kgok, '못 맞춤', kgno, '· 경기 경로당(OSM)', kyr2, '· 학교 점', sum(len(PTS[g]['edu']) for g in PTS))
    GGKG = kgno
    # 이 동의 상권(서울시 상권분석서비스 · 구마다 trdar.json 의 dong 칸) — 처음 4분기 합 ↔ 마지막 4분기 합
    for gu in gus:
        fn = os.path.join(ROOT, 'data', 'r', gu, 'trdar.json')
        if not os.path.exists(fn): continue
        tj = json.load(open(fn, encoding='utf-8')); nm2k = {D[f['properties']['adm_cd2'][:8]].get('name'): f['properties']['adm_cd2'][:8] for f in feats if f['properties']['sgg'] == gu}
        for t in tj['trdar']:
            k = nm2k.get(t.get('dong'))
            if not k: continue
            qs = sorted(t.get('tr', {})); v = [t['tr'][q][0] for q in qs]
            a0, a1 = (sum(v[:4]), sum(v[-4:])) if len(v) >= 8 else (0, 0)
            ix = t.get('ix') or ['']
            D[k].setdefault('trd', []).append([t['cd'], t['name'], t['se'], a1, a0, ix[0], qs[0] if qs else '', qs[-1] if qs else ''])
    for k in D:
        if 'trd' in D[k]: D[k]['trd'].sort(key=lambda x: -x[3])
    # 쓰기
    rp = os.path.join(ROOT, 'data', 'r', 'index.json'); R = json.load(open(rp, encoding='utf-8'))
    tot = 0
    for g in R['gus']:
        gu = g['gu']; ks = [f['properties']['adm_cd2'][:8] for f in feats if f['properties']['sgg'] == gu]
        doc = {'schema': 'tg-fac/1', 'gu': gu, 'name': g['name'], 'cyears': YRS if gu[:2] == '11' else YRSG, 'kyears': KY, 'sido': gu[:2], 'kgNo': GGKG if gu[:2] == '41' else 0,
               'source': {'남녀': '행정안전부 주민등록 인구통계 · 행정동별 연령별 · 남녀(2026년 9월)',
                          '어린이집': '서울시 어린이집 정보(ChildCareInfo · 서울 열린데이터광장 · 2026-10-04) — 해마다 수 = 인가일 ≤ 그해 < 폐지일(그해 말 운영) · 좌표 없는 곳 빠짐',
                          '유치원·학교': '서울특별시교육청 연도별 학교 위도 경도(공공데이터포털 15152021 · 2014~2025)',
                          '경로당': '서울시 경로당 정보(OdsnBuildingInfo · OA-15052) — 주소만 있어 OpenStreetMap 건물 도로명주소(ODbL)와 맞춤(번호가 없으면 같은 길 ±20번 안 가까운 번호 = 근사) · 못 맞춘 곳은 뺌',
                          '상권변화': '서울시 상권분석서비스 상권변화지표-행정동(VwsmAdstrdIxQq) — LL 다이나믹 · LH 상권확장 · HL 상권축소 · HH 정체 · 운영·폐업 평균 개월',
                          '점포': '서울시 상권분석서비스 점포-행정동(VwsmAdstrdStorW) — 업종 합 점포·개업·폐업(분기)',
                          '경기 어린이집': '경기데이터드림 어린이집 현황(ChildHouse · 2025-07-25 기준 · 인가일·폐지일·좌표 — 해마다 그해 말 운영 수, 2025 = 기준일 현재)',
                          '경기 유치원': '경기도교육청 유치원 공시(경기데이터드림 Kndrgrschoolstus · 2026년 1차) — 좌표·주소가 없어 같은 이름의 어린이보호구역 대상 시설(표준데이터)·OSM 점이 경기 안에 하나일 때만 자리를 잡음',
                          '학교': '서울 초·중·고·특수 = 서울특별시교육청 2025(공식) · 경기 초등·특수 = 어린이보호구역 대상 시설(표준데이터) + OSM · 경기 중·고 · 서울·경기 대학 = OpenStreetMap(ODbL · 학교 이름으로 갈래)',
                          '경기 경로당': '경기 경로당 공식 목록(좌표)을 찾지 못함 — OpenStreetMap 에 이름이 「경로당·노인정·경로회관」인 점만',
                          '학원': '소상공인시장진흥공단 상가(상권)정보 2026년 6월 — 입시·교과학원(P10501) · 학원 전체 = 일반·기타 교육(P105·P106)'},
               'ix_names': {'LL': '다이나믹', 'LH': '상권확장', 'HL': '상권축소', 'HH': '정체'},
               'dong': {k: D[k] for k in ks if k in D}, 'kyrNo': D.get('G' + gu, {}).get('kyrNo', 0),
               'pts': {k: v for k, v in PTS[gu].items()}}
        fn = os.path.join(ROOT, 'data', 'r', gu, 'fac.json'); os.makedirs(os.path.dirname(fn), exist_ok=True)
        json.dump(doc, open(fn, 'w', encoding='utf-8', newline='\n'), ensure_ascii=False, separators=(',', ':'))
        g.setdefault('bytes', {})['fac'] = os.path.getsize(fn); tot += g['bytes']['fac']
    R['layers']['fac'] = '동 현황 보강 — 남녀 · 어린이집·유치원(해마다) · 경로당 · 입시·교과학원 · 상권변화지표 · 점포 추이'
    json.dump(R, open(rp, 'w', encoding='utf-8', newline='\n'), ensure_ascii=False, separators=(',', ':'))
    print('fac total', tot, {k: sum(len(PTS[g][k]) for g in PTS) for k in ('cc', 'kg', 'kyr', 'aca')})

if __name__ == '__main__': main()
