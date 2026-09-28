# CREDITS — 외부에서 가져온 것

SEOUL PATROL 의 건물·차량·표지·소리는 전부 코드로 만든다. 아래만 예외다(2026-09-17 소유자 결정 「절충 — 사람 모델만, 파일 안에 심기」).
파일로 두지 않고 `js/*.js` 안에 base64 로 심었으므로 게임은 여전히 네트워크 요청 0 · 오프라인 · file:// 실행이다.

## 사람 모델

* **Characters**: "Animated Characters" by **Kenney** (www.kenney.nl) — **CC0 1.0** (퍼블릭 도메인)
  * 받은 곳: pmndrs/market-assets (github.com/pmndrs/market-assets, commit `c9cfa02`) — `info.json` 의 `license: 1` = CC0
  * 가공: Draco 압축 해제(gltf-transform copy) → 내장 텍스처 제거 → `js/humans-data.js` 에 base64 로 심음
  * 쓰는 메시: `skater-male`
* **한국형 스킨**(`police_summer` 등): 위 Kenney 스킨을 바탕으로 머리색·피부톤·복장을 다시 칠함(교통경찰 하계 근무복 — 소유자 제공 사진 기준).
  1024px JPEG 로 줄여 심음. 스킨은 CC0 원본의 2차 작업물이다.
* 정모·신호봉은 모델에 없어 코드로 만든다(`js/humans.js`).

## 라이브러리

* **three.js r128** (MIT) — `lib/three.min.js`
* **GLTFLoader.js r128** (MIT, three.js 저장소 `examples/js/loaders/GLTFLoader.js`) — `lib/GLTFLoader.js`

## 이미지

* 경찰 표장(`js/emblem.js`): 소유자가 제공한 실물 마크 — 교통안전 홍보·공익 목적(소유자 확인).

## 자료(지도·통계)

* 교통사고: 도로교통공단 교통사고분석시스템(TAAS) — 출처 표시 의무(게임 안 레이어 패널·인트로에 표기)
* 신호 주기: 경찰청 교차로계획정보(공공데이터포털) — 출처 표시 의무
* 실제 도로 형상: © OpenStreetMap contributors — ODbL
* 행정동 경계: 통계청 통계지리정보서비스(SGIS) 행정동 경계를 가공한 vuski/admdongkor(ver20260701) — 공공누리 제1유형(출처 표시) · `data/dong-seocho.json`(서초구 18개 동) · 교차로·지금 선 자리의 행정동 판정에 쓴다

## 도시 공공데이터(v0.10.44 · 2026-09-28 수집 · 서초구 디지털 트윈 전용)
- **서울특별시 문화행사 정보**(서울 열린데이터광장 culturalEventInfo) — 서초구 + 서초 쪽 한강공원 행사·축제 329건 · 공공누리 제1유형(출처표시)
- **서울특별시 교통량 조사**(서울 열린데이터광장 VolInfo·SpotInfo) — 서초 조사 지점 7곳 시간대별(2026-09-15·16·19·20) · 공공누리 제1유형(출처표시)
- **서울특별시경찰청 「오늘의 주요집회」**(www.smpa.go.kr 집회/시위 게시판 본문) — 관할 서초 2026-07-20~09-28 · 15건(주최자 이름 없음 · 신고 인원은 신고값)
- **전국무인교통단속카메라표준데이터**(공공데이터포털 · 행정안전부 표준데이터 · 서초구분 222대 · 기준일 2026-04-06)
- 자리는 **OpenStreetMap contributors (ODbL)** 도로 중심선으로 고무판 변환해 옮긴다. 정곡빌딩·CU양재역점은 OSM 에 없어 가까운 자리로 둔 **근사**다.

## 데이터 압축지도(map2d.html · v0.10.57) 공공데이터 묶음 `data/pubdata-seocho.json`
- **서울시 생활인구**(행정동 단위 · LOCAL_PEOPLE_DONG · 2026년 7월) — 평일·주말 시간대 평균. KT 통신 자료로 추정한 체류 인구
- **도로교통공단 교통사고정보 개방시스템** — 음주운전 사고다발지 · 사고위험지역(좌표 UTM-K → WGS84 변환) · 출처와 자료 링크 표시 의무
- **서울시 교통카드 승하차**(지하철 역별 · 버스 정류장별 시간대 · 2026년 6월) · 버스정류소 위치
- **서울 열린데이터광장 OpenAPI**(2026-09-28): 병의원·응급실(TbHospitalInfo) · 약국 운영시간(TbPharmacyOperateInfo) · 무더위쉼터(TbGtnHwcwP) · 한파쉼터(TbGtnCwP) · 따릉이 대여소(tbCycleStationInfo) · 공영주차장(GetParkInfo) — 공공누리 1유형(출처 표시)
- **서울 C-ITS 교차로 지도정보**(서울특별시 교통빅데이터플랫폼 · 2026-09-10) — 신호 교차로 번호·이름
- **OpenStreetMap contributors (ODbL)** — 경찰·소방·학교·편의점·은행·주차장·지하철 출입구 등 시설(서초구 경계 안 · 2026-09-28)
- CCTV 위치는 넣지 않았다 — 서울시가 보안 문제로 공개를 끝냈다(2025-12-02)

## 경찰 관서 `data/police-seocho.json`(v0.10.63)
- **경찰청_전국 지구대 파출소 주소 현황_20251231** — 공공데이터포털(data.go.kr/data/15077036) · 경찰청 범죄예방대응국 지역경찰운영과 · 이용허락범위 제한 없음 · 받은 날 2026-09-28. 이름·소속·주소만 있고 좌표가 없다
- 자리는 **OpenStreetMap contributors (ODbL)** 의 같은 도로명주소·같은 이름 경찰 관서로 잡았다(Overpass 2026-09-28). 서초2·서초3·서초·이수·방배1 파출소는 OSM 에 없어 같은 길 건물번호 사이를 이어 잡은 **근사**다
- 경찰서 청사 위치·대표번호 — 경찰민원24(2026-09-09 · T-Book PS_PTS 와 같은 값)
