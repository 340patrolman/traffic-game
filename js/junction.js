// 교차로 근무(하차 근무): 정체·꼬리물기를 읽고 신호기를 수동으로 조작해 통행량을 조절·분산한다.
//
//  1단계 — 신호기 수동 조작: 제어함을 열어 자동 → 수동으로 바꾸고, 정체가 심한 방향에 녹색을 더 준다.
//          버튼을 눌러도 즉시 바뀌지 않는다. 교차로 고유의 최소 녹색 시간과 보행 신호 최소 시간(줄일 수 없다)을 채운 뒤
//          황색·전적색을 거쳐 넘어간다. 그래서 교차로의 특성을 알고 미리 눌러야 한다.
//  2단계 — 그래도 안 풀리면: 진입이 많은 방향의 바깥쪽 1개 차로를 라바콘으로 임시 차단하고,
//          꼬리 끊기(수신호로 진입을 끊어 교차로 안 공간을 확보) 근무를 한다. 경찰관의 수신호는 신호기보다 우선한다(도로교통법 제5조).
TG.Junction = function (game) {
  var self = this, city = game.city, traffic = game.traffic, signals = game.signals, S = game.cfg.SCORE;
  var DIRNAME = ['남행(북→남)', '동행(서→동)', '북행(남→북)', '서행(동→서)'];
  var APPROACH = ['북쪽에서', '서쪽에서', '남쪽에서', '동쪽에서'];   // 진행 방향 d 로 오는 차는 그 반대쪽에서 진입한다(남행 = 북쪽에서)
  this.node = null; this.cones = null; this.closed = [];   // 차단한 차로 [{node, d}]
  this.hand = null;                                        // 꼬리 끊기 수신호 대상 접근로 {node, d}
  this.score = { good: 0, gridT: 0, bestQueue: 99, cleared: 0 };
  traffic.control = traffic.control || { closed: [], hand: [] };

  // 접근로별 대기 행렬: 정지선 뒤 80m 안에서 느리게(2m/s 미만) 있는 차량 수와 꼬리 길이(m)
  function queueOf(node, d) {
    var f = TG.DIR_VEC[d], r = [-f[1], f[0]], sd = city.stopDist(node, d), n = 0, far = 0;
    for (var i = 0; i < traffic.cars.length; i++) {
      var c = traffic.cars[i];
      var dx = c.pos.x - node.x, dz = c.pos.z - node.z, along = -(dx * f[0] + dz * f[1]), lat = dx * r[0] + dz * r[1];
      if (along < sd - 2 || along > sd + 80) continue;                   // 정지선 뒤 80m
      var rd = city.roadOf(node, d), half = city.halfOf(rd.axis, rd.idx);
      if (lat < -0.5 || lat > half) continue;                            // 진행 방향 우측(내 차로)만
      if (c.v > 2) continue;
      n++; far = Math.max(far, along - sd);
    }
    return { n: n, len: Math.round(far) };
  }
  // 꼬리물기: 교차로 상자 안에 서 있는(1m/s 미만) 차량
  function gridlockOf(node) {
    var n = 0;
    for (var i = 0; i < traffic.cars.length; i++) {
      var c = traffic.cars[i];
      if (c.v > 1 || c.mode === 'incident') continue;
      if (Math.abs(c.pos.x - node.x) <= city.halfV[node.i] + 1 && Math.abs(c.pos.z - node.z) <= city.halfH[node.j] + 1) n++;
    }
    return n;
  }
  this.stats = function (node) {
    node = node || self.node; if (!node) return null;
    var q = [], worst = -1, worstN = -1;
    for (var d = 0; d < 4; d++) { var e = city.nodeFrom(node, (d + 2) % 4) ? queueOf(node, d) : { n: 0, len: 0 }; q.push(e); if (e.n > worstN) { worstN = e.n; worst = d; } }
    return { q: q, worst: worst, worstN: worstN, grid: gridlockOf(node), manual: signals.isManual(node) };
  };
  // 정체 상황(통행량 증가): 상류(차가 들어오는 쪽) 교차로에서 이 접근로로 차를 계속 들여보낸다.
  // 한 번에 몰아 넣으면 서로 겹쳐 만들어지지 않는다(스폰 최소 간격 12m) — 대열이 정지선에서 다져지는 동안 뒤에서 계속 넣는다.
  function injectOne(node, d, lane) {
    var up = city.nodeFrom(node, (d + 2) % 4); if (!up) return null;
    var f = TG.DIR_VEC[d], r = [-f[1], f[0]], rd = city.roadOf(node, d);
    var span = Math.hypot(up.x - node.x, up.z - node.z) - city.crossHalf(up, d) - 6, lo = city.laneOff(rd.axis, rd.idx, lane);
    var x = node.x - f[0] * span + r[0] * lo, z = node.z - f[1] * span + r[1] * lo;
    return traffic.spawn({ at: { x: x, z: z, d: d, node: up }, v: 9, cruise: 12, straight: true, violator: false, laneIdx: lane });
  }
  this.burst = function (node, d, count) {
    if (!city.nodeFrom(node, (d + 2) % 4)) return 0;   // 차가 들어오는 쪽 교차로가 있어야 대열이 생긴다
    self.flow = { node: node, d: d, left: count, t: 0, lane: 0 };
    return count;
  };
  // 흐름 주입(update 에서 호출): 1.1초마다 한 대씩 — 12m 간격으로 들어와 정지선 앞에서 다져진다
  function flowUpdate(dt) {
    var F = self.flow; if (!F || F.left <= 0) return;
    F.t -= dt; if (F.t > 0) return;
    var rd = city.roadOf(F.node, F.d), nL = city.lanesOf(rd.axis, rd.idx);
    var c = injectOne(F.node, F.d, F.lane % nL); F.lane++;
    if (c) { F.left--; F.t = 1.1; } else F.t = 0.6;
  }
  // ---------- 2단계: 바깥 차로 임시 차단 ----------
  this.closeLane = function (node, d) {
    var rd = city.roadOf(node, d), n = city.lanesOf(rd.axis, rd.idx);
    if (n < 2) return { ok: false, why: '차로가 하나뿐인 도로입니다' };
    for (var i = 0; i < self.closed.length; i++) if (self.closed[i].node === node && self.closed[i].d === d) return { ok: false, why: '이미 차단한 방향입니다' };
    var f = TG.DIR_VEC[d], r = [-f[1], f[0]], lo = city.laneOff(rd.axis, rd.idx, n - 1), sd = city.stopDist(node, d);
    if (!self.cones) { self.cones = new THREE.Group(); game.scene.add(self.cones); }
    for (var k = 0; k < 7; k++) {
      var back = sd + 4 + k * 5, gb = new TG.GeoBuilder();
      gb.cylinder(0, 0, 0, 0.26, 0.06, 0.72, 8, 0xff7a00, true); gb.box(0, 0.02, 0, 0.5, 0.04, 0.5, 0x2a2e33, {}); gb.cylinder(0, 0.34, 0, 0.16, 0.13, 0.1, 8, 0xf2f2f2, false);
      var m = new THREE.Mesh(gb.build(), new THREE.MeshLambertMaterial({ vertexColors: true }));
      m.position.set(node.x - f[0] * back + r[0] * lo, 0, node.z - f[1] * back + r[1] * lo);
      self.cones.add(m);
    }
    self.closed.push({ node: node, d: d, lane: n - 1 });
    traffic.control.closed = self.closed;
    return { ok: true, name: APPROACH[d] + ' 바깥 ' + n + '차로' };
  };
  this.openLanes = function () {
    self.closed.length = 0; traffic.control.closed = self.closed;
    if (self.cones) { game.scene.remove(self.cones); self.cones = null; }
  };
  // ---------- 꼬리 끊기: 수신호로 한 접근로의 진입을 끊는다 ----------
  this.setHand = function (node, d, on) {
    self.hand = on ? { node: node, d: d } : null;
    traffic.control.hand = on ? [{ node: node, d: d }] : [];
    return self.hand;
  };
  // ---------- 근무 평가 ----------
  // 10초마다: 꼬리물기 0 + 최대 대기 8대 이하면 「소통 양호」(+), 꼬리물기가 6초 넘게 이어지면 경고
  var tick = 0;
  this.update = function (dt) {
    var node = self.node; if (!node) return;
    flowUpdate(dt);
    var st = self.stats(node); if (!st) return;
    self.last = st;
    self.score.gridT = st.grid > 0 ? self.score.gridT + dt : 0;
    self.score.bestQueue = Math.min(self.score.bestQueue, st.worstN);
    if (self.score.gridT > 6 && !self.warned) {
      self.warned = true;
      game.hud.notice('⚠ 꼬리물기 발생 — 1단계 신호기 수동 조작, 안 되면 2단계 차로 차단·꼬리 끊기', 'warn', 4600);
      game.hud.hint('교차로 안에 차가 갇히면 모든 방향이 멈춘다. 진입을 끊어 공간을 먼저 확보한다');
    }
    if (st.grid === 0) self.warned = false;
    tick -= dt;
    if (tick <= 0) {
      tick = 10;
      if (st.grid === 0 && st.worstN <= 8) {
        self.score.good++; self.score.cleared++;
        game.addScore(S.junctionGood, null);
        game.stats.junction = (game.stats.junction || 0) + 1;
        game.hud.notice('✅ 소통 양호 — 꼬리물기 없음, 최대 대기 ' + st.worstN + '대 (+' + S.junctionGood + ')', 'good', 3200);
      } else if (st.grid > 0) {
        game.penalize('junctionJam', '교차로 정체 지속(꼬리물기 ' + st.grid + '대)', '정체가 심한 방향에 녹색을 더 주고, 진입은 끊는다');
      }
    }
  };
  // HUD 한 줄 요약
  this.line = function () {
    var st = self.last; if (!st) return '';
    var node = self.node, mi = signals.manualInfo(node);
    var dirs = ['남', '동', '북', '서'], parts = [];
    for (var d = 0; d < 4; d++) if (st.q[d].n) parts.push(dirs[d] + ' ' + st.q[d].n);
    return (mi.manual ? '🔧 수동' : '🤖 자동') + ' · ' + (mi.axis === 'v' ? '남북 녹색' : mi.axis === 'h' ? '동서 녹색' : '전환 중') +
           ' ' + Math.round(mi.elapsed) + '초 · 대기[' + (parts.join(' ') || '없음') + ']' + (st.grid ? ' · ⚠ 꼬리물기 ' + st.grid : '');
  };
  // ---------- 신호제어기(제어함) ----------
  // 실제 교차로 모퉁이에 서 있는 회색 강철 함체. 문을 열면 자동/수동 전환 스위치가 있다.
  // 게임에서는 함체 3.2m 안으로 걸어가야 조작판이 열린다(순찰차에서 조작할 수 없다 — 하차 근무다).
  this.placeBox = function (node, sx, sz) {
    // 보도 위, 교차로 모퉁이에서 9m 떨어진 곳(횡단보도 끝·보행 신호등 기둥과 겹치지 않는 자리)
    var x = node.x + sx * city.sideOff('v', node.i), z = node.z + sz * (city.halfH[node.j] + 9), gb = new TG.GeoBuilder();
    gb.box(0, 0.06, 0, 1.05, 0.12, 0.8, 0x9aa0a6, {});                       // 기초 콘크리트
    gb.box(0, 0.80, 0, 0.78, 1.36, 0.52, 0x8d949c, {});                      // 함체
    gb.box(0, 0.80, 0.27, 0.70, 1.24, 0.03, 0x7d848c, {});                   // 문
    gb.box(0.28, 0.80, 0.30, 0.05, 0.20, 0.04, 0x2a2e33, {});                // 손잡이·시건장치
    gb.box(0, 1.28, 0.29, 0.46, 0.14, 0.02, 0xe8edf2, {});                   // 명판(교통신호제어기)
    for (var v = 0; v < 4; v++) gb.box(0, 0.36 + v * 0.09, 0.29, 0.50, 0.03, 0.02, 0x5e666e, {});   // 통풍 루버
    gb.box(0, 1.50, 0, 0.86, 0.08, 0.60, 0x767d85, {});                      // 상단 처마
    var m = new THREE.Mesh(gb.build(), new THREE.MeshLambertMaterial({ vertexColors: true }));
    m.position.set(x, game.terrain ? game.terrain.heightAt(x, z) : 0, z);
    m.rotation.y = Math.atan2(-sx, 0);                                       // 문이 차도 쪽(근무자가 서는 쪽)을 본다
    game.scene.add(m);
    var lamp = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 6), new THREE.MeshBasicMaterial({ color: 0x39d353 }));
    lamp.position.set(0.28, 1.44, 0.20); m.add(lamp);
    self.box = { mesh: m, lamp: lamp, x: x, z: z };
    return self.box;
  };
  this.setBoxLamp = function (manual) { if (self.box) self.box.lamp.material.color.setHex(manual ? 0xffb020 : 0x39d353); };
  this.nearBox = function (x, z) { return self.box ? Math.hypot(x - self.box.x, z - self.box.z) : 999; };
  // 이 교차로에서 실제로 대열이 생기는 접근로(앞뒤로 도로가 이어진 방향)
  this.dirsAvail = function (node) {
    node = node || self.node; var out = [];
    for (var d = 0; d < 4; d++) if (city.nodeFrom(node, (d + 2) % 4)) out.push(d);   // 차가 들어오는 쪽이 있으면 대열이 생긴다
    return out;
  };
  this.dispose = function () {
    self.openLanes(); self.setHand(null, 0, false);
    if (self.node) signals.setManual(self.node, false);   // 근무를 마치면 신호기는 자동 운영으로 돌려놓는다
    if (self.box) { game.scene.remove(self.box.mesh); self.box = null; }
  };
  this.dirName = function (d) { return APPROACH[d]; };
};
