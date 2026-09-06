// 행인: 팔·다리가 흔들리는 관절 인형. 각 도로의 보도 중앙선(반폭 + 1.5m)을 걷고 모서리에서 보행 신호에 건넌다.
// 일부는 무단횡단(블록 중간 횡단, 적색 횡단)을 한다 → 차들이 급제동하고, 플레이어는 경광등 켜고 옆에 서면 「보행자 계도」.
TG.Peds = function (scene, city, signals, cfg, rng) {
  var peds = [], self = this;
  this.peds = peds; this.player = null; this.traffic = null;
  this.onEvent = function () {};
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
  function makeMesh(p) {
    var shirt = TG.pick(rng, SHIRTS), pants = TG.pick(rng, PANTS), skin = TG.pick(rng, SKINS), hair = TG.pick(rng, HAIRS), g = new THREE.Group();
    var torso = new THREE.Mesh(torsoGeo(shirt, skin, hair, rng() < 0.3), mat); torso.castShadow = true; g.add(torso);
    var legL = new THREE.Mesh(limbGeo(pants, 0.84, 0.15), mat), legR = new THREE.Mesh(limbGeo(pants, 0.84, 0.15), mat), armL = new THREE.Mesh(limbGeo(shirt, 0.62, 0.11), mat), armR = new THREE.Mesh(limbGeo(shirt, 0.62, 0.11), mat);
    legL.position.set(0.1, 0.86, 0); legR.position.set(-0.1, 0.86, 0); armL.position.set(0.26, 1.36, 0); armR.position.set(-0.26, 1.36, 0);
    g.add(legL); g.add(legR); g.add(armL); g.add(armR);
    p.limbs = [legL, legR, armL, armR]; p.scale = 0.9 + rng() * 0.2; g.scale.set(p.scale, p.scale, p.scale);
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
                jaywalker: opts.jaywalker !== undefined ? opts.jaywalker : rng() < 0.18, jayT: 0, jayDone: false, warned: false, jayLive: false };
      var m = makeMesh(p); m.position.set(x, 0.2, z); m.rotation.y = TG.DIR_HEADING[d]; scene.add(m); p.mesh = m; peds.push(p);
      return p;
    }
    return null;
  }
  function remove(p) { scene.remove(p.mesh); var k = peds.indexOf(p); if (k >= 0) peds.splice(k, 1); }

  function step(p, dt) {
    var f = TG.DIR_VEC[p.d];
    if (p.state === 'walk' || p.state === 'cross' || p.state === 'jaywalk') { p.pos.x += f[0] * p.speed * dt; p.pos.z += f[1] * p.speed * dt; }
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
      if (p.state === 'walk') { var edge = p.axis === 'v' ? (p.d === 0 ? city.zs[city.zs.length - 1] : city.zs[0]) : (p.d === 1 ? city.xs[city.xs.length - 1] : city.xs[0]);
        if ((p.axis === 'v' ? p.pos.z : p.pos.x) * (f[0] + f[1]) > edge * (f[0] + f[1]) + 9) { p.d = (p.d + 2) % 4; p.decided = null; } }
      return;
    }
    var nc = p.axis === 'v' ? node.z : node.x, dist = (nc - along) * (f[0] + f[1]), SIDE = acrossSide(p, node);
    if (p.state === 'cross') { if (dist < -SIDE) { p.state = 'walk'; p.decided = node; p.jayLive = false; } return; }
    if (p.state === 'wait') {
      p.waitT += dt;
      var walk = signals.pedWalk(node, p.axis === 'v' ? 'h' : 'v');
      if (walk && !carBlocking(p)) { p.state = 'cross'; p.waitT = 0; }
      else if (!walk && p.jaywalker && !p.jayDone && p.waitT > 4 && !carBlocking(p)) { p.state = 'cross'; p.jayDone = true; p.jayLive = true; p.jayT = 0; self.onEvent('jaywalk', p); }
      else if (p.waitT > 25) turnCorner(p, node);
      return;
    }
    if (p.jaywalker && !p.jayDone && dist > 18 && dist < 48 && rng() < dt * 0.7 && !carBlocking(p, true)) {
      p.jayDone = true; p.jayLive = true; p.jayT = 0; p.state = 'jaywalk'; p.jayD = p.d;
      if (p.axis === 'v') p.d = p.side > 0 ? 3 : 1; else p.d = p.side > 0 ? 2 : 0;
      self.onEvent('jaywalk', p); return;
    }
    if (dist <= SIDE + 0.05 && p.decided !== node) {
      p.decided = node;
      if (city.nodeFrom(node, p.d) && rng() < 0.5) { p.state = 'wait'; p.waitT = 0; } else turnCorner(p, node);
    }
  }
  function carBlocking(p, sideways) {
    var T = self.traffic; if (!T) return false;
    var f = TG.DIR_VEC[p.d];
    if (sideways) { if (p.axis === 'v') f = [p.side > 0 ? -1 : 1, 0]; else f = [0, p.side > 0 ? -1 : 1]; }
    var all = T.cars.slice(); if (self.player) all.push({ pos: self.player.pos, v: self.player.telemetry.speed });
    for (var i = 0; i < all.length; i++) {
      var c = all[i], dx = c.pos.x - p.pos.x, dz = c.pos.z - p.pos.z, along = dx * f[0] + dz * f[1], lat = Math.abs(dx * -f[1] + dz * f[0]);
      if (along > 0 && along < 16 && lat < 4 && c.v > 3) return true;
      if (lat < 3 && Math.abs(along) < 30 && c.v > 6) return true;
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

  var spawnT = 0;
  this.update = function (dt, budget) {
    spawnT -= dt;
    if (spawnT <= 0) { spawnT = 0.7; if (peds.length < budget) spawn(); }
    var pl = self.player;
    for (var i = peds.length - 1; i >= 0; i--) {
      var p = peds[i]; step(p, dt); p.t += dt;
      var moving = p.state !== 'wait' && p.state !== 'warned', w = p.t * 7.5 * (p.speed / 1.3), sw = moving ? Math.sin(w) * 0.6 : 0;
      p.mesh.position.set(p.pos.x, 0.2 + (moving ? Math.abs(Math.cos(w)) * 0.03 : 0), p.pos.z); p.mesh.rotation.y = TG.DIR_HEADING[p.d];
      p.limbs[0].rotation.x = sw; p.limbs[1].rotation.x = -sw; p.limbs[2].rotation.x = -sw * 0.7; p.limbs[3].rotation.x = sw * 0.7;
      if (pl && Math.hypot(p.pos.x - pl.pos.x, p.pos.z - pl.pos.z) > cfg.PED_DESPAWN) remove(p);
    }
  };
  this.nearestAhead = function (x, z, fx, fz, maxAlong, maxLat) {
    var best = null;
    for (var i = 0; i < peds.length; i++) {
      var p = peds[i], dx = p.pos.x - x, dz = p.pos.z - z, along = dx * fx + dz * fz;
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
  this.spawn = spawn; this.remove = remove;
};
