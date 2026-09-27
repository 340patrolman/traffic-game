// 고무판 변환(rubber-sheet) — 실제 자리(위경도) → 이 지도의 **격자** 좌표 (v0.10.41)
//  소유자 2026-09-27: 「서초구 디지털 트윈 지도의 완성도를 극한까지」.
//  축약 지도(기본·트윈)는 서초구 간선 10개를 **곧은 격자**로 눌러 담는다. 그런데 실제 반포대로·서초대로는 굽는다.
//  그래서 위경도를 아핀변환 하나로 옮기면(종전) 실제 자리가 격자에서 150~580m 어긋나 **엉뚱한 블록**에 떨어졌다
//  (예: 서초역 출입구가 반포대로 건너편 블록에). v0.9.70 에 「좌표로 붙이지 마라」로 적어 두고 이름으로만 붙였던 까닭이다.
//  → 실제 도로 중심선(OSM · seocho-twin-roads.json, 아핀 공간)이 격자의 도로선에 **정확히 겹치도록** 땅을 늘이고 줄인다:
//     남북 도로 i 의 실제 x 는 그 점의 z 에서 xAt_i(z), 두 도로 사이의 몇 분의 몇인지(t)를 재서 격자 xs[i]~xs[i+1] 의 같은 자리에 둔다.
//     동서도 같다. 격자 밖은 가장 가까운 바깥 도로에서 같은 거리만큼 밀어 둔다.
//  이러면 **어느 두 도로 사이 · 어느 모퉁이**인지가 실제와 같아진다(위상이 맞는다). 거리는 격자 배율을 따른다.
//  자료는 부팅 때 한 번 읽는다(main.bootMap) — 격자는 city 가 생긴 뒤 setGrid 로 넘긴다. 읽지 못하면 ok=false 로 종전(아핀)대로 간다.
TG.warp = (function () {
  var V = null, H = null, xs = null, zs = null, W = null, src = null, MV = null, MH = null;
  var BLEND = 40;   // 자료 끝 너머 되돌아가는 거리 — 축약 지도 단위 40(약 590m). 미터 자료(unit m)면 1500m(init 에서)
  // 실제 도로 둘이 한 점으로 모이는 자리(효령로가 사당 쪽에서 남부순환로와 만난다 등)는 **곧은 격자로는 담을 수 없는 위상**이다.
  //  그 자리에서는 두 도로 사이 간격이 대표 간격의 절반 아래로 줄어든 만큼 대표 자리(곧은 선)로 섞는다 — 억지로 늘이면 땅이 뒤집힌다.
  function relax(lines, meds) {
    var r = 1;
    for (var k = 0; k < lines.length - 1; k++) { var G = meds[k + 1] - meds[k]; if (G > 0) r = Math.min(r, (lines[k + 1] - lines[k]) / G); }
    if (r >= 0.5) return lines;
    var a = Math.max(0, r / 0.5);
    return lines.map(function (l, k) { return meds[k] + a * (l - meds[k]); });
  }
  function curve(pts, along, med) {   // along: 0 = x 를 z 의 함수로(남북) · 1 = z 를 x 의 함수로(동서) · med: 그 도로의 대표(중앙값) 자리
    var P = pts.map(function (p) { return along ? [p[0], p[1]] : [p[1], p[0]]; })   // [주축, 가로]
      .sort(function (a, b) { return a[0] - b[0]; });
    // 자료 끝 너머는 끝값에 못 박지 않고 40 단위에 걸쳐 대표 자리로 돌아간다 — 끝이 휘어 들어간 도로(효령로 서쪽 끝 등)가
    //  그 너머 전부를 끌고 가지 않게(사당역이 효령로 북쪽으로 떨어졌다 — 실측)
    return function (s) {
      if (s <= P[0][0]) return P[0][1] + (med - P[0][1]) * Math.min(1, (P[0][0] - s) / BLEND);
      if (s >= P[P.length - 1][0]) { var e = P[P.length - 1]; return e[1] + (med - e[1]) * Math.min(1, (s - e[0]) / BLEND); }
      for (var k = 1; k < P.length; k++) if (s <= P[k][0]) { var t = (s - P[k - 1][0]) / ((P[k][0] - P[k - 1][0]) || 1); return P[k - 1][1] + t * (P[k][1] - P[k - 1][1]); }
      return P[P.length - 1][1];
    };
  }
  function axisMap(val, lines, grid) {   // lines: 그 점에서의 실제 도로 자리(오름차순) · grid: 격자 좌표
    var n = lines.length;
    if (val <= lines[0]) return grid[0] + (val - lines[0]);
    if (val >= lines[n - 1]) return grid[n - 1] + (val - lines[n - 1]);
    for (var k = 0; k < n - 1; k++) if (val <= lines[k + 1]) {
      var t = (val - lines[k]) / ((lines[k + 1] - lines[k]) || 1);
      return grid[k] + t * (grid[k + 1] - grid[k]);
    }
    return grid[n - 1];
  }
  var self = {
    ok: false, note: '',
    // roads: seocho-twin-roads.json(아핀 공간) · names: 이 지도의 도로 이름(남북·동서) · wgs84: 그 아핀변환
    init: function (roads, map) {
      self.ok = false; V = H = null; src = roads; W = map && map.wgs84;
      BLEND = (roads && roads.unit === 'm') ? 1500 : 40;   // 미터 지도 실측: 590m 면 양재역 515m 어긋남, 1500m 면 역 7곳 모두 3~18m
      if (!roads || !roads.roads || !map || !W) { self.note = '도로 형상 자료 없음'; return false; }
      var nv = map.roadNamesV || [], nh = map.roadNamesH || [];
      function find(name, ax) { var r = roads.roads[name]; return (r && r.axis === ax && r.pts && r.pts.length > 1) ? r : null; }   // roads 는 이름을 열쇠로 한 객체다
      var vr = nv.map(function (nm) { return find(nm, 'v'); }), hr = nh.map(function (nm) { return find(nm, 'h'); });
      if (!vr.length || !hr.length || vr.some(function (r) { return !r; }) || hr.some(function (r) { return !r; })) { self.note = '도로 이름이 형상 자료와 안 맞음'; return false; }
      function medOf(r, k) { if (typeof r.median === 'number') return r.median; var a = r.pts.map(function (p) { return p[k]; }).sort(function (x, y) { return x - y; }); return a[Math.floor((a.length - 1) / 2)]; }
      MV = vr.map(function (r) { return medOf(r, 0); }); MH = hr.map(function (r) { return medOf(r, 1); });
      V = vr.map(function (r, k) { return curve(r.pts, 0, MV[k]); });
      H = hr.map(function (r, k) { return curve(r.pts, 1, MH[k]); });
      self.names = { v: nv.slice(), h: nh.slice() };
      return true;
    },
    setGrid: function (gx, gz) {
      xs = gx; zs = gz;
      self.ok = !!(V && H && xs && zs && xs.length === V.length && zs.length === H.length);
      if (!self.ok && V) self.note = '격자 도로 수가 형상 자료와 다름';
      return self.ok;
    },
    // 아핀 공간(종전 방식으로 옮긴 자리) → 격자 자리. 자료가 없으면 그대로 돌려준다.
    fromAffine: function (X, Z) {
      if (!self.ok) return [X, Z];
      var lv = relax(V.map(function (f) { return f(Z); }), MV), lh = relax(H.map(function (f) { return f(X); }), MH);
      // 도로가 서로 엇갈린 자리(자료 끝의 고정값)에서도 순서를 지킨다
      for (var a = 1; a < lv.length; a++) if (lv[a] <= lv[a - 1]) lv[a] = lv[a - 1] + 1;
      for (var b = 1; b < lh.length; b++) if (lh[b] <= lh[b - 1]) lh[b] = lh[b - 1] + 1;
      return [axisMap(X, lv, xs), axisMap(Z, lh, zs)];
    },
    affine: function (lon, lat) {
      if (!W) return null;
      var u = lon - W.lon0, w = lat - W.lat0;
      return [W.x[0] * u + W.x[1] * w + W.x[2], W.z[0] * u + W.z[1] * w + W.z[2]];
    },
    // 위경도 → 격자 자리(고무판이 없으면 아핀만)
    fromLL: function (lon, lat) { var a = self.affine(lon, lat); return a ? self.fromAffine(a[0], a[1]) : null; },
    // 자료 파일이 **다른 지도의 아핀 공간**으로 구워져 있을 때(TAAS 사례 gx·gz 는 축약 지도 공간) — 그 식을 거꾸로 풀어 위경도로 되돌린 뒤 옮긴다(v0.10.42)
    fromData: function (X, Z) {
      var D = TG.MAP && TG.MAP.dataAffine;
      if (!D || !D.x || !D.z) return self.fromAffine(X, Z);
      var a = D.x[0], b = D.x[1], c = D.z[0], d = D.z[1], det = a * d - b * c;
      if (!det) return self.fromAffine(X, Z);
      var px = X - D.x[2], pz = Z - D.z[2], u = (d * px - b * pz) / det, w = (-c * px + a * pz) / det;
      return self.fromLL(u + D.lon0, w + D.lat0);
    },
    source: function () { return src && (src.attribution || 'OpenStreetMap contributors (ODbL)'); }
  };
  return self;
})();
