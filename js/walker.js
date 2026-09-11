// 보행자 모드: 플레이어가 도보 순찰 경찰관(또는 어린이)이 되어 걷는다. 「보행자가 보는 도로」 — 보행 신호등·횡단보도·차량을 보행자 눈높이에서.
// 규칙(도로교통법 제5조 신호 준수 · 제10조 횡단 방법): 횡단보도 밖 차도 진입 = 무단횡단, 적색 보행 신호에 횡단보도 진입 = 신호위반 보행,
// 녹색에 건너서 반대편 보도에 닿으면 안전 횡단(+). 차에 닿으면 즉시 실패. 목적지(사거리 모퉁이)를 차례로 찾아간다.
// 몸·동작은 TG.Character(관절 리그): 걷기·달리기·서기·손 들기·수신호(stop/go)·시선.
TG.Walker = function (scene, city, terrain, cfg, opts) {
  var self = this; opts = opts || {};
  this.kid = !!opts.kid; this.hand = 0; this.gesture = null; this.look = 0; this.lookScan = false;   // hand: 손 들기 남은 초, gesture: 'stop'|'go'|'wave', look: 머리 방향(rad)
  this.pos = { x: 0, z: 0 }; this.heading = 0; this.y = 0.2; this.v = 0; this.vF = 0; this.vx = 0; this.vz = 0;   // vF: 차량 AI(leadOf)가 앞차 속도로 읽는다
  this.radius = this.kid ? 0.35 : 0.45; this.len = 0.6; this.wid = 0.6; this.siren = false; this.signal = null; this.controls = { throttle: 0, brake: 0, steer: 0, reverse: 0 };
  this.telemetry = { speed: 0, ratio: 0, understeer: false, oversteer: false, skid: 0, stopDist: 0, kappa: 0, offroad: false, slope: 0, limit: 1 };
  this.spec = { name: this.kid ? '어린이 보행' : '도보 순찰', maxSpeed: 4.2, powertrain: 'foot', latMax: 1 };
  this.gear = 'D'; this.walkT = 0; this.moving = false;
  var rig = TG.Character.build(this.kid ? 'kid' : 'officer'), g = rig.group;
  this.rig = rig; g.userData.walker = this; scene.add(g); this.mesh = g;
  // 목적지 표지: 높은 빛기둥 + 바닥 고리
  var beam = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 40, 8, 1, true), new THREE.MeshBasicMaterial({ color: 0xffcf3f, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide }));
  var ring = new THREE.Mesh(new THREE.RingGeometry(1.6, 2.2, 32), new THREE.MeshBasicMaterial({ color: 0xffcf3f, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2; beam.visible = false; ring.visible = false; scene.add(beam); scene.add(ring);
  this.marker = null;
  this.setMarker = function (m) { this.marker = m; beam.visible = ring.visible = !!m; if (m) { var y = terrain ? terrain.heightAt(m.x, m.z) : 0; beam.position.set(m.x, y + 20, m.z); ring.position.set(m.x, y + 0.12, m.z); } };
  // 목표 빔은 **찾을 때** 쓰는 것이다. 바로 앞에 서면 빔이 대상을 가린다 —
  // 교차로 근무에서 노란 기둥이 제어함을 반쯤 덮었다(화면 점검에서 발견). 6m 안에서는 바닥 고리만 남긴다.
  this.markerFade = function () {
    if (!this.marker) return;
    var d = Math.hypot(this.marker.x - this.pos.x, this.marker.z - this.pos.z);
    beam.visible = d > 6;
  };

  this.forward = function () { return [Math.sin(this.heading), Math.cos(this.heading)]; };
  this.speedKmh = function () { return this.v * 3.6; };
  this.teleport = function (x, z, h) { this.pos.x = x; this.pos.z = z; if (h !== undefined) this.heading = h; this.v = 0; this.jumped = true; this.sync(); };   // jumped: 카메라를 즉시 따라오게
  this.resync = function () { this.sync(); };
  this.setSiren = function () {}; this.setView = function () {};
  this.eyeHeight = function () { return this.kid ? 1.08 : 1.62; };
  this.eyeWorld = function () { return new THREE.Vector3(this.pos.x, this.y + this.eyeHeight(), this.pos.z); };
  this.sync = function (dt) {
    this.y = terrain ? terrain.heightAt(this.pos.x, this.pos.z, this.y) : 0;
    rig.baseY = this.y; g.position.x = this.pos.x; g.position.z = this.pos.z; g.rotation.y = this.heading;
    var sp = TG.audio.speaking, talking = sp === (this.kid ? 'kid' : 'officer');
    TG.Character.animate(rig, { speed: this.v, moving: this.moving, hand: this.hand, gesture: this.gesture, look: this.look, lookScan: this.lookScan, talking: talking, smile: !!this.smile }, dt || 0.016);
  };
  this.raiseHand = function (sec) { this.hand = sec || 3; };
  // move: {x, y, run} — 카메라 기준(위 = 카메라가 보는 방향). camYaw: 카메라가 향하는 헤딩
  this.update = function (dt, move, camYaw) {
    var mx = move.x, my = move.y, mag = Math.min(1, Math.hypot(mx, my));
    var want = 0, dir = null;
    if (mag > 0.08) {
      // 스틱 위(+y) = camYaw 방향, 오른쪽(+x) = 그 우측
      var fx = Math.sin(camYaw), fz = Math.cos(camYaw), rx = -fz, rz = fx;
      var dx = fx * my + rx * mx, dz = fz * my + rz * mx, dl = Math.hypot(dx, dz) || 1;
      dir = Math.atan2(dx / dl, dz / dl);
      want = move.run ? (this.kid ? 3.4 : 4.2) : (this.kid ? 1.25 : 1.5) * Math.max(0.5, mag);   // 달리기는 「달리기」 버튼/Shift/A 로만(스틱 끝까지 밀어도 걷는다)
      this.running = !!move.run;
    }
    if (this.hand > 0) this.hand -= dt;
    this.v += ((want - this.v) * Math.min(1, dt * (want > this.v ? 6 : 9)));
    // 방향 전환: 급회전 금지 — 최대 3.2rad/s, 작은 각도는 부드럽게(MMORPG 식: 살짝 밀면 살짝 휜다)
    if (dir !== null) { var d = TG.wrapAngle(dir - this.heading), stp = Math.min(Math.abs(d), (1.6 + 2.2 * Math.abs(d)) * dt); this.heading += Math.sign(d) * stp; }
    var f = this.forward(), nx = this.pos.x + f[0] * this.v * dt, nz = this.pos.z + f[1] * this.v * dt;
    var c = city.collideCircle(nx, nz, 0.4); this.pos.x = c.x; this.pos.z = c.z;
    this.vx = f[0] * this.v; this.vz = f[1] * this.v; this.vF = this.v;
    this.moving = this.v > 0.15; if (this.moving) this.walkT += dt * (6 + this.v * 2.2);
    this.telemetry.speed = this.v; this.controls.throttle = want > 0 ? 1 : 0;
    this.markerFade();
    this.sync(dt);
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
      return { where: 'crosswalk', node: node, d: d, crossAxis: crossAxis, walk: signals.pedWalk(node, crossAxis), remain: signals.pedRemain(node, crossAxis), flash: signals.pedFlash(node, crossAxis) };
    }
  }
  return { where: 'road' };
};
