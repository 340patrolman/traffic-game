// 🏛 국가유산(역사·흥미) — 소유자 「역사적 의미, 흥미를 끌 만한 것도 디지털 트윈 지도가 품고 있다가 보여줄 수 있어야 한다」(2026-09-25)
//  자료: **국가유산청 국가유산 목록 공개 OpenAPI**(키 없음 · 2026-09-25 수집). 서울 서초구 지정·등록 국가유산.
//  ⚠ 위경도로 담는다 — 지도마다 배율·원점이 달라(축약 13.1m/unit · 1:1 1m/unit) 게임 좌표로 구워 두면
//     다른 지도에서 엉뚱한 자리에 그려진다(v0.10.31 자치구 경계에서 겪었다). **그리는 쪽이 그 지도의 wgs84 변환으로 옮긴다.**
//  ⚠ 좌표가 없는 항목(동산 국가유산 중 일부)은 **자리에 찍지 않는다** — 없는 자리에 세우지 않는다.
TG.Heritage = function () {
  var self = this, D = null, pts = [];

  function project() {
    pts = [];
    var W = TG.MAP && TG.MAP.wgs84;
    if (!D || !D.items || !W || !W.x || !W.z) return;
    D.items.forEach(function (h) {
      if (!(h.lat > 0 && h.lon > 0)) return;              // 좌표 없는 것은 자리에 안 찍는다
      var u = h.lon - W.lon0, w = h.lat - W.lat0;
      pts.push({
        x: W.x[0] * u + W.x[1] * w + W.x[2],
        z: W.z[0] * u + W.z[1] * w + W.z[2],
        name: h.name, kind: h.kind, era: h.era, desc: h.desc, addr: h.addr, admin: h.admin
      });
    });
  }

  this.load = function (path, cb) {
    if (!path || location.protocol.indexOf('http') !== 0) { if (cb) cb('skip'); return; }
    fetch(path).then(function (r) { return r.json(); }).then(function (j) {
      D = j; project();
      if (cb) cb(null, pts.length, (D.items || []).length);
    }).catch(function (e) { if (cb) cb(e && e.message); });
  };
  this.ready = function () { return !!(D && D.items && D.items.length); };
  this.data = function () { return D; };
  this.count = function () { return D && D.items ? D.items.length : 0; };
  this.placed = function () { return pts.length; };
  this.src = function () { return (D && D.source) || '국가유산청 국가유산 목록 공개 OpenAPI'; };
  this.all = function () { return pts; };

  // 이 자리 가까운 국가유산 — 가까운 순
  this.near = function (x, z, r) {
    r = r || 400;
    var out = [];
    pts.forEach(function (p) {
      var d = Math.hypot(p.x - x, p.z - z);
      if (d <= r) out.push({ name: p.name, kind: p.kind, era: p.era, addr: p.addr, admin: p.admin, dist: Math.round(d), desc: short(p.desc) });
    });
    out.sort(function (a, b) { return a.dist - b.dist; });
    return out;
  };
  // 설명은 길다 — 첫 두 문장까지만(원문을 줄여 옮기지 않고 자른 것이라고 화면에 적는다)
  function short(s) {
    if (!s) return '';
    // ⚠ 뒤보기 정규식 `(?<=)` 은 쓰지 않는다 — 옛 사파리는 그 한 줄로 **파일 전체가 파싱 실패**한다(v0.9.58).
    s = String(s).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    var t = s, cut = 0, seen = 0;
    for (var i = 0; i < s.length; i++) {
      if (s.charAt(i) === '.' || s.charAt(i) === '\u3002') { seen++; if (seen >= 2) { cut = i + 1; break; } }
    }
    if (cut > 0) t = s.slice(0, cut);
    if (t.length > 160) t = t.slice(0, 158) + '…';
    return t;
  }
};
