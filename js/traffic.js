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

  var CITY_TYPES = ['sedan', 'sedan', 'sedan', 'hatch', 'hatch', 'suv', 'suv', 'van', 'truck', 'pickup', 'bus', 'moto', 'moto', 'bike', 'pm', 'pm'];
  var HW_TYPES = ['sedan', 'sedan', 'sedan', 'suv', 'suv', 'hatch', 'van', 'truck', 'truck', 'pickup', 'pickup', 'bus', 'bus'];
  var COLORS = { sedan: [0xc94d43, 0x3e6bb0, 0x9aa3ad, 0x2f3438, 0xe6e2d8, 0x6b8f5a, 0xb08a3e, 0x7d5a96],
                 hatch: [0xd77a3a, 0x5c8bd6, 0xbfb8aa, 0x7d5a96, 0xd9d34f, 0x2f3438],
                 suv: [0x2f3438, 0xdcdcd4, 0x4a6e8a, 0x6d4f3a, 0x3e6bb0, 0x8e9aa6],
                 van: [0xdcdcd4, 0x4a6e8a, 0x9a4a3a, 0xe6e2d8], truck: [0x6e4a2f, 0x3b4a58, 0x7a2e2a, 0x2f6fd6], pickup: [0xdcdcd4, 0x2f3438, 0x8e9aa6, 0x6d4f3a, 0x9a4a3a], bus: [0x2f6fd6, 0x2ea043, 0xd7262b, 0x1f4fa8], moto: [0xd7262b, 0x2f3438, 0x3e6bb0, 0xf3c418, 0xdcdcd4], bike: [0xc94d43, 0x2ea043, 0x3e6bb0, 0x2f3438, 0xd9d34f], pm: [0x3b6fd1, 0x2f3438, 0xd7262b, 0xe6e2d8] };
  var bodyMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  var brakeMat = new THREE.MeshBasicMaterial({ color: 0xff2a1a });
  var blinkMat = new THREE.MeshBasicMaterial({ color: 0xffa000 }), phoneMat = new THREE.MeshBasicMaterial({ color: 0xbfe6ff }), dogMat = new THREE.MeshLambertMaterial({ color: 0x8a5a2b });
  var litterMat = new THREE.MeshBasicMaterial({ color: 0xff7a1a }), litters = [];
  var cargoMat = new THREE.MeshLambertMaterial({ color: 0xb98a4a }), doorMat = new THREE.MeshLambertMaterial({ color: 0xdfe4ea }), pasMat = new THREE.MeshLambertMaterial({ color: 0x3b6fd1 });
  // 반투명 유리(깊이를 쓰지 않아 안의 운전자가 비친다) · 휴대전화 화면(손에 든 폰 = 말풍선 · 거치대 = 지도) · 운전자 옷·피부·머리색
  // 유리는 너무 짙으면 안의 휴대전화 화면이 실내와 같은 회색으로 묻힌다(실측: 화면 157 · 옆 유리 106) — 조금 옅고 맑게
  var glassMat = new THREE.MeshLambertMaterial({ color: 0x3a5068, transparent: true, opacity: 0.34, depthWrite: false });
  var screenChatMat = new THREE.MeshBasicMaterial({ map: TG.tex.phoneScreen('chat'), side: THREE.DoubleSide }), screenMapMat = new THREE.MeshBasicMaterial({ map: TG.tex.phoneScreen('map'), side: THREE.DoubleSide });
  var phoneBodyMat = new THREE.MeshLambertMaterial({ color: 0x15171a });
  // 화면 빛(가산 스프라이트) — 창 너머에서 「켜진 화면」을 알아보게 한다. 차체에 가리면 안 보인다(깊이 검사는 한다)
  var phoneGlowMat = new THREE.SpriteMaterial({ map: TG.tex.flare(), color: 0xcfe8ff, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending });
  var DRV_SHIRT = [0x2b2f38, 0xe8e2d4, 0x3b6fd1, 0x6b5a48, 0xd94f4f, 0x2fa36b, 0x8a8f98], DRV_SKIN = [0xf1c9a5, 0xd9a06e, 0xb5794f], DRV_HAIR = [0x1a1a1a, 0x3a2a1a, 0x5a3a2a];
  this.rail = null;   // TG.Rail(철길건널목) — main 이 붙인다
  this.control = { closed: [], hand: [] };   // 교차로 근무: 임시 차단한 차로 · 꼬리 끊기 수신호(js/junction.js 가 채운다)
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
      nd = (d + 3) % 4; lb = gridLane(car, N, nd); R = 5 + Math.max(0, city.crossHalf(N, d) - 6) * 0.3;   // 넓은 교차로는 우회전 반경도 크게
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
    var rdN = city.roadOf(N, d), nLn = city.lanesOf(rdN.axis, rdN.idx);
    if (city.nodeFrom(N, (d + 3) % 4) && (!car || nLn === 1 || car.laneIdx >= nLn - 1)) opts.push(['R', 0.28]);  // 우회전은 가장 바깥 차로에서만
    // 보호 좌회전이 있는 접근로(v0.9.49): 1차로 차의 일부가 좌회전 화살표에 맞춰 돈다(1차로 = 좌회전 전용). 다른 차로는 좌회전하지 않는다.
    var protL = !!(signals.hasLeftFor && signals.hasLeftFor(N, d)) && nLn >= 2;
    var wL = protL ? (car && car.laneIdx === 0 && !car.isBus && !car.isMoto && !car.isBike && !car.isPM ? 0.55 : 0) : (opts.length ? 0.0 : 1);
    if (city.nodeFrom(N, (d + 1) % 4)) opts.push(['L', wL]);
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
  // 고속도로 차로 배정: 버스전용차로가 있는 도로(경부)에서만 버스가 1차로. 나머지 고속도로는 버스도 일반 차로로 달린다.
  // 지정차로(도로교통법 §14② · 시행규칙 별표9 — 티북 원문): 고속도로 편도 3차로 이상은 1차로 = 앞지르기,
  // 나머지를 반으로 나눠 1차로 쪽이 「왼쪽 차로」(승용·경~중형 승합), 바깥쪽이 「오른쪽 차로」(대형승합·화물·특수·건설기계).
  // 홀수면 가운데 차로는 어느 쪽도 아니다. 「지정 차로보다 오른쪽은 언제나 가능」(비고2).
  // → 편도 4차로면 화물·대형승합은 **3·4차로**. 티북 현장 사례 「5톤 화물이 고속도로 2차로(왼쪽) 주행 → 위반」.
  // (전에는 화물을 2~4차로에 고르게 두어 **2차로의 화물차가 사실은 위반**이었다.)
  function minCargoLane(n) { return 1 + Math.floor((n - 1) / 2); }
  function cargoLane(car, n) {
    var lo = minCargoLane(n);
    if (car.laneViolator) return Math.floor(rng() * lo);             // 1차로 또는 2차로 — 위반 성향
    return lo + Math.floor(rng() * Math.max(1, n - lo));
  }
  this.minCargoLane = minCargoLane;
  function laneFor(car, link) {
    if (link.kind !== 'highway') return 0;
    var n = self.terrain.laneOffsets(link.pts[0]).length, busl = !!link.busLane;
    if (busl && (car.isBus || car.busLaneViolator)) return 0;
    // 지정차로: 버스전용차로가 없는 고속도로(올림픽대로·순환 본선)에서 승합·화물은 1차로에 들어갈 수 없다.
    // 중앙 기준 오른쪽 차로로 통행한다(소유자: 「올림픽대로에서는 지정차로 위반 — 1차로는 진입할 수 없음.
    // 승합차 화물차는 가운데 기준 우측차로로만 통행해야 함」). 시행규칙 별표9 취지.
    if (!busl && (car.isBus || car.isCargo) && n > 1) return cargoLane(car, n);
    var lo = busl ? 1 : 0;
    return lo + Math.floor(rng() * Math.max(1, n - lo));
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
          if (rt.pendingExit === ex && i === ex.atIndex) { car.route = rt = { link: ex.link, dirA: true, i: 0, lane: 0, lanePrev: cfg.HW_LANES[cfg.HW_LANES.length - 1], blend: 0 }; L = ex.link; i = 0; break; }
        }
      }
      if (atEnd) {
        var nx = rt.dirA ? L.nextA : L.nextB;
        if (nx) {
          var lanePrev = laneOffsetOf(car, L, rt.lane, rt);
          car.route = rt = { link: nx.link, dirA: nx.dirA !== false, i: nx.index, lane: laneFor(car, nx.link), lanePrev: lanePrev, blend: 0, merge: !!nx.merge };
          L = nx.link; i = rt.i;
          if (rt.merge) rt.lanePrev = cfg.HW_LANES[cfg.HW_LANES.length - 1];
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
      isBus: type === 'bus', isTruck: type === 'truck', isCargo: type === 'truck' || type === 'pickup',
      laneViolator: opts.laneViolator !== undefined ? !!opts.laneViolator : ((type === 'truck' || type === 'pickup' || type === 'bus') && rng() < cfg.LANE_VIOLATOR_RATE), laneT: 0,
      violator: violator, pedViolator: opts.pedViolator !== undefined ? opts.pedViolator : (violator && rng() < 0.5), cooldown: opts.violator ? 0 : rng() * 10,
      busLaneViolator: false, busLaneT: 0, running: null, violation: null, unseen: 0, mode: 'drive', extra: 0, yieldT: 0, radius: T.l * 0.36,
      braking: false, spawnT: self.time, straight: !!opts.straight, wantsExit: !!opts.wantsExit, stayRing: !!opts.stayRing, route: null,
      laneIdx: opts.laneIdx !== undefined ? opts.laneIdx : (rng() < 0.5 ? 0 : 1),
      // 운전자 습관(위반 소재): phone(휴대전화) · litter(꽁초 던지기) · animal(동물 안고 운전). 방향지시등 없이 차로 변경(noSignalViolator), 실선 구간 변경은 위치로 판정.
      // 12대 중과실 소재: drunk(비틀거림) · overtake(우측 앞지르기) · sidewalk(보도 주행) · cargo(트럭 낙하물) · door(버스 문 열고 주행 = passenger). noLicense 는 정차 후 면허 조회에서만 드러난다.
      trait: opts.trait !== undefined ? opts.trait : (type === 'bus' ? (rng() < 0.12 ? 'door' : null) : type === 'truck' ? (rng() < 0.25 ? 'cargo' : null) : (rng() < 0.10 ? TG.pick(rng, ['phone', 'litter', 'animal', 'drunk', 'overtake', 'sidewalk']) : null)),
      noLicense: opts.noLicense !== undefined ? !!opts.noLicense : rng() < 0.04, weaveT: rng() * 6, swT: rng() * 20, cargoT: 8 + rng() * 12, doorT: 0, otBoost: 0,
      signal: null, signalT: 0, lcShift: 0, lcCd: 6 + rng() * 20, noSignalViolator: opts.noSignalViolator !== undefined ? opts.noSignalViolator : (violator && rng() < 0.6), traitT: rng() * 6, litterT: 6 + rng() * 10,
    };
    if (type !== 'bus' && type !== 'truck') car.busLaneViolator = opts.busLaneViolator !== undefined ? opts.busLaneViolator : TG.chance(rng, cfg.BUSLANE_VIOLATOR_RATE);
    if (type === 'bus') { car.cruise = cfg.AI_CRUISE_BUS * 0.5; car.laneIdx = 1; }
    // 거치대(내비게이션 지도) — 적법. 손에 든 휴대전화(phone 습관)와 가려 보게 한다
    // (소유자: 「거치대를 사용한다면 별문제가 없지만 스마트폰을 들고 문자나 카톡을 보거나 만진 경우에도 해당」)
    car.mount = opts.mount !== undefined ? !!opts.mount : (car.trait !== 'phone' && type !== 'bus' && type !== 'truck' && type !== 'moto' && type !== 'bike' && type !== 'pm' && rng() < 0.3);
    // 이륜차·자전거: 바깥 차로, 자전거는 느리게. 일부는 보도로 올라가 달린다(edgeRider → 이륜차 '보도 통행', 자전거 '보도 주행' 위반 소재)
    car.isMoto = type === 'moto'; car.isBike = type === 'bike'; car.isPM = type === 'pm';
    if (car.isMoto || car.isBike || car.isPM) {
      car.laneIdx = 1; car.trait = null; car.noSignalViolator = false;
      // 보도 통행은 드물게(대부분 차도 우측). 아래 두 줄이 주석에 먹혀 있어서 edgeOff·edgeT 가 undefined 였고,
      // 그 값이 계산에 섞여 이륜차·자전거·PM 의 heading 과 좌표가 NaN 이 됐다(차가 사라지거나 화면이 검게 나오던 원인).
      car.edgeRider = rng() < (car.isPM ? 0.26 : car.isBike ? 0.24 : 0.14);
      car.edgeOff = car.edgeRider ? 5.4 : 0;
      car.edgeT = rng() * 5;
      car.crossRider = (car.isBike || car.isPM) && rng() < 0.28;   // 일부만 타고 건넌다(위반) — 대부분은 내려서 끌고 걷는다(제13조의2 제6항)
      if (car.isBike) { car.cruise = 5.5; car.speedK = 0.6; car.violator = false; }
      else if (car.isPM) { car.cruise = 6.2; car.speedK = 0.7; car.violator = false; car.pmHelmet = rng() < 0.35; car.pmTwo = rng() < 0.22; car.pmT = rng() * 4; }   // 개인형 이동장치: 헬멧 착용 35%, 2인 탑승 22%
      else if (car.violator) car.pedViolator = false;
    }
    // 수배차량(절도·강도 등 중대 사건): 아주 드물게. 겉으로는 표시가 없고 무전 조회(📡)로만 드러난다 → 등급 A(적극 대응)
    car.wanted = opts.wanted !== undefined ? !!opts.wanted : (!car.isMoto && !car.isBike && !car.isPM && !car.isBus && rng() < 0.02);
    var twoW = car.isMoto || car.isBike || car.isPM;
    // 승용·소형 승합·픽업은 유리를 반투명으로 따로 그리고 운전자를 태운다 — 손에 든 휴대전화와 거치대를 밖에서 보고 가려야 한다
    var see = !twoW && type !== 'bus' && type !== 'truck';
    var mesh = new THREE.Mesh(TG.vehmesh.build(type, color, false, twoW ? { noRider: true, helmet: car.pmHelmet, two: car.pmTwo } : (see ? { noGlass: true } : null)), bodyMat); mesh.castShadow = true;
    var g = new THREE.Group(); g.rotation.order = 'YXZ'; g.add(mesh);
    if (see) {
      g.add(new THREE.Mesh(TG.vehmesh.glass(type), glassMat));
      var dv = new THREE.Mesh(TG.vehmesh.driver(type, car.trait === 'phone' ? 'phone' : 'wheel', TG.pick(rng, DRV_SHIRT), TG.pick(rng, DRV_SKIN), TG.pick(rng, DRV_HAIR)), bodyMat);
      g.add(dv); car.driverMesh = dv;
      var LY = TG.vehmesh.layout(T), EY = LY.eye;
      if (car.trait === 'phone') {          // 손에 든 휴대전화 — 고개를 숙이고 화면(말풍선)을 본다. 창 높이라 밖에서 보인다
        // 얼굴 앞(눈 12cm 아래 · 30cm 앞)에 들고 화면을 눈 쪽으로 기울인다 — 핸들 아래로 내리면 창 너머로 안 보인다
        var hp = new THREE.Group(); hp.position.set(EY.x - 0.04, EY.y - 0.12, EY.z + 0.30); hp.rotation.x = 0.4;
        hp.add(new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.19, 0.014), phoneBodyMat));   // 실제보다 조금 크게 — 창 너머로 알아봐야 한다
        var hs = new THREE.Mesh(new THREE.PlaneGeometry(0.09, 0.175), screenChatMat); hs.position.z = -0.009; hs.rotation.y = Math.PI; hp.add(hs);
        var hg = new THREE.Sprite(phoneGlowMat); hg.scale.set(0.34, 0.34, 1); hg.position.z = -0.03; hp.add(hg);
        g.add(hp); car.phoneMesh = hp; car.phoneY = hp.position.y;
      } else if (car.mount) {               // 거치대에 꽂은 휴대전화(지도 안내) — 앞유리 밑, 대시보드 위
        var mp = new THREE.Group(); mp.position.set(0.10, T.belt + 0.12, LY.wsBase - 0.22); mp.rotation.x = 0.2;
        var marm = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.10, 0.03), phoneBodyMat); marm.position.y = -0.08; mp.add(marm);
        mp.add(new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.09, 0.014), phoneBodyMat));
        var ms = new THREE.Mesh(new THREE.PlaneGeometry(0.145, 0.078), screenMapMat); ms.position.z = -0.009; ms.rotation.y = Math.PI; mp.add(ms);
        var mg = new THREE.Sprite(phoneGlowMat); mg.scale.set(0.30, 0.30, 1); mg.position.z = -0.03; mp.add(mg);
        g.add(mp); car.mountMesh = mp;
      }
    }
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
        rg.group.position.set(0, rideY, rideZ - rr * 0.42); car.rideY = rideY; car.rideZ = rideZ;
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
    if (car.trait === 'phone' && !see) { var ph = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.15, 0.09), phoneMat); ph.position.set(T.w * 0.30, T.belt + 0.30, T.l * 0.06); ph.rotation.z = 0.3; g.add(ph); }
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
        var nHW = self.terrain.laneOffsets(L.pts[0]).length;
        var isCargoT = type === 'truck' || type === 'pickup';
        var lvRoll = opts.laneViolator !== undefined ? !!opts.laneViolator : ((isBus || isCargoT) && !L.busLane && rng() < cfg.LANE_VIOLATOR_RATE);
        if (L.kind === 'highway') lane = (opts.lane !== undefined) ? opts.lane
          : (isBus || isCargoT) ? (L.busLane ? (isBus ? 0 : 1 + Math.floor(rng() * Math.max(1, nHW - 1))) : cargoLane({ laneViolator: lvRoll }, nHW))   // 지정차로(별표9) · 전용차로 있는 경부는 버스만 1차로
          : (rng() < cfg.BUSLANE_VIOLATOR_RATE && L.busLane ? 0 : 1 + Math.floor(rng() * 2));
        var offs = T.laneOffsets(p), off = offs[Math.min(lane, offs.length - 1)], x = p.x + p.rx * off * sgn, z = p.z + p.rz * off * sgn;
        if (pl && !opts.atLink) { var dist = Math.hypot(x - pl.pos.x, z - pl.pos.z); if (dist < cfg.SPAWN_MIN || dist > cfg.SPAWN_MAX * 3.2) continue; var pfl = pl.forward(), ahl = (x - pl.pos.x) * pfl[0] + (z - pl.pos.z) * pfl[1]; if (ahl > 0 && dist < 140 && Math.abs((x - pl.pos.x) * -pfl[1] + (z - pl.pos.z) * pfl[0]) < dist * 0.9) continue; }   // 플레이어 앞 시야(140m) 안에서 불쑥 나타나지 않게
        if (tooClose(x, z)) continue;
        car = makeCar(type, x, z, heading, { violator: opts.violator, straight: opts.straight, cruise: opts.cruise, busLaneViolator: lane === 0 && !isBus && !!L.busLane, stayRing: opts.stayRing, trait: opts.trait, noLicense: opts.noLicense, laneViolator: lvRoll, mount: opts.mount });
        car.route = { link: L, dirA: dirA, i: i, lane: lane, lanePrev: null };
        appendLink(car, 30);
        car.v = opts.v !== undefined ? opts.v : cruiseFor(car, p.kind) * 0.8;
        return car;
      }
      var gi = TG.irange(rng, 0, city.xs.length - 1), gj = TG.irange(rng, 0, city.zs.length - 1), d = TG.irange(rng, 0, 3);
      var N = city.nodes[gi][gj], N2 = city.nodeFrom(N, d);
      if (!N2 && !opts.at) continue;
      var laneIdx = opts.laneIdx !== undefined ? opts.laneIdx : TG.irange(rng, 0, city.lanesOf(city.roadOf(city.nodes[gi][gj], d).axis, city.roadOf(city.nodes[gi][gj], d).idx) - 1);
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
      car = makeCar(ctype, gx, gz, TG.DIR_HEADING[d], { violator: opts.violator, pedViolator: opts.pedViolator, straight: opts.straight, cruise: opts.cruise, wantsExit: opts.wantsExit, laneIdx: laneIdx, trait: opts.trait, noLicense: opts.noLicense, color: opts.color, mount: opts.mount });
      if (opts.at && opts.laneIdx === undefined) { var lf = city.laneFrame(gx, gz, TG.DIR_HEADING[d]); car.laneIdx = lf.lateral > 4 ? 1 : 0; }
      car.path.push(approachPoint(car, N2, d));
      car.lastNode = N2; car.lastDir = d;
      extend(car); extend(car);
      car.v = opts.v !== undefined ? opts.v : car.cruise * 0.8;
      return car;
    }
    return null;
  }
  // 내려서 끌기(자전거·PM 이 횡단보도를 건널 때): 탑승자를 기계 옆에 세우고 걷는 자세로 바꾼다. 다시 타면 원래 자세로.
  function setPush(car, on) {
    if (!car.riders || !car.riders.length || !!car.pushing === !!on) return;
    car.pushing = !!on;
    for (var pi = 0; pi < car.riders.length; pi++) {
      var rg = car.riders[pi];
      TG.Character.pose(rg, on ? 'stand' : (car.isPM ? 'stand' : 'ride'));
      if (on) rg.group.position.set(0.62, 0.02, -0.1 - pi * 0.45);                                  // 기계 왼쪽(차 국소 +x)에 서서 끌고 간다
      else rg.group.position.set(0, car.rideY || 0, (car.rideZ || 0) - pi * 0.42);
    }
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

  // ---------- 고장차량·교통사고 현장 ----------
  // mode 'incident' 인 차는 그 자리에 서서 비상등만 켠다. 삼각대(안전삼각대)·라바콘을 뒤에 놓는다.
  var incidentGroup = null;
  this.spawnIncident = function (kind, at) {
    var pl = self.player; if (!pl && !at) return null;
    var spot = at, node = null, d = 0;
    if (!spot) {   // 플레이어 앞 70~110m, 진행 방향 도로의 갓길
      var pf = pl.forward(), dd = 70 + rng() * 40, x = pl.pos.x + pf[0] * dd, z = pl.pos.z + pf[1] * dd;
      var fr = city.frameAt(x, z, pl.heading); if (fr.kind !== 'grid') return null;
      d = TG.headingToDir(pl.heading); var f = TG.DIR_VEC[d], r = [-f[1], f[0]];
      var rd = city.roadOf({ i: fr.idx, j: fr.idx, x: x, z: z }, d);
      var off = city.shoulderOff(fr.axis, fr.idx) - 0.6;
      spot = { x: fr.axis === 'v' ? fr.center + r[0] * off : x, z: fr.axis === 'h' ? fr.center + r[1] * off : z, heading: TG.DIR_HEADING[d] };
    }
    var made = [];
    function place(type, dx, dz, hd) {
      var c = makeCar(type, spot.x + dx, spot.z + dz, hd, { violator: false, straight: true, trait: null });
      c.mode = 'incident'; c.v = 0; c.cruise = 0; c.speedK = 0; c.path = []; c.route = null; c.lastNode = null;
      c.incident = { kind: kind, handled: false }; made.push(c); return c;
    }
    var hd0 = spot.heading || 0, fx = Math.sin(hd0), fz = Math.cos(hd0);
    if (kind === 'crash') { place('sedan', 0, 0, hd0); place('hatch', -fx * 5.4 * 0.9 + 0.9, -fz * 5.4 * 0.9 + 0.9, hd0 + 0.35); }
    else place(rng() < 0.3 ? 'truck' : 'sedan', 0, 0, hd0);
    // 안전삼각대 + 라바콘(뒤 10m·18m)
    if (!incidentGroup) { incidentGroup = new THREE.Group(); scene.add(incidentGroup); }
    var gb = new TG.GeoBuilder();
    gb.box(0, 0.42, 0, 0.72, 0.06, 0.05, 0xd7262b, {}); gb.box(-0.3, 0.24, 0, 0.06, 0.42, 0.05, 0xd7262b, { rotY: 0 }); gb.box(0.3, 0.24, 0, 0.06, 0.42, 0.05, 0xd7262b, {});
    gb.box(0, 0.03, 0, 0.8, 0.06, 0.2, 0xe8e8e8, {});
    var tri = new THREE.Mesh(gb.build(), bodyMat); tri.position.set(spot.x - fx * 11, 0, spot.z - fz * 11); tri.rotation.y = hd0; incidentGroup.add(tri);
    for (var k = 1; k <= 2; k++) {
      var cb = new TG.GeoBuilder(); cb.cylinder(0, 0, 0, 0.26, 0.06, 0.72, 8, 0xff7a00, true); cb.box(0, 0.02, 0, 0.5, 0.04, 0.5, 0x2a2e33, {}); cb.cylinder(0, 0.34, 0, 0.16, 0.13, 0.1, 8, 0xf2f2f2, false);
      var cone = new THREE.Mesh(cb.build(), bodyMat); cone.position.set(spot.x - fx * (5 + k * 7), 0, spot.z - fz * (5 + k * 7)); incidentGroup.add(cone);
    }
    made[0].incident.props = [tri];
    self.onEvent('incident', made[0]);
    return made[0];
  };
  this.clearIncidents = function () {
    for (var i = cars.length - 1; i >= 0; i--) if (cars[i].incident) remove(cars[i]);
    if (incidentGroup) { scene.remove(incidentGroup); incidentGroup = null; }
  };
  function drive(car, dt) {
    if (car.mode === 'incident') {   // 현장 차량: 비상등(양쪽 깜빡이)만 켜고 정지
      var on = ((self.time * 1.4) % 1) < 0.5;
      for (var bi3 = 0; bi3 < car.blinkL.length; bi3++) { car.blinkL[bi3].visible = on; car.blinkR[bi3].visible = on; }
      car.braking = true; car.brakeLamp.visible = true;
      return;
    }
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
    if (car.flee) {
      // 도주 운전: 2~4초 주기로 급가속과 급제동을 번갈아 한다(골목에서 특히 심하다).
      car.fleeT = (car.fleeT || 0) + dt;
      var narrow = !onLink && cur && (city.lanesOf(city.roadOf(car.lastNode || cur.node || city.nodes[0][0], car.lastDir || 0).axis, city.roadOf(car.lastNode || cur.node || city.nodes[0][0], car.lastDir || 0).idx) <= 2);
      var cyc = (car.fleeT % (narrow ? 2.6 : 3.8)) / (narrow ? 2.6 : 3.8);
      car.fleeBrake = cyc > 0.72;                       // 뒤쪽 28% 는 급제동
      target *= car.fleeBrake ? 0.45 : 1.75;
      car.fleeDust = (car.fleeDust || 0) - dt;
      if (self.vfx && car.fleeDust <= 0 && car.v > 3) {
        car.fleeDust = 0.09;
        var ff = forwardOf(car), rr = [-ff[1], ff[0]], back = car.len * 0.5 + 0.2;
        for (var ds = -1; ds <= 1; ds += 2) {           // 뒷바퀴 두 곳에서 흙먼지가 피어오른다(오래 남아 흔적이 된다)
          self.vfx.puff(car.pos.x - ff[0] * back + rr[0] * ds * car.wid * 0.42, 0.18,
                        car.pos.z - ff[1] * back + rr[1] * ds * car.wid * 0.42,
                        -ff[0] * 1.4 + (rng() - 0.5) * 1.2, 0.55 + rng() * 0.5, -ff[1] * 1.4 + (rng() - 0.5) * 1.2,
                        car.fleeBrake ? 3.4 : 2.4, car.fleeBrake ? 2.6 : 1.9);
        }
      }
    }

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
      // 멈출 자리는 **앞범퍼**로 잰다(distStop 은 차 중심 기준). 중심으로 재면 차 중심이 정지선 1.3m 앞에 서서
      // 버스(11m)는 앞머리가 횡단보도를 통째로 덮었고, 그 옆구리에 막힌 보행자와 서로 영원히 기다렸다(v0.9.45 검증에서 43~84초 교착).
      var dStopF = distStop - car.len / 2 + 0.8;
      car.cooldown -= dt;
      if (distStop > -0.5 && distStop < 60) {
        // 보호 좌회전 교차로에서 좌회전 차는 **좌회전 화살표**를 따른다(v0.9.49). 직진·우회전은 직진 신호.
        // 실측 현시가 있는 교차로는 그 접근로의 이동류 신호를 따른다(v0.9.50) — 서측 직좌 현시에 동측 차는 선다
        var axS = (ap.d === 0 || ap.d === 2) ? 'v' : 'h', st = signals.moveState(ap.node, ap.d, ap.maneuver === 'L' ? 'L' : 'S');
        if (!rightTurn && car.running !== ap.node && car.violator && car.cooldown <= 0 && st.s === 'red' && st.remain > 2.0 && distStop < 38 && car.mode === 'drive') {
          var lead0 = leadOf(car, fx, fz);
          if (!lead0 || lead0.along > distStop + 2) { car.running = ap.node; car.cooldown = cfg.VIOLATOR_COOLDOWN; }
        }
        if (rightTurn && st.s === 'red') {
          if (car.rorNode !== ap.node) {
            if (dStopF < 3 && car.v < 0.2) { car.rorT = (car.rorT || 0) + dt; if (car.rorT > 1.0) car.rorNode = ap.node; } else car.rorT = 0;
            // 우회전도 적색이면 정지선 앞에서 먼저 선다 — 평상 감속으로 넘치면 급제동한다(검증: 우회전 차가 정지선을 1.5~1.7m 넘어 섰다).
            // 적색이 켜진 순간 급제동으로도 정지선 앞에 못 서는 차는 직진과 같이 멈추지 않는다 — 세우면 횡단보도 위에 선다(검증: 1.3m).
            if (car.rorNode !== ap.node && car.v > 2 && dStopF - 0.3 < car.v * car.v / (2 * cfg.AI_EMERGENCY)) car.rorNode = ap.node;
            if (car.rorNode !== ap.node) { target = Math.min(target, stopProfile(dStopF, cfg.AI_DECEL)); if (dStopF - 1.3 < car.v * car.v / (2 * cfg.AI_DECEL)) emergency = true; }
          }
        } else if (car.running !== ap.node) {
          var canStop = dStopF > car.v * car.v / (2 * cfg.AI_DECEL * 1.25) + 1.5;
          // 적색이 켜진 순간 **급제동으로도 정지선 앞에 못 서는 차**는 멈추지 않고 교차로를 빠져나간다 — 세우면 횡단보도 한가운데 선다
          // (v0.9.46 검증: 적색에 선 차가 앞범퍼를 횡단보도에 걸치고 긴 적색 내내 서 있었다). 설 수는 있지만 평상 감속으로 넘치면 급제동한다.
          // 기준을 0.3m 로 잡는다(1.3m 로 잡으면 정지선에 천천히 다가가는 마지막 몇 m 에서 「못 선다」로 뒤집혀 적색에 들어갔다 — 검증에서 대기 표본이 10분의 1로 줄었다).
          var needD = car.v * car.v / 2, cantStop = car.v > 2 && dStopF - 0.3 < needD / cfg.AI_EMERGENCY;
          if ((st.s === 'red' && !cantStop) || (st.s === 'yellow' && canStop)) {
            target = Math.min(target, stopProfile(dStopF, cfg.AI_DECEL));
            if (dStopF - 1.3 < needD / cfg.AI_DECEL) emergency = true;
          }
        }
        // 경찰관의 수신호(꼬리 끊기)는 신호기보다 우선한다(도로교통법 제5조) — 녹색이어도 정지선 앞에 선다
        if (self.control && self.control.hand.length) {
          for (var hh = 0; hh < self.control.hand.length; hh++) {
            var H = self.control.hand[hh];
            if (H.node === ap.node && H.d === ap.d) target = Math.min(target, stopProfile(dStopF, cfg.AI_DECEL));
          }
        }
        // 임시 차단한 바깥 차로: 40m 앞에서 안쪽 차로로 옮긴다(라바콘 구간을 피한다)
        if (self.control && self.control.closed.length && distStop < 42 && distStop > 6 && car.mode === 'drive') {
          for (var cc = 0; cc < self.control.closed.length; cc++) {
            var Cl = self.control.closed[cc];
            if (Cl.node !== ap.node || Cl.d !== ap.d || car.laneIdx < Cl.lane) continue;
            var rdC = city.roadOf(ap.node, ap.d), tgtL = Math.max(0, Cl.lane - 1);
            car.lcShift += city.laneOff(rdC.axis, rdC.idx, tgtL) - city.laneOff(rdC.axis, rdC.idx, car.laneIdx);
            car.laneIdx = tgtL; car.signal = 'L'; car.signalT = 2;
          }
        }
        // 보호 좌회전 접근로의 1차로는 좌회전 전용 — 직진 차는 2차로로 옮긴다(좌회전 신호를 기다리는 차 뒤에 막히지 않게)
        if (ap.maneuver !== 'L' && car.laneIdx === 0 && distStop < 60 && distStop > 8 && car.mode === 'drive' && signals.hasLeftFor(ap.node, ap.d)) {
          var rdP = city.roadOf(ap.node, ap.d);
          if (city.lanesOf(rdP.axis, rdP.idx) >= 2) { car.lcShift += city.laneOff(rdP.axis, rdP.idx, 1) - city.laneOff(rdP.axis, rdP.idx, 0); car.laneIdx = 1; car.signal = 'R'; car.signalT = 2; }
        }
        // 보행자 보호 무시 성향: 횡단보도 앞 정지를 건너뛴다(정면 3m 급제동만)
        if (car.pedViolator && car.mode === 'drive' && distStop < 30 && car.cooldown <= 0) pedIgnore = true;
      }
      if (car.prevDistStop !== undefined && car.prevDistStop > 0 && distStop <= 0 && car.prevAp === ap) {
        var st2 = signals.moveState(ap.node, ap.d, ap.maneuver === 'L' ? 'L' : 'S');
        if (st2.s === 'red' && st2.elapsed > 0.6 && car.v > 1.5 && !rightTurn) { self.stats.violations++; flag(car, 'signal', ap.node, self.witness(car)); }
        car.running = null;
        // 횡단보도 진입 시 보행자가 걷고 있으면 보행자 보호의무 위반
        if (!car.violation && car.v > 1.5 && pedOnCrosswalk(ap)) { self.stats.violations++; flag(car, 'pedestrian', ap.node, self.witness(car)); car.cooldown = cfg.VIOLATOR_COOLDOWN; }
      }
      car.prevDistStop = distStop; car.prevAp = ap;
    } else { car.prevAp = null; car.prevDistStop = undefined; }
    // 전용차로·지정차로 판정은 **차가 실제로 달리는 링크(car.route.link)** 로 한다. 위치로 잡은 프레임(cur)은 램프가 본선 포장 안을 지날 때
    // 본선을 돌려준다 — 그러면 램프 위 0번 차로를 본선 1차로로 읽어 **준법 차량을 위반으로 기록**했다(v0.9.45 검증 2회차에서 잡힘).
    if (onLink && cur.kind === 'highway' && car.route && car.route.link && car.route.link.busLane && !car.route.merge && car.route.lane === 0 && !car.isBus && car.mode === 'drive') {
      if (self.witness(car)) { car.busLaneT += dt; if (car.busLaneT > cfg.BUSLANE_WITNESS_SEC && !car.violation) { self.stats.violations++; flag(car, 'buslane', null, true); } }
    } else car.busLaneT = 0;
    // 지정차로 위반: 버스전용차로가 없는 고속도로(올림픽대로·순환 본선)에서 화물·대형승합이 왼쪽 차로(편도 4차로면 1·2차로)로 달린다.
    // 경부고속도로(전용차로 있음)는 소유자 지시대로 판정하지 않는다.
    var RLn = car.route && car.route.link;
    if (onLink && RLn && RLn.kind === 'highway' && !RLn.busLane && !car.route.merge && (car.isCargo || car.isBus) && car.mode === 'drive' &&
        car.route.lane < minCargoLane(RLn.nLanes || (RLn.nLanes = self.terrain.laneOffsets(RLn.pts[0]).length))) {
      if (self.witness(car)) { car.laneT += dt; if (car.laneT > cfg.LANE_WITNESS_SEC && !car.violation) { self.stats.violations++; flag(car, 'lane', null, true); } }
    } else car.laneT = 0;
    // ---- 방향지시등·차로 변경·운전자 습관 ----
    car.lcCd -= dt; car.signalT -= dt;
    if (ap && (ap.maneuver === 'L' || ap.maneuver === 'R') && distStop > -2 && distStop < 40) car.signal = ap.maneuver;   // 교차로 회전 예고
    else if (car.signalT <= 0 && !(ap && (ap.maneuver === 'L' || ap.maneuver === 'R') && distStop < 40)) car.signal = null;
    if (car.prevApRef && car.prevApRef !== ap) car.lcShift = 0;   // 교차로를 지나면 새 경로가 새 차로에 있다
    car.prevApRef = ap;
    if (!onLink && car.mode === 'drive' && ap && distStop > 18 && distStop < 75 && car.lcCd <= 0 && car.v > 4 && !car.isBus && car.trait !== 'overtake' && (car.lcForce || rng() < dt * 0.35)) {   // 앞지르기 습관 차량은 추월할 때만 차로를 바꾼다
      car.lcForce = false;
      var rdL = city.roadOf(ap.node, ap.d), nL = city.lanesOf(rdL.axis, rdL.idx);
      if (nL >= 2) {
        var oldL = TG.clamp(car.laneIdx, 0, nL - 1), newL = oldL + (oldL === 0 ? 1 : oldL === nL - 1 ? -1 : (rng() < 0.5 ? -1 : 1));   // 옆 차로로만 한 칸
        var offOld = city.laneOff(rdL.axis, rdL.idx, oldL), offNew = city.laneOff(rdL.axis, rdL.idx, newL);
        car.laneIdx = newL; car.lcShift += offNew - offOld; car.lcCd = 14 + rng() * 22;
        if (car.noSignalViolator) { car.signal = null; self.stats.violations++; flag(car, 'nosignal', ap.node, self.witness(car)); }
        else { car.signal = newL > oldL ? 'R' : 'L'; car.signalT = 3; }
        if (distStop < 32) { self.stats.violations++; flag(car, 'solidline', ap.node, self.witness(car)); }   // 정지선 앞 실선 구간
      }
    }
    // 보도 주행 차량(sidewalk 습관): 30초마다 7초 동안 보도로 올라갔다 내려온다. 이륜차·자전거는 계속(edgeRider).
    if (car.trait === 'sidewalk' && !onLink && car.mode === 'drive' && !car.isMoto && !car.isBike) { car.swT += dt; var swOn = (car.swT % 30) < 7 && !(ap && distStop < 26 && distStop > -2); if (swOn && !car.edgeRider) { car.edgeRider = true; car.edgeT = 3; car.laneIdx = 1; } if (!swOn && car.edgeRider) car.edgeRider = false; car.edgeOff = 6.0; }
    // 보도 주행(edgeRider)의 옆 이동량은 도로 폭에 맞춘다 — 보도 중앙선까지. 고정값(5.4m)이면 8차로 도로에서는 바깥 차로에 있을 뿐 보도가 아니다.
    if (car.edgeRider && !onLink && ap && car.mode === 'drive') {
      var rdE = city.roadOf(ap.node, ap.d);
      car.edgeOff = city.sideOff(rdE.axis, rdE.idx) - city.laneOff(rdE.axis, rdE.idx, car.laneIdx || 0);
    }
    // 자전거·개인형 이동장치가 횡단보도로 도로를 횡단할 때에는 **내려서 끌거나 들고 보행**해야 한다(도로교통법 제13조의2 제6항).
    // 탄 채로 건너면 그 사람은 「자전거등의 운전자」여서 보행자가 아니다 — 통행방법 위반이고, 사고가 나도 12대 중과실(횡단보도 보행자 보호)이 성립하지 않는다.
    // (근거: 티북 v21.94 「자전거 타고 횡단보도」 카드 — 조문 인용. 판례가 아니라 조문이 정면으로 정한다.)
    if ((car.isBike || car.isPM) && car.edgeRider && !onLink && car.mode === 'drive') {
      // 경로점(ap)은 정지선을 지나면 다음 교차로로 넘어가 버린다 — 그래서 가까운 노드와 진행 방향으로 직접 잰다.
      var ndE = city.nodes[city.nearestIdx(city.xs, car.pos.x)][city.nearestIdx(city.zs, car.pos.z)];
      var dE = Math.abs(Math.sin(car.heading)) > Math.abs(Math.cos(car.heading)) ? (Math.sin(car.heading) > 0 ? 1 : 3) : (Math.cos(car.heading) > 0 ? 0 : 2);
      var fE2 = TG.DIR_VEC[dE], anE = (ndE.x - car.pos.x) * fE2[0] + (ndE.z - car.pos.z) * fE2[1];   // 노드까지(진행 방향)
      var bandE = city.crossHalf(ndE, dE) + 4.2, onCrossE = Math.abs(anE) <= bandE, nearE = anE > 0 && anE <= bandE + 10;
      if (nearE || onCrossE) {
        var walkE = signals.pedWalk(ndE, (dE === 0 || dE === 2) ? 'h' : 'v');   // 건너는 도로의 축(진행축의 반대)
        if (car.crossRider) {   // 타고 건너는 사람(위반)
          if (onCrossE && !car.violation) { self.stats.violations++; flag(car, 'bikeCross', ndE, self.witness(car)); }   // 이미 기록된 위반(보도 주행 등)은 덮지 않는다
        } else {                // 내려서 끌고 걷는 사람(정상)
          setPush(car, true);
          if (!onCrossE && !walkE) target = Math.min(target, stopProfile(Math.max(0, anE - bandE), cfg.AI_DECEL));   // 보행 신호를 기다린다
          else target = Math.min(target, 1.35);                                                                      // 끌고 걷는 속도
        }
      } else setPush(car, false);

    }
    if (car.pushing && car.riders) for (var pr = 0; pr < car.riders.length; pr++) TG.Character.animate(car.riders[pr], { speed: car.v, moving: car.v > 0.12 }, dt);
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
    // 휴대전화는 **주행 중에만** 쌓는다 — 「정지하고 있는 경우」는 문언상 예외다(§49①10 가목 · 티북: 신호대기 정지 중 사용은 예외, 주행 중 장면을 채증).
    if (car.trait === 'phone' || car.trait === 'animal') { if (car.trait !== 'phone' || car.v > 1.5) car.traitT += dt; if (car.traitT > 8 && self.witness(car) && (!car.violation || car.violation.type !== car.trait)) { self.stats.violations++; flag(car, car.trait, null, true); car.traitT = -25; } }
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
    // 앞 횡단보도에 사람이 있으면 **다 건널 때까지** 정지선 앞에 선다(제27조 보행자 보호).
    // 앞만 보는 판정(nearestAhead)으로는 옆 차로로 건너오는 사람을 놓친다.
    // 앞범퍼가 이미 정지선을 넘었거나 급제동으로도 못 서는 차는 여기서 세우지 않는다 — 세우면 횡단보도 위에 선다(바로 앞 사람은 아래 nearestAhead 가 막는다).
    if (!onLink && ap && ap.node && self.peds && self.peds.onCrossing && dStopF > -0.3 && dStopF < 70 && (car.v <= 2 || dStopF - 0.3 > car.v * car.v / (2 * cfg.AI_EMERGENCY)) && self.peds.onCrossing(ap.node, ap.d)) {
      target = Math.min(target, stopProfile(dStopF, cfg.AI_DECEL));
      if (dStopF - 1.3 < car.v * car.v / (2 * cfg.AI_DECEL)) emergency = true;
    }
    if (self.peds && !onLink) {
      // 사람까지 거리도 **앞범퍼**에서 잰다 — 중심에서 재면 긴 차일수록 사람을 차체 안에 두고 선다(앞범퍼 2m 앞에서 선다).
      var hlP = car.len / 2, pd = self.peds.nearestAhead(car.pos.x, car.pos.z, fx, fz, (pedIgnore ? 6 : 18) + hlP, pedIgnore ? 2.2 : 6.5);
      if (pd !== null) { pd -= hlP; target = Math.min(target, stopProfile(pd - 0.7, pedIgnore ? cfg.AI_EMERGENCY : cfg.AI_DECEL)); if (pd < 3.7) { emergency = true; if (car.v > 4 && !car.pedHorn && self.player && Math.hypot(car.pos.x - self.player.pos.x, car.pos.z - self.player.pos.z) < 50) { car.pedHorn = true; TG.audio.horn(false); } } else car.pedHorn = false; }   // 급제동 경적
    }
    var lead = leadOf(car, fx, fz);
    // 우측 앞지르기(overtake 습관): 느린 앞차 뒤에서 바깥(우측) 차로로 빠져 속도를 올려 추월한다 → 「앞지르기 위반」(앞지르기는 좌측으로)
    if (car.trait === 'overtake' && !onLink && car.mode === 'drive' && car.laneIdx === 0 && car.lcCd <= 0 && lead && lead.along < 24 && lead.v < car.cruise - 2 && car.v > 3 && ap && distStop > 20) {
      var rdO = city.roadOf(ap.node, ap.d);
      var nO = city.lanesOf(rdO.axis, rdO.idx), oL = TG.clamp(car.laneIdx, 0, nO - 1);
      if (nO >= 2 && oL < nO - 1) { car.laneIdx = oL + 1; car.lcShift += city.laneOff(rdO.axis, rdO.idx, oL + 1) - city.laneOff(rdO.axis, rdO.idx, oL); car.signal = 'R'; car.signalT = 2; car.lcCd = 25 + rng() * 20; car.cruise *= 1.35; car.otBoost = 7; lead = null; self.stats.violations++; flag(car, 'overtake', ap.node, self.witness(car)); }
    }
    if (car.otBoost > 0) { car.otBoost -= dt; if (car.otBoost <= 0) car.cruise /= 1.35; }
    // 철길건널목: 차단기가 내려오면 정지선 앞에 선다. 위반 성향 차량 일부는 그대로 통과 → 「건널목 위반」
    if (self.rail) {
      var rr = self.rail.approach(car, onLink ? cur : null);
      if (rr) {
        if (rr.closed && rr.dist > 0 && !car.railRun) target = Math.min(target, stopProfile(rr.dist - 1.5, cfg.AI_DECEL));
        if (rr.closed && rr.dist > 0 && rr.dist < 30 && car.railRun === undefined) car.railRun = car.violator && rng() < 0.35;
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
      var yh = car.y === undefined ? (car.ap ? car.ap.y : 0) : car.y;
      var yA = self.terrain.heightAt(car.pos.x + fx3 * 2, car.pos.z + fz3 * 2, yh), yB = self.terrain.heightAt(car.pos.x - fx3 * 2, car.pos.z - fz3 * 2, yh);
      car.y = (yA + yB) / 2; car.pitch = -Math.atan2(yA - yB, 4);
    } else { car.y = 0; car.pitch = 0; }
    car.mesh.position.set(car.pos.x, car.y, car.pos.z); car.mesh.rotation.set(car.pitch, car.heading, 0);
    // 운전자·휴대전화는 가까운 차(90m)만 그린다. 손에 든 폰은 조금씩 오르내린다(화면을 만지는 손)
    if (car.driverMesh && self.player) {
      var ddx = car.pos.x - self.player.pos.x, ddz = car.pos.z - self.player.pos.z, nearD = ddx * ddx + ddz * ddz < 90 * 90;
      car.driverMesh.visible = nearD;
      if (car.phoneMesh) { car.phoneMesh.visible = nearD; car.phoneMesh.position.y = car.phoneY + Math.sin(self.time * 2.3 + car.id) * 0.012; }
      if (car.mountMesh) car.mountMesh.visible = nearD;
    }
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
      var c = cars[k]; if (c.mode !== 'drive' || c.violation || c.incident || c.chase) continue;   // 추격 대상은 멀어도 지우지 않는다
      var far = city.frameAt(pl.pos.x, pl.pos.z, pl.heading).kind === 'link' ? cfg.DESPAWN * 3.0 : cfg.DESPAWN;   // 링크(고속도로)에서는 멀리까지 남겨 둔다 — 달리다 차가 사라지지 않게
      var ddp = Math.hypot(c.pos.x - pl.pos.x, c.pos.z - pl.pos.z), pfd = pl.forward(), inView = (c.pos.x - pl.pos.x) * pfd[0] + (c.pos.z - pl.pos.z) * pfd[1] > 0;
      if (ddp > far && (!inView || ddp > far * 1.8)) remove(c);   // 시야 앞의 차는 훨씬 멀어질 때까지 남긴다(눈앞에서 사라지지 않게)
      else if (!c.route && !c.lastNode) remove(c);
    }
  };
  // 좌표가 NaN 이 된 차는 즉시 치운다 — 한 대만 있어도 접촉 판정을 타고 플레이어까지 번진다
  this.sweepNaN = function () {
    for (var i = cars.length - 1; i >= 0; i--) {
      var c = cars[i];
      if (!isFinite(c.pos.x) || !isFinite(c.pos.z) || !isFinite(c.v) || !isFinite(c.heading)) remove(c);
    }
  };
  this.separate = function () {
    self.sweepNaN();
    for (var i = 0; i < cars.length; i++) for (var j = i + 1; j < cars.length; j++) {
      var a = cars[i], b = cars[j], dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z, rr = a.radius + b.radius, d2 = dx * dx + dz * dz;
      if (!(d2 < rr * rr) || !(d2 >= 1e-6)) continue;   // NaN 방어(위와 같은 이유)
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
