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
  // (v0.10.62 · 소유자 「교통시설도 고도화 시키자 우리동네와 그 밑부분들」) 칸을 누르면 그 교차로 카드 — 동 · 실제 사고와 경위 · 신호 · 내 장비 · 효과 기록 · 내 지수,
  //  그리고 🚓 여기서 출근 · 🏗 교통시설에서 보기 · 🗜 데이터 압축지도. 위에는 「지금 가장 지켜야 할 곳」, 아래에는 동별 평균.
  var selK = null, XI = null;
  function loadXI() {   // 교차로 실제 위경도(데이터 압축지도로 잇는다) — 한 번만 읽는다
    if (XI !== null) return; XI = false;
    try { fetch('data/intersections-seocho.json').then(function (r) { return r.json(); }).then(function (j) { XI = {}; (j.nodes || []).forEach(function (n) { XI[n.i + ',' + n.j] = n; }); if (self.isOpen()) self.open(); }).catch(function () {}); } catch (e) { }
  }
  function focusPick(c, rm) {   // 실제 사고가 많은데 아직 지수가 낮은 곳
    var best = null, bs = -1;
    for (var i = 0; i < c.xs.length; i++) for (var j = 0; j < c.zs.length; j++) {
      var k = i + ',' + j, r = rm[k]; if (!r) continue;
      var s = r.score * (1 - self.index(k, rm) / 100); if (s > bs) { bs = s; best = { k: k, r: r, ix: self.index(k, rm) }; }
    }
    return best;
  }
  function detailHtml(k, rm) {
    var c = game.city, ij = k.split(','), i = +ij[0], j = +ij[1], nd = c.nodes[i] && c.nodes[i][j]; if (!nd) return '';
    var r = rm[k], ix = self.index(k, rm), need = needOf(k, rm), pts = db.pts[k] || 0, L = game.layers;
    var h = '<div class="hdet"><div class="hdet-h"><b>' + esc(c.nodeName(nd)) + '</b>';
    var dl = game.pop && game.pop.dongLabel ? game.pop.dongLabel(nd) : ''; if (dl) h += '<span>🏘 ' + esc(dl) + '</span>';
    h += '</div><div class="hbar"><i style="width:' + ix + '%;background:' + color(ix) + '"></i><span>안전 지수 ' + ix + ' · 모은 점수 ' + pts + ' / ' + need + '</span></div>';
    if (r) {
      var cv = L && L.nodeViolations ? L.nodeViolations(i, j) : null;
      h += '<div class="hrow">🚗 실제 사고 <b>' + r.total + '건</b>' + (r.death ? ' · 사망 ' + r.death : '') + ' <i>(TAAS ' + esc(L && L.realYears ? L.realYears() : '') + ')</i></div>';
      if (cv && cv.violations && cv.violations.length) h += '<div class="hrow">🔎 주된 경위 — ' + cv.violations.slice(0, 3).map(function (v) { return esc(v[0]) + ' ' + v[1]; }).join(' · ') + '</div>';
    } else h += '<div class="hrow dim">🚗 이 지도에는 이 교차로의 사고 자료가 없습니다</div>';
    var ci = game.signals && game.signals.cycleInfo ? game.signals.cycleInfo(nd) : null;
    if (ci && ci.target) h += '<div class="hrow">🚦 신호 주기 ' + ci.target + '초 ' + (ci.real ? '(경찰청 실측)' : '(추정)') + '</div>';
    var F = game.facil;
    if (F) {
      var nc = F.camsAt ? F.camsAt(nd).length : 0; if (nc) h += '<div class="hrow">📷 내가 세운 무인 단속 장비 ' + nc + '대</div>';
      var rows = F.obsRows ? F.obsRows(nd) : [], cur = rows.filter(function (x) { return x.cur; })[0];
      if (cur && cur.min > 0.1) h += '<div class="hrow">📈 지켜본 ' + cur.min.toFixed(1) + '분 · 기록된 위반 ' + (cur.red + cur.speed + cur.ped + cur.grid) + '건' + (cur.min >= 5 ? ' (10분당 ' + cur.per10.toFixed(1) + ')' : '') + '</div>';
    }
    var xi = XI && XI[k];
    h += '<div class="hbtns"><button class="primary" data-hgo="' + k + '">🚓 여기서 출근</button><button data-hplan="' + k + '">🏗 교통시설에서 보기</button>' +
      (xi && xi.lat ? '<a class="hlink" target="_blank" rel="noopener" href="map2d.html#lat=' + xi.lat + '&lon=' + xi.lon + '">🗜 데이터 압축지도</a>' : '') + '</div>';
    if (xi && xi.met === false) h += '<div class="hrow dim">※ 이 두 도로는 실제로는 만나지 않는다(' + esc(xi.why || '') + ') — 축약 지도의 교차로다</div>';
    return h + '</div>';
  }
  this.open = function (k) {
    var c = game.city; if (!c) return;
    loadXI();
    if (!el) {
      el = document.createElement('div'); el.id = 'hood'; el.className = 'overlay hood';
      el.addEventListener('click', function (e) { if (e.target === el) self.close(); });
      document.body.appendChild(el);
    }
    if (typeof k === 'string') selK = k;
    var rm = realMap(), cells = '';
    for (var j = 0; j < c.zs.length; j++) for (var i = 0; i < c.xs.length; i++) {
      var kk = i + ',' + j, ix = self.index(kk, rm), r = rm[kk], nd = c.nodes[i][j];
      cells += '<button class="hcell' + (kk === selK ? ' sel' : '') + '" data-hk="' + kk + '" style="--hc:' + color(ix) + '" title="' + esc(c.nodeName(nd)) + '"><b>' + ix + '</b><span>' + esc(c.nodeName(nd).replace(/ ?(사거리|교차로)$/, '')) + '</span>' +
        (r ? '<i>사고 ' + r.total + (r.death ? ' · 사망 ' + r.death : '') + '</i>' : '<i>자료 없음</i>') + '</button>';
    }
    var fp = focusPick(c, rm);
    var focus = fp ? '<button class="hfocus" data-hk="' + fp.k + '">🎯 지금 가장 지켜야 할 곳 — <b>' + esc(c.nodeName(c.nodes[+fp.k.split(',')[0]][+fp.k.split(',')[1]])) + '</b> · 실제 사고 ' + fp.r.total + '건 · 지수 ' + fp.ix + '</button>' : '';
    // 동별 평균(통계청 행정동 경계로 판정한 교차로의 동)
    var dongs = {};
    if (game.pop && game.pop.dongInfo) for (var a = 0; a < c.xs.length; a++) for (var b = 0; b < c.zs.length; b++) {
      var di = game.pop.dongInfo(c.nodes[a][b]); if (!di || !di.name) continue;
      var dd = dongs[di.name] || (dongs[di.name] = { n: 0, s: 0 }); dd.n++; dd.s += self.index(a + ',' + b, rm);
    }
    var dk = Object.keys(dongs).sort(function (x, y) { return dongs[x].s / dongs[x].n - dongs[y].s / dongs[y].n; });
    var dongH = dk.length ? '<div class="hdongs"><b>🏘 동별 평균</b>' + dk.map(function (n) { var v = Math.round(dongs[n].s / dongs[n].n); return '<span style="--hc:' + color(v) + '">' + esc(n) + ' ' + v + '</span>'; }).join('') + '</div>' : '';
    el.innerHTML = '<div class="card wide hood-card"><div class="badge">🗺 우리 동네 — 안전 지수</div><h2>동네 평균 ' + self.average() + '</h2>' +
      '<div class="dim small">교차로를 지키고 그 자리에서 맡은 일을 끝내면 지수가 오릅니다. 실제 사고가 많은 곳(TAAS ' + esc(game.layers && game.layers.realYears ? game.layers.realYears() : '') + ')일수록 더 오래 지켜야 합니다. 칸을 누르면 그 교차로를 봅니다. 지수는 게임 설계값이며 실제 안전도가 아닙니다.</div>' +
      focus +
      '<div class="hgrid" style="grid-template-columns:repeat(' + c.xs.length + ',1fr)">' + cells + '</div>' +
      '<div class="hlegend"><span style="--hc:#d9534f">0~33</span><span style="--hc:#e0a93a">34~66</span><span style="--hc:#3fbf6f">67~100</span><span class="dim">위가 북쪽</span></div>' +
      (selK ? detailHtml(selK, rm) : '<div class="hrow dim">▲ 칸을 누르면 그 교차로의 동 · 실제 사고 · 신호 · 효과 기록이 나옵니다</div>') +
      dongH +
      '<button class="primary" id="hoodX">닫기</button></div>';
    el.style.display = 'flex';
    document.getElementById('hoodX').addEventListener('click', self.close);
    Array.prototype.forEach.call(el.querySelectorAll('[data-hk]'), function (b) { b.addEventListener('click', function () { selK = b.getAttribute('data-hk'); self.open(); var d = el.querySelector('.hdet'); if (d && d.scrollIntoView) d.scrollIntoView({ block: 'nearest' }); }); });
    var go = el.querySelector('[data-hgo]'); if (go) go.addEventListener('click', function () { var p = go.getAttribute('data-hgo').split(','); self.close(); if (game.startPatrolAt) game.startPatrolAt(+p[0], +p[1]); });
    var pl = el.querySelector('[data-hplan]'); if (pl) pl.addEventListener('click', function () { var p = pl.getAttribute('data-hplan').split(','); self.close(); if (game.openPlan) game.openPlan(c.nodes[+p[0]][+p[1]]); });
    if (game.setPaused) game.setPaused(true, 'hood');
  };
  this.selected = function () { return selK; };
  this.close = function () { if (el) el.style.display = 'none'; if (game.setPaused) game.setPaused(false, 'hood'); };
  this.isOpen = function () { return !!el && el.style.display !== 'none'; };
};
