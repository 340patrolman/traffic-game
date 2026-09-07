// 철길건널목(12대 중과실 「철길건널목 통과방법 위반」 소재): 교외 연결로 한 곳을 철길이 가로지른다.
// 주기: 열림 → 경보(적색 등 교대 점멸 + 차단기 내려옴) → 닫힘(열차 통과) → 열림. 차량 AI 는 traffic.rail.approach() 로 정지선을 안다.
// 파일 0개: 레일·침목·차단기·경보등·열차 전부 코드 지오메트리.
TG.Rail = function (scene, terrain, link, idx, cfg) {
  var self = this, P = link.P(idx), half = P.half, t = [P.tx, P.tz], r = [P.rx, P.rz];
  this.link = link; this.idx = idx; this.s = P.s; this.x = P.x; this.z = P.z; this.t = t; this.r = r;
  var CYCLE = 58, WARN = 3, CLOSED = 17;   // 열림 38초 → 경보 3초 → 닫힘 17초(열차 통과)
  this.phase = 12; this.closed = false; this.warning = false; this.trainOn = false;
  var lambert = new THREE.MeshLambertMaterial({ vertexColors: true });
  function hAt(x, z) { return terrain.heightAt(x, z); }
  // ---- 레일·침목·자갈 ----
  var gb = new TG.GeoBuilder(), yawR = Math.atan2(r[0], r[1]);   // 레일 방향(도로에 직각)의 헤딩
  for (var d = -90; d <= 90; d += 0.75) {
    var onRoad = Math.abs(d) < half + 0.6, x = P.x + r[0] * d, z = P.z + r[1] * d, y = onRoad ? P.y : hAt(x, z);
    if (!onRoad && (d % 1.5 === 0 || Math.abs(d % 1.5) < 0.01)) gb.box(x, y + 0.06, z, 2.6, 0.12, 0.24, 0x5a4634, { rotY: yawR });   // 침목
  }
  for (var d2 = -90; d2 < 90; d2 += 3) {
    var xa = P.x + r[0] * (d2 + 1.5), za = P.z + r[1] * (d2 + 1.5), onR = Math.abs(d2 + 1.5) < half + 0.6, ya = onR ? P.y : hAt(xa, za);
    if (!onR) gb.box(xa, ya - 0.05, za, 4.2, 0.16, 3.05, 0x8b8a84, { rotY: yawR });   // 자갈 도상
    for (var s = -1; s <= 1; s += 2) gb.box(xa + t[0] * s * 0.72, ya + 0.16, za + t[1] * s * 0.72, 0.09, 0.12, 3.05, 0x3a3d42, { rotY: yawR });   // 레일 2줄(궤간 1.44)
  }
  // 정지선(양 방향, 건널목 7m 앞) + 「정지」 노면 표시 대신 굵은 흰 선
  for (var sd = -1; sd <= 1; sd += 2) { var sx = P.x - t[0] * sd * 7, sz = P.z - t[1] * sd * 7; gb.box(sx + r[0] * sd * half * 0.5, P.y + 0.05, sz + r[1] * sd * half * 0.5, 0.35, 0.02, half, 0xf2f2ee, { rotY: Math.atan2(t[0], t[1]) + Math.PI / 2 }); }
  var railMesh = new THREE.Mesh(gb.build(), lambert); railMesh.matrixAutoUpdate = false; railMesh.updateMatrix(); railMesh.receiveShadow = true; scene.add(railMesh);
  // ---- 차단기 2조(접근 방향마다 우측) + 경보등 + 건널목 표지 ----
  var lampOn = new THREE.MeshBasicMaterial({ color: 0xff2a1a }), lampOff = new THREE.MeshBasicMaterial({ color: 0x3a1210 });
  var gates = [], lamps = [], signGeo = new THREE.PlaneGeometry(1.3, 1.3), signMat = new THREE.MeshBasicMaterial({ map: TG.tex.sign('rail'), transparent: true, side: THREE.DoubleSide });
  function gate(sign) {   // sign: +1 = A 방향(s 증가) 접근, -1 = B 방향
    var px = P.x - t[0] * sign * 7 + r[0] * sign * (half + 0.9), pz = P.z - t[1] * sign * 7 + r[1] * sign * (half + 0.9), py = hAt(px, pz);
    var pg = new TG.GeoBuilder(); pg.cylinder(px, py, pz, 0.14, 0.14, 3.2, 6, 0xdfe4ea); pg.box(px, py + 1.0, pz, 0.5, 0.5, 0.5, 0x2d3138, {});
    var pm = new THREE.Mesh(pg.build(), lambert); pm.matrixAutoUpdate = false; pm.updateMatrix(); scene.add(pm);
    var yaw = new THREE.Object3D(); yaw.position.set(px, py + 1.05, pz);
    var a = [-r[0] * sign, -r[1] * sign]; yaw.rotation.y = Math.atan2(-a[1], a[0]);   // 로컬 +x → 도로 건너는 방향
    var pivot = new THREE.Object3D(); yaw.add(pivot);
    var len = half + 1.0, arm = new THREE.Group();
    for (var k = 0; k < 6; k++) { var seg = new THREE.Mesh(new THREE.BoxGeometry(len / 6, 0.14, 0.14), new THREE.MeshLambertMaterial({ color: k % 2 ? 0xffffff : 0xe0261f })); seg.position.set(len / 6 * (k + 0.5), 0, 0); arm.add(seg); }
    pivot.add(arm); scene.add(yaw);
    var L1 = new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 6), lampOff), L2 = new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 6), lampOff);
    L1.position.set(px + t[0] * 0.3, py + 2.55, pz + t[1] * 0.3); L2.position.set(px - t[0] * 0.3, py + 2.55, pz - t[1] * 0.3); scene.add(L1); scene.add(L2); lamps.push(L1, L2);
    var sg = new THREE.Mesh(signGeo, signMat); sg.position.set(px, py + 3.6, pz); sg.rotation.y = Math.atan2(t[0] * sign, t[1] * sign) + Math.PI; scene.add(sg);
    gates.push({ pivot: pivot, sign: sign, x: px, z: pz });
  }
  gate(1); gate(-1);
  // ---- 열차(기관차 + 객차 2) ----
  var train = new THREE.Group(), tg2 = new TG.GeoBuilder();
  tg2.box(0, 1.9, 0, 2.9, 3.4, 17, 0x1f4fa8, {}); tg2.box(0, 2.6, 0, 2.95, 0.9, 17.05, 0xf2f2ee, {}); tg2.box(0, 1.1, 8.6, 2.6, 1.6, 0.4, 0xf3c418, {});
  for (var c = 1; c <= 2; c++) { tg2.box(0, 1.9, -c * 18, 2.9, 3.4, 17, 0x2f6fd6, {}); tg2.box(0, 2.7, -c * 18, 2.95, 0.8, 17.05, 0xf2f2ee, {}); }
  var tm = new THREE.Mesh(tg2.build(), lambert); tm.castShadow = true; train.add(tm); train.visible = false; scene.add(train);
  this.train = train;
  var bellT = 0;
  this.update = function (dt) {
    self.phase = (self.phase + dt) % CYCLE;
    var ph = self.phase, open = CYCLE - WARN - CLOSED;
    self.warning = ph >= open && ph < open + WARN; self.closed = ph >= open;
    var down = self.closed ? TG.clamp((ph - open) / 2.2, 0, 1) : 0;           // 내려오는 데 2.2초
    if (!self.closed) down = 0; else if (ph > CYCLE - 1.6) down = TG.clamp((CYCLE - ph) / 1.6, 0, 1);   // 마지막 1.6초에 올라간다
    for (var i = 0; i < gates.length; i++) gates[i].pivot.rotation.z = (1 - down) * Math.PI / 2;
    var blink = self.closed && (Math.floor(ph * 2.5) % 2 === 0);
    for (var j = 0; j < lamps.length; j++) lamps[j].material = self.closed ? ((j % 2 === 0) === blink ? lampOn : lampOff) : lampOff;
    // 열차: 닫힘 3초 뒤 +100m 에서 -100m 로(14m/s)
    var tt = ph - (open + WARN + 2.5);
    self.trainOn = tt > 0 && tt < 200 / 14;
    train.visible = self.trainOn;
    if (self.trainOn) { var dd = 100 - tt * 14; train.position.set(P.x + r[0] * dd, hAt(P.x + r[0] * dd, P.z + r[1] * dd) + 0.1, P.z + r[1] * dd); train.rotation.y = Math.atan2(-r[0], -r[1]); }
    if (self.closed && TG.audio && TG.audio.bell) { bellT -= dt; if (bellT <= 0) { bellT = 0.55; TG.audio.bell(); } }
  };
  // 차량 AI: 이 링크 위(cur.lp 가 있는 경로점)에서 건널목까지 진행 방향 거리(+ = 앞). 다른 링크·격자면 null
  this.approach = function (car, cur) {
    if (!cur || !cur.lp || cur.link !== link || !car.route) return null;
    var dirA = car.route.dirA !== false, dist = (self.s - cur.lp.s) * (dirA ? 1 : -1);
    if (dist < -12 || dist > 80) return null;
    return { dist: dist, closed: self.closed };
  };
  // 플레이어: 위치·헤딩으로 같은 정보
  this.distFor = function (x, z, heading) {
    var q = terrain.nearest(x, z, false); if (!q || q.link !== link || q.dist > half + 2) return null;
    var fwd = Math.sin(heading) * t[0] + Math.cos(heading) * t[1], dist = (self.s - q.p.s) * (fwd >= 0 ? 1 : -1);
    if (dist < -12 || dist > 80) return null;
    return { dist: dist, closed: self.closed, warning: self.warning };
  };
  this.forceClose = function () { self.phase = CYCLE - WARN - CLOSED + 0.01; self.update(0); };
  this.forceOpen = function () { self.phase = 5; self.update(0); };
};
