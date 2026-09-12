// 행인: 팔·다리가 흔들리는 관절 인형. 각 도로의 보도 중앙선(반폭 + 1.5m)을 걷고 모서리에서 보행 신호에 건넌다.
// 일부는 무단횡단(블록 중간 횡단, 적색 횡단)을 한다 → 차들이 급제동하고, 플레이어는 경광등 켜고 옆에 서면 「보행자 계도」.
TG.Peds = function (scene, city, signals, cfg, rng) {
  var peds = [], self = this;
  this.peds = peds; this.player = null; this.traffic = null; this.walker = null;   // walker: 보행자 모드의 플레이어(차량 AI 가 보행자로 취급)
  this.onEvent = function () {};
  // 이미 걷고 있는 사람의 무단횡단 성향까지 지운다 — 어린이 교실·인트로에서 쓴다(보여 주면 안 되는 장면이다).
  this.clearJaywalkers = function () {
    for (var i = 0; i < peds.length; i++) {
      var p = peds[i]; p.jaywalker = false;
      if (p.state === 'jaywalk') { p.state = 'walk'; p.d = p.jayD !== undefined ? p.jayD : p.d; }
      p.jayLive = false;
    }
  };

  var mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  var SHIRTS = [0xd94f4f, 0x3b6fd1, 0x2fa36b, 0xe0b84a, 0x8b5cc7, 0xe8e2d4, 0x2b2f38, 0xf08a5d, 0x6fc3d8, 0xc7c7c7];
  var PANTS = [0x2b3140, 0x4a4a4a, 0x6b5a48, 0x1f2e4a, 0x8a7d6b], SKINS = [0xf1c9a5, 0xd9a06e, 0xb5794f], HAIRS = [0x1a1a1a, 0x3a2a1a, 0x5a3a2a, 0x8a6a4a];
  var geo = {};
  function torsoGeo(shirt, skin, hair, bag) {
    var key = 't' + shirt + ':' + skin + ':' + hair + ':' + bag;
    if (geo[key]) return geo[key];
    var gb = new TG.GeoBuilder();
    gb.box(0, 1.12, 0, 0.40, 0.56, 0.24, shirt, {}); gb.box(0, 0.86, 0, 0.36, 0.06, 0.24, TG.pick(TG.makeRNG(shirt), PANTS), {});
    gb.box(0, 1.44, 0, 0.14, 0.08, 0.14, skin, {}); gb.box(0, 1.60, 0, 0.22, 0.24, 0.22, skin, {});
    gb.box(0, 1.70, -0.01, 0.24, 0.10, 0.24, hair, {}); gb.box(0, 1.62, -0.13, 0.24, 0.18, 0.04, hair, {});
    if (bag) gb.box(0.26, 0.98, 0, 0.1, 0.34, 0.26, 0x6d4f3a, {});
    return (geo[key] = gb.build());
  }
  function limbGeo(color, len, w) { var key = 'l' + color + ':' + len + ':' + w; if (geo[key]) return geo[key]; var gb = new TG.GeoBuilder(); gb.box(0, -len / 2, 0, w, len, w, color, {}); return (geo[key] = gb.build()); }
  // 행인 몸: TG.Character.lite(얼굴·머리카락·신발·가방·모자·치마, 메시 5개). 옷·피부·머리색은 무작위
  function makeMesh(p) {
    var shirt = TG.pick(rng, SHIRTS), pants = TG.pick(rng, PANTS), skin = TG.pick(rng, SKINS), hair = TG.pick(rng, HAIRS);
    var r = TG.Character.lite({ shirt: shirt, pants: pants, skin: skin, hair: hair, bag: rng() < 0.3, hat: rng() < 0.12 ? TG.pick(rng, [0x2b2f38, 0xe0b84a, 0xd94f4f]) : 0, female: rng() < 0.45, shoe: rng() < 0.5 ? 0x2a2a2a : 0xe8e2d4 });
    var g = r.group; p.limbs = r.limbs; p.scale = 0.9 + rng() * 0.2; g.scale.set(p.scale, p.scale, p.scale);
    return g;
  }
  // 이 행인이 걷는 보도선의 오프셋(자기 도로 기준)
  function mySide(p) { return city.sideOff(p.axis, p.idx); }
  // 모서리에서 가로지르는 도로의 보도선(횡단 거리)
  function acrossSide(p, node) { return p.axis === 'v' ? city.sideOff('h', node.j) : city.sideOff('v', node.i); }

  function spawn(opts) {
    opts = opts || {};
    var pl = self.player;
    for (var attempt = 0; attempt < 10; attempt++) {
      var axis = rng() < 0.5 ? 'v' : 'h', i = TG.irange(rng, 0, city.xs.length - 1), j = TG.irange(rng, 0, city.zs.length - 1), side = rng() < 0.5 ? -1 : 1, d, x, z, idx;
      if (axis === 'v') { if (j >= city.zs.length - 1) continue; idx = i; d = rng() < 0.5 ? 0 : 2; x = city.xs[i] + side * city.sideOff('v', i); z = city.zs[j] + 14 + rng() * (city.zs[j + 1] - city.zs[j] - 28); }
      else { if (i >= city.xs.length - 1) continue; idx = j; d = rng() < 0.5 ? 1 : 3; z = city.zs[j] + side * city.sideOff('h', j); x = city.xs[i] + 14 + rng() * (city.xs[i + 1] - city.xs[i] - 28); }
      if (opts.at) { x = opts.at.x; z = opts.at.z; axis = opts.at.axis; idx = opts.at.idx !== undefined ? opts.at.idx : (axis === 'v' ? city.nearestIdx(city.xs, opts.at.coord) : city.nearestIdx(city.zs, opts.at.coord)); side = opts.at.side; d = opts.at.d; }
      if (pl && !opts.at) { var dist = Math.hypot(x - pl.pos.x, z - pl.pos.z); if (dist < cfg.PED_SPAWN_MIN || dist > cfg.PED_SPAWN_MAX) continue; }
      var p = { pos: { x: x, z: z }, axis: axis, idx: idx, coord: axis === 'v' ? city.xs[idx] : city.zs[idx], side: side, d: d, speed: 1.1 + rng() * 0.6, state: 'walk', t: rng() * 10, waitT: 0, decided: null,
                // 무단횡단은 드물게. **인트로에서는 아예 안 나온다** — 홍보 영상은 지켜지는 거리를 보여야 한다
                // (소유자: 「인트로에서 사람들이 너무 많이 무단횡단을 한다. 좋은세상을 보여줘야지」).
                jaywalker: opts.jaywalker !== undefined ? opts.jaywalker : (self.noJaywalk ? false : rng() < 0.07),
                jayT: 0, jayDone: false, warned: false, jayLive: false };
      var m = makeMesh(p); m.position.set(x, 0.2, z); m.rotation.y = TG.DIR_HEADING[d]; m.userData.ped = p; scene.add(m); p.mesh = m; peds.push(p);
      return p;
    }
    return null;
  }
  function remove(p) { scene.remove(p.mesh); var k = peds.indexOf(p); if (k >= 0) peds.splice(k, 1); }

  function step(p, dt) {
    var f = TG.DIR_VEC[p.d];
    if (p.state === 'walk' || p.state === 'cross' || p.state === 'jaywalk') { p.pos.x += f[0] * p.speed * dt; p.pos.z += f[1] * p.speed * dt; }
    // **보도선으로 돌아온다 — 걷는 사람은 차도에 있을 수 없다.**
    // 사람끼리 어깨가 닿으면 옆으로 밀어내는데(separate) 밀린 사람이 돌아올 길이 없어서, 마주 걷는 사람이
    // 오갈수록 조금씩 차도 쪽으로 밀려 나갔다(실측: 보도선에서 5.3m 안쪽 = 바깥 차로를 3.2m 침범한 채 계속 걸음).
    // 그러면 차는 그 사람을 보호하려고(제27조) 정지선 앞에 서서 통행이 막힌다 —
    // 소유자 「보행자들이 자동차가 다니는 차도로 걸어 다니고 있다 에러임」·「차들이 그냥 서있는데」.
    // 그래서 ① 횡단 중이 아니면 **늘** 자기 보도선으로 돌아오고(차를 돌아간 직후 detour 초 동안만 참는다)
    // ② 연석 안쪽으로는 한 걸음도 들어가지 않게 막는다.
    if (p.state !== 'cross' && p.state !== 'jaywalk') {
      if (p.detour > 0) p.detour -= dt;
      else {
        p.detour = undefined;
        var wantL = p.coord + p.side * mySide(p), curL = p.axis === 'v' ? p.pos.x : p.pos.z, dL = wantL - curL;
        if (Math.abs(dL) > 0.03 && Math.abs(dL) < 14) { var mvL = (dL > 0 ? 1 : -1) * Math.min(Math.abs(dL), 1.2 * dt); if (p.axis === 'v') p.pos.x += mvL; else p.pos.z += mvL; }
      }
      var curb = city.halfOf(p.axis, p.idx) + 0.35, offNow = (p.axis === 'v' ? p.pos.x : p.pos.z) - p.coord;
      if (offNow * p.side < curb) { if (p.axis === 'v') p.pos.x = p.coord + p.side * curb; else p.pos.z = p.coord + p.side * curb; }
    }
    if (p.state === 'warned') { p.waitT += dt; if (p.waitT > 3) p.state = 'walk'; return; }
    if (p.state === 'jaywalk') {
      var cross = p.axis === 'v' ? Math.abs(p.pos.x - p.coord) : Math.abs(p.pos.z - p.coord), sideO = mySide(p);
      if (cross >= sideO - 0.1 && p.jayT > 2) {
        p.side = -p.side; p.d = p.jayD; p.state = 'walk'; p.jayLive = false;
        if (p.axis === 'v') p.pos.x = p.coord + p.side * sideO; else p.pos.z = p.coord + p.side * sideO;
      }
      p.jayT += dt; return;
    }
    var along = p.axis === 'v' ? p.pos.z : p.pos.x, node = city.nodeAhead(p.pos.x, p.pos.z, p.d, 0);
    if (!node) {
      // 횡단 중에 앞 교차로가 사라지면(지나쳤다) 「건너는 중」에서 못 빠져나와 끝없이 걸었다 — 88초·134m 를 확인했다.
      if (p.state === 'cross') { p.state = 'walk'; p.decided = null; p.crossNode = null; p.jayLive = false; if (p.hurry) { p.speed /= p.hurryK || 1.5; p.hurry = false; } }
      if (p.state === 'walk') { var edge = p.axis === 'v' ? (p.d === 0 ? city.zs[city.zs.length - 1] : city.zs[0]) : (p.d === 1 ? city.xs[city.xs.length - 1] : city.xs[0]);
        if ((p.axis === 'v' ? p.pos.z : p.pos.x) * (f[0] + f[1]) > edge * (f[0] + f[1]) + 9) { p.d = (p.d + 2) % 4; p.decided = null; } }
      return;
    }
    var nc = p.axis === 'v' ? node.z : node.x, dist = (nc - along) * (f[0] + f[1]), SIDE = acrossSide(p, node);
    if (p.state === 'cross') {
      // **건너던 그 교차로**를 기준으로 다 건넜는지 본다. nodeAhead 는 지나치면 **다음** 교차로를 돌려주므로,
      // 그것으로 재면 dist 가 다시 커져 「건너는 중」이 끝나지 않았다 — 100m 넘게 횡단 중인 사람이 있었다.
      var cn = p.crossNode || node;
      var cnc = p.axis === 'v' ? cn.z : cn.x, cdist = (cnc - along) * (f[0] + f[1]);
      if (cdist < -acrossSide(p, cn)) { p.state = 'walk'; p.decided = cn; p.crossNode = null; p.jayLive = false; if (p.hurry) { p.speed /= p.hurryK || 1.5; p.hurry = false; } return; }
      if (!p.hurry && !signals.pedWalk(node, p.axis === 'v' ? 'h' : 'v')) { p.hurryK = 1.35; p.speed *= 1.35; p.hurry = true; }   // 점멸·적색으로 바뀌면 서둘러 건넌다
      return;
    }
    if (p.state === 'wait') {
      p.waitT += dt;
      var crossAx = p.axis === 'v' ? 'h' : 'v', walk = signals.pedWalk(node, crossAx);
      // 녹색 점멸에는 횡단을 시작할 수 없다 — 시행규칙 별표2 보행신호등 녹색등화의 점멸. 점멸은 횡단 거리에 비례해 길다(v0.9.48).
      var canStart = walk && !signals.pedFlash(node, crossAx);
      if (canStart && !carBlocking(p)) { p.state = 'cross'; p.waitT = 0; p.crossNode = node; }
      else if (!walk && p.jaywalker && !p.jayDone && p.waitT > 4 && !carBlocking(p, false, true)) { p.state = 'cross'; p.crossNode = node; p.jayDone = true; p.jayLive = true; p.jayT = 0; p.jayKind = 'red'; p.hurryK = 1.5; p.speed *= 1.5; p.hurry = true; self.onEvent('jaywalk', p); }
      else if (p.waitT > 62) turnCorner(p, node);   // 한 주기(57초)는 기다려 본다
      return;
    }
    if (p.jaywalker && !p.jayDone && dist > 18 && dist < 48 && rng() < dt * 0.7 && !carBlocking(p, true)) {
      p.jayDone = true; p.jayLive = true; p.jayT = 0; p.state = 'jaywalk'; p.jayD = p.d; p.jayKind = 'mid';
      if (p.axis === 'v') p.d = p.side > 0 ? 3 : 1; else p.d = p.side > 0 ? 2 : 0;
      self.onEvent('jaywalk', p); return;
    }
    if (dist <= SIDE + 1.6 && p.decided !== node) {   // 연석보다 1.6m 뒤 = 보도 위에서 기다린다
      p.decided = node;
      if (city.nodeFrom(node, p.d) && rng() < 0.62) { p.state = 'wait'; p.waitT = 0; }   // 건널 사람은 연석에서 신호를 기다린다
      else turnCorner(p, node);
    }
  }
  function carBlocking(p, sideways, strict) {
    var T = self.traffic; if (!T) return false;
    var f = TG.DIR_VEC[p.d];
    if (sideways) { if (p.axis === 'v') f = [p.side > 0 ? -1 : 1, 0]; else f = [0, p.side > 0 ? -1 : 1]; }
    var all = T.cars.slice(); if (self.player) all.push({ pos: self.player.pos, v: self.player.telemetry.speed });
    for (var i = 0; i < all.length; i++) {
      var c = all[i], dx = c.pos.x - p.pos.x, dz = c.pos.z - p.pos.z, along = dx * f[0] + dz * f[1], lat = Math.abs(dx * -f[1] + dz * f[0]);
      if (along > 0 && along < 16 && lat < 4 && c.v > 3) return true;
      if (lat < 3 && Math.abs(along) < 30 && c.v > 6) return true;
      if (strict && Math.hypot(dx, dz) < 28 && c.v > 1.5) return true;   // 보행 적색 횡단(신호위반 보행)은 근처에 움직이는 차(좌·우회전 차 포함)가 있으면 시작하지 않는다
    }
    return false;
  }
  function turnCorner(p, node) {
    var opts = [];
    if (p.axis === 'v') { var sideH = p.pos.z > node.z ? 1 : -1; [1, 3].forEach(function (nd) { if (city.nodeFrom(node, nd)) opts.push({ axis: 'h', idx: node.j, side: sideH, d: nd }); }); }
    else { var sideV = p.pos.x > node.x ? 1 : -1; [0, 2].forEach(function (nd) { if (city.nodeFrom(node, nd)) opts.push({ axis: 'v', idx: node.i, side: sideV, d: nd }); }); }
    if (!opts.length) { p.d = (p.d + 2) % 4; p.state = 'walk'; p.decided = node; return; }
    var o = TG.pick(rng, opts);
    p.axis = o.axis; p.idx = o.idx; p.side = o.side; p.d = o.d; p.coord = o.axis === 'v' ? city.xs[o.idx] : city.zs[o.idx];
    if (o.axis === 'h') p.pos.z = p.coord + o.side * mySide(p); else p.pos.x = p.coord + o.side * mySide(p);
    p.state = 'walk'; p.decided = node;
  }

  // ---- 겹침 풀기 ----
  // 사람이 사람을 통과하고 차를 통과해 지나가면, 그 뒤에 나오는 어떤 숫자도 믿기지 않는다(소유자 신고).
  // ① 사람끼리: 어깨 반경 안으로 들어오면 서로 밀어낸다. ② 차: 차체 사각형 안에 있으면 가장 가까운 변으로 밀어낸다.
  var PED_R = 0.34;          // 어깨 반경 — 둘이 만나면 0.68m 이상 벌어진다
  function bodies() {        // 밀어낼 대상: 행인 + (보행 모드의) 플레이어·동행 어린이
    var list = peds.slice();
    if (self.walker) list.push(self.walker);
    if (self.extra) for (var i = 0; i < self.extra.length; i++) list.push(self.extra[i]);
    return list;
  }
  function separate() {
    var list = bodies(), n = list.length;
    for (var i = 0; i < n; i++) for (var k = i + 1; k < n; k++) {
      var a = list[i], b = list[k], ap = a.pos, bp = b.pos;
      var dx = bp.x - ap.x, dz = bp.z - ap.z, d2 = dx * dx + dz * dz, R = PED_R * 2;
      if (d2 >= R * R) continue;
      var d = Math.sqrt(d2), ux, uz;
      if (d < 1e-4) { ux = 1; uz = 0; d = 0; }                    // 완전히 겹쳤으면 아무 방향으로 뗀다(방향만 정하고 거리는 0)
      else { ux = dx / d; uz = dz / d; }
      // **플레이어(보행 모드의 사람)는 밀지 않는다.** 조작하는 사람이 밀려나면 횡단보도에서 차도로 튕겨 나간다.
      var aFix = (a === self.walker), bFix = (b === self.walker);
      var gap = R - d;
      if (aFix && bFix) continue;
      // **진행 방향으로는 밀지 않는다.** 같은 방향으로 줄지어 걸으면 뒤 사람이 매 프레임 뒤로 밀려
      // 횡단보도 위에서 제자리걸음이 됐다(소유자: 「횡단보도위 사람들이 같은 자리만 걷고 있어」).
      // 옆으로만 벌린다 — 사람은 나란히 서지, 서로를 뒤로 밀지 않는다.
      var sideStep = function (o, sgn, half) {
        var hd = (o.heading !== undefined) ? o.heading : TG.DIR_HEADING[o.d || 0];
        var fx = Math.sin(hd), fz = Math.cos(hd), rx = -fz, rz = fx;
        var lat = (ux * rx + uz * rz) * sgn;
        if (Math.abs(lat) < 0.25) lat = sgn * 0.6;             // 완전히 일직선이면 정해진 쪽으로 비킨다
        var amt = gap * half * (lat >= 0 ? 1 : -1);
        o.pos.x += rx * amt; o.pos.z += rz * amt;
      };
      if (aFix) sideStep(b, 1, 1);
      else if (bFix) sideStep(a, -1, 1);
      else { sideStep(a, -1, 0.5); sideStep(b, 1, 0.5); }
    }
  }
  // 🚇 **보도 위 시설물을 통과하지 않는다** — 지하철 출입구(계단 옹벽 3.6×2.6m + 난간)가 보도 위에 서 있어
  // 행인이 그 안을 그대로 지나갔다(소유자 2026-09-12: 「사람이 물리적으로 겹쳐져서 성의가 없어 보여」).
  // 사람은 둥글게 밀어내면 충분하다(반지름 2.3m = 옹벽 반대각). 출입구 목록은 city 가 가진 것을 그대로 쓴다.
  function pushOutOfProps() {
    var list = city.subways || []; if (!list.length) return;
    for (var i = 0; i < peds.length; i++) {
      var p = peds[i];
      for (var s = 0; s < list.length; s++) {
        var S = list[s], dx = p.pos.x - S.x, dz = p.pos.z - S.z, d = Math.hypot(dx, dz);
        if (d > 2.3 || d < 1e-4) continue;
        p.pos.x = S.x + dx / d * 2.3; p.pos.z = S.z + dz / d * 2.3;
      }
    }
  }

  function pushOutOfCars(dt) {
    dt = dt || 1 / 30;
    var T = self.traffic; if (!T) return;
    var cars = T.cars.slice();
    // **보행 모드에서는 `self.player` 가 사람(walker)이다.** 그것을 차 목록에 넣으면 자기 자신을 차로 보고
    // 매 프레임 자기를 밀어낸다 — 교차로 근무 경찰관이 1초에 37m 를 미끄러져 벌판으로 나갔다(소유자: 「벌판에 서있다」).
    if (self.player && self.player.mesh && self.player !== self.walker && self.player.wid && self.player.len) cars.push(self.player);
    var list = bodies();

    for (var i = 0; i < cars.length; i++) {
      var c = cars[i], h = c.heading || 0, fx = Math.sin(h), fz = Math.cos(h);
      var hl = (c.len || 4.4) / 2 + PED_R, hw = (c.wid || 1.8) / 2 + PED_R;
      for (var k = 0; k < list.length; k++) {
        var p = list[k]; if (p === c) continue;             // 자기 자신은 건너뛴다(위 방어와 이중으로)
        var dx = p.pos.x - c.pos.x, dz = p.pos.z - c.pos.z;
        var al = dx * fx + dz * fz, la = dx * -fz + dz * fx;         // 차체 국소 좌표(앞뒤, 좌우)
        if (Math.abs(al) >= hl || Math.abs(la) >= hw) continue;      // 차체 밖
        // 사각형 안이다 — 빠져나갈 거리가 짧은 쪽으로 민다
        var outL = hl - Math.abs(al), outW = hw - Math.abs(la);
        // 건너는 사람이 **선 차에 막히면**(밀려나는 방향이 자기가 가려는 방향의 반대) 차를 돌아서 간다. 되밀리기만 하면 매 프레임 같은 자리로 돌아와
        // 차는 사람을 기다리고 사람은 차에 막혀 **서로 영원히 기다렸다**(v0.9.45 검증 — 43~84초 교착). 옆구리에 막히면 가까운 끝(앞·뒤)으로,
        // 앞·뒤 범퍼에 막히면 가까운 옆으로 비킨다. 처음엔 차가 사람 길과 직각일 때만 돌게 해서 **비스듬히 선 회전 차**에는 또 막혔다(v0.9.47 검증 35초).
        var blocked = p !== self.walker && (p.state === 'cross' || p.state === 'jaywalk'), pf = blocked ? TG.DIR_VEC[p.d] : null, sl = 1.4 * dt;
        if (outW <= outL) {
          var s = la >= 0 ? 1 : -1; p.pos.x += -fz * s * outW; p.pos.z += fx * s * outW;
          // 비키는 쪽은 **가려던 방향이 그 면을 따라 기우는 쪽**이다. 가까운 끝만 고르면 비스듬한 차의 모서리에서 옆면↔앞면을 오가며 제자리였다(v0.9.47 검증).
          // 면과 정확히 직각으로 부딪혔을 때만 가까운 끝으로 간다(직각 버스 시험은 그대로).
          if (blocked && (-fz * s * pf[0] + fx * s * pf[1]) < -0.3) { var tg = pf[0] * fx + pf[1] * fz, sg = Math.abs(tg) > 0.2 ? (tg > 0 ? 1 : -1) : (al >= 0 ? 1 : -1), sla = Math.min(Math.max(hl - al * sg, 0), sl); p.pos.x += fx * sg * sla; p.pos.z += fz * sg * sla; p.detour = 2.0; }
        }
        else {
          var s2 = al >= 0 ? 1 : -1; p.pos.x += fx * s2 * outL; p.pos.z += fz * s2 * outL;
          if (blocked && (fx * s2 * pf[0] + fz * s2 * pf[1]) < -0.3) { var tu = pf[0] * -fz + pf[1] * fx, sgl = Math.abs(tu) > 0.2 ? (tu > 0 ? 1 : -1) : (la >= 0 ? 1 : -1), slw = Math.min(Math.max(hw - la * sgl, 0), sl); p.pos.x += -fz * sgl * slw; p.pos.z += fx * sgl * slw; p.detour = 2.0; }
        }
      }
    }
  }

  var spawnT = 0;
  // 무단횡단 표식: 방금 무단횡단한 보행자 머리 위에 위반 표식(차량과 같은 모양) — 60m 안에서만.
  // 전에는 차에만 표식이 떠서 무단횡단자를 눈으로 찾을 수가 없었다(소유자: 「보행자 무단횡단도 단속할 수 있어야」).
  var jayMarkMat = new THREE.SpriteMaterial({ map: TG.tex.marker(), depthTest: false });
  function jayMarks() {
    var pl = self.player;
    for (var i = 0; i < peds.length; i++) {
      var p = peds[i], want = !p.warned && (p.jayLive || (p.jayDone && p.jayT < 12));
      if (want && pl) want = Math.hypot(p.pos.x - pl.pos.x, p.pos.z - pl.pos.z) < 60;
      if (want && !p.mark && p.mesh) { var sp = new THREE.Sprite(jayMarkMat); sp.scale.set(0.9, 0.9, 1); sp.position.set(0, 2.35 / (p.scale || 1), 0); p.mesh.add(sp); p.mark = sp; }
      if (p.mark) p.mark.visible = want;
    }
  }
  this.jayMarks = jayMarks;
  this.update = function (dt, budget) {
    jayMarks();
    spawnT -= dt;
    if (spawnT <= 0) { spawnT = 0.7; if (peds.length < budget) spawn(); }
    var pl = self.player;
    for (var i = peds.length - 1; i >= 0; i--) {
      var p = peds[i]; step(p, dt); p.t += dt;
      if (pl && Math.hypot(p.pos.x - pl.pos.x, p.pos.z - pl.pos.z) > cfg.PED_DESPAWN) remove(p);
    }
    // 걸음을 다 옮긴 뒤에 겹침을 푼다 — 그래야 밀어낸 자리가 그 프레임에 그대로 그려진다
    separate(); pushOutOfCars(dt); pushOutOfProps();
    for (var i2 = peds.length - 1; i2 >= 0; i2--) {
      var q = peds[i2];
      var moving = q.state !== 'wait' && q.state !== 'warned', w = q.t * 7.5 * (q.speed / 1.3), sw = moving ? Math.sin(w) * 0.6 : 0;
      q.mesh.position.set(q.pos.x, 0.2 + (moving ? Math.abs(Math.cos(w)) * 0.03 : 0), q.pos.z); q.mesh.rotation.y = TG.DIR_HEADING[q.d];
      q.limbs[0].rotation.x = sw; q.limbs[1].rotation.x = -sw; q.limbs[2].rotation.x = -sw * 0.7; q.limbs[3].rotation.x = sw * 0.7;
    }
  };
  self.separate = separate; self.pushOutOfCars = pushOutOfCars;   // 검증에서 직접 부른다
  this.nearestAhead = function (x, z, fx, fz, maxAlong, maxLat) {
    var best = null, list = self.walker ? peds.concat([self.walker]) : peds;
    for (var i = 0; i < list.length; i++) {
      var p = list[i], dx = p.pos.x - x, dz = p.pos.z - z, along = dx * fx + dz * fz;
      if (along <= 0 || along > maxAlong || Math.abs(dx * -fz + dz * fx) > maxLat || !city.onRoad(p.pos.x, p.pos.z)) continue;
      if (best === null || along < best) best = along;
    }
    return best;
  };
  this.tryWarn = function (pl) {
    for (var i = 0; i < peds.length; i++) {
      var p = peds[i];
      if (!p.jayLive && !(p.jayDone && p.jayT < 8)) continue;
      if (p.warned) continue;
      if (Math.hypot(p.pos.x - pl.pos.x, p.pos.z - pl.pos.z) < 9) { p.warned = true; p.state = p.state === 'jaywalk' ? 'jaywalk' : 'warned'; p.waitT = 0; return p; }
    }
    return null;
  };
  // 이 접근로(node, d)의 횡단보도 위에 사람이 있는가 — 차량은 다 건널 때까지 정지선 앞에 선다(제27조).
  // 소유자: 「어린이가 다 건널 때까지 차량들은 모두 정지해야 해」
  this.onCrossing = function (node, d) {
    var axis = city.axisOfDir(d), half = city.halfOf(axis, axis === 'v' ? node.i : node.j);
    var near = city.crossNear(node, d), far = city.crossFar(node, d);
    var f = TG.DIR_VEC[d], r = [-f[1], f[0]];
    var list = self.walker ? peds.concat([self.walker]) : peds;
    for (var i = 0; i < list.length; i++) {
      var p = list[i], dx = p.pos.x - node.x, dz = p.pos.z - node.z;
      var alo = dx * f[0] + dz * f[1], lat = dx * r[0] + dz * r[1];
      if (alo > -far - 2.5 && alo < -near + 2.5 && Math.abs(lat) < half + 0.3) return true;   // 차도 안에 있을 때만 — 연석에 서 있는 사람까지 세우면 통행이 멈춰 버린다
    }
    return false;
  };
  this.spawn = spawn; this.remove = remove;
};
