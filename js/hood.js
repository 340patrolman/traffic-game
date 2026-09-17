// 🗺 동네 안전 지수 지도(재미 설계서 5절 #6 · 7절 3단계) — 「내 손으로 바뀐 동네」(Animal Crossing 의 메타 루프).
//  교차로마다 **지킨 만큼** 지수가 오른다. 실제 사고가 많은 교차로(TAAS 교차로별 집계)일수록 더 오래 지켜야 오른다.
//   · 근무(순찰·교차로·도보·추격) 중 교차로 45m 안에서 움직이면 10초에 1점(한 근무 한 교차로 최대 6점)
//   · 그 교차로 70m 안에서 맡은 일을 끝내면: 정차·고지 +4 · 현장 안전조치 +5 · 112 출동 +4 · 위반 포착 +1 (한 근무 한 교차로 최대 20점)
//   · 필요 점수 = 20 + √(실제 사고 점수) × 4 — 실제 사고 점수 = 건수 + 사망×6 + 중상×0.6(layers.compare 와 같은 가중)
//  지수 = 모은 점수 ÷ 필요 점수(0~100). **게임 설계값**이다 — 실제 안전도가 아니다(화면에 밝힌다).
//  기록은 기기에만(tg_hood). 🧪 시뮬레이션·교실에서는 쌓지 않는다. 벌(깎기)은 없다.
TG.Hood = function (game) {
  var self = this, db = TG.save.get('hood', null) || { pts: {} }, shift = null, tick = 0;
  if (!db.pts) db.pts = {};
  var MODES = { patrol: 1, duty: 1, walk: 1, chase: 1 };
  var EV = { pulloverDone: 4, incident: 5, dispatch: 4, violationSeen: 1 };
  function save() { TG.save.set('hood', db); }
  function sim() { return !!(TG.mode && TG.mode.sim); }
  function realMap() { var m = {}; (game.layers && game.layers.realNodes ? game.layers.realNodes() : []).forEach(function (r) { m[r.key] = r; }); return m; }
  function needOf(key, rm) { var r = (rm || realMap())[key]; return Math.round(20 + Math.sqrt(r ? r.score : 0) * 4); }
  this.need = function (key) { return needOf(key); };
  this.index = function (key, rm) { return Math.min(100, Math.round((db.pts[key] || 0) / needOf(key, rm) * 100)); };
  this.points = function (key) { return db.pts[key] || 0; };
  function actor() { var g = game; return (g.afoot || g.mode === 'walk' || g.mode === 'duty') && g.walker ? g.walker : g.player; }
  function nearest(maxD) {
    var a = actor(), city = game.city; if (!a || !city) return null;
    var nd = city.nearestNode ? city.nearestNode(a.pos.x, a.pos.z) : null; if (!nd) return null;
    return Math.hypot(nd.x - a.pos.x, nd.z - a.pos.z) <= maxD ? nd : null;
  }
  function add(key, n, kind) {
    if (!shift) return;
    var s = shift.nodes[key] || (shift.nodes[key] = { stay: 0, ev: 0, t: 0 });
    if (kind === 'stay') s.stay = Math.min(6, s.stay + n); else s.ev = Math.min(20, s.ev + n);
  }
  this.begin = function () { shift = (MODES[game.mode] && !sim()) ? { nodes: {} } : null; tick = 0; };
  this.update = function (dt) {
    if (!shift || game.state !== 'play') return;
    tick += dt; if (tick < 1) return;
    var step = tick; tick = 0;
    var a = actor(); if (!a) return;
    var sp = a.vF !== undefined ? Math.abs(a.vF) : (a.v || 0);
    if (sp < 0.4) return;                                              // 서 있기만 해서는 오르지 않는다
    var nd = nearest(45); if (!nd) return;
    var key = nd.i + ',' + nd.j, s = shift.nodes[key] || (shift.nodes[key] = { stay: 0, ev: 0, t: 0 });
    s.t += step;
    while (s.t >= 10) { s.t -= 10; add(key, 1, 'stay'); }
  };
  // 계측이 사건을 적을 때 부른다(metrics.ev)
  this.onEv = function (name) {
    if (!shift || !EV[name]) return;
    var nd = nearest(70); if (!nd) return;
    add(nd.i + ',' + nd.j, EV[name], 'ev');
  };
  // 근무 끝: 점수를 더하고 바뀐 교차로를 돌려준다(결과 카드)
  this.commit = function () {
    if (!shift) return null;
    var rm = realMap(), out = [];
    Object.keys(shift.nodes).forEach(function (k) {
      var s = shift.nodes[k], got = s.stay + s.ev; if (got <= 0) return;
      var before = self.index(k, rm);
      db.pts[k] = (db.pts[k] || 0) + got;
      var after = self.index(k, rm), nd = nodeOf(k);
      out.push({ key: k, name: nd ? game.city.nodeName(nd) : k, got: got, before: before, after: after });
    });
    shift = null; save();
    out.sort(function (a, b) { return (b.after - b.before) - (a.after - a.before) || b.got - a.got; });
    return out;
  };
  function nodeOf(k) { var p = k.split(','), c = game.city; return c && c.nodes[+p[0]] ? c.nodes[+p[0]][+p[1]] : null; }
  this.reset = function () { db = { pts: {} }; save(); };
  this.average = function () {
    var c = game.city; if (!c) return 0; var rm = realMap(), sum = 0, n = 0;
    for (var i = 0; i < c.xs.length; i++) for (var j = 0; j < c.zs.length; j++) { sum += self.index(i + ',' + j, rm); n++; }
    return n ? Math.round(sum / n) : 0;
  };
  function color(ix) { return ix >= 67 ? '#3fbf6f' : ix >= 34 ? '#e0a93a' : '#d9534f'; }
  this.color = color;
  // ---------- 화면: 🗺 우리 동네 ----------
  var el = null;
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (m) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]; }); }
  this.open = function () {
    var c = game.city; if (!c) return;
    if (!el) {
      el = document.createElement('div'); el.id = 'hood'; el.className = 'overlay hood';
      el.addEventListener('click', function (e) { if (e.target === el) self.close(); });
      document.body.appendChild(el);
    }
    var rm = realMap(), cells = '';
    for (var j = 0; j < c.zs.length; j++) for (var i = 0; i < c.xs.length; i++) {
      var k = i + ',' + j, ix = self.index(k, rm), r = rm[k], nd = c.nodes[i][j];
      cells += '<div class="hcell" style="--hc:' + color(ix) + '" title="' + esc(c.nodeName(nd)) + '"><b>' + ix + '</b><span>' + esc(c.nodeName(nd).replace(/ ?(사거리|교차로)$/, '')) + '</span>' +
        (r ? '<i>사고 ' + r.total + (r.death ? ' · 사망 ' + r.death : '') + '</i>' : '<i>자료 없음</i>') + '</div>';
    }
    el.innerHTML = '<div class="card wide hood-card"><div class="badge">🗺 우리 동네 — 안전 지수</div><h2>동네 평균 ' + self.average() + '</h2>' +
      '<div class="dim small">교차로를 지키고 그 자리에서 맡은 일을 끝내면 지수가 오릅니다. 실제 사고가 많은 곳(TAAS ' + esc(game.layers && game.layers.realYears ? game.layers.realYears() : '') + ')일수록 더 오래 지켜야 합니다. 지수는 게임 설계값이며 실제 안전도가 아닙니다.</div>' +
      '<div class="hgrid" style="grid-template-columns:repeat(' + c.xs.length + ',1fr)">' + cells + '</div>' +
      '<div class="hlegend"><span style="--hc:#d9534f">0~33</span><span style="--hc:#e0a93a">34~66</span><span style="--hc:#3fbf6f">67~100</span><span class="dim">위가 북쪽</span></div>' +
      '<button class="primary" id="hoodX">닫기</button></div>';
    el.style.display = 'flex';
    document.getElementById('hoodX').addEventListener('click', self.close);
    if (game.setPaused) game.setPaused(true, 'hood');
  };
  this.close = function () { if (el) el.style.display = 'none'; if (game.setPaused) game.setPaused(false, 'hood'); };
  this.isOpen = function () { return !!el && el.style.display !== 'none'; };
};
