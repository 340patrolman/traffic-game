// 🚌 중앙버스전용차로 · 중앙 정류장(v0.10.68)
//  소유자 2026-09-29: 「신반포로 고속버스터미널 중앙버스전용차로 및 정류장 · 강남대로 양재역 부근 서초구민회관 앞 버스중앙차로 및 정류장 ·
//   동작대로도 구현」 · 「사고가 잦았던 곳으로 게임 속에서 시뮬레이션 — 버스 이용객 · 횡단보도 이용 행인 많은 · 버스와 인파 · 사망사고가 잦았던 곳」.
//  자료(지도 항목 brt · 서초구 1:1 에만):
//   · 구간 = OpenStreetMap highway=busway(2026-09-29 Overpass) 를 고무판 변환으로 격자에 옮긴 범위(강남대로 전 구간 · 동작대로 정금마을~ · 신반포로 구반포~반포역)
//   · 승강장 = 서울시 버스정류소 위치(버스노선별 정류장별 승하차 2026.6) 중 OSM 버스차로 25m 안 · 방향은 원자료 좌표가 도로 어느 반쪽인지로
//   · 실제로 서는 노선 수 = 서울시 버스도착정보조회(getLowArrInfoByStId · 2026-09-29 08:44) — 승하차 자료에는 경기 면허 노선이 없다(T-Book 분석 ④-4)
//  T-Book 「서울 중앙버스전용차로 정류장 402곳 · 8년」: 위험을 가른 것은 이용객 수(p=0.27)가 아니라 **실제로 서는 노선 수**, 특히 광역·직행좌석(p=0.0015),
//   그리고 위험은 타고 내리는 순간이 아니라 **정류장으로 가는 동선**(보행노인 사망 73.1% 가 차도 위). 이 모듈은 그 두 가지를 장면으로 만든다 —
//   노선이 많은 정류장일수록 버스가 몰려 서고(줄줄이 정차), 버스를 쫓아 차도로 뛰어드는 사람이 잦다. 인과를 주장하지 않는다(분석이 스스로 밝힌 한계).
//  배치: 한국 버스는 오른쪽 문이라 승강장은 **버스 진행 방향 오른쪽** — [일반 차로][승강장][버스 1차로 | 중앙선 | 버스 1차로][승강장][일반 차로].
//   방향마다 승강장이 엇갈려 선다. 게임 격자는 도로 폭이 고정이라 승강장이 2차로 안쪽 1.9m 를 차지한다 — 그 앞뒤에서 2차로 차는 옆으로 비킨다(traffic.js).
TG.Brt = function (G, city, cfg, scene) {
  var self = this, B = city.brt || null;
  self.on = !!(B && B.lanes && B.lanes.length);
  self.stations = [];
  self.stats = { buses: 0, rushers: 0, crowd: 0, boards: 0, bumps: 0 };
  if (!self.on) { self.update = function () {}; self.stationNear = function () { return null; }; return; }
  var L = cfg.BRT_PLAT_LEN || 30, W = 1.9, LAT = 3.9 + W / 2;   // 승강장 길이·폭·중앙선에서 승강장 가운데까지
  var rng = TG.makeRNG(4077);
  function sgnOf(d) { return (d === 0 || d === 1) ? 1 : -1; }          // 진행 방향이 격자 좌표를 키우는가
  function rightOf(d) { var f = TG.DIR_VEC[d]; return [-f[1], f[0]]; }
  function pt(axis, idx, s, lat) { return axis === 'v' ? [city.xs[idx] + lat, s] : [s, city.zs[idx] + lat]; }
  (city.brt.stations || []).forEach(function (S, k) {
    var r = rightOf(S.d), latS = (S.axis === 'v' ? r[0] : r[1]) * LAT;   // 승강장 가운데의 부호 있는 가로 좌표(도로 중심 기준)
    var c = pt(S.axis, S.idx, S.s, latS);
    self.stations.push({ key: 'st' + k, name: S.name, id: S.id, ars: S.ars, axis: S.axis, idx: S.idx, d: S.d, s: S.s, lat: latS, x: c[0], z: c[1],
      routes: S.routes || 0, wide: S.wide || 0, day: S.day || 0, len: L, fatal: S.fatal || null, dwell: null });
  });
  city.brtStations = self.stations;   // traffic.js(정차·비킴)가 읽는다

  // ---------- 그림: 청색 실선은 world.js(차선과 같은 자리) · 여기서는 승강장·붉은 포장·「버스전용」 글자 ----------
  var gb = new TG.GeoBuilder(), paint = new TG.GeoBuilder(), glass = new TG.GeoBuilder(), signs = new TG.GeoBuilder();
  self.stations.forEach(function (S) {
    var base = S.axis === 'v' ? city.xs[S.idx] : city.zs[S.idx], sg = S.lat > 0 ? 1 : -1;
    function put(b, along0, along1, lat0, lat1, y0, y1, col) {   // along·lat 범위로 상자 하나
      var sm = S.s + (along0 + along1) / 2, lm = base + (lat0 + lat1) / 2, a = Math.abs(along1 - along0), c2 = Math.abs(lat1 - lat0);
      if (S.axis === 'v') b.box(lm, (y0 + y1) / 2, sm, c2, y1 - y0, a, col, {}); else b.box(sm, (y0 + y1) / 2, lm, a, y1 - y0, c2, col, {});
    }
    var li = S.lat - sg * W / 2, lo = S.lat + sg * W / 2;   // 버스 쪽 끝 · 일반 차로 쪽 끝
    put(gb, -L / 2, L / 2, li, lo, 0.02, 0.26, 0xc9c6bd);                                           // 승강장 바닥(연석 높이)
    put(gb, -L / 2, L / 2, li - sg * 0.02, li + sg * 0.25, 0.26, 0.29, 0xf2c200);                  // 버스 쪽 끝 노란 점자·경계
    for (var a = -L / 2 + 3; a <= L / 2 - 3; a += 6) put(gb, a - 0.06, a + 0.06, S.lat - 0.06, S.lat + 0.06, 0.26, 2.95, 0x4a5563);   // 기둥
    put(gb, -L / 2 + 2, L / 2 - 2, li + sg * 0.1, lo + sg * 0.25, 2.95, 3.08, 0x2f5fa8);           // 지붕(파란 차양)
    put(glass, -L / 2 + 2, L / 2 - 4, lo - sg * 0.08, lo, 0.35, 1.9, 0x9fc4d8);                    // 차도 쪽 유리 난간 — 끝 4m 는 비운다(출입구: 횡단보도 쪽)
    put(gb, -L / 2 + 2, L / 2 - 4, lo - sg * 0.08, lo, 1.9, 1.98, 0x6b7785);
    // 붉은 포장: 승강장 앞뒤 버스 1차로(서울 중앙차로 정류장 구간) — 진행 방향 오른쪽 1차로(0.25~3.75)
    var s0 = -L / 2 - 18, s1 = L / 2 + 10; if (sgnOf(S.d) < 0) { var t = s0; s0 = -s1; s1 = -t; }
    var pl0 = sg * 0.3, pl1 = sg * 3.7, sm2 = S.s + (s0 + s1) / 2, lm2 = base + (pl0 + pl1) / 2;
    if (S.axis === 'v') paint.rect(lm2, sm2, Math.abs(pl1 - pl0), s1 - s0, 0, 0.062, 0xa8453a); else paint.rect(sm2, lm2, s1 - s0, Math.abs(pl1 - pl0), 0, 0.062, 0xa8453a);
    // 이름판(지붕 위) · 버스 표지
    var nb = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(9, 1.2 + S.name.length * 0.62), 0.9), new THREE.MeshBasicMaterial({ map: TG.tex.label(S.name, '#ffffff'), transparent: true, side: THREE.DoubleSide }));
    var bk = new THREE.Mesh(new THREE.BoxGeometry(Math.min(9.4, 1.6 + S.name.length * 0.62), 1.1, 0.12), new THREE.MeshLambertMaterial({ color: 0x1f3f7a }));
    var ps = pt(S.axis, S.idx, S.s, S.lat), rot = S.axis === 'v' ? Math.PI / 2 : 0;
    bk.position.set(ps[0], 3.75, ps[1]); bk.rotation.y = rot; nb.position.copy(bk.position); nb.rotation.y = rot;
    var nb2 = nb.clone(); nb2.rotation.y = rot + Math.PI;
    var off = 0.07; if (S.axis === 'v') { nb.position.x += off; nb2.position.x -= off; } else { nb.position.z += off; nb2.position.z -= off; }
    put(gb, -0.1, 0.1, S.lat - 0.1, S.lat + 0.1, 3.08, 3.3, 0x4a5563);
    [bk, nb, nb2].forEach(function (m) { m.matrixAutoUpdate = false; m.updateMatrix(); scene.add(m); });
  });
  // 「버스전용」 노면 글자: 구간마다 약 160m 간격, 그 방향 1차로 가운데
  var texts = new TG.GeoBuilder(), NT = 0;
  B.lanes.forEach(function (Ln) {
    [Ln.axis === 'v' ? 0 : 1, Ln.axis === 'v' ? 2 : 3].forEach(function (d) {
      var r = rightOf(d), lat = (Ln.axis === 'v' ? r[0] : r[1]) * 2.0, nodes = Ln.axis === 'v' ? city.zs : city.xs;
      for (var s = Ln.s0 + 60; s < Ln.s1 - 40; s += 160) {
        var near = false; nodes.forEach(function (nc) { if (Math.abs(nc - s) < 45) near = true; });
        self.stations.forEach(function (S) { if (S.axis === Ln.axis && S.idx === Ln.idx && Math.abs(S.s - s) < L) near = true; });
        if (near) continue;
        var p = pt(Ln.axis, Ln.idx, s, lat), n = 4, rotT = TG.DIR_HEADING[d];
        texts.rect(p[0] + Math.sin(rotT) * n * 1.2, p[1] + Math.cos(rotT) * n * 1.2, 2.0, n * 2.4, rotT + Math.PI, 0.075, 0xffffff); NT++;
      }
    });
  });
  function add(geo, mat) { var m = new THREE.Mesh(geo, mat); m.matrixAutoUpdate = false; m.updateMatrix(); m.receiveShadow = true; scene.add(m); return m; }
  add(gb.build(), new THREE.MeshLambertMaterial({ vertexColors: true }));
  add(glass.build(), new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 0.45 }));
  add(paint.build(), new THREE.MeshBasicMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
  if (NT) add(texts.build(), new THREE.MeshBasicMaterial({ map: TG.tex.roadText('버스전용'), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  self.textCount = NT;

  // ---------- 질의 ----------
  function along(axis, x, z) { return axis === 'v' ? z : x; }
  function latOf(S, x, z) { return (S.axis === 'v' ? x - city.xs[S.idx] : z - city.zs[S.idx]); }
  self.stationNear = function (x, z, max) {
    var best = null;
    self.stations.forEach(function (S) { var dd = Math.hypot(S.x - x, S.z - z); if (dd <= (max || 250) && (!best || dd < best.dist)) best = { st: S, dist: dd }; });
    return best;
  };
  self.byKey = function (k) { for (var i = 0; i < self.stations.length; i++) if (self.stations[i].key === k) return self.stations[i]; return null; };

  // ---------- 버스: 노선 수만큼 몰려온다 ----------
  var acc = {};
  function nodeBehind(axis, idx, d, s) {   // 이 자리에서 진행 방향으로 볼 때 뒤에 있는 교차로
    var arr = axis === 'v' ? city.zs : city.xs, sg = sgnOf(d), best = -1;
    for (var k = 0; k < arr.length; k++) { var ok = sg > 0 ? arr[k] <= s - 30 : arr[k] >= s + 30; if (ok && (best < 0 || (sg > 0 ? arr[k] > arr[best] : arr[k] < arr[best]))) best = k; }
    if (best < 0) return null;
    return axis === 'v' ? city.nodes[idx][best] : city.nodes[best][idx];
  }
  function routesOf(axis, idx, d) { var n = 0, sum = 0; self.stations.forEach(function (S) { if (S.axis === axis && S.idx === idx && S.d === d) { n++; sum += S.routes; } }); return n ? sum / n : 12; }
  self.spawnBus = function (axis, idx, d, s, v) {
    var tr = G.traffic; if (!tr) return null;
    var nd = nodeBehind(axis, idx, d, s); if (!nd) return null;
    var r = rightOf(d), p = pt(axis, idx, s, (axis === 'v' ? r[0] : r[1]) * cfg.LANE_OFF);
    if (city.inIntersection && city.inIntersection(p[0], p[1])) return null;
    var c = tr.spawn({ at: { x: p[0], z: p[1], d: d, node: nd }, type: 'bus', laneIdx: 0, v: v !== undefined ? v : 7, straight: true, violator: false });
    if (c) { c.brtBus = true; c.laneIdx = 0; self.stats.buses++; }
    return c;
  };
  function busesNear(axis, idx, d, pl, R) {
    var n = 0, cars = G.traffic ? G.traffic.cars : [];
    for (var i = 0; i < cars.length; i++) { var c = cars[i]; if (!c.isBus || !c.brtLane || c.brtLane.axis !== axis || c.brtLane.idx !== idx || c.brtDir !== d) continue; if (Math.hypot(c.pos.x - pl.pos.x, c.pos.z - pl.pos.z) < R) n++; }
    return n;
  }
  // ---------- 사람: 승강장에서 기다리고, 버스를 쫓아 차도로 뛰어든다 ----------
  function platPeds(S) { var n = 0, ps = G.peds ? G.peds.peds : []; for (var i = 0; i < ps.length; i++) if (ps[i].brt && ps[i].brt.key === S.key) n++; return n; }
  self.addCrowd = function (S) {
    var P = G.peds; if (!P) return null;
    var sg = S.lat > 0 ? 1 : -1, a = S.s + (rng() - 0.5) * (L - 6), lat = S.lat + (rng() - 0.5) * 0.8;
    var q = pt(S.axis, S.idx, a, lat), dAlong = S.d;
    var p = P.spawn({ at: { x: q[0], z: q[1], axis: S.axis, idx: S.idx, coord: S.axis === 'v' ? city.xs[S.idx] : city.zs[S.idx], side: sg, d: dAlong }, jaywalker: false });
    if (!p) return null;
    p.state = 'plat'; p.brt = { key: S.key, lat: lat, crowd: true }; p.platT = 0; self.stats.crowd++;
    return p;
  };
  // 뛰어드는 사람: 같은 쪽 보도에서(대개) 또는 건너편 보도에서(드물게 — 버스 두 차로를 다 건넌다)
  self.rush = function (S, opts) {
    var P = G.peds; if (!P) return null; opts = opts || {};
    var sg = S.lat > 0 ? 1 : -1, far = opts.far !== undefined ? !!opts.far : rng() < 0.25, side = far ? -sg : sg;
    var a = opts.along !== undefined ? opts.along : S.s + (rng() - 0.5) * (L + 24);
    var coord = S.axis === 'v' ? city.xs[S.idx] : city.zs[S.idx], so = city.sideOff(S.axis, S.idx), q = pt(S.axis, S.idx, a, side * so);
    var p = P.spawn({ at: { x: q[0], z: q[1], axis: S.axis, idx: S.idx, coord: coord, side: side, d: S.d }, jaywalker: false });
    if (!p) return null;
    p.jayD = p.d; p.d = S.axis === 'v' ? (side > 0 ? 3 : 1) : (side > 0 ? 2 : 0);
    p.state = 'jaywalk'; p.jayLive = true; p.jayDone = true; p.jayT = 0; p.jayKind = 'mid'; p.speed = opts.speed || (2.3 + rng() * 0.9);
    p.brt = { key: S.key, lat: S.lat + (rng() - 0.5) * 0.6, dir: -side, rusher: true, far: far, a0: S.s - L / 2, a1: S.s + L / 2 };
    self.stats.rushers++;
    if (P.onEvent) P.onEvent('jaywalk', p);
    return p;
  };

  // ---------- 매 프레임 ----------
  var crowdT = 0, later = [];
  self.later = function (sec, fn) { later.push({ t: sec, fn: fn }); };   // 체험 장면이 몇 초 뒤 일을 건다(게임 시간)
  self.clearLater = function () { later.length = 0; };
  self.update = function (dt, pl) {
    for (var li = later.length - 1; li >= 0; li--) { later[li].t -= dt; if (later[li].t <= 0) { var fnL = later[li].fn; later.splice(li, 1); try { fnL(); } catch (e) {} } }
    if (!pl) return;
    var tr = G.traffic, P = G.peds;
    // ① 버스: 플레이어 둘레 구간에 노선 수만큼(시간당 노선 × 4대 · 400m 안 방향마다 최대 6대)
    B.lanes.forEach(function (Ln) {
      var sP = along(Ln.axis, pl.pos.x, pl.pos.z), latP = Ln.axis === 'v' ? pl.pos.x - city.xs[Ln.idx] : pl.pos.z - city.zs[Ln.idx];
      if (Math.abs(latP) > 450 || sP < Ln.s0 - 300 || sP > Ln.s1 + 300) return;
      [Ln.axis === 'v' ? 0 : 1, Ln.axis === 'v' ? 2 : 3].forEach(function (d) {
        var k = Ln.axis + Ln.idx + d; acc[k] = (acc[k] || 0) + dt * routesOf(Ln.axis, Ln.idx, d) * 4 / 3600 * (cfg.BRT_BUS_K || 1);
        if (acc[k] < 1) return;
        acc[k] = 0;
        if (busesNear(Ln.axis, Ln.idx, d, pl, 420) >= 6) return;
        var s = sP - sgnOf(d) * (170 + rng() * 90);
        if (s < Ln.s0 + 10 || s > Ln.s1 - 10) return;
        self.spawnBus(Ln.axis, Ln.idx, d, s);
      });
    });
    // ② 승강장 사람: 가까운 정류장마다 기다리는 사람(하루 이용객 규모) · 버스가 서면 한두 명이 탄다
    crowdT -= dt;
    self.stations.forEach(function (S) {
      var dp = Math.hypot(S.x - pl.pos.x, S.z - pl.pos.z);
      if (dp > 220) return;
      if (crowdT <= 0) { var want = Math.max(1, Math.min(5, Math.round(S.day / 2500) + (S.wide > 30 ? 1 : 0))); if (platPeds(S) < want) self.addCrowd(S); }
      // 버스를 쫓아 뛰어드는 사람 — 버스가 서 있거나 60m 안으로 들어올 때. 경기·광역 노선이 많을수록 잦다
      var busNow = false, cars = tr ? tr.cars : [];
      for (var i = 0; i < cars.length; i++) { var c = cars[i]; if (c.isBus && (c.dwellKey === S.key || (c.brtDir === S.d && c.brtLane && c.brtLane.axis === S.axis && c.brtLane.idx === S.idx && Math.hypot(c.pos.x - S.x, c.pos.z - S.z) < 60))) { busNow = true; break; } }
      if (busNow && dp < 160 && !(P && P.noJaywalk) && rng() < dt * (0.02 + 0.1 * Math.min(1, S.wide / 60)) * (cfg.BRT_RUSH_K || 1)) self.rush(S);
    });
    if (crowdT <= 0) crowdT = 1.2;
    // ③ 승강장 사람 정리: 버스가 떠난 뒤 탄 사람은 사라진다
    if (P) for (var j = P.peds.length - 1; j >= 0; j--) {
      var q = P.peds[j]; if (!q.brt || q.state !== 'plat') continue;
      q.platT = (q.platT || 0) + dt;
      var S2 = self.byKey(q.brt.key), dwelling = false;
      if (S2 && tr) for (var i2 = 0; i2 < tr.cars.length; i2++) if (tr.cars[i2].dwellKey === S2.key) { dwelling = true; break; }
      if ((dwelling && q.platT > 3 && rng() < dt * 0.35) || (!q.brt.crowd && q.platT > 30)) { P.remove(q); self.stats.boards++; }
    }
    // ④ 순찰차가 승강장에 올라타지 않게(연석) — 부딪히면 옆으로 밀어내고 속도를 죽인다
    self.stations.forEach(function (S) {
      if (Math.abs(S.x - pl.pos.x) > 40 || Math.abs(S.z - pl.pos.z) > 40) return;
      var al = along(S.axis, pl.pos.x, pl.pos.z) - S.s, lt = latOf(S, pl.pos.x, pl.pos.z) - S.lat, hw = W / 2 + 1.0;
      if (Math.abs(al) > L / 2 + 1.2 || Math.abs(lt) > hw) return;
      var push = (lt >= 0 ? hw - lt : -hw - lt);
      if (S.axis === 'v') pl.pos.x += push; else pl.pos.z += push;
      if (pl.vx !== undefined) { pl.vx *= 0.3; pl.vz *= 0.3; }
      if (pl.resync) pl.resync();
      self.stats.bumps++;
      if (G.hud && (!self._bumpCd || self._bumpCd < G.traffic.time)) { self._bumpCd = G.traffic.time + 4; G.hud.hint('🚏 중앙 정류장 승강장 — 연석에 부딪혔다'); }
    });
  };
};
