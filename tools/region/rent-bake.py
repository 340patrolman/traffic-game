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
            grp, name, vals = r[1], r[2], r[3:]
            if name in AGG and (name == grp or name in ('서울', '전국')):
                agg.setdefault(name, {})[short] = vals; continue
            it = items.setdefault(name, {'name': name, 'grp': grp})
            it[short] = vals
    miss = []
    for it in items.values():
        p, how = at(it['name'])
        if not p: miss.append(it['name']); continue
        it['lon'], it['lat'], it['how'] = p[0], p[1], how
    out = {'schema': 'tg-rent/1', 'baked': time.strftime('%Y-%m-%d'), 'quarters': Q,
           'source': '한국부동산원 상업용부동산 임대동향조사(부동산통계정보시스템 R-ONE · 「임대동향 지역별 임대료·공실률(2024년3분기~)」 소규모·중대형·집합 상가) — 공공데이터포털 15069766·15069789·15069791·15069726·15069735 · 이용허락범위 제한 없음',
           'unit': {'s': '소규모 상가 임대료(천원/㎡ · 월 · 전용+공용 면적)', 'm': '중대형 상가 임대료(천원/㎡)', 'c': '집합 상가 임대료(천원/㎡)', 'vs': '소규모 상가 공실률(%)', 'vm': '중대형 상가 공실률(%)'},
           'note': '부동산원 표본 상권의 평균이다(그 상권 안 표본 건물) — 상권 경계는 공개되지 않아 이 지도는 이름(역)으로 대표 자리를 잡았다. 한 건물·한 점포의 실제 임대료가 아니고 권리금·보증금은 없다. 소규모 = 2층 이하·연면적 330㎡ 이하, 중대형 = 3층 이상 또는 330㎡ 초과, 집합 = 구분소유 상가(부동산원 조사 정의).',
           'items': [it for it in items.values() if 'lon' in it], 'agg': agg, 'miss': miss}
    p = os.path.join(ROOT, 'data', 'r', 'rent.json')
    json.dump(out, open(p, 'w', encoding='utf-8', newline='\n'), ensure_ascii=False, separators=(',', ':'))
    print('rent', len(out['items']), 'miss', miss, os.path.getsize(p))

if __name__ == '__main__': main()
