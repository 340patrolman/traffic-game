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

## v0.7.3 추가(2026-09-07) — 12항목 소재 완성 · 건널목 · 침수 · 어린이 교실 · 도보 단속

* 교통 AI 습관 추가(`traffic.js` makeCar `trait`): `drunk`(차로 안 비틀거림 `car.weave` → extra, 목격 5초 → 'drunk'), `overtake`(느린 앞차를 우측 차로로 추월 → 'overtake', 랜덤 차로 변경은 이 습관 차량엔 없음), `sidewalk`(30초 주기 7초 보도 주행 → edgeRider 재사용, 'sidewalk'),
  트럭 `cargo`(짐칸 상자 3개, 15~25초마다 낙하 → litters 에 life 20초, 'cargo'), 버스 `door`(열린 문 + 문가 승객, 달리며 3초 목격 → 'passenger'). `noLicense`(8%)는 고지 완료 때 MDT 면허 조회로만 드러난다(+15).
  `spawn(opts)` 는 `trait`·`noLicense`·`type`·`color` 를 makeCar 로 넘긴다(전엔 버려졌다 — 체험 장면이 안 되던 원인).
* 철길건널목 `js/rail.js` `TG.Rail(scene, terrain, link, idx)`: 서초대로 연장(`conns[3]`) 샘플 22. 주기 58초(열림 38 → 경보 3 → 닫힘 17, 열차 통과). `approach(car, cur)`(AI: 정지선, 위반 성향 70% 통과 → 'railroad'), `distFor(x,z,h)`(플레이어: 통과 시 −10, 열려 있어도 일시정지 안내), `forceClose/forceOpen`(테스트·체험). 경보종 `TG.audio.bell`.
* 양재천(`terrain.yjZ`, `river()` 두 번째 항, 남부순환로 남쪽 z≈356) + 산책로. 비(`weather.set('rain')`) → `terrain.setFlood(true)`: 수면 +1.2m(양재천·한강), `isWater` 임계 상승(둔치·산책로 침수 → 빠지면 복귀), 잠수교 통제 표지·차단봉(`jamsuGroup`), 산책로 「통제」 표지.
  잠수교 낮은 상판은 강을 건너는 첫 연결로(`terrain.jamsu.link`, 축약 지도에선 한남대교) 아래 −0.55m.
* 모드 `kid`(🧒 어린이 보행 교실): `TG.Walker(..., {kid:true})` 작은 몸·노란 모자·책가방, 학교 블록 모퉁이 4곳(학교 정문→놀이터→문방구→우리 집). 감점 없음, 횡단마다 별(초록불 1 + 멈춤 0.8초 1 + ✋ 손 들기 1). `kidStep()` 단계 칩(`#kidSteps`), `kidVoice()` 쉬운 말 음성, `#btnHand`(G 키) 손 들기, `walker.raiseHand`.
* 도보 단속: walk 모드에서 위반 차량 터치/단속 버튼 → 퀴즈 → 정답이면 `enforcement` 가 수신호 정차(`onFoot()`: 경광등 조건 없음, 운전석 옆 3.6m 안에 서면 고지 완료). enforcement 는 `game.actor()` 로 걷는 경찰관을 본다.
* 타이틀 정리: 부제 「서울교통 순찰근무」, 모드 6개만 보이고 차량·시점·날씨·조작은 `<details class="more">` 안. 설정 v3: 차량 `random`(`carSpec()`), 날씨 `auto` 기본. laws.json 에 overtake·railroad·license·drunk·sidewalk·passenger·cargo(모두 verified:false), study12 7개에 scene 연결.

## v0.7.4 추가(2026-09-07 밤) — 캐릭터 리그 · 홍보 페이지

* `js/character.js` `TG.Character.build('officer'|'kid'|'civilian', opts)` → 관절 리그(목·어깨·팔꿈치·엉덩이·무릎 9관절, 얼굴·정모/모자·조끼·「POLICE」 라벨·장갑·신발·책가방). `animate(rig, {speed, moving, hand, gesture:'stop'|'go'|'wave', look, lookScan}, dt)` 가 걷기(무릎·팔꿈치·몸통 흔들림·숨쉬기)·손 들기·수신호·시선·두리번을 만든다.
  `TG.Character.lite(opts)` 는 행인용(메시 5개, 얼굴·치마·가방·모자) — `peds.js` 가 쓴다(limbs 4개 API 유지, 발 높이 0.02). GeoBuilder 에 `sphere()` 추가.
