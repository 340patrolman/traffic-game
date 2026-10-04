# 🗜 데이터 압축지도 — 구성과 만드는 법 (다른 곳 요청이 오면 이대로 만든다)

> 대상: 사람·AI 모두. 이 문서만 읽고 **다른 구·다른 관서용 지도를 같은 방식으로 굽고 띄울 수 있게** 적는다.
> 마지막 정리: 2026-10-04 · v0.10.80 · 소유자 지시 「데이터 압축지도 구성과 만드는 방법을 계속 정리해서 다른 곳에서 요청이 오면 바로바로 만들 수 있게」.
> **판이 바뀌면 이 문서도 같이 고친다**(새 층·새 자료·새 함정은 아래 해당 칸에 한 줄씩).

---

## 1. 한 줄 요약
`map2d.html`(화면 · CSS) + `js/map2d.js`(로직 하나) + `data/*.json`(미리 구운 공공데이터) — **이 세 가지만 있으면 따로 떼어 돈다.**
three.js·게임 모듈에 기대지 않는다. **통신 0**(지도는 같은 출처의 data/ 파일만 읽는다) · **키는 저장소에 없다**(굽는 도구가 이 PC 의 `07_API키/keys.json` 에서만 읽는다).
주소: https://340patrolman.github.io/traffic-game/map2d.html · 검색 안 걸림(noindex · 문서는 `_config.yml` exclude).

## 2. 원칙(어기면 지도가 거짓말을 한다)
1. **실제 값만** — 없는 값은 지어내지 않고 「자료 없음 / 대조 전 / 근사」로 적는다. 모든 카드 끝에 출처 줄(`src(...)`).
2. **좌표는 실제 위경도** — 평면 근사 `P(lon,lat) = [(lon−127.01)×88800, −(lat−37.49)×111000]`(m). 다른 지역이면 기준점 `LON0·LAT0` 와 배율(위도에 따라 가로 m/도 = 111320·cos(위도))만 바꾼다.
3. **개인정보 금지** — 사고는 나이·성별·상해 부위·사고번호·날짜의 일을 받는 자리에서 버린다. 담당자 직통번호·실명 없음. 좌표(보고 자리·지금 위치)는 저장하지 않는다.
4. **실시간은 「받은 시각」을 적는다** — 지나간 값을 지금처럼 보이지 않는다(📡 인파 카드: 지금 / 예측 / 받은 때).
5. **출처 표기 의무** — OSM(ODbL) · 공공누리 · SGIS(CC BY) · TAAS · 서울시 … 지도 아래 「ⓘ 자료 출처 · 한계」와 `CREDITS.md`.
6. **범례로 말한다** — 색만으로 두지 않는다(소유자 지시). 새 층은 `legend()` 에 한 묶음을 꼭 더한다.
7. **법정 관할·법령 문구는 1차 출처** — 관할 = 「경찰청과 그 소속기관 직제 시행규칙」 별표2 + 현장 지식(소유자 확인) + T-GIS 관할 칸 대조.

## 3. 화면 구성(위 → 아래)
| 자리 | 요소 | 하는 일 |
|---|---|---|
| 한 줄(늘) | ← · **☰ 층 N** · 날짜(10/4(일)) · 🕐 지금 ◀ 시각 막대 ▶ 14시 | v0.10.99 소유자 「지도만 전체로」 — 위 막대는 이 한 줄(약 51px)뿐. 날짜 단추 = 숨긴 date 입력의 `showPicker()` · 폭 430px 아래는 ◀ ▶ 와 「평일/주말」 글을 숨긴다(날짜 단추가 주말이면 빨강) · 시각 → `HOUR`(=`#h`) |
| ☰ 판(누르면) | 찾기 · 🧭 근무별 한 번에 · 지금 요약 · 층 단추(두 줄 + 「☰ 모든 층」) · 「▴ 닫고 지도 넓게」 | 지도 **위에 겹쳐** 열린다(지도 크기는 그대로 — `fitTop` 이 판 높이를 뺀다) · 판 안 단추를 눌러도 판은 그대로(여러 개 고르기) · 지도를 누르거나 카드가 열리면(찾기 결과) 닫힌다. 찾기 = 동·교차로·길·역·정류장·병원·상권·AED… / 업종 이름이면 상권을 그 업종으로 |
| 지도 | 캔버스 | 끌기 · 두 손가락/휠 확대 · 누르면 아래 카드 |
| 오른쪽 아래 | ＋ － 전체 범례 | 범례 = 켠 층의 색·선·크기 뜻 + 최솟값~최댓값 |
| 아래 | 카드 · 출처 | 카드 = 그 점/면의 모든 값 + 출처 줄 |

## 4. 주소(다른 앱에서 여는 법)
- `map2d.html#ly=키,키` — 행정동·도로·바탕·건물 + 그 층만 켜고 연다(저장값을 덮지 않는다). 모르는 키는 건너뛴다.
- `#h=0~23` — 볼 시각. `#lat=..&lon=..` — 그 자리로(반경 약 500m) + 가장 가까운 교차로 카드. 서초 상자(37.425~37.525 / 126.965~127.075) 밖은 무시.
- `&here=1` — 그 표시를 「📍 지금 위치」로(아니면 「📋 보고 자리」 — T-Book 최초보고). 카드에 관할·가까운 지구대·인파·하차 상위.
- `&gps=1` — 열린 뒤 스스로 위치를 다시 잡아(정밀 1km 안 · 상자 안) 옮긴다.
- T-Book 이 쓰는 주소(키 이름을 바꾸면 T-Book 세션에 먼저 알린다): `ly=jur,pol,acc,cam,er,crowd&here=1&gps=1` · `ly=acc,fatal,cam,er,pol,jur` · `ly=tgis,sig,acc,cam,bus`.

