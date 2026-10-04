# -*- coding: utf-8 -*-
# 데이터 갱신 점검 — Claude Code 세션이 열릴 때(SessionStart 훅) 돈다. 통신 0 · 2초 안.
# 소유자 지시(2026-10-04): 「클로드코드를 켜면 자동으로 찾아서 수정·보완·입력·삭제가 되도록」
# 하는 일: 데이터 압축지도 자료 파일마다 마지막 커밋 날짜를 보고, 다시 굽는 주기를 넘긴 것을 목록으로 낸다.
#          이 출력은 세션 문맥에 들어가고, 그 세션의 Claude 가 목록대로 다시 굽고 검증해 커밋한다(MAP2D.md §6·§8).
# 키·자료 값은 읽지 않는다(파일 날짜만 본다).
import datetime, os, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KB = os.path.dirname(ROOT)
# [파일, 주기(일), 다시 굽는 법(auto = 키만 있으면 혼자 돈다 / hand = 사람·브라우저 단계가 있다), 명령·절차]
SETS = [
    ['data/live-seocho.json', 0.5, 'auto', '작업 스케줄러 「SEOUL-PATROL 실시간 지도 갱신」(3시간마다) — 멈췄으면 `py -3.12 tools/live-refresh.py`'],
    ['data/flow-seocho.json', 31, 'auto', '`py -3.12 tools/flow-bake.py flow`(교통카드 다음 달 · 동 매출 다음 분기)'],
    ['data/pubdata-seocho.json', 31, 'auto', '`perl tools/map2d-build/build_pub.pl`(생활인구·지하철·버스·병의원·약국 — 원자료를 먼저 다시 받는다)'],
    ['data/events-seocho.json', 31, 'auto', '서울시 문화행사 OA-15486 + 서울경찰청 오늘의 주요집회(CLAUDE.md v0.10.44) — 끝난 행사는 지우고 새 것을 넣는다'],
    ['data/trend-seocho.json', 92, 'auto', '`py -3.12 tools/trend-bake.py`(새 분기 매출 · 해마다 6월 지하철)'],
    ['data/trdar-seocho.json', 92, 'hand', '상권 영역 shp(OA-15560) 받은 뒤 `py -3.12 tools/trdar-bake.py <shp>` — 새 분기(STDR_YYQU_CD)가 나왔는지 먼저 본다'],
    ['data/stores-seocho.json', 92, 'auto', '소상공인 상가정보 storeListInDong(키 data_go_kr · CLAUDE.md v0.10.65)'],
    ['data/pop-seocho.json', 92, 'hand', '행안부 주민등록 인구(jumin.mois.go.kr POST · CLAUDE.md v0.10.26)'],
    ['data/traffic-vol-seocho.json', 92, 'auto', '서울시 VolInfo `…/VolInfo/1/40/{지점}/{YYYYMMDD}/{HH}/`(CLAUDE.md v0.10.44)'],
    ['data/safety-seocho.json', 182, 'auto', '`py -3.12 tools/safety-bake.py`'],
    ['data/base/index.json', 182, 'auto', 'Geofabrik south-korea-latest.osm.pbf 를 C:/Users/knpth/osmwork/kr.pbf 로 받고(영문 경로) → `py -3.12 -X utf8 tools/map2d-build/tiles-bake.py`(2분) → `tools/map2d-build/sgg-bake.py`'],
    ['data/cameras-seocho.json', 182, 'auto', '전국무인교통단속카메라표준데이터(키 data_go_kr)'],
    ['data/schoolzone-seocho.json', 182, 'auto', '전국어린이보호구역표준데이터 tn_pubr_public_child_prtc_zn_api(키 data_go_kr)'],
    ['data/tgis-seocho.json', 365, 'hand', '서울시 T-GIS A008_P(소유자가 받아 둔 shp) → `perl tools/map2d-build/tgis.pl`'],
    ['data/police-seocho.json', 365, 'hand', '경찰청 지구대·파출소·치안센터 주소 CSV(data.go.kr 15077036·15076962 — 해마다 12월 말 기준) → police_*.pl'],
    ['data/hot10-seocho.json', 365, 'auto', '도로교통공단 다발지 OpenAPI(키 koroad · MAP2D.md §7) — 새 해가 나왔는지'],
    ['data/taas10-seocho.json', 365, 'hand', 'TAAS GIS — 브라우저 안 절차(MAP2D.md §8 ⑧) · 새 해(2026) 자료가 열리면'],
    ['data/season-seocho.json', 182, 'auto', '침수흔적도(OA-15636 · 해마다 봄에 전년분)·제설함·열선·전진기지 다시 받기 → `py -3.12 -X utf8 tools/season-bake.py`(받는 법은 파일 머리 주석)'],
    ['data/pedbtn-seocho.json', 182, 'auto', '서울 API trafficSafetyA077PInfo(OA-15545) → 07_API키/out/season/ped_button.json → `py -3.12 -X utf8 tools/pedbtn-bake.py`'],
    ['data/enforce-seocho.json', 365, 'hand', '경찰청 서울특별시경찰청_경찰서별 교통법규 위반 단속 수(공공데이터포털 15097296 · 해마다 새 해 파일)'],
    ['data/police-stats.json', 365, 'hand', '공공데이터포털 15097296(단속)·15114082(112 출동)·15054738(5대 범죄)·15114084(지역경찰)·15126908(경기남부 범죄) 새 해 파일 → 07_API키/단속통계_20260929/seoul_years 집계 → `py -3.12 -X utf8 tools/map2d-build/police-stats-bake.py`'],
    ['data/heritage-seocho.json', 365, 'auto', '국가유산청 목록 OpenAPI(키 없음)'],
    ['data/r/biz/index.json', 92, 'auto', '서울 상권 1,650곳(매출 분기 · 1년 전 · 점포 · 유동·직장·상주 · 변화지표) — 07_API키/out/region/trdar_* 를 지우고 `py -3.12 -X utf8 tools/region/trdar-bake.py fetch` → `build`(dong-bake build 뒤에 — r/index.json 에 상권 바이트를 더한다)'],
    ['data/r/stores-index.json', 92, 'auto', '서울 상가 점포(소상공인 상가정보 · 분기마다 기준 연월 갱신) — 07_API키/out/region/stores_* 를 지우고 `py -3.12 -X utf8 tools/region/store-bake.py fetch` → `build`(dong·trdar build 뒤에)'],
    ['data/r/rent.json', 92, 'hand', '한국부동산원 임대동향(R-ONE 화면 「임대동향 지역별 임대료·공실률(2024년3분기~)」 5개 표 — CLAUDE.md v0.10.93 받는 법) → `py -3.12 -X utf8 tools/region/rent-bake.py`'],
    ['data/r/11680/transit.json', 31, 'auto', '서울 버스·지하철 승하차(다음 달 교통카드 CSV·CardSubwayTime) — transit-bake.py 의 BUSCSV·YM 을 새 달로 · `py -3.12 -X utf8 tools/region/transit-bake.py`'],
    ['data/r/11680/safety.json', 182, 'auto', '서울 단속 카메라·어린이보호구역·생활안전 시설 — 07_API키/out/region/safe_* 를 지우고 `py -3.12 -X utf8 tools/region/safety-bake.py fetch` → `build`'],
    ['data/r/11680/taas10.json', 365, 'hand', 'TAAS 사고 서울 25개 구 — TAAS GIS 화면 안에서 모으기(CLAUDE.md v0.10.96 절차) → 07_API키/out/region/taas10_raw.json → `py -3.12 -X utf8 tools/region/taas10-bake.py` · 새 해(2026) 자료가 열리면'],
    ['data/r/11560/season.json', 182, 'auto', '서울 계절 위험(침수흔적도 봄마다 전년분 · 제설함 · 열선) — tools/season-bake.py 와 같은 원자료를 다시 받은 뒤 `py -3.12 -X utf8 tools/region/season-bake.py`(바탕 조각 data/base/t 길을 쓴다)'],
    ['data/r/index.json', 92, 'auto', '서울 25개 구 행정동(주민 연령 매월 · 상권 매출 분기 · 생활인구 월 파일) — 07_API키/out/region 의 받은 것을 지우거나 JUMIN_YM·LOCAL_PEOPLE 달을 올리고 `py -3.12 -X utf8 tools/region/dong-bake.py fetch` → `build`'],
]