* `walker.js` 는 리그를 쓴다(`walker.rig`, `gesture`, `look`, `lookScan`). main `walkUpdate` 가 수신호(정차 유도 중 stop, 풀 때 go)와 시선(대상 차량)을 넣는다.
* 음성: `TG.audio.say(text, {kind:'officer'|'kid'|'pa'|'narrator', queue})` — 한국어 목소리 자동 선택(Google/Neural 우선), 화자별 높낮이. `pa()` 는 say 를 쓴다. main `LINES`/`pickLine` 으로 같은 뜻의 말을 돌려 쓴다(kidVoice 키: stop/hand/wait/go/red/green/road/good1~3, kidSay 'kidOk').
* 홍보 페이지 `promo.html` + `js/promo.js`: 게임 본체 없이(main.js·hud·input 미포함) 같은 도시에서 경찰관·어린이가 「횡단보도 5원칙」을 50초 루프로 시연(자막·음성·차량 정지·마지막 QR 카드). `?test=1` 로 헤드리스 검증. `js/qr.js` `TG.qr.encode/draw`(티북 QR 과 같은 인코더).
* 랜드마크 추가: `'0,1': 'terminal'`(고속버스터미널) · `'0,2': 'gu'`(서초구청) — world.js 에 그리기.

## v0.7.5 추가(2026-09-07 밤) — 게임 감각·효과음·표정·동행 경찰관

* 효과음 팩(`audio.js`, 전부 합성): `footstep(run, surface)`(왼발·오른발 음색 다름) · `tick(on)`(방향지시등 릴레이) · `crossSignal('cuckoo'|'cricket')`(횡단보도 음향신호기: 남북 뻐꾸기·동서 귀뚜라미) · `jingle(n)`(별·정답 아르페지오) · `pop()`(점수) · `whoosh()`(모드 전환) · `horn()` · `shutter()`(위반 포착) · `rain(on)`(빗소리 루프) · `bell()`. `TG.audio.speaking` 은 지금 말하는 화자(officer/kid/narrator/pa).
* 표정(`character.js`): 눈·입은 별도 메시. 3~6초마다 깜빡임, `talking` 이면 입이 열렸다 닫히고, `smile` 이면 입이 넓어진다. `TG.Character.actor(scene, terrain, kind, x, z, h)` 자율 배우(goTo/face/lookAtPos/gesture/smile, `update(dt, talking)`) — 홍보 장면과 어린이 교실 동행 경찰관이 같이 쓴다.
* main: `addScore` → `hud.pop`(떠오르는 점수)+`pop` 소리, 위반 목격 → `hud.flash`+셔터+`G.punch`(FOV 펀치), 충돌 → `G.shake`(`camFx(dt)` 가 두 카메라 끝에서 적용), 깜빡이 릴레이 소리, 비 오면 빗소리, 모드 버튼 휙 소리, 출동 버튼 맥동(CSS).
  걷기 모드: 발소리(`walker.rig.ph` 반 바퀴마다, `walk.onRoad` 면 노면 소리), 앞 횡단보도가 보행 녹색이면 음향신호기(`walk.greenAxis`), 별 획득 시 `hud.burst('⭐')`+`jingle`+웃음(`walk.smileT`).
  어린이 교실 `walk.officer`(동행 교통경찰관): 아이 왼쪽 뒤 1.3m 를 따라 걷고, 아이가 건널 땐 「정지」 수신호, 별을 따면 손 흔들며 웃는다. 안내 음성(narrator)이 나올 때 입이 움직인다. start() 에서 dispose.

## v0.7.6 추가(2026-09-08) — 보행 신호등 현실화 · 차량 감각 · 결과 카드 · 경적 · 홍보 장면 2

