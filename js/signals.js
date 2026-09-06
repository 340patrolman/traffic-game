// 4구 신호(적·황·좌회전·녹) 주기 제어. 교차로마다 위상 오프셋. 보행 신호는 직각 방향 차량 녹색 초반에만 켜진다.
TG.Signals = function (city, world, cfg) {
  var G = cfg.SIG_GREEN, Y = cfg.SIG_YELLOW, R = cfg.SIG_ALLRED, HALF = G + Y + R, CYCLE = HALF * 2;
  var ctrl = {};
  city.xs.forEach(function (_, i) { city.zs.forEach(function (__, j) { ctrl[i + ',' + j] = { t: ((i * 7 + j * 11) % 10) * 3 }; }); });

  var mats = {
    green: new THREE.MeshBasicMaterial({ map: TG.tex.signalHead('greenLeft') }),
    yellow: new THREE.MeshBasicMaterial({ map: TG.tex.signalHead('yellow') }),
    red: new THREE.MeshBasicMaterial({ map: TG.tex.signalHead('red') }),
  };
  var pedMats = { walk: new THREE.MeshBasicMaterial({ map: TG.tex.pedHead(true) }), stop: new THREE.MeshBasicMaterial({ map: TG.tex.pedHead(false) }) };

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
  function update(dt) {
    for (var k in ctrl) ctrl[k].t += dt;
    var heads = world.heads;
    for (var i = 0; i < heads.length; i++) {
      var h = heads[i];
      if (h.kind === 'veh') {
        var s = state(h.node, h.axis).s;
        if (h.last !== s) { h.last = s; h.mesh.material = mats[s]; }
      } else {
        var w = pedWalk(h.node, h.axis);
        if (h.last !== w) { h.last = w; h.mesh.material = w ? pedMats.walk : pedMats.stop; }
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
  return { state: state, pedWalk: pedWalk, update: update, force: force, set: set, CYCLE: CYCLE, phase: function (node) { return phase(ctrl[node.i + ',' + node.j].t); } };
};
