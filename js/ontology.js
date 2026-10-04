// 🧭 서초구 정체 원인 온톨로지(v0.10.70 · 1단계 — 자료 구조와 읽기만)
//  소유자 「SEOUL PATROL 온톨로지 설계서 ver.1」(2026-10-01): 게임에 부족한 것은 자료의 양이 아니라 자료 사이의 인과 연결이다.
//  현장 판단(정체 원인·대응 원칙)을 정답지로 삼고, 공공자료는 그 구조의 값을 채우고 검증하는 데 쓴다.
//  자료 = data/ontology-seocho.json(지도 목록 항목 `ontology`) · 사람용 설명 = 저장소 ONTOLOGY.md.
//  **이 판은 읽기만 한다** — 차량·신호 동작은 바꾸지 않는다(2~5단계에서 시간표 시계·구간 대기열·경로 선택·조치를 붙인다).
//  모든 값에는 출처 등급(src: 실측 · 현장 지식 · 2차 자료 · 가설 · 설계값 · 확인 필요)이 있다 — 화면에 낼 때도 같이 낸다.
TG.Ontology = function (G) {
  var self = this, D = null, byId = {};
  self.ok = false; self.err = null; self.path = null;
  self.load = function (entry, cb) {
    var f = (entry && entry.ontology) || (TG.MAP && TG.MAP.ontology) || null;
    self.path = f;
    if (!f || location.protocol.indexOf('http') !== 0) { if (cb) cb(null); return; }
    fetch(f).then(function (r) { return r.json(); }).then(function (j) {
      D = j; byId = {};
      Object.keys(j.entities || {}).forEach(function (k) { (j.entities[k] || []).forEach(function (e) { e._kind = k; byId[e.id] = e; }); });
      (j.causeTypes || []).forEach(function (e) { e._kind = 'causeTypes'; byId[e.id] = e; });
      (j.cases || []).forEach(function (e) { e._kind = 'cases'; byId[e.id] = e; });
      (j.scenarios || []).forEach(function (e) { e._kind = 'scenarios'; byId[e.id] = e; });
      // 게임 자리: 격자 교차로([i,j])가 있으면 그 자리, 없고 위경도가 있으면 지도 변환(고무판)으로 옮긴다
      (j.entities.intersections || []).forEach(function (e) {
        var nd = e.game && e.game.node && G.city && G.city.nodes[e.game.node[0]] ? G.city.nodes[e.game.node[0]][e.game.node[1]] : null;
        if (nd) e._xz = [nd.x, nd.z];
        if (e.lat && e.lon && TG.warp && TG.warp.ok) { var q = TG.warp.fromLL(e.lon, e.lat); if (q) { e._ll = q; if (!e._xz) e._xz = q; } }
      });
      self.ok = true; if (cb) cb(null, j);
    }).catch(function (e) { self.err = String(e); if (cb) cb(self.err); });
  };
  self.data = function () { return D; };
  self.get = function (id) { return byId[id] || null; };
  self.list = function (kind) { return D ? (D.entities[kind] || D[kind] || []) : []; };
  self.relations = function (id) { return D ? D.relations.filter(function (r) { return r[0] === id || r[2] === id; }) : []; };
  // 1단계 검사: 격자 교차로로 붙인 개체의 실제 위경도(고무판 변환)가 그 교차로에서 얼마나 떨어지는가 · 끊긴 참조
  self.check = function () {
    if (!D) return null;
    var out = { nodes: [], maxDist: 0, broken: [] };
    (D.entities.intersections || []).forEach(function (e) {
      if (e.game && e.game.node && e._ll && e._xz) { var dd = Math.hypot(e._ll[0] - e._xz[0], e._ll[1] - e._xz[1]); out.nodes.push([e.id, e.game.node.join(','), Math.round(dd)]); out.maxDist = Math.max(out.maxDist, dd); }
    });
    D.relations.forEach(function (r) { if (!byId[r[0]]) out.broken.push(r[0]); if (!byId[r[2]]) out.broken.push(r[2]); if (!D.vocabulary.relations[r[1]]) out.broken.push(r[1]); });
    return out;
  };
  // 이 자리에서 가장 가까운 온톨로지 교차로(r 안)와 그곳의 정체 사례·원인·조치
  self.near = function (x, z, r) {
    if (!D) return null;
    var best = null;
    (D.entities.intersections || []).forEach(function (e) { if (!e._xz) return; var dd = Math.hypot(e._xz[0] - x, e._xz[1] - z); if (dd <= (r || 250) && (!best || dd < best.dist)) best = { ix: e, dist: dd }; });
    if (!best) return null;
    best.cases = (D.cases || []).filter(function (c) { return c.at === best.ix.id; }).map(function (c) {
      return { c: c, cause: byId[c.cause] || null, measure: c.measure ? byId[c.measure] : null };
    });
    return best;
  };
  // ---------- 2단계: 시간표 시계(v0.10.73) — 원인 시설이 정해진 요일·시각에 그 교차로로 차를 보낸다 ----------
  //  설계서 「시뮬레이션 로직 1. 시간표 시계 — 정시·30분에 터미널에서 버스가 나오고, 15:30부터 학원 차량이, 토요일 19시부터 공원 방문 차량이 생긴다」.
  //  시각은 사례의 `clock`(요일·시각·달)만 읽는다 — 숫자를 코드에 적지 않는다. 시계는 기기 날짜·시각(G.ontoDate 로 검사 고정).
  //  보내는 양(몇 초에 한 대 · 어느 접근로)은 **게임 설계값**이다 — 실제 차량 수 자료는 없다(3단계 구간 대기열에서 다시 맞춘다).
  function hm(s) { if (!s) return null; var p = String(s).split(':'); return (+p[0]) * 60 + (+p[1]); }
  self.clockOn = function (k, date) {
    if (!k) return false; if (k.always) return true;
    var d = date || new Date(), dow = d.getDay(), mo = d.getMonth() + 1, m = d.getHours() * 60 + d.getMinutes();
    if (k.days && k.days.indexOf(dow) < 0) return false;
    if (k.months && k.months.indexOf(mo) < 0) return false;
    var a = hm(k.from), b = k.to === null && k.from ? hm('21:00') : hm(k.to);   // 끝 시각 미확인 = 21:00(설계값 · 사례에 적어 둠)
    if (a != null && m < a) return false; if (b != null && m >= b) return false;
    return true;
  };
  function wetOrWindy() { var w = G.weather && G.weather.name; return w === 'rain' || w === 'snow' || w === 'windy'; }
  self.activeAt = function (date) {
    if (!D) return [];
    return (D.cases || []).filter(function (c) {
      if (!self.clockOn(c.clock, date)) return false;
      if (c.clock && c.clock.stopIf && wetOrWindy()) return false;            // 분수: 비·강풍이면 운영 중지(cf.fountain.stopWhen)
      return true;
    }).map(function (c) { return { c: c, ix: byId[c.at] || null, cause: byId[c.cause] || null }; });
  };
  // 사례별 보내는 길 — node = 차가 몰리는 교차로(격자에 없는 반포대교남단은 대기열이 차오르는 고속터미널 사거리) · dirs = 들어오는 방향(0 남 1 동 2 북 3 서)
  var FLOW = {
    'cs.stMaryWeekday':    { node: 'ix.stMary',        dirs: [3, 3, 3, 0, 2], every: 6 },   // 삼호가든·궁전 학원가 → 사평대로 서행으로 성모병원
    'cs.fountainSat':      { node: 'ix.terminalUnder', dirs: [2, 2, 2, 1], every: 5 },      // 반포대로 북행 → 반포대교남단·한강공원(대기열이 고속터미널까지)
    'cs.shinsegaeEvening': { node: 'ix.terminalUnder', dirs: [0, 1, 3, 2], every: 9 },      // 사방에서 개별 차량 수렴
    'cs.samhoHalfHour':    { node: 'ix.samhoGarden',   dirs: [1, 1, 0], pulse: true, n: 2, type: 'bus' }   // 10분 단위 시각마다 고속버스
  };
  var st = {};
  self.reset = function () { st = {}; self.sent = 0; self.told = {}; };
  self.reset();
  self.flowOf = function (id) { return FLOW[id] || null; };
  function spawnTo(node, d, type) {
    var city = G.city, prev = city.nodeFrom(node, (d + 2) % 4); if (!prev) return null;
    var f = TG.DIR_VEC[d], r = [-f[1], f[0]], seg = Math.hypot(node.x - prev.x, node.z - prev.z);
    var dist = Math.min(seg * 0.75, 110 + Math.random() * 60);
    var axis = (d === 0 || d === 2) ? 'v' : 'h', idx = axis === 'v' ? node.i : node.j, lanes = city.lanesOf(axis, idx);
    var lane = type === 'bus' ? Math.max(0, lanes - 1) : Math.floor(Math.random() * lanes), off = city.laneOff(axis, idx, lane);
    var x = node.x - f[0] * dist + r[0] * off, z = node.z - f[1] * dist + r[1] * off;
    if (city.onRoad && !city.onRoad(x, z)) return null;
    var car = G.traffic.spawn({ at: { x: x, z: z, d: d, node: prev }, type: type || (Math.random() < 0.18 ? 'van' : 'sedan'), laneIdx: lane, violator: false, v: 8, cruise: 10 });
    if (car) { car.ontoCause = true; self.sent++; }
    return car;
  }
  var DEMAND_MODES = { patrol: 1, free: 1, open: 1, duty: 1 };
  self.tick = function (dt) {
    if (!D || !self.ok || !G.traffic || !G.city || !DEMAND_MODES[G.mode] || G.state !== 'play') return;
    var p = G.player && G.player.pos; if (!p) return;
    var now = G.ontoDate || new Date(), mk = now.getHours() * 60 + now.getMinutes();
    self.activeAt(now).forEach(function (a) {
      var F = FLOW[a.c.id]; if (!F) return;
      var ix = byId[F.node]; if (!ix || !ix.game || !ix.game.node) return;
      var node = G.city.nodes[ix.game.node[0]] && G.city.nodes[ix.game.node[0]][ix.game.node[1]]; if (!node) return;
      if (Math.hypot(node.x - p.x, node.z - p.z) > 520) return;                   // 플레이어 둘레에서만(차는 둘레 약 130m 밖에서 지워지지 않게 그 안팎에 둔다)
      var s = st[a.c.id] || (st[a.c.id] = { t: 0, k: 0, pulse: -1 });
      if (!self.told[a.c.id]) { self.told[a.c.id] = true; if (G.officerSay) G.officerSay('🧭 지금 ' + (a.c.when.days || '') + ' ' + (a.c.when.time || '') + ' — ' + (a.cause ? a.cause.name : '') + ' 수요가 ' + ix.name + '(으)로 몰린다 [' + a.c.src + ']'); }
      if (G.traffic.cars.length > (TG.CONFIG.TRAFFIC_MAX || 26) * 1.5) return;
      if (F.pulse) {
        var ev = a.c.clock && a.c.clock.every || 10;
        if (mk % ev === 0 && s.pulse !== mk) { s.pulse = mk; for (var q = 0; q < (F.n || 1); q++) spawnTo(node, F.dirs[(s.k++) % F.dirs.length], F.type); }
        return;
      }
      s.t += dt; if (s.t < F.every) return; s.t = 0;
      spawnTo(node, F.dirs[(s.k++) % F.dirs.length], F.type);
    });
  };
  // ---------- 3단계: 구간 대기열(v0.10.75) — 하류가 못 받으면 대기열이 상류로 차오른다 ----------
  //  설계서 「구간 대기열 — 사평대로 수용량 초과 시 상류 역류」. 대기열은 **플레이어가 멀어도 늘 돈다**(차를 만들지 않고 숫자로) —
  //  가까이 가면 그 수만큼 정지 차량을 접근로에 실제로 세운다.
  //  값의 출처(data/ontology-seocho.json queueModel 이 정한다 · 코드에 숫자를 적지 않는다):
  //   · 빠지는 양 = 포화교통류율(도로용량편람 2013 · 2차 자료) × 차로 수(구간 lanes · 출처 그대로) — **하류 신호가 실제로 녹색일 때만**
  //   · 들어오는 양 = 서울시 교통량 조사 그 시각 값(실측 · 방향 구분 미확인이라 두 방향 평균) + 지금 작동 중인 원인 시설 수요(설계값)
  //   · 대기 길이 = 대수 ÷ 차로 수 × 한 대 길이(설계값). 구간 길이를 넘으면 spillsBackTo 관계의 상류 구간으로 넘친다.
  var Q = {}, QM = null, qMat = 0;
  function nodeOf(ij) { return ij && G.city.nodes[ij[0]] && G.city.nodes[ij[0]][ij[1]]; }
  function dirOf(a, b) { var dx = b.x - a.x, dz = b.z - a.z; return Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? 1 : 3) : (dz > 0 ? 0 : 2); }
  function sigOf(node, d) { var s = G.signals && G.signals.moveState ? G.signals.moveState(node, d, 'S') : null; return typeof s === 'string' ? s : s && s.s; }
  function arrival(sg, A, B, date) {
    var cd = G.citydata, vol = 0, vsrc = '자료 없음';
    if (cd && cd.volSpot && cd.volAt) {
      var axis = (sg._d === 0 || sg._d === 2) ? 'v' : 'h', idx = axis === 'v' ? A.i : A.j;
      var sp = cd.volSpot(axis, idx, (A.x + B.x) / 2, (A.z + B.z) / 2), v = sp ? cd.volAt(sp, date) : null;
      if (v && v.now === 0 && v.type !== 'wd') { var wd = new Date(date.getTime()); while (wd.getDay() === 0 || wd.getDay() === 6) wd.setDate(wd.getDate() + 1); v = cd.volAt(sp, wd); vsrc = ' (그날 조사 없음 → 평일 값)'; } else vsrc = '';
      if (v && v.dir) { vol = (v.dir[0] + v.dir[1]) / 2; vsrc = sp.name + ' ' + date.getHours() + '시' + vsrc + ' · 두 방향 평균'; }
    }
    var cause = 0;   // 지금 작동 중인 원인 시설이 이 접근로로 보내는 차(2단계 FLOW · 설계값)
    self.activeAt(date).forEach(function (a) {
      var F = FLOW[a.c.id]; if (!F || F.pulse || F.node !== sg.to) return;
      var k = F.dirs.filter(function (x) { return x === sg._d; }).length; if (k) cause += 3600 / F.every * k / F.dirs.length;
    });
    return { vph: vol + cause, vol: vol, cause: cause, src: vsrc };
  }
  self.queueTick = function (dt) {
    if (!D || !self.ok || !G.city || !G.signals) return;
    QM = QM || D.queueModel || null; if (!QM) return;
    var date = G.ontoDate || new Date(), sat = QM.saturation.v, sp = QM.spacing.v;
    (D.entities.segments || []).forEach(function (sg) {
      if (!sg.game || !sg.game.from || !sg.lanes || !sg.lanes.v) return;
      var A = nodeOf(sg.game.from), B = nodeOf(sg.game.to); if (!A || !B) return;
      if (sg._d == null) { sg._d = dirOf(A, B); sg._len = Math.max(20, Math.hypot(B.x - A.x, B.z - A.z) - G.city.stopDist(B, sg._d)); }
      var q = Q[sg.id] || (Q[sg.id] = { q: 0, max: 0, spill: false, inT: 0, in: null });
      q.inT -= dt; if (q.inT <= 0 || !q.in) { q.in = arrival(sg, A, B, date); q.inT = 30; }
      var lanes = sg.lanes.v, s = sigOf(B, sg._d), cap = sat * lanes;
      var down = (D.relations || []).filter(function (r) { return r[1] === 'spillsBackTo' && r[2] === sg.id && Q[r[0]] && Q[r[0]].spill; }).length;   // 하류가 넘치면 이 구간도 막힌다
      var out = (s === 'green' ? cap : 0) * (down ? QM.blockedShare.v : 1);
      q.q = Math.min(lanes * sg._len / sp * 3, Math.max(0, q.q + (q.in.vph - out) * dt / 3600));   // 상한 = 구간 저장량의 3배(넘친 몫은 상류 구간까지 차 있는 것으로 본다)
      q.lenM = q.q / lanes * sp; q.spill = q.lenM > sg._len; q.max = Math.max(q.max, q.q);
      q.sig = s; q.cap = cap; q.blocked = !!down;
    });
    // 플레이어가 가까우면 대기열을 실제 정지 차량으로 세운다(초당 2대까지 · 이미 있는 차는 센다)
    qMat -= dt; if (qMat > 0) return; qMat = 0.5;
    var p = G.player && G.player.pos; if (!p || !G.traffic || G.state !== 'play' || !DEMAND_MODES[G.mode]) return;
    if (G.traffic.cars.length > (TG.CONFIG.TRAFFIC_MAX || 26) * 1.6) return;
    (D.entities.segments || []).forEach(function (sg) {
      var q = Q[sg.id]; if (!q || q.q < 1 || sg._d == null) return;
      var B = nodeOf(sg.game.to), d = sg._d; if (!B || Math.hypot(B.x - p.x, B.z - p.z) > 260) return;
      var f = TG.DIR_VEC[d], r = [-f[1], f[0]], axis = (d === 0 || d === 2) ? 'v' : 'h', idx = axis === 'v' ? B.i : B.j, lanes = Math.min(G.city.lanesOf(axis, idx), sg.lanes.v);
      var want = Math.min(Math.floor(q.q), lanes * 12), have = G.traffic.cars.filter(function (c) {
        var dx = B.x - c.pos.x, dz = B.z - c.pos.z, along = dx * f[0] + dz * f[1];
        return along > 0 && along < sg._len + G.city.stopDist(B, d) && Math.abs(dx * r[0] + dz * r[1]) < 3.5 * lanes + 2 && Math.abs(Math.sin(c.heading) * f[0] + Math.cos(c.heading) * f[1]) > 0.7;
      }).length;
      if (have >= want) return;
      var k = have, lane = k % lanes, rank = Math.floor(k / lanes), dist = G.city.stopDist(B, d) + 3 + rank * QM.spacing.v;
      if (dist > sg._len + G.city.stopDist(B, d) - 6 || Math.hypot(B.x - p.x - f[0] * dist, B.z - p.z - f[1] * dist) < 25) return;   // 구간 밖·플레이어 코앞에는 안 세운다
      var off = G.city.laneOff(axis, idx, lane), x = B.x - f[0] * dist + r[0] * off, z = B.z - f[1] * dist + r[1] * off;
      if (G.traffic.cars.some(function (c) { return Math.hypot(c.pos.x - x, c.pos.z - z) < 5.5; })) return;
      var prev = G.city.nodeFrom(B, (d + 2) % 4); if (!prev) return;
      var car = G.traffic.spawn({ at: { x: x, z: z, d: d, node: prev }, type: Math.random() < 0.15 ? 'van' : 'sedan', laneIdx: lane, violator: false, v: 0, cruise: 10 });
      if (car) { car.ontoQueue = sg.id; self.queued = (self.queued || 0) + 1; }
    });
  };
  self.queues = function () { return Q; };
  self.queueLine = function (sg) {
    var q = Q[sg.id]; if (!q || !q.in || !QM) return null;
    return sg.road + ' ' + sg.dir + ' — 대기 약 ' + Math.round(q.q) + '대 · ' + Math.round(q.lenM) + 'm' + (q.spill ? ' ⚠ 구간을 넘쳐 상류로 역류' : '') + (q.blocked ? ' · 하류가 막혀 덜 빠짐' : '') +
      ' (들어옴 ' + Math.round(q.in.vph) + '대/시 = 조사 ' + Math.round(q.in.vol) + (q.in.cause ? ' + 원인 시설 ' + Math.round(q.in.cause) : '') + ' · 녹색일 때 빠짐 ' + q.cap + '대/시 = ' + QM.saturation.v + ' × ' + sg.lanes.v + '차로[' + sg.lanes.src + '])';
  };
  self.queuesNear = function (x, z, r) {
    if (!D) return [];
    return (D.entities.segments || []).filter(function (sg) { var B = sg.game && nodeOf(sg.game.to); return B && Q[sg.id] && Math.hypot(B.x - x, B.z - z) <= (r || 300); });
  };
  // 사례 한 줄(📍 이 자리) — 출처 등급을 늘 함께 적는다
  self.caseLine = function (k) {
    var c = k.c, f = k.cause;
    return (c.when.days || '') + ' ' + (c.when.time || '') + ' · ' + (f ? f.name : '원인 미상') + ' · ' + c.story +
      (k.measure ? ' → ' + k.measure.name + (c.result ? '(' + c.result + ')' : '') : '') + ' [' + c.src + (c.check ? ' · ' + c.check : '') + ']' +
      (self.clockOn(c.clock, G.ontoDate || new Date()) ? ' · ⏱ 지금 작동 중' : '');
  };
};