* 보행 신호등(`world.js`): 횡단보도마다 양쪽 연석에 하나씩(노드당 8개), 기둥 3m·함체·차양·작동 버튼함, 머리(잔여시간)는 길 건너편을 향한다(`rotation.y = atan2(-ps*r, ...)`). `world.heads` 의 ped 항목이 2배가 되었다(signals.update 가 그대로 돈다).
* `js/vfx.js` `TG.VFX(scene)`: 입자 풀(THREE.Points 160개, `puff(x,y,z,vx,vy,vz,sec,size)`) + `attachFlares(mesh,w,l,y)`(가산 스프라이트 2개). main: 내연기관 급가속 배기(속도 <9), 미끄러짐 타이어 연기(`telemetry.skid>0.35`), 밤이면 전조등 플레어(추적 시점만). 텍스처 `TG.tex.smoke/flare`.
* 결과 카드(`hud.showEnd`): `stats.stars`(1~5)·`stats.badges`(무사고·단속왕·정확한 판단·보행자 지킴이·신호·속도 준수·모범 보행 / 어린이: 횡단보도 박사·무사히 집까지·안전 보행) — `endShift` 가 계산. 4별 이상이면 팡파르.
* AI 경적(`traffic.js`): 앞차가 3~7초 서 있으면 성질 급한 운전자가 울린다(플레이어 45m 안에서만 소리), 보행자 급제동 때 짧은 경적.
* 타이틀: 카메라가 숨 쉬듯 오르내리고 제목 글자에 반짝임(CSS shimmer).
* 홍보 페이지 장면 2 「이륜차 보도 통행」(`MOTO_STEPS`, `?scene=moto`): 동쪽 보도로 북상하는 오토바이(edgeRider)를 경찰관이 수신호로 세운다. 장면 1(50초) → 장면 2(30초) 번갈아 자동 재생. 헤드리스 테스트는 82초를 돌려 두 장면을 거친다.

## v0.7.7(2026-09-08) — 보행 조작·보행 신호 시간·걸음걸이

* 신호 주기: `SIG_GREEN 24 · SIG_YELLOW 3 · SIG_ALLRED 1.5`, `PED_WALK 20`(왕복 4차로 20m 를 어린이 걸음 1.25m/s 로 건널 시간). 주기 57초.
* 보행 조작(소유자: 「살짝 밀면 살짝 휘어야, 시야가 확 돌면 MMORPG 유저가 욕한다」): `walker.update` 회전은 최대 ≈3.2rad/s·작은 각은 느리게, 3인칭 카메라 방향 `walk.cyaw` 는 헤딩을 1.3rad/s(급회전 3.0, 정지 0.5)로 따라간다. 이동 기준은 실제 카메라 방향 `walk.camYaw`(walkCamera 반환값) 그대로.
* 달리기는 토글 버튼 `#btnRun`(🚶/🏃, `input.runToggle`)·Shift·패드 A 로만. 스틱 끝까지 밀어도 걷는다. 어린이 교실: 횡단보도에서 뛰면 「뛰지 말고 걸어요」 + 걷기 ✗(별 −1, 최소 1).
* 걸음걸이: 팔은 반대쪽 다리와 함께(`character.js` lx = sin(ph)·rx = −sin(ph)). 이전엔 같은 쪽 팔·다리가 같이 나갔다.

## v0.7.8(2026-09-08) — 서초구 지명 · 경부고속도로 · 차량 팝인 방지

* 도로명(`city.js`): 남북 반포대로·서초중앙로·강남대로·논현로·언주로 / 동서 신반포로·사평대로·서초대로|테헤란로·효령로·남부순환로. 교차로 이름 `NODE_NAMES`(고속터미널·서울성모병원·서초역·교대역·강남역·역삼역·반포·서초3동·남부터미널 사거리). 랜드마크 terminal 은 '0,0'(신반포로·사평대로 사이). 미니맵에 역 이름.
* 경부고속도로(`terrain.js` ICS S)는 `kind: 'highway'`(편도 3차로 + 1차로 버스전용, 100km/h). 버스는 1차로로 22m/s 로 달린다. 연결로 이름: NE 언주로·청담대교 방향, SW 반포대로 연장·양재 방향.
* 차량 팝인/팝아웃(`traffic.js`): 링크 스폰은 플레이어 앞 시야 140m 안에서 하지 않고, 시야 앞의 차는 despawn 거리의 1.8배까지 남긴다(눈앞에서 사라졌다 나타나던 현상).

## v0.7.9(2026-09-09) — 경찰 대응 원칙(추격은 최후의 수단) · PM · 탑승자 사람 리그

* `js/response.js` `TG.Response(game)` — 등급: **A**(음주 의심·무면허·수배차량) 무전 전파 후 정차 유도·추격 허용 / **B**(일반 차량 위반) 정차 유도 단속 / **C**(이륜차·자전거·PM 단순 위반) **추격 금지 → 📹 영상 + 📡 무전**.
  `blackbox(car)`(B 12점·C 25점, 위반 표시 해제) · `radio()`(8점, 등급 C 는 6~10초 뒤 인접 순찰차 인계 +10, 등급 A 는 `car.pursuitOk` = 추격 정당화, 수배차량은 이때 드러난다) · `update(dt)`(등급 C 를 사이렌·38km/h·30m 안에서 5.5초 쫓으면 `pursuitBan` −15, 등급 A 를 무전 없이 8초 쫓으면 `noRadio` −8, 보행자 5m 근접 경고) · `adviceFor(car)`(MDT 노란 줄).
  버튼 `#btnCam`(B 키) · `#btnRadio`(T 키). enforcement 퀴즈 정답 뒤 등급 C 는 정차 유도 대신 영상 단속으로 간다. 결과 카드에 영상·무전·인계 줄과 배지(📹 원칙대로 대응 · 📡 상황 전파).
