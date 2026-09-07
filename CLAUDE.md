# SEOUL PATROL (traffic-game) — 모든 세션이 먼저 읽는 파일

브라우저에서 바로 실행되는 3인칭 교통경찰 순찰 게임. 1순위는 「재미있는 주행」, 그 위에
「위반 차량을 발견해 우측에 정차시켜 단속하는 일」을 얹는다. 교육용으로도 쓰이지만 교육으로 한정하지 않는다.

## 절대 규칙

* 빌드 도구 없음. npm·Vite·번들러 금지. `index.html`을 열면 바로 실행된다. GitHub Pages(main / root)에 그대로 올린다.
* 의존성은 three.js 1개만 `lib/`에 vendored. CDN 로드 금지(오프라인 실행).
* 외부 3D 모델·이미지·오디오 파일 0개. 건물·차량·사람·표지·사운드는 전부 코드로 생성(절차형 지오메트리 + Web Audio 합성).
* 서버 0대. 네트워크 요청 0. 진행 저장은 localStorage만 쓰고 키는 반드시 `tg_` 접두사. `tb_`로 시작하는 키는 읽지도 쓰지도 않는다(같은 origin에 다른 앱이 있다).
* 「GTA」「Grand Theft Auto」 및 그 게임의 지명·차량명·로고·서체·UI 모사 금지. 실존 자동차 브랜드명 금지. 게임 이름은 네가 새로 짓는다.
* 총기·전투·차량 파괴 쇼 없음. 플레이어는 경찰이다. 사람을 치면 큰 감점과 즉시 임무 실패.
* 폰 우선. 세로·가로 모두 대응, 터치 조작이 1급 시민. 키보드·마우스는 부가. 중급 안드로이드 폰에서 30fps를 지키고, 프레임이 떨어지면 교통량·행인·그림자를 자동으로 줄인다(이미 화면에 있는 것은 지우지 않고 새로 스폰하는 양을 줄이는 방식).
* 법령 수치(범칙금·벌점·조문 번호)는 코드에 하드코딩하지 않는다. `data/laws.json` 한 곳에 두고, 확인되지 않은 값은 `"verified": false`로 표시해 화면에 「확인 중」으로 보인다. 네가 기억으로 채운 숫자를 확정값으로 표시하지 마라. 정확한 값은 소유자가 별표 원문으로 대조해 채운다.
* 한 번에 한 층만 고친다. 주행 물리와 단속 로직을 같은 커밋에서 동시에 바꾸지 않는다.
* 작업 끝에는 반드시 직접 실행해 확인하고, 콘솔 에러 0을 확인한 뒤 보고한다.

## 구조 (v0.2 기준)

