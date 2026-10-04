# -*- coding: utf-8 -*-
# 데이터 압축지도 — 상가 임대료·공실률(한국부동산원 상업용부동산 임대동향조사 · v0.10.93)
#   원자료: 07_API키/out/rent/rone_rent.json — 부동산통계정보시스템(R-ONE) 「임대동향 지역별 임대료·공실률(2024년3분기~)」 표 5개를 화면에서 읽은 값
#           (소규모·중대형·집합 상가 임대료 천원/㎡ · 소규모·중대형 공실률 %) — 공공데이터포털 15069766·15069789·15069791·15069726·15069735 가 가리키는 표
#           07_API키/out/rent/stations.json — 서울시 역사마스터(subwayStationMaster · 서울 열린데이터광장)
#   py -3.12 -X utf8 tools/region/rent-bake.py → data/r/rent.json
# 부동산원 「상권」은 경계가 공개되지 않는다 — 이름(역·동네)으로 대표 자리를 잡는다(역 좌표 또는 두 역 가운데 · 역이 없는 곳은 손으로 잡은 자리 · how 칸에 적는다).
import json, os, time
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
RD = os.path.join(os.path.dirname(ROOT), '07_API키', 'out', 'rent')
# 이름 → 역 이름(앞부분이 맞으면) 여러 개면 가운데. 숫자 쌍이면 손으로 잡은 자리(경도, 위도).
MAP = {'강남대로': ['강남', '신논현'], '교대역': ['교대'], '남부터미널': ['남부터미널'], '도산대로': ['압구정로데오', '신사'], '방배역/내방역': ['방배', '내방'],
       '서래마을': (126.9972, 37.4990), '양재말죽거리': (127.0362, 37.4846), '양재역': ['양재'], '테헤란로': ['역삼', '선릉'], '학동/강남구청역': ['학동', '강남구청'],
       '경희대': ['회기'], '구의역': ['구의'], '군자': ['군자'], '독산/시흥': ['독산', '시흥대교'], '상봉역': ['상봉'], '서울대입구역': ['서울대입구'], '성신여대': ['성신여대입구'],
       '수유': ['수유'], '숙명여대': ['숙대입구'], '왕십리': ['왕십리'], '잠실/송파': ['잠실', '송파'], '장안동': ['장한평'], '천호': ['천호'], '청량리': ['청량리'], '혜화동': ['혜화'],
       '광화문': ['광화문'], '남대문': ['회현'], '방산시장': ['을지로4가'], '북촌': ['안국'], '서촌': ['경복궁'], '을지로': ['을지로3가'], '종로': ['종각'],
       '동교/연남': (126.9228, 37.5622), '신촌/이대': ['신촌', '이대'], '홍대/합정': ['홍대입구', '합정']}
