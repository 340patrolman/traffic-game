// 시간대별 신호계획(TOD) — 경찰청 교차로계획정보. **숫자는 코드에 한 줄도 없다**(data/signal-tod-*.json 만 읽는다).
// 자료 구조가 실제 제어기와 같다: 요일 → 계획번호 → 시각별 [주기, 옵셋, A링 현시, B링 현시].
//   · 현시값의 합 = 주기 (표본에서 확인)
//   · A링 ≠ B링 이면 겹침현시(좌회전 lead/lag)
//   · **어느 현시가 어느 방향인지는 이 자료에 없다** — 그래서 게임은 주기만 쓴다(배분은 게임 설계값).
// 「지금」은 기기 시계를 본다. 교통근무 중에 그 교차로가 지금 몇 초로 도는지 바로 보려는 것이 목적이다.
TG.SignalTod = function () {
  var self = this, D = null;
  self.ready = false;
  self.err = '';

  self.load = function (path, cb) {
    if (!path) { self.err = '지도에 signalTod 가 없습니다'; if (cb) cb(self.err); return; }
    if (location.protocol.indexOf('http') !== 0) { self.err = 'file:// — 시간대별 계획을 읽을 수 없습니다'; if (cb) cb(self.err); return; }
    fetch(path).then(function (r) { return r.json(); }).then(function (j) {
      D = j; self.ready = !!(j && j.spots && j.spots.length);
      if (cb) cb(null, self.spots().length);
    }).catch(function (e) { self.err = e.message; if (cb) cb(e.message); });
  };

  self.data = function () { return D; };
  self.source = function () { return D ? (D.source || '') : ''; };
  self.note = function () { return D ? (D.note || '') : ''; };
  self.area = function () { return D ? (D.area || '') : ''; };
  self.spots = function () { return (D && D.spots) || []; };
  self.spot = function (name) {
    var s = self.spots();
    for (var i = 0; i < s.length; i++) if (s[i].name === name) return s[i];
    return null;
  };
  // 자료의 요일 코드는 일=1 … 토=7 이다(경찰청 PLAN_DY).
  function dowCode(date) { return (date || new Date()).getDay() + 1; }
  self.dowKo = function (date) { var k = (D && D.dowKo) || null; return k ? k[dowCode(date) - 1] : ''; };
  self.planNo = function (spot, date) {
    if (!spot || !spot.dow) return null;
    var p = spot.dow['' + dowCode(date)];
    if (p && spot.plans && spot.plans[p]) return p;
    // 그 요일 계획이 없으면 가진 것 중 첫 번째로 물러선다(자료가 비어 있는 요일이 있다)
    for (var k in spot.plans) return k;
    return null;
  };
  self.rows = function (spot, date) {
    var p = self.planNo(spot, date);
    return (p && spot.plans[p]) || [];
  };
  function mins(hhmm) { var a = String(hhmm).split(':'); return (+a[0]) * 60 + (+a[1] || 0); }
  // 지금 도는 줄. 첫 줄보다 이른 시각이면 **그 계획의 마지막 줄**이 이어지고 있는 것으로 본다
  // (심야 계획이 자정을 넘어 이어진다. 전날의 요일 계획과 다를 수 있어 그때는 근사다).
  self.nowIndex = function (spot, date) {
    var r = self.rows(spot, date); if (!r.length) return -1;
    var now = mins((date || new Date()).getHours() + ':' + (date || new Date()).getMinutes());
    var idx = -1;
    for (var i = 0; i < r.length; i++) if (mins(r[i][0]) <= now) idx = i;
    return idx < 0 ? r.length - 1 : idx;
  };
  // 화면·게임이 쓰는 한 덩이. 없으면 null 이고, 그때 게임은 최빈 주기로 남는다.
  self.info = function (name, date) {
    if (!self.ready) return null;
    var sp = self.spot(name); if (!sp) return null;
    var r = self.rows(sp, date), i = self.nowIndex(sp, date);
    if (i < 0) return null;
    var row = r[i], nx = r[(i + 1) % r.length];
    var A = String(row[3]).split(' ').filter(Boolean), B = String(row[4]).split(' ').filter(Boolean);
    return {
      name: sp.name, no: sp.no, lat: sp.lat, lon: sp.lon,
      plan: self.planNo(sp, date), dowKo: self.dowKo(date),
      time: row[0], cycle: row[1], offset: row[2],
      a: A, b: B, phases: Math.max(A.length, B.length), lap: row[3] !== row[4],
      wrapped: mins(row[0]) > mins((date || new Date()).getHours() + ':' + (date || new Date()).getMinutes()),
      nextTime: nx ? nx[0] : '', nextCycle: nx ? nx[1] : 0, rows: r.length
    };
  };
  self.infoBySpot = function (spot, date) { return spot ? self.info(spot.name, date) : null; };
};
