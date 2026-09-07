// 게임 루프·규칙·카메라·점수·인트로. 여기서 모든 모듈을 잇는다.
(function () {
  var C = TG.CONFIG;
  var G = TG.game = { state: 'boot', score: 0, timeLeft: C.SHIFT_SECONDS, cfg: C, laws: null, stats: null, paused: false, pauseReasons: {} };
  var renderer, scene, camera, canvas, city, world, terrain, signals, traffic, peds, player, input, enforcement, minimap, weather, hud = TG.hud;
  var settings = TG.save.get('settings', { hints: true, stopbar: true, sound: true, car: 'sedan' });
  if (typeof settings.hints !== 'boolean') settings = { hints: true, stopbar: true, sound: true, car: 'sedan' };
  // v2: 소유자 「운전이 너무 예민·어렵다」 → 차선 유지 보조·초보 운전 보조(자동 감속)를 모두에게 켠다(옛 저장값 무시)
  if ((settings.v || 0) < 2) { settings.assist = true; settings.easy = true; settings.v = 2; TG.save.set('settings', settings); }
  if (settings.cam !== 'cockpit') settings.cam = 'chase';
  if (!C.CARS[settings.car] && settings.car !== 'random') settings.car = 'random';
  if ((settings.v || 0) < 3) { settings.car = 'random'; settings.weather = 'auto'; settings.v = 3; TG.save.set('settings', settings); }   // v3: 소유자 「모두 랜덤, 날씨는 현재와」 → 차량 랜덤·날씨 자동(시계·계절, 티북 연동이면 실제 날씨)
  var rules = {}, camPos = new THREE.Vector3(), camLook = new THREE.Vector3(), camInit = false;
  var vfx = null, vfxT = 0, flares = null;   // 차량 감각 입자·플레어(js/vfx.js)
  var walker = null, walk = null, rail = null;   // 보행자 모드(walk/kid): walker = 도보 경찰관/어린이, walk = 규칙·목적지 상태. rail = 철길건널목
  function actor() { return walker || player; }   // 화면의 「나」: 보행자 모드면 걷는 경찰관, 아니면 순찰차
  function onFoot() { return G.mode === 'walk' || G.mode === 'kid'; }
  G.actor = actor;
  // 차량 선택 「랜덤」: 근무마다 다른 순찰차
  function carSpec(id) { if (id === 'random' || !C.CARS[id]) { var ks = Object.keys(C.CARS); return C.CARS[ks[Math.floor(Math.random() * ks.length)]]; } return C.CARS[id]; }
  var lastT = 0, penaltyTotal = 0, penaltyCount = {};
  var isStress = /[?&]stress=1/.test(location.search), isTest = /[?&]test=1/.test(location.search), noIntro = /[?&]nointro=1/.test(location.search), noRender = /[?&]norender=1/.test(location.search);
  var intro = { t: 0, lines: [], idx: -1, done: false };
  var FALLBACK_PURPOSE = '도로에서 일어나는 교통상의 위험과 장애를 방지하고 제거하여 안전하고 원활한 교통을 확보한다';

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
    if (!TG.WEATHERS[settings.weather]) settings.weather = 'auto';
    // 티북 연동: 티북의 「교통경찰GAME」 링크가 ?w=날씨종류&temp=기온&t=테마 를 붙여 오면 그 값으로 시간대·날씨를 맞춘다(설정보다 우선, 이번 실행만)
    (function () {
      var q = new URLSearchParams(location.search), w = q.get('w'), temp = q.get('temp'), th = q.get('t');
      if (!w && !temp && !th) return;
      var name = weather.fromTBook(w, temp, th);
      G.tbLink = { kind: w || '', temp: temp !== null && temp !== '' && !isNaN(parseFloat(temp)) ? Math.round(parseFloat(temp)) : null, theme: th || '', preset: name };
      log('티북 연동 날씨: ' + JSON.stringify(G.tbLink));
    })();
    weather.set(G.tbLink ? G.tbLink.preset : settings.weather);
    vfx = new TG.VFX(scene); G.vfx = vfx;
    signals = new TG.Signals(city, world, C);
    var rng = TG.makeRNG((Date.now() & 0xffff) + 1);
    traffic = new TG.Traffic(scene, city, signals, C, rng); traffic.terrain = terrain;
    rail = new TG.Rail(scene, terrain, terrain.conns[3], 22, C); traffic.rail = rail; G.rail = rail;   // 철길건널목: 서초대로 연장(서초IC 방향) 교외 구간
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
    player = new TG.PlayerCar(scene, city, C, carSpec(settings.car)); player.setSiren(true); G.player = player;
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
      { at: 0.6, text: '도로에서 일어나는 위험과 장애를 막고, 없애고,' },
      { at: 2.6, text: '안전하고 원활한 교통을 확보한다.' },
      { at: 4.4, text: cite + ' — ' + purpose, small: true },
      { at: 6.6, text: '그 목적을 매일 도로 위에서 실현하는 사람,' },
      { at: 8.4, text: '교통경찰.' },
      { at: 10.4, text: 'SEOUL PATROL', big: true },
      { at: 11.4, text: '서울교통 순찰근무 · 강남 · 서초 · 순환고속도로', small: true },
    ];
    hud.introLines(intro.lines, -1);
    hud.showIntro(true);
    TG.audio.setSiren(false);
  }
  function endIntro() { if (intro.done) return; intro.done = true; TG.audio.stopIntro(); hud.showIntro(false); showTitle(); }
  function showTitle() { document.body.classList.remove('onfoot'); document.body.classList.remove('kidmode'); G.state = 'title'; hud.showTitle(TG.save.get('best', null)); camInit = false; }
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
        if (G.state === 'title') { scene.remove(player.mesh); player = new TG.PlayerCar(scene, city, C, carSpec(settings.car)); player.setSiren(true); G.player = player; weather.attachPlayer(player.mesh, player.len); }
      });
    });
    input.bindTap($('btnStart'), function () { start(settings.car); });
    // 날씨·시간대: 타이틀 버튼 + 일시정지 메뉴 선택
    function applyWeather(name) { settings.weather = name; TG.save.set('settings', settings); weather.set(name === 'auto' || name === 'random' ? weather.pick(name) : name); document.querySelectorAll('.wpick').forEach(function (x) { x.classList.toggle('sel', x.getAttribute('data-weather') === name); }); var ow = $('optWeather'); if (ow) ow.value = name; }
    document.querySelectorAll('.wpick').forEach(function (b) { input.bindTap(b, function () { applyWeather(b.getAttribute('data-weather')); }); });
    if ($('optWeather')) $('optWeather').addEventListener('change', function () { applyWeather($('optWeather').value); });
    applyWeather(settings.weather);
    // 모드: 순찰 근무 / 자유 주행 / 연습 서킷 / 학습(12항목 카드 → 체험)
    function applyMode(name) { if (name === 'study') { if (TG.study) TG.study.open(G); return; } if (settings.mode !== name) TG.audio.whoosh(); settings.mode = MODES[name] ? name : 'patrol'; TG.save.set('settings', settings); document.querySelectorAll('.mpick').forEach(function (x) { x.classList.toggle('sel', x.getAttribute('data-mode') === settings.mode); }); }
    document.querySelectorAll('.mpick').forEach(function (b) { input.bindTap(b, function () { applyMode(b.getAttribute('data-mode')); }); });
    applyMode(settings.mode || 'patrol');
    // 조작 배치: 조이스틱(원형 스틱 + 버튼) / 게임패드(십자키 + △○×□ + L1·R1). 타이틀 버튼 · 일시정지 선택 · 설명 창에서 고른다
    function applyCtl(name) {
      settings.ctl = name === 'pad' ? 'pad' : 'stick'; TG.save.set('settings', settings);
      document.body.classList.toggle('padctl', settings.ctl === 'pad');
      document.querySelectorAll('.cpick[data-ctl]').forEach(function (x) { x.classList.toggle('sel', x.getAttribute('data-ctl') === settings.ctl); });
      var oc = $('optCtl'); if (oc) oc.value = settings.ctl;
    }
    G.applyCtl = applyCtl;
    document.querySelectorAll('.cpick[data-ctl]').forEach(function (b) { input.bindTap(b, function () { applyCtl(b.getAttribute('data-ctl')); }); });
    if ($('optCtl')) $('optCtl').addEventListener('change', function () { applyCtl($('optCtl').value); });
    applyCtl(settings.ctl || 'stick');
    function showCtlHelp(on) { var e = $('ctlHelp'); if (!e) return; e.style.display = on ? 'flex' : 'none'; if (G.state === 'play') setPaused(on, 'help'); }
    G.showCtlHelp = showCtlHelp;
    input.bindTap($('btnCtlHelp'), function () { showCtlHelp(true); }); input.bindTap($('btnCtlHelp2'), function () { showCtlHelp(true); }); input.bindTap($('btnCtlHelpClose'), function () { showCtlHelp(false); });
    input.onGamepad = function (on, id) { hud.notice(on ? '🎮 게임패드 연결: ' + (id || '').slice(0, 28) + ' — 왼쪽 스틱 조향 · RT 가속 · LT 브레이크 · □ 단속 · △ 앰프' : '게임패드 연결 해제', 'info', 4500); log('게임패드 ' + (on ? '연결 ' + id : '해제')); };
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
    var optE = $('optEasy');
    if (optE) { optE.checked = settings.easy !== false; optE.addEventListener('change', function () { settings.easy = optE.checked; TG.save.set('settings', settings); }); }
    // 음량(기본 30% — 은은하게). 마스터 게인에 바로 반영
    if (typeof settings.volume !== 'number') settings.volume = 0.3;
    var optV = $('optVolume'), optVV = $('optVolumeVal');
    if (optV && optVV) { optV.value = Math.round(settings.volume * 100); optVV.textContent = optV.value + '%'; }
    TG.audio.setVolume(settings.volume);
    if (optV) optV.addEventListener('input', function () { settings.volume = optV.value / 100; optVV.textContent = optV.value + '%'; TG.audio.setVolume(settings.volume); TG.save.set('settings', settings); });
    // 앰프(확성기): 버튼·M 키. 누를 때마다 안내 문구를 돌아가며 방송
    var PA_LINES = ['앞 차량, 우측 가장자리에 정차하십시오', '서행하십시오, 전방에 보행자가 있습니다', '무단횡단은 위험합니다, 횡단보도를 이용하십시오', '순찰 중입니다, 안전 운전 부탁드립니다'];
    var paIdx = 0;
    // 앰프는 대상을 가려 방송한다: 가까운 무단횡단 보행자 → 보행자용, 위반 차량(이륜차·자전거는 따로) → 차량용, 없으면 일반 안내를 돌아가며.
    function paTarget() {
      var me = actor(), best = null, bd = 1e9, pf = me.forward();
      peds.peds.forEach(function (p) { var recent = p.jayLive || (p.jayDone && p.jayT < 12); if (!recent || p.warned) return; var d = Math.hypot(p.pos.x - me.pos.x, p.pos.z - me.pos.z); if (d < 45 && d < bd) { bd = d; best = { kind: 'ped', ped: p }; } });
      traffic.cars.forEach(function (c) { if (!c.violation && !c.trait) return; var dx = c.pos.x - me.pos.x, dz = c.pos.z - me.pos.z, d = Math.hypot(dx, dz); if (d < 60 && dx * pf[0] + dz * pf[1] > -3 && d < bd) { bd = d; best = { kind: 'car', sub: c.isMoto ? 'moto' : c.isBike ? 'bike' : 'car', car: c }; } });
      return best;
    }
    function pa() {
      if (G.state !== 'play') return; TG.audio.resume();
      var tgt = paTarget(), line;
      if (tgt && tgt.kind === 'ped') line = tgt.ped.jayKind === 'red' ? '보행자, 정지하세요. 보행 신호를 기다리세요' : '보행자, 정지하세요. 횡단보도로 건너세요';
      else if (tgt && tgt.sub === 'bike') line = '자전거, 정지하세요. 내려서 끌고 가세요';
      else if (tgt && tgt.sub === 'moto') line = '이륜차, 정지하세요. 우측 가장자리에 정차하십시오';
      else if (tgt && tgt.kind === 'car') line = (tgt.car.isBus ? '앞 버스' : tgt.car.type === 'truck' ? '앞 화물차' : '앞 차량') + ', 우측 가장자리에 정차하십시오';
      else { line = PA_LINES[paIdx % PA_LINES.length]; paIdx++; }
      TG.audio.pa(line); hud.notice('📢 ' + line, 'info', 2400);
      if (tgt) selectTarget(tgt);
    }
    input.bindTap($('btnPA'), pa);
    input.onKey('KeyM', pa);
    // 미니맵 확대·축소: 미니맵 터치(단계 순환) · +/- 키
    input.onKey('Equal', function () { if (minimap) minimap.setZoom(minimap.zoom * 2); });
    input.onKey('Minus', function () { if (minimap) minimap.setZoom(minimap.zoom / 2); });
    // 방향지시등: , / . 키 · 좌우 버튼. 같은 쪽을 다시 누르면 끈다. 회전이 끝나거나 8초가 지나면 자동으로 꺼진다(checkRules).
    function setSignal(side) {
      if (!player || G.state !== 'play') return;
      player.signal = player.signal === side ? null : side; player.sigT = 0; player.sigHead = player.heading; player.sigAge = 0;
      $('btnSigL').classList.toggle('active', player.signal === 'L'); $('btnSigR').classList.toggle('active', player.signal === 'R'); TG.audio.ui();
      document.querySelectorAll('[data-key="Comma"]').forEach(function (e) { e.classList.toggle('active', player.signal === 'L'); }); document.querySelectorAll('[data-key="Period"]').forEach(function (e) { e.classList.toggle('active', player.signal === 'R'); });
    }
    G.setSignal = setSignal; G.paOnce = function () { pa(); };
    input.bindTap($('btnSigL'), function () { setSignal('L'); }); input.bindTap($('btnSigR'), function () { setSignal('R'); });
    input.onKey('Comma', function () { setSignal('L'); }); input.onKey('Period', function () { setSignal('R'); });
    // 주행 모드: 노말 / 스포츠(일시정지 메뉴 · N 키)
    var optDr = $('optDrive');
    function applyDrive(m) { settings.drive = m === 'sport' ? 'sport' : 'normal'; TG.save.set('settings', settings); if (optDr) optDr.value = settings.drive; var dm = $('driveMode'); if (dm) { dm.textContent = settings.drive === 'sport' ? 'S' : 'N'; dm.classList.toggle('sport', settings.drive === 'sport'); } }
    if (optDr) optDr.addEventListener('change', function () { applyDrive(optDr.value); });
    input.onKey('KeyN', function () { applyDrive(settings.drive === 'sport' ? 'normal' : 'sport'); hud.notice(settings.drive === 'sport' ? '스포츠 모드 — 가속·조향 응답이 빨라집니다' : '노멀 모드', 'info', 1500); });
    applyDrive(settings.drive || 'normal');
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
        if (G.mode === 'kid') return;   // 어린이 교실: 단속 없음(이름표만)
        if (enforcement && enforcement.quiz(sel)) selectTarget(null);   // 터치 즉시 「무슨 위반?」 객관식(도보면 정답 뒤 수신호 정차)
        return;
      }
      selectTarget(null);
    });
    input.bindTap($('btnEnforce'), enforce);
    input.onKey('KeyF', enforce);
    // 손 들기(보행자·어린이 모드): ✋ 버튼 · G 키
    function raiseHand() { if (G.state === 'play' && walker) { walker.raiseHand(4); if (G.mode === 'kid') { hud.notice('✋ 손을 들었어요', 'good', 1200); TG.audio.ui(); kidSay('kidOk'); } } }
    input.bindTap($('btnHand'), raiseHand); input.onKey('KeyG', raiseHand);
    // 걷기/달리기 토글(보행자·어린이 모드): 스틱을 끝까지 밀어도 걷는다. 달리기는 이 버튼(또는 Shift·패드 A)으로만
    input.bindTap($('btnRun'), function () { input.runToggle = !input.runToggle; var b = $('btnRun'); b.classList.toggle('on', input.runToggle); b.querySelector('.ico').textContent = input.runToggle ? '🏃' : '🚶'; b.querySelector('span:last-child').textContent = input.runToggle ? '달리기' : '걷기'; TG.audio.ui(); if (G.mode === 'kid' && input.runToggle) kidVoice('norun', true); });
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
      var c = sel.car, tn = { sedan: '승용차', hatch: '승용차', suv: 'SUV', van: '승합차', truck: '화물차', bus: '버스', moto: '이륜차', bike: '자전거' }[c.type] || '차량';
      var vn = c.violation && enforcement && enforcement.nameOf ? enforcement.nameOf(c.violation.type) : null; var v = c.violation ? ((vn || { signal: '신호위반', pedestrian: '보행자 보호 위반', buslane: '버스전용차로 위반' }[c.violation.type] || '위반') + ' 의심') : '위반 없음(목격 안 됨)';
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
    var alive = s.kind === 'car' ? traffic.cars.indexOf(e) >= 0 : peds.peds.indexOf(e) >= 0, me = actor();
    if (!alive || Math.hypot(e.pos.x - me.pos.x, e.pos.z - me.pos.z) > 90) { selectTarget(null); return; }
    var y = s.kind === 'car' ? e.y : 0.2;
    selRing.position.set(e.pos.x, y + 0.08, e.pos.z);
    var sc = s.kind === 'car' ? (e.isBus ? 2.6 : 1.3) : 0.5; selRing.scale.set(sc, sc, 1);
  }
  // 「단속」: 선택 대상이 없으면 앞쪽 45m 안의 위반 의심 차량·보행자를 자동으로 고른다
  function enforce() {
    if (G.state !== 'play' || G.paused || !enforcement) return;
    if (G.mode === 'kid') { walker.raiseHand(4); hud.notice('✋ 손을 들었어요', 'good', 1200); kidSay('kidOk'); return; }
    if (onFoot()) {   // 도보: 선택한(또는 45m 안에서 목격한) 위반 차량 → 퀴즈 → 수신호 정차. 없으면 가까운 무단횡단 보행자 계도(+8)
      var selW = G.selected && G.selected.kind === 'car' ? G.selected : null;
      if (!selW) { var pfW = walker.forward(), bdW = 45; traffic.cars.forEach(function (c) { if (!c.violation) return; var dx = c.pos.x - walker.pos.x, dz = c.pos.z - walker.pos.z, d = Math.hypot(dx, dz); if (d < bdW && dx * pfW[0] + dz * pfW[1] > -2 && (c.mode === 'drive' || c.mode === 'release')) { bdW = d; selW = { kind: 'car', car: c }; } }); }
      if (selW) {
        var vNameW = selW.car.violation ? enforcement.nameOf(selW.car.violation.type) : null;
        if (vNameW) { hud.notice('🚨 위반 확인: ' + vNameW + ' — 수신호 정차', 'alert', 2600); TG.audio.resume(); TG.audio.pa('앞 차량, ' + vNameW + '. 정지하세요'); }
        selectTarget(selW); if (enforcement.quiz(selW)) selectTarget(null);
        return;
      }
      var wp2 = peds.tryWarn(walker);
      if (wp2) { addScore(8, null); G.stats.warned++; hud.setStops(G.stats.warned); hud.notice('무단횡단 보행자 계도 (+8)', 'good', 2600); TG.audio.resume(); TG.audio.pa('보행자, 횡단보도로 건너 주세요'); }
      else hud.notice('대상이 없습니다 — 위반 차량(45m 안)이나 무단횡단 보행자(9m 안)를 찾으세요', 'warn', 2400);
      return;
    }
    var sel = G.selected;
    if (!sel) {
      var pf = player.forward(), best = null, bd = 1e9;
      traffic.cars.forEach(function (c) { if (!c.violation) return; var dx = c.pos.x - player.pos.x, dz = c.pos.z - player.pos.z, d = Math.hypot(dx, dz); if (d < 45 && dx * pf[0] + dz * pf[1] > -2 && d < bd) { bd = d; best = { kind: 'car', car: c }; } });
      peds.peds.forEach(function (p) { var recent = p.jayLive || (p.jayDone && p.jayT < 12); if (!recent || p.warned) return; var d = Math.hypot(p.pos.x - player.pos.x, p.pos.z - player.pos.z); if (d < 20 && d < bd) { bd = d; best = { kind: 'ped', ped: p }; } });
      if (!best) { hud.notice('대상이 없습니다 — 화면에서 차량이나 보행자를 터치해 고르세요', 'warn', 2400); return; }
      sel = best; selectTarget(sel);
    }
    // 단속 버튼: 먼저 위반 사실을 알리고(화면·앰프) 단속 절차(객관식)로 들어간다
    var vName = sel.kind === 'car' ? (sel.car.violation ? (enforcement.nameOf ? enforcement.nameOf(sel.car.violation.type) : sel.car.violation.type) : null) : (sel.ped && (sel.ped.jayLive || sel.ped.jayDone) ? '무단횡단' : null);
    if (vName) { hud.notice('🚨 위반 확인: ' + vName + ' — 단속합니다', 'alert', 2600); TG.audio.resume(); TG.audio.pa((sel.kind === 'car' ? '앞 차량, ' : '보행자, ') + vName + '. 정지하세요'); }
    if (enforcement.quiz(sel)) selectTarget(null);
  }
  function toggleSiren() {
    if (G.state !== 'play' || !player || onFoot()) return;
    player.setSiren(!player.siren); TG.audio.resume(); TG.audio.setSiren(player.siren); hud.setSiren(player.siren);
  }

  function start(carId, modeOverride) {
    TG.audio.resume(); if (TG.study) TG.study.close();
    if (player) scene.remove(player.mesh);
    player = new TG.PlayerCar(scene, city, C, carSpec(carId));
    player.setView(settings.cam); weather.attachPlayer(player.mesh, player.len); if (vfx) flares = vfx.attachFlares(player.mesh, player.wid, player.len, 0.72);
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
    if (G.tbLink) { weather.set(G.tbLink.preset); hud.notice('티북 연동 · ' + weather.presets[G.tbLink.preset].label + (G.tbLink.temp !== null ? ' · ' + G.tbLink.temp + '°C' : '') + (G.tbLink.theme === 'dark' ? ' · 야간' : '') + (weather.grip < 1 ? ' — 노면이 미끄럽습니다' : ''), 'info', 4000); }
    else if (settings.weather === 'auto' || settings.weather === 'random') { var wpick = weather.pick(settings.weather); weather.set(wpick); hud.notice('날씨: ' + weather.presets[wpick].label + (wpick === 'windy' ? ' — 옆바람에 차가 밀립니다' : wpick === 'rain' || wpick === 'snow' ? ' — 노면이 미끄럽습니다' : ''), 'info', 3500); }
    if (walker) { if (walk && walk.officer) walk.officer.dispose(); walker.dispose(); walker = null; walk = null; peds.walker = null; }
    if (onFoot()) startWalk();
    if (G.mode === 'free') { G.timeLeft = 1e9; lap.link = terrain.ring; }
    if (G.mode === 'circuit') { G.timeLeft = 1e9; C.TRAFFIC_MAX = 0; C.PED_MAX = 0; lap.link = terrain.circuit; var cp0 = terrain.circuit.P(3); player.teleport(cp0.x + cp0.rx * 0.5, cp0.z + cp0.rz * 0.5, Math.atan2(cp0.tx, cp0.tz)); }
    G.stats = { score: 0, stops: 0, correct: 0, violatorStops: 0, witnessed: 0, penalty: 0, lesson: '', reason: '', warned: 0 };
    traffic.stats.violations = 0; traffic.stats.witnessed = 0;
    rules = { prevDist: null, prevNode: null, speedT: 0, clT: 0, cornerCd: 0, crashCd: 0, gapWarnCd: 0, busHintCd: 0, jayCd: 0, saveT: 0, lastRoad: { x: player.pos.x, z: player.pos.z, h: player.heading } };
    G.pauseReasons = {}; G.paused = false; G.lastCrash = null; G.lead = null; camInit = false;
    hud.hideTitle(); hud.hideEnd(); hud.showHud(true); hud.setScore(0); hud.setStops(0); hud.setTimer(G.timeLeft); hud.setSiren(false); hud.setTarget(null); hud.setGear('D');
    G.state = 'play'; TG.perf.reset();
    if (G.mode !== 'patrol' && G.mode !== 'walk') hud.setTimerText(G.mode === 'circuit' ? '출발선을 지나면 랩 시작' : '∞ 자유 주행');
    if (onFoot()) { document.getElementById('stopbarWrap').style.display = 'none'; hud.setTimer(G.timeLeft); walkGuide(); }
    else { document.getElementById('stopbarWrap').style.display = settings.stopbar ? '' : 'none'; document.getElementById('section').className = 'section'; }
    document.body.classList.toggle('onfoot', onFoot()); document.body.classList.toggle('kidmode', G.mode === 'kid');
    hud.notice(G.mode === 'kid' ? '어린이 보행 교실 — 횡단보도 앞에서 멈추고 ✋ 손을 들고, 초록불에 건너요. 노란 빛기둥까지 가요!' : onFoot() ? '보행자 체험 — 보행 신호(녹색 걷는 사람)에 횡단보도로 건너 목적지(노란 빛기둥)까지. 차에 닿으면 실패. 위반 차량을 터치하면 수신호 단속' : G.mode === 'free' ? '자유 주행 — 시간 제한·감점 없음. IC 로 나가 순환고속도로를 마음껏 달리세요(랩 타임 기록)' : G.mode === 'circuit' ? '연습 서킷 — 슬로우 인·패스트 아웃. 코너 앞 안내를 따라 달려 보세요(랩 타임 기록)' : '순찰 시작 — 안전 운전이 먼저입니다', 'info', 4000);
    log('근무 시작: ' + player.spec.name + ' / ' + G.mode);
    if (G.mode === 'walk') officerSay('도보 순찰 시작합니다. 보행 신호 확인하고 안전하게 건너세요');
  }
  var MODES = { patrol: '순찰 근무', free: '자유 주행', circuit: '연습 서킷', walk: '보행자 체험', kid: '어린이 보행 교실' }, BASE_TRAFFIC = C.TRAFFIC_MAX, BASE_PED = C.PED_MAX, lap = null, coach = null;
  // ---------- 보행자 모드 ----------
  // 순찰차는 강남대로 갓길에 세워 두고, 경찰관이 내려 걷는다. 목적지(사거리 모퉁이) 8곳을 차례로. 차량·행인 AI 는 걷는 경찰관을 보행자로 본다.
  function startWalk() {
    var xs = city.xs, zs = city.zs, rng = TG.makeRNG((Date.now() & 0xffff) + 7);
    player.teleport(xs[2] + city.shoulderOff('v', 2), zs[2] + 48, Math.PI); player.setSiren(false);
    var kid = G.mode === 'kid';
    walker = new TG.Walker(scene, city, terrain, C, { kid: kid }); G.walker = walker;
    traffic.player = walker; peds.player = walker; peds.walker = walker;
    G.timeLeft = C.WALK_SECONDS + (kid ? 120 : 0);
    if (kid) {
      // 어린이 보행 교실: 학교 블록(논현로·역삼로 어린이보호구역) 둘레. 학교 정문 → 놀이터 → 문방구 → 우리 집
      var SB = city.schoolBlock, nA = city.nodes[SB.i][SB.j], nB = city.nodes[SB.i + 1][SB.j], nC = city.nodes[SB.i][SB.j + 1], nD = city.nodes[SB.i + 1][SB.j + 1];
      function corner(n, sx, sz, name) { return { x: n.x + sx * (city.halfV[n.i] + 1.6), z: n.z + sz * (city.halfH[n.j] + 1.6), name: name }; }
      walker.teleport(xs[SB.i] + city.sideOff('v', SB.i), (nA.z + nC.z) / 2 + 10, Math.PI);
      walk = { dests: [corner(nA, 1, 1, '🏫 학교 정문'), corner(nB, 1, -1, '🛝 놀이터(공원)'), corner(nC, -1, -1, '✏️ 문방구'), corner(nD, 1, 1, '🏠 우리 집')], idx: 0, cross: null, jay: false, crossings: 0, arrived: 0, hintCd: 0, hitCd: 0, stars: 0, stopT: 0, voiceCd: 0, step: -1 };
      walk.officer = TG.Character.actor(scene, terrain, 'officer', walker.pos.x - 1.2, walker.pos.z + 1.4, Math.PI);   // 동행 교통경찰관(안내 목소리의 주인)
      walker.setMarker(walk.dests[0]); kidVoice('횡단보도 앞에서 멈추고, 손을 들고, 초록불에 건너요');
      return;
    }
    walker.teleport(xs[2] + city.sideOff('v', 2), zs[2] + 43, Math.PI);
    // 목적지: 이웃 사거리를 따라 이어지는 모퉁이들(같은 곳 반복 없음)
    var dests = [], ni = 2, nj = 2, used = {};
    for (var k = 0; k < C.WALK_DESTS; k++) {
      var tries = 0, nn;
      do { nn = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]][TG.irange(rng, 0, 7)]; tries++; }
      while (tries < 20 && (ni + nn[0] < 0 || ni + nn[0] >= xs.length || nj + nn[1] < 0 || nj + nn[1] >= zs.length || used[(ni + nn[0]) + ',' + (nj + nn[1])]));
      ni = TG.clamp(ni + nn[0], 0, xs.length - 1); nj = TG.clamp(nj + nn[1], 0, zs.length - 1); used[ni + ',' + nj] = true;
      var node = city.nodes[ni][nj], sx = rng() < 0.5 ? -1 : 1, sz = rng() < 0.5 ? -1 : 1;
      dests.push({ x: node.x + sx * (city.halfV[ni] + 1.6), z: node.z + sz * (city.halfH[nj] + 1.6), name: city.nodeName(node) + ' ' + (sz > 0 ? '남' : '북') + (sx > 0 ? '동' : '서') + ' 모퉁이' });
    }
    walk = { dests: dests, idx: 0, cross: null, jay: false, crossings: 0, arrived: 0, hintCd: 0, hitCd: 0 };
    walker.setMarker(dests[0]);
  }
  // 어린이 교실: 쉬운 말로 음성 안내(앰프와 같은 speechSynthesis, 없으면 차임). 너무 자주 말하지 않는다
  // 목소리: 어린이 교실의 안내는 따뜻한 선생님(경찰관) 목소리, 아이의 대답은 높은 목소리. 같은 뜻의 말을 여러 개 두고 돌려 쓴다(같은 말 반복 방지).
  var LINES = {
    stop: ['횡단보도예요. 먼저 멈춰요', '잠깐, 여기서 멈추자', '횡단보도 앞에서는 딱 멈추는 거예요'],
    hand: ['손을 번쩍 들어요', '자, 손을 높이 들어 볼까요?', '운전자가 잘 보이게 손을 들어요'],
    wait: ['빨간불. 초록불이 될 때까지 기다려요', '아직 빨간불이에요. 조금만 기다리자', '빨간불엔 기다리는 거예요'],
    go: ['초록불! 좌우를 보고 건너요', '초록불이에요. 왼쪽, 오른쪽 보고 건너요', '지금 건너요. 뛰지 말고 걸어요'],
    red: ['빨간불이에요! 멈춰요. 초록불을 기다려요', '앗, 빨간불! 여기서 멈추자'],
    green: ['초록불! 손을 들고 좌우를 보면서 건너요', '초록불이에요. 손 들고, 살피고, 건너요'],
    road: ['차도는 위험해요! 횡단보도로 가요', '거긴 차가 다니는 길이에요. 횡단보도로 돌아가요'],
    good3: ['참 잘했어요! 별 세 개', '완벽해요! 멈추고, 손 들고, 초록불에 건넜어요'],
    good2: ['잘했어요! 다음엔 한 가지만 더 챙겨요'],
    good1: ['건넜어요. 다음엔 멈추고 손을 들어요'],
    kidOk: ['네!', '알겠어요!', '손 들었어요!', '초록불이다!'],
    norun: ['뛰지 말고 걸어요', '횡단보도에서는 걷는 거예요', '천천히 걸어도 돼요. 뛰지 않아요'],
  };
  var lastLine = {};
  function pickLine(key) { var arr = LINES[key] || [key], i = Math.floor(Math.random() * arr.length); if (arr.length > 1 && i === lastLine[key]) i = (i + 1) % arr.length; lastLine[key] = i; return arr[i]; }
  function kidVoice(text, force) { if (!walk) return; if (!force && walk.voiceCd > 0) return; walk.voiceCd = 3.5; TG.audio.resume(); TG.audio.say(pickLine(text), { kind: 'narrator', queue: !force }); }
  function kidSay(key) { if (!walk || !walker || !walker.kid) return; TG.audio.say(pickLine(key), { kind: 'kid', queue: true }); }
  function officerSay(text) { TG.audio.resume(); TG.audio.say(text, { kind: 'officer', queue: true }); }
  // 어린이 교실 단계 표시: 0 멈춰요 · 1 손 들어요 · 2 초록불 기다려요 · 3 건너요 · -1 보도로 걸어요
  function kidStep(i) {
    if (walk.step === i) return; walk.step = i;
    var chips = document.querySelectorAll('#kidSteps .chip'); for (var k = 0; k < chips.length; k++) chips[k].classList.toggle('on', k === i);
    var lbl = document.getElementById('kidNow'); if (lbl) lbl.textContent = i < 0 ? '보도로 걸어요 🚶' : ['🛑 멈춰요', '✋ 손을 들어요', '🔴 초록불을 기다려요', '🟢 좌우 보며 건너요'][i];
  }
  function walkGuide() {
    if (G.selected) return;   // 선택 이름표가 떠 있으면 안내를 덮지 않는다
    if (!walk) return;
    var d = walk.dests[walk.idx];
    if (!d) { hud.setTarget('🎯 목적지 ' + walk.arrived + '/' + walk.dests.length + ' 모두 도착'); return; }
    var dx = d.x - walker.pos.x, dz = d.z - walker.pos.z, dist = Math.hypot(dx, dz), rel = TG.wrapAngle(Math.atan2(dx, dz) - walker.heading);
    var arrows = ['↑', '↗', '→', '↘', '↓', '↙', '←', '↖'], ai = ((Math.round(rel / (Math.PI / 4)) % 8) + 8) % 8;
    hud.setTarget('🎯 ' + (walk.idx + 1) + '/' + walk.dests.length + ' ' + arrows[ai] + ' ' + Math.round(dist) + 'm · ' + d.name);
  }
  function lawLine(id, fallback) {
    var v = G.laws && G.laws.violations ? G.laws.violations.filter(function (x) { return x.id === id; })[0] : null;
    return v ? (v.article ? '도로교통법 ' + v.article : '') + (v.verified === false ? ' (확인 중)' : '') : fallback || '';
  }
  // 보행 규칙 + 목적지 + 차량 접촉. 횡단보도는 진입 순간의 보행 신호로 판정한다(녹색에 들어섰으면 끝나기 전에 못 건너도 위반 아님).
  function walkRules(dt) {
    var p = TG.walkerPlace(city, signals, walker.pos.x, walker.pos.z), sec = '', kid = walker.kid;
    walk.hintCd -= dt; walk.voiceCd -= dt;
    if (p.where === 'crosswalk') {
      if (!walk.cross || walk.cross.node !== p.node || walk.cross.d !== p.d) {
        walk.cross = { node: p.node, d: p.d, legal: p.walk, x0: walker.pos.x, z0: walker.pos.z, stopped: walk.stopT > 0.8, hand: walker.hand > 0 };
        if (kid) { if (!p.walk) { kidVoice('red', true); hud.notice('🔴 빨간불이에요! 초록불을 기다려요', 'bad', 2600); } else kidVoice('green', true); }
        else if (!p.walk) penalize('walkRed', '신호위반 보행 — 적색 보행 신호에 횡단보도 진입', '보행 신호(녹색 걷는 사람)를 기다린다 · ' + lawLine('jaywalk-red', '도로교통법 제5조'));
        else hud.hint('보행 신호 — 좌우를 살피고 횡단보도 안으로 건넌다 (남은 ' + Math.ceil(p.remain) + '초)');
      }
      walk.jay = false; walk.stopT = 0;
      sec = (p.walk ? '🟢 보행 신호 ' + Math.ceil(p.remain) + '초' : '🔴 보행 신호 대기 ' + Math.ceil(p.remain) + '초') + ' · ' + (p.crossAxis === 'v' ? city.roadNamesV[p.node.i] : city.hName(p.node.j, walker.pos.x)) + ' 횡단 중';
      if (kid) { kidStep(3); if (walker.running && walker.v > 2.2 && walk.cross) { walk.cross.ran = true; if (walk.voiceCd <= 0) { kidVoice('norun', true); hud.notice('🏃 뛰지 말고 걸어요!', 'warn', 1800); } } }
      if (p.walk && p.remain < 3 && walk.hintCd <= 0) { hud.hintNow(kid ? '초록불이 곧 꺼져요 — 빨리 걸어요(뛰지 않아요)' : '보행 신호 곧 종료 — 서두르되 뛰지 않는다'); walk.hintCd = 3; }
    } else if (p.where === 'road' || p.where === 'box') {
      if (!walk.jay) { walk.jay = true; walk.cross = null; if (kid) { kidVoice('road', true); hud.notice('⚠ 차도는 위험해요! 횡단보도로 건너요', 'bad', 2600); TG.audio.bad(); } else penalize('jaywalk', '무단횡단 — 횡단보도 밖 차도 진입', '차도는 횡단보도로만 건넌다 · ' + lawLine('jaywalk', '도로교통법 제10조')); }
      sec = '⚠ 차도 위 — 횡단보도로'; walk.stopT = 0; if (kid) kidStep(-1);
    } else {
      walk.jay = false;
      if (walk.cross) {
        var moved = Math.hypot(walker.pos.x - walk.cross.x0, walker.pos.z - walk.cross.z0), rd = city.roadOf(walk.cross.node, walk.cross.d), half = city.halfOf(rd.axis, rd.idx);
        if (moved > half * 1.2 && walk.cross.legal) {
          if (kid) {
            var st = Math.max(1, 1 + (walk.cross.stopped ? 1 : 0) + (walk.cross.hand ? 1 : 0) - (walk.cross.ran ? 1 : 0)); walk.stars += st; walk.crossings++; addScore(st * 10, null);
            hud.burst('⭐', st * 4); TG.audio.jingle(st); walk.smileT = 4; walk.waveT = 3.5;
            hud.notice('⭐'.repeat(st) + ' 잘 건넜어요! (멈춤 ' + (walk.cross.stopped ? '✓' : '✗') + ' · 손 ' + (walk.cross.hand ? '✓' : '✗') + ' · 초록불 ✓ · 걷기 ' + (walk.cross.ran ? '✗' : '✓') + ') 별 ' + walk.stars + '개', 'good', 3600); TG.audio.good();
            kidVoice(st === 3 ? 'good3' : st === 2 ? 'good2' : 'good1', true);
          } else { addScore(C.SCORE.safeCross, null); walk.crossings++; hud.notice('안전 횡단 (+' + C.SCORE.safeCross + ')', 'good', 2000); TG.audio.good(); }
        }
        walk.cross = null;
      }
      // 가장 가까운 횡단보도(30m 안)의 보행 신호를 미리 보여 준다
      var i = city.nearestIdx(city.xs, walker.pos.x), j = city.nearestIdx(city.zs, walker.pos.z), node = city.nodes[i][j], best = null, bd = 30;
      for (var d = 0; d < 4; d++) {
        var f = TG.DIR_VEC[d], rk = [-f[1], f[0]], dxk = walker.pos.x - node.x, dzk = walker.pos.z - node.z, alk = dxk * f[0] + dzk * f[1], lak = dxk * rk[0] + dzk * rk[1], rdk = city.roadOf(node, d), hk = city.halfOf(rdk.axis, rdk.idx);
        var dd = Math.hypot(alk + city.crossNear(node, d) + 1.75, Math.max(0, Math.abs(lak) - hk));   // 횡단보도 띠(도로 폭 전체)까지의 거리 — 보도 위 사람 기준
        if (dd < bd) { bd = dd; best = d; }
      }
      if (best !== null) { var ax = city.roadOf(node, best).axis, w = signals.pedWalk(node, ax), rem = signals.pedRemain(node, ax); sec = (w ? '🟢 앞 횡단보도 보행 ' + Math.ceil(rem) + '초' : '🔴 앞 횡단보도 대기 ' + Math.ceil(rem) + '초') + ' · ' + (ax === 'v' ? city.roadNamesV[node.i] : city.hName(node.j, walker.pos.x)); }
      else sec = p.where === 'sidewalk' ? '🚶 보도 · ' + city.nodeName(node).replace(' 교차로', '') + ' 부근' : '🚶 도로 밖';
      // 어린이 교실: 횡단보도 앞 4m 안에서 멈추면(0.8초) ✓, 손 들기 ✓, 초록불 ✓ — 단계 표시
      if (kid) {
        var nearX = best !== null && bd < 4.5;
        if (nearX && walker.v < 0.3) walk.stopT += dt; else if (!nearX) walk.stopT = 0;
        if (!nearX) kidStep(-1);
        else if (walk.stopT < 0.8) { kidStep(0); if (walker.v > 0.5 && walk.voiceCd <= 0) kidVoice('stop'); }
        else if (walker.hand <= 0) { kidStep(1); if (walk.voiceCd <= 0) kidVoice('hand'); }
        else { var wk = signals.pedWalk(node, city.roadOf(node, best).axis); kidStep(wk ? 3 : 2); if (walk.voiceCd <= 0) kidVoice(wk ? 'go' : 'wait'); if (wk && walk.step !== 3) kidSay('kidOk'); }
      }
    }
    var secEl = document.getElementById('section'); if (secEl) { secEl.className = 'section walk ' + (sec.charAt(0) === '🟢' ? 'go' : sec.charAt(0) === '🔴' || sec.charAt(0) === '⚠' ? 'stop' : ''); }
    walk.onRoad = p.where === 'crosswalk' || p.where === 'road' || p.where === 'box';
    walk.greenAxis = p.where === 'crosswalk' ? (p.walk ? p.crossAxis : null) : (sec.charAt(0) === '🟢' && typeof best === 'number' && node ? city.roadOf(node, best).axis : null);
    hud.setSectionText(sec);
    // 목적지
    var dst = walk.dests[walk.idx];
    if (dst && Math.hypot(dst.x - walker.pos.x, dst.z - walker.pos.z) < 3.5) {
      walk.arrived++; walk.idx++; addScore(C.SCORE.arrive, null); TG.audio.good();
      var nx = walk.dests[walk.idx]; walker.setMarker(nx || null);
      hud.notice('목적지 도착 (+' + C.SCORE.arrive + ')' + (nx ? ' — 다음: ' + nx.name : ' — 모든 목적지 완료!'), 'good', 3200);
      if (kid) kidVoice(nx ? '도착! 다음은 ' + nx.name.replace(/^\S+\s/, '') + '(으)로 가요' : '모두 도착했어요! 오늘의 별 ' + walk.stars + '개', true);
      if (!nx) endShift(kid ? '⭐ 별 ' + walk.stars + '개 — 목적지 ' + walk.dests.length + '곳 모두 도착' : '목적지 ' + walk.dests.length + '곳 모두 도착');
    }
    walkGuide();
    // 차량 접촉: 움직이는 차에 닿으면 실패, 선 차는 밀어낸다
    walk.hitCd -= dt;
    for (var k = 0; k < traffic.cars.length; k++) {
      var c = traffic.cars[k]; if (Math.abs(c.pos.x - walker.pos.x) > 8 || Math.abs(c.pos.z - walker.pos.z) > 8) continue;
      var cc = circlesOf(c, c.len, c.wid), cr = c.wid * 0.55 + walker.radius;
      for (var b = 0; b < cc.length; b++) {
        var ddx = walker.pos.x - cc[b].x, ddz = walker.pos.z - cc[b].z, d2 = ddx * ddx + ddz * ddz;
        if (d2 >= cr * cr) continue;
        if (c.v > 0.8) { if (kid) { addScore(-10, 'pedestrian'); hud.notice('앗! 차에 부딪혔어요 — 차도는 위험해요. 다시 해 봐요', 'bad', 5000); TG.audio.thump(1); endShift('차에 부딪혔어요 — 횡단보도에서 멈추고, 손 들고, 초록불에 건너요'); return; } addScore(C.SCORE.pedestrian, 'pedestrian'); hud.notice('차량에 치임 — 보행자 체험 종료', 'bad', 5000); TG.audio.thump(1); endShift('차량 접촉 — 사람은 차와 부딪히면 끝'); return; }
        var dd2 = Math.sqrt(d2) || 0.01; walker.pos.x += ddx / dd2 * (cr - dd2); walker.pos.z += ddz / dd2 * (cr - dd2); walker.sync();
      }
    }
  }
  function walkCamera(dt, look) {
    // 3인칭 카메라 방향은 캐릭터 헤딩을 천천히 따른다(MMORPG 식). 스틱을 살짝 옆으로 밀면 캐릭터만 살짝 휘고 시야는 급히 돌지 않는다.
    var w = walker, cy = walk.cyaw === undefined ? w.heading : walk.cyaw, dcy = TG.wrapAngle(w.heading - cy);
    cy += dcy * Math.min(1, dt * (w.moving ? (Math.abs(dcy) > 1.4 ? 3.0 : 1.3) : 0.5)); walk.cyaw = cy;
    var yaw = (settings.cam === 'cockpit' ? w.heading : cy) + (G.lookYaw || 0);
    if (settings.cam === 'cockpit') {
      w.mesh.visible = false;
      var eh = w.eyeHeight ? w.eyeHeight() : 1.62, eye = new THREE.Vector3(w.pos.x, w.y + eh, w.pos.z), ahead = new THREE.Vector3(w.pos.x + Math.sin(yaw) * 10, w.y + eh - 0.6, w.pos.z + Math.cos(yaw) * 10);
      if (!camInit) { camPos.copy(eye); camLook.copy(ahead); camInit = true; }
      var kc = 1 - Math.exp(-30 * dt); camPos.lerp(eye, kc); camLook.lerp(ahead, kc);
    } else {
      w.mesh.visible = true;
      var portrait = document.body.classList.contains('portrait'), back = 3.6 + (portrait ? 1.2 : 0), up = 2.1 + (portrait ? 0.8 : 0);
      var tx = w.pos.x - Math.sin(yaw) * back, tz = w.pos.z - Math.cos(yaw) * back, ty = w.y + up;
      var lx = w.pos.x + Math.sin(yaw) * 2.5, lz = w.pos.z + Math.cos(yaw) * 2.5, ly = w.y + 1.3;
      if (!camInit) { camPos.set(tx, ty, tz); camLook.set(lx, ly, lz); camInit = true; }
      var k = 1 - Math.exp(-5 * dt); camPos.x += (tx - camPos.x) * k; camPos.y += (ty - camPos.y) * k; camPos.z += (tz - camPos.z) * k;
      camLook.x += (lx - camLook.x) * k * 1.4; camLook.y += (ly - camLook.y) * k; camLook.z += (lz - camLook.z) * k * 1.4;
      var gy = terrain.heightAt(camPos.x, camPos.z) + 0.9; if (camPos.y < gy) camPos.y = gy;
    }
    camera.position.copy(camPos); camera.lookAt(camLook); camFx(dt);
    world.followSun(w.pos.x, w.pos.z);
    return Math.atan2(camLook.x - camPos.x, camLook.z - camPos.z);
  }
  function walkUpdate(dt) {
    var mv = input.readMove(); if (G.testMove) mv = G.testMove;
    var lk = (input.held.KeyQ ? 1 : 0) - (input.held.KeyE ? 1 : 0) - (mv.look || 0);
    if (lk !== 0) G.lookYaw = TG.clamp(G.lookYaw + lk * 2.4 * dt, -2.6, 2.6); else if (!G.lookHold) G.lookYaw += (0 - G.lookYaw) * Math.min(1, dt * 3);
    if (walker.jumped) { walker.jumped = false; camInit = false; walk.camYaw = walker.heading; walk.cyaw = walker.heading; G.lookYaw = 0; }   // 순간이동 뒤에는 카메라·이동 기준을 바로 맞춘다
    var camYaw = walk.camYaw !== undefined ? walk.camYaw : walker.heading;
    // 몸짓·시선: 수신호 정차 중엔 왼팔을 들어 「정지」, 풀어 줄 땐 「가세요」 손짓. 어린이는 횡단보도에서 좌우를 살핀다. 시선은 선택 대상이나 정차 대상 쪽
    var es = enforcement.state;
    walker.gesture = (es === 'yielding' || es === 'stopped') ? 'stop' : es === 'release' ? 'go' : null;
    var lookAt = enforcement.target || (G.selected && G.selected.kind === 'car' ? G.selected.car : null);
    walker.look = lookAt ? TG.wrapAngle(Math.atan2(lookAt.pos.x - walker.pos.x, lookAt.pos.z - walker.pos.z) - walker.heading) * 0.9 : 0;
    walker.lookScan = !!(walk && walker.kid && (walk.step === 2 || walk.step === 3));
    walker.smile = walk.smileT > 0; walk.smileT = Math.max(0, (walk.smileT || 0) - dt);
    walker.update(dt, mv, camYaw);
    // 발소리(걸음 위상 반 바퀴마다) · 횡단보도 음향신호기(앞 횡단보도가 보행 녹색이면 뻐꾸기/귀뚜라미)
    var phk = Math.floor(walker.rig.ph / Math.PI); if (walk.stepK === undefined) walk.stepK = phk; if (phk !== walk.stepK && walker.v > 0.2) { walk.stepK = phk; TG.audio.footstep(walker.v > 2.4, walk.onRoad ? 'road' : 'walk'); }
    walk.sigT = (walk.sigT || 0) - dt; if (walk.sigT <= 0 && walk.greenAxis) { walk.sigT = 0.95; TG.audio.crossSignal(walk.greenAxis === 'v' ? 'cuckoo' : 'cricket'); }
    // 어린이 교실 동행 경찰관: 아이 왼쪽 뒤를 따라 걷고, 아이가 건널 땐 차도 쪽에 서서 「정지」 수신호, 잘 건너면 손 흔들며 웃는다
    if (walk.officer) {
      var of = walk.officer, kf = walker.forward(), kr = [-kf[1], kf[0]], hx = walker.pos.x - kf[0] * 1.3 - kr[0] * 1.1, hz = walker.pos.z - kf[1] * 1.3 - kr[1] * 1.1;
      if (walk.step === 3 && walk.cross) { of.gesture = 'stop'; of.target = null; of.face(walker.heading + (walk.cross.d === 0 || walk.cross.d === 2 ? 0 : 0)); }
      else if (walk.waveT > 0) { walk.waveT -= dt; of.gesture = 'wave'; of.smile = true; of.target = null; of.face(Math.atan2(walker.pos.x - of.pos.x, walker.pos.z - of.pos.z)); }
      else { of.gesture = null; of.smile = false; if (Math.hypot(hx - of.pos.x, hz - of.pos.z) > 1.6) of.goTo(hx, hz, walker.v > 2.4 ? 3.4 : 1.55); else if (!of.target) of.face(walker.heading); }
      of.lookAtPos(walker.pos); of.update(dt, TG.audio.speaking === 'narrator' || TG.audio.speaking === 'officer');
    }
    weather.update(dt, camera.position); TG.audio.rain(weather.name === 'rain'); if (vfx) vfx.update(dt);
    signals.update(dt); if (rail) rail.update(dt);
    traffic.update(dt, TG.perf.budget(C.TRAFFIC_MAX)); traffic.separate();
    peds.update(dt, TG.perf.budget(C.PED_MAX));
    walkRules(dt);
    if (G.state !== 'play') return;
    walk.camYaw = walkCamera(dt);
    enforcement.update(dt);   // 도보 수신호 정차 유도(운전석 옆에 서면 고지 완료)
    hud.tick(dt); updateSelection();
    hud.setSpeed(walker.speedKmh(), 0, 999); hud.setGear('D');
    minimap.draw(walker, traffic.cars, null, walk.dests[walk.idx] || null);
    TG.audio.update(dt, 0, 0, 0, 0, false);
    G.timeLeft -= dt; hud.setTimer(Math.max(0, G.timeLeft)); if (G.timeLeft <= 0) endShift('체험 시간 종료 — 목적지 ' + walk.arrived + '/' + walk.dests.length);
  }
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
    else if (id === 'overtake') { player.teleport(xs[2] + 2, zs[3] + 20, Math.PI); var N23 = city.nodes[2][3]; traffic.spawn({ at: { x: xs[2] + 2, z: zs[2] + 44, d: 2, node: N23 }, v: 4, cruise: 4, straight: true, violator: false, laneIdx: 0, trait: null }); var ot = traffic.spawn({ at: { x: xs[2] + 2, z: zs[2] + 62, d: 2, node: N23 }, v: 10, cruise: 11, straight: true, violator: false, laneIdx: 0, trait: 'overtake' }); if (ot) ot.lcCd = 0; hud.notice('체험 · 앞지르기 위반: 앞의 빠른 차가 느린 차를 우측(바깥 차로)으로 추월한다 — 앞지르기는 좌측으로(§21)', 'info', 6000); }
    else if (id === 'railroad') { var LW = terrain.conns[3], p6 = LW.P(6); player.teleport(p6.x + p6.rx * 2, p6.z + p6.rz * 2, Math.atan2(p6.tx, p6.tz)); rail.forceClose(); var rc = traffic.spawn({ atLink: { link: LW, i: 11, dirA: true }, lane: 0, v: 11, type: 'sedan', violator: true, stayRing: true }); if (rc) rc.railRun = true; hud.notice('체험 · 철길건널목: 앞 건널목 차단기가 내려온다 — 정지선 앞에 선다. 앞차는 그대로 통과(위반)', 'info', 6000); }
    else if (id === 'license') { player.teleport(xs[2] + 2, zs[2] + 48, Math.PI); signals.set(N22, 'h', 'red'); var lc = traffic.spawn({ at: { x: xs[2] - 70, z: zs[2] - 2, d: 1, node: N22 }, v: 9, violator: true, straight: true, noLicense: true }); hud.notice('체험 · 무면허: 왼쪽에서 신호위반으로 들어오는 차를 세우면 MDT 면허 조회에서 무면허가 드러난다', 'info', 6000); }
    else if (id === 'drunk') { player.teleport(xs[2] + 2, zs[3] + 30, Math.PI); traffic.spawn({ at: { x: xs[2] + 2, z: zs[2] + 60, d: 2, node: city.nodes[2][3] }, v: 8, cruise: 8, straight: true, violator: false, laneIdx: 0, trait: 'drunk' }); hud.notice('체험 · 음주운전 의심: 앞차가 차로 안에서 비틀거리고 속도가 들쭉날쭉 — 5초 관찰 후 「음주운전 의심」 정차·측정', 'info', 6000); }
    else if (id === 'sidewalk') { player.teleport(xs[2] + 2, zs[3] + 30, Math.PI); var sw = traffic.spawn({ at: { x: xs[2] + 5.5, z: zs[2] + 60, d: 2, node: city.nodes[2][3] }, v: 7, cruise: 7, straight: true, violator: false, laneIdx: 1, trait: 'sidewalk' }); if (sw) sw.swT = 0; hud.notice('체험 · 보도 침범: 앞차가 보도로 올라가 달린다 — 보행자 사고 위험(§13①)', 'info', 6000); }
    else if (id === 'passenger') { player.teleport(xs[2] + 2, zs[3] + 30, Math.PI); traffic.spawn({ at: { x: xs[2] + 5.5, z: zs[2] + 62, d: 2, node: city.nodes[2][3] }, v: 7, cruise: 8, straight: true, violator: false, laneIdx: 1, type: 'bus', trait: 'door' }); hud.notice('체험 · 승객 추락방지: 앞 버스가 문을 연 채 달린다(문가에 승객) — 3초 목격이면 위반 기록(§39③)', 'info', 6000); }
    else if (id === 'cargo') { player.teleport(xs[2] + 2, zs[3] + 34, Math.PI); var tk = traffic.spawn({ at: { x: xs[2] + 2, z: zs[2] + 62, d: 2, node: city.nodes[2][3] }, v: 8, cruise: 9, straight: true, violator: false, laneIdx: 0, type: 'truck', trait: 'cargo' }); if (tk) tk.cargoT = 2; hud.notice('체험 · 적재물 추락방지: 앞 트럭 짐칸 상자가 떨어진다 — 낙하물은 도로 위 장애물(§39④). 거리를 둔다', 'info', 6000); }
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
    if (delta) { hud.pop((delta > 0 ? '+' : '') + delta, delta > 0 ? 'good' : 'bad'); if (delta > 0) TG.audio.pop(); }
    if (delta < 0 && reason) { penaltyTotal += delta; penaltyCount[reason] = (penaltyCount[reason] || 0) + 1; }
  }
  G.addScore = addScore;
  function penalize(key, text, teach) {
    if (G.mode !== 'patrol' && G.mode !== 'walk' && key !== 'crash' && key !== 'pedestrian') { if (teach) hud.hint(teach); return; }   // 자유 주행·서킷: 사고 외 감점 없음(안내만)
    addScore(C.SCORE[key], key); hud.notice(text + ' (' + C.SCORE[key] + ')', 'bad', 2600); if (teach) hud.hint(teach); TG.audio.bad(); }
  function onTrafficEvent(kind, car) {
    if (kind === 'witness') {
      if (G.mode === 'kid') return;
      var name = { buslane: '버스전용차로 위반', pedestrian: '보행자 보호의무 위반(횡단보도)', signal: '신호위반' }[car.violation.type] || (enforcement && enforcement.nameOf ? enforcement.nameOf(car.violation.type) : car.violation.type);
      hud.notice('위반 의심: ' + name + ' — 대상 차량 표시', 'alert', 3200); hud.flash(); TG.audio.shutter(); G.punch = 1;   // 위반 포착: 카메라 셔터·플래시·줌 펀치 TG.audio.alert(); if (G.stats) G.stats.witnessed++;
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
                    cornerFail: '코너 진입 전에 속도를 줄인다', pedestrian: onFoot() ? '차도에서는 사람이 진다 — 보행 신호와 횡단보도가 지켜 준다' : '횡단보도 앞에서는 언제나 멈출 준비', water: '도로를 벗어나지 않는다',
                    jaywalk: '차도는 횡단보도로만 건넌다(제10조)', walkRed: '보행 신호(녹색)를 기다렸다가 건넌다(제5조)' };
    var worst = null, wc = 0; for (var k in penaltyCount) if (penaltyCount[k] > wc) { wc = penaltyCount[k]; worst = k; }
    var lesson = worst ? lessons[worst] : (onFoot() ? (walk && walk.crossings ? '보행 신호에 횡단보도로 — 오늘처럼' : '보행 신호를 기다려 횡단보도로 건넌다') : G.stats.stops ? '위반을 직접 목격한 차량만 세운다' : '경광등을 켜고 위반 차량 뒤에 붙으면 우측으로 정차한다');
    if (G.mode === 'kid' && walk) lesson = '⭐ 별 ' + walk.stars + '개 · 횡단보도 앞에서 멈추고 ✋ 손 들고 🟢 초록불에 건너요';
    if (onFoot() && walk) G.stats.stops = walk.arrived;
    G.stats.score = G.score; G.stats.penalty = penaltyTotal; G.stats.lesson = lesson; G.stats.reason = reason || '';
    var best = TG.save.get('best', null);
    if (!best || G.score > best.score) { best = { score: G.score, stops: G.stats.stops, date: new Date().toISOString().slice(0, 10) }; TG.save.set('best', best); }
    TG.save.set('last', { score: G.score, stops: G.stats.stops, correct: G.stats.correct, penalty: penaltyTotal, date: new Date().toISOString().slice(0, 10) });
    // 별(1~5)·배지: 점수·정답률·감점·계도·별로 계산. 어린이 교실은 딴 별 그대로
    var st = G.stats, kidMode = G.mode === 'kid', badges = [];
    if (kidMode) { st.stars = Math.max(1, Math.min(5, Math.round((walk ? walk.stars : 0) / 2.4))); if (walk && walk.stars >= 12) badges.push({ text: '🏅 횡단보도 박사', gold: true }); if (walk && walk.arrived >= walk.dests.length) badges.push({ text: '🏠 무사히 집까지' }); if (!penaltyCount.pedestrian) badges.push({ text: '🛡 안전 보행' }); }
    else {
      var acc = st.stops ? st.correct / st.stops : 0;
      st.stars = Math.max(1, Math.min(5, Math.round(1 + G.score / 60 + acc * 1.5 + (penaltyTotal >= -10 ? 0.5 : 0))));
      if (!penaltyCount.crash && !penaltyCount.pedestrian && G.mode !== 'walk') badges.push({ text: '🛡 무사고', gold: true });
      if (st.correct >= 5) badges.push({ text: '🚨 단속왕 ' + st.correct + '건', gold: st.correct >= 8 });
      if (acc >= 0.8 && st.stops >= 3) badges.push({ text: '🎯 정확한 판단 ' + Math.round(acc * 100) + '%' });
      if ((st.warned || 0) >= 2) badges.push({ text: '🚸 보행자 지킴이' });
      if (!penaltyCount.redLight && !penaltyCount.speeding && G.mode === 'patrol') badges.push({ text: '🚦 신호·속도 준수' });
      if (walk && walk.crossings >= 4) badges.push({ text: '🚶 모범 보행 ' + walk.crossings + '회' });
    }
    st.badges = badges;
    if (st.stars >= 4) TG.audio.jingle(st.stars); hud.showEnd(G.stats); hud.setTarget(null);
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
    // 8-1) 방향지시등: 회전이 끝나면(헤딩 55° 이상 변화) 또는 8초 뒤 자동 해제. HUD 화살표 깜빡임
    if (player.signal) {
      player.sigAge = (player.sigAge || 0) + dt;
      var turned = Math.abs(TG.wrapAngle(player.heading - (player.sigHead || player.heading))) > 0.96;
      if ((turned && player.sigAge > 1.5) || player.sigAge > 8) { player.signal = null; var bL = document.getElementById('btnSigL'), bR = document.getElementById('btnSigR'); if (bL) bL.classList.remove('active'); if (bR) bR.classList.remove('active'); }
    }
    var sigOnHud = player.signal && ((player.sigT * 1.6) % 1) < 0.5, eL = document.getElementById('sigL'), eR = document.getElementById('sigR');
    if (!!sigOnHud !== !!rules.sigWas) { rules.sigWas = !!sigOnHud; if (player.signal) TG.audio.tick(!!sigOnHud); }   // 릴레이 「딱·딱」
    if (eL) eL.classList.toggle('on', !!(sigOnHud && player.signal === 'L')); if (eR) eR.classList.toggle('on', !!(sigOnHud && player.signal === 'R'));
    // 8-2) 플레이어 차로 변경 판정(4차로 격자): 차로 인덱스가 바뀌면 방향지시등 없음 → 감점, 정지선 30m 안(실선) → 감점. 경광등 추격 중은 특례
    if (frame.kind === 'grid' && frame.lanes === 2 && T.speed > 3) {
      var laneNow = frame.lateral > (C.LANE_OFF + C.LANE2_OFF) / 2 ? 1 : 0, roadKey = frame.axis + frame.idx;
      if (rules.laneKey === roadKey && rules.laneIdx !== undefined && laneNow !== rules.laneIdx && !player.siren) {
        // 실선 구간 = 진행 방향 앞 교차로의 정지선까지 30m 안(뒤쪽 교차로는 무관)
        var dLc = TG.headingToDir(player.heading), nLc = city.nodeAhead(player.pos.x, player.pos.z, dLc, 0), fLc = TG.DIR_VEC[dLc];
        var dNode = nLc ? (nLc.x - player.pos.x) * fLc[0] + (nLc.z - player.pos.z) * fLc[1] - city.stopDist(nLc, dLc) : 99;
        if (dNode >= 0 && dNode < 30) penalize('solidline', '실선 구간 차로 변경', '교차로 앞 실선에서는 차로를 바꾸지 않는다');
        else if (!player.signal) penalize('nosignal', '방향지시등 없이 차로 변경', '차로를 바꾸기 3초 전에 방향지시등(, 또는 .)');
        else hud.hint('차로 변경 — 방향지시등 확인');
      }
      rules.laneKey = roadKey; rules.laneIdx = laneNow;
    } else if (frame.kind !== 'grid') { rules.laneKey = null; }
    // 8-3) 감속 시점 안내: 앞 교차로 신호가 적·황이고 정지거리가 남은 거리에 가까워지면 「지금 감속」. 굽은 길은 곡률로 권장 속도.
    rules.brakeCd = (rules.brakeCd || 0) - dt;
    if (rules.brakeCd <= 0 && T.speed > 6 && player.controls.brake < 0.2 && !player.siren) {
      if (frame.kind === 'grid') {
        var dAh = TG.headingToDir(player.heading), nAh = city.nodeAhead(player.pos.x, player.pos.z, dAh, 0);
        if (nAh) {
          var fA = TG.DIR_VEC[dAh], distN = (nAh.x - player.pos.x) * fA[0] + (nAh.z - player.pos.z) * fA[1] - city.stopDist(nAh, dAh), stS = signals.state(nAh, (dAh === 0 || dAh === 2) ? 'v' : 'h');
          if (distN > 0 && (stS.s === 'red' || (stS.s === 'yellow' && distN > 12)) && distN < T.stopDist + (player.easy ? 24 : 14)) { hud.hintNow('지금 감속 — 정지선 ' + Math.round(distN) + 'm · 정지거리 ' + Math.round(T.stopDist) + 'm' + (player.easy ? ' (보조 제동)' : '')); rules.brakeCd = 5; if (player.easy) player.autoBrake = 0.7; }
          else if (distN > 0 && stS.s === 'green' && stS.remain < 3 && distN < T.stopDist + 20 && distN > T.stopDist) { hud.hintNow('곧 황색 — 정지선 ' + Math.round(distN) + 'm, 지금이면 안전하게 설 수 있다'); rules.brakeCd = 6; }
        }
      } else if (frame.kind === 'link' && frame.link) {
        var Lk = frame.link, ii = frame.i, kmax = 0, ki = 0;
        for (var kk = 1; kk <= 18; kk++) { var pk = Lk.P(ii + (frame.dirA ? kk : -kk)); if (pk.kappa > kmax) { kmax = pk.kappa; ki = kk; } }
        if (kmax > 0.016) { var vRec2 = Math.sqrt(player.spec.latMax * 0.9 / kmax), dCurve = ki * 3; if (T.speed > vRec2 * 1.1 && dCurve < T.stopDist + 15) { hud.hintNow('감속 시점 — 앞 코너 권장 ' + Math.round(vRec2 * 3.6) + 'km/h (' + Math.round(dCurve) + 'm 앞)' + (player.easy ? ' (보조 제동)' : '')); rules.brakeCd = 8; if (player.easy) player.autoBrake = 0.45; } }
      }
    }
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
    // 9) 철길건널목(§24): 차단기가 내려온 건널목을 지나면 감점. 열려 있어도 일시정지 안내
    rules.railCd = (rules.railCd || 0) - dt;
    if (rail) {
      var rdR = rail.distFor(player.pos.x, player.pos.z, player.heading);
      if (rdR) {
        if (rdR.closed && rules.railPrev !== undefined && rules.railPrev > 0 && rdR.dist <= 0 && !exempt) penalize('railroad', '철길건널목 통과방법 위반 — 차단기가 내려온 건널목 통과', '건널목: 정지선 앞 일시정지 → 좌우 확인 → 통과');
        else if (rdR.closed && rdR.dist > 7 && rdR.dist < T.stopDist + 22 && rules.railCd <= 0 && T.speed > 2) { hud.hintNow('건널목 차단기 — 정지선 ' + Math.round(rdR.dist - 7) + 'm 앞에 정지'); if (player.easy) player.autoBrake = 0.6; rules.railCd = 2.5; }
        else if (!rdR.closed && rdR.dist > 0 && rdR.dist < 45 && rules.railCd <= 0) { hud.hint('철길건널목 — 정지선 앞 일시정지 후 좌우 확인(§24)'); rules.railCd = 20; }
        rules.railPrev = rdR.dist;
      } else rules.railPrev = undefined;
    }
    // 10) 침수 통제(비): 양재천 산책로·잠수교
    rules.floodCd = (rules.floodCd || 0) - dt;
    if (terrain.flood && rules.floodCd <= 0) {
      if (frame.kind === 'link' && terrain.jamsu.link && frame.link === terrain.jamsu.link && frame.link.P(frame.i).bridge) { hud.notice('잠수교 통제 중(수위 상승) — ' + ((frame.link.name || '').split(' · ')[1] || '상판') + ' 상판으로 통행', 'warn', 3200); rules.floodCd = 30; }
      else if (terrain.nearStream(player.pos.x, player.pos.z) && (frame.kind !== 'link' || !frame.onRoad)) { hud.notice('양재천 침수 — 하천변 산책로 통제 중, 다리로 건너세요', 'warn', 3200); rules.floodCd = 20; }
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
            penalize('crash', '차량 접촉', teach); G.lastCrash = { car: c.id, closing: closing, t: performance.now() }; G.shake = Math.min(1.2, closing / 8);
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
      camera.position.copy(camPos); camera.lookAt(camLook); camFx(dt);
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
    camera.position.copy(camPos); camera.lookAt(camLook); camFx(dt);
    world.followSun(player.pos.x, player.pos.z);
  }

  // 카메라 감각: 충돌 흔들림(G.shake) · 위반 포착 줌 펀치(G.punch)
  function camFx(dt) {
    G.shake = Math.max(0, (G.shake || 0) - dt * 3); G.punch = Math.max(0, (G.punch || 0) - dt * 1.6);
    if (G.shake > 0) { camera.position.x += (Math.random() - 0.5) * G.shake * 0.5; camera.position.y += (Math.random() - 0.5) * G.shake * 0.3; camera.position.z += (Math.random() - 0.5) * G.shake * 0.5; }
    var target = chaseFov() - 9 * G.punch;
    if (Math.abs(camera.fov - target) > 0.05) { camera.fov = target; camera.updateProjectionMatrix(); }
  }
  function recoverToRoad(msg) {
    if (!player || !rules) return;
    hud.notice(msg || '마지막 도로 위치로 복귀', 'info', 3000); TG.audio.ui();
    player.teleport(rules.lastRoad.x, rules.lastRoad.z, rules.lastRoad.h); player.vx = 0; player.vz = 0; player.vF = 0; player.vL = 0; player.resync(); camInit = false;
  }
  function update(dt) {
    if (onFoot() && walker) { walkUpdate(dt); return; }
    var inp = input.read();
    player.controls.steer = inp.steer; player.controls.throttle = inp.throttle; player.controls.brake = inp.brake; player.controls.reverse = inp.reverse;
    if (G.testOverride) { for (var k in G.testOverride) player.controls[k] = G.testOverride[k]; }
    player.assist = settings.assist !== false; player.easy = settings.easy !== false; player.surfaceFactor = weather.grip; player.windLat = weather.lateralGust(player.heading); player.driveMode = settings.drive || 'normal';
    player.autoBrake = Math.max(0, (player.autoBrake || 0) - dt * 0.4);   // 초보 보조 자동 감속은 안내가 뜰 때 걸리고 서서히 풀린다
    weather.update(dt, camera.position); TG.audio.rain(weather.name === 'rain'); if (vfx) vfx.update(dt);
    if (settings.cam === 'cockpit') { var fr0 = city.frameAt(player.pos.x, player.pos.z, player.heading), sus = 0; for (var si = 0; si < traffic.cars.length; si++) if (traffic.cars[si].violation && traffic.cars[si].violation.seen) sus++; player.mdtInfo = { score: G.score, stops: G.stats.stops, suspects: sus, target: enforcement.state === 'idle' ? '' : enforcement.state === 'yielding' ? '정차 유도 중' : enforcement.state === 'stopped' ? '대상 정차' : enforcement.state === 'release' ? '고지 완료' : '', limit: fr0.limit, section: fr0.name, gap: G.lead ? Math.round(G.lead.gap) + 'm · ' + G.lead.sec.toFixed(1) + 's' : '', time: hud.fmtTime ? hud.fmtTime(G.timeLeft) : '' }; }
    player.update(dt);
    // 차량 감각: 급가속 배기(내연기관) · 타이어 연기(미끄러짐) · 밤 전조등 플레어
    if (vfx) {
      var Tq = player.telemetry, pf2 = player.forward(), pr2 = [-pf2[1], pf2[0]];
      vfxT = (vfxT || 0) - dt;
      if (vfxT <= 0 && player.spec.powertrain !== 'ev' && player.controls.throttle > 0.7 && Tq.speed < 9 && Tq.speed > 0.3) { vfxT = 0.06; vfx.puff(player.pos.x - pf2[0] * (player.len / 2) + pr2[0] * 0.55, player.y + 0.3, player.pos.z - pf2[1] * (player.len / 2) + pr2[1] * 0.55, -pf2[0] * 1.5 + (Math.random() - 0.5), 0.4, -pf2[1] * 1.5 + (Math.random() - 0.5), 0.9, 1); }
      if (vfxT <= 0 && Tq.skid > 0.35 && Tq.speed > 4) { vfxT = 0.05; for (var wsd = -1; wsd <= 1; wsd += 2) vfx.puff(player.pos.x - pf2[0] * (player.len * 0.3) + pr2[0] * wsd * player.wid * 0.45, player.y + 0.15, player.pos.z - pf2[1] * (player.len * 0.3) + pr2[1] * wsd * player.wid * 0.45, (Math.random() - 0.5) * 1.2, 0.8, (Math.random() - 0.5) * 1.2, 1.2 + Tq.skid, 1.6); }
      if (flares) for (var fl2 = 0; fl2 < flares.length; fl2++) flares[fl2].visible = !!weather.dark && settings.cam !== 'cockpit';
    }
    signals.update(dt); if (rail) rail.update(dt);
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
      signals.update(dt); if (rail) rail.update(dt); traffic.player = player; peds.player = player;
      traffic.update(dt, 14); traffic.separate(); peds.update(dt, 10);
      player.update(0.0001);
      if (intro.t > 13.5) endIntro();
    } else if (G.state === 'title' || G.state === 'end') {
      var t = now / 1000 * 0.25;
      if (G.state === 'title') { var tb = Math.sin(t * 1.7) * 0.6; camera.position.set(player.pos.x + Math.cos(t) * (8.5 + tb), player.y + 2.4 + Math.sin(t * 0.8) * 0.7, player.pos.z + Math.sin(t) * (8.5 + tb)); camera.lookAt(player.pos.x, player.y + 0.9, player.pos.z); player.update(0.0001); if (flares) for (var fl3 = 0; fl3 < flares.length; fl3++) flares[fl3].visible = !!weather.dark; if (vfx) vfx.update(dt); }
      else if (walker && onFoot()) walkCamera(dt);
      else if (player) updateCamera(dt);
      signals.update(dt); if (rail) rail.update(dt);
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
      walker: function () { return walker; }, walk: function () { return walk; }, move: function (m) { G.testMove = m; }, place: function () { return walker ? TG.walkerPlace(city, signals, walker.pos.x, walker.pos.z) : null; },
      sectionText: function () { return document.getElementById('section').textContent; }, targetText: function () { return document.getElementById('target').textContent; },
    };
    log('테스트 훅 설치: TG.test.*');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
