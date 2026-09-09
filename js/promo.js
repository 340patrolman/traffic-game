// 홍보용 장면(promo.html): 교통경찰관과 어린이가 「횡단보도 안전하게 건너기 5가지」를 보여 준다. 게임 본체와 같은 도시·차량·신호·캐릭터를 쓰고, 조작 없이 자동으로 돈다.
// 빌드 0 · 서버 0 · 에셋 0. 자막(#sub)·단계(#step)·음성(TG.audio.say)·마지막 카드(QR). ?test=1 이면 50초를 고정 스텝으로 돌려 <pre id="VOUT"> 에 결과를 쓴다.
(function () {
  var C = TG.CONFIG, isTest = /[?&]test=1/.test(location.search), $ = function (id) { return document.getElementById(id); };
  var canvas = $('game'), renderer, scene, camera, city, world, terrain, weather, signals, traffic, peds, player;
  var actors = {}, t = 0, running = false, started = false, stepIdx = -1, lastNow = 0, loopCount = 0, spoken = {};
  var N, CX, CZ, EAST, WEST, camPos = new THREE.Vector3(), camLook = new THREE.Vector3(), camInit = false, crossT = 0, burstDone = false;

  function init() {
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: isTest });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputEncoding = THREE.sRGBEncoding; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.02;
    scene = new THREE.Scene(); camera = new THREE.PerspectiveCamera(58, 1, 0.3, 2600);
    city = TG.buildCity(C); world = TG.buildWorld(scene, city, C); terrain = TG.buildTerrain(scene, city, C); city.attachTerrain(terrain);
    weather = new TG.Weather(scene, world, terrain, city, renderer); weather.set('clear');
    signals = new TG.Signals(city, world, C);
    var rng = TG.makeRNG(41);
    traffic = new TG.Traffic(scene, city, signals, C, rng); traffic.terrain = terrain;
    peds = new TG.Peds(scene, city, signals, C, rng); traffic.peds = peds; peds.traffic = traffic;
    // 장면: 방배로(x = xs[1]) 를 건너는 횡단보도 — 학교 블록 위 노드(1,2)의 북쪽 접근로. 동쪽 보도 → 서쪽 보도
    N = city.nodes[1][2]; CX = N.x; CZ = N.z - city.crossNear(N, 0) - 1.75; EAST = CX + city.sideOff('v', 1); WEST = CX - city.sideOff('v', 1);
    actors.officer = actor('officer', EAST + 1.6, CZ - 1.7, -Math.PI / 2);   // 어린이 옆(북쪽), 카메라는 남쪽에서 본다
    actors.kid = actor('kid', EAST + 13, CZ, -Math.PI / 2);
    // 순찰차: 동쪽 보도 옆 갓길에 경광등 켜고 정차
    player = new TG.PlayerCar(scene, city, C, C.CARS.sedan); player.teleport(CX + city.shoulderOff('v', 1), CZ + 30, Math.PI); player.setSiren(true);
    traffic.player = actors.officer; peds.player = actors.officer; peds.walker = actors.kid;   // 차량 AI: 어린이는 보행자, 경찰관은 앞의 장애물로 본다
    C.PED_MAX = 10; C.TRAFFIC_MAX = 10;
    resize(); addEventListener('resize', resize);
    if (TG.qr && $('qr')) TG.qr.draw($('qr'), 'https://340patrolman.github.io/traffic-game/', 360);
    $('btnPlay').addEventListener('click', function () { running = !running; $('btnPlay').textContent = running ? '❚❚ 일시정지' : '▶ 재생'; });
    $('btnMute').addEventListener('click', function () { var m = !TG.audio.muted; TG.audio.setMuted(m); $('btnMute').textContent = m ? '🔇 소리 끔' : '🔊 소리'; if (m) try { speechSynthesis.cancel(); } catch (e) {} });
    $('btnFull').addEventListener('click', function () { var d = document.documentElement; try { if (document.fullscreenElement) document.exitFullscreen(); else d.requestFullscreen(); } catch (e) {} });
    $('tap').addEventListener('pointerdown', function () { TG.audio.resume(); $('tap').style.display = 'none'; running = true; started = true; });
    $('card').addEventListener('pointerdown', function () { if (t > STEPS[STEPS.length - 1].at + 3) restart(); });
    if (isTest) { $('tap').style.display = 'none'; running = true; started = true; runTest(); return; }
    requestAnimationFrame(loop);
  }
  function resize() { var w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.fov = h > w ? 74 : 58; camera.updateProjectionMatrix(); }
  // ---- 배우: 목표점으로 걷고, 리그를 움직인다 ----
  function actor(kind, x, z, h) { return TG.Character.actor(scene, terrain, kind, x, z, h); }
  // 발소리: 걸음 위상이 반 바퀴 돌 때마다
  function steps(a) { var ph = a.rig.ph, k = Math.floor(ph / Math.PI); if (a.stepK === undefined) a.stepK = k; if (k !== a.stepK && a.v > 0.2) { a.stepK = k; TG.audio.footstep(a.v > 2.4, 'road'); } }
  // ---- 대본: 단계마다 자막·음성·동작·카메라 ----
  var STEPS = [
    { at: 0,  step: '', sub: '횡단보도, 안전하게 건너는 다섯 가지 약속', say: '횡단보도, 안전하게 건너는 다섯 가지 약속. 서울경찰이 알려 드릴게요',
      on: function () { actors.kid.goTo(EAST + 1.3, CZ); actors.kid.hand = 0; actors.officer.gesture = 'wave'; actors.officer.face(-Math.PI / 2); },
      cam: function (u) { return [[EAST + 8, 5.5, CZ + 20], [EAST - 2, 1.2, CZ + 2]]; } },
    { at: 5,  step: '① 멈춰요', sub: '횡단보도 앞에서 딱 멈춰요', say: '하나, 멈춰요. 횡단보도 앞에서 딱 멈춰요', kid: '네!',
      on: function () { actors.officer.gesture = null; actors.officer.face(-Math.PI / 2 - 0.5); },
      cam: function () { return [[EAST + 5, 2.6, CZ + 8], [EAST + 1, 0.9, CZ]]; } },
    { at: 10, step: '② 살펴요', sub: '왼쪽, 오른쪽, 다시 왼쪽 — 차가 오는지 살펴요', say: '둘, 살펴요. 왼쪽, 오른쪽, 다시 왼쪽',
      on: function () { actors.kid.lookScan = true; },
      cam: function () { return [[EAST - 3.2, 1.35, CZ + 3.6], [EAST + 1.3, 1.0, CZ]]; } },
    { at: 15, step: '③ 손을 들어요', sub: '운전자가 잘 보이게 손을 번쩍 들어요', say: '셋, 손을 들어요. 운전자가 잘 보이게 번쩍', kid: '손 들었어요!',
      on: function () { actors.kid.lookScan = false; actors.kid.hand = 30; actors.officer.gesture = 'go'; setTimeout(function () { actors.officer.gesture = null; }, 2500); },
      cam: function () { return [[EAST - 1.5, 2.2, CZ + 5.5], [EAST + 1.0, 1.0, CZ]]; } },
    { at: 20, step: '④ 초록불을 기다려요', sub: '빨간불엔 절대 건너지 않아요 — 초록불이 될 때까지', say: '넷, 초록불을 기다려요. 빨간불엔 절대 건너지 않아요',
      on: function () {},
      cam: function () { return [[EAST + 4.5, 2.0, CZ - 4.5], [EAST - 0.5, 2.3, CZ + 1.0]]; } },
    { at: 24, step: '⑤ 초록불에 건너요', sub: '뛰지 말고 걸어서, 차를 계속 보면서 건너요', say: '다섯, 초록불에 건너요. 뛰지 말고, 차를 계속 보면서', kid: '초록불이다!',
      on: function () { actors.kid.goTo(WEST - 1.5, CZ); actors.officer.goTo(WEST - 1.0, CZ - 1.7); actors.officer.gesture = 'stop'; actors.kid.hand = 4; actors.kid.lookScan = true;
        traffic.spawn({ at: { x: CX + C.LANE2_OFF, z: CZ + 34, d: 2, node: city.nodes[1][3] }, v: 8, cruise: 8, straight: true, violator: false, laneIdx: 1, trait: null }); },
      cam: function (u) { return [[CX - 9, 3.0, CZ - 9 + u * 4], [CX - u * 8, 1.0, CZ + 1]]; } },
    { at: 36, step: '잘했어요!', sub: '이렇게 건너면 안전해요 — 서울경찰이 함께합니다', say: '참 잘했어요! 오늘도 안전하게, 서울경찰이 함께합니다',
      on: function () { actors.officer.gesture = 'wave'; actors.kid.lookScan = false; actors.kid.hand = 0; actors.officer.face(Math.PI / 2); actors.kid.face(Math.PI / 2); },
      cam: function () { return [[WEST - 8, 2.4, CZ + 6], [WEST - 1.2, 1.1, CZ + 0.8]]; } },
    { at: 41, step: '', sub: '', say: null, card: true,
      on: function () { $('card').style.display = 'flex'; actors.officer.gesture = null; },
      cam: function (u) { return [[CX + 6, 12 + u * 6, CZ + 26 + u * 6], [CX, 1, CZ]]; } },
  ];
  // ---- 장면 2: 이륜차 보도 통행 — 보도로 달려오는 오토바이를 경찰관이 세운다(?scene=moto). 카드 뒤에 자동으로 이어진다 ----
  var moto = null, MOTO_STEPS = [
    { at: 0, step: '', sub: '보도는 사람이 걷는 길이에요', say: '보도는 사람이 걷는 길. 이륜차가 보도로 달리면 안 돼요',
      on: function () { actors.kid.goTo(EAST + 2.6, CZ + 4.0); actors.officer.goTo(EAST + 1.0, CZ - 6); actors.officer.gesture = null;
        moto = traffic.spawn({ at: { x: CX + C.LANE2_OFF, z: CZ + 70, d: 2, node: city.nodes[1][3] }, v: 6, cruise: 6, straight: true, violator: false, laneIdx: 1, type: 'moto' }); if (moto) { moto.edgeRider = true; moto.edgeOff = 6.0; moto.edgeT = 0; } },
      cam: function () { return null; } },
    { at: 6, step: '🛵 보도로 달리는 이륜차', sub: '오토바이가 보도로 올라와 달려요 — 사람들이 위험해요', say: '보도로 올라온 오토바이. 걷는 사람들이 위험해요', on: function () { actors.officer.face(0); actors.kid.face(0); actors.officer.lookScan = false; }, cam: function () { return null; } },
    { at: 11, step: '✋ 정지!', sub: '교통경찰관이 수신호로 세워요', say: '정지! 교통경찰관이 손을 들어 세웁니다',   // 이륜차·킥보드는 단속 대상이다 — 어린이 칭찬 말투를 쓰지 않는다
      on: function () { actors.officer.gesture = 'stop'; if (moto) { moto.edgeRider = false; moto.cruise = 0; moto.speedK = 0; moto.violation = { type: 'motorcycle', t: traffic.time, node: null, seen: true }; } }, cam: function () { return null; } },
    { at: 17, step: '이륜차는 차도 우측으로', sub: '이륜차 보도 통행은 위반입니다 — 차도 우측 가장자리로 (도로교통법 제13조)', say: '이륜차 보도 통행은 위반입니다. 차도 우측 가장자리로 통행하십시오', on: function () { actors.officer.gesture = 'go'; }, cam: function () { return null; } },
    { at: 21, step: '자전거·킥보드는 내려서 끕니다', sub: '횡단보도에서는 내려서 끌거나 들고 걸어야 보행자입니다 (도로교통법 제13조의2 제6항)', say: '자전거와 킥보드는 횡단보도에서 내려서 끌고 걸어야 보행자가 됩니다', on: function () {}, cam: function () { return null; } },
    { at: 26, step: '', sub: '', say: null, card: true, on: function () { $('card').style.display = 'flex'; actors.officer.gesture = null; if (moto) { traffic.setYield(moto, false); moto.cruise = 6; moto.speedK = 1; } }, cam: function () { return null; } },
  ];
  var SCENE = /[?&]scene=moto/.test(location.search) ? 'moto' : 'cross', LOOP_AT = 50;
  function motoCam(u) {
    var O = actors.officer.pos, M = moto ? moto.pos : { x: EAST + 0.5, z: CZ + 30 };
    if (stepIdx <= 0) return [[EAST + 7, 4.0, CZ + 8], [EAST + 1, 1.2, CZ - 12]];
    if (stepIdx === 1) return [[M.x + 4, 2.2, M.z + 6], [M.x, 1.0, M.z]];
    if (stepIdx === 2) return [[O.x - 4.5, 1.8, O.z + 3.5], [(O.x + M.x) / 2, 1.1, (O.z + M.z) / 2]];
    if (stepIdx === 3) return [[O.x + 5, 2.4, O.z + 4], [M.x, 1.0, M.z]];
    return [[CX + 6, 12 + u * 6, CZ + 26 + u * 6], [CX, 1, CZ]];
  }
  function restart() {
    t = 0; stepIdx = -1; spoken = {}; loopCount++; burstDone = false; moto = null; $('card').style.display = 'none';
    actors.kid.pos.x = EAST + 13; actors.kid.pos.z = CZ; actors.kid.heading = -Math.PI / 2; actors.kid.target = null; actors.kid.hand = 0; actors.kid.lookScan = false;
    actors.officer.pos.x = EAST + 1.6; actors.officer.pos.z = CZ - 1.7; actors.officer.heading = -Math.PI / 2; actors.officer.target = null; actors.officer.gesture = null;
    while (traffic.cars.length) traffic.remove(traffic.cars[0]);
    camInit = false;
  }
  function setText(id, s) { var e = $(id); if (e && e.textContent !== s) { e.textContent = s; e.style.opacity = s ? 1 : 0; } }
  function update(dt) {
    t += dt;
    // 단계 진입
    var ST = SCENE === 'moto' ? MOTO_STEPS : STEPS;
    for (var i = 0; i < ST.length; i++) if (t >= ST[i].at && stepIdx < i) {
      stepIdx = i; var S = ST[i]; S.on(); setText('step', S.step); setText('sub', S.sub);
      if (S.say && !isTest) { TG.audio.say(S.say, { kind: 'narrator' }); if (S.kid) setTimeout(function () { TG.audio.say(S.kid, { kind: 'kid', queue: true }); }, 2600); }
    }
    // 보행 신호: 4단계까지 적색(차량 남북 녹색), 5단계부터 녹색(차량 동서 녹색)
    if (SCENE === 'cross') { if (t < 24) signals.set(N, 'v', 'green'); else if (t < 36) signals.set(N, 'h', 'green'); }
    signals.update(dt);
    var sp = TG.audio.speaking;
    actors.kid.smile = stepIdx === 6; actors.officer.smile = stepIdx === 6 || stepIdx === 0;
    actors.kid.update(dt, sp === 'kid'); actors.officer.update(dt, sp === 'narrator' || sp === 'officer'); steps(actors.kid); steps(actors.officer);
    if (SCENE === 'cross' && stepIdx === 5 && !isTest) { crossT -= dt; if (crossT <= 0) { crossT = 0.95; TG.audio.crossSignal('cuckoo'); } }   // 횡단보도 음향신호기(뻐꾸기)
    if (stepIdx === 6 && !burstDone) { burstDone = true; }
    // 경찰관 시선: 어린이 또는 다가오는 차
    var lead = null; for (var k = 0; k < traffic.cars.length; k++) { var c = traffic.cars[k]; if (Math.hypot(c.pos.x - actors.officer.pos.x, c.pos.z - actors.officer.pos.z) < 30) lead = c; }
    var tgt = (stepIdx === 5 && lead) ? lead.pos : (SCENE === 'moto' && moto ? moto.pos : actors.kid.pos);
    actors.officer.look = TG.wrapAngle(Math.atan2(tgt.x - actors.officer.pos.x, tgt.z - actors.officer.pos.z) - actors.officer.heading) * 0.8;
    traffic.update(dt, stepIdx >= 5 ? 6 : 4); traffic.separate(); peds.update(dt, 8);
    player.update(0.0001);
    weather.update(dt, camera.position); world.followSun(CX, CZ);
    // 카메라
    // 카메라는 배우 위치 기준(어린이·둘의 가운데)으로 잡아 항상 화면 가운데에 온다
    var S2 = ST[Math.max(0, stepIdx)], nextAt = stepIdx + 1 < ST.length ? ST[stepIdx + 1].at : LOOP_AT, u = TG.clamp((t - S2.at) / Math.max(1, nextAt - S2.at), 0, 1);
    var K = actors.kid.pos, O = actors.officer.pos, mid = [(K.x + O.x) / 2, (K.z + O.z) / 2], P, L, si = Math.max(0, stepIdx);
    if (si === 0) { P = [K.x + 6 - u * 2, 3.2 - u * 1.2, K.z + 9]; L = [K.x - 2, 0.9, K.z]; }
    else if (si === 1) { P = [K.x + 4.2, 2.3, K.z + 5.8]; L = [K.x, 0.85, K.z]; }
    else if (si === 2) { P = [K.x - 2.6, 1.25, K.z + 1.6]; L = [K.x, 0.95, K.z]; }
    else if (si === 3) { P = [K.x - 2.0, 1.7, K.z + 3.4]; L = [K.x + 0.3, 1.0, K.z - 0.4]; }
    else if (si === 4) { P = [K.x + 2.6, 1.9, K.z - 3.6]; L = [EAST - 0.5, 2.2, CZ + 0.9]; }
    else if (si === 5) { P = [mid[0] - 6.5 + u * 2, 2.4, mid[1] + 7.5]; L = [mid[0], 0.9, mid[1]]; }   // 남서쪽에서: 남쪽에 선 어린이가 앞에 온다
    else if (si === 6) { P = [mid[0] - 5.5, 2.1, mid[1] + 5.5]; L = [mid[0], 1.0, mid[1]]; }
    else { P = [CX + 6, 12 + u * 6, CZ + 26 + u * 6]; L = [CX, 1, CZ]; }
    if (SCENE === 'moto') { var mk = motoCam(u); P = mk[0]; L = mk[1]; }
    if (!camInit) { camPos.set(P[0], P[1], P[2]); camLook.set(L[0], L[1], L[2]); camInit = true; }
    var kc = 1 - Math.exp(-2.2 * dt); camPos.x += (P[0] - camPos.x) * kc; camPos.y += (P[1] - camPos.y) * kc; camPos.z += (P[2] - camPos.z) * kc;
    camLook.x += (L[0] - camLook.x) * kc * 1.3; camLook.y += (L[1] - camLook.y) * kc * 1.3; camLook.z += (L[2] - camLook.z) * kc * 1.3;
    var gy = terrain.heightAt(camPos.x, camPos.z) + 0.6; if (camPos.y < gy) camPos.y = gy;
    camera.position.copy(camPos); camera.lookAt(camLook);
    if (t >= (SCENE === 'moto' ? 32 : LOOP_AT)) { SCENE = SCENE === 'moto' ? 'cross' : 'moto'; restart(); }   // 두 장면을 번갈아
  }
  function loop(now) {
    requestAnimationFrame(loop);
    var dt = Math.min(0.05, (now - lastNow) / 1000); lastNow = now;
    if (running && started) update(dt);
    else { camera.position.set(EAST + 8, 5.5, CZ + 20); camera.lookAt(EAST - 2, 1.2, CZ + 2); actors.kid.update(0.016); actors.officer.update(0.016); signals.update(dt || 0.016); }
    renderer.render(scene, camera);
  }
  function runTest() {
    var errs = [], R = [];
    window.addEventListener('error', function (e) { errs.push(e.message + ' @' + (e.filename || '').split('/').pop() + ':' + e.lineno); });
    try {
      for (var i = 0; i < 82 * 30; i++) update(1 / 30);
      R.push('scene = ' + SCENE + ' · moto = ' + (moto ? Math.round(moto.v * 10) / 10 : null) + ' · loops = ' + loopCount + ' · step = ' + stepIdx + ' · kid = ' + Math.round(actors.kid.pos.x) + ',' + Math.round(actors.kid.pos.z) + ' · officer = ' + Math.round(actors.officer.pos.x) + ' · cars = ' + traffic.cars.length);
      R.push('rig parts = ' + Object.keys(actors.officer.rig.joints).length + ' joints · officer height ' + actors.officer.rig.height.toFixed(2));
      renderer.render(scene, camera); R.push('render calls = ' + renderer.info.render.calls);
      var q = TG.qr.encode('https://340patrolman.github.io/traffic-game/'); R.push('qr = v' + q.version + ' size ' + q.size);
    } catch (e) { errs.push('HARNESS ' + e.message + '\n' + (e.stack || '')); }
    var pre = document.createElement('pre'); pre.id = 'VOUT'; pre.textContent = R.join('\n') + '\nERRORS(' + errs.length + '): ' + errs.join(' | '); document.body.appendChild(pre);
  }
  TG.promo = { get t() { return t; }, actors: actors, steps: STEPS, restart: restart, jump: function (sec) { restart(); for (var i = 0; i < sec * 30; i++) update(1 / 30); }, get camera() { return camera; } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
