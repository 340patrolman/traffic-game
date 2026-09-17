// 🚲 자전거 교실 — 초등학생·중고등학생.
// 성장 코스: 👶 영아 교실 → 🧒 어린이 보행 교실 → 🚲 자전거 교실 → 🪪 만 16세 원동기면허 → 🛴 전동킥보드 교실
//
// 소유자(2026-09-15): 「초등·중고등학생 자전거 주행 게임도 개념을 넣으면 좋을 것 같아. 도로의 위험요소 — 특히 **사방을 확인하지 않고
//  막 달려나가는 자전거 주행**, **차 사이를 갑자기 나오는 주행** 등 어린이·중고등학생 자전거 교통사고 유형을 모아서 상황을 재구성해서
//  게임을 만드는데, 어린이 보행게임 통과 후 자전거 및 원동기면허 취득 후 전동킥보드로 넘어갈 수 있게 **연결된 게임**을 구상하면 좋겠다.」
//
// 설계 원칙
//  · 법령 문구는 코드에 없다 — data/laws.json 의 rideSafe(티북 · 원문 대조)에서 읽는다.
//  · **운이 좋아 안 부딪힌 것은 통과가 아니다** — 멈추고(일시정지) 살피지(👀) 않고 나가면 차가 없어도 다시 한다.
//  · 사고 장면은 없다. 차는 급제동해 아이 앞에 서고(아찔한 순간) 그 자리로 되돌린다 — 대신 **위험 게이지**가 쌓인다.
//  · 과실비율 같은 숫자는 보이지 않는다(대조한 표가 없다). 위험 게이지는 **게임 설계값**이다.
//  · 장면은 한 곳에 하나씩 — 마당마다 자리를 옮긴다(규칙끼리 섞이지 않게: 보도 주행 금지와 횡단보도 끌기가 한 길에서 부딪히지 않는다).
TG.BikeClass = function (game) {
  var self = this, G = game, scene = game.scene, terrain = game.terrain, city = game.city;
  var st = null;

  var SCENES = [
    { id: 'gap',   icon: '🅿️', name: '차 사이로 나가기', goal: '연석 앞에서 🛑 멈추고 👀 살핀 뒤, 차가 지나가면 나가요', card: 'ride-sidewalk-cross' },
    { id: 'cross', icon: '🚸', name: '횡단보도는 끌고',   goal: '🚶 내려서 끌고, 초록불에 건너요',                     card: 'ride-cross' },
    { id: 'lane',  icon: '🛣️', name: '어디로 달릴까',     goal: '',                                                    card: 'ride-lane' },
    { id: 'brake', icon: '🛑', name: '멈추는 거리',       goal: '힘껏 달리다가 🛑 선 앞에서 멈춰요',                   card: 'ride-check' },
    // 🛴 이건 자전거일까?(v0.9.93) — 소유자: 「자토바이 — 전기자전거이지만 스로틀이 있어서 페달을 밟지 않고 주행되면 이륜차로 분류되어
    //   면허증이 있어야 하고 더 엄격한 도로교통법이 적용됨에도 그냥 자전거인 줄 아는 경우 … 세상은 모른다고 봐주지 않는다.」
    { id: 'class', icon: '🛴', name: '이건 자전거일까?', goal: '네 가지를 맞혀요 — 모르고 타도 봐주지 않아요',       card: 'ride-ebike-class' },
    // 🛣 자유 주행(v0.9.90) — 소유자: 「청소년 모드에 **자전거 자유주행**을 넣어야 하네, **자전거 주행 원칙에 맞춰서**」.
    // 교실이 아니라 **그냥 신나게 타는 판**이다. 대신 원칙이 살아 있고, 사람을 치면 그 자리에서 절차가 시작된다.
    { id: 'free',  icon: '🛣', name: '자유 주행',         goal: '목적지 세 곳을 찍어요 — 오른쪽 가장자리 · 신호 · 횡단보도는 끌고', card: 'ride-lane' },
  ];
  // 위험 게이지 — **게임 설계값**(법령·통계 수치가 아니다). 60 을 넘으면 「다시 도전」.
  var RISK = { miss: 35, blind: 15, rideCross: 20, sidewalk: 12, fastPed: 15, wrongWay: 10, lanes: 5, overshoot: 8, crash: 40, quiz: 8, redLight: 15 };
  var RISK_PASS = 60, LANE_SEC = 8;

  function el(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function law(id) {
    var R = G.laws && G.laws.rideSafe, items = R && R.items ? R.items : [];
    for (var i = 0; i < items.length; i++) if (items[i].id === id) return items[i];
    return null;
  }
  function cardLine(id) { var c = law(id); return c ? '📘 ' + c.name + (c.verified === false ? ' (확인 중)' : '') + ' — ' + (c.tip || c.situation || '') : ''; }
  function say(t, force) { if (!st) return; if (!force && st.sayCd > 0) return; st.sayCd = 2.4; TG.audio.resume(); TG.audio.say(t, { kind: 'narrator', queue: !force }); }
  function notice(t, kind, ms) { if (G.hud) G.hud.notice(t, kind || 'info', ms || 3200); }
  function hint(t) { if (G.hud) { if (G.hud.hintNow) G.hud.hintNow(t); else G.hud.hint(t); } }
  function stop() { return { x: 0, y: 0, run: false }; }

  // ---------- 무대(서초역 사거리 블록 — 어린이 교실과 같은 곳) ----------
  function geo() {
    var B = G.kidStageBlock ? G.kidStageBlock() : { i: 1, j: 1 };
    var nA = city.nodes[B.i][B.j], nB = city.nodes[B.i][B.j + 1] || nA;
    return { B: B, nA: nA, nB: nB, half: city.halfOf('v', B.i), lanes: city.lanesOf('v', B.i), sideOff: city.sideOff('v', B.i), shoulder: city.shoulderOff('v', B.i) };
  }

  // ---------- 세워 둔 차(정적 메시) — 교통 AI 의 차 목록에 넣지 않는다(뒤차가 줄줄이 서서 막히지 않게) ----------
  var carMat = null, glassMat = null;
  function parkCars(list) {
    carMat = carMat || new THREE.MeshLambertMaterial({ vertexColors: true });
    glassMat = glassMat || new THREE.MeshLambertMaterial({ color: 0x3a5068, transparent: true, opacity: 0.34, depthWrite: false });
    var COL = [0xd9dde3, 0x2b2f36, 0x8a1f2b, 0x1f3f7a, 0xb9b9b9];
    list.forEach(function (p, k) {
      var type = TG.vehmesh.TYPES[p.type] ? p.type : 'sedan', T = TG.vehmesh.TYPES[type];
      var gr = new THREE.Group();
      gr.add(new THREE.Mesh(TG.vehmesh.build(type, COL[k % COL.length]), carMat));
      try { gr.add(new THREE.Mesh(TG.vehmesh.glass(type), glassMat)); } catch (e) { /* 유리 없는 차종 */ }
      gr.position.set(p.x, terrain ? terrain.heightAt(p.x, p.z) : 0, p.z); gr.rotation.y = p.h;
      scene.add(gr);
      st.parked.push({ g: gr, x: p.x, z: p.z, len: (T && T.l) || 4.6, wid: (T && T.w) || 1.8 });
    });
  }
  function pushOutParked(W) {
    for (var k = 0; k < st.parked.length; k++) {
      var p = st.parked[k], hx = p.wid / 2 + 0.35, hz = p.len / 2 + 0.35, dx = W.pos.x - p.x, dz = W.pos.z - p.z;
      if (Math.abs(dx) >= hx || Math.abs(dz) >= hz) continue;
      if (hx - Math.abs(dx) < hz - Math.abs(dz)) W.pos.x = p.x + (dx >= 0 ? 1 : -1) * hx; else W.pos.z = p.z + (dz >= 0 ? 1 : -1) * hz;
      W.v = Math.min(W.v, 0.5); W.sync();
    }
  }
  function carTouching(W) {
    var cars = G.traffic && G.traffic.cars ? G.traffic.cars : [];
    for (var k = 0; k < cars.length; k++) {
      var c = cars[k]; if (Math.abs(c.pos.x - W.pos.x) > 6 || Math.abs(c.pos.z - W.pos.z) > 6) continue;
      var f = [Math.sin(c.heading), Math.cos(c.heading)], dx = W.pos.x - c.pos.x, dz = W.pos.z - c.pos.z;
      if (Math.abs(dx * f[0] + dz * f[1]) < (c.len || 4.4) / 2 + 0.45 && Math.abs(dx * -f[1] + dz * f[0]) < (c.wid || 1.8) / 2 + 0.45) return c;
    }
    return null;
  }
  // 동쪽 가장자리 차로에서 −z 로 달려오는(아직 그 자리를 안 지난) 차
  function approachingCar(zRef, range) {
    var g = st.g, best = null, cars = G.traffic && G.traffic.cars ? G.traffic.cars : [];
    for (var k = 0; k < cars.length; k++) {
      var c = cars[k];
      if (c.pos.x < g.nA.x || Math.cos(c.heading) > -0.5 || c.v < 1.2) continue;
      var ahead = c.pos.z - zRef;
      if (ahead > -2.5 && ahead < range) best = c;
    }
    return best;
  }

  // ---------- 위험 · 아찔한 순간 · 통과 ----------
  function addRisk(n, why) {
    st.risk = Math.min(100, st.risk + n); st.riskLog.push({ scene: SCENES[st.i] ? SCENES[st.i].id : '', n: n, why: why });
    if (G.hud && G.hud.pop) G.hud.pop('⚠ +' + n, 'bad');
    paint();
  }
  function nearMiss(car, why) {
    if (car) { car.v = Math.min(car.v, 2.2); car.brakeHard = 1.2; }
    if (TG.audio.skidBurst) TG.audio.skidBurst();
    if (TG.audio.horn) TG.audio.horn(false);
    G.slowmo = 1.0; G.punch = 0.9; G.shake = 0.5;
    if (G.hud && G.hud.vignette) G.hud.vignette(0.55); st.vigT = 1.4;
    if (G.hud && G.hud.burst) G.hud.burst('⚠️', 5);
    addRisk(RISK.miss, why || '아찔했어요'); st.misses++;
    // 👁 **두 시점으로 되돌려 본다** — 아이 눈에는 차가 안 보였고, 운전자 눈에는 아이가 갑자기 나타났다(소유자 2026-09-16)
    if (G.replay && car && G.walker) {
      var W0 = G.walker;
      G.replay.blindSpot({ x: W0.pos.x, y: W0.y || 0, z: W0.pos.z }, car, {
        childTtl: '차 사이에서는 차가 안 보인다',
        driverTtl: '운전자도 나를 못 본다',
        driverSub: '갑자기 나타나면 브레이크를 밟아도 늦다 — 자전거도 차도 바로 멈추지 않는다'
      });
    }
  }
  function retry() {
    var S = SCENES[st.i]; st.tries[S.id] = (st.tries[S.id] || 0) + 1;
    if (G.praise) G.praise.miss();   // 콤보만 끊는다 — 교실에서는 벌하지 않는다
    st.retryT = 1.8;                                    // 잠깐 보여 준 뒤 그 장면 처음으로
    if (G.walker) G.walker.v = 0;
  }
  function pass(msg) {
    var S = SCENES[st.i]; st.done[S.id] = true;
    if (TG.audio.jingle) TG.audio.jingle(3);
    if (G.hud && G.hud.burst) G.hud.burst('⭐', 6);
    notice('✅ ' + S.name + ' — ' + msg, 'good', 4600);
    if (G.praise) G.praise.cheer(S.id === 'cross' ? 'bike' : 'scene', 55, { feed: S.icon + ' ' + S.name + ' 통과' });   // 🎖 장면 통과 = 등업 한 걸음
    var cl = cardLine(S.card); if (cl) setTimeout(function () { if (st) hint(cl); }, 900);
    say(msg, true); st.passT = 3.0; paint();
  }

  // ---------- 장면 ----------
  function clearScene() {
    st.parked.forEach(function (p) { scene.remove(p.g); }); st.parked = [];
    st.actors.forEach(function (a) { if (a && a.dispose) a.dispose(); }); st.actors = [];
    if (st.lineMesh) { scene.remove(st.lineMesh); st.lineMesh = null; }
    if (G.walker && G.walker.setMarker) G.walker.setMarker(null);
    if (st.holdNode && G.signals && G.signals.restoreReal) { G.signals.restoreReal(st.holdNode); st.holdNode = null; }
    if (G.walker && G.walker.ride) G.walker.ride.dec = 3.5;
    setPassenger(false);
    quizShow(false);
  }
  function goalOf(S) {
    if (S.id === 'lane') return st.grade === 'teen' ? '차도 오른쪽 가장자리로 ' + LANE_SEC + '초 달려요 — 중·고등학생은 보도로 달리지 않아요' : '보도로 천천히 — 사람 옆에서는 멈추거나 비켜 가요';
    return S.goal;
  }
  function nextScene() {
    clearScene();
    st.i++;
    if (st.i >= SCENES.length) { finish(); return; }
    var S = SCENES[st.i];
    setupScene(S.id, true);
    notice(S.icon + ' ' + (st.i + 1) + '/' + SCENES.length + ' ' + S.name + ' — ' + goalOf(S), 'info', 4600);
    paint();
  }
  function setupScene(id, first) {
    var W = G.walker, g = geo(), nA = g.nA;
    st.g = g; st.sceneT = 0; st.stopT = 0; st.stoppedOnce = false; st.lookT = -99; st.prevX = null; st.hintT = -99; st.retryT = 0;
    if (id === 'gap') {
      // 🅿️ 보도 안쪽(건물 쪽)에서 **주차된 차 사이로** 차도에 나간다. 달려오는 차는 세워 둔 차에 가려 늦게 보인다(사각).
      // 자리는 시설물(지하철 출입구·가로등·표지·노거수)과 겹치지 않는 곳을 고른다(소유자: 「사람과 시설물이 겹치면 성의 없어 보여」)
      var zg = clearZ(nA.x + g.half + 2.4, nA.z, [40, 34, 46, 28, 52]), xP = nA.x + g.shoulder;
      if (first) parkCars([{ x: xP, z: zg - 4.4, h: Math.PI }, { x: xP, z: zg + 4.4, h: Math.PI }, { x: xP, z: zg + 9.8, h: Math.PI, type: 'suv' }, { x: xP, z: zg + 15.2, h: Math.PI }]);
      st.gap = { z: zg, curb: nA.x + g.half };
      W.setBike('ride'); W.teleport(nA.x + g.half + 2.4, zg, -Math.PI / 2);
      W.setMarker({ x: nA.x + g.half - 1.4, z: zg, name: '차 사이' });
      st.carSpawned = false;
    } else if (id === 'cross') {
      // 🚸 횡단보도 앞 보도. 자전거를 탄 채로 들어가면 「보행자」가 아니다 — 내려서 끌고 건넌다.
      var zc = nA.z + (city.crossNear(nA, 0) + city.crossFar(nA, 0)) / 2;
      st.cross = { z: zc, onCross: false, greenOn: false };
      W.setBike('ride'); W.teleport(nA.x + g.half + 1.7, zc, -Math.PI / 2);
      W.setMarker({ x: nA.x - g.half - 1.6, z: zc, name: '건너편' });
      if (G.signals && G.signals.setRealOff) { G.signals.setRealOff(nA, true); st.holdNode = nA; }
      if (G.signals) G.signals.set(nA, 'v', 'green');            // 처음엔 보행 적색(세로 도로 차가 간다) — 기다리는 것부터
    } else if (id === 'lane') {
      st.lane = { edgeT: 0, swT: 0, warnT: -99, wrongWarned: false, fast: {} };
      if (st.grade === 'teen') {
        W.setBike('ride'); W.teleport(nA.x - (g.half - 1.3), nA.z + 24, 0);
      } else {
        W.setBike('ride'); W.teleport(nA.x - g.sideOff, nA.z + 24, 0);
        // 보도에서 마주 걸어오는 사람 둘 — 사람 옆에서는 천천히(멈추거나 내려서 끈다)
        if (first || !st.actors.length) {
          [[0.5, 15], [-0.4, 23]].forEach(function (p) {
            var a = TG.Character.actor(scene, terrain, 'civilian', nA.x - g.sideOff + p[0], nA.z + 24 + p[1], Math.PI);
            a.startZ = a.pos.z; a.startX = a.pos.x; st.actors.push(a);
          });
        }
        st.actors.forEach(function (a) { a.pos.x = a.startX; a.pos.z = a.startZ; a.target = null; });
      }
      W.setMarker({ x: W.pos.x, z: nA.z + 54, name: '앞으로' });
    } else if (id === 'brake') {
      // 🛑 가장자리 차로. 한 번은 보통 자전거, 한 번은 **브레이크 없는 픽시** — 멈추는 거리를 몸으로 비교한다.
      var zL = nA.z + 40, xE = nA.x - (g.half - 1.3);
      st.brake = st.brake && !first ? st.brake : { sub: 0, d: [] };
      st.brake.zL = zL; st.brake.maxV = 0; st.brake.bz = null; st.brake.bv = 0; st.brake.scare = false;
      W.setBike('ride'); W.teleport(xE, nA.z + 22, 0);
      W.ride.dec = st.brake.sub === 1 ? 1.0 : 3.5;
      if (!st.lineMesh) {
        var ln = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.0), new THREE.MeshBasicMaterial({ color: 0xff3b3b, transparent: true, opacity: 0.85, depthWrite: false }));
        ln.rotation.x = -Math.PI / 2; ln.position.set(xE, (terrain ? terrain.heightAt(xE, zL) : 0) + 0.24, zL); scene.add(ln); st.lineMesh = ln;
      }
      if (!st.actors.length) {
        var kid = TG.Character.actor(scene, terrain, 'kid', nA.x - g.half - 0.9, zL + 6.5, Math.PI / 2);
        kid.homeX = kid.pos.x; st.actors.push(kid);
      }
      st.actors.forEach(function (a) { a.pos.x = a.homeX || a.pos.x; a.target = null; });
      if (st.brake.sub === 1) notice('🚲 이번에는 브레이크 없는 픽시 자전거예요 — 같은 곳에서 멈춰 봐요', 'warn', 4200);
      // 👥 셋째: 친구를 뒤에 태웠을 때(v0.9.93) — 소유자: 「자전거 2인 탑승하면 왜 문제가 되는지」.
      // 무게가 늘면 같은 브레이크로도 더 멀리 간다(게임 설계값 — 제동 감속을 줄여 보여 준다). 뒤에 탄 친구가 실제로 보인다.
      setPassenger(st.brake.sub === 2);
      if (st.brake.sub === 2) {
        W.ride.dec = 2.3;
        notice('👥 이번에는 친구를 뒤에 태웠어요 — 같은 곳에서 멈춰 봐요', 'warn', 4200);
      }
    } else if (id === 'class') {
      // 🛴 보도 한쪽에 세 대를 세워 두고(보통 전기자전거 · 스로틀 전기자전거 · 전동킥보드) 네 문제를 푼다. 조작은 멈춘다.
      var zq = clearZ(nA.x + g.half + 2.4, nA.z, [34, 40, 28, 46]);
      W.setBike('walk'); W.teleport(nA.x + g.sideOff, zq, 0); W.v = 0;
      if (first) {
        var sx = nA.x + g.sideOff + 1.4;
        parkCars([{ x: sx, z: zq + 2.2, h: Math.PI / 2, type: 'bike' }, { x: sx, z: zq + 3.8, h: Math.PI / 2, type: 'bike' }, { x: sx, z: zq + 5.4, h: Math.PI / 2, type: 'pm' }]);
      }
      st.quiz = { i: 0, wrong: 0, lock: 0 };
      quizShow(true); quizPaint();
    } else if (id === 'free') {
      // 🛣 자유 주행 — 교실이 아니라 **그냥 타는 판**. 대신 원칙이 살아 있고, 사람을 치면 그 자리에서 절차가 시작된다.
      var B = g.B, dests = [];
      var pick = [[B.i, B.j + 1, '🏪 편의점'], [B.i + 1, B.j + 1, '🏫 학교 앞'], [B.i, B.j, '🏠 우리 집']];
      pick.forEach(function (p) {
        var n = city.nodes[p[0]] && city.nodes[p[0]][p[1]]; if (!n) return;
        dests.push({ x: n.x - g.half - 2.2, z: n.z - 14, name: p[2] });
      });
      if (!dests.length) dests.push({ x: nA.x - g.half - 2.2, z: nA.z - 14, name: '🏠 우리 집' });
      st.free = { dests: dests, at: 0, ok: 0, warnT: -99, swT: 0, sigT: -99, crossT: 0, wrongT: -99, crash: null, goodT: 0, ridden: 0 };
      W.setBike('ride'); W.teleport(nA.x - (g.half - 1.3), nA.z + 30, 0);
      W.setMarker({ x: dests[0].x, z: dests[0].z, name: dests[0].name });
      // 자유 주행에는 차와 사람이 있어야 한다 — 청소년 교실은 이미 교통량·행인을 절반으로 켜 두고 시작한다(main.js)
      notice('🛣 자유 주행 — 차도 **오른쪽 가장자리**로, 신호를 지키고, 횡단보도는 **내려서 끌고** 건너요', 'info', 5200);
    }
  }
  function clearZ(x, z0, offs) {
    var lim = st.g.nB && st.g.nB.z > z0 ? st.g.nB.z - z0 - 30 : 46, best = z0 + offs[0], bestD = -1;
    for (var k = 0; k < offs.length; k++) {
      if (offs[k] > lim) continue;
      var z = z0 + offs[k], d = 99;
      ['lamps', 'signs', 'subways', 'trees'].forEach(function (key) {
        (city[key] || []).forEach(function (o) {
          var ox = o.x !== undefined ? o.x : (o.pos && o.pos.x), oz = o.z !== undefined ? o.z : (o.pos && o.pos.z);
          if (Math.abs(ox - x) < 6 && Math.abs(oz - z) < 20) d = Math.min(d, Math.hypot(ox - x, oz - z));
        });
      });
      (city.monuments || []).forEach(function (o) { d = Math.min(d, Math.hypot(o.x - x, o.z - z) - 10); });
      if (d >= 5) return z;
      if (d > bestD) { bestD = d; best = z; }
    }
    return best;
  }
  function spawnApproach() {
    st.carSpawned = true;
    var g = st.g, TR = G.traffic; if (!TR || !TR.spawn) return;
    var li = Math.max(0, g.lanes - 1);
    TR.spawn({ at: { x: g.nA.x + city.laneOff('v', g.B.i, li), z: st.gap.z + 27, d: 2, node: g.nA }, v: 8, cruise: 8, straight: true, type: 'sedan', trait: null, violator: false, laneIdx: li });
  }

  function updGap(dt, W) {
    var gp = st.gap, nearCurb = W.pos.x < gp.curb + 2.2 && W.pos.x > gp.curb - 0.2;
    if (W.v < 0.35 && nearCurb) st.stopT += dt; else if (W.v > 0.8) st.stopT = 0;
    if (st.stopT >= 0.9) st.stoppedOnce = true;
    if (!st.carSpawned && (W.pos.x < gp.curb + 1.6 || st.sceneT > 3)) spawnApproach();
    var x = W.pos.x, crossed = st.prevX !== null && st.prevX >= gp.curb - 0.2 && x < gp.curb - 0.2;
    st.prevX = x;
    if (!crossed) {
      if (nearCurb && W.v < 0.35 && st.sceneT - st.hintT > 5) { st.hintT = st.sceneT; hint('👀 살피기로 좌우를 보고 — 차가 지나간 뒤에 나가요'); }
      return;
    }
    var danger = approachingCar(gp.z, 26);
    if (danger) {
      nearMiss(danger, '주차된 차 사이에서 갑자기 나왔어요');
      notice('😨 아찔! 주차된 차 뒤에서 나오면 운전자가 나를 못 봐요 — 멈추고 살펴요', 'bad', 4600);
      say('주차된 차 사이에서 갑자기 나오면 운전하는 사람이 나를 못 봐요. 멈추고 살펴요', true);
      retry(); return;
    }
    var looked = st.t - st.lookT < 4.5, stopped = st.stoppedOnce;
    if (!(looked && stopped)) {
      addRisk(RISK.blind, '멈추거나 살피지 않고 나갔어요');
      notice('🍀 차가 없었을 뿐이에요 — ' + (!stopped ? '연석 앞에서 멈추고 ' : '') + (!looked ? '👀 좌우를 살피고 ' : '') + '나가요', 'warn', 4600);
      say('운이 좋았을 뿐이에요. 멈추고 살핀 다음에 나가요', true);
      retry(); return;
    }
    pass('멈추고 살핀 뒤 안전하게 나갔어요');
  }
  function updCross(dt, W) {
    var c = st.cross, g = st.g, S2 = G.signals;
    if (!c.greenOn && st.sceneT > 3) { c.greenOn = true; if (S2) S2.set(g.nA, 'h', 'green'); hint('🟢 초록불 — 🚶 내려서 끌고 건너요'); say('초록불이에요. 자전거에서 내려서 끌고 건너요'); }
    if (c.greenOn && S2 && S2.holdPed) S2.holdPed(g.nA, 'v');
    var pl = TG.walkerPlace(city, S2, W.pos.x, W.pos.z);
    var inRoad = pl.where === 'crosswalk' || pl.where === 'road' || pl.where === 'box';
    if (inRoad && !c.onCross) {
      if (W.riding) {
        addRisk(RISK.rideCross, '자전거를 탄 채로 횡단보도에 들어갔어요');
        notice('🚲 타고 건너면 보행자가 아니에요 — 내려서 끌고 건너요', 'bad', 4600);
        say('자전거를 타고 건너면 보행자가 아니에요. 내려서 끌고 건너요', true);
        var cl = cardLine('ride-cross'); if (cl) hint(cl);
        retry(); return;
      }
      if (pl.where !== 'crosswalk') { notice('🚸 횡단보도 안으로 건너요', 'warn', 2600); retry(); return; }
      if (!pl.walk) { notice('🔴 빨간불 — 초록불을 기다려요', 'warn', 2600); retry(); return; }
      c.onCross = true;
    }
    if (c.onCross && W.riding && inRoad) { addRisk(RISK.rideCross, '건너다가 자전거에 올라탔어요'); notice('🚲 다 건널 때까지 끌고 가요', 'bad', 3000); retry(); return; }
    if (c.onCross && W.pos.x < g.nA.x - g.half - 0.6) pass('내려서 끌고, 초록불에 건넜어요');
  }
  function updLane(dt, W) {
    var L = st.lane, g = st.g, nA = g.nA, pl = TG.walkerPlace(city, G.signals, W.pos.x, W.pos.z), fwd = Math.cos(W.heading);
    if (W.pos.z > nA.z + 56) { W.teleport(W.pos.x, nA.z + 24, W.heading); }        // 한 블록 안에서 돈다(교차로로 안 들어가게)
    if (st.grade === 'teen') {
      var lat = nA.x - W.pos.x;                                                    // 도로 중심에서 서쪽으로 떨어진 거리
      if (pl.where === 'sidewalk' && W.riding && W.v > 0.8) {
        L.swT += dt;
        if (L.swT > 1.0 && st.sceneT - L.warnT > 3) {
          L.warnT = st.sceneT; addRisk(RISK.sidewalk, '중·고등학생이 보도로 달렸어요');
          notice('🚫 보도는 사람이 걷는 곳 — 13세 이상은 차도 오른쪽 가장자리로 달려요', 'bad', 4200);
          var cl = cardLine('ride-lane'); if (cl) hint(cl);
        }
      } else L.swT = 0;
      if (pl.where === 'road' && fwd < -0.5 && !L.wrongWarned) { L.wrongWarned = true; addRisk(RISK.wrongWay, '거꾸로 달렸어요(역주행)'); notice('⛔ 차와 같은 방향으로 달려요 — 거꾸로 달리면 정면으로 부딪혀요', 'bad', 3800); }
      if (pl.where === 'road' && lat < g.half - 3.4 && st.sceneT - L.warnT > 4) { L.warnT = st.sceneT; addRisk(RISK.lanes, '차로 한가운데로 달렸어요'); hint('↘️ 가장자리로 — 차로 한가운데는 뒤차가 피하기 어려워요'); }
      var onEdge = pl.where === 'road' && lat > g.half - 3.2 && lat < g.half - 0.2 && fwd > 0.7 && W.v > 1.0;
      if (onEdge) L.edgeT += dt;
      if (L.edgeT >= LANE_SEC) pass('차도 오른쪽 가장자리로, 차와 같은 방향으로 달렸어요');
    } else {
      var fastNow = false;
      st.actors.forEach(function (a, k) {
        if (!a.target) a.goTo(a.pos.x, a.pos.z - 30, 1.15);
        var d = Math.hypot(a.pos.x - W.pos.x, a.pos.z - W.pos.z);
        if (d < 2.6 && W.riding && W.v > 1.6 && !L.fast[k]) { L.fast[k] = true; fastNow = true; }
      });
      if (fastNow) {
        addRisk(RISK.fastPed, '사람 옆을 빠르게 지나갔어요');
        notice('🚶 사람 옆에서는 천천히 — 멈추거나 내려서 끌어요', 'bad', 4200);
        var cy = cardLine('ride-yield'); if (cy) hint(cy);
      }
      var passedAll = st.actors.length && st.actors.every(function (a) { return W.pos.z > a.pos.z + 2; });
      if (passedAll) pass(Object.keys(L.fast).length ? '다 지나갔어요 — 다음엔 사람 옆에서 더 천천히' : '사람 옆을 천천히, 안전하게 지나갔어요');
    }
  }
  function updBrake(dt, W) {
    var b = st.brake, a = st.actors[0];
    b.maxV = Math.max(b.maxV, W.v);
    if (W.braking && b.bz === null && W.v > 1.0) { b.bz = W.pos.z; b.bv = W.v; }
    if (b.sub === 1 && !b.scare && W.pos.z > b.zL + 5 && W.v > 1.2) {                        // 픽시: 선을 한참 넘어 사람 앞까지
      b.scare = true; if (TG.audio.bad) TG.audio.bad(); G.punch = 0.7; G.shake = 0.35;
      if (a) a.goTo(a.pos.x - 1.6, a.pos.z, 3.2);
      notice('😨 선을 한참 넘었어요 — 브레이크 없는 자전거는 멈추지 못해요', 'bad', 4200);
    }
    var capped = W.pos.z > b.zL + 17;
    if (capped) { W.v = 0; }
    var stopped = b.maxV > 2.5 && W.v < 0.15;
    if (!stopped) { if (W.v < 0.2 && b.maxV < 2.5 && st.sceneT > 6 && st.sceneT - st.hintT > 5) { st.hintT = st.sceneT; hint('🚲 힘껏 달려 봐요 — 🛑 선 앞에서 브레이크'); } return; }
    var d = Math.max(0, W.pos.z - (b.bz === null ? b.zL : b.bz)), over = W.pos.z - b.zL;
    if (b.sub === 0) {
      if (b.maxV < 3.3) { hint('🚲 조금 더 빠르게 달린 다음에 멈춰 봐요'); retry(); return; }
      if (over > 1.5) { addRisk(RISK.overshoot, '선을 넘어 멈췄어요'); notice('↩️ 선을 넘었어요 — 조금 더 일찍 브레이크를 잡아요', 'warn', 3400); retry(); return; }
      b.d[0] = { d: d, v: b.bv || b.maxV };
      notice('✅ 보통 자전거: 시속 ' + Math.round((b.bv || b.maxV) * 3.6) + 'km 에서 ' + d.toFixed(1) + 'm 만에 멈췄어요', 'good', 4200);
      b.sub = 1; st.retryT = 2.6;                                                           // 같은 자리에서 한 번 더(픽시)
      return;
    }
    if (b.sub === 1) {
      b.d[1] = { d: d, v: b.bv || b.maxV };
      var ratio = b.d[0] && b.d[0].d > 0.3 ? d / b.d[0].d : 0;
      notice('😨 픽시: ' + d.toFixed(1) + 'm' + (ratio ? ' — 보통의 약 ' + ratio.toFixed(1) + '배' : '') + '. 브레이크 없는 자전거는 타지 않아요', 'warn', 4400);
      b.sub = 2; st.retryT = 2.6;                                                           // 셋째: 친구를 뒤에 태우고
      return;
    }
    b.d[2] = { d: d, v: b.bv || b.maxV };
    var r2 = b.d[0] && b.d[0].d > 0.3 ? d / b.d[0].d : 0;
    setPassenger(false);
    var cl2 = cardLine('ride-inertia'); if (cl2) setTimeout(function () { if (st) hint(cl2); }, 2600);   // 소유자(2026-09-16): 「바퀴 달린 물건은 차 — 관성 때문에 바로 못 멈춘다 → 안전운전의무」
    var cl3 = cardLine('ride-two-bike'); if (cl3) setTimeout(function () { if (st) hint(cl3); }, 6200);
    pass('보통 ' + (b.d[0] ? b.d[0].d.toFixed(1) : '?') + 'm · 픽시 ' + (b.d[1] ? b.d[1].d.toFixed(1) : '?') + 'm · 둘이 탔을 때 ' + d.toFixed(1) + 'm' +
         (r2 ? '(보통의 약 ' + r2.toFixed(1) + '배)' : '') + '. 무게가 늘면 바로 못 멈춰요');
  }
  // 👥 뒤에 탄 친구 — 자전거 메시에 사람 리그를 붙인다(뒤 짐받이 자리)
  var passenger = null;
  function setPassenger(on) {
    var W = G.walker; if (!W || !W.bike) return;
    if (on && !passenger && TG.Character && TG.Character.build) {
      passenger = TG.Character.build('kid', { shirt: 0xf2b134 });
      if (TG.Character.pose) TG.Character.pose(passenger, 'ride');
      passenger.group.position.set(0, 0.46, -0.95);         // 자전거 메시는 사람보다 0.5m 앞에 붙어 있다(walker.setBike) — 탄 사람 0.45m 뒤
      passenger.group.scale.setScalar(1.3);                     // 어린이 리그(0.62배)를 청소년 키로 — 앞사람보다 조금 낮게 앉는다
      W.bike.add(passenger.group);
    }
    if (passenger) passenger.group.visible = !!on;
  }
  self.passengerOn = function () { return !!(passenger && passenger.group.visible); };

  // ---------- 🔴 내 앞 신호(v0.9.94) ----------
  // 소유자(2026-09-17): 「자기 신호가 아닐 경우 도로에 진입했을 때는 자전거·PM·보행자일 경우 위험 신호를 줘야 해」.
  //  · **타고 있으면 「차」** — 차량 신호를 따른다(시행규칙 별표 2: 녹색 = 직진·우회전, 적색 = 정지선·횡단보도·교차로 직전 정지).
  //    적색에 정지선을 넘으면 적색등을 크게 보여 준다.
  //  · **내려서 끌고 있으면 보행자** — 보행 신호를 따른다. 적색 횡단보도에 들어서면 같은 경고.
  var sw = { along: null, node: null, onRedCross: false };
  function signalWatch(W) {
    if (!G.signals || !G.sigAlert) return;
    var pl = TG.walkerPlace(city, G.signals, W.pos.x, W.pos.z);
    if (!W.riding) {                                                   // 끌고 걷는 중 = 보행자
      var redCross = pl.where === 'crosswalk' && !pl.walk;
      if (redCross && !sw.onRedCross) { G.sigAlert('ped'); addRisk(RISK.redLight, '적색 보행 신호에 횡단보도로 들어갔어요'); }
      sw.onRedCross = redCross; sw.along = null;
      return;
    }
    sw.onRedCross = false;
    if (W.v < 0.6) { sw.along = null; return; }
    var d = TG.headingToDir(W.heading), f = TG.DIR_VEC[d];
    var nd = city.nearestNode ? city.nearestNode(W.pos.x, W.pos.z) : null; if (!nd) return;
    var along = (nd.x - W.pos.x) * f[0] + (nd.z - W.pos.z) * f[1];        // 앞쪽 교차로까지(음수면 이미 지남)
    var stopAt = city.stopDist(nd, d);
    if (sw.node === nd && sw.along !== null && sw.along > stopAt && along <= stopAt && along > 0) {
      var ms = G.signals.moveState ? G.signals.moveState(nd, d, 'S') : null;
      if (ms && ms.s === 'red') { G.sigAlert('veh'); addRisk(RISK.redLight, '적색 신호에 정지선을 넘었어요'); if (G.praise) G.praise.miss(true); }
    }
    sw.node = nd; sw.along = along;
  }

  // ---------- 🛴 이건 자전거일까?(v0.9.93) ----------
  // 문항은 짧게, 정답의 근거는 카드(laws.json)가 말한다 — 조문 번호를 코드에 적지 않는다.
  var QUIZ = [
    { q: '🚲 페달을 밟아야만 모터가 돕는 전기자전거\n(시속 25km 넘으면 모터가 멈추고, 30kg 미만)', a: ['면허 없이 탄다 — 자전거다', '원동기장치자전거 면허가 필요하다', '자동차 면허가 필요하다'], ok: 0, card: 'ride-ebike-class' },
    { q: '🛵 손잡이(스로틀)만 돌려도\n페달 없이 굴러가는 전기자전거', a: ['그냥 자전거다', '원동기장치자전거다 — 면허·안전모가 필요하다', '아무 규칙도 없다'], ok: 1, card: 'ride-ebike-class' },
    { q: '🛴 전동킥보드에 친구와 둘이 탔다', a: ['가까운 거리면 괜찮다', '안 된다 — 킥보드 정원은 1명이다', '헬멧만 쓰면 된다'], ok: 1, card: 'ride-seats' },
    { q: '🪪 전동킥보드, 타기 전에 챙길 것은?', a: ['아무것도 없다', '원동기장치자전거 면허(만 16세) · 안전모 · 보험 확인', '자전거라서 필요 없다'], ok: 1, card: 'ride-insurance' }
  ];
  self.QUIZ_N = QUIZ.length;
  function quizShow(on) {
    var b = el('bikeQuiz'); if (!b) return;
    b.style.display = on ? 'flex' : 'none';
    if (on && !b._bound) {
      b._bound = true;
      b.addEventListener('pointerdown', function (e) {
        var t = e.target && e.target.closest ? e.target.closest('button[data-i]') : null;
        if (!t) return;
        e.preventDefault(); e.stopPropagation(); TG.audio.resume();
        if (G.bike) G.bike.quizPick(+t.getAttribute('data-i'));
      });
    }
  }
  function quizPaint(mark) {
    var b = el('bikeQuiz'); if (!b || !st || !st.quiz) return;
    var Q = QUIZ[st.quiz.i]; if (!Q) return;
    var h = '<div class="bq-n">🛴 ' + (st.quiz.i + 1) + ' / ' + QUIZ.length + '</div><div class="bq-q">' + esc(Q.q).replace(/\n/g, '<br>') + '</div>';
    Q.a.forEach(function (txt, k) {
      var cls = mark && mark.pick === k ? (k === Q.ok ? ' ok' : ' no') : (mark && mark.show && k === Q.ok ? ' ok' : '');
      h += '<button type="button" data-i="' + k + '" class="' + cls + '"' + (st.quiz.lock > 0 ? ' disabled' : '') + '>' + esc(txt) + '</button>';
    });
    b.innerHTML = h;
  }
  self.quizPick = function (k) {
    if (!st || !st.quiz || st.quiz.lock > 0) return false;
    var Q = QUIZ[st.quiz.i]; if (!Q) return false;
    var right = k === Q.ok, cl = cardLine(Q.card);
    if (right) {
      st.quiz.lock = 1.4; quizPaint({ pick: k });
      if (G.praise) G.praise.cheer('quiz', 15, { feed: '🛴 ' + (st.quiz.i + 1) + '번 정답' });
      if (TG.audio.good) TG.audio.good();
      if (cl) hint(cl);
    } else {
      st.quiz.lock = 1.8; st.quiz.wrong++;
      addRisk(RISK.quiz, '헷갈렸어요 — ' + Q.a[Q.ok]);
      quizPaint({ pick: k, show: true });
      notice('❌ 정답은 「' + Q.a[Q.ok] + '」 — 모른다고 봐주지 않아요', 'bad', 4200);
      if (G.praise) G.praise.miss();
      if (cl) hint(cl);
    }
    st.quiz.next = right;
    return right;
  };
  function updClass(dt, W) {
    var qz = st.quiz; if (!qz) return;
    W.v = 0;
    if (qz.lock > 0) {
      qz.lock -= dt;
      if (qz.lock <= 0) {
        qz.lock = 0;
        if (qz.next) {
          qz.i++; qz.next = false;
          if (qz.i >= QUIZ.length) { quizShow(false); pass('세상은 모른다고 봐주지 않는다 — 알고 타야 해요'); return; }
        }
        quizPaint();
      }
    }
  }

  // ---------- 🛣 자유 주행(v0.9.90) ----------
  // 소유자(2026-09-16): 「교통안전교실을 만들어 놓으니까 잘 안 해. 순찰근무·자유주행도 중고등학생이 할 수 있으니
  //  **그들이 자주 위반하는 것**, 자전거도 조금만 잘못되어도 **경찰서 교통수사팀**으로 올 수 있다는 것 …
  //  특히 **12개 항목 — 횡단보도**, 게다가 **인도에서 사람과 부딪히면** 경찰서로 갈 수 있네.」
  // 그래서 이 판에서는 **가르치지 않고 겪게** 한다: 신나게 타다가 사람을 치면 그 자리에서 절차가 시작된다.
  function crashCard(where) {
    // 어디서 쳤는가로 조문이 갈린다. 문구·조문은 **laws.json 에서만** 읽는다(코드에 조문을 적지 않는다).
    var id = where === 'crosswalk' ? 'crash-crosswalk' : where === 'sidewalk' ? 'crash-sidewalk' : 'crash-road';
    return law(id) || law('crash-road');
  }
  function crashScene(ped, where) {
    var F = st.free; if (!F || F.crash) return;
    var W = G.walker;
    F.crash = { where: where, t: 0 };
    W.v = 0; if (W.setBike) W.setBike('walk');
    G.slowmo = 1.4; G.punch = 1.1; G.shake = 0.7;
    if (TG.audio.thump) TG.audio.thump(1);
    if (TG.audio.skidBurst) TG.audio.skidBurst();
    if (G.buzz) G.buzz([220, 80, 220]);
    if (G.hud && G.hud.vignette) { G.hud.vignette(0.6); st.vigT = 1.6; }
    if (ped && ped.pos) { ped.stunned = 6; ped.v = 0; }
    addRisk(RISK.crash, where === 'crosswalk' ? '횡단보도에서 사람을 쳤어요' : where === 'sidewalk' ? '보도에서 사람을 쳤어요' : '차도에서 사람을 쳤어요');
    if (G.praise) G.praise.miss(true);
    var c = crashCard(where);
    // 👁 먼저 **두 시점으로 되돌려 보고**(내 눈 · 보행자 눈) 그다음에 절차 카드를 연다
    var shown = false;
    if (G.replay && ped && ped.pos) {
      var px = ped.pos.x, pz = ped.pos.z, py = (ped.y || 0);
      shown = G.replay.play([
        { pos: [W.pos.x, (W.y || 0) + 1.35, W.pos.z], look: [px, py + 1.1, pz], sec: 2.6, push: 0.8,
          kick: '① 내 눈(자전거)', ttl: '「금방 지나갈 줄 알았다」',
          sub: where === 'crosswalk' ? '횡단보도는 사람이 먼저다 — 타고 건너면 나는 「차」다' : where === 'sidewalk' ? '보도는 사람이 걷는 곳이다 — 나는 「차」다' : '차도에서도 앞의 사람이 먼저다',
          say: '내 눈에는 금방 지나갈 것 같았어요' },
        { pos: [px, py + 1.55, pz], look: [W.pos.x, (W.y || 0) + 1.1, W.pos.z], sec: 2.8, push: 0.5,
          kick: '② 걷던 사람 눈', ttl: '갑자기 자전거가 나타난다',
          sub: '사람은 피할 시간이 없다 — 자전거도 바로 멈추지 않는다(관성)',
          say: '걷던 사람 눈에는 자전거가 갑자기 나타나요' }
      ], function () { showCrash(c, where); });
    }
    if (!shown) showCrash(c, where);
    say('사람과 부딪혔어요. 자전거도 차예요 — 여기서부터는 교통사고 처리가 시작됩니다', true);
  }
  function showCrash(c, where) {
    var box = el('bikeCrash'); if (!box) return;
    var whereKo = where === 'crosswalk' ? '횡단보도' : where === 'sidewalk' ? '보도(인도)' : '차도';
    var rows = '';
    if (c) {
      rows += '<div class="cr-law">' + esc(c.law || '') + (c.verified === false ? ' <i>(확인 중)</i>' : '') + '</div>';
      if (c.situation) rows += '<p>' + esc(c.situation) + '</p>';
      if (c.tip) rows += '<p class="cr-tip">' + esc(c.tip) + '</p>';
      if (c.penalty) rows += '<p class="cr-pen">' + esc(c.penalty) + '</p>';
    }
    var base = law('crash-bike-is-car');
    if (base) rows += '<div class="cr-base">' + esc(base.law || '') + ' — ' + esc(base.situation || '') + '</div>';
    box.innerHTML = '<div class="cr-box"><h3>🚓 교통수사팀 — 출석 요구</h3>' +
      '<div class="cr-where">' + esc(whereKo) + '에서 사람과 부딪혔습니다</div>' + rows +
      '<div class="cr-note">게임은 여기서 멈춥니다. 다친 사람은 없습니다 — 실제라면 지금부터 조사가 시작됩니다.</div>' +
      '<button id="crashOk" type="button">다시 타기</button></div>';
    box.style.display = 'flex';
    var b = el('crashOk');
    if (b) b.onclick = function () { box.style.display = 'none'; if (st && st.free) { st.free.crash = null; setupScene('free', false); } };
  }
  function pedNear(W) {
    var P = G.peds && G.peds.peds ? G.peds.peds : [];
    for (var i = 0; i < P.length; i++) {
      var p = P[i]; if (!p || !p.pos) continue;
      var d = Math.hypot(p.pos.x - W.pos.x, p.pos.z - W.pos.z);
      if (d < 0.95) return p;
    }
    return null;
  }
  function updFree(dt, W) {
    var F = st.free, g = st.g, pl = TG.walkerPlace(city, G.signals, W.pos.x, W.pos.z);
    if (F.crash) return;                                   // 조사 카드가 떠 있는 동안은 멈춘다
    signalWatch(W);                                        // 🔴 내 앞 신호 — 타면 차량 신호, 끌면 보행 신호
    // ① 사람과 부딪히면 — 어디서 쳤는지로 조문이 갈린다
    if (W.riding && W.v > 1.2) {
      var hitP = pedNear(W);
      if (hitP) { crashScene(hitP, pl.where === 'crosswalk' ? 'crosswalk' : pl.where === 'sidewalk' ? 'sidewalk' : 'road'); return; }
    }
    // ② 보도 주행 — 13세 이상은 차도 오른쪽 가장자리
    if (pl.where === 'sidewalk' && W.riding && W.v > 0.8) {
      F.swT += dt;
      if (F.swT > 1.2 && st.sceneT - F.warnT > 5) {
        F.warnT = st.sceneT; addRisk(RISK.sidewalk, '보도로 달렸어요');
        notice('🚫 보도는 사람이 걷는 곳 — 여기서 사람을 치면 **보도 침범**입니다', 'bad', 4200);
        var cs = cardLine('crash-sidewalk'); if (cs) hint(cs);
      }
    } else F.swT = 0;
    // ③ 횡단보도를 탄 채로 건너면 — 보행자가 아니다
    if (pl.where === 'crosswalk' && W.riding && W.v > 0.6) {
      F.crossT += dt;
      if (F.crossT > 0.6 && st.sceneT - F.sigT > 5) {
        F.sigT = st.sceneT; addRisk(RISK.rideCross, '횡단보도를 탄 채로 건넜어요');
        notice('🚸 횡단보도는 **내려서 끌고** — 타고 건너면 보행자가 아닙니다', 'bad', 4200);
        var cc = cardLine('ride-cross'); if (cc) hint(cc);
      }
    } else F.crossT = 0;
    // ④ 역주행
    var fwd = Math.cos(W.heading);
    if (pl.where === 'road' && Math.abs(fwd) > 0.5) {
      var wrong = (W.pos.x < g.nA.x && fwd < -0.5) || (W.pos.x > g.nA.x && fwd > 0.5);
      if (wrong && st.sceneT - F.wrongT > 6) { F.wrongT = st.sceneT; addRisk(RISK.wrongWay, '거꾸로 달렸어요(역주행)'); notice('⛔ 차와 같은 방향으로 — 거꾸로 달리면 정면으로 부딪혀요', 'bad', 3800); }
    }
    // ⑤ 규칙을 지키며 달리면 칭찬(등업) — 20초마다
    if (pl.where === 'road' && W.riding && W.v > 1.2 && !F.swT) {
      F.goodT += dt;
      if (F.goodT > 20) { F.goodT = 0; if (G.praise) G.praise.cheer('bike', 18, { feed: '규칙대로 주행 🚲' }); }
    }
    // ⑥ 목적지
    var d0 = F.dests[F.at];
    if (d0 && Math.hypot(W.pos.x - d0.x, W.pos.z - d0.z) < 5.5) {
      F.at++; F.ok++;
      if (G.praise) G.praise.cheer('scene', 30, { feed: d0.name + ' 도착' });
      if (F.at >= F.dests.length) { pass('세 곳을 모두 안전하게 다녀왔어요'); return; }
      var d1 = F.dests[F.at];
      W.setMarker({ x: d1.x, z: d1.z, name: d1.name });
      notice('✅ ' + d0.name + ' 도착 — 다음은 ' + d1.name, 'good', 3200);
    }
  }
  // ---------- 화면 ----------
  function paint() {
    var box = el('bikeHud'); if (!box || !st) return;
    var S = SCENES[Math.max(0, Math.min(st.i, SCENES.length - 1))];
    var q = function (s) { return box.querySelector(s); };
    var e1 = q('.bk-stage'); if (e1) e1.textContent = st.i < 0 ? '🚲 자전거 교실' : (S.icon + ' ' + (st.i + 1) + '/' + SCENES.length + ' ' + S.name);
    var e2 = q('.bk-grade'); if (e2) e2.textContent = st.grade === 'teen' ? '🏫 중·고등' : st.grade === 'elem' ? '🎒 초등' : '';
    var e3 = q('.bk-goal'); if (e3) e3.textContent = st.i < 0 ? '학년을 골라요' : goalOf(S);
    var e4 = q('.bk-fill'); if (e4) { e4.style.width = st.risk + '%'; e4.className = 'bk-fill ' + (st.risk >= RISK_PASS ? 'bad' : st.risk >= 30 ? 'warn' : 'ok'); }
    var e5 = q('.bk-rtxt'); if (e5) e5.textContent = '위험 ' + Math.round(st.risk) + ' / 통과 ' + RISK_PASS + ' 미만';
    var dots = q('.bk-dots');
    if (dots) dots.innerHTML = SCENES.map(function (s2, k) { return '<span class="' + (st.done[s2.id] ? 'ok' : k === st.i ? 'on' : '') + '">' + s2.icon + '</span>'; }).join('');
    paintButtons();
  }
  function paintButtons() {
    var W = G.walker, b = el('btnBikeMount'); if (!b || !W) return;
    var ic = b.querySelector('.ico'), tx = b.querySelector('.lbl');
    if (ic) ic.textContent = W.riding ? '🚶' : '🚲';
    if (tx) tx.textContent = W.riding ? '내리기' : '타기';
  }
  function paintLive() {
    var box = el('bikeHud'); if (!box || !st) return;
    var S = SCENES[st.i]; if (!S) return;
    var live = box.querySelector('.bk-live'); if (!live) return;
    var t = '';
    if (S.id === 'lane' && st.grade === 'teen' && st.lane) t = '가장자리 ' + Math.min(LANE_SEC, st.lane.edgeT).toFixed(1) + ' / ' + LANE_SEC + '초';
    else if (S.id === 'gap') t = (st.stoppedOnce ? '🛑 멈춤 ✓' : '🛑 멈춤') + ' · ' + (st.t - st.lookT < 4.5 ? '👀 살핌 ✓' : '👀 살핌');
    else if (S.id === 'brake' && st.brake) t = (st.brake.sub === 0 ? '보통 자전거' : '픽시(브레이크 없음)') + ' · 시속 ' + Math.round(G.walker.v * 3.6) + 'km';
    else if (S.id === 'cross' && st.cross) t = G.walker.riding ? '🚲 타는 중 — 내려서 끌어요' : '🚶 끌고 가는 중';
    if (live._t !== t) { live._t = t; live.textContent = t; }
  }
  function showGrade(on) {
    var e = el('bikeGrade'); if (!e) return;
    e.style.display = on ? 'flex' : 'none';
    if (!e._bound) {
      e._bound = true;
      e.addEventListener('pointerdown', function (ev) {
        var b = ev.target && ev.target.closest ? ev.target.closest('[data-grade]') : null;
        if (!b || !G.bike) return;
        ev.preventDefault(); ev.stopPropagation(); TG.audio.resume();
        G.bike.setGrade(b.getAttribute('data-grade'));
      });
    }
  }
  function showResult(ok) {
    var e = el('bikeResult'); if (!e) return;
    var rows = SCENES.map(function (S) {
      var n = st.tries[S.id] || 0;
      return '<li class="' + (st.done[S.id] ? 'ok' : 'no') + '">' + S.icon + ' ' + esc(S.name) + ' <b>' + (st.done[S.id] ? '✓' : '—') + '</b>' + (n ? ' <i>다시 ' + n + '번</i>' : '') + '</li>';
    }).join('');
    var ids = SCENES.map(function (S) { return S.card; }).concat(['ride-inertia', 'ride-signal', 'ride-two-bike', 'ride-seats', 'ride-insurance', 'crash-bike-is-car', 'crash-crosswalk', 'crash-sidewalk', 'ride-helmet', 'ride-visible', st.grade === 'teen' ? 'ride-license' : 'ride-age13']);
    var cards = ids.map(function (id) {
      var c = law(id); if (!c) return '';
      return '<div class="bk-card"><b>' + esc(c.name) + (c.verified === false ? ' <em>확인 중</em>' : '') + '</b><small>' + esc(c.law || '') + '</small><p>' + esc(c.tip || c.situation || '') + '</p></div>';
    }).join('');
    var next = ok ? (st.grade === 'teen' ? '🪪 다음 단계 — 원동기장치자전거면허(아래 카드). 🛴 전동킥보드 교실은 준비 중이에요.' : '🎒 초등학생은 전동킥보드를 탈 수 없어요(아래 카드). 자전거를 안전하게 타요.') : '위험 게이지가 ' + RISK_PASS + ' 을 넘었어요 — 한 번 더 해 봐요.';
    e.innerHTML = '<div class="bk-box"><h3>' + (ok ? '🎉 자전거 교실 통과!' : '🔁 다시 도전해요') + '</h3>' +
      '<div class="bk-rbar"><div class="bk-fill ' + (st.risk >= RISK_PASS ? 'bad' : st.risk >= 30 ? 'warn' : 'ok') + '" style="width:' + st.risk + '%"></div><span>위험 ' + Math.round(st.risk) + '</span></div>' +
      '<ul class="bk-rows">' + rows + '</ul><div class="bk-next">' + esc(next) + '</div><div class="bk-cards">' + cards + '</div>' +
      '<div class="bk-acts"><button data-act="again">🔁 다시 하기</button><button data-act="quit">🏠 끝내기</button></div>' +
      '<div class="bk-src">위험 게이지는 게임 설계값입니다(과실비율·통계 수치가 아닙니다). 법령 카드는 T-Book·국가법령정보센터 원문에서 옮겼습니다.</div></div>';
    e.style.display = 'flex';
    if (!e._bound) {
      e._bound = true;
      e.addEventListener('pointerdown', function (ev) {
        var b = ev.target && ev.target.closest ? ev.target.closest('[data-act]') : null;
        if (!b || !G.bike) return;
        ev.preventDefault(); ev.stopPropagation();
        if (b.getAttribute('data-act') === 'again') G.bike.restart();
        else if (G.endShift) G.endShift('🚲 자전거 교실 — ' + (G.bike.state && G.bike.state.passed ? '통과' : '다시 도전'));
      });
    }
  }
  function finish() {
    clearScene();
    st.finished = true;
    var ok = st.risk < RISK_PASS && SCENES.every(function (S) { return st.done[S.id]; });
    st.passed = ok;
    if (ok) { var c = TG.save.get('course', {}) || {}; c.bike = true; TG.save.set('course', c); }
    if (G.walker) { G.walker.v = 0; }
    showResult(ok);
    say(ok ? '자전거 교실을 통과했어요! 멈추고, 살피고, 끌고 건너는 것 잊지 마요' : '위험 게이지가 높아요. 한 번 더 해 봐요', true);
    if (ok && G.hud && G.hud.burst) { G.hud.burst('🎉', 6); G.hud.burst('⭐', 6); }
    if (ok && TG.audio.totFanfare) TG.audio.totFanfare();
  }

  // ---------- 바깥에서 부르는 것 ----------
  self.start = function (preset) {
    var W = G.walker; if (!W || !W.setBike) return false;
    st = { i: -1, t: 0, sayCd: 0, risk: 0, riskLog: [], grade: null, misses: 0, done: {}, tries: {}, lookT: -99, stopT: 0, vigT: 0, sceneT: 0,
           parked: [], actors: [], lineMesh: null, retryT: 0, passT: 0, lookSweep: 0, finished: false, passed: false };
    self.state = st;
    document.body.classList.add('bikemode');
    var g = geo(); st.g = g;
    W.setBike('ride'); W.teleport(g.nA.x + g.half + 2.4, g.nA.z + 40, -Math.PI / 2);
    if (preset) { paint(); self.setGrade(preset); return true; }   // 메뉴 「청소년 교실」 = 중·고등학생으로 바로 시작(학년 창 없음)
    showGrade(true); paint();
    say('자전거 교실이에요. 먼저 학년을 골라요', true);
    return true;
  };
  self.setGrade = function (k) {
    if (!st) return;
    st.grade = k === 'teen' ? 'teen' : 'elem';
    showGrade(false);
    if (G.walker && G.walker.rig && G.walker.rig.group) G.walker.rig.group.scale.setScalar(st.grade === 'teen' ? 1.12 : 0.95);
    say('네 가지 장면을 차례로 해 봐요. 멈추고, 살피고, 안전하게', true);
    nextScene();
  };
  self.update = function (dt, mv) {
    if (!st) return mv;
    var W = G.walker; if (!W) return mv;
    st.t += dt; st.sayCd -= dt;
    W.brakeHold = !!(G.input && G.input.btn && G.input.btn.bikebrake);
    if (st.vigT > 0) { st.vigT -= dt; if (st.vigT <= 0 && G.hud && G.hud.vignette) G.hud.vignette(0); }
    if (st.lookSweep > 0) {                                            // 👀 살피기 — 고개와 화면이 왼쪽 → 오른쪽을 훑는다
      st.lookSweep -= dt;
      var ph = 1 - st.lookSweep / 1.4;
      G.lookYaw = Math.sin(ph * Math.PI * 2) * 1.15; G.lookHold = true; W.look = G.lookYaw * 0.8; W.lookScan = true;
      if (st.lookSweep <= 0) { G.lookHold = false; W.look = 0; W.lookScan = false; }
    }
    st.actors.forEach(function (a) { if (a && a.update) a.update(dt, false); });
    pushOutParked(W);
    if (!st.grade || st.finished) return stop();
    if (st.retryT > 0) { st.retryT -= dt; if (st.retryT <= 0 && SCENES[st.i]) setupScene(SCENES[st.i].id, false); return stop(); }
    if (st.passT > 0) { st.passT -= dt; if (st.passT <= 0) nextScene(); return stop(); }
    st.sceneT += dt;
    var hit = carTouching(W);
    if (hit && hit.v > 0.8) {
      nearMiss(hit, '차와 부딪힐 뻔했어요');
      notice('😨 차와 부딪힐 뻔했어요 — 차도에서는 차를 먼저 살펴요', 'bad', 3800);
      retry(); return stop();
    }
    var id = SCENES[st.i] ? SCENES[st.i].id : null;
    if (id === 'gap') updGap(dt, W); else if (id === 'cross') updCross(dt, W); else if (id === 'lane') updLane(dt, W); else if (id === 'brake') updBrake(dt, W); else if (id === 'class') updClass(dt, W); else if (id === 'free') updFree(dt, W);
    paintLive();
    return mv;
  };
  self.look = function () {
    if (!st) return;
    st.lookT = st.t; st.lookSweep = 1.4;
    if (TG.audio.ui) TG.audio.ui();
    if (G.hud && G.hud.burst) G.hud.burst('👀', 2);
  };
  self.mount = function () {
    var W = G.walker; if (!st || !W) return;
    if (W.riding && W.v > 1.2) { hint('🛑 먼저 멈춘 다음에 내려요'); return; }
    W.setBike(W.riding ? 'walk' : 'ride'); paintButtons();
    if (TG.audio.ui) TG.audio.ui();
  };
  self.bell = function () { if (TG.audio.bell) TG.audio.bell(); else if (TG.audio.ui) TG.audio.ui(); if (G.hud && G.hud.burst) G.hud.burst('🔔', 2); };
  self.restart = function () {
    if (!st) return;
    var grade = st.grade;
    var r = el('bikeResult'); if (r) r.style.display = 'none';
    clearScene();
    st.i = -1; st.risk = 0; st.riskLog = []; st.misses = 0; st.done = {}; st.tries = {}; st.finished = false; st.passed = false; st.brake = null;
    st.grade = grade; nextScene();
  };
  self.badges = function () {
    if (!st) return [];
    var out = SCENES.filter(function (S) { return st.done[S.id]; }).map(function (S) { return { text: S.icon + ' ' + S.name }; });
    if (st.passed) out.push({ text: '🚲 자전거 교실 통과', gold: true });
    return out;
  };
  self.on = function () { return !!st; };
  self.dispose = function () {
    if (st) clearScene();
    document.body.classList.remove('bikemode');
    var g1 = el('bikeGrade'); if (g1) g1.style.display = 'none';
    var r1 = el('bikeResult'); if (r1) r1.style.display = 'none';
    if (G.walker && G.walker.setBike) G.walker.setBike(null);
    if (G.hud && G.hud.vignette) G.hud.vignette(0);
    G.lookHold = false;
    st = null; self.state = null;
  };
  self.scenes = SCENES;
  self.RISK_PASS = RISK_PASS;
};
