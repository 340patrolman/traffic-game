// 같은 자리 열쇠(v0.10.119) — 게임 · 데이터 압축지도 · T-Book 이 같은 교차로를 같은 열쇠로 부른다.
// 열쇠 표 = data/intersections-seocho.json(격자 i,j · 실제 위경도 · T-GIS 교차로코드 tgis · C-ITS 신호번호 sigNo — tools/maps/place-keys.py).
// 들어오는 길: 주소 ?at=INT-548 또는 ?at=37.4917,127.0077 (+ &nm=이름) → 그 교차로에서 순찰 근무를 연다(지도 「🚓 여기서 근무해 보기」).
// 나가는 길: mapUrl(i,j) → 데이터 압축지도 그 교차로(#lat=..&lon=..&int=..).
// 통신 0 그대로 — 표는 이 저장소 파일이고, 주소의 좌표는 어디에도 저장하지 않는다.
TG.PlaceKey = (function () {
  var self = {}, NODES = null, WAIT = [];
  var MAP_URL = 'https://340patrolman.github.io/datamap/';
  var NEAR_M = 700;   // 이 거리 안이면 그 교차로로 본다(게임 설계값 — 간선 교차로 사이 간격의 절반쯤)
  function dist(a, b, c, d) { return Math.hypot((b - d) * 88800, (a - c) * 111000); }
  self.load = function (cb) {
    if (NODES) { if (cb) cb(NODES); return; }
    if (cb) WAIT.push(cb);
    if (WAIT.length > 1 || self.loading) return;
    self.loading = true;
    try {
      fetch('data/intersections-seocho.json').then(function (r) { return r.json(); }).then(function (j) {
        NODES = j.nodes || []; self.loading = false; var w = WAIT; WAIT = []; w.forEach(function (f) { f(NODES); });
      }).catch(function () { NODES = []; self.loading = false; var w = WAIT; WAIT = []; w.forEach(function (f) { f(NODES); }); });
    } catch (e) { NODES = []; self.loading = false; }
  };
  self.nodes = function () { return NODES || []; };
  self.byIJ = function (i, j) { var r = null; (NODES || []).forEach(function (n) { if (n.i === i && n.j === j) r = n; }); return r; };
  // 주소 ?at= 읽기 → { tgis } 또는 { lat, lon } (+ nm)
  self.param = function (search) {
    var q = new URLSearchParams(search == null ? location.search : search), a = q.get('at'); if (!a) return null;
    var nm = q.get('nm') || '', m = /^INT-(\d+)$/i.exec(a);
    if (m) return { tgis: +m[1], nm: nm };
    var p = a.split(','), la = +p[0], lo = +p[1];
    if (isFinite(la) && isFinite(lo) && la > 33 && la < 39 && lo > 124 && lo < 132) return { lat: la, lon: lo, nm: nm };
    return null;
  };
  // 열쇠 → 게임 교차로(실제로 만나는 25곳 중) · 없으면 null
  self.find = function (k) {
    if (!k || !NODES) return null;
    var hit = null;
    if (k.tgis) NODES.forEach(function (n) { if (n.tgis === k.tgis && n.met !== false) hit = { n: n, m: 0, by: 'tgis' }; });
    if (hit) return hit;
    if (k.lat == null) return null;
    NODES.forEach(function (n) { if (n.met === false) return; var d = dist(k.lat, k.lon, n.lat, n.lon); if (!hit || d < hit.m) hit = { n: n, m: d, by: 'll' }; });
    return hit && hit.m <= NEAR_M ? hit : (hit ? { n: null, m: hit.m, near: hit.n } : null);
  };
  self.mapUrl = function (i, j) {
    var n = self.byIJ(i, j); if (!n || n.met === false) return null;
    return MAP_URL + '#lat=' + n.lat.toFixed(5) + '&lon=' + n.lon.toFixed(5) + (n.tgis ? '&int=' + n.tgis : '');
  };
  self.NEAR_M = NEAR_M;
  return self;
})();