* 개인형 이동장치(PM, 전동킥보드): `vehmesh TYPES.pm`(발판·T핸들), `traffic` isPM(보도 통행 `pm`, 헬멧 미착용 `pmHelmet`, 2인 탑승 `pmTwo` — 보도 통행이 기록돼 있으면 덮지 않는다), laws.json 3항목(모두 확인 중), 퀴즈 보기, 앰프 문구.
* 이륜차·자전거·PM 탑승자는 사람 리그로 태운다: `vehmesh twoWheeler(..., {noRider:true})` + `TG.Character.build('civilian', {helmet})` + `TG.Character.pose(rig, 'ride'|'stand')`. 몸통 메시 원점이 발끝이라 `parts.torso.rotation.x` 를 크게 주면 상체가 꺾인다 — 자세는 관절(엉덩이·무릎·어깨·목)로만 만든다.
* 수배차량 `car.wanted`(승용 2%): 겉보기 표시 없음, 📡 무전 조회로 드러나고 그때부터 추격이 정당해진다.

## v0.8.1(2026-09-09) — 도로 차로 수(서초구 실측) · 8차로 고속도로 · 연결부 · 미니맵 · 고장차량·사고 · 경찰 표장

* 도로마다 편도 차로 수(`config.LANES_V/H`, `LANE_W 3.5`): 반포대로·강남대로·남부순환로 왕복 8차로, 서초대로(테헤란로) 왕복 6차로, 나머지 왕복 4차로.
  `city.halfOf = 3 + 3.5n`, `laneOff(axis,idx,k) = 2.0 + 3.5k`, `shoulderOff = 3.5n + 1.65`, `laneIndexAt(axis,idx,lateral)`. `AVENUE_V/H`·`ROAD_HALF4` 는 더 쓰지 않는다.
  world.js 차로 점선은 n−1 개, 가장자리 실선은 `0.25+3.5n`, 신호등 암 길이는 차로 수에 맞춘다. traffic 차로 변경은 옆 차로 한 칸씩, 우회전은 가장 바깥 차로에서만. main 8-2 는 `city.laneIndexAt` 로 판정.
* 고속도로 왕복 8차로(`HW_LANES` 4개, `HW_HALF 17`, `HW_SHOULDER 15.65`). **버스전용차로는 경부고속도로만**(`link.busLane`) — 올림픽대로·순환고속도로에는 없다. 차로 배정·위반 판정·청색 실선 모두 이 플래그를 본다. 버스는 전용차로에서 정차하지 않는다(kind 'highway' 순항).
* 연결부 꺾임 수정 2건: IC 연결로 시작점을 `city.EXT`(가장 넓은 도로 기준 스텁 길이)로 통일해 도시 스텁 끝과 정확히 맞물리게 하고, 도시에서 곧게 나가는 제어점 길이를 첫 경유점 거리의 45%로 제한(고정 45m 면 경유점을 지나쳐 스플라인이 되돌아 꺾였다 — 차가 튕겨 나가던 원인). IC 자동 주행 32/32·AI 8/8.
* 미니맵 현재 위치: 맥동 고리 + 어두운 원 + 흰 테두리 화살표 + 왼쪽 아래 「▲ 현재 위치」 범례(확대 변환 밖). 도로 두께는 차로 수에 비례.
* 고장차량·교통사고 현장: `traffic.spawnIncident('broken'|'crash', at)` — 갓길에 비상등만 켠 차(`mode 'incident'`) + 안전삼각대 + 라바콘 2개, 상황실 신고(`onEvent('incident')`). 처리 절차는 `response.incidentUpdate`: 경광등 ON + 현장 뒤 3~22m 정차 + 📡 무전(견인·구급 요청) → 2초 유지 → 안전조치 완료(+30), 6초 뒤 현장 정리. 순찰 근무에서 70~110초마다 하나. 결과 카드 줄·배지(🛠 현장 안전조치).
* 경찰 표장(`textures.drawEmblem`): 금색 이중 테두리·점선 고리 + 아치 글씨(「경 찰 청」·KOREAN NATIONAL POLICE AGENCY) + 참수리(각진 깃 5장 날개·갈고리 부리) + 저울 막대·접시 + 무궁화 5장 + 태극. 캔버스 512로 키웠다. 외부 이미지 파일은 여전히 0개(에셋 0 규칙) — 첨부 사진은 참고용으로만 썼다.

