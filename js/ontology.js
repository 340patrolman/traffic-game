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
  // 사례 한 줄(📍 이 자리) — 출처 등급을 늘 함께 적는다
  self.caseLine = function (k) {
    var c = k.c, f = k.cause;
    return (c.when.days || '') + ' ' + (c.when.time || '') + ' · ' + (f ? f.name : '원인 미상') + ' · ' + c.story +
      (k.measure ? ' → ' + k.measure.name + (c.result ? '(' + c.result + ')' : '') : '') + ' [' + c.src + (c.check ? ' · ' + c.check : '') + ']' +
      (self.clockOn(c.clock, G.ontoDate || new Date()) ? ' · ⏱ 지금 작동 중' : '');
  };
};