def last_commit(path):
    try:
        out = subprocess.run(['git', '-C', ROOT, 'log', '-1', '--format=%cI', '--', path], capture_output=True, text=True, timeout=5).stdout.strip()
        if out: return datetime.datetime.fromisoformat(out)
    except Exception: pass
    p = os.path.join(ROOT, path)
    if os.path.exists(p): return datetime.datetime.fromtimestamp(os.path.getmtime(p)).astimezone()
    return None

def main():
    now = datetime.datetime.now().astimezone()
    stale, missing = [], []
    for f, days, kind, how in SETS:
        t = last_commit(f)
        if t is None: missing.append(f); continue
        age = (now - t).total_seconds() / 86400
        if age > days: stale.append((f, age, days, kind, how))
    # 실시간 자동 갱신 기록(마지막 줄)
    log = os.path.join(KB, '07_API키', 'out', 'live-refresh.log'); last = ''
    try:
        with open(log, encoding='utf-8') as h: lines = [l.strip() for l in h if l.strip()]
        last = lines[-1] if lines else ''
    except Exception: pass
    if not stale and not missing:
        print('📋 데이터 압축지도 자료 점검(' + now.strftime('%Y-%m-%d %H:%M') + ') — 기한 지난 자료 없음.' + (' 실시간 갱신 마지막: ' + last if last else ''))
        return
    print('📋 데이터 압축지도 자료 점검(' + now.strftime('%Y-%m-%d %H:%M') + ') — 다시 굽는 주기를 넘긴 자료 ' + str(len(stale)) + '건')
    for f, age, days, kind, how in sorted(stale, key=lambda x: (x[3] != 'auto', -x[1] / x[2])):
        print('- [' + ('자동' if kind == 'auto' else '사람 단계') + '] ' + f + ' — 마지막 ' + (str(round(age * 24)) + '시간' if age < 2 else str(int(age)) + '일') + ' 전(주기 ' + (str(int(days * 24)) + '시간' if days < 1 else str(int(days)) + '일') + ') · ' + how)
    for f in missing: print('- [없음] ' + f)
    if last: print('실시간 갱신 마지막 기록: ' + last)
    print('소유자 지시(2026-10-04): 세션이 열리면 이 목록을 찾아 수정·보완·입력·삭제까지 한다 — 1차 출처에 새 자료가 있는지 먼저 확인하고(없으면 「새 자료 없음」으로 끝), '
          '[자동] 은 다시 굽고 [사람 단계] 는 할 수 있는 데까지 한 뒤 막힌 단계를 소유자에게 알린다. 굽은 뒤 map2d 브라우저 검사(콘솔 0 · 해당 층 카드) → 판올림 없이 「data:」 커밋·푸시 · CLAUDE.md 한 줄. '
          '키는 07_API키/keys.json 에서만 읽고 출력·커밋하지 않는다. 지어낸 값·개인정보 금지(MAP2D.md 원칙).')

if __name__ == '__main__':
    try: main()
    except Exception as e: print('📋 데이터 점검 실패: ' + str(e))
    sys.exit(0)