* 모듈 시스템 없음. 모든 스크립트는 고전 `<script>`로 순서대로 로드되고 전역 `TG` 네임스페이스에 붙는다
  (file:// 로 열어도 실행되어야 하므로 ES module·importmap 금지).
* `js/config.js` 수치 → `js/city.js` 도로망(격자 노드 + `frameAt`: 어디서든 차로 좌표·제한속도·갓길을 주는 단일 창구)
  → `js/world.js` 도심 메시 → `js/terrain.js` 지형 높이 함수·순환 고속도로(ring)·연결로(connE/connN)·램프 4개·강·바다·하늘·나무
  → `js/signals.js` 신호 → `js/vehmesh.js` 차량 실루엣 로프트 → `js/vehicle.js` 플레이어 물리 → `js/traffic.js` AI(격자 기동 S/R/L/X + 링크 경로 + 위반)
  → `js/peds.js` 행인(관절·무단횡단) → `js/enforcement.js` 목격→정차→고지 → `js/hud.js` → `js/input.js` 조이스틱·버튼·키보드
  → `js/perf.js` 밀도 자동 조절 → `js/save.js` → `js/main.js` 루프·규칙·인트로·테스트 훅.
* 좌표 관례: heading h → forward = (sin h, cos h), right = (−fz, fx). 방위 0..3 = 남(+z) 동(+x) 북(−z) 서(−x). 우회전 = (d+3)%4.
* 링크 방향 A = 샘플 증가 방향. 링 A = 안쪽 차로(시계 방향), 접속부(램프)는 A 에만 붙는다(평면 교차 없음). 차로 오프셋은 진행 방향 우측 +.
* 실존 자동차 브랜드·모델명은 쓰지 않는다(소유자 규칙). 순찰차는 「서울경찰 POLICE」「112」 라벨의 백색·청색 띠 도색.
* 검증은 `?test=1` 의 `TG.test.step(초)` 로 rAF 와 무관하게 결정적으로 돌린다(숨은 탭에서도 동작). README 의 훅 목록 참고.
* 도로 폭은 도로마다 다르다(`city.halfV/halfH`, `lanesV/lanesH`; `AVENUE_V/H` 인덱스가 왕복 4차로). 정지선·횡단보도 거리는 `city.stopDist(node,d)`·`crossNear/crossFar`,
  차로 오프셋은 `city.laneOff(axis, idx, laneIdx)`, 갓길은 `city.shoulderOff`, 보도선은 `city.sideOff`. 상수를 직접 쓰지 말고 이 함수들을 쓴다.
* 확성기(PA) 안내는 `TG.audio.pa(text)` — 브라우저 내장 speechSynthesis(오프라인). 음성이 없으면 차임만 울린다. 오디오 파일은 여전히 0개.
* `data/laws.json`은 http(s)로 열었을 때 fetch로 읽는다. file:// 에서는 브라우저가 fetch를 막으므로
  범칙금·벌점 칸이 「확인 중」으로 보인다(값 복제본을 두지 않는다 — 정본은 한 곳).
* `ref/`는 참고용 clone. 커밋·배포에 포함하지 않는다(.gitignore).

## v0.6 추가(2026-09-06)

* `js/weather.js` — 날씨·시간대 5종(맑음·석양·밤·비·눈). 조명·안개·하늘색(`terrain.skyMesh`)·노면/지면 색(`TG.mats.road/ground`)·창문 불빛(`TG.mats.facade` emissive)·입자·가로등 점·전조등(SpotLight)을 한 곳에서. 그립은 `weather.grip` → `player.surfaceFactor`.
* IC 8곳: `terrain.js` 의 `ICS[]`(노드·방향·링 각도·via 점) → `conns[]`(연결로) + `ramps()`(우회전 진입 on / 진출 off). 연결로는 램프 분기점(링 접속점 42m 전)에서 끝난다 — 그 너머 스텁이 링 밑으로 들어가던 버그의 원인이었다. 분기점 너머는 지형이 링 높이로 이어지므로 차단벽을 두지 않는다.
  링 가드레일·다리 난간은 램프가 가로지르는 곳(`rampGap`)에서 비운다. 램프 다리에는 난간 충돌이 없다. `frameAt` 는 램프 옆 본선 위(합류부)에서 본선 프레임을 쓴다.
* 다리 위 `heightAt` 는 노면 높이(강 위에서 빠지지 않음). 물 복귀는 `!frame.onRoad` 일 때만. 빠짐·끼임·지도 밖은 `recoverToRoad`(일시정지 메뉴 「도로로 복귀」).
* 격자 스텁 끝 12곳은 낮은 벽 + 황·흑 차단봉(`city.walls[].stub`, world.js 가 그림).
* 모드(`G.mode`): patrol / free(랩 타임 = 링 인덱스 0 통과) / circuit(`terrain.circuit`, 교통 0, `coachUpdate` 코칭) / study(`js/study.js` 카드, `laws.json.study12`, `G.startScenario(id)`).
* 차량: `vehmesh.js` 단면 로프트(13점 × 정점 법선), 경찰 띠·황색 선은 단면 색 띠. 실내 `interior(T)`·`layout(T)` 는 눈 기준. `vehicle.js` 디지털 계기판·내비(미니맵 캔버스)·MDT(`player.mdtInfo` 는 main 이 채움).
* 캐시: 스크립트 주소 `?v=X`(index.html·sw.js 둘 다) + sw CACHE 이름을 배포 때마다 올린다. GitHub Pages 는 max-age=600 이라 안 올리면 새 HTML 이 옛 JS 를 부른다(키보드 먹통 원인).
* 검증: `_verify_tail.js`(기능 전체) · `_ic_tail.js`(IC 32구간 + 링 자동 조종 주행) · `_probe_tail.js`(도로 끝) · `_shot_tail.js`(장면 스크린샷). `?norender=1` 로 헤드리스에서 빠르게 돈다. 브라우저 페인이 숨겨지면 rAF 가 멈추므로 `step()` 만 믿는다.

## v0.6.3~ 추가(2026-09-06 밤)

* 지도 = 강남·서초 축약(`city.roadNamesV/H`, `hName(j,x)` 로 서초대로|테헤란로, `LANDMARK_BLOCKS`, `inSchoolZone`, `hasStub`). 모든 격자 도로 4차로(`AVENUE_V/H` 전부). 한강은 `riverZ(x)`(북쪽 동서), `hBase` 가 강 둔치를 평탄화. 스텁은 IC 8곳만.
* IC 이름·안내표지: `terrain.js` `IC_INFO`, `gantry(L,i,textA,textB)`(A/B 방향 글 따로), `TG.tex.hwSign('줄1|줄2')`.
* 순찰차 도색은 데칼: `TG.tex.liverySide(flip)/liveryHood()` + `vehmesh.sideDecal/hoodDecal`(DoubleSide 필수, 로프트 띠는 흰색).
* 차내: 눈은 `wsBase − 0.95`, 카메라 near 0.12(핸들·손). 핸들 그룹 `steer3d` 에 손·소매 포함.
* 키보드: `input.js` `codeOf(e)` — `e.code` 가 비면 `e.key`(한글 자모 포함)로 복원. 방향지시등 `Comma/Period`, 주행 모드 `KeyN`, 미니맵 `Equal/Minus`.
* 교통 AI: `car.trait`(phone/litter/animal), `car.signal`·깜빡이, 4차로 차로 변경(`lcShift` 를 `car.extra` 로 반영, `noSignalViolator` → 'nosignal', 정지선 32m 안 → 'solidline'), `lcForce` 는 테스트용. `flag(car,type,node,seen)` 은 목격 없이도 기록(퀴즈 정답 근거).
* 플레이어: `player.signal`, 차로 변경 판정(`checkRules` 8-2, 앞 교차로 정지선 30m 안 = 실선), 감속 안내(8-3, `hud.hintNow`), `driveMode` sport 배율, `windLat`(강풍).
* 날씨 `auto`(기기 시계·달)/`random`/`windy`. 실제 기상 연동은 「네트워크 0」 규칙상 하지 않는다.

## 확인 절차

`index.html`을 브라우저로 연다(파일 또는 정적 서버). 콘솔에 `[TG]` 로그 외 에러가 없어야 한다.
`?stress=1`을 붙이면 교통량 최대 + 프레임 저하 시뮬레이션 로그(`[perf]`)가 찍힌다.
`?test=1`을 붙이면 `TG.test.*` 자동 확인 훅이 활성화된다(README 참고).

## v0.7.2 추가(2026-09-07) — 보행자 모드 · 게임패드

* 모드 `walk`(🚶 보행자 체험): `js/walker.js` `TG.Walker`(도보 경찰관 메시·카메라 기준 이동·목적지 빛기둥) + `TG.walkerPlace(city, signals, x, z)`(보도/횡단보도/차도/교차로 판정).
  main.js `startWalk/walkRules/walkCamera/walkUpdate` — 순찰차는 강남대로 갓길에 세워 두고 걷는다. `traffic.player`·`peds.player`·`peds.walker` 를 walker 로 바꿔 차량 AI 가 보행자로 보고 선다
  (walker 는 `vF`·`len`·`telemetry.speed` 등 차량 AI 가 읽는 필드를 갖는다). 규칙: 적색 보행 신호에 횡단보도 진입 = `walkRed`(제5조), 횡단보도 밖 차도 = `jaywalk`(제10조), 녹색 진입 후 반대편 보도 = `safeCross`, 모퉁이 목적지 8곳 `arrive`. 차에 닿으면 즉시 종료.
* 보행 신호등: `signals.pedRemain(node, crossAxis)` 잔여 시간, 끝 3초 전 녹색 깜빡임, `TG.tex.pedHead(walk, n)` 서 있는/걷는 사람 픽토그램 + 잔여 초 숫자. HUD `section` 에 앞 횡단보도의 보행 신호·잔여 초.
* 조작 배치 `settings.ctl` stick|pad: `body.padctl` 이면 `#pad`(십자키 `data-btn` + △○×□·L1/R1·SELECT/START `data-key` → 키 핸들러 호출) 를 쓰고 스틱·버튼을 숨긴다. 설명 창 `#ctlHelp`(`G.showCtlHelp`, 게임 중엔 일시정지 사유 'help').
* 실물 게임패드: `input.pollGamepad()` 표준 배치(왼쪽 스틱 조향·RT/A 가속·LT/B 브레이크·X 단속·Y 앰프·L1/R1 깜빡이·십자=방향키·Start=Esc·Select=시점·L3 경광등·R3 주행 모드). 연결 시 `input.onGamepad` 로 안내. `readMove()` 가 보행자 이동 벡터(스틱·십자·패드 왼쪽 스틱·Shift/A 달리기).