AGG = {'전국', '서울', '도심', '강남', '영등포신촌', '기타'}
# v0.10.101 경기 — 부동산원 표의 경기 상권(gg_rone_rent.json · 같은 표 다섯을 화면에서 읽음) · 자리 = OpenStreetMap 이름 점(ggnames.json · tools/region/ggname_scan.py · ODbL)
#   [OSM 이름들(여럿이면 가운데), 시 이름(그 시 시청에서 가까운 것을 고름)] · 없는 이름은 넣지 않는다(아주대삼거리·팔달문로터리·상중동)
MAPG = {'고양시청': [['원당'], '고양'], '고잔신도시': [['고잔'], '안산'], '광교중앙역': [['광교중앙'], '수원'], '광명철산': [['철산'], '광명'], '광주광남동': [['광남동 행정복지센터'], '광주'],
        '광주시가지': [['경기광주'], '광주'], '구리역': [['구리'], '구리'], '금릉역': [['금릉'], '파주'], '기흥역': [['기흥'], '용인'], '김량장동': [['김량장동'], '용인'],
        '김포운양역': [['운양'], '김포'], '김포장기역': [['장기'], '김포'], '김포한강구래': [['구래'], '김포'], '남양주다산': [['다산'], '남양주'], '남양주별내': [['별내'], '남양주'],
        '단대오거리역': [['단대오거리'], '성남'], '동두천중앙로': [['동두천중앙'], '동두천'], '동백지구': [['동백'], '용인'], '동탄2신도시': [['동탄2신도시'], '화성'], '동탄센트럴파크': [['동탄'], '화성'],
        '모란': [['모란'], '성남'], '미사지구': [['미사'], '하남'], '배곧신도시': [['배곧동'], '시흥'], '범계학원가': [['범계'], '안양'], '병점역': [['병점'], '화성'], '부천역': [['부천'], '부천'],
        '분당역세권': [['서현', '정자'], '성남'], '산본역': [['산본'], '군포'], '상록수역': [['상록수'], '안산'], '상현역': [['상현'], '용인'], '서판교': [['판교동'], '성남'],
        '선부다이아몬드': [['선부'], '안산'], '성남구시가지': [['신흥동'], '성남'], '송내역': [['송내'], '부천'], '수원역': [['수원'], '수원'], '수원파장동': [['파장동'], '수원'],
        '시흥시립도서관': [['시흥시청'], '시흥'], '신장/지산/서정': [['송탄'], '평택'], '신천역': [['신천'], '시흥'], '안산중앙역': [['중앙'], '안산'], '안성 서인사거리': [['서인동'], '안성'],
        '안양역': [['안양'], '안양'], '야탑역': [['야탑'], '성남'], '양주덕정역': [['덕정'], '양주'], '여주시청': [['여주종합터미널'], '여주'], '역곡역': [['역곡'], '부천'], '영통역': [['영통'], '수원'],
        '오산시청': [['오산시청'], '오산'], '용인수지': [['수지구청'], '용인'], '월피다이아몬드': [['월피동'], '안산'], '위례신도시': [['위례신도시'], '성남'], '의정부민락': [['민락동'], '의정부'],
        '의정부역': [['의정부'], '의정부'], '이천종합터미널': [['이천터미널'], '이천'], '인계동': [['인계동'], '수원'], '인덕원': [['인덕원'], '안양'], '일산라페스타': [['주엽', '정발산'], '고양'],
        '죽전카페거리': [['죽전'], '용인'], '탄현역': [['탄현'], '고양'], '파주시청': [['파주시청'], '파주'], '파주야당역': [['야당'], '파주'], '파주운정호수': [['운정중앙'], '파주'],
        '평촌범계': [['평촌', '범계'], '안양'], '평택시청': [['평택시청'], '평택'], '평택역': [['평택'], '평택'], '포천소흘읍': [['소흘읍'], '포천'], '포천시외버스터미널': [['포천시외버스터미널'], '포천'],
        '하남원도심': [['하남시청'], '하남'], '한대앞역': [['한대앞'], '안산'], '행신역': [['행신'], '고양'], '화성남양읍': [['남양읍'], '화성'], '화성봉담읍': [['봉담읍'], '화성'], '화정역': [['화정'], '고양']}
def gg_at():
    import math
    o = json.load(open(os.path.join(RD, 'ggnames.json'), encoding='utf-8')); by = {}
    for n, k, lon, lat in o: by.setdefault(n, []).append((k, lon, lat))
    def city(c):
        for q in (c + '시청', c + '시', c):
            for k, lon, lat in by.get(q, []):
                if k in ('townhall', 'station', 'city', '') : return (lon, lat)
        return None
    def at(name):
        m = MAPG.get(name)
        if not m: return None, ''
        anc = city(m[1]); pts = []
        for nm in m[0]:
            c = by.get(nm, [])
            if anc: c = sorted(c, key=lambda q: math.hypot(q[1] - anc[0], q[2] - anc[1]))
            if c and (not anc or math.hypot(c[0][1] - anc[0], c[0][2] - anc[1]) < 0.35): pts.append(c[0][1:])
        if len(pts) < len(m[0]): return None, ''
        return (round(sum(p[0] for p in pts) / len(pts), 5), round(sum(p[1] for p in pts) / len(pts), 5)), 'OSM ' + '·'.join(m[0]) + (' 가운데' if len(pts) > 1 else '') + ' (' + m[1] + ')'
    return at

def num(v):
    try: return float(v) if isinstance(v, str) and v.strip() not in ('', '-') else (None if isinstance(v, str) else v)
    except ValueError: return None

