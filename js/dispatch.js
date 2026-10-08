// 112 긴급출동 연습(코드0·코드1) — 순찰 근무 중 상황실 신고가 들어오면 경광등·사이렌을 켜고 현장으로 간다.
// 소유자: 「긴급자동차 운전 방법 코드1 코드0 신고를 받고 4거리를 통과하는 법과 항상 안전을 확보하며 긴급자동차를 신속 안전운전하는 방법」.
// 법령·규칙 문구는 data/laws.json 의 emergency 블록(티북 원문)에서만 읽는다. 시간·속도 기준은 게임 설계값(config).
TG.Dispatch = function (game) {
  var self = this, cfg = TG.CONFIG, city = game.city;
  var scene = game.scene || (game.player && game.player.mesh && game.player.mesh.parent) || null;
  this.active = null; this.dest = null; this.nextT = 30 + Math.random() * 15;   // v0.10.108 첫 신고 30~45초(종전 40~80 — 첫 1분 계측에서 첫 112 가 75~79초에 와 첫 위반 포착(20초 무렵) 뒤 40초 넘게 빈 근무가 됐다) · 그다음은 DISPATCH_EVERY
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
  // ---------- 🚨 동시 신고(v0.10.109 · 소유자 「재미가 없어」 → 외부 의견 중 실제로 빠진 것 하나 「우선순위 판단」) ----------
  //  두 번째 신고부터 60% 로 두 건이 함께 들어온다. 8초 안에 어디로 갈지 고른다 — 정답 = 코드 숫자가 작은 쪽(112 신고처리 규칙 §6 코드 구분 · laws.json emergency.codes),
  //  같은 코드면 가까운 쪽. 맞히면 칭찬·경험치, 틀려도 **벌하지 않는다**(콤보만 끊기고 왜 그런지 한 줄). 안 고르면 상황실이 급한 쪽을 지정한다(보상 없음).
  //  고르지 않은 신고는 「인접 순찰차가 맡는다」 — 근무에 남지 않는다. 시간은 게임 시계(dt)라 검사 step 으로도 돈다.
  this.pair = null;
  var PICK_SEC = 8, pickEl = null;
  function pickBox() {
    if (pickEl) return pickEl;
    pickEl = document.createElement('div'); pickEl.id = 'dpPick'; pickEl.innerHTML = '<div class="dp-h">📡 112 신고 두 건 — 어디부터?</div><div class="dp-b"></div><div class="dp-bar"><i></i></div>';
    document.body.appendChild(pickEl);
    pickEl.addEventListener('pointerdown', function (e) { var b = e.target.closest('button'); if (!b) return; e.preventDefault(); e.stopPropagation(); self.choose(+b.getAttribute('data-i')); });
    pickEl.addEventListener('touchstart', function (e) { e.preventDefault(); }, { passive: false });
    window.addEventListener('keydown', function (e) { if (!self.pair) return; if (e.code === 'Digit1' || e.key === '1') self.choose(0); else if (e.code === 'Digit2' || e.key === '2') self.choose(1); });
    return pickEl;
  }
  function bestOf(P) { var a = P.opts[0], b = P.opts[1]; return a.code !== b.code ? (a.code < b.code ? 0 : 1) : (a.dist <= b.dist ? 0 : 1); }
  this.offer = function () {
    if (self.active || self.pair) return null;
    var n1 = pickDest(), n2 = null, k = 0; while (k++ < 12) { n2 = pickDest(); if (n2 && n2 !== n1) break; }
    if (!n1 || !n2 || n1 === n2) return self.call();
    var c1 = Math.random() < 0.5 ? 0 : 1, c2 = Math.random() < 0.3 ? c1 : Math.min(2, c1 + 1 + (Math.random() < 0.4 ? 1 : 0));
    if (Math.random() < 0.5) { var t = c1; c1 = c2; c2 = t; }
    var pl = game.player, mk = function (node, code) { return { node: node, code: code, dist: Math.round(Math.hypot(node.x - pl.pos.x, node.z - pl.pos.z)), name: city.nodeName ? city.nodeName(node) : '교차로' }; };
    self.pair = { t: 0, opts: [mk(n1, c1), mk(n2, c2)] };
    var el = pickBox(), bx = el.querySelector('.dp-b');
    bx.innerHTML = self.pair.opts.map(function (o, i) { var ct = codeText(o.code); return '<button data-i="' + i + '" class="dp-o c' + o.code + '"><b>' + (i + 1) + ' · ' + ct.name + '</b><span>' + o.name + ' · ' + o.dist + 'm</span><small>' + (ct.what || '') + '</small></button>'; }).join('');
    el.classList.add('on'); el.querySelector('.dp-bar i').style.width = '100%';
    if (TG.audio.squelch) TG.audio.squelch();
    TG.audio.say('상황실에서 알립니다. 신고 두 건, 어디부터 가겠습니까', { kind: 'narrator', queue: true });
    if (game.metrics) game.metrics.ev('dispatch');
    return self.pair;
  };
  this.choose = function (i, auto) {
    var P = self.pair; if (!P) return null; self.pair = null; if (pickEl) pickEl.classList.remove('on');
    var best = bestOf(P), o = P.opts[auto ? best : i], other = P.opts[auto ? 1 - best : 1 - i], bo = P.opts[best], ok = !auto && i === best;
    var got = self.call(o.code, o.node); if (!got) return null;
    var why = P.opts[0].code !== P.opts[1].code ? codeText(bo.code).name + '이 더 급하다 — 코드 숫자가 작을수록 먼저' : '같은 코드면 가까운 곳부터';
    game.stats.triage = (game.stats.triage || 0) + 1; if (ok) game.stats.triageOk = (game.stats.triageOk || 0) + 1;
    if (auto) game.hud.notice('📡 상황실 지정 — ' + codeText(o.code).name + ' ' + o.name + ' · 다른 신고는 인접 순찰차가 맡는다', 'info', 3600);
    else if (ok) { if (game.praise) game.praise.cheer('triage', 15, { feed: '출동 판단 — ' + codeText(o.code).name + ' 먼저', voice: true }); game.hud.notice('👍 ' + why + ' · ' + other.name + ' 신고는 인접 순찰차가 맡는다', 'info', 3600); }
    else { if (game.praise) game.praise.miss(true); game.hud.notice('💭 ' + why + ' · ' + other.name + ' 신고는 인접 순찰차가 맡는다', 'info', 4200); }
    return { ok: ok, auto: !!auto, chosen: o, other: other };
  };
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
    if (game.cinema && code <= 1) game.cinema.stamp(ct.name, self.active.name + ' 부근', 'urgent');   // 🎬 v0.10.16 — 코드0·1 은 「출동」의 순간이다
    game.hud.notice('📡 112 ' + ct.name + ' — ' + self.active.name + ' 부근', 'alert', 3200);   // 📏 v0.10.15 — 자리·남은 시간은 목표 줄에 계속 떠 있다
    game.hud.hint(code <= 1 ? '긴급 출동 — 경광등·사이렌, 교차로는 서행' : '일반 출동 — 신호·속도를 지킨다');
    if (TG.audio.squelch) TG.audio.squelch();
    if (game.crew) game.crew.say('dispatch', 6, 90);
    if (game.metrics) game.metrics.ev('dispatch');
    TG.audio.say('상황실에서 알립니다. ' + ct.name + ', ' + self.active.name + ' 부근 신고입니다', { kind: 'narrator', queue: true });
    game.stats.dispatches = (game.stats.dispatches || 0) + 1;
    return self.active;
  };
  // 이 교차로를 지금 지나가면 부딪칠 상대가 있는가 — 교차 방향으로 교차로 쪽에 오는 차, 또는 건널 횡단보도 위의 사람
  // (대법 2017도12194: 진행방향에 보행자·교차 진행 차량이 있으면 긴급자동차도 정지해야 한다 — 티북)
  this.crossConflict = function (node, d) {
    var f = TG.DIR_VEC[d], hit = false;
    (game.traffic.cars || []).forEach(function (c) {
      // 소유자(현장): 「신호를 뚫고 갈 수 있지만 안전이 확보된 뒤 **차량들이 정지한 것을 확인하고** 이동」 — 아직 움직이는 차(0.5m/s 넘게)는 다 센다
      if (hit || c.v < 0.5 || c.mode !== 'drive') return;
      var dx = c.pos.x - node.x, dz = c.pos.z - node.z;
      if (Math.hypot(dx, dz) > 60) return;   // 달려오는 차도 멈춰야 「확인」이다(40m 로는 먼 차를 못 보고 「정지 확인」이 먼저 떴다)
      var cf = [Math.sin(c.heading), Math.cos(c.heading)];
      if (Math.abs(cf[0] * f[0] + cf[1] * f[1]) < 0.5 && (-dx * cf[0] - dz * cf[1]) > -2) hit = true;   // 교차 방향이면서 교차로 쪽으로 오는 중
    });
    if (!hit && game.peds && game.peds.onCrossing) hit = game.peds.onCrossing(node, d) || game.peds.onCrossing(node, (d + 2) % 4);
    return hit;
  };
  this.update = function (dt) {
    var pl = game.player; if (!pl || !pl.pos) return;
    if (self.pair) { self.pair.t += dt; if (pickEl) pickEl.querySelector('.dp-bar i').style.width = Math.max(0, 100 - self.pair.t / PICK_SEC * 100).toFixed(1) + '%'; if (self.pair.t >= PICK_SEC || game.state !== 'play') self.choose(0, true); return; }
    if (!self.active) {
      if (!(game.mode === 'patrol' || game.mode === 'open') || game.state !== 'play' || game.afoot) return;
      self.nextT -= dt;
      if (self.nextT <= 0) {
        var ev = cfg.DISPATCH_EVERY || [90, 150];
        self.nextT = ev[0] + Math.random() * (ev[1] - ev[0]);
        if (!(game.enforcement && game.enforcement.state !== 'idle') && !(game.chase && game.chase.car)) { if ((game.stats.dispatches || 0) >= 1 && Math.random() < 0.6) self.offer(); else self.call(); }
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
