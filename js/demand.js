// 🕗 요일·시간대 수요(v0.10.19) — 「지금이 몇 요일 몇 시인가」에 따라 도시가 달라진다(디지털 트윈 층).
//  ⚠ **실제 교통량 자료가 아니다.** 서울 열린데이터광장의 시간대별 교통량(VolInfo)은 어느 날짜로 물어도 비어 있고
//     data.go.kr 「서울특별시_교통량 이력 정보」는 엔드포인트를 아직 못 찾았다(v0.9.68 기록). 그래서 지어내지 않고
//     **이미 확보한 1차 자료 둘에서 대리지표를 만든다**:
//     ① 경찰청 교차로계획정보(TOD) — 그 시각의 **신호 주기**. 신호 주기는 수요에 맞춰 늘린다(혼잡할수록 길다).
//     ② TAAS 사고 시간대 분포(byHour) — 그 시각에 **사람이 실제로 얼마나 다치는가**(보행자 밀도의 대리지표).
//  둘 다 화면에 출처와 「대리지표」임을 그대로 적는다. 교통량을 아는 척하지 않는다.
TG.Demand = function (game) {
  var self = this, G = game;
  var last = null;

  // ① 신호 주기 — 그 지도의 TOD 자료 51곳에서 **지금 시각 주기의 중앙값**을 낸다
  function cycleNow(date) {
    var tod = G.signalTod;
    if (!tod || !tod.ready) return null;
    var spots = tod.spots(), v = [];
    for (var i = 0; i < spots.length; i++) {
      var inf = tod.infoBySpot(spots[i], date);
      if (inf && inf.cycle > 0) v.push(inf.cycle);
    }
    if (v.length < 5) return null;
    v.sort(function (a, b) { return a - b; });
    return { med: v[Math.floor(v.length / 2)], n: v.length, min: v[0], max: v[v.length - 1] };
  }
  // 그 지도에서 주기가 가장 짧은 때(심야)와 가장 긴 때(첨두)를 재어 0~1 로 편다 — 하루를 두 시간 간격으로 훑는다
  var span = null;
  function cycleSpan(date) {
    if (span) return span;
    var lo = 1e9, hi = 0, d = new Date(date || Date.now());
    for (var h = 0; h < 24; h += 2) {
      d.setHours(h, 30, 0, 0);
      var c = cycleNow(d);
      if (!c) continue;
      if (c.med < lo) lo = c.med;
      if (c.med > hi) hi = c.med;
    }
    span = (hi > lo) ? { lo: lo, hi: hi } : null;
    return span;
  }
  // ② TAAS 사고 시간대 분포 — 보행자 쪽 가중(그 시각에 사람이 많이 다친다 = 사람이 많이 다닌다)
  function pedWeight(hour) {
    var L = G.layers;
    if (!L || !L.hourBrief) return 1;
    var b = L.hourBrief(hour);
    if (!b || !b.rows || !b.rows.length) return 1;
    // 보행 갈래(보행자·노인 보행·어린이 보행)의 **3시간 창 비중**을 평균한다.
    //  하루를 24시간으로 고르게 나눈 비중은 3/24 = 0.125 — 그보다 높으면 그 시각에 사람이 많이 다닌다.
    var w = b.rows.filter(function (r) { return /보행/.test(r.name); });
    if (!w.length) w = b.rows.slice(0, 1);
    var share = 0; w.forEach(function (r) { share += r.share; }); share /= w.length;
    return TG.clamp(0.6 + (share / 0.125) * 0.45, 0.6, 1.6);
  }

  // 지금(또는 넘겨준 시각)의 수요. 자료가 없으면 null 을 돌려주고 게임은 종전 밀도로 돈다.
  this.index = function (date) {
    var d = date || new Date(), c = cycleNow(d), sp = cycleSpan(d);
    if (!c || !sp) return null;
    var busy = TG.clamp((c.med - sp.lo) / Math.max(1, sp.hi - sp.lo), 0, 1);
    last = {
      busy: +busy.toFixed(2), cycle: c.med, n: c.n, lo: sp.lo, hi: sp.hi,
      hour: d.getHours(), dow: ['일', '월', '화', '수', '목', '금', '토'][d.getDay()],
      pedW: +pedWeight(d.getHours()).toFixed(2)
    };
    return last;
  };
  this.last = function () { return last; };

  // 도시 밀도에 건다. **곱하는 폭은 게임 설계값**이다(0.55~1.30배) — 자료는 「언제가 더 붐비는가」만 말해 준다.
  this.apply = function (C, baseTraffic, basePed, date) {
    var x = self.index(date);
    if (!x) return null;
    C.TRAFFIC_MAX = Math.max(8, Math.round(baseTraffic * (0.55 + x.busy * 0.75)));
    C.PED_MAX = Math.max(8, Math.round(basePed * (0.55 + x.busy * 0.55) * x.pedW));
    x.traffic = C.TRAFFIC_MAX; x.ped = C.PED_MAX;
    return x;
  };
  // 화면에 그대로 적는 한 줄 — 근거와 한계를 같이 말한다
  this.line = function () {
    var x = last;
    if (!x) return '';
    return x.dow + '요일 ' + x.hour + '시 — 신호 주기 중앙값 ' + x.cycle + '초(교차로 ' + x.n + '곳) · 혼잡 ' +
      Math.round(x.busy * 100) + '% → 차량 ' + x.traffic + '대 · 사람 ' + x.ped + '명';
  };
  this.note = '실제 교통량 자료가 아니라 **경찰청 신호 주기(TOD)와 TAAS 사고 시간대 분포에서 유도한 대리지표**입니다. 곱하는 폭은 게임 설계값입니다.';
};
