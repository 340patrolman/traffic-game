// 🗜 서초 데이터 압축지도(v0.10.55 「2D 지도」 → v0.10.57 이름 바꿈) — 소유자 「교통경찰 게임에 2D 지도만 있으면 좋겠다. 서초구 위주로 거기서도 이것저것 볼 수 있게 — 나중에 이 부분만 따로 빼도 될 정도로」.
//  **게임 엔진(three.js·TG.game)에 기대지 않는다** — 이 파일 하나 + map2d.html + data/ 파일만 있으면 따로 떼어 돈다.
//  좌표는 모두 **실제 위경도**로 되돌려 그린다(게임의 축약·고무판 좌표를 쓰지 않는다). 없는 값을 지어내지 않고, 근사는 근사라고 적는다.
//  자료: 통계청 행정동 경계 · 행안부 인구 · OSM 도로·건물 · 도로교통공단 TAAS · 경찰청 무인단속 카메라·교차로 신호 · 서울시 문화행사·교통량 · 서울경찰청 집회 · 국가유산청.
(function () {
  'use strict';
  var LON0 = 127.01, LAT0 = 37.49, KX = 88800, KY = 111000;   // 서초 위도에서 1° = 가로 88.8km · 세로 111km(평면 근사)
  function P(lon, lat) { return [(lon - LON0) * KX, -(lat - LAT0) * KY]; }                       // 위경도 → 평면 m(오른쪽 +x · 아래 +y)
  function fullM(x, z) { return [x - 2438 - (LON0 - 127.0077) * KX, z - 1743 - (37.4917 - LAT0) * KY]; }   // 서초구 1:1 자료 공간(m) → 평면 m
  var $ = function (id) { return document.getElementById(id); };
  var cv = $('m2d'), ctx = cv.getContext('2d'), DPR = Math.min(window.devicePixelRatio || 1, 2);
  var view = { s: 0.16, cx: 0, cy: 0 };   // s = 화면 px / m · cx,cy = 화면 가운데의 평면 m
  var D = {}, hit = [], sel = null;
  // 층 = [키, 이름, 기본 켜짐, 갈래, 위 줄 단추]. 위 줄에는 자주 쓰는 것만, 나머지는 「☰ 모든 층」 판에서(v0.10.57 · 소유자 「파출소·지구대에서 써도 좋을 만큼 — 찾을 수 있는 것 싹 다」)
  var LAYERS = [
    ['dong', '🏘 행정동', true, '기본', 1], ['road', '🛣 도로', true, '기본', 1], ['base', '🗺 바탕(물·녹지·철도)', true, '기본', 0], ['bld', '🏢 건물', true, '기본', 0], ['sub', '🚇 지하철역', true, '기본', 0], ['exit', '🚪 지하철 출입구', false, '기본', 0],
    ['acc', '🚗 교차로 사고', true, '교통안전', 1], ['fatal', '🕯 사망사고', false, '교통안전', 0], ['hot', '⚠ 사고다발지', false, '교통안전', 0], ['drunk', '🍺 음주 사고 다발지', false, '교통안전', 1],
    ['risk', '🟥 사고위험지역', false, '교통안전', 0], ['sz', '🏫 어린이보호구역', false, '교통안전', 1], ['szh', '🧒 보호구역 어린이 사고', false, '교통안전', 0], ['cam', '📷 단속 카메라', false, '교통안전', 0], ['spd', '🚥 도로 소통(받은 때)', false, '교통안전', 0], ['sig', '🚦 신호 주기', false, '교통안전', 0], ['sigx', '🔢 신호 교차로 번호', false, '교통안전', 0],
    ['crowd', '📡 실시간 인파·카드', false, '사람·흐름', 1], ['live', '👥 생활인구(지금)', false, '사람·흐름', 1], ['sales', '💳 카드 매출(시간대)', false, '사람·흐름', 1], ['bus', '🚌 버스 승차·하차', false, '사람·흐름', 1], ['subr', '🚇 지하철 승차·하차', false, '사람·흐름', 0], ['vol', '🚙 교통량', false, '사람·흐름', 0], ['bike', '🚲 따릉이', false, '사람·흐름', 0],
    ['pol', '👮 경찰 관서', false, '치안·안전', 1], ['fire', '🚒 소방', false, '치안·안전', 0], ['er', '🏥 응급실', false, '치안·안전', 1], ['hosp', '🩺 병원·의원', false, '치안·안전', 0], ['phar', '💊 약국', false, '치안·안전', 1],
    ['bar', '🍺 주점(밤 순찰)', false, '치안·안전', 0], ['play', '🎤 노래방·PC방', false, '치안·안전', 0], ['inn', '🏨 숙박', false, '치안·안전', 0], ['heat', '🥵 무더위쉼터', false, '치안·안전', 0], ['cold', '🥶 한파쉼터', false, '치안·안전', 0], ['hyd', '🧯 소화전', false, '치안·안전', 0], ['wc', '🚻 화장실', false, '치안·안전', 0],
    ['school', '🏫 학교', false, '생활', 0], ['kids', '🧸 유치원·어린이집', false, '생활', 0], ['pg', '🛝 놀이터', false, '생활', 0], ['park', '🌳 공원', false, '생활', 0], ['welf', '🧓 복지시설', false, '생활', 0],
    ['gov', '🏢 관공서·주민센터', false, '생활', 0], ['lib', '📚 도서관', false, '생활', 0], ['post', '📮 우체국', false, '생활', 0], ['bank', '🏦 은행·ATM', false, '생활', 0], ['conv', '🏪 편의점', false, '생활', 0],
    ['fuel', '⛽ 주유소', false, '생활', 0], ['ev', '🔌 전기차 충전', false, '생활', 0], ['pk', '🅿 주차장', false, '생활', 0],
    ['jur', '🚓 경찰서 관할(서초·방배)', false, '치안·안전', 0], ['tgis', '🚥 T-GIS 신호 교차로', false, '교통안전', 0], ['spot', '🎯 길목 — 이 시각 하차', false, '사람·흐름', 0], ['spota', '🗂 길목 다발지(참고)', false, '교통안전', 0],
    ['evt', '📅 행사·집회', true, '행사·역사', 1], ['her', '🏛 국가유산', false, '행사·역사', 0]
  ];
  // OSM 시설 갈래 → 층 키
  var FAC_K = { '경찰': 'pol', '소방': 'fire', '소화전': 'hyd', '화장실': 'wc', '학교': 'school', '유치원·어린이집': 'kids', '놀이터': 'pg', '공원': 'park', '복지시설': 'welf', '관공서·주민센터': 'gov', '도서관': 'lib',
    '우체국': 'post', '은행·ATM': 'bank', '편의점': 'conv', '주유소': 'fuel', '전기차 충전': 'ev', '주차장': 'pk', '지하철 출입구': 'exit', '병원': null, '의원': null, '약국': null };
  var FAC_C = { pol: '#1d4ed8', fire: '#dc2626', hyd: '#ef4444', wc: '#0891b2', school: '#ca8a04', kids: '#f59e0b', pg: '#84cc16', park: '#16a34a', welf: '#a855f7', gov: '#475569', lib: '#7c3aed',
    post: '#e11d48', bank: '#0f766e', conv: '#64748b', fuel: '#b45309', ev: '#059669', pk: '#2563eb', exit: '#0ea5e9' };
  var on = {}; LAYERS.forEach(function (l) { on[l[0]] = l[2]; });
  try { var sv = JSON.parse(localStorage.getItem('tg_map2d') || 'null'); if (sv && sv.on) Object.keys(sv.on).forEach(function (k) { if (k in on) on[k] = !!sv.on[k]; }); } catch (e) {}
  var HASHLY = false, HOUR = null;   // 주소의 #ly= 로 연 층 — 이 동안은 저장하지 않는다(T-Book 이 여는 보기는 그때만)
  function saveOn() { if (HASHLY) return; try { localStorage.setItem('tg_map2d', JSON.stringify({ on: on })); } catch (e) {} }
  function hashLayers() {   // #ly=acc,sz,cam → 행정동·도로 + 그 층만 켠다. 모르는 키는 건너뛴다
    var hm = /[#&]h=(\d{1,2})(?!\d)/.exec(location.hash); HOUR = hm && +hm[1] < 24 ? +hm[1] : null;   // #h=22 — 길목 층이 볼 시각
    var m = /[#&]ly=([a-z0-9,]*)/.exec(location.hash); if (!m) return false;
    var ks = m[1].split(',').filter(function (k) { return k in on; });
    LAYERS.forEach(function (l) { on[l[0]] = false; }); on.dong = true; on.road = true; on.base = true; on.bld = true;
    ks.forEach(function (k) { on[k] = true; }); HASHLY = true; return true;
  }
  hashLayers();

  // ---------- 자료 읽기 ----------
  var FILES = { dong: 'data/dong-seocho.json', pop: 'data/pop-seocho.json', roads: 'data/maps/seocho-full-roads.json', full: 'data/maps/seocho-full.json',
    base: 'data/maps/seocho.json', gu: 'data/maps/seoul-districts.json', acc: 'data/taas-nodes-seocho.json', fatal: 'data/taas-fatal-seocho.json', hot: 'data/taas.json',
    cam: 'data/cameras-seocho.json', sig: 'data/signal-tod-seocho.json', evt: 'data/events-seocho.json', vol: 'data/traffic-vol-seocho.json', her: 'data/heritage-seocho.json',
    near: 'data/dong-near.json', xing: 'data/intersections-seocho.json', pub: 'data/pubdata-seocho.json', police: 'data/police-seocho.json', sz: 'data/schoolzone-seocho.json', st: 'data/stores-seocho.json',
    jur: 'data/jur-seocho.json', tgis: 'data/tgis-seocho.json', spot: 'data/spot-seocho.json',
    osm: 'data/base-seocho.json', flow: 'data/flow-seocho.json', livep: 'data/live-seocho.json' };
  function get(k) { return fetch(FILES[k]).then(function (r) { return r.json(); }).then(function (j) { D[k] = j; }).catch(function () { D[k] = null; }); }
  Promise.all(Object.keys(FILES).map(get)).then(function () { prep(); pubPrep(); extraPrep(); basePrep(); flowPrep(); fit(); if (on.bld && view.s > 0.12) loadBld(); draw(); applyHash(); $('m2dLoad').style.display = 'none'; paintTime(); summary(); });
  function loadBld() {   // 건물 593KB — 켤 때만
    if (D.bld !== undefined) return;
    D.bld = null; fetch('data/maps/seocho-full-buildings.json').then(function (r) { return r.json(); }).then(function (j) { D.bld = j; prepBld(); draw(); }).catch(function () {});
  }

  // ---------- 준비: 모든 자료를 평면 m 로 ----------
  var NEAR = [], DONG = [], ROADS = [], NODES = [], GU = [], BLD = [];
  function prep() {
    if (D.dong) DONG = D.dong.dong.map(function (d) {
      var polys = d.polys.map(function (Pg) { return Pg.map(function (r) { return r.map(function (q) { return P(q[0], q[1]); }); }); });
      var box = [1e9, -1e9, 1e9, -1e9], sx = 0, sy = 0, n = 0;
      polys.forEach(function (Pg) { Pg[0].forEach(function (q) { box[0] = Math.min(box[0], q[0]); box[1] = Math.max(box[1], q[0]); box[2] = Math.min(box[2], q[1]); box[3] = Math.max(box[3], q[1]); sx += q[0]; sy += q[1]; n++; }); });
      var pop = D.pop && D.pop.dong ? D.pop.dong.filter(function (x) { return x.name === d.name; })[0] : null;
      return { name: d.name, polys: polys, box: box, c: labelPt(polys, box), pop: pop };
    });
    if (D.roads) Object.keys(D.roads.roads).forEach(function (nm) { var r = D.roads.roads[nm]; ROADS.push({ name: nm, axis: r.axis, pts: r.pts.map(function (q) { return fullM(q[0], q[1]); }) }); });
    // 실제 교차점 25곳 — 두 도로 중심선이 만나는 자리(게임과 같은 도로 쌍). 이름은 서초구 1:1 지도의 이름(v0.10.41 바로잡음)
    var F = D.full; F2 = F;
    if (F && D.roads) {
      for (var i = 0; i < F.roadNamesV.length; i++) for (var j = 0; j < F.roadNamesH.length; j++) {
        var V = D.roads.roads[F.roadNamesV[i]], H = D.roads.roads[F.roadNamesH[j]]; if (!V || !H) continue;
        var x = F.grid.xs[i], z = F.grid.zs[j];
        for (var it = 0; it < 30; it++) { z = along(H.pts, 0, x); x = along(V.pts, 1, z); }
        var pr = F.roadNamesV[i] + '×' + F.roadNamesH[j], br = D.pop && D.pop.byRoads ? D.pop.byRoads[pr] : null;
        var xr = D.xing && D.xing.nodes ? D.xing.nodes.filter(function (q) { return q.i === i && q.j === j; })[0] : null;
        NODES.push({ i: i, j: j, p: xr && xr.met ? P(xr.lon, xr.lat) : fullM(x, z), name: (xr && xr.name) || (F.nodeNames && F.nodeNames[i + ',' + j]) || (F.roadNamesV[i] + ' · ' + F.roadNamesH[j]), pair: pr, dong: br,
          real: xr ? !!xr.met : true, why: xr && xr.why, gap: xr ? xr.gapM : null, measured: !!xr, sig: xr && xr.sigName ? { name: xr.sigName, no: xr.sigNo, m: xr.sigM } : null, nameSrc: xr && xr.nameSource });
      }
    }
    // 서초구와 맞닿은 강남·동작·관악구 동 — 경계와 이름만(자료는 서초구만 자세하다)
    if (D.near && D.near.dong) NEAR = D.near.dong.map(function (d) {
      var polys = d.polys.map(function (Pg) { return Pg.map(function (r) { return r.map(function (q) { return P(q[0], q[1]); }); }); });
      var box = [1e9, -1e9, 1e9, -1e9]; polys.forEach(function (Pg) { Pg[0].forEach(function (q) { box[0] = Math.min(box[0], q[0]); box[1] = Math.max(box[1], q[0]); box[2] = Math.min(box[2], q[1]); box[3] = Math.max(box[3], q[1]); }); });
      return { name: d.name, gu: d.gu, polys: polys, box: box, c: labelPt(polys, box), near: true };
    });
    if (D.gu) (D.gu.districts || D.gu.gu || []).forEach(function (g) { var rings = g.rings || g.lines || (g.coords ? [g.coords] : []); rings.forEach(function (r) { GU.push({ name: g.name, pts: r.map(function (q) { return P(q[0], q[1]); }) }); }); });
  }
  function prepBld() { if (!D.bld) return; BLD = (D.bld.buildings || []).map(function (b) { return { p: (b.p || []).map(function (q) { return fullM(q[0], q[1]); }), n: b.n || '', lv: b.lv || 0 }; }).filter(function (b) { return b.p.length > 2; }); }
  function along(pts, ax, t) {   // 중심선에서 주축 값 t 의 가로 값(ax 0: x 로 z 를 · ax 1: z 로 x 를)
    var s = pts.slice().sort(function (a, b) { return a[ax] - b[ax]; }), o = 1 - ax;
    if (t <= s[0][ax]) return s[0][o];
    for (var k = 1; k < s.length; k++) if (t <= s[k][ax]) { var a = s[k - 1], b = s[k], u = (t - a[ax]) / ((b[ax] - a[ax]) || 1); return a[o] + (b[o] - a[o]) * u; }
    return s[s.length - 1][o];
  }
  function labelPt(polys, box) {   // 이름 자리 — 가장 큰 고리의 무게중심(안에 안 들면 상자 가운데)
    var best = null, ba = 0;
    polys.forEach(function (Pg) { var r = Pg[0], a = 0, cx = 0, cy = 0; for (var i = 0, j = r.length - 1; i < r.length; j = i++) { var f = r[j][0] * r[i][1] - r[i][0] * r[j][1]; a += f; cx += (r[j][0] + r[i][0]) * f; cy += (r[j][1] + r[i][1]) * f; } if (Math.abs(a) > ba) { ba = Math.abs(a); best = [cx / (3 * a), cy / (3 * a)]; } });
    best = best || [(box[0] + box[1]) / 2, (box[2] + box[3]) / 2];
    // 오목한 동은 무게중심이 밖(옆 동)에 떨어진다 — 그러면 그 높이의 가로줄에서 가장 긴 안쪽 구간의 가운데로
    var R = null, ra = 0; polys.forEach(function (Pg) { var r = Pg[0], a = 0; for (var i = 0, j = r.length - 1; i < r.length; j = i++) a += r[j][0] * r[i][1] - r[i][0] * r[j][1]; if (Math.abs(a) > ra) { ra = Math.abs(a); R = r; } });
    if (!R || inRing(R, best[0], best[1])) return best;
    var y0 = Infinity, y1 = -Infinity; R.forEach(function (q) { y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); });
    var pick = best, bw = 0;
    for (var k = 1; k < 20; k++) {
      var y = y0 + (y1 - y0) * k / 20, xs = [];
      for (var i = 0, j = R.length - 1; i < R.length; j = i++) { var a1 = R[j], b1 = R[i]; if ((a1[1] > y) !== (b1[1] > y)) xs.push(a1[0] + (y - a1[1]) * (b1[0] - a1[0]) / (b1[1] - a1[1])); }
      xs.sort(function (p, q) { return p - q; });
      for (var m = 0; m + 1 < xs.length; m += 2) { var w = xs[m + 1] - xs[m], wt = w * (1 - Math.abs(k - 10) / 14); if (wt > bw) { bw = wt; pick = [(xs[m] + xs[m + 1]) / 2, y]; } }
    }
    return pick;
  }
  function baseLL(gx, gz) {   // 기본 지도 아핀 공간(TAAS gx·gz) → 위경도(식을 거꾸로 푼다)
    var W = D.base && D.base.wgs84; if (!W) return null;
    var a = W.x[0], b = W.x[1], c = W.z[0], d = W.z[1], det = a * d - b * c, px = gx - W.x[2], pz = gz - W.z[2];
    return [(d * px - b * pz) / det + W.lon0, (-c * px + a * pz) / det + W.lat0];
  }
  function nodeAt(ij) { for (var k = 0; k < NODES.length; k++) if (NODES[k].i === ij[0] && NODES[k].j === ij[1]) return NODES[k]; return null; }

  // ---------- 보기 ----------
  // 처음에는 간선 격자(교차로 25곳)를 채우고, 「전체」는 격자 ↔ 서초구 전체를 번갈아 보인다
  var fitAll = false;
  function fit() {
    var W = cv.clientWidth, H = cv.clientHeight, b = [1e9, -1e9, 1e9, -1e9];
    if (!fitAll && NODES.length) NODES.forEach(function (n) { b[0] = Math.min(b[0], n.p[0] - 250); b[1] = Math.max(b[1], n.p[0] + 250); b[2] = Math.min(b[2], n.p[1] - 250); b[3] = Math.max(b[3], n.p[1] + 250); });
    else DONG.forEach(function (d) { b[0] = Math.min(b[0], d.box[0]); b[1] = Math.max(b[1], d.box[1]); b[2] = Math.min(b[2], d.box[2]); b[3] = Math.max(b[3], d.box[3]); });
    if (b[0] > b[1]) b = [-4000, 4000, -4000, 4000];
    view.cx = (b[0] + b[1]) / 2; view.cy = (b[2] + b[3]) / 2; view.s = Math.min(W / (b[1] - b[0]), H / (b[3] - b[2])) * 0.92;
  }
  function S(q) { return [(q[0] - view.cx) * view.s + cv.clientWidth / 2, (q[1] - view.cy) * view.s + cv.clientHeight / 2]; }
  function M(sx, sy) { return [(sx - cv.clientWidth / 2) / view.s + view.cx, (sy - cv.clientHeight / 2) / view.s + view.cy]; }
  function resize() { cv.width = cv.clientWidth * DPR; cv.height = cv.clientHeight * DPR; draw(); }
  window.addEventListener("m2dresize", resize);

  var LINE_C = { '2': '#00a84d', '3': '#ef7c1c', '4': '#00a5de', '7': '#747f00', '9': '#bdb092', '신': '#d4003b' };   // 노선 색(번호만 적는다 · 로고 없음)
  var F2 = null;
  var PAL = ['#dbeafe', '#fce7f3', '#dcfce7', '#fef9c3', '#ede9fe', '#ffedd5', '#cffafe', '#fee2e2', '#e0e7ff'];
  function path(pts) { ctx.beginPath(); pts.forEach(function (q, k) { var s = S(q); if (k) ctx.lineTo(s[0], s[1]); else ctx.moveTo(s[0], s[1]); }); }
  function zk() { return Math.max(0.55, Math.min(1.35, view.s / 0.3)); }
  function dot(q, r, fill, stroke, item) { var s = S(q); r = r * zk(); ctx.beginPath(); ctx.arc(s[0], s[1], r, 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill(); if (stroke) { ctx.lineWidth = 1.5; ctx.strokeStyle = stroke; ctx.stroke(); } if (item) hit.push({ x: s[0], y: s[1], r: Math.max(r, 9), it: item }); }
  function label(q, text, size, color, bg) { var s = S(q); ctx.font = 'bold ' + size + 'px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; if (bg) { var w = ctx.measureText(text).width; ctx.fillStyle = bg; ctx.fillRect(s[0] - w / 2 - 3, s[1] - size / 2 - 2, w + 6, size + 4); } ctx.fillStyle = color; ctx.fillText(text, s[0], s[1]); }
  function draw() {
    var needW = Math.round(cv.clientWidth * DPR), needH = Math.round(cv.clientHeight * DPR);
    if (cv.width !== needW || cv.height !== needH) { cv.width = needW; cv.height = needH; }
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0); hit = [];
    var W = cv.clientWidth, H = cv.clientHeight, dark = document.documentElement.classList.contains('dark');
    var BASE = on.base && OSM; ctx.fillStyle = dark ? '#0f1624' : (BASE ? '#f2efe8' : '#eef2f6'); ctx.fillRect(0, 0, W, H);
    var ymd = pickDate();
    // 이웃 구의 동(회색 · 점선 경계)
    NEAR.forEach(function (d) {
      d.polys.forEach(function (Pg) { ctx.beginPath(); Pg.forEach(function (r) { r.forEach(function (q, n) { var s = S(q); if (n) ctx.lineTo(s[0], s[1]); else ctx.moveTo(s[0], s[1]); }); ctx.closePath(); });
        if (on.dong) { var hl = sel && sel.it.kind === 'near' && sel.it.d === d; ctx.fillStyle = dark ? (hl ? 'rgba(148,163,184,.35)' : 'rgba(148,163,184,.10)') : (hl ? '#e2e8f0' : '#f1f5f9'); ctx.fill('evenodd'); }
        ctx.lineWidth = 0.9; ctx.setLineDash([3, 3]); ctx.strokeStyle = dark ? 'rgba(148,163,184,.5)' : 'rgba(100,116,139,.55)'; ctx.stroke(); ctx.setLineDash([]); });
    });
    // 행정동
    DONG.forEach(function (d, k) {
      d.polys.forEach(function (Pg) { ctx.beginPath(); Pg.forEach(function (r) { r.forEach(function (q, n) { var s = S(q); if (n) ctx.lineTo(s[0], s[1]); else ctx.moveTo(s[0], s[1]); }); ctx.closePath(); });
        var lv = on.live ? liveNow(d.name) : null;
        if (lv) { var t = Math.min(1, lv.n / (lv.max || 1)); ctx.fillStyle = 'rgba(' + Math.round(255 - 40 * t) + ',' + Math.round(230 - 170 * t) + ',' + Math.round(150 - 110 * t) + ',' + (dark ? .55 : .75) + ')'; ctx.fill('evenodd'); }
        else if (on.sales && salesNow(d.name)) { var sn = salesNow(d.name); ctx.fillStyle = 'rgba(' + Math.round(237 - 120 * sn.t) + ',' + Math.round(233 - 180 * sn.t) + ',' + Math.round(254 - 40 * sn.t) + ',' + (dark ? .5 : .8) + ')'; ctx.fill('evenodd'); }
        else if (on.dong) { var hl3 = sel && sel.it.kind === 'dong' && sel.it.d === d; ctx.fillStyle = dark ? 'rgba(90,120,170,' + (hl3 ? '.45' : BASE ? '.08' : '.18') + ')' : (hl3 ? '#fde68a' : PAL[k % PAL.length]); if (BASE && !hl3 && !dark) ctx.globalAlpha = 0.3; ctx.fill('evenodd'); ctx.globalAlpha = 1; }
        if (!BASE) { ctx.lineWidth = on.dong ? 1.6 : 0.8; ctx.strokeStyle = dark ? 'rgba(160,190,230,.6)' : 'rgba(40,60,90,.45)'; ctx.stroke(); } });
    });
    if (BASE) { drawBaseAreas(dark); DONG.forEach(function (d) { d.polys.forEach(function (Pg) { ctx.beginPath(); Pg.forEach(function (r) { r.forEach(function (q, n) { var s = S(q); if (n) ctx.lineTo(s[0], s[1]); else ctx.moveTo(s[0], s[1]); }); ctx.closePath(); });
      ctx.lineWidth = on.dong ? 1.8 : 0.8; ctx.setLineDash(on.dong ? [] : [4, 4]); ctx.strokeStyle = dark ? 'rgba(167,139,250,.65)' : 'rgba(109,40,217,.45)'; ctx.stroke(); ctx.setLineDash([]); }); }); }
    // 구 경계(서초·동작·관악·강남)
    GU.forEach(function (g) { path(g.pts); ctx.lineWidth = 2.4; ctx.setLineDash([8, 5]); ctx.strokeStyle = dark ? '#9fb3d1' : '#475569'; ctx.stroke(); ctx.setLineDash([]); });
    // 도로 — 바탕 지도가 있으면 OSM 도로 전부(종류별 폭·색 · 지하차도 점선 · 다리 테), 없으면 간선 10개
    if (on.road && OSM) drawBaseRoads(dark);
    // 건물
    if (on.bld && BLD.length && view.s > 0.12) BLD.forEach(function (b) { path(b.p); ctx.closePath(); ctx.fillStyle = dark ? 'rgba(200,210,225,.28)' : (BASE ? 'rgba(186,176,164,.85)' : 'rgba(90,100,115,.30)'); ctx.fill(); if (BASE && !dark && view.s > 0.5) { ctx.lineWidth = 0.6; ctx.strokeStyle = 'rgba(120,110,100,.7)'; ctx.stroke(); } });
    if (on.road && OSM) drawBaseLabels(dark);
    // 도로(OSM 간선 10개)
    if (on.road && !OSM) ROADS.forEach(function (r) { path(r.pts); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(3, 26 * view.s); ctx.strokeStyle = dark ? '#3b4a63' : '#ffffff'; ctx.stroke(); ctx.lineWidth = Math.max(1, 3 * view.s); ctx.strokeStyle = dark ? '#8aa0c0' : '#f59e0b'; ctx.stroke(); });
    if (on.road && !OSM && view.s > 0.08) ROADS.forEach(function (r) { var q = r.pts[Math.floor(r.pts.length * 0.3)]; if (q) label(q, r.name, 12, dark ? '#e2e8f0' : '#334155', dark ? 'rgba(15,22,36,.7)' : 'rgba(255,255,255,.8)'); });
    if (on.dong && view.s > 0.09) NEAR.forEach(function (d) { label(d.c, d.name, 11, dark ? '#94a3b8' : '#64748b'); if (view.s > 0.16) label([d.c[0], d.c[1] + 14 / view.s], d.gu, 10, dark ? '#64748b' : '#94a3b8'); });
    // 동 이름
    if (on.dong) DONG.forEach(function (d) { label(d.c, d.name, view.s > 0.2 ? 14 : 12, dark ? '#dbe6f5' : '#1e293b'); var lv2 = on.live ? liveNow(d.name) : null, sn2 = on.sales && !lv2 ? salesNow(d.name) : null; if (sn2 && view.s > 0.06) label([d.c[0], d.c[1] + 16 / view.s], '💳 시간당 약 ' + won(sn2.perH), 11, dark ? '#ddd6fe' : '#4c1d95'); else if (lv2 && view.s > 0.06) label([d.c[0], d.c[1] + 16 / view.s], '지금 ' + lv2.n.toLocaleString() + '명', 11, dark ? '#fde68a' : '#7c2d12'); else if (d.pop && view.s > 0.14) label([d.c[0], d.c[1] + 16 / view.s], d.pop.tot.toLocaleString() + '명', 11, dark ? '#94a3b8' : '#475569'); });
    // 교차로(이름 · 사고)
    NODES.forEach(function (n) {
      var st = D.acc && D.acc.nodes ? D.acc.nodes.filter(function (x) { return x.node[0] === n.i && x.node[1] === n.j; })[0] : null;
      if (!n.real) { var sx = S(n.p); ctx.strokeStyle = dark ? '#94a3b8' : '#64748b'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(sx[0] - 5, sx[1] - 5); ctx.lineTo(sx[0] + 5, sx[1] + 5); ctx.moveTo(sx[0] + 5, sx[1] - 5); ctx.lineTo(sx[0] - 5, sx[1] + 5); ctx.stroke(); hit.push({ x: sx[0], y: sx[1], r: 9, it: { kind: 'node', n: n, st: null } }); return; }
      if (on.acc && st && st.total) { var r = 5 + Math.sqrt(st.total) * 0.9; dot(n.p, r, st.death ? 'rgba(220,38,38,.55)' : 'rgba(234,88,12,.45)', '#7f1d1d', { kind: 'node', n: n, st: st }); }
      else dot(n.p, 4, dark ? '#e2e8f0' : '#1e293b', null, { kind: 'node', n: n, st: st });
      if (view.s > 0.13) label([n.p[0], n.p[1] - 22 / view.s], n.name, 11.5, dark ? '#fef3c7' : '#0f172a', dark ? 'rgba(15,22,36,.75)' : 'rgba(255,255,255,.85)');
    });
    // 사망사고 사례(한 건씩 — 기본 지도 아핀을 거꾸로 풀어 실제 자리로)
    if (on.fatal && D.fatal) D.fatal.cases.forEach(function (c) { var ll = baseLL(c.gx, c.gz); if (ll) dot(P(ll[0], ll[1]), 5, '#111827', '#f87171', { kind: 'fatal', c: c }); });
    if (on.hot && D.hot) (D.hot.layers || []).forEach(function (L) { (L.items || []).forEach(function (it) { if (it.lo && it.la) dot(P(it.lo, it.la), 7, 'rgba(250,204,21,.8)', '#a16207', { kind: 'hot', it: it, L: L }); }); });
    // 🏫 어린이보호구역(v0.10.65 · 전국어린이보호구역표준데이터) — 자리는 대상 시설의 점(구역 경계선은 자료에 없다)
    var SZC = { '초등학교': '#eab308', '유치원': '#f97316', '어린이집': '#fb923c', '특수학교': '#a855f7', '외국인학교': '#0ea5e9', '학원': '#84cc16' };
    if (on.sz && D.sz) D.sz.zones.forEach(function (z) { dot(P(z.lon, z.lat), z.kind === '초등학교' ? 6 : 4.5, SZC[z.kind] || '#eab308', '#1f2937', { kind: 'sz', z: z });
      if (view.s > 0.18 && z.kind === '초등학교') label([P(z.lon, z.lat)[0], P(z.lon, z.lat)[1] - 12 / view.s], z.name, 10, dark ? '#fde68a' : '#713f12', dark ? 'rgba(15,22,36,.7)' : 'rgba(255,255,255,.85)'); });
    if (on.szh && D.sz) D.sz.hot.forEach(function (t) { var q = P(t.lon, t.lat), s = S(q); ctx.beginPath(); ctx.arc(s[0], s[1], Math.max(10, 60 * view.s), 0, Math.PI * 2); ctx.fillStyle = 'rgba(220,38,38,.18)'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#dc2626'; ctx.stroke(); dot(q, 6, '#dc2626', '#fff', { kind: 'szh', t: t }); });
    if (on.cam && D.cam) D.cam.items.forEach(function (c) { dot(P(c.lon, c.lat), 4.5, '#2563eb', '#fff', { kind: 'cam', c: c }); });
    if (on.sig && D.sig) D.sig.spots.forEach(function (s) { dot(P(s.lon, s.lat), 5, '#16a34a', '#fff', { kind: 'sig', s: s }); });
    if (on.sub && F2) (F2.subways || []).forEach(function (s) { var n = nodeAt([s.i, s.j]); if (!n) return; var q = [n.p[0] + (s.side || 1) * 26, n.p[1] + 26], ls = s.lines || [];
      ls.forEach(function (l, k) { dot([q[0] + k * 13 / view.s, q[1]], 6, LINE_C[l] || '#64748b', '#fff', k ? null : { kind: 'sub', s: s, n: n }); });
      if (view.s > 0.1) label([q[0], q[1] + 16 / view.s], s.name, 11, dark ? '#e2e8f0' : '#334155', dark ? 'rgba(15,22,36,.7)' : 'rgba(255,255,255,.85)'); });
    if (on.her && D.her) D.her.items.forEach(function (h) { if (h.lat && h.lon) dot(P(h.lon, h.lat), 5, '#92400e', '#fde68a', { kind: 'her', h: h }); });
    if (on.vol && D.vol) D.vol.spots.forEach(function (v) { var n = v.node && nodeAt(v.node); if (n && !v.outside) { var s2 = S(n.p); ctx.fillStyle = '#0ea5e9'; ctx.fillRect(s2[0] + 8, s2[1] - 8, 16, 16); hit.push({ x: s2[0] + 16, y: s2[1], r: 12, it: { kind: 'vol', v: v, n: n } }); } });
    drawPub(dark); drawExtra(dark); drawFlow(dark);
    if (on.evt && D.evt) {
      (D.evt.events && D.evt.events.items || []).forEach(function (e) { if (e.lat && e.s <= ymd && e.e >= ymd) dot(P(e.lon, e.lat), 5.5, '#a855f7', '#fff', { kind: 'evt', e: e }); });
      (D.evt.rallies && D.evt.rallies.items || []).forEach(function (r) {
        if (r.d !== ymd || !r.lat) return;
        if (r.march && r.dest) { path([P(r.lon, r.lat), P(r.dest[1], r.dest[0])]); ctx.lineWidth = 3; ctx.setLineDash([6, 4]); ctx.strokeStyle = '#ef4444'; ctx.stroke(); ctx.setLineDash([]); }
        dot(P(r.lon, r.lat), 7, '#ef4444', '#fff', { kind: 'rally', r: r });
      });
    }
    if (REP) { var rs = S(REP.p); ctx.beginPath(); ctx.arc(rs[0], rs[1], 14, 0, Math.PI * 2); ctx.lineWidth = 4; ctx.strokeStyle = '#dc2626'; ctx.stroke(); ctx.beginPath(); ctx.arc(rs[0], rs[1], 4, 0, Math.PI * 2); ctx.fillStyle = '#dc2626'; ctx.fill();
      label([REP.p[0], REP.p[1] - 26 / view.s], '📋 보고 자리', 12, '#fff', 'rgba(185,28,28,.9)'); hit.push({ x: rs[0], y: rs[1], r: 16, it: { kind: 'report' } }); }
    if (sel) { ctx.beginPath(); ctx.arc(sel.x, sel.y, sel.r + 5, 0, Math.PI * 2); ctx.lineWidth = 3; ctx.strokeStyle = '#facc15'; ctx.stroke(); }
    // 축척
    var mScale = [100, 200, 500, 1000, 2000].filter(function (m) { return m * view.s > 60; })[0] || 2000;
    ctx.fillStyle = dark ? '#e2e8f0' : '#0f172a'; ctx.fillRect(12, H - 22, mScale * view.s, 4); ctx.font = '11px system-ui'; ctx.textAlign = 'left'; ctx.fillText(mScale >= 1000 ? mScale / 1000 + 'km' : mScale + 'm', 12, H - 30);
  }

  // ---------- 누름 · 끌기 · 확대 ----------
  var ptrs = {}, drag = null, pinch = null;
  cv.addEventListener('pointerdown', function (e) { cv.setPointerCapture(e.pointerId); ptrs[e.pointerId] = [e.offsetX, e.offsetY]; var ks = Object.keys(ptrs);
    if (ks.length === 1) drag = { x: e.offsetX, y: e.offsetY, cx: view.cx, cy: view.cy, moved: 0 };
    else if (ks.length === 2) { var a = ptrs[ks[0]], b = ptrs[ks[1]]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), s: view.s, m: M((a[0] + b[0]) / 2, (a[1] + b[1]) / 2) }; drag = null; } });
  cv.addEventListener('pointermove', function (e) { if (!ptrs[e.pointerId]) return; ptrs[e.pointerId] = [e.offsetX, e.offsetY]; var ks = Object.keys(ptrs);
    if (pinch && ks.length === 2) { var a = ptrs[ks[0]], b = ptrs[ks[1]], d = Math.hypot(a[0] - b[0], a[1] - b[1]); zoomAt(pinch.s * d / pinch.d, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, pinch.m); return; }
    if (drag) { var dx = e.offsetX - drag.x, dy = e.offsetY - drag.y; drag.moved = Math.max(drag.moved, Math.abs(dx) + Math.abs(dy)); view.cx = drag.cx - dx / view.s; view.cy = drag.cy - dy / view.s; draw(); } });
  function up(e) { var wasTap = drag && drag.moved < 6; delete ptrs[e.pointerId]; if (Object.keys(ptrs).length < 2) pinch = null; if (wasTap) tap(e.offsetX, e.offsetY); if (!Object.keys(ptrs).length) drag = null; }
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', function (e) { delete ptrs[e.pointerId]; drag = null; pinch = null; });
  cv.addEventListener('wheel', function (e) { e.preventDefault(); zoomAt(view.s * (e.deltaY < 0 ? 1.18 : 1 / 1.18), e.offsetX, e.offsetY); }, { passive: false });
  function zoomAt(ns, sx, sy, anchor) { ns = Math.max(0.03, Math.min(3, ns)); var m = anchor || M(sx, sy); view.s = ns; view.cx = m[0] - (sx - cv.clientWidth / 2) / ns; view.cy = m[1] - (sy - cv.clientHeight / 2) / ns; if (on.bld && ns > 0.12) loadBld(); draw(); }
  $('m2dIn').onclick = function () { zoomAt(view.s * 1.5, cv.clientWidth / 2, cv.clientHeight / 2); };
  $('m2dOut').onclick = function () { zoomAt(view.s / 1.5, cv.clientWidth / 2, cv.clientHeight / 2); };
  $('m2dFit').onclick = function () { fitAll = !fitAll; this.textContent = fitAll ? '격자' : '전체'; fit(); if (on.bld && view.s > 0.12) loadBld(); draw(); };

  // ---------- 눌러서 보기 ----------
  function inRing(r, x, y) { var c = false; for (var i = 0, j = r.length - 1; i < r.length; j = i++) { if (((r[i][1] > y) !== (r[j][1] > y)) && (x < (r[j][0] - r[i][0]) * (y - r[i][1]) / (r[j][1] - r[i][1]) + r[i][0])) c = !c; } return c; }
  function dongAtM(m) { for (var k = 0; k < DONG.length; k++) { var d = DONG[k]; if (m[0] < d.box[0] || m[0] > d.box[1] || m[1] < d.box[2] || m[1] > d.box[3]) continue; for (var p = 0; p < d.polys.length; p++) if (inRing(d.polys[p][0], m[0], m[1]) && !d.polys[p].slice(1).some(function (h) { return inRing(h, m[0], m[1]); })) return d; } return null; }
  function inPoly(d, m) { if (m[0] < d.box[0] || m[0] > d.box[1] || m[1] < d.box[2] || m[1] > d.box[3]) return false; for (var p = 0; p < d.polys.length; p++) if (inRing(d.polys[p][0], m[0], m[1]) && !d.polys[p].slice(1).some(function (h) { return inRing(h, m[0], m[1]); })) return true; return false; }
  function nearAtM(m) { for (var k = 0; k < NEAR.length; k++) if (inPoly(NEAR[k], m)) return NEAR[k]; return null; }
  function tap(x, y) {
    var best = null, bd = 1e9;
    hit.forEach(function (h) { var d = Math.hypot(h.x - x, h.y - y); if (d <= h.r + 4 && d < bd) { bd = d; best = h; } });
    if (!best && on.jur) { var j0 = jurAtM(M(x, y)); if (j0) { var sj = S(j0.c); best = { x: sj[0], y: sj[1], r: 6, it: { kind: 'jur', J: j0 } }; } }
    if (!best) { var d0 = dongAtM(M(x, y)); if (d0) { var s = S(d0.c); best = { x: s[0], y: s[1], r: 6, it: { kind: 'dong', d: d0 } }; } }
    if (!best) { var d1 = nearAtM(M(x, y)); if (d1) { var s1 = S(d1.c); best = { x: s1[0], y: s1[1], r: 6, it: { kind: 'near', d: d1 } }; } }
    sel = best; show(best ? best.it : null); draw();
  }
  function unent(t) { return String(t == null ? '' : t).replace(/<!\[CDATA\[|\]\]>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&'); }
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function row(k, v) { return '<div class="r"><b>' + esc(k) + '</b><span>' + v + '</span></div>'; }
  function src(t) { return '<div class="src">' + esc(t) + '</div>'; }
  function bar(arr, color) { var mx = Math.max.apply(null, arr) || 1; return '<div class="bars">' + arr.map(function (v, i) { return '<i title="' + i + '" style="height:' + Math.round(v / mx * 100) + '%;background:' + (color || '#3b82f6') + '"></i>'; }).join('') + '</div>'; }
  function show(it) {
    var card = $('m2dCard'), h = '';
    if (!it) { card.classList.remove('on'); return; }
    if (it.kind === 'report') {
      var nn = nearestRealNode(REP.p), dd = nn ? Math.round(Math.hypot(nn.p[0] - REP.p[0], nn.p[1] - REP.p[1])) : 0;
      if (nn && dd <= 800) { show({ kind: 'node', n: nn, st: accOf(nn), rep: dd }); return; }
      h = '<h3>📋 보고 자리</h3>' + row('가까운 교차로', '없음(800m 안) — 서초구 밖일 수 있음') + repAround() + src('T-Book 최초보고가 넘긴 좌표 — 이 기기 안에서만 쓰고 어디에도 저장하지 않는다');
    } else if (it.kind === 'near') {
      var nd = it.d, cnt = function (arr, ll) { return (arr || []).filter(function (q) { var v = ll(q); return v && inPoly(nd, P(v[0], v[1])); }).length; };
      var nS = D.sig ? cnt(D.sig.spots, function (q) { return [q.lon, q.lat]; }) : 0, nE = D.evt && D.evt.events ? cnt(D.evt.events.items, function (q) { return q.lat ? [q.lon, q.lat] : null; }) : 0, nC = D.cam ? cnt(D.cam.items, function (q) { return [q.lon, q.lat]; }) : 0;
      var touch = NODES.filter(function (n) { if (!n.real) return false; if (inPoly(nd, n.p)) return true; var m = 1e9; nd.polys.forEach(function (Pg) { Pg[0].forEach(function (q) { m = Math.min(m, Math.hypot(q[0] - n.p[0], q[1] - n.p[1])); }); }); return m < 120; });
      h = '<h3>🏘 ' + esc(nd.gu + ' ' + nd.name) + '</h3>' + row('자리', '서초구 밖 — 맞닿은 동') + (touch.length ? row('맞닿은 교차로', touch.map(function (n) { return esc(n.name); }).join(' · ')) : '') +
        row('이 동 안의 자료', '신호 ' + nS + '곳 · 단속 카메라 ' + nC + '대 · 행사 ' + nE + '건') + '<p class="desc">이 지도가 자세히 가진 것은 서초구 자료다(인구·사고·국가유산 등). 이웃 구는 경계와 이름, 그리고 서초 자료에 함께 들어온 신호·행사만 보인다.</p>' +
        src('경계: 통계청 SGIS 행정동(2026.7 · 공공누리 1유형) · 서초구 경계에서 1.5km 안의 동');
    } else if (it.kind === 'dong') {
      var d = it.d, p = d.pop; h = '<h3>🏘 ' + esc(d.name) + '</h3>'; var jz = jurDongLine(d.name); if (jz) h += row('경찰서 관할', jz);
      if (p) { h += row('주민', p.tot.toLocaleString() + '명'); h += row('19세 이하', Math.round((p.age[0] + p.age[1]) / p.tot * 100) + '%') + row('70세 이상', Math.round((p.age[7] + p.age[8] + p.age[9]) / p.tot * 100) + '%');
        h += '<div class="cap">연령대(0~9 … 90~99세)</div>' + bar(p.age, '#8b5cf6'); }
      var lv = liveNow(d.name);
      if (lv) { h += row('생활인구 지금', lv.n.toLocaleString() + '명 <em>(' + (lv.we ? '주말' : '평일') + ' ' + lv.h + '시 평균)</em>') + row('하루 폭', Math.min.apply(null, lv.arr).toLocaleString() + ' ~ ' + Math.max.apply(null, lv.arr).toLocaleString() + '명') +
        '<div class="cap">생활인구 시간대(0~23시 · ' + (lv.we ? '주말' : '평일') + ')</div>' + bar(lv.arr, '#f97316'); }
      h += salesRows(d.name);
      var ag = D.st && D.st.agg && D.st.agg[d.name];   // 🏪 등록 상가(소상공인시장진흥공단 · v0.10.65)
      if (ag) h += row('등록 상가', (ag.all || 0).toLocaleString() + '곳 · 음식 ' + (ag.food || 0) + ' · 주점 ' + (ag.bar || 0) + ' · 노래방·PC방 ' + (ag.play || 0) + ' · 숙박 ' + (ag.inn || 0) + ' · 편의점 ' + (ag.conv || 0));
      var sz2 = D.sz ? D.sz.zones.filter(function (z) { var q = P(z.lon, z.lat); return inPoly(d, q); }).length : 0; if (D.sz) h += row('어린이보호구역', sz2 + '곳');
      var ns = NODES.filter(function (n) { return n.dong && (n.dong.dong === d.name || (n.dong.also || []).indexOf(d.name) >= 0); });
      if (ns.length) h += row('걸친 교차로', ns.map(function (n) { return esc(n.name); }).join(' · '));
      h += src('경계: 통계청 SGIS 행정동(2026.7 · 공공누리 1유형) · 인구: 행정안전부 주민등록(2026.8)' + (lv ? ' · 생활인구: 서울시(2026.7 · KT 통신 자료 추정)' : ''));
    } else if (it.kind === 'node') {
      var n = it.n, st = it.st; h = '<h3>' + (n.real ? '🚦 ' : '✕ ') + esc(n.name) + '</h3>' + (it.rep ? row('보고 자리', 'T-Book 보고 자리에서 ' + it.rep + 'm') + repAround() : '') + row('도로', esc(n.pair.replace('×', ' × ')));
      if (!n.real) { h += row('실제', '두 도로가 만나지 않는다 — ' + esc(n.why || ('최단 ' + n.gap + 'm'))) + '<p class="desc">게임 지도(격자)에는 교차로가 있지만 실제 길에는 없다. 사고·신호 자료를 이 자리에 붙이지 않는다.</p>' + src('OpenStreetMap(ODbL) · 2026-09-28 · 두 도로의 모든 선분 사이 최단 거리');
        card.innerHTML = '<button class="x" id="m2dX">닫기</button>' + h; card.classList.add('on'); $('m2dX').onclick = function () { sel = null; show(null); draw(); }; return; }
      h += row('신호 교차로', n.sig ? esc(n.sig.name) + ' <em>#' + esc(n.sig.no) + '</em>' : '<em>공개 신호 목록(C-ITS)에 없음</em>');
      if (n.nameSrc) h += row('이름', '<em>' + esc(n.nameSrc) + '</em>');
      if (n.dong) h += row('행정동', esc(n.dong.dong) + ((n.dong.also || []).length ? ' · ' + esc(n.dong.also.join('·')) + ' <em>경계</em>' : ''));
      if (st && st.total) { h += row('사고(2023~25)', st.total + '건 · 사망 ' + st.death + ' · 중상 ' + st.serious + ' · 경상 ' + st.slight);
        h += row('주된 경위', st.violations.slice(0, 3).map(function (v) { return esc(v[0]) + ' ' + v[1]; }).join(' · ')) + row('사고 유형', st.types.slice(0, 3).map(function (v) { return esc(v[0]) + ' ' + v[1]; }).join(' · '));
        h += src('TAAS 도로교통공단 · 반경 약 585m 안 사고를 가장 가까운 교차로에 배정(근사)'); }
      var sp = D.sig && D.sig.spots ? D.sig.spots.filter(function (s) { return Math.hypot(P(s.lon, s.lat)[0] - n.p[0], P(s.lon, s.lat)[1] - n.p[1]) < 120; })[0] : null;
      if (sp) h += row('신호 지금', sigNow(sp));
      var v = D.vol && D.vol.spots ? D.vol.spots.filter(function (x) { return x.node && x.node[0] === n.i && x.node[1] === n.j; })[0] : null;
      if (v) h += volRows(v);
      h += src((n.measured ? '교차점: OSM 두 도로의 모든 선분이 만나는 자리(2026-09-28 실측) · 이름: OSM 신호·교차로 이름' : '교차점: OSM 도로 중심선이 만나는 자리') + ' · 행정동: 반경 50m 안 걸친 동 모두');
    } else if (it.kind === 'fatal') {
      var c = it.c; h = '<h3>🕯 사망사고 — ' + c.y + '년 ' + c.m + '월</h3>' + row('때', c.dow + '요일 ' + c.tz + ' ' + c.hh + '시') + row('유형', esc(c.typeH + ' · ' + c.typeM)) + row('법규위반', esc(c.viol)) +
        row('가해 / 피해', esc(c.wr + ' / ' + c.dm)) + row('날씨·노면', esc(c.wx + ' · ' + c.rdse)) + row('사상', '사망 ' + c.dead + ' · 중상 ' + c.ser + ' · 경상 ' + c.sli);
      h += src('TAAS 사망사고(2020~2025) · 날짜는 연·월까지만 · 개인정보 없음');
    } else if (it.kind === 'hot') {
      var t = it.it; h = '<h3>⚠ ' + esc(t.name) + '</h3>' + row('갈래', esc(it.L.name || '')) + row('사고', (t.total || '-') + '건 · 사망 ' + (t.death || 0) + ' · 중상 ' + (t.serious || 0)) + row('공표', esc(t.year || '')) + src('TAAS 사고다발지 공표자료');
    } else if (it.kind === 'sz') {
      var z = it.z; h = '<h3>🏫 어린이보호구역 · ' + esc(z.name) + '</h3>' + row('대상 시설', esc(z.kind)) + row('주소', esc(z.addr || '-')) + row('관할', esc(z.police || '-')) +
        row('CCTV', z.cctv > 0 ? z.cctv + '대' : z.cctv < 0 ? '있음(대수 모름)' : '없음') + row('보호구역 도로 폭', z.rw ? z.rw + 'm' : '모름') + row('기준일', esc(z.ref || '-')) +
        '<p class="desc">자리는 대상 시설의 점이다 — 보호구역이 걸친 도로 구간(경계선)은 이 자료에 없다. 보호구역 안 제한속도·주정차 금지(08~20시 가중)는 표지를 보고 확인한다.</p>';
      h += src((D.sz.source || {}).zones || '');
    } else if (it.kind === 'szh') {
      var t2 = it.t; h = '<h3>🧒 보호구역 어린이 사고 다발지</h3>' + row('곳', esc(t2.name)) + row('공표', t2.year + '년') + row('사고', t2.acc + '건 · 사상 ' + t2.cas + '(사망 ' + t2.dead + ' · 중상 ' + t2.ser + ' · 경상 ' + t2.sli + ')');
      h += src((D.sz.source || {}).hot || '');
    } else if (it.kind === 'cam') {
      var cm = it.c; h = '<h3>📷 무인 단속 카메라</h3>' + row('자리', esc(cm.at)) + row('도로', esc(cm.road)) + row('제한속도', cm.lim ? cm.lim + 'km/h' : '-') + row('설치', esc(cm.yr || '-')) + row('단속구분 코드', esc(cm.se) + ' <em>(코드 뜻은 대조 전)</em>');
      h += src('경찰청 전국무인교통단속카메라표준데이터(기준일 2026-04-06)');
    } else if (it.kind === 'sig') {
      var s = it.s; h = '<h3>🚦 ' + esc(s.name) + '</h3>' + row('교차로 번호', esc(s.no)) + row('지금', sigNow(s)) + src('경찰청 교차로계획정보(공공데이터포털) · 계획값 — 감응·수동 운영 중에는 다르다');
    } else if (it.kind === 'sub') {
      h = '<h3>🚇 ' + esc(it.s.name) + '</h3>' + row('노선', (it.s.lines || []).map(function (l) { return '<i class="ln" style="background:' + (LINE_C[l] || '#64748b') + '">' + esc(l) + '</i>'; }).join(' ')) + row('교차로', esc(it.n.name)) + src('자리는 교차로 기준(출입구 위치 아님) · 역 이름은 지도 파일');
    } else if (it.kind === 'her') {
      var hr = it.h; h = '<h3>🏛 ' + esc(hr.name) + '</h3>' + row('종류', esc(hr.kind)) + row('시대', esc(hr.era || '-')) + row('주소', esc(hr.addr || '-')) + '<p class="desc">' + esc(unent(hr.desc).slice(0, 220)) + '…</p>' + src('국가유산청 국가유산 목록');
    } else if (it.kind === 'vol') {
      h = '<h3>🚙 ' + esc(it.v.name) + '</h3>' + volRows(it.v) + src('서울시 교통량조사(VolInfo) · 평일은 2일 평균');
    } else if (it.kind === 'evt') {
      var e = it.e; h = '<h3>📅 ' + esc(e.t) + '</h3>' + row('갈래', esc(e.c)) + row('기간', esc(e.s + ' ~ ' + e.e)) + row('시간', esc(e.hour || '-')) + row('자리', esc(e.p)) + row('요금', esc(e.free || '-')) + src('서울시 문화행사 정보(공공누리 1유형)');
    } else if (['crowd', 'link', 'osmroad'].indexOf(it.kind) >= 0) {
      h = flowCard(it);
    } else if (['jur', 'jurst', 'tgis', 'spot', 'spota'].indexOf(it.kind) >= 0) {
      h = extraCard(it);
    } else if (it.kind === 'pub') {
      h = pubCard(it);
    } else if (it.kind === 'rally') {
      var r = it.r; h = '<h3>🪧 집회' + (r.march ? '·행진' : '') + '</h3>' + row('때', esc(r.d + ' ' + r.from + '~' + r.to)) + row('자리', esc(r.p)) + row('신고 인원', (r.n || '-') + '명 <em>(신고값)</em>') + (r.approx ? row('자리 표시', '<em>근사</em> — ' + esc(r.note)) : '');
      h += src('서울경찰청 「오늘의 주요집회」 · 주최자는 담지 않았다');
    }
    card.innerHTML = '<button class="x" id="m2dX">닫기</button>' + h; card.classList.add('on');
    $('m2dX').onclick = function () { sel = null; show(null); draw(); };
  }
  // ---------- 공공데이터 묶음(pubdata) ----------
  var PUB = null;
  function pubPrep() {
    var p = D.pub; if (!p) return;
    PUB = { fac: {}, hosp: [], er: [], phar: [], heat: [], cold: [], bike: [], bus: [], subr: [], drunk: [], risk: [], sigx: [] };
    Object.keys((p.fac && p.fac.cats) || {}).forEach(function (c) { var k = FAC_K[c]; if (!k) return; PUB.fac[k] = p.fac.cats[c].map(function (o) { return { name: o.name, p: P(o.lon, o.lat), cat: c, er: o.er, ref: o.ref }; }); });
    var S2 = p.seoul || {};
    (S2.hosp || []).forEach(function (o) { var q = { name: o.name, p: P(o.lon, o.lat), o: o }; PUB.hosp.push(q); if (o.er) PUB.er.push(q); });
    (S2.phar || []).forEach(function (o) { PUB.phar.push({ name: o.name, p: P(o.lon, o.lat), o: o }); });
    (S2.heat || []).forEach(function (o) { PUB.heat.push({ name: o.name, p: P(o.lon, o.lat), o: o }); });
    (S2.cold || []).forEach(function (o) { PUB.cold.push({ name: o.name, p: P(o.lon, o.lat), o: o }); });
    (S2.bike || []).forEach(function (o) { PUB.bike.push({ name: o.name, p: P(o.lon, o.lat), o: o }); });
    ((p.bus && p.bus.items) || []).forEach(function (o) { PUB.bus.push({ name: o.name, p: P(o.lon, o.lat), o: o }); });
    ((p.subway && p.subway.items) || []).forEach(function (o) { PUB.subr.push({ name: o.name, p: P(o.lon, o.lat), o: o }); });
    ((p.drunk && p.drunk.items) || []).forEach(function (o) { PUB.drunk.push({ name: o.name, p: P(o.lon, o.lat), ring: (o.ring || []).map(function (q) { return P(q[0], q[1]); }), o: o }); });
    ((p.risk && p.risk.items) || []).forEach(function (o) { PUB.risk.push({ name: o.name, p: P(o.lon, o.lat), ring: (o.ring || []).map(function (q) { return P(q[0], q[1]); }), o: o }); });
    ((p.sigx && p.sigx.items) || []).forEach(function (o) { PUB.sigx.push({ name: o.name, p: P(o.lon, o.lat), o: o }); });
    // 👮 경찰 관서 = **공식 목록**(v0.10.63 · 경찰청 지구대·파출소 주소 현황 + 경찰민원24 경찰서) — OSM 표기(중복·틀린 이름)를 갈아 끼운다
    var ST = D.st; PUB.st = { bar: [], play: [], inn: [], conv: [] };
    if (ST && ST.pts) ST.pts.forEach(function (a) { var sub = ST.sub[a[3]], g = ST.group[sub]; if (!PUB.st[g]) return; PUB.st[g].push({ name: a[0], p: P(a[2], a[1]), sub: sub, dong: ST.dong[a[4]], fl: a[5] }); });
    if (PUB.st.conv.length) PUB.fac.conv = PUB.st.conv.map(function (q) { return { name: q.name, p: q.p, cat: '편의점', o: q, stq: 1 }; });   // 상가정보 편의점(등록 481곳)이 OSM 을 갈아 끼운다
    var PL = D.police;
    if (PL && PL.boxes) PUB.fac.pol = (PL.stations || []).map(function (o) { return { name: o.name, p: P(o.lon, o.lat), cat: '경찰서', o: o, off: 1, st: 1 }; })
      .concat(PL.boxes.map(function (o) { return { name: o.name, p: P(o.lon, o.lat), cat: o.kind, o: o, off: 1 }; }))
      .concat((PL.centers || []).map(function (o) { return { name: o.name, p: P(o.lon, o.lat), cat: '치안센터', o: o, off: 1, ctr: 1 }; }));   // v0.10.66 치안센터(공식 목록)
  }
  // 등록된 운영시간(월~일·공휴일 8칸 「0900-1930」)으로 지금 여는지
  function openNow(hs) {
    if (!hs) return null; var parts = hs.split(' '), d = new Date(), i = (d.getDay() + 6) % 7, t = parts[i];
    if (!t || t === '-') return false; var m = /(\d{4})-(\d{4})/.exec(t); if (!m) return null;
    var s = +m[1], c = +m[2], now = d.getHours() * 100 + d.getMinutes();
    if (c > 2400) return now >= s || now < c - 2400;   // 자정 넘어 여는 곳(예: 0900-2600)
    if (c <= s) return now >= s || now < c;
    return now >= s && now < c;
  }
  function hoursTxt(hs) { if (!hs) return '-'; var N = ['월', '화', '수', '목', '금', '토', '일', '공휴일']; return hs.split(' ').map(function (t, i) { return N[i] + ' ' + (t === '-' ? '휴무' : t.replace(/(\d\d)(\d\d)-(\d\d)(\d\d)/, '$1:$2~$3:$4')); }).join(' · '); }
  function liveNow(name) {
    var L = D.pub && D.pub.livepop && D.pub.livepop.dong; if (!L || !L[name]) return null;
    var dt = new Date(pickDate() + 'T00:00'), we = dt.getDay() === 0 || dt.getDay() === 6, h = nowH(), key = we ? 'we' : 'wd', max = 0;
    Object.keys(L).forEach(function (k) { max = Math.max(max, L[k][key][h]); });
    return { n: L[name][key][h], max: max, we: we, h: h, arr: L[name][key], other: L[name][we ? 'wd' : 'we'] };
  }
  function ring(pts, fill, stroke) { if (!pts || pts.length < 3) return; path(pts); ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = stroke; ctx.stroke(); }
  // ---------- 관할 · T-GIS · 길목(v0.10.74 — T-Book 교통관리 요청) ----------
  var JUR = [], TG = [], TGC = {}, SPOTS = [], SPA = [];
  var JUR_C = { seocho: ['rgba(37,99,235,.10)', '#2563eb'], bangbae: ['rgba(13,148,136,.12)', '#0d9488'], banpo: ['rgba(124,58,237,.10)', '#7c3aed'] };
  var SPA_C = { '음주': '#b45309', '이륜차': '#dc2626', '보행자': '#2563eb', '자전거': '#16a34a', '어린이': '#ca8a04', '고령자': '#7c3aed' };
  function extraPrep() {
    if (D.jur) JUR = D.jur.zones.map(function (z) { var rings = z.rings.map(function (r) { return r.map(function (q) { return P(q[0], q[1]); }); }); var r0 = rings[0], sx = 0, sy = 0; r0.forEach(function (q) { sx += q[0]; sy += q[1]; }); return { z: z, rings: rings, c: [sx / r0.length, sy / r0.length] }; });
    if (D.tgis) { TG = D.tgis.items.map(function (o) { return { c: o[0], name: o[1], p: P(o[3], o[2]), par: o[4], pe: o[5], cits: o[6] }; }); TG.forEach(function (t) { TGC[t.c] = t; }); }
    if (D.spot) { SPOTS = D.spot.stops.map(function (o) { var nt = 0; [22, 23, 0, 1].forEach(function (k) { nt += o.h[k]; }); var day = o.h.reduce(function (a, b) { return a + b; }, 0); return { o: o, name: o.n, p: P(o.lo, o.la), day: day, night: day ? nt / day : 0 }; });
      SPA = D.spot.spots.map(function (o) { return { o: o, name: o.n, p: P(o.lo, o.la) }; }); }
  }
  function spotHour() { return nowH(); }
  function nowH() { return HOUR != null ? HOUR : new Date().getHours(); }
  function spotRank() { var h = spotHour(); return SPOTS.slice().sort(function (a, b) { return b.o.h[h] - a.o.h[h]; }); }
  function jurAtM(m) { for (var k = 0; k < JUR.length; k++) { if (JUR[k].rings.some(function (r) { return inRing(r, m[0], m[1]); })) return JUR[k]; } return null; }
  function jurOfDong(nm) { var z = null; if (D.jur) D.jur.zones.forEach(function (x) { if (x.dongs.indexOf(nm) >= 0) z = x; }); return z; }
  function jurSplit(nm) { return D.jur && D.jur.split ? D.jur.split.filter(function (x) { return x.dong === nm; })[0] || null : null; }   // 도로로 갈린 동(반포4동 = 반포대로 서쪽 방배서 · 동쪽 서초서)
  function jurDongLine(nm) { var z = jurOfDong(nm); if (z) return esc(z.name); var sp = jurSplit(nm); if (!sp) return ''; var zn = function (id) { return (D.jur.zones.filter(function (x) { return x.id === id; })[0] || {}).name || id; };
    return esc(sp.road) + ' 서쪽 ' + esc(zn(sp.west)) + ' · 동쪽 ' + esc(zn(sp.east)) + ' <em>(현장 지식 · T-GIS 관할과 맞음)</em>'; }
  function drawExtra(dark) {
    if (on.jur && JUR.length) {
      JUR.forEach(function (J) { var c = JUR_C[J.z.id] || ['rgba(100,116,139,.1)', '#64748b'];
        J.rings.forEach(function (r) { path(r); ctx.closePath(); ctx.fillStyle = c[0]; ctx.fill(); if (J.z.id === 'banpo') { ctx.save(); ctx.clip(); ctx.strokeStyle = 'rgba(124,58,237,.22)'; ctx.lineWidth = 1; for (var x = -cv.clientHeight; x < cv.clientWidth; x += 12) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + cv.clientHeight, cv.clientHeight); ctx.stroke(); } ctx.restore(); }
          path(r); ctx.closePath(); ctx.lineWidth = 3; ctx.strokeStyle = c[1]; ctx.stroke(); });
        });
      (D.jur.split || []).forEach(function (sp) { (sp.line || []).forEach(function (ln) { path(ln.map(function (q) { return P(q[0], q[1]); })); ctx.setLineDash([10, 6]); ctx.lineWidth = 3; ctx.strokeStyle = dark ? '#fbbf24' : '#b45309'; ctx.stroke(); ctx.setLineDash([]); }); });
      JUR.forEach(function (J) { var c = JUR_C[J.z.id] || ['rgba(100,116,139,.1)', '#64748b'];
        var nm = J.z.id === 'banpo' ? '서초서·방배서 번지로 나눔' : J.z.name.replace('서울', '');
        label(J.c, nm, view.s > 0.12 ? 14 : 12, c[1], dark ? 'rgba(15,22,36,.8)' : 'rgba(255,255,255,.88)'); var s = S(J.c); hit.push({ x: s[0], y: s[1], r: 16, it: { kind: 'jur', J: J } }); });
      (D.jur.stations || []).forEach(function (st) { dot(P(st.lon, st.lat), 7, /방배/.test(st.name) ? '#0d9488' : '#2563eb', '#fff', { kind: 'jurst', st: st }); });
    }
    if (on.tgis && TG.length && view.s > 0.07) {
      TG.forEach(function (t) { if (!t.par || t.par === t.c || !TGC[t.par]) return; path([t.p, TGC[t.par].p]); ctx.lineWidth = 1.2; ctx.strokeStyle = dark ? 'rgba(251,191,36,.6)' : 'rgba(180,83,9,.55)'; ctx.stroke(); });
      TG.forEach(function (t) { var s = S(t.p), r = t.par ? 2.5 : 4; ctx.beginPath(); ctx.arc(s[0], s[1], r * zk(), 0, Math.PI * 2); ctx.fillStyle = t.pe === 380 ? '#0d9488' : '#1d4ed8'; ctx.fill(); ctx.lineWidth = 1.2; ctx.strokeStyle = t.par ? '#f59e0b' : '#fff'; ctx.stroke(); hit.push({ x: s[0], y: s[1], r: 7, it: { kind: 'tgis', t: t } });
        if (view.s > 0.4 && !t.par) label([t.p[0], t.p[1] - 11 / view.s], t.name, 10, dark ? '#e2e8f0' : '#334155', dark ? 'rgba(15,22,36,.7)' : 'rgba(255,255,255,.85)'); });
    }
    if (on.spota && SPA.length) SPA.forEach(function (q) { dot(q.p, 4 + q.o.yrs * 1.2, SPA_C[q.o.k] || '#64748b', '#fff', { kind: 'spota', q: q }); });
    if (on.spot && SPOTS.length) { var h = spotHour(); spotRank().slice(0, 15).forEach(function (q, k) { var v = q.o.h[h]; if (!v) return; var s = S(q.p), r = Math.max(7, Math.sqrt(v) * 0.9) * zk();
      ctx.beginPath(); ctx.arc(s[0], s[1], r, 0, Math.PI * 2); ctx.fillStyle = q.o.t === 's' ? 'rgba(14,165,233,.35)' : 'rgba(234,88,12,.32)'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = q.o.t === 's' ? '#0369a1' : '#c2410c'; ctx.stroke();
      ctx.font = 'bold 12px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = dark ? '#fff' : '#111827'; ctx.fillText(String(k + 1), s[0], s[1]); hit.push({ x: s[0], y: s[1], r: Math.max(9, r), it: { kind: 'spot', q: q, rank: k + 1 } }); }); }
  }
  function extraCard(it) {
    var h = '';
    if (it.kind === 'jur') { var z = it.J.z; h = '<h3>🚓 ' + esc(z.id === 'banpo' ? '반포동 — 서초서·방배서가 번지로 나눔' : z.name + ' 관할') + '</h3>' + row('행정동', esc(z.dongs.join(' · '))) + '<p class="desc">' + esc(z.note) + '</p>' + (D.jur.src ? '<p class="desc">반포동 나눔 — ' + esc(D.jur.src) + '</p>' : '') + src(D.jur.law + ' · ' + D.jur.boundary); }
    else if (it.kind === 'jurst') { var st = it.st; h = '<h3>🚓 ' + esc(st.name) + '</h3>' + row('청사', esc(st.addr)) + src('경찰민원24 청사 좌표(T-Book PS_PTS)'); }
    else if (it.kind === 'tgis') { var t = it.t, pa = t.par ? TGC[t.par] : null; h = '<h3>🚥 ' + esc(t.name) + '</h3>' + row('T-GIS 교차로코드', String(t.c)) + row('관할', t.pe === 380 ? '서울방배경찰서' : '서울서초경찰서') + (t.par && t.par !== t.c ? row('연동교차로코드', t.par + ' → ' + (pa ? esc(pa.name) + ' · ' + Math.round(Math.hypot(pa.p[0] - t.p[0], pa.p[1] - t.p[1])) + 'm' : '이 구역 밖') + (/연등/.test(t.name) ? ' <em>(「(연등)」 종속 신호)</em>' : ' <em>(그 교차로에 딸려 도는 신호)</em>')) : '') + (t.cits ? row('C-ITS 번호', String(t.cits) + ' <em>(15m 안 같은 신호)</em>') : '') + src(D.tgis.source + ' · 신호 현시·주기는 이 표에 없다'); }
    else if (it.kind === 'spot') { var q = it.q, o = q.o, hh = spotHour(); h = '<h3>🎯 ' + esc(q.name) + '</h3>' + row('종류', o.t === 's' ? '지하철역' + (o.g === '경계' ? ' <em>(구 경계 — 이웃 구와 나눠 셈)</em>' : '') : '버스 정류장') + row(hh + '시 하차', o.h[hh].toLocaleString() + '명(하루 평균) · 서초 ' + it.rank + '위') + row('하루 하차', q.day.toLocaleString() + '명') + row('밤 22~01시 비중', Math.round(q.night * 100) + '%') + '<div class="cap">시간대 하차(0~23시)</div>' + bar(o.h, o.t === 's' ? '#0284c7' : '#ea580c') + src(D.spot.source + ' · ' + D.spot.method); }
    else if (it.kind === 'spota') { var a = it.q.o; h = '<h3>🗂 ' + esc(a.k) + ' 다발지 — ' + esc(a.n) + '</h3>' + row('뽑힌 해', esc(a.y) + (a.yrs > 1 ? ' <em>(' + a.yrs + '해 — 고질 자리)</em>' : '')) + row('사고', a.c + '건 · 사상 ' + a.cs + (a.d ? ' · 사망 ' + a.d : '')) + '<p class="desc">참고 — 1년 전 자료·연 1회 갱신. 「0건」은 사고 없음이 아니다.</p>' + src(D.spot.source); }
    return h;
  }
  function drawPub(dark) {
    if (!PUB) return;
    if (on.risk) PUB.risk.forEach(function (q) { ring(q.ring, 'rgba(220,38,38,.18)', '#b91c1c'); dot(q.p, 5, '#b91c1c', '#fff', { kind: 'pub', layer: 'risk', q: q }); });
    if (on.drunk) PUB.drunk.forEach(function (q) { ring(q.ring, 'rgba(168,85,247,.18)', '#7e22ce'); dot(q.p, 6, '#7e22ce', '#fff', { kind: 'pub', layer: 'drunk', q: q }); });
    if (on.sigx && view.s > 0.12) PUB.sigx.forEach(function (q) { var s = S(q.p); ctx.fillStyle = dark ? '#94a3b8' : '#334155'; ctx.fillRect(s[0] - 3, s[1] - 3, 6, 6); hit.push({ x: s[0], y: s[1], r: 7, it: { kind: 'pub', layer: 'sigx', q: q } });
      if (view.s > 0.45) label([q.p[0], q.p[1] + 12 / view.s], q.o.no, 10, dark ? '#cbd5e1' : '#334155', dark ? 'rgba(15,22,36,.7)' : 'rgba(255,255,255,.8)'); });
    var hh = nowH();
    if (on.bus && view.s > 0.07) PUB.bus.forEach(function (q) { var f = FLOW.bus[q.o.id]; if (f) { var a = f[0][hh], b = f[1][hh]; if (a + b < (view.s < 0.14 ? 60 : 3)) return; dot(q.p, 2.5 + Math.sqrt(a + b) / 4.5, onoffC(a, b, .62), onoffC(a, b, 1), { kind: 'pub', layer: 'bus', q: q }); return; }
      if (view.s < 0.14 && q.o.day < 2000) return; dot(q.p, 2.5 + Math.sqrt(q.o.day) / 18, 'rgba(22,163,74,.55)', '#166534', { kind: 'pub', layer: 'bus', q: q }); });
    if (on.subr) PUB.subr.forEach(function (q) { var f = FLOW.sub[q.name]; if (f) { var a = f[0][hh], b = f[1][hh]; dot(q.p, 4 + Math.sqrt(a + b) / 7, onoffC(a, b, .55), onoffC(a, b, 1), { kind: 'pub', layer: 'subr', q: q }); if (view.s > 0.1) label([q.p[0], q.p[1] + 18 / view.s], q.name + ' ' + (a + b).toLocaleString(), 10.5, dark ? '#e0f2fe' : '#075985', dark ? 'rgba(15,22,36,.7)' : 'rgba(255,255,255,.85)'); return; }
      dot(q.p, 4 + Math.sqrt(q.o.on + q.o.off) / 22, 'rgba(14,165,233,.45)', '#075985', { kind: 'pub', layer: 'subr', q: q }); });
    if (on.bike && view.s > 0.1) PUB.bike.forEach(function (q) { dot(q.p, 3.5, '#16a34a', '#fff', { kind: 'pub', layer: 'bike', q: q }); });
    if (on.pol && PUB.fac.pol && PUB.fac.pol[0] && PUB.fac.pol[0].off) PUB.fac.pol.forEach(function (q) {   // 공식 관서: 경찰서는 크게 · 자리가 근사면 옅게
      dot(q.p, q.st ? 8 : q.ctr ? 4 : 5.5, q.st ? '#1e3a8a' : q.ctr ? '#0f766e' : (q.o.approx ? '#93c5fd' : '#2563eb'), '#fff', { kind: 'pub', layer: 'pol', q: q });
      if (view.s > (q.st ? 0.06 : 0.14)) label([q.p[0], q.p[1] - (q.st ? 16 : 12) / view.s], q.name.replace(/^서울/, ''), q.st ? 11 : 10, dark ? '#bfdbfe' : '#1e3a8a', dark ? 'rgba(15,22,36,.75)' : 'rgba(255,255,255,.85)');
    });
    Object.keys(PUB.fac).forEach(function (k) { if (!on[k] || (k === 'pol' && PUB.fac.pol[0] && PUB.fac.pol[0].off)) return; var small = PUB.fac[k].length > 80 && view.s < 0.1; PUB.fac[k].forEach(function (q) { dot(q.p, small ? 2.5 : 4.5, FAC_C[k] || '#64748b', small ? null : '#fff', small ? null : { kind: 'pub', layer: k, q: q }); }); });
    if (on.hosp && view.s > 0.1) PUB.hosp.forEach(function (q) { if (q.o.er) return; dot(q.p, 3.5, '#0891b2', '#fff', { kind: 'pub', layer: 'hosp', q: q }); });
    if (on.er) PUB.er.forEach(function (q) { dot(q.p, 8, '#dc2626', '#fff', { kind: 'pub', layer: 'er', q: q }); if (view.s > 0.08) label([q.p[0], q.p[1] - 16 / view.s], q.name, 11, dark ? '#fecaca' : '#7f1d1d', dark ? 'rgba(15,22,36,.75)' : 'rgba(255,255,255,.85)'); });
    if (on.phar) PUB.phar.forEach(function (q) { var op = openNow(q.o.h); dot(q.p, 4.5, op ? '#16a34a' : '#94a3b8', '#fff', { kind: 'pub', layer: 'phar', q: q }); });
    var STC = { bar: '#b45309', play: '#db2777', inn: '#7c3aed' };
    ['bar', 'play', 'inn'].forEach(function (g) { if (!on[g] || !PUB.st || (view.s < 0.07 && g === 'bar')) return; PUB.st[g].forEach(function (q) { dot(q.p, view.s < 0.12 ? 2.8 : 4, STC[g], view.s < 0.12 ? null : '#fff', { kind: 'pub', layer: g, q: q }); }); });
    if (on.heat) PUB.heat.forEach(function (q) { dot(q.p, 4.5, '#f97316', '#fff', { kind: 'pub', layer: 'heat', q: q }); });
    if (on.cold) PUB.cold.forEach(function (q) { dot(q.p, 4.5, '#38bdf8', '#fff', { kind: 'pub', layer: 'cold', q: q }); });
  }
  var PUB_T = { risk: '🟥 사고위험지역', drunk: '🍺 음주 사고 다발지', sigx: '🔢 신호 교차로', bus: '🚌 버스 정류장', subr: '🚇 지하철 승하차', bike: '🚲 따릉이 대여소', hosp: '🩺 병원·의원', er: '🏥 응급실', phar: '💊 약국', heat: '🥵 무더위쉼터', cold: '🥶 한파쉼터' };
  function pubCard(it) {
    var q = it.q, o = q.o || {}, k = it.layer, p = D.pub || {}, h = '<h3>' + esc((PUB_T[k] || (LAYERS.filter(function (l) { return l[0] === k; })[0] || [0, '📍'])[1]) + ' · ' + (q.name || '(이름 없음)')) + '</h3>', s = '';
    if (k === 'risk') { h += row('사고', o.acc + '건 · 사망 ' + o.dead + ' · 중상 ' + o.ser + ' · 경상 ' + o.sli) + row('주된 원인', esc([].concat(o.cause || []).join(' · ') || '-')) + '<p class="desc">' + esc(q.name) + '</p>'; s = p.risk && p.risk.source; }
    else if (k === 'drunk') { h += row('사고', o.acc + '건 · 사상 ' + o.caslt + '(사망 ' + o.dead + ' · 중상 ' + o.ser + ' · 경상 ' + o.sli + ')') + (o.year ? row('자료 해', o.year + '년 공표') : '') + '<p class="desc">음주 단속·순찰 동선을 잡을 때 참고 — 이 구역 둘레(다각형)에서 음주 사고가 몰렸다.</p>'; s = p.drunk && p.drunk.source; }
    else if (k === 'sigx') { h += row('신호 교차로 번호', esc(o.no)) + (/연등/.test(q.name) ? row('종류', '연동 보조 신호') : ''); s = p.sigx && p.sigx.source; }
    else if (k === 'bus') { var fb = FLOW.bus[o.id]; if (fb) { h += onoffRows(fb); s = D.flow.bus.source; } else { h += row('하루 승하차', o.day.toLocaleString() + '명') + row('가장 붐비는 때', o.peak + '시') + '<div class="cap">시간대(0~23시 · 승차+하차)</div>' + bar(o.h, '#16a34a'); s = p.bus && p.bus.source; } }
    else if (k === 'subr') { var fs = FLOW.sub[q.name]; h += row('노선', esc((fs ? fs[2] : o.lines || []).join(' · '))); if (fs) { h += onoffRows(fs); s = D.flow.subway.source; } else { h += row('하루 승차', o.on.toLocaleString() + '명') + row('하루 하차', o.off.toLocaleString() + '명'); s = p.subway && p.subway.source; } }
    else if (k === 'bike') { h += row('대여소 번호', esc(o.no)) + row('거치대', o.n + '대'); s = p.seoul && p.seoul.source; }
    else if (k === 'hosp' || k === 'er') { var op = openNow(o.h); h += row('종류', esc((o.div || '') + (o.er ? ' · 응급실 운영' : ''))) + (o.emcls && !/이외/.test(o.emcls) ? row('응급 등급', esc(o.emcls)) : '') + row('전화', esc(o.tel || '-')) + (o.ertel ? row('응급실 전화', esc(o.ertel)) : '') +
        row('지금', o.er ? '응급실 24시간(등록값)' : (op === null ? '시간 정보 없음' : op ? '<b style="color:#16a34a">진료 중</b>' : '진료 시간 아님')) + row('주소', esc(o.addr || '-')) + '<div class="cap">' + esc(hoursTxt(o.h)) + '</div>'; s = p.seoul && p.seoul.source; }
    else if (k === 'phar') { var op2 = openNow(o.h); h += row('지금', op2 === null ? '시간 정보 없음' : op2 ? '<b style="color:#16a34a">영업 중</b>' : '닫음') + row('전화', esc(o.tel || '-')) + row('주소', esc(o.addr || '-')) + '<div class="cap">' + esc(hoursTxt(o.h)) + '</div>'; s = p.seoul && p.seoul.source; }
    else if (k === 'heat' || k === 'cold') { h += row('시설', esc(o.type || '-')) + (o.days ? row('여는 날', esc(o.days)) : '') + (o.time && o.time !== '~' ? row('시간', esc(o.time)) : '') + (o.cap ? row('수용', o.cap + '명') : '') + row('주소', esc(o.addr || '-')) + (o.note ? '<p class="desc">' + esc(o.note) + '</p>' : ''); s = p.seoul && p.seoul.source; }
    else if (k === 'bar' || k === 'play' || k === 'inn' || (k === 'conv' && q.stq)) {
      var o3 = q.stq ? q.o : q; h += row('업종', esc(o3.sub)) + row('행정동', esc(o3.dong || '-')) + (o3.fl ? row('층', esc(o3.fl)) : '') +
        '<p class="desc">등록 상가 정보다 — 지금 영업 중인지·영업시간은 담지 않는다. 밤 순찰·주취 신고 동선 참고용.</p>';
      s = (D.st || {}).source;
    }
    else if (k === 'pol' && q.off) {
      var PL = D.police || {}, S3 = PL.source || {};
      h += row('구분', esc(q.cat)) + (q.st ? row('대표번호', esc(q.o.tel)) + row('관할', esc(q.o.gu)) : row('소속', esc(q.o.station) + (q.ctr ? ' · ' + esc(q.o.box) : '')) + row('주소', esc(q.o.addr))) +
        (q.st ? '' : row('자리', (q.o.approx ? '⚠ ' : '') + esc(q.o.locNote || '')));
      s = q.st ? S3.stations : ((q.ctr ? S3.centers : S3.boxes) + ' · ' + S3.loc);
    }
    else { h += row('갈래', esc(q.cat || '')) + (q.ref ? row('출구', esc(q.ref)) : '') + (k === 'pol' ? '<p class="desc">⚠ 경찰 관서는 OpenStreetMap 표기 그대로다(공식 목록 data/police-seocho.json 을 읽지 못했다).</p>' : ''); s = p.fac && p.fac.source; }
    return h + src(s || '');
  }
  // ---------- 🗺 바탕 지도(v0.10.76 · OSM 전 도로·물·녹지·철도·주차장) ----------
  //  소유자 「지금 지도가 거칠고 부족하고 허술해 보여 — 제대로 된 지도를 구현하자」. 간선 10개만 긋던 것을 OSM 도로 전부로.
  //  자료 공간은 P() 와 같다(평면 m · 127.01/37.49 기준). 종류별로 Path2D 를 한 번 만들고, 그릴 때는 캔버스 변환만 바꾼다(끌기·확대가 가볍다).
  var OSM = null, OSMN = [], OSMLAB = [], WLAB = [];
  var RSTY = {   // 종류: 실제 폭(m) · 최소 px · 보이기 시작하는 배율 · [채움, 테두리] 낮 · 밤
    m: [24, 3.2, 0, ['#f9c56b', '#c9801c'], ['#b7791f', '#7c5212']], p: [21, 2.8, 0, ['#ffe08a', '#d4a12a'], ['#9a7b2c', '#6b5420']],
    s: [16, 2.3, 0, ['#fff2c2', '#cdb06a'], ['#6d6447', '#4b4533']], l: [8, 1.6, 0.05, ['#ffe7a3', '#cdb06a'], ['#7a6a3e', '#4b4533']],
    t: [12, 1.9, 0.04, ['#ffffff', '#b9c1cc'], ['#4a5568', '#2d3748']], r: [7, 1.2, 0.07, ['#ffffff', '#c7cdd6'], ['#3d4a5e', '#27303f']],
    v: [4.5, 0.8, 0.2, ['#ffffff', '#d6dbe2'], ['#344055', '#252e3d']], c: [2, 0.9, 0.3, ['#22a35a', null], ['#3fbf78', null]], f: [1.6, 0.8, 0.35, ['#a0a9b6', null], ['#64748b', null]]
  };
  var RORD = ['v', 'r', 't', 'l', 's', 'p', 'm'];
  function decLine(a, from) { var out = [], x = a[from], z = a[from + 1]; out.push([x, z]); for (var i = from + 2; i < a.length; i += 2) { x += a[i]; z += a[i + 1]; out.push([x, z]); } return out; }
  function addLine(pa, pts) { pa.moveTo(pts[0][0], pts[0][1]); for (var i = 1; i < pts.length; i++) pa.lineTo(pts[i][0], pts[i][1]); }
  function addRings(pa, rr) { rr.forEach(function (a) { var pts = decLine(a, 0); addLine(pa, pts); pa.closePath(); }); }
  function lenOf(pts) { var L = 0; for (var i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return L; }
  function midOf(pts) { var L = lenOf(pts) / 2; for (var i = 1; i < pts.length; i++) { var a = pts[i - 1], b = pts[i], d = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L <= d) { var u = L / (d || 1); return { p: [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u], ang: Math.atan2(b[1] - a[1], b[0] - a[0]) }; } L -= d; } return { p: pts[0], ang: 0 }; }
  function basePrep() {
    var B = D.osm; if (!B || typeof Path2D === 'undefined') return;
    OSM = { road: {}, green: { wood: new Path2D(), park: new Path2D(), pitch: new Path2D(), cem: new Path2D() }, water: new Path2D(), ww: [new Path2D(), new Path2D()], wwT: new Path2D(), rail: new Path2D(), railT: new Path2D(), pk: new Path2D() };
    var NM = B.names || [], byName = {};
    Object.keys(B.roads || {}).forEach(function (c) {
      var R = OSM.road[c] = { n: new Path2D(), t: new Path2D(), b: new Path2D(), cnt: 0 };
      B.roads[c].forEach(function (f) { var pts = decLine(f, 2), fl = f[1]; addLine(fl & 2 ? R.t : fl & 1 ? R.b : R.n, pts); if (fl & 1) addLine(R.n, pts); R.cnt++;
        var nm = f[0] >= 0 ? NM[f[0]] : ''; if (!nm || fl & 2) return; var L = lenOf(pts), m = midOf(pts);
        if ('mpstr'.indexOf(c) >= 0 && L > 60) OSMLAB.push({ name: nm, c: c, p: m.p, ang: m.ang, L: L });
        var k = nm, e = byName[k]; if (!e || L > e.L) byName[k] = { name: nm, c: c, p: m.p, L: L, n: (e ? e.n : 0) + 1 }; else e.n++; });
    });
    var PR = { m: 0, p: 1, s: 2, t: 3, r: 4 }; OSMLAB.sort(function (a, b) { return PR[a.c] - PR[b.c] || b.L - a.L; });
    OSMN = Object.keys(byName).map(function (k) { return byName[k]; });
    var GK = { forest: 'wood', wood: 'wood', scrub: 'wood', park: 'park', garden: 'park', grass: 'park', grassland: 'park', recreation_ground: 'park', playground: 'park', golf_course: 'park', pitch: 'pitch', cemetery: 'cem' };
    (B.green || []).forEach(function (g) { addRings(OSM.green[GK[g[1]] || 'park'], g[2]); var nm = g[0] >= 0 ? NM[g[0]] : ''; if (nm && /공원|산|숲/.test(nm)) { var pts = decLine(g[2][0], 0), sx = 0, sy = 0; pts.forEach(function (q) { sx += q[0]; sy += q[1]; }); var a = 0; for (var i = 0, j = pts.length - 1; i < pts.length; j = i++) a += pts[j][0] * pts[i][1] - pts[i][0] * pts[j][1]; if (Math.abs(a) / 2 > 20000) WLAB.push({ name: nm, p: [sx / pts.length, sy / pts.length], k: 'g', A: Math.abs(a) / 2 }); } });
    (B.water || []).forEach(function (w) { addRings(OSM.water, w[1]); var nm = w[0] >= 0 ? NM[w[0]] : ''; if (nm) { var pts = decLine(w[1][0], 0), sx = 0, sy = 0; pts.forEach(function (q) { sx += q[0]; sy += q[1]; }); var A = 0; for (var i = 0, j = pts.length - 1; i < pts.length; j = i++) A += pts[j][0] * pts[i][1] - pts[i][0] * pts[j][1]; A = Math.abs(A) / 2; if (A > 40000 || /강$|천$|호수|저수지/.test(nm)) WLAB.push({ name: nm, p: [sx / pts.length, sy / pts.length], k: 'w', A: 1e9 }); } });   // 단지 안 연못·분수는 이름을 달지 않는다
    (B.waterways || []).forEach(function (w) { var pts = decLine(w, 3); addLine(w[2] & 2 ? OSM.wwT : OSM.ww[w[1] ? 1 : 0], pts); var nm = w[0] >= 0 ? NM[w[0]] : ''; if (nm && !(w[2] & 2) && lenOf(pts) > 300) { var m = midOf(pts); WLAB.push({ name: nm, p: m.p, ang: m.ang, k: 'ww', A: lenOf(pts) }); } });
    (B.rail || []).forEach(function (r) { var pts = decLine(r, 3); addLine(r[2] & 2 ? OSM.railT : OSM.rail, pts); });
    (B.parking || []).forEach(function (rr) { addRings(OSM.pk, rr); });
    WLAB.sort(function (a, b) { return b.A - a.A; });
  }
  function worldT() { var W = cv.clientWidth, H = cv.clientHeight; ctx.setTransform(DPR * view.s, 0, 0, DPR * view.s, DPR * (W / 2 - view.cx * view.s), DPR * (H / 2 - view.cy * view.s)); }
  function screenT() { ctx.setTransform(DPR, 0, 0, DPR, 0, 0); }
  function drawBaseAreas(dark) {
    if (!OSM) return; worldT();
    var G = OSM.green;
    ctx.fillStyle = dark ? 'rgba(34,84,52,.55)' : '#cfe6bd'; ctx.fill(G.park, 'evenodd');
    ctx.fillStyle = dark ? 'rgba(28,74,44,.75)' : '#b9dba3'; ctx.fill(G.wood, 'evenodd');
    ctx.fillStyle = dark ? 'rgba(52,96,60,.6)' : '#bfe0b0'; ctx.fill(G.pitch, 'evenodd');
    ctx.fillStyle = dark ? 'rgba(60,80,64,.5)' : '#d6e3cf'; ctx.fill(G.cem, 'evenodd');
    if (view.s > 0.25) { ctx.fillStyle = dark ? 'rgba(80,92,110,.35)' : 'rgba(205,210,218,.75)'; ctx.fill(OSM.pk, 'evenodd'); }
    ctx.fillStyle = dark ? '#1c3b5e' : '#a8d0f0'; ctx.fill(OSM.water, 'evenodd');
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = dark ? '#2b5a8a' : '#8cc0ea';
    ctx.lineWidth = Math.max(1.6 / view.s, 9); ctx.stroke(OSM.ww[1]); ctx.lineWidth = Math.max(1.2 / view.s, 4); ctx.stroke(OSM.ww[0]);
    ctx.setLineDash([4 / view.s, 3 / view.s]); ctx.lineWidth = Math.max(1 / view.s, 3); ctx.globalAlpha = 0.6; ctx.stroke(OSM.wwT); ctx.globalAlpha = 1; ctx.setLineDash([]);
    screenT();
  }
  function drawBaseRoads(dark) {
    if (!OSM) return; worldT(); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; var s = view.s, mode = dark ? 4 : 3;
    // 철도(지상 · 회색 + 흰 줄) — 지하 노선은 옅은 점선
    if (s > 0.05) { ctx.strokeStyle = dark ? '#64748b' : '#8b95a3'; ctx.lineWidth = Math.max(2.6 / s, 4); ctx.stroke(OSM.rail); ctx.strokeStyle = dark ? '#0f1624' : '#ffffff'; ctx.lineWidth = Math.max(1.2 / s, 1.8); ctx.setLineDash([6 / s, 6 / s]); ctx.stroke(OSM.rail); ctx.setLineDash([]); }
    // 보행·자전거 길(가늘게 · 점선)
    ['f', 'c'].forEach(function (c) { var R = OSM.road[c], st = RSTY[c]; if (!R || s < st[2]) return; ctx.strokeStyle = st[mode][0]; ctx.lineWidth = Math.max(st[1] / s, st[0]); ctx.setLineDash([3 / s, 2.5 / s]); ctx.stroke(R.n); ctx.stroke(R.b); ctx.setLineDash([]); });
    // 지하차도·터널: 옅은 점선 한 겹
    RORD.forEach(function (c) { var R = OSM.road[c], st = RSTY[c]; if (!R || s < st[2]) return; ctx.globalAlpha = 0.55; ctx.setLineDash([5 / s, 4 / s]); ctx.strokeStyle = st[mode][1]; ctx.lineWidth = Math.max(st[1] / s, st[0] * 0.8); ctx.stroke(R.t); ctx.setLineDash([]); ctx.globalAlpha = 1; });
    // 테두리 → 채움(낮은 종류부터 — 큰길이 위로)
    RORD.forEach(function (c) { var R = OSM.road[c], st = RSTY[c]; if (!R || s < st[2]) return; var w = Math.max(st[1] / s, st[0]); ctx.strokeStyle = st[mode][1]; ctx.lineWidth = w + Math.max(1.4 / s, w * 0.18); ctx.stroke(R.n); });
    RORD.forEach(function (c) { var R = OSM.road[c], st = RSTY[c]; if (!R || s < st[2]) return; var w = Math.max(st[1] / s, st[0]); ctx.strokeStyle = dark ? '#0b1220' : '#5b6472'; ctx.lineWidth = w + Math.max(2.4 / s, w * 0.3); if (s > 0.15) ctx.stroke(R.b); ctx.strokeStyle = st[mode][0]; ctx.lineWidth = w; ctx.stroke(R.n); });
    screenT();
  }
  function drawBaseLabels(dark) {
    if (!OSM) return; var boxes = [], seen = {}, W = cv.clientWidth, H = cv.clientHeight, s = view.s;
    function free(x, y, w, h) { for (var i = 0; i < boxes.length; i++) { var b = boxes[i]; if (x < b[0] + b[2] && x + w > b[0] && y < b[1] + b[3] && y + h > b[1]) return false; } boxes.push([x, y, w, h]); return true; }
    WLAB.forEach(function (L) { if ((L.k === 'g' && s < 0.12) || (L.k === 'ww' && s < 0.08)) return; var q = S(L.p); if (q[0] < -50 || q[0] > W + 50 || q[1] < -20 || q[1] > H + 20) return; if (seen['w' + L.name] && L.k !== 'w') return;
      ctx.font = (L.k === 'g' ? '600 ' : 'italic 700 ') + (L.k === 'w' ? 15 : 12) + 'px system-ui, sans-serif'; var tw = ctx.measureText(L.name).width; if (!free(q[0] - tw / 2, q[1] - 9, tw, 18)) return; seen['w' + L.name] = 1;
      ctx.save(); ctx.translate(q[0], q[1]); if (L.ang) { var a = L.ang; if (a > Math.PI / 2) a -= Math.PI; if (a < -Math.PI / 2) a += Math.PI; ctx.rotate(a); } ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 3; ctx.strokeStyle = dark ? 'rgba(15,22,36,.8)' : 'rgba(255,255,255,.85)'; ctx.strokeText(L.name, 0, 0); ctx.fillStyle = L.k === 'g' ? (dark ? '#86efac' : '#166534') : (dark ? '#7dd3fc' : '#1d5f99'); ctx.fillText(L.name, 0, 0); ctx.restore(); });
    var lim = { m: 0.06, p: 0.08, s: 0.14, t: 0.22, r: 0.55 }, n = 0;
    for (var i = 0; i < OSMLAB.length && n < 90; i++) {
      var L = OSMLAB[i]; if (s < lim[L.c]) continue; if (L.L * s < 50) continue;
      var q = S(L.p); if (q[0] < -40 || q[0] > W + 40 || q[1] < -20 || q[1] > H + 20) continue;
      var key = L.name, last = seen[key]; if (last && last.some(function (o) { return Math.hypot(o[0] - q[0], o[1] - q[1]) < 260; })) continue;
      var fs = L.c === 'r' ? 10.5 : L.c === 't' ? 11 : 12; ctx.font = '700 ' + fs + 'px system-ui, sans-serif'; var tw = ctx.measureText(L.name).width; if (tw + 12 > L.L * s) continue;
      var a = L.ang; if (a > Math.PI / 2) a -= Math.PI; if (a < -Math.PI / 2) a += Math.PI;
      var hw = Math.abs(Math.cos(a)) * tw / 2 + 6, hh = Math.abs(Math.sin(a)) * tw / 2 + 7; if (!free(q[0] - hw, q[1] - hh, hw * 2, hh * 2)) continue;
      (seen[key] = seen[key] || []).push(q); n++;
      ctx.save(); ctx.translate(q[0], q[1]); ctx.rotate(a); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineWidth = 3.2; ctx.strokeStyle = dark ? 'rgba(15,22,36,.9)' : 'rgba(255,255,255,.95)'; ctx.strokeText(L.name, 0, 0);
      ctx.fillStyle = dark ? '#e2e8f0' : (L.c === 'r' ? '#475569' : '#1f2937'); ctx.fillText(L.name, 0, 0); ctx.restore();
    }
  }

  // ---------- 흐름(v0.10.76): 버스·지하철 시간대 승차/하차 · 카드 매출 · 실시간 인파·카드·도로 소통 ----------
  //  소유자 「실시간 유동인구와 카드사용상황 · 버스정류장 승하차 인구 등 파악해서 넣고」. 지도는 통신 0 — 실시간 도시데이터는 **받은 시각의 한 장**이고,
  //  받은 뒤 12시간은 서울시 예측값을 보인다. 그 밖의 시각은 「받은 때」라고 적는다(지난 값을 지금처럼 보이지 않는다).
  var FLOW = { bus: {}, sub: {}, sales: {} }, LIVEP = [], LINKS = [];
  var LVC = { '여유': '#22c55e', '보통': '#eab308', '약간 붐빔': '#f97316', '붐빔': '#dc2626', '한산한': '#22c55e', '분주한': '#f97316', '바쁜': '#dc2626' };
  var IDXC = { '원활': '#16a34a', '서행': '#f59e0b', '정체': '#dc2626' };
  function flowPrep() {
    var F = D.flow; if (F) { FLOW.bus = (F.bus && F.bus.items) || {}; FLOW.sub = (F.subway && F.subway.items) || {}; FLOW.sales = (F.sales && F.sales.items) || {}; }
    var L = D.livep; if (!L) return; var seen = {};
    LIVEP = (L.places || []).map(function (o) { var rings = (o.rings || []).map(function (r) { return r.map(function (q) { return P(q[0], q[1]); }); }); var r0 = rings[0] || [[0, 0]], sx = 0, sy = 0; r0.forEach(function (q) { sx += q[0]; sy += q[1]; });
      ((o.road && o.road.links) || []).forEach(function (k) { if (!k[3] || k[3].length < 2) return; var key = k[3][0].join() + '|' + k[3][k[3].length - 1].join(); if (seen[key]) return; seen[key] = 1; LINKS.push({ name: k[0], idx: k[1], spd: k[2], pts: k[3].map(function (q) { return P(q[0], q[1]); }), t: o.road.time, place: o.name }); });
      return { o: o, rings: rings, c: [sx / r0.length, sy / r0.length] }; });
  }
  function pad2(n) { return ('0' + n).slice(-2); }
  function crowdAt(Lp) {   // 고른 날짜·시각에 보일 값 — 받은 시각이면 그 값, 12시간 안이면 서울시 예측, 아니면 받은 때 값(옛것이라 적는다)
    var p = Lp.o.pop; if (!p) return null; var tgt = pickDate() + ' ' + pad2(nowH()) + ':00', got = (p.time || '').slice(0, 13) + ':00';
    if (tgt === got) return { kind: 'now', lvl: p.lvl, min: p.min, max: p.max, t: p.time };
    var f = (p.fcst || []).filter(function (x) { return x[0] === tgt; })[0];
    if (f) return { kind: 'fcst', lvl: f[1], min: f[2], max: f[3], t: f[0] };
    return { kind: 'old', lvl: p.lvl, min: p.min, max: p.max, t: p.time };
  }
  function man(n) { return n >= 10000 ? (n / 10000).toFixed(n >= 100000 ? 0 : 1) + '만' : Math.round(n).toLocaleString(); }
  function won(x) { return x >= 10000 ? (x / 10000).toFixed(x >= 100000 ? 0 : 1) + '억원' : Math.round(x).toLocaleString() + '만원'; }
  var TBH = [6, 5, 3, 3, 4, 3];
  function bandOf(h) { return h < 6 ? 0 : h < 11 ? 1 : h < 14 ? 2 : h < 17 ? 3 : h < 21 ? 4 : 5; }
  function salesNow(name) {
    var x = FLOW.sales[name]; if (!x) return null; var b = bandOf(nowH()), mx = 0;
    Object.keys(FLOW.sales).forEach(function (k) { mx = Math.max(mx, FLOW.sales[k].tb[b] / TBH[b]); });
    var perH = x.tb[b] / TBH[b] / 30.4; return { perH: perH, t: Math.min(1, x.tb[b] / TBH[b] / (mx || 1)), b: b };
  }
  function salesRows(name) {
    var x = FLOW.sales[name]; if (!x) return ''; var S5 = D.flow.sales, b = bandOf(nowH()), now = salesNow(name);
    var top = x.top.slice().sort(function (p, q) { return q[2 + b] - p[2 + b]; }).filter(function (t) { return t[2 + b] > 0; }).slice(0, 4);
    return row('카드 매출(추정)', '한 달 약 ' + won(x.amt) + ' · 결제 ' + man(x.cnt) + '건') + row('지금 시간대', esc(S5.tb[b]) + ' — 시간당 약 ' + won(now.perH) + ' <em>(하루 평균)</em>') +
      (top.length ? row('지금 많은 업종', top.map(function (t) { return esc(t[0]); }).join(' · ')) : '') +
      '<div class="cap">시간당 매출(0~6 · 6~11 · 11~14 · 14~17 · 17~21 · 21~24시)</div>' + bar(x.tb.map(function (v, i) { return v / TBH[i]; }), '#7c3aed') +
      '<div class="cap">요일(월~일)</div>' + bar(x.dw, '#a78bfa') + '<div class="src">' + esc(S5.source) + '</div>';
  }
  function onoffC(a, b, al) { var c = a > b * 1.25 ? '37,99,235' : b > a * 1.25 ? '234,88,12' : '13,148,136'; return 'rgba(' + c + ',' + al + ')'; }
  function bar2(on, off) { var mx = 1, hh = nowH(); for (var i = 0; i < 24; i++) mx = Math.max(mx, on[i], off[i]);
    return '<div class="bars">' + on.map(function (v, i) { var op = i === hh ? 1 : 0.55; return '<i title="' + i + '시 승차" style="height:' + Math.round(v / mx * 100) + '%;background:#2563eb;opacity:' + op + '"></i><i title="' + i + '시 하차" style="height:' + Math.round(off[i] / mx * 100) + '%;background:#ea580c;opacity:' + op + ';margin-right:2px"></i>'; }).join('') + '</div>'; }
  function onoffRows(f) {
    var hh = nowH(), on = f[0], off = f[1], so = on.reduce(function (a, b) { return a + b; }, 0), sf = off.reduce(function (a, b) { return a + b; }, 0);
    var pOn = on.indexOf(Math.max.apply(null, on)), pOff = off.indexOf(Math.max.apply(null, off)), a = on[hh], b = off[hh];
    return row(hh + '시', '승차 ' + a.toLocaleString() + ' · 하차 ' + b.toLocaleString() + '명 <em>(' + (a > b * 1.25 ? '떠나는 사람이 많다' : b > a * 1.25 ? '모여드는 사람이 많다' : '오가는 수가 비슷') + ')</em>') +
      row('하루', '승차 ' + so.toLocaleString() + ' · 하차 ' + sf.toLocaleString() + '명') + row('가장 붐빌 때', '타는 때 ' + pOn + '시 · 내리는 때 ' + pOff + '시') +
      '<div class="cap">시간대 승차(파랑) · 하차(주황) — 하루 평균 · 진한 것이 고른 시각</div>' + bar2(on, off);
  }
  function drawFlow(dark) {
    if (on.spd && LINKS.length && view.s > 0.05) { LINKS.forEach(function (k) { path(k.pts); ctx.lineCap = 'round'; ctx.lineWidth = Math.max(3, 7 * view.s); ctx.strokeStyle = IDXC[k.idx] || '#64748b'; ctx.globalAlpha = 0.9; ctx.stroke(); ctx.globalAlpha = 1;
      var m = k.pts[Math.floor(k.pts.length / 2)], s = S(m); hit.push({ x: s[0], y: s[1], r: 7, it: { kind: 'link', k: k } }); }); }
    if (on.crowd && LIVEP.length) LIVEP.forEach(function (Lp) {
      var cw = crowdAt(Lp); if (!cw) return; var col = LVC[cw.lvl] || '#64748b';
      Lp.rings.forEach(function (r) { path(r); ctx.closePath(); if (cw.kind !== 'old') { ctx.fillStyle = col; ctx.globalAlpha = dark ? 0.28 : 0.22; ctx.fill(); ctx.globalAlpha = 1; } ctx.lineWidth = 2.5; ctx.setLineDash(cw.kind === 'old' ? [6, 4] : cw.kind === 'fcst' ? [10, 3] : []); ctx.strokeStyle = cw.kind === 'old' ? (dark ? '#94a3b8' : '#64748b') : col; ctx.stroke(); ctx.setLineDash([]); });
      var s = S(Lp.c); hit.push({ x: s[0], y: s[1], r: 14, it: { kind: 'crowd', L: Lp } });
      if (view.s > 0.07) { var t1 = Lp.o.name + ' · ' + (cw.lvl || '-'), t2 = (cw.min ? man(cw.min) + '~' + man(cw.max) + '명' : '') + (cw.kind === 'fcst' ? ' 예측' : cw.kind === 'old' ? ' (받은 때 ' + (cw.t || '').slice(11, 16) + ')' : ' 지금');
        label(Lp.c, t1, 12, '#fff', cw.kind === 'old' ? 'rgba(71,85,105,.85)' : col); label([Lp.c[0], Lp.c[1] + 17 / view.s], t2, 10.5, dark ? '#e2e8f0' : '#1f2937', dark ? 'rgba(15,22,36,.75)' : 'rgba(255,255,255,.88)'); }
    });
  }
  function flowCard(it) {
    var h = '', L = D.livep || {};
    if (it.kind === 'osmroad') { var r = it.r; return '<h3>🛣 ' + esc(r.name) + '</h3>' + row('종류', esc((D.osm.roadClass || {})[r.c] || r.c)) + row('구간', r.n + '개(OSM 길 조각)') + src(D.osm.source); }
    if (it.kind === 'link') { var k = it.k; return '<h3>🚥 ' + esc(k.name || '도로') + '</h3>' + row('소통', '<b style="color:' + (IDXC[k.idx] || '#64748b') + '">' + esc(k.idx) + '</b> · ' + k.spd + 'km/h') + row('받은 때', esc(k.t || '-') + ' <em>(지금 소통이 아니다)</em>') + row('장소', esc(k.place)) + src(L.source || ''); }
    var o = it.L.o, cw = crowdAt(it.L), p = o.pop || {}, c = o.card;
    h = '<h3>📡 ' + esc(o.name) + ' <small style="font-weight:400;color:var(--ink2)">' + esc(o.cat) + '</small></h3>';
    if (cw) h += row(cw.kind === 'now' ? '지금' : cw.kind === 'fcst' ? '예측(' + esc(cw.t.slice(11, 16)) + ')' : '받은 때', '<b style="color:' + (LVC[cw.lvl] || '#64748b') + '">' + esc(cw.lvl) + '</b> · ' + (cw.min ? man(cw.min) + '~' + man(cw.max) + '명' : '-') + (cw.kind === 'old' ? ' <em>(' + esc(cw.t) + ' 값 — 지금이 아니다)</em>' : cw.kind === 'fcst' ? ' <em>(서울시 예측)</em>' : ''));
    if (p.msg) h += '<p class="desc">' + esc(p.msg) + '</p>';
    if (p.age) h += row('남·여', Math.round(p.male) + ' : ' + Math.round(100 - p.male) + ' · 상주 ' + Math.round(p.resnt) + '%') + '<div class="cap">연령(10세 미만 … 70대 이상 · ' + esc(p.time) + ')</div>' + bar(p.age, '#0ea5e9');
    if (p.fcst && p.fcst.length) h += '<div class="cap">앞으로 12시간 예측(' + esc(p.fcst[0][0].slice(11, 16)) + '~ · 인구 상한)</div>' + bar(p.fcst.map(function (f) { return f[3] || 0; }), '#64748b');
    if (c) { h += row('실시간 카드', '<b style="color:' + (LVC[c.lvl] || '#64748b') + '">' + esc(c.lvl) + '</b> · 결제 ' + c.cnt + '건 · ' + won(c.amin / 1e4) + '~' + won(c.amax / 1e4) + ' <em>(' + esc(String(c.time || '').replace(/^(\d{4})(\d\d)(\d\d) (\d\d)(\d\d)$/, '$2-$3 $4:$5')) + ' 표본)</em>');
      if (c.rsb && c.rsb.length) h += row('업종', c.rsb.map(function (x) { return esc(x[1]) + ' ' + esc(x[2]) + ' ' + (x[3] || 0) + '건'; }).join(' · '));
      if (c.age) h += '<div class="cap">결제 연령(10대 … 60대 이상)</div>' + bar(c.age, '#7c3aed'); }
    if (o.bus) h += row('버스 오늘 누적', '승차 ' + man(o.bus.acc[0]) + '~' + man(o.bus.acc[1]) + ' · 하차 ' + man(o.bus.acc[2]) + '~' + man(o.bus.acc[3]) + ' <em>(정류장 ' + o.bus.n + ')</em>');
    if (o.sub) h += row('지하철 오늘 누적', '승차 ' + man(o.sub.acc[0]) + '~' + man(o.sub.acc[1]) + ' · 하차 ' + man(o.sub.acc[2]) + '~' + man(o.sub.acc[3]) + ' <em>(역 ' + o.sub.n + ')</em>');
    if (o.road && o.road.idx) h += row('둘레 도로', '<b style="color:' + (IDXC[o.road.idx] || '#64748b') + '">' + esc(o.road.idx) + '</b> · 평균 ' + o.road.spd + 'km/h · 링크 ' + ((o.road.links || []).length) + '개');
    if ((o.acdnt || []).length) h += row('사고·통제', o.acdnt.map(function (a) { return esc(a[1] + ' ' + (a[3] || '')); }).join(' · '));
    if ((o.event || []).length) h += row('행사', o.event.map(function (e) { return esc(e[0]); }).join(' · '));
    if (o.prk) h += row('주차장', o.prk + '곳(장소 안 등록)');
    if (o.wx) h += row('날씨(받은 때)', (o.wx.t != null ? o.wx.t + '℃ · ' : '') + esc(o.wx.pcp || '') + ' · 미세먼지 ' + esc(o.wx.pm10 || '-'));
    return h + '<p class="desc">' + esc(L.note || '') + '</p>' + src((L.source || '') + ' · 받은 시각 ' + (L.baked || ''));
  }

  // ---------- 🕐 시각 막대 · 🧭 근무별 한 번에 · 지금 요약(v0.10.76 · 소유자 「더 효율적이고 구체적으로」) ----------
  function setHour(h) { HOUR = h == null ? null : (h + 24) % 24; paintTime(); draw(); summary(); if (sel && $('m2dCard').classList.contains('on')) show(sel.it); }
  function paintTime() {
    var h = nowH(), dt = new Date(pickDate() + 'T00:00'), we = dt.getDay() === 0 || dt.getDay() === 6, r = $('m2dHour'); if (!r) return;
    r.value = h; $('m2dHourT').textContent = h + '시 · ' + (we ? '주말' : '평일') + (HOUR == null ? '' : ' ✎'); $('m2dNowBtn').classList.toggle('on', HOUR == null);
  }
  if ($('m2dHour')) {
    $('m2dHour').addEventListener('input', function () { setHour(+this.value); });
    $('m2dHm').onclick = function () { setHour(nowH() - 1); }; $('m2dHp').onclick = function () { setHour(nowH() + 1); };
    $('m2dNowBtn').onclick = function () { setHour(null); };
  }
  var PRESETS = [
    ['traffic', '🚦 교통근무', ['acc', 'cam', 'sig', 'spd', 'vol', 'sz', 'risk', 'bus']],
    ['night', '🌙 야간순찰', ['bar', 'play', 'inn', 'conv', 'er', 'pol', 'drunk', 'sales']],
    ['crowd', '🎪 행사·인파', ['evt', 'crowd', 'live', 'subr', 'bus', 'spot']],
    ['jur', '🚓 관할·관서', ['jur', 'pol', 'tgis', 'fire', 'er']],
    ['kids', '🧒 어린이', ['sz', 'szh', 'school', 'kids', 'pg']],
    ['acc', '🚑 사고·응급', ['acc', 'fatal', 'hot', 'er', 'hosp', 'phar', 'pol', 'fire', 'cam']]
  ];
  var KEEP = ['dong', 'road', 'base', 'bld', 'sub'];
  function preset(id) {
    var P3 = PRESETS.filter(function (x) { return x[0] === id; })[0]; if (!P3) return;
    LAYERS.forEach(function (l) { if (KEEP.indexOf(l[0]) < 0) on[l[0]] = false; }); on.dong = true; on.road = true; on.base = true;
    P3[2].forEach(function (k) { if (k in on) on[k] = true; }); saveOn(); paintLayers(); paintPre(); sel = null; show(null); draw(); summary();
  }
  function paintPre() {
    var el = $('m2dPre'); if (!el) return;
    el.innerHTML = PRESETS.map(function (x) { var act = LAYERS.every(function (l) { return KEEP.indexOf(l[0]) >= 0 || on[l[0]] === (x[2].indexOf(l[0]) >= 0); }); return '<button data-p="' + x[0] + '" class="' + (act ? 'on' : '') + '">' + x[1] + '</button>'; }).join('');
  }
  if ($('m2dPre')) { $('m2dPre').addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) preset(b.getAttribute('data-p')); }); }
  var SUMT = [];
  function summary() {
    var el = $('m2dSum'); if (!el || !DONG.length) return; var h = nowH(), out = [], it; SUMT = [];
    function go(txt, p, item) { SUMT.push({ p: p, it: item }); return '<button data-s="' + (SUMT.length - 1) + '">' + esc(txt) + '</button>'; }
    var best = null; DONG.forEach(function (d) { var lv = liveNow(d.name); if (lv && (!best || lv.n > best.n)) best = { d: d, n: lv.n }; });
    if (best) out.push('👥 생활인구 ' + go(best.d.name + ' ' + man(best.n), best.d.c, { kind: 'dong', d: best.d }));
    var bs = null; if (PUB) PUB.subr.forEach(function (q) { var f = FLOW.sub[q.name]; if (f && (!bs || f[1][h] > bs.v)) bs = { q: q, v: f[1][h] }; });
    if (bs && bs.v) out.push('🚇 하차 ' + go(bs.q.name + ' ' + bs.v.toLocaleString(), bs.q.p, { kind: 'pub', layer: 'subr', q: bs.q }));
    var bb = null; if (PUB) PUB.bus.forEach(function (q) { var f = FLOW.bus[q.o.id]; if (f && (!bb || f[1][h] > bb.v)) bb = { q: q, v: f[1][h] }; });
    if (bb && bb.v) out.push('🚌 하차 ' + go(bb.q.name + ' ' + bb.v.toLocaleString(), bb.q.p, { kind: 'pub', layer: 'bus', q: bb.q }));
    var sm = null; DONG.forEach(function (d) { var sn = salesNow(d.name); if (sn && (!sm || sn.perH > sm.v)) sm = { d: d, v: sn.perH }; });
    if (sm) out.push('💳 매출 ' + go(sm.d.name, sm.d.c, { kind: 'dong', d: sm.d }));
    if (LIVEP.length) { var cnt = { '붐빔': 0, '약간 붐빔': 0 }, kind = null, hot = null; LIVEP.forEach(function (L) { var cw = crowdAt(L); if (!cw) return; kind = kind || cw.kind; if (cnt[cw.lvl] != null) { cnt[cw.lvl]++; if (!hot || cw.lvl === '붐빔') hot = L; } });
      out.push('📡 ' + (kind === 'old' ? '실시간 인파(' + esc(String((D.livep || {}).baked || '').slice(5)) + ' 받음)' : '인파 ' + (kind === 'fcst' ? '예측' : '지금')) + ' 붐빔 ' + cnt['붐빔'] + ' · 약간 ' + cnt['약간 붐빔'] + (hot ? ' ' + go(hot.o.name, hot.c, { kind: 'crowd', L: hot }) : '')); }
    el.innerHTML = '<b>' + h + '시</b> ' + out.join(' · ');
  }
  if ($('m2dSum')) $('m2dSum').addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; var t = SUMT[+b.getAttribute('data-s')]; if (!t) return;
    var k = t.it.kind === 'pub' ? t.it.layer : t.it.kind === 'crowd' ? 'crowd' : null; if (k && !on[k]) { on[k] = true; saveOn(); paintLayers(); paintPre(); }
    view.cx = t.p[0]; view.cy = t.p[1]; view.s = Math.max(view.s, 0.3); draw(); var s = S(t.p); sel = { x: s[0], y: s[1], r: 8, it: t.it }; show(t.it); draw(); });
  paintPre();
  // ---------- 📋 T-Book 보고 자리(v0.10.59 · 주소 #lat=..&lon=..) ----------
  //  T-Book 최초보고 「발생장소」 단추가 GPS 좌표를 해시로 넘긴다. 해시는 서버로 가지 않고, 이 좌표는 어디에도 저장하지 않는다.
  var REP = null;
  function accOf(n) { return D.acc && D.acc.nodes ? D.acc.nodes.filter(function (x) { return x.node[0] === n.i && x.node[1] === n.j; })[0] : null; }
  function nearestRealNode(p) { var best = null, bd = 1e9; NODES.forEach(function (n) { if (!n.real) return; var d = Math.hypot(n.p[0] - p[0], n.p[1] - p[1]); if (d < bd) { bd = d; best = n; } }); return best; }
  function repAround() {
    if (!REP) return '';
    var nc = D.cam ? D.cam.items.filter(function (c) { var q = P(c.lon, c.lat); return Math.hypot(q[0] - REP.p[0], q[1] - REP.p[1]) <= 300; }).length : 0;
    var er = null, ed2 = 1e9; (PUB ? PUB.er : []).forEach(function (q) { var d = Math.hypot(q.p[0] - REP.p[0], q.p[1] - REP.p[1]); if (d < ed2) { ed2 = d; er = q; } });
    return row('보고 자리 둘레', '300m 안 단속 카메라 ' + nc + '대' + (er ? ' · 가장 가까운 응급실 ' + esc(er.name.replace(/^학교법인가톨릭학원/, '')) + ' ' + (ed2 >= 1000 ? (ed2 / 1000).toFixed(1) + 'km' : Math.round(ed2) + 'm') + (er.o.ertel ? ' (' + esc(er.o.ertel) + ')' : '') : ''));
  }
  function applyHash() {
    var m = /[#&]lat=(-?[\d.]+)/.exec(location.hash), n = /[#&]lon=(-?[\d.]+)/.exec(location.hash);
    if (!m || !n) return false;
    var lat = +m[1], lon = +n[1];
    if (!isFinite(lat) || !isFinite(lon) || lat < 37.425 || lat > 37.525 || lon < 126.965 || lon > 127.075) return false;
    REP = { p: P(lon, lat) };
    view.s = Math.min(cv.clientWidth, cv.clientHeight) / (2 * 500); view.cx = REP.p[0]; view.cy = REP.p[1] + cv.clientHeight * 0.22 / view.s;   // 아래 카드에 가리지 않게 표시를 위쪽에   // 반경 약 500m
    if (on.bld && view.s > 0.12) loadBld();
    draw(); var s = S(REP.p); sel = { x: s[0], y: s[1], r: 12, it: { kind: 'report' } }; show({ kind: 'report' }); draw();
    return true;
  }
  window.addEventListener('hashchange', function () { if (hashLayers()) { paintLayers(); if (on.bld && view.s > 0.12) loadBld(); } if (Object.keys(D).length) { if (!applyHash()) draw(); } });
  function sigNow(s) {
    var d = new Date(), dk = String(d.getDay() + 1), pn = s.dow && s.dow[dk], rows = pn && s.plans && s.plans[pn], hm = ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2), cur = null;
    if (!rows || !rows.length) return '계획 없음';
    rows.forEach(function (r) { if (r[0] <= hm && r[1] > 0) cur = r; });
    if (!cur) cur = rows[rows.length - 1];
    return '주기 ' + cur[1] + '초 · ' + String(cur[3] || '').split(' ').filter(function (x) { return +x > 0; }).length + '현시 (' + esc(cur[0]) + ' 계획)';
  }
  function volRows(v) {
    var d = new Date(), dow = d.getDay(), arr = dow === 0 ? v.sun : dow === 6 ? v.sat : v.wd; if (!arr) return '';
    var h = d.getHours(), tot = arr.map(function (x) { return x[0] + x[1]; }), day = tot.reduce(function (a, b) { return a + b; }, 0), pk = tot.indexOf(Math.max.apply(null, tot));
    return row('지금 ' + h + '시', tot[h].toLocaleString() + '대/시(양방향)') + row('하루', day.toLocaleString() + '대 · 가장 붐비는 때 ' + pk + '시') + '<div class="cap">시간대(0~23시)</div>' + bar(tot, '#0ea5e9');
  }

  // ---------- 층 단추 · 찾기 ----------
  var lay = $('m2dLayers');
  function paintLayers() {
    lay.innerHTML = '<button data-all="1" class="all">☰ 모든 층 <b>' + LAYERS.filter(function (l) { return on[l[0]]; }).length + '</b></button>' +
      LAYERS.filter(function (l) { return l[4] || on[l[0]]; }).map(function (l) { return '<button data-k="' + l[0] + '" class="' + (on[l[0]] ? 'on' : '') + '">' + l[1] + '</button>'; }).join('');
    var pn = $('m2dPanel'); if (!pn) return;
    var G = []; LAYERS.forEach(function (l) { if (G.indexOf(l[3]) < 0) G.push(l[3]); });
    pn.innerHTML = '<div class="ph"><b>☰ 모든 층</b><button class="x" data-close="1">닫기</button></div>' + G.map(function (g) {
      return '<div class="pg"><div class="pgt">' + esc(g) + '</div>' + LAYERS.filter(function (l) { return l[3] === g; }).map(function (l) { return '<button data-k="' + l[0] + '" class="' + (on[l[0]] ? 'on' : '') + '">' + l[1] + '</button>'; }).join('') + '</div>';
    }).join('') + '<div class="pg"><button data-none="1">모두 끄기</button><button data-reset="1">처음대로</button></div>';
    paintPre();
  }
  function toggle(k) { on[k] = !on[k]; if (k === 'bld' && on[k]) loadBld(); saveOn(); paintLayers(); draw(); }
  function onLayerClick(e) {
    var b = e.target.closest('button'); if (!b) return; var pn = $('m2dPanel');
    if (b.getAttribute('data-all')) { pn.classList.toggle('on'); return; }
    if (b.getAttribute('data-close')) { pn.classList.remove('on'); return; }
    if (b.getAttribute('data-none')) { LAYERS.forEach(function (l) { on[l[0]] = false; }); on.dong = true; on.road = true; on.base = true; saveOn(); paintLayers(); draw(); return; }
    if (b.getAttribute('data-reset')) { LAYERS.forEach(function (l) { on[l[0]] = l[2]; }); saveOn(); paintLayers(); draw(); return; }
    var k = b.getAttribute('data-k'); if (k) toggle(k);
  }
  var pnEl = document.createElement('div'); pnEl.id = 'm2dPanel'; document.body.appendChild(pnEl);
  lay.addEventListener('click', onLayerClick); pnEl.addEventListener('click', onLayerClick);
  paintLayers();
  $('m2dFind').addEventListener('keydown', function (e) {
    if (e.key !== 'Enter') return;
    var q = this.value.trim(); if (!q) return;
    var c = [];
    DONG.forEach(function (d) { if (d.name.indexOf(q) >= 0) c.push({ p: d.c, it: { kind: 'dong', d: d } }); });
    NEAR.forEach(function (d) { if ((d.gu + ' ' + d.name).indexOf(q) >= 0) c.push({ p: d.c, it: { kind: 'near', d: d } }); });
    NODES.forEach(function (n) { if (n.name.indexOf(q) >= 0 || (n.sig && n.sig.name.indexOf(q) >= 0)) c.push({ p: n.p, it: { kind: 'node', n: n, st: D.acc && D.acc.nodes ? D.acc.nodes.filter(function (x) { return x.node[0] === n.i && x.node[1] === n.j; })[0] : null } }); });
    if (D.her) D.her.items.forEach(function (h) { if (h.name.indexOf(q) >= 0 && h.lat) c.push({ p: P(h.lon, h.lat), it: { kind: 'her', h: h } }); });
    if (D.sig) D.sig.spots.forEach(function (s) { if (s.name.indexOf(q) >= 0) c.push({ p: P(s.lon, s.lat), it: { kind: 'sig', s: s } }); });
    TG.forEach(function (t) { if (t.name.indexOf(q) >= 0 || String(t.c) === q) c.push({ p: t.p, it: { kind: 'tgis', t: t }, k: 'tgis' }); });
    SPOTS.forEach(function (s2) { if (s2.name.indexOf(q) >= 0) { var rk = spotRank().indexOf(s2) + 1; c.push({ p: s2.p, it: { kind: 'spot', q: s2, rank: rk }, k: 'spot' }); } });
    LIVEP.forEach(function (L) { if (L.o.name.indexOf(q) >= 0) c.push({ p: L.c, it: { kind: 'crowd', L: L }, k: 'crowd' }); });
    OSMN.filter(function (r) { return r.name.indexOf(q) >= 0; }).sort(function (a, b) { return (a.name === q ? 0 : 1) - (b.name === q ? 0 : 1) || a.name.length - b.name.length; }).forEach(function (r) { if (r.name.indexOf(q) >= 0 && !c.some(function (x) { return x.rn === r.name; })) c.push({ p: r.p, it: { kind: 'osmroad', r: r }, rn: r.name }); });
    if (PUB) { ['er', 'hosp', 'phar', 'heat', 'cold', 'bus', 'subr', 'bike', 'sigx', 'drunk'].forEach(function (k) { PUB[k].forEach(function (x) { if ((x.name || '').indexOf(q) >= 0 || (k === 'sigx' && x.o.no === q)) c.push({ p: x.p, it: { kind: 'pub', layer: k, q: x }, k: k }); }); });
      Object.keys(PUB.fac).forEach(function (k) { PUB.fac[k].forEach(function (x) { if (x.name && x.name.indexOf(q) >= 0) c.push({ p: x.p, it: { kind: 'pub', layer: k, q: x }, k: k }); }); }); }
    if (c.length && c[0].k && !on[c[0].k]) { on[c[0].k] = true; saveOn(); paintLayers(); }
    if (!c.length) { $('m2dFindMsg').textContent = '「' + q + '」 — 이 지도 자료에 없다'; return; }
    $('m2dFindMsg').textContent = c.length > 1 ? c.length + '곳 중 첫째' : '';
    view.cx = c[0].p[0]; view.cy = c[0].p[1]; view.s = Math.max(view.s, 0.35); draw();
    var s = S(c[0].p); sel = { x: s[0], y: s[1], r: 8, it: c[0].it }; show(c[0].it); draw();
  });
  // 시계(행사·집회·신호·교통량이 「지금」을 본다)
  function clock() { var d = new Date(); $('m2dNow').textContent = (d.getMonth() + 1) + '월 ' + d.getDate() + '일(' + '일월화수목금토'[d.getDay()] + ') ' + ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2); }
  clock(); setInterval(function () { clock(); if (HOUR == null) { summary(); } }, 30000);
  function ymdOf(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function pickDate() { var v = $('m2dDate') && $('m2dDate').value; return v || ymdOf(new Date()); }
  if ($('m2dDate')) { $('m2dDate').value = ymdOf(new Date()); $('m2dDate').addEventListener('change', function () { sel = null; show(null); draw(); paintTime(); summary(); }); }
  try { var mq = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)'); if (mq && mq.matches) document.documentElement.classList.add('dark'); } catch (e) {}
  window.TGMap2D = { osm: function () { return OSM; }, flow: function () { return FLOW; }, livep: function () { return LIVEP; }, setHour: setHour, preset: preset, PRESETS: PRESETS, summary: summary, salesNow: salesNow, crowdAt: crowdAt, nowH: function () { return nowH(); }, hashLayers: hashLayers, hour: spotHour, jur: function () { return JUR; }, tgis: function () { return TG; }, spots: function () { return SPOTS; }, saving: function () { return !HASHLY; }, report: function () { return REP; }, applyHash: applyHash, hits: function () { return hit; }, pub: function () { return PUB; }, openNow: openNow, liveNow: liveNow, layers: LAYERS, view: view, nodes: function () { return NODES; }, dongs: function () { return DONG; }, draw: draw, tap: tap, on: on, S: S, P: P };   // 검사·다른 페이지가 읽는 창구
})();
