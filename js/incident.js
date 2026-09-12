// 현장 안전조치 — 라바콘 차로 차단 · 불꽃신호기 · 순찰차 방패.
//
// 소유자 요구(2026-09-11): 「야간 사고 처리 공간 확보 — 맨 끝 차로라도 1개 차로 이상, 4차로면 2~3개 차로 차단,
// 불꽃신호기·라바콘으로 공간과 시인성」. 그리고 2026-09-12 안전 근무 시뮬레이션 카드 「이런 상황과 멘트도 넣자」.
//
// 문구·수치는 **코드에 적지 않는다** — data/laws.json 의 incidentScene 에서 읽는다(T-Book 문구 그대로).
//   라바콘 후방 3중 배치 (50/100/150m) · 사고차량 후방 100m까지 차로 차단 · 최소 6개, 권장 10개 이상 ·
//   다차로 차단 시 추가 4개 필요 · 야광 라바콘 50% 이상 · 야간·악천후에는 불꽃신호기(점화 후 200m 가시거리).
//
// 게임에서 하는 일: 🚧 단추(K) 한 번 = 한 개 차로 차단(라바콘 3중). 필요한 만큼 더 누르면 다차로 차단.
// 밤·비·눈이면 마지막에 🔥 불꽃신호기 점화까지 해야 안전조치가 끝난다.
TG.IncidentScene = function (game) {
  var self = this, city = game.city, scene = game.scene;
  var S = null;   // { car, node, d, axis, idx, lanes, closed, cones:[], flares:[], group }

  function laws() { return (game.laws && game.laws.incidentScene) ? game.laws.incidentScene : null; }
  function msg(k) { var L = laws(); return (L && L.msgs && L.msgs[k]) ? L.msgs[k] : ''; }
  // 이 도로에서 몇 개 차로를 막아야 하는가 — 편도 4차로 이상이면 2개(다차로 차단), 아니면 1개.
  // T-Book 「4차로 이상 본선: 견인차 도착 전까지 사고차량 차로 폐쇄 보존」 · 「다차로 차단 시 추가 4개 필요」.
  function needOf(lanes) { return lanes >= 4 ? 2 : 1; }
  self.needOf = needOf;

  function dark() { return !!(game.weather && (game.weather.dark || game.weather.kind === 'rain' || game.weather.kind === 'snow')); }
  self.darkNow = dark;

  // 현장 차량이 선 도로를 읽는다. 격자 도로에서만 쓴다(연결로 현장은 다음 판).
  function frameOf(car) {
    var fr = city.frameAt(car.pos.x, car.pos.z, car.heading);
    if (!fr || fr.kind !== 'grid') return null;
    var d = TG.headingToDir(car.heading);
    return { axis: fr.axis, idx: fr.idx, d: d, lanes: city.lanesOf(fr.axis, fr.idx), center: fr.center };
  }

  function begin(car) {
    var fr = frameOf(car); if (!fr) return null;
    S = { car: car, axis: fr.axis, idx: fr.idx, d: fr.d, lanes: fr.lanes, center: fr.center,
          closed: 0, need: needOf(fr.lanes), cones: [], flares: [], group: null, zones: [] };
    return S;
  }
  self.state = function () { return S; };
  self.forCar = function (car) { return (S && S.car === car) ? S : null; };

  // 라바콘 하나 — 야광 띠(흰 테)를 두른 원뿔. T-Book 「야광 라바콘 50% 이상 비율 유지(야간 대비)」
  function coneMesh(x, z, glow) {
    var gb = new TG.GeoBuilder();
    gb.cylinder(0, 0, 0, 0.26, 0.06, 0.72, 8, 0xff7a00, true);
    gb.box(0, 0.02, 0, 0.5, 0.04, 0.5, 0x2a2e33, {});
    gb.cylinder(0, 0.34, 0, 0.16, 0.13, 0.1, 8, glow ? 0xfdfdf5 : 0xf2f2f2, false);
    var m = new THREE.Mesh(gb.build(), new THREE.MeshLambertMaterial({ vertexColors: true, emissive: glow ? 0x554400 : 0x000000 }));
    m.position.set(x, 0, z);
    return m;
  }
  // 불꽃신호기 — 붉은 통 + 타오르는 빛. 점화 후 200m 가시거리(laws 문구)
  function flareMesh(x, z) {
    var gb = new TG.GeoBuilder();
    gb.cylinder(0, 0, 0, 0.05, 0.05, 0.42, 6, 0xb2231f, true);
    gb.cylinder(0, 0.42, 0, 0.09, 0.02, 0.16, 6, 0xffd23f, true);
    var m = new THREE.Mesh(gb.build(), new THREE.MeshLambertMaterial({ vertexColors: true }));
    m.position.set(x, 0, z);
    var s = new THREE.Sprite(new THREE.SpriteMaterial({ map: TG.tex.flare ? TG.tex.flare() : null, color: 0xffa33a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    s.scale.set(2.6, 2.6, 1); s.position.set(0, 0.75, 0); m.add(s); m.userData.glow = s;
    return m;
  }

  // 차로 하나를 막는다. 라바콘은 **현장 뒤 100m 까지**, 3중(50·100·150m 감각)으로 놓는다.
  self.closeLane = function (car) {
    if (!car || !car.incident) return { ok: false, why: 'no-car' };
    if (!S || S.car !== car) { if (!begin(car)) return { ok: false, why: 'off-grid' }; }
    if (S.closed >= Math.max(1, S.lanes - 1)) return { ok: false, why: 'max' };
    var f = TG.DIR_VEC[S.d], r = [-f[1], f[0]];
    // 막는 차로는 **바깥(오른쪽)부터** 안쪽으로. 현장 차량이 선 차로가 첫 번째다.
    var lane = Math.max(0, S.lanes - 1 - S.closed);
    var off = city.laneOff(S.axis, S.idx, lane);
    if (!S.group) { S.group = new THREE.Group(); scene.add(S.group); }
    // 개수: 첫 차로 6개(최소 6개) · 차로를 더 막을 때마다 4개 추가(다차로 차단 시 추가 4개 필요)
    // 라바콘은 **도로 좌표**로 놓는다(현장 차량이 어느 차로에 섰든 차로 중앙에 정확히 선다).
    // 뒤로 8m~100m(T-Book 「사고차량 후방 100m까지 차로 차단」), 3중(50·100·150m 감각)의 앞쪽 두 겹이 이 구간이다.
    var n = S.closed === 0 ? 6 : 4, made = 0;
    for (var k = 0; k < n; k++) {
      var back = 8 + (100 - 8) * (k / (n - 1 || 1));
      var bx, bz;
      if (S.axis === 'v') { bx = S.center + r[0] * off; bz = car.pos.z - f[1] * back; }
      else { bz = S.center + r[1] * off; bx = car.pos.x - f[0] * back; }
      var cm = coneMesh(bx, bz, k % 2 === 0);
      S.group.add(cm); S.cones.push(cm); made++;
    }
    S.closed++;
    // 차량 AI 에게 「이 차로는 막혔다」고 알린다 — 130m 앞에서 안쪽 차로로 옮기고 서행한다
    var zone = { x: car.pos.x, z: car.pos.z, d: S.d, axis: S.axis, idx: S.idx, lane: lane, back: 110 };
    S.zones.push(zone);
    if (game.traffic.control) { game.traffic.control.zones = (game.traffic.control.zones || []); game.traffic.control.zones.push(zone); }
    return { ok: true, closed: S.closed, need: S.need, cones: made, lane: lane, total: S.cones.length };
  };

  // 불꽃신호기 점화 — 라바콘 후방(차단 구간 끝)에 둘.
  self.lightFlares = function (car) {
    if (!S || S.car !== car) return { ok: false, why: 'no-scene' };
    if (!S.closed) return { ok: false, why: 'no-cone' };
    if (S.flares.length) return { ok: false, why: 'done' };
    var f = TG.DIR_VEC[S.d], r = [-f[1], f[0]], off = city.laneOff(S.axis, S.idx, S.lanes - 1);
    if (!S.group) { S.group = new THREE.Group(); scene.add(S.group); }
    for (var k = 0; k < 2; k++) {
      var back = 105 + k * 20, fx2, fz2;
      if (S.axis === 'v') { fx2 = S.center + r[0] * (off - k * 1.6); fz2 = car.pos.z - f[1] * back; }
      else { fz2 = S.center + r[1] * (off - k * 1.6); fx2 = car.pos.x - f[0] * back; }
      var fm = flareMesh(fx2, fz2); S.group.add(fm); S.flares.push(fm);
    }
    return { ok: true, n: S.flares.length };
  };

  // 순찰차 방패 — 현장 후방 30~50m · 진행축과 10~25° · 경광등. T-Book 문구는 laws 의 shield.how.
  self.shieldOf = function (car) {
    var pl = game.player; if (!pl || !car) return null;
    var f = TG.DIR_VEC[TG.headingToDir(car.heading)];
    var dx = car.pos.x - pl.pos.x, dz = car.pos.z - pl.pos.z;
    var along = dx * f[0] + dz * f[1], lat = dx * -f[1] + dz * f[0];
    var pf = pl.forward(), ang = Math.abs(TG.wrapAngle(Math.atan2(pf[0], pf[1]) - Math.atan2(f[0], f[1]))) * 180 / Math.PI;
    return { along: along, lat: lat, angle: ang,
             back: along > 22 && along < 62, slant: ang >= 7 && ang <= 32, stopped: pl.speedKmh() < 2, siren: !!pl.siren,
             ok: along > 22 && along < 62 && Math.abs(lat) < 9 && ang >= 7 && ang <= 32 && pl.speedKmh() < 2 && !!pl.siren };
  };

  // 지금 무엇을 해야 하는가 — HUD 단추 이름과 다음 할 일
  self.next = function (car) {
    var st = (S && S.car === car) ? S : null, lanes = st ? st.lanes : null;
    if (!st) { var fr = frameOf(car); lanes = fr ? fr.lanes : 2; return { step: 'cone', label: '🚧 라바콘', need: needOf(lanes), closed: 0, hint: msg('cone') }; }
    if (st.closed < st.need) return { step: 'cone', label: '🚧 라바콘', need: st.need, closed: st.closed, hint: st.closed ? msg('coneMore') : msg('cone') };
    if (dark() && !st.flares.length) return { step: 'flare', label: '🔥 불꽃', need: st.need, closed: st.closed, hint: msg('flare') };
    return { step: 'done', label: '🚧 완료', need: st.need, closed: st.closed, hint: msg('keep') };
  };

  // 안전조치가 갖춰졌는가(사고 현장 완료 조건). 고장차(broken)는 종전대로 라바콘을 요구하지 않는다.
  self.ready = function (car) {
    if (!car || !car.incident) return false;
    if (car.incident.kind !== 'crash') return true;
    var st = (S && S.car === car) ? S : null;
    if (!st || st.closed < st.need) return false;
    if (dark() && !st.flares.length) return false;
    return true;
  };

  // 후미 안전조치 순찰차 — 무전(📡)으로 부른다. 현장 뒤 45m, 막은 차로(없으면 맨 바깥 차로)에 선다.
  self.callBackup = function (car) {
    if (!car) return { ok: false };
    if (!S || S.car !== car) { if (!begin(car)) return { ok: false, why: 'off-grid' }; }
    if (S.backup) return { ok: false, why: 'already' };
    var f = TG.DIR_VEC[S.d], r = [-f[1], f[0]], lane = S.closed ? Math.max(0, S.lanes - S.closed) : S.lanes - 1;
    var off = city.laneOff(S.axis, S.idx, Math.min(lane, S.lanes - 1)), bx, bz, back = 45;
    if (S.axis === 'v') { bx = S.center + r[0] * off; bz = car.pos.z - f[1] * back; }
    else { bz = S.center + r[1] * off; bx = car.pos.x - f[0] * back; }
    var c = game.traffic.spawnBackup ? game.traffic.spawnBackup({ x: bx, z: bz, heading: TG.DIR_HEADING[S.d] }) : null;
    if (!c) return { ok: false, why: 'no-car' };
    S.backup = c; return { ok: true, back: back };
  };
  self.hasBackup = function (car) { return !!(S && S.car === car && S.backup); };
  // ---------- 견인고리·견인줄 ----------
  // T-Book 「서초경찰서는 모든 순찰차에 견인고리·견인줄을 상시 적재한다 … 사고·고장 차량을 차로에 계속 두는 것 자체가
  // 2차사고를 부른다. 견인차 도착을 기다리며 본선에 세워 두는 것보다, 가능한 경우 순찰차로 즉시 안전한 곳까지 끌어내는 것이 원칙」.
  // 「바퀴가 굴러가지 않는 상태라도 몇십 미터는 이동시킬 수 있다. 본선에서 갓길·안전지대까지의 그 몇십 미터가 사람을 살린다.」
  // **에어(압축공기) 확인은 소유자 현장 지시**다 — 티북에 없다(laws 의 tow.airSource 에 그렇게 적어 두었다).
  var TOW = null;   // { car, rope, asked, connected, len }
  function bigOf(car) { return car && (car.isBus || car.isTruck || car.type === 'bus' || car.type === 'truck'); }
  self.towState = function () { return TOW; };
  self.bigOf = bigOf;
  // 순찰차가 고장차 **앞**에 같은 방향으로 서 있는가(끌려면 앞에서 당긴다)
  self.hitchOf = function (car) {
    var pl = game.player; if (!pl || !car) return null;
    var pf = pl.forward(), dx = car.pos.x - pl.pos.x, dz = car.pos.z - pl.pos.z;
    var behind = -(dx * pf[0] + dz * pf[1]);   // 순찰차 뒤쪽에 있으면 +
    var lat = dx * -pf[1] + dz * pf[0];
    var cf = [Math.sin(car.heading), Math.cos(car.heading)], sameWay = cf[0] * pf[0] + cf[1] * pf[1];
    return { behind: behind, lat: lat, sameWay: sameWay,
             ok: behind > 2.5 && behind < 9 && Math.abs(lat) < 3.2 && sameWay > 0.72 && pl.speedKmh() < 4 };
  };
  // 🪝 단추: ① 대형차면 에어를 먼저 묻는다 ② 연결 ③ 끌어서 갓길·안전지대까지
  self.towAct = function (car) {
    var L = laws(), pl = game.player;
    if (!car) return { ok: false, why: 'no-car' };
    if (TOW && TOW.car === car && TOW.connected) return { ok: false, why: 'already' };
    var big = bigOf(car);
    if (big && (!TOW || TOW.car !== car || !TOW.asked)) {
      TOW = { car: car, asked: true, connected: false, rope: null, len: 4.2 };
      if (car.airLost === undefined) car.airLost = Math.random() < 0.35;
      return { ok: false, why: 'ask', air: !car.airLost, msg: (L && L.tow && L.tow.air) || '' };
    }
    if (big && car.airLost) return { ok: false, why: 'air', msg: (L && L.tow && L.tow.air) || '' };
    var h = self.hitchOf(car);
    if (!h || !h.ok) return { ok: false, why: 'place', h: h };
    if (!TOW || TOW.car !== car) TOW = { car: car, asked: true, connected: false, rope: null, len: 4.2 };
    TOW.connected = true; TOW.len = Math.max(3.4, h.behind);
    // 견인줄: 순찰차 뒤 ↔ 고장차 앞을 잇는 얇은 원기둥(매 프레임 자리·길이를 고친다)
    var gb = new TG.GeoBuilder(); gb.box(0, 0, 0, 0.06, 0.06, 1, 0x2a2e33, {});
    TOW.rope = new THREE.Mesh(gb.build(), new THREE.MeshLambertMaterial({ vertexColors: true }));
    scene.add(TOW.rope);
    car.towing = true;
    return { ok: true, len: Math.round(TOW.len * 10) / 10 };
  };
  self.towUpdate = function (dt) {
    if (!TOW || !TOW.connected) return null;
    var car = TOW.car, pl = game.player;
    if (!car || !pl || game.traffic.cars.indexOf(car) < 0) { self.towCut(); return null; }
    var pf = pl.forward();
    var hx = pl.pos.x - pf[0] * (pl.len / 2 + 0.2), hz = pl.pos.z - pf[1] * (pl.len / 2 + 0.2);   // 순찰차 뒤 고리
    var dx = car.pos.x - hx, dz = car.pos.z - hz, d = Math.hypot(dx, dz);
    // **줄은 늘어나지 않는다** — 줄 길이를 넘으면 그만큼 끌려온다. 속도는 순찰차보다 빠를 수 없다.
    if (d > TOW.len) {
      var pull = Math.min(d - TOW.len, Math.max(0.02, pl.speedKmh() / 3.6 * dt * 1.6));
      car.pos.x -= dx / d * pull; car.pos.z -= dz / d * pull;
      var want = Math.atan2(-dx / d, -dz / d);
      car.heading += TG.wrapAngle(want - car.heading) * Math.min(1, dt * 2.4);
      if (car.mesh) { car.mesh.position.set(car.pos.x, car.y || 0, car.pos.z); car.mesh.rotation.y = car.heading; }
    }
    // 줄 그리기
    var mx = (hx + car.pos.x) / 2, mz = (hz + car.pos.z) / 2, len = Math.max(0.2, Math.hypot(car.pos.x - hx, car.pos.z - hz));
    TOW.rope.position.set(mx, 0.34, mz); TOW.rope.scale.set(1, 1, len); TOW.rope.rotation.y = Math.atan2(car.pos.x - hx, car.pos.z - hz);
    // 끌고 갈 수 있는 속도(과속하면 줄이 끊긴다 — 20km/h)
    if (pl.speedKmh() > 22) { self.towCut(); return { cut: true }; }
    // 갓길·안전지대에 닿았는가
    var fr = city.frameAt(car.pos.x, car.pos.z, car.heading);
    var safeNow = !fr || fr.kind !== 'grid' ? true : Math.abs(fr.lateral) >= city.shoulderMin(fr.axis, fr.idx) - 0.4;
    return { towing: true, safe: safeNow, d: d };
  };
  self.towCut = function () {
    if (!TOW) return;
    if (TOW.rope) { scene.remove(TOW.rope); TOW.rope = null; }
    if (TOW.car) TOW.car.towing = false;
    TOW.connected = false;
  };
  self.towDone = function () { if (TOW && TOW.car) TOW.car.towing = false; self.towCut(); TOW = null; };
  self.update = function (dt) {
    if (!S) return;
    for (var i = 0; i < S.flares.length; i++) {
      var g = S.flares[i].userData.glow;
      if (g) { var p = 1 + 0.22 * Math.sin(game.time ? game.time * 9 + i : Date.now() / 90 + i); g.scale.set(2.6 * p, 2.6 * p, 1); }
    }
  };

  self.clear = function () {
    self.towDone();
    if (S && S.group) { scene.remove(S.group); }
    if (game.traffic && game.traffic.control) game.traffic.control.zones = [];
    S = null;
  };
};
