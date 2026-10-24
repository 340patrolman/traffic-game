// 🧪 만약에(v0.10.121 · ROADMAP E2~E4 · 소유자 「유기적인 연결 — 권고대로」 3단계)
// 한 교차로에서 **조건 하나만 바꿔** 같은 씨앗의 판을 두 번 돌리고 차이를 표로 돌려준다(🧪 시뮬레이션 모드 그대로 — 운전 보조·칭찬·무전 끔 · Math.random 고정).
// 같은 씨앗 세 개(340·341·342)로 「그대로」·「바꾼 것」을 각각 돌려 평균한다(한 씨앗만 보면 우연이 섞인다). 앞 40초는 버리고(도시가 차는 시간) 뒤 240초를 잰다.
// 재는 것(그 교차로 둘레 R — 이웃 교차로 간격의 0.45배 · 최대 150 단위): 교통 AI 가 그 교차로에 남긴 위반 기록(종류별) · 보행자 근접(건너는 사람 2.5 단위 안을 달리는 차) ·
//   무단횡단을 시작한 사람 · 평균 대기 대수(선 차) · 교차로를 지나간 차.
// ⚠ 결과는 **게임 설계값 위의 비교**다 — 교통 AI·보행자 모형이 정한 반응이지 실제 효과 증명이 아니다(화면에 늘 밝힌다).
TG.WhatIf = function (G) {
  var self = {}, box = null, busy = false, last = null, sel = null, vsel = null;
  var WARM = 40, MEAS = 240, DT = 1 / 30, SEEDS = [340, 341, 342];
  // 바꿀 조건 — apply/undo 는 근무가 시작된 뒤 부른다(시작이 C·신호를 다시 정하기 때문)
  var VARS = [
    { id: 'green', label: '🚦 이 교차로 남북 녹색 +10초', why: '신호 시간을 늘리면 대기·신호위반이 어떻게 바뀌나',
      prep: function (c) { if (c.signals.setRealOff) c.signals.setRealOff(c.N, true); },          // 두 판 모두 일반형 신호로(실측 현시가 있는 곳도 같은 조건)
      apply: function (c) { c.prevG = c.signals.greenFor(c.N, 'v'); c.signals.setGreen(c.N, 'v', c.prevG + 10); },
      undo: function (c) { if (c.prevG != null) c.signals.setGreen(c.N, 'v', c.prevG); } },
    { id: 'ped2', label: '🚶 보행자 2배', why: '사람이 많아지면 보행자 근접·무단횡단이 얼마나 느나',
      apply: function (c) { c.prevP = c.C.PED_MAX; c.C.PED_MAX = Math.round(c.C.PED_MAX * 2); }, undo: function (c) { if (c.prevP != null) c.C.PED_MAX = c.prevP; } },
    { id: 'car15', label: '🚗 차량 1.5배', why: '교통량이 늘면 대기·위반이 어떻게 바뀌나',
      apply: function (c) { c.prevT = c.C.TRAFFIC_MAX; c.C.TRAFFIC_MAX = Math.round(c.C.TRAFFIC_MAX * 1.5); }, undo: function (c) { if (c.prevT != null) c.C.TRAFFIC_MAX = c.prevT; } },
    { id: 'viol50', label: '✅ 위반 성향 절반(단속·계도 효과 가정)', why: '신호를 무시하는 운전자가 절반이면',
      apply: function (c) { c.prevV = c.C.VIOLATOR_RATE; c.C.VIOLATOR_RATE = c.C.VIOLATOR_RATE * 0.5; }, undo: function (c) { if (c.prevV != null) c.C.VIOLATOR_RATE = c.prevV; } },
    { id: 'nojay', label: '🚧 무단횡단 막기(보행 펜스 가정)', why: '무단횡단을 막으면 보행자 근접이 얼마나 주나',
      apply: function (c) { c.prevJ = c.peds.noJaywalk; c.peds.noJaywalk = true; if (c.peds.clearJaywalkers) c.peds.clearJaywalkers(); }, undo: function (c) { c.peds.noJaywalk = !!c.prevJ; } }
  ];
  self.VARS = VARS;
  function el(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function vname(t) { var L = (G.laws && G.laws.violations) || [], v = null; (Array.isArray(L) ? L : []).forEach(function (x) { if (x && x.id === t) v = x; }); return v && v.name ? v.name : t; }
  function radiusOf(city, i, j) {
    var g = [];
    if (city.xs[i - 1] != null) g.push(city.xs[i] - city.xs[i - 1]); if (city.xs[i + 1] != null) g.push(city.xs[i + 1] - city.xs[i]);
    if (city.zs[j - 1] != null) g.push(city.zs[j] - city.zs[j - 1]); if (city.zs[j + 1] != null) g.push(city.zs[j + 1] - city.zs[j]);
    return Math.min(150, Math.min.apply(null, g.length ? g : [80]) * 0.45);
  }

  // ---------- 한 판 돌리기 ----------
  function runOne(i, j, V, on, seed, prog, done) {
    var core = G.simCore, prevSim = TG.mode.sim, prevSeed = TG.mode.seed, prevDem = G.demandOff;
    TG.mode.sim = true; TG.mode.seed = seed; G.demandOff = true;
    core.start('free');
    var c = core.ctx(); c.N = c.city.nodes[i][j];
    core.park(i, j);
    if (V.prep) V.prep(c);
    if (on) V.apply(c);
    var R = radiusOf(c.city, i, j), R2 = R * R, N = c.N, RT2 = Math.pow(Math.max(10, R * 0.3), 2);   // 지나간 차 = 교차로 가운데 R×0.3 안을 지난 차
    var M = { flags: {}, flagN: 0, near: 0, jay: 0, queue: 0, qs: 0, thru: 0 }, seenJ = {}, seenT = {}, nearCd = {};
    var prevFlag = c.traffic.onFlag;
    c.traffic.onFlag = function (car, type, node) { if (prevFlag) prevFlag(car, type, node); if (t < WARM || !node || node !== N) return; M.flags[type] = (M.flags[type] || 0) + 1; M.flagN++; };
    var t = 0, k = 0, total = WARM + MEAS, steps = Math.round(total / DT);
    function sample() {
      var cars = c.traffic.cars, peds = c.peds.peds, q = 0;
      cars.forEach(function (cr) {
        var dx = cr.pos.x - N.x, dz = cr.pos.z - N.z, d2 = dx * dx + dz * dz; if (d2 > R2) return;
        if (cr.v < 1 && cr.mode !== 'parked' && cr.mode !== 'incident') q++;
        if (d2 < RT2 && !seenT[cr.id]) { seenT[cr.id] = 1; M.thru++; }
      });
      M.queue += q; M.qs++;
      peds.forEach(function (p) {
        var dx = p.pos.x - N.x, dz = p.pos.z - N.z; if (dx * dx + dz * dz > R2) return;
        if (p.state === 'jaywalk' && !seenJ[p.id]) { seenJ[p.id] = 1; M.jay++; }
        if ((p.state === 'cross' || p.state === 'jaywalk') && !(nearCd[p.id] > t)) {
          for (var a = 0; a < cars.length; a++) { var cr = cars[a]; if (cr.v > 3 && Math.hypot(cr.pos.x - p.pos.x, cr.pos.z - p.pos.z) < 2.5) { M.near++; nearCd[p.id] = t + 5; break; } }
        }
      });
    }
    function finish(ok) {
      c.traffic.onFlag = prevFlag;
      if (on) V.undo(c);
      if (V.prep && c.signals.restoreReal) c.signals.restoreReal(N);
      TG.mode.sim = prevSim; TG.mode.seed = prevSeed; G.demandOff = prevDem; if (TG.mode.unseed && !prevSim) TG.mode.unseed();
      done(ok ? { flags: M.flags, flagN: M.flagN, near: M.near, jay: M.jay, queue: M.qs ? M.queue / M.qs : 0, thru: M.thru } : null);
    }
    (function chunk() {
      var n = 0;
      while (k < steps && n < 150) {
        if (!core.step(1, DT)) { finish(false); return; }
        k++; n++; t = k * DT;
        if (t >= WARM && k % 15 === 0) sample();
      }
      prog(k / steps);
      if (k < steps) setTimeout(chunk, 0); else finish(true);
    })();
  }

  // ---------- 두 조건 × 씨앗 둘 ----------
  self.run = function (i, j, vid, cb) {
    var V = null; VARS.forEach(function (v) { if (v.id === vid) V = v; });
    if (!V || busy || !G.simCore) return false;
    busy = true;
    var jobs = [], out = { base: [], alt: [] };
    SEEDS.forEach(function (s) { jobs.push({ on: false, seed: s }); jobs.push({ on: true, seed: s }); });
    var n = 0;
    (function next() {
      if (n >= jobs.length) { busy = false; var r = summarize(out, V, i, j); last = r; G.simCore.title(); cb(r); return; }
      var jb = jobs[n];
      runOne(i, j, V, jb.on, jb.seed, function (p) { paintProg((n + p) / jobs.length, jb.on ? '바꾼 것' : '그대로', jb.seed); }, function (res) {
        if (!res) { busy = false; G.simCore.title(); cb(null); return; }
        (jb.on ? out.alt : out.base).push(res); n++; setTimeout(next, 0);
      });
    })();
    return true;
  };
  function avg(L, f) { var s = 0; L.forEach(function (x) { s += f(x); }); return L.length ? s / L.length : 0; }
  function spread(L, f) { var a = L.map(f); return a.length ? Math.max.apply(null, a) - Math.min.apply(null, a) : 0; }
  function row(k, base, alt, f, dec) { var a = avg(base, f), b = avg(alt, f), sp = Math.max(spread(base, f), spread(alt, f)); return { k: k, a: a, b: b, sp: sp, noise: Math.abs(b - a) <= sp / 2, dec: dec }; }
  function summarize(out, V, i, j) {
    var types = {}; out.base.concat(out.alt).forEach(function (r) { Object.keys(r.flags).forEach(function (t) { types[t] = 1; }); });
    var B = out.base, A = out.alt, rows = [
      row('위반 기록(모든 종류)', B, A, function (r) { return r.flagN; }),
      row('보행자 근접(2.5 단위 안)', B, A, function (r) { return r.near; }),
      row('무단횡단 시작', B, A, function (r) { return r.jay; }),
      row('평균 대기 대수', B, A, function (r) { return r.queue; }, 1),
      row('지나간 차', B, A, function (r) { return r.thru; })
    ];
    Object.keys(types).forEach(function (t) { rows.push(row('　└ ' + vname(t), B, A, function (r) { return r.flags[t] || 0; })); });
    var city = G.simCore.ctx().city;
    return { i: i, j: j, name: city.nodeName(city.nodes[i][j]), v: V, rows: rows, seeds: SEEDS.length, sec: MEAS };
  }

  // ---------- 화면 ----------
  function ensure() {
    if (box) return box;
    box = document.createElement('div'); box.id = 'whatIf';
    box.innerHTML = '<div class="wi-card"><div class="wi-h">🧪 만약에 <button class="wi-x" data-wi="x">닫기</button></div><div class="wi-b"></div></div>';
    document.body.appendChild(box);
    box.addEventListener('click', function (e) {
      var b = e.target.closest('[data-wi]'); if (!b) return; var a = b.getAttribute('data-wi');
      if (busy) return;
      if (a === 'x') self.close();
      else if (/^n:/.test(a)) { var p = a.slice(2).split(','); sel = [+p[0], +p[1]]; paint(); }
      else if (/^v:/.test(a)) { vsel = a.slice(2); paint(); }
      else if (a === 'go' && sel && vsel) { var ok = self.run(sel[0], sel[1], vsel, function (r) { paint(r || 'fail'); }); if (ok) paintProg(0, '준비', SEEDS[0]); }
    });
    return box;
  }
  function paintProg(p, what, seed) {
    var b = ensure().querySelector('.wi-b');
    b.innerHTML = '<div class="wi-run">⏳ 돌리는 중 — ' + esc(what) + ' · 씨앗 ' + seed + '<div class="wi-bar"><i style="width:' + Math.round(p * 100) + '%"></i></div><small>같은 판을 여섯 번(그대로 3 · 바꾼 것 3) 빠르게 돌립니다. 화면은 그리지 않아요.</small></div>';
  }
  function fmt(x, dec) { return dec ? x.toFixed(1) : (Math.round(x * 10) / 10).toString(); }
  function paint(res) {
    var b = ensure().querySelector('.wi-b'), city = G.simCore && G.simCore.ctx().city; if (!city) return;
    var h = NOTE ? '<div class="wi-note">📍 ' + esc(NOTE) + '</div>' : '';
    if (res && res !== 'fail') {
      h += '<div class="wi-res"><b>' + esc(res.name) + ' · ' + esc(res.v.label) + '</b><table><tr><th></th><th>그대로</th><th>바꾼 것</th><th>차이</th></tr>' +
        res.rows.map(function (r) { var d = r.b - r.a, pc = r.a > 0 ? Math.round(d / r.a * 100) : null; return '<tr><td>' + esc(r.k) + '</td><td>' + fmt(r.a, r.dec) + '</td><td>' + fmt(r.b, r.dec) + '</td><td class="' + (r.noise ? 'nz' : d > 0 ? 'up' : d < 0 ? 'dn' : '') + '" title="씨앗끼리 흔들림 ' + fmt(r.sp, r.dec) + '">' + (d > 0 ? '+' : '') + fmt(d, r.dec) + (pc != null && Math.abs(d) >= 0.5 ? ' (' + (pc > 0 ? '+' : '') + pc + '%)' : '') + (r.noise && d !== 0 ? '<i>우연 범위</i>' : '') + '</td></tr>'; }).join('') +
        '</table><small>씨앗 ' + res.seeds + '개 평균 · 앞 40초 버리고 ' + res.sec + '초 · 그 교차로 둘레. 조건 하나를 바꿔도 그 뒤 판은 조금씩 갈라진다 — 차이가 씨앗끼리 흔들림의 절반 안이면 회색 「우연 범위」(이 앱의 기준). 🧪 게임 설계값 위의 비교 — 실제 효과 증명이 아닙니다.</small></div>';
    } else if (res === 'fail') h += '<div class="wi-res">돌리는 중 근무가 끝났습니다 — 다시 해 보세요.</div>';
    var nodes = [];
    for (var i = 0; i < city.nodes.length; i++) for (var j = 0; j < city.nodes[i].length; j++) if (!/실제로 안 만남/.test(city.nodeName(city.nodes[i][j]))) nodes.push([i, j]);
    h += '<div class="wi-l">어느 교차로</div><div class="wi-chips">' + nodes.map(function (q) { var on = sel && sel[0] === q[0] && sel[1] === q[1]; return '<button data-wi="n:' + q[0] + ',' + q[1] + '" class="' + (on ? 'on' : '') + '">' + esc(city.nodeName(city.nodes[q[0]][q[1]])) + '</button>'; }).join('') + '</div>';
    h += '<div class="wi-l">무엇을 바꿀까</div><div class="wi-vars">' + VARS.map(function (v) { return '<button data-wi="v:' + v.id + '" class="' + (vsel === v.id ? 'on' : '') + '">' + esc(v.label) + '<small>' + esc(v.why) + '</small></button>'; }).join('') + '</div>';
    h += '<button class="wi-go" data-wi="go"' + (sel && vsel ? '' : ' disabled') + '>▶ 돌려 보기(1~2분)</button>';
    b.innerHTML = h;
  }
  var NOTE = '';   // 다른 앱에서 넘어온 자리 → 게임 교차로로 돌린 까닭(창 위 한 줄)
  self.open = function (i, j, vid, note) {
    ensure().style.display = 'flex'; if (note != null) NOTE = note;
    if (i != null) sel = [i, j]; if (vid) vsel = vid;
    paint(last && sel && last.i === sel[0] && last.j === sel[1] ? last : null);
  };
  self.close = function () { if (box && !busy) box.style.display = 'none'; };
  self.busy = function () { return busy; };
  // 주소 ?whatif=<조건>&at=INT-…|위도,경도 — 데이터 압축지도 가설에서 바로 연다(돌리기는 누를 때)
  self.param = function () { var q = new URLSearchParams(location.search), w = q.get('whatif'); if (!w) return null; var ok = null; VARS.forEach(function (v) { if (v.id === w) ok = w; }); return { v: ok }; };   // 모르는 조건(예: whatif=1)이면 고르기만 비워 둔다
  return self;
};
