// 🔗 사건 사슬 · 👤 아는 얼굴 — 「한 근무가 하나의 이야기」가 되게 하는 층.
//
// 소유자(2026-09-16): 「게임의 재미를 높여야 하는데 좋은 거 뭐 없을까? **역동성 스토리** 나 더 좋은거?」
//   → 지금 게임은 신고·위반이 따로따로 떨어져 있어 「다음이 궁금해서 한 판 더」가 없다. 그래서 둘을 넣는다.
//
//  ① **사건 사슬**: 무전 한 건이 다음 사건을 부른다(3~4단계). 끝에 작전 종료 카드.
//  ② **아는 얼굴**: 이름 있는 상습 위반자·아이가 근무를 넘어 **기억된다**(localStorage `tg_faces`).
//     계도하거나 단속하면 다음 판에는 **달라져서 나타난다**(헬멧을 쓰고 · 멈춰서 손을 들고 · 깜빡이를 켜고).
//     「내가 바꿨다」가 남는 것이 이 게임의 보람이다(소유자: 「어려운 사람들을 돕기 · 성취감과 보람」).
//
// 규칙
//  · **실존 인물·실제 사건을 쓰지 않는다.** 이름은 성씨·번호 정도의 가상 인물이고 화면에도 그렇게 밝힌다.
//  · 법령 문구는 여전히 `data/laws.json` 에서만 온다 — 이 층은 **누가 어디서 무엇을 했는지**만 엮는다.
//  · 사슬은 **기존 판정을 그대로 쓴다**(단속 완료 · 영상 단속 · 무전 조회 · 현장 도착). 새 채점은 만들지 않는다.
//  · 아이 앞(교실 모드)에서는 돌지 않는다. 순찰 근무에서만.
TG.Story = function (game) {
  var self = this, G = game, city = game.city;

  // ---------- 👤 아는 얼굴 ----------
  // kind 는 traffic 의 차종·습관을 그대로 쓴다. fix 는 「계도·단속 뒤에 달라진 모습」이다.
  var FACES = [
    { id: 'moto-choi', name: '배달 이륜차 최씨', type: 'moto', trait: null, viol: 'motorcycle',
      what: '헬멧을 쓰지 않고 보도로 올라간다', fix: '헬멧을 쓰고 차도로 달린다', need: 2 },
    { id: 'taxi-7482', name: '택시 7482', type: 'sedan', trait: null, viol: 'nosignal',
      what: '깜빡이 없이 차로를 바꾼다', fix: '깜빡이를 켜고 바꾼다', need: 2 },
    { id: 'pm-two', name: '킥보드 두 명', type: 'pm', trait: null, viol: 'pmTwo',
      what: '한 대에 둘이 탄다', fix: '한 명만 타고 헬멧을 쓴다', need: 1 },
    { id: 'truck-ko', name: '화물차 고씨', type: 'truck', trait: 'cargo', viol: 'cargo',
      what: '짐을 묶지 않아 떨어뜨린다', fix: '짐을 덮고 묶었다', need: 1 }
  ];
  function faceById(id) { for (var i = 0; i < FACES.length; i++) if (FACES[i].id === id) return FACES[i]; return null; }
  var db = TG.save.get('faces', {}) || {};                       // localStorage tg_faces
  function rec(id) { if (!db[id]) db[id] = { met: 0, warned: 0, fixed: false }; return db[id]; }
  function saveDb() { TG.save.set('faces', db); }
  this.faces = {
    all: function () { return FACES.map(function (f) { var r = rec(f.id); return { id: f.id, name: f.name, what: f.what, fix: f.fix, met: r.met, warned: r.warned, fixed: !!r.fixed }; }); },
    fixedCount: function () { var n = 0; FACES.forEach(function (f) { if (rec(f.id).fixed) n++; }); return n; },
    reset: function () { db = {}; saveDb(); }
  };

  // ---------- 사슬 ----------
  // 단계 갈래: go(그 자리로) · stop(그 차를 세워 단속) · radio(무전 조회) · video(영상 단속) · again(같은 얼굴이 다시)
  var CHAINS = [
    { id: 'school', name: '등굣길 지킴이', open: '📻 상황실 — 서초 등굣길에서 이륜차가 인도로 다닌다는 신고입니다',
      steps: [
        { k: 'go',    goal: '신고 지점(학교 앞)으로 간다', xp: 20 },
        { k: 'stop',  goal: '그 이륜차를 세워 고지한다', face: 'moto-choi', xp: 40 },
        { k: 'radio', goal: '📡 무전으로 조회한다 — 같은 번호가 또 있었다', xp: 25 },
        { k: 'again', goal: '같은 이륜차가 다른 곳에서 또 — 다시 잡는다', face: 'moto-choi', xp: 55 }
      ] },
    { id: 'delivery', name: '짐을 흘리는 화물차', open: '📻 상황실 — 도로에 짐이 떨어져 있다는 신고가 이어집니다',
      steps: [
        { k: 'go',    goal: '신고가 몰린 교차로로 간다', xp: 20 },
        { k: 'video', goal: '📹 블랙박스로 낙하물 장면을 남긴다', face: 'truck-ko', xp: 35 },
        { k: 'stop',  goal: '그 화물차를 세워 고지한다', face: 'truck-ko', xp: 45 }
      ] },
    { id: 'signal', name: '깜빡이 없는 택시', open: '📻 상황실 — 택시가 깜빡이 없이 끼어든다는 신고입니다',
      steps: [
        { k: 'go',    goal: '신고 지점으로 간다', xp: 20 },
        { k: 'stop',  goal: '그 택시를 세워 고지한다', face: 'taxi-7482', xp: 40 },
        { k: 'again', goal: '같은 택시가 또 — 이번엔 어떻게 할지 내가 고른다', face: 'taxi-7482', xp: 50 }
      ] }
  ];

  var st = null, shiftLog = [];          // 이 근무에서 끝낸 사슬들(결과 카드용)
  function el(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  // ---------- 무대 고르기 ----------
  // 사슬의 무대는 **실제 사고 자료**가 고른다 — TAAS 교차로별 집계 상위, 없으면 플레이어 앞쪽 교차로.
  function pickNode(avoid) {
    var best = null, bestV = -1;
    // 실제 사고가 많은 교차로를 무대로 고른다(TAAS 교차로별 집계 — layers.compare 의 상위 목록).
    // 열쇠는 "i,j" 문자열이다. 자료가 없으면(지도가 다르거나 파일이 없으면) 플레이어 앞쪽 교차로로 물러선다.
    var L = G.layers, cmp = (L && L.compare) ? L.compare(8) : null, rows = cmp && cmp.rows ? cmp.rows : null;
    if (rows && rows.length) {
      rows.forEach(function (r) {
        var ij = String(r.key || '').split(','), nd = city.nodes[+ij[0]] && city.nodes[+ij[0]][+ij[1]];
        if (!nd || (avoid && nd === avoid)) return;
        var v = (r.real || 0) * (0.6 + Math.random() * 0.8);          // 상위 몇 곳 중에서 매번 다르게 고른다
        if (v > bestV) { bestV = v; best = nd; }
      });
    }
    if (!best) {
      var pl = G.player, f = pl ? pl.forward() : [0, 1];
      var i = city.nearestIdx(city.xs, pl ? pl.pos.x + f[0] * 120 : 0);
      var j = city.nearestIdx(city.zs, pl ? pl.pos.z + f[1] * 120 : 0);
      best = city.nodes[i][j];
    }
    return best;
  }
  // 교차로로 다가오는 차를 만든다(진행 방향 우측 차로). 얼굴(face)이 있으면 그 습관·위반을 달고 나온다.
  // **이미 고친 얼굴은 위반을 달지 않는다** — 계도한 뒤에는 헬멧을 쓰고, 깜빡이를 켜고 나타난다(그것이 이 층의 보람이다).
  function spawnOne(face, node, d, dist) {
    // 차는 **앞 교차로(prev) → 무대(node)** 사이에서 d 방향으로 달려온다. traffic.spawn 의 at.node 는 「출발 교차로」라서
    // 무대를 넘겨 주면 그 너머 교차로를 찾다가 지도 가장자리 무대에서 null 이 됐다(얼굴이 안 나오던 원인).
    var prev = city.nodeFrom(node, (d + 2) % 4); if (!prev) return null;
    dist = Math.min(dist, Math.hypot(node.x - prev.x, node.z - prev.z) * 0.7);
    var f = TG.DIR_VEC[d], r = [-f[1], f[0]];
    var axis = (d === 0 || d === 2) ? 'v' : 'h', idx = axis === 'v' ? node.i : node.j;
    var lanes = city.lanesOf(axis, idx), off = city.laneOff(axis, idx, Math.max(0, lanes - 1));
    var x = node.x - f[0] * dist + r[0] * off, z = node.z - f[1] * dist + r[1] * off;
    if (city.onRoad && !city.onRoad(x, z)) return null;              // 무대가 지도 가장자리면 그 뒤는 길이 아니다
    return G.traffic.spawn({ at: { x: x, z: z, d: d, node: prev }, type: face.type, trait: face.trait,
                             violator: false, straight: true, v: 7, cruise: 9 });
  }
  function spawnFace(face, node, d, dist) {
    if (!G.traffic || !face) return null;
    // 정한 방향·거리에서 안 되면(지도 가장자리 교차로 · 그 자리를 다른 차가 막음) 다른 접근로·가까운 거리로 — 전에는 남쪽 끝 교차로에서 얼굴이 안 나왔다
    var car = null, dirs = [d, (d + 2) % 4, (d + 1) % 4, (d + 3) % 4], dists = [dist, dist * 0.6, 30];
    for (var a = 0; a < dirs.length && !car; a++) for (var b = 0; b < dists.length && !car; b++) car = spawnOne(face, node, dirs[a], dists[b]);
    if (!car) return null;
    car.face = face.id;
    var rc = rec(face.id); rc.met++; saveDb();
    if (rc.fixed) {                                                   // 고친 얼굴 — 위반 없이, 규칙대로 지나간다
      car.violation = null; car.violator = false; car.noSignalViolator = false; car.sigRunner = false;
      car.trait = null; car.edgeRider = false; car.mount = true;
      if (car.riders && car.riders.length && TG.Character.pose) car.helmet = true;
      car.faceFixed = true;
    } else {
      car.violation = { type: face.viol, seen: true, node: node };    // 목격한 것으로 둔다 — 사슬이 이미 신고를 받았다
    }
    return car;
  }

  // ---------- 진행 ----------
  function line() {
    var b = el('missionBar'); if (!b) return;
    if (!st || st.done) { b.className = ''; b.textContent = ''; return; }
    var s = st.steps[st.i];
    b.className = 'on';
    b.innerHTML = '<i>📋 ' + esc(st.name) + ' ' + (st.i + 1) + '/' + st.steps.length + '</i><b>' + esc(s.goal) + '</b>';
  }
  function notice(t, kind, ms) { if (G.hud) G.hud.notice(t, kind || 'info', ms || 4200); }
  function stepDone(bonus) {
    var s = st.steps[st.i];
    st.log.push({ goal: s.goal, ok: true });
    if (G.praise) G.praise.cheer('quiz', s.xp + (bonus || 0), { feed: '📋 ' + s.goal });
    st.i++;
    if (st.i >= st.steps.length) { finish(true); return; }
    begin();
  }
  function begin() {
    var s = st.steps[st.i];
    st.t = 0; st.car = st.car || null;
    // **이미 고친 얼굴**을 다시 만나는 단계는 단속할 것이 없다 — 그 자체가 답이다(계도가 남았다는 것을 보여 주고 넘어간다).
    if (s.face && rec(s.face).fixed) {
      var ff = faceById(s.face);
      st.car = spawnFace(ff, st.node || pickNode(null), 2, 70);
      notice('👤 ' + ff.name + ' — ' + ff.fix + '. 지난번 계도가 남았습니다', 'good', 5200);
      if (G.praise) G.praise.cheer('help', 45, { feed: '👤 ' + ff.name + ' 그대로', voice: true });
      line(); setTimeout(function () { if (st && !st.done && st.steps[st.i] === s) stepDone(0); }, 1200);
      return;
    }
    if (s.k === 'go') {
      st.node = pickNode(null);
      notice('📋 ' + st.name + ' — ' + s.goal + ' · ' + city.nodeName(st.node), 'alert', 5200);
      if (G.hud && G.hud.setTarget) G.hud.setTarget('📋 ' + city.nodeName(st.node) + ' 으로');
    } else if (s.k === 'stop' || s.k === 'video') {
      var face = faceById(s.face);
      st.car = spawnFace(face, st.node || pickNode(null), 2, 70);
      var r = rec(s.face);
      notice('👤 ' + face.name + ' — ' + (r.met > 1 ? '또 만났습니다. ' : '') + face.what, 'warn', 5200);
      if (G.hud && G.hud.hintNow) G.hud.hintNow(s.k === 'video' ? '📹 블랙박스로 장면을 남긴다(추격하지 않는다)' : '🚨 단속으로 세워 고지한다');
    } else if (s.k === 'radio') {
      notice('📋 ' + s.goal, 'alert', 4600);
      if (G.hud && G.hud.hintNow) G.hud.hintNow('📡 무전 단추(T)로 조회한다');
    } else if (s.k === 'again') {
      st.node = pickNode(st.node);
      st.car = spawnFace(faceById(s.face), st.node, 2, 80);
      // 조사(이/가·을/를)는 이름에 따라 달라진다 — 숫자·영문 이름이 섞이므로 **줄표로 잇는다**(어색한 조사를 만들지 않는다)
      notice('📻 상황실 — ' + faceById(s.face).name + ' — ' + city.nodeName(st.node) + '에서 또 보입니다', 'alert', 5400);
    }
    line();
  }
  function finish(ok) {
    if (!st || st.done) return;
    st.done = true; st.ok = !!ok;
    line();
    // 사슬을 끝내면 **얼굴이 달라진다** — 계도·단속이 쌓이면 다음 판에는 고친 모습으로 나온다
    var changed = [];
    Object.keys(st.touched).forEach(function (id) {
      var f = faceById(id), r = rec(id); if (!f) return;
      r.warned += st.touched[id];
      if (!r.fixed && r.warned >= f.need) { r.fixed = true; changed.push(f); }
    });
    saveDb();
    if (ok) {
      notice('✅ 작전 종료 — ' + st.name + ' (' + st.log.length + '/' + st.steps.length + ' 단계)', 'good', 5600);
      if (G.praise) { G.praise.medal('chain-' + st.id, '작전 완료 · ' + st.name, 40); }
      changed.forEach(function (f) {
        notice('👤 ' + f.name + ' — 다음에는 ' + f.fix, 'good', 5200);
        if (G.praise) G.praise.cheer('help', 40, { feed: '👤 ' + f.name + ' 바뀜', voice: true });
      });
    }
    st.changed = changed.map(function (f) { return { name: f.name, fix: f.fix }; });
    st.restart = 25 + Math.random() * 20;
    shiftLog.push({ name: st.name, done: st.log.length, steps: st.steps.length, ok: !!ok, changed: st.changed });
    var s2 = TG.save.get('story', {}) || {}; s2.last = st.id; s2.cleared = (s2.cleared || 0) + (ok ? 1 : 0); TG.save.set('story', s2);
  }

  // ---------- 바깥에서 부르는 것 ----------
  this.start = function () {
    if (G.mode !== 'patrol') { st = null; line(); return false; }
    if (st && !st.done) return false;                              // 이미 돌고 있으면 다시 시작하지 않는다(근무 시작 예약과 겹칠 수 있다)
    var prev = (TG.save.get('story', {}) || {}).last;
    var pool = CHAINS.filter(function (c) { return c.id !== prev; });
    var c = pool.length ? pool[Math.floor(Math.random() * pool.length)] : CHAINS[0];
    st = { id: c.id, name: c.name, steps: c.steps, i: 0, t: 0, log: [], touched: {}, done: false, node: null, car: null, openT: 0 };
    notice(c.open, 'alert', 5600);
    if (game.metrics) game.metrics.ev('radio');
    if (TG.audio.squelch) TG.audio.squelch();
    TG.audio.pa(c.open.replace('📻 상황실 — ', ''));
    begin();
    return true;
  };
  this.stop = function () { st = null; line(); };
  this.resetShift = function () { st = null; shiftLog = []; line(); };
  this.on = function () { return !!st && !st.done; };
  this.state = function () { return st; };
  this.update = function (dt) {
    if (!st) return;
    if (st.done) {                                                   // 한 근무에 사슬 하나로 끝내지 않는다 — 25~45초 뒤에 다음 신고가 들어온다
      if (st.restart > 0) { st.restart -= dt; if (st.restart <= 0) { st = null; self.start(); } }
      return;
    }
    st.t += dt;
    var s = st.steps[st.i], pl = G.player;
    if (s.k === 'go' && pl && st.node) {
      if (Math.hypot(pl.pos.x - st.node.x, pl.pos.z - st.node.z) < 46) { if (G.hud && G.hud.setTarget) G.hud.setTarget(null); stepDone(0); return; }
    }
    // 대상을 놓치면(사라짐) 다시 만든다 — 사슬이 끊기지 않게
    if ((s.k === 'stop' || s.k === 'video' || s.k === 'again') && st.car && G.traffic.cars.indexOf(st.car) < 0) {
      if (st.t > 6) { st.car = spawnFace(faceById(s.face), st.node || pickNode(null), 2, 70); st.t = 0; }
    }
  };
  // 단속 고지 완료 · 영상 단속 · 무전 조회 — 기존 판정이 그대로 사슬을 밀어 준다
  this.onEnforced = function (car) {
    if (!st || st.done) return;
    var s = st.steps[st.i];
    if (s.k !== 'stop' && s.k !== 'again') return;
    if (s.face && car && car.face !== s.face) return;
    if (car && car.face) st.touched[car.face] = (st.touched[car.face] || 0) + 1;
    stepDone(0);
  };
  this.onVideo = function (car) {
    if (!st || st.done) return;
    var s = st.steps[st.i];
    if (s.k !== 'video') return;
    if (s.face && car && car.face !== s.face) return;
    if (car && car.face) st.touched[car.face] = (st.touched[car.face] || 0) + 1;
    stepDone(0);
  };
  this.onRadio = function (car) {
    if (!st || st.done) return;
    if (st.steps[st.i].k !== 'radio') return;
    stepDone(0);
  };
  // 근무 결과 카드에 넣을 값
  // 📻 다음 근무 떡밥(재미 설계 #4) — 끝나지 않은 일이 기억에 남는다. 아직 안 바뀐 얼굴이 있으면 그 제보, 없으면 오늘 안 한 사슬의 신고.
  this.teaser = function () {
    var open = FACES.filter(function (f) { return !rec(f.id).fixed; });
    var done = {}; shiftLog.forEach(function (c) { done[c.name] = 1; });
    var todo = CHAINS.filter(function (c) { return !done[c.name]; });
    var seed = (shiftLog.length * 7 + self.faces.fixedCount() * 3 + new Date().getDate()) % 11;
    if (open.length && (seed % 2 === 0 || !todo.length)) {
      var f = open[seed % open.length];
      return '👤 제보 — ' + f.name + ' · 「' + f.what + '」 — 다음 근무에 만날지도 모릅니다.';
    }
    if (todo.length) { var c = todo[seed % todo.length]; return '📻 다음 근무 — 「' + c.name + '」 ' + c.open.replace(/^📻\s*상황실\s*—\s*/, ''); }
    return '📻 다음 근무 — 오늘 바꾼 동네에서 새 신고를 기다리고 있습니다.';
  };
  this.summary = function () {
    // 한 근무에 사슬이 여러 개 돌 수 있다 — 끝낸 것을 모두 세고, 마지막(또는 돌고 있는) 사슬을 이름으로 보인다.
    var cur = st && !st.done ? { name: st.name, done: st.log.length, steps: st.steps.length, ok: false, changed: [] } : null;
    var last = shiftLog.length ? shiftLog[shiftLog.length - 1] : cur;
    if (!last) return null;
    var changed = [];
    shiftLog.forEach(function (c) { (c.changed || []).forEach(function (x) { changed.push(x); }); });
    return { name: last.name, steps: last.steps, done: last.done, ok: !!last.ok,
             cleared: shiftLog.filter(function (c) { return c.ok; }).length, chains: shiftLog.length,
             changed: changed, faces: self.faces.fixedCount() };
  };
};