## 5. 층 키 전부(`LAYERS` = [키, 이름, 기본 켜짐, 갈래, 위 줄 우선])
| 갈래 | 키 |
|---|---|
| 기본 | dong 행정동 · road 도로 · base 바탕(물·녹지·철도) · bld 건물 · sub 지하철역 · exit 출입구 |
| 교통안전 | acc 교차로 사고(23~25) · **acc10 사고 10년(100m 칸)** · **fatal10 사망사고 10년** · fatal · hot · **hot10 다발지 10년** · drunk · risk · sz · szh · cam · **spd 도로 소통** · sig · sigx · tgis · spota · **pkcctv 불법주정차 CCTV** · **tow 견인보관소** |
| 사람·흐름 | **trd 상권분석** · **crowd 실시간 인파·카드** · live 생활인구 · **sales 카드 매출(동)** · bus · subr · vol · bike · spot |
| 치안·안전 | pol 경찰 관서(공식) · jur 관할 · fire · er · hosp · phar · bar · play · inn · heat · cold · hyd · wc · **srcctv · srbell · srlamp · sr112 · srsvc(안심귀갓길)** · **aed** · **fw 소방용수** · **dem 치매안심센터** |
| 생활 | school · kids · pg 놀이터 · park · welf · gov · lib · post · bank · conv · fuel · ev · pk · **wc2 · box** |
| 행사·역사 | evt 행사·집회 · her 국가유산 |
⚠ `hot` 은 「사고다발지」, `pg` 는 놀이터(옛 `play` 는 노래방·PC방) — 키 이름은 한 번 정하면 바꾸지 않는다.

