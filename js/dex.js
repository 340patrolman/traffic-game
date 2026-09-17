// 📚 도감 3종(재미 설계서 5절 #8 · 7절 3단계) — 포켓몬식 수집. 「아직 못 본 칸」이 다음 근무의 이유가 된다.
//  ① 위반 도감: 정답으로 단속(정차·고지)했거나 📹 영상으로 남긴 위반 종류. 이름은 laws.json(violations)에서만 읽는다.
//  ② 인물 도감: 사건 사슬의 아는 얼굴(story.faces) — 만났는지 · 바뀌었는지.
//  ③ 교차로 도감: 동네 안전 지수(hood)에 점수가 한 번이라도 쌓인 교차로.
//  기록은 기기에만(tg_dex — 위반 도감만 따로 둔다. 인물·교차로는 이미 있는 기록을 읽는다). 🧪 시뮬레이션에서는 쌓지 않는다.
TG.Dex = function (game) {
  var self = this, db = TG.save.get('dex', null) || { viol: {} };
  if (!db.viol) db.viol = {};
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
    return { viol: [vn, L.length], faces: [fm, F.length], nodes: [nn, nt] };
  };
  this.reset = function () { db = { viol: {} }; save(); };
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
    var tabs = [['viol', '🚨 위반', n.viol], ['faces', '👤 인물', n.faces], ['nodes', '🚦 교차로', n.nodes]];
    el.innerHTML = '<div class="card wide dex-card"><div class="badge">📚 도감</div><h2>모은 칸 ' + (n.viol[0] + n.faces[0] + n.nodes[0]) + ' / ' + (n.viol[1] + n.faces[1] + n.nodes[1]) + '</h2>' +
      '<div class="dxtabs">' + tabs.map(function (t) { return '<button class="dxtab' + (tab === t[0] ? ' sel' : '') + '" data-tab="' + t[0] + '">' + t[1] + ' ' + t[2][0] + '/' + t[2][1] + '</button>'; }).join('') + '</div>' +
      '<div class="dxgrid">' + body() + '</div>' +
      '<div class="dim small">위반은 정답으로 단속하거나 📹 영상으로 남기면 채워집니다. 인물은 사건 사슬에서, 교차로는 🗺 우리 동네에서 채워집니다.</div>' +
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
