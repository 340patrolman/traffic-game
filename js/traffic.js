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

  var CITY_TYPES = ['sedan', 'sedan', 'sedan', 'hatch', 'hatch', 'suv', 'suv', 'van', 'truck', 'bus'];
  var HW_TYPES = ['sedan', 'sedan', 'sedan', 'suv', 'suv', 'hatch', 'van', 'truck', 'truck', 'bus', 'bus'];
  var COLORS = { sedan: [0xc94d43, 0x3e6bb0, 0x9aa3ad, 0x2f3438, 0xe6e2d8, 0x6b8f5a, 0xb08a3e, 0x7d5a96],
                 hatch: [0xd77a3a, 0x5c8bd6, 0xbfb8aa, 0x7d5a96, 0xd9d34f, 0x2f3438],
                 suv: [0x2f3438, 0xdcdcd4, 0x4a6e8a, 0x6d4f3a, 0x3e6bb0, 0x8e9aa6],
                 van: [0xdcdcd4, 0x4a6e8a, 0x9a4a3a, 0xe6e2d8], truck: [0x6e4a2f, 0x3b4a58, 0x7a2e2a, 0x2f6fd6], bus: [0x2f6fd6, 0x2ea043, 0xd7262b, 0x1f4fa8] };
  var bodyMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  var brakeMat = new THREE.MeshBasicMaterial({ color: 0xff2a1a });
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
    if (exit && !car.isBus) opts.push(['X', 0.5]);
    if (city.nodeFrom(N, (d + 3) % 4) && (!car || car.laneIdx === 1 || city.lanesOf(city.roadOf(N, d).axis, city.roadOf(N, d).idx) === 1)) opts.push(['R', 0.28]);  // 4차로에서는 바깥 차로만 우회전
    if (city.nodeFrom(N, (d + 1) % 4)) opts.push(['L', opts.length ? 0.0 : 1]);
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
    };
    if (type !== 'bus' && type !== 'truck') car.busLaneViolator = opts.busLaneViolator !== undefined ? opts.busLaneViolator : TG.chance(rng, cfg.BUSLANE_VIOLATOR_RATE);
    if (type === 'bus') { car.cruise = cfg.AI_CRUISE_BUS * 0.5; car.laneIdx = 1; }
    var mesh = new THREE.Mesh(TG.vehmesh.build(type, color, false), bodyMat); mesh.castShadow = true;
    var g = new THREE.Group(); g.rotation.order = 'YXZ'; g.add(mesh);
    var bl = new THREE.Mesh(new THREE.BoxGeometry(T.w * 0.8, 0.14, 0.06), brakeMat); bl.position.set(0, T.pts[1][1] * 0.82 + 0.08, -T.l / 2 - 0.03); bl.visible = false; g.add(bl); car.brakeLamp = bl;
    var sp = new THREE.Sprite(markerMat); sp.scale.set(1.6, 1.6, 1); sp.position.set(0, (T.bus ? 4.2 : 3.2), 0); sp.visible = false; g.add(sp); car.marker = sp;
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
        else { L = TG.pick(rng, [T.ring, T.ring, T.ring, T.connE, T.connN]); i = Math.floor(rng() * L.N); dirA = L.oneWay ? true : rng() < 0.5; if (!L.closed && (i < 12 || i > L.N - 14)) continue; }
        var p = L.P(i), type = opts.type || TG.pick(rng, L.kind === 'highway' ? HW_TYPES : CITY_TYPES);
        var lane = 0, sgn = dirA ? 1 : -1, heading = Math.atan2(p.tx * sgn, p.tz * sgn), isBus = type === 'bus';
        if (L.kind === 'highway') lane = (opts.lane !== undefined) ? opts.lane : (isBus ? 0 : (rng() < cfg.BUSLANE_VIOLATOR_RATE && type !== 'truck' ? 0 : 1 + Math.floor(rng() * 2)));
        var offs = T.laneOffsets(p), off = offs[Math.min(lane, offs.length - 1)], x = p.x + p.rx * off * sgn, z = p.z + p.rz * off * sgn;
        if (pl && !opts.atLink) { var dist = Math.hypot(x - pl.pos.x, z - pl.pos.z); if (dist < cfg.SPAWN_MIN || dist > cfg.SPAWN_MAX * 1.6) continue; }
        if (tooClose(x, z)) continue;
        car = makeCar(type, x, z, heading, { violator: opts.violator, straight: opts.straight, cruise: opts.cruise, busLaneViolator: lane === 0 && !isBus, stayRing: opts.stayRing });
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
      car = makeCar(ctype, gx, gz, TG.DIR_HEADING[d], { violator: opts.violator, pedViolator: opts.pedViolator, straight: opts.straight, cruise: opts.cruise, wantsExit: opts.wantsExit, laneIdx: laneIdx });
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
    for (var i = 0; i < P.peds.length; i++) {
      var p = P.peds[i], dx = p.pos.x - node.x, dz = p.pos.z - node.z, along = dx * f[0] + dz * f[1], lat = dx * r[0] + dz * r[1];
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
        if (st2.s === 'red' && st2.elapsed > 0.6 && car.v > 1.5 && !rightTurn) { self.stats.violations++; if (self.witness(car)) flag(car, 'signal', ap.node); else car.unseen++; }
        car.running = null;
        // 횡단보도 진입 시 보행자가 걷고 있으면 보행자 보호의무 위반
        if (!car.violation && car.v > 1.5 && pedOnCrosswalk(ap)) { self.stats.violations++; if (self.witness(car)) flag(car, 'pedestrian', ap.node); else car.unseen++; car.cooldown = cfg.VIOLATOR_COOLDOWN; }
      }
      car.prevDistStop = distStop; car.prevAp = ap;
    } else { car.prevAp = null; car.prevDistStop = undefined; }
    if (onLink && cur.kind === 'highway' && car.route && car.route.lane === 0 && !car.isBus && car.mode === 'drive') {
      if (self.witness(car)) { car.busLaneT += dt; if (car.busLaneT > cfg.BUSLANE_WITNESS_SEC && !car.violation) { self.stats.violations++; flag(car, 'buslane', null); } }
    } else car.busLaneT = 0;
    if (self.peds && !onLink) {
      var pd = self.peds.nearestAhead(car.pos.x, car.pos.z, fx, fz, pedIgnore ? 6 : 18, pedIgnore ? 2.2 : 6.5);
      if (pd !== null) { target = Math.min(target, stopProfile(pd - 2.5, pedIgnore ? cfg.AI_EMERGENCY : cfg.AI_DECEL)); if (pd < 6) emergency = true; }
    }
    var lead = leadOf(car, fx, fz);
    if (lead) {
      var gap = lead.along - (car.len / 2 + lead.len / 2), want = 2.5 + car.v * cfg.AI_FOLLOW_SEC;
      if (gap < want) target = Math.min(target, Math.max(0, lead.v - (want - gap) * 0.9));
      if (gap < 1.5) { target = 0; emergency = true; }
    }
    if (car.route && car.route.merge && car.route.blend < 0.6) {
      for (var mi = 0; mi < cars.length; mi++) { var o2 = cars[mi]; if (o2 === car) continue; var ddx = o2.pos.x - car.pos.x, ddz = o2.pos.z - car.pos.z; if (ddx * ddx + ddz * ddz < 14 * 14 && (ddx * fx + ddz * fz) < 0 && Math.abs(ddx * rx + ddz * rz) < 5) target = Math.min(target, 4); }
    }
    // 정차 유도: 갓길로 옮기고, 교차로·횡단보도 밖에서 선다
    var extraT = 0;
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
    if (car.violation) {
      car.marker.position.y = (car.isBus ? 4.2 : 3.2) + Math.sin(self.time * 4) * 0.2;
      if (self.time - car.violation.t > cfg.VIOLATION_MEMORY && car.mode === 'drive') { car.violation = null; car.marker.visible = false; }
    }
  }
  function flag(car, type, node) { car.violation = { type: type, t: self.time, node: node }; car.marker.visible = true; self.stats.witnessed++; self.onEvent('witness', car); }
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
    var pl = self.player;
    if (pl) for (var k = cars.length - 1; k >= 0; k--) {
      var c = cars[k]; if (c.mode !== 'drive' || c.violation) continue;
      var far = city.frameAt(pl.pos.x, pl.pos.z, pl.heading).kind === 'link' ? cfg.DESPAWN * 1.7 : cfg.DESPAWN;
      if (Math.hypot(c.pos.x - pl.pos.x, c.pos.z - pl.pos.z) > far) remove(c);
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
