// 보행자 모드: 플레이어가 도보 순찰 경찰관이 되어 걷는다. 「보행자가 보는 도로」 — 보행 신호등·횡단보도·차량을 보행자 눈높이에서.
// 규칙(도로교통법 제5조 신호 준수 · 제10조 횡단 방법): 횡단보도 밖 차도 진입 = 무단횡단, 적색 보행 신호에 횡단보도 진입 = 신호위반 보행,
// 녹색에 건너서 반대편 보도에 닿으면 안전 횡단(+). 차에 닿으면 즉시 실패. 목적지(사거리 모퉁이)를 차례로 찾아간다.
TG.Walker = function (scene, city, terrain, cfg) {
  var self = this;
  this.pos = { x: 0, z: 0 }; this.heading = 0; this.y = 0.2; this.v = 0; this.vF = 0; this.vx = 0; this.vz = 0;   // vF: 차량 AI(leadOf)가 앞차 속도로 읽는다
  this.radius = 0.45; this.len = 0.6; this.wid = 0.6; this.siren = false; this.signal = null; this.controls = { throttle: 0, brake: 0, steer: 0, reverse: 0 };
  this.telemetry = { speed: 0, ratio: 0, understeer: false, oversteer: false, skid: 0, stopDist: 0, kappa: 0, offroad: false, slope: 0, limit: 1 };
  this.spec = { name: '도보 순찰', maxSpeed: 4.2, powertrain: 'foot', latMax: 1 };
  this.gear = 'D'; this.walkT = 0; this.moving = false;
  var mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  // 교통경찰 제복: 남색 상의·바지, 형광 조끼(반사 띠), 흰 장갑, 정모(흰 덮개 + 검정 챙 + 금색 표장)
  var NAVY = 0x1e3763, VEST = 0xd7ff3a, STRIPE = 0xe8e8e8, SKIN = 0xf1c9a5, BLACK = 0x15171c, WHITE = 0xf4f4f4, GOLD = 0xc9a227;
  function body() {
    var gb = new TG.GeoBuilder();
    gb.box(0, 1.12, 0, 0.42, 0.56, 0.26, NAVY, {});
    gb.box(0, 1.14, 0, 0.46, 0.44, 0.30, VEST, {}); gb.box(0, 1.24, 0, 0.47, 0.06, 0.31, STRIPE, {}); gb.box(0, 1.04, 0, 0.47, 0.06, 0.31, STRIPE, {});
    gb.box(0, 0.86, 0, 0.38, 0.06, 0.26, BLACK, {});   // 벨트
    gb.box(0, 1.44, 0, 0.14, 0.08, 0.14, SKIN, {}); gb.box(0, 1.60, 0, 0.22, 0.24, 0.22, SKIN, {});
    gb.box(0, 1.75, 0, 0.26, 0.10, 0.26, WHITE, {}); gb.box(0, 1.70, -0.02, 0.27, 0.05, 0.28, NAVY, {}); gb.box(0, 1.68, 0.17, 0.26, 0.03, 0.10, BLACK, {});   // 정모
    gb.box(0, 1.75, 0.135, 0.06, 0.06, 0.02, GOLD, {});
    return gb.build();
  }
  function limb(color, len, w, cuff) { var gb = new TG.GeoBuilder(); gb.box(0, -len / 2, 0, w, len, w, color, {}); if (cuff) gb.box(0, -len + 0.03, 0, w + 0.02, 0.07, w + 0.02, cuff, {}); return gb.build(); }
  var g = new THREE.Group(), torso = new THREE.Mesh(body(), mat); torso.castShadow = true; g.add(torso);
  var legL = new THREE.Mesh(limb(NAVY, 0.84, 0.16, BLACK), mat), legR = new THREE.Mesh(limb(NAVY, 0.84, 0.16, BLACK), mat), armL = new THREE.Mesh(limb(NAVY, 0.62, 0.12, WHITE), mat), armR = new THREE.Mesh(limb(NAVY, 0.62, 0.12, WHITE), mat);
  legL.position.set(0.11, 0.86, 0); legR.position.set(-0.11, 0.86, 0); armL.position.set(0.28, 1.36, 0); armR.position.set(-0.28, 1.36, 0);
  g.add(legL); g.add(legR); g.add(armL); g.add(armR);
  var limbs = [legL, legR, armL, armR];
  g.userData.walker = this; scene.add(g); this.mesh = g;
  // 목적지 표지: 높은 빛기둥 + 바닥 고리
  var beam = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 40, 8, 1, true), new THREE.MeshBasicMaterial({ color: 0xffcf3f, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide }));
  var ring = new THREE.Mesh(new THREE.RingGeometry(1.6, 2.2, 32), new THREE.MeshBasicMaterial({ color: 0xffcf3f, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2; beam.visible = false; ring.visible = false; scene.add(beam); scene.add(ring);
  this.marker = null;
  this.setMarker = function (m) { this.marker = m; beam.visible = ring.visible = !!m; if (m) { var y = terrain ? terrain.heightAt(m.x, m.z) : 0; beam.position.set(m.x, y + 20, m.z); ring.position.set(m.x, y + 0.12, m.z); } };

  this.forward = function () { return [Math.sin(this.heading), Math.cos(this.heading)]; };
  this.speedKmh = function () { return this.v * 3.6; };
  this.teleport = function (x, z, h) { this.pos.x = x; this.pos.z = z; if (h !== undefined) this.heading = h; this.v = 0; this.jumped = true; this.sync(); };   // jumped: 카메라를 즉시 따라오게
  this.resync = function () { this.sync(); };
  this.setSiren = function () {}; this.setView = function () {};
  // 1인칭 눈 위치(월드)
  this.eyeWorld = function () { return new THREE.Vector3(this.pos.x, this.y + 1.62, this.pos.z); };
  this.sync = function () {
    this.y = terrain ? terrain.heightAt(this.pos.x, this.pos.z) : 0;
    g.position.set(this.pos.x, this.y + (this.moving ? Math.abs(Math.cos(this.walkT)) * 0.03 : 0), this.pos.z); g.rotation.y = this.heading;
    var sw = this.moving ? Math.sin(this.walkT) * (0.45 + 0.35 * Math.min(1, this.v / 4)) : 0;
    limbs[0].rotation.x = sw; limbs[1].rotation.x = -sw; limbs[2].rotation.x = -sw * 0.7; limbs[3].rotation.x = sw * 0.7;
  };
  // move: {x, y, run} — 카메라 기준(위 = 카메라가 보는 방향). camYaw: 카메라가 향하는 헤딩
  this.update = function (dt, move, camYaw) {
    var mx = move.x, my = move.y, mag = Math.min(1, Math.hypot(mx, my));
    var want = 0, dir = null;
    if (mag > 0.08) {
      // 스틱 위(+y) = camYaw 방향, 오른쪽(+x) = 그 우측
      var fx = Math.sin(camYaw), fz = Math.cos(camYaw), rx = -fz, rz = fx;
      var dx = fx * my + rx * mx, dz = fz * my + rz * mx, dl = Math.hypot(dx, dz) || 1;
      dir = Math.atan2(dx / dl, dz / dl);
      want = (move.run || mag > 0.92) ? 4.2 : 1.5 * Math.max(0.5, mag);
    }
    this.v += ((want - this.v) * Math.min(1, dt * (want > this.v ? 6 : 9)));
    if (dir !== null) { var d = TG.wrapAngle(dir - this.heading); this.heading += d * Math.min(1, dt * 12); }
    var f = this.forward(), nx = this.pos.x + f[0] * this.v * dt, nz = this.pos.z + f[1] * this.v * dt;
    var c = city.collideCircle(nx, nz, 0.4); this.pos.x = c.x; this.pos.z = c.z;
    this.vx = f[0] * this.v; this.vz = f[1] * this.v; this.vF = this.v;
    this.moving = this.v > 0.15; if (this.moving) this.walkT += dt * (6 + this.v * 2.2);
    this.telemetry.speed = this.v; this.controls.throttle = want > 0 ? 1 : 0;
    this.sync();
    if (this.marker) ring.rotation.z += dt * 0.8;
  };
  this.dispose = function () { scene.remove(g); scene.remove(beam); scene.remove(ring); };
  this.sync();
};

// 보행 규칙 판정: 지금 어디에 서 있는가. { where: 'sidewalk'|'crosswalk'|'road'|'box'|'off', node, d, crossAxis, walk }
TG.walkerPlace = function (city, signals, x, z) {
  if (!city.onRoad(x, z)) return { where: city.onSidewalk(x, z) ? 'sidewalk' : 'off' };
  if (city.inIntersection(x, z)) return { where: 'box' };
  var i = city.nearestIdx(city.xs, x), j = city.nearestIdx(city.zs, z), node = city.nodes[i][j];
  for (var d = 0; d < 4; d++) {
    var f = TG.DIR_VEC[d], r = [-f[1], f[0]], dx = x - node.x, dz = z - node.z, along = dx * f[0] + dz * f[1], lat = dx * r[0] + dz * r[1];
    var rd = city.roadOf(node, d), half = city.halfOf(rd.axis, rd.idx), cn = city.crossNear(node, d), cf = city.crossFar(node, d);
    // 접근로 d 의 횡단보도는 교차로 앞(along < 0 쪽)에 있다
    if (along <= -cn + 0.3 && along >= -cf - 0.3 && Math.abs(lat) <= half + 0.2) {
      var crossAxis = rd.axis;   // 건너는 도로의 축
      return { where: 'crosswalk', node: node, d: d, crossAxis: crossAxis, walk: signals.pedWalk(node, crossAxis), remain: signals.pedRemain(node, crossAxis) };
    }
  }
  return { where: 'road' };
};
