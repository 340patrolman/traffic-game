// 📚 도감 3종(재미 설계서 5절 #8 · 7절 3단계) — 포켓몬식 수집. 「아직 못 본 칸」이 다음 근무의 이유가 된다.
//  ① 위반 도감: 정답으로 단속(정차·고지)했거나 📹 영상으로 남긴 위반 종류. 이름은 laws.json(violations)에서만 읽는다.
//  ② 인물 도감: 사건 사슬의 아는 얼굴(story.faces) — 만났는지 · 바뀌었는지.
//  ③ 교차로 도감: 동네 안전 지수(hood)에 점수가 한 번이라도 쌓인 교차로.
//  기록은 기기에만(tg_dex — 위반 도감만 따로 둔다. 인물·교차로는 이미 있는 기록을 읽는다). 🧪 시뮬레이션에서는 쌓지 않는다.
TG.Dex = function (game) {
  var self = this, db = TG.save.get('dex', null) || { viol: {} };
  if (!db.viol) db.viol = {};
  if (!db.places) db.places = {};
  // ④ 🏢 장소 도감(v0.10.62 · 「우리 동네와 그 밑부분들」 고도화) — 근무 중 **지나간** 역 출입구 · 랜드마크 · 기념물 · 국가유산.
  //  이 지도에 있는 것만 칸이 된다(지도마다 다르다). 이름으로 기억하므로 지도를 바꿔도 이어진다. 🧪 시뮬·교실에서는 쌓지 않는다.
  var LM_KO = { terminal: '고속버스터미널', hospital: '서울성모병원', library: '국립중앙도서관', arts: '예술의전당', court: '법원·검찰청', gu: '서초구청', stadium: '반포종합운동장', trade: '업무타워', twin: '아파트 타워' };
  var PMODES = { patrol: 1, open: 1, free: 1, duty: 1, walk: 1, chase: 1 }, placesC = null, placesN = -1, ptick = 0;
  function big() { return !!(TG.MAP && TG.MAP.scale1to1); }
  function placeList() {
    var c = game.city, hN = game.heritage && game.heritage.all ? game.heritage.all().length : 0;
    if (placesC && placesN === hN) return placesC;
    var out = [], seen = {};
    function add(name, kind, x, z, r) { if (!name || seen[name] || !isFinite(x) || !isFinite(z)) return; seen[name] = 1; out.push({ name: name, kind: kind, x: x, z: z, r: r }); }
    if (c) {
      (c.subways || []).forEach(function (s) { add(s.name, '🚇 역', s.x, s.z, big() ? 60 : 22); });
      (c.landmarks || []).forEach(function (L) { add(LM_KO[L.kind] || L.kind, '🏛 랜드마크', (L.x0 + L.x1) / 2, (L.z0 + L.z1) / 2, Math.max(L.x1 - L.x0, L.z1 - L.z0) / 2 + 10); });
      (c.monuments || []).forEach(function (M) { add(M.label || M.name, '🌳 기념물', M.x, M.z, (M.r || 9.5) + 15); });
    }
    if (game.heritage && game.heritage.all) game.heritage.all().forEach(function (p) { add(p.name, '🏯 국가유산', p.x, p.z, big() ? 60 : 14); });
    placesC = out; placesN = hN; return out;
  }
  this.update = function (dt) {
    if (sim() || game.state !== 'play' || !PMODES[game.mode]) return;
    ptick += dt; if (ptick < 1) return; ptick = 0;
    var a = (game.afoot || game.mode === 'walk' || game.mode === 'duty') && game.walker ? game.walker : game.player; if (!a || !a.pos) return;
    placeList().forEach(function (p) {
      if (db.places[p.name] || Math.hypot(p.x - a.pos.x, p.z - a.pos.z) > p.r) return;
      db.places[p.name] = { first: new Date().toISOString().slice(0, 10), kind: p.kind }; save();
      if (game.hud) game.hud.hint('📚 도감 — 새 장소 「' + p.name + '」(' + p.kind + ')');
      if (game.praise && game.praise.addXp && game.praise.feed) game.praise.feed('📚 장소 도감 · ' + p.name, game.praise.addXp(8, 'place'));
    });
  };
  this.hasPlace = function (n) { return !!db.places[n]; };
  this.placeCount = function () { var L = placeList(); return [L.filter(function (p) { return db.places[p.name]; }).length, L.length]; };
  function save() { TG.save.set('dex', db); }
  function sim() { return !!(TG.mode && TG.mode.sim); }
  // 근무 끝: 이번 근무의 종류별 정답 단속·영상 기록을 더한다. 처음 채운 칸을 돌려준다(결과 카드)
  this.commit = function (st) {
    if (sim() || !st) return [];
    var fresh = [], add = function (type, n) {
      if (!type || !n) return;
      var r = db.viol[type] || (db.viol[type] = { n: 0, first: null });
      if (!r.n) { r.first = new Date().toISOString().slice(0, 10); fresh.push(type); }
      r.n += n;
    };
    Object.keys(st.byType || {}).forEach(function (k) { if (k !== 'none') add(k, st.byType[k]); });
    Object.keys(st.videoTypes || {}).forEach(function (k) { add(k, st.videoTypes[k]); });
    if (fresh.length) save();
    return fresh.map(function (k) { return nameOf(k); });
  };
  function laws() { return (game.laws && game.laws.violations) || []; }
  function nameOf(k) { var v = laws().filter(function (x) { return x.id === k; })[0]; return v ? v.name : (game.enforcement && game.enforcement.nameOf ? game.enforcement.nameOf(k) : k); }
  this.count = function () {
    var L = laws(), vn = L.filter(function (v) { return db.viol[v.id] && db.viol[v.id].n > 0; }).length;
    var F = game.story && game.story.faces ? game.story.faces.all() : [], fm = F.filter(function (f) { return f.met > 0 || f.fixed; }).length;
    var c = game.city, nn = 0, nt = 0;
    if (c) for (var i = 0; i < c.xs.length; i++) for (var j = 0; j < c.zs.length; j++) { nt++; if (game.hood && game.hood.points(i + ',' + j) > 0) nn++; }
    return { viol: [vn, L.length], faces: [fm, F.length], nodes: [nn, nt], places: self.placeCount() };
  };
  this.reset = function () { db = { viol: {}, places: {} }; save(); };
  // ---------- 화면 ----------
  var el = null, tab = 'viol';
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (m) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]; }); }
  function body() {
    if (tab === 'viol') {
      return laws().map(function (v) {
        var r = db.viol[v.id];
        return r && r.n ? '<div class="dx on"><b>' + esc(v.name) + '</b><span>' + r.n + '건 · 처음 ' + esc(r.first || '') + '</span></div>'
                        : '<div class="dx off"><b>❔ ???</b><span>아직 단속하지 않은 위반</span></div>';
      }).join('');
    }
    if (tab === 'faces') {
      var F = game.story && game.story.faces ? game.story.faces.all() : [];
      return F.map(function (f) {
        var seen = f.met > 0 || f.fixed;
        return seen ? '<div class="dx on' + (f.fixed ? ' fixed' : '') + '"><b>' + esc(f.name) + (f.fixed ? ' ✔ 바뀜' : '') + '</b><span>' + esc(f.fixed ? f.fix : f.what) + '</span></div>'
                    : '<div class="dx off"><b>❔ ???</b><span>순찰 중 무전으로 만난다</span></div>';
      }).join('') || '<div class="dim">사건 사슬 자료 없음</div>';
    }
    if (tab === 'places') {
      var PL = placeList();
      if (!PL.length) return '<div class="dim">이 지도에는 장소 칸이 없습니다</div>';
      return PL.map(function (p) {
        var r = db.places[p.name];
        return r ? '<div class="dx on"><b>' + esc(p.name) + '</b><span>' + esc(p.kind) + ' · 처음 ' + esc(r.first || '') + '</span></div>'
                 : '<div class="dx off"><b>❔ ' + esc(p.name) + '</b><span>' + esc(p.kind) + ' · 아직 안 가 봄 — 근무 중 지나가면 채워진다</span></div>';   // 장소는 이름을 보여 준다(찾아가게)
      }).join('');
    }
    var c = game.city, out = '';
    if (c) for (var j = 0; j < c.zs.length; j++) for (var i = 0; i < c.xs.length; i++) {
      var k = i + ',' + j, p = game.hood ? game.hood.points(k) : 0, nm = c.nodeName(c.nodes[i][j]);
      out += p > 0 ? '<div class="dx on"><b>' + esc(nm) + '</b><span>안전 지수 ' + game.hood.index(k) + '</span></div>' : '<div class="dx off"><b>❔ ' + esc(nm) + '</b><span>아직 지키지 않음</span></div>';
    }
    return out;
  }
  this.render = function () {
    if (!el) return;
    var n = self.count();
    var tabs = [['viol', '🚨 위반', n.viol], ['faces', '👤 인물', n.faces], ['nodes', '🚦 교차로', n.nodes], ['places', '🏢 장소', n.places]];
    el.innerHTML = '<div class="card wide dex-card"><div class="badge">📚 도감</div><h2>모은 칸 ' + (n.viol[0] + n.faces[0] + n.nodes[0] + n.places[0]) + ' / ' + (n.viol[1] + n.faces[1] + n.nodes[1] + n.places[1]) + '</h2>' +
      '<div class="dxtabs">' + tabs.map(function (t) { return '<button class="dxtab' + (tab === t[0] ? ' sel' : '') + '" data-tab="' + t[0] + '">' + t[1] + ' ' + t[2][0] + '/' + t[2][1] + '</button>'; }).join('') + '</div>' +
      '<div class="dxgrid">' + body() + '</div>' +
      '<div class="dim small">위반은 정답으로 단속하거나 📹 영상으로 남기면 채워집니다. 인물은 사건 사슬에서, 교차로는 🗺 우리 동네에서, 장소는 근무 중 그 곁을 지나가면 채워집니다.</div>' +
      '<button class="primary" id="dexX">닫기</button></div>';
    Array.prototype.forEach.call(el.querySelectorAll('.dxtab'), function (b) { b.addEventListener('click', function () { tab = b.getAttribute('data-tab'); self.render(); }); });
    document.getElementById('dexX').addEventListener('click', self.close);
  };
  this.open = function (t) {
    if (!el) {
      el = document.createElement('div'); el.id = 'dex'; el.className = 'overlay dex';
      el.addEventListener('click', function (e) { if (e.target === el) self.close(); });
      document.body.appendChild(el);
    }
    if (t) tab = t;
    self.render(); el.style.display = 'flex';
    if (game.setPaused) game.setPaused(true, 'dex');
  };
  this.close = function () { if (el) el.style.display = 'none'; if (game.setPaused) game.setPaused(false, 'dex'); };
  this.isOpen = function () { return !!el && el.style.display !== 'none'; };
};
