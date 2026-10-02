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
  // 사례 한 줄(📍 이 자리) — 출처 등급을 늘 함께 적는다
  self.caseLine = function (k) {
    var c = k.c, f = k.cause;
    return (c.when.days || '') + ' ' + (c.when.time || '') + ' · ' + (f ? f.name : '원인 미상') + ' · ' + c.story +
      (k.measure ? ' → ' + k.measure.name + (c.result ? '(' + c.result + ')' : '') : '') + ' [' + c.src + (c.check ? ' · ' + c.check : '') + ']';
  };
};
