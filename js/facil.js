// 교통시설 관리(심시티 요소). 교차로마다 신호 녹색 시간을 정하고, 접근로에 무인 교통단속 장비를 세운다.
// 원칙: **보행 시간은 줄일 수 없다** — 녹색 시간 하한은 그 횡단보도를 건너는 데 걸리는 시간에서 나온다(signals.greenMin).
// 저장은 localStorage `tg_facil` 한 곳. 다른 앱(tb_) 키는 읽지도 쓰지도 않는다.
TG.Facil = function (game, city, signals, cfg, scene) {
  var self = this;
  var DIRN = ['남행', '동행', '북행', '서행'];
  var KINDS = { signal: { name: '신호위반 단속', ico: '🚦' }, speed: { name: '과속 단속', ico: '📷' } };
  var data = { green: {}, cams: [] };
  var group = new THREE.Group();
  scene.add(group);
  var stats = { caught: 0, byKind: { signal: 0, speed: 0 } };
  self.stats = stats;

  function load() {
    var d = TG.save.get('facil', null);
    if (d && typeof d === 'object') {
      data.green = d.green && typeof d.green === 'object' ? d.green : {};
      data.cams = Array.isArray(d.cams) ? d.cams.filter(function (c) { return KINDS[c.kind] && city.nodes[c.i] && city.nodes[c.i][c.j]; }) : [];
    }
  }
  function store() { TG.save.set('facil', data); }
  self.save = store;

  // 저장된 녹색 시간을 신호기에 적용한다(하한에 걸리면 신호기가 알아서 올린다)
  function apply() {
    Object.keys(data.green).forEach(function (k) {
      var ij = k.split(','), nd = city.nodes[+ij[0]] && city.nodes[+ij[0]][+ij[1]]; if (!nd) return;
      var g = data.green[k];
      if (g && g.v) signals.setGreen(nd, 'v', g.v);
      if (g && g.h) signals.setGreen(nd, 'h', g.h);
    });
  }
  self.apply = apply;

  self.setGreen = function (node, axis, sec) {
    var r = signals.setGreen(node, axis, sec), k = node.i + ',' + node.j;
    var g = data.green[k] = data.green[k] || {};
    g[axis] = r.sec; store();
    return r;
  };
  self.resetNode = function (node) {
    var k = node.i + ',' + node.j;
    signals.setGreen(node, 'v', cfg.SIG_GREEN); signals.setGreen(node, 'h', cfg.SIG_GREEN);
    if (signals.restoreReal) signals.restoreReal(node);   // 되돌리면 실측 현시(로컬 자료가 있으면)로 돌아간다
    delete data.green[k];
    data.cams = data.cams.filter(function (c) { return !(c.i === node.i && c.j === node.j); });
    store(); build();
  };
  self.camsAt = function (node) { return data.cams.filter(function (c) { return c.i === node.i && c.j === node.j; }); };
  self.hasCam = function (node, d, kind) { return data.cams.some(function (c) { return c.i === node.i && c.j === node.j && c.d === d && c.kind === kind; }); };
  self.toggleCam = function (node, d, kind) {
    if (!KINDS[kind]) return false;
    var on = self.hasCam(node, d, kind);
    if (on) data.cams = data.cams.filter(function (c) { return !(c.i === node.i && c.j === node.j && c.d === d && c.kind === kind); });
    else data.cams.push({ i: node.i, j: node.j, d: d, kind: kind });
    store(); build();
    return !on;
  };
  self.count = function () { return data.cams.length; };
  self.list = function () { return data.cams.slice(); };

  // ---- 무인 단속 장비 모형: 문형 지주(도로 위로 뻗은 팔) + 함체 + 「무인단속」 표지 ----
  var G = TG.GeoBuilder;
  function build() {
    while (group.children.length) { var c0 = group.children[0]; group.remove(c0); if (c0.geometry) c0.geometry.dispose(); }
    if (!data.cams.length) return;
    var gb = new G(), faces = {};
    data.cams.forEach(function (C) {
      var nd = city.nodes[C.i][C.j], d = C.d, f = TG.DIR_VEC[d], r = [-f[1], f[0]];
      var rd = city.roadOf(nd, d), back = city.stopDist(nd, d) + 14, side = city.sideOff(rd.axis, rd.idx) + 1.2;
      var px = nd.x - f[0] * back + r[0] * side, pz = nd.z - f[1] * back + r[1] * side;
      var rot = TG.DIR_HEADING[d];
      gb.cylinder(px, 0.2, pz, 0.19, 0.16, 7.4, 8, 0x5a6068);                                      // 지주
      var armLen = side + city.laneOff(rd.axis, rd.idx, 1);
      gb.box(px - r[0] * armLen * 0.5, 7.5, pz - r[1] * armLen * 0.5, 0.2, 0.2, armLen, 0x5a6068, { rotY: rot + Math.PI / 2 });   // 도로 위로 뻗은 팔
      for (var n = 0; n < 2; n++) {                                                                 // 함체 두 대(차로별)
        var off = armLen * (0.45 + n * 0.32);
        var cx = px - r[0] * off, cz = pz - r[1] * off;
        gb.box(cx, 7.05, cz, 0.62, 0.44, 0.5, C.kind === 'speed' ? 0x2f3d4c : 0x3a4a3a, { rotY: rot });
        gb.box(cx - f[0] * 0.3, 7.05, cz - f[1] * 0.3, 0.2, 0.24, 0.2, 0x101418, { rotY: rot });     // 렌즈(진행 방향 반대 = 다가오는 차)
        gb.box(cx, 7.42, cz, 0.66, 0.08, 0.54, 0x9aa0a8, { rotY: rot, noBottom: true });
      }
      var key = C.kind;
      (faces[key] = faces[key] || new G()).vquad(px - r[0] * 1.6, 4.4, pz - r[1] * 1.6, 2.1, 0.72, rot + Math.PI, 0xffffff, null);
    });
    var m = new THREE.Mesh(gb.build(), new THREE.MeshLambertMaterial({ vertexColors: true }));
    m.castShadow = false; group.add(m);
    Object.keys(faces).forEach(function (k) {
      var tx = TG.tex.camSign(k === 'speed' ? '무인 과속 단속' : '무인 신호 단속', k === 'speed' ? '#1f4fa8' : '#1f7a3a');
      group.add(new THREE.Mesh(faces[k].build(), new THREE.MeshBasicMaterial({ map: tx, transparent: true, side: THREE.DoubleSide })));
    });
  }
  self.rebuild = build;

  // ---- 단속: 카메라 구역을 지나는 차(플레이어 포함)를 본다 ----
  // 신호위반: 적색인데 정지선을 넘어 교차로로 들어간다. 과속: 제한속도 + 11km/h 이상.
  // 한 대가 한 번 지날 때 한 번만 센다(car.__cam 표식).
  var cool = 0;
  self.update = function (dt, traffic, player, onCatch) {
    if (!data.cams.length) return;
    cool -= dt;
    for (var ci = 0; ci < data.cams.length; ci++) {
      var C = data.cams[ci], nd = city.nodes[C.i][C.j], d = C.d;
      var f = TG.DIR_VEC[d], ax = city.axisOfDir(d), rd = city.roadOf(nd, d);
      var sd = city.stopDist(nd, d), band = city.crossHalf(nd, d) + 2;
      var red = signals.state(nd, ax).s === 'red';
      // 제한속도는 도로에서 직접 읽는다(어린이보호구역이면 30). 정지선 6m 앞 지점을 기준점으로.
      var fr0 = city.frameAt(nd.x - f[0] * (city.stopDist(nd, d) + 6), nd.z - f[1] * (city.stopDist(nd, d) + 6), TG.DIR_HEADING[d]);
      var limit = (fr0 && fr0.limit) || cfg.ROAD_LIMIT_KMH || 50;
      var list = traffic ? traffic.cars : [];
      for (var k = -1; k < list.length; k++) {
        var obj = k < 0 ? player : list[k]; if (!obj || !obj.pos) continue;
        var dx = obj.pos.x - nd.x, dz = obj.pos.z - nd.z;
        var alo = -(dx * f[0] + dz * f[1]), lat = dx * (-f[1]) + dz * f[0];   // alo>0 = 교차로 앞(접근 중)
        if (Math.abs(lat) > city.halfOf(rd.axis, rd.idx) + 1) continue;
        var kmh = k < 0 ? (obj.speedKmh ? obj.speedKmh() : 0) : Math.round(obj.v * 3.6);
        var head = k < 0 ? obj.heading : obj.heading;
        if (TG.headingToDir(head) !== d) continue;                            // 이 접근로 방향으로 달리는 차만
        var inZone = alo < sd - 0.5 && alo > -band;                           // 정지선을 넘어 교차로 상자 안
        var tag = C.kind + ':' + C.i + ',' + C.j + ',' + C.d;
        if (C.kind === 'signal') {
          if (inZone && red && kmh > 6) {
            if (obj.__cam !== tag) { obj.__cam = tag; hit(C, obj, k < 0, '신호위반', kmh, onCatch); }
          } else if (!inZone && obj.__cam === tag) obj.__cam = null;
        } else {
          var near = alo < sd + 16 && alo > sd - 6;
          if (near && kmh > limit + 11) {
            if (obj.__cam !== tag) { obj.__cam = tag; hit(C, obj, k < 0, '제한 ' + limit + 'km/h 초과 ' + kmh + 'km/h', kmh, onCatch); }
          } else if (!near && obj.__cam === tag) obj.__cam = null;
        }
      }
    }
  };
  function hit(C, obj, isPlayer, why, kmh, onCatch) {
    stats.caught++; stats.byKind[C.kind] = (stats.byKind[C.kind] || 0) + 1;
    var nm = city.nodeName(city.nodes[C.i][C.j]);
    if (onCatch) onCatch({ kind: C.kind, node: city.nodes[C.i][C.j], dir: C.d, name: nm, why: why, kmh: kmh, player: !!isPlayer });
  }


  // ---- 교통시설 관리 화면(심시티식): 왼쪽 교차로 목록 · 오른쪽 설정판 ----
  // 손가락으로 쓰도록 목록에서 골라 큰 단추로 바꾼다(3D 화면을 찍는 방식은 폰에서 어렵다).
  var sel = null, host = null, todSel = '';
  function esc(s) { return String(s).replace(/[&<>"]/g, function (m) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]; }); }
  function nodesWithSignal() {
    var out = [];
    for (var i = 0; i < city.xs.length; i++) for (var j = 0; j < city.zs.length; j++) out.push(city.nodes[i][j]);
    return out;
  }
  function render() {
    if (!host) return;
    var all = nodesWithSignal();
    if (!sel) sel = city.nodes[2][2];
    var gi = signals.greenInfo(sel), cams = self.camsAt(sel);
    var h = '<div class="pl-wrap">';
    h += '<div class="pl-list">';
    h += '<div class="pl-head">교차로 ' + all.length + '곳 · 설치된 무인 단속 ' + self.count() + '대</div>';
    all.forEach(function (nd) {
      var n = self.camsAt(nd).length, g2 = signals.greenInfo(nd);
      var tuned = (data.green[nd.i + ',' + nd.j] ? '●' : '');
      h += '<button class="pl-item' + (nd === sel ? ' on' : '') + '" data-i="' + nd.i + '" data-j="' + nd.j + '">' +
           '<b>' + esc(city.nodeName(nd)) + '</b>' +
           '<span>주기 ' + g2.cycle + '초 ' + (g2.real ? '<i class="pl-real">실측</i>' : '<i class="pl-est">추정</i>') +
           ' · 남북 ' + g2.gv + ' · 동서 ' + g2.gh + (n ? ' · 📷' + n : '') + ' ' + tuned + '</span></button>';
    });
    h += '</div><div class="pl-body">';
    h += '<h3>' + esc(city.nodeName(sel)) + '</h3>';
    h += '<div class="pl-sub">한 주기 <b>' + gi.cycle + '초</b> (황색 ' + cfg.SIG_YELLOW + ' + 전적색 ' + cfg.SIG_ALLRED + '초 포함) · 최소 녹색 ' + gi.minGreen + '초</div>';
    var ci = signals.cycleInfo ? signals.cycleInfo(sel) : null;
    if (ci && ci.target) {
      h += '<div class="pl-src">' + (ci.real
        ? '실제 신호값 <b>' + ci.target + '초</b> — ' + esc(ci.src) + ' 교차로' + (ci.phases ? ' · ' + ci.phases + '현시' : '') + (ci.lap ? ' · 겹침현시' : '')
        : '<b>추정 ' + ci.target + '초</b> — 이 교차로는 개방 목록에 없어 서울 주간 주기 중앙값을 씁니다')
        + '<span class="pl-src2">' + esc(ci.source) + '</span></div>';
    }
    [['v', '남북(' + esc(city.roadNamesV[sel.i]) + ')', gi.gv, gi.minV, gi.pedH],
     ['h', '동서(' + esc(city.hName(sel.j, sel.x)) + ')', gi.gh, gi.minH, gi.pedV]].forEach(function (row) {
      h += '<div class="pl-row"><span class="pl-lbl">' + row[1] + ' 녹색</span>' +
           '<button class="pl-btn" data-g="' + row[0] + '" data-dv="-2">−2초</button>' +
           '<b class="pl-val">' + row[2] + '초</b>' +
           '<button class="pl-btn" data-g="' + row[0] + '" data-dv="2">+2초</button>' +
           '<span class="pl-min">하한 ' + row[3] + '초 · 이 방향 녹색 동안 보행 ' + row[4] + '초</span></div>';
    });
    h += '<div class="pl-note">보행 시간은 줄일 수 없습니다 — 녹색 하한은 그 횡단보도를 건너는 데 걸리는 시간(§27·시행규칙 별표2)에서 나옵니다.</div>';
    h += '<h4>무인 교통단속 장비</h4><div class="pl-cams">';
    for (var d = 0; d < 4; d++) {
      var up = city.nodeFrom(sel, (d + 2) % 4);
      h += '<div class="pl-cam' + (up ? '' : ' dim') + '"><span>' + DIRN[d] + ' 접근' + (up ? '' : ' (진입로 없음)') + '</span>' +
           '<button class="pl-tog' + (self.hasCam(sel, d, 'signal') ? ' on' : '') + '" data-cd="' + d + '" data-ck="signal"' + (up ? '' : ' disabled') + '>🚦 신호위반</button>' +
           '<button class="pl-tog' + (self.hasCam(sel, d, 'speed') ? ' on' : '') + '" data-cd="' + d + '" data-ck="speed"' + (up ? '' : ' disabled') + '>📷 과속</button></div>';
    }
    h += '</div>';
    h += todHtml();
    h += '<div class="pl-foot"><button class="pl-btn wide" data-reset="1">이 교차로 기본값으로</button>' +
         '<span class="pl-min">단속 실적 ' + stats.caught + '건 (신호 ' + (stats.byKind.signal || 0) + ' · 과속 ' + (stats.byKind.speed || 0) + ')</span></div>';
    h += '</div></div>';
    host.innerHTML = h;
    host.querySelectorAll('.pl-item').forEach(function (b) {
      b.addEventListener('click', function () { sel = city.nodes[+b.getAttribute('data-i')][+b.getAttribute('data-j')]; render(); });
    });
    host.querySelectorAll('[data-g]').forEach(function (b) {
      b.addEventListener('click', function () {
        var ax = b.getAttribute('data-g'), dv = +b.getAttribute('data-dv');
        var cur = signals.greenFor(sel, ax), r = self.setGreen(sel, ax, cur + dv);
        if (r.clamped && dv < 0) game.hud.notice('더 줄일 수 없습니다 — 보행 시간(' + (ax === 'v' ? signals.greenInfo(sel).pedH : signals.greenInfo(sel).pedV) + '초)이 먼저입니다', 'warn', 2600);
        render();
      });
    });
    host.querySelectorAll('[data-cd]').forEach(function (b) {
      b.addEventListener('click', function () {
        if (b.disabled) return;
        var on = self.toggleCam(sel, +b.getAttribute('data-cd'), b.getAttribute('data-ck'));
        game.hud.notice(on ? '무인 단속 장비를 설치했습니다 — 예고 표지도 함께 섭니다' : '무인 단속 장비를 철거했습니다', 'info', 2200);
        render();
      });
    });
    var rb = host.querySelector('[data-reset]');
    if (rb) rb.addEventListener('click', function () { self.resetNode(sel); render(); });
    var ts = host.querySelector('#todSel');
    if (ts) ts.addEventListener('change', function () { todSel = ts.value; render(); });
  }
  // ---- 🚦 신호 근무표 — 교통근무 중에 그 교차로가 지금 몇 초로 도는지 본다 ----
  // 자료는 경찰청 교차로계획정보 그대로다. 숫자를 코드에 적지 않는다.
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function todHtml() {
    var T = game.signalTod;
    if (!T) return '';
    if (!T.ready) return '<h4>🚦 신호 근무표</h4><div class="pl-note">시간대별 신호계획을 읽지 못했습니다' +
      (T.err ? ' — ' + esc(T.err) : '') + '. 정적 서버(http)로 열면 나옵니다.</div>';
    var spots = T.spots();
    // 처음에는 고른 교차로에 해당하는 실측 지점을 보여 준다(있으면).
    var ci = signals.cycleInfo ? signals.cycleInfo(sel) : null;
    if (!todSel) todSel = (ci && ci.real && ci.src) ? ci.src : spots[0].name;
    var sp = T.spot(todSel) || spots[0];
    var now = new Date(), inf = T.infoBySpot(sp, now), rows = T.rows(sp, now), ni = T.nowIndex(sp, now);
    var h = '<h4>🚦 신호 근무표 <span class="pl-min">지금 ' + pad2(now.getHours()) + ':' + pad2(now.getMinutes()) +
            ' · ' + esc(T.dowKo(now)) + '요일 · 계획 ' + esc(inf ? inf.plan : '?') + '</span></h4>';
    h += '<select class="pl-sel" id="todSel">';
    spots.forEach(function (s) { h += '<option value="' + esc(s.name) + '"' + (s.name === sp.name ? ' selected' : '') + '>' + esc(s.name) + '</option>'; });
    h += '</select>';
    if (inf) {
      h += '<div class="pl-now">지금 <b>주기 ' + inf.cycle + '초</b> · 옵셋 ' + inf.offset + ' · ' + inf.phases + '현시' +
           (inf.lap ? ' · <b>겹침현시</b>' : '') + ' <span class="pl-min">' + esc(inf.time) + ' 계획' +
           (inf.wrapped ? '(전날 심야분이 이어짐)' : '') + ' → 다음 ' + esc(inf.nextTime) + ' ' + inf.nextCycle + '초</span></div>';
    }
    h += '<div class="pl-tod"><table><thead><tr><th>시각</th><th>주기</th><th>옵셋</th><th>A링 현시</th><th>B링 현시</th></tr></thead><tbody>';
    var odd = 0;
    rows.forEach(function (r, i) {
      var sum = String(r[3]).split(' ').filter(Boolean).reduce(function (x, y) { return x + (+y); }, 0);
      var bad = sum !== r[1];
      if (bad) odd++;
      h += '<tr' + (i === ni ? ' class="on"' : '') + '><td>' + esc(r[0]) + '</td><td><b>' + r[1] + '</b>' +
           (bad ? '<i title="현시 합 ' + sum + '초">⚠</i>' : '') + '</td><td>' + r[2] +
           '</td><td>' + esc(r[3]) + '</td><td>' + esc(r[4]) + (r[3] !== r[4] ? ' <i>겹침</i>' : '') + '</td></tr>';
    });
    h += '</tbody></table></div>';
    if (odd) h += '<div class="pl-note warn">⚠ 표시한 ' + odd + '줄은 <b>현시값의 합이 주기보다 적습니다</b>(원자료 그대로 · 지어내 채우지 않았습니다). ' +
                  '이런 줄은 <b>어느 요일도 쓰지 않는 예비 계획</b>에만 있습니다 — 실제로 도는 계획에는 없습니다.</div>';
    var dw = [];
    for (var d = 1; d <= 7; d++) if (sp.dow && sp.dow['' + d]) dw.push((T.data().dowKo[d - 1]) + ' ' + sp.dow['' + d]);
    h += '<div class="pl-min">요일별 계획 — ' + esc(dw.join(' · ')) + '</div>';
    h += '<div class="pl-note">현시값의 합 = 주기입니다(어긋나는 줄은 ⚠ 로 표시 — 예비 계획에만 있습니다). ' +
         'A링과 B링이 다르면 겹침현시(좌회전이 한쪽에서 먼저 열리거나 늦게 닫힘)입니다. ' +
         '<b>어느 현시가 어느 방향인지는 이 자료에 없습니다</b> — 그래서 게임은 주기만 실측을 쓰고 남북·동서 배분은 설계값입니다.' +
         '<span class="pl-src2">' + esc(T.source()) + '<br>' + esc(T.area()) + '</span></div>';
    return h;
  }
  self.openPanel = function (el) { host = el; render(); };
  self.refreshPanel = render;

  load(); apply(); build();
};
