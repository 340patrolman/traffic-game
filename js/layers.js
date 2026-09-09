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
      if (!nf) { after(); return; }
      return fetch(nf).then(function (r2) { return r2.json(); }).then(function (n2) { nodes = n2; after(); })
        .catch(function () { after(); });
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
    return 0;
  }
  function noteOf(d) {
    if (d.kind !== 'taas') return '';
    var all = d.src.items || [], real = realItems(d);
    if (!all.length) return '데이터 없음 — TAAS 자료를 data/taas.json 에 넣으면 지도에 뜹니다';
    if (!real.length) return '예시만 있습니다 — 실제 TAAS 값으로 교체하세요';
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
  self.sourceNote = function () { return taas ? { source: taas.source, sourceUrl: taas.sourceUrl, attribution: taas.attribution,
    years: taas.years, howto: taas.howto, updated: taas.updated, region: taas.region, criteria: taas.criteria, mapping: taas.mapping } : null; };

  self.toggle = function (id) {
    if (!(id in on)) return false;
    on[id] = !on[id];
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
    if (it.radius) return it.radius;
    if (it.types) {   // 교차로별 집계(건수가 수백) — 제곱근으로 눌러 화면을 덮지 않게
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
          g.fillStyle = d.color + 'aa'; g.fill();
          g.strokeStyle = d.color; g.lineWidth = 1.1 * K; g.stroke();
        });
      } else if (d.kind === 'risk') {
        Object.keys(risk).forEach(function (k) {
          var r0 = risk[k], nd = city.nodes[r0.i][r0.j];
          g.beginPath(); g.arc(mx(nd.x), mz(nd.z), Math.max(2.5, (12 + r0.total * 2) * 0.09) * K, 0, Math.PI * 2);
          g.fillStyle = d.color + '99'; g.fill();
        });
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
      if (src.mapping) h += '<div class="pl-min">좌표 변환 · ' + lesc(src.mapping) + '</div>';
      h += '<div class="pl-min">넣는 방법 · ' + lesc(src.howto) + '</div>';
    } else {
      h += '<div class="pl-note">data/taas.json 을 읽지 못했습니다 — file:// 로 열면 브라우저가 막습니다. 정적 서버나 GitHub Pages 로 여세요.</div>';
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
