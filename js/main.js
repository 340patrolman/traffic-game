// 게임 루프·규칙·카메라·점수·인트로. 여기서 모든 모듈을 잇는다.
(function () {
  var C = TG.CONFIG;
  var G = TG.game = { state: 'boot', score: 0, timeLeft: C.SHIFT_SECONDS, cfg: C, laws: null, stats: null, paused: false, pauseReasons: {} };
  var renderer, scene, camera, canvas, city, world, terrain, signals, traffic, peds, player, input, enforcement, minimap, weather, hud = TG.hud;
  var settings = TG.save.get('settings', { hints: true, stopbar: true, sound: true, car: 'sedan' });
  if (typeof settings.hints !== 'boolean') settings = { hints: true, stopbar: true, sound: true, car: 'sedan' };
  if (settings.cam !== 'cockpit') settings.cam = 'chase';
  if (!C.CARS[settings.car]) settings.car = 'flag';
  var rules = {}, camPos = new THREE.Vector3(), camLook = new THREE.Vector3(), camInit = false;
  var lastT = 0, penaltyTotal = 0, penaltyCount = {};
  var isStress = /[?&]stress=1/.test(location.search), isTest = /[?&]test=1/.test(location.search), noIntro = /[?&]nointro=1/.test(location.search), noRender = /[?&]norender=1/.test(location.search);
  var intro = { t: 0, lines: [], idx: -1, done: false };
  var FALLBACK_PURPOSE = '도로에서 일어나는 교통상의 위험과 장해를 방지하고 제거하여 안전하고 원활한 교통을 확보한다';

  function log(m) { console.log('[TG] ' + m); }

  function init() {
    canvas = document.getElementById('game');
    input = new TG.Input();
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: noRender });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, input.isTouch ? 1.5 : 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = input.isTouch ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.02;
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(62, 1, 0.5, 2600);

    city = TG.buildCity(C);
    world = TG.buildWorld(scene, city, C);
    terrain = TG.buildTerrain(scene, city, C);
    city.attachTerrain(terrain);
    weather = new TG.Weather(scene, world, terrain, city, renderer); G.weather = weather;
    if (!TG.WEATHERS[settings.weather]) settings.weather = 'clear';
    weather.set(settings.weather);
    signals = new TG.Signals(city, world, C);
    var rng = TG.makeRNG((Date.now() & 0xffff) + 1);
    traffic = new TG.Traffic(scene, city, signals, C, rng); traffic.terrain = terrain;
    peds = new TG.Peds(scene, city, signals, C, rng);
    traffic.peds = peds; peds.traffic = traffic;
    traffic.onEvent = onTrafficEvent; peds.onEvent = onPedEvent;
    G.city = city; G.traffic = traffic; G.peds = peds; G.signals = signals; G.hud = hud; G.world = world; G.terrain = terrain;

    hud.init(settings);
    hud.showTouch(true);   // 원형 조작판·경광등 버튼은 PC(마우스)에서도 항상 보인다
    document.body.classList.toggle('desktop', !input.isTouch);
    minimap = new TG.Minimap(document.getElementById('minimap'), city, terrain); G.minimap = minimap;
    TG.audio.setMuted(!settings.sound);
    TG.perf.onChange(function (scale, shadows) { world.sun.castShadow = shadows; });
    if (isStress) { C.TRAFFIC_MAX = 40; C.PED_MAX = 40; log('stress 모드: 교통 최대 40, 행인 40'); }

    bindUI();
    loadLaws();
    resize();
    addEventListener('resize', resize);
    addEventListener('orientationchange', function () { setTimeout(resize, 200); });
    if (!isTest) document.addEventListener('visibilitychange', function () { if (document.hidden && G.state === 'play') setPaused(true, 'menu'); });
    // 인트로용 순찰차(타이틀 배경에서도 경광등을 켜고 서 있다)
    player = new TG.PlayerCar(scene, city, C, C.CARS[settings.car] || C.CARS.sedan); player.setSiren(true); G.player = player;
    document.querySelectorAll('.carpick').forEach(function (b) { b.classList.toggle('sel', b.getAttribute('data-car') === settings.car); });
    log('준비 완료 v' + TG.VERSION + ' · 건물 ' + city.buildings.length + ' · 링크 ' + terrain.links.length + ' · 터치 ' + input.isTouch + ' · ' + location.protocol);
    if (isTest) installTestHooks();
    if (noIntro || isTest) showTitle(); else startIntro();
    requestAnimationFrame(loop);
  }

  function loadLaws() {
    if (location.protocol.indexOf('http') !== 0) { log('file:// 모드 — data/laws.json 을 읽을 수 없어 범칙금·벌점은 「확인 중」으로 표시됩니다'); return; }
    fetch('data/laws.json').then(function (r) { return r.json(); }).then(function (j) { G.laws = j; log('laws.json 로딩: ' + j.violations.length + '항목 (' + j.updated + ')'); })
      .catch(function (e) { log('laws.json 로딩 실패: ' + e.message); });
  }
  // 시야각: 차내 72 / 세로 72 / PC 와이드(가로 1.6배 이상) 64 / 그 외 60
  function chaseFov() {
    var w = window.innerWidth, h = window.innerHeight;
    // 세로 화면은 가로 시야가 좁아지므로 수직 시야각을 더 키운다
    if (settings.cam === 'cockpit') return h > w ? 112 : (w / h >= 1.6 ? 92 : 98);
    return h > w ? 88 : (w / h >= 1.6 ? 74 : 70);
  }
  // ---------- 차내 광각(3면 파노라마) ----------
  // 가로 화면·차내 시점에서는 왼쪽·가운데·오른쪽 세 카메라로 나눠 그린다(각 패널의 수직 시야각은 같고, 옆 패널은 가운데 시야각의 절반만큼 더 돌아가 이음새가 이어진다).
  // 총 가로 시야 ≈ 175°: 운전석에서 양옆 창문 밖까지 보인다. 세로 화면·추적 시점은 카메라 하나.
  var camC = new THREE.PerspectiveCamera(80, 1, 0.5, 2600), camL = new THREE.PerspectiveCamera(80, 1, 0.5, 2600), camR = new THREE.PerspectiveCamera(80, 1, 0.5, 2600);
  var pano = { on: false, sw: 0, cw: 0, yaw: 0, total: 0 }, qL = new THREE.Quaternion(), qR = new THREE.Quaternion(), Y_AXIS = new THREE.Vector3(0, 1, 0);
  function panoLayout(w, h) {
    var cw = Math.round(w * 0.54), sw = Math.round((w - cw) / 2), best = null, TARGET = 150 * Math.PI / 180;
    for (var v = 64; v <= 112; v += 1) {
      var t = Math.tan(v * Math.PI / 360), hc = 2 * Math.atan(t * cw / h), hs = 2 * Math.atan(t * sw / h), tot = hc + 2 * hs;
      if (!best || Math.abs(tot - TARGET) < Math.abs(best.tot - TARGET)) best = { v: v, hc: hc, hs: hs, tot: tot };
    }
    return { on: true, cw: cw, sw: sw, v: best.v, yaw: (best.hc + best.hs) / 2, total: best.tot * 180 / Math.PI };
  }
  function panoActive() { return settings.cam === 'cockpit' && settings.pano === true && window.innerWidth > window.innerHeight; }
  function renderFrame() {
    var w = window.innerWidth, h = window.innerHeight;
    if (!(pano.on && G.state === 'play')) { renderer.render(scene, camera); return; }
    camC.position.copy(camera.position); camC.quaternion.copy(camera.quaternion);
    camL.position.copy(camera.position); camL.quaternion.copy(camera.quaternion).premultiply(qL);
    camR.position.copy(camera.position); camR.quaternion.copy(camera.quaternion).premultiply(qR);
    renderer.setScissorTest(true);
    renderer.setViewport(0, 0, pano.sw, h); renderer.setScissor(0, 0, pano.sw, h); renderer.render(scene, camL);
    renderer.setViewport(pano.sw, 0, pano.cw, h); renderer.setScissor(pano.sw, 0, pano.cw, h); renderer.render(scene, camC);
    renderer.setViewport(pano.sw + pano.cw, 0, pano.sw, h); renderer.setScissor(pano.sw + pano.cw, 0, pano.sw, h); renderer.render(scene, camR);
    renderer.setScissorTest(false); renderer.setViewport(0, 0, w, h);
  }
  // 화면 좌표 → (어느 패널의) 카메라와 정규화 좌표. 터치 단속의 레이캐스트에 쓴다.
  function pickCamera(cx, cy) {
    var w = window.innerWidth, h = window.innerHeight, ny = -(cy / h) * 2 + 1;
    if (!(pano.on && G.state === 'play')) return { cam: camera, nx: (cx / w) * 2 - 1, ny: ny };
    if (cx < pano.sw) return { cam: camL, nx: (cx / pano.sw) * 2 - 1, ny: ny };
    if (cx >= pano.sw + pano.cw) return { cam: camR, nx: ((cx - pano.sw - pano.cw) / pano.sw) * 2 - 1, ny: ny };
    return { cam: camC, nx: ((cx - pano.sw) / pano.cw) * 2 - 1, ny: ny };
  }
  function resize() {
    var w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.fov = chaseFov();
    camera.near = settings.cam === 'cockpit' ? 0.12 : 0.5;   // 차내: 핸들·손(눈앞 0.35m)이 근접 평면에 잘리지 않게
    camera.updateProjectionMatrix();
    document.body.classList.toggle('portrait', h > w);
    if (panoActive()) {
      var L = panoLayout(w, h); pano = L;
      camC.near = camL.near = camR.near = 0.12;
      camC.aspect = L.cw / h; camC.fov = L.v; camC.updateProjectionMatrix();
      camL.aspect = L.sw / h; camL.fov = L.v; camL.updateProjectionMatrix();
      camR.aspect = L.sw / h; camR.fov = L.v; camR.updateProjectionMatrix();
      qL.setFromAxisAngle(Y_AXIS, L.yaw); qR.setFromAxisAngle(Y_AXIS, -L.yaw);
    } else { pano.on = false; renderer.setScissorTest(false); renderer.setViewport(0, 0, w, h); }
  }

  // ---------- 인트로 ----------
  function startIntro() {
    G.state = 'intro'; intro.t = 0; intro.idx = -1; intro.done = false; intro.theme = false;
    var purpose = (G.laws && G.laws.act && G.laws.act.purpose) ? G.laws.act.purpose : FALLBACK_PURPOSE;
    var cite = (G.laws && G.laws.act) ? (G.laws.act.name + ' ' + G.laws.act.purposeArticle + '(목적)') : '도로교통법 제1조(목적) · 확인 중';
    intro.lines = [
      { at: 0.6, text: '도로에서 일어나는 위험과 장해를 막고, 없애고,' },
      { at: 2.6, text: '안전하고 원활한 교통을 확보한다.' },
      { at: 4.4, text: cite + ' — ' + purpose, small: true },
      { at: 6.6, text: '그 목적을 매일 도로 위에서 실현하는 사람,' },
      { at: 8.4, text: '교통경찰.' },
      { at: 10.4, text: 'SEOUL PATROL', big: true },
      { at: 11.4, text: '서울 강남 · 서초 · 순환고속도로 순찰 근무', small: true },
    ];
    hud.introLines(intro.lines, -1);
    hud.showIntro(true);
    TG.audio.setSiren(false);
  }
  function endIntro() { if (intro.done) return; intro.done = true; TG.audio.stopIntro(); hud.showIntro(false); showTitle(); }
  function showTitle() { G.state = 'title'; hud.showTitle(TG.save.get('best', null)); camInit = false; }
  function introCamera(t) {
    // 0~5s: 순환고속도로 위를 낮게 난다 → 5~9s: 도시 위로 스윕 → 9~13s: 경광등 켠 순찰차 주위를 돈다
    var ring = terrain.ring, N = ring.N;
    if (t < 5) {
      var i = Math.floor((t / 5) * 60) + Math.floor(N * 0.02), p = ring.P(i), q = ring.P(i + 12);
      camera.position.set(p.x + p.rx * 22, p.y + 26, p.z + p.rz * 22);
      camera.lookAt(q.x, q.y + 3, q.z);
    } else if (t < 9) {
      var u = (t - 5) / 4, ex = TG.lerp(-80, 120, u), ez = TG.lerp(-140, 60, u), ey = TG.lerp(140, 40, u);
      camera.position.set(ex, ey, ez); camera.lookAt(160 + u * 20, 6, 120 + u * 20);
    } else {
      var a = (t - 9) * 0.5 + 2.2, r = 9 - Math.min(3, (t - 9) * 0.6);
      camera.position.set(player.pos.x + Math.cos(a) * r, player.y + 2.6, player.pos.z + Math.sin(a) * r);
      camera.lookAt(player.pos.x, player.y + 1.0, player.pos.z);
    }
  }

  function bindUI() {
    var $ = function (id) { return document.getElementById(id); };
    document.querySelectorAll('.carpick').forEach(function (b) {
      input.bindTap(b, function () {
        settings.car = b.getAttribute('data-car'); TG.save.set('settings', settings);
        document.querySelectorAll('.carpick').forEach(function (x) { x.classList.toggle('sel', x === b); });
        if (G.state === 'title') { scene.remove(player.mesh); player = new TG.PlayerCar(scene, city, C, C.CARS[settings.car]); player.setSiren(true); G.player = player; weather.attachPlayer(player.mesh, player.len); }
      });
    });
    input.bindTap($('btnStart'), function () { start(settings.car); });
    // 날씨·시간대: 타이틀 버튼 + 일시정지 메뉴 선택
    function applyWeather(name) { settings.weather = name; TG.save.set('settings', settings); weather.set(name); document.querySelectorAll('.wpick').forEach(function (x) { x.classList.toggle('sel', x.getAttribute('data-weather') === name); }); var ow = $('optWeather'); if (ow) ow.value = name; }
    document.querySelectorAll('.wpick').forEach(function (b) { input.bindTap(b, function () { applyWeather(b.getAttribute('data-weather')); }); });
    if ($('optWeather')) $('optWeather').addEventListener('change', function () { applyWeather($('optWeather').value); });
    applyWeather(settings.weather);
    // 모드: 순찰 근무 / 자유 주행 / 연습 서킷 / 학습(12항목 카드 → 체험)
    function applyMode(name) { if (name === 'study') { if (TG.study) TG.study.open(G); return; } settings.mode = MODES[name] ? name : 'patrol'; TG.save.set('settings', settings); document.querySelectorAll('.mpick').forEach(function (x) { x.classList.toggle('sel', x.getAttribute('data-mode') === settings.mode); }); }
    document.querySelectorAll('.mpick').forEach(function (b) { input.bindTap(b, function () { applyMode(b.getAttribute('data-mode')); }); });
    applyMode(settings.mode || 'patrol');
    // 시점: 타이틀의 선택 버튼 + 게임 중 「시점」 버튼 / C 키
    function applyView(mode, announce) {
      settings.cam = mode; TG.save.set('settings', settings);
      document.querySelectorAll('.viewpick').forEach(function (x) { x.classList.toggle('sel', x.getAttribute('data-view') === mode); });
      if (player) player.setView(mode);
      resize();
      camInit = false;
      if (announce && G.state === 'play') hud.notice(mode === 'cockpit' ? '차내 시점' : '추적 시점', 'info', 1200);
    }
    G.applyView = applyView;
    document.querySelectorAll('.viewpick').forEach(function (b) { input.bindTap(b, function () { applyView(b.getAttribute('data-view'), false); }); });
    input.bindTap($('btnView'), function () { if (G.state === 'play') applyView(settings.cam === 'cockpit' ? 'chase' : 'cockpit', true); });
    input.onKey('KeyC', function () { if (G.state === 'play') applyView(settings.cam === 'cockpit' ? 'chase' : 'cockpit', true); });
    applyView(settings.cam, false);
    input.bindTap($('introSkip'), endIntro);
    $('intro').addEventListener('pointerdown', function () { if (intro.t > 1.5) endIntro(); });
    input.bindTap($('btnSiren'), toggleSiren);
    input.bindTap($('btnPause'), function () { if (G.state === 'play') setPaused(!G.pauseReasons.menu, 'menu'); });
    input.bindTap($('btnResume'), function () { setPaused(false, 'menu'); });
    input.bindTap($('btnQuit'), function () { endShift('근무 종료(직접 종료)'); setPaused(false, 'menu'); });
    input.bindTap($('btnRecover'), function () { setPaused(false, 'menu'); recoverToRoad('마지막 도로 위치로 복귀'); });
    input.bindTap($('btnAgain'), function () { hud.hideEnd(); showTitle(); });
    var optH = $('optHints'), optS = $('optStopbar'), optA = $('optSound');
    if (optH && optS && optA) { optH.checked = settings.hints; optS.checked = settings.stopbar; optA.checked = settings.sound;
    optH.addEventListener('change', function () { settings.hints = optH.checked; hud.setHints(optH.checked); TG.save.set('settings', settings); });
    optS.addEventListener('change', function () { settings.stopbar = optS.checked; hud.setStopbar(optS.checked); TG.save.set('settings', settings); });
    optA.addEventListener('change', function () { settings.sound = optA.checked; TG.audio.setMuted(!optA.checked); TG.save.set('settings', settings); }); }
    var optAs = $('optAssist'), optP = $('optPano');
    if (optAs) optAs.checked = settings.assist !== false; if (optP) optP.checked = settings.pano === true;
    if (optAs) optAs.addEventListener('change', function () { settings.assist = optAs.checked; if (player) player.assist = optAs.checked; TG.save.set('settings', settings); });
    if (optP) optP.addEventListener('change', function () { settings.pano = optP.checked; TG.save.set('settings', settings); resize(); });
    // 음량(기본 30% — 은은하게). 마스터 게인에 바로 반영
    if (typeof settings.volume !== 'number') settings.volume = 0.3;
    var optV = $('optVolume'), optVV = $('optVolumeVal');
    if (optV && optVV) { optV.value = Math.round(settings.volume * 100); optVV.textContent = optV.value + '%'; }
    TG.audio.setVolume(settings.volume);
    if (optV) optV.addEventListener('input', function () { settings.volume = optV.value / 100; optVV.textContent = optV.value + '%'; TG.audio.setVolume(settings.volume); TG.save.set('settings', settings); });
    // 앰프(확성기): 버튼·M 키. 누를 때마다 안내 문구를 돌아가며 방송
    var PA_LINES = ['앞 차량, 우측 가장자리에 정차하십시오', '서행하십시오, 전방에 보행자가 있습니다', '무단횡단은 위험합니다, 횡단보도를 이용하십시오', '순찰 중입니다, 안전 운전 부탁드립니다'];
    var paIdx = 0;
    function pa() { if (G.state !== 'play') return; TG.audio.resume(); TG.audio.pa(PA_LINES[paIdx % PA_LINES.length]); hud.notice('📢 ' + PA_LINES[paIdx % PA_LINES.length], 'info', 2200); paIdx++; }
    input.bindTap($('btnPA'), pa);
    input.onKey('KeyM', pa);
    // ---------- 대상 선택(화면 터치/클릭) + 「단속」 ----------
    // 화면의 차량·보행자를 터치하면 선택(빨간 고리 + 이름표). 「단속」(E) 을 누르면 차량은 정차 유도, 보행자는 계도·통고 화면.
    var ray = new THREE.Raycaster(), tapStart = null, dragId = null;
    G.lookYaw = 0; G.lookHold = false;
    canvas.addEventListener('pointerdown', function (e) { tapStart = { x: e.clientX, y: e.clientY, t: performance.now() }; dragId = e.pointerId; });
    // 드래그(가로)로 둘러보기: 차내 시점에서 머리를 돌린다(최대 ±100°). 놓으면 정면으로 돌아온다.
    canvas.addEventListener('pointermove', function (e) {
      if (!tapStart || e.pointerId !== dragId || G.state !== 'play') return;
      var dx = e.clientX - tapStart.x;
      if (Math.abs(dx) > 10) { G.lookHold = true; G.lookYaw = TG.clamp(-dx / window.innerWidth * 2.6, -C.CAM_COCKPIT.lookMax, C.CAM_COCKPIT.lookMax); }
    });
    canvas.addEventListener('pointercancel', function () { tapStart = null; G.lookHold = false; });
    canvas.addEventListener('pointerup', function (e) {
      if (!tapStart || G.state !== 'play' || G.paused) { tapStart = null; G.lookHold = false; return; }
      var moved = Math.hypot(e.clientX - tapStart.x, e.clientY - tapStart.y); tapStart = null; G.lookHold = false;
      if (moved > 10) return;
      var pk = pickCamera(e.clientX, e.clientY), nx = pk.nx, ny = pk.ny;
      ray.setFromCamera(new THREE.Vector2(nx, ny), pk.cam);
      var objs = traffic.cars.map(function (c) { return c.mesh; }).concat(peds.peds.map(function (p) { return p.mesh; }));
      var hits = ray.intersectObjects(objs, true);
      for (var i = 0; i < hits.length; i++) {
        var o = hits[i].object;
        while (o && !(o.userData && (o.userData.car || o.userData.ped))) o = o.parent;
        if (!o) continue;
        var sel = o.userData.car ? { kind: 'car', car: o.userData.car } : { kind: 'ped', ped: o.userData.ped };
        selectTarget(sel);
        if (enforcement && enforcement.quiz(sel)) selectTarget(null);   // 터치 즉시 「무슨 위반?」 객관식
        return;
      }
      selectTarget(null);
    });
    input.bindTap($('btnEnforce'), enforce);
    input.onKey('KeyF', enforce);
    input.onKey('KeyL', toggleSiren);
    input.onKey('KeyH', function () { settings.hints = !settings.hints; hud.setHints(settings.hints); optH.checked = settings.hints; TG.save.set('settings', settings); hud.notice('교육 안내 ' + (settings.hints ? '켬' : '끔'), 'info', 1500); });
    input.onKey('Escape', function () { if (G.state === 'play') setPaused(!G.pauseReasons.menu, 'menu'); else if (G.state === 'intro') endIntro(); });
    input.onKey('KeyP', function () { if (G.state === 'play') setPaused(!G.pauseReasons.menu, 'menu'); });
    input.onKey('Enter', function () { if (G.state === 'title') start(settings.car); else if (G.state === 'intro') endIntro(); else if (G.state === 'end') { hud.hideEnd(); showTitle(); } });
    input.onKey('Space', function () { if (G.state === 'intro') endIntro(); });
    canvas.addEventListener('pointerdown', function () { TG.audio.resume(); });
  }
  // ---------- 선택 대상 ----------
  var selRing = null;
  function ensureRing() {
    if (selRing) return;
    selRing = new THREE.Mesh(new THREE.RingGeometry(1.4, 1.8, 32), new THREE.MeshBasicMaterial({ color: 0xff3b30, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthTest: false }));
    selRing.rotation.x = -Math.PI / 2; selRing.renderOrder = 5; selRing.visible = false; scene.add(selRing);
  }
  function selName(sel) {
    if (!sel) return null;
    if (sel.kind === 'car') {
      var c = sel.car, tn = { sedan: '승용차', hatch: '승용차', suv: 'SUV', van: '승합차', truck: '화물차', bus: '버스' }[c.type] || '차량';
      var v = c.violation ? ({ signal: '신호위반 의심', pedestrian: '보행자 보호 위반 의심', buslane: '버스전용차로 위반 의심' }[c.violation.type] || '위반 의심') : '위반 없음(목격 안 됨)';
      return tn + ' · ' + v;
    }
    var p = sel.ped, recent = p.jayLive || (p.jayDone && p.jayT < 12);
    return '보행자 · ' + (recent ? (p.jayKind === 'red' ? '신호위반 보행 의심' : '무단횡단 의심') : '위반 없음');
  }
  function selectTarget(sel) {
    G.selected = sel; ensureRing();
    var btn = document.getElementById('btnEnforce');
    if (!sel) { selRing.visible = false; if (btn) btn.classList.remove('ready'); if (enforcement && enforcement.state === 'idle') hud.setTarget(null); return; }
    selRing.visible = true; if (btn) btn.classList.add('ready');
    hud.setTarget('선택: ' + selName(sel) + ' — 「단속」(E)');
    TG.audio.ui();
  }
  function updateSelection() {
    var s = G.selected; if (!s || !selRing) return;
    var e = s.kind === 'car' ? s.car : s.ped;
    var alive = s.kind === 'car' ? traffic.cars.indexOf(e) >= 0 : peds.peds.indexOf(e) >= 0;
    if (!alive || Math.hypot(e.pos.x - player.pos.x, e.pos.z - player.pos.z) > 90) { selectTarget(null); return; }
    var y = s.kind === 'car' ? e.y : 0.2;
    selRing.position.set(e.pos.x, y + 0.08, e.pos.z);
    var sc = s.kind === 'car' ? (e.isBus ? 2.6 : 1.3) : 0.5; selRing.scale.set(sc, sc, 1);
  }
  // 「단속」: 선택 대상이 없으면 앞쪽 45m 안의 위반 의심 차량·보행자를 자동으로 고른다
  function enforce() {
    if (G.state !== 'play' || G.paused || !enforcement) return;
    var sel = G.selected;
    if (!sel) {
      var pf = player.forward(), best = null, bd = 1e9;
      traffic.cars.forEach(function (c) { if (!c.violation) return; var dx = c.pos.x - player.pos.x, dz = c.pos.z - player.pos.z, d = Math.hypot(dx, dz); if (d < 45 && dx * pf[0] + dz * pf[1] > -2 && d < bd) { bd = d; best = { kind: 'car', car: c }; } });
      peds.peds.forEach(function (p) { var recent = p.jayLive || (p.jayDone && p.jayT < 12); if (!recent || p.warned) return; var d = Math.hypot(p.pos.x - player.pos.x, p.pos.z - player.pos.z); if (d < 20 && d < bd) { bd = d; best = { kind: 'ped', ped: p }; } });
      if (!best) { hud.notice('대상이 없습니다 — 화면에서 차량이나 보행자를 터치해 고르세요', 'warn', 2400); return; }
      sel = best; selectTarget(sel);
    }
    if (enforcement.quiz(sel)) selectTarget(null);
  }
  function toggleSiren() {
    if (G.state !== 'play' || !player) return;
    player.setSiren(!player.siren); TG.audio.resume(); TG.audio.setSiren(player.siren); hud.setSiren(player.siren);
  }

  function start(carId, modeOverride) {
    TG.audio.resume(); if (TG.study) TG.study.close();
    if (player) scene.remove(player.mesh);
    player = new TG.PlayerCar(scene, city, C, C.CARS[carId] || C.CARS.sedan);
    player.setView(settings.cam); weather.attachPlayer(player.mesh, player.len);
    TG.audio.setPowertrain(player.spec.powertrain || 'ice');
    G.player = player; traffic.player = player; peds.player = player;
    while (traffic.cars.length) traffic.remove(traffic.cars[0]);
    while (peds.peds.length) peds.remove(peds.peds[0]);
    enforcement = new TG.Enforcement(G); G.enforcement = enforcement;
    G.score = 0; G.timeLeft = C.SHIFT_SECONDS; penaltyTotal = 0; penaltyCount = {};
    // 모드: patrol(순찰 근무) | free(자유 주행: 시간 제한·감점 없음, 랩 타임) | circuit(연습 서킷: 교통 없음, 코칭·랩 타임)
    G.mode = modeOverride || settings.mode || 'patrol'; if (!MODES[G.mode]) G.mode = 'patrol';
    C.TRAFFIC_MAX = BASE_TRAFFIC; C.PED_MAX = BASE_PED;
    lap = { on: false, t: 0, prevI: null, last: null, best: TG.save.get('bestlap_' + G.mode, null), link: null, name: G.mode };
    coach = { cd: 0, lastCorner: -1, apexDone: -1 };
    if (G.mode === 'free') { G.timeLeft = 1e9; lap.link = terrain.ring; }
    if (G.mode === 'circuit') { G.timeLeft = 1e9; C.TRAFFIC_MAX = 0; C.PED_MAX = 0; lap.link = terrain.circuit; var cp0 = terrain.circuit.P(3); player.teleport(cp0.x + cp0.rx * 0.5, cp0.z + cp0.rz * 0.5, Math.atan2(cp0.tx, cp0.tz)); }
    G.stats = { score: 0, stops: 0, correct: 0, violatorStops: 0, witnessed: 0, penalty: 0, lesson: '', reason: '', warned: 0 };
    traffic.stats.violations = 0; traffic.stats.witnessed = 0;
    rules = { prevDist: null, prevNode: null, speedT: 0, clT: 0, cornerCd: 0, crashCd: 0, gapWarnCd: 0, busHintCd: 0, jayCd: 0, saveT: 0, lastRoad: { x: player.pos.x, z: player.pos.z, h: player.heading } };
    G.pauseReasons = {}; G.paused = false; G.lastCrash = null; G.lead = null; camInit = false;
    hud.hideTitle(); hud.hideEnd(); hud.showHud(true); hud.setScore(0); hud.setStops(0); hud.setTimer(G.timeLeft); hud.setSiren(false); hud.setTarget(null); hud.setGear('D');
    G.state = 'play'; TG.perf.reset();
    if (G.mode !== 'patrol') hud.setTimerText(G.mode === 'circuit' ? '출발선을 지나면 랩 시작' : '∞ 자유 주행');
    hud.notice(G.mode === 'free' ? '자유 주행 — 시간 제한·감점 없음. IC 로 나가 순환고속도로를 마음껏 달리세요(랩 타임 기록)' : G.mode === 'circuit' ? '연습 서킷 — 슬로우 인·패스트 아웃. 코너 앞 안내를 따라 달려 보세요(랩 타임 기록)' : '순찰 시작 — 안전 운전이 먼저입니다', 'info', 4000);
    log('근무 시작: ' + player.spec.name + ' / ' + G.mode);
  }
  var MODES = { patrol: '순찰 근무', free: '자유 주행', circuit: '연습 서킷' }, BASE_TRAFFIC = C.TRAFFIC_MAX, BASE_PED = C.PED_MAX, lap = null, coach = null;
  function fmtLap(t) { var m = Math.floor(t / 60), s = t - m * 60; return m + ':' + (s < 10 ? '0' : '') + s.toFixed(1); }
  // 랩 타임: 링크 인덱스 0 을 진행 방향으로 지나면 한 바퀴. 최고 기록은 tg_bestlap_<mode>.
  function lapUpdate(dt) {
    var L = lap.link; if (!L) return;
    var q = terrain.nearest(player.pos.x, player.pos.z, false);
    if (!q || q.link !== L) { if (lap.on) hud.setTimerText('—'); lap.on = false; lap.prevI = null; return; }
    if (lap.on) lap.t += dt;
    var i = q.i, N = L.N;
    if (lap.prevI !== null && lap.prevI > N - 10 && i < 10) {
      if (lap.on && lap.t > 15) {
        lap.last = lap.t; var isBest = !lap.best || lap.t < lap.best; if (isBest) { lap.best = lap.t; TG.save.set('bestlap_' + lap.name, lap.best); }
        hud.notice('랩 ' + fmtLap(lap.t) + (isBest ? ' — 최고 기록!' : ' · 최고 ' + fmtLap(lap.best)), 'good', 4000); TG.audio.good();
      } else if (!lap.on) hud.notice('랩 타임 시작', 'info', 1500);
      lap.t = 0; lap.on = true;
    }
    lap.prevI = i;
    hud.setTimerText(lap.on ? '랩 ' + fmtLap(lap.t) + (lap.best ? ' · 최고 ' + fmtLap(lap.best) : '') : (lap.best ? '최고 ' + fmtLap(lap.best) : '출발선을 지나면 랩 시작'));
  }
  // 코칭(연습 서킷): 앞 45m 안의 최대 곡률로 권장 진입 속도(√(횡가속 한계·0.9 / κ))를 구해 제동 시점을 알려 준다.
  // 정점에서 가속(패스트 아웃), 언더스티어·오버스티어(카운터 스티어) 안내.
  function coachUpdate(dt) {
    var L = terrain.circuit, T = player.telemetry, s = player.spec; coach.cd -= dt;
    var q = terrain.nearest(player.pos.x, player.pos.z, false); if (!q || q.link !== L) return;
    var i = q.i, kmax = 0, ki = i;
    for (var k = 1; k <= 15; k++) { var p = L.P(i + k); if (p.kappa > kmax) { kmax = p.kappa; ki = ((i + k) % L.N + L.N) % L.N; } }
    var here = L.P(i).kappa;
    if (T.oversteer && coach.cd <= 0) { hud.hint('뒤가 미끄러진다 — 미끄러지는 쪽으로 핸들을 살짝(카운터 스티어), 가속은 부드럽게'); coach.cd = 3; return; }
    if (T.understeer && coach.cd <= 0) { hud.hint('언더스티어 — 핸들을 더 꺾지 말고 속도를 줄여 앞바퀴 그립을 되찾는다'); coach.cd = 3; return; }
    if (kmax > 0.018 && ki !== coach.lastCorner) {
      var vRec = Math.sqrt(s.latMax * 0.9 / kmax), dist = ((ki - i) % L.N + L.N) % L.N * 3;
      if (T.speed > vRec * 1.08 && dist < T.stopDist + 12 && coach.cd <= 0) { hud.hint('제동! 이 코너 권장 ' + Math.round(vRec * 3.6) + 'km/h — 직선에서 줄이고 천천히 진입(슬로우 인)'); coach.cd = 4; coach.lastCorner = ki; }
    }
    if (here > 0.018 && coach.apexDone !== i && T.speed < Math.sqrt(s.latMax * 0.9 / here) * 1.05 && coach.cd <= 0 && player.controls.throttle < 0.3) { hud.hint('정점(에이펙스) — 핸들을 풀면서 가속(패스트 아웃)'); coach.apexDone = i; coach.cd = 4; }
  }
  // 학습 모드 「체험하기」: 순찰 근무로 시작한 뒤 해당 상황을 만든다
  G.startScenario = function (id) {
    start(settings.car, 'patrol'); var xs = city.xs, zs = city.zs, N22 = city.nodes[2][2];
    if (id === 'signal') { player.teleport(xs[2] + 2, zs[2] + 48, Math.PI); signals.set(N22, 'h', 'red'); traffic.spawn({ at: { x: xs[2] - 70, z: zs[2] - 2, d: 1, node: N22 }, v: 9, violator: true, straight: true }); hud.notice('체험 · 신호위반: 왼쪽에서 적색에 정지선을 넘는 차가 온다 — 터치해서 단속', 'info', 6000); }
    else if (id === 'pedestrian') { player.teleport(xs[2] + 2, zs[2] + 60, Math.PI); signals.set(N22, 'v', 'red'); for (var k = 0; k < 3; k++) peds.spawn({ at: { x: xs[2] - 9 + k * 2, z: zs[2] - 12, axis: 'h', coord: zs[2], side: -1, d: 1 }, jaywalker: false }); traffic.spawn({ at: { x: xs[2] - 2, z: zs[2] - 60, d: 0, node: N22 }, v: 10, violator: false, straight: true, pedViolator: true }); hud.notice('체험 · 보행자 보호: 횡단보도에 보행자가 있는데 통과하는 차를 터치해서 단속. 순찰차도 정지선 앞에서 멈춘다', 'info', 6000); }
    else if (id === 'centerline') { var cE = terrain.connE, p10 = cE.P(10); player.teleport(p10.x + p10.rx * 2, p10.z + p10.rz * 2, Math.atan2(p10.tx, p10.tz)); traffic.spawn({ atLink: { link: cE, i: 40, dirA: false }, lane: 0, v: 12, type: 'sedan', stayRing: true }); hud.notice('체험 · 중앙선: 왕복 2차로 교외 길, 황색 중앙선을 넘으면 감점 — 마주 오는 차에 주의', 'info', 6000); }
    else if (id === 'speed') { var R = terrain.ring, rp = R.P(30); player.teleport(rp.x + rp.rx * 5.5, rp.z + rp.rz * 5.5, Math.atan2(rp.tx, rp.tz)); player.vx = rp.tx * 22; player.vz = rp.tz * 22; player.resync(); hud.notice('체험 · 과속: 순환고속도로 제한 100 — 120km/h 이상은 12대 중과실(20km/h 초과)', 'info', 6000); }
    else if (id === 'school') { player.teleport(xs[1] + 2, zs[3] + 40, Math.PI); hud.notice('체험 · 어린이보호구역: 앞 학교 블록 주변은 30km/h. 무신호 횡단보도 앞 일시정지', 'info', 6000); }
    camInit = false;
  };
  function setPaused(on, reason) {
    G.pauseReasons[reason] = on;
    var any = false; for (var k in G.pauseReasons) if (G.pauseReasons[k]) any = true;
    G.paused = any;
    if (reason === 'menu') hud.showPause(on);
    if (any) TG.audio.setSiren(false); else if (player && player.siren) TG.audio.setSiren(true);
  }
  G.setPaused = setPaused;
  function addScore(delta, reason) {
    G.score += delta; hud.setScore(G.score); hud.setStops(G.stats.stops);
    if (delta < 0 && reason) { penaltyTotal += delta; penaltyCount[reason] = (penaltyCount[reason] || 0) + 1; }
  }
  G.addScore = addScore;
  function penalize(key, text, teach) {
    if (G.mode !== 'patrol' && key !== 'crash' && key !== 'pedestrian') { if (teach) hud.hint(teach); return; }   // 자유 주행·서킷: 사고 외 감점 없음(안내만)
    addScore(C.SCORE[key], key); hud.notice(text + ' (' + C.SCORE[key] + ')', 'bad', 2600); if (teach) hud.hint(teach); TG.audio.bad(); }
  function onTrafficEvent(kind, car) {
    if (kind === 'witness') {
      var name = { buslane: '버스전용차로 위반', pedestrian: '보행자 보호의무 위반(횡단보도)', signal: '신호위반' }[car.violation.type] || car.violation.type;
      hud.notice('위반 의심: ' + name + ' — 대상 차량 표시', 'alert', 3200); TG.audio.alert(); if (G.stats) G.stats.witnessed++;
    }
  }
  function onPedEvent(kind, p) {
    if (kind === 'jaywalk' && player && G.state === 'play') {
      var d = Math.hypot(p.pos.x - player.pos.x, p.pos.z - player.pos.z);
      if (d < 60 && rules.jayCd <= 0) { rules.jayCd = 6; hud.notice('무단횡단 보행자 — 감속! 경광등 켜고 옆에 서면 계도', 'warn', 3000); }
    }
  }
  function endShift(reason) {
    if (G.state !== 'play') return;
    G.state = 'end'; player.setSiren(false); TG.audio.setSiren(false);
    var lessons = { redLight: '신호는 경찰이 먼저 지킨다', speeding: '제한속도 준수 — 정지거리는 속도의 제곱', centerline: '중앙선은 넘지 않는다', crash: '앞차와 2초 이상 — 1초 미만이면 급제동 시 추돌',
                    cornerFail: '코너 진입 전에 속도를 줄인다', pedestrian: '횡단보도 앞에서는 언제나 멈출 준비', water: '도로를 벗어나지 않는다' };
    var worst = null, wc = 0; for (var k in penaltyCount) if (penaltyCount[k] > wc) { wc = penaltyCount[k]; worst = k; }
    var lesson = worst ? lessons[worst] : (G.stats.stops ? '위반을 직접 목격한 차량만 세운다' : '경광등을 켜고 위반 차량 뒤에 붙으면 우측으로 정차한다');
    G.stats.score = G.score; G.stats.penalty = penaltyTotal; G.stats.lesson = lesson; G.stats.reason = reason || '';
    var best = TG.save.get('best', null);
    if (!best || G.score > best.score) { best = { score: G.score, stops: G.stats.stops, date: new Date().toISOString().slice(0, 10) }; TG.save.set('best', best); }
    TG.save.set('last', { score: G.score, stops: G.stats.stops, correct: G.stats.correct, penalty: penaltyTotal, date: new Date().toISOString().slice(0, 10) });
    hud.showEnd(G.stats); hud.setTarget(null);
    log('근무 종료: ' + G.score + '점, 단속 ' + G.stats.stops + '건' + (reason ? ' (' + reason + ')' : ''));
  }
  G.endShift = endShift;

  // ---------- 규칙 ----------
  function checkRules(dt, frame) {
    var T = player.telemetry, kmh = player.speedKmh();
    var exempt = player.siren && (enforcement.target || traffic.cars.some(function (c) { return !!c.violation; }));
    hud.setSection(frame.name, frame.kind === 'off' ? '—' : frame.limit);
    // 1) 신호위반(격자에서만)
    if (frame.kind === 'grid') {
      var d = TG.headingToDir(player.heading), f = TG.DIR_VEC[d];
      var node = city.nodeAhead(player.pos.x, player.pos.z, d, -16);
      if (node && Math.abs(frame.lateral) < frame.half) {
        var dist = (node.x - player.pos.x) * f[0] + (node.z - player.pos.z) * f[1] - city.stopDist(node, d);
        if (rules.prevNode === node && rules.prevDist > 0 && dist <= 0 && player.vF > 1.5) {
          var st = signals.state(node, (d === 0 || d === 2) ? 'v' : 'h');
          if (st.s === 'red' && st.elapsed > 0.6 && !exempt) penalize('redLight', '신호위반 — 경찰이 먼저 지킨다', '적색 신호에서는 정지선 앞에 멈춘다');
          else if (st.s === 'red' && exempt) hud.hint('긴급 출동: 교차로는 서행하며 좌우를 확인한다');
        }
        rules.prevNode = node; rules.prevDist = dist;
      } else rules.prevNode = null;
    } else rules.prevNode = null;
    // 2) 과속(구간 제한속도)
    if (frame.kind !== 'off' && kmh > frame.limit + C.SPEED_TOLERANCE_KMH && !exempt) {
      rules.speedT += dt;
      if (rules.speedT > 2) { penalize('speeding', '과속(' + frame.name + ' 제한 ' + frame.limit + ') — 경찰이 먼저 지킨다', '이 속도의 정지거리 ' + Math.round(T.stopDist) + 'm'); rules.speedT = -10; }
    } else rules.speedT = Math.max(Math.min(rules.speedT, 0), rules.speedT - dt);
    // 3) 중앙선 침범
    var nearNode = frame.kind === 'grid' && city.distToNearestNode(player.pos.x, player.pos.z) < 13;
    if (frame.kind !== 'off' && frame.onRoad && !nearNode && !frame.oneWay && frame.lateral < -0.45 && player.vF > 1) {
      rules.clT += dt;
      if (rules.clT > 1.0) { penalize('centerline', '중앙선 침범 — 경찰이 먼저 지킨다', '노란 중앙선 오른쪽으로 달린다'); rules.clT = -6; }
    } else rules.clT = Math.max(Math.min(rules.clT, 0), rules.clT - dt);
    // 4) 코너 한계
    rules.cornerCd -= dt;
    hud.vignette(T.ratio > 0.8 ? (T.ratio - 0.8) * 2.5 : 0);
    if (T.ratio > 0.8 && rules.cornerCd <= -4 && player.vF > 5) { hud.hint('코너 한계 ' + Math.round(T.ratio * 100) + '% — 속도를 줄이면 그립이 돌아온다'); rules.cornerCd = -3; }
    var offLane = frame.kind !== 'off' && (frame.lateral < -0.6 || frame.lateral > frame.half + 0.3 || player.lastImpact > 2);
    if (T.understeer && offLane && rules.cornerCd <= 0) {
      var safe = Math.sqrt(T.limit / Math.max(1e-4, Math.abs(T.kappa))) * 3.6;
      penalize('cornerFail', '코너 이탈', '이 코너의 안전 속도는 ' + Math.round(Math.min(safe, 150)) + 'km/h였다'); rules.cornerCd = 6;
    }
    // 5) 안전거리
    var lead = leadForPlayer();
    if (lead && T.speed > 2.5 && lead.sec < 6) {
      hud.setGap(lead.sec); rules.gapWarnCd -= dt;
      if (lead.sec < 1 && rules.gapWarnCd <= 0) { hud.hint('앞차와 1초 미만 — 급제동 시 추돌한다'); rules.gapWarnCd = 4; }
      else if (lead.sec < 2 && rules.gapWarnCd <= 0) { hud.hint('앞차와 2초 이상 띄우자'); rules.gapWarnCd = 5; }
    } else hud.setGap(null);
    G.lead = lead;
    // 6) 버스전용차로(플레이어): 안내만
    rules.busHintCd -= dt;
    if (frame.kind === 'link' && frame.busLane && !player.siren && kmh > 10 && rules.busHintCd <= 0) { hud.hint('1차로는 버스전용차로 — 순찰차도 긴급 상황이 아니면 2차로로'); rules.busHintCd = 15; }
    // 7) 물에 빠짐 → 마지막 도로 위치로
    rules.saveT -= dt;
    if (frame.onRoad && T.speed < 25 && rules.saveT <= 0) { rules.saveT = 0.5; rules.lastRoad = { x: player.pos.x, z: player.pos.z, h: player.heading }; }
    // 구덩이·경사에 빠져 못 나오거나(가속해도 3초 이상 제자리) 도로 밖 낮은 곳에 2.5초 이상 있으면 마지막 도로로 복귀
    var pushing = (player.controls.throttle > 0.3 || player.controls.reverse > 0) && T.speed < 0.4;
    rules.stuckT = pushing ? (rules.stuckT || 0) + dt : 0;
    var pit = !frame.onRoad && (player.y < -0.6 || Math.abs(T.slope) > 0.42);
    rules.pitT = pit ? (rules.pitT || 0) + dt : 0;
    var B = city.bounds, outside = player.pos.x < B.x0 || player.pos.x > B.x1 || player.pos.z < B.z0 || player.pos.z > B.z1;
    if (rules.stuckT > 3 || rules.pitT > 2.5 || outside) { rules.stuckT = 0; rules.pitT = 0; recoverToRoad(outside ? '지도 밖 — 마지막 도로 위치로 복귀' : '도로 밖에 빠졌습니다 — 마지막 도로 위치로 복귀'); }
    if (terrain.isWater(player.pos.x, player.pos.z) && !frame.onRoad) {
      addScore(-5, 'water'); hud.notice('도로 이탈(물) — 마지막 도로 위치로 복귀 (-5)', 'bad', 3000); TG.audio.bad();
      player.teleport(rules.lastRoad.x, rules.lastRoad.z, rules.lastRoad.h); camInit = false;
    }
    // 8) 무단횡단 보행자 계도
    rules.jayCd -= dt;
    if (player.siren && T.speed < 0.5) { var wp = peds.tryWarn(player); if (wp) { addScore(8, null); G.stats.warned++; hud.notice('무단횡단 보행자 계도 (+8)', 'good', 2600); hud.hint('횡단보도로 건너도록 안내했다'); TG.audio.good(); } }
  }
  function leadForPlayer() {
    var pf = player.forward(), rx = -pf[1], rz = pf[0], best = null;
    for (var i = 0; i < traffic.cars.length; i++) {
      var c = traffic.cars[i], dx = c.pos.x - player.pos.x, dz = c.pos.z - player.pos.z, along = dx * pf[0] + dz * pf[1], lat = dx * rx + dz * rz;
      if (along <= 0 || along > 90 || Math.abs(lat) > 2.2) continue;
      var cf = [Math.sin(c.heading), Math.cos(c.heading)]; if (cf[0] * pf[0] + cf[1] * pf[1] < 0.5 && c.v > 1) continue;
      var gap = along - (player.len / 2 + c.len / 2);
      if (!best || gap < best.gap) best = { car: c, gap: gap, sec: gap / Math.max(player.telemetry.speed, 0.1) };
    }
    return best;
  }

  // ---------- 충돌 ----------
  function circlesOf(e, len, wid) { var f = [Math.sin(e.heading), Math.cos(e.heading)], off = len / 2 - wid * 0.55; return [{ x: e.pos.x + f[0] * off, z: e.pos.z + f[1] * off }, { x: e.pos.x - f[0] * off, z: e.pos.z - f[1] * off }]; }
  function collisions(dt) {
    rules.crashCd -= dt;
    var pr = player.wid * 0.55;
    for (var i = 0; i < traffic.cars.length; i++) {
      var c = traffic.cars[i];
      if (Math.abs(c.pos.x - player.pos.x) > 12 || Math.abs(c.pos.z - player.pos.z) > 12) continue;
      var pc = circlesOf(player, player.len, player.wid), cc = circlesOf(c, c.len, c.wid), cr = c.wid * 0.55, rr = pr + cr;
      if (c.isBus) { cc.push({ x: c.pos.x, z: c.pos.z }); }
      for (var a = 0; a < 2; a++) for (var b = 0; b < cc.length; b++) {
        var dx = cc[b].x - pc[a].x, dz = cc[b].z - pc[a].z, d2 = dx * dx + dz * dz;
        if (d2 >= rr * rr || d2 < 1e-6) continue;
        var d = Math.sqrt(d2), nx = dx / d, nz = dz / d, ov = rr - d;
        player.pos.x -= nx * ov * 0.6; player.pos.z -= nz * ov * 0.6; c.pos.x += nx * ov * 0.4; c.pos.z += nz * ov * 0.4;
        var cf = [Math.sin(c.heading), Math.cos(c.heading)], closing = (player.vx - cf[0] * c.v) * nx + (player.vz - cf[1] * c.v) * nz;
        if (closing > 0) {
          player.vx -= nx * closing * 0.8; player.vz -= nz * closing * 0.8; player.resync(); c.v = Math.max(0, c.v - closing * 0.3);
          if (closing > 2.5 && rules.crashCd <= 0) {
            rules.crashCd = 1.5; TG.audio.thump(closing / 10);
            var teach = (G.lead && G.lead.car === c && G.lead.sec < 1.2) ? '1초 미만 간격에서는 사람의 반응 시간(약 1초) 안에 못 멈춘다' : '차량 접촉 — 속도를 줄이고 간격을 둔다';
            penalize('crash', '차량 접촉', teach); G.lastCrash = { car: c.id, closing: closing, t: performance.now() };
          }
        }
      }
    }
    if (player.lastImpact > 3 && rules.crashCd <= 0) { rules.crashCd = 1.5; TG.audio.thump(player.lastImpact / 12); penalize('crash', '구조물 충돌', null); }
    for (var k = 0; k < peds.peds.length; k++) {
      var p = peds.peds[k];
      if (Math.hypot(p.pos.x - player.pos.x, p.pos.z - player.pos.z) < player.radius + 0.5 && player.telemetry.speed > 1.0) {
        addScore(C.SCORE.pedestrian, 'pedestrian'); hud.notice(p.jayLive ? '보행자 사고 — 신호위반 보행자라도 사람을 치면 근무 종료' : '보행자 사고 — 근무 종료', 'bad', 5000); TG.audio.thump(1);
        endShift('보행자 사고 — 사람을 치면 즉시 임무 실패'); return;
      }
    }
  }

  // ---------- 카메라 ----------
  function updateCamera(dt) {
    var f = player.forward(), sp = player.telemetry.speed, portrait = document.body.classList.contains('portrait');
    if (settings.cam === 'cockpit') {
      // 운전석 눈 위치에서 전방. 차체 피치·롤을 살짝만 따라가고(멀미 방지) 요는 즉시 따른다.
      var E = player.layout.eye, yaw = G.lookYaw || 0;
      // 둘러보기: 눈을 중심으로 머리를 yaw 만큼 돌린 방향(차체 로컬)으로 14m 앞을 본다
      var eye = player.eyeWorld(E), ahead = player.eyeWorld({ x: E.x + Math.sin(yaw) * 14 * 1.0 + (yaw === 0 ? -E.x * 0.5 : 0), y: E.y - 14 * Math.tan(C.CAM_COCKPIT.lookDown), z: E.z + Math.cos(yaw) * 14 });
      if (!camInit) { camPos.copy(eye); camLook.copy(ahead); camInit = true; }
      var kc = 1 - Math.exp(-30 * dt);
      camPos.lerp(eye, kc); camLook.lerp(ahead, kc);
      camera.position.copy(camPos); camera.lookAt(camLook);
      world.followSun(player.pos.x, player.pos.z);
      return;
    }
    // PC 와이드(가로 1.6배 이상): 조금 더 뒤·위에서 넓게 본다
    var wide = window.innerWidth / window.innerHeight >= 1.6;
    var back = C.CAM_BACK + 1.0 + sp * C.CAM_BACK_PER_MS + (portrait ? 1.8 : 0) + (wide ? 1.4 : 0), up = C.CAM_UP + 0.4 + sp * 0.02 + (portrait ? 1.4 : 0) + (wide ? 0.5 : 0);
    var tx = player.pos.x - f[0] * back, tz = player.pos.z - f[1] * back, ty = player.y + up;
    var lx = player.pos.x + f[0] * 7, lz = player.pos.z + f[1] * 7, ly = player.y + 1.0;
    if (!camInit) { camPos.set(tx, ty, tz); camLook.set(lx, ly, lz); camInit = true; }
    var k = 1 - Math.exp(-C.CAM_LERP * dt);
    camPos.x += (tx - camPos.x) * k; camPos.y += (ty - camPos.y) * k; camPos.z += (tz - camPos.z) * k;
    camLook.x += (lx - camLook.x) * k * 1.4; camLook.y += (ly - camLook.y) * k; camLook.z += (lz - camLook.z) * k * 1.4;
    // 카메라가 지형 밑으로 들어가지 않게
    var gy = terrain.heightAt(camPos.x, camPos.z) + 1.2; if (camPos.y < gy) camPos.y = gy;
    camera.position.copy(camPos); camera.lookAt(camLook);
    world.followSun(player.pos.x, player.pos.z);
  }

  function recoverToRoad(msg) {
    if (!player || !rules) return;
    hud.notice(msg || '마지막 도로 위치로 복귀', 'info', 3000); TG.audio.ui();
    player.teleport(rules.lastRoad.x, rules.lastRoad.z, rules.lastRoad.h); player.vx = 0; player.vz = 0; player.vF = 0; player.vL = 0; player.resync(); camInit = false;
  }
  function update(dt) {
    var inp = input.read();
    player.controls.steer = inp.steer; player.controls.throttle = inp.throttle; player.controls.brake = inp.brake; player.controls.reverse = inp.reverse;
    if (G.testOverride) { for (var k in G.testOverride) player.controls[k] = G.testOverride[k]; }
    player.assist = settings.assist !== false; player.surfaceFactor = weather.grip;
    weather.update(dt, camera.position);
    if (settings.cam === 'cockpit') { var fr0 = city.frameAt(player.pos.x, player.pos.z, player.heading), sus = 0; for (var si = 0; si < traffic.cars.length; si++) if (traffic.cars[si].violation && traffic.cars[si].violation.seen) sus++; player.mdtInfo = { score: G.score, stops: G.stats.stops, suspects: sus, target: enforcement.state === 'idle' ? '' : enforcement.state === 'yielding' ? '정차 유도 중' : enforcement.state === 'stopped' ? '대상 정차' : enforcement.state === 'release' ? '고지 완료' : '', limit: fr0.limit, section: fr0.name, gap: G.lead ? Math.round(G.lead.gap) + 'm · ' + G.lead.sec.toFixed(1) + 's' : '', time: hud.fmtTime ? hud.fmtTime(G.timeLeft) : '' }; }
    player.update(dt);
    signals.update(dt);
    traffic.update(dt, TG.perf.budget(C.TRAFFIC_MAX));
    traffic.separate();
    peds.update(dt, TG.perf.budget(C.PED_MAX));
    collisions(dt);
    if (G.state !== 'play') return;
    enforcement.update(dt);
    var frame = city.frameAt(player.pos.x, player.pos.z, player.heading); G.frame = frame;
    checkRules(dt, frame);
    updateCamera(dt);
    hud.tick(dt);
    updateSelection();
    // 둘러보기: Q(왼쪽)/E(오른쪽) 누르는 동안, 또는 드래그 중. 놓으면 정면으로 복귀
    var lk = (input.held.KeyQ ? 1 : 0) - (input.held.KeyE ? 1 : 0);
    if (lk !== 0) G.lookYaw = TG.clamp(G.lookYaw + lk * 3.0 * dt, -C.CAM_COCKPIT.lookMax, C.CAM_COCKPIT.lookMax);
    else if (!G.lookHold) G.lookYaw += (0 - G.lookYaw) * Math.min(1, dt * 6);
    var T = player.telemetry;
    hud.setSpeed(player.speedKmh(), T.stopDist, frame.kind === 'off' ? 999 : frame.limit);
    hud.setGear(player.gear);
    minimap.draw(player, traffic.cars, enforcement.target);
    TG.audio.update(dt, TG.clamp(T.speed / player.spec.maxSpeed, 0, 1), player.controls.throttle, T.skid, player.speedKmh(), player.controls.brake > 0 || (player.controls.throttle === 0 && T.speed > 3));
    if (G.mode === 'patrol') { G.timeLeft -= dt; hud.setTimer(Math.max(0, G.timeLeft)); if (G.timeLeft <= 0) endShift('근무 시간 종료'); }
    else { lapUpdate(dt); if (G.mode === 'circuit') coachUpdate(dt); }
  }

  function loop(now) {
    requestAnimationFrame(loop);
    var raw = now - lastT; lastT = now;
    var dt = Math.min(0.05, raw / 1000);
    if (G.state === 'play') {
      if (!G.paused) { TG.perf.sample(raw); TG.perf.update(dt); update(dt); }
      else if (G.pauseReasons.ticket) enforcement.tickTicket(dt);
    } else if (G.state === 'intro') {
      intro.t += dt;
      if (!intro.theme && TG.audio.running) intro.theme = TG.audio.introTheme(intro.t);   // 브라우저가 소리를 풀어 주는 순간(첫 터치)부터 테마를 이어서 연주
      var isnd = document.getElementById('introSound'); if (isnd) isnd.style.display = TG.audio.running ? 'none' : 'block';
      var idx = -1; for (var i = 0; i < intro.lines.length; i++) if (intro.t >= intro.lines[i].at) idx = i;
      if (idx !== intro.idx) { intro.idx = idx; hud.introLines(intro.lines, idx); }
      introCamera(intro.t);
      signals.update(dt); traffic.player = player; peds.player = player;
      traffic.update(dt, 14); traffic.separate(); peds.update(dt, 10);
      player.update(0.0001);
      if (intro.t > 13.5) endIntro();
    } else if (G.state === 'title' || G.state === 'end') {
      var t = now / 1000 * 0.25;
      if (G.state === 'title') { camera.position.set(player.pos.x + Math.cos(t) * 8.5, player.y + 2.4, player.pos.z + Math.sin(t) * 8.5); camera.lookAt(player.pos.x, player.y + 0.9, player.pos.z); player.update(0.0001); }
      else if (player) updateCamera(dt);
      signals.update(dt);
      if (G.state === 'title') { traffic.update(dt, 10); traffic.separate(); peds.update(dt, 8); }
    }
    input.clearPressed();
    if (player && settings.cam === 'cockpit' && G.state === 'play' && !G.paused) player.updateMirrors(renderer, scene);
    if (!noRender) renderFrame();
  }

  function installTestHooks() {
    TG.test = {
      start: function (car) { start(car || 'sedan'); },
      state: function () {
        var fr = player ? city.frameAt(player.pos.x, player.pos.z, player.heading) : null;
        return { state: G.state, paused: G.paused, score: G.score, stops: G.stats ? G.stats.stops : 0, cars: traffic.cars.length, peds: peds.peds.length,
                 enforcement: enforcement ? enforcement.state : null, perfScale: TG.perf.scale, shadows: TG.perf.shadows, laws: !!G.laws,
                 player: player ? { x: player.pos.x, z: player.pos.z, y: player.y, h: player.heading, kmh: player.speedKmh(), ratio: player.telemetry.ratio, siren: player.siren, offroad: player.telemetry.offroad, gear: player.gear, slope: player.telemetry.slope } : null,
                 frame: fr ? { kind: fr.kind, name: fr.name, lateral: fr.lateral, limit: fr.limit, onRoad: fr.onRoad, busLane: !!fr.busLane } : null,
                 lead: G.lead ? { gap: G.lead.gap, sec: G.lead.sec, carId: G.lead.car.id, carV: G.lead.car.v } : null, lastCrash: G.lastCrash || null,
                 target: enforcement && enforcement.target ? { id: enforcement.target.id, mode: enforcement.target.mode, violation: enforcement.target.violation, x: enforcement.target.pos.x, z: enforcement.target.pos.z, h: enforcement.target.heading } : null };
      },
      setPlayer: function (x, z, heading, speed) { player.teleport(x, z, heading); var f = player.forward(); player.vx = f[0] * speed; player.vz = f[1] * speed; player.resync(); camInit = false; },
      spawnLead: function (gap, speed, cruise) {
        var d = TG.headingToDir(player.heading), f = TG.DIR_VEC[d], r = [-f[1], f[0]], frame = city.laneFrame(player.pos.x, player.pos.z, player.heading);
        var N2 = city.nodeAhead(player.pos.x + f[0] * gap, player.pos.z + f[1] * gap, d, 0), N = city.nodeFrom(N2, (d + 2) % 4) || N2, x, z;
        var lo = city.laneOff(frame.axis, frame.idx, frame.lateral > 4 ? 1 : 0);
        if (frame.axis === 'v') { x = frame.center + r[0] * lo; z = player.pos.z + f[1] * gap; } else { z = frame.center + r[1] * lo; x = player.pos.x + f[0] * gap; }
        var car = traffic.spawn({ at: { x: x, z: z, d: d, node: N }, v: speed, cruise: cruise || speed, violator: false, straight: true, laneIdx: frame.lateral > 4 ? 1 : 0 });
        return car ? car.id : null;
      },
      carById: function (id) { for (var i = 0; i < traffic.cars.length; i++) if (traffic.cars[i].id === id) return traffic.cars[i]; return null; },
      brakeCar: function (id) { var c = this.carById(id); if (c) { c.cruise = 0; c.speedK = 0; } },
      clearTraffic: function () { while (traffic.cars.length) traffic.remove(traffic.cars[0]); },
      clearPeds: function () { while (peds.peds.length) peds.remove(peds.peds[0]); },
      spawnCarAt: function (x, z, d, node, v, violator, straight, pedViolator) { var c = traffic.spawn({ at: { x: x, z: z, d: d, node: node }, v: v, violator: !!violator, straight: straight !== false, pedViolator: !!pedViolator }); return c ? c.id : null; },
      spawnOnLink: function (linkId, i, dirA, lane, v, type) { var L = null; for (var k = 0; k < terrain.links.length; k++) if (terrain.links[k].id === linkId) L = terrain.links[k]; var c = traffic.spawn({ atLink: { link: L, i: i, dirA: dirA }, lane: lane, v: v, type: type, stayRing: true }); return c ? c.id : null; },
      spawnPedAt: function (x, z, axis, coord, side, d, jay) { return !!peds.spawn({ at: { x: x, z: z, axis: axis, coord: coord, side: side, d: d }, jaywalker: !!jay }); },
      setSignal: function (i, j, axis, s) { signals.set(city.nodes[i][j], axis, s); },
      signal: function (i, j, axis) { return signals.state(city.nodes[i][j], axis); },
      override: function (o) { G.testOverride = o; },
      siren: function (on) { if (player.siren !== on) toggleSiren(); },
      setSpawning: function (on) { C.TRAFFIC_MAX = on ? 18 : 0; C.PED_MAX = on ? 22 : 0; },
      simulateSlow: function (ms) { TG.perf.simulateSlow(ms); },
      ticketChoose: function (id) { var b = document.querySelector('#ticketOptions .opt[data-id="' + id + '"]'); if (b) b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); return !!b; },
      ticketClose: function () { hud.closeTicketNow(); },
      node: function (i, j) { return city.nodes[i][j]; },
      link: function (id) { for (var k = 0; k < terrain.links.length; k++) if (terrain.links[k].id === id) return terrain.links[k]; return null; },
      step: function (sec) {
        var n = Math.round(sec * 60);
        for (var i = 0; i < n; i++) {
          if (G.state !== 'play') break;
          if (!G.paused) { TG.perf.sample(1000 / 60); TG.perf.update(1 / 60); update(1 / 60); }
          else if (G.pauseReasons.ticket) enforcement.tickTicket(1 / 60);
        }
        return G.state;
      },
      render: function () { renderFrame(); return true; },
      info: function () { var r = renderer.info.render; return { calls: r.calls, triangles: r.triangles, frameMs: TG.perf.frameMs }; },
      intro: startIntro, endIntro: endIntro, introCamera: function (t) { introCamera(t); renderer.render(scene, camera); },
      camAt: function (x, y, z, lx, ly, lz) { camera.position.set(x, y, z); camera.lookAt(lx, ly, lz); renderer.render(scene, camera); },
      hintText: function () { return document.getElementById('hint').textContent; },
      noticeText: function () { return document.getElementById('notice').textContent; },
      city: city, traffic: traffic, peds: peds, signals: signals, game: G, input: input, terrain: terrain, camera: camera, pano: function () { return pano; }, settings: settings, resize: resize,
      startMode: function (car, mode) { start(car || 'sedan', mode); }, lap: function () { return lap; }, coach: function () { return coach; }, scenario: function (id) { G.startScenario(id); },
    };
    log('테스트 훅 설치: TG.test.*');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
