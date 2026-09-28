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
    ['dong', '🏘 행정동', true, '기본', 1], ['road', '🛣 도로', true, '기본', 1], ['bld', '🏢 건물', false, '기본', 0], ['sub', '🚇 지하철역', true, '기본', 0], ['exit', '🚪 지하철 출입구', false, '기본', 0],
    ['acc', '🚗 교차로 사고', true, '교통안전', 1], ['fatal', '🕯 사망사고', false, '교통안전', 0], ['hot', '⚠ 사고다발지', false, '교통안전', 0], ['drunk', '🍺 음주 사고 다발지', false, '교통안전', 1],
    ['risk', '🟥 사고위험지역', false, '교통안전', 0], ['cam', '📷 단속 카메라', false, '교통안전', 0], ['sig', '🚦 신호 주기', false, '교통안전', 0], ['sigx', '🔢 신호 교차로 번호', false, '교통안전', 0],
    ['live', '👥 생활인구(지금)', false, '사람·흐름', 1], ['bus', '🚌 버스 승하차', false, '사람·흐름', 0], ['subr', '🚇 지하철 승하차', false, '사람·흐름', 0], ['vol', '🚙 교통량', false, '사람·흐름', 0], ['bike', '🚲 따릉이', false, '사람·흐름', 0],
    ['pol', '👮 경찰 관서', false, '치안·안전', 1], ['fire', '🚒 소방', false, '치안·안전', 0], ['er', '🏥 응급실', false, '치안·안전', 1], ['hosp', '🩺 병원·의원', false, '치안·안전', 0], ['phar', '💊 약국', false, '치안·안전', 1],
    ['heat', '🥵 무더위쉼터', false, '치안·안전', 0], ['cold', '🥶 한파쉼터', false, '치안·안전', 0], ['hyd', '🧯 소화전', false, '치안·안전', 0], ['wc', '🚻 화장실', false, '치안·안전', 0],
    ['school', '🏫 학교', false, '생활', 0], ['kids', '🧸 유치원·어린이집', false, '생활', 0], ['play', '🛝 놀이터', false, '생활', 0], ['park', '🌳 공원', false, '생활', 0], ['welf', '🧓 복지시설', false, '생활', 0],
    ['gov', '🏢 관공서·주민센터', false, '생활', 0], ['lib', '📚 도서관', false, '생활', 0], ['post', '📮 우체국', false, '생활', 0], ['bank', '🏦 은행·ATM', false, '생활', 0], ['conv', '🏪 편의점', false, '생활', 0],
    ['fuel', '⛽ 주유소', false, '생활', 0], ['ev', '🔌 전기차 충전', false, '생활', 0], ['pk', '🅿 주차장', false, '생활', 0],
    ['evt', '📅 행사·집회', true, '행사·역사', 1], ['her', '🏛 국가유산', false, '행사·역사', 0]
  ];
  // OSM 시설 갈래 → 층 키
  var FAC_K = { '경찰': 'pol', '소방': 'fire', '소화전': 'hyd', '화장실': 'wc', '학교': 'school', '유치원·어린이집': 'kids', '놀이터': 'play', '공원': 'park', '복지시설': 'welf', '관공서·주민센터': 'gov', '도서관': 'lib',
    '우체국': 'post', '은행·ATM': 'bank', '편의점': 'conv', '주유소': 'fuel', '전기차 충전': 'ev', '주차장': 'pk', '지하철 출입구': 'exit', '병원': null, '의원': null, '약국': null };
  var FAC_C = { pol: '#1d4ed8', fire: '#dc2626', hyd: '#ef4444', wc: '#0891b2', school: '#ca8a04', kids: '#f59e0b', play: '#84cc16', park: '#16a34a', welf: '#a855f7', gov: '#475569', lib: '#7c3aed',
    post: '#e11d48', bank: '#0f766e', conv: '#64748b', fuel: '#b45309', ev: '#059669', pk: '#2563eb', exit: '#0ea5e9' };
  var on = {}; LAYERS.forEach(function (l) { on[l[0]] = l[2]; });
  try { var sv = JSON.parse(localStorage.getItem('tg_map2d') || 'null'); if (sv && sv.on) Object.keys(sv.on).forEach(function (k) { if (k in on) on[k] = !!sv.on[k]; }); } catch (e) {}
  function saveOn() { try { localStorage.setItem('tg_map2d', JSON.stringify({ on: on })); } catch (e) {} }

  // ---------- 자료 읽기 ----------
  var FILES = { dong: 'data/dong-seocho.json', pop: 'data/pop-seocho.json', roads: 'data/maps/seocho-full-roads.json', full: 'data/maps/seocho-full.json',
    base: 'data/maps/seocho.json', gu: 'data/maps/seoul-districts.json', acc: 'data/taas-nodes-seocho.json', fatal: 'data/taas-fatal-seocho.json', hot: 'data/taas.json',
    cam: 'data/cameras-seocho.json', sig: 'data/signal-tod-seocho.json', evt: 'data/events-seocho.json', vol: 'data/traffic-vol-seocho.json', her: 'data/heritage-seocho.json',
    near: 'data/dong-near.json', xing: 'data/intersections-seocho.json', pub: 'data/pubdata-seocho.json' };
  function get(k) { return fetch(FILES[k]).then(function (r) { return r.json(); }).then(function (j) { D[k] = j; }).catch(function () { D[k] = null; }); }
  Promise.all(Object.keys(FILES).map(get)).then(function () { prep(); pubPrep(); fit(); draw(); applyHash(); $('m2dLoad').style.display = 'none'; });
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
    ctx.fillStyle = dark ? '#0f1624' : '#eef2f6'; ctx.fillRect(0, 0, W, H);
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
        else if (on.dong) { ctx.fillStyle = dark ? 'rgba(90,120,170,' + (sel && sel.it.kind === 'dong' && sel.it.d === d ? '.45' : '.18') + ')' : (sel && sel.it.kind === 'dong' && sel.it.d === d ? '#fde68a' : PAL[k % PAL.length]); ctx.fill('evenodd'); }
        ctx.lineWidth = on.dong ? 1.6 : 0.8; ctx.strokeStyle = dark ? 'rgba(160,190,230,.6)' : 'rgba(40,60,90,.45)'; ctx.stroke(); });
    });
    // 구 경계(서초·동작·관악·강남)
    GU.forEach(function (g) { path(g.pts); ctx.lineWidth = 2.4; ctx.setLineDash([8, 5]); ctx.strokeStyle = dark ? '#9fb3d1' : '#475569'; ctx.stroke(); ctx.setLineDash([]); });
    // 건물
    if (on.bld && BLD.length && view.s > 0.12) BLD.forEach(function (b) { path(b.p); ctx.closePath(); ctx.fillStyle = dark ? 'rgba(200,210,225,.28)' : 'rgba(90,100,115,.30)'; ctx.fill(); });
    // 도로(OSM 간선 10개)
    if (on.road) ROADS.forEach(function (r) { path(r.pts); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(3, 26 * view.s); ctx.strokeStyle = dark ? '#3b4a63' : '#ffffff'; ctx.stroke(); ctx.lineWidth = Math.max(1, 3 * view.s); ctx.strokeStyle = dark ? '#8aa0c0' : '#f59e0b'; ctx.stroke(); });
    if (on.road && view.s > 0.08) ROADS.forEach(function (r) { var q = r.pts[Math.floor(r.pts.length * 0.3)]; if (q) label(q, r.name, 12, dark ? '#e2e8f0' : '#334155', dark ? 'rgba(15,22,36,.7)' : 'rgba(255,255,255,.8)'); });
    if (on.dong && view.s > 0.09) NEAR.forEach(function (d) { label(d.c, d.name, 11, dark ? '#94a3b8' : '#64748b'); if (view.s > 0.16) label([d.c[0], d.c[1] + 14 / view.s], d.gu, 10, dark ? '#64748b' : '#94a3b8'); });
    // 동 이름
    if (on.dong) DONG.forEach(function (d) { label(d.c, d.name, view.s > 0.2 ? 14 : 12, dark ? '#dbe6f5' : '#1e293b'); var lv2 = on.live ? liveNow(d.name) : null; if (lv2 && view.s > 0.06) label([d.c[0], d.c[1] + 16 / view.s], '지금 ' + lv2.n.toLocaleString() + '명', 11, dark ? '#fde68a' : '#7c2d12'); else if (d.pop && view.s > 0.14) label([d.c[0], d.c[1] + 16 / view.s], d.pop.tot.toLocaleString() + '명', 11, dark ? '#94a3b8' : '#475569'); });
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
    if (on.cam && D.cam) D.cam.items.forEach(function (c) { dot(P(c.lon, c.lat), 4.5, '#2563eb', '#fff', { kind: 'cam', c: c }); });
    if (on.sig && D.sig) D.sig.spots.forEach(function (s) { dot(P(s.lon, s.lat), 5, '#16a34a', '#fff', { kind: 'sig', s: s }); });
    if (on.sub && F2) (F2.subways || []).forEach(function (s) { var n = nodeAt([s.i, s.j]); if (!n) return; var q = [n.p[0] + (s.side || 1) * 26, n.p[1] + 26], ls = s.lines || [];
      ls.forEach(function (l, k) { dot([q[0] + k * 13 / view.s, q[1]], 6, LINE_C[l] || '#64748b', '#fff', k ? null : { kind: 'sub', s: s, n: n }); });
      if (view.s > 0.1) label([q[0], q[1] + 16 / view.s], s.name, 11, dark ? '#e2e8f0' : '#334155', dark ? 'rgba(15,22,36,.7)' : 'rgba(255,255,255,.85)'); });
    if (on.her && D.her) D.her.items.forEach(function (h) { if (h.lat && h.lon) dot(P(h.lon, h.lat), 5, '#92400e', '#fde68a', { kind: 'her', h: h }); });
    if (on.vol && D.vol) D.vol.spots.forEach(function (v) { var n = v.node && nodeAt(v.node); if (n && !v.outside) { var s2 = S(n.p); ctx.fillStyle = '#0ea5e9'; ctx.fillRect(s2[0] + 8, s2[1] - 8, 16, 16); hit.push({ x: s2[0] + 16, y: s2[1], r: 12, it: { kind: 'vol', v: v, n: n } }); } });
    drawPub(dark);
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
      var d = it.d, p = d.pop; h = '<h3>🏘 ' + esc(d.name) + '</h3>';
      if (p) { h += row('주민', p.tot.toLocaleString() + '명'); h += row('19세 이하', Math.round((p.age[0] + p.age[1]) / p.tot * 100) + '%') + row('70세 이상', Math.round((p.age[7] + p.age[8] + p.age[9]) / p.tot * 100) + '%');
        h += '<div class="cap">연령대(0~9 … 90~99세)</div>' + bar(p.age, '#8b5cf6'); }
      var lv = liveNow(d.name);
      if (lv) { h += row('생활인구 지금', lv.n.toLocaleString() + '명 <em>(' + (lv.we ? '주말' : '평일') + ' ' + lv.h + '시 평균)</em>') + row('하루 폭', Math.min.apply(null, lv.arr).toLocaleString() + ' ~ ' + Math.max.apply(null, lv.arr).toLocaleString() + '명') +
        '<div class="cap">생활인구 시간대(0~23시 · ' + (lv.we ? '주말' : '평일') + ')</div>' + bar(lv.arr, '#f97316'); }
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
    var dt = new Date(pickDate() + 'T00:00'), we = dt.getDay() === 0 || dt.getDay() === 6, h = new Date().getHours(), key = we ? 'we' : 'wd', max = 0;
    Object.keys(L).forEach(function (k) { max = Math.max(max, L[k][key][h]); });
    return { n: L[name][key][h], max: max, we: we, h: h, arr: L[name][key], other: L[name][we ? 'wd' : 'we'] };
  }
  function ring(pts, fill, stroke) { if (!pts || pts.length < 3) return; path(pts); ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = stroke; ctx.stroke(); }
  function drawPub(dark) {
    if (!PUB) return;
    if (on.risk) PUB.risk.forEach(function (q) { ring(q.ring, 'rgba(220,38,38,.18)', '#b91c1c'); dot(q.p, 5, '#b91c1c', '#fff', { kind: 'pub', layer: 'risk', q: q }); });
    if (on.drunk) PUB.drunk.forEach(function (q) { ring(q.ring, 'rgba(168,85,247,.18)', '#7e22ce'); dot(q.p, 6, '#7e22ce', '#fff', { kind: 'pub', layer: 'drunk', q: q }); });
    if (on.sigx && view.s > 0.12) PUB.sigx.forEach(function (q) { var s = S(q.p); ctx.fillStyle = dark ? '#94a3b8' : '#334155'; ctx.fillRect(s[0] - 3, s[1] - 3, 6, 6); hit.push({ x: s[0], y: s[1], r: 7, it: { kind: 'pub', layer: 'sigx', q: q } });
      if (view.s > 0.45) label([q.p[0], q.p[1] + 12 / view.s], q.o.no, 10, dark ? '#cbd5e1' : '#334155', dark ? 'rgba(15,22,36,.7)' : 'rgba(255,255,255,.8)'); });
    if (on.bus && view.s > 0.07) PUB.bus.forEach(function (q) { if (view.s < 0.14 && q.o.day < 2000) return; dot(q.p, 2.5 + Math.sqrt(q.o.day) / 18, 'rgba(22,163,74,.55)', '#166534', { kind: 'pub', layer: 'bus', q: q }); });
    if (on.subr) PUB.subr.forEach(function (q) { dot(q.p, 4 + Math.sqrt(q.o.on + q.o.off) / 22, 'rgba(14,165,233,.45)', '#075985', { kind: 'pub', layer: 'subr', q: q }); });
    if (on.bike && view.s > 0.1) PUB.bike.forEach(function (q) { dot(q.p, 3.5, '#16a34a', '#fff', { kind: 'pub', layer: 'bike', q: q }); });
    Object.keys(PUB.fac).forEach(function (k) { if (!on[k]) return; var small = PUB.fac[k].length > 80 && view.s < 0.1; PUB.fac[k].forEach(function (q) { dot(q.p, small ? 2.5 : 4.5, FAC_C[k] || '#64748b', small ? null : '#fff', small ? null : { kind: 'pub', layer: k, q: q }); }); });
    if (on.hosp && view.s > 0.1) PUB.hosp.forEach(function (q) { if (q.o.er) return; dot(q.p, 3.5, '#0891b2', '#fff', { kind: 'pub', layer: 'hosp', q: q }); });
    if (on.er) PUB.er.forEach(function (q) { dot(q.p, 8, '#dc2626', '#fff', { kind: 'pub', layer: 'er', q: q }); if (view.s > 0.08) label([q.p[0], q.p[1] - 16 / view.s], q.name, 11, dark ? '#fecaca' : '#7f1d1d', dark ? 'rgba(15,22,36,.75)' : 'rgba(255,255,255,.85)'); });
    if (on.phar) PUB.phar.forEach(function (q) { var op = openNow(q.o.h); dot(q.p, 4.5, op ? '#16a34a' : '#94a3b8', '#fff', { kind: 'pub', layer: 'phar', q: q }); });
    if (on.heat) PUB.heat.forEach(function (q) { dot(q.p, 4.5, '#f97316', '#fff', { kind: 'pub', layer: 'heat', q: q }); });
    if (on.cold) PUB.cold.forEach(function (q) { dot(q.p, 4.5, '#38bdf8', '#fff', { kind: 'pub', layer: 'cold', q: q }); });
  }
  var PUB_T = { risk: '🟥 사고위험지역', drunk: '🍺 음주 사고 다발지', sigx: '🔢 신호 교차로', bus: '🚌 버스 정류장', subr: '🚇 지하철 승하차', bike: '🚲 따릉이 대여소', hosp: '🩺 병원·의원', er: '🏥 응급실', phar: '💊 약국', heat: '🥵 무더위쉼터', cold: '🥶 한파쉼터' };
  function pubCard(it) {
    var q = it.q, o = q.o || {}, k = it.layer, p = D.pub || {}, h = '<h3>' + esc((PUB_T[k] || (LAYERS.filter(function (l) { return l[0] === k; })[0] || [0, '📍'])[1]) + ' · ' + (q.name || '(이름 없음)')) + '</h3>', s = '';
    if (k === 'risk') { h += row('사고', o.acc + '건 · 사망 ' + o.dead + ' · 중상 ' + o.ser + ' · 경상 ' + o.sli) + row('주된 원인', esc([].concat(o.cause || []).join(' · ') || '-')) + '<p class="desc">' + esc(q.name) + '</p>'; s = p.risk && p.risk.source; }
    else if (k === 'drunk') { h += row('사고', o.acc + '건 · 사상 ' + o.caslt + '(사망 ' + o.dead + ' · 중상 ' + o.ser + ' · 경상 ' + o.sli + ')') + (o.year ? row('자료 해', o.year + '년 공표') : '') + '<p class="desc">음주 단속·순찰 동선을 잡을 때 참고 — 이 구역 둘레(다각형)에서 음주 사고가 몰렸다.</p>'; s = p.drunk && p.drunk.source; }
    else if (k === 'sigx') { h += row('신호 교차로 번호', esc(o.no)) + (/연등/.test(q.name) ? row('종류', '연동 보조 신호') : ''); s = p.sigx && p.sigx.source; }
    else if (k === 'bus') { h += row('하루 승하차', o.day.toLocaleString() + '명') + row('가장 붐비는 때', o.peak + '시') + '<div class="cap">시간대(0~23시 · 승차+하차)</div>' + bar(o.h, '#16a34a'); s = p.bus && p.bus.source; }
    else if (k === 'subr') { h += row('노선', esc((o.lines || []).join(' · '))) + row('하루 승차', o.on.toLocaleString() + '명') + row('하루 하차', o.off.toLocaleString() + '명'); s = p.subway && p.subway.source; }
    else if (k === 'bike') { h += row('대여소 번호', esc(o.no)) + row('거치대', o.n + '대'); s = p.seoul && p.seoul.source; }
    else if (k === 'hosp' || k === 'er') { var op = openNow(o.h); h += row('종류', esc((o.div || '') + (o.er ? ' · 응급실 운영' : ''))) + (o.emcls && !/이외/.test(o.emcls) ? row('응급 등급', esc(o.emcls)) : '') + row('전화', esc(o.tel || '-')) + (o.ertel ? row('응급실 전화', esc(o.ertel)) : '') +
        row('지금', o.er ? '응급실 24시간(등록값)' : (op === null ? '시간 정보 없음' : op ? '<b style="color:#16a34a">진료 중</b>' : '진료 시간 아님')) + row('주소', esc(o.addr || '-')) + '<div class="cap">' + esc(hoursTxt(o.h)) + '</div>'; s = p.seoul && p.seoul.source; }
    else if (k === 'phar') { var op2 = openNow(o.h); h += row('지금', op2 === null ? '시간 정보 없음' : op2 ? '<b style="color:#16a34a">영업 중</b>' : '닫음') + row('전화', esc(o.tel || '-')) + row('주소', esc(o.addr || '-')) + '<div class="cap">' + esc(hoursTxt(o.h)) + '</div>'; s = p.seoul && p.seoul.source; }
    else if (k === 'heat' || k === 'cold') { h += row('시설', esc(o.type || '-')) + (o.days ? row('여는 날', esc(o.days)) : '') + (o.time && o.time !== '~' ? row('시간', esc(o.time)) : '') + (o.cap ? row('수용', o.cap + '명') : '') + row('주소', esc(o.addr || '-')) + (o.note ? '<p class="desc">' + esc(o.note) + '</p>' : ''); s = p.seoul && p.seoul.source; }
    else { h += row('갈래', esc(q.cat || '')) + (q.ref ? row('출구', esc(q.ref)) : '') + (k === 'pol' ? '<p class="desc">⚠ 경찰 관서는 OpenStreetMap 표기 그대로다 — 같은 곳이 둘 있거나 이름이 틀린 것이 섞여 있다(공식 목록 대조 전).</p>' : ''); s = p.fac && p.fac.source; }
    return h + src(s || '');
  }
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
  window.addEventListener('hashchange', function () { if (Object.keys(D).length) applyHash(); });
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
  }
  function toggle(k) { on[k] = !on[k]; if (k === 'bld' && on[k]) loadBld(); saveOn(); paintLayers(); draw(); }
  function onLayerClick(e) {
    var b = e.target.closest('button'); if (!b) return; var pn = $('m2dPanel');
    if (b.getAttribute('data-all')) { pn.classList.toggle('on'); return; }
    if (b.getAttribute('data-close')) { pn.classList.remove('on'); return; }
    if (b.getAttribute('data-none')) { LAYERS.forEach(function (l) { on[l[0]] = false; }); on.dong = true; on.road = true; saveOn(); paintLayers(); draw(); return; }
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
  clock(); setInterval(function () { clock(); }, 30000);
  function ymdOf(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function pickDate() { var v = $('m2dDate') && $('m2dDate').value; return v || ymdOf(new Date()); }
  if ($('m2dDate')) { $('m2dDate').value = ymdOf(new Date()); $('m2dDate').addEventListener('change', function () { sel = null; show(null); draw(); }); }
  try { var mq = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)'); if (mq && mq.matches) document.documentElement.classList.add('dark'); } catch (e) {}
  window.TGMap2D = { report: function () { return REP; }, applyHash: applyHash, hits: function () { return hit; }, pub: function () { return PUB; }, openNow: openNow, liveNow: liveNow, layers: LAYERS, view: view, nodes: function () { return NODES; }, dongs: function () { return DONG; }, draw: draw, tap: tap, on: on, S: S, P: P };   // 검사·다른 페이지가 읽는 창구
})();
