// 4구 신호(적·황·좌회전·녹) 주기 제어. 교차로마다 위상 오프셋. 보행 신호는 직각 방향 차량 녹색 초반에만 켜진다.
TG.Signals = function (city, world, cfg) {
  var G = cfg.SIG_GREEN, Y = cfg.SIG_YELLOW, R = cfg.SIG_ALLRED, HALF = G + Y + R, CYCLE = HALF * 2;
  // 교차로마다 고유값(강제값): 최소 녹색 시간. 보행 신호 최소(cfg.PED_WALK)는 어느 교차로에서도 줄일 수 없다.
  // 수동 조작에서 버튼을 눌러도 최소 녹색·보행 최소를 채운 뒤 황색·전적색을 거쳐야 넘어간다 — 교차로 특성을 알아야 조작할 수 있다.
  var NODE_MIN = { '2,1': 18, '2,2': 16, '3,2': 18, '4,2': 20, '2,0': 16, '4,1': 18, '3,4': 15, '2,4': 15, '4,4': 18 };   // 성모병원·서초역·교대역·강남역·고속터미널·신논현·남부터미널·예술의전당·양재역
  var ctrl = {};
  city.xs.forEach(function (_, i) { city.zs.forEach(function (__, j) {
    var key = i + ',' + j;
    ctrl[key] = { t: ((i * 7 + j * 11) % 10) * 3, manual: false, req: null, minGreen: NODE_MIN[key] || 12, gv: G, gh: G };   // gv·gh = 남북·동서 녹색 시간(교차로마다 다르게 설정할 수 있다)
  }); });
  function keyOf(node) { return node.i + ',' + node.j; }
  function greenFor(node, axis) { var c = ctrl[keyOf(node)]; return axis === 'v' ? c.gv : c.gh; }
  // ↓ 아래 raiseToPedMin() 은 ctrl 을 다 만든 뒤 이 파일 끝에서 한 번 부른다.
  // 기본 녹색(cfg.SIG_GREEN)이 넓은 횡단보도의 보행 시간을 못 품는 교차로가 있었다.
  // 그러면 pedTime 이 「차량 녹색 − 2」로 깎여, 보행 신호를 보고 제때 출발해도 다 건너기 전에 적색이 됐다
  // (소유자: 「횡단보도 보행자 신호가 너무 짧아서 제 시간에 출발해도 빨간불이 되는경우가 있다」).
  // 그래서 초기값을 교차로마다 greenMin 까지 끌어올린다 — 보행 시간이 줄어드는 일이 없어진다.
  function raiseToPedMin() {
    for (var k in ctrl) {
      var kn = k.split(','), nd = city.nodes[+kn[0]][+kn[1]], c = ctrl[k];
      c.gv = Math.max(c.gv, greenMin(nd, 'v'));
      c.gh = Math.max(c.gh, greenMin(nd, 'h'));
    }
  }
  function cycleOf(node) { var c = ctrl[keyOf(node)]; return c.gv + c.gh + 2 * (Y + R); }
  // 녹색 시간 하한: 그 방향의 최소 녹색과, 직각 횡단보도의 보행 시간 + 2초. **보행 시간은 줄일 수 없다**(소유자 강조).
  function greenMin(node, axis) {
    var c = ctrl[keyOf(node)], crossAx = axis === 'v' ? 'h' : 'v';
    var len = 2 * city.sideOff(crossAx, crossAx === 'v' ? node.i : node.j);
    return Math.max(c.minGreen, Math.ceil(Math.max(cfg.PED_WALK, 5 + len / 1.15)) + 2);
  }
  function setGreen(node, axis, sec) {
    var c = ctrl[keyOf(node)], lo = greenMin(node, axis), hi = 60;
    var v = Math.round(TG.clamp(sec, lo, hi));
    if (axis === 'v') c.gv = v; else c.gh = v;
    return { sec: v, min: lo, max: hi, clamped: v !== Math.round(sec) };
  }
  function greenInfo(node) {
    var c = ctrl[keyOf(node)];
    return { gv: c.gv, gh: c.gh, minV: greenMin(node, 'v'), minH: greenMin(node, 'h'), cycle: cycleOf(node),
             pedV: Math.round(pedTime(node, 'v')), pedH: Math.round(pedTime(node, 'h')), minGreen: c.minGreen };
  }
  // 보행 시간 = 진입 5초 + 횡단 거리 ÷ 1.15m/s(어린이 걸음). 차량 녹색보다 2초 짧게 묶는다.
  // crossAxis 는 **건너는 도로**의 축이다(그 도로의 보도선 사이가 횡단 거리).
  function pedTime(node, crossAxis) {
    var idx = crossAxis === 'v' ? node.i : node.j;
    var len = 2 * city.sideOff(crossAxis, idx);
    var gAx = crossAxis === 'v' ? 'h' : 'v';   // 이 횡단보도는 직각 축 차량 녹색 동안 켜진다
    // 진입 5초 + 횡단거리 ÷ 1.15m/s — **차량 녹색 길이로 깎지 않는다**. 짧으면 차량 녹색을 늘리는 쪽이다(raiseToPedMin).
    return Math.max(cfg.PED_WALK, 5 + len / 1.15);
  }
  // 지금 녹색인 축과 경과·지속 시간(전환 중이면 null)
  function greenNow(node) {
    var c = ctrl[keyOf(node)], p = phase(c.t, c.gv, c.gh);
    if (p.ns.s === 'green') return { axis: 'v', elapsed: p.ns.elapsed, dur: c.gv, at: 0 };
    if (p.ew.s === 'green') return { axis: 'h', elapsed: p.ew.elapsed, dur: c.gh, at: c.gv + Y + R };
    return null;
  }
  // 수동 전환에 필요한 남은 시간: 최소 녹색·보행 최소를 채우고 + 황색 + 전적색
  function waitFor(node, axis) {
    var c = ctrl[keyOf(node)], g = greenNow(node);
    if (!g) return { wait: 1.5, why: '전환 중' };
    if (g.axis === axis) return { wait: 0, why: '이미 녹색' };
    var needMin = Math.max(c.minGreen, pedTime(node, g.axis === 'v' ? 'h' : 'v') + 2);   // 보행 신호를 줄일 수 없다 → 그 횡단보도의 보행 시간 + 여유
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
    var c = ctrl[keyOf(node)], g = greenNow(node);
    return { manual: c.manual, req: c.req, minGreen: c.minGreen, axis: g ? g.axis : null, elapsed: g ? g.elapsed : 0,
             // 전환(황색·전적색) 중에는 녹색 축이 없다. 그때 cfg.PED_WALK(하한 20초)를 보여 주면
             // 「보행 최소 20초」라는 **틀린 숫자**가 화면에 뜬다 — 이 교차로의 실제 보행 시간은 도로 폭으로 정해진다(v0.9.28).
             // 그래서 두 횡단보도 중 **긴 쪽**을 보여 준다.
             holding: !!(c.manual && g && g.elapsed >= g.dur - 0.05 && !c.req),
             pedMin: g ? Math.round(pedTime(node, g.axis === 'v' ? 'h' : 'v'))
                       : Math.round(Math.max(pedTime(node, 'v'), pedTime(node, 'h'))) };
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
  // 교차로마다 남북 녹색 gv · 동서 녹색 gh 가 다르다. 한 주기 = gv + Y + R + gh + Y + R.
  function phase(t, gv, gh) {
    gv = gv || G; gh = gh || G;
    var Hv = gv + Y + R, Hh = gh + Y + R, C = Hv + Hh;
    t = ((t % C) + C) % C;
    var ns, ew;
    if (t < gv) { ns = { s: 'green', remain: gv - t, elapsed: t }; ew = { s: 'red', remain: Hv - t, elapsed: t + Hh }; }
    else if (t < gv + Y) { ns = { s: 'yellow', remain: gv + Y - t, elapsed: t - gv }; ew = { s: 'red', remain: Hv - t, elapsed: t + Hh }; }
    else if (t < Hv) { ns = { s: 'red', remain: C - t, elapsed: t - gv - Y }; ew = { s: 'red', remain: Hv - t, elapsed: t + Hh }; }
    else if (t < Hv + gh) { ns = { s: 'red', remain: C - t, elapsed: t - gv - Y }; ew = { s: 'green', remain: Hv + gh - t, elapsed: t - Hv }; }
    else if (t < Hv + gh + Y) { ns = { s: 'red', remain: C - t, elapsed: t - gv - Y }; ew = { s: 'yellow', remain: Hv + gh + Y - t, elapsed: t - Hv - gh }; }
    else { ns = { s: 'red', remain: C - t, elapsed: t - gv - Y }; ew = { s: 'red', remain: C - t + Hv, elapsed: t - Hv - gh }; }
    return { ns: ns, ew: ew, t: t, cycle: C };
  }
  function ph(node) { var c = ctrl[keyOf(node)]; return phase(c.t, c.gv, c.gh); }
  function state(node, axis) {
    var p = ph(node);
    return axis === 'v' ? p.ns : p.ew;
  }
  // crossAxis: 건너는 도로의 축. 'v' 도로를 건넌다 = x 방향으로 걷는다 = 동서 차량 녹색 초반
  function pedWalk(node, crossAxis) {
    var p = ph(node);
    var W = pedTime(node, crossAxis);
    if (crossAxis === 'v') return p.ew.s === 'green' && p.ew.elapsed < W;
    return p.ns.s === 'green' && p.ns.elapsed < W;
  }
  // 보행 신호 잔여 시간: 녹색이면 남은 보행 시간, 적색이면 다음 보행 신호까지 남은 시간(초)
  function pedRemain(node, crossAxis) {
    var c = ctrl[keyOf(node)], p = ph(node), s = crossAxis === 'v' ? p.ew : p.ns, start = crossAxis === 'v' ? (c.gv + Y + R) : 0;
    var W = pedTime(node, crossAxis);
    if (s.s === 'green' && s.elapsed < W) return W - s.elapsed;
    var until = start - p.t; while (until <= 0) until += p.cycle;
    return until;
  }
  var blinkT = 0;
  function update(dt) {
    for (var k in ctrl) {
      var c = ctrl[k], kn = k.split(','), nd = city.nodes[+kn[0]][+kn[1]];
      if (!c.manual) { c.t += dt; continue; }
      // 수동: 현재 녹색 끝에서 멈춰 유지(요청 없으면 계속 녹색). 요청이 있으면 최소 시간을 채운 뒤 황색·전적색을 거쳐 다음 녹색으로.
      var g = greenNow(nd);
      if (g) {
        // 이미 그 방향이 녹색이면 요청은 이룬 것이다 — 안 지우면 「유지 중」으로 안 보이고 연장 판정도 어긋난다.
        if (c.req === g.axis) c.req = null;
        // 하한은 cfg.PED_WALK(20) 가 아니라 **이 교차로의 실제 최소 녹색**이다(도로 폭으로 정해진 보행 시간을 품는다).
        var needMin = greenMin(nd, g.axis);
        var canLeave = c.req && c.req !== g.axis && g.elapsed >= needMin;
        var atEnd = g.elapsed >= g.dur - 0.05;
        if (atEnd && !canLeave) { c.t = g.at + g.dur - 0.05; continue; }   // 녹색 유지(연장)
        c.t += dt;
      } else {
        c.t += dt;   // 황색·전적색은 그대로 흐른다
        var g2 = greenNow(nd);
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
    var c = ctrl[keyOf(node)], Hv = c.gv + Y + R, t;
    if (axis === 'v') t = s === 'green' ? 0.5 : s === 'yellow' ? c.gv + 0.5 : Hv + 0.5;
    else t = s === 'green' ? Hv + 0.5 : s === 'yellow' ? Hv + c.gh + 0.5 : 0.5;
    ctrl[node.i + ',' + node.j].t = t;
  }
  raiseToPedMin();   // 어느 교차로에서도 보행 시간이 차량 녹색에 밀려 줄어들지 않게, 처음부터 녹색을 충분히 준다
  return { state: state, pedWalk: pedWalk, pedRemain: pedRemain, pedTime: pedTime, update: update, force: force, set: set, CYCLE: CYCLE, phase: ph,
           setManual: setManual, isManual: isManual, request: request, waitFor: waitFor, manualInfo: manualInfo, minGreenOf: function (node) { return ctrl[keyOf(node)].minGreen; },
           greenFor: greenFor, greenMin: greenMin, setGreen: setGreen, greenInfo: greenInfo, cycleOf: cycleOf };
};
