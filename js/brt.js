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
  self.stats = { buses: 0, rushers: 0, crowd: 0, boards: 0, bumps: 0, flows: 0, greenX: 0, redX: 0, alight: 0, xwStops: 0, reenact: 0 };
  if (!self.on) { self.update = function () {}; self.reset = function () {}; self.stationNear = function () { return null; }; return; }
  var L = cfg.BRT_PLAT_LEN || 30, W = 1.9, LAT = 3.9 + W / 2;   // 승강장 길이·폭·중앙선에서 승강장 가운데까지
  var rng = TG.makeRNG(4077);
  function sgnOf(d) { return (d === 0 || d === 1) ? 1 : -1; }          // 진행 방향이 격자 좌표를 키우는가
  function rightOf(d) { var f = TG.DIR_VEC[d]; return [-f[1], f[0]]; }
  function pt(axis, idx, s, lat) { return axis === 'v' ? [city.xs[idx] + lat, s] : [s, city.zs[idx] + lat]; }
  (city.brt.stations || []).forEach(function (S, k) {
    var r = rightOf(S.d), latS = (S.axis === 'v' ? r[0] : r[1]) * LAT;   // 승강장 가운데의 부호 있는 가로 좌표(도로 중심 기준)
    // (v0.10.69) 승강장 끝을 횡단보도에 붙인다 — 승강장(30m 고정)이 실제보다 짧아 OSM 횡단보도와 사이에 차로가 남으면, 건넌 사람이 차도 위를 걸어 승강장으로 갔다.
    //  횡단보도 가운데(교차로 상자 안이면 그 교차로 횡단보도 띠 가운데)에서 2.5m 떨어진 자리가 승강장 끝이 되게 옮긴다(26m 넘게 떨어진 횡단보도는 — 실제 승강장은 40~60m 라 30m 승강장 끝에서 그만큼은 떨어진다 — 이 정류장 것이 아니라고 보고 쓰지 않는다).
    var sUse = S.s, xwC = null;
    if (S.xw != null) {
      var arrN = S.axis === 'v' ? city.zs : city.xs, kN = 0; for (var kk = 1; kk < arrN.length; kk++) if (Math.abs(arrN[kk] - S.xw) < Math.abs(arrN[kN] - S.xw)) kN = kk;
      var hbN = S.axis === 'v' ? city.halfH[kN] : city.halfV[kN], ncN = arrN[kN];
      xwC = Math.abs(S.xw - ncN) < hbN + 6 ? ncN + (S.xw >= ncN ? 1 : -1) * (hbN + 2.25) : S.xw;
      if (Math.abs(xwC - S.s) - L / 2 <= 26) { var sdX = xwC >= S.s ? 1 : -1; sUse = xwC - sdX * (L / 2 + 2.5); } else xwC = null;
    }
    var c = pt(S.axis, S.idx, sUse, latS);
    self.stations.push({ key: 'st' + k, name: S.name, id: S.id, ars: S.ars, axis: S.axis, idx: S.idx, d: S.d, s: sUse, sData: S.s, lat: latS, x: c[0], z: c[1],
      routes: S.routes || 0, wide: S.wide || 0, day: S.day || 0, len: L, fatal: S.fatal || null, dwell: null,
      // (v0.10.69) 동선 — 횡단보도 자리(OSM · 없으면 승강장 앞끝 5m 로 어림) · 지하철 출입구(OSM) · 시간대별 승하차(서울시 교통카드 2026.6)
      xw: xwC != null ? xwC : sUse + sgnOf(S.d) * (L / 2 + 5), xwGuess: xwC == null, xwSig: S.xwSig !== undefined ? !!S.xwSig : true, exits: S.exits || [], h: S.h || null });
    var st0 = self.stations[self.stations.length - 1]; st0.xwSide = st0.xw >= st0.s ? 1 : -1;
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
    var gA = S.xwSide > 0 ? -L / 2 + 2 : -L / 2 + 4, gB = S.xwSide > 0 ? L / 2 - 4 : L / 2 - 2;   // 횡단보도 쪽 끝 4m 는 비운다(승강장 출입구)
    put(glass, gA, gB, lo - sg * 0.08, lo, 0.35, 1.9, 0x9fc4d8);                                  // 차도 쪽 유리 난간
    put(gb, gA, gB, lo - sg * 0.08, lo, 1.9, 1.98, 0x6b7785);
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

  // ---------- 🚸 정류장 횡단보도(v0.10.69) — 승강장으로 가는 길. OSM 횡단보도 자리(신호 여부 포함) ----------
  //  신호는 가장 가까운 교차로의 「이 도로를 건너는 보행 신호」에 맞춘다(게임 설계 — 실제 연동 방식은 자료에 없다).
  var XW = [];
  function nodeNear(axis, idx, s) { var arr = axis === 'v' ? city.zs : city.xs, b = 0; for (var k = 1; k < arr.length; k++) if (Math.abs(arr[k] - s) < Math.abs(arr[b] - s)) b = k; return axis === 'v' ? city.nodes[idx][b] : city.nodes[b][idx]; }
  self.stations.forEach(function (S) {
    var X = null; XW.forEach(function (x) { if (x.axis === S.axis && x.idx === S.idx && Math.abs(x.s - S.xw) < 14) X = x; });
    if (!X) { X = { axis: S.axis, idx: S.idx, s: S.xw, sig: S.xwSig, guess: S.xwGuess, node: nodeNear(S.axis, S.idx, S.xw), st: [], walk: false, flash: false, heads: [] }; XW.push(X); }
    X.st.push(S); S.X = X;
  });
  // 교차로 상자 안에 떨어진 횡단보도는 교차로 것을 쓴다(그리지 않는다)
  XW.forEach(function (X) { var nd = X.node, nc = X.axis === 'v' ? nd.z : nd.x, hb = X.axis === 'v' ? city.halfH[nd.j] : city.halfV[nd.i]; X.inNode = Math.abs(X.s - nc) < hb + 6; X.cs = X.inNode ? nc + (X.s >= nc ? 1 : -1) * (hb + 2.25) : X.s; });
  self.crosswalks = XW;
  var zeb = new TG.GeoBuilder(), headMats = [];
  XW.forEach(function (X) {
    if (X.inNode) return;
    var half = city.halfOf(X.axis, X.idx), base = X.axis === 'v' ? city.xs[X.idx] : city.zs[X.idx];
    for (var la = -half + 0.5; la < half; la += 1.0) { var q = pt(X.axis, X.idx, X.s, la); if (X.axis === 'v') zeb.rect(q[0], q[1], 0.5, 4, 0, 0.076, 0xf2f2ee); else zeb.rect(q[0], q[1], 4, 0.5, 0, 0.076, 0xf2f2ee); }
    [0, 2, 1, 3].forEach(function (d) {   // 정지선: 진행 방향 오른쪽 반폭 · 횡단보도 3.5m 앞
      if ((X.axis === 'v') !== (d === 0 || d === 2)) return;
      var sg = sgnOf(d), r = rightOf(d), rs = X.axis === 'v' ? r[0] : r[1], q = pt(X.axis, X.idx, X.s - sg * 3.5, rs * half / 2);
      if (X.axis === 'v') zeb.rect(q[0], q[1], half - 0.2, 0.45, 0, 0.076, 0xf2f2ee); else zeb.rect(q[0], q[1], 0.45, half - 0.2, 0, 0.076, 0xf2f2ee);
    });
    if (!X.sig) return;
    // 보행 신호등(양쪽 보도 끝) — 색은 매 프레임 바꾼다
    var mat = new THREE.MeshBasicMaterial({ color: 0xff3b30 }); X.mat = mat; headMats.push(mat);
    [-1, 1].forEach(function (sd) {
      var q = pt(X.axis, X.idx, X.s + 2.6, sd * (half + 0.9)), pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 3, 6), new THREE.MeshLambertMaterial({ color: 0x5b6470 }));
      pole.position.set(q[0], 1.5, q[1]); var head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.7, 0.42), mat); head.position.set(q[0], 2.75, q[1]);
      [pole, head].forEach(function (m) { m.matrixAutoUpdate = false; m.updateMatrix(); scene.add(m); });
    });
  });
  add(zeb.build(), new THREE.MeshBasicMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  function xwTick() {
    var SG = G.signals; if (!SG) return;
    XW.forEach(function (X) {
      var w = SG.pedWalk ? !!SG.pedWalk(X.node, X.axis) : false, fl = w && SG.pedFlash ? !!SG.pedFlash(X.node, X.axis) : false;
      X.walk = w; X.flash = fl;
      if (X.mat) X.mat.color.setHex(w ? ((fl && (Date.now() % 600) < 300) ? 0x1c3a22 : 0x2ecc40) : 0xff3b30);
    });
  }
  // 차가 정류장 횡단보도 정지선 앞에 서는가(traffic.js 가 부른다): 보행 녹색이면 정지선까지 거리, 아니면 null
  city.brtXwStop = function (axis, idx, d, s) {
    var sg = sgnOf(d), best = null;
    for (var k = 0; k < XW.length; k++) { var X = XW[k]; if (X.inNode || X.axis !== axis || X.idx !== idx || !X.walk) continue; var dd = (X.s - sg * 3.5 - s) * sg; if (dd > -1 && dd < 90 && (best === null || dd < best)) best = dd; }
    return best;
  };

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

  // ---------- 🚶 이용객 동선(v0.10.69) ----------
  function hourNow() { return G.brtHour != null ? G.brtHour : new Date().getHours(); }
  self.hourNow = hourNow;
  function meanH(S) { if (!S.h) return 1; var a = 0; for (var i = 0; i < 24; i++) a += S.h[i]; return a / 24 || 1; }
  function busF(S) { return S.h ? Math.max(0.3, Math.min(1.8, S.h[hourNow()] / meanH(S))) : 1; }   // 버스 대수 배율 = 이 시각 승하차 ÷ 하루 평균(설계값 — 시간대별 운행 대수는 공개 자료에 없다)
  function busFDir(axis, idx, d) { var n = 0, s = 0; self.stations.forEach(function (S) { if (S.axis === axis && S.idx === idx && S.d === d) { n++; s += busF(S); } }); return n ? s / n : 1; }
  function flowsOf(S) { var n = 0, ps = G.peds ? G.peds.peds : []; for (var i = 0; i < ps.length; i++) if (ps[i].fl && ps[i].fl.S === S && ps[i].state === 'flow') n++; return n; }
  function dirOf(dx, dz) { return Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? 1 : 3) : (dz > 0 ? 0 : 2); }
  function busAt(S) { var cars = G.traffic ? G.traffic.cars : []; for (var i = 0; i < cars.length; i++) { var c = cars[i]; if (c.isBus && (c.dwellKey === S.key || (c.brtDir === S.d && c.brtLane && Math.hypot(c.pos.x - S.x, c.pos.z - S.z) < 70))) return true; } return false; }
  // 한 사람의 길: 출구·보도 → 횡단보도 연석(신호 기다림) → 건넘 → 승강장 · 내린 사람은 거꾸로 → 보도 → 출구(사라짐) 또는 보도를 걸어감
  self.flow = function (S, kind) {
    var Pd = G.peds; if (!Pd || !S.X) return null;
    var X = S.X, sg = S.lat > 0 ? 1 : -1, so = city.sideOff(S.axis, S.idx), half = city.halfOf(S.axis, S.idx), coord = S.axis === 'v' ? city.xs[S.idx] : city.zs[S.idx];
    var far = rng() < 0.3, side = far ? -sg : sg, xs0 = X.cs;
    var aPl = S.s + S.xwSide * (L / 2 - 3), start, wps;
    var plP = Pd.player || G.player, exOK = S.exits.filter(function (e) { return !plP || Math.hypot(e[0] - plP.pos.x, e[1] - plP.pos.z) < (cfg.PED_DESPAWN || 120) - 15; });   // 멀면 곧바로 지워진다
    var ex = exOK.length && rng() < 0.6 ? exOK[Math.floor(rng() * exOK.length)] : null;
    if (ex) { var exLat = (S.axis === 'v' ? ex[0] : ex[1]) - coord; side = exLat >= 0 ? 1 : -1; far = side !== sg; }
    var curb = pt(S.axis, S.idx, xs0, side * (half + 0.7)), walkIn = pt(S.axis, S.idx, xs0 - S.xwSide * 1.5, side * so);
    if (kind === 'board') {
      start = ex ? [ex[0], ex[1]] : pt(S.axis, S.idx, xs0 + (rng() < 0.5 ? -1 : 1) * (20 + rng() * 60), side * so);
      wps = [{ p: walkIn }, { p: curb, wait: true }, { p: pt(S.axis, S.idx, xs0, S.lat), cross: true }, { p: pt(S.axis, S.idx, xs0 - S.xwSide * 3.5, S.lat) }, { p: pt(S.axis, S.idx, aPl - S.xwSide * rng() * 16, S.lat + (rng() - 0.5) * 0.7), plat: true }];
    } else {
      start = pt(S.axis, S.idx, aPl - S.xwSide * rng() * 10, S.lat); side = rng() < 0.6 ? sg : -sg; far = side !== sg;
      curb = pt(S.axis, S.idx, xs0, side * (half + 0.7));
      var endP = ex && (((S.axis === 'v' ? ex[0] : ex[1]) - coord) * side > 0) ? [ex[0], ex[1]] : pt(S.axis, S.idx, xs0 + (rng() < 0.5 ? -1 : 1) * (25 + rng() * 40), side * so);
      wps = [{ p: pt(S.axis, S.idx, xs0 - S.xwSide * 3.5, S.lat), wait: true }, { p: pt(S.axis, S.idx, xs0, S.lat) }, { p: curb, cross: true }, { p: pt(S.axis, S.idx, xs0 + S.xwSide * 1.5, side * so) }, { p: endP, end: true }];
      self.stats.alight++;
    }
    var p = Pd.spawn({ at: { x: start[0], z: start[1], axis: S.axis, idx: S.idx, coord: coord, side: side, d: S.d }, jaywalker: false });
    if (!p) return null;
    p.state = 'flow'; p.fl = { S: S, X: X, wps: wps, k: 0, kind: kind, far: far, waitT: 0, side: side }; p.speed = 1.15 + rng() * 0.45; self.stats.flows++;
    return p;
  };
  function flowTick(dt) {
    var Pd = G.peds; if (!Pd) return;
    for (var i = Pd.peds.length - 1; i >= 0; i--) {
      var p = Pd.peds[i]; if (p.state !== 'flow' || !p.fl) continue;
      var f = p.fl, w = f.wps[f.k]; if (!w) { Pd.remove(p); continue; }
      if (f.delay > 0) { f.delay -= dt; p.flowWait = true; continue; }
      p.flowWait = false;
      if (w.wait && f.at) {   // 연석(또는 승강장 끝)에서 보행 신호를 기다린다 — 버스가 오면 적색에 건너는 사람이 나온다
        p.flowWait = true; f.waitT += dt;
        if (f.redPick === undefined) f.redPick = !f.X.walk && busAt(f.S) && !Pd.noJaywalk && rng() < (0.08 + 0.12 * Math.min(1, f.S.wide / 60)) * (G.brtRiskK != null ? G.brtRiskK : 1) ? 0.8 + rng() * 2 : 0;
        var green = f.X.walk && !f.X.flash, risky = !f.X.walk && f.redPick > 0 && f.waitT > f.redPick && !Pd.noJaywalk;
        if (green || risky || f.waitT > 170) {
          if (!f.X.walk) { p.jayLive = true; p.jayDone = true; p.jayT = 0; p.jayKind = 'red'; p.speed = 2.3; self.stats.redX++; if (Pd.onEvent) Pd.onEvent('jaywalk', p); } else self.stats.greenX++;
          p.flowWait = false; f.at = false; f.k++; f.redPick = undefined;
        }
        continue;
      }
      var dx = w.p[0] - p.pos.x, dz = w.p[1] - p.pos.z, dd = Math.hypot(dx, dz), step = p.speed * dt;
      if (dd > 0.05) p.d = dirOf(dx, dz);
      // 선 차와 서로 기다리면(차는 사람 앞에 서고 사람은 차체에 막힌다) 3초 뒤 그 걸음을 마친 것으로 본다 — 교착 방지(v0.9.84 행인 jamDir 와 같은 뜻)
      var mvd = f.lx === undefined ? 1 : Math.hypot(p.pos.x - f.lx, p.pos.z - f.lz); f.lx = p.pos.x; f.lz = p.pos.z;
      f.stall = mvd < step * 0.3 ? (f.stall || 0) + dt : 0;
      if (dd > step && f.stall < 3) { p.pos.x += dx / dd * step; p.pos.z += dz / dd * step; if (p.jayLive) p.jayT += dt; continue; }
      f.stall = 0; f.lx = undefined;
      p.pos.x = w.p[0]; p.pos.z = w.p[1];
      if (w.wait) { f.at = true; continue; }
      if (w.cross && p.jayLive) { p.jayLive = false; }
      if (w.plat) { p.state = 'plat'; p.flowWait = false; p.brt = { key: f.S.key, lat: (f.S.axis === 'v' ? p.pos.x - city.xs[f.S.idx] : p.pos.z - city.zs[f.S.idx]), crowd: true }; p.platT = 0; p.d = f.S.d; continue; }
      if (w.end) { Pd.remove(p); continue; }
      f.k++;
    }
  }

  // ---------- 🎞 실제 사망사고 재현(v0.10.69 · 지도 항목 brt.reenact) ----------
  //  사실(연·월·요일·시각·날씨·노면·도로형태·사고유형·법규위반·가해 차종·사망자 수)은 TAAS 사망사고 자료 그대로(지도 파일에 복사).
  //  **방향·차로·신호·사람의 동선은 자료에 없어 재구성**한다 — 카드에 그렇게 밝힌다. 부딪히는 장면은 없다: 차는 급제동으로 사람 앞에 선다.
  var RE = B.reenact || [], re = null;
  self.reenactIds = function () { return RE.map(function (r) { return r.id; }); };
  self.reState = function () { return re ? { id: re.R.id, t: +re.t.toFixed(1), phase: re.phase, s: Math.round(re.s0), carV: re.car ? +re.car.v.toFixed(1) : null, gap: re.gap, minGap: re.minGap === 1e9 ? null : +re.minGap.toFixed(1), peds: re.peds.length, card: re.card, skid: re.skid } : null; };
  function reSnap(R, s0) {   // TAAS 자리에서 도로를 따라 가장 가까운 횡단보도 띠(교차로 또는 정류장) — 25m 안에 없으면 그 자리(단일로)
    if (R.midBlock) return s0;
    var arr = R.axis === 'v' ? city.zs : city.xs, best = null;
    for (var k = 0; k < arr.length; k++) { var nd = R.axis === 'v' ? city.nodes[R.idx][k] : city.nodes[k][R.idx], hb = R.axis === 'v' ? city.halfH[k] : city.halfV[k];
      [-1, 1].forEach(function (sg) { var c = arr[k] + sg * (hb + 2.25); if (Math.abs(c - s0) < 25 && (best === null || Math.abs(c - s0) < Math.abs(best - s0))) best = c; }); }
    XW.forEach(function (X) { if (X.axis === R.axis && X.idx === R.idx && !X.inNode && Math.abs(X.cs - s0) < 25 && (best === null || Math.abs(X.cs - s0) < Math.abs(best - s0))) best = X.cs; });
    return best === null ? s0 : best;
  }
  self.reenact = function (id) {
    var R = null; RE.forEach(function (r) { if (r.id === id) R = r; }); if (!R) return false;
    var tr = G.traffic, Pd = G.peds, pl = G.player, F = R.facts; if (!tr || !Pd || !pl) return false;
    var p0 = TG.warp && TG.warp.fromData ? TG.warp.fromData(F.gx, F.gz) : null; if (!p0) return false;
    G.brtHour = +F.hh; if (G.weather && R.weather) G.weather.set(R.weather);
    var s0 = reSnap(R, R.axis === 'v' ? p0[1] : p0[0]), d = R.carDir, sg = sgnOf(d), r = rightOf(d), rs = R.axis === 'v' ? r[0] : r[1];
    var half = city.halfOf(R.axis, R.idx), base = R.axis === 'v' ? city.xs[R.idx] : city.zs[R.idx];
    // 판을 비운다 — 이 도로 300m 안의 차·사람
    for (var i = tr.cars.length - 1; i >= 0; i--) { var c = tr.cars[i], al = R.axis === 'v' ? c.pos.z : c.pos.x, lt = (R.axis === 'v' ? c.pos.x : c.pos.z) - base; if (Math.abs(al - s0) < 300 && Math.abs(lt) < half + 8) tr.remove(c); }
    for (var j = Pd.peds.length - 1; j >= 0; j--) { var q = Pd.peds[j], alq = R.axis === 'v' ? q.pos.z : q.pos.x; if (Math.abs(alq - s0) < 60) Pd.remove(q); }
    // 순찰차: 같은 방향 갓길, 55m 뒤에 세워 둔다(지나가는 차와 건너는 사람이 앞에 보이게)
    var shP = pt(R.axis, R.idx, s0 - sg * 55, rs * (city.shoulderOff(R.axis, R.idx) - 0.4));
    pl.teleport(shP[0], shP[1], TG.DIR_HEADING[d]); pl.vx = 0; pl.vz = 0; pl.resync();
    // 사람: 연석 → 건너편 연석 → 건너편 보도
    var so = city.sideOff(R.axis, R.idx), side = R.pedFrom, laneLat = city.laneOff(R.axis, R.idx, R.carLane), laneSide = rs;
    var peds = [], n = R.peds || 1, cs = R.midBlock ? 0 : 1;
    for (var k2 = 0; k2 < n; k2++) {
      var a2 = s0 + (k2 - (n - 1) / 2) * 0.9, st = pt(R.axis, R.idx, a2, side * so);
      var pp = Pd.spawn({ at: { x: st[0], z: st[1], axis: R.axis, idx: R.idx, coord: base, side: side, d: d }, jaywalker: false });
      if (!pp) continue;
      pp.state = 'flow'; pp.speed = R.pedSpeed || 1.35; pp.fl = { S: null, X: null, kind: 'reenact', k: 0, delay: 2.4 + k2 * 0.15, waitT: 0,
        wps: [{ p: pt(R.axis, R.idx, a2, side * (half + 0.6)) }, { p: pt(R.axis, R.idx, a2, -side * (half + 0.6)), cross: true }, { p: pt(R.axis, R.idx, a2, -side * so) }, { p: pt(R.axis, R.idx, a2 + sg * 12, -side * so), end: true }] };
      peds.push(pp);
    }
    // 사람은 차가 가까이 올 때 걷기 시작한다(reTick) — 그 차로 가장자리에 닿을 때 차가 약 12m 앞에 오게(급제동 거리 · 게임 설계값)
    var pv = R.pedSpeed || 1.35, tLane = laneSide === side ? Math.max(0, (half + 0.6) - (laneLat + 1.75)) / pv : ((half + 0.6) + (laneLat - 1.75)) / pv;
    peds.forEach(function (pp) { pp.fl.delay = 99; });
    // 차: 곧게 오거나(carDir·carLane), 교차로에서 돌아 들어온다(turn — 그 차의 녹색 · 건너는 사람의 보행 녹색이 함께인 우회전 충돌)
    var v0 = R.carType === 'truck' ? 12.5 : 13.9, car = null, T0 = R.turn, sigNode = null;
    if (T0) {
      var tn = city.nodes[T0.i][T0.j], tf = TG.DIR_VEC[T0.d], trr = rightOf(T0.d), tAx = (T0.d === 0 || T0.d === 2) ? 'v' : 'h', tIdx = tAx === 'v' ? T0.i : T0.j;
      var tla = city.laneOff(tAx, tIdx, T0.lane), tx = tn.x - tf[0] * (T0.back || 130) + trr[0] * tla, tz = tn.z - tf[1] * (T0.back || 130) + trr[1] * tla;
      var tnd = nodeBehind(tAx, tIdx, T0.d, tAx === 'v' ? tz : tx);
      car = tnd ? tr.spawn({ at: { x: tx, z: tz, d: T0.d, node: tnd }, type: R.carType, laneIdx: T0.lane, v: v0 * 0.8, cruise: v0 * 0.8, violator: false, trait: null, turn: T0.m || 'R' }) : null;
      if (car) car.laneIdx = T0.lane;
      var pb = 42, psh = city.shoulderOff(tAx, tIdx) - 0.4;   // 도는 차 뒤 갓길에서 본다(차가 돌아 횡단보도로 들어가는 것이 앞에 보이게)
      pl.teleport(tn.x - tf[0] * pb + trr[0] * psh, tn.z - tf[1] * pb + trr[1] * psh, TG.DIR_HEADING[T0.d]); pl.vx = 0; pl.vz = 0; pl.resync();
      sigNode = tn; if (G.signals) G.signals.set(tn, tAx, 'green');   // 도는 차의 녹색 = 건너는 사람의 보행 녹색(같은 현시)
    } else {
      var D0 = 150, cp = pt(R.axis, R.idx, s0 - sg * D0, rs * laneLat), nd = nodeBehind(R.axis, R.idx, d, s0 - sg * D0);
      car = nd ? tr.spawn({ at: { x: cp[0], z: cp[1], d: d, node: nd }, type: R.carType, laneIdx: R.carLane, v: v0, cruise: v0, straight: true, violator: false, trait: null }) : null;
      if (car) car.laneIdx = R.carLane;
      { var arrN = R.axis === 'v' ? city.zs : city.xs, kN = 0; for (var kk = 1; kk < arrN.length; kk++) if (Math.abs(arrN[kk] - s0) < Math.abs(arrN[kN] - s0)) kN = kk;
        sigNode = R.axis === 'v' ? city.nodes[R.idx][kN] : city.nodes[kN][R.idx]; if (G.signals) G.signals.set(sigNode, R.axis, 'green'); }
    }
    if (car) { car.reenact = true; car.brtViol = false; }
    re = { R: R, t: 0, phase: 'wait', s0: s0, car: car, peds: peds, gap: null, minGap: 1e9, card: false, skid: false, v0: v0, tLane: tLane, go: pt(R.axis, R.idx, s0, side * (half + 0.6)), sigNode: sigNode };
    if (G.hud) G.hud.notice('🎞 재현 · ' + F.y + '년 ' + F.m + '월 ' + F.dow + '요일 ' + F.hh + '시 · ' + R.where, 'info', 3000);
    return true;
  };
  function reTick(dt) {
    if (!re) return;
    re.t += dt;
    var R = re.R, car = re.car, sg = sgnOf(R.carDir);
    if (re.phase === 'wait' && (!car || G.traffic.cars.indexOf(car) < 0 || re.t > 14 || Math.hypot(car.pos.x - re.go[0], car.pos.z - re.go[1]) < (re.R.release || Math.max(10, car.v * re.tLane + (re.R.pedSpeed ? 7 : 12))))) {
      re.phase = 'run'; re.peds.forEach(function (p, k) { if (p.fl) p.fl.delay = k * 0.15; });
    }
    if (car && G.traffic.cars.indexOf(car) >= 0) {
      var fw = [Math.sin(car.heading), Math.cos(car.heading)], gap = null;   // 차 앞쪽 기준(돌아 들어오는 차도 같은 식)
      re.peds.forEach(function (p) { if (G.peds.peds.indexOf(p) < 0) return; var dx = p.pos.x - car.pos.x, dz = p.pos.z - car.pos.z;
        var g = dx * fw[0] + dz * fw[1] - car.len / 2, lat = Math.abs(dx * -fw[1] + dz * fw[0]); if (lat < car.wid / 2 + 1.0 && g > -1 && (gap === null || g < gap)) gap = g; });
      re.gap = gap === null ? null : +gap.toFixed(1); if (gap !== null) re.minGap = Math.min(re.minGap, gap);
      if (gap !== null && gap < 22 && car.v > (R.turn ? 2 : 4) && !re.skid) { re.skid = true; if (TG.audio.skidBurst) TG.audio.skidBurst(); if (!(TG.mode && TG.mode.sim)) G.slowmo = 1.4; G.shake = 0.35; }
      if (gap !== null && gap < 2.5 && car.v > 0) { car.v = 0; car.mode = 'parked'; re.froze = true; }   // 안전장치 — 부딪히는 장면은 없다
      if (re.froze && (gap === null || gap > 4)) { car.mode = 'drive'; re.froze = false; }
    }
    if (!re.card && (re.skid && re.t > 1 && car && car.v < 0.6 || re.t > 16)) {
      re.card = true; var F = R.facts;
      var shown = G.cinema && G.cinema.brief({ kick: '🎞 실제 사망사고 재현 · TAAS', title: F.y + '년 ' + F.m + '월 ' + F.dow + '요일 ' + F.hh + '시 · ' + R.where,
        sub: F.typeH + ' · ' + F.typeM + ' · ' + F.road + ' · ' + F.wx + '·' + F.rdse + ' · 가해 ' + F.wr + ' · 법규위반 ' + F.viol + ' · 사망 ' + F.dead + '명',
        goal: R.lesson + ' ⚠ 방향·차로·신호·동선은 자료에 없어 게임이 재구성했다.', ms: 9000 });
      if (!shown && G.hud) G.hud.notice('🎞 ' + F.y + '.' + F.m + ' ' + R.where + ' — ' + F.typeM + ' · 가해 ' + F.wr + ' · 사망 ' + F.dead + '명', 'warn', 5000);
      if (G.hud) G.hud.hint('💭 ' + R.lesson);
      self.stats.reenact++;
    }
    if (re.t > 30) re = null;
  }
  self.reenactNow = function () { return re; };

  // ---------- 매 프레임 ----------
  var crowdT = 0, later = [];
  self.later = function (sec, fn) { later.push({ t: sec, fn: fn }); };   // 체험 장면이 몇 초 뒤 일을 건다(게임 시간)
  self.clearLater = function () { later.length = 0; };
  self.reset = function () { later.length = 0; re = null; G.brtHour = null; crowdT = 0; acc = {}; self.stations.forEach(function (S) { S.filled = false; S.accB = 0; }); for (var k in self.stats) self.stats[k] = 0; };
  self.update = function (dt, pl) {
    reTick(dt);
    for (var li = later.length - 1; li >= 0; li--) { later[li].t -= dt; if (later[li].t <= 0) { var fnL = later[li].fn; later.splice(li, 1); try { fnL(); } catch (e) {} } }
    if (!pl) return;
    var tr = G.traffic, P = G.peds;
    // ① 버스: 플레이어 둘레 구간에 노선 수만큼(시간당 노선 × 4대 · 400m 안 방향마다 최대 6대)
    B.lanes.forEach(function (Ln) {
      var sP = along(Ln.axis, pl.pos.x, pl.pos.z), latP = Ln.axis === 'v' ? pl.pos.x - city.xs[Ln.idx] : pl.pos.z - city.zs[Ln.idx];
      if (Math.abs(latP) > 450 || sP < Ln.s0 - 300 || sP > Ln.s1 + 300) return;
      [Ln.axis === 'v' ? 0 : 1, Ln.axis === 'v' ? 2 : 3].forEach(function (d) {
        var k = Ln.axis + Ln.idx + d; acc[k] = (acc[k] || 0) + dt * routesOf(Ln.axis, Ln.idx, d) * 4 / 3600 * (cfg.BRT_BUS_K || 1) * busFDir(Ln.axis, Ln.idx, d) * (G.brtBusK != null ? G.brtBusK : 1);
        if (acc[k] < 1) return;
        acc[k] = 0;
        if (busesNear(Ln.axis, Ln.idx, d, pl, 420) >= (G.brtBusMax != null ? G.brtBusMax : 6)) return;
        var s = sP - sgnOf(d) * (170 + rng() * 90);
        if (s < Ln.s0 + 10 || s > Ln.s1 - 10) return;
        self.spawnBus(Ln.axis, Ln.idx, d, s);
      });
    });
    // ② 승강장 사람: **이 시각의 실제 승하차**(서울시 교통카드 · 시간대별)만큼 기다린다 — 평균 대기 4분 · 상한 10(혼잡 체험 G.brtCap)
    //  그리고 그만큼 사람이 출구·보도에서 걸어와 횡단보도에서 신호를 기다려 건넌다(flow). 숫자 규칙은 게임 설계값.
    xwTick();
    crowdT -= dt;
    var HR = hourNow(), cap = G.brtCap || 10;
    self.stations.forEach(function (S) {
      var dp = Math.hypot(S.x - pl.pos.x, S.z - pl.pos.z);
      if (dp > 240) return;
      var perH = S.h ? S.h[HR] : S.day / 18, lamB = perH / 2 / 3600 * (G.brtFlowK != null ? G.brtFlowK : 1);
      if (crowdT <= 0) { var want = Math.min(cap, Math.round(lamB * 240)); if (platPeds(S) < want && !S.filled) { for (var fi = platPeds(S); fi < want; fi++) self.addCrowd(S); } S.filled = true; }
      S.accB = (S.accB || 0) + dt * lamB;
      if (S.filled && dp > 200) S.filled = false;
      if (S.accB >= 1) { S.accB = 0; if (flowsOf(S) < 8 + (G.brtCap ? 6 : 0) && platPeds(S) < cap + 4) self.flow(S, 'board'); }
      // 버스를 쫓아 뛰어드는 사람 — 버스가 서 있거나 60m 안으로 들어올 때. 경기·광역 노선이 많을수록 잦다
      var busNow = false, cars = tr ? tr.cars : [];
      for (var i = 0; i < cars.length; i++) { var c = cars[i]; if (c.isBus && (c.dwellKey === S.key || (c.brtDir === S.d && c.brtLane && c.brtLane.axis === S.axis && c.brtLane.idx === S.idx && Math.hypot(c.pos.x - S.x, c.pos.z - S.z) < 60))) { busNow = true; break; } }
      if (busNow && dp < 160 && !(P && P.noJaywalk) && rng() < dt * (0.01 + 0.05 * Math.min(1, S.wide / 60)) * (cfg.BRT_RUSH_K || 1)) self.rush(S);
    });
    if (crowdT <= 0) crowdT = 1.2;
    // ②-2 버스가 서면 내리는 사람 — 그 시각 승하차 ÷ 그 방향 버스 대수
    if (tr) for (var bi = 0; bi < tr.cars.length; bi++) { var cb = tr.cars[bi]; if (!cb.isBus || !cb.dwellKey || cb.alightDone === cb.dwellKey) continue; cb.alightDone = cb.dwellKey; var SB = self.byKey(cb.dwellKey); if (!SB || Math.hypot(SB.x - pl.pos.x, SB.z - pl.pos.z) > 240) continue;
      var perH2 = SB.h ? SB.h[HR] : SB.day / 18, hw = 3600 / Math.max(1, SB.routes * 4 * busF(SB)), nA = perH2 / 2 / 3600 * hw * (G.brtFlowK != null ? G.brtFlowK : 1), nI = Math.floor(nA) + (rng() < nA - Math.floor(nA) ? 1 : 0);
      for (var ai = 0; ai < Math.min(4, nI); ai++) self.flow(SB, 'alight'); }
    flowTick(dt);
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
