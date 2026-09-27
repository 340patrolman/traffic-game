// 🧩 꼬리물기 풀기(v0.10.45) — 1분 퍼즐
//  소유자 2026-09-28: 「구글·애플·스팀의 인기 게임과 왜 인기 순위에 올라갔는지 확인해서 교통경찰 게임에 넣자」.
//  조사(2026-09): 미국 앱스토어 무료 캐주얼 상위에 교통 정체 탈출 퍼즐(Bus Fever Party! #8 · Bus Traffic Fever! #11)이 있다 —
//  **동작 하나(차를 누르면 빠져나간다) · 설명 없이 이해 · 몇 초짜리 판 · 판이 비워지는 쾌감**. 매일 같은 문제(데일리)가 다시 오게 한다.
//  여기서는 그 짜임새를 **교통경찰의 실제 일(꼬리물기 정리 · 도로교통법 제25조 제5항)** 로 옮겼다 — 이름·그림·화면은 따라 하지 않는다.
//  광고·목숨 충전 없음. 틀려도 막지 않는다(별만 준다). 통신 0 · 기기 저장(tg_jam).
//  규칙: 차는 **보는 방향으로만** 곧게 빠져나간다. 앞길(판 끝까지)에 다른 차가 있으면 못 나가고 「쿵」(실수 1).
//  판은 무작위로 채운 뒤 **「빠져나갈 수 있는 차를 하나씩 빼는」 탐욕 풀이로 다 빠지는지** 확인한다 — 빼면 자리만 늘어나므로
//  탐욕 풀이가 막히면 어떤 순서로도 막힌다(단조성). 막힌 차는 판에서 지운다 → **모든 판은 풀린다.**
TG.JamPuzzle = function (game) {
  var self = this, G = game, KEY = 'jam';
  var st = null, cv = null, ctx = null, raf = 0, anim = [], board = null, cell = 0, ox = 0, oy = 0;
  var data = TG.save.get(KEY, null) || { level: 1, stars: {}, daily: {}, streak: 0, lastDaily: null, cleared: 0 };
  function save() { TG.save.set(KEY, data); }
  function EL(id) { return document.getElementById(id); }
  function rngOf(seed) { var s = seed >>> 0 || 1; return function () { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
  function ymd(d) { var m = d.getMonth() + 1, dd = d.getDate(); return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (dd < 10 ? '0' : '') + dd; }
  function hash(str) { var h = 2166136261; for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  var DV = [[0, 1], [1, 0], [0, -1], [-1, 0]];   // 0 아래 · 1 오른쪽 · 2 위 · 3 왼쪽(판 칸 좌표)
  var COLORS = ['#e5484d', '#3e8bff', '#f2c94c', '#30a46c', '#f76b15', '#8e4ec6', '#12a594', '#e93d82', '#dfe3ea', '#5b6b85'];

  // ── 판 만들기 ─────────────────────────────────────────────
  function cellsOf(c) { var out = []; for (var k = 0; k < c.len; k++) out.push([c.x - DV[c.d][0] * k, c.y - DV[c.d][1] * k]); return out; }   // (x,y) = 앞머리
  function occupied(cars, n) { var g = []; for (var i = 0; i < n * n; i++) g.push(-1); cars.forEach(function (c, ci) { if (c.gone) return; cellsOf(c).forEach(function (q) { g[q[1] * n + q[0]] = ci; }); }); return g; }
  function blocker(cars, n, ci) {   // 앞길에 있는 첫 차(없으면 -1)
    var c = cars[ci], g = occupied(cars, n), x = c.x + DV[c.d][0], y = c.y + DV[c.d][1];
    while (x >= 0 && y >= 0 && x < n && y < n) { var o = g[y * n + x]; if (o >= 0 && o !== ci) return o; x += DV[c.d][0]; y += DV[c.d][1]; }
    return -1;
  }
  function greedy(cars, n) {   // 탐욕 풀이 — 빠져나간 순서와 몇 바퀴(깊이)
    var cs = cars.map(function (c) { return { x: c.x, y: c.y, d: c.d, len: c.len, gone: false }; }), order = [], rounds = 0, moved = true;
    while (moved) { moved = false; rounds++; var free = []; cs.forEach(function (c, i) { if (!c.gone && blocker(cs, n, i) < 0) free.push(i); }); free.forEach(function (i) { cs[i].gone = true; order.push(i); moved = true; }); }
    return { order: order, stuck: cs.map(function (c, i) { return c.gone ? -1 : i; }).filter(function (i) { return i >= 0; }), depth: rounds - 1 };
  }
  function make(seed, lvl) {
    var R = rngOf(seed), n = lvl <= 3 ? 6 : lvl <= 8 ? 7 : 8, want = Math.min(n * n * 0.42, 7 + lvl * 1.6) | 0, cars = [];
    for (var t = 0; t < 900 && cars.length < want; t++) {
      var len = R() < Math.min(0.28, 0.08 + lvl * 0.02) ? 3 : 2, d = (R() * 4) | 0, x = (R() * n) | 0, y = (R() * n) | 0;
      var c = { x: x, y: y, d: d, len: len, col: COLORS[(R() * COLORS.length) | 0], bus: len === 3 };
      var ok = cellsOf(c).every(function (q) { return q[0] >= 0 && q[1] >= 0 && q[0] < n && q[1] < n; });
      if (!ok) continue;
      var g = occupied(cars, n); if (cellsOf(c).some(function (q) { return g[q[1] * n + q[0]] >= 0; })) continue;
      // 하나씩 넣고 **넣은 뒤에도 풀리는지** 본다 — 막히면 그 차는 넣지 않는다(판이 비지 않고 촘촘해진다 · 실측: 빼는 방식은 3~5대 판이 나왔다)
      cars.push(c); if (greedy(cars, n).stuck.length) cars.pop();
    }
    var gr = greedy(cars, n);
    return { n: n, cars: cars, depth: gr.depth, solution: gr.order };
  }

  // ── 한 판 ─────────────────────────────────────────────
  function realPlace(seed) {   // 무대 이름 — 이 지도의 실제 교차로(TAAS 교차로별 집계) 가운데 하나
    var L = G.layers, list = L && L.realNodes ? L.realNodes().filter(function (n) { return n.total > 0; }) : [];
    if (!list.length) return null;
    list.sort(function (a, b) { return b.total - a.total; });
    return list[seed % Math.min(list.length, 12)];
  }
  function start(kind, lvl) {
    var today = ymd(new Date()), seed = kind === 'daily' ? hash('daily' + today) : hash('lvl' + lvl + 'v1');
    var lv = kind === 'daily' ? 6 + (hash(today) % 4) : lvl;
    board = make(seed, lv);
    st = { kind: kind, lvl: lv, level: lvl, mistakes: 0, taps: 0, t0: Date.now(), done: false, place: realPlace(seed), today: today };
    anim = []; layout(); paint(); draw();
  }
  function lawTip() {
    var v = G.laws && G.laws.violations ? G.laws.violations.filter(function (x) { return x.id === 'gridlock'; })[0] : null;
    if (!v) return '꼬리물기 — 앞이 막혀 있으면 녹색이어도 교차로에 들어가지 않는다(도로교통법 제25조 제5항).';
    var f = v.fine && v.fine['승용'] ? ' · 범칙금 승용 ' + String(v.fine['승용']).replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '원' : '';
    return (v.law && v.law.article ? v.law.article : '제25조 제5항') + ' — 앞이 막혀 있으면 녹색이어도 교차로에 들어가지 않는다' + f + '.';
  }
  function tap(ci) {   // 차 하나에 수신호 — 빠져나가면 true
    if (!st || st.done || !board.cars[ci] || board.cars[ci].gone) return false;
    st.taps++;
    var b = blocker(board.cars, board.n, ci), c = board.cars[ci];
    if (b >= 0) { st.mistakes++; anim.push({ ci: ci, t: 0, kind: 'bump' }); if (TG.audio && TG.audio.horn) TG.audio.horn(); if (TG.haptic) TG.haptic(40); paint(); kick(); return false; }
    c.gone = true; anim.push({ ci: ci, t: 0, kind: 'go' });
    if (TG.audio && TG.audio.pop) TG.audio.pop(); if (TG.haptic) TG.haptic(10);
    if (board.cars.every(function (q) { return q.gone; })) win();
    paint(); kick(); return true;
  }
  function win() {
    st.done = true;
    var stars = st.mistakes === 0 ? 3 : st.mistakes <= 2 ? 2 : 1, secs = Math.round((Date.now() - st.t0) / 1000), xp = stars * 5;
    if (st.kind === 'daily') {
      var first = !data.daily[st.today];
      data.daily[st.today] = Math.max(data.daily[st.today] || 0, stars);
      if (first) { var y = new Date(); y.setDate(y.getDate() - 1); data.streak = data.lastDaily === ymd(y) ? (data.streak || 0) + 1 : 1; data.lastDaily = st.today; xp += 20; }
    } else {
      data.stars[st.level] = Math.max(data.stars[st.level] || 0, stars);
      if (st.level >= data.level) data.level = st.level + 1;
    }
    data.cleared = (data.cleared || 0) + 1; save();
    if (G.praise && !(TG.mode && TG.mode.sim)) G.praise.addXp(xp, 'jam');
    if (TG.audio && TG.audio.jingle) TG.audio.jingle(stars + 1);
    st.result = { stars: stars, secs: secs, xp: xp };
    paint();
  }

  // ── 그리기 ─────────────────────────────────────────────
  function layout() {
    if (!cv) return;
    var W = cv.clientWidth || 360, H = cv.clientHeight || 360, dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var n = board ? board.n : 6, sz = Math.min(W, H) - 24; cell = Math.floor(sz / n); ox = Math.round((W - cell * n) / 2); oy = Math.round((H - cell * n) / 2);
  }
  function drawCar(c, dx, dy, sh) {
    var cs = cellsOf(c), minx = 1e9, miny = 1e9, maxx = -1e9, maxy = -1e9;
    cs.forEach(function (q) { minx = Math.min(minx, q[0]); miny = Math.min(miny, q[1]); maxx = Math.max(maxx, q[0]); maxy = Math.max(maxy, q[1]); });
    var p = cell * 0.12, x = ox + minx * cell + p + dx + sh, y = oy + miny * cell + p + dy, w = (maxx - minx + 1) * cell - p * 2, h = (maxy - miny + 1) * cell - p * 2;
    ctx.fillStyle = 'rgba(0,0,0,.28)'; roundRect(x + 2, y + 3, w, h, cell * 0.2); ctx.fill();
    ctx.fillStyle = c.bus ? '#f2b705' : c.col; roundRect(x, y, w, h, cell * 0.2); ctx.fill();
    // 앞유리(보는 방향 쪽) — 방향이 한눈에 보이게
    var d = c.d, gw = cell * 0.5, gl = cell * 0.18; ctx.fillStyle = 'rgba(20,28,44,.85)';
    if (d === 0) roundRect(x + (w - gw) / 2, y + h - gl - cell * 0.12, gw, gl, 3);
    else if (d === 2) roundRect(x + (w - gw) / 2, y + cell * 0.12, gw, gl, 3);
    else if (d === 1) roundRect(x + w - gl - cell * 0.12, y + (h - gw) / 2, gl, gw, 3);
    else roundRect(x + cell * 0.12, y + (h - gw) / 2, gl, gw, 3);
    ctx.fill();
    // 화살표
    var cx = x + w / 2, cy = y + h / 2, a = cell * 0.18; ctx.fillStyle = 'rgba(255,255,255,.92)'; ctx.beginPath();
    var fx = DV[d][0], fy = DV[d][1], rx = -fy, ry = fx;
    ctx.moveTo(cx + fx * a * 1.3, cy + fy * a * 1.3); ctx.lineTo(cx - fx * a * 0.6 + rx * a, cy - fy * a * 0.6 + ry * a); ctx.lineTo(cx - fx * a * 0.6 - rx * a, cy - fy * a * 0.6 - ry * a); ctx.closePath(); ctx.fill();
    if (c.bus) { ctx.fillStyle = '#1f3b73'; ctx.font = 'bold ' + Math.round(cell * 0.22) + 'px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('버스', cx, cy - fy * a * 2.2 - fx * 0 + (d % 2 ? cell * 0.3 : 0)); }
  }
  function roundRect(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function draw() {
    if (!ctx || !board) return;
    var W = cv.clientWidth, H = cv.clientHeight, n = board.n;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#3a3f47'; ctx.fillRect(ox - 10, oy - 10, cell * n + 20, cell * n + 20);
    // 가장자리 횡단보도(흰 줄무늬) — 교차로 상자
    ctx.fillStyle = 'rgba(255,255,255,.55)';
    for (var s = 0; s < n * 3; s++) { var t = s * cell / 3 + 2; ctx.fillRect(ox + t, oy - 9, cell / 6, 7); ctx.fillRect(ox + t, oy + cell * n + 2, cell / 6, 7); ctx.fillRect(ox - 9, oy + t, 7, cell / 6); ctx.fillRect(ox + cell * n + 2, oy + t, 7, cell / 6); }
    // 꼬리물기 금지 상자(황색 빗금)
    ctx.strokeStyle = 'rgba(242,201,76,.35)'; ctx.lineWidth = 2;
    for (var k = -n; k < n * 2; k++) { ctx.beginPath(); ctx.moveTo(ox + k * cell, oy); ctx.lineTo(ox + (k + n) * cell, oy + n * cell); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(242,201,76,.8)'; ctx.lineWidth = 3; ctx.strokeRect(ox, oy, cell * n, cell * n);
    var now = performance.now();
    board.cars.forEach(function (c, ci) {
      var a = anim.filter(function (q) { return q.ci === ci; })[0], dx = 0, dy = 0, sh = 0;
      if (c.gone && !a) return;
      if (a && a.kind === 'go') { var k2 = Math.min(1, a.t / 0.45); dx = DV[c.d][0] * k2 * cell * (n + 2); dy = DV[c.d][1] * k2 * cell * (n + 2); }
      if (a && a.kind === 'bump') sh = Math.sin(a.t * 40) * cell * 0.08 * (1 - a.t / 0.3);
      ctx.save(); ctx.beginPath(); ctx.rect(ox - 10, oy - 10, cell * n + 20, cell * n + 20); ctx.clip(); drawCar(c, dx, dy, sh); ctx.restore();
    });
  }
  var lastT = 0;
  function loop(t) {
    var dt = lastT ? Math.min(0.05, (t - lastT) / 1000) : 0.016; lastT = t;
    anim.forEach(function (a) { a.t += dt; }); anim = anim.filter(function (a) { return a.kind === 'go' ? a.t < 0.45 : a.t < 0.3; });
    draw();
    raf = anim.length ? requestAnimationFrame(loop) : 0; if (!raf) lastT = 0;
  }
  function kick() { if (!raf) raf = requestAnimationFrame(loop); draw(); }

  // ── 화면 ─────────────────────────────────────────────
  function paint() {
    var hd = EL('jamHead'), ft = EL('jamFoot'); if (!hd || !st) return;
    var left = board.cars.filter(function (c) { return !c.gone; }).length, hearts = '';
    var place = st.place ? st.place.name + ' · 실제 사고 ' + st.place.total + '건' : '교차로';
    hd.innerHTML = '<b>' + (st.kind === 'daily' ? '📅 오늘의 퍼즐 ' + st.today.slice(5) : '🧩 단계 ' + st.level) + '</b><span>' + place + '</span>' +
      '<i>남은 차 ' + left + ' · 실수 ' + st.mistakes + (st.kind === 'daily' ? ' · 연속 ' + (data.streak || 0) + '일' : '') + '</i>';
    if (st.result) {
      ft.innerHTML = '<div class="jam-win">' + '★★★'.slice(0, st.result.stars) + '☆☆☆'.slice(0, 3 - st.result.stars) + ' 정리 완료 · ' + st.result.secs + '초 · +' + st.result.xp + ' 경험치</div>' +
        '<div class="jam-law">📘 ' + lawTip() + '</div>' +
        '<div class="jam-btns"><button id="jamNext">▶ 다음 단계</button><button id="jamRetry">↺ 다시</button></div>';
      hook('jamNext', function () { start('level', st.kind === 'daily' ? data.level : st.level + 1); });
      hook('jamRetry', function () { st.kind === 'daily' ? start('daily') : start('level', st.level); });
    } else {
      ft.innerHTML = '<div class="jam-help">화살표 방향으로 앞길이 비어 있는 차를 누르면 수신호로 빼 줍니다. 막힌 차를 누르면 「쿵」 — 실수.</div>' +
        '<div class="jam-btns"><button id="jamHint">💡 힌트</button><button id="jamRetry2">↺ 다시</button><button id="jamDaily">📅 오늘의 퍼즐' + (data.daily[ymd(new Date())] ? ' ✓' : '') + '</button></div>';
      hook('jamHint', function () { var i = hint(); if (i >= 0) { anim.push({ ci: i, t: 0, kind: 'bump' }); kick(); } });
      hook('jamRetry2', function () { st.kind === 'daily' ? start('daily') : start('level', st.level); });
      hook('jamDaily', function () { start('daily'); });
    }
  }
  function hook(id, fn) { var b = EL(id); if (b) b.addEventListener('click', function (e) { e.stopPropagation(); fn(); }); }
  function hint() { if (!board) return -1; for (var i = 0; i < board.cars.length; i++) if (!board.cars[i].gone && blocker(board.cars, board.n, i) < 0) return i; return -1; }
  function onDown(e) {
    if (!board || !st) return;
    var r = cv.getBoundingClientRect(), px = (e.clientX - r.left) * (cv.clientWidth / r.width), py = (e.clientY - r.top) * (cv.clientHeight / r.height);
    var gx = Math.floor((px - ox) / cell), gy = Math.floor((py - oy) / cell); if (gx < 0 || gy < 0 || gx >= board.n || gy >= board.n) return;
    var g = occupied(board.cars, board.n), ci = g[gy * board.n + gx]; if (ci >= 0) tap(ci);
  }
  this.open = function (kind) {
    var p = EL('jamPanel'); if (!p) return;
    p.style.display = 'flex'; cv = EL('jamCanvas'); ctx = cv.getContext('2d');
    if (!cv._hooked) { cv._hooked = true; cv.addEventListener('pointerdown', onDown); window.addEventListener('resize', function () { if (p.style.display !== 'none') { layout(); draw(); } }); }
    start(kind === 'daily' || (!kind && !data.daily[ymd(new Date())]) ? 'daily' : 'level', data.level);
  };
  this.close = function () { var p = EL('jamPanel'); if (p) p.style.display = 'none'; if (raf) cancelAnimationFrame(raf); raf = 0; };
  this.line = function () { var t = ymd(new Date()); return '🧩 꼬리물기 풀기 — 단계 ' + data.level + ' · 오늘의 퍼즐 ' + (data.daily[t] ? '★' + data.daily[t] : '아직') + (data.streak ? ' · 연속 ' + data.streak + '일' : ''); };
  // 검증이 읽는다
  this.state = function () { return st; }; this.board = function () { return board; }; this.tap = tap; this.hint = hint; this.make = make; this.greedy = greedy; this.data = function () { return data; };
};
