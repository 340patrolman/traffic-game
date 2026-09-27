// 🏙 도시 공공데이터(v0.10.44) — 행사·축제 · 집회·행진 · 교통량 · 무인 단속 카메라
//  소유자 2026-09-28: 「서초구 디지털트윈 지도에 동네별 각종 공공데이터를 넣어주고 현재시간과 날씨 차량통행량과 기타 여러가지
//  한강시민공원 행사 축제 서초구 축제 행사 집회 행진 등 모두 넣고」 · 「게임의 출발 지역을 선택할 수 있게 … 공공데이터로 알 수 있는 모든 것」.
//  ⚠ **게임은 통신 0 이다.** 자료는 받은 날(2026-09-28)에 구워 둔 파일이고, 게임은 **기기 날짜·시각**으로 그날 해당하는 것을 고른다.
//     받은 날 뒤의 행사는 자료에 있는 것까지만, 집회는 받은 날까지만 안다 — 그 뒤는 **지난 무늬(요일·시간·자리)** 로만 말한다.
//  ⚠ 자리는 위경도를 그 지도의 고무판 변환(js/warp.js)으로 옮긴다 — 변환이 없는 지도(기본·서초역 1:1)는 아핀만.
//  ⚠ 이 파일은 자료를 만들지 않는다. 없는 값은 없다고 적는다.
TG.CityData = function (game) {
  var self = this, G = game, EV = null, VOL = null, CAM = null;
  var evPts = [], ralPts = [], camPts = [];
  function toXZ(lon, lat) {
    if (!(lat > 0 && lon > 0)) return null;
    if (TG.warp && TG.warp.ok) return TG.warp.fromLL(lon, lat);
    var W = TG.MAP && TG.MAP.wgs84; if (!W) return null;
    var u = lon - W.lon0, w = lat - W.lat0;
    return [W.x[0] * u + W.x[1] * w + W.x[2], W.z[0] * u + W.z[1] * w + W.z[2]];
  }
  function ymd(d) { var m = d.getMonth() + 1, dd = d.getDate(); return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (dd < 10 ? '0' : '') + dd; }
  function get(path, cb) {
    if (!path || location.protocol.indexOf('http') !== 0) { cb(null); return; }
    fetch(path).then(function (r) { return r.json(); }).then(cb).catch(function () { cb(null); });
  }
  this.load = function (entry, done) {
    var n = 3, fin = function () { if (--n === 0 && done) done(); };
    get(entry && entry.events, function (j) {
      EV = j; evPts = []; ralPts = [];
      if (j && j.events) j.events.items.forEach(function (e) { var q = toXZ(e.lon, e.lat); if (q) evPts.push({ e: e, x: q[0], z: q[1] }); });
      if (j && j.rallies) j.rallies.items.forEach(function (r) { var q = toXZ(r.lon, r.lat), q2 = r.dest ? toXZ(r.dest[1], r.dest[0]) : null; ralPts.push({ r: r, x: q ? q[0] : null, z: q ? q[1] : null, to: q2 }); });
      fin();
    });
    get(entry && entry.volume, function (j) { VOL = j; fin(); });
    get(entry && entry.cameras, function (j) {
      CAM = j; camPts = [];
      if (j && j.items) j.items.forEach(function (c) { var q = toXZ(c.lon, c.lat); if (q) camPts.push({ c: c, x: q[0], z: q[1] }); });
      fin();
    });
  };
  this.ready = function () { return !!(EV || VOL || CAM); };
  this.src = function (k) { var j = k === 'vol' ? VOL : k === 'cam' ? CAM : EV; if (!j) return ''; if (k === 'rally') return EV && EV.rallies ? EV.rallies.source : ''; if (k === 'ev') return EV && EV.events ? EV.events.source + ' · ' + EV.events.license : ''; return (j.source || '') + (j.license ? ' · ' + j.license : ''); };
  this.collected = function () { return EV ? EV.collected : null; };

  // ── 행사·축제 ─────────────────────────────────────────────
  //  on(날짜): 그날 열려 있는 행사 · near(자리, 반경 m, 날짜, 며칠 앞까지)
  this.eventsOn = function (date) { var d = ymd(date || new Date()); return evPts.filter(function (p) { return p.e.s <= d && p.e.e >= d; }); };
  this.eventsNear = function (x, z, r, date, ahead) {
    var d0 = date || new Date(), a = ymd(d0), b = ymd(new Date(d0.getTime() + (ahead || 0) * 864e5));
    return evPts.filter(function (p) { return Math.hypot(p.x - x, p.z - z) <= r && p.e.e >= a && p.e.s <= b; })
      .sort(function (p, q) { return p.e.s < q.e.s ? -1 : 1; });
  };
  this.isFestival = function (e) { return /축제/.test(e.c || ''); };

  // ── 집회·행진 ─────────────────────────────────────────────
  this.ralliesOn = function (date) { var d = ymd(date || new Date()); return ralPts.filter(function (p) { return p.r.d === d; }); };
  //  받은 자료 기간의 무늬 — 자리별 횟수·요일·시간(받은 날 뒤를 **예측하지 않는다**, 지난 무늬를 그대로 보인다)
  this.rallyPattern = function () {
    var by = {};
    ralPts.forEach(function (p) {
      var key = p.r.p.replace(/\s*(이면도로|인도)\s*/g, ' ').replace(/7出/g, '7출').replace(/\s+/g, ' ').trim();
      var o = by[key] = by[key] || { place: key, n: 0, dows: {}, hours: [], max: 0, x: p.x, z: p.z, approx: p.r.approx, note: p.r.note };
      o.n++; var dw = ['일', '월', '화', '수', '목', '금', '토'][new Date(p.r.d + 'T12:00:00').getDay()]; o.dows[dw] = (o.dows[dw] || 0) + 1;
      o.hours.push(p.r.from + '~' + p.r.to); o.max = Math.max(o.max, p.r.n);
    });
    return Object.keys(by).map(function (k) { return by[k]; }).sort(function (a, b) { return b.n - a.n; });
  };
  this.ralliesNear = function (x, z, r) { return ralPts.filter(function (p) { return p.x != null && Math.hypot(p.x - x, p.z - z) <= r; }); };
  this.rallyRange = function () { if (!ralPts.length) return null; var ds = ralPts.map(function (p) { return p.r.d; }).sort(); return [ds[0], ds[ds.length - 1], ralPts.length]; };

  // ── 교통량 ─────────────────────────────────────────────
  function dayType(d) { var w = d.getDay(); if (w === 0) return 'sun'; if (w === 6) return 'sat'; return 'wd'; }
  //  그 도로(축·번호)에서 가장 가까운 조사 지점 — 같은 축의 지점이 없으면 null(다른 도로 값을 빌려 쓰지 않는다)
  this.volSpot = function (axis, idx, x, z) {
    if (!VOL || !VOL.spots) return null;
    var best = null, bd = 1e18;
    VOL.spots.forEach(function (s) {
      if (s.axis !== axis || s.idx !== idx || s.outside) return;
      var N = G.city.nodes[s.node[0]] && G.city.nodes[s.node[0]][s.node[1]]; if (!N) return;
      var dd = Math.hypot(N.x - x, N.z - z); if (dd < bd) { bd = dd; best = s; }
    });
    return best;
  };
  this.volAt = function (spot, date) {
    var d = date || new Date(), t = dayType(d), h = d.getHours(), a = spot[t] && spot[t][h];
    if (!a) return null;
    var day = (spot[t] || []).reduce(function (s, v) { return s + v[0] + v[1]; }, 0);
    var peakH = 0, peakV = 0; (spot[t] || []).forEach(function (v, i) { if (v[0] + v[1] > peakV) { peakV = v[0] + v[1]; peakH = i; } });
    return { now: a[0] + a[1], dir: a, day: day, peakH: peakH, peakV: peakV, type: t };
  };
  //  도시 혼잡도(0~1): 조사 지점 전체의 이 시각 합 ÷ 그날 가장 붐비는 시각 합. 수요(js/demand.js)가 쓴다.
  this.busy = function (date) {
    if (!VOL || !VOL.spots) return null;
    var d = date || new Date(), t = dayType(d), h = d.getHours(), cur = 0, mx = 0, mn = 1e12;
    for (var hh = 0; hh < 24; hh++) {
      var s = 0; VOL.spots.forEach(function (sp) { var v = sp[t] && sp[t][hh]; if (v) s += v[0] + v[1]; });
      if (hh === h) cur = s; mx = Math.max(mx, s); mn = Math.min(mn, s);
    }
    if (!(mx > mn)) return null;
    return { busy: (cur - mn) / (mx - mn), perHour: cur, spots: VOL.spots.length, type: t, hour: h };
  };

  // ── 무인 단속 카메라 ─────────────────────────────────────
  this.camerasNear = function (x, z, r) {
    return camPts.map(function (p) { return { c: p.c, x: p.x, z: p.z, d: Math.hypot(p.x - x, p.z - z) }; })
      .filter(function (p) { return p.d <= r; }).sort(function (a, b) { return a.d - b.d; });
  };
  this.cameraCount = function () { return camPts.length; };
  this.cameraRef = function () { return CAM ? CAM.referenceDate : null; };

  // 미니맵·검증이 읽는다
  this.points = function () { return { events: evPts, rallies: ralPts, cameras: camPts }; };
};