## v0.8.2(2026-09-09) — 교차로 근무(하차 근무): 신호기 수동 조작 1단계 · 차로 차단·꼬리 끊기 2단계

* 모드 `duty`(🚦 교차로 근무). `startDuty()`: 서울성모병원 사거리(`city.nodes[0][1]`)에 순찰차를 갓길에 **경광등 켠 채** 세우고, `TG.Walker` 로 하차해 근무한다(`onFoot()` 에 duty 포함 — 보행 카메라·조작·발소리를 그대로 쓴다). 제한 시간 `DUTY_SECONDS 420`, `TRAFFIC_MAX + 26`.
* `js/junction.js` `TG.Junction(game)` — 대기 행렬 `queueOf(node,d)`(정지선 뒤 80m, 2m/s 미만, 내 차로만), 꼬리물기 `gridlockOf(node)`(교차로 상자 안에 선 차), `stats(node)`, `dirsAvail(node)`(차가 들어오는 쪽이 있는 접근로만 — 지도 끝 노드는 3곳),
  `burst(node,d,count)` = **흐름 주입**(상류 교차로 쪽에서 1.1초마다 한 대. 스폰 최소 간격이 12m 이므로 한꺼번에 놓으면 만들어지지 않는다 — 대열은 정지선에서 다져진다), `closeLane(node,d)`(바깥 차로에 라바콘 7개 + `traffic.control.closed`), `openLanes()`, `setHand(node,d,on)`(`traffic.control.hand`), `placeBox(node,sx,sz)`(보도 위 모퉁이에서 9m — 횡단보도·보행 신호등 기둥과 겹치지 않는 자리), `nearBox`, `setBoxLamp`, `dispose()`(수동을 자동으로 되돌린다).
  채점: 10초마다 꼬리물기 0 + 최대 대기 8대 이하 → `junctionGood +15`, 꼬리물기가 이어지면 `junctionJam −6` + 6초 경고.
* `js/signals.js` 수동 조작: 교차로 고유 최소 녹색 `NODE_MIN`(성모병원 18 · 서초역 16 · 교대역 15 · 강남역 20 · 역삼역 15 · 고속터미널 16, 기본 12), **보행 최소는 어디서도 줄일 수 없다**(`Math.max(minGreen, PED_WALK + 2)`).
  `setManual/isManual/request(node,axis)/waitFor(node,axis)/manualInfo/minGreenOf`. `update` 는 수동일 때 녹색 끝에서 시계를 멈춰 **녹색을 연장**하고, 요청이 최소 시간을 채우면 황색·전적색을 거쳐 넘어간다 — 버튼을 눌러도 즉시 바뀌지 않는다.
* `js/traffic.js` `this.control = { closed: [], hand: [] }`: 수신호가 있으면 **녹색이어도 정지선 앞에 선다**(제5조), 차단한 바깥 차로는 40m 앞에서 안쪽 차로로 옮긴다(라바콘 회피). 검증: 차단 뒤 정지선 부근 바깥 차로 0대.
* UI `#dutyPanel`(제어함 3.2m 안에서만 열림, 멀어지면 닫힘): 자동/수동 스위치 · 방향별 대기 대수·꼬리물기 칸 · 「↕ 남북 녹색 N초」「↔ 동서 녹색 N초」 요청 버튼(대기 이유: 보행 신호 최소 시간 / 최소 녹색 시간 / 황색·전적색 통과) · 🚧 바깥 차로 차단 · ✋ 꼬리 끊기. 버튼 `#btnBox`(R) · ✋ 는 duty 에서 꼬리 끊기(G).
* 결과 카드 배지 `🚦 소통 확보 N회`(3회 이상, 5회 금색). `_verify_tail.js` 5o 가 제어함 거리·자동에서의 거절·최소 녹색 26초·2초 뒤 미전환·30초 뒤 전환·녹색 연장·대열 8대·차로 차단(라바콘 7)·수신호·정리까지 확인한다.

