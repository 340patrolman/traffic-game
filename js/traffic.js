// AI 교통. 도시 격자(노드·기동 S/R/L/X, 도로별 차로 수)와 링크(교외·순환 고속도로·램프)를 하나의 경로점 열로 잇는다.
// 차종: 승용(세단·해치·SUV)·밴·트럭·버스. 고속도로 1차로는 버스전용 — 승용이 달리면 위반.
// 위반 성향: 신호 무시(적색 통과) / 보행자 보호 무시(횡단보도 위 보행자 앞을 그냥 지나감). 플레이어가 직접 목격한 경우에만 표시된다.
TG.Traffic = function (scene, city, signals, cfg, rng) {
  var LANE = cfg.LANE_OFF;
  var cars = [], nextId = 1, self = this;
  this.cars = cars; this.player = null; this.peds = null; this.terrain = null;
  this.onEvent = function () {};
  this.time = 0;
  this.stats = { violations: 0, witnessed: 0 };

  var CITY_TYPES = ['sedan', 'sedan', 'sedan', 'hatch', 'hatch', 'suv', 'suv', 'van', 'truck', 'bus', 'moto', 'moto', 'bike', 'pm', 'pm'];
  var HW_TYPES = ['sedan', 'sedan', 'sedan', 'suv', 'suv', 'hatch', 'van', 'truck', 'truck', 'bus', 'bus'];
  var COLORS = { sedan: [0xc94d43, 0x3e6bb0, 0x9aa3ad, 0x2f3438, 0xe6e2d8, 0x6b8f5a, 0xb08a3e, 0x7d5a96],
                 hatch: [0xd77a3a, 0x5c8bd6, 0xbfb8aa, 0x7d5a96, 0xd9d34f, 0x2f3438],
                 suv: [0x2f3438, 0xdcdcd4, 0x4a6e8a, 0x6d4f3a, 0x3e6bb0, 0x8e9aa6],
                 van: [0xdcdcd4, 0x4a6e8a, 0x9a4a3a, 0xe6e2d8], truck: [0x6e4a2f, 0x3b4a58, 0x7a2e2a, 0x2f6fd6], bus: [0x2f6fd6, 0x2ea043, 0xd7262b, 0x1f4fa8], moto: [0xd7262b, 0x2f3438, 0x3e6bb0, 0xf3c418, 0xdcdcd4], bike: [0xc94d43, 0x2ea043, 0x3e6bb0, 0x2f3438, 0xd9d34f], pm: [0x3b6fd1, 0x2f3438, 0xd7262b, 0xe6e2d8] };
  var bodyMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  var brakeMat = new THREE.MeshBasicMaterial({ color: 0xff2a1a });
  var blinkMat = new THREE.MeshBasicMaterial({ color: 0xffa000 }), phoneMat = new THREE.MeshBasicMaterial({ color: 0xbfe6ff }), dogMat = new THREE.MeshLambertMaterial({ color: 0x8a5a2b });
  var litterMat = new THREE.MeshBasicMaterial({ color: 0xff7a1a }), litters = [];
  var cargoMat = new THREE.MeshLambertMaterial({ color: 0xb98a4a }), doorMat = new THREE.MeshLambertMaterial({ color: 0xdfe4ea }), pasMat = new THREE.MeshLambertMaterial({ color: 0x3b6fd1 });
  this.rail = null;   // TG.Rail(철길건널목) — main 이 붙인다
  var markerMat = new THREE.SpriteMaterial({ map: TG.tex.marker(), depthTest: false });

  // ---------- 격자 경로 ----------
  function gridLane(car, node, d) { var rd = city.roadOf(node, d); return city.laneOff(rd.axis, rd.idx, car.laneIdx); }
  function approachPoint(car, node, d) {
    var f = TG.DIR_VEC[d], r = [-f[1], f[0]], sd = city.stopDist(node, d), la = gridLane(car, node, d);
    return { x: node.x - f[0] * sd + r[0] * la, z: node.z - f[1] * sd + r[1] * la, y: 0, node: node, d: d, stop: true, lane: la };
  }
  function appendManeuver(car, N, d, m) {
    var f = TG.DIR_VEC[d], r = [-f[1], f[0]], C = N, pts = [], nd, R, cx, cz, k, th, la = gridLane(car, N, d), lb;
    for (var q = car.path.length - 1; q >= 0; q--) if (car.path[q].stop && car.path[q].node === N) { car.path[q].maneuver = m; break; }
    if (m === 'S' || m === 'X') {
      nd = d; lb = m === 'X' ? la : gridLane(car, N, nd);
      pts.push({ x: C.x + f[0] * (city.crossHalf(N, d) + 3) + r[0] * lb, z: C.z + f[1] * (city.crossHalf(N, d) + 3) + r[1] * lb, y: 0 });
    } else if (m === 'R') {
      nd = (d + 3) % 4; lb = gridLane(car, N, nd); R = 5;
      cx = C.x + (la + R) * r[0] - (lb + R) * f[0]; cz = C.z + (la + R) * r[1] - (lb + R) * f[1];
      for (k = 1; k <= 5; k++) { th = k / 5 * Math.PI / 2; pts.push({ x: cx - r[0] * R * Math.cos(th) + f[0] * R * Math.sin(th), z: cz - r[1] * R * Math.cos(th) + f[1] * R * Math.sin(th), y: 0, vmax: cfg.AI_TURN_SPEED }); }
    } else {
      nd = (d + 1) % 4; lb = gridLane(car, N, nd); R = 8 + Math.max(0, city.crossHalf(N, d) - 6);
      cx = C.x + (la - R) * r[0] + (lb - R) * f[0]; cz = C.z + (la - R) * r[1] + (lb - R) * f[1];
      pts.push({ x: C.x + r[0] * la + f[0] * (lb - R), z: C.z + r[1] * la + f[1] * (lb - R), y: 0, vmax: cfg.AI_TURN_SPEED });
      for (k = 1; k <= 6; k++) { th = k / 6 * Math.PI / 2; pts.push({ x: cx + r[0] * R * Math.cos(th) + f[0] * R * Math.sin(th), z: cz + r[1] * R * Math.cos(th) + f[1] * R * Math.sin(th), y: 0, vmax: cfg.AI_TURN_SPEED }); }
    }
    for (var i = 0; i < pts.length; i++) car.path.push(pts[i]);
    if (m === 'X') {
      var ex = city.exitFor(N, d);
      car.route = { link: ex.link, dirA: true, i: 0, lane: laneFor(car, ex.link), lanePrev: null };
      appendLink(car, 30);
    } else {
      var N2 = city.nodeFrom(N, nd);
      car.path.push(approachPoint(car, N2, nd));
      car.lastNode = N2; car.lastDir = nd;
    }
  }
  function chooseManeuver(N, d, car) {
    var opts = [], exit = city.exitFor(N, d);
    if (car && car.straight && city.nodeFrom(N, d)) return 'S';
    if (car && car.wantsExit && exit) return 'X';
    if (city.nodeFrom(N, d)) opts.push(['S', 0.62]);
    if (exit && !car.isBus && !car.isMoto && !car.isBike && !car.isPM) opts.push(['X', 0.5]);   // 이륜차·자전거·PM 은 고속도로로 나가지 않는다
    if (city.nodeFrom(N, (d + 3) % 4) && (!car || car.laneIdx === 1 || city.lanesOf(city.roadOf(N, d).axis, city.roadOf(N, d).idx) === 1)) opts.push(['R', 0.28]);  // 4차로에서는 바깥 차로만 우회전
    if (city.nodeFrom(N, (d + 1) % 4)) opts.push(['L', opts.length ? 0.0 : 1]);
    if (!opts.length) {   // 모퉁이(직진 불가)에서 안쪽 차로 차량: 우회전·좌회전 허용(차로 바꿔 돈다)
      if (city.nodeFrom(N, (d + 3) % 4)) return 'R';
      if (city.nodeFrom(N, (d + 1) % 4)) return 'L';
      return 'S';
    }
    var sum = 0; opts.forEach(function (o) { sum += o[1]; });
    var x = rng() * sum;
    for (var i = 0; i < opts.length; i++) { x -= opts[i][1]; if (x <= 0) return opts[i][0]; }
    return opts[opts.length - 1][0];
  }
  function laneFor(car, link) {
    if (link.kind !== 'highway') return 0;
    if (car.isBus || car.busLaneViolator) return 0;
    return 1 + Math.floor(rng() * 2);
  }
  // ---------- 링크 경로 ----------
  function appendLink(car, count) {
    var rt = car.route, L = rt.link;
    for (var n = 0; n < count; n++) {
      if (!rt) return;
      var i = rt.i, N = L.N, atEnd = L.closed ? false : (rt.dirA ? i >= N - 1 : i <= 0);
      if (L.closed && rt.dirA) {
        for (var e = 0; e < L.exitsA.length; e++) {
          var ex = L.exitsA[e];
          if (i === ex.decideIndex && !car.isBus && !car.stayRing && rng() < 0.35) rt.pendingExit = ex;
          if (rt.pendingExit === ex && i === ex.atIndex) { car.route = rt = { link: ex.link, dirA: true, i: 0, lane: 0, lanePrev: cfg.HW_LANES[2], blend: 0 }; L = ex.link; i = 0; break; }
        }
      }
      if (atEnd) {
        var nx = rt.dirA ? L.nextA : L.nextB;
        if (nx) {
          var lanePrev = laneOffsetOf(car, L, rt.lane, rt);
          car.route = rt = { link: nx.link, dirA: nx.dirA !== false, i: nx.index, lane: laneFor(car, nx.link), lanePrev: lanePrev, blend: 0, merge: !!nx.merge };
          L = nx.link; i = rt.i;
          if (rt.merge) rt.lanePrev = cfg.HW_LANES[2];
        } else if (L.cityEnd && !rt.dirA) {
          car.route = null; car.laneIdx = 0;
          var ce = L.cityEnd; car.path.push(approachPoint(car, ce.node, ce.dir)); car.lastNode = ce.node; car.lastDir = ce.dir;
          return;
        } else { car.route = null; return; }
      }
      var p = L.P(i), off = laneOffsetOf(car, L, rt.lane, rt), sgn = rt.dirA ? 1 : -1;
      var vmax = Math.min(cruiseFor(car, p.kind), Math.sqrt(3.6 / Math.max(p.kappa, 1e-4)));
      car.path.push({ x: p.x + p.rx * off * sgn, z: p.z + p.rz * off * sgn, y: p.y, vmax: vmax, kind: p.kind, lp: p, off: off, link: L });
      if (rt.blend !== undefined && rt.blend < 1) rt.blend += 1 / 18;
      rt.i = L.closed ? ((i + sgn) % N + N) % N : i + sgn;
    }
  }
  function laneOffsetOf(car, L, lane, rt) {
    var offs = self.terrain.laneOffsets(L.pts[0]), target = offs[Math.min(lane, offs.length - 1)];
    if (rt && rt.lanePrev !== null && rt.lanePrev !== undefined && rt.blend !== undefined && rt.blend < 1) return TG.lerp(rt.lanePrev, target, rt.blend);
    return target;
  }
  function cruiseFor(car, kind) {
    if (kind === 'highway') return car.isBus ? cfg.AI_CRUISE_BUS : cfg.AI_CRUISE_HW * car.speedK;
    if (kind === 'suburb') return cfg.AI_CRUISE_SUB * car.speedK;
    if (kind === 'ramp') return 18 * car.speedK;
    return 12;
  }
  function extend(car) { if (car.route) appendLink(car, 25); else appendManeuver(car, car.lastNode, car.lastDir, chooseManeuver(car.lastNode, car.lastDir, car)); }

  // ---------- 생성 ----------
  function makeCar(type, x, z, heading, opts) {
    var T = TG.vehmesh.TYPES[type], color = opts.color || TG.pick(rng, COLORS[type]);
    var violator = opts.violator !== undefined ? opts.violator : TG.chance(rng, cfg.VIOLATOR_RATE);
    var car = {
      id: nextId++, type: type, len: T.l, wid: T.w, pos: { x: x, z: z }, y: 0, heading: heading, v: 0, pitch: 0,
      speedK: 0.9 + rng() * 0.25, cruise: opts.cruise || (cfg.AI_CRUISE + (rng() - 0.5) * 2 * cfg.AI_CRUISE_VAR), path: [], idx: 0,
      isBus: type === 'bus', violator: violator, pedViolator: opts.pedViolator !== undefined ? opts.pedViolator : (violator && rng() < 0.5), cooldown: opts.violator ? 0 : rng() * 10,
      busLaneViolator: false, busLaneT: 0, running: null, violation: null, unseen: 0, mode: 'drive', extra: 0, yieldT: 0, radius: T.l * 0.36,
      braking: false, spawnT: self.time, straight: !!opts.straight, wantsExit: !!opts.wantsExit, stayRing: !!opts.stayRing, route: null,
      laneIdx: opts.laneIdx !== undefined ? opts.laneIdx : (rng() < 0.5 ? 0 : 1),
      // 운전자 습관(위반 소재): phone(휴대전화) · litter(꽁초 던지기) · animal(동물 안고 운전). 방향지시등 없이 차로 변경(noSignalViolator), 실선 구간 변경은 위치로 판정.
      // 12대 중과실 소재: drunk(비틀거림) · overtake(우측 앞지르기) · sidewalk(보도 주행) · cargo(트럭 낙하물) · door(버스 문 열고 주행 = passenger). noLicense 는 정차 후 면허 조회에서만 드러난다.
      trait: opts.trait !== undefined ? opts.trait : (type === 'bus' ? (rng() < 0.12 ? 'door' : null) : type === 'truck' ? (rng() < 0.25 ? 'cargo' : null) : (rng() < 0.22 ? TG.pick(rng, ['phone', 'litter', 'animal', 'drunk', 'overtake', 'sidewalk']) : null)),
      noLicense: opts.noLicense !== undefined ? !!opts.noLicense : rng() < 0.08, weaveT: rng() * 6, swT: rng() * 20, cargoT: 8 + rng() * 12, doorT: 0, otBoost: 0,
      signal: null, signalT: 0, lcShift: 0, lcCd: 6 + rng() * 20, noSignalViolator: opts.noSignalViolator !== undefined ? opts.noSignalViolator : (violator && rng() < 0.6), traitT: rng() * 6, litterT: 6 + rng() * 10,
    };
    if (type !== 'bus' && type !== 'truck') car.busLaneViolator = opts.busLaneViolator !== undefined ? opts.busLaneViolator : TG.chance(rng, cfg.BUSLANE_VIOLATOR_RATE);
    if (type === 'bus') { car.cruise = cfg.AI_CRUISE_BUS * 0.5; car.laneIdx = 1; }
    // 이륜차·자전거: 바깥 차로, 자전거는 느리게. 일부는 보도로 올라가 달린다(edgeRider → 이륜차 '보도 통행', 자전거 '보도 주행' 위반 소재)
    car.isMoto = type === 'moto'; car.isBike = type === 'bike'; car.isPM = type === 'pm';
    if (car.isMoto || car.isBike || car.isPM) {
      car.laneIdx = 1; car.trait = null; car.noSignalViolator = false;
      car.edgeRider = rng() < (car.isPM ? 0.5 : car.isBike ? 0.45 : 0.3); car.edgeOff = car.edgeRider ? 5.4 : 0; car.edgeT = rng() * 5;
      if (car.isBike) { car.cruise = 5.5; car.speedK = 0.6; car.violator = false; }
      else if (car.isPM) { car.cruise = 6.2; car.speedK = 0.7; car.violator = false; car.pmHelmet = rng() < 0.35; car.pmTwo = rng() < 0.22; car.pmT = rng() * 4; }   // 개인형 이동장치: 헬멧 착용 35%, 2인 탑승 22%
      else if (car.violator) car.pedViolator = false;
    }
    // 수배차량(절도·강도 등 중대 사건): 아주 드물게. 겉으로는 표시가 없고 무전 조회(📡)로만 드러난다 → 등급 A(적극 대응)
    car.wanted = opts.wanted !== undefined ? !!opts.wanted : (!car.isMoto && !car.isBike && !car.isPM && !car.isBus && rng() < 0.02);
    var twoW = car.isMoto || car.isBike || car.isPM;
    var mesh = new THREE.Mesh(TG.vehmesh.build(type, color, false, twoW ? { noRider: true, helmet: car.pmHelmet, two: car.pmTwo } : null), bodyMat); mesh.castShadow = true;
    var g = new THREE.Group(); g.rotation.order = 'YXZ'; g.add(mesh);
    // 이륜차·자전거·킥보드 탑승자: 사람 리그(얼굴·머리카락·헬멧)를 태운다. 정지 자세라 매 프레임 계산이 없다.
    if (twoW && TG.Character && TG.Character.pose) {
      var SHIRTS2 = [0xd94f4f, 0x3b6fd1, 0x2fa36b, 0xe0b84a, 0x8b5cc7, 0x2b2f38, 0xf08a5d], PANTS2 = [0x2b3140, 0x4a4a4a, 0x1f2e4a, 0x6b5a48];
      var rideY = car.isPM ? T.wheelR + 0.09 : car.isMoto ? -0.22 : 0.02, rideZ = car.isPM ? 0.02 : car.isMoto ? -0.34 : -0.50;
      var hel = car.isPM ? (car.pmHelmet ? 0xf2f2f2 : 0) : car.isMoto ? 0xf2f2f2 : (rng() < 0.5 ? 0xf3c418 : 0);
      var riders = 1 + (car.isPM && car.pmTwo ? 1 : 0);
      car.riders = [];
      for (var rr = 0; rr < riders; rr++) {
        var rg = TG.Character.build('civilian', { shirt: TG.pick(rng, SHIRTS2), pants: TG.pick(rng, PANTS2), helmet: hel || undefined });
        TG.Character.pose(rg, car.isPM ? 'stand' : 'ride');
        rg.group.position.set(0, rideY, rideZ - rr * 0.42);
        rg.group.scale.setScalar(car.isPM ? 0.95 : 1.0);
        if (rr > 0) { rg.joints.shL.rotation.x = -0.2; rg.joints.shR.rotation.x = -0.2; }   // 뒷사람은 팔을 내린다(2인 탑승)
        g.add(rg.group); car.riders.push(rg);
      }
    }
    var bl = new THREE.Mesh(new THREE.BoxGeometry(T.w * 0.8, 0.14, 0.06), brakeMat); bl.position.set(0, T.pts[1][1] * 0.82 + 0.08, -T.l / 2 - 0.03); bl.visible = false; g.add(bl); car.brakeLamp = bl;
    var sp = new THREE.Sprite(markerMat); sp.scale.set(1.6, 1.6, 1); sp.position.set(0, (T.bus ? 4.2 : 3.2), 0); sp.visible = false; g.add(sp); car.marker = sp;
    // 방향지시등(앞뒤 모서리, 주황) — +x 가 차 왼쪽
    var hy2 = T.pts[1][1] * 0.82 + 0.08; car.blinkL = []; car.blinkR = [];
    [[1, T.l / 2 + 0.02], [1, -T.l / 2 - 0.02], [-1, T.l / 2 + 0.02], [-1, -T.l / 2 - 0.02]].forEach(function (bp) {
      var b = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.10, 0.05), blinkMat); b.position.set(bp[0] * T.w * 0.40, hy2 + 0.06, bp[1]); b.visible = false; g.add(b); (bp[0] > 0 ? car.blinkL : car.blinkR).push(b);
    });
    // 습관 소품: 휴대전화(운전석 머리 옆, 밝은 화면) / 반려동물(운전석 창가, 갈색)
    if (car.trait === 'phone') { var ph = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.15, 0.09), phoneMat); ph.position.set(T.w * 0.30, T.belt + 0.30, T.l * 0.06); ph.rotation.z = 0.3; g.add(ph); }
    // 트럭 짐칸의 상자(고정 안 됨 → 흘린다) / 버스 열린 문 + 문가에 선 승객
    if (car.trait === 'cargo') { car.cargoBoxes = []; for (var cb = 0; cb < 3; cb++) { var bx = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.8, 0.9), cargoMat); bx.position.set((cb - 1) * 0.6, T.belt + 0.55, -T.l * 0.12 - cb * 1.1); g.add(bx); car.cargoBoxes.push(bx); } }
    if (car.trait === 'door') { var dr = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.0, 1.0), doorMat); dr.position.set(-T.w / 2 - 0.55, 1.5, T.l * 0.30); dr.rotation.y = -1.2; g.add(dr); var ps = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.6, 0.3), pasMat); ps.position.set(-T.w / 2 + 0.05, 1.3, T.l * 0.30); g.add(ps); }
    if (car.trait === 'animal') { var dg = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.16, 0.24), dogMat); dg.position.set(T.w * 0.40, T.belt + 0.22, T.l * 0.10); g.add(dg); var dh = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, 0.12), dogMat); dh.position.set(T.w * 0.44, T.belt + 0.34, T.l * 0.19); g.add(dh); }
    g.position.set(x, 0, z); g.rotation.y = heading; g.userData.car = car; scene.add(g); car.mesh = g;
    cars.push(car);
    return car;
  }
  function spawn(opts) {
    opts = opts || {};
    var pl = self.player, T = self.terrain;
    for (var attempt = 0; attempt < 14; attempt++) {
      var onLink = pl && T && (city.frameAt(pl.pos.x, pl.pos.z, pl.heading).kind === 'link');
      var useLink = T && !opts.at && !opts.atLink && (onLink ? rng() < 0.85 : rng() < 0.12), car;
      if (opts.atLink || useLink) {
        var L, i, dirA;
        if (opts.atLink) { L = opts.atLink.link; i = opts.atLink.i; dirA = opts.atLink.dirA; }
        else { L = TG.pick(rng, [T.ring, T.ring, T.ring, T.ring, TG.pick(rng, T.conns), TG.pick(rng, T.conns)]); i = Math.floor(rng() * L.N); dirA = L.oneWay ? true : rng() < 0.5; if (!L.closed && (i < 12 || i > L.N - 14)) continue; }
        var p = L.P(i), type = opts.type || TG.pick(rng, L.kind === 'highway' ? HW_TYPES : CITY_TYPES); if (type === 'bike' && !opts.type) type = 'sedan';   // 교외 링크엔 자전거 없음
        var lane = 0, sgn = dirA ? 1 : -1, heading = Math.atan2(p.tx * sgn, p.tz * sgn), isBus = type === 'bus';
        if (L.kind === 'highway') lane = (opts.lane !== undefined) ? opts.lane : (isBus ? 0 : (rng() < cfg.BUSLANE_VIOLATOR_RATE && type !== 'truck' ? 0 : 1 + Math.floor(rng() * 2)));
        var offs = T.laneOffsets(p), off = offs[Math.min(lane, offs.length - 1)], x = p.x + p.rx * off * sgn, z = p.z + p.rz * off * sgn;
        if (pl && !opts.atLink) { var dist = Math.hypot(x - pl.pos.x, z - pl.pos.z); if (dist < cfg.SPAWN_MIN || dist > cfg.SPAWN_MAX * 1.6) continue; var pfl = pl.forward(), ahl = (x - pl.pos.x) * pfl[0] + (z - pl.pos.z) * pfl[1]; if (ahl > 0 && dist < 140 && Math.abs((x - pl.pos.x) * -pfl[1] + (z - pl.pos.z) * pfl[0]) < dist * 0.9) continue; }   // 플레이어 앞 시야(140m) 안에서 불쑥 나타나지 않게
        if (tooClose(x, z)) continue;
        car = makeCar(type, x, z, heading, { violator: opts.violator, straight: opts.straight, cruise: opts.cruise, busLaneViolator: lane === 0 && !isBus, stayRing: opts.stayRing, trait: opts.trait, noLicense: opts.noLicense });
        car.route = { link: L, dirA: dirA, i: i, lane: lane, lanePrev: null };
        appendLink(car, 30);
        car.v = opts.v !== undefined ? opts.v : cruiseFor(car, p.kind) * 0.8;
        return car;
      }
      var gi = TG.irange(rng, 0, city.xs.length - 1), gj = TG.irange(rng, 0, city.zs.length - 1), d = TG.irange(rng, 0, 3);
      var N = city.nodes[gi][gj], N2 = city.nodeFrom(N, d);
      if (!N2 && !opts.at) continue;
      var laneIdx = opts.laneIdx !== undefined ? opts.laneIdx : (rng() < 0.5 ? 0 : 1);
      var rdS = city.roadOf(N, d), la = city.laneOff(rdS.axis, rdS.idx, laneIdx);
      var f = TG.DIR_VEC[d], r = [-f[1], f[0]], u = opts.u !== undefined ? opts.u : 0.2 + rng() * 0.6, gx, gz;
      if (opts.at) { gx = opts.at.x; gz = opts.at.z; d = opts.at.d; N = opts.at.node; N2 = city.nodeFrom(N, d); f = TG.DIR_VEC[d]; if (!N2) return null; }
      else { gx = N.x + (N2.x - N.x) * u + r[0] * la; gz = N.z + (N2.z - N.z) * u + r[1] * la; }
      if (pl && !opts.at) {
        var dist2 = Math.hypot(gx - pl.pos.x, gz - pl.pos.z);
        if (dist2 < cfg.SPAWN_MIN || dist2 > cfg.SPAWN_MAX) continue;
        var pf = pl.forward(), ahead = (gx - pl.pos.x) * pf[0] + (gz - pl.pos.z) * pf[1];
        if (ahead > 0 && dist2 < 60 && Math.abs((gx - pl.pos.x) * -pf[1] + (gz - pl.pos.z) * pf[0]) < 8) continue;
      }
      if (tooClose(gx, gz)) continue;
      var ctype = opts.type || TG.pick(rng, CITY_TYPES);
      car = makeCar(ctype, gx, gz, TG.DIR_HEADING[d], { violator: opts.violator, pedViolator: opts.pedViolator, straight: opts.straight, cruise: opts.cruise, wantsExit: opts.wantsExit, laneIdx: laneIdx, trait: opts.trait, noLicense: opts.noLicense, color: opts.color });
      if (opts.at && opts.laneIdx === undefined) { var lf = city.laneFrame(gx, gz, TG.DIR_HEADING[d]); car.laneIdx = lf.lateral > 4 ? 1 : 0; }
      car.path.push(approachPoint(car, N2, d));
      car.lastNode = N2; car.lastDir = d;
      extend(car); extend(car);
      car.v = opts.v !== undefined ? opts.v : car.cruise * 0.8;
      return car;
    }
    return null;
  }
  function tooClose(x, z) { for (var c = 0; c < cars.length; c++) if (Math.hypot(cars[c].pos.x - x, cars[c].pos.z - z) < 12) return true; return false; }
  function remove(car) { scene.remove(car.mesh); var k = cars.indexOf(car); if (k >= 0) cars.splice(k, 1); }
  function forwardOf(car) { return [Math.sin(car.heading), Math.cos(car.heading)]; }

  function leadOf(car, fx, fz) {
    var best = null, bestAlong = 1e9, rx = -fz, rz = fx;
    function consider(o, olen, ov, oheadDot) {
      var dx = o.pos.x - car.pos.x, dz = o.pos.z - car.pos.z, along = dx * fx + dz * fz, lat = dx * rx + dz * rz;
      if (along <= 0 || along > 60 || Math.abs(lat) > 2.2) return;
      if (oheadDot < 0.3 && ov > 1) return;
      if (along < bestAlong) { bestAlong = along; best = { along: along, len: olen, v: ov }; }
    }
    for (var i = 0; i < cars.length; i++) { var o = cars[i]; if (o === car) continue; var of = forwardOf(o); consider(o, o.len, o.v, of[0] * fx + of[1] * fz); }
    var pl = self.player;
    if (pl) { var pf = pl.forward(); consider(pl, pl.len, Math.max(0, pl.vF), pf[0] * fx + pf[1] * fz); }
    return best;
  }
  function stopProfile(dist, decel) { var d = dist - 1.0; return d <= 0.3 ? 0 : Math.sqrt(2 * decel * d); }
  // 이 접근로의 횡단보도 위에 보행자가 있는가(차도 위, 횡단보도 띠 안)
  function pedOnCrosswalk(ap) {
    var P = self.peds; if (!P) return false;
    var f = TG.DIR_VEC[ap.d], r = [-f[1], f[0]], node = ap.node, cn = city.crossNear(node, ap.d), cf = city.crossFar(node, ap.d), rd = city.roadOf(node, ap.d), half = city.halfOf(rd.axis, rd.idx);
    var list = P.walker ? P.peds.concat([P.walker]) : P.peds;
    for (var i = 0; i < list.length; i++) {
      var p = list[i], dx = p.pos.x - node.x, dz = p.pos.z - node.z, along = dx * f[0] + dz * f[1], lat = dx * r[0] + dz * r[1];
      if (along <= -cn + 0.6 && along >= -cf - 0.6 && Math.abs(lat) <= half - 0.3 && city.onRoad(p.pos.x, p.pos.z)) return true;
    }
    return false;
  }

  function drive(car, dt) {
    var path = car.path;
    while (path.length - car.idx < 6 && (car.route || car.lastNode)) { var before = path.length; extend(car); if (path.length === before) break; }
    var fx = Math.sin(car.heading), fz = Math.cos(car.heading), rx = -fz, rz = fx;
    while (car.idx < path.length - 1) {
      var p = path[car.idx], dx = p.x - car.pos.x, dz = p.z - car.pos.z, along = dx * fx + dz * fz;
      if (p.stop ? along < -0.8 : (along < 0.6 || Math.hypot(dx, dz) < 1.2)) car.idx++; else break;
    }
    if (car.idx > 40) { path.splice(0, car.idx); car.idx = 0; }
    var cur = path[Math.min(car.idx, path.length - 1)], onLink = !!cur.lp;
    var target = onLink ? cruiseFor(car, cur.kind) : car.cruise, emergency = false;
    for (var t = car.idx; t < Math.min(path.length, car.idx + 12); t++) {
      var q = path[t]; if (q.vmax === undefined) continue;
      var dq = Math.hypot(q.x - car.pos.x, q.z - car.pos.z);
      target = Math.min(target, Math.sqrt(q.vmax * q.vmax + 2 * cfg.AI_DECEL * Math.max(0, dq - 4)));
    }
    var ap = null;
    for (var k = car.idx; k < path.length; k++) if (path[k].stop) { ap = path[k]; break; }
    var pedIgnore = false;
    if (ap) {
      for (var g = 0; g < 3 && ap.maneuver === undefined && car.lastNode; g++) extend(car);
      var f = TG.DIR_VEC[ap.d], distStop = (ap.x - car.pos.x) * f[0] + (ap.z - car.pos.z) * f[1], rightTurn = ap.maneuver === 'R';
      car.cooldown -= dt;
      if (distStop > -0.5 && distStop < 60) {
        var st = signals.state(ap.node, (ap.d === 0 || ap.d === 2) ? 'v' : 'h');
        if (!rightTurn && car.running !== ap.node && car.violator && car.cooldown <= 0 && st.s === 'red' && st.remain > 2.0 && distStop < 38 && car.mode === 'drive') {
          var lead0 = leadOf(car, fx, fz);
          if (!lead0 || lead0.along > distStop + 2) { car.running = ap.node; car.cooldown = cfg.VIOLATOR_COOLDOWN; }
        }
        if (rightTurn && st.s === 'red') {
          if (car.rorNode !== ap.node) {
            if (distStop < 3 && car.v < 0.2) { car.rorT = (car.rorT || 0) + dt; if (car.rorT > 1.0) car.rorNode = ap.node; } else car.rorT = 0;
            if (car.rorNode !== ap.node) target = Math.min(target, stopProfile(distStop, cfg.AI_DECEL));
          }
        } else if (car.running !== ap.node) {
          var canStop = distStop > car.v * car.v / (2 * cfg.AI_DECEL * 1.25) + 1.5;
          if (st.s === 'red' || (st.s === 'yellow' && canStop)) target = Math.min(target, stopProfile(distStop, cfg.AI_DECEL));
        }
        // 보행자 보호 무시 성향: 횡단보도 앞 정지를 건너뛴다(정면 3m 급제동만)
        if (car.pedViolator && car.mode === 'drive' && distStop < 30 && car.cooldown <= 0) pedIgnore = true;
      }
      if (car.prevDistStop !== undefined && car.prevDistStop > 0 && distStop <= 0 && car.prevAp === ap) {
        var st2 = signals.state(ap.node, (ap.d === 0 || ap.d === 2) ? 'v' : 'h');
        if (st2.s === 'red' && st2.elapsed > 0.6 && car.v > 1.5 && !rightTurn) { self.stats.violations++; flag(car, 'signal', ap.node, self.witness(car)); }
        car.running = null;
        // 횡단보도 진입 시 보행자가 걷고 있으면 보행자 보호의무 위반
        if (!car.violation && car.v > 1.5 && pedOnCrosswalk(ap)) { self.stats.violations++; flag(car, 'pedestrian', ap.node, self.witness(car)); car.cooldown = cfg.VIOLATOR_COOLDOWN; }
      }
      car.prevDistStop = distStop; car.prevAp = ap;
    } else { car.prevAp = null; car.prevDistStop = undefined; }
    if (onLink && cur.kind === 'highway' && car.route && car.route.lane === 0 && !car.isBus && car.mode === 'drive') {
      if (self.witness(car)) { car.busLaneT += dt; if (car.busLaneT > cfg.BUSLANE_WITNESS_SEC && !car.violation) { self.stats.violations++; flag(car, 'buslane', null, true); } }
    } else car.busLaneT = 0;
    // ---- 방향지시등·차로 변경·운전자 습관 ----
    car.lcCd -= dt; car.signalT -= dt;
    if (ap && (ap.maneuver === 'L' || ap.maneuver === 'R') && distStop > -2 && distStop < 40) car.signal = ap.maneuver;   // 교차로 회전 예고
    else if (car.signalT <= 0 && !(ap && (ap.maneuver === 'L' || ap.maneuver === 'R') && distStop < 40)) car.signal = null;
    if (car.prevApRef && car.prevApRef !== ap) car.lcShift = 0;   // 교차로를 지나면 새 경로가 새 차로에 있다
    car.prevApRef = ap;
    if (!onLink && car.mode === 'drive' && ap && distStop > 18 && distStop < 75 && car.lcCd <= 0 && car.v > 4 && !car.isBus && car.trait !== 'overtake' && (car.lcForce || rng() < dt * 0.35)) {   // 앞지르기 습관 차량은 추월할 때만 차로를 바꾼다
      car.lcForce = false;
      var rdL = city.roadOf(ap.node, ap.d);
      if (city.lanesOf(rdL.axis, rdL.idx) === 2) {
        var oldL = car.laneIdx, newL = 1 - oldL, offOld = city.laneOff(rdL.axis, rdL.idx, oldL), offNew = city.laneOff(rdL.axis, rdL.idx, newL);
        car.laneIdx = newL; car.lcShift += offNew - offOld; car.lcCd = 14 + rng() * 22;
        if (car.noSignalViolator) { car.signal = null; self.stats.violations++; flag(car, 'nosignal', ap.node, self.witness(car)); }
        else { car.signal = newL === 1 ? 'R' : 'L'; car.signalT = 3; }
        if (distStop < 32) { self.stats.violations++; flag(car, 'solidline', ap.node, self.witness(car)); }   // 정지선 앞 실선 구간
      }
    }
    // 보도 주행 차량(sidewalk 습관): 30초마다 7초 동안 보도로 올라갔다 내려온다. 이륜차·자전거는 계속(edgeRider).
    if (car.trait === 'sidewalk' && !onLink && car.mode === 'drive' && !car.isMoto && !car.isBike) { car.swT += dt; var swOn = (car.swT % 30) < 7 && !(ap && distStop < 26 && distStop > -2); if (swOn && !car.edgeRider) { car.edgeRider = true; car.edgeT = 3; car.laneIdx = 1; } if (!swOn && car.edgeRider) car.edgeRider = false; car.edgeOff = 6.0; }
    if (car.edgeRider && !onLink && car.mode === 'drive') { var et = car.isMoto ? 'motorcycle' : car.isBike ? 'bicycle' : car.isPM ? 'pm' : 'sidewalk'; car.edgeT += dt; if (car.edgeT > (et === 'sidewalk' ? 4 : 6) && self.witness(car) && (!car.violation || car.violation.type !== et)) { self.stats.violations++; flag(car, et, null, true); car.edgeT = -30; } }
    // 개인형 이동장치: 인명보호장구(헬멧) 미착용 · 2인 이상 탑승 — 목격 3초면 기록(보도 통행과 별개)
    if (car.isPM && car.mode === 'drive' && car.v > 1.5 && self.witness(car)) {
      car.pmT += dt;
      if (car.pmT > 3) { car.pmT = -20; var pv = !car.pmHelmet ? 'pmHelmet' : (car.pmTwo ? 'pmTwo' : null); if (pv && !car.violation) { self.stats.violations++; flag(car, pv, null, true); } }   // 보도 통행이 이미 기록됐으면 덮지 않는다
    }
    // 음주 의심: 차로 안에서 좌우로 비틀거리고 속도가 들쭉날쭉. 목격 5초면 「음주운전 의심」 기록
    if (car.trait === 'drunk' && car.mode === 'drive') { car.weaveT += dt; car.weave = Math.sin(car.weaveT * 1.1) * 1.25 + Math.sin(car.weaveT * 2.7) * 0.35; target *= 0.82 + 0.28 * Math.sin(car.weaveT * 0.8); if (self.witness(car)) { car.drunkSeen = (car.drunkSeen || 0) + dt; if (car.drunkSeen > 5 && (!car.violation || car.violation.type !== 'drunk')) { self.stats.violations++; flag(car, 'drunk', null, true); car.drunkSeen = -40; } } }
    // 버스 문 열고 주행(승객이 문가에 서 있음): 달리는 것을 3초 목격하면 「승객 추락방지 위반」
    if (car.trait === 'door' && car.mode === 'drive' && car.v > 3) { if (self.witness(car)) { car.doorT += dt; if (car.doorT > 3 && (!car.violation || car.violation.type !== 'passenger')) { self.stats.violations++; flag(car, 'passenger', null, true); car.doorT = -40; } } }
    // 트럭 낙하물: 고정 안 된 상자가 15~25초마다 하나씩 떨어져 도로 위에 20초 남는다(장애물)
    if (car.trait === 'cargo' && car.mode === 'drive' && car.v > 4 && car.cargoBoxes && car.cargoBoxes.length) {
      car.cargoT -= dt;
      if (car.cargoT <= 0) {
        car.cargoT = 15 + rng() * 10; var box = car.cargoBoxes.pop(); car.mesh.remove(box);
        var bm = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.8, 0.9), cargoMat); bm.position.set(car.pos.x - fx * (car.len / 2), car.y + 1.6, car.pos.z - fz * (car.len / 2)); bm.rotation.y = car.heading; scene.add(bm);
        litters.push({ m: bm, vx: fx * car.v * 0.5, vy: 0.5, vz: fz * car.v * 0.5, t: 0, life: 20, ground: 0.4 });
        self.stats.violations++; flag(car, 'cargo', null, self.witness(car));
        if (car.cargoBoxes.length === 0) setTimeout(function () { car.cargoBoxes = null; }, 0);
      }
    }
    if (car.trait === 'phone' || car.trait === 'animal') { car.traitT += dt; if (car.traitT > 8 && self.witness(car) && (!car.violation || car.violation.type !== car.trait)) { self.stats.violations++; flag(car, car.trait, null, true); car.traitT = -25; } }
    if (car.trait === 'litter' && car.mode === 'drive') {
      car.litterT -= dt;
      if (car.litterT <= 0) {
        car.litterT = 16 + rng() * 14;
        var lm = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.02, 0.06), litterMat), rxl = -fz, rzl = fx;
        lm.position.set(car.pos.x + rxl * -(car.wid / 2 + 0.2), car.y + 1.0, car.pos.z + rzl * -(car.wid / 2 + 0.2));   // 왼쪽 창(+x 는 왼쪽 → 우측 벡터의 반대)
        scene.add(lm); litters.push({ m: lm, vx: fx * car.v * 0.6 - rxl * 3, vy: 2.2, vz: fz * car.v * 0.6 - rzl * 3, t: 0 });
        self.stats.violations++; flag(car, 'litter', null, self.witness(car));
      }
    }
    if (self.peds && !onLink) {
      var pd = self.peds.nearestAhead(car.pos.x, car.pos.z, fx, fz, pedIgnore ? 6 : 18, pedIgnore ? 2.2 : 6.5);
      if (pd !== null) { target = Math.min(target, stopProfile(pd - 2.5, pedIgnore ? cfg.AI_EMERGENCY : cfg.AI_DECEL)); if (pd < 6) { emergency = true; if (car.v > 4 && !car.pedHorn && self.player && Math.hypot(car.pos.x - self.player.pos.x, car.pos.z - self.player.pos.z) < 50) { car.pedHorn = true; TG.audio.horn(false); } } else car.pedHorn = false; }   // 급제동 경적
    }
    var lead = leadOf(car, fx, fz);
    // 우측 앞지르기(overtake 습관): 느린 앞차 뒤에서 바깥(우측) 차로로 빠져 속도를 올려 추월한다 → 「앞지르기 위반」(앞지르기는 좌측으로)
    if (car.trait === 'overtake' && !onLink && car.mode === 'drive' && car.laneIdx === 0 && car.lcCd <= 0 && lead && lead.along < 24 && lead.v < car.cruise - 2 && car.v > 3 && ap && distStop > 20) {
      var rdO = city.roadOf(ap.node, ap.d);
      if (city.lanesOf(rdO.axis, rdO.idx) === 2) { car.laneIdx = 1; car.lcShift += city.laneOff(rdO.axis, rdO.idx, 1) - city.laneOff(rdO.axis, rdO.idx, 0); car.signal = 'R'; car.signalT = 2; car.lcCd = 25 + rng() * 20; car.cruise *= 1.35; car.otBoost = 7; lead = null; self.stats.violations++; flag(car, 'overtake', ap.node, self.witness(car)); }
    }
    if (car.otBoost > 0) { car.otBoost -= dt; if (car.otBoost <= 0) car.cruise /= 1.35; }
    // 철길건널목: 차단기가 내려오면 정지선 앞에 선다. 위반 성향 차량 일부는 그대로 통과 → 「건널목 위반」
    if (self.rail) {
      var rr = self.rail.approach(car, onLink ? cur : null);
      if (rr) {
        if (rr.closed && rr.dist > 0 && !car.railRun) target = Math.min(target, stopProfile(rr.dist - 1.5, cfg.AI_DECEL));
        if (rr.closed && rr.dist > 0 && rr.dist < 30 && car.railRun === undefined) car.railRun = car.violator && rng() < 0.7;
        if (!rr.closed) car.railRun = undefined;
        if (car.railPrev !== undefined && car.railPrev > 0 && rr.dist <= 0 && rr.closed && car.v > 1) { self.stats.violations++; flag(car, 'railroad', null, self.witness(car)); }
        car.railPrev = rr.dist;
      } else car.railPrev = undefined;
    }
    if (lead) {
      var gap = lead.along - (car.len / 2 + lead.len / 2), want = 2.5 + car.v * cfg.AI_FOLLOW_SEC;
      if (gap < want) target = Math.min(target, Math.max(0, lead.v - (want - gap) * 0.9));
      if (gap < 1.5) { target = 0; emergency = true; }
      // 경적: 앞차가 서서 안 움직이면(3~6초) 성질 급한 운전자가 짧게 울린다(플레이어 근처만 들린다)
      if (lead.v < 0.4 && car.v < 0.4 && gap < 4) { car.hornT = (car.hornT || 0) + dt; if (car.hornT > (car.hornAt || (car.hornAt = 3 + rng() * 4))) { car.hornT = 0; car.hornAt = 6 + rng() * 6; if (self.player && Math.hypot(car.pos.x - self.player.pos.x, car.pos.z - self.player.pos.z) < 45 && rng() < 0.5) TG.audio.horn(rng() < 0.3); } } else car.hornT = 0;
    }
    if (car.route && car.route.merge && car.route.blend < 0.6) {
      for (var mi = 0; mi < cars.length; mi++) { var o2 = cars[mi]; if (o2 === car) continue; var ddx = o2.pos.x - car.pos.x, ddz = o2.pos.z - car.pos.z; if (ddx * ddx + ddz * ddz < 14 * 14 && (ddx * fx + ddz * fz) < 0 && Math.abs(ddx * rx + ddz * rz) < 5) target = Math.min(target, 4); }
    }
    // 정차 유도: 갓길로 옮기고, 교차로·횡단보도 밖에서 선다
    var extraT = car.mode === 'drive' ? (car.lcShift || 0) + (car.edgeRider ? car.edgeOff : 0) + (car.trait === 'drunk' ? (car.weave || 0) : 0) : 0;   // 차로 변경·보도 주행(이륜차·자전거 위반): 경로점 대비 옆 이동
    if (car.mode === 'yield' || car.mode === 'stopped') {
      var frame = city.frameAt(car.pos.x, car.pos.z, car.heading);
      var shoulder = onLink ? self.terrain.shoulderOf(cur.lp) : frame.shoulder;
      var laneOffNow = onLink ? cur.off : (frame.kind === 'grid' ? city.laneOff(frame.axis, frame.idx, car.laneIdx) : LANE);   // 경로점 기준 차로(현재 위치가 아니라) — 진동 방지
      extraT = shoulder - laneOffNow;
      car.yieldT += dt; target = Math.min(target, 5);
      var moved = frame.lateral >= shoulder - 0.8;
      var clear = (onLink || !city.nearIntersectionZone(car.pos.x, car.pos.z)) && car.yieldT > 1.2 && moved;
      if (!moved && !emergency) target = Math.max(target, Math.min(car.v, 3.5));
      if (clear) { target = 0; if (car.v < 0.05) car.mode = 'stopped'; }
      if (car.mode === 'stopped' && !clear) car.mode = 'yield';
    } else if (car.mode === 'release') { car.yieldT -= dt; if (car.yieldT <= 0) car.mode = 'drive'; }
    car.extra += TG.clamp(extraT - car.extra, -2.0 * dt, 2.0 * dt);

    car.dbg = { target: target, emergency: emergency, lead: lead ? [lead.along, lead.v] : null, ap: ap ? (ap.node.i + ',' + ap.node.j + ':' + ap.maneuver) : null };
    var decel = (emergency || car.v - target > 6) ? cfg.AI_EMERGENCY : cfg.AI_DECEL;
    if (car.v < target) car.v = Math.min(target, car.v + (onLink ? 2.6 : cfg.AI_ACCEL) * dt); else car.v = Math.max(target, car.v - decel * dt);
    car.braking = target < car.v - 0.3 || (target === 0 && car.v > 0.05);
    if (car.mode === 'stopped') car.v = 0;

    var L = 4 + car.v * 0.45, tgt = null;
    for (var m = car.idx; m < path.length; m++) { var pp = path[m]; if (Math.hypot(pp.x - car.pos.x, pp.z - car.pos.z) >= L || m === path.length - 1) { tgt = pp; break; } }
    if (tgt) {
      var tx = tgt.x + rx * car.extra, tz = tgt.z + rz * car.extra, dh = TG.wrapAngle(Math.atan2(tx - car.pos.x, tz - car.pos.z) - car.heading), maxYaw = Math.max(0.9, car.v * 0.42);
      if (car.v > 0.05) car.heading += TG.clamp(dh, -maxYaw * dt, maxYaw * dt);
    }
    var fx3 = Math.sin(car.heading), fz3 = Math.cos(car.heading);
    car.pos.x += fx3 * car.v * dt; car.pos.z += fz3 * car.v * dt;
    if (self.terrain && !city.inGridArea(car.pos.x, car.pos.z)) {
      var yA = self.terrain.heightAt(car.pos.x + fx3 * 2, car.pos.z + fz3 * 2), yB = self.terrain.heightAt(car.pos.x - fx3 * 2, car.pos.z - fz3 * 2);
      car.y = (yA + yB) / 2; car.pitch = -Math.atan2(yA - yB, 4);
    } else { car.y = 0; car.pitch = 0; }
    car.mesh.position.set(car.pos.x, car.y, car.pos.z); car.mesh.rotation.set(car.pitch, car.heading, 0);
    car.brakeLamp.visible = car.braking;
    var blinkOn = car.signal && ((self.time * 1.6) % 1) < 0.5;
    for (var bi2 = 0; bi2 < car.blinkL.length; bi2++) { car.blinkL[bi2].visible = !!(blinkOn && car.signal === 'L'); car.blinkR[bi2].visible = !!(blinkOn && car.signal === 'R'); }
    if (car.violation) {
      car.marker.position.y = (car.isBus ? 4.2 : 3.2) + Math.sin(self.time * 4) * 0.2;
      if (self.time - car.violation.t > cfg.VIOLATION_MEMORY && car.mode === 'drive') { car.violation = null; car.marker.visible = false; }
    }
  }
  // 위반은 목격 여부와 상관없이 차량에 기록한다(터치 단속 퀴즈의 정답 근거). 화살표·HUD 알림은 플레이어가 목격했을 때만.
  function flag(car, type, node, seen) {
    if (car.violation && car.violation.seen && !seen) return;
    car.violation = { type: type, t: self.time, node: node, seen: !!seen }; car.marker.visible = !!seen;
    if (seen) { self.stats.witnessed++; self.onEvent('witness', car); } else car.unseen++;
  }
  this.witness = function (car) {
    var pl = self.player; if (!pl) return false;
    var dx = car.pos.x - pl.pos.x, dz = car.pos.z - pl.pos.z, dist = Math.hypot(dx, dz);
    if (dist > cfg.WITNESS_DIST) return false;
    if (dist < 25) return true;
    var pf = pl.forward(); return (dx * pf[0] + dz * pf[1]) / (dist || 1) > Math.cos(cfg.WITNESS_FOV * Math.PI / 180);
  };

  var spawnT = 0;
  this.update = function (dt, budget) {
    self.time += dt; spawnT -= dt;
    if (spawnT <= 0) { spawnT = 0.5; if (cars.length < budget) spawn(); }
    for (var i = 0; i < cars.length; i++) drive(cars[i], dt);
    for (var li = litters.length - 1; li >= 0; li--) {   // 던져진 꽁초: 포물선으로 떨어져 2초 뒤 사라진다
      var lt = litters[li]; lt.t += dt; lt.vy -= 9.8 * dt;
      var gnd = lt.ground || 0.03;
      lt.m.position.x += lt.vx * dt; lt.m.position.y = Math.max(gnd, lt.m.position.y + lt.vy * dt); lt.m.position.z += lt.vz * dt;
      if (lt.m.position.y <= gnd) { lt.vx *= 0.5; lt.vz *= 0.5; }
      if (lt.t > (lt.life || 2.5)) { scene.remove(lt.m); litters.splice(li, 1); }
    }
    var pl = self.player;
    if (pl) for (var k = cars.length - 1; k >= 0; k--) {
      var c = cars[k]; if (c.mode !== 'drive' || c.violation) continue;
      var far = city.frameAt(pl.pos.x, pl.pos.z, pl.heading).kind === 'link' ? cfg.DESPAWN * 1.7 : cfg.DESPAWN;
      var ddp = Math.hypot(c.pos.x - pl.pos.x, c.pos.z - pl.pos.z), pfd = pl.forward(), inView = (c.pos.x - pl.pos.x) * pfd[0] + (c.pos.z - pl.pos.z) * pfd[1] > 0;
      if (ddp > far && (!inView || ddp > far * 1.8)) remove(c);   // 시야 앞의 차는 훨씬 멀어질 때까지 남긴다(눈앞에서 사라지지 않게)
      else if (!c.route && !c.lastNode) remove(c);
    }
  };
  this.separate = function () {
    for (var i = 0; i < cars.length; i++) for (var j = i + 1; j < cars.length; j++) {
      var a = cars[i], b = cars[j], dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z, rr = a.radius + b.radius, d2 = dx * dx + dz * dz;
      if (d2 >= rr * rr || d2 < 1e-6) continue;
      var d = Math.sqrt(d2), ov = (rr - d) / 2;
      a.pos.x -= dx / d * ov; a.pos.z -= dz / d * ov; b.pos.x += dx / d * ov; b.pos.z += dz / d * ov; a.v *= 0.5; b.v *= 0.5;
    }
  };
  this.spawn = spawn; this.remove = remove;
  this.setYield = function (car, on) {
    if (on) { if (car.mode === 'drive' || car.mode === 'release') { car.mode = 'yield'; car.yieldT = 0; } }
    else if (car.mode !== 'drive') { car.mode = 'release'; car.yieldT = 3; car.violation = null; car.marker.visible = false; car.busLaneT = 0; if (car.route) car.route.lane = Math.max(car.route.lane, car.isBus ? 0 : 1); }
  };
  this.approachPoint = approachPoint;
};
