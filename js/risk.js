// 🧭 지금 무엇이 잦은가(v0.10.27) — 소유자 지시 「시간별 요일별로 정리 되어있을 테니 현재 시간·날씨로 발생 가능성 높은 것으로」.
//  **자료가 없으면 아무 말도 하지 않는다.** 지금 채워져 있는 것은 교통(TAAS)뿐이고,
//  절도·강도·스토킹·실종·화재는 `data/incidents-seocho.json` 이 비어 있어 갈래 자체가 꺼져 있다(DATA_WANTED.md).
//  자료가 들어오면 이 파일을 고치지 않아도 그날 바로 돈다 — 엔진은 파일만 읽는다.
TG.Risk = function (game) {
  var self = this, G = game, D = null;

  this.load = function (path, cb) {
    if (location.protocol.indexOf('http') !== 0) { if (cb) cb('file://'); return; }
    fetch(path || 'data/incidents-seocho.json').then(function (r) { return r.json(); }).then(function (j) {
      D = j; if (cb) cb(null, j);
    }).catch(function (e) { if (cb) cb(e.message); });
  };
  this.ready = function () { return !!D; };
  this.filled = function () { return !!(D && D.filled); };
  this.kinds = function () { return D ? D.kinds : []; };

  // 한 갈래의 「지금 점수」 = (그 시각 비중) × (그 요일 비중) × (그 달 비중) × (날씨 가중, 자료가 있을 때만)
  //  비중은 **그 갈래 안에서의 몫**이라 갈래끼리 바로 견줄 수 없다 — 그래서 아래에서 건수로 다시 곱한다.
  function share(arr, i) {
    if (!arr || !arr.length) return null;
    var s = 0; for (var k = 0; k < arr.length; k++) s += arr[k] || 0;
    return s > 0 ? (arr[i] || 0) / s : null;
  }
  this.scoreOf = function (id, date, weather) {
    if (!D || !D.data || !D.data[id]) return null;
    var e = D.data[id], d = date || new Date();
    // 원자료가 **3시간 단위**면 그대로 3시간 칸으로 읽는다 — 시간별로 쪼개지 않는다(없는 정밀도를 만들지 않는다).
    var band = e.byBand3 ? e.byBand3 : null;
    var h = band ? share(band, Math.floor(d.getHours() / 3)) : share(e.byHour, d.getHours());
    var w = share(e.byDow, d.getDay()), m = share(e.byMonth, d.getMonth());
    if (h === null) return null;
    var arr = band || e.byHour || [];
    var tot = 0; for (var k = 0; k < arr.length; k++) tot += arr[k] || 0;
    var v = tot * h * (w === null ? 1 : w * 7) * (m === null ? 1 : m * 12);
    // 날씨 가중은 **자료에 조건별 건수가 있을 때만** 쓴다(없으면 1)
    if (weather && e.byWeather && e.byWeather[weather]) {
      var ws = 0, kk; for (kk in e.byWeather) ws += e.byWeather[kk] || 0;
      if (ws > 0) v *= (e.byWeather[weather] / ws) * Object.keys(e.byWeather).length;
    }
    return v;
  };
  // 지금 가장 잦은 갈래 위쪽 몇 개. 자료가 없으면 빈 배열이다(그러면 화면에 아무것도 안 뜬다).
  this.top = function (n, date, weather) {
    if (!D || !D.data) return [];
    var out = [];
    for (var i = 0; i < D.kinds.length; i++) {
      var k = D.kinds[i], s = self.scoreOf(k.id, date, weather);
      if (s !== null && s > 0) out.push({ id: k.id, name: k.name, who: k.who, score: s,
        scope: (D.data[k.id] || {}).scope || '', year: (D.data[k.id] || {}).year || '', src: (D.data[k.id] || {}).source || '' });
    }
    out.sort(function (a, b) { return b.score - a.score; });
    return out.slice(0, n || 2);
  };
  // 근무 브리핑 한 줄 — 자료가 있는 갈래만 말한다. 출처를 같이 적는다.
  this.line = function (date, weather) {
    var t = self.top(2, date, weather);
    if (!t.length) return '';
    var d = date || new Date(), dow = ['일', '월', '화', '수', '목', '금', '토'][d.getDay()];
    // **어느 범위의 자료인지 반드시 같이 적는다** — 지금 것은 전국 2019년 분포이고 서초구 값이 아니다.
    var sc = t[0] && t[0].scope ? t[0].scope : '';
    var yr = t[0] && t[0].year ? t[0].year : '';
    return '🧭 ' + dow + '요일 ' + d.getHours() + '시 — 이 시간대에 잦은 신고: ' +
           t.map(function (x) { return x.name + (x.who === '소방' ? '(소방)' : ''); }).join(' · ') +
           (sc ? ' (' + sc + ' ' + yr + ' 분포 · 서초 값 아님)' : '');
  };
  // 아직 못 받은 갈래 목록(화면·문서에 그대로 보여 준다 — 숨기지 않는다)
  this.missing = function () {
    if (!D) return [];
    return D.kinds.filter(function (k) { return !k.filled; }).map(function (k) { return k.name; });
  };
};
