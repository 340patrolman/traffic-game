// 4구 신호(적·황·좌회전·녹) 주기 제어. 교차로마다 위상 오프셋. 보행 신호는 직각 방향 차량 녹색 초반에만 켜진다.
TG.Signals = function (city, world, cfg) {
  var G = cfg.SIG_GREEN, Y = cfg.SIG_YELLOW, R = cfg.SIG_ALLRED, HALF = G + Y + R, CYCLE = HALF * 2;
  // 교차로마다 고유값(강제값): 최소 녹색 시간. 보행 신호 최소(cfg.PED_WALK)는 어느 교차로에서도 줄일 수 없다.
  // 수동 조작에서 버튼을 눌러도 최소 녹색·보행 최소를 채운 뒤 황색·전적색을 거쳐야 넘어간다 — 교차로 특성을 알아야 조작할 수 있다.
  var NODE_MIN = { '0,1': 18, '0,2': 16, '1,2': 15, '2,2': 20, '3,2': 15, '0,0': 16 };   // 성모병원·서초역·교대역·강남역·역삼역·고속터미널
  var ctrl = {};
  city.xs.forEach(function (_, i) { city.zs.forEach(function (__, j) {
    var key = i + ',' + j;
    ctrl[key] = { t: ((i * 7 + j * 11) % 10) * 3, manual: false, req: null, minGreen: NODE_MIN[key] || 12 };
  }); });
  function keyOf(node) { return node.i + ',' + node.j; }
  // 지금 녹색인 축과 경과·지속 시간(전환 중이면 null)
  function greenNow(t) {
    var p = phase(t);
    if (p.ns.s === 'green') return { axis: 'v', elapsed: p.ns.elapsed, dur: G, at: 0 };
    if (p.ew.s === 'green') return { axis: 'h', elapsed: p.ew.elapsed, dur: G, at: HALF };
    return null;
  }
  // 수동 전환에 필요한 남은 시간: 최소 녹색·보행 최소를 채우고 + 황색 + 전적색
  function waitFor(node, axis) {
    var c = ctrl[keyOf(node)], g = greenNow(c.t);
    if (!g) return { wait: 1.5, why: '전환 중' };
    if (g.axis === axis) return { wait: 0, why: '이미 녹색' };
    var needMin = Math.max(c.minGreen, cfg.PED_WALK + 2);   // 보행 신호를 줄일 수 없다 → 보행 최소 + 여유
    var left = Math.max(0, needMin - g.elapsed);
    return { wait: left + Y + R, why: left > 0 ? (pedWalk(node, g.axis === 'v' ? 'h' : 'v') ? '보행 신호 최소 시간' : '최소 녹색 시간') : '황색·전적색 통과' };
  }
  function setManual(node, on) { var c = ctrl[keyOf(node)]; c.manual = !!on; c.req = null; return c.manual; }
  function isManual(node) { return !!ctrl[keyOf(node)].manual; }
  // 수동 요청: 이 축을 녹색으로. 즉시 바뀌지 않고 최소 시간을 채운 뒤 넘어간다.
  function request(node, axis) {
    var c = ctrl[keyOf(node)];
    if (!c.manual) return { ok: false, why: '자동 운영 중 — 수동으로 먼저 전환하세요' };
    var w = waitFor(node, axis);
    if (w.wait <= 0) return { ok: false, why: '이미 그 방향이 녹색입니다' };
    c.req = axis;
    return { ok: true, wait: w.wait, why: w.why };
  }
  function manualInfo(node) {
    var c = ctrl[keyOf(node)], g = greenNow(c.t);
    return { manual: c.manual, req: c.req, minGreen: c.minGreen, axis: g ? g.axis : null, elapsed: g ? g.elapsed : 0,
             holding: !!(c.manual && g && g.elapsed >= g.dur - 0.05 && !c.req), pedMin: cfg.PED_WALK };
  }

  var mats = {
    green: new THREE.MeshBasicMaterial({ map: TG.tex.signalHead('greenLeft') }),
    yellow: new THREE.MeshBasicMaterial({ map: TG.tex.signalHead('yellow') }),
    red: new THREE.MeshBasicMaterial({ map: TG.tex.signalHead('red') }),
  };
  // 보행 신호등: 적색 서 있는 사람 / 녹색 걷는 사람 + 잔여 시간 숫자(한국식 잔여시간 표시기). 끝나기 3초 전부터 녹색이 깜빡인다.
  var pedMats = { stop: new THREE.MeshBasicMaterial({ map: TG.tex.pedHead(false) }), off: new THREE.MeshBasicMaterial({ map: TG.tex.pedHead(true, -1) }) };
  function pedMat(remain) { var n = Math.max(1, Math.ceil(remain)), k = 'w' + n; if (!pedMats[k]) pedMats[k] = new THREE.MeshBasicMaterial({ map: TG.tex.pedHead(true, n) }); return pedMats[k]; }

  // 축별 상태. axis 'v' = 남북 도로(x 고정) 위를 달리는 차량, 'h' = 동서.
  function phase(t) {
    t = ((t % CYCLE) + CYCLE) % CYCLE;
    var ns, ew;
    if (t < G) { ns = { s: 'green', remain: G - t, elapsed: t }; ew = { s: 'red', remain: HALF - t, elapsed: t + HALF }; }
    else if (t < G + Y) { ns = { s: 'yellow', remain: G + Y - t, elapsed: t - G }; ew = { s: 'red', remain: HALF - t, elapsed: t + HALF }; }
    else if (t < HALF) { ns = { s: 'red', remain: CYCLE - t, elapsed: t - G - Y }; ew = { s: 'red', remain: HALF - t, elapsed: t + HALF }; }
    else if (t < HALF + G) { ns = { s: 'red', remain: CYCLE - t, elapsed: t - G - Y }; ew = { s: 'green', remain: HALF + G - t, elapsed: t - HALF }; }
    else if (t < HALF + G + Y) { ns = { s: 'red', remain: CYCLE - t, elapsed: t - G - Y }; ew = { s: 'yellow', remain: HALF + G + Y - t, elapsed: t - HALF - G }; }
    else { ns = { s: 'red', remain: CYCLE - t, elapsed: t - G - Y }; ew = { s: 'red', remain: CYCLE - t + HALF, elapsed: t - HALF - G - Y }; }
    return { ns: ns, ew: ew, t: t };
  }
  function state(node, axis) {
    var p = phase(ctrl[node.i + ',' + node.j].t);
    return axis === 'v' ? p.ns : p.ew;
  }
  // crossAxis: 건너는 도로의 축. 'v' 도로를 건넌다 = x 방향으로 걷는다 = 동서 차량 녹색 초반
  function pedWalk(node, crossAxis) {
    var p = phase(ctrl[node.i + ',' + node.j].t);
    if (crossAxis === 'v') return p.ew.s === 'green' && p.ew.elapsed < cfg.PED_WALK;
    return p.ns.s === 'green' && p.ns.elapsed < cfg.PED_WALK;
  }
  // 보행 신호 잔여 시간: 녹색이면 남은 보행 시간, 적색이면 다음 보행 신호까지 남은 시간(초)
  function pedRemain(node, crossAxis) {
    var p = phase(ctrl[node.i + ',' + node.j].t), s = crossAxis === 'v' ? p.ew : p.ns, start = crossAxis === 'v' ? HALF : 0;
    if (s.s === 'green' && s.elapsed < cfg.PED_WALK) return cfg.PED_WALK - s.elapsed;
    var until = start - p.t; while (until <= 0) until += CYCLE;
    return until;
  }
  var blinkT = 0;
  function update(dt) {
    for (var k in ctrl) {
      var c = ctrl[k];
      if (!c.manual) { c.t += dt; continue; }
      // 수동: 현재 녹색 끝에서 멈춰 유지(요청 없으면 계속 녹색). 요청이 있으면 최소 시간을 채운 뒤 황색·전적색을 거쳐 다음 녹색으로.
      var g = greenNow(c.t);
      if (g) {
        var needMin = Math.max(c.minGreen, cfg.PED_WALK + 2);
        var canLeave = c.req && c.req !== g.axis && g.elapsed >= needMin;
        var atEnd = g.elapsed >= g.dur - 0.05;
        if (atEnd && !canLeave) { c.t = g.at + g.dur - 0.05; continue; }   // 녹색 유지(연장)
        c.t += dt;
      } else {
        c.t += dt;   // 황색·전적색은 그대로 흐른다
        var g2 = greenNow(c.t);
        if (g2 && c.req === g2.axis) c.req = null;   // 요청 방향이 녹색이 되면 요청 해제
      }
    }
    blinkT += dt;
    var heads = world.heads;
    for (var i = 0; i < heads.length; i++) {
      var h = heads[i];
      if (h.kind === 'veh') {
        var s = state(h.node, h.axis).s;
        if (h.last !== s) { h.last = s; h.mesh.material = mats[s]; }
      } else {
        var w = pedWalk(h.node, h.axis), key = 'stop', m = pedMats.stop;
        if (w) { var rem = pedRemain(h.node, h.axis); if (rem < 3 && (blinkT * 4) % 2 >= 1) { key = 'off'; m = pedMats.off; } else { key = 'w' + Math.max(1, Math.ceil(rem)); m = pedMat(rem); } }
        if (h.last !== key) { h.last = key; h.mesh.material = m; }
      }
    }
  }
  function force(i, j, t) { ctrl[i + ',' + j].t = t; }
  // 테스트·디버그: 어떤 노드의 축 axis 를 지금 즉시 상태 s 로 만든다
  function set(node, axis, s) {
    var t;
    if (axis === 'v') t = s === 'green' ? 0.5 : s === 'yellow' ? G + 0.5 : HALF + 0.5;
    else t = s === 'green' ? HALF + 0.5 : s === 'yellow' ? HALF + G + 0.5 : 0.5;
    ctrl[node.i + ',' + node.j].t = t;
  }
  return { state: state, pedWalk: pedWalk, pedRemain: pedRemain, update: update, force: force, set: set, CYCLE: CYCLE, phase: function (node) { return phase(ctrl[node.i + ',' + node.j].t); },
           setManual: setManual, isManual: isManual, request: request, waitFor: waitFor, manualInfo: manualInfo, minGreenOf: function (node) { return ctrl[keyOf(node)].minGreen; } };
};
