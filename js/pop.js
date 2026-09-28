// 👥 동별 인구·연령(v0.10.26) — 소유자 지시 「각 동별 인구, 인구분포, 연령대도 넣는 거 알지」.
//  자료는 **행정안전부 주민등록 인구통계**(행정동별 연령별 인구현황, 2026년 8월)와 **서초구청 서초통계**(월별인구현황)에서
//  받아 `data/pop-seocho.json` 에 담았다. 숫자는 코드에 한 줄도 없다.
//  행정동은 **통계청 행정동 경계**로 판정한다(v0.10.53~54) — 트윈·서초구 1:1·서초역 1:1 은 지금 선 자리로(dongHere), 기본 지도는 교차로 도로 쌍 값(byRoads)으로.
//  (v0.10.26 의 「교차로 이름 → 동」 짐작 표는 틀린 것이 많아 없앴다.)
//  쓰는 곳: ① 그 동네의 **행인 나이 구성**(어린이·노인 비율) ② 순찰 중 한 줄 안내 ③ 다른 층(TAAS 취약계층)과 맞대 보기.
TG.Pop = function (game) {
  var self = this, G = game, D = null, byName = null;

  this.load = function (path, cb) {
    if (location.protocol.indexOf('http') !== 0) { if (cb) cb('file://'); return; }
    fetch(path || 'data/pop-seocho.json').then(function (r) { return r.json(); }).then(function (j) {
      D = j; byName = {};
      for (var i = 0; i < j.dong.length; i++) byName[j.dong[i].name] = j.dong[i];
      if (cb) cb(null, j);
    }).catch(function (e) { if (cb) cb(e.message); });
  };
  this.ready = function () { return !!D; };
  this.data = function () { return D; };
  // (v0.10.53) 교차로의 행정동은 **그 교차로를 만드는 두 도로**(roadNamesV[i] × roadNamesH[j])로 찾는다 — 통계청 행정동 경계로 판정한 값(data byRoads).
  //  종전에는 교차로 **이름**으로 찾았는데 그 표가 짐작으로 채워져 틀린 것이 많았다(소유자: 「사당역 사거리가 방배4동이라니 — 방배2동이다」).
  function roadKey(node) { var C = G.city; return (C.roadNamesV && C.roadNamesH) ? C.roadNamesV[node.i] + '×' + C.roadNamesH[node.j] : null; }
  this.dongInfo = function (node) {
    if (!D || !D.byRoads || !node || !G.city) return null;
    var k = roadKey(node), r = k && D.byRoads[k];
    return r && r.dong ? { dong: byName[r.dong] || null, name: r.dong, also: r.also || [] } : null;
  };
  this.dongOf = function (node) { var r = self.dongInfo(node); return r ? r.dong : null; };
  // 📍 **지금 선 자리**의 행정동(v0.10.54 · 소유자 「길로 가면 길 따라 행정동이 달라지는데」) — 큰 길이 동 경계인 곳이 많아 길 건너편은 다른 동이다.
  //  통계청 행정동 경계(data/dong-seocho.json)를 **그 지도의 변환**으로 게임 좌표에 옮겨 둔다: 고무판(트윈·서초구 1:1 — 실제 건물·도로와 같은 변환) ·
  //  1:1 지도는 아핀. 기본(베타) 지도는 배치가 실제와 달라 쓰지 않는다(교차로 도로 쌍 값으로 물러선다).
  var DG = null, GP = null, DN = null, NP = null;   // DN·NP = 서초구와 맞닿은 강남·동작·관악구 동(v0.10.56 · 경계와 이름만)
  this.loadDong = function (path) {
    if (location.protocol.indexOf('http') !== 0) return;
    fetch(path || 'data/dong-seocho.json').then(function (r) { return r.json(); }).then(function (j) { DG = j; GP = null; }).catch(function () {});
    fetch('data/dong-near.json').then(function (r) { return r.json(); }).then(function (j) { DN = j; NP = null; }).catch(function () {});
  };
  function toGame(lon, lat) {
    var M = TG.MAP; if (!M || !M.wgs84) return null;
    if (TG.warp && TG.warp.ok) return TG.warp.fromLL(lon, lat);
    if (M.scale1to1) { var W = M.wgs84, u = lon - W.lon0, w = lat - W.lat0; return [W.x[0] * u + W.x[1] * w + W.x[2], W.z[0] * u + W.z[1] * w + W.z[2]]; }
    return null;
  }
  function polysOf(list, withGu) {
    return list.map(function (d) {
      var polys = d.polys.map(function (P) { return P.map(function (ring) { return ring.map(function (q) { return toGame(q[0], q[1]); }); }); });
      var x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
      polys.forEach(function (P) { P[0].forEach(function (q) { if (q[0] < x0) x0 = q[0]; if (q[0] > x1) x1 = q[0]; if (q[1] < z0) z0 = q[1]; if (q[1] > z1) z1 = q[1]; }); });
      return { name: d.name, gu: withGu ? d.gu : null, polys: polys, box: [x0, x1, z0, z1] };
    });
  }
  // 서초구 밖이면 맞닿은 동 이름(「강남구 역삼1동」) — 모르면 ''
  this.nearAtPos = function (x, z) {
    if (!DN || !toGame(127.0, 37.49)) return '';
    if (!NP) NP = polysOf(DN.dong, true);
    for (var k = 0; k < NP.length; k++) {
      var d = NP[k], b = d.box; if (x < b[0] || x > b[1] || z < b[2] || z > b[3]) continue;
      for (var p = 0; p < d.polys.length; p++) { var P = d.polys[p]; if (inRing(P[0], x, z) && !P.slice(1).some(function (h) { return inRing(h, x, z); })) return d.gu + ' ' + d.name; }
    }
    return '';
  };
  function build() {
    if (GP || !DG) return GP;
    if (!toGame(127.0, 37.49)) { GP = []; return GP; }
    GP = DG.dong.map(function (d) {
      var polys = d.polys.map(function (P) { return P.map(function (ring) { return ring.map(function (q) { return toGame(q[0], q[1]); }); }); });
      var x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
      polys.forEach(function (P) { P[0].forEach(function (q) { if (q[0] < x0) x0 = q[0]; if (q[0] > x1) x1 = q[0]; if (q[1] < z0) z0 = q[1]; if (q[1] > z1) z1 = q[1]; }); });
      return { name: d.name, polys: polys, box: [x0, x1, z0, z1] };
    });
    return GP;
  }
  function inRing(r, x, z) { var c = false; for (var i = 0, j = r.length - 1; i < r.length; j = i++) { var xi = r[i][0], zi = r[i][1], xj = r[j][0], zj = r[j][1]; if (((zi > z) !== (zj > z)) && (x < (xj - xi) * (z - zi) / (zj - zi) + xi)) c = !c; } return c; }
  this.dongAtPos = function (x, z) {
    var gp = build(); if (!gp || !gp.length) return null;
    for (var k = 0; k < gp.length; k++) {
      var d = gp[k], b = d.box; if (x < b[0] || x > b[1] || z < b[2] || z > b[3]) continue;
      for (var p = 0; p < d.polys.length; p++) { var P = d.polys[p]; if (inRing(P[0], x, z) && !P.slice(1).some(function (h) { return inRing(h, x, z); })) return d.name; }
    }
    return '';   // 서초구 밖(동작·관악·강남구 쪽)
  };
  this.posMode = function () { var gp = build(); return !!(gp && gp.length); };
  // 이 자리의 동: 자리 판정이 되면 그 값, 안 되면(기본 지도·자료 없음) 가까운 교차로 값
  this.dongHere = function (x, z) {
    var nm = self.dongAtPos(x, z);
    if (nm === null) { var nd = G.city && G.city.nearestNode(x, z); var r = nd && self.dongInfo(nd); return r ? { name: r.name, dong: r.dong, exact: false, also: r.also } : null; }
    if (!nm) return { name: '', dong: null, exact: true, outside: true, near: self.nearAtPos(x, z) };
    return { name: nm, dong: byName[nm] || null, exact: true, also: [] };
  };
  // 경계에 걸친 교차로면 「서초3동 · 서초1동 경계」
  this.dongLabel = function (node) { var r = self.dongInfo(node); return r ? r.name + (r.also.length ? ' · ' + r.also.join('·') + ' 경계' : '') : ''; };
  // 연령 구성 → 행인 나이 비율. 어린이 = 0~19세 · 노인 = 70세 이상(보행 사고 자료와 결이 같다).
  //  그대로 쓰면 낮 거리에 아이가 너무 많다(학교·직장에 있다) — **보이는 비율은 게임 설계값으로 눌러 쓴다.**
  this.mix = function (dong) {
    if (!dong) return null;
    var a = dong.age, tot = dong.tot || 1;
    var kid = (a[0] + a[1]) / tot, senior = (a[7] + a[8] + a[9]) / tot;
    return { tot: dong.tot, kidShare: kid, seniorShare: senior,
             kid: TG.clamp(kid * 0.55, 0.02, 0.26), senior: TG.clamp(senior * 1.15, 0.02, 0.3) };
  };
  this.line = function (node) {
    var d = self.dongOf(node); if (!d) return '';
    var m = self.mix(d);
    return '👥 ' + d.name + ' ' + d.tot.toLocaleString() + '명 · 19세 이하 ' + Math.round(m.kidShare * 100) +
           '% · 70세 이상 ' + Math.round(m.seniorShare * 100) + '% (행안부 2026.8 · 교차로 자리는 통계청 행정동 경계로 판정)';
  };
  this.src = function () { return D ? D.source['연령별'] : ''; };
};
