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
    ['acc', '🚗 교차로 사고(2019~)', true, '교통안전', 1], ['acc10', '🚗 사고 10년(100m 칸)', false, '교통안전', 1], ['fatal10', '🕯 사망사고 10년', false, '교통안전', 0], ['fatal', '🕯 사망사고', false, '교통안전', 0], ['hot', '⚠ 사고다발지', false, '교통안전', 0], ['drunk', '🍺 음주 사고 다발지', false, '교통안전', 1],
    ['risk', '🟥 사고위험지역', false, '교통안전', 0], ['sz', '🏫 어린이보호구역', false, '교통안전', 1], ['szh', '🧒 보호구역 어린이 사고', false, '교통안전', 0], ['cam', '📷 단속 카메라', false, '교통안전', 0], ['spd', '🚥 도로 소통(받은 때)', false, '교통안전', 0], ['sig', '🚦 신호 주기', false, '교통안전', 0], ['sigx', '🔢 신호 교차로 번호', false, '교통안전', 0],
    ['trd', '🏪 상권분석(카드·유동·점포)', false, '사람·흐름', 1], ['rent', '💰 상가 임대료·공실률', false, '사람·흐름', 0], ['crowd', '📡 실시간 인파·카드', false, '사람·흐름', 1], ['live', '👥 생활인구(지금)', false, '사람·흐름', 1], ['sales', '💳 카드 매출(시간대)', false, '사람·흐름', 1], ['bus', '🚌 버스 승차·하차', false, '사람·흐름', 1], ['subr', '🚇 지하철 승차·하차', false, '사람·흐름', 0], ['vol', '🚙 교통량', false, '사람·흐름', 0], ['bike', '🚲 따릉이', false, '사람·흐름', 0],
    ['pol', '👮 경찰 관서', false, '치안·안전', 1], ['fire', '🚒 소방', false, '치안·안전', 0], ['er', '🏥 응급실', false, '치안·안전', 1], ['hosp', '🩺 병원·의원', false, '치안·안전', 0], ['phar', '💊 약국', false, '치안·안전', 1],
    ['bar', '🍺 주점(밤 순찰)', false, '치안·안전', 0], ['play', '🎤 노래방·PC방', false, '치안·안전', 0], ['inn', '🏨 숙박', false, '치안·안전', 0], ['heat', '🥵 무더위쉼터', false, '치안·안전', 0], ['cold', '🥶 한파쉼터', false, '치안·안전', 0], ['hyd', '🧯 소화전', false, '치안·안전', 0], ['wc', '🚻 화장실', false, '치안·안전', 0],
    ['school', '🏫 학교', false, '생활', 0], ['kids', '🧸 유치원·어린이집', false, '생활', 0], ['pg', '🛝 놀이터', false, '생활', 0], ['park', '🌳 공원', false, '생활', 0], ['welf', '🧓 복지시설', false, '생활', 0],
    ['gov', '🏢 관공서·주민센터', false, '생활', 0], ['lib', '📚 도서관', false, '생활', 0], ['post', '📮 우체국', false, '생활', 0], ['bank', '🏦 은행·ATM', false, '생활', 0], ['conv', '🏪 편의점', false, '생활', 0],
    ['fuel', '⛽ 주유소', false, '생활', 0], ['ev', '🔌 전기차 충전', false, '생활', 0], ['pk', '🅿 주차장', false, '생활', 0],
    ['jur', '🚓 경찰서 관할(서초·방배)', false, '치안·안전', 0], ['srcctv', '📹 CCTV(안심귀갓길)', false, '치안·안전', 0], ['srbell', '🔔 안심벨', false, '치안·안전', 0], ['srlamp', '💡 보안등(안심귀갓길)', false, '치안·안전', 0], ['sr112', '🆘 112 위치 신고 안내', false, '치안·안전', 0], ['srsvc', '🏪 안심 서비스·지킴이집', false, '치안·안전', 0],
    ['aed', '❤️ AED', false, '치안·안전', 0], ['fw', '🧯 소방용수(서울시)', false, '치안·안전', 0], ['pkcctv', '📸 불법주정차 단속 CCTV', false, '교통안전', 0], ['tow', '🛻 견인차량보관소', false, '교통안전', 0], ['wc2', '🚻 공중화장실(서울시)', false, '생활', 0], ['box', '📦 안심택배함', false, '생활', 0], ['dem', '🧠 치매안심센터', false, '치안·안전', 0], ['tgis', '🚥 T-GIS 신호 교차로', false, '교통안전', 0], ['spot', '🎯 길목 — 이 시각 하차', false, '사람·흐름', 0], ['spota', '🗂 길목 다발지(참고)', false, '교통안전', 0], ['hot10', '🗂 다발지 10년(2016~2025)', false, '교통안전', 1],
    ['evt', '📅 행사·집회', true, '행사·역사', 1], ['her', '🏛 국가유산', false, '행사·역사', 0],
    ['flt', '🌊 침수 흔적(2010~2025)', false, '계절 위험', 0], ['flr', '🌧 침수 이력 도로', false, '계절 위험', 0], ['und', '🚇 지하차도(침수 이력)', false, '계절 위험', 0],
    ['ice', '🧊 제설함(결빙 우려 자리)', false, '계절 위험', 0], ['hcab', '🔥 도로 열선 길', false, '계절 위험', 0], ['advb', '❄ 제설 전진기지', false, '계절 위험', 0],
    ['pbtn', '🚸 보행자작동신호기', false, '교통안전', 0]
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
  var FILES = { ridx: 'data/r/index.json', pstat: 'data/police-stats.json', season: 'data/season-seocho.json', pbtn: 'data/pedbtn-seocho.json', enf: 'data/enforce-seocho.json', dong: 'data/dong-seocho.json', pop: 'data/pop-seocho.json', roads: 'data/maps/seocho-full-roads.json', full: 'data/maps/seocho-full.json',
    base: 'data/maps/seocho.json', gu: 'data/maps/seoul-districts.json', acc: 'data/taas-nodes-seocho.json', fatal: 'data/taas-fatal-seocho.json', hot: 'data/taas.json',
    cam: 'data/cameras-seocho.json', sig: 'data/signal-tod-seocho.json', evt: 'data/events-seocho.json', vol: 'data/traffic-vol-seocho.json', her: 'data/heritage-seocho.json',
    near: 'data/dong-near.json', xing: 'data/intersections-seocho.json', pub: 'data/pubdata-seocho.json', police: 'data/police-seocho.json', sz: 'data/schoolzone-seocho.json', st: 'data/stores-seocho.json',
    jur: 'data/jur-seocho.json', tgis: 'data/tgis-seocho.json', spot: 'data/spot-seocho.json',
    bidx: 'data/base/index.json', ov: 'data/base/ov.json', sgg: 'data/base/sgg.json', flow: 'data/flow-seocho.json', livep: 'data/live-seocho.json', trend: 'data/trend-seocho.json', hot10: 'data/hot10-seocho.json', trdar: 'data/trdar-seocho.json', safety: 'data/safety-seocho.json', taas10: 'data/taas10-seocho.json' };
  function get(k) { return fetch(FILES[k]).then(function (r) { return r.json(); }).then(function (j) { D[k] = j; }).catch(function () { D[k] = null; }); }
  var LATE = ['livep', 'trend', 'hot10', 'trdar', 'safety', 'taas10', 'enf', 'season', 'pbtn', 'pstat'];   // v0.10.80 무거운 자료(상권·안전시설·사고 10년·추이)는 첫 그림 뒤에 읽는다 — 지도가 먼저 뜬다
  Promise.all(Object.keys(FILES).filter(function (k) { return LATE.indexOf(k) < 0; }).map(get)).then(function () { setTimeout(gpsHere, 0); prep(); pubPrep(); extraPrep(); basePrep(); sggPrep(); flowPrep(); fit(); if (on.bld && view.s > 0.12) loadBld(); draw(); applyHash(); $('m2dLoad').style.display = 'none'; paintTime(); summary();
    Promise.all(LATE.map(get)).then(function () { livePrep(); trdPrep(); safePrep(); a10Prep(); seasonPrep(); paintPre(); summary(); draw(); if (sel && $('m2dCard').classList.contains('on')) show(sel.it); }); });
  function loadBld() {   // 건물 593KB — 켤 때만
    if (D.bld !== undefined) return;
    D.bld = null; fetch('data/maps/seocho-full-buildings.json').then(function (r) { return r.json(); }).then(function (j) { D.bld = j; prepBld(); draw(); }).catch(function () {});
  }

  // ---------- 준비: 모든 자료를 평면 m 로 ----------
  var NEAR = [], DONG = [], ROADS = [], NODES = [], GU = [], BLD = [];
  // ---------- v0.10.91 서울 25개 구 행정동(지역 자료 · data/r/<구 5자리>/dong.json) — 화면에 걸린 구만 받는다 · 서초구는 기존 서초 자료가 우선 ----------
  // 동 열쇠는 행정동 코드 8자리(이름은 구가 달라도 겹친다 — 신사동 · 강남/관악). 업종 줄·분기 추이(dongx)는 카드를 열 때만 받는다.
  var RDONG = [], RGUN = {}, RLOAD = {}, RX = {}, LMX = {}, SMX = {}, RWANT = null, RLOADT = {}, TWANT = null;
  function rIdx() { return D.ridx && D.ridx.gus || []; }
  function viewLL() { var a = M(0, 0), b = M(cv.clientWidth, cv.clientHeight); return [a[0] / KX + LON0, LAT0 - b[1] / KY, b[0] / KX + LON0, LAT0 - a[1] / KY]; }
  // v0.10.95 단속 카메라 · 어린이보호구역 · 생활안전 시설(구마다 safety.json) — 서초는 기존 서초 파일이 우선(서초 구 파일은 안 받는다)
  var RLOADS = {}, SAFE_KEYS = ['cam', 'sz', 'srbell', 'srcctv', 'srlamp', 'sr112', 'srsvc', 'aed', 'fw', 'tow', 'wc2', 'box', 'dem'];
  function sfLoad(gu) {
    if (RLOADS[gu]) return RLOADS[gu]; if (gu === '11650') return (RLOADS[gu] = Promise.resolve()); if (!SAFE.length) return Promise.resolve();   // 서초 안전 파일(늦게 읽음)이 칸을 만든 뒤에
    RLOADS[gu] = fetch('data/r/' + gu + '/safety.json').then(function (r) { if (!r.ok) throw 0; return r.json(); }).then(function (j) {
      var key = function (a, b) { return a + '|' + b; };
      if (!D.cam) D.cam = { items: [], source: j.source.cam }; var hc = {}; D.cam.items.forEach(function (c) { hc[key(c.lat, c.lon)] = 1; }); j.cam.forEach(function (c) { if (!hc[key(c.lat, c.lon)]) D.cam.items.push(c); });
      if (!D.sz) D.sz = { zones: [], hot: [], source: { zones: j.source.sz } }; var hz = {}; D.sz.zones.forEach(function (z) { hz[key(z.name, z.lat)] = 1; }); j.sz.forEach(function (z) { if (!hz[key(z.name, z.lat)]) D.sz.zones.push(z); });
      var I = j.items || {}, add = function (k, arr) { var L = SAFE.filter(function (x) { return x[0] === k; })[0]; if (!L || !arr) return; var hs = {}; L[3].forEach(function (q) { hs[key(q.r[0], q.r[1])] = 1; }); arr.forEach(function (r) { if (r[0] && r[1] && !hs[key(r[0], r[1])]) L[3].push({ p: P(r[1], r[0]), r: r }); }); };
      var it = I.srItem || []; add('srbell', it.filter(function (r) { return r[2] === '301'; })); add('srcctv', it.filter(function (r) { return r[2] === '302'; })); add('srlamp', it.filter(function (r) { return r[2] === '305'; }));
      add('sr112', it.filter(function (r) { return ['303', '304', '306', '307', '308'].indexOf(r[2]) >= 0; })); add('srsvc', I.srSvc); add('aed', I.aed); add('fw', I.fire); add('tow', I.tow); add('wc2', I.wc); add('box', I.box); add('dem', I.dem);
      draw();
    }).catch(function () {}); return RLOADS[gu];
  }
  // v0.10.96 TAAS 사고 10년(구마다 taas10.json · 서초 taas10-seocho 와 같은 꼴) — 서초는 기존 파일이 우선
  var RLOADA = {};
  function aLoad(gu) {
    if (gu === '11650') return Promise.resolve(); if (RLOADA[gu]) return RLOADA[gu];
    RLOADA[gu] = fetch('data/r/' + gu + '/taas10.json').then(function (r) { if (!r.ok) throw 0; return r.json(); }).then(function (j) {
      j.cells.forEach(function (c) { A10.push({ c: c, p: P(c[1], c[0]), m: j }); }); j.fatal.forEach(function (f) { F10.push({ f: f, p: P(f[17], f[16]), m: j }); }); draw();
    }).catch(function () {}); return RLOADA[gu];
  }
  var RLOADX = {};
  function xLoad(gu) {   // v0.10.94 버스·지하철 승하차(구마다) — 서초 정류장·역이 이미 있으면 건너뛴다
    if (RLOADX[gu]) return RLOADX[gu];
    RLOADX[gu] = fetch('data/r/' + gu + '/transit.json').then(function (r) { if (!r.ok) throw 0; return r.json(); }).then(function (j) {
      if (!PUB) return; var hb = {}, hs = {}; PUB.bus.forEach(function (q) { hb[q.o.id] = 1; }); PUB.subr.forEach(function (q) { hs[q.name] = 1; });
      j.bus.forEach(function (b) { if (hb[b[0]]) return; var on2 = b[4], off2 = b[5], day = on2.concat(off2).reduce(function (a, c) { return a + c; }, 0), tot = on2.map(function (v, i) { return v + off2[i]; });
        FLOW.bus[b[0]] = [on2, off2]; PUB.bus.push({ name: b[1], p: P(b[2], b[3]), o: { id: b[0], name: b[1], lon: b[2], lat: b[3], day: day, h: tot, peak: tot.indexOf(Math.max.apply(null, tot)), rg: j } }); });
      j.sub.forEach(function (b) { if (hs[b[0]]) return; FLOW.sub[b[0]] = [b[4], b[5], b[1]]; PUB.subr.push({ name: b[0], p: P(b[2], b[3]), o: { name: b[0], lines: b[1], lon: b[2], lat: b[3], rg: j } }); });
      draw();
    }).catch(function () {}); return RLOADX[gu];
  }
  function needRegions() {
    if ((on.acc10 || on.fatal10) && view.s >= 0.012) { var va = viewLL(); rIdx().forEach(function (g) { if (RLOADA[g.gu] || !(g.bytes || {}).taas10) return; var x = g.box; if (x[2] < va[0] || x[0] > va[2] || x[3] < va[1] || x[1] > va[3]) return; aLoad(g.gu); }); }
    if (view.s >= 0.03 && SAFE_KEYS.some(function (k) { return on[k]; })) { var vs2 = viewLL(); rIdx().forEach(function (g) { if (RLOADS[g.gu] || !(g.bytes || {}).safety) return; var x = g.box; if (x[2] < vs2[0] || x[0] > vs2[2] || x[3] < vs2[1] || x[1] > vs2[3]) return; sfLoad(g.gu); }); }
    if ((on.bus && view.s > 0.07) || (on.subr && view.s >= 0.02)) { var vx = viewLL(); rIdx().forEach(function (g) { if (RLOADX[g.gu] || !(g.bytes || {}).transit) return; var x = g.box; if (x[2] < vx[0] || x[0] > vx[2] || x[3] < vx[1] || x[1] > vx[3]) return; xLoad(g.gu); }); }
    if (on.trd && view.s >= 0.02) { var vt = viewLL(); rIdx().forEach(function (g) { if (RLOADT[g.gu] || !(g.bytes || {}).trdar) return; var x = g.box; if (x[2] < vt[0] || x[0] > vt[2] || x[3] < vt[1] || x[1] > vt[3]) return; tLoad(g.gu); }); }
    if (!(on.dong || on.live || on.sales) || view.s < 0.012) return; var v = viewLL();
    rIdx().forEach(function (g) { if (g.gu === '11650' || RLOAD[g.gu]) return; var x = g.box; if (x[2] < v[0] || x[0] > v[2] || x[3] < v[1] || x[1] > v[3]) return;
      rLoadGu(g.gu); });
  }
  function rAdd(j) {
    RGUN[j.name] = 1;
    j.dong.forEach(function (d) { var polys = d.polys.map(function (Pg) { return Pg.map(function (r) { return r.map(function (q) { return P(q[0], q[1]); }); }); });
      var box = [1e9, -1e9, 1e9, -1e9]; polys.forEach(function (Pg) { Pg[0].forEach(function (q) { box[0] = Math.min(box[0], q[0]); box[1] = Math.max(box[1], q[0]); box[2] = Math.min(box[2], q[1]); box[3] = Math.max(box[3], q[1]); }); });
      RDONG.push({ name: d.name, gu: j.name, gcd: j.gu, k: d.k, polys: polys, box: box, c: d.c ? P(d.c[0], d.c[1]) : labelPt(polys, box), pop: d.pop, live: d.live, sales: d.sales, old: d.old, rg: j }); });
    LMX = {}; SMX = {};
    if (RWANT) RDONG.forEach(function (d) { if (RWANT && d.gcd === RWANT.gu && d.name === RWANT.name) { RWANT = null; var s2 = S(d.c); sel = { x: s2[0], y: s2[1], r: 6, it: { kind: 'dong', d: d } }; show(sel.it); } });
  }
  function rExt(d) {   // 업종 줄·분기 추이 — 카드를 열 때만
    if (!d.rg || d.x !== undefined) return; var g = d.gcd;
    if (RX[g]) { d.x = RX[g].dong[d.k] || {}; return; }
    d.x = null; fetch('data/r/' + g + '/dongx.json').then(function (r) { if (!r.ok) throw 0; return r.json(); }).then(function (j) { RX[g] = j; RDONG.forEach(function (q) { if (q.gcd === g && q.x === null) q.x = j.dong[q.k] || {}; }); if (sel && sel.it.d && sel.it.d.gcd === g) show(sel.it); }).catch(function () { d.x = {}; });
  }
  var TCB = {};
  function tLoad(gu, then) {   // v0.10.92 구의 상권(서울시 상권분석서비스) — 서초는 기존 trdar-seocho 를 이 파일(1년 전 매출·점포 포함)로 갈아 끼운다
    if (RLOADT[gu] === 3 || RLOADT[gu] === 2) { if (then) then(); return; } if (then) (TCB[gu] = TCB[gu] || []).push(then); if (RLOADT[gu]) return; RLOADT[gu] = 1;
    var fin = function () { var L = TCB[gu] || []; TCB[gu] = []; L.forEach(function (f) { f(); }); };
    fetch('data/r/' + gu + '/trdar.json').then(function (r) { if (!r.ok) throw 0; return r.json(); }).then(function (j) { tAdd(j); RLOADT[gu] = 3; fin(); draw(); }).catch(function () { RLOADT[gu] = 2; fin(); });
  }
  function rLoadGu(gu) {   // 행정동 지역 파일 하나 — 약속으로(반경 분석이 기다린다)
    if (gu === '11650') return Promise.resolve(); if (RLOAD[gu] && RLOAD[gu].then) return RLOAD[gu]; if (RLOAD[gu]) return Promise.resolve();
    RLOAD[gu] = fetch('data/r/' + gu + '/dong.json').then(function (r) { if (!r.ok) throw 0; return r.json(); }).then(function (j) { rAdd(j); draw(); }).catch(function () { RLOAD[gu] = 2; }); return RLOAD[gu];
  }
  function tAdd(j) {
    var by = {}; TRD.forEach(function (x, i) { by[x.t.cd] = i; });
    j.trdar.forEach(function (t) { var o = trdItem(t, j); if (by[t.cd] != null) TRD[by[t.cd]] = o; else TRD.push(o); });
    trdList();
    if (TWANT) TRD.forEach(function (x) { if (TWANT && x.t.cd === TWANT.cd) { var it = { kind: 'trd', x: x, biz: TWANT.biz }; TWANT = null; var s2 = S(x.c); sel = { x: s2[0], y: s2[1], r: 12, it: it }; show(it); } });
  }
  function inViewBox(d) { var a = M(0, 0), b = M(cv.clientWidth, cv.clientHeight); return !(d.box[1] < a[0] || d.box[0] > b[0] || d.box[3] < a[1] || d.box[2] > b[1]); }
  function allDong() { return DONG.concat(RDONG); }
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
  function dot(q, r, fill, stroke, item) { var s = S(q); if (s[0] < -40 || s[1] < -40 || s[0] > cv.clientWidth + 40 || s[1] > cv.clientHeight + 40) return; r = r * zk(); ctx.beginPath(); ctx.arc(s[0], s[1], r, 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill(); if (stroke) { ctx.lineWidth = 1.5; ctx.strokeStyle = stroke; ctx.stroke(); } if (item) hit.push({ x: s[0], y: s[1], r: Math.max(r, 9), it: item }); }
  function label(q, text, size, color, bg) { var s = S(q); ctx.font = 'bold ' + size + 'px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; if (bg) { var w = ctx.measureText(text).width; ctx.fillStyle = bg; ctx.fillRect(s[0] - w / 2 - 3, s[1] - size / 2 - 2, w + 6, size + 4); } ctx.fillStyle = color; ctx.fillText(text, s[0], s[1]); }
  function draw() {
    var needW = Math.round(cv.clientWidth * DPR), needH = Math.round(cv.clientHeight * DPR);
    if (cv.width !== needW || cv.height !== needH) { cv.width = needW; cv.height = needH; }
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0); hit = [];
    var W = cv.clientWidth, H = cv.clientHeight, dark = document.documentElement.classList.contains('dark');
    var BASE = on.base && OSM; ctx.fillStyle = dark ? '#0f1624' : (BASE ? '#f2efe8' : '#eef2f6'); ctx.fillRect(0, 0, W, H);
    var ymd = pickDate(), RVIS = RDONG.filter(inViewBox);
    // 이웃 구의 동(회색 · 점선 경계) — 그 구의 지역 자료를 받았으면 그쪽이 그린다
    NEAR.forEach(function (d) { if (RGUN[d.gu]) return;
      d.polys.forEach(function (Pg) { ctx.beginPath(); Pg.forEach(function (r) { r.forEach(function (q, n) { var s = S(q); if (n) ctx.lineTo(s[0], s[1]); else ctx.moveTo(s[0], s[1]); }); ctx.closePath(); });
        if (on.dong) { var hl = sel && sel.it.kind === 'near' && sel.it.d === d; ctx.fillStyle = dark ? (hl ? 'rgba(148,163,184,.35)' : 'rgba(148,163,184,.10)') : (hl ? '#e2e8f0' : '#f1f5f9'); ctx.fill('evenodd'); }
        ctx.lineWidth = 0.9; ctx.setLineDash([3, 3]); ctx.strokeStyle = dark ? 'rgba(148,163,184,.5)' : 'rgba(100,116,139,.55)'; ctx.stroke(); ctx.setLineDash([]); });
    });
    // 행정동
    DONG.concat(RVIS).forEach(function (d, k) {
      d.polys.forEach(function (Pg) { ctx.beginPath(); Pg.forEach(function (r) { r.forEach(function (q, n) { var s = S(q); if (n) ctx.lineTo(s[0], s[1]); else ctx.moveTo(s[0], s[1]); }); ctx.closePath(); });
        var lv = on.live ? liveNow(d) : null;
        if (lv) { var t = Math.min(1, lv.n / (lv.max || 1)); ctx.fillStyle = 'rgba(' + Math.round(255 - 40 * t) + ',' + Math.round(230 - 170 * t) + ',' + Math.round(150 - 110 * t) + ',' + (dark ? .55 : .75) + ')'; ctx.fill('evenodd'); }
        else if (on.sales && salesNow(d)) { var sn = salesNow(d); ctx.fillStyle = 'rgba(' + Math.round(237 - 120 * sn.t) + ',' + Math.round(233 - 180 * sn.t) + ',' + Math.round(254 - 40 * sn.t) + ',' + (dark ? .5 : .8) + ')'; ctx.fill('evenodd'); }
        else if (on.dong) { var hl3 = sel && sel.it.kind === 'dong' && sel.it.d === d; ctx.fillStyle = dark ? 'rgba(90,120,170,' + (hl3 ? '.45' : BASE ? '.08' : '.18') + ')' : (hl3 ? '#fde68a' : PAL[k % PAL.length]); if (BASE && !hl3 && !dark) ctx.globalAlpha = 0.3; ctx.fill('evenodd'); ctx.globalAlpha = 1; }
        if (!BASE) { ctx.lineWidth = (on.dong ? 1.6 : 0.8) * (d.rg ? 0.7 : 1); ctx.strokeStyle = dark ? 'rgba(160,190,230,.6)' : 'rgba(40,60,90,.45)'; ctx.stroke(); } });
    });
    if (BASE) { drawBaseAreas(dark); DONG.concat(RVIS).forEach(function (d) { d.polys.forEach(function (Pg) { ctx.beginPath(); Pg.forEach(function (r) { r.forEach(function (q, n) { var s = S(q); if (n) ctx.lineTo(s[0], s[1]); else ctx.moveTo(s[0], s[1]); }); ctx.closePath(); });
      ctx.lineWidth = (on.dong ? 1.8 : 0.8) * (d.rg ? 0.65 : 1); ctx.setLineDash(on.dong ? [] : [4, 4]); ctx.strokeStyle = dark ? 'rgba(167,139,250,.65)' : 'rgba(109,40,217,.45)'; ctx.stroke(); ctx.setLineDash([]); }); }); }
    // 구 경계(서초·동작·관악·강남)
    GU.forEach(function (g) { path(g.pts); ctx.lineWidth = 2.4; ctx.setLineDash([8, 5]); ctx.strokeStyle = dark ? '#9fb3d1' : '#475569'; ctx.stroke(); ctx.setLineDash([]); });
    // 도로 — 바탕 지도가 있으면 OSM 도로 전부(종류별 폭·색 · 지하차도 점선 · 다리 테), 없으면 간선 10개
    if (on.road && OSM) drawBaseRoads(dark);
    drawSgg(dark);   // v0.10.90 시·군·구 경계(서울·경기·인천)
    // 건물
    if (on.bld && BLD.length && view.s > 0.12) BLD.forEach(function (b) { path(b.p); ctx.closePath(); ctx.fillStyle = dark ? 'rgba(200,210,225,.28)' : (BASE ? 'rgba(186,176,164,.85)' : 'rgba(90,100,115,.30)'); ctx.fill(); if (BASE && !dark && view.s > 0.5) { ctx.lineWidth = 0.6; ctx.strokeStyle = 'rgba(120,110,100,.7)'; ctx.stroke(); } });
    if (on.road && OSM) drawBaseLabels(dark);
    // 도로(OSM 간선 10개)
    if (on.road && !OSM) ROADS.forEach(function (r) { path(r.pts); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(3, 26 * view.s); ctx.strokeStyle = dark ? '#3b4a63' : '#ffffff'; ctx.stroke(); ctx.lineWidth = Math.max(1, 3 * view.s); ctx.strokeStyle = dark ? '#8aa0c0' : '#f59e0b'; ctx.stroke(); });
    if (on.road && !OSM && view.s > 0.08) ROADS.forEach(function (r) { var q = r.pts[Math.floor(r.pts.length * 0.3)]; if (q) label(q, r.name, 12, dark ? '#e2e8f0' : '#334155', dark ? 'rgba(15,22,36,.7)' : 'rgba(255,255,255,.8)'); });
    if (on.dong && view.s > 0.09) NEAR.forEach(function (d) { if (RGUN[d.gu]) return; label(d.c, d.name, 11, dark ? '#94a3b8' : '#64748b'); if (view.s > 0.16) label([d.c[0], d.c[1] + 14 / view.s], d.gu, 10, dark ? '#64748b' : '#94a3b8'); });
    // 동 이름
    if (on.dong) DONG.concat(view.s > 0.045 ? RVIS : []).forEach(function (d) { label(d.c, d.name, view.s > 0.2 ? 14 : 12, dark ? '#dbe6f5' : '#1e293b'); if (d.rg && view.s > 0.12) label([d.c[0], d.c[1] - 15 / view.s], d.gu, 10, dark ? '#94a3b8' : '#64748b'); var lv2 = on.live ? liveNow(d) : null, sn2 = on.sales && !lv2 ? salesNow(d) : null; if (sn2 && view.s > 0.06) label([d.c[0], d.c[1] + 16 / view.s], '💳 시간당 약 ' + won(sn2.perH), 11, dark ? '#ddd6fe' : '#4c1d95'); else if (lv2 && view.s > 0.06) label([d.c[0], d.c[1] + 16 / view.s], '지금 ' + lv2.n.toLocaleString() + '명', 11, dark ? '#fde68a' : '#7c2d12'); else if (d.pop && view.s > 0.14) label([d.c[0], d.c[1] + 16 / view.s], d.pop.tot.toLocaleString() + '명', 11, dark ? '#94a3b8' : '#475569'); });
    // 교차로(이름 · 사고)
    NODES.forEach(function (n) {
      var st = D.acc && D.acc.nodes ? D.acc.nodes.filter(function (x) { return x.node[0] === n.i && x.node[1] === n.j; })[0] : null;
      if (!n.real) { var sx = S(n.p); ctx.strokeStyle = dark ? '#94a3b8' : '#64748b'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(sx[0] - 5, sx[1] - 5); ctx.lineTo(sx[0] + 5, sx[1] + 5); ctx.moveTo(sx[0] + 5, sx[1] - 5); ctx.lineTo(sx[0] - 5, sx[1] + 5); ctx.stroke(); hit.push({ x: sx[0], y: sx[1], r: 9, it: { kind: 'node', n: n, st: null } }); return; }
      var a19 = accN(n, 2019, 2025), d19 = deadN(n, 2019, 2025);
      if (on.acc && a19) { var r19 = 5 + Math.sqrt(a19) * 0.55; dot(n.p, r19, d19 ? 'rgba(220,38,38,.55)' : 'rgba(234,88,12,.45)', '#7f1d1d', { kind: 'node', n: n, st: st }); if (view.s > 0.09) label([n.p[0], n.p[1] + (r19 * zk() + 9) / view.s], a19 + '건' + (d19 ? ' · 사망 ' + d19 : ''), 10.5, '#7f1d1d', 'rgba(255,255,255,.85)'); }
      else if (on.acc && st && st.total) { var r = 5 + Math.sqrt(st.total) * 0.9; dot(n.p, r, st.death ? 'rgba(220,38,38,.55)' : 'rgba(234,88,12,.45)', '#7f1d1d', { kind: 'node', n: n, st: st }); }
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
    if (on.cam && D.cam) D.cam.items.forEach(function (c) { dot(P(c.lon, c.lat), 4.5, camCol(c), '#fff', { kind: 'cam', c: c }); });
    if (on.sig && D.sig) D.sig.spots.forEach(function (s) { dot(P(s.lon, s.lat), 5, '#16a34a', '#fff', { kind: 'sig', s: s }); });
    if (on.sub && F2) (F2.subways || []).forEach(function (s) { var n = nodeAt([s.i, s.j]); if (!n) return; var q = [n.p[0] + (s.side || 1) * 26, n.p[1] + 26], ls = s.lines || [];
      ls.forEach(function (l, k) { dot([q[0] + k * 13 / view.s, q[1]], 6, LINE_C[l] || '#64748b', '#fff', k ? null : { kind: 'sub', s: s, n: n }); });
      if (view.s > 0.1) label([q[0], q[1] + 16 / view.s], s.name, 11, dark ? '#e2e8f0' : '#334155', dark ? 'rgba(15,22,36,.7)' : 'rgba(255,255,255,.85)'); });
    if (on.her && D.her) D.her.items.forEach(function (h) { if (h.lat && h.lon) dot(P(h.lon, h.lat), 5, '#92400e', '#fde68a', { kind: 'her', h: h }); });
    if (on.vol && D.vol) D.vol.spots.forEach(function (v) { var n = v.node && nodeAt(v.node); if (n && !v.outside) { var s2 = S(n.p); ctx.fillStyle = '#0ea5e9'; ctx.fillRect(s2[0] + 8, s2[1] - 8, 16, 16); hit.push({ x: s2[0] + 16, y: s2[1], r: 12, it: { kind: 'vol', v: v, n: n } }); } });
    drawTrd(dark); drawRent(dark); drawBiz(dark); drawRad(dark); drawA10(dark); drawPub(dark); drawExtra(dark); drawFlow(dark); drawSafe(dark); drawSeason(dark);
    if (on.evt && D.evt) {
      (D.evt.events && D.evt.events.items || []).forEach(function (e) { if (e.lat && e.s <= ymd && e.e >= ymd) dot(P(e.lon, e.lat), 5.5, '#a855f7', '#fff', { kind: 'evt', e: e }); });
      (D.evt.rallies && D.evt.rallies.items || []).forEach(function (r) {
        if (r.d !== ymd || !r.lat) return;
        if (r.march && r.dest) { path([P(r.lon, r.lat), P(r.dest[1], r.dest[0])]); ctx.lineWidth = 3; ctx.setLineDash([6, 4]); ctx.strokeStyle = '#ef4444'; ctx.stroke(); ctx.setLineDash([]); }
        dot(P(r.lon, r.lat), 7, '#ef4444', '#fff', { kind: 'rally', r: r });
      });
    }
    if (REP) { var rs = S(REP.p); ctx.beginPath(); ctx.arc(rs[0], rs[1], 14, 0, Math.PI * 2); ctx.lineWidth = 4; ctx.strokeStyle = '#dc2626'; ctx.stroke(); ctx.beginPath(); ctx.arc(rs[0], rs[1], 4, 0, Math.PI * 2); ctx.fillStyle = '#dc2626'; ctx.fill();
      label([REP.p[0], REP.p[1] - 26 / view.s], REP.here ? '📍 지금 위치' : '📋 보고 자리', 12, '#fff', REP.here ? 'rgba(29,78,216,.92)' : 'rgba(185,28,28,.9)'); hit.push({ x: rs[0], y: rs[1], r: 16, it: { kind: 'report' } }); }
    if (sel) { ctx.beginPath(); ctx.arc(sel.x, sel.y, sel.r + 5, 0, Math.PI * 2); ctx.lineWidth = 3; ctx.strokeStyle = '#facc15'; ctx.stroke(); }
    if (document.body.classList.contains('legon')) legend();
    needRegions();
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
  function dongAtM(m) { var AD = allDong(); for (var k = 0; k < AD.length; k++) { var d = AD[k]; if (m[0] < d.box[0] || m[0] > d.box[1] || m[1] < d.box[2] || m[1] > d.box[3]) continue; for (var p = 0; p < d.polys.length; p++) if (inRing(d.polys[p][0], m[0], m[1]) && !d.polys[p].slice(1).some(function (h) { return inRing(h, m[0], m[1]); })) return d; } return null; }
  function inPoly(d, m) { if (m[0] < d.box[0] || m[0] > d.box[1] || m[1] < d.box[2] || m[1] > d.box[3]) return false; for (var p = 0; p < d.polys.length; p++) if (inRing(d.polys[p][0], m[0], m[1]) && !d.polys[p].slice(1).some(function (h) { return inRing(h, m[0], m[1]); })) return true; return false; }
  function nearAtM(m) { for (var k = 0; k < NEAR.length; k++) if (!RGUN[NEAR[k].gu] && inPoly(NEAR[k], m)) return NEAR[k]; return null; }
  function tap(x, y) {
    if (RAD.pick && document.body.classList.contains('radon')) { RAD.c = M(x, y); RAD.pick = false; radRun(); return; }
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
  // v0.10.83 24시간 막대 = 아래에 시각 숫자 · 붐빔(그 막대의 가장 작은 값~가장 큰 값 사이 위쪽 25%)/보통/한산(아래쪽 30%) 색 · 지금 시각 테 — 소유자 「시간을 숫자로 · 붐비는 시간대를 색을 달리」
  var BUSY = 0.75, QUIET = 0.30, C_BUSY = '#dc2626', C_QUIET = '#cbd5e1';
  function hourLv(v, mx, mn) { var t = (v - (mn || 0)) / Math.max(1e-9, mx - (mn || 0)); return t >= BUSY ? 2 : t < QUIET ? 0 : 1; }
  function hourAxis(lv) { var hh = nowH(); return '<div class="hx">' + lv.map(function (l, i) { return '<span class="' + (l === 2 ? 'b' : '') + (i === hh ? ' n' : '') + '">' + i + '</span>'; }).join('') + '</div>'; }
  function hourKey(lv, color) { var b = []; lv.forEach(function (l, i) { if (l === 2) b.push(i); }); var r = [], s0 = null;
    b.forEach(function (h, k) { if (s0 == null) s0 = h; if (b[k + 1] !== h + 1) { r.push(s0 === h ? s0 + '시' : s0 + '~' + h + '시'); s0 = null; } });
    return '<div class="hk"><i style="background:' + C_BUSY + '"></i>붐빔' + (r.length ? ' <b>' + r.join(' · ') + '</b>' : '') + ' <i style="background:' + (color || '#3b82f6') + '"></i>보통 <i style="background:' + C_QUIET + '"></i>한산 <i class="nw"></i>지금</div>'; }
  function bar(arr, color, lab, fmt) { if (!arr.some(function (v) { return +v; })) return '<div class="nil">이 기간 값이 모두 0 — 자료에 기록이 없다</div>';
    var mx = Math.max.apply(null, arr) || 1;
    if (arr.length === 24) { var mn = Math.min.apply(null, arr), lv = arr.map(function (v) { return hourLv(v, mx, mn); }), hh = nowH();
      return vxRow(arr, hh) + '<div class="bars h24">' + arr.map(function (v, i) { return '<i title="' + i + '시 ' + Math.round(v).toLocaleString() + '" class="' + (i === hh ? 'n' : '') + '" style="height:' + Math.round(v / mx * 100) + '%;background:' + (lv[i] === 2 ? C_BUSY : lv[i] === 0 ? C_QUIET : (color || '#3b82f6')) + '"></i>'; }).join('') + '</div>' + hourAxis(lv) + hourKey(lv, color); }
    var ok = lab && lab.length === arr.length;
    return vxRow(arr, null, fmt) +
      '<div class="bars">' + arr.map(function (v, i) { return '<i title="' + esc(ok ? String(lab[i]).replace(/<[^>]+>/g, '') : String(i)) + ' ' + shortN(v) + '" style="height:' + Math.round(v / mx * 100) + '%;background:' + (color || '#3b82f6') + '"></i>'; }).join('') + '</div>' +
      (ok ? '<div class="lx">' + lab.map(function (t) { return '<span>' + t + '</span>'; }).join('') + '</div>' : ''); }
  // v0.10.86 막대 눈금 글자 — 소유자 「세로 막대에 몇 년도인지 숫자로 · 막대만 덜렁 있으니 이해하기 어렵다」
  // v0.10.87 막대 위 값 — 소유자 「모든 막대에 숫자 · 좁으면 작게 · 지저분하면 처음·끝·중요한 것만」: 12칸 이하면 전부, 넘으면 처음·끝·가장 큰 값(·지금 시각)
  function vxRow(arr, now, fmt) { var F = fmt === 'w' ? wonS : shortN; var n = arr.length, mx = -Infinity, im = 0; arr.forEach(function (v, i) { if (v > mx) { mx = v; im = i; } });
    var show = n <= 12 ? null : [0, n - 1, im].concat(now != null ? [now] : []);
    return '<div class="vx' + (n > 12 ? ' many' : '') + '">' + arr.map(function (v, i) { var on = show ? show.indexOf(i) >= 0 : true;
      return '<span class="' + (i === im && n > 1 ? 'mx' : '') + (now === i ? ' n' : '') + '">' + (on && v ? F(v) : '') + '</span>'; }).join('') + '</div>'; }
  function wonS(v) { return won(v).replace(/원$/, ''); }   // 만원 단위 값 → 「6,347만」「1.9억」
  function shortN(v) { v = +v || 0; var a = Math.abs(v); return a >= 1e8 ? (v / 1e8).toFixed(a >= 1e9 ? 0 : 1) + '억' : a >= 1e4 ? (v / 1e4).toFixed(a >= 1e5 ? 0 : 1) + '만' : a >= 100 ? Math.round(v).toLocaleString() : a >= 10 ? Math.round(v) : (Math.round(v * 10) / 10); }
  function yLab(y0, n) { var o = []; for (var i = 0; i < n; i++) o.push('<b>' + String(y0 + i).slice(0, 2) + '</b>' + String(y0 + i).slice(2)); return o; }
  function qLab(qs) { return qs.map(function (q) { return q[4] === '1' ? "'" + q.slice(2, 4) : ''; }); }
  var LB_Y16 = yLab(2016, 10), LB_TB6 = ['0~6', '6~11', '11~14', '14~17', '17~21', '21~24'], LB_TB4 = ['0~6', '6~12', '12~18', '18~24'], LB_DW = ['월', '화', '수', '목', '금', '토', '일'],
    LB_AGE6 = ['10대', '20대', '30대', '40대', '50대', '60+'];
  function ageLab(n) { var o = []; for (var i = 0; i < n; i++) o.push(i === 0 ? '~9' : i === n - 1 && n < 10 ? i * 10 + '+' : i * 10 + '대'); return o; }
  function show(it) {
    var card = $('m2dCard'), h = '';
    if (!it) { card.classList.remove('on'); return; }
    if (it.kind === 'report') {
      var nn = nearestRealNode(REP.p), dd = nn ? Math.round(Math.hypot(nn.p[0] - REP.p[0], nn.p[1] - REP.p[1])) : 0;
      if (nn && dd <= 800) { show({ kind: 'node', n: nn, st: accOf(nn), rep: dd }); return; }
      h = '<h3>' + (REP.here ? '📍 지금 위치' : '📋 보고 자리') + '</h3>' + row('가까운 교차로', '없음(800m 안) — 서초구 밖일 수 있음') + repAround() + hereRows() + src('T-Book 최초보고가 넘긴 좌표 — 이 기기 안에서만 쓰고 어디에도 저장하지 않는다');
    } else if (it.kind === 'near') {
      var nd = it.d, cnt = function (arr, ll) { return (arr || []).filter(function (q) { var v = ll(q); return v && inPoly(nd, P(v[0], v[1])); }).length; };
      var nS = D.sig ? cnt(D.sig.spots, function (q) { return [q.lon, q.lat]; }) : 0, nE = D.evt && D.evt.events ? cnt(D.evt.events.items, function (q) { return q.lat ? [q.lon, q.lat] : null; }) : 0, nC = D.cam ? cnt(D.cam.items, function (q) { return [q.lon, q.lat]; }) : 0;
      var touch = NODES.filter(function (n) { if (!n.real) return false; if (inPoly(nd, n.p)) return true; var m = 1e9; nd.polys.forEach(function (Pg) { Pg[0].forEach(function (q) { m = Math.min(m, Math.hypot(q[0] - n.p[0], q[1] - n.p[1])); }); }); return m < 120; });
      h = '<h3>🏘 ' + esc(nd.gu + ' ' + nd.name) + '</h3>' + row('자리', '서초구 밖 — 맞닿은 동') + (touch.length ? row('맞닿은 교차로', touch.map(function (n) { return esc(n.name); }).join(' · ')) : '') +
        row('이 동 안의 자료', '신호 ' + nS + '곳 · 단속 카메라 ' + nC + '대 · 행사 ' + nE + '건') + '<p class="desc">이 지도가 자세히 가진 것은 서초구 자료다(인구·사고·국가유산 등). 이웃 구는 경계와 이름, 그리고 서초 자료에 함께 들어온 신호·행사만 보인다.</p>' +
        src('경계: 통계청 SGIS 행정동(2026.7 · 공공누리 1유형) · 서초구 경계에서 1.5km 안의 동');
    } else if (it.kind === 'rgo') {   // 찾기 — 아직 안 받은 구의 동
      h = '<h3>🏘 ' + esc(it.g + ' ' + it.name) + '</h3><p class="desc">이 구 자료를 받는 중…</p>'; RWANT = { gu: it.gu, name: it.name }; if (!on.dong) { on.dong = true; saveOn(); paintLayers(); } setTimeout(draw, 0);
    } else if (it.kind === 'dong' && it.d.rg) { h = rDongCard(it.d);
    } else if (it.kind === 'dong') {
      var d = it.d, p = d.pop; h = '<h3>🏘 ' + esc(d.name) + '</h3>'; var jz = jurDongLine(d.name); if (jz) h += row('경찰서 관할', jz);
      if (p) { h += row('주민', p.tot.toLocaleString() + '명'); h += row('19세 이하', Math.round((p.age[0] + p.age[1]) / p.tot * 100) + '%') + row('70세 이상', Math.round((p.age[7] + p.age[8] + p.age[9]) / p.tot * 100) + '%');
        h += '<div class="cap">주민 연령대별 인구(명 · 주민등록 · 0~9세 … 90~99세)</div>' + bar(p.age, '#8b5cf6', ageLab(p.age.length)); }
      var lv = liveNow(d);
      if (lv) { h += row('생활인구 지금', lv.n.toLocaleString() + '명 <em>(' + (lv.we ? '주말' : '평일') + ' ' + lv.h + '시 평균)</em>') + row('하루 폭', Math.min.apply(null, lv.arr).toLocaleString() + ' ~ ' + Math.max.apply(null, lv.arr).toLocaleString() + '명') +
        '<div class="cap">시간대별 생활인구(명 · 그 시각 동 안에 있는 사람 · 0~23시 ' + (lv.we ? '주말' : '평일') + ' 평균)</div>' + bar(lv.arr, '#f97316'); }
      h += salesRows(d) + dongIndRows(d);
      var ag = D.st && D.st.agg && D.st.agg[d.name];   // 🏪 등록 상가(소상공인시장진흥공단 · v0.10.65)
      if (ag) h += row('등록 상가', (ag.all || 0).toLocaleString() + '곳 · 음식 ' + (ag.food || 0) + ' · 주점 ' + (ag.bar || 0) + ' · 노래방·PC방 ' + (ag.play || 0) + ' · 숙박 ' + (ag.inn || 0) + ' · 편의점 ' + (ag.conv || 0));
      var sz2 = D.sz ? D.sz.zones.filter(function (z) { var q = P(z.lon, z.lat); return inPoly(d, q); }).length : 0; if (D.sz) h += row('어린이보호구역', sz2 + '곳');
      var ns = NODES.filter(function (n) { return n.dong && (n.dong.dong === d.name || (n.dong.also || []).indexOf(d.name) >= 0); });
      if (ns.length) h += row('걸친 교차로', ns.map(function (n) { return esc(n.name); }).join(' · '));
      h += src('경계: 통계청 SGIS 행정동(2026.7 · 공공누리 1유형) · 인구: 행정안전부 주민등록(2026.8)' + (lv ? ' · 생활인구: 서울시(2026.7 · KT 통신 자료 추정)' : ''));
    } else if (it.kind === 'node') {
      var n = it.n, st = it.st; h = '<h3>' + (n.real ? '🚦 ' : '✕ ') + esc(n.name) + '</h3>' + (it.rep ? row(REP.here ? '지금 위치' : '보고 자리', (REP.here ? '지금 위치에서 ' : 'T-Book 보고 자리에서 ') + it.rep + 'm') + repAround() + hereRows() : '') + row('도로', esc(n.pair.replace('×', ' × ')));
      if (!n.real) { h += row('실제', '두 도로가 만나지 않는다 — ' + esc(n.why || ('최단 ' + n.gap + 'm'))) + '<p class="desc">게임 지도(격자)에는 교차로가 있지만 실제 길에는 없다. 사고·신호 자료를 이 자리에 붙이지 않는다.</p>' + src('OpenStreetMap(ODbL) · 2026-09-28 · 두 도로의 모든 선분 사이 최단 거리');
        card.innerHTML = '<button class="x" id="m2dX">닫기</button>' + h; card.classList.add('on'); $('m2dX').onclick = function () { sel = null; show(null); draw(); }; return; }
      h += row('신호 교차로', n.sig ? esc(n.sig.name) + ' <em>#' + esc(n.sig.no) + '</em>' : '<em>공개 신호 목록(C-ITS)에 없음</em>');
      if (n.nameSrc) h += row('이름', '<em>' + esc(n.nameSrc) + '</em>');
      if (n.dong) h += row('행정동', esc(n.dong.dong) + ((n.dong.also || []).length ? ' · ' + esc(n.dong.also.join('·')) + ' <em>경계</em>' : ''));
      if (n.y10) { var t19 = accN(n, 2019, 2025); h += row('사고 2019~2025', t19 + '건 · 사망 ' + deadN(n, 2019, 2025) + '명 <em>(사망사고 기록)</em> · 해마다 평균 ' + Math.round(t19 / 7)) + row('2016~2025', accN(n, 2016, 2025) + '건 · 사망·중상자 ' + n.sev + ' · 보행자 피해 ' + n.ped) +
        '<div class="cap">해마다 교통사고 건수(건 · 2016~2025 · 585m 안 100m 칸을 이 교차로에 배정)</div>' + bar(n.y10, '#ea580c', LB_Y16) + (n.d10.some(function (v) { return v; }) ? '<div class="cap">해마다 교통사고 사망자 수(명 · 2016~2025 · 사망사고 기록)</div>' + bar(n.d10, '#111827', LB_Y16) : ''); }
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
      h += camEff(cm) + src('경찰청 전국무인교통단속카메라표준데이터(기준일 2026-04-06) · 설치 전후 사고 = TAAS 사고 10년(100m 칸)');
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
    } else if (it.kind === 'a10' || it.kind === 'f10') { h = a10Card(it);
    } else if (it.kind === 'bizpin') { bizGo(it.k); return;
    } else if (it.kind === 'rent') { h = rentCard(it.it);
    } else if (it.kind === 'store') { var so = it.s, C3 = SIDX ? SIDX.cls[so.c] : null; h = '<h3>🏬 ' + esc(so.n) + '</h3>' + (C3 ? row('업종', esc(C3[1] + ' › ' + C3[3] + ' › ' + C3[4])) : '') + (so.f ? row('층', esc(so.f) + '층') : '') + (RAD.c ? row('반경 가운데에서', Math.round(Math.hypot(so.p[0] - RAD.c[0], so.p[1] - RAD.c[1])) + 'm') : '') + '<p class="desc">등록된 상가 정보다 — 영업 중인지·매출은 이 자료에 없다.</p>' + src(SIDX ? SIDX.source + ' · 기준 ' + SIDX.stdrYm : '');
    } else if (it.kind === 'trd') { h = trdCard(it);
    } else if (it.kind === 'season') { h = seasonCard(it);
    } else if (it.kind === 'safe') { h = safeCard(it);
    } else if (['crowd', 'link', 'osmroad', 'hot10'].indexOf(it.kind) >= 0) {
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
  function liveArr(d) { if (d.rg || d.pre) return d.live || null; var L = D.pub && D.pub.livepop && D.pub.livepop.dong; return L && L[d.name] || null; }
  function liveMax(key, h) { var c = key + h; if (LMX[c] == null) { var m = 0; allDong().forEach(function (d) { var a = liveArr(d); if (a) m = Math.max(m, a[key][h]); }); LMX[c] = m; } return LMX[c]; }   // 서울 전체(받은 구까지) 한 눈금
  function liveNow(x) {
    var d = typeof x === 'string' ? { name: x } : x, A = liveArr(d); if (!A) return null;
    var dt = new Date(pickDate() + 'T00:00'), we = dt.getDay() === 0 || dt.getDay() === 6, h = nowH(), key = we ? 'we' : 'wd';
    return { n: A[key][h], max: liveMax(key, h), we: we, h: h, arr: A[key], other: A[we ? 'wd' : 'we'] };
  }
  function ring(pts, fill, stroke) { if (!pts || pts.length < 3) return; path(pts); ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = stroke; ctx.stroke(); }
  // ---------- 관할 · T-GIS · 길목(v0.10.74 — T-Book 교통관리 요청) ----------
  var JUR = [], TG = [], TGC = {}, SPOTS = [], SPA = [];
  var JUR_C = { seocho: ['rgba(37,99,235,.10)', '#2563eb'], bangbae: ['rgba(13,148,136,.12)', '#0d9488'], banpo: ['rgba(124,58,237,.10)', '#7c3aed'],
    yongsan: ['rgba(234,88,12,.06)', '#c2410c'], dongjak: ['rgba(22,163,74,.06)', '#15803d'], gwanak: ['rgba(202,138,4,.07)', '#a16207'], geumcheon: ['rgba(120,113,108,.06)', '#57534e'],
    gangnam: ['rgba(219,39,119,.06)', '#be185d'], suseo: ['rgba(147,51,234,.06)', '#7e22ce'], songpa: ['rgba(8,145,178,.06)', '#0e7490'], gwacheon: ['rgba(101,163,13,.07)', '#4d7c0f'], sujeong: ['rgba(225,29,72,.06)', '#be123c'] };
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
      (D.jur.stations || []).forEach(function (st) { var zz = JUR.filter(function (J) { return J.z.name === st.name; })[0]; dot(P(st.lon, st.lat), 7, zz && JUR_C[zz.z.id] ? JUR_C[zz.z.id][1] : '#2563eb', '#fff', { kind: 'jurst', st: st }); });
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
    if (it.kind === 'jur') { var z = it.J.z; h = '<h3>🚓 ' + esc(z.id === 'banpo' ? '반포동 — 서초서·방배서가 번지로 나눔' : z.name + ' 관할') + '</h3>' + row('행정동', esc(z.dongs.join(' · '))) + enfRows(z.name) + polStats(z.name) + '<p class="desc">' + esc(z.note) + '</p>' + (D.jur.src ? '<p class="desc">반포동 나눔 — ' + esc(D.jur.src) + '</p>' : '') + src(D.jur.law + ' · ' + D.jur.boundary); }
    else if (it.kind === 'jurst') { var st = it.st; h = '<h3>🚓 ' + esc(st.name) + '</h3>' + (st.addr ? row('청사', esc(st.addr)) : '') + (st.tel ? row('대표번호', esc(st.tel)) : '') + enfRows(st.name) + polStats(st.name) + src('경찰민원24 청사 좌표(T-Book PS_PTS)'); }
    else if (it.kind === 'tgis') { var t = it.t, pa = t.par ? TGC[t.par] : null; h = '<h3>🚥 ' + esc(t.name) + '</h3>' + row('T-GIS 교차로코드', String(t.c)) + row('관할', t.pe === 380 ? '서울방배경찰서' : '서울서초경찰서') + (t.par && t.par !== t.c ? row('연동교차로코드', t.par + ' → ' + (pa ? esc(pa.name) + ' · ' + Math.round(Math.hypot(pa.p[0] - t.p[0], pa.p[1] - t.p[1])) + 'm' : '이 구역 밖') + (/연등/.test(t.name) ? ' <em>(「(연등)」 종속 신호)</em>' : ' <em>(그 교차로에 딸려 도는 신호)</em>')) : '') + (t.cits ? row('C-ITS 번호', String(t.cits) + ' <em>(15m 안 같은 신호)</em>') : '') + src(D.tgis.source + ' · 신호 현시·주기는 이 표에 없다'); }
    else if (it.kind === 'spot') { var q = it.q, o = q.o, hh = spotHour(); h = '<h3>🎯 ' + esc(q.name) + '</h3>' + row('종류', o.t === 's' ? '지하철역' + (o.g === '경계' ? ' <em>(구 경계 — 이웃 구와 나눠 셈)</em>' : '') : '버스 정류장') + row(hh + '시 하차', o.h[hh].toLocaleString() + '명(하루 평균) · 서초 ' + it.rank + '위') + row('하루 하차', q.day.toLocaleString() + '명') + row('밤 22~01시 비중', Math.round(q.night * 100) + '%') + '<div class="cap">시간대별 하차 인원(명/시 · 0~23시 · 하루 평균 · 교통카드)</div>' + bar(o.h, o.t === 's' ? '#0284c7' : '#ea580c') + src(D.spot.source + ' · ' + D.spot.method); }
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
    else if (k === 'bus') { var fb = FLOW.bus[o.id]; if (fb) { h += onoffRows(fb); s = o.rg ? o.rg.source.bus : D.flow.bus.source; } else { h += row('하루 승하차', o.day.toLocaleString() + '명') + row('가장 붐비는 때', o.peak + '시') + '<div class="cap">시간대별 승차+하차 인원(명/시 · 0~23시 · 하루 평균)</div>' + bar(o.h, '#16a34a'); s = p.bus && p.bus.source; } }
    else if (k === 'subr') { var fs = FLOW.sub[q.name]; h += row('노선', esc((fs ? fs[2] : o.lines || []).join(' · '))); if (fs) { h += onoffRows(fs) + subTrend(q.name); s = o.rg ? o.rg.source.sub : D.flow.subway.source + (D.trend ? ' · 여러 해: ' + D.trend.subway.source : ''); } else { h += row('하루 승차', o.on.toLocaleString() + '명') + row('하루 하차', o.off.toLocaleString() + '명'); s = p.subway && p.subway.source; } }
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
      h += row('구분', esc(q.cat)) + (q.st ? row('대표번호', esc(q.o.tel)) + row('관할', esc(q.o.gu)) + enfRows(q.o.name || q.name || '') + polStats(q.o.name || q.name || '') : row('소속', esc(q.o.station) + (q.ctr ? ' · ' + esc(q.o.box) : '')) + row('주소', esc(q.o.addr))) +
        (q.st ? '' : row('자리', (q.o.approx ? '⚠ ' : '') + esc(q.o.locNote || '')));
      s = q.st ? S3.stations : ((q.ctr ? S3.centers : S3.boxes) + ' · ' + S3.loc);
    }
    else { h += row('갈래', esc(q.cat || '')) + (q.ref ? row('출구', esc(q.ref)) : '') + (k === 'pol' ? '<p class="desc">⚠ 경찰 관서는 OpenStreetMap 표기 그대로다(공식 목록 data/police-seocho.json 을 읽지 못했다).</p>' : ''); s = p.fac && p.fac.source; }
    return h + src(s || '');
  }
  // ---------- 🗺 바탕 지도(v0.10.76 · OSM 전 도로·물·녹지·철도·주차장) ----------
  //  소유자 「지금 지도가 거칠고 부족하고 허술해 보여 — 제대로 된 지도를 구현하자」. 간선 10개만 긋던 것을 OSM 도로 전부로.
  //  자료 공간은 P() 와 같다(평면 m · 127.01/37.49 기준). 종류별로 Path2D 를 한 번 만들고, 그릴 때는 캔버스 변환만 바꾼다(끌기·확대가 가볍다).
  // v0.10.90 바탕 = 조각(소유자 「서울시 전역·경기도 전역 · 조각조각 나누어 받게」) — 개관 1장(고속·주간선·큰 물·큰 숲·철도) + 8km 조각(data/base/t/ix_iz.json)
  //  화면에 걸린 조각만 받는다(배율 TILE_S 넘을 때) · 너무 많아지면 먼 조각부터 내려놓는다 · 꼴은 옛 base-seocho.json(tg-base/1)과 같다
  var OSM = null, OSMN = [], OSMLAB = [], WLAB = [], JLAB = [], OSMBN = {}, PACKS = [], OVP = null, TILES = {}, TLOAD = {}, BIDX = null, BSET = {}, TILE_S = 0.045, TMAX = 64, TBAKE = '';
  var RCLS = { m: '고속·도시고속', p: '주간선', s: '보조간선', t: '집산', r: '국지·주거', l: '연결로', v: '단지·서비스', f: '보행', c: '자전거' };
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
  var JR = /(사거리|삼거리|오거리|교차로|입구|네거리|IC|나들목|JC|분기점)$/;
  function addJunctions(cand, pk) {
    cand.sort(function (a, b) { return (JR.test(b[0]) ? 1 : 0) - (JR.test(a[0]) ? 1 : 0); });
    cand.forEach(function (c) {
      if (NODES.some(function (n) { return Math.hypot(n.p[0] - c[1][0], n.p[1] - c[1][1]) < 60; })) return;
      if (JLAB.some(function (o) { var d = Math.hypot(o.p[0] - c[1][0], o.p[1] - c[1][1]); return d < 25 || (o.name === c[0] && d < 150); })) return;
      JLAB.push({ name: c[0], p: c[1], major: JR.test(c[0]), pk: pk });
    });
  }
  function prepPack(B, key) {   // 한 묶음(개관 또는 조각)을 Path2D 로 — 이름표는 공용 목록에 key 를 달아 넣는다(내려놓을 때 같이 지운다)
    var K = { key: key, ov: key === 'ov', road: {}, green: { wood: new Path2D(), park: new Path2D(), pitch: new Path2D(), cem: new Path2D() }, water: new Path2D(), ww: [new Path2D(), new Path2D()], wwT: new Path2D(), rail: new Path2D(), railT: new Path2D(), pk: new Path2D() };
    if (B.tile) { var T = B.size; K.box = [B.tile[0] * T, B.tile[1] * T, (B.tile[0] + 1) * T, (B.tile[1] + 1) * T]; }
    var NM = B.names || [];
    Object.keys(B.roads || {}).forEach(function (c) {
      var R = K.road[c] = { n: new Path2D(), t: new Path2D(), b: new Path2D(), cnt: 0 };
      B.roads[c].forEach(function (f) { var pts = decLine(f, 2), fl = f[1]; addLine(fl & 2 ? R.t : fl & 1 ? R.b : R.n, pts); if (fl & 1) addLine(R.n, pts); R.cnt++;
        var nm = f[0] >= 0 ? NM[f[0]] : ''; if (!nm || fl & 2) return; var L = lenOf(pts), m = midOf(pts);
        if ('mpstr'.indexOf(c) >= 0 && L > 60) OSMLAB.push({ name: nm, c: c, p: m.p, ang: m.ang, L: L, pk: key, ov: K.ov });
        if (K.ov) return; var e = OSMBN[nm]; if (!e) { OSMBN[nm] = e = { name: nm, c: c, p: m.p, L: L, n: 0 }; OSMN.push(e); } e.n++; if (L > e.L) { e.p = m.p; e.L = L; e.c = c; } });
    });
    var PR = { m: 0, p: 1, s: 2, t: 3, r: 4 }; OSMLAB.sort(function (a, b) { return PR[a.c] - PR[b.c] || b.L - a.L; });
    var GK = { forest: 'wood', wood: 'wood', scrub: 'wood', park: 'park', garden: 'park', grass: 'park', grassland: 'park', recreation_ground: 'park', playground: 'park', golf_course: 'park', pitch: 'pitch', cemetery: 'cem' };
    function cen(pts) { var sx = 0, sy = 0; pts.forEach(function (q) { sx += q[0]; sy += q[1]; }); return [sx / pts.length, sy / pts.length]; }
    function area(pts) { var a = 0; for (var i = 0, j = pts.length - 1; i < pts.length; j = i++) a += pts[j][0] * pts[i][1] - pts[i][0] * pts[j][1]; return Math.abs(a) / 2; }
    (B.green || []).forEach(function (g) { addRings(K.green[GK[g[1]] || 'park'], g[2]); var nm = g[0] >= 0 ? NM[g[0]] : ''; if (nm && /공원|산|숲/.test(nm)) { var pts = decLine(g[2][0], 0), A = area(pts); if (A > 20000) WLAB.push({ name: nm, p: cen(pts), k: 'g', A: A, pk: key, ov: K.ov }); } });
    (B.water || []).forEach(function (w) { addRings(K.water, w[1]); var nm = w[0] >= 0 ? NM[w[0]] : ''; if (nm) { var pts = decLine(w[1][0], 0), A = area(pts); if (A > 300000 || /강$|천$|저수지$|호$/.test(nm)) WLAB.push({ name: nm, p: cen(pts), k: 'w', A: 1e9, big: A > 4000000 || /강$/.test(nm), pk: key, ov: K.ov }); } });   // 단지 안 연못·분수는 이름을 달지 않는다
    (B.waterways || []).forEach(function (w) { var pts = decLine(w, 3); addLine(w[2] & 2 ? K.wwT : K.ww[w[1] ? 1 : 0], pts); var nm = w[0] >= 0 ? NM[w[0]] : ''; if (nm && !(w[2] & 2) && lenOf(pts) > 300) { var m = midOf(pts); WLAB.push({ name: nm, p: m.p, ang: m.ang, k: 'ww', A: lenOf(pts), pk: key, ov: K.ov }); } });
    (B.rail || []).forEach(function (r) { var pts = decLine(r, 3); addLine(r[2] & 2 ? K.railT : K.rail, pts); });
    (B.parking || []).forEach(function (rr) { addRings(K.pk, rr); });
    WLAB.sort(function (a, b) { return b.A - a.A; });
    // 교차로 이름(v0.10.78 · 소유자 「삼거리·사거리 이름을 빠짐없이」) — 조각에 서울 C-ITS·OSM 이름 · 같은 이름 150m 안·다른 이름 25m 안은 하나만
    if (!K.ov) addJunctions((B.junctions || []).map(function (j) { return [j[0], [j[1], j[2]]]; }), key);
    return K;
  }
  function basePrep() {
    if (typeof Path2D === 'undefined') return;
    // 서초 둘레 T-GIS 신호 교차로·C-ITS(공공 자료) 이름을 먼저 — 조각 이름보다 앞에 선다
    var cand = []; TG.forEach(function (t) { if (!/연등/.test(t.name)) cand.push([t.name, t.p]); });
    if (PUB) PUB.sigx.forEach(function (q) { if (q.name && !/연등/.test(q.name)) cand.push([q.name, q.p]); });
    addJunctions(cand, 'pub');
    if (D.bidx) { BIDX = D.bidx; TBAKE = String(BIDX.bake || BIDX.total || ''); BIDX.tiles.forEach(function (t) { BSET[t[0] + '_' + t[1]] = t[2]; });
      // 새로 구운 조각이 올라오면 보관함의 옛 조각은 지운다(받은 지역 표시는 다시 받으라고 비워진다)
      if ('caches' in window) caches.open('tg-tiles').then(function (c) { c.keys().then(function (ks) { ks.forEach(function (r) { if (r.url.indexOf('b=' + encodeURIComponent(TBAKE)) < 0) c.delete(r); }); }); }).catch(function () {}); }
    if (D.ov) { OVP = prepPack(D.ov, 'ov'); OSM = OVP; }
  }
  function visTiles() { if (!BIDX) return []; var W = cv.clientWidth, H = cv.clientHeight, a = M(0, 0), b = M(W, H), T = BIDX.size, out = [];
    for (var ix = Math.floor(Math.min(a[0], b[0]) / T); ix <= Math.floor(Math.max(a[0], b[0]) / T); ix++) for (var iz = Math.floor(Math.min(a[1], b[1]) / T); iz <= Math.floor(Math.max(a[1], b[1]) / T); iz++) { var k = ix + '_' + iz; if (BSET[k]) out.push(k); }
    return out; }
  function tileUrl(k) { return 'data/base/t/' + k + '.json?b=' + encodeURIComponent(TBAKE); }
  var TQ = 0, TRAF = 0;
  function needTiles() { if (!BIDX || view.s < TILE_S) return; var vt = visTiles(); if (vt.length > 24) return;
    vt.forEach(function (k) { if (TILES[k] || TLOAD[k] || TQ >= 4) return; TLOAD[k] = 1; TQ++;
      fetch(tileUrl(k)).then(function (r) { if (!r.ok) throw 0; return r.json(); }).catch(function () { return caches.match(tileUrl(k), { ignoreSearch: true }).then(function (r) { if (!r) throw 0; return r.json(); }); }).then(function (j) { TILES[k] = prepPack(j, k); OSM = OSM || TILES[k]; trimTiles(); }).catch(function () {}).then(function () { TQ--; delete TLOAD[k]; if (!TRAF) TRAF = requestAnimationFrame(function () { TRAF = 0; draw(); }); }); }); }
  function trimTiles() { var ks = Object.keys(TILES); if (ks.length <= TMAX) return; var T = BIDX.size;
    ks.sort(function (a, b) { function d(k) { var q = k.split('_'); return Math.hypot((+q[0] + 0.5) * T - view.cx, (+q[1] + 0.5) * T - view.cy); } return d(b) - d(a); });
    ks.slice(0, ks.length - TMAX).forEach(function (k) { delete TILES[k]; var f = function (L) { return L.pk !== k; }; OSMLAB = OSMLAB.filter(f); WLAB = WLAB.filter(f); JLAB = JLAB.filter(f); }); }
  // ---------- 🗺 시·군·구 경계 · 📥 지역 받기(v0.10.90 · 소유자 「GPS 기반으로 구별·지역별로 받거나 골라서 받으면」·「인근 인접도 보이게」) ----------
  var SGG = [];
  function sggPrep() { if (!D.sgg) return; SGG = D.sgg.sgg.map(function (g) { return { g: g, rings: g.rings.map(function (r) { return r.map(function (q) { return P(q[0], q[1]); }); }), c: P(g.c[0], g.c[1]) }; }); }
  function drawSgg(dark) { if (!SGG.length) return; var s = view.s;
    SGG.forEach(function (G) { G.rings.forEach(function (r) { path(r); ctx.closePath(); ctx.setLineDash(s < 0.02 ? [6, 4] : [10, 6]); ctx.lineWidth = s < 0.02 ? 1.4 : 2; ctx.strokeStyle = dark ? 'rgba(203,213,225,.55)' : 'rgba(71,85,105,.55)'; ctx.stroke(); ctx.setLineDash([]); }); });
    if (s < 0.05) SGG.forEach(function (G) { if (s < 0.006 && G.g.sido === '인천광역시') return; label(G.c, G.g.name, s < 0.01 ? 11 : 13, dark ? '#e2e8f0' : '#334155', dark ? 'rgba(15,22,36,.7)' : 'rgba(255,255,255,.8)'); }); }
  function distToRings(pt, rings) { var inside = false, best = Infinity;
    rings.forEach(function (r) { if (inRing(r, pt[0], pt[1])) inside = true;
      for (var i = 1; i < r.length; i++) { var a = r[i - 1], b = r[i], dx = b[0] - a[0], dz = b[1] - a[1], L = dx * dx + dz * dz, u = L ? Math.max(0, Math.min(1, ((pt[0] - a[0]) * dx + (pt[1] - a[1]) * dz) / L)) : 0; best = Math.min(best, Math.hypot(a[0] + u * dx - pt[0], a[1] + u * dz - pt[1])); } });
    return inside ? 0 : best; }
  var DL_AROUND = 3000;   // 고른 구·시 경계 밖 이만큼(맞닿은 둘레)까지 함께 받는다 — 설계값
  function tilesForRings(rings) { if (!BIDX) return []; var T = BIDX.size, half = T * Math.SQRT1_2;
    return BIDX.tiles.filter(function (t) { var c = [(t[0] + 0.5) * T, (t[1] + 0.5) * T]; return distToRings(c, rings) <= DL_AROUND + half; }).map(function (t) { return t[0] + '_' + t[1]; }); }
  function tilesAround(p, R) { if (!BIDX) return []; var T = BIDX.size, half = T * Math.SQRT1_2;
    return BIDX.tiles.filter(function (t) { return Math.hypot((t[0] + 0.5) * T - p[0], (t[1] + 0.5) * T - p[1]) <= R + half; }).map(function (t) { return t[0] + '_' + t[1]; }); }
  function tbytes(ks) { return ks.reduce(function (a, k) { return a + (BSET[k] || 0); }, 0); }
  function mb(b) { return b >= 1048576 ? (b / 1048576).toFixed(1) + 'MB' : Math.max(1, Math.round(b / 1024)) + 'KB'; }
  var DLKEY = 'tg_map2d_dl';
  function dlDone() { try { return JSON.parse(localStorage.getItem(DLKEY) || '{}'); } catch (e) { return {}; } }
  function dlSave(o) { try { localStorage.setItem(DLKEY, JSON.stringify(o)); } catch (e) {} }
  var DLBUSY = false;
  function dlTiles(name, ks, msg, ext) { if (DLBUSY || !('caches' in window)) { msg('이 브라우저에서는 미리 받기를 쓸 수 없다'); return; } DLBUSY = true;
    ext = ext || []; var all = ks.slice(), n = 0, fail = 0, eb = ext.reduce(function (a, x) { return a + x.b; }, 0), q = ks.map(tileUrl).concat(ext.map(function (x) { return x.u; })), tot = q.length;
    caches.open('tg-tiles').then(function (c) {
      function next() { var u = q.shift(); if (!u) { DLBUSY = false; var o = dlDone(); o[name] = { n: all.length, b: tbytes(all) + eb, d: new Date().toISOString().slice(0, 10), bake: TBAKE, r: ext.length }; dlSave(o); paintDl(); msg('✅ ' + name + ' — 조각 ' + all.length + '개' + (ext.length ? ' + 행정동 자료 ' + ext.length + '개' : '') + '(' + mb(tbytes(all) + eb) + ') 받음' + (fail ? ' · 실패 ' + fail : '') + ' · 통신이 끊겨도 열린다'); return; }
        c.match(u).then(function (hitR) { if (hitR && u.indexOf('/data/r/') < 0 && u.indexOf('data/r/') !== 0) return; return c.add(u); }).catch(function () { fail++; }).then(function () { n++; msg('받는 중 ' + n + ' / ' + tot); next(); }); }
      next(); }); }
  function rFilesFor(G, full) {   // v0.10.91 고른 구의 행정동 자료(+ full 이면 둘레 3km 에 걸친 서울 구의 가벼운 자료) — 바탕 조각과 같은 보관함에(서비스워커가 통신 끊김 때 모든 보관함에서 꺼낸다)
    var o = []; rIdx().forEach(function (g) { var B = g.bytes || {}, me = g.name === G.g.name;
      if (!me) { if (!full) return; var S2 = SGG.filter(function (x) { return x.g.name === g.name && x.g.sido === '서울특별시'; })[0]; if (!S2) return;
        var near = S2.rings.some(function (r) { for (var i = 0; i < r.length; i += 4) if (distToRings(r[i], G.rings) <= DL_AROUND) return true; return false; }); if (!near) return; }
      o.push({ u: 'data/r/' + g.gu + '/dong.json', b: B.dong || 0 }); if (me) o.push({ u: 'data/r/' + g.gu + '/dongx.json', b: B.dongx || 0 }); });
    if (o.length) o.unshift({ u: 'data/r/index.json', b: 20000 }); return o; }
  function paintDl() { var el = $('m2dGetP'); if (!el || !el.classList.contains('on')) return; var done = dlDone(), h = '';
    h += '<div class="lg-h"><b>📥 지역 받기</b><button id="m2dGetX">닫기</button></div><p class="lg-n">화면에 보이는 곳은 저절로 받는다. 미리 받아 두면 <b>통신이 끊긴 곳에서도</b> 그 지역 지도가 열린다(고른 구·시 경계 밖 ' + (DL_AROUND / 1000) + 'km 둘레까지 함께).</p>';
    h += '<div class="lg-btns"><button data-dl="gps">📍 지금 위치 둘레 6km</button><button data-dl="view">🖥 지금 화면 둘레</button></div><div id="m2dGetMsg" class="lg-n"></div>';
    ['서울특별시', '경기도'].forEach(function (sd) { h += '<div class="lg"><b>' + sd + '</b><div class="dlg">' + SGG.filter(function (G) { return G.g.sido === sd; }).map(function (G) { var ks = tilesForRings(G.rings), d = done[G.g.name]; if (d && d.bake !== TBAKE) d = null;
      return '<button data-sg="' + esc(G.g.name) + '" class="' + (d ? 'on' : '') + '">' + (d ? '✓ ' : '') + esc(G.g.name) + ' <small>' + mb(tbytes(ks) + rFilesFor(G).reduce(function (a, x) { return a + x.b; }, 0)) + '</small></button>'; }).join('') + '</div></div>'; });
    var keys = Object.keys(done); h += '<div class="lg-btns"><button data-dl="clear">받은 지역 지우기' + (keys.length ? '(' + keys.length + ')' : '') + '</button></div><small class="lg-n">조각은 OSM 2026-10-03 기준(© OpenStreetMap contributors · ODbL) · 서울 구는 행정동 자료(주민·생활인구·카드 매출)도 함께 받는다 · 그 밖의 자료 층은 아직 서초 둘레</small>';
    el.innerHTML = h; }
  function dlMsg(t) { var m = $('m2dGetMsg'); if (m) m.textContent = t; }
  function dlClick(e) { var b = e.target.closest('button'); if (!b) return;
    if (b.id === 'm2dGetX') { $('m2dGetP').classList.remove('on'); return; }
    var sg = b.getAttribute('data-sg'), dl = b.getAttribute('data-dl');
    if (sg) { var G = SGG.filter(function (x) { return x.g.name === sg; })[0]; if (G) { var ks = tilesForRings(G.rings), rx = rFilesFor(G, true), rb = rx.reduce(function (a, x) { return a + x.b; }, 0); if (confirm(sg + ' 과 둘레 ' + (DL_AROUND / 1000) + 'km — 조각 ' + ks.length + '개' + (rx.length ? ' + 행정동 자료 ' + rx.length + '개' : '') + '(' + mb(tbytes(ks) + rb) + ')를 받을까요?')) dlTiles(sg, ks, dlMsg, rx); } return; }
    if (dl === 'view') { var c = [view.cx, view.cy], W = cv.clientWidth / view.s, H = cv.clientHeight / view.s, ks2 = tilesAround(c, Math.hypot(W, H) / 2 + 2000); if (ks2.length > 120) { dlMsg('화면이 너무 넓다 — 조금 확대한 뒤 받으세요'); return; } dlTiles('화면 둘레 ' + new Date().toLocaleDateString('ko-KR'), ks2, dlMsg); return; }
    if (dl === 'gps') { if (!navigator.geolocation) { dlMsg('위치를 쓸 수 없는 기기'); return; } dlMsg('위치를 잡는 중…'); navigator.geolocation.getCurrentPosition(function (pos) { var p = P(pos.coords.longitude, pos.coords.latitude), ks3 = tilesAround(p, 6000); if (!ks3.length) { dlMsg('지금 위치가 서울·경기 조각 밖이다'); return; } dlTiles('지금 위치 둘레(' + new Date().toLocaleDateString('ko-KR') + ')', ks3, dlMsg); }, function () { dlMsg('위치를 못 잡았다(권한 · 실내)'); }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 }); return; }
    if (dl === 'clear') { if (!confirm('미리 받은 지도 조각을 모두 지울까요?')) return; caches.delete('tg-tiles').then(function () { dlSave({}); paintDl(); dlMsg('지웠다'); }); } }
  if ($('m2dGetB')) $('m2dGetB').onclick = function () { var el = $('m2dGetP'); el.classList.toggle('on'); paintDl(); };
  if ($('m2dGetP')) $('m2dGetP').addEventListener('click', dlClick);
  function basePacks() { var out = [], vt = view.s >= TILE_S ? visTiles() : [], all = vt.length > 0 && vt.every(function (k) { return TILES[k]; });
    if (OVP && !all) out.push(OVP); vt.forEach(function (k) { if (TILES[k]) out.push(TILES[k]); }); return out; }
  function worldT() { var W = cv.clientWidth, H = cv.clientHeight; ctx.setTransform(DPR * view.s, 0, 0, DPR * view.s, DPR * (W / 2 - view.cx * view.s), DPR * (H / 2 - view.cy * view.s)); }
  function screenT() { ctx.setTransform(DPR, 0, 0, DPR, 0, 0); }
  function drawBaseAreas(dark) {
    needTiles(); PACKS = basePacks(); if (!PACKS.length) return; worldT();
    function each(f) { PACKS.forEach(f); }
    ctx.fillStyle = dark ? 'rgba(34,84,52,.55)' : '#cfe6bd'; each(function (K) { ctx.fill(K.green.park, 'evenodd'); });
    ctx.fillStyle = dark ? 'rgba(28,74,44,.75)' : '#b9dba3'; each(function (K) { ctx.fill(K.green.wood, 'evenodd'); });
    ctx.fillStyle = dark ? 'rgba(52,96,60,.6)' : '#bfe0b0'; each(function (K) { ctx.fill(K.green.pitch, 'evenodd'); });
    ctx.fillStyle = dark ? 'rgba(60,80,64,.5)' : '#d6e3cf'; each(function (K) { ctx.fill(K.green.cem, 'evenodd'); });
    if (view.s > 0.25) { ctx.fillStyle = dark ? 'rgba(80,92,110,.35)' : 'rgba(205,210,218,.75)'; each(function (K) { ctx.fill(K.pk, 'evenodd'); }); }
    ctx.fillStyle = dark ? '#1c3b5e' : '#a8d0f0'; each(function (K) { ctx.fill(K.water, 'evenodd'); });
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = dark ? '#2b5a8a' : '#8cc0ea';
    ctx.lineWidth = Math.max(1.6 / view.s, 9); each(function (K) { ctx.stroke(K.ww[1]); }); ctx.lineWidth = Math.max(1.2 / view.s, 4); each(function (K) { ctx.stroke(K.ww[0]); });
    ctx.setLineDash([4 / view.s, 3 / view.s]); ctx.lineWidth = Math.max(1 / view.s, 3); ctx.globalAlpha = 0.6; each(function (K) { ctx.stroke(K.wwT); }); ctx.globalAlpha = 1; ctx.setLineDash([]);
    screenT();
  }
  function drawBaseRoads(dark) {
    needTiles(); PACKS = basePacks(); if (!PACKS.length) return; worldT(); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; var s = view.s, mode = dark ? 4 : 3;   // 바탕 층을 꺼도 길 조각은 받는다
    function each(f) { PACKS.forEach(f); }
    function eachR(c, f) { PACKS.forEach(function (K) { var R = K.road[c]; if (R) f(R); }); }
    // 철도(지상 · 회색 + 흰 줄) — 지하 노선은 옅은 점선
    if (s > 0.05) { ctx.strokeStyle = dark ? '#64748b' : '#8b95a3'; ctx.lineWidth = Math.max(2.6 / s, 4); each(function (K) { ctx.stroke(K.rail); }); ctx.strokeStyle = dark ? '#0f1624' : '#ffffff'; ctx.lineWidth = Math.max(1.2 / s, 1.8); ctx.setLineDash([6 / s, 6 / s]); each(function (K) { ctx.stroke(K.rail); }); ctx.setLineDash([]); }
    else if (s > 0.008) { ctx.strokeStyle = dark ? '#64748b' : '#8b95a3'; ctx.lineWidth = 1.4 / s; each(function (K) { ctx.stroke(K.rail); }); }
    // 보행·자전거 길(가늘게 · 점선)
    ['f', 'c'].forEach(function (c) { var st = RSTY[c]; if (s < st[2]) return; ctx.strokeStyle = st[mode][0]; ctx.lineWidth = Math.max(st[1] / s, st[0]); ctx.setLineDash([3 / s, 2.5 / s]); eachR(c, function (R) { ctx.stroke(R.n); ctx.stroke(R.b); }); ctx.setLineDash([]); });
    // 지하차도·터널: 옅은 점선 한 겹
    RORD.forEach(function (c) { var st = RSTY[c]; if (s < st[2]) return; ctx.globalAlpha = 0.55; ctx.setLineDash([5 / s, 4 / s]); ctx.strokeStyle = st[mode][1]; ctx.lineWidth = Math.max(st[1] / s, st[0] * 0.8); eachR(c, function (R) { ctx.stroke(R.t); }); ctx.setLineDash([]); ctx.globalAlpha = 1; });
    // 테두리 → 채움(낮은 종류부터 — 큰길이 위로)
    RORD.forEach(function (c) { var st = RSTY[c]; if (s < st[2]) return; var w = Math.max(st[1] / s, st[0]); ctx.strokeStyle = st[mode][1]; ctx.lineWidth = w + Math.max(1.4 / s, w * 0.18); eachR(c, function (R) { ctx.stroke(R.n); }); });
    RORD.forEach(function (c) { var st = RSTY[c]; if (s < st[2]) return; var w = Math.max(st[1] / s, st[0]); ctx.strokeStyle = dark ? '#0b1220' : '#5b6472'; ctx.lineWidth = w + Math.max(2.4 / s, w * 0.3); if (s > 0.15) eachR(c, function (R) { ctx.stroke(R.b); }); ctx.strokeStyle = st[mode][0]; ctx.lineWidth = w; eachR(c, function (R) { ctx.stroke(R.n); }); });
    screenT();
  }
  function drawBaseLabels(dark) {
    if (!OSM) return; var boxes = [], seen = {}, W = cv.clientWidth, H = cv.clientHeight, s = view.s, zin = s >= TILE_S && PACKS.some(function (K) { return !K.ov; });
    function free(x, y, w, h) { for (var i = 0; i < boxes.length; i++) { var b = boxes[i]; if (x < b[0] + b[2] && x + w > b[0] && y < b[1] + b[3] && y + h > b[1]) return false; } boxes.push([x, y, w, h]); return true; }
    WLAB.forEach(function (L) { if (zin && L.ov) return; if (s < 0.012 && !(L.k === 'w' && L.big)) return; if ((L.k === 'g' && s < 0.12) || (L.k === 'ww' && s < 0.08)) return; var q = S(L.p); if (q[0] < -50 || q[0] > W + 50 || q[1] < -20 || q[1] > H + 20) return; if (seen['w' + L.name] && L.k !== 'w') return;
      ctx.font = (L.k === 'g' ? '600 ' : 'italic 700 ') + (L.k === 'w' ? 15 : 12) + 'px system-ui, sans-serif'; var tw = ctx.measureText(L.name).width; if (!free(q[0] - tw / 2, q[1] - 9, tw, 18)) return; seen['w' + L.name] = 1;
      ctx.save(); ctx.translate(q[0], q[1]); if (L.ang) { var a = L.ang; if (a > Math.PI / 2) a -= Math.PI; if (a < -Math.PI / 2) a += Math.PI; ctx.rotate(a); } ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 3; ctx.strokeStyle = dark ? 'rgba(15,22,36,.8)' : 'rgba(255,255,255,.85)'; ctx.strokeText(L.name, 0, 0); ctx.fillStyle = L.k === 'g' ? (dark ? '#86efac' : '#166534') : (dark ? '#7dd3fc' : '#1d5f99'); ctx.fillText(L.name, 0, 0); ctx.restore(); });
    JLAB.forEach(function (L) { if (s < (L.major ? 0.12 : 0.2)) return; var q = S(L.p); if (q[0] < -40 || q[0] > W + 40 || q[1] < -20 || q[1] > H + 20) return;
      ctx.font = '700 11px system-ui, sans-serif'; var tw = ctx.measureText(L.name).width; if (!free(q[0] - tw / 2 - 4, q[1] - 19, tw + 8, 15)) return;
      ctx.beginPath(); ctx.arc(q[0], q[1], 2.6, 0, Math.PI * 2); ctx.fillStyle = dark ? '#fde68a' : '#334155'; ctx.fill();
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineWidth = 3; ctx.strokeStyle = dark ? 'rgba(15,22,36,.9)' : 'rgba(255,255,255,.95)'; ctx.strokeText(L.name, q[0], q[1] - 11); ctx.fillStyle = dark ? '#fef3c7' : (L.major ? '#7c2d12' : '#334155'); ctx.fillText(L.name, q[0], q[1] - 11); });
    var lim = { m: 0.06, p: 0.08, s: 0.14, t: 0.22, r: 0.55 }, n = 0;
    for (var i = 0; i < OSMLAB.length && n < 90; i++) {
      var L = OSMLAB[i]; if (zin && L.ov) continue; if (s < lim[L.c]) continue; if (L.L * s < 50) continue;
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
    livePrep();
  }
  function livePrep() {   // v0.10.95 실시간 도시데이터는 서울 121장소(약 1MB) — 첫 그림 뒤에 읽는다
    var L = D.livep; if (!L) return; var seen = {}; LINKS = [];
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
  function salesOf(d) { return d.rg || d.pre ? d.sales || null : FLOW.sales[d.name] || null; }
  function salesNow(x) {
    var d = typeof x === 'string' ? { name: x } : x, s0 = salesOf(d); if (!s0) return null; var b = bandOf(nowH());
    if (SMX[b] == null) { var mx = 0; allDong().forEach(function (q) { var v = salesOf(q); if (v) mx = Math.max(mx, v.tb[b] / TBH[b]); }); SMX[b] = mx; }   // 서울 전체(받은 구까지) 한 눈금
    var perH = s0.tb[b] / TBH[b] / 30.4; return { perH: perH, t: Math.min(1, s0.tb[b] / TBH[b] / (SMX[b] || 1)), b: b };
  }
  function subTrend(nm) {   // 10년 추이(해마다 6월 · 하루 평균) — v0.10.77
    var T = D.trend && D.trend.subway && D.trend.subway.items[nm]; if (!T) return ''; var ys = Object.keys(T).sort(), hh = nowH();
    var tot = ys.map(function (y) { return T[y][0].reduce(function (a, b) { return a + b; }, 0) + T[y][1].reduce(function (a, b) { return a + b; }, 0); }), atH = ys.map(function (y) { return T[y][1][hh]; });
    var a = tot[0], b = tot[tot.length - 1];
    return row(ys[0] + '→' + ys[ys.length - 1], '하루 승하차 ' + man(a) + ' → ' + man(b) + ' <em>(' + (b >= a ? '+' : '') + Math.round((b - a) / (a || 1) * 100) + '% · 6월 기준)</em>') +
      '<div class="cap">해마다 하루 승하차 인원(명 · ' + ys[0] + '~' + ys[ys.length - 1] + ' · 그해 6월 하루 평균)</div>' + bar(tot, '#0284c7', ys.map(function (y) { return yLab(+y, 1)[0]; })) + '<div class="cap">해마다 ' + hh + '시 하차 인원(명/시 · 그해 6월 하루 평균)</div>' + bar(atH, '#ea580c', ys.map(function (y) { return yLab(+y, 1)[0]; }));
  }
  function salesTrend(x) {
    var d = typeof x === 'string' ? { name: x } : x, T, Q, tbl = d.rg ? d.rg.tb : D.flow.sales.tb;
    if (d.rg) { if (!d.x || !d.x.tr) return ''; T = {}; Q = d.rg.quarters; Q.forEach(function (q, i) { if (d.x.tr[i]) T[q] = d.x.tr[i]; }); }
    else { T = D.trend && D.trend.sales && D.trend.sales.items[d.name]; if (!T) return ''; Q = D.trend.sales.quarters; }
    var qs = Q.filter(function (q) { return T[q]; }); if (qs.length < 2) return ''; var b = bandOf(nowH());
    var lab = function (q) { return q.slice(2, 4) + '.' + q[4] + 'Q'; };
    return '<div class="cap">분기별 카드 매출(원 · 한 달 기준 · ' + lab(qs[0]) + '~' + lab(qs[qs.length - 1]) + ')</div>' + bar(qs.map(function (q) { return T[q][0]; }), '#6d28d9', qLab(qs), 'w') +
      '<div class="cap">분기별 주점·노래방류 카드 매출(원 · 한 달 기준)</div>' + bar(qs.map(function (q) { return T[q][7]; }), '#b45309', qLab(qs), 'w') + '<div class="cap">분기별 ' + esc(tbl[b]) + '시 카드 매출(원 · 한 달 기준 · 지금 시간대)</div>' + bar(qs.map(function (q) { return T[q][1 + b]; }), '#a78bfa', qLab(qs), 'w');
  }
  function salesRows(dd) {
    var d = typeof dd === 'string' ? { name: dd } : dd, x = salesOf(d); if (!x) return ''; var S5 = d.rg || d.pre ? { tb: (d.rg || d.pre).tb, source: (d.rg || d.pre).source['매출'] } : D.flow.sales, b = bandOf(nowH()), now = salesNow(d);
    var top = x.top.slice().sort(function (p, q) { return q[2 + b] - p[2 + b]; }).filter(function (t) { return t[2 + b] > 0; }).slice(0, 4);
    return row('카드 매출(추정)', '한 달 약 ' + won(x.amt) + ' · 결제 ' + man(x.cnt) + '건') + row('지금 시간대', esc(S5.tb[b]) + ' — 시간당 약 ' + won(now.perH) + ' <em>(하루 평균)</em>') +
      (top.length ? row('지금 많은 업종', top.map(function (t) { return esc(t[0]); }).join(' · ')) : '') +
      '<div class="cap">시간대별 시간당 카드 매출(원 · 하루 평균 · 0~6 … 21~24시)</div>' + bar(x.tb.map(function (v, i) { return v / TBH[i] / 30.4; }), '#7c3aed', LB_TB6, 'w') +
      '<div class="cap">요일별 카드 매출(원 · 한 달 동안 그 요일 합 · 월~일)</div>' + bar(x.dw, '#a78bfa', LB_DW, 'w') + (d.pre ? '' : salesTrend(d)) + '<div class="src">' + esc(S5.source) + (d.rg ? (d.x && d.x.tr ? ' · 추이: ' + esc(d.rg.source['추이']) : '') : d.pre ? '' : (D.trend ? ' · 추이: ' + esc(D.trend.sales.source) : '')) + '</div>';
  }
  function onoffC(a, b, al) { var c = a > b * 1.25 ? '37,99,235' : b > a * 1.25 ? '234,88,12' : '13,148,136'; return 'rgba(' + c + ',' + al + ')'; }
  function bar2(on, off) { var mx = 1, hh = nowH(), sm = [], sx = 1; for (var i = 0; i < 24; i++) { mx = Math.max(mx, on[i], off[i]); sm[i] = on[i] + off[i]; sx = Math.max(sx, sm[i]); }
    var sn = Math.min.apply(null, sm), lv = sm.map(function (v) { return hourLv(v, sx, sn); });
    return vxRow(sm, hh) + '<div class="bars h24 b2">' + on.map(function (v, i) { var op = i === hh ? 1 : lv[i] === 0 ? 0.35 : 0.7; return '<span class="hb' + (lv[i] === 2 ? ' b' : '') + (i === hh ? ' n' : '') + '"><i title="' + i + '시 승차" style="height:' + Math.round(v / mx * 100) + '%;background:#2563eb;opacity:' + op + '"></i><i title="' + i + '시 하차" style="height:' + Math.round(off[i] / mx * 100) + '%;background:#ea580c;opacity:' + op + '"></i></span>'; }).join('') + '</div>' + hourAxis(lv) +
      '<div class="hk"><i style="background:#2563eb"></i>승차 <i style="background:#ea580c"></i>하차 · <u></u>붐빔(승하차 합)' + (function () { var b = []; lv.forEach(function (l, i) { if (l === 2) b.push(i); }); var r = [], s0 = null; b.forEach(function (h, k) { if (s0 == null) s0 = h; if (b[k + 1] !== h + 1) { r.push(s0 === h ? s0 + '시' : s0 + '~' + h + '시'); s0 = null; } }); return r.length ? ' <b>' + r.join(' · ') + '</b>' : ''; })() + ' <i class="nw"></i>지금</div>'; }
  function onoffRows(f) {
    var hh = nowH(), on = f[0], off = f[1], so = on.reduce(function (a, b) { return a + b; }, 0), sf = off.reduce(function (a, b) { return a + b; }, 0);
    var pOn = on.indexOf(Math.max.apply(null, on)), pOff = off.indexOf(Math.max.apply(null, off)), a = on[hh], b = off[hh];
    return row(hh + '시', '승차 ' + a.toLocaleString() + ' · 하차 ' + b.toLocaleString() + '명 <em>(' + (a > b * 1.25 ? '떠나는 사람이 많다' : b > a * 1.25 ? '모여드는 사람이 많다' : '오가는 수가 비슷') + ')</em>') +
      row('하루', '승차 ' + so.toLocaleString() + ' · 하차 ' + sf.toLocaleString() + '명') + row('가장 붐빌 때', '타는 때 ' + pOn + '시 · 내리는 때 ' + pOff + '시') +
      '<div class="cap">시간대별 승차(파랑) · 하차(주황) 인원(명/시 · 하루 평균) — 아래 숫자 = 시각 · 빨간 밑줄 = 붐빔 · 검은 테 = 고른 시각</div>' + bar2(on, off);
  }
  function drawFlow(dark) {
    if (on.hot10 && D.hot10) D.hot10.spots.forEach(function (g) { var cnt = {}; g.rec.forEach(function (r) { cnt[r[0]] = (cnt[r[0]] || 0) + 1; }); var k = Object.keys(cnt).sort(function (a, b) { return cnt[b] - cnt[a]; })[0], q = P(g.lo, g.la);
      dot(q, 5 + Math.min(8, g.rec.length * 1.3), H10C[k] || '#475569', '#fff', { kind: 'hot10', g: g });
      if (view.s > 0.16) { var ys = g.rec.map(function (r) { return r[1]; }); label([q[0], q[1] + 18 / view.s], g.rec.length + '회 · ' + Math.min.apply(null, ys) + (ys.length > 1 ? '~' + Math.max.apply(null, ys) : ''), 10, dark ? '#e2e8f0' : '#1f2937', dark ? 'rgba(15,22,36,.75)' : 'rgba(255,255,255,.85)'); } });
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
  var H10C = { '보행자': '#2563eb', '보행노인': '#7c3aed', '보행어린이': '#ca8a04', '자전거': '#16a34a', '이륜차': '#dc2626', '화물차': '#78350f', '결빙': '#0891b2', '지자체별(전체)': '#475569' };
  function flowCard(it) {
    if (it.kind === 'hot10') { var g = it.g; return '<h3>🗂 ' + esc(g.n) + '</h3>' + row('뽑힌 횟수', g.rec.length + '회(' + g.rec.map(function (r) { return r[1]; }).filter(function (v, i, a) { return a.indexOf(v) === i; }).join(' · ') + ')') +
      g.rec.map(function (r) { return row(r[1] + ' ' + r[0], r[2] + '건 · 사상 ' + r[3] + ' (사망 ' + r[4] + ' · 중상 ' + r[5] + ' · 경상 ' + r[6] + ')'); }).join('') + '<p class="desc">' + esc(D.hot10.note) + '</p>' + src(D.hot10.source); }
    var h = '', L = D.livep || {};
    if (it.kind === 'osmroad') { var r = it.r; return '<h3>🛣 ' + esc(r.name) + '</h3>' + row('종류', esc(RCLS[r.c] || r.c)) + row('구간', r.n + '개(OSM 길 조각)') + src(D.osm.source); }
    if (it.kind === 'link') { var k = it.k; return '<h3>🚥 ' + esc(k.name || '도로') + '</h3>' + row('소통', '<b style="color:' + (IDXC[k.idx] || '#64748b') + '">' + esc(k.idx) + '</b> · ' + k.spd + 'km/h') + row('받은 때', esc(k.t || '-') + ' <em>(지금 소통이 아니다)</em>') + row('장소', esc(k.place)) + src(L.source || ''); }
    var o = it.L.o, cw = crowdAt(it.L), p = o.pop || {}, c = o.card;
    h = '<h3>📡 ' + esc(o.name) + ' <small style="font-weight:400;color:var(--ink2)">' + esc(o.cat) + '</small></h3>';
    if (cw) h += row(cw.kind === 'now' ? '지금' : cw.kind === 'fcst' ? '예측(' + esc(cw.t.slice(11, 16)) + ')' : '받은 때', '<b style="color:' + (LVC[cw.lvl] || '#64748b') + '">' + esc(cw.lvl) + '</b> · ' + (cw.min ? man(cw.min) + '~' + man(cw.max) + '명' : '-') + (cw.kind === 'old' ? ' <em>(' + esc(cw.t) + ' 값 — 지금이 아니다)</em>' : cw.kind === 'fcst' ? ' <em>(서울시 예측)</em>' : ''));
    if (p.msg) h += '<p class="desc">' + esc(p.msg) + '</p>';
    if (p.age) h += row('남·여', Math.round(p.male) + ' : ' + Math.round(100 - p.male) + ' · 상주 ' + Math.round(p.resnt) + '%') + '<div class="cap">지금 있는 사람의 연령대 비율(% · 10세 미만 … 70대 이상 · ' + esc(p.time) + ' 기준)</div>' + bar(p.age, '#0ea5e9', ageLab(p.age.length));
    if (p.fcst && p.fcst.length) h += '<div class="cap">앞으로 12시간 인구 예측(명 · 예측 범위의 상한 · ' + esc(p.fcst[0][0].slice(11, 16)) + '부터)</div>' + bar(p.fcst.map(function (f) { return f[3] || 0; }), '#64748b', p.fcst.map(function (f) { return String(f[0]).slice(11, 13) + '시'; }));
    if (c) { h += row('실시간 카드', '<b style="color:' + (LVC[c.lvl] || '#64748b') + '">' + esc(c.lvl) + '</b> · 결제 ' + c.cnt + '건 · ' + won(c.amin / 1e4) + '~' + won(c.amax / 1e4) + ' <em>(' + esc(String(c.time || '').replace(/^(\d{4})(\d\d)(\d\d) (\d\d)(\d\d)$/, '$2-$3 $4:$5')) + ' 표본)</em>');
      if (c.rsb && c.rsb.length) h += row('업종', c.rsb.map(function (x) { return esc(x[1]) + ' ' + esc(x[2]) + ' ' + (x[3] || 0) + '건'; }).join(' · '));
      if (c.age) h += '<div class="cap">실시간 카드 결제 연령대 비율(% · 최근 10분 · 10대 … 60대 이상)</div>' + bar(c.age, '#7c3aed', c.age.length === 6 ? LB_AGE6 : null); }
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
    ['night', '🌙 야간순찰', ['trd', 'bar', 'play', 'inn', 'er', 'pol', 'drunk', 'srcctv', 'srbell', 'srsvc']],
    ['shop', '🏪 상권분석', ['trd', 'rent', 'bus', 'subr', 'live']],
    ['acc10', '🚗 사고 10년', ['acc10', 'fatal10', 'hot10', 'cam', 'sz']],
    ['crowd', '🎪 행사·인파', ['evt', 'crowd', 'live', 'subr', 'bus', 'spot']],
    ['jur', '🚓 관할·관서', ['jur', 'pol', 'tgis', 'fire', 'er']],
    ['kids', '🧒 어린이', ['sz', 'szh', 'school', 'kids', 'pg']],
    ['acc', '🚑 사고·응급', ['acc', 'fatal', 'hot10', 'er', 'aed', 'pol', 'fire', 'cam', 'tow']]
  ];
  var KEEP = ['dong', 'road', 'base', 'bld', 'sub'];
  function preset(id) {
    var P3 = PRESETS.filter(function (x) { return x[0] === id; })[0]; if (!P3) return;
    LAYERS.forEach(function (l) { if (KEEP.indexOf(l[0]) < 0) on[l[0]] = false; }); on.dong = true; on.road = true; on.base = true;
    P3[2].forEach(function (k) { if (k in on) on[k] = true; }); saveOn(); paintLayers(); paintPre(); sel = null; show(null); draw(); summary();
  }
  function paintPre() {
    var el = $('m2dPre'); if (!el) return; var si = seasonInfo(); PRESETS = PRESETS.filter(function (x) { return x[0] !== 'season'; }); PRESETS.unshift(['season', si.icon + ' 지금 계절 · ' + si.short, si.keys]);
    el.innerHTML = '<button data-x="none" class="ctl">모두 끄기</button><button data-x="reset" class="ctl">처음대로</button><button data-x="biz" class="ctl biz">🏪 창업 자리 찾기</button><button data-x="rad" class="ctl biz">📐 반경 분석</button>' + PRESETS.map(function (x) { var act = LAYERS.every(function (l) { return KEEP.indexOf(l[0]) >= 0 || on[l[0]] === (x[2].indexOf(l[0]) >= 0); }); return '<button data-p="' + x[0] + '" class="' + (act ? 'on' : '') + '">' + x[1] + '</button>'; }).join('') +
      '';
    preFit();
  }
  // v0.10.92 소유자 「모두 끄기·처음대로는 왼쪽 맨 앞 · 화면을 넘으면 두 줄로」 — 한 줄에 다 들면 한 줄, 넘치면 두 줄(그래도 넘치면 옆으로 민다)
  function preFit() { var el = $('m2dPre'); if (!el) return; el.classList.remove('two'); if (el.scrollWidth > el.clientWidth + 2) el.classList.add('two'); }
  window.addEventListener('resize', preFit);
  // v0.10.82 모두 끄기(행정동·도로·바탕만 남김) · 처음대로(층마다 기본값) — 근무별 줄과 「☰ 모든 층」 판이 같이 쓴다
  function layersNone() { LAYERS.forEach(function (l) { on[l[0]] = false; }); on.dong = true; on.road = true; on.base = true; saveOn(); paintLayers(); paintPre(); sel = null; show(null); draw(); summary(); }
  function layersReset() { LAYERS.forEach(function (l) { on[l[0]] = l[2]; }); saveOn(); paintLayers(); paintPre(); draw(); summary(); }
  if ($('m2dPre')) { $('m2dPre').addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; var x = b.getAttribute('data-x'); if (x === 'biz') bizOpen(); else if (x === 'rad') radOpen(null); else if (x === 'none') layersNone(); else if (x === 'reset') layersReset(); else preset(b.getAttribute('data-p')); }); }
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
    var si = seasonInfo(), sn = seasonCount(si); if (sn) out.unshift('<button data-sp="1">' + si.icon + ' ' + esc(si.name) + ' — ' + esc(sn) + '</button>');
    el.innerHTML = '<b>' + h + '시</b> ' + out.join(' · ');
  }
  if ($('m2dSum')) $('m2dSum').addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; if (b.getAttribute('data-sp')) { preset('season'); return; } var t = SUMT[+b.getAttribute('data-s')]; if (!t) return;
    var k = t.it.kind === 'pub' ? t.it.layer : t.it.kind === 'crowd' ? 'crowd' : null; if (k && !on[k]) { on[k] = true; saveOn(); paintLayers(); paintPre(); }
    view.cx = t.p[0]; view.cy = t.p[1]; view.s = Math.max(view.s, 0.3); draw(); var s = S(t.p); sel = { x: s[0], y: s[1], r: 8, it: t.it }; show(t.it); draw(); });
  paintPre();
  // ---------- 🏪 상권분석(v0.10.78 · 소유자 「상권분석과 똑같이 · 어떤 업종에서 어떤 연령대가 카드를 어떻게 쓰는지 — 음주운전 예방 · 지역을 세세하게」) ----------
  //  서울시 상권분석서비스: 상권(골목·발달·전통시장) 74곳 영역 + 업종별 추정매출(시간대·연령·성별·요일 — 금액·건수) · 길단위 유동인구 · 직장·상주인구 · 점포 · 집객시설 · 상권변화지표.
  //  ind 칸: 0 업종 · 1 매출(만원) · 2 건수 · 3~8 시간대 매출 · 9~14 연령 매출 · 15 남 · 16 여 · 17~23 요일 · 24~29 시간대 건수 · 30~35 연령 건수
  var TRD = [], TRDM = 'sales', TRDI = '', TRDIL = [];   // TRDI = 고른 업종('' = 전부)
  var AGEL = ['10대', '20대', '30대', '40대', '50대', '60+'], TBL = ['0~6', '6~11', '11~14', '14~17', '17~21', '21~24'];
  var TRDMS = { sales: ['💳 그 시간대 매출', '#7c3aed'], amt: ['💰 한 달 매출', '#6d28d9'], atv: ['🧾 객단가(건당)', '#9333ea'], night: ['🌙 밤(21~6시) 매출 비중', '#1e3a8a'], young: ['🧑 20·30대 매출 비중', '#db2777'], bar: ['🍺 밤 주점·유흥 매출', '#b45309'],
    flp: ['🚶 그 시간대 유동인구', '#0284c7'], wrc: ['🏢 직장인구', '#0f766e'], job: ['🏢 직장/(직장+상주) 비율', '#0d9488'], stor: ['🏬 점포 수', '#475569'], dens: ['🏬 점포 밀도(곳/ha)', '#334155'], perstor: ['📈 점포당 매출', '#4d7c0f'], cls: ['📉 폐업 점포', '#dc2626'] };
  function isBar(n) { return /주점|유흥/.test(n); }
  function trdItem(t, m) { var rings = t.rings.map(function (r) { return r.map(function (q) { return P(q[0], q[1]); }); }); var r0 = rings[0], sx = 0, sy = 0; r0.forEach(function (q) { sx += q[0]; sy += q[1]; }); return { t: t, rings: rings, c: [sx / r0.length, sy / r0.length], m: m || null }; }
  function trdList() { var tot = {}; TRD.forEach(function (x) { (x.t.ind || []).forEach(function (i) { tot[i[0]] = (tot[i[0]] || 0) + i[1]; }); }); TRDIL = Object.keys(tot).sort(function (a, b) { return tot[b] - tot[a]; }); }
  function trdPrep() {
    var T = D.trdar; if (!T) return; var have = {}; TRD.forEach(function (x) { have[x.t.cd] = 1; });   // 서울 상권 파일이 먼저 왔으면 그쪽(1년 전 값 포함)을 둔다
    T.trdar.forEach(function (t) { if (!have[t.cd]) TRD.push(trdItem(t, null)); }); trdList();
  }
  function trdInd(t) { var ind = t.ind || []; return TRDI ? ind.filter(function (i) { return i[0] === TRDI; }) : ind; }
  function sumI(ind, k) { return ind.reduce(function (a, r) { return a + r[k]; }, 0); }
  function trdVal(t, m) {
    var b = bandOf(nowH()), ind = trdInd(t), stor = (t.stor || []).filter(function (s) { return !TRDI || s[0] === TRDI; });
    if (m === 'amt') return sumI(ind, 1);
    if (m === 'atv') { var co = sumI(ind, 2); return co ? sumI(ind, 1) * 1e4 / co : 0; }
    if (m === 'night') { var a0 = sumI(ind, 1); return a0 ? (sumI(ind, 3) + sumI(ind, 8)) / a0 * 100 : 0; }
    if (m === 'young') { var ag = sumI(ind, 9) + sumI(ind, 10) + sumI(ind, 11) + sumI(ind, 12) + sumI(ind, 13) + sumI(ind, 14); return ag ? (sumI(ind, 10) + sumI(ind, 11)) / ag * 100 : 0; }
    if (m === 'job') return t.wrc && t.rep && (t.wrc[0] + t.rep[0]) ? t.wrc[0] / (t.wrc[0] + t.rep[0]) * 100 : 0;
    if (m === 'dens') return t.area ? stor.reduce(function (a, s) { return a + s[1]; }, 0) / (t.area / 1e4) : 0;
    if (m === 'perstor') { var n = stor.reduce(function (a, s) { return a + s[1]; }, 0); return n ? sumI(ind, 1) / n : 0; }
    if (m === 'stor') return stor.reduce(function (a, s) { return a + s[1]; }, 0);
    if (m === 'cls') return stor.reduce(function (a, s) { return a + s[4]; }, 0);
    if (m === 'sales') return ind.reduce(function (a, i) { return a + i[3 + b]; }, 0) / TBH[b] / 30.4;
    if (m === 'bar') return ind.filter(function (i) { return isBar(i[0]); }).reduce(function (a, i) { return a + i[3] + i[8]; }, 0);
    if (m === 'flp') return t.flp ? t.flp[9 + b] / TBH[b] / 91 : 0;
    if (m === 'wrc') return t.wrc ? t.wrc[0] : 0;
    return 0;
  }
  function trdFmt(v, m) { return m === 'sales' ? '시간당 ' + won(v) : m === 'bar' || m === 'amt' ? '한 달 ' + won(v) : m === 'perstor' ? '점포당 ' + won(v) : m === 'atv' ? Math.round(v).toLocaleString() + '원' : m === 'night' || m === 'young' || m === 'job' ? Math.round(v) + '%' : m === 'dens' ? v.toFixed(1) + '곳/ha' : m === 'flp' ? '시간당 약 ' + man(v) + '명' : m === 'wrc' ? man(v) + '명' : Math.round(v) + '곳'; }
  function trdMetricName() { return TRDMS[TRDM][0]; }
  function trdLegend() {
    if (!on.trd || !TRD.length) return null; var vs = TRD.map(function (x) { return trdVal(x.t, TRDM); }), mx = Math.max.apply(null, vs), mn = Math.min.apply(null, vs);
    return ['🏪 상권분석 — ' + (TRDI ? TRDI + ' · ' : '') + TRDMS[TRDM][0], '<div class="lg-btns"><button data-bizopen="1">🏪 이 업종 창업 자리 찾기</button></div><div class="lg-btns"><select data-trdi aria-label="업종"><option value="">업종 전부</option>' + TRDIL.map(function (n) { return '<option' + (n === TRDI ? ' selected' : '') + '>' + esc(n) + '</option>'; }).join('') + '</select></div><div class="lg-btns">' + Object.keys(TRDMS).map(function (k) { return '<button data-trdm="' + k + '" class="' + (k === TRDM ? 'on' : '') + '">' + TRDMS[k][0] + '</button>'; }).join('') + '</div>' +
      grad('rgba(255,255,255,.4)', TRDMS[TRDM][1], trdFmt(mn, TRDM), trdFmt(mx, TRDM)) + li('#64748b', '굵은 테 = 발달상권 · 가는 테 = 골목상권 · 점선 = 전통시장', 'line') + '<small class="lg-n">상권을 누르면 업종 × 연령 · 업종 × 시간대 표</small>'];
  }
  function hexA(c, a) { var n = parseInt(c.slice(1), 16); return 'rgba(' + (n >> 16) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')'; }
  function drawTrd(dark) {
    if (!on.trd || !TRD.length) return; var vs = TRD.map(function (x) { return trdVal(x.t, TRDM); }), mx = Math.max.apply(null, vs) || 1, col = TRDMS[TRDM][1];
    TRD.forEach(function (x, k) { var t = vs[k] / mx;
      x.rings.forEach(function (r) { path(r); ctx.closePath(); ctx.fillStyle = hexA(col, 0.08 + 0.62 * t); ctx.fill(); ctx.lineWidth = x.t.se === '발달상권' ? 2.4 : 1.2; ctx.setLineDash(x.t.se === '전통시장' ? [4, 3] : []); ctx.strokeStyle = col; ctx.stroke(); ctx.setLineDash([]); });
      var s = S(x.c); hit.push({ x: s[0], y: s[1], r: 12, it: { kind: 'trd', x: x } });
      if (view.s > 0.11) { label(x.c, x.t.name, 11, '#fff', hexA(col, 0.85)); if (view.s > 0.2) label([x.c[0], x.c[1] + 16 / view.s], trdFmt(vs[k], TRDM), 10, dark ? '#e2e8f0' : '#1f2937', dark ? 'rgba(15,22,36,.75)' : 'rgba(255,255,255,.88)'); }
    });
  }
  function pct(a, b) { return b ? Math.round(a / b * 100) : 0; }
  function indTable(ind, mode, n) {   // 업종 × (연령|시간대) — 칸 = 그 업종 안 비중(%) · 가장 큰 칸은 진하게
    var top = ind.slice().sort(function (a, b) { return b[1] - a[1]; }).slice(0, n || 8), cols = mode === 'age' ? AGEL : TBL, o = mode === 'age' ? 9 : 3, hh = bandOf(nowH());
    return '<table class="it"><tr><th>업종</th>' + cols.map(function (c, i) { return '<th' + (mode === 'tb' && i === hh ? ' class="now"' : '') + '>' + c + '</th>'; }).join('') + '</tr>' +
      top.map(function (r) { var tot = 0; for (var i = 0; i < 6; i++) tot += r[o + i]; var mxi = 0; for (i = 1; i < 6; i++) if (r[o + i] > r[o + mxi]) mxi = i;
        return '<tr' + (isBar(r[0]) ? ' class="bar"' : '') + '><td>' + esc(r[0]) + '</td>' + [0, 1, 2, 3, 4, 5].map(function (i) { var p = pct(r[o + i], tot); return '<td style="background:rgba(124,58,237,' + (p / 100 * 0.9).toFixed(2) + ')' + (i === mxi ? ';font-weight:800' : '') + '">' + p + '</td>'; }).join('') + '</tr>'; }).join('') + '</table>';
  }
  function barRows(ind, unit) {   // 🍺 주점·유흥 — 음주운전 예방에 쓰는 줄
    var bars = ind.filter(function (r) { return isBar(r[0]); }); if (!bars.length) return row('🍺 주점·유흥', '이 자료에 없음');
    var S2 = function (k) { return bars.reduce(function (a, r) { return a + r[k]; }, 0); }, amt = S2(1), night = S2(3) + S2(8), nCo = S2(24) + S2(29), all = ind.reduce(function (a, r) { return a + r[1]; }, 0);
    var ag = [0, 1, 2, 3, 4, 5].map(function (i) { return S2(9 + i); }), agt = ag.reduce(function (a, b) { return a + b; }, 0), ac = [0, 1, 2, 3, 4, 5].map(function (i) { return S2(30 + i); });
    var tbs = [0, 1, 2, 3, 4, 5].map(function (i) { return S2(24 + i); });
    return row('🍺 주점·유흥', esc(bars.map(function (r) { return r[0]; }).join('·')) + ' — 한 달 ' + won(amt) + ' (' + unit + ' 매출의 ' + pct(amt, all) + '%)') +
      row('밤 21~6시', '매출의 ' + pct(night, amt) + '% · 결제 하루 약 ' + Math.round(nCo / 30.4).toLocaleString() + '건') +
      row('누가', AGEL.map(function (a, i) { return a + ' ' + pct(ag[i], agt) + '%'; }).join(' · ') + ' <em>(20·30대 ' + pct(ag[1] + ag[2], agt) + '%)</em>') +
      '<div class="cap">주점·유흥 시간대별 카드 결제 건수(건 · 한 달 · 0~6 … 21~24시)</div>' + bar(tbs, '#b45309', LB_TB6) +
      '<div class="cap">주점·유흥 연령대별 카드 결제 건수(건 · 한 달 · 10대 … 60세 이상)</div>' + bar(ac, '#d97706', LB_AGE6) +
      '<p class="desc">음주 단속·순찰 참고 — 술자리 결제가 몰리는 시간·연령이다. 결제 = 카드 추정치(현금 제외)이고, 결제한 사람이 운전한다는 뜻은 아니다.</p>';
  }
  function trdCard(it) {
    var t = it.x.t, MT = it.x.m || D.trdar, h = '<h3>🏪 ' + esc(t.name) + ' <small style="font-weight:400;color:var(--ink2)">' + esc(t.se) + '</small></h3>', ind = t.ind || [], Q = MT.quarter, b = bandOf(nowH());
    if (it.biz) h += bizWhy(it.biz);
    rentLoad();
    h += '<div class="lg-btns"><button data-radhere="' + (it.x.c[0] / KX + LON0).toFixed(5) + ',' + (LAT0 - it.x.c[1] / KY).toFixed(5) + '">📐 여기서 반경 분석</button></div>';
    h += row('자리', (t.guName ? esc(t.guName) + ' ' : '') + esc(t.dong) + ' · 넓이 ' + man(t.area) + '㎡') + (t.ix ? row('상권 변화', '<b>' + esc(t.ix[0]) + '</b> · 운영 평균 ' + t.ix[1] + '개월 · 폐업 평균 ' + t.ix[2] + '개월' + (t.ix[3] ? ' <em>(서울 평균 ' + t.ix[3] + ' · ' + t.ix[4] + ')</em>' : '')) : '');
    if (ind.length) { var amt = ind.reduce(function (a, r) { return a + r[1]; }, 0), co = ind.reduce(function (a, r) { return a + r[2]; }, 0), S3 = function (k) { return ind.reduce(function (a, r) { return a + r[k]; }, 0); };
      h += row('카드 매출(추정)', '한 달 ' + won(amt) + ' · 결제 ' + man(co) + '건 <em>(' + Q.slice(0, 4) + '년 ' + Q[4] + '분기)</em>') + yoyRow(t, MT) + row('남·여', pct(S3(15), S3(15) + S3(16)) + ' : ' + pct(S3(16), S3(15) + S3(16)));
      h += row('지금 시간대', TBL[b] + '시 — 시간당 약 ' + won(S3(3 + b) / TBH[b] / 30.4) + ' · 많은 업종 ' + ind.slice().sort(function (p, q) { return q[3 + b] - p[3 + b]; }).slice(0, 3).map(function (r) { return esc(r[0]); }).join(' · '));
      h += '<div class="cap">시간대별 시간당 카드 매출(원 · 하루 평균 · 0~6 … 21~24시)</div>' + bar([0, 1, 2, 3, 4, 5].map(function (i) { return S3(3 + i) / TBH[i] / 30.4; }), '#7c3aed', LB_TB6, 'w') + '<div class="cap">연령대별 카드 매출(원 · 한 달 · 10대 … 60세 이상)</div>' + bar([0, 1, 2, 3, 4, 5].map(function (i) { return S3(9 + i); }), '#a78bfa', LB_AGE6, 'w') + '<div class="cap">요일별 카드 매출(원 · 한 달 동안 그 요일 합 · 월~일)</div>' + bar([0, 1, 2, 3, 4, 5, 6].map(function (i) { return S3(17 + i); }), '#c4b5fd', LB_DW, 'w');
      var co2 = S3(2), wk = S3(17) + S3(18) + S3(19) + S3(20) + S3(21), we = S3(22) + S3(23), lunch = S3(5), eve = S3(7), nite = S3(8) + S3(3), pk = Math.max(lunch, eve, nite);
      h += row('객단가', (co2 ? Math.round(amt * 1e4 / co2).toLocaleString() : '-') + '원(건당 결제) · 주중 ' + pct(wk, wk + we) + '% · 주말 ' + pct(we, wk + we) + '%');
      h += row('피크', (pk === lunch ? '점심형(11~14시)' : pk === eve ? '저녁형(17~21시)' : '야간형(21~6시)') + ' — 점심 ' + pct(lunch, amt) + '% · 저녁 ' + pct(eve, amt) + '% · 밤 ' + pct(nite, amt) + '%');
      var nst = (t.stor || []).reduce(function (a, s) { return a + s[1]; }, 0); if (nst) h += row('경쟁·밀집', '점포 ' + nst + '곳 · ' + (nst / (t.area / 1e4)).toFixed(1) + '곳/ha · 점포당 한 달 ' + won(amt / nst));
      if (t.wrc && t.rep) { var jr = pct(t.wrc[0], t.wrc[0] + t.rep[0]); h += row('배후 수요', (jr >= 70 ? '직장 중심' : jr <= 30 ? '주거 배후' : '직장·주거 혼합') + ' — 직장 ' + man(t.wrc[0]) + ' · 상주 ' + man(t.rep[0]) + (t.flp ? ' · 하루 유동 ' + man(t.flp[0] / 91) : '')); }
      h += rentRows(it.x.c, '임대료(가까운 표본)');
      h += '<div class="cap">업종별 객단가 · 피크 · 점포(매출 많은 업종 8)</div>' + indCompare(t);
      h += barRows(ind, '이 상권');
      h += '<div class="cap">업종 × 연령(그 업종 매출 안 비중 % · 매출 많은 업종 8)</div>' + indTable(ind, 'age') + '<div class="cap">업종 × 시간대(그 업종 매출 안 비중 % · 테두리 = 지금)</div>' + indTable(ind, 'tb'); }
    else h += row('카드 매출', '이 상권은 매출 자료가 없다');
    if (t.flp) { var f = t.flp; h += row('유동인구', '분기 ' + man(f[0]) + '명 · 하루 약 ' + man(f[0] / 91) + ' · 남 ' + pct(f[1], f[0]) + '%') + '<div class="cap">시간대별 유동인구(명/시 · 하루 평균 · 0~6 … 21~24시)</div>' + bar([0, 1, 2, 3, 4, 5].map(function (i) { return f[9 + i] / TBH[i] / 91; }), '#0284c7', LB_TB6) + '<div class="cap">연령대별 유동인구(명 · 한 분기 합 · 10대 … 60세 이상)</div>' + bar(f.slice(3, 9), '#38bdf8', LB_AGE6); }
    if (t.wrc) h += row('직장인구', man(t.wrc[0]) + '명 · 20·30대 ' + pct(t.wrc[4] + t.wrc[5], t.wrc[0]) + '%');
    if (t.rep) h += row('상주인구', man(t.rep[0]) + '명 · 가구 ' + man(t.rep[9]) + '(아파트 ' + man(t.rep[10]) + ')');
    if (t.stor && t.stor.length) { var st = t.stor.slice().sort(function (p, q) { return q[1] - p[1]; }), sn = st.reduce(function (a, s) { return a + s[1]; }, 0); h += row('점포', sn + '곳 · 개업 ' + st.reduce(function (a, s) { return a + s[3]; }, 0) + ' · 폐업 ' + st.reduce(function (a, s) { return a + s[4]; }, 0) + ' · 많은 업종 ' + st.slice(0, 4).map(function (s) { return esc(s[0]) + ' ' + s[1]; }).join(' · ')); }
    if (t.fac) { var FN = MT.fields.fac, fs = t.fac.map(function (v, i) { return v ? FN[i] + ' ' + v : ''; }).filter(Boolean); if (fs.length) h += row('집객시설', esc(fs.join(' · '))); }
    if (t.tr) { var qs = Object.keys(t.tr).sort(); h += '<div class="cap">분기별 카드 매출(원 · 한 달 기준 · ' + qs[0].slice(2, 4) + '.' + qs[0][4] + 'Q~' + qs[qs.length - 1].slice(2, 4) + '.' + qs[qs.length - 1][4] + 'Q)</div>' + bar(qs.map(function (q) { return t.tr[q][0]; }), '#6d28d9', qLab(qs), 'w') + '<div class="cap">분기별 밤(21~6시) 카드 매출(원 · 한 달 기준)</div>' + bar(qs.map(function (q) { return t.tr[q][2]; }), '#1e3a8a', qLab(qs), 'w') + '<div class="cap">분기별 주점·유흥 카드 매출(원 · 한 달 기준)</div>' + bar(qs.map(function (q) { return t.tr[q][1]; }), '#b45309', qLab(qs), 'w'); }
    return h + '<p class="desc">' + esc(MT.note) + '</p>' + src(MT.source);
  }
  // ---------- 💰 상가 임대료·공실률(v0.10.93 · 한국부동산원 상업용부동산 임대동향조사 · 표본 상권 72곳) ----------
  var RENT = null, RENTP = null;
  function rentLoad() { if (RENTP) return RENTP; RENTP = fetch('data/r/rent.json').then(function (r) { return r.json(); }).then(function (j) { RENT = j; j.items.forEach(function (it) { it.p = P(it.lon, it.lat); }); draw(); }).catch(function () { RENT = null; }); return RENTP; }
  function rentNear(q, max) { if (!RENT) return null; var b = null, bd = max || 1500; RENT.items.forEach(function (it) { var d = Math.hypot(it.p[0] - q[0], it.p[1] - q[1]); if (d < bd) { bd = d; b = it; } }); return b ? { it: b, d: Math.round(bd) } : null; }
  function lastV(a) { if (!a) return null; for (var i = a.length - 1; i >= 0; i--) if (a[i] != null) return a[i]; return null; }
  function rentRows(q, title) {   // 가까운 부동산원 표본 상권 — 그 상권 자체 값이 아니다
    var R2 = rentNear(q, 1500); if (!R2) return RENT ? row('임대료', '<em>1.5km 안 부동산원 표본 상권 없음</em>') : '';
    var it = R2.it, Q = RENT.quarters, ql = Q[Q.length - 1], s1 = lastV(it.s), m1 = lastV(it.m), c1 = lastV(it.c);
    var won33 = function (v) { return v != null ? ' <small>(33㎡·10평이면 월 약 ' + Math.round(v * 33 / 10) + '만원)</small>' : ''; };
    return row(title || '임대료', '<b>' + esc(it.name) + '</b> <em>(부동산원 표본 상권 · ' + R2.d + 'm · ' + ql.slice(0, 4) + '년 ' + ql.slice(5) + '분기)</em>') +
      (s1 != null ? row('소규모 상가', s1 + '천원/㎡' + won33(s1) + (lastV(it.vs) != null ? ' · 공실 ' + lastV(it.vs) + '%' : '')) : '') +
      (m1 != null ? row('중대형 상가', m1 + '천원/㎡' + won33(m1) + (lastV(it.vm) != null ? ' · 공실 ' + lastV(it.vm) + '%' : '')) : '') +
      (c1 != null ? row('집합 상가', c1 + '천원/㎡' + won33(c1)) : '');
  }
  function rentCard(it) {
    var Q = RENT.quarters, L = Q.map(function (q) { return "'" + q.slice(2, 4) + '.' + q.slice(5); });
    var h = '<h3>💰 ' + esc(it.name) + ' <small style="font-weight:400;color:var(--ink2)">' + esc(it.grp) + ' · 부동산원 표본 상권</small></h3>' + row('대표 자리', esc(it.how) + ' <em>(상권 경계는 공개되지 않는다)</em>');
    [['s', '소규모 상가'], ['m', '중대형 상가'], ['c', '집합 상가']].forEach(function (k) { if (it[k[0]]) h += row(k[1], lastV(it[k[0]]) + '천원/㎡ · 33㎡(10평)이면 월 약 ' + Math.round(lastV(it[k[0]]) * 3.3) + '만원') + '<div class="cap">' + k[1] + ' 임대료 분기별(천원/㎡ · 한 달 · 전용+공용 면적)</div>' + bar(it[k[0]].map(function (v) { return v || 0; }), '#b45309', L); });
    [['vs', '소규모 상가'], ['vm', '중대형 상가']].forEach(function (k) { if (it[k[0]]) h += '<div class="cap">' + k[1] + ' 공실률 분기별(% · 빈 점포 면적 비율)</div>' + bar(it[k[0]].map(function (v) { return v || 0; }), '#64748b', L); });
    var A = RENT.agg['서울']; if (A && A.m) h += row('서울 평균', '중대형 ' + lastV(A.m) + '천원/㎡ · 공실 ' + lastV(A.vm) + '% · 소규모 ' + lastV(A.s) + '천원/㎡ · 공실 ' + lastV(A.vs) + '%');
    h += '<div class="lg-btns"><button data-radhere="' + it.lon + ',' + it.lat + '">📐 여기서 반경 분석</button></div>';
    return h + '<p class="desc">' + esc(RENT.note) + '</p>' + src(RENT.source);
  }
  function drawRent(dark) {
    if (!on.rent) return; if (!RENT) { rentLoad(); return; }
    RENT.items.forEach(function (it) { var v = lastV(it.m) || lastV(it.s); dot(it.p, 6 + Math.min(10, (v || 0) / 15), 'rgba(180,83,9,.75)', '#fff', { kind: 'rent', it: it });
      if (view.s > 0.035) label([it.p[0], it.p[1] - 16 / view.s], it.name + (v ? ' ' + v : ''), 10.5, dark ? '#fde68a' : '#78350f', dark ? 'rgba(15,22,36,.75)' : 'rgba(255,255,255,.88)'); });
  }
  function yoyRow(t, MT) {   // 1년 전 같은 분기보다(지금도 있는 업종끼리)
    if (!t.indp) return ''; var a = 0, b = 0; (t.ind || []).forEach(function (r) { var q = t.indp[r[0]]; if (q && q[0] > 0) { a += r[1]; b += q[0]; } }); if (!b) return '';
    var ps = t.storp ? Object.keys(t.storp).reduce(function (x, k) { return x + t.storp[k]; }, 0) : 0, ns = (t.stor || []).reduce(function (x, s2) { return x + s2[1]; }, 0);
    return row('1년 전보다', (a >= b ? '+' : '') + Math.round((a - b) / b * 100) + '% 매출 <em>(' + (MT.prev || '').slice(0, 4) + '년 ' + (MT.prev || '').slice(4) + '분기 대비 · 같은 업종끼리)</em>' + (ps ? ' · 점포 ' + ps + ' → ' + ns : ''));
  }
  function indCompare(t) {   // 업종 | 한 달 매출 | 객단가 | 피크 | 점포(개업/폐업) — 같은 업종 경쟁
    var st = {}; (t.stor || []).forEach(function (s) { st[s[0]] = s; });
    var yy = !!t.indp;
    return '<table class="it"><tr><th>업종</th><th>한 달</th>' + (yy ? '<th>1년</th>' : '') + '<th>객단가</th><th>피크</th><th>점포</th></tr>' + (t.ind || []).slice().sort(function (a, b) { return b[1] - a[1]; }).slice(0, 8).map(function (r) {
      var pkI = 0; for (var i = 1; i < 6; i++) if (r[3 + i] > r[3 + pkI]) pkI = i; var s2 = st[r[0]], q = yy && t.indp[r[0]];
      return '<tr' + (isBar(r[0]) ? ' class="bar"' : '') + '><td>' + esc(r[0]) + '</td><td>' + won(r[1]) + '</td>' + (yy ? '<td>' + (q && q[0] > 0 ? (r[1] >= q[0] ? '+' : '') + Math.round((r[1] - q[0]) / q[0] * 100) + '%' : '-') + '</td>' : '') + '<td>' + (r[2] ? Math.round(r[1] * 1e4 / r[2]).toLocaleString() : '-') + '</td><td>' + TBL[pkI] + '</td><td>' + (s2 ? s2[1] + (s2[3] || s2[4] ? ' <small>+' + s2[3] + '/−' + s2[4] + '</small>' : '') : '-') + '</td></tr>'; }).join('') + '</table>';
  }
  function rDongCard(d) {   // 서울 다른 구의 동 — 지역 자료 하나로(서초 동 카드와 같은 줄 차례)
    rExt(d); var p = d.pop, R = d.rg, J = jurAtM(d.c), h = '<h3>🏘 ' + esc(d.gu + ' ' + d.name) + '</h3>';
    if (J) h += row('경찰서 관할', esc(J.z.name) + ' <em>(이 지도가 그린 관할 안)</em>');
    if (p) { h += row('주민', p.tot.toLocaleString() + '명') + row('19세 이하', Math.round((p.age[0] + p.age[1]) / p.tot * 100) + '%') + row('70세 이상', Math.round((p.age[7] + p.age[8] + p.age[9]) / p.tot * 100) + '%');
      h += '<div class="cap">주민 연령대별 인구(명 · 주민등록 · 0~9세 … 90~99세)</div>' + bar(p.age, '#8b5cf6', ageLab(p.age.length)); }
    var lv = liveNow(d);
    if (lv) h += row('생활인구 지금', lv.n.toLocaleString() + '명 <em>(' + (lv.we ? '주말' : '평일') + ' ' + lv.h + '시 평균)</em>') + row('하루 폭', Math.min.apply(null, lv.arr).toLocaleString() + ' ~ ' + Math.max.apply(null, lv.arr).toLocaleString() + '명') +
      '<div class="cap">시간대별 생활인구(명 · 그 시각 동 안에 있는 사람 · 0~23시 ' + (lv.we ? '주말' : '평일') + ' 평균)</div>' + bar(lv.arr, '#f97316');
    h += salesRows(d) + dongIndRows(d);
    if (d.old) { var o = { name: '옛 ' + d.old.name, live: d.old.live, sales: d.old.sales, pre: R };
      h += '<p class="desc">이 동은 옛 ' + esc(d.old.name) + '에서 나뉘었다 — 생활인구(2026.7)·카드 매출 원자료가 옛 동 하나로만 있어 아래는 <b>옛 ' + esc(d.old.name) + ' 전체</b> 값이다(나눠 지어내지 않는다).</p>';
      var lo = liveNow(o); if (lo) h += row('옛 ' + esc(d.old.name) + ' 생활인구', lo.n.toLocaleString() + '명 <em>(' + lo.h + '시)</em>') + '<div class="cap">옛 ' + esc(d.old.name) + ' 시간대별 생활인구(명 · 0~23시 ' + (lo.we ? '주말' : '평일') + ' 평균)</div>' + bar(lo.arr, '#fdba74');
      h += salesRows(o); }
    if (!lv && !d.old) h += '<p class="desc">생활인구(2026.7) 원자료에 이 동이 없다 — 새로 생긴 동이면 옛 동에 합쳐 있다.</p>';
    var sz2 = D.sz ? D.sz.zones.filter(function (z) { return inPoly(d, P(z.lon, z.lat)); }).length : 0; if (sz2) h += row('어린이보호구역', sz2 + '곳');
    return h + src('경계: ' + R.source['경계'] + ' · 주민: ' + R.source['주민'] + ' · 생활인구: ' + R.source['생활인구']);
  }
  function dongIndRows(x) {   // 행정동 — 업종 × 연령 · 업종 × 시간대 · 주점·유흥
    var d = typeof x === 'string' ? { name: x } : x, ind = d.rg ? d.x && d.x.ind : D.trdar && D.trdar.dong && D.trdar.dong[d.name]; if (!ind || !ind.length) return d.rg && d.x === null ? '<p class="desc">업종 표를 받는 중…</p>' : '';
    return barRows(ind, '이 동') + '<div class="cap">업종 × 연령(%) — 이 동 매출 많은 업종 8</div>' + indTable(ind, 'age') + '<div class="cap">업종 × 시간대(%)</div>' + indTable(ind, 'tb');
  }
  // ---------- 🚗 교통사고 10년(v0.10.79 · TAAS 2016~2025 서초 22,546건 · 100m 칸 + 사망사고 한 건씩) ----------
  // v0.10.89 경찰서 통계 — 소유자 「단속 실적도 5년치 · 범죄나 생활에 필요한 정보」: 현장 단속 5개 해 · 112 출동 15년 · 5대 범죄 · 지구대·파출소
  function stKey(name) { return String(name || '').replace(/^서울/, '').replace(/경찰서$/, ''); }
  function polStats(name) { var S = D.pstat; if (!S || !name) return ''; var k = stKey(name), h = '';
    var E = S.enf[k];
    if (E) { var ys = Object.keys(E).sort(), last = E[ys[ys.length - 1]];
      h += '<div class="cap">🚓 해마다 현장 단속 건수(건 · 경찰관 단속 기록 · 무인 장비 제외 · 2017~2020 파일 없음)</div>' + bar(ys.map(function (y) { return E[y].n; }), '#1d4ed8', ys.map(function (y) { return yLab(+y, 1)[0]; }));
      h += row(ys[ys.length - 1] + '년 많이 단속한 조항', last.art.slice(0, 6).map(function (a) { var m = String(a[0]).match(/(\d+)조(의\d+)?/), t = m ? S.titles[m[1] + (m[2] || '')] : ''; return esc(a[0]) + (t ? ' <em>' + esc(t) + '</em>' : '') + ' ' + a[1].toLocaleString(); }).join('<br>'));
      h += row('차종', last.veh.map(function (v) { return esc(v[0] || '-') + ' ' + v[1].toLocaleString(); }).join(' · '));
      h += row('많이 단속한 자리', last.pl.slice(0, 4).map(function (v) { return esc(v[0]) + ' ' + v[1].toLocaleString(); }).join('<br>') + ' <em>(기록 글 그대로)</em>');
      if (k === '동작' && E['2023'] && E['2023'].n < 2000) h += '<p class="desc">⚠ 동작서 2023년 파일은 건수가 다른 해의 10분의 1도 안 된다 — 원자료 그대로 둔다(빠진 기록으로 보임).</p>'; }
    var C = S.call[k];
    if (C) h += '<div class="cap">📞 해마다 112 신고 출동 건수(건 · ' + S.callYears[0] + '~' + S.callYears[S.callYears.length - 1] + ')</div>' + bar(C.map(function (v) { return v || 0; }), '#7c3aed', S.callYears.map(function (y) { return "'" + String(y).slice(2); }));
    var R = S.crime[k], ry = S.crimeYear;
    if (!R && S.gn) { R = S.gn[k]; ry = S.gnYear; }
    if (R) { var KS = ['살인', '강도', '강간·추행', '절도', '폭력'];
      h += '<div class="cap">🚨 5대 범죄 ' + ry + '년 — 발생 / 검거(검거율)</div><table class="it"><tr><th></th>' + KS.map(function (x) { return '<th>' + x + '</th>'; }).join('') + '</tr>' +
        '<tr><td>발생</td>' + KS.map(function (x) { return '<td>' + ((R[x] || [0])[0]).toLocaleString() + '</td>'; }).join('') + '</tr>' +
        '<tr><td>검거</td>' + KS.map(function (x) { var v = R[x] || [0, 0]; return '<td>' + v[1].toLocaleString() + (v[0] ? '<br><small>' + Math.round(v[1] / v[0] * 100) + '%</small>' : '') + '</td>'; }).join('') + '</tr></table>'; }
    var B = S.box[k];
    if (B) { var n = B.length; h += row('지역경찰 관서(' + String(S.boxCols[n - 1]).slice(0, 4) + ')', '지구대 ' + B[n - 3] + ' · 파출소 ' + B[n - 2] + ' · 치안센터 ' + B[n - 1]); }
    if (!E && !C && R) h += '<p class="desc">경기남부경찰청은 경찰서별 단속·112 출동 공개 파일을 찾지 못했다 — 5대 범죄만(' + ry + '년이 공개된 마지막 해).</p>';
    if (h) h += '<p class="desc">출처 — ' + esc([S.source.enf, S.source.call, S.source.crime, S.source.box, S.source.gn].join(' · ')) + ' · ' + esc(S.license) + '</p>';
    return h; }
  // v0.10.84 경찰서별 단속 건수(서울청 2024 · 무인·현장 합계) — 카메라 한 대 단위 건수는 공개되지 않는다
  function enfOf(name) { var E = D.enf; if (!E || !name) return null; var k = String(name).replace(/^서울/, '').replace(/경찰서$/, '');
    for (var i = 0; i < E.items.length; i++) if (E.items[i][0] === k) return E.items[i]; return null; }
  function enfRows(name) { var r = enfOf(name), E = D.enf; if (!r) return '';
    function rk(j) { var v = r[j], n = 1; E.items.forEach(function (x) { if (x[j] > v) n++; }); return n; }
    var lab = ['', '중앙선 침범', '신호위반', '음주운전', '무면허운전', '속도위반'], ord = [5, 2, 1, 3, 4];
    return row(E.year + '년 단속', ord.map(function (j) { return lab[j] + ' ' + r[j].toLocaleString() + '건 <em>(서울 ' + E.items.length + '서 중 ' + rk(j) + '위)</em>'; }).join('<br>')) +
      '<p class="desc">경찰서 한 해 합계 — 무인 장비와 경찰관 현장단속이 섞여 있다(속도위반은 대부분 무인 장비로 본다 · 추정). 카메라 한 대 단위 건수는 공개되지 않는다. 출처 ' + esc(E.source) + '</p>'; }
  // v0.10.84 카메라 설치 전후 둘레 사고(참고 지표) — 설치 해를 빼고 앞뒤 3년씩 연평균을 견주고, 같은 해 서초 전체 변화와 나란히 보인다
  var CAM_R = 150, CAM_W = 3;
  function camYears(yr) { var b = [], a = []; for (var y = Math.max(2016, yr - CAM_W); y < yr; y++) b.push(y); for (var y2 = yr + 1; y2 <= Math.min(2025, yr + CAM_W); y2++) a.push(y2); return [b, a]; }
  function camCalc(cm) { if (!A10.length) return null; if (cm._e) return cm._e; return (cm._e = camCalc0(cm)); }
  function camCalc0(cm) { var yr = parseInt(cm.yr, 10); if (!(yr >= 2017 && yr <= 2024)) return { no: '설치 ' + (cm.yr || '?') + '년 — 사고 자료(2016~2025)로 설치 전·뒤를 함께 볼 수 없다' };
    var p = P(cm.lon, cm.lat), ys = camYears(yr), loc = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], all = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    A10.forEach(function (x) { var c = x.c, near = Math.hypot(x.p[0] - p[0], x.p[1] - p[1]) <= CAM_R; for (var i = 0; i < 10; i++) { all[i] += c[2 + i]; if (near) loc[i] += c[2 + i]; } });
    function avg(arr, list) { return list.reduce(function (t, y) { return t + arr[y - 2016]; }, 0) / list.length; }
    var lb = avg(loc, ys[0]), la = avg(loc, ys[1]), ab = avg(all, ys[0]), aa = avg(all, ys[1]);
    return { yr: yr, ys: ys, loc: loc, lb: lb, la: la, ch: lb ? (la - lb) / lb : null, ach: ab ? (aa - ab) / ab : null, few: (lb + la) * ys[0].length < 6 }; }
  function pctS(v) { return (v > 0 ? '+' : '') + Math.round(v * 100) + '%'; }
  function camEff(cm) { var r = camCalc(cm); if (!r) return row('설치 전후 사고', '사고 10년 자료를 읽는 중…'); if (r.no) return row('설치 전후 사고', esc(r.no));
    var y0 = r.ys[0], y1 = r.ys[1], rng = function (l) { return l[0] + (l.length > 1 ? '~' + l[l.length - 1] : '') + '년'; };
    var v = r.few ? '둘레 사고가 적어 견주기 어렵다' : r.ch == null ? '설치 전 사고 0건' : (r.ch < r.ach - 0.1 ? '<b style="color:#15803d">서초 전체보다 더 줄었다</b>' : r.ch > r.ach + 0.1 ? '<b style="color:#b91c1c">서초 전체보다 덜 줄었다(늘었다)</b>' : '서초 전체와 비슷하게 변했다');
    return row('설치 전후 사고', '둘레 ' + CAM_R + 'm · 설치 전 ' + rng(y0) + ' 연평균 ' + r.lb.toFixed(1) + '건 → 설치 뒤 ' + rng(y1) + ' 연평균 ' + r.la.toFixed(1) + '건' + (r.ch != null ? ' (' + pctS(r.ch) + ')' : '')) +
      row('견주기', '서초 전체 같은 해 ' + (r.ach != null ? pctS(r.ach) : '-') + ' → ' + v) +
      '<div class="cap">카메라 둘레 ' + CAM_R + 'm 해마다 교통사고 건수(건 · 2016~2025 · 설치 ' + r.yr + '년)</div>' + bar(r.loc, '#2563eb', LB_Y16) +
      '<p class="desc">참고 지표 — 단속 건수가 아니라 둘레 사고의 변화다. 교통량·도로 공사·다른 시설 변화가 섞이고, 사고가 많아서 설치한 자리는 그 뒤 저절로 줄어 보일 수 있다(평균으로 돌아감). 100m 칸 가운데가 ' + CAM_R + 'm 안이면 센다.</p>'; }
  // 점 색 = 설치 전후 사고(참고) — 초록 서초 전체보다 더 줄었다 · 빨강 덜 줄거나 늘었다 · 파랑 비슷하거나 견줄 수 없음
  function camCol(c) { var r = camCalc(c); if (!r || r.no || r.few || r.ch == null) return '#2563eb'; return r.ch < r.ach - 0.1 ? '#16a34a' : r.ch > r.ach + 0.1 ? '#dc2626' : '#2563eb'; }
  function camSum() { if (!D.cam || !A10.length) return ''; var n = 0, more = 0, less = 0;
    D.cam.items.forEach(function (c) { var r = camCalc(c); if (!r || r.no || r.few || r.ch == null) return; n++; if (r.ch < r.ach - 0.1) more++; else if (r.ch > r.ach + 0.1) less++; });
    return '<small class="lg-n">설치 전후 사고를 견줄 수 있는 카메라 ' + n + '대 — 서초 전체보다 더 줄어든 곳 ' + more + ' · 덜 줄거나 는 곳 ' + less + ' · 비슷 ' + (n - more - less) + '(참고 지표 · 카드에 자세히)</small>'; }
  var A10 = [], F10 = [], A10M = 'all', A10Y = null;   // A10Y = 그 해만(null = 10년 전부)
  var A10MS = { all: ['전체 사고', '#ea580c'], sev: ['사망·중상자', '#b91c1c'], ped: ['보행자 피해', '#2563eb'], two: ['자전거·PM·이륜', '#16a34a'], night: ['밤(20~6시)', '#1e3a8a'] };
  function a10Prep() { var T = D.taas10; if (!T) return; var kA = A10.filter(function (x) { return x.m; }), kF = F10.filter(function (x) { return x.m; });   // 먼저 온 구 파일은 남긴다
    A10 = T.cells.map(function (c) { return { c: c, p: P(c[1], c[0]) }; }).concat(kA); F10 = T.fatal.map(function (f) { return { f: f, p: P(f[17], f[16]) }; }).concat(kF);
    // 교차로 집계를 2019년부터(v0.10.82 · 소유자 「사고 데이터 2019년부터」) — 칸을 585m 안 가장 가까운 실제 교차로에 배정(23~25 집계와 같은 규칙)
    NODES.forEach(function (n) { n.y10 = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]; n.d10 = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]; n.ped = 0; n.sev = 0; });
    function near(p) { var b = null, bd = 585; NODES.forEach(function (n) { if (!n.real) return; var d = Math.hypot(n.p[0] - p[0], n.p[1] - p[1]); if (d < bd) { bd = d; b = n; } }); return b; }
    A10.forEach(function (x) { var n = near(x.p); if (!n) return; for (var i = 0; i < 10; i++) n.y10[i] += x.c[2 + i]; n.ped += x.c[14]; n.sev += x.c[12] + x.c[13]; });
    F10.forEach(function (x) { var n = near(x.p); if (n) n.d10[x.f[0] - 2016] += x.f[12]; });
  }
  function accN(n, a, b) { if (!n.y10) return 0; var t = 0; for (var y = a; y <= b; y++) t += n.y10[y - 2016]; return t; }
  function deadN(n, a, b) { if (!n.d10) return 0; var t = 0; for (var y = a; y <= b; y++) t += n.d10[y - 2016]; return t; }
  function a10Val(c) {
    if (A10M === 'all') return A10Y === 19 ? c.slice(5, 12).reduce(function (a, b) { return a + b; }, 0) : A10Y ? c[2 + A10Y - 2016] : c.slice(2, 12).reduce(function (a, b) { return a + b; }, 0);
    var share = A10Y === 19 ? c.slice(5, 12).reduce(function (a, b) { return a + b; }, 0) / Math.max(1, c.slice(2, 12).reduce(function (a, b) { return a + b; }, 0)) : A10Y ? c[2 + A10Y - 2016] / Math.max(1, c.slice(2, 12).reduce(function (a, b) { return a + b; }, 0)) : 1;
    return (A10M === 'sev' ? c[12] + c[13] : A10M === 'ped' ? c[14] : A10M === 'two' ? c[15] + c[16] + c[17] : c[18]) * share;
  }
  function drawA10(dark) {
    if (on.acc10 && A10.length) { var vs = A10.map(function (x) { return a10Val(x.c); }), mx = Math.max.apply(null, vs) || 1, col = A10MS[A10M][1], h = 50;
      var W0 = cv.clientWidth, H0 = cv.clientHeight;
      A10.forEach(function (x, k) { var v = vs[k]; if (!v) return; var t = Math.sqrt(v / mx), a = S([x.p[0] - h, x.p[1] - h]), b = S([x.p[0] + h, x.p[1] + h]); if (b[0] < 0 || b[1] < 0 || a[0] > W0 || a[1] > H0) return;
        ctx.fillStyle = hexA(col, 0.12 + 0.7 * t); ctx.fillRect(a[0], a[1], b[0] - a[0], b[1] - a[1]);
        if (view.s > 0.35) { ctx.font = 'bold 10px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = t > 0.5 ? '#fff' : '#111827'; ctx.fillText(String(Math.round(v)), (a[0] + b[0]) / 2, (a[1] + b[1]) / 2); }
        hit.push({ x: (a[0] + b[0]) / 2, y: (a[1] + b[1]) / 2, r: Math.max(6, (b[0] - a[0]) / 2), it: { kind: 'a10', x: x } }); }); }
    if (on.fatal10 && F10.length) F10.forEach(function (x) { if (A10Y === 19 ? x.f[0] < 2019 : A10Y && x.f[0] !== A10Y) return; dot(x.p, 5.5, '#111827', '#fca5a5', { kind: 'f10', x: x }); });
  }
  var DICT = null;
  function dic(k, v) { var D2 = ((DICT || D.taas10 || {}).dic || {})[k] || {}; return D2[v] || v || '-'; }
  function a10Card(it) {
    var T = it.x.m || D.taas10; DICT = T;
    if (it.kind === 'f10') { var f = it.x.f; return '<h3>🕯 사망사고 — ' + f[0] + '년 ' + f[1] + '월</h3>' + row('때', T.dow[f[2]] + '요일 ' + f[3] + '시') + row('유형', esc(dic('t', f[5]))) + row('법규위반', esc(dic('v', f[6]))) + row('도로', esc(dic('r', f[7]))) +
      row('날씨·노면', esc(dic('w', f[8]) + ' · ' + dic('s', f[9]))) + row('가해 / 피해', esc(dic('k', f[10]) + ' / ' + dic('k', f[11]))) + row('사상', '사망 ' + f[12] + ' · 중상 ' + f[13] + ' · 경상 ' + f[14] + (f[15] ? ' · 부상신고 ' + f[15] : '')) + '<p class="desc">' + esc(T.note) + '</p>' + src(T.source); }
    var c = it.x.c, tot = c.slice(2, 12).reduce(function (a, b) { return a + b; }, 0), ys = []; for (var y = 2016; y <= 2025; y++) ys.push(y);
    return '<h3>🚗 사고 10년 — 이 100m 칸</h3>' + row('2016~2025', tot + '건 · 사망 ' + c[12] + ' · 중상 ' + c[13]) + row('누가', '보행자 피해 ' + c[14] + ' · 자전거 ' + c[15] + ' · PM ' + c[16] + ' · 이륜·원동기 가해 ' + c[17]) +
      row('주 법규위반', esc(dic('v', c[23])) + ' ' + c[24] + '건') + row('주 유형', esc(dic('t', c[25]))) + row('밤(20~6시)', c[18] + '건 (' + pct(c[18], tot) + '%)') +
      '<div class="cap">해마다 교통사고 건수(건 · 2016~2025 · 이 100m 칸)</div>' + bar(c.slice(2, 12), '#ea580c', LB_Y16) + '<div class="cap">시간대별 교통사고 건수(건 · 10년 합 · 0~6 · 6~12 · 12~18 · 18~24시)</div>' + bar(c.slice(19, 23), '#1e3a8a', LB_TB4) + '<p class="desc">' + esc(T.note) + '</p>' + src(T.source);
  }
  function a10Legend() {
    if (!on.acc10 && !on.fatal10) return null; var ys = ['', 19]; for (var y = 2016; y <= 2025; y++) ys.push(y);
    return ['🚗 사고 10년(TAAS)', '<div class="lg-btns">' + Object.keys(A10MS).map(function (k) { return '<button data-a10m="' + k + '" class="' + (k === A10M ? 'on' : '') + '">' + A10MS[k][0] + '</button>'; }).join('') + '</div>' +
      '<div class="lg-btns"><select data-a10y aria-label="해">' + ys.map(function (y) { return '<option value="' + y + '"' + ((A10Y || '') == y ? ' selected' : '') + '>' + (y === 19 ? '2019~2025' : y ? y + '년만' : '10년 전부') + '</option>'; }).join('') + '</select></div>' +
      li(hexA(A10MS[A10M][1], 0.8), '100m 칸 · 진할수록 많음(√) · 확대하면 숫자', 'box') + (on.fatal10 ? li('#111827', '사망사고(한 건씩)') : '') + '<small class="lg-n">' + (D.taas10 ? D.taas10.count.toLocaleString() + '건 · 개인정보 없음' : '') + '</small>'];
  }
  // ---------- 🛡 치안·생활안전 시설(v0.10.78 · 서울 열린데이터 — 서초구) ----------
  var SAFE = [];   // [층 키, 이름, 색, 점들[{p, it}]]
  var SRC_C = { '301': '#dc2626', '302': '#1d4ed8', '303': '#64748b', '304': '#94a3b8', '305': '#f59e0b', '306': '#64748b', '307': '#7c3aed', '308': '#64748b' };
  function safePrep() {
    var Sx = D.safety; if (!Sx) return; var I = Sx.items, C = Sx.codes || {};
    function add(k, name, col, arr, f) { var pts = []; arr.forEach(function (r) { if (r[0] && r[1]) pts.push({ p: P(r[1], r[0]), r: r }); }); SAFE.push([k, name, col, pts, f]); POLL.push([k, name, col, f ? '' : name]); }
    add('srbell', '🔔 안심벨(안심귀갓길)', '#dc2626', I.srItem.filter(function (r) { return r[2] === '301'; }));
    add('srcctv', '📹 CCTV(안심귀갓길)', '#1d4ed8', I.srItem.filter(function (r) { return r[2] === '302'; }));
    add('srlamp', '💡 보안등(안심귀갓길)', '#f59e0b', I.srItem.filter(function (r) { return r[2] === '305'; }));
    add('sr112', '🆘 112 위치 신고 안내', '#7c3aed', I.srItem.filter(function (r) { return r[2] === '307' || r[2] === '303' || r[2] === '304' || r[2] === '306' || r[2] === '308'; }));
    add('srsvc', '🏪 안심 서비스·지킴이집', '#db2777', I.srSvc);
    add('aed', '❤️ 자동심장충격기(AED)', '#e11d48', I.aed);
    add('fw', '🧯 소방용수(소화전 등)', '#ef4444', I.fire);
    add('pkcctv', '📸 불법주정차 단속 CCTV', '#0f766e', I.pkcctv);
    add('tow', '🛻 견인차량보관소', '#78350f', I.tow);
    add('wc2', '🚻 공중화장실(서울시 목록)', '#0891b2', I.wc);
    add('box', '📦 안심택배함', '#a16207', I.box);
    add('dem', '🧠 치매안심센터', '#9333ea', I.dem);
  }
  // ---------- 🗓 계절 취약지(v0.10.85 · 소유자 「겨울에는 결빙 여름에는 폭우 등 위험한 지역을 자동으로 데이터에 맞게」) ----------
  // 고른 날짜의 달로 계절을 정한다 — 6~9월 폭우(침수흔적·침수 이력 도로·지하차도) · 11~3월 결빙(제설함·열선 길·전진기지·결빙 다발지) · 그 밖은 둘 다
  var SEA = null;
  function dec2(a, k) { var out = [], x = a[k], z = a[k + 1]; out.push([x, z]); for (var i = k + 2; i < a.length; i += 2) { x += a[i]; z += a[i + 1]; out.push([x, z]); } return out; }
  function seasonPrep() { var Sd = D.season; if (!Sd) return;
    SEA = { tr: Sd.traces.map(function (t) { return { p: [t[0], t[1]], t: t }; }), fr: Sd.floodRoads.map(function (r) { return { r: r, pts: dec2(r, 6) }; }),
      un: Sd.under.map(function (u) { return { p: [u[2], u[3]], u: u }; }), ib: Sd.sbox.map(function (b) { return { p: [b[0], b[1]], b: b }; }), ad: Sd.adv.map(function (a) { return { p: [a[0], a[1]], a: a }; }),
      ht: Sd.heat.map(function (h) { return { h: h, segs: h[5].map(function (a) { return dec2(a, 0); }) }; }), pb: D.pbtn ? D.pbtn.items.map(function (b) { return { p: [b[0], b[1]], b: b }; }) : [] }; }
  function seasonInfo() { var m = +String(pickDate()).slice(5, 7) || (new Date().getMonth() + 1), hh = nowH();
    if (m >= 6 && m <= 9) return { k: 'rain', icon: '🌧', short: '폭우', name: m + '월 장마·집중호우 철', keys: ['flt', 'flr', 'und', 'hot10'] };
    if (m >= 11 || m <= 3) return { k: 'ice', icon: '🧊', short: '결빙', name: m + '월 결빙 철' + (hh >= 0 && hh < 10 ? ' · 새벽·아침' : ''), keys: ['ice', 'hcab', 'advb', 'hot10'] };
    return { k: 'both', icon: '🗓', short: '침수·결빙', name: m + '월 환절기', keys: ['flr', 'und', 'ice', 'hcab'] }; }
  function seasonCount(si) { if (!SEA) return ''; var Sd = D.season;
    var nm = {}; SEA.fr.forEach(function (r) { if (r.r[2] >= 2 && r.r[0]) nm[r.r[0]] = 1; }); var fr = Object.keys(nm).length, un = SEA.un.filter(function (u) { return u.u[5]; }).length;
    if (si.k === 'rain') return '두 해 넘게 침수 흔적이 닿은 길 ' + fr + '곳 · 침수 흔적 가까운 지하차도 ' + un + '곳';
    if (si.k === 'ice') return '제설함 ' + SEA.ib.length + '곳 · 열선 길 ' + SEA.ht.length + '곳';
    return '두 해 넘게 침수 흔적이 닿은 길 ' + fr + '곳 · 제설함 ' + SEA.ib.length + '곳'; }
  function polyl(pts, col, w, dark, it) { if (pts.length < 2) return; ctx.beginPath(); pts.forEach(function (q, i) { var a = S(q); if (i) ctx.lineTo(a[0], a[1]); else ctx.moveTo(a[0], a[1]); });
    ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke();
    if (it) { var m = S(pts[Math.floor(pts.length / 2)]); hit.push({ x: m[0], y: m[1], r: 10, it: it }); } }
  var FR_C = ['#7dd3fc', '#38bdf8', '#0284c7', '#1e3a8a'];
  function drawSeason(dark) { if (!SEA) return; var Sd = D.season, z = view.s;
    if (on.flr) SEA.fr.forEach(function (r) { var n = Math.min(3, r.r[2]); polyl(r.pts, FR_C[n], Math.max(3, (n + 2) * Math.min(1.6, z * 6)), dark, { kind: 'season', k: 'flr', r: r }); });
    if (on.hcab) SEA.ht.forEach(function (h) { h.segs.forEach(function (pts, i) { polyl(pts, '#f97316', Math.max(3, Math.min(7, z * 18)), dark, i === 0 ? { kind: 'season', k: 'hcab', h: h } : null); }); });
    if (on.flt) SEA.tr.forEach(function (t) { var d = t.t[4], c = d >= 1 ? '#1e3a8a' : d >= 0.5 ? '#2563eb' : '#60a5fa'; dot(t.p, z < 0.12 ? 2.2 : 3 + Math.min(4, Math.sqrt(t.t[3])), hexA(c, 0.75), z < 0.12 ? null : '#fff', z < 0.12 ? null : { kind: 'season', k: 'flt', t: t }); });
    if (on.und) SEA.un.forEach(function (u) { var a = S(u.p), wet = u.u[5] > 0, r = 7; ctx.fillStyle = wet ? '#b91c1c' : '#475569'; ctx.fillRect(a[0] - r, a[1] - r, r * 2, r * 2); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(a[0] - r, a[1] - r, r * 2, r * 2);
      ctx.fillStyle = '#fff'; ctx.font = 'bold 10px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('U', a[0], a[1] + 0.5); hit.push({ x: a[0], y: a[1], r: 11, it: { kind: 'season', k: 'und', u: u } });
      if (z > 0.18 && u.u[0]) label([u.p[0], u.p[1] + 16 / z], u.u[0] + (wet ? ' · 침수 ' + u.u[5] + '해' : ''), 10.5, wet ? '#7f1d1d' : '#334155', 'rgba(255,255,255,.85)'); });
    if (on.ice) SEA.ib.forEach(function (b) { dot(b.p, z < 0.12 ? 2 : 3.6, '#06b6d4', z < 0.12 ? null : '#fff', z < 0.12 ? null : { kind: 'season', k: 'ice', b: b }); });
    if (on.advb) SEA.ad.forEach(function (a) { dot(a.p, 7, '#0e7490', '#fff', { kind: 'season', k: 'advb', a: a }); });
    if (on.pbtn) SEA.pb.forEach(function (b) { dot(b.p, 5.5, '#16a34a', '#fff', { kind: 'season', k: 'pbtn', b: b }); if (z > 0.3) label([b.p[0], b.p[1] + 14 / z], '보행자 작동', 10, '#14532d', 'rgba(255,255,255,.85)'); });
  }
  function seasonCard(it) { var Sd = D.season, h = '', k = it.k, src2 = '';
    if (k === 'flt') { var t = it.t.t, near = SEA.tr.filter(function (o) { return Math.hypot(o.p[0] - it.t.p[0], o.p[1] - it.t.p[1]) < 40; }), ys = {}; near.forEach(function (o) { ys[o.t[2]] = 1; });
      h = '<h3>🌊 침수 흔적 — ' + t[2] + '년</h3>' + row('흔적', t[3] + '곳(20m 칸에 묶음)') + row('최대 침수심', t[4] ? t[4] + 'm' : '기록 없음') + row('원인', esc(Sd.causes[t[5]] || '-')) + row('동', esc(Sd.zones[t[6]] || '-')) +
        row('이 자리 40m 안 침수 해', Object.keys(ys).sort().join(' · ')) + '<p class="desc">건물·필지가 물에 잠긴 범위의 가운데 점이다(도로 침수 기록이 아니다). 2015·2021년은 서울시 자료가 없다.</p>'; src2 = Sd.source.flood; }
    else if (k === 'flr') { var r = it.r.r; h = '<h3>🌧 침수 이력 도로 — ' + esc(r[0] || '이름 없는 길') + '</h3>' + row('침수 흔적 해 수', r[2] + '해 · 마지막 ' + r[3] + '년') + row('둘레 흔적', r[5] + '곳 · 최대 침수심 ' + (r[4] || '-') + 'm') +
        '<p class="desc">이 도로 조각 30m 안에 침수 흔적이 있다는 뜻 — 이 앱이 계산한 근사이고 도로가 잠겼다는 공식 기록은 아니다. 큰비 예보 때 먼저 볼 자리로 쓴다.</p>'; src2 = Sd.source.floodRoads; }
    else if (k === 'und') { var u = it.u.u; h = '<h3>🚇 지하차도 — ' + esc(u[0] || '이름 없음') + '</h3>' + row('길이', u[4] + 'm(OSM)') + row('150m 안 침수 흔적', u[5] ? u[5] + '해 · 마지막 ' + u[6] + '년' : '없음') +
        '<p class="desc">서울시는 침수 우려 지하차도에 진입차단시설·침수감지장치를 두고 통제 정보를 실시간으로 보낸다(행안부 재난안전데이터 공유플랫폼 → 내비). 차단시설 자리·실시간 통제는 공개 파일이 없어 이 지도(통신 0)에는 없다 — 큰비 때 통제 여부는 상황실·내비로 확인.</p>'; src2 = Sd.source.under; }
    else if (k === 'ice') { var b = it.b.b; h = '<h3>🧊 제설함 ' + esc(b[2]) + '</h3>' + row('자리', esc(b[3])) + '<p class="desc">제설함은 눈·결빙이 잦은 경사로·교량·그늘진 길에 둔다 — 겨울 새벽 결빙 우려 자리로 본다(추정).</p>'; src2 = Sd.source.sbox; }
    else if (k === 'hcab') { var hh = it.h.h; h = '<h3>🔥 도로 열선 — ' + esc(hh[4]) + '</h3>' + row('설치 위치(원문)', esc(hh[2])) + row('설치', esc(hh[1]) + ' · ' + esc(hh[3]) + 'm · ' + esc(hh[0])) +
        '<p class="desc">열선은 결빙이 잦은 경사로에 깐다. 선은 같은 이름 길 전체를 그린 근사 — 실제 깔린 구간은 원문 위치.</p>'; src2 = Sd.source.heat; }
    else if (k === 'advb') { var a = it.a.a; h = '<h3>❄ 제설 ' + esc(a[3]) + '기지 ' + esc(a[2]) + '</h3>' + row('자리', esc(a[4])) + row('관리', esc(a[5])); src2 = Sd.source.adv; }
    else if (k === 'pbtn') { var pb = it.b.b; h = '<h3>🚸 보행자작동신호기</h3>' + row('버튼', pb[2] + '개(30m 안 묶음)') + row('관리번호', esc(pb[3] || '-')) + (pb[4] ? row('설치일', esc(pb[4])) : '') +
        '<p class="desc">보행자가 버튼을 눌러야 보행 신호가 켜지는 곳 — 누르지 않으면 차량 신호가 이어진다(무단횡단 유혹 · 어르신·어린이 안내 자리).</p>'; src2 = D.pbtn.source; }
    return h + src(src2); }
  function seasonLegend(G) { if (!SEA) return; var Sd = D.season, b = '';
    if (on.flt) b += li('#1e3a8a', '침수 흔적 — 깊이 1m 넘음', 'box') + li('#2563eb', '0.5~1m') + li('#60a5fa', '얕음·기록 없음');
    if (on.flr) b += li(FR_C[1], '침수 이력 도로(30m 안 흔적) 1해', 'line') + li(FR_C[2], '2해', 'line') + li(FR_C[3], '3해 넘음', 'line');
    if (on.und) b += li('#b91c1c', '지하차도 — 150m 안 침수 흔적 있음', 'box') + li('#475569', '지하차도', 'box');
    if (on.ice) b += li('#06b6d4', '제설함(결빙 우려 자리)');
    if (on.hcab) b += li('#f97316', '도로 열선 길', 'line');
    if (on.advb) b += li('#0e7490', '제설 전진기지');
    if (on.pbtn) b += li('#16a34a', '보행자작동신호기');
    if (!b) return; var si = seasonInfo();
    G(si.icon + ' 계절 위험 · ' + esc(si.name), b + '<small class="lg-n">침수흔적 2010~2025(' + Sd.years.join('·') + ') · 자연재해위험개선지구: ' + Sd.danger.map(function (d) { return esc(d.DSTRCT_NM + '(' + d.PSTN + ')'); }).join(', ') + '</small>'); }
  function drawSafe(dark) {
    SAFE.forEach(function (L) { if (!on[L[0]]) return; var dense = L[3].length > 300, small = dense && view.s < 0.25; if (L[0] === 'fw' && view.s < 0.18) return;
      L[3].forEach(function (q) { var c = L[0].indexOf('sr') === 0 && L[0] !== 'srsvc' ? (SRC_C[q.r[2]] || L[2]) : L[2]; dot(q.p, small ? 2.4 : 4.2, c, small ? null : '#fff', small ? null : { kind: 'safe', L: L, q: q }); }); });
  }
  function safeCard(it) {
    var k = it.L[0], r = it.q.r, Sx = D.safety, C = Sx.codes || {}, h = '<h3>' + esc(it.L[1]) + '</h3>', s = '';
    if (k.indexOf('sr') === 0 && k !== 'srsvc') { h += row('시설', esc((C.srItem || {})[r[2]] || r[2]) + (r[5] > 1 ? ' ' + r[5] + '개' : '')) + row('안심귀갓길', esc(r[3] + ' · ' + r[4])) + (r[6] ? row('비고', esc(r[6])) : '') + (r[7] ? row('관리', esc(r[7] + ' ' + (r[8] || ''))) : ''); s = Sx.source.srItem + ' · 코드: ' + C.srItemSrc; }
    else if (k === 'srsvc') { h += row('이름', esc(r[3])) + row('구분', esc((C.srSvc || {})[r[2]] || r[2])) + row('주소', esc(r[4])) + row('운영', esc(String(r[7] || '').replace('_', '~'))) + row('관리', esc(r[5] + ' ' + (r[6] || ''))); s = Sx.source.srSvc; }
    else if (k === 'aed') { h += row('기관', esc(r[2])) + row('설치 자리', esc(r[3])) + row('주소', esc(r[4])) + (r[5] ? row('전화', esc(r[5])) : ''); s = Sx.source.aed; }
    else if (k === 'fw') { var st = typeof r[4] === 'string' ? [r[4], ''] : (Sx.items.fireSt || [])[r[4]] || []; h += row('종류 코드', esc(r[2])) + row('사용', r[3] ? '가능' : '<b>불가·점검</b>') + row('관할 소방서', esc((st[0] || '') + ' ' + (st[1] || ''))); s = Sx.source.fire; }
    else if (k === 'pkcctv') { h += row('단속 지점', esc(r[2])) + row('주소', esc(r[3])) + row('구분', esc(r[4])); s = Sx.source.pkcctv; }
    else if (k === 'tow') { h += row('이름', esc(r[2])) + row('주소', esc(r[3])) + row('전화', esc(r[4])) + row('보관', esc(r[5]) + '대') + '<p class="desc">' + esc(r[6]) + '</p>'; s = Sx.source.tow; }
    else if (k === 'wc2') { h += row('이름', esc(r[2])) + row('주소', esc(r[3])) + row('구분', esc(r[4])) + row('개방', esc(r[5])) + row('남녀', esc(r[6])); s = Sx.source.wc; }
    else if (k === 'box') { h += row('자리', esc(r[2])) + row('주소', esc(r[3])); s = Sx.source.box; }
    else if (k === 'dem') { h += row('이름', esc(r[2])) + row('주소', esc(r[3])) + row('전화', esc(r[4])) + '<p class="desc">배회·실종 치매 어르신 발견 때 연락.</p>'; s = Sx.source.dem; }
    return h + src(s);
  }
  // ---------- 🗂 범례(v0.10.78 · 소유자 「색으로 구분만 되어 있으면 데이터 전달이 부실 — 범례로 확실하게」) ----------
  function sw(c, kind) { return kind === 'line' ? '<i class="lg-l" style="background:' + c + '"></i>' : kind === 'dash' ? '<i class="lg-l lg-d" style="border-color:' + c + '"></i>' : kind === 'box' ? '<i class="lg-b" style="background:' + c + '"></i>' : '<i class="lg-c" style="background:' + c + '"></i>'; }
  function li(c, t, kind) { return '<span>' + sw(c, kind) + esc(t) + '</span>'; }
  function grad(c0, c1, a, b) { return '<span class="lg-g"><i style="background:linear-gradient(90deg,' + c0 + ',' + c1 + ')"></i><small>' + esc(a) + '</small><small>' + esc(b) + '</small></span>'; }
  var POLL = [];   // 시설 층(이름 · 색 · 설명) — 아래 공공시설 층이 채운다
  function legend() {
    var el = $('m2dLeg'); if (!el) return; var g = [], hh = nowH();
    function G(t, body) { g.push('<div class="lg"><b>' + t + '</b><div>' + body + '</div></div>'); }
    if (on.road && OSM) G('🛣 도로', li('#f9c56b', '고속·도시고속', 'line') + li('#ffe08a', '주간선', 'line') + li('#fff2c2', '보조간선', 'line') + li('#ffffff', '집산·국지', 'line') + li('#a0a9b6', '보행', 'dash') + li('#22a35a', '자전거', 'dash') + li('#8b95a3', '지하차도(점선)', 'dash') + li('#334155', '교차로 이름(점)'));
    if (on.base && OSM) G('🗺 바탕', li('#a8d0f0', '물', 'box') + li('#cfe6bd', '공원·녹지', 'box') + li('#b9dba3', '숲', 'box') + li('#8b95a3', '철도', 'line') + li('#bab0a4', '건물', 'box'));
    if (on.dong) G('🏘 행정동', li('rgba(109,40,217,.6)', '행정동 경계', 'line') + li('#64748b', '이웃 구 동(점선)', 'dash') + li('#475569', '구 경계(굵은 점선)', 'dash'));
    if (on.live) { var mx = 0, mn = 1e9; allDong().forEach(function (d) { var lv = liveNow(d); if (lv) { mx = Math.max(mx, lv.n); mn = Math.min(mn, lv.n); } }); if (mx) G('👥 생활인구 ' + hh + '시', grad('rgb(255,230,150)', 'rgb(215,60,40)', man(mn) + '명', man(mx) + '명') + '<small class="lg-n">동 안의 숫자 = 그 시각 평균 체류 인구</small>'); }
    if (on.sales) { var a = 1e18, b = 0; allDong().forEach(function (d) { var sn = salesNow(d); if (sn) { a = Math.min(a, sn.perH); b = Math.max(b, sn.perH); } }); if (b) G('💳 카드 매출 ' + esc(D.flow.sales.tb[bandOf(hh)]), grad('rgb(237,233,254)', 'rgb(117,53,214)', won(a), won(b)) + '<small class="lg-n">시간당 추정 매출(하루 평균) · 동을 누르면 업종·연령</small>'); }
    if (typeof trdLegend === 'function') { var tl = trdLegend(); if (tl) G(tl[0], tl[1]); }
    if (typeof a10Legend === 'function') { var al = a10Legend(); if (al) G(al[0], al[1]); }
    if (on.bus || on.subr) G('🚌🚇 ' + hh + '시 승하차', li('rgba(37,99,235,.8)', '타는 사람 많음(떠나는 곳)') + li('rgba(234,88,12,.8)', '내리는 사람 많음(모여드는 곳)') + li('rgba(13,148,136,.8)', '비슷') + '<small class="lg-n">원 크기 = 그 시각 승차+하차(하루 평균) · 지하철 옆 숫자 = 그 시각 승하차</small>');
    if (on.crowd) G('📡 실시간 인파', li(LVC['여유'], '여유') + li(LVC['보통'], '보통') + li(LVC['약간 붐빔'], '약간 붐빔') + li(LVC['붐빔'], '붐빔') + li('#64748b', '실선 지금 · 긴 점선 예측 · 회색 점선 받은 때', 'dash') + '<small class="lg-n">받은 시각 ' + esc(String((D.livep || {}).baked || '')) + '</small>');
    if (on.spd) G('🚥 도로 소통(받은 때)', li(IDXC['원활'], '원활', 'line') + li(IDXC['서행'], '서행', 'line') + li(IDXC['정체'], '정체', 'line'));
    if (on.jur) G('🚓 관할', li('#2563eb', '서울서초경찰서', 'box') + li('#0d9488', '서울방배경찰서', 'box') + li('#b45309', '반포4동 반포대로 경계', 'dash') +
      JUR.filter(function (J) { return J.z.near; }).map(function (J) { return li(JUR_C[J.z.id] ? JUR_C[J.z.id][1] : '#64748b', J.z.name.replace('서울', '') + '(별표2 · 행정동 근사)', 'box'); }).join('') + '<small class="lg-n">경계·청사를 누르면 단속 5개 해·112 출동·5대 범죄</small>');
    if (on.acc) G('🚗 교차로 사고 ' + (A10.length ? '2019~2025' : '2023~25'), li('rgba(234,88,12,.6)', '원 크기 = √사고 건수 · 아래 숫자 = 건수·사망') + li('rgba(220,38,38,.7)', '사망 포함') + '<small class="lg-n">585m 안 사고를 가장 가까운 교차로에 배정(근사) · 카드에 해마다 막대</small>');
    if (on.hot10) G('🗂 다발지 10년', Object.keys(H10C).map(function (k) { return li(H10C[k], k); }).join('') + '<small class="lg-n">원 크기 = 뽑힌 횟수 · 아래 숫자 = 횟수·해</small>');
    if (on.fatal) G('🕯 사망사고', li('#111827', '한 건씩(2020~2025)'));
    if (on.hot) G('⚠ 사고다발지', li('rgba(250,204,21,.9)', 'TAAS 공표 다발지'));
    if (on.drunk || on.risk) G('🟥 구역', (on.drunk ? li('rgba(126,34,206,.5)', '음주 사고 다발지', 'box') : '') + (on.risk ? li('rgba(185,28,28,.5)', '사고위험지역', 'box') : ''));
    if (on.sz) G('🏫 어린이보호구역', li('#eab308', '초등학교') + li('#f97316', '유치원') + li('#fb923c', '어린이집') + li('#a855f7', '특수학교'));
    if (on.tgis) G('🚥 T-GIS 신호', li('#1d4ed8', '서초서 관할') + li('#0d9488', '방배서 관할') + li('#f59e0b', '주황 테 = 딸린 신호(선 = 부모)'));
    if (on.pol) G('👮 경찰', li('#1e3a8a', '경찰서') + li('#2563eb', '지구대·파출소') + li('#93c5fd', '자리 근사') + li('#0f766e', '치안센터'));
    if (on.phar) G('💊 약국', li('#16a34a', '지금 영업 중') + li('#94a3b8', '닫음·모름'));
    if (on.er || on.hosp) G('🏥 의료', (on.er ? li('#dc2626', '응급실') : '') + (on.hosp ? li('#0891b2', '병원·의원') : ''));
    if (on.bar || on.play || on.inn) G('🌙 밤 순찰', (on.bar ? li('#b45309', '주점') : '') + (on.play ? li('#db2777', '노래방·PC방') : '') + (on.inn ? li('#7c3aed', '숙박') : ''));
    if (on.evt) G('📅 행사·집회', li('#a855f7', '문화행사') + li('#ef4444', '집회(선 = 행진)'));
    seasonLegend(G);
    if (on.cam || on.sig) G('📷🚦', (on.cam ? li('#2563eb', '무인 단속 카메라') + (A10.length ? li('#16a34a', '설치 뒤 둘레 사고가 서초 전체보다 더 줄었다') + li('#dc2626', '덜 줄었거나 늘었다') : '') + camSum() : '') + (on.sig ? li('#16a34a', '신호 주기(경찰청)') : ''));
    if (on.spot) G('🎯 길목', li('rgba(234,88,12,.5)', '버스 정류장') + li('rgba(14,165,233,.5)', '지하철역') + '<small class="lg-n">숫자 = 그 시각 하차 순위</small>');
    POLL.forEach(function (L) { if (on[L[0]]) G(L[1], li(L[2], L[3])); });
    var oth = Object.keys(FAC_C).filter(function (k) { return on[k] && k !== 'pol'; }); if (oth.length) G('📍 시설', oth.map(function (k) { return li(FAC_C[k], (LAYERS.filter(function (l) { return l[0] === k; })[0] || [0, k])[1].replace(/^\S+ /, '')); }).join(''));
    el.innerHTML = '<div class="lgh"><b>🗂 범례</b><button id="m2dLegX" aria-label="범례 닫기">닫기</button></div>' + (g.join('') || '<small>켠 층이 없다</small>');
    $('m2dLegX').onclick = function () { legOpen(false); };
  }
  if ($('m2dLeg')) { $('m2dLeg').addEventListener('click', function (e) { if (e.target.closest('[data-bizopen]')) { if (TRDI && BIZ.idx) { var c = BIZ.idx.inds.filter(function (x) { return x[1] === TRDI; })[0]; if (c && c[0] !== BIZ.code) { BIZ.code = c[0]; bizOpen(); bizLoad(); return; } } bizOpen(); return; } var b = e.target.closest('[data-trdm]'); if (b) { TRDM = b.getAttribute('data-trdm'); draw(); return; } b = e.target.closest('[data-a10m]'); if (b) { A10M = b.getAttribute('data-a10m'); draw(); } });
    $('m2dLeg').addEventListener('change', function (e) { var t = e.target; if (t.hasAttribute('data-trdi')) { TRDI = t.value; draw(); } else if (t.hasAttribute('data-a10y')) { A10Y = t.value ? +t.value : null; draw(); } }); }
  function legOpen(v) { if (v && window.innerWidth < 760 && $('m2dCard').classList.contains('on')) $('m2dCard').classList.remove('on');
    document.body.classList.toggle('legon', v); try { localStorage.setItem('tg_map2d_leg', v ? '1' : '0'); } catch (e) {} if (v) legend(); }
  if ($('m2dLegB')) $('m2dLegB').onclick = function () { legOpen(!document.body.classList.contains('legon')); };
  setTimeout(function () { try { var lv0 = localStorage.getItem('tg_map2d_leg'); legOpen(lv0 == null ? window.innerWidth >= 760 : lv0 === '1'); } catch (e) {} }, 0);
  // ---------- 📋 T-Book 보고 자리(v0.10.59 · 주소 #lat=..&lon=..) ----------
  //  T-Book 최초보고 「발생장소」 단추가 GPS 좌표를 해시로 넘긴다. 해시는 서버로 가지 않고, 이 좌표는 어디에도 저장하지 않는다.
  var REP = null;
  function accOf(n) { return D.acc && D.acc.nodes ? D.acc.nodes.filter(function (x) { return x.node[0] === n.i && x.node[1] === n.j; })[0] : null; }
  function nearestRealNode(p) { var best = null, bd = 1e9; NODES.forEach(function (n) { if (!n.real) return; var d = Math.hypot(n.p[0] - p[0], n.p[1] - p[1]); if (d < bd) { bd = d; best = n; } }); return best; }
  function repAround() {
    if (!REP) return '';
    var nc = D.cam ? D.cam.items.filter(function (c) { var q = P(c.lon, c.lat); return Math.hypot(q[0] - REP.p[0], q[1] - REP.p[1]) <= 300; }).length : 0;
    var er = null, ed2 = 1e9; (PUB ? PUB.er : []).forEach(function (q) { var d = Math.hypot(q.p[0] - REP.p[0], q.p[1] - REP.p[1]); if (d < ed2) { ed2 = d; er = q; } });
    return row(REP.here ? '둘레' : '보고 자리 둘레', '300m 안 단속 카메라 ' + nc + '대' + (er ? ' · 가장 가까운 응급실 ' + esc(er.name.replace(/^학교법인가톨릭학원/, '')) + ' ' + (ed2 >= 1000 ? (ed2 / 1000).toFixed(1) + 'km' : Math.round(ed2) + 'm') + (er.o.ertel ? ' (' + esc(er.o.ertel) + ')' : '') : ''));
  }
  function hereRows() {   // 「📍 지금 위치」(T-Book 홈 · &here=1) — 한눈에 볼 것: 관할 · 가까운 지구대·파출소 · 지금 인파 · 지금 하차 상위
    if (!REP || !REP.here) return '';
    var h = '', p = REP.p, dist = function (q) { return Math.hypot(q[0] - p[0], q[1] - p[1]); }, mt = function (d) { return d >= 1000 ? (d / 1000).toFixed(1) + 'km' : Math.round(d) + 'm'; };
    var dg = dongAtM(p), J = jurAtM(p); if (J || dg) h += row('관할', (J ? esc(J.z.name) : '-') + (dg ? ' · ' + esc(dg.name) : '') + (dg && jurSplit(dg.name) ? ' <em>(반포대로 기준으로 갈림)</em>' : ''));
    var boxes = PUB && PUB.fac.pol ? PUB.fac.pol.filter(function (q) { return q.off && !q.st && !q.ctr; }) : [], bx = null, bd = 1e9;
    boxes.forEach(function (q) { var d = dist(q.p); if (d < bd) { bd = d; bx = q; } });
    if (bx) { var stn = (D.police && D.police.stations || []).filter(function (x) { return x.name === bx.o.station; })[0]; h += row('가까운 지구대·파출소', esc(bx.name) + ' ' + mt(bd) + (stn ? ' · ' + esc(stn.name.replace(/^서울/, '')) + ' ' + esc(stn.tel) : '') + (bx.o.approx ? ' <em>(자리 근사)</em>' : '')); }
    var cw = null, cd = 1e9; LIVEP.forEach(function (L) { var d = dist(L.c); if (d < cd) { cd = d; cw = L; } });
    if (cw && cd < 2000) { var c = crowdAt(cw); if (c) h += row('가까운 인파', esc(cw.o.name) + ' ' + mt(cd) + ' — <b style="color:' + (LVC[c.lvl] || '#64748b') + '">' + esc(c.lvl) + '</b> ' + (c.min ? man(c.min) + '~' + man(c.max) + '명' : '') + (c.kind === 'old' ? ' <em>(받은 때 ' + esc(String(c.t).slice(11, 16)) + ')</em>' : c.kind === 'fcst' ? ' <em>(예측)</em>' : '')); }
    var hh = nowH(), offs = [];
    if (PUB) { PUB.bus.forEach(function (q) { var f = FLOW.bus[q.o.id]; if (f && dist(q.p) < 600) offs.push(['🚌 ' + q.name, f[1][hh]]); }); PUB.subr.forEach(function (q) { var f = FLOW.sub[q.name]; if (f && dist(q.p) < 1000) offs.push(['🚇 ' + q.name + '역', f[1][hh]]); }); }
    offs.sort(function (a, b) { return b[1] - a[1]; });
    if (offs.length) h += row(hh + '시 하차 상위', offs.slice(0, 3).map(function (x) { return esc(x[0]) + ' ' + x[1].toLocaleString(); }).join(' · ') + ' <em>(하루 평균)</em>');
    return h;
  }
  function applyHash() {
    var m = /[#&]lat=(-?[\d.]+)/.exec(location.hash), n = /[#&]lon=(-?[\d.]+)/.exec(location.hash);
    if (!m || !n) return false;
    var lat = +m[1], lon = +n[1];
    if (!isFinite(lat) || !isFinite(lon) || lat < 37.395 || lat > 37.535 || lon < 126.935 || lon > 127.135) return false;
    REP = { p: P(lon, lat), here: /[#&]here=1(?!\d)/.test(location.hash) };   // here=1 = T-Book 홈 「📍 지금 위치」(v0.10.77) — 아니면 최초보고 「보고 자리」
    view.s = Math.min(cv.clientWidth, cv.clientHeight) / (2 * 500); view.cx = REP.p[0]; view.cy = REP.p[1] + cv.clientHeight * 0.22 / view.s;   // 아래 카드에 가리지 않게 표시를 위쪽에   // 반경 약 500m
    if (on.bld && view.s > 0.12) loadBld();
    draw(); var s = S(REP.p); sel = { x: s[0], y: s[1], r: 12, it: { kind: 'report' } }; show({ kind: 'report' }); draw();
    return true;
  }
  // &gps=1(T-Book v23.52 · 홈 관내 이름) — 열린 뒤 스스로 지금 위치를 다시 잡는다. 정밀 1km 안 · 서초 상자 안일 때만 옮기고, 아니면 넘겨받은 자리 그대로. 좌표는 저장하지 않는다.
  var gpsAsked = false;
  function gpsHere() {
    if (gpsAsked || !/[#&]gps=1(?!\d)/.test(location.hash) || !navigator.geolocation) return; gpsAsked = true;
    navigator.geolocation.getCurrentPosition(function (pos) {
      var c = pos.coords; if (!(c.accuracy <= 1000) || c.latitude < 37.395 || c.latitude > 37.535 || c.longitude < 126.935 || c.longitude > 127.135) return;
      REP = { p: P(c.longitude, c.latitude), here: true, acc: Math.round(c.accuracy) }; view.cx = REP.p[0]; view.cy = REP.p[1] + cv.clientHeight * 0.22 / view.s;
      draw(); var s = S(REP.p); sel = { x: s[0], y: s[1], r: 12, it: { kind: 'report' } }; show({ kind: 'report' }); draw();
    }, function () {}, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
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
    return row('지금 ' + h + '시', tot[h].toLocaleString() + '대/시(양방향)') + row('하루', day.toLocaleString() + '대 · 가장 붐비는 때 ' + pk + '시') + '<div class="cap">시간대별 교통량(대/시 · 양방향 · 0~23시 · 오늘 요일의 조사값)</div>' + bar(tot, '#0ea5e9');
  }

  // ---------- 층 단추 · 찾기 ----------
  var lay = $('m2dLayers');
  function paintLayers() {
    lay.innerHTML = '<button data-all="1" class="all">☰ 모든 층 <b>' + LAYERS.filter(function (l) { return on[l[0]]; }).length + '</b></button>' +
      LAYERS.slice().sort(function (a, b) { return (on[b[0]] ? 2 : b[4] ? 1 : 0) - (on[a[0]] ? 2 : a[4] ? 1 : 0); }).map(function (l) { return '<button data-k="' + l[0] + '" class="' + (on[l[0]] ? 'on' : '') + '">' + l[1] + '</button>'; }).join('');
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
    if (b.getAttribute('data-none')) { layersNone(); return; }
    if (b.getAttribute('data-reset')) { layersReset(); return; }
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
    var rseen = {}; RDONG.forEach(function (d) { if ((d.gu + ' ' + d.name).indexOf(q) >= 0) { rseen[d.gcd + d.name] = 1; c.push({ p: d.c, it: { kind: 'dong', d: d } }); } });
    rIdx().forEach(function (g) { if (g.gu === '11650') return; (g.d || []).forEach(function (x) { if (!rseen[g.gu + x[0]] && (g.name + ' ' + x[0]).indexOf(q) >= 0) c.push({ p: P(x[1], x[2]), it: { kind: 'rgo', gu: g.gu, name: x[0], g: g.name } }); }); });
    NEAR.forEach(function (d) { if (!RGUN[d.gu] && !c.some(function (x) { return x.it.kind === 'rgo' && x.it.g === d.gu && x.it.name === d.name; }) && (d.gu + ' ' + d.name).indexOf(q) >= 0) c.push({ p: d.c, it: { kind: 'near', d: d } }); });
    NODES.forEach(function (n) { if (n.name.indexOf(q) >= 0 || (n.sig && n.sig.name.indexOf(q) >= 0)) c.push({ p: n.p, it: { kind: 'node', n: n, st: D.acc && D.acc.nodes ? D.acc.nodes.filter(function (x) { return x.node[0] === n.i && x.node[1] === n.j; })[0] : null } }); });
    if (D.her) D.her.items.forEach(function (h) { if (h.name.indexOf(q) >= 0 && h.lat) c.push({ p: P(h.lon, h.lat), it: { kind: 'her', h: h } }); });
    if (D.sig) D.sig.spots.forEach(function (s) { if (s.name.indexOf(q) >= 0) c.push({ p: P(s.lon, s.lat), it: { kind: 'sig', s: s } }); });
    TG.forEach(function (t) { if (t.name.indexOf(q) >= 0 || String(t.c) === q) c.push({ p: t.p, it: { kind: 'tgis', t: t }, k: 'tgis' }); });
    SPOTS.forEach(function (s2) { if (s2.name.indexOf(q) >= 0) { var rk = spotRank().indexOf(s2) + 1; c.push({ p: s2.p, it: { kind: 'spot', q: s2, rank: rk }, k: 'spot' }); } });
    TRD.forEach(function (x) { if (x.t.name.indexOf(q) >= 0) c.push({ p: x.c, it: { kind: 'trd', x: x }, k: 'trd' }); });
    if (!c.length && TRDIL.indexOf(q) >= 0) { TRDI = q; if (!on.trd) { on.trd = true; saveOn(); paintLayers(); } $('m2dFindMsg').textContent = '업종 「' + q + '」 — 상권을 그 업종 매출로 칠했다(범례에서 바꿈)'; draw(); return; }
    SAFE.forEach(function (L) { L[3].forEach(function (z) { var nm = L[0] === 'aed' ? z.r[2] : L[0] === 'wc2' || L[0] === 'srsvc' || L[0] === 'dem' || L[0] === 'tow' ? (L[0] === 'srsvc' ? z.r[3] : z.r[2]) : ''; if (nm && nm.indexOf(q) >= 0) c.push({ p: z.p, it: { kind: 'safe', L: L, q: z }, k: L[0] }); }); });
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
  // ---------- 🏪 창업 자리 찾기(v0.10.92 · 소유자 「상권분석은 그 부분만 따로 써도 어떤 업종을 어디에 열어 할 수 있을 만큼 제대로」) ----------
  //  고른 업종을 서울 상권 1,650곳(또는 고른 구 · 지금 화면)에서 견준다. 점수 = 항목마다 「그 업종이 있는 상권 안 백분위」의 가중 합(가중은 고르는 목적마다 — 설계값).
  //  지표는 전부 서울시 상권분석서비스 값이다(카드 추정 매출 · 점포 · 개업/폐업 · 1년 전 같은 분기 · 유동·직장·상주인구 · 상권변화지표). 임대료·권리금·공실·동선은 이 자료에 없다.
  var BIZ = { idx: null, ind: null, code: '', mode: 'bal', area: 'all', res: [], top: 15, busy: false };
  var BIZW = { bal: ['⚖ 균형', { D: .22, G: .17, V: .18, C: .13, B: .18, R: .12 }], sales: ['💰 매출 큰 곳', { D: .4, Z: .3, B: .15, G: .15 }], safe: ['🛡 오래 버티는 곳', { V: .4, C: .2, D: .15, R: .15, G: .1 }],
    grow: ['📈 크는 곳', { G: .45, D: .25, B: .15, V: .15 }], gap: ['🆕 빈 자리', { P: .45, D: .2, B: .25, V: .1 }], rent: ['💸 임대료 대비', { Y: .45, D: .2, V: .15, B: .1, C: .1 }] };
  var BIZN = { D: '점포당 매출', Z: '시장 크기', C: '경쟁 적음', G: '1년 성장', V: '버티기', B: '배후 사람', P: '사람 대비 점포 적음', R: '임대료 낮음', Y: '점포당 매출 ÷ 임대료' };
  function bizOpen() {
    rentLoad(); radClose();
    var el = $('m2dBiz'); el.classList.add('on'); el.classList.remove('min'); document.body.classList.add('bizon');
    if (!BIZ.idx) { el.innerHTML = '<div class="lg-h"><b>🏪 창업 자리 찾기</b><button data-bx="x">닫기</button></div><p class="lg-n">서울 상권 목록을 받는 중…</p>';
      fetch('data/r/biz/index.json').then(function (r) { return r.json(); }).then(function (j) { BIZ.idx = j; if (!BIZ.code) { var c = j.inds.filter(function (x) { return x[1] === (TRDI || '커피-음료'); })[0] || j.inds[0]; BIZ.code = c[0]; } bizLoad(); }).catch(function () { el.querySelector('.lg-n').textContent = '상권 목록을 받지 못했다(통신)'; }); return; }
    bizPaint();
  }
  function bizLoad() { BIZ.ind = null; BIZ.busy = true; bizPaint();
    fetch('data/r/biz/' + BIZ.code + '.json').then(function (r) { return r.json(); }).then(function (j) { BIZ.ind = j; BIZ.busy = false; bizCalc(); bizPaint(); draw(); }).catch(function () { BIZ.busy = false; bizPaint(); }); }
  function bizArea(m) { if (BIZ.area === 'all') return true; if (BIZ.area === 'view') { var q = P(m[4], m[5]), a = M(0, 0), b = M(cv.clientWidth, cv.clientHeight); return q[0] >= a[0] && q[0] <= b[0] && q[1] >= a[1] && q[1] <= b[1]; } return m[3] === BIZ.area; }
  function prank(list, key, hi) {   // 백분위(0~1 · 높을수록 좋음) — 값 없는 칸은 0.5(가운데)로 두고 표시한다
    var v = list.filter(function (x) { return x[key] != null; }).sort(function (a, b) { return a[key] - b[key]; }), n = v.length;
    v.forEach(function (x, i) { var r = n > 1 ? i / (n - 1) : 0.5; x['p' + key] = hi ? r : 1 - r; }); list.forEach(function (x) { if (x[key] == null) x['p' + key] = 0.5; });
  }
  function bizCalc() {
    var I = BIZ.ind, MT = BIZ.idx.trdar; if (!I) return; var L = [], seen = {};
    I.rows.forEach(function (r) { var m = MT[r[0]]; if (!m || !m[13] || !bizArea(m)) return; seen[r[0]] = 1;
      var st = r[3], amt = r[1], ha = Math.max(m[6] / 1e4, 0.5), ppl = m[7] / 91 + m[8] + m[9];
      L.push({ r: r, m: m, i: r[0], D: st && amt ? amt / st : null, Z: amt || null, C: st / ha, G: r[7] > 0 && amt > 0 && r[7] >= 1000 && (st >= 2 || (r[8] || 0) >= 2) ? (amt - r[7]) / r[7] : null,
        cr: st ? r[6] / st : null, mo: m[11] || null, B: ppl || null, P: ppl ? ppl / (st + 1) : null }); });
    if (BIZ.mode === 'gap') MT.forEach(function (m, i) { if (seen[i] || !m[13] || !bizArea(m)) return; var ppl = m[7] / 91 + m[8] + m[9]; if (!ppl) return;
      L.push({ r: null, m: m, i: i, D: null, Z: null, C: 0, G: null, cr: null, mo: m[11] || null, B: ppl, P: ppl, none: true }); });
    L.forEach(function (x) { var rn = rentNear(P(x.m[4], x.m[5]), 1500); x.rn = rn; x.R = rn ? lastV(rn.it.s) || lastV(rn.it.m) : null; x.Y = x.R && x.D ? x.D / x.R : null; });
    ['D', 'Z', 'G', 'B', 'P', 'mo', 'Y'].forEach(function (k) { prank(L, k, true); }); prank(L, 'C', false); prank(L, 'cr', false); prank(L, 'R', false);
    L.forEach(function (x) { x.pV = x.cr == null && x.mo == null ? 0.5 : (x.cr == null ? x.pmo : x.mo == null ? x.pcr : x.pcr * 0.6 + x.pmo * 0.4); });
    var W = BIZW[BIZ.mode][1]; L.forEach(function (x) { var s2 = 0; Object.keys(W).forEach(function (k) { s2 += W[k] * x['p' + k]; }); x.score = Math.round(s2 * 100); });
    L.sort(function (a, b) { return b.score - a.score; }); BIZ.res = L; BIZ.n = L.length;
  }
  function bizPct(v) { return v >= 0.5 ? '상위 ' + Math.max(1, Math.round((1 - v) * 100)) + '%' : '하위 ' + Math.max(1, Math.round(v * 100)) + '%'; }
  function bizFacts(x) {   // 숫자 줄 — 그 업종이 이 상권에서
    var r = x.r; if (!r) return '이 업종 점포·매출 없음 — 상권 사람 ' + man(x.B) + '명(하루 유동 + 직장 + 상주)';
    var tb = r.slice(9, 15), pk = 0; for (var i = 1; i < 6; i++) if (tb[i] > tb[pk]) pk = i; var ag = r.slice(15, 21), at = ag.reduce(function (a, b) { return a + b; }, 0);
    return '한 달 ' + won(r[1]) + ' · 점포 ' + r[3] + (r[5] || r[6] ? ' (+' + r[5] + '/−' + r[6] + ')' : '') + (r[3] ? ' · 점포당 ' + won(r[1] / r[3]) : '') + (r[2] ? ' · 객단가 ' + Math.round(r[1] * 1e4 / r[2]).toLocaleString() + '원' : '') +
      (r[1] ? ' · 피크 ' + TBL[pk] + '시 · 20·30대 ' + pct(ag[1] + ag[2], at) + '% · 주말 ' + pct(r[21], r[1]) + '%' : '') + (x.G != null ? ' · 1년 ' + (x.G >= 0 ? '+' : '') + Math.round(x.G * 100) + '%' : '') +
      (x.rn ? ' · 임대료 ' + x.R + '천원/㎡(' + x.rn.it.name + ' ' + x.rn.d + 'm)' : '');
  }
  function bizWhy(b) {   // 상권 카드 맨 위 — 왜 이 순위인가
    var x = b.x, W = BIZW[b.mode][1];
    return '<div class="bizwhy"><button data-bizback="1">◀ 목록</button><b>🏪 ' + esc(b.ind) + ' — ' + b.rank + '위 / ' + b.n + '곳 · 점수 ' + x.score + '</b> <small>(' + BIZW[b.mode][0] + ')</small><br>' +
      Object.keys(W).map(function (k) { var v = x['p' + k]; return esc(BIZN[k]) + ' ' + (k === 'G' && x.G == null ? '<em>자료 적음</em>' : (k === 'R' || k === 'Y') && x.R == null ? '<em>1.5km 안 표본 없음</em>' : k === 'V' && x.cr == null && x.mo == null ? '<em>자료 없음</em>' : bizPct(v)) + ' <small>×' + Math.round(W[k] * 100) + '</small>'; }).join(' · ') +
      '<br><small>' + esc(bizFacts(x)) + '</small></div>';
  }
  function bizPaint() {
    var el = $('m2dBiz'); if (!el.classList.contains('on')) return; var X = BIZ.idx, h = '<div class="lg-h"><b>🏪 창업 자리 찾기</b><span><button data-bx="min">▾ 접기</button> <button data-bx="x">닫기</button></span></div>';
    if (!X) { el.innerHTML = h; return; }
    var gus = (D.ridx && D.ridx.gus || []).map(function (g) { return [g.gu, g.name]; });
    h += '<div class="bizrow"><label>업종 <select data-bz="ind">' + X.inds.map(function (c) { return '<option value="' + c[0] + '"' + (c[0] === BIZ.code ? ' selected' : '') + '>' + esc(c[1]) + ' · ' + c[2] + '곳</option>'; }).join('') + '</select></label>' +
      '<label>어디서 <select data-bz="area"><option value="all">서울 전체</option><option value="view"' + (BIZ.area === 'view' ? ' selected' : '') + '>지금 화면</option>' + gus.map(function (g) { return '<option value="' + g[0] + '"' + (BIZ.area === g[0] ? ' selected' : '') + '>' + esc(g[1]) + '</option>'; }).join('') + '</select></label></div>';
    h += '<div class="lg-btns">' + Object.keys(BIZW).map(function (k) { return '<button data-bm="' + k + '" class="' + (k === BIZ.mode ? 'on' : '') + '">' + BIZW[k][0] + '</button>'; }).join('') + '</div>';
    var W = BIZW[BIZ.mode][1]; h += '<p class="lg-n">점수 = ' + Object.keys(W).map(function (k) { return BIZN[k] + ' ' + Math.round(W[k] * 100); }).join(' + ') + ' (그 업종이 있는 상권 안 백분위 · 가중은 설계값)' + (BIZ.mode === 'gap' ? ' — 「빈 자리」는 그 업종 점포가 없는 상권도 넣는다(수요는 사람 수로만 본다)' : '') + '</p>';
    if (BIZ.busy || !BIZ.ind) h += '<p class="lg-n">업종 자료를 받는 중…</p>';
    else { var R = BIZ.res.slice(0, BIZ.top);
      h += '<ol class="bizl">' + R.map(function (x, k) { var m = x.m; return '<li data-bi="' + k + '"><b>' + (k + 1) + '. ' + esc(m[1]) + '</b> <small>' + esc(m[2]) + ' · ' + esc(guName(m[3])) + '</small> <i style="--w:' + x.score + '%">' + x.score + '</i><br><small>' +
        ['D', 'G', 'C', 'V', 'B', 'R', 'Y'].filter(function (q) { return W[q] || q === 'D'; }).map(function (q) { return BIZN[q] + ' ' + ((q === 'G' && x.G == null) || ((q === 'R' || q === 'Y') && x.R == null) ? '-' : bizPct(x['p' + q])); }).join(' · ') + '</small><br><small class="f">' + esc(bizFacts(x)) + '</small></li>'; }).join('') + '</ol>';
      h += '<div class="lg-btns">' + (BIZ.res.length > BIZ.top ? '<button data-bx="more">더 보기(' + BIZ.top + ' / ' + BIZ.res.length + ')</button>' : '') + '<button data-bx="map">🗺 상권 층을 이 업종으로</button></div>'; }
    h += '<small class="lg-n">' + esc(X.source) + ' · ' + esc(X.note) + '<br>⚠ 참고 지표다 — <b>임대료는 1.5km 안 부동산원 표본 상권(72곳) 평균일 뿐 그 자리 값이 아니다 · 권리금·보증금·개별 공실·유동 동선·상가 위치(1층·코너)는 이 자료에 없다</b>. 고른 상권은 현장에서 확인한다. 추정 매출은 카드 결제 기반(현금 제외)이고, 점포가 적은 상권은 값이 크게 흔들린다.</small>';
    el.innerHTML = h;
  }
  function guName(c) { var g = (D.ridx && D.ridx.gus || []).filter(function (x) { return x.gu === c; })[0]; return g ? g.name : c; }
  function bizGo(k) {
    var x = BIZ.res[k]; if (!x) return; var m = x.m, q = P(m[4], m[5]); view.cx = q[0]; view.cy = q[1]; view.s = Math.max(view.s, 0.28);
    if (!on.trd) { on.trd = true; saveOn(); paintLayers(); } TRDI = BIZ.ind.name;
    var biz = { x: x, rank: k + 1, n: BIZ.res.length, ind: BIZ.ind.name, mode: BIZ.mode }; TWANT = { cd: m[0], biz: biz };
    if (window.innerWidth < 760) { $('m2dBiz').classList.add('min'); }
    tLoad(m[3], function () { TRD.forEach(function (y) { if (TWANT && y.t.cd === TWANT.cd) { var it = { kind: 'trd', x: y, biz: TWANT.biz }; TWANT = null; var s2 = S(y.c); sel = { x: s2[0], y: s2[1], r: 12, it: it }; show(it); } }); draw(); });
    draw();
  }
  function drawBiz(dark) {   // 고른 업종의 점수 — 상위는 번호 핀, 나머지는 옅은 점
    if (!document.body.classList.contains('bizon') || !BIZ.res.length) return; var R = BIZ.res;
    for (var i = R.length - 1; i >= BIZ.top; i--) { var q = P(R[i].m[4], R[i].m[5]), s2 = S(q); if (s2[0] < -10 || s2[1] < -10 || s2[0] > cv.clientWidth + 10 || s2[1] > cv.clientHeight + 10) continue; ctx.beginPath(); ctx.arc(s2[0], s2[1], 3, 0, Math.PI * 2); ctx.fillStyle = 'rgba(124,58,237,' + (0.15 + 0.6 * R[i].score / 100).toFixed(2) + ')'; ctx.fill(); }
    for (i = Math.min(BIZ.top, R.length) - 1; i >= 0; i--) { var q2 = P(R[i].m[4], R[i].m[5]), s3 = S(q2); ctx.beginPath(); ctx.arc(s3[0], s3[1], 11, 0, Math.PI * 2); ctx.fillStyle = i < 3 ? '#7c3aed' : '#a78bfa'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.font = 'bold 11px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(i + 1), s3[0], s3[1]); hit.push({ x: s3[0], y: s3[1], r: 12, it: { kind: 'bizpin', k: i } });
      if (view.s > 0.06) label([q2[0], q2[1] + 20 / view.s], R[i].m[1], 10.5, dark ? '#ede9fe' : '#4c1d95', dark ? 'rgba(15,22,36,.75)' : 'rgba(255,255,255,.88)'); }
  }
  document.addEventListener('click', function (e) { if (e.target.closest('[data-bizback]')) bizOpen(); });
  if ($('m2dBiz')) {
    $('m2dBiz').addEventListener('click', function (e) { var b = e.target.closest('[data-bx],[data-bm],[data-bi]'); if (!b) { if ($('m2dBiz').classList.contains('min')) $('m2dBiz').classList.remove('min'); return; }
      var x = b.getAttribute('data-bx');
      if (x === 'x') { $('m2dBiz').classList.remove('on'); document.body.classList.remove('bizon'); draw(); return; }
      if (x === 'min') { e.stopPropagation(); $('m2dBiz').classList.toggle('min'); return; }
      if (x === 'more') { BIZ.top += 15; bizPaint(); draw(); return; }
      if (x === 'map') { if (!on.trd) { on.trd = true; saveOn(); paintLayers(); } TRDI = BIZ.ind ? BIZ.ind.name : ''; TRDM = 'perstor'; document.body.classList.add('legon'); draw(); return; }
      var m2 = b.getAttribute('data-bm'); if (m2) { BIZ.mode = m2; bizCalc(); bizPaint(); draw(); return; }
      var k = b.getAttribute('data-bi'); if (k != null) bizGo(+k); });
    $('m2dBiz').addEventListener('change', function (e) { var t = e.target, w = t.getAttribute('data-bz'); if (w === 'ind') { BIZ.code = t.value; BIZ.top = 15; bizLoad(); } else if (w === 'area') { BIZ.area = t.value; BIZ.top = 15; bizCalc(); bizPaint(); draw(); } });
  }
  // ---------- 📐 반경 분석(v0.10.93 · 소유자 「상용 상권분석 프로그램만큼의 퍼포먼스」) ----------
  //  고른 자리에서 반경 300m·500m·1km — 점포(소상공인 상가정보 · 하나하나) · 경쟁점 · 추정 매출(걸친 상권을 겹친 넓이 비율로) · 생활인구·주민(걸친 동을 넓이 비율로) ·
  //  유동·직장 인구 · 지하철역 · 가까운 부동산원 임대료. 넓이 비율 = 반경 안을 격자로 찍어 센 것(근사 · 화면에 밝힌다).
  var RAD = { c: null, r: 500, ind: '', res: null, busy: false, pick: false }, SIDX = null, SIDXP = null, SPTS = {}, STNS = null;
  function sLoadIdx() { if (SIDXP) return SIDXP; SIDXP = fetch('data/r/stores-index.json').then(function (r) { return r.json(); }).then(function (j) { SIDX = j; }).catch(function () {}); return SIDXP; }
  function sLoad(gu) {
    if (SPTS[gu]) return SPTS[gu].p; var o = SPTS[gu] = { a: null };
    o.p = fetch('data/r/' + gu + '/stores.json').then(function (r) { if (!r.ok) throw 0; return r.json(); }).then(function (j) { var O = j.o, K = j.k; o.ym = j.stdrYm; o.a = j.pts.map(function (q) { return { p: P(O[0] + q[0] / K[0], O[1] + q[1] / K[1]), c: q[2], f: q[3], n: q[4] }; }); }).catch(function () { o.a = []; });
    return o.p;
  }
  function polyA(polys) { var a = 0; polys.forEach(function (Pg) { Pg.forEach(function (r, i) { var s2 = 0; for (var k = 0, j = r.length - 1; k < r.length; j = k++) s2 += r[j][0] * r[k][1] - r[k][0] * r[j][1]; a += (i ? -1 : 1) * Math.abs(s2) / 2; }); }); return a; }
  function trdBB(x) { if (!x.bb) { var b = [1e9, -1e9, 1e9, -1e9]; x.rings.forEach(function (r) { r.forEach(function (q) { b[0] = Math.min(b[0], q[0]); b[1] = Math.max(b[1], q[0]); b[2] = Math.min(b[2], q[1]); b[3] = Math.max(b[3], q[1]); }); }); x.bb = b; } return x.bb; }
  function radOpen(c) {
    rentLoad(); sLoadIdx(); var el = $('m2dRad'); el.classList.add('on'); el.classList.remove('min'); document.body.classList.add('radon');
    $('m2dBiz') && $('m2dBiz').classList.remove('on'); document.body.classList.remove('bizon');
    if (c) { RAD.c = c; RAD.pick = false; radRun(); } else if (!RAD.c) { RAD.pick = true; radPaint(); } else radPaint();
  }
  function radClose() { var el = $('m2dRad'); if (el) el.classList.remove('on'); document.body.classList.remove('radon'); RAD.pick = false; draw(); }
  function radRun() {
    var c = RAD.c, r = RAD.r; RAD.busy = true; radPaint(); draw();
    var ll = [c[0] / KX + LON0, LAT0 - c[1] / KY], dl = r / KX * 1.1, dt = r / KY * 1.1, bx = [ll[0] - dl, ll[1] - dt, ll[0] + dl, ll[1] + dt];
    var gus = rIdx().filter(function (g) { var b = g.box; return !(b[2] < bx[0] || b[0] > bx[2] || b[3] < bx[1] || b[1] > bx[3]); });
    var jobs = [sLoadIdx(), rentLoad()];
    if (!STNS) jobs.push(fetch('data/r/stations.json').then(function (x) { return x.json(); }).then(function (j) { STNS = j.items.map(function (s2) { return { n: s2[0], l: s2[1], p: P(s2[2], s2[3]) }; }); }).catch(function () { STNS = []; }));
    gus.forEach(function (g) { jobs.push(sLoad(g.gu)); jobs.push(new Promise(function (res) { tLoad(g.gu, res); setTimeout(res, 20000); })); jobs.push(rLoadGu(g.gu)); if ((g.bytes || {}).transit) jobs.push(xLoad(g.gu)); if ((g.bytes || {}).safety) jobs.push(sfLoad(g.gu)); if ((g.bytes || {}).taas10) jobs.push(aLoad(g.gu)); });
    Promise.all(jobs).then(function () { RAD.gus = gus; RAD.res = radCalc(gus); RAD.busy = false; radPaint(); draw(); });
  }
  function radCalc(gus) {
    var c = RAD.c, r = RAD.r, r2 = r * r, o = { n: 0, byL: {}, byS: {}, comp: [], r: r, ym: '' }, CL = SIDX ? SIDX.cls : [];
    gus.forEach(function (g) { var S2 = SPTS[g.gu]; if (!S2 || !S2.a) return; o.ym = S2.ym || o.ym;
      S2.a.forEach(function (st) { var dx = st.p[0] - c[0], dy = st.p[1] - c[1], d2 = dx * dx + dy * dy; if (d2 > r2) return; var C3 = CL[st.c] || ['', '?', '', '?', '?']; o.n++;
        o.byL[C3[1]] = (o.byL[C3[1]] || 0) + 1; o.byS[C3[4]] = (o.byS[C3[4]] || 0) + 1; if (RAD.ind && C3[4] === RAD.ind) o.comp.push({ s: st, d: Math.sqrt(d2) }); }); });
    o.comp.sort(function (a, b) { return a.d - b.d; });
    // 넓이 비율 — 반경 안 격자(한 변 r/16)
    var step = r / 16, cell = step * step, smp = [], dc = new Map(), tc = new Map(), AD = allDong(); for (var x = -r + step / 2; x < r; x += step) for (var y = -r + step / 2; y < r; y += step) if (x * x + y * y <= r2) smp.push([c[0] + x, c[1] + y]);
    smp.forEach(function (q) { var d = dongAtM(q); if (d) dc.set(d, (dc.get(d) || 0) + 1);
      for (var k = 0; k < TRD.length; k++) { var X = TRD[k], b = trdBB(X); if (q[0] < b[0] || q[0] > b[1] || q[1] < b[2] || q[1] > b[3]) continue; if (X.rings.some(function (rr) { return inRing(rr, q[0], q[1]); })) tc.set(X, (tc.get(X) || 0) + 1); } });
    var h = nowH(), dt2 = new Date(pickDate() + 'T00:00'), we = dt2.getDay() === 0 || dt2.getDay() === 6, key = we ? 'we' : 'wd';
    o.pop = 0; o.age = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]; o.live = []; for (var i = 0; i < 24; i++) o.live.push(0); o.dongs = [];
    dc.forEach(function (n, d) { if (d.area == null) d.area = polyA(d.polys); var w = Math.min(1, n * cell / (d.area || 1)); o.dongs.push([(d.gu ? d.gu + ' ' : '') + d.name, Math.round(w * 100)]);
      if (d.pop) { o.pop += d.pop.tot * w; d.pop.age.forEach(function (v, k) { o.age[k] += v * w; }); } var A = liveArr(d); if (A) A[key].forEach(function (v, k) { o.live[k] += v * w; }); });
    o.we = we; o.dongs.sort(function (a, b) { return b[1] - a[1]; });
    o.amt = 0; o.cnt = 0; o.tb = [0, 0, 0, 0, 0, 0]; o.ag = [0, 0, 0, 0, 0, 0]; o.ind = {}; o.flp = 0; o.wrc = 0; o.trd = [];
    tc.forEach(function (n, X) { var t = X.t, w = Math.min(1, n * cell / (t.area || 1)); o.trd.push([t.name, Math.round(w * 100)]);
      (t.ind || []).forEach(function (rr) { o.amt += rr[1] * w; o.cnt += rr[2] * w; for (var k = 0; k < 6; k++) { o.tb[k] += rr[3 + k] * w; o.ag[k] += rr[9 + k] * w; } o.ind[rr[0]] = (o.ind[rr[0]] || 0) + rr[1] * w; });
      if (t.flp) o.flp += t.flp[0] / 91 * w; if (t.wrc) o.wrc += t.wrc[0] * w; });
    o.trd.sort(function (a, b) { return b[1] - a[1]; });
    o.stn = (STNS || []).map(function (s2) { return { s: s2, d: Math.hypot(s2.p[0] - c[0], s2.p[1] - c[1]) }; }).filter(function (q) { return q.d <= r; }).sort(function (a, b) { return a.d - b.d; });
    var seenN = {}; o.stn = o.stn.filter(function (q) { var k = seenN[q.s.n]; if (k) { if (k.ls.indexOf(q.s.l) < 0) k.ls.push(q.s.l); return false; } seenN[q.s.n] = { ls: [q.s.l] }; q.ls = seenN[q.s.n].ls; return true; });
    o.rent = rentNear(c, 1500);
    o.acc = { y: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], dead: 0, ser: 0, ped: 0, night: 0, bike: 0, pm: 0, v: {} }; o.fat = [];
    A10.forEach(function (x) { if (Math.hypot(x.p[0] - c[0], x.p[1] - c[1]) > r) return; var q = x.c; for (var k = 0; k < 10; k++) o.acc.y[k] += q[2 + k]; o.acc.dead += q[12]; o.acc.ser += q[13]; o.acc.ped += q[14]; o.acc.bike += q[15]; o.acc.pm += q[16]; o.acc.night += q[18]; var dv = (x.m || D.taas10 || {}).dic; var vn = dv && dv.v ? dv.v[q[23]] || q[23] : q[23]; o.acc.v[vn] = (o.acc.v[vn] || 0) + q[24]; });
    F10.forEach(function (x) { if (Math.hypot(x.p[0] - c[0], x.p[1] - c[1]) <= r) o.fat.push(x); });
    o.cam = D.cam ? D.cam.items.filter(function (q) { var p2 = P(q.lon, q.lat); return Math.hypot(p2[0] - c[0], p2[1] - c[1]) <= r; }).length : 0;
    o.szn = D.sz ? D.sz.zones.filter(function (q) { var p2 = P(q.lon, q.lat); return Math.hypot(p2[0] - c[0], p2[1] - c[1]) <= r; }).length : 0;
    o.bus = { n: 0, on: [], off: [] }; o.sub = { n: 0, on: [], off: [], names: [] }; for (var hh2 = 0; hh2 < 24; hh2++) { o.bus.on.push(0); o.bus.off.push(0); o.sub.on.push(0); o.sub.off.push(0); }
    if (PUB) { PUB.bus.forEach(function (q) { var f = FLOW.bus[q.o.id]; if (!f || Math.hypot(q.p[0] - c[0], q.p[1] - c[1]) > r) return; o.bus.n++; for (var k = 0; k < 24; k++) { o.bus.on[k] += f[0][k]; o.bus.off[k] += f[1][k]; } });
      PUB.subr.forEach(function (q) { var f = FLOW.sub[q.name]; if (!f || Math.hypot(q.p[0] - c[0], q.p[1] - c[1]) > r) return; o.sub.n++; o.sub.names.push(q.name); for (var k = 0; k < 24; k++) { o.sub.on[k] += f[0][k]; o.sub.off[k] += f[1][k]; } }); }
    return o;
  }
  function radText() {   // 📋 복사 — 보고서 글
    var o = RAD.res, ll = [RAD.c[0] / KX + LON0, LAT0 - RAD.c[1] / KY]; if (!o) return '';
    var L = ['[반경 ' + o.r + 'm 상권 요약] 위도 ' + ll[1].toFixed(5) + ', 경도 ' + ll[0].toFixed(5),
      '점포 ' + o.n.toLocaleString() + '곳(' + (o.n / (Math.PI * o.r * o.r / 1e4)).toFixed(1) + '곳/ha) · ' + Object.keys(o.byL).sort(function (a, b) { return o.byL[b] - o.byL[a]; }).slice(0, 6).map(function (k) { return k + ' ' + o.byL[k]; }).join(' · '),
      RAD.ind ? '「' + RAD.ind + '」 ' + o.comp.length + '곳 · 가장 가까운 ' + (o.comp[0] ? Math.round(o.comp[0].d) + 'm' : '-') : '',
      '추정 카드 매출 한 달 약 ' + won(o.amt) + '(걸친 상권 ' + o.trd.length + '곳을 겹친 넓이 비율로)',
      '생활인구 ' + nowH() + '시 약 ' + Math.round(o.live[nowH()]).toLocaleString() + '명 · 주민 약 ' + Math.round(o.pop).toLocaleString() + '명 · 하루 유동 약 ' + Math.round(o.flp).toLocaleString() + ' · 직장 약 ' + Math.round(o.wrc).toLocaleString(),
      o.stn.length ? '지하철역 ' + o.stn.map(function (q) { return q.s.n + ' ' + Math.round(q.d) + 'm'; }).join(' · ') : '반경 안 지하철역 없음',
      o.acc && o.acc.y.some(function (v) { return v; }) ? '교통사고 10년 ' + o.acc.y.reduce(function (a, b) { return a + b; }, 0).toLocaleString() + '건 · 사망 ' + o.acc.dead + '명 · 보행자 피해 ' + o.acc.ped : '',
      o.bus.n ? '버스 정류장 ' + o.bus.n + '곳 하루 승차 ' + o.bus.on.reduce(function (a, b) { return a + b; }, 0).toLocaleString() + ' · 하차 ' + o.bus.off.reduce(function (a, b) { return a + b; }, 0).toLocaleString() : '',
      o.rent ? '임대료(부동산원 표본 ' + o.rent.it.name + ' ' + o.rent.d + 'm) 소규모 ' + lastV(o.rent.it.s) + ' · 중대형 ' + lastV(o.rent.it.m) + '천원/㎡' : '',
      '출처: 소상공인 상가정보(' + o.ym + ') · 서울시 상권분석서비스 · 서울 생활인구 · 행안부 주민등록 · 한국부동산원 임대동향 — 추정·근사 포함'];
    return L.filter(Boolean).join('\n');
  }
  function radPaint() {
    var el = $('m2dRad'); if (!el || !el.classList.contains('on')) return; var o = RAD.res, h = '<div class="lg-h"><b>📐 반경 분석</b><span><button data-rx="min">▾ 접기</button> <button data-rx="x">닫기</button></span></div>';
    h += '<div class="lg-btns">' + [300, 500, 1000].map(function (r) { return '<button data-rr="' + r + '" class="' + (RAD.r === r ? 'on' : '') + '">반경 ' + (r >= 1000 ? r / 1000 + 'km' : r + 'm') + '</button>'; }).join('') +
      '<button data-rx="pick" class="' + (RAD.pick ? 'on' : '') + '">📍 지도에서 자리 고르기</button>' + (REP ? '<button data-rx="rep">' + (REP.here ? '📍 지금 위치' : '📋 보고 자리') + '</button>' : '') + '</div>';
    if (SIDX) { var grp = {}; SIDX.cls.forEach(function (C3) { (grp[C3[1]] = grp[C3[1]] || []).push(C3[4]); });
      h += '<div class="bizrow"><label>경쟁 업종 <select data-rz="ind"><option value="">(고르지 않음)</option>' + Object.keys(grp).map(function (g) { return '<optgroup label="' + esc(g) + '">' + grp[g].sort().map(function (n) { return '<option' + (n === RAD.ind ? ' selected' : '') + '>' + esc(n) + '</option>'; }).join('') + '</optgroup>'; }).join('') + '</select></label></div>'; }
    if (RAD.pick) h += '<p class="lg-n"><b>지도를 눌러 분석할 자리를 고르세요.</b></p>';
    if (RAD.busy) h += '<p class="lg-n">반경 안 자료를 모으는 중…</p>';
    else if (o && RAD.c) {
      var ha = Math.PI * o.r * o.r / 1e4, Lk = Object.keys(o.byL).sort(function (a, b) { return o.byL[b] - o.byL[a]; }), Sk = Object.keys(o.byS).sort(function (a, b) { return o.byS[b] - o.byS[a]; }).slice(0, 12);
      h += '<div class="rcard">' + row('점포', o.n.toLocaleString() + '곳 · ' + (o.n / ha).toFixed(1) + '곳/ha <em>(반경 넓이 ' + ha.toFixed(1) + 'ha · 등록 상가 ' + o.ym + ')</em>');
      h += '<div class="cap">업종 대분류별 점포 수(곳 · 반경 안 등록 상가)</div>' + bar(Lk.map(function (k) { return o.byL[k]; }), '#475569', Lk.map(function (k) { return ({ '과학·기술': '전문', '시설관리·임대': '시설', '수리·개인': '수리', '예술·스포츠': '예체', '보건의료': '의료' })[k] || k.slice(0, 3); })) + '<p class="lg-n">' + Lk.map(function (k) { return esc(k) + ' ' + o.byL[k]; }).join(' · ') + '</p>';
      h += row('많은 업종', Sk.map(function (k) { return esc(k) + ' ' + o.byS[k]; }).join(' · '));
      if (RAD.ind) { var cp = o.comp; h += row('경쟁점 「' + esc(RAD.ind) + '」', cp.length + '곳' + (cp.length ? ' · 가장 가까운 곳 ' + Math.round(cp[0].d) + 'm · ' + (cp.length / ha).toFixed(2) + '곳/ha' : ' — 반경 안에 없음'));
        if (cp.length) h += '<ol class="comp">' + cp.slice(0, 25).map(function (q) { return '<li>' + esc(q.s.n) + ' <small>' + (q.s.f ? q.s.f + '층 · ' : '') + Math.round(q.d) + 'm</small></li>'; }).join('') + '</ol>' + (cp.length > 25 ? '<p class="lg-n">… 외 ' + (cp.length - 25) + '곳(지도에 빨간 점)</p>' : ''); }
      h += row('추정 카드 매출', o.trd.length ? '한 달 약 ' + won(o.amt) + ' · 결제 약 ' + man(o.cnt) + '건 <em>(걸친 상권 ' + o.trd.length + '곳 × 겹친 넓이 비율 — 상권 밖 점포 매출은 빠진다)</em>' : '<em>반경에 걸친 상권이 없다(주거지 등)</em>');
      if (o.amt) { var ik = Object.keys(o.ind).sort(function (a, b) { return o.ind[b] - o.ind[a]; }).slice(0, 8);
        h += '<div class="cap">시간대별 시간당 카드 매출(원 · 하루 평균 · 반경 추정)</div>' + bar(o.tb.map(function (v, i) { return v / TBH[i] / 30.4; }), '#7c3aed', LB_TB6, 'w');
        h += '<div class="cap">연령대별 카드 매출(원 · 한 달 · 반경 추정)</div>' + bar(o.ag, '#a78bfa', LB_AGE6, 'w');
        h += row('매출 많은 업종', ik.map(function (k) { return esc(k) + ' ' + won(o.ind[k]); }).join(' · ')); }
      h += row('생활인구 지금', Math.round(o.live[nowH()]).toLocaleString() + '명 <em>(' + (o.we ? '주말' : '평일') + ' ' + nowH() + '시 · 걸친 동 × 넓이 비율)</em>');
      h += '<div class="cap">시간대별 생활인구(명 · 반경 안 추정 · 0~23시 ' + (o.we ? '주말' : '평일') + ' 평균)</div>' + bar(o.live.map(Math.round), '#f97316');
      h += row('주민', '약 ' + Math.round(o.pop).toLocaleString() + '명 · 19세 이하 ' + pct(o.age[0] + o.age[1], o.pop) + '% · 20·30대 ' + pct(o.age[2] + o.age[3], o.pop) + '% · 60세 이상 ' + pct(o.age[6] + o.age[7] + o.age[8] + o.age[9], o.pop) + '%');
      h += '<div class="cap">주민 연령대별 인구(명 · 반경 안 추정 · 0~9세 … 90~99세)</div>' + bar(o.age.map(Math.round), '#8b5cf6', ageLab(10));
      h += row('유동·직장', '하루 유동 약 ' + man(o.flp) + '명 · 직장인구 약 ' + man(o.wrc) + '명 <em>(걸친 상권 기준)</em>');
      var sumA = function (a) { return a.reduce(function (x, y) { return x + y; }, 0); };
      if (o.bus.n) h += row('버스 승하차', '정류장 ' + o.bus.n + '곳 · 하루 승차 ' + man(sumA(o.bus.on)) + ' · 하차 ' + man(sumA(o.bus.off)) + ' <em>(2026년 6월 하루 평균)</em>') + '<div class="cap">시간대별 버스 승차(파랑) · 하차(주황) 인원(명/시 · 반경 안 정류장 합 · 하루 평균)</div>' + bar2(o.bus.on, o.bus.off);
      if (o.sub.n) h += row('지하철 승하차', esc(o.sub.names.join('·')) + ' · 하루 승차 ' + man(sumA(o.sub.on)) + ' · 하차 ' + man(sumA(o.sub.off))) + '<div class="cap">시간대별 지하철 승차(파랑) · 하차(주황) 인원(명/시 · 반경 안 역 합 · 하루 평균)</div>' + bar2(o.sub.on, o.sub.off);
      var at = o.acc.y.reduce(function (a, b) { return a + b; }, 0);
      if (at) { var vk = Object.keys(o.acc.v).sort(function (a, b) { return o.acc.v[b] - o.acc.v[a]; }).slice(0, 3);
        h += row('교통사고 10년', at.toLocaleString() + '건(2016~2025) · 사망 ' + o.acc.dead + '명(사망사고 ' + o.fat.length + '건) · 중상 ' + o.acc.ser + ' · 보행자 피해 ' + o.acc.ped + ' · 밤(20~6시) ' + pct(o.acc.night, at) + '%') +
          row('주 법규위반', vk.map(function (k) { return esc(k) + ' ' + o.acc.v[k]; }).join(' · ') + ' <em>(100m 칸마다 가장 많은 위반의 합 — 근사)</em>') +
          '<div class="cap">해마다 교통사고 건수(건 · 2016~2025 · 반경 안 100m 칸 합 · TAAS)</div>' + bar(o.acc.y, '#ea580c', LB_Y16); }
      h += row('안전', '무인 단속 카메라 ' + o.cam + '대 · 어린이보호구역 대상 시설 ' + o.szn + '곳');
      h += row('지하철역', o.stn.length ? o.stn.map(function (q) { return esc(q.s.n) + ' <small>' + esc(q.ls.join('·')) + ' · ' + Math.round(q.d) + 'm</small>'; }).join(' · ') : '반경 안에 없음');
      h += rentRows(RAD.c, '임대료(가까운 표본)');
      h += row('걸친 동', o.dongs.slice(0, 6).map(function (d) { return esc(d[0]) + ' ' + d[1] + '%'; }).join(' · ') + ' <em>(동 넓이 중 반경 안 비율)</em>');
      if (o.trd.length) h += row('걸친 상권', o.trd.slice(0, 6).map(function (d) { return esc(d[0]) + ' ' + d[1] + '%'; }).join(' · '));
      h += '<div class="lg-btns"><button data-rx="copy">📋 요약 복사</button><button data-rx="biz">🏪 이 업종 서울 다른 자리</button></div></div>';
      h += '<small class="lg-n">넓이 비율은 반경 안을 격자로 찍어 센 근사다. 추정 매출은 카드 결제 기반(현금 제외) · 상권 밖 점포 매출은 빠진다. 임대료는 1.5km 안 부동산원 표본 상권 평균이다. 점포는 등록 정보라 문 닫은 곳이 섞일 수 있다. <b>한 점포 실제 매출·권리금·50m 단위 유동은 공공 자료에 없다.</b></small>';
    }
    el.innerHTML = h;
  }
  function drawRad(dark) {
    if (!document.body.classList.contains('radon') || !RAD.c) return; var c = S(RAD.c), rr = RAD.r * view.s;
    ctx.beginPath(); ctx.arc(c[0], c[1], rr, 0, Math.PI * 2); ctx.fillStyle = 'rgba(14,165,233,.06)'; ctx.fill(); ctx.lineWidth = 2.5; ctx.setLineDash([8, 5]); ctx.strokeStyle = '#0284c7'; ctx.stroke(); ctx.setLineDash([]);
    ctx.beginPath(); ctx.arc(c[0], c[1], 6, 0, Math.PI * 2); ctx.fillStyle = '#0284c7'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.stroke();
    var o = RAD.res; if (!o || RAD.busy || !SIDX) return; var r2 = RAD.r * RAD.r, CL = SIDX.cls, pal = { '음식': '#ea580c', '소매': '#2563eb', '과학·기술': '#0d9488', '시설관리·임대': '#64748b', '교육': '#16a34a', '보건의료': '#dc2626', '수리·개인': '#9333ea', '예술·스포츠': '#db2777', '숙박': '#a16207', '부동산': '#475569' };
    if (view.s > 0.08) (RAD.gus || []).forEach(function (g) { var S2 = SPTS[g.gu]; if (!S2 || !S2.a) return; S2.a.forEach(function (st) { var dx = st.p[0] - RAD.c[0], dy = st.p[1] - RAD.c[1]; if (dx * dx + dy * dy > r2) return; var C3 = CL[st.c] || []; if (RAD.ind && C3[4] === RAD.ind) return; var s3 = S(st.p); ctx.fillStyle = pal[C3[1]] || '#94a3b8'; ctx.globalAlpha = 0.55; ctx.fillRect(s3[0] - 1.5, s3[1] - 1.5, 3, 3); ctx.globalAlpha = 1; }); });
    o.comp.forEach(function (q) { dot(q.s.p, 5, '#dc2626', '#fff', { kind: 'store', s: q.s }); });
  }
  document.addEventListener('click', function (e) { var b = e.target.closest('[data-radhere]'); if (!b) return; var a = b.getAttribute('data-radhere').split(','); var q = P(+a[0], +a[1]); view.cx = q[0]; view.cy = q[1]; view.s = Math.max(view.s, 0.25); radOpen(q); });
  if ($('m2dRad')) {
    $('m2dRad').addEventListener('click', function (e) { var b = e.target.closest('[data-rx],[data-rr]'); if (!b) { if ($('m2dRad').classList.contains('min')) $('m2dRad').classList.remove('min'); return; }
      var x = b.getAttribute('data-rx'), rr = b.getAttribute('data-rr');
      if (rr) { RAD.r = +rr; if (RAD.c) radRun(); else radPaint(); return; }
      if (x === 'x') return radClose(); if (x === 'min') { e.stopPropagation(); $('m2dRad').classList.toggle('min'); return; }
      if (x === 'pick') { RAD.pick = !RAD.pick; radPaint(); return; }
      if (x === 'rep' && REP) { RAD.c = REP.p; radRun(); return; }
      if (x === 'copy') { var t = radText(); try { navigator.clipboard.writeText(t).then(function () { b.textContent = '✅ 복사했다'; }); } catch (e2) { prompt('복사', t); } return; }
      if (x === 'biz') { bizOpen(); return; } });
    $('m2dRad').addEventListener('change', function (e) { var t = e.target; if (t.getAttribute('data-rz') === 'ind') { RAD.ind = t.value; if (RAD.c && RAD.res) { RAD.res = radCalc(RAD.gus || []); radPaint(); draw(); } } });
  }
  // 시계(행사·집회·신호·교통량이 「지금」을 본다)
  function clock() { var d = new Date(); $('m2dNow').textContent = (d.getMonth() + 1) + '월 ' + d.getDate() + '일(' + '일월화수목금토'[d.getDay()] + ') ' + ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2); }
  clock(); setInterval(function () { clock(); if (HOUR == null) { summary(); } }, 30000);
  function ymdOf(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function pickDate() { var v = $('m2dDate') && $('m2dDate').value; return v || ymdOf(new Date()); }
  if ($('m2dDate')) { $('m2dDate').value = ymdOf(new Date()); $('m2dDate').addEventListener('change', function () { var wasSea = $('m2dPre') && $('m2dPre').querySelector('[data-p="season"].on'); sel = null; show(null); paintPre(); if (wasSea) preset('season'); draw(); paintTime(); summary(); }); }
  // v0.10.85 날짜를 바꾸면 계절 단추도 따라 바뀌고, 계절 단추가 켜져 있었으면 새 계절 층으로
  try { var mq = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)'); if (mq && mq.matches) document.documentElement.classList.add('dark'); } catch (e) {}
  window.TGMap2D = { a10: function () { return A10; }, rad: function () { return RAD; }, radOpen: radOpen, radRun: radRun, rent: function () { return RENT; }, biz: function () { return BIZ; }, bizOpen: bizOpen, bizGo: bizGo, trd: function () { return TRD; }, rdong: function () { return RDONG; }, ridx: rIdx, osm: function () { return OSM; }, flow: function () { return FLOW; }, livep: function () { return LIVEP; }, setHour: setHour, preset: preset, PRESETS: PRESETS, summary: summary, salesNow: salesNow, crowdAt: crowdAt, nowH: function () { return nowH(); }, hashLayers: hashLayers, hour: spotHour, jur: function () { return JUR; }, tgis: function () { return TG; }, spots: function () { return SPOTS; }, saving: function () { return !HASHLY; }, report: function () { return REP; }, applyHash: applyHash, hits: function () { return hit; }, pub: function () { return PUB; }, openNow: openNow, liveNow: liveNow, layers: LAYERS, view: view, nodes: function () { return NODES; }, dongs: function () { return DONG; }, draw: draw, tap: tap, on: on, S: S, P: P };   // 검사·다른 페이지가 읽는 창구
})();
