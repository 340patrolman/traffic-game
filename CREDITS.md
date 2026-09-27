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

## 도시 공공데이터(v0.10.44 · 2026-09-28 수집 · 서초구 디지털 트윈 전용)
- **서울특별시 문화행사 정보**(서울 열린데이터광장 culturalEventInfo) — 서초구 + 서초 쪽 한강공원 행사·축제 329건 · 공공누리 제1유형(출처표시)
- **서울특별시 교통량 조사**(서울 열린데이터광장 VolInfo·SpotInfo) — 서초 조사 지점 7곳 시간대별(2026-09-15·16·19·20) · 공공누리 제1유형(출처표시)
- **서울특별시경찰청 「오늘의 주요집회」**(www.smpa.go.kr 집회/시위 게시판 본문) — 관할 서초 2026-07-20~09-28 · 15건(주최자 이름 없음 · 신고 인원은 신고값)
- **전국무인교통단속카메라표준데이터**(공공데이터포털 · 행정안전부 표준데이터 · 서초구분 222대 · 기준일 2026-04-06)
- 자리는 **OpenStreetMap contributors (ODbL)** 도로 중심선으로 고무판 변환해 옮긴다. 정곡빌딩·CU양재역점은 OSM 에 없어 가까운 자리로 둔 **근사**다.