## v0.8.3(2026-09-09) — 웅장한 인트로 사운드 · 타이틀 테마

* 소유자 「인트로 화면에서 웅장한 사운드도 필요한데」 → `audio.js` 테마 확장(파일 0개 유지).
  ① `reverb()` — 컨볼루션 대신 딜레이 4개를 되먹인 콤 필터 홀(폰에서도 가볍다). 테마는 센드로 보낸다. ② 테마 버스에 `DynamicsCompressor`(합주가 뭉쳐 크게 들린다).
  ③ 금관 모티프 D–A–D–F♯: 3초에 낮게 예고, 10.55초 타이틀 순간에 옥타브 위 + 5도 화음, 12.7초 지속음(`brass(at,dur,freq,vol,pan)` = 톱니 2겹 + 사각파 + 필터 엔벨로프).
  ④ 합창 패드(사인 스택 8성 + 4.6Hz 떨림) 8.4초 진입. ⑤ 타이코 2연타·마지막 대타격 2겹(140Hz + 62Hz). ⑥ 좌우 폭(`createStereoPanner`, 없으면 게인). 길이 14.5초(인트로 15초).
* `titleTheme()`/`stopTitleTheme()` — 타이틀 화면용 16초 루프(드론 D + 0.75초 아르페지오 D–F♯–A–D + 6초마다 낮은 북, 음량 0.5). 타이틀이 무음이면 게임이 꺼진 것처럼 보인다.
  main 루프의 title 분기에서 소리가 풀리는 순간 시작하고, 출동·근무 종료에 끈다. 소리가 아직 잠겨 있으면 타이틀에도 「🔊 화면을 한 번 터치하면 소리가 납니다」를 띄운다(전에는 인트로에만 나와서 소유자가 테마를 못 들었을 수 있다).
* 헤드리스에서 소리 코드까지 실제로 돌려 확인하려면 `--autoplay-policy=no-user-gesture-required --mute-audio` 를 붙인다(그냥 돌리면 `audio running = false` 로 테마 그래프가 만들어지지 않는다).

## v0.8.4(2026-09-09) — 추격전 모드(모드 구조 = 근무 / 교차로 근무 / 추격전 / 서킷 / 자유 / 보행·어린이)

* 소유자 질문 「근무 모드 서킷 모드 추격전 뭐 이렇게」에 대한 답. 추격전은 **대응 원칙(v0.7.9)의 실습판**이다 — 빨리 달리는 재미는 있지만 이기는 방법은 난폭 운전이 아니다.
* `js/chase.js` `TG.Chase(game)`: 대상은 등급 A(수배·절도·음주 의심)뿐. `spawn()` 이 플레이어 앞 55m+ 도로에 `wanted/flee/chase` 차량을 만든다(`traffic.js` 에서 `car.flee` 는 흐름의 1.6배, 앞차·보행자 앞에서는 그대로 선다. `car.chase` 는 멀어도 despawn 하지 않는다).
* 채점(`config.SCORE`): `chaseSafe +15`(경광등 ON + 📡 전파 + 대상이 앞 + 10~42m 를 10초마다), `chaseClose −10`(8m 안 1.2초마다), `chaseReckless −25`(추격 중 차량 접촉), `chaseBreak +45`(추격 중단이 정답인 경우), `chaseCatch +60`(원칙 유지 20초 → 대상 포기·정차).
  중단이 정답인 경우: **어린이보호구역으로 도주**(자동 판정) · 차량 접촉 2회 뒤 상황실 지시(경광등 끄고 45km/h 미만으로 감속하면 중단 처리). 놓치면 무전 전파로 인계('lost').
* 감점 게이트 수정: `penalize` 는 이제 `SCORED = {patrol, walk, duty, chase}` 만 감점한다(전엔 `mode !== 'patrol' && mode !== 'walk'` 라 교차로 근무·추격전의 감점이 통째로 무시됐다). 타이머도 patrol·chase 가 카운트다운하고, `setTimerText('∞ 자유 주행')` 는 free·circuit 에만 쓴다.
* 결과 카드 배지: `🛑 중단 판단`(금) · `🚨 안전한 추격`(무사고 검거, 금) · `📏 안전거리 N회`. 교훈 줄도 결과별로 다르다.
* `_verify_tail.js` 5p: 대상 생성·8m 근접 감점·**무전 없이는 원칙 유지 시간이 쌓이지 않음**·전파 후 20초 → 검거·부수적 피해 2회 → 중단 지시·어린이보호구역 도주 → 중단(+45)·정리까지.
