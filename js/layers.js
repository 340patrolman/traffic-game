// 지도 레이어. 도로 위에 데이터를 겹쳐 쌓아 본다 — 디지털 트윈으로 가는 첫 층(소유자 방향).
// 레이어는 세 갈래다.
//   ① 외부 데이터: TAAS 교통사고 자료(data/taas.json). **파일에 있는 값만** 쓴다 — 코드에 사고 건수를 적지 않고, 지어내지 않는다.
//   ② 지도가 이미 아는 것: 어린이보호구역, 무인 단속 장비.
//   ③ 시뮬레이션이 만드는 것: 위험도(급제동·보행자 근접·신호위반을 교차로별로 쌓는다) — 외부 자료가 없어도 오늘 바로 쌓인다.
// 켜고 끈 상태는 localStorage `tg_layers` 에 저장한다.
TG.Layers = function (game, city, cfg, scene) {
  var self = this;
  var group = new THREE.Group();
  scene.add(group);
  var meshes = {};           // id → THREE.Group
  var on = {};               // id → boolean
  var taas = null;           // data/taas.json
  var nodes = null;          // data/taas-nodes-<지도>.json — 교차로별 사고 집계
  var fatal = null;          // data/taas-fatal-<지도>.json — 사망사고 한 건씩(집계하지 않는다)
  var vuln = null;           // data/taas-vuln-<지도>.json — 어린이·보행자·노인·자전거(홍보용 분포까지)
  var roads = null;          // data/maps/<지도>-roads.json — **실제 도로 형상**(디지털 트윈 T1-a). 트윈 지도에만 있다
  var defs = [];             // 레이어 정의(순서 = 그리는 순서)
  // 시뮬레이션 위험도: 교차로별로 사건을 쌓는다. { 'i,j': {brake, near, red, total} }
  var risk = {};
  self.risk = risk;
  self.stats = { events: 0 };

  function keyOf(node) { return node.i + ',' + node.j; }
  function riskAt(node) { return risk[keyOf(node)] || null; }
  self.riskAt = riskAt;
  // 게임이 위험한 일을 볼 때마다 부른다. kind: 'brake'(급제동) 'near'(보행자 근접) 'red'(신호위반)
  self.mark = function (node, kind) {
    if (!node) return;
    var k = keyOf(node), r = risk[k] = risk[k] || { brake: 0, near: 0, red: 0, total: 0, i: node.i, j: node.j };
    if (r[kind] === undefined) return;
    r[kind]++; r.total++; self.stats.events++;
    if (on.risk) build('risk');
  };
  self.resetRisk = function () { for (var k in risk) delete risk[k]; self.stats.events = 0; if (on.risk) build('risk'); };

  // ---- 데이터 ----
  function load(cb) {
    var saved = TG.save.get('layers', null);
    if (location.protocol.indexOf('http') !== 0) { defsBuild(); if (cb) cb('file:// — data/taas.json 을 읽을 수 없습니다'); return; }
    var tf = (TG.MAP_ENTRY && TG.MAP_ENTRY.taas) || (TG.MAP && TG.MAP.taas) || 'data/taas.json';   // 지도마다 다른 사고 자료 파일
    fetch(tf).then(function (r) { return r.json(); }).then(function (j) {
      taas = j;
      // 교차로별 사고 집계(있으면). 개별 사고가 아니라 집계값이다 — 개인 속성은 애초에 담지 않았다.
      var nf = (TG.MAP_ENTRY && TG.MAP_ENTRY.taasNodes) || (TG.MAP && TG.MAP.taasNodes) || null;
      var after = function () {
        defsBuild();
        if (saved && typeof saved === 'object') Object.keys(saved).forEach(function (k) { if (k in on) on[k] = !!saved[k]; });
        apply();
        if (self.refreshPanel) self.refreshPanel();   // 자료가 늦게 와도 패널이 비어 있지 않게
        if (cb) cb(null, j);
      };
      // 사망사고는 건수가 적어 뭉치지 않는다 — 한 건씩 사례로 읽는다
      var ff = (TG.MAP_ENTRY && TG.MAP_ENTRY.taasFatal) || (TG.MAP && TG.MAP.taasFatal) || null;
      // 어린이·보행자·노인·자전거 — 홍보 활동에 쓸 분포까지 같이 들어 있다
      var vf = (TG.MAP_ENTRY && TG.MAP_ENTRY.taasVuln) || (TG.MAP && TG.MAP.taasVuln) || null;
      // 실제 도로 형상(OSM) — 트윈 지도 항목에 roads 가 있을 때만
      var rf = (TG.MAP_ENTRY && TG.MAP_ENTRY.roads) || (TG.MAP && TG.MAP.roads) || null;
      var loadRoads = function () {
        if (!rf) { after(); return; }
        fetch(rf).then(function (r5) { return r5.json(); }).then(function (v5) { roads = v5; after(); }).catch(function () { after(); });
      };
      var loadVuln = function () {
        if (!vf) { loadRoads(); return; }
        fetch(vf).then(function (r4) { return r4.json(); }).then(function (v4) { vuln = v4; loadRoads(); }).catch(function () { loadRoads(); });
      };
      var loadFatal = function () {
        if (!ff) { loadVuln(); return; }
        fetch(ff).then(function (r3) { return r3.json(); }).then(function (f3) { fatal = f3; loadVuln(); }).catch(function () { loadVuln(); });
      };
      if (!nf) { loadFatal(); return; }
      return fetch(nf).then(function (r2) { return r2.json(); }).then(function (n2) { nodes = n2; loadFatal(); })
        .catch(function () { loadFatal(); });
    }).catch(function (e) { defsBuild(); if (self.refreshPanel) self.refreshPanel(); if (cb) cb(e.message); });
  }
  function defsBuild() {
    defs = [];
    (taas && taas.layers ? taas.layers : []).forEach(function (L) {
      defs.push({ id: L.id, name: L.name, color: L.color || '#e5484d', kind: 'taas', src: L, desc: L.desc || '' });
    });
    if (nodes && nodes.nodes && nodes.nodes.length) {
      defs.push({ id: 'taasNode', name: '교차로별 사고 집계', color: '#ff7ab6', kind: 'taas',
        src: { items: nodes.nodes.map(function (n) {
          return { node: n.node, name: n.name, total: n.total, death: n.death, serious: n.serious,
                   slight: n.slight, report: n.report, types: n.types, violations: n.violations,
                   vehicles: n.vehicles, roadForms: n.roadForms, year: nodes.years, verified: true, approx: true };
        }) },
        desc: (nodes.years || '') + ' · 사고 ' + (nodes.collected || 0) + '건 중 교차로 반경 약 600m 안 ' + (nodes.assigned || 0) + '건' });
    }
    if (fatal && fatal.cases && fatal.cases.length) {
      // 사망사고: 원의 크기로 세기를 나타내지 않는다 — 한 건은 한 건이다. 크기를 고정한다.
      defs.push({ id: 'taasFatal', name: '사망사고', color: '#ff2d2d', kind: 'taas',
        src: { items: fatal.cases.filter(function (c) { return c.inMap; }).map(function (c) {
          return { xz: [c.gx, c.gz], radius: 11, name: c.typeH + ' · ' + c.typeM, year: c.y + '년 ' + c.m + '월',
            total: null, death: c.dead, serious: c.ser, verified: true, approx: true, fatal: true,
            caseLine: c.tz + ' ' + c.hh + '시 · ' + c.dow + '요일 · ' + c.wx + ' · ' + c.road + ' · ' + c.viol +
              ' · ' + c.wr + (c.dm && c.dm !== '없음' ? ' → ' + c.dm : '') };
        }) },
        desc: fatal.years + ' 사망사고 ' + fatal.collected + '건 중 이 지도 안 ' + fatal.inMap + '건 — 한 건씩 사례로 둔다' });
    }
    // 어린이·보행자·노인·자전거: 교차로 부근 집계로 얹는다. 어린이 보행자만 건수가 적어 한 건씩 사례로 둔다.
    if (vuln && vuln.groups) vuln.groups.forEach(function (g) {
      var items;
      if (g.cases && g.cases.length) {
        items = g.cases.map(function (c) {
          return { xz: [c[11], c[12]], radius: 10, name: g.name + ' · ' + c[5], year: c[0] + '년 ' + c[1] + '월',
            total: null, death: 0, verified: true, approx: true,
            caseLine: c[3] + ' ' + c[4] + '시 · ' + c[2] + '요일 · ' + c[7] + ' · ' + c[8] + ' · ' + c[6] + ' · 가해 ' + c[9] + ' · ' + c[10] };
        });
      } else {
        items = (g.nodes || []).map(function (n) {
          // 교차로 이름은 파일이 아니라 지도가 가지고 있다 — 지도를 바꾸면 이름도 따라 바뀐다
          var nd = city.nodes[n[0]] && city.nodes[n[0]][n[1]];
          return { node: [n[0], n[1]], name: nd ? city.nodeName(nd) + ' 부근' : null,
            total: n[2], death: n[3], serious: n[4], slight: n[5], report: n[6],
            year: vuln.years, verified: true, approx: true, agg: true };
        });
      }
      defs.push({ id: 'vuln_' + g.id, name: g.name, color: g.color || '#ef476f', kind: 'taas', src: { items: items },
        desc: vuln.years + ' ' + g.total + '건 · 사망 ' + g.dead + ' · 중상 ' + g.ser +
          (g.cases ? ' · 한 건씩 사례' : ' · 교차로 부근 ' + (g.total - g.outside) + '건, 격자 바깥 ' + g.outside + '건') });
    });
    // 실제 도로 형상(디지털 트윈 T1-a) — **주행에는 아직 쓰지 않는다.** 지금 직선 격자와 얼마나 다른지 겹쳐 보는 층이다.
    if (roads && roads.roads) {
      var rn = Object.keys(roads.roads), dsum = 0, dmax = 0;
      rn.forEach(function (k) { var R = roads.roads[k]; dsum += R.devAvg || 0; if ((R.devMax || 0) > dmax) dmax = R.devMax; });
      defs.push({ id: 'twinRoads', name: '실제 도로 형상(OSM)', color: '#4cc3ff', kind: 'roads', src: roads,
        desc: '간선 ' + rn.length + '개 · 지금 직선 격자에서 평균 ' + (dsum / Math.max(1, rn.length)).toFixed(1) + 'm · 최대 ' + dmax.toFixed(1) + 'm 벗어난다 · ' + (roads.source || '') });
    }
    defs.push({ id: 'schoolZone', name: '어린이보호구역', color: '#f5c518', kind: 'zone', desc: '제한 30km/h · 범칙금·벌점 2배(08~20시)' });
    defs.push({ id: 'camera', name: '무인 단속 장비', color: '#2f8f5a', kind: 'cam', desc: '교통시설 관리에서 설치한 신호·과속 단속 장비' });
    defs.push({ id: 'risk', name: '시뮬레이션 위험도', color: '#d33bd3', kind: 'risk', desc: '이 기기에서 달린 결과 — 급제동·보행자 근접·신호위반을 교차로별로 쌓는다' });
    defs.forEach(function (d) { if (!(d.id in on)) on[d.id] = false; });
  }
  self.list = function () {
    return defs.map(function (d) {
      return { id: d.id, name: d.name, color: d.color, desc: d.desc, on: !!on[d.id], count: countOf(d), note: noteOf(d) };
    });
  };
  function realItems(d) { return (d.src && d.src.items ? d.src.items : []).filter(function (it) { return !it.example; }); }
  function countOf(d) {
    if (d.kind === 'taas') return (d.src.items || []).length;
    if (d.kind === 'zone') return 1;
    if (d.kind === 'cam') return game.facil ? game.facil.count() : 0;
    if (d.kind === 'risk') return Object.keys(risk).length;
    if (d.kind === 'roads') return Object.keys((d.src && d.src.roads) || {}).length;
    return 0;
  }
  function noteOf(d) {
    if (d.kind !== 'taas') return '';
    var all = d.src.items || [], real = realItems(d);
    if (!all.length) return '데이터 없음 — TAAS 자료를 data/taas.json 에 넣으면 지도에 뜹니다';
    if (!real.length) return '예시만 있습니다 — 실제 TAAS 값으로 교체하세요';
    if (d.id === 'taasFatal') return real.length + '건 · 사망 ' + real.reduce(function (s, it) { return s + (it.death || 0); }, 0) + '명 · 원 크기는 세기가 아니라 자리만 나타낸다';
    var ys = {}; real.forEach(function (it) { if (it.year) ys[it.year] = 1; });
    var yl = Object.keys(ys).sort();
    var ap = real.filter(function (it) { return it.approx; }).length;
    var un = real.filter(function (it) { return !it.verified; }).length;
    return real.length + '건' + (yl.length ? ' · ' + yl.join('·') + '년 공표' : '') +
      (ap ? ' · 위치 근사 ' + ap + '건' : '') + (un ? ' · 확인 중 ' + un + '건' : '');
  }
  self.nodesNote = function () { return nodes ? { source: nodes.source, attribution: nodes.attribution, years: nodes.years,
    collected: nodes.collected, assigned: nodes.assigned, outside: nodes.outside, byGrade: nodes.byGrade,
    method: nodes.method, caution: nodes.caution, notice: nodes.notice, wholeGu: nodes.wholeGu } : null; };
  self.vulnNote = function () { return vuln ? { source: vuln.source, attribution: vuln.attribution, years: vuln.years,
    method: vuln.method, privacy: vuln.privacy, caution: vuln.caution, highlights: vuln.highlights || [],
    groups: (vuln.groups || []).map(function (g) { return { id: g.id, name: g.name, total: g.total, dead: g.dead,
      ser: g.ser, outside: g.outside, dist: g.dist }; }) } : null; };
  self.fatalNote = function () { return fatal ? { source: fatal.source, attribution: fatal.attribution, years: fatal.years,
    collected: fatal.collected, inMap: fatal.inMap, outsideMap: fatal.outsideMap, casualties: fatal.casualties,
    byYear: fatal.byYear, byViolation: fatal.byViolation, byType: fatal.byType, byTimeZone: fatal.byTimeZone,
    byOffender: fatal.byOffender, byVictim: fatal.byVictim, method: fatal.method, privacy: fatal.privacy, caution: fatal.caution } : null; };
  self.sourceNote = function () { return taas ? { source: taas.source, sourceUrl: taas.sourceUrl, attribution: taas.attribution,
    years: taas.years, howto: taas.howto, updated: taas.updated, region: taas.region, criteria: taas.criteria, mapping: taas.mapping } : null; };

  // ---------- T5: 실제 사고 ↔ 시뮬레이션 위험도 비교(디지털 트윈) ----------
  // 소유자 방향(v0.9.22): 「군대에서 하는 워 게임 같은 것을 실제 도로 데이터들을 받아서 돌리는 것이다.」
  // 실제로 사람이 다친 곳과, 이 기기에서 달려 본 결과가 위험하다고 말하는 곳이 **같은 곳인가**를 맞대 본다.
  //  · 실제(real) = TAAS 교차로별 사고. 위험 가중은 **사망 ×6 · 중상 ×0.6**(v0.9.23 원 크기와 같은 가중)
  //  · 시뮬(sim)  = 이 기기에서 쌓인 급제동·보행자 근접·신호위반. 가중은 **보행자 근접 ×3 · 신호위반 ×2 · 급제동 ×1**
  //    (사람이 다칠 수 있는 순서다 — 게임 설계값이고 법령·통계에서 온 값이 아니다)
  // 순위를 비교한다(점수 자체는 단위가 다르다). 표본이 적을 때는 「아직 이르다」고 말한다 — 없는 결론을 만들지 않는다.
  function realScore(n) { return (n.total || 0) + (n.death || 0) * 6 + (n.serious || 0) * 0.6; }
  function simScore(r) { return (r.brake || 0) + (r.near || 0) * 3 + (r.red || 0) * 2; }
  self.compare = function (topN) {
    topN = topN || 8;
    if (!nodes || !nodes.nodes) return null;
    var real = nodes.nodes.map(function (n) { return { key: n.node[0] + ',' + n.node[1], name: n.name, total: n.total, death: n.death, serious: n.serious, score: realScore(n) }; })
      .sort(function (a, b) { return b.score - a.score; });
    var rrank = {}; real.forEach(function (r, i) { rrank[r.key] = i + 1; });
    var sim = Object.keys(risk).map(function (k) {
      var r = risk[k], nd = city.nodes[r.i] && city.nodes[r.i][r.j];
      return { key: k, name: nd ? city.nodeName(nd) : k, brake: r.brake, near: r.near, red: r.red, total: r.total, score: simScore(r) };
    }).sort(function (a, b) { return b.score - a.score; });
    var srank = {}; sim.forEach(function (r, i) { srank[r.key] = i + 1; });
    // 실제 상위 topN 곳이 시뮬 순위에서 어디에 있는가
    var rows = real.slice(0, topN).map(function (r) {
      return { key: r.key, name: r.name, realRank: rrank[r.key], real: r.total, death: r.death,
               simRank: srank[r.key] || null, sim: (risk[r.key] ? simScore(risk[r.key]) : 0) };
    });
    var hit = rows.filter(function (r) { return r.simRank && r.simRank <= topN + 2; }).length;
    var events = self.stats.events;
    return { rows: rows, simTop: sim.slice(0, topN), realN: real.length, simN: sim.length, events: events,
             hit: hit, topN: topN, enough: events >= 40 && sim.length >= 5,
             years: nodes.years || '', weights: { real: '사망×6 · 중상×0.6', sim: '보행자 근접×3 · 신호위반×2 · 급제동×1' } };
  };
  self.raw = function (id) { for (var i = 0; i < defs.length; i++) if (defs[i].id === id) return defs[i].src || null; return null; };   // 검증용: 그 층의 원자료
  self.toggle = function (id, want) {
    if (!(id in on)) return false;
    on[id] = (want === undefined) ? !on[id] : !!want;
    TG.save.set('layers', on);
    apply();
    return on[id];
  };
  self.isOn = function (id) { return !!on[id]; };
  function apply() { defs.forEach(function (d) { if (on[d.id]) build(d.id); else clear(d.id); }); }
  self.refresh = apply;

  // ---- 그리기 ----
  function clear(id) {
    var g = meshes[id]; if (!g) return;
    group.remove(g);
    g.traverse(function (o) { if (o.geometry) o.geometry.dispose(); });
    delete meshes[id];
  }
  function disc(gb, x, z, r, color, y) {
    var seg = 22, y0 = (y === undefined ? 0.09 : y);
    for (var i = 0; i < seg; i++) {
      var a0 = i / seg * Math.PI * 2, a1 = (i + 1) / seg * Math.PI * 2;
      gb.quad([x, y0, z], [x + Math.cos(a0) * r, y0, z + Math.sin(a0) * r], [x + Math.cos(a1) * r, y0, z + Math.sin(a1) * r], [x, y0, z], [0, 1, 0], color, null);
    }
  }
  function ring(gb, x, z, r, w, color, y) {
    var seg = 30, y0 = (y === undefined ? 0.11 : y);
    for (var i = 0; i < seg; i++) {
      var a0 = i / seg * Math.PI * 2, a1 = (i + 1) / seg * Math.PI * 2;
      gb.quad([x + Math.cos(a0) * (r - w), y0, z + Math.sin(a0) * (r - w)], [x + Math.cos(a0) * r, y0, z + Math.sin(a0) * r],
              [x + Math.cos(a1) * r, y0, z + Math.sin(a1) * r], [x + Math.cos(a1) * (r - w), y0, z + Math.sin(a1) * (r - w)], [0, 1, 0], color, null);
    }
  }
  function hex(c) { return parseInt(String(c).replace('#', ''), 16) || 0xffffff; }
  // 원 크기: 사고건수 + 사망·중상 가중. TAAS 다발지 기준은 반경 100m 라 최대도 그 안에 둔다.
  function radOf(it) {
    if (it.radius) return it.radius;   // 사망사고처럼 크기를 고정한 항목
    if (it.types || it.agg) {   // 교차로별 집계(건수가 수백) — 제곱근으로 눌러 화면을 덮지 않게
      var t = (it.total || 0) + (it.death || 0) * 20;
      return Math.max(12, Math.min(38, 8 + Math.sqrt(t) * 2.0));
    }
    var w = (it.total || 0) + (it.death || 0) * 6 + (it.serious || 0) * 0.6;
    return Math.max(14, Math.min(50, 12 + w * 0.9));
  }
  function posOf(it) {
    if (it.node && city.nodes[it.node[0]] && city.nodes[it.node[0]][it.node[1]]) { var n = city.nodes[it.node[0]][it.node[1]]; return [n.x, n.z]; }
    if (it.xz) return [it.xz[0], it.xz[1]];
    return null;
  }
  self.itemsOf = function (id) {
    var d = null; defs.forEach(function (x) { if (x.id === id) d = x; });
    if (!d || d.kind !== 'taas') return [];
    return (d.src.items || []).map(function (it) { var p = posOf(it); return p ? { it: it, x: p[0], z: p[1] } : null; }).filter(Boolean);
  };

  function build(id) {
    clear(id);
    var d = null; defs.forEach(function (x) { if (x.id === id) d = x; });
    if (!d) return;
    var g = new THREE.Group(), gb = new TG.GeoBuilder(), col = hex(d.color), any = false;
    if (d.kind === 'taas') {
      (d.src.items || []).forEach(function (it) {
        var p = posOf(it); if (!p) return;
        var r = radOf(it);
        disc(gb, p[0], p[1], r, col, 0.09); ring(gb, p[0], p[1], r + 1.6, 1.2, col, 0.10);
        any = true;
      });
    } else if (d.kind === 'zone') {
      var sb = city.schoolBlock, x0 = city.xs[sb.i], x1 = city.xs[sb.i + 1], z0 = city.zs[sb.j], z1 = city.zs[sb.j + 1];
      gb.rect((x0 + x1) / 2, (z0 + z1) / 2, x1 - x0, z1 - z0, 0, 0.08, col); any = true;
    } else if (d.kind === 'cam') {
      (game.facil ? game.facil.list() : []).forEach(function (C) {
        var nd = city.nodes[C.i][C.j], f = TG.DIR_VEC[C.d];
        var back = city.stopDist(nd, C.d) + 14;
        disc(gb, nd.x - f[0] * back, nd.z - f[1] * back, 9, col, 0.09); any = true;
      });
    } else if (d.kind === 'risk') {
      Object.keys(risk).forEach(function (k) {
        var r0 = risk[k], nd = city.nodes[r0.i][r0.j];
        var rr = 12 + Math.min(28, r0.total * 2.2);
        disc(gb, nd.x, nd.z, rr, col, 0.09); ring(gb, nd.x, nd.z, rr + 1.4, 1.1, col, 0.10); any = true;
      });
    }
    if (!any) return;
    // 부채꼴 삼각형의 감김 방향이 위에서 볼 때 뒤를 보는 경우가 있어 **양면**으로 그린다(안 그러면 원이 거의 안 보인다).
    var m = new THREE.Mesh(gb.build(), new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.46, side: THREE.DoubleSide, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
    g.add(m); group.add(g); meshes[id] = g;
  }

  // ---- 지금 어느 사고다발지 안인가(HUD 안내용) ----
  self.hotAt = function (x, z) {
    for (var i = 0; i < defs.length; i++) {
      var d = defs[i]; if (d.kind !== 'taas' || !on[d.id]) continue;
      var items = d.src.items || [];
      for (var k = 0; k < items.length; k++) {
        var it = items[k], p = posOf(it); if (!p) continue;
        var r = radOf(it);
        if (Math.hypot(p[0] - x, p[1] - z) <= r) return { layer: d, it: it };
      }
    }
    return null;
  };
  // 미니맵에 겹쳐 그린다(minimap.js 가 매 프레임 부른다)
  self.drawMini = function (g, mx, mz, K) {
    defs.forEach(function (d) {
      if (!on[d.id]) return;
      if (d.kind === 'taas') {
        (d.src.items || []).forEach(function (it) {
          var p = posOf(it); if (!p) return;
          var r = radOf(it);
          g.beginPath(); g.arc(mx(p[0]), mz(p[1]), Math.max(2.5, r * 0.09) * K, 0, Math.PI * 2);
          // 두 층을 같이 켜면 점이 74개가 되어 미니맵의 도로가 안 보였다 — 채움을 묽게 하고 테두리로 자리를 잡는다
          g.fillStyle = d.color + '55'; g.fill();
          g.strokeStyle = d.color; g.lineWidth = 1.1 * K; g.stroke();
        });
      } else if (d.kind === 'risk') {
        Object.keys(risk).forEach(function (k) {
          var r0 = risk[k], nd = city.nodes[r0.i][r0.j];
          g.beginPath(); g.arc(mx(nd.x), mz(nd.z), Math.max(2.5, (12 + r0.total * 2) * 0.09) * K, 0, Math.PI * 2);
          g.fillStyle = d.color + '99'; g.fill();
        });
      } else if (d.kind === 'roads') {
        var RR = d.src.roads || {};
        g.strokeStyle = d.color; g.lineWidth = 1.6 * K; g.setLineDash([5 * K, 4 * K]);
        Object.keys(RR).forEach(function (k) {
          var pts = RR[k].pts || []; if (pts.length < 2) return;
          g.beginPath(); g.moveTo(mx(pts[0][0]), mz(pts[0][1]));
          for (var i = 1; i < pts.length; i++) g.lineTo(mx(pts[i][0]), mz(pts[i][1]));
          g.stroke();
        });
        g.setLineDash([]);
      } else if (d.kind === 'cam') {
        (game.facil ? game.facil.list() : []).forEach(function (C) {
          var nd = city.nodes[C.i][C.j], f = TG.DIR_VEC[C.d], back = city.stopDist(nd, C.d) + 14;
          g.beginPath(); g.arc(mx(nd.x - f[0] * back), mz(nd.z - f[1] * back), 2.2 * K, 0, Math.PI * 2);
          g.fillStyle = d.color; g.fill();
        });
      }
    });
  };


  // ---- 지도 레이어 패널(교통시설 화면 아래에 붙는다) ----
  var lhost = null;
  function lesc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (m) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]; }); }
  function lrender() {
    if (!lhost) return;
    var src = self.sourceNote();
    var h = '<h4>🗺 지도 레이어 — 데이터를 도로 위에 쌓아 본다</h4>';
    h += '<div class="pl-cams">';
    self.list().forEach(function (L) {
      h += '<div class="pl-cam"><span><i class="lay-dot" style="background:' + lesc(L.color) + '"></i>' + lesc(L.name) + ' <b>' + L.count + '</b></span>' +
           '<button class="pl-tog' + (L.on ? ' on' : '') + '" data-lay="' + lesc(L.id) + '">' + (L.on ? '켜짐' : '꺼짐') + '</button>' +
           '<span class="pl-min">' + lesc(L.note || L.desc) + '</span></div>';
    });
    h += '</div>';
    if (src) {
      h += '<div class="pl-note">' + lesc(src.attribution || '출처: 도로교통공단 TAAS') + (src.years ? ' · ' + lesc(src.years) : '') + '</div>';
      h += '<div class="pl-min">' + lesc(src.source) + '</div>';
      if (src.criteria) h += '<div class="pl-min">선정 기준 · ' + lesc(src.criteria) + '</div>';
      var nn = self.nodesNote();
      if (nn) {
        h += '<div class="pl-note">교차로별 집계 · ' + lesc(nn.years) + ' 서초구 ' + nn.collected + '건' +
          (nn.byGrade ? ' (사망 ' + nn.byGrade['사망'] + ' · 중상 ' + nn.byGrade['중상'] + ' · 경상 ' + nn.byGrade['경상'] + ' · 부상신고 ' + nn.byGrade['부상신고'] + ')' : '') + '</div>';
        if (nn.wholeGu && nn.wholeGu.violations) h += '<div class="pl-min">구 전체 법규위반 · ' +
          nn.wholeGu.violations.slice(0, 5).map(function (v) { return lesc(v[0]) + ' ' + v[1]; }).join(' · ') + '</div>';
        h += '<div class="pl-min">' + lesc(nn.method) + '</div>';
        h += '<div class="pl-min">개인정보 · ' + lesc(nn.notice) + '</div>';
      }
      var vn = self.vulnNote();
      if (vn) {
        h += '<div class="pl-note">어린이 · 보행자 · 노인 · 자전거 (' + lesc(vn.years) + ')</div>';
        h += '<div class="pl-min">' + vn.groups.map(function (g) { return lesc(g.name) + ' ' + g.total + '건(사망 ' + g.dead + ')'; }).join(' · ') + '</div>';
        // 홍보에 그대로 쓸 문장 — 위 숫자에서만 뽑았다
        vn.highlights.forEach(function (s) { h += '<div class="pl-min">· ' + lesc(s) + '</div>'; });
        h += '<div class="pl-min">개인정보 · ' + lesc(vn.privacy) + '</div>';
        h += '<div class="pl-min">' + lesc(vn.caution) + '</div>';
      }
      var fn = self.fatalNote();
      if (fn) {
        h += '<div class="pl-note">사망사고 · ' + lesc(fn.years) + ' ' + fn.collected + '건 (사망 ' + fn.casualties['사망'] + '명) · 이 지도 안 ' + fn.inMap + '건 · 바깥 ' + fn.outsideMap + '건</div>';
        h += '<div class="pl-min">연도별 · ' + Object.keys(fn.byYear).map(function (y) { return y + '년 ' + fn.byYear[y]; }).join(' · ') + '</div>';
        h += '<div class="pl-min">법규위반 · ' + fn.byViolation.slice(0, 5).map(function (v) { return lesc(v[0]) + ' ' + v[1]; }).join(' · ') + '</div>';
        h += '<div class="pl-min">가해 차종 · ' + fn.byOffender.slice(0, 5).map(function (v) { return lesc(v[0]) + ' ' + v[1]; }).join(' · ') + '</div>';
        h += '<div class="pl-min">피해 · ' + fn.byVictim.slice(0, 5).map(function (v) { return lesc(v[0]) + ' ' + v[1]; }).join(' · ') + '</div>';
        h += '<div class="pl-min">개인정보 · ' + lesc(fn.privacy) + '</div>';
        h += '<div class="pl-min">' + lesc(fn.caution) + '</div>';
      }
      if (src.mapping) h += '<div class="pl-min">좌표 변환 · ' + lesc(src.mapping) + '</div>';
      h += '<div class="pl-min">넣는 방법 · ' + lesc(src.howto) + '</div>';
    } else {
      h += '<div class="pl-note">data/taas.json 을 읽지 못했습니다 — file:// 로 열면 브라우저가 막습니다. 정적 서버나 GitHub Pages 로 여세요.</div>';
    }
    // T5: 실제 ↔ 시뮬 비교. 표본이 적으면 순위를 말하지 않는다.
    var cmp = self.compare(6);
    if (cmp) {
      h += '<div class="pl-note">⚖ 실제 사고 ↔ 시뮬레이션 위험도 (' + lesc(cmp.years) + ')</div>';
      h += '<div class="pl-min">가중 — 실제: ' + lesc(cmp.weights.real) + ' / 시뮬: ' + lesc(cmp.weights.sim) + ' (시뮬 가중은 게임 설계값)</div>';
      if (!cmp.enough) h += '<div class="pl-min">시뮬 표본이 적습니다(사건 ' + cmp.events + '건 · 교차로 ' + cmp.simN + '곳) — 더 달린 뒤에 견주는 것이 맞습니다. 아래는 실제 순위만 보여 줍니다.</div>';
      else h += '<div class="pl-min">실제 상위 ' + cmp.topN + '곳 중 <b>' + cmp.hit + '곳</b>이 시뮬 상위 ' + (cmp.topN + 2) + '위 안에 들었습니다 · 시뮬 사건 ' + cmp.events + '건 · 교차로 ' + cmp.simN + '곳</div>';
      cmp.rows.forEach(function (r) {
        h += '<div class="pl-min">' + r.realRank + '. ' + lesc(r.name) + ' — 실제 ' + r.real + '건' + (r.death ? '(사망 ' + r.death + ')' : '') +
             ' · 시뮬 ' + (r.simRank ? r.simRank + '위(' + r.sim + '점)' : '아직 없음') + '</div>';
      });
    }
    h += '<div class="pl-foot"><button class="pl-btn" data-riskreset="1">위험도 초기화</button>' +
         '<span class="pl-min">시뮬레이션 위험도는 이 기기에서 달린 결과입니다 — 급제동·보행자 근접·신호위반·무인 단속 적발을 교차로별로 쌓습니다. 쌓인 사건 ' + self.stats.events + '건.</span></div>';
    lhost.innerHTML = h;
    lhost.querySelectorAll('[data-lay]').forEach(function (b) {
      b.addEventListener('click', function () { self.toggle(b.getAttribute('data-lay')); lrender(); });
    });
    var rr = lhost.querySelector('[data-riskreset]');
    if (rr) rr.addEventListener('click', function () { self.resetRisk(); lrender(); });
  }
  self.openPanel = function (el) { lhost = el; lrender(); };
  self.refreshPanel = lrender;

  self.load = load;
  load();
};