def main():
    st = json.load(open(os.path.join(RD, 'stations.json'), encoding='utf-8'))
    pos = {}
    for r in st:
        n = r['BLDN_NM'].split('(')[0]
        pos.setdefault(n, (float(r['LOT']), float(r['LAT'])))
    def at(name):
        m = MAP.get(name)
        if isinstance(m, tuple): return m, '손으로 잡은 자리(역 없음)'
        keys = m or [name.replace('역', '')]
        pts = [pos[k] for k in keys if k in pos]
        if not pts: return None, ''
        return (round(sum(p[0] for p in pts) / len(pts), 5), round(sum(p[1] for p in pts) / len(pts), 5)), '역 ' + '·'.join(k for k in keys if k in pos) + (' 가운데' if len(pts) > 1 else '')
    R = json.load(open(os.path.join(RD, 'rone_rent.json'), encoding='utf-8'))
    Q = R['rent_small']['cols']
    items, agg = {}, {}
    for key, short in (('rent_small', 's'), ('rent_mid', 'm'), ('rent_set', 'c'), ('vac_small', 'vs'), ('vac_mid', 'vm')):
        assert R[key]['cols'] == Q, key
        for r in R[key]['rows']:
            grp, name, vals = r[1], r[2], [num(v) for v in r[3:]]
            if name in AGG and (name == grp or name in ('서울', '전국')):
                agg.setdefault(name, {})[short] = vals; continue
            it = items.setdefault(name, {'name': name, 'grp': grp})
            it[short] = vals
    GP = os.path.join(RD, 'gg_rone_rent.json')
    if os.path.exists(GP):   # v0.10.101 경기
        G = json.load(open(GP, encoding='utf-8')); gat = gg_at()
        for key, short in (('rent_small', 's'), ('rent_mid', 'm'), ('rent_set', 'c'), ('vac_small', 'vs'), ('vac_mid', 'vm')):
            assert G[key]['cols'] == Q, key
            for r in G[key]['rows']:
                grp, name, vals = r[1], r[2], [num(v) for v in r[3:]]
                if name == '경기': agg.setdefault('경기', {})[short] = vals; continue
                it = items.setdefault('경기 ' + name, {'name': name, 'grp': '경기', 'sido': '경기'}); it[short] = vals
        for it in items.values():
            if it.get('sido') == '경기':
                p, how = gat(it['name'])
                if p: it['lon'], it['lat'], it['how'] = p[0], p[1], how
    miss = []
    for it in items.values():
        if it.get('sido') == '경기':
            if 'lon' not in it: miss.append('경기 ' + it['name'])
            continue
        p, how = at(it['name'])
        if not p: miss.append(it['name']); continue
        it['lon'], it['lat'], it['how'] = p[0], p[1], how
    out = {'schema': 'tg-rent/1', 'baked': time.strftime('%Y-%m-%d'), 'quarters': Q,
           'source': '한국부동산원 상업용부동산 임대동향조사(서울·경기 · 부동산통계정보시스템 R-ONE · 「임대동향 지역별 임대료·공실률(2024년3분기~)」 소규모·중대형·집합 상가) — 공공데이터포털 15069766·15069789·15069791·15069726·15069735 · 이용허락범위 제한 없음',
           'unit': {'s': '소규모 상가 임대료(천원/㎡ · 월 · 전용+공용 면적)', 'm': '중대형 상가 임대료(천원/㎡)', 'c': '집합 상가 임대료(천원/㎡)', 'vs': '소규모 상가 공실률(%)', 'vm': '중대형 상가 공실률(%)'},
           'note': '부동산원 표본 상권의 평균이다(그 상권 안 표본 건물) — 상권 경계는 공개되지 않아 이 지도는 이름(역)으로 대표 자리를 잡았다. 한 건물·한 점포의 실제 임대료가 아니고 권리금·보증금은 없다. 소규모 = 2층 이하·연면적 330㎡ 이하, 중대형 = 3층 이상 또는 330㎡ 초과, 집합 = 구분소유 상가(부동산원 조사 정의).',
           'items': [it for it in items.values() if 'lon' in it], 'agg': agg, 'miss': miss}
    p = os.path.join(ROOT, 'data', 'r', 'rent.json')
    json.dump(out, open(p, 'w', encoding='utf-8', newline='\n'), ensure_ascii=False, separators=(',', ':'))
    print('rent', len(out['items']), 'miss', miss, os.path.getsize(p))

if __name__ == '__main__': main()