## 6. 자료 파일과 굽는 도구(새로 굽기 = 이 표 순서대로)
| 파일 | 크기 | 내용 | 원천(1차 출처) | 굽는 도구 | 다시 굽는 주기 |
|---|---|---|---|---|---|
| r/index.json · r/<구>/dong.json · r/<구>/dongx.json | 18KB + 25개 구 0.86MB + 3.5MB(카드 열 때만) | **서울 25개 구 행정동**(v0.10.91): 경계 · 주민 연령 · 생활인구 · 카드 매출 · 업종 줄 · 분기 추이 | SGIS · 행안부 주민등록 · 서울 LOCAL_PEOPLE_DONG · VwsmAdstrdSelngW | tools/region/dong-bake.py | 분기 |
| base/index.json · base/ov.json · base/t/*.json · base/sgg.json | 0.85MB + 조각 391개 38MB + 171KB | **서울·경기(+인천) 바탕 조각**(v0.10.90): 개관(고속·주간선·큰 물·큰 숲·철도) + 8km 조각(모든 길·물·녹지·철도·주차장·교차로 이름) + 시·군·구 경계 | Geofabrik south-korea-latest.osm.pbf(ODbL) · 서울 C-ITS · SGIS | tools/map2d-build/tiles-bake.py · sgg-bake.py | 반년 |
| dong-seocho.json · dong-near.json | 25·18KB | 행정동 경계(서초 + 이웃 1.5km) | 통계청 SGIS 행정동(vuski/admdongkor) | dongnear.pl | 행정동 개편 때 |
| maps/seoul-districts.json | — | 자치구 테두리(행정동 합침) | 같은 원자료 | gu.pl | 〃 |
| pop-seocho.json | 7KB | 동별 주민·연령 | 행안부 주민등록 | (CSV 손굽기) | 분기 |
| jur-seocho.json | 11KB | 서초서·방배서 관할 · 반포4동 반포대로 가름 | 별표2 + 소유자 현장 지식 + T-GIS 관할 칸 | tools/map2d-build/jur-bake.py(shapely) | 직제 개정 때 |
| tgis-seocho.json | 27KB | 신호 교차로 432(관할 칸 340/380) | 서울시 T-GIS A008_P | tgis.pl | 연 1 |
| pubdata-seocho.json | 1.1MB | 생활인구(동×24시) · 음주다발 · 위험지역 · 지하철·버스 하루 · 병의원·약국·쉼터·따릉이 · OSM 시설 · C-ITS 신호 | 서울 열린데이터 · 도로교통공단 · OSM · C-ITS | build_pub.pl | 월 |
| flow-seocho.json | 166KB | 버스 1,042·지하철 37 **시간대 승차/하차** · 행정동 카드 매출(시간대·요일·업종) | 서울 교통카드 · 상권분석 | `tools/flow-bake.py flow` | 월·분기 |
| live-seocho.json | 157KB | 실시간 인파·카드·도로 소통 27장소(+12시간 예측) | 서울 실시간 도시데이터 OA-21285 + 121장소 영역 OA-21778 | `tools/flow-bake.py live <shp>` · **자동: tools/live-refresh.py(작업 스케줄러 3시간마다)** | 3시간 |
| trend-seocho.json | 101KB | 지하철 10년(해마다 6월) · 동 매출 22분기 | CardSubwayTime · VwsmAdstrdSelngW | `tools/trend-bake.py` | 연 1·분기 |
| trdar-seocho.json | 519KB | **상권 74곳** 영역 + 업종별 매출(시간대·연령·성별·요일 · 금액·건수) · 유동·직장·상주인구 · 점포 · 집객시설 · 상권변화 · 추이 + 동별 업종 | 서울시 상권분석서비스(OA-15560 · VwsmTrdar*Qq) | `tools/trdar-bake.py <상권 shp>` | 분기 |
| safety-seocho.json | 444KB | 안심귀갓길 시설·서비스 · AED · 소방용수 · 불법주정차 CCTV · 견인보관소 · 화장실 · 안심택배함 · 치매안심센터 | 서울 열린데이터(§7) | `tools/safety-bake.py` | 반년 |
| taas10-seocho.json | 179KB | 사고 2016~2025 22,546건(100m 칸) · 사망 122(한 건씩) | TAAS GIS 사고분석(브라우저 안 · §8) | 수동(§8 절차) | 연 1 |
| hot10-seocho.json | 8KB | 다발지 2016~2025 | 도로교통공단 다발지 OpenAPI | (§8 hot.py 절차) | 연 1 |
| police-seocho.json | 10KB | 경찰서·지구대·파출소·치안센터(공식) | 경찰청 주소 현황 CSV + OSM 자리 | police_*.pl | 연 1 |
| schoolzone · stores · events · cameras · traffic-vol · signal-tod · heritage · taas* · intersections · spot | — | (이전 판들 — CLAUDE.md v0.10.44~v0.10.74) | | build_pub.pl 등 | |
**큰 파일은 첫 그림 뒤에 읽는다**(`LATE` = trend·hot10·trdar·safety·taas10). 새 큰 파일도 여기에 넣는다.

## 7. API 이름 모음(서울 열린데이터광장 · `http://openapi.seoul.go.kr:8088/{키}/json/{서비스}/{시작}/{끝}/{인자}` · **http 만** · 한 번 1,000행)
| 자료 | 서비스 | 비고 |
|---|---|---|
| 실시간 도시데이터 | `citydata` (인자 = 장소명) | 인구·예측·카드·버스/지하철·도로·주차·날씨 |
| 상권 매출 / 유동 / 직장 / 상주 / 점포 / 집객 / 변화 | `VwsmTrdarSelngQq` `VwsmTrdarFlpopQq` `VwsmTrdarWrcPopltnQq` `VwsmTrdarRepopQq` `VwsmTrdarStorQq` `VwsmTrdarFcltyQq` `VwsmTrdarIxQq` | 인자 = 분기(20262). 직장·상주·점포·집객은 분기 인자를 무시하기도 해 받은 뒤 `STDR_YYQU_CD` 로 거른다. 매출은 **2021년 1분기부터** |
| 행정동 매출 | `VwsmAdstrdSelngW` | 동 코드 인자는 무시 — 분기 전체를 받아 `11650` 으로 거른다 |
| 지하철 시간대 | `CardSubwayTime/{s}/{e}/{YYYYMM}` | 2015~ · HR_0~23 ON/OFF |
| 생활인구(동) | `SPOP_LOCAL_RESD_DONG` | **API 는 최근 두 달만** · 지난 해는 월별 파일 · 2026-07-31 생산 끝(250m 격자 `se250mSpopOrgnCt` 로 바뀜) |
| 안심귀갓길 시설 / 서비스 | `tbSafeReturnItem` / `tbSafeReturnService` | 시설코드 301 안심벨 · 302 CCTV · 303 표지판 · 304 노면 · 305 보안등 · 306 안내판 · 307 112 위치신고 · 308 기타(첨부 xlsx) · WKT 는 `POINT(` 뒤 빈칸 없을 수 있음 |
| AED / 소방용수 / 화장실 / 견인보관소 / 안심택배함 / 치매안심센터 | `tbEmgcAedInfo` / `tbFireItem` / `mgisToiletPoi` / `TbTowCarsDepository` / `safeOpenBox` / `TbDementiaCenter` | safeOpenBox 는 WGSXPT=위도·WGSYPT=경도(이름 뒤바뀜) |
| 구별 불법주정차 CCTV | `TbOpendataFixedcctv` + 구 두 글자(서초 SC · 강남 GN …) | |
| 실시간 돌발 | `AccInfo` | **xml 만** |
| 자료 찾기 | `SearchCatalogService`(이름) · `SearchOpenAPIIOValueService`(OA 번호 → 서비스명) | sample 키로도 5행 |
**파일 받기**: `datafile.seoul.go.kr/bigfile/iot/inf/nio_download.do?&useCache=false` 에 POST `infId=OA-…&seq={파일}&infSeq={파일 탭의 값(보통 3)}` + Referer. ⚠ 이미지 묶음(수백 MB) seq 를 함부로 받지 말 것 — 페이지의 파일 이름을 먼저 본다.
그 밖: 도로교통공단 다발지 `opendata.koroad.or.kr/data/rest/frequentzone/{pedstrians|oldman|child|bicycle|motorcycle|truck|lg|freezing}` (키 `koroad` · siDo=11 guGun=650 · 2016~2025 중 있는 해만).

## 8. 절차(처음부터 새 지역 지도를 만들 때)
1. **범위 정하기** — 자치구 코드(서초 11650 · 시군구 10자리 1165000000), 상자(위경도 4개), 기준점(가운데), 관할 경찰서.
2. **바탕** — Overpass 질의(아래)를 상자로 → `base-bake.py` → `data/base-<지역>.json`.
   `[out:json][timeout:180];(way["highway"~"^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|living_street|.*_link|pedestrian|footway|cycleway|path|steps|service)$"](BBOX);way["waterway"](BBOX);way["natural"="water"](BBOX);relation["natural"="water"](BBOX);way["leisure"~"^(park|pitch|garden|playground)$"](BBOX);way["landuse"~"^(forest|grass|recreation_ground|cemetery)$"](BBOX);way["natural"~"^(wood|scrub|grassland)$"](BBOX);relation["leisure"="park"](BBOX);way["railway"~"^(rail|subway|light_rail)$"](BBOX);way["amenity"="parking"](BBOX););out body geom;` — User-Agent 를 꼭 붙인다(없으면 406).
   교차로 이름: `node["name"~"(사거리|삼거리|오거리|교차로|입구)$"]` + `node["highway"="traffic_signals"]["name"]` + `node["junction"]["name"]` → base 파일 `junctions`.
3. **행정동·구 경계** — SGIS 원자료에서 그 구 동 + 이웃 1.5km → dong·near·districts.
4. **관할** — 별표2 를 행정동에 붙이고, 번지로 갈리는 동은 현장 확인(소유자) + T-GIS 관할 칸으로 대조 → `jur-bake.py`(도로 중심선으로 동을 가르는 예: 반포4동/반포대로).
5. **흐름** — `flow-bake.py flow`(버스·지하철·동 매출) · `trend-bake.py` · 실시간 `flow-bake.py live` + 작업 스케줄러.
6. **상권** — 상권 영역 shp(OA-15560 · EPSG:5181) → `trdar-bake.py` (구 코드만 바꾼다).
7. **안전시설** — `safety-bake.py`(구 코드·구 이름 거르기만 바꾼다).
8. **사고 10년** — TAAS 는 세션이 있어야 한다: ① 앱 안 브라우저로 `taas.koroad.or.kr/` → `gis/mcm/mcl/initMap.do?menuId=GIS_GMP_STS_RSN` ② 페이지 안에서 `gis.com.req.requestAjaxByPost({url:'/gis/srh/ash/selectAccidentInfo.do', data:{searchType:'00', zoneYn:false, engnCode:'00', startAcdntYear, endAcdntYear(**3년까지**), legaldongCode:'11650%', acdntGaeCode:'01'~'04'}})` ③ 개인정보 칸을 버리고 100m 칸으로 묶어 gzip+base64 ④ 6,000자 묶음마다 SHA-1 4바이트를 대조하며 옮긴다(curl 직접 호출은 「데이터베이스 오류」) ⑤ pyproj EPSG:5179 → WGS84.
9. **지도 코드** — `js/map2d.js` 의 `FILES`(+`LATE`) 에 파일, `LAYERS` 에 키, `*Prep()`·`draw*()`·카드·`legend()` 묶음·찾기·`PRESETS` 를 더한다(§9). 기준점 `LON0·LAT0`·상자 상수(`applyHash`·`gpsHere`)를 그 지역으로.
10. **검사** — 브라우저: 콘솔 오류 0 · 층마다 카드 열기 · 범례 · 375px 폭 · 헤드리스 스크린샷(`chrome --headless=new --screenshot`, 2D 캔버스는 찍힌다). 게임 검증(`_verify_tail.js`)도 돌린다(같은 저장소).
11. **배포** — 판 번호(`js/config.js` 3줄 · `?v=` index·promo·map2d · `sw.js` CACHE)와 sw 미리 저장 목록에 새 data 파일 · CLAUDE.md·CREDITS.md·이 문서 · 키 흔적 grep · 커밋·푸시.

## 9. 새 층 하나 더하는 법(레시피)
```
1) FILES 에 'k: data/xxx.json' (크면 LATE 에도)
2) LAYERS 에 ['k', '🧩 이름', false, '갈래', 0]
3) function kPrep() { D.k 를 [{p: P(lon,lat), r: …}] 로 } — 불러오는 then 안에서 부른다
4) function drawK(dark) { if (!on.k) return; 점은 dot(p, 반지름, 색, 테, {kind:'k', …}) · 면은 path()+fill · 큰 배율에서만 label() } — draw() 안 drawPub 앞뒤에
5) show() 에 else if (it.kind === 'k') h = kCard(it) — 카드 끝에 src(출처)
6) legend() 에 G('🧩 이름', li(색, '뜻') …) — 숫자 색띠는 grad()
7) 찾기(m2dFind keydown)에 이름으로 찾기 · 필요하면 PRESETS 에 키 추가
8) map2d.html 출처 목록 한 줄 · CREDITS.md 한 줄 · 이 문서 §5·§6 한 줄
```
⚠ **줄 중간에 `//` 주석 금지** — 패치로 줄 가운데에 주석을 붙이면 그 줄 나머지가 사라진다(이 프로젝트 사고 열 번 넘게 · v0.10.80 에도). 주석은 줄 끝이나 다음 줄.
⚠ 페인이 숨어 있으면 캔버스 폭이 0 이라 누르기 시험이 엉뚱한 것을 집는다 — `resize_window` 로 폭을 준 뒤 시험.

## 10. 지금 서초 지도에 든 것(2026-10-04 · v0.10.82)
교차로 사고는 2019~2025 를 기본으로(TAAS 10년 100m 칸을 585m 안 교차로에 배정) · 바탕은 세곡동·과천·성남 수정구까지 · 교차로 이름 884 · 이웃 동 31(과천·성남 포함).
교차로 25 + 이름 있는 교차로 수백 · 행정동 18(+이웃 26) · 상권 74 · 정류장 1,042 · 지하철 37 · 실시간 장소 27 · 사고 22,546건(10년)·사망 122 · 다발지 10년 45자리 · 무인 카메라 222 · 불법주정차 CCTV 496 · 안심귀갓길 시설 666 · AED 614 · 소방용수 6,833 · 경찰 관서 38 · 어린이보호구역 242 · 행사 329 · 집회 15 · 국가유산 86 …
**못 넣은 것**: 통계청 SGIS 집계구(가구소득·주택 — 키 필요) · 생활인구 지난 해(월별 큰 파일) · 실시간 돌발(AccInfo xml — 다음 판) · 안전비상벨 서울 전체(API 없음) · CCTV 위치(서울시 공개 종료).

## 10-1. 자동 갱신 점검(소유자 지시 2026-10-04)
Claude Code 를 지식베이스 폴더에서 켜면 `지식베이스/.claude/settings.json` 의 SessionStart 훅이 `tools/data-check.py` 를 돌린다(통신 0 · 1초).
위 §6 표의 파일마다 마지막 커밋 날짜와 주기를 견줘 **기한 지난 것만** 세션 문맥에 적고, 그 세션의 Claude 가 1차 출처에 새 자료가 있는지 확인 → [자동] 은 다시 굽고 · [사람 단계] 는 막힌 단계를 소유자에게 알린다 → 브라우저 검사 → 「data:」 커밋·푸시.
주기·명령은 `data-check.py` 의 `SETS` 한 곳에서 고친다(새 자료 파일을 만들면 여기에도 한 줄).

## 10-2. 바탕 조각과 지역 받기(v0.10.90)
* 좌표는 그대로 평면 m(127.01/37.49). 조각 = 8km 칸 `ix_iz`(ix = floor(x/8000)). `index.json` 에 조각 목록·바이트·굽은 때(`bake`).
* 지도: 배율 `TILE_S`(0.045) 넘으면 화면에 걸린 조각만 받는다(동시 4 · 64개 넘으면 먼 것부터 내려놓음) · 그 아래는 개관 한 장. 그리기는 단계(숲·물·길 테두리·길 채움)마다 모든 묶음을 돌아 조각 경계가 안 보인다.
* 「📥 지역 받기」: 구·시(경계 밖 3km 둘레까지 · `DL_AROUND`) · 지금 위치 둘레 6km · 지금 화면 → 보관함 `tg-tiles`(판을 올려도 안 지워짐 · sw.js 가 조각은 보관함 먼저) · 받은 기록 `tg_map2d_dl`. 새로 구우면 `?b=` 가 바뀌어 옛 조각은 지도가 지운다.
* 다시 굽기: Geofabrik pbf 를 **영문 경로**(`C:/Users/knpth/osmwork/kr.pbf`)에 — libosmium 은 한글 경로를 못 연다 · `pip install osmium`(pyosmium) · 2분.
* 아직 서초 둘레만 있는 것: 상권·안전시설·사고·버스·지하철 등 자료 층(2단계 = 서울 25개 구 · 3단계 = 경기). 행정동 층은 v0.10.91 에서 서울 전역.

## 10-3. 지역 자료(서울 25개 구 · v0.10.91~)
* 파일 = `data/r/<구 5자리>/<층>.json` + `data/r/index.json`(구마다 상자·동 이름과 이름 자리 `d`·바이트). 지도는 **화면에 걸린 구만** 받는다(`needRegions` · 배율 0.012 넘을 때 · 행정동·생활인구·카드 매출 층 중 하나가 켜져 있을 때).
* **서초구(11650)는 기존 서초 자료가 우선**(지역 파일도 굽지만 지도는 안 받는다) — 서초 카드·요약·관할 줄은 그대로다.
* 동 열쇠 = 행정동 코드 8자리(`adm_cd2` 앞 8 = 서울 생활인구·상권 `ADSTRD_CD`). **이름으로 찾지 않는다** — 신사동(강남·관악) 같은 겹침. 지도 안 함수는 이름 대신 동 객체를 받는다(`liveNow(d)` · `salesNow(d)` · `salesRows(d)` · `dongIndRows(d)` · `salesTrend(d)` — 문자열을 주면 서초 자료로).
* 층 `dong` = 경계(SGIS · 공유 변 함께 약 4m 단순화) · 주민 연령(행안부 · 구마다 POST 한 번) · 생활인구 평일/주말 24시(서울시 LOCAL_PEOPLE_DONG 월 파일 — 서울 전체가 한 파일) · 카드 매출 요약(VwsmAdstrdSelngW 최근 분기). 층 `dongx` = 업종 줄·분기 추이(2021년 1분기~) — **카드를 열 때만** 받는다.
* 색칠 눈금은 **받은 구 전체 한 눈금**(생활인구·매출 — 구를 더 받으면 서초 색도 함께 옅어질 수 있다 · 그게 서울 기준이다).
* 행정동 바뀜(2024~2026): 코드만 바뀐 곳은 새 코드로 옮긴다(`RENUM` — 강북 번1~3·수유1~3 · 강남 일원2동 → 개포3동). 나뉜 곳(동대문 용신동 → 신설·용두 · 강동 상일동 → 상일제1·2)은 옛 동 값을 `old` 로 따로 붙이고 카드에 「옛 ○○동 전체 값」으로 보인다 — **나눠 지어내지 않는다**. 구로 항동은 생활인구 원자료에 없다(카드에 밝힘).
* 층 `trdar`(v0.10.92) = 서울 상권 1,650곳을 구마다(`r/<구>/trdar.json` · 서초 trdar-seocho.json 과 같은 꼴 + 1년 전 같은 분기 업종 매출 `indp` · 점포 `storp` · 서울 평균 운영 개월). 상권분석 층을 켜면 화면에 걸린 구를 받는다(서초도 이 파일로 갈아 끼운다 — 1년 전보다 줄이 생긴다). 굽기 `tools/region/trdar-bake.py fetch` → `build` (**dong-bake build 다음**에 — r/index.json 에 상권 바이트를 더한다).
* **🏪 창업 자리 찾기**(근무별 줄 「🏪 창업 자리 찾기」 · 상권 범례 · 상권 카드 「◀ 목록」): `r/biz/index.json`(상권 요약 1,650줄) + `r/biz/<업종코드>.json`(업종 100가지 — 그 업종을 서울 모든 상권에서 [상권, 매출, 건수, 점포, 프랜차이즈, 개업, 폐업, 1년 전 매출·점포, 시간대 6, 연령 6, 주말]). 점수 = 항목마다 「그 업종이 있는 상권 안 백분위」 × 가중(⚖ 균형 · 💰 매출 · 🛡 버티기 · 📈 성장 · 🆕 빈 자리 — 설계값). 항목 = 점포당 매출 · 시장 크기 · 경쟁(점포/ha 적음) · 1년 성장(1년 전 매출 1천만원 넘고 점포 2곳 넘을 때만) · 버티기(분기 폐업률 60% + 운영 평균 개월 40%) · 배후 사람(하루 유동 + 직장 + 상주) · 사람 대비 점포. 어디서 = 서울 전체 / 구 / 지금 화면. **임대료·권리금·공실·동선·1층 여부는 자료에 없다 — 화면에 밝힌다.**
* **📐 반경 분석**(v0.10.93 · 근무별 줄 · 상권·임대료 카드 「📐 여기서 반경 분석」): 고른 자리에서 반경 300m·500m·1km — 점포(`r/<구>/stores.json` · 소상공인 상가정보 55만 곳 하나하나 · 업종 대·중·소 분류표 `r/stores-index.json`) · 경쟁 업종(소분류) 점포 거리순 · 추정 카드 매출(걸친 상권 × 겹친 넓이 비율) · 시간대·연령 매출 · 생활인구 24시 · 주민 연령(걸친 동 × 넓이 비율) · 하루 유동·직장(걸친 상권) · 지하철역(`r/stations.json` 서울 역사마스터 784) · 가까운 부동산원 임대료 · 📋 요약 복사. 넓이 비율 = 반경 안 격자(한 변 r/16)로 센 근사.
* **💰 예상 매출**(v0.10.97 · 반경 분석 안): 상권분석 업종 하나를 고르면 반경에 걸친 상권의 그 업종 매출·결제·점포(+개업·폐업)를 겹친 넓이 비율로 합쳐 **점포당 한 달 평균 매출** · 1년 전 같은 분기 대비 · 객단가 · 피크 · 연령 · 주말 · 「10평 임대료 ÷ 점포당 매출」 어림 + 시간대·연령 막대. 한 점포 실제 매출이 아니라 평균이라고 적는다.
* **💰 상가 임대료·공실률**(층 `rent` · `r/rent.json` · `tools/region/rent-bake.py`): 한국부동산원 상업용부동산 임대동향조사 표본 상권 72곳(서울) × 2024년 3분기~2026년 2분기 — 소규모·중대형·집합 임대료(천원/㎡) · 소규모·중대형 공실률. 상권 경계는 공개되지 않아 **이름(역)으로 대표 자리**(how 칸). 상권 카드·창업 자리(💸 임대료 대비 · ⚖ 균형·🛡 버티기에 「임대료 낮음」)·반경 분석이 1.5km 안 가장 가까운 표본을 쓴다 — 그 자리 값이 아니라고 늘 밝힌다.
  * 받는 법: 공공데이터포털 15069766 등은 「기관 자체 다운로드」(R-ONE 화면)로 이어진다. R-ONE OpenAPI 는 키 없이 표본 5줄만 준다 → 화면(easyStatPage/<표ID>.do)을 열면 표가 IBSheet 로 다 실린다 → `IBSheet[0].getDataRows()` 로 읽어 지도 쪽(localhost) 페이지로 넘겨(window.name) 파일로 둔다. 표 ID: 소규모 임대료 T248223134698125 · 중대형 T244363134858603 · 집합 T244913134948657 · 소규모 공실 T241833134686576 · 중대형 공실 T249633134845544.
* 층 `transit`(v0.10.94) = 서울 버스 정류장 10,617곳·지하철역 304곳의 시간대 승차·하차(2026년 6월 하루 평균) — `r/<구>/transit.json` · `tools/region/transit-bake.py`. 버스·지하철 층을 켜면 화면에 걸린 구를 받아 서초 정류장·역과 같은 모양으로 그린다. 반경 분석에 「버스·지하철 승하차」 줄과 막대.
* 층 `safety`(v0.10.95) = 서울 25개 구 단속 카메라(전국무인교통단속카메라표준데이터) · 어린이보호구역(표준데이터 · 구청 insttCode 3000000~3240000) · 안심귀갓길 시설·서비스 · AED · 소방용수(12만) · 견인보관소 · 공중화장실 · 안심택배함 · 치매안심센터 — `r/<구>/safety.json` · `tools/region/safety-bake.py fetch|build`. 그 층을 켜면 화면에 걸린 구를 받아 서초와 같은 배열에 더한다(같은 자리는 건너뜀 · 서초 구 파일은 안 받는다). 반경 분석에 「안전」 줄(카메라·보호구역 수). `dot()` 은 화면 밖 점을 그리지 않는다(서울 전역 자료).
* **굽는 차례**: dong-bake build → trdar-bake build → store-bake build → transit-bake → safety-bake build — 앞의 것이 r/index.json 을 다시 써도 dong-bake 는 이제 다른 굽기가 적은 바이트·층을 남긴다.
* 실시간 인파·카드(`live-seocho.json`)는 v0.10.95 부터 **서울 121장소 전부**(약 1MB · `flow-bake.py` 의 `LIVE_BBOX`) — 첫 그림 뒤에 읽는다(`livePrep`). 3시간마다 갱신 예약 작업 그대로.
* 층 `taas10`(v0.10.96) = 서울 25개 구 TAAS 사고 2016~2025 **361,140건**(100m 칸 34,090 · 사망사고 2,485건 한 건씩) — `r/<구>/taas10.json` · `tools/region/taas10-bake.py`(입력은 TAAS 화면 안에서 모은 `taas10_raw.json`). 사고 10년·사망사고 10년 층을 켜면 화면에 걸린 구를 받는다(서초는 기존 파일 우선 — 다시 모은 서초 값이 기존과 칸 2,113·사망 122·22,546건으로 같다). 반경 분석에 「교통사고 10년」 줄·해마다 막대.
* 층 `season`(v0.10.98) = 서울 계절 위험 — `tools/region/season-bake.py`(원본 season-bake 를 서울 상자·바탕 조각 길(data/base/t)로 돌려 구마다 `r/<구>/season.json` · **서초 둘레 상자(126.935~127.135 · 37.395~37.535) 안은 기존 season-seocho 가 맡고 구 파일에서 뺀다** — 강남·서초 구 파일은 없다). 침수 흔적 32,790(20m 칸) · 침수 이력 길 12,070 조각 · 지하차도 395(침수 흔적 가까운 90) · 제설함 10,435 · 전진기지 86 · 열선 673 길. 계절 층을 켜면 화면에 걸린 구를 받는다(`seaLoad` · 서초 판이 SEA 를 만든 뒤) · 카드는 그 파일의 원인·동 목록 · 화면 밖 선은 안 그린다.
* **경기(⑧ · v0.10.99~)**: 행정동(SGIS · 경기 602동 · 일반구가 있는 시는 일반구 단위 47곳 · index 항목에 `sido: '41'`) · 주민 연령(행안부 · `sltOrgLvl1=4100000000`) · 단속 카메라(표준데이터 `ctprvnNm=경기도`) · 어린이보호구역(표준데이터 전국을 받아 경기 상자로 거름 — 구청 insttCode 목록을 모른다). **생활인구·카드 매출·상권분석·안심귀갓길 등 서울시 자료는 경기에 없다**(동 카드에 밝힘). 📥 지역 받기의 경기 시(SGIS 시 단위)는 그 시의 일반구 파일을 모두 묶는다(`rFilesFor` — 고른 구는 dongx·상권·점포·승하차·안전·사고·계절 파일까지).
* **📋 동 현황**(v0.10.100 · 층 `fac` · `r/<구>/fac.json` 72곳 합계 3.1MB · 서초도 이 파일): 동 카드(서초·서울·경기) 아래 — 👫 남녀(주민등록 2026.9 · 연령대별 남녀 피라미드) · 아이·어르신·교육(어린이집 정원·현원 · 유치원 · 초중고 · 경로당 · 입시·교과학원/학원 전체) · 어린이집 해마다 2016~2026(인가일~폐지일로 셈 · 폐지 5,504곳 포함) · 유치원 해마다 2014~2025(교육청 위경도 파일) · 🏪 상권 — 점포(업종 합) 분기 추이 · 이 동의 상권 목록(처음 1년 ↔ 최근 1년 매출) · 상권변화지표 22분기 띠 · 「한 줄로」 판정(매출 ±10% · 점포 ±3% · 지표 — 설계값). **상권분석서비스는 2021년부터** — 그 앞 10년 상권 값은 없다고 카드에 밝힌다. 새 층 🧓 경로당(서울시 3,644곳 중 OSM 도로명주소·이름으로 자리를 잡은 1,056곳 — 나머지는 빠짐을 밝힘) · 👶 어린이집(서울시 · 운영 중 3,901 · 시청 기본 좌표 40·빈 좌표 628 버림) · 🎒 유치원(교육청 2025 · 706) · 📚 입시·교과학원(상가정보 P10501 · 서울+경기 36,474). 받기 `tools/region/fac-fetch.py`(경로당 OdsnBuildingInfo · 어린이집 ChildCareInfo · 상권변화지표-행정동 VwsmAdstrdIxQq · 점포-행정동 VwsmAdstrdStorW 77.5만 줄) + 교육청 CSV(data.go.kr 15152021 파일 받기) + `tools/region/addr_scan.py`(pbf) → 굽기 `tools/region/fac-bake.py`(**dong-bake·store-bake·trdar-bake 다음**). 남녀는 행안부 조회에 `gender=gender` 를 켠 `jumin_<월>g.json`.
* **경기 임대료**(v0.10.101): 부동산원 표 다섯의 경기 상권 73곳 중 70곳(`07_API키/out/rent/gg_rone_rent.json` → `rent-bake.py` 의 `MAPG`) — 자리 = OSM 역·시청·동·읍 이름 점(`ggnames.json` · `tools/region/ggname_scan.py`)을 그 시 시청에서 가까운 것으로 고름(how 칸에 어느 이름인지). 아주대삼거리·팔달문로터리·상중동은 OSM 이름이 없어 뺐다. 상가 카드의 평균 줄은 경기 상권이면 「경기 평균」.
* **경로당 자리 맞춤**(v0.10.101): 29% → **79%**(2,885/3,644) — 구 이름 없는 주소·띄어 쓴 길 이름(「구로동로 22길」) 정리 + 번호가 OSM 에 없으면 같은 길 ±20번 안 가까운 번호로 **근사**(1,238곳 · 이 방법을 정확한 주소 3,603개로 시험 — 오차 가운데 38m · 90% 125m 안 · 카드에 「근사」).
* **경기 고르게(v0.10.102)**: ① 경기 교통사고 10년 — TAAS 를 시 단위(법정동 앞 4자리 31곳) × 해 × 등급 1,240번 조회 → **525,544건**(100m 칸 100,557 · 사망사고 5,859) · 칸 가운데가 든 시군구 경계로 47곳에 나눔(`taas10-bake.py <원자료> 경기` · 경계 밖 799건). ⚠ TAAS 요청에는 **`pageIndex:1` 이 있어야** 한다(없으면 세션 만료 HTML 500) · 한 호출 45초 제한이라 페이지 안에서 일꾼 6개로 돌리고 결과를 묻는다. ② 경기 어린이집 — 경기데이터드림 `ChildHouse`(2025-07-25 · 17,873줄 · 인가일·폐지일·좌표 → 운영 중 약 8,200 · 2016~2025 해마다) ③ 경기 유치원 — 경기도교육청 공시 `Kndrgrschoolstus`(좌표·주소 없음) → 같은 이름의 어린이보호구역 대상 시설·OSM 점 · 병설유치원은 그 학교 자리 · 이름이 여럿이면 교육지원청이 맡는 시로 거름 → 1,771곳 중 1,283(72%) ④ 학교 층 `edu`(🏫 초·중·고·대학) — 서울 초중고 = 교육청 2025(공식), 경기 초·특수 = 보호구역 + OSM, 경기 중·고·대학·서울 대학 = OSM(`edu_scan.py`) · 같은 이름(시 이름·분교장 표기 정리) 1.5km 안 / 다른 출처끼리 같은 갈래 150m 안은 한 학교 → 서울 초 609·중 391·고 319·대학 119 · 경기 초 1,447·중 607·고 486·대학 120 ⑤ 경기 경로당 — 공식 좌표 목록을 못 찾아 OSM 이름 점만(239). ⚠ 경기 OpenAPI 는 브라우저 User-Agent 가 아니면 「보안 정책에 의해 차단」.
* 아직 서초 둘레만: 다발지 10년 · 교차로 사고(교차로 이름 목록이 서초 간선 25곳뿐).
* 받기·굽기: `py -3.12 -X utf8 tools/region/dong-bake.py fetch`(받은 것은 07_API키/out/region/ 에 두고 건너뜀) → `build`. 「📥 지역 받기」에서 서울 구를 고르면 그 구의 dong·dongx + 둘레 3km 에 걸친 서울 구의 dong 이 바탕 조각과 같은 보관함(tg-tiles)에 들어간다.

## 11. 기록할 곳
판마다 `CLAUDE.md`(v0.10.xx 절) · `ROADMAP.md` 한 줄 · `CREDITS.md` · **이 문서**. 소유자 결정(관할·공개 범위 등)은 날짜와 함께.
