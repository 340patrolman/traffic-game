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
      ] },
    // ⏰ 시간대 신고(소유자 현장 지시 2026-09-17): 오전 11시 부근 염곡사거리 꼬리물기 · 오후 4시 서울성모병원 사거리 꼬리물기 · 야간 경부고속도로 서초IC 부산방향 고장차량.
    //  그 시간이면 **이 신고가 먼저** 들어온다(prio). 염곡사거리는 축약 지도에 없다 — 그 방면의 지도 안 교차로(양재역 사거리)에서 막힌다고 밝힌다(지도 교차로 이름을 바꾸지 않는다).
    { id: 'tail-am', name: '염곡사거리 방면 꼬리물기', hours: [[10, 12]], prio: true, place: '양재역',
      open: '📻 상황실 — 염곡사거리 방면 꼬리물기가 심하다는 신고입니다. 양재역 사거리부터 막힙니다',
      steps: [
        { k: 'go',  goal: '양재역 사거리(염곡사거리 방면)로 간다', xp: 20 },
        { k: 'jam', goal: '교차로 안에 멈춰 선 꼬리물기 차를 세워 고지한다', xp: 45 }
      ] },
    { id: 'tail-pm', name: '서울성모병원 사거리 꼬리물기', hours: [[15, 17]], prio: true, place: '성모병원',
      open: '📻 상황실 — 서울성모병원 사거리 꼬리물기가 심하다는 신고입니다',
      steps: [
        { k: 'go',  goal: '서울성모병원 사거리로 간다', xp: 20 },
        { k: 'jam', goal: '교차로 안에 멈춰 선 꼬리물기 차를 세워 고지한다', xp: 45 }
      ] },
    // 야간 신고 셋(소유자 지시) — 한 근무에서 차례로 들어온다. spot: 연결로(ic) · 진행 방향(dir: south/east) · 연결로에서 몇 칸(ahead, −면 못 미쳐서) · 사고 종류
    { id: 'hw-seocho', name: '경부고속도로 고장차량', hours: [[20, 24], [0, 5]], prio: true,
      open: '📻 상황실 — 경부고속도로 서초IC 부산방향 고장차량 신고입니다',
      spot: { ic: 'E', dir: 'south', ahead: 10, kind: 'broken', label: '경부고속도로 서초IC 부산방향' },
      steps: [
        { k: 'hw',    goal: '서초IC 부산방향 현장으로 간다', xp: 25 },
        { k: 'scene', goal: '뒤를 막고 안전조치를 끝낸다 — 경광등 · 후방 정차 · 📡 무전', xp: 55 }
      ] },
    { id: 'hw-hannam', name: '올림픽대로 고장차량', hours: [[20, 24], [0, 5]], prio: true,
      open: '📻 상황실 — 올림픽대로 잠실방향 한남대교 못 미쳐서 고장차량 신고입니다',
      spot: { ic: 'NE', dir: 'east', ahead: -12, kind: 'broken', label: '올림픽대로 잠실방향 한남대교 못 미쳐' },
      steps: [
        { k: 'hw',    goal: '올림픽대로 잠실방향(한남대교 못 미쳐) 현장으로 간다', xp: 25 },
        { k: 'scene', goal: '뒤를 막고 안전조치를 끝낸다 — 경광등 · 후방 정차 · 📡 무전', xp: 55 }
      ] },
    { id: 'hw-banpo', name: '경부고속도로 사고', hours: [[20, 24], [0, 5]], prio: true,
      open: '📻 상황실 — 경부고속도로 반포IC 부근 교통사고 신고입니다',
      spot: { ic: 'S', dir: 'any', ahead: 6, kind: 'crash', label: '경부고속도로 반포IC 부근' },
      steps: [
        { k: 'hw',    goal: '반포IC 부근 사고 현장으로 간다', xp: 25 },
        { k: 'scene', goal: '차로를 막고(라바콘·불꽃신호기) 안전조치를 끝낸다 — 경광등 · 후방 정차 · 📡 무전', xp: 60 }
      ] }
  ];
  function availAt(c, h) { if (!c.hours) return true; return c.hours.some(function (w) { return h >= w[0] && h < w[1]; }); }
  function nodeByName(part) {
    for (var i = 0; i < city.xs.length; i++) for (var j = 0; j < city.zs.length; j++) { var nd = city.nodes[i][j]; if (city.nodeName(nd).indexOf(part) >= 0) return nd; }
    return null;
  }

  // ⏰ 신고 문구는 **지금 시각**을 따른다(소유자: 「이 밤에 등굣길 위반 신고 무전이 나오는 것은 오류」).
  //  인도 주행 이륜차 사슬은 등교(07~09)·하교(12~17)·심야(21~05)·그 밖(배달)으로 이름·첫 무전·첫 목표가 바뀐다. 다른 사슬은 시간과 무관하다.
  //  시각은 기기 시계(신호 TOD·시간대 브리핑과 같다) — 검사는 G.storyHour 로 고정한다.
  function hourNow() { return (G.storyHour !== undefined && G.storyHour !== null) ? G.storyHour : new Date().getHours(); }
  var VARIANT = {
    school: function (h) {
      if (h >= 7 && h < 9) return { name: '등굣길 지킴이', open: '📻 상황실 — 서초 등굣길에서 이륜차가 인도로 다닌다는 신고입니다', go: '신고 지점(학교 앞)으로 간다' };
      if (h >= 12 && h < 17) return { name: '하굣길 지킴이', open: '📻 상황실 — 하굣길 학교 앞 인도로 이륜차가 다닌다는 신고입니다', go: '신고 지점(학교 앞)으로 간다' };
      if (h >= 21 || h < 5) return { name: '심야 인도 주행 이륜차', open: '📻 상황실 — 늦은 밤 배달 이륜차가 인도로 다닌다는 신고입니다', go: '신고 지점으로 간다' };
      return { name: '인도 위 배달 이륜차', open: '📻 상황실 — 배달 이륜차가 인도로 다닌다는 신고입니다', go: '신고 지점으로 간다' };
    }
  };
  function textOf(c, h) {
    var v = VARIANT[c.id] ? VARIANT[c.id](h === undefined ? hourNow() : h) : null;
    if (!v) return { name: c.name, open: c.open, steps: c.steps };
    var steps = c.steps.map(function (s, k) { return k === 0 && s.k === 'go' ? Object.assign({}, s, { goal: v.go }) : s; });
    return { name: v.name, open: v.open, steps: steps };
  }
  self.textOf = textOf;   // 검사용
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
  function notice(t, kind, ms) { if (G.hud) G.hud.notice(t, kind || 'info', ms || 2600); }
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
      st.node = (st.spec && st.spec.place && nodeByName(st.spec.place)) || pickNode(null);
      notice('📋 ' + st.name + ' — ' + city.nodeName(st.node), 'alert', 2800);   // 📏 v0.10.15 — 목표 글은 목표 줄(#missionBar)에 계속 떠 있다
      if (G.hud && G.hud.setTarget) G.hud.setTarget('📋 ' + city.nodeName(st.node) + ' 으로');
    } else if (s.k === 'stop' || s.k === 'video') {
      var face = faceById(s.face);
      st.car = spawnFace(face, st.node || pickNode(null), 2, 70);
      var r = rec(s.face);
      notice('👤 ' + face.name + ' — ' + (r.met > 1 ? '또 만났습니다. ' : '') + face.what, 'warn', 5200);
      if (G.hud && G.hud.hintNow) G.hud.hintNow(s.k === 'video' ? '📹 블랙박스로 장면을 남긴다(추격하지 않는다)' : '🚨 단속으로 세워 고지한다');
    } else if (s.k === 'jam') {
      st.car = jamScene(st.node || pickNode(null));
      if (G.hud && G.hud.hintNow) G.hud.hintNow('🚦 녹색이어도 앞이 막히면 들어가지 않는다(§25⑤) — 교차로 안에 선 차를 🚨 단속');
    } else if (s.k === 'hw') {
      st.place = hwSpot(st.spec && st.spec.spot);
      if (st.place) { notice('📋 ' + st.name, 'alert', 2400); if (G.hud && G.hud.setTarget) G.hud.setTarget('📋 ' + st.place.name); }
      else { line(); setTimeout(function () { if (st && !st.done && st.steps[st.i] === s) stepDone(0); }, 10); return; }   // 이 지도에 서초IC 연결로가 없으면 다음 단계로
    } else if (s.k === 'scene') {
      var sp = st.place;
      var kindS = (st.spec && st.spec.spot && st.spec.spot.kind) || 'broken';
      st.incident = sp ? G.traffic.spawnIncident(kindS, { x: sp.x, z: sp.z, heading: sp.heading }) : null;
      notice(kindS === 'crash' ? '🚧 사고 현장 — 경광등을 켜고 현장 뒤에 세워 차로를 막는다' : '🚧 고장차량 발견 — 경광등을 켜고 현장 뒤에 세워 안전조치', 'warn', 4600);
    } else if (s.k === 'radio') {
      notice('📋 ' + s.goal, 'alert', 2600);
      if (G.hud && G.hud.hintNow) G.hud.hintNow('📡 무전 단추(T)로 조회한다');
    } else if (s.k === 'again') {
      st.node = pickNode(st.node);
      st.car = spawnFace(faceById(s.face), st.node, 2, 80);
      // 조사(이/가·을/를)는 이름에 따라 달라진다 — 숫자·영문 이름이 섞이므로 **줄표로 잇는다**(어색한 조사를 만들지 않는다)
      notice('📻 상황실 — ' + faceById(s.face).name + ' — ' + city.nodeName(st.node) + '에서 또 보입니다', 'alert', 5400);
    }
    line();
  }
  // 🚦 꼬리물기 장면: 무대 교차로의 한 진출로에 정체 줄(멈춘 차 3대)을 세우고, 교차로 안에 한 대가 선다.
  //  줄은 단속이 시작되거나 사슬이 끝나면 풀린다(멈춘 차를 도로에 남기지 않는다).
  function jamScene(node) {
    if (!node || !G.traffic) return null;
    for (var d = 0; d < 4; d++) {
      var N2 = city.nodeFrom(node, d); if (!N2) continue;   // 진출로만 있으면 된다(양재역처럼 지도 모퉁이 교차로도)
      var f = TG.DIR_VEC[d], r = [-f[1], f[0]], rd = city.roadOf(node, d), la = city.laneOff(rd.axis, rd.idx, 0);
      var held = [], far = city.crossFar(node, d);
      // 줄 차 간격 13m — 스폰 최소 간격이 12m 다
      for (var q = 0; q < 3; q++) {
        var dq = far + 2 + q * 13, qc = G.traffic.spawn({ at: { x: node.x + f[0] * dq + r[0] * la, z: node.z + f[1] * dq + r[1] * la, d: d, node: node }, laneIdx: 0, v: 0, straight: true, type: 'sedan', trait: null, violator: false });
        if (qc) { qc.jamCruise = qc.cruise; qc.cruise = 0; qc.v = 0; held.push(qc); }
      }
      if (held.length < 2) { held.forEach(function (c) { G.traffic.remove(c); }); continue; }
      var box = G.traffic.spawn({ at: { x: node.x + f[0] * 1 + r[0] * la, z: node.z + f[1] * 1 + r[1] * la, d: d, node: node }, laneIdx: 0, v: 0, straight: true, type: 'hatch', trait: null, violator: false });
      if (!box) { held.forEach(function (c) { G.traffic.remove(c); }); continue; }
      box.jamBox = true; st.held = held;
      return box;
    }
    return null;
  }
  function releaseJam() {
    if (!st || !st.held) return;
    st.held.forEach(function (c) { if (c.jamCruise !== undefined) { c.cruise = c.jamCruise; c.jamCruise = undefined; } });
    st.held = [];
  }
  // 순환 고속도로 위 현장 자리 — 연결로(ic)가 본선에 붙는 곳에서 진행 방향(dir: south = +z 부산방향 · east = +x 잠실방향)으로 ahead 칸(−면 못 미쳐서).
  //  고장차는 갓길, 사고차는 바깥 차로(사고 차량은 차로 위에 보존 — T-Book).
  function hwSpot(sp) {
    sp = sp || { ic: 'E', dir: 'south', ahead: 10, kind: 'broken', label: '경부고속도로 서초IC 부산방향' };
    var T = G.traffic && G.traffic.terrain; if (!T || !T.ring || !T.conns) return null;
    var cn = T.conns.filter(function (c) { return c.ic === sp.ic; })[0]; if (!cn) return null;
    var E = cn.pts[cn.pts.length - 1], R = T.ring, best = 0, bd = 1e9;
    for (var i = 0; i < R.N; i++) { var p = R.P(i), dd = Math.hypot(p.x - E.x, p.z - E.z); if (dd < bd) { bd = dd; best = i; } }
    var P0 = R.P(best), s = sp.dir === 'south' ? (P0.tz >= 0 ? 1 : -1) : sp.dir === 'east' ? (P0.tx >= 0 ? 1 : -1) : 1;
    var P = R.P(((best + s * (sp.ahead || 0)) % R.N + R.N) % R.N);
    var offs = T.laneOffsets ? T.laneOffsets(P) : null;
    var off = sp.kind === 'crash' && offs && offs.length ? offs[offs.length - 1] : ((TG.CONFIG && TG.CONFIG.HW_SHOULDER) || 15.65);
    return { x: P.x + P.rx * off * s, z: P.z + P.rz * off * s, heading: Math.atan2(P.tx * s, P.tz * s), name: sp.label || '' };
  }
  self.hwSpot = hwSpot;   // 검사용
  self.finishNow = function () { if (st && !st.done) { finish(true); st = null; } };   // 검사용: 지금 사슬을 끝낸 것으로
  this.onIncident = function (car) {
    if (!st || st.done || st.steps[st.i].k !== 'scene') return;
    stepDone(0);
  };
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
      if (G.cinema) G.cinema.stamp('작전 종료', st.name, 'gold');   // 🎬 v0.10.16
      notice('✅ 작전 종료 — ' + st.name, 'good', 2400);
      if (G.praise) { G.praise.medal('chain-' + st.id, '작전 완료 · ' + st.name, 40); }
      changed.forEach(function (f) {
        notice('👤 ' + f.name + ' — 다음에는 ' + f.fix, 'good', 5200);
        if (G.praise) G.praise.cheer('help', 40, { feed: '👤 ' + f.name + ' 바뀜', voice: true });
      });
    }
    st.changed = changed.map(function (f) { return { name: f.name, fix: f.fix }; });
    st.restart = 25 + Math.random() * 20;
    releaseJam();
    shiftLog.push({ id: st.id, name: st.name, done: st.log.length, steps: st.steps.length, ok: !!ok, changed: st.changed });
    var s2 = TG.save.get('story', {}) || {}; s2.last = st.id; s2.cleared = (s2.cleared || 0) + (ok ? 1 : 0); TG.save.set('story', s2);
  }

  // ---------- 바깥에서 부르는 것 ----------
  this.start = function () {
    if (!(G.mode === 'patrol' || G.mode === 'open')) { st = null; line(); return false; }
    if (st && !st.done) return false;                              // 이미 돌고 있으면 다시 시작하지 않는다(근무 시작 예약과 겹칠 수 있다)
    var prev = (TG.save.get('story', {}) || {}).last, h = hourNow(), doneNow = {};
    shiftLog.forEach(function (x) { doneNow[x.id] = 1; });
    // 그 시간대 신고(prio)가 이 근무에서 아직 안 나왔으면 먼저 — 아니면 시간에 맞는 일반 사슬 중에서
    var pri = CHAINS.filter(function (x) { return x.prio && availAt(x, h) && !doneNow[x.id]; });
    var pool = CHAINS.filter(function (x) { return !x.prio && availAt(x, h) && x.id !== prev; });
    var c = pri.length ? pri[0] : (pool.length ? pool[Math.floor(Math.random() * pool.length)] : CHAINS[0]);
    var tx = textOf(c);
    st = { id: c.id, name: tx.name, steps: tx.steps, i: 0, t: 0, log: [], touched: {}, done: false, node: null, car: null, openT: 0, spec: c, held: [] };
    notice(tx.open, 'alert', 5600);
    if (game.metrics) game.metrics.ev('radio');
    if (TG.audio.squelch) TG.audio.squelch();
    TG.audio.pa(tx.open.replace('📻 상황실 — ', ''));
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
    if (s.k === 'hw' && pl && st.place && Math.hypot(pl.pos.x - st.place.x, pl.pos.z - st.place.z) < 90) { if (G.hud && G.hud.setTarget) G.hud.setTarget(null); stepDone(0); return; }
    if (s.k === 'jam' && st.car) {
      var bc = st.car, E = G.enforcement;
      if (!bc.violation && bc.v < 0.6 && G.traffic.witness(bc)) {       // 교차로 안에 선 것을 봤다 — 평소 목격과 같은 길로 기록한다
        bc.violation = { type: 'gridlock', t: G.traffic.time, node: st.node, seen: true }; if (bc.marker) bc.marker.visible = true;
        G.traffic.stats.witnessed++; G.traffic.onEvent('witness', bc);
      }
      if (E && E.target === bc) releaseJam();                         // 세우기 시작하면 줄을 풀어 빠져나갈 길을 연다
      if (G.traffic.cars.indexOf(bc) < 0 && st.t > 3) { releaseJam(); stepDone(0); return; }   // 사라졌으면(멀어짐) 넘어간다
      if (st.t > 90) releaseJam();
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
    if (s.k === 'jam') { if (car && car === st.car) { releaseJam(); stepDone(0); } return; }
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
    var todo = CHAINS.map(function (c) { return textOf(c); }).filter(function (c) { return !done[c.name]; });
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
