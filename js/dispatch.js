// 112 긴급출동 연습(코드0·코드1) — 순찰 근무 중 상황실 신고가 들어오면 경광등·사이렌을 켜고 현장으로 간다.
// 소유자: 「긴급자동차 운전 방법 코드1 코드0 신고를 받고 4거리를 통과하는 법과 항상 안전을 확보하며 긴급자동차를 신속 안전운전하는 방법」.
// 법령·규칙 문구는 data/laws.json 의 emergency 블록(티북 원문)에서만 읽는다. 시간·속도 기준은 게임 설계값(config).
TG.Dispatch = function (game) {
  var self = this, cfg = TG.CONFIG, city = game.city;
  var scene = game.scene || (game.player && game.player.mesh && game.player.mesh.parent) || null;
  this.active = null; this.dest = null; this.nextT = 40 + Math.random() * 40;
  function law() { return (game.laws && game.laws.emergency) || null; }
  function codeText(code) { var L = law(), c = L && L.codes && L.codes['' + code]; return c || { name: '코드' + code, what: '' }; }
  this.msg = function (k) { var L = law(); return (L && L.msgs && L.msgs[k]) || null; };
  // 긴급 용도(특례의 첫 요건)인가 — 코드0·1 만. 코드2 는 사안별이라 이 연습에서는 일반 출동으로 둔다(티북).
  this.emergency = function () { return !!(self.active && (self.active.code === 0 || self.active.code === 1)); };

  // 목적지 표지: 파란 빛기둥 + 바닥 고리(보행 목적지의 노란색과 구분한다)
  var beam = null, ring = null;
  if (scene) {
    beam = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 46, 8, 1, true), new THREE.MeshBasicMaterial({ color: 0x4da3ff, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide }));
    ring = new THREE.Mesh(new THREE.RingGeometry(3.0, 4.0, 32), new THREE.MeshBasicMaterial({ color: 0x4da3ff, transparent: true, opacity: 0.75, depthWrite: false, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; beam.visible = ring.visible = false; scene.add(beam); scene.add(ring);
  }
  function showMarker(on, x, z) {
    if (!beam) return;
    beam.visible = ring.visible = !!on;
    if (on) { var y = (game.terrain && game.terrain.heightAt) ? game.terrain.heightAt(x, z) : 0; beam.position.set(x, y + 23, z); ring.position.set(x, y + 0.15, z); }
  }
  function pickDest() {
    var pl = game.player, list = [];
    for (var i = 0; i < city.xs.length; i++) for (var j = 0; j < city.zs.length; j++) {
      var n = city.nodes[i][j], d = Math.hypot(n.x - pl.pos.x, n.z - pl.pos.z);
      if (d > 200 && d < 520) list.push(n);
    }
    return list.length ? list[Math.floor(Math.random() * list.length)] : null;
  }
  // 신고를 받는다. code 0·1 = 긴급 출동, 2 = 일반 출동. node 를 주면 그 교차로(검증·체험).
  this.call = function (code, node) {
    if (self.active) return null;
    node = node || pickDest(); if (!node) return null;
    if (code === undefined) code = Math.random() < 0.3 ? 0 : (Math.random() < 0.8 ? 1 : 2);
    var pl = game.player, dist = Math.hypot(node.x - pl.pos.x, node.z - pl.pos.z);
    var limit = Math.round(dist / 100 * (cfg.DISPATCH_SEC_PER_100M || 16)) + 10;
    self.active = { code: code, node: node, t: 0, limit: limit, name: city.nodeName ? city.nodeName(node) : '교차로' };
    self.dest = { x: node.x, z: node.z, name: self.active.name };
    showMarker(true, node.x, node.z);
    var ct = codeText(code);
    game.hud.notice('📡 112 ' + ct.name + (ct.what ? '(' + ct.what + ')' : '') + ' — ' + self.active.name + ' 부근. ' +
                    (code <= 1 ? '긴급 출동: 경광등·사이렌, 교차로는 서행' : '일반 출동: 신호·속도를 지킨다'), 'alert', 6000);
    if (TG.audio.squelch) TG.audio.squelch();
    TG.audio.say('상황실에서 알립니다. ' + ct.name + ', ' + self.active.name + ' 부근 신고입니다', { kind: 'narrator', queue: true });
    game.stats.dispatches = (game.stats.dispatches || 0) + 1;
    return self.active;
  };
  // 이 교차로를 지금 지나가면 부딪칠 상대가 있는가 — 교차 방향으로 교차로 쪽에 오는 차, 또는 건널 횡단보도 위의 사람
  // (대법 2017도12194: 진행방향에 보행자·교차 진행 차량이 있으면 긴급자동차도 정지해야 한다 — 티북)
  this.crossConflict = function (node, d) {
    var f = TG.DIR_VEC[d], hit = false;
    (game.traffic.cars || []).forEach(function (c) {
      if (hit || c.v < 2 || c.mode !== 'drive') return;
      var dx = c.pos.x - node.x, dz = c.pos.z - node.z;
      if (Math.hypot(dx, dz) > 32) return;
      var cf = [Math.sin(c.heading), Math.cos(c.heading)];
      if (Math.abs(cf[0] * f[0] + cf[1] * f[1]) < 0.5 && (-dx * cf[0] - dz * cf[1]) > -2) hit = true;   // 교차 방향이면서 교차로 쪽으로 오는 중
    });
    if (!hit && game.peds && game.peds.onCrossing) hit = game.peds.onCrossing(node, d) || game.peds.onCrossing(node, (d + 2) % 4);
    return hit;
  };
  this.update = function (dt) {
    var pl = game.player; if (!pl || !pl.pos) return;
    if (!self.active) {
      if (game.mode !== 'patrol' || game.state !== 'play' || game.afoot) return;
      self.nextT -= dt;
      if (self.nextT <= 0) {
        var ev = cfg.DISPATCH_EVERY || [90, 150];
        self.nextT = ev[0] + Math.random() * (ev[1] - ev[0]);
        if (!(game.enforcement && game.enforcement.state !== 'idle') && !(game.chase && game.chase.car)) self.call();
      }
      return;
    }
    var a = self.active; a.t += dt;
    var d = Math.hypot(a.node.x - pl.pos.x, a.node.z - pl.pos.z);
    if (!game.afoot && game.enforcement && game.enforcement.state === 'idle' && !game.selected)
      game.hud.setTarget('🚨 ' + codeText(a.code).name + ' · ' + a.name + ' ' + Math.round(d) + 'm · ' + Math.max(0, Math.ceil(a.limit - a.t)) + '초');
    if (beam) beam.visible = d > 12;
    if (d < 18 && pl.speedKmh() < 15) self.arrive();
    else if (a.t > a.limit + 120) self.cancel('출동 시간이 많이 지났습니다 — 인접 순찰차가 먼저 도착해 처리했습니다');
  };
  this.arrive = function () {
    var a = self.active, on = a.t <= a.limit, S = cfg.SCORE;
    if (game.addScore) game.addScore(on ? S.dispatchArrive : S.dispatchLate, null);
    if (on) game.stats.dispatchOnTime = (game.stats.dispatchOnTime || 0) + 1;
    game.hud.notice('🚨 현장 도착 — ' + a.name + ' · ' + Math.round(a.t) + '초' + (on ? ' (제시간 +' + S.dispatchArrive + ')' : ' (늦음 +' + S.dispatchLate + ')'), 'good', 3600);
    var m = self.msg('arrive'); if (m) game.hud.hint(m);
    self.clear();
  };
  this.cancel = function (why) { if (!self.active) return; game.hud.notice('📡 ' + why, 'warn', 3200); self.clear(); };
  this.clear = function () {
    self.active = null; self.dest = null; showMarker(false);
    if (!game.afoot && game.enforcement && game.enforcement.state === 'idle' && !game.selected) game.hud.setTarget(null);
  };
  this.dispose = function () { if (scene && beam) { scene.remove(beam); scene.remove(ring); } };
};
