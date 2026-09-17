// 📏 재미 계측(완성도 지시서 1절 · ROADMAP A-P0) — 「재미를 망치는 원인」을 숫자로 남긴다. **게임 동작은 바꾸지 않는다**(보기만 한다).
//  F1 첫 행동까지(초) · F2 첫 성공까지(초) · F3 빈 시간 최대·평균 간격(초) · F4 누름→반응(ms) · F5 안내문 시간 비율 · F6 끝→다시(초)
//  시간은 게임 시간(traffic.time — 배속·검사 step 과 같은 시계), F4·F6 만 실제 시계(performance.now).
//  기록은 기기 안에만(localStorage tg_metrics · 최근 20판). 네트워크 0.
TG.Metrics = function (game) {
  var self = this, cur = null, lastEndAt = null, taps = [];
  var SAVE_N = 20;
  function gt() { return game.traffic ? game.traffic.time : 0; }
  function load() { var d = TG.save.get('metrics', []); return Array.isArray(d) ? d : []; }
  this.cur = function () { return cur; };
  this.history = load;
  // 사건 = 플레이어가 「무슨 일이 있다」고 느끼는 것(F3 의 빈 시간을 끊는다)
  var EVENT = { praise: 1, violationSeen: 1, pulloverDone: 1, radio: 1, incident: 1, dispatch: 1, chase: 1 };
  this.begin = function (mode) {
    cur = { mode: mode, date: new Date().toISOString(), t0: gt(), ev: [], firstInput: null, noticeSec: 0, noticeEnd: 0, noticeN: 0, noticeLong: 0, taps: [], retry: null };
    if (lastEndAt !== null) { cur.retry = +((performance.now() - lastEndAt) / 1000).toFixed(2); lastEndAt = null; }
  };
  this.ev = function (name) {
    if (!cur) return;
    var t = +(gt() - cur.t0).toFixed(2);
    cur.ev.push([t, name]);
    if (name === 'firstInput' && cur.firstInput === null) cur.firstInput = t;
  };
  // 안내문이 떠 있는 시간(겹치면 겹친 만큼만 센다) · 한 줄 22자 넘는 안내 수
  this.notice = function (text, ms) {
    if (!cur) return;
    var now = gt() - cur.t0, dur = (ms || 2600) / 1000, end = now + dur;
    var add = Math.max(0, end - Math.max(now, cur.noticeEnd));
    cur.noticeSec += add; cur.noticeEnd = Math.max(cur.noticeEnd, end); cur.noticeN++;
    if (String(text || '').replace(/\s+/g, ' ').length > 22) cur.noticeLong++;
  };
  // F4: 누른 순간(이벤트 시각) → 그 뒤 첫 그림(rAF)까지. 단추 처리는 누른 그 자리에서 돈다(input.bindTap).
  this.tap = function (evTime) {
    if (!cur || !window.requestAnimationFrame) return;
    var t0 = evTime || performance.now();
    requestAnimationFrame(function (ts) { if (cur && cur.taps.length < 200) cur.taps.push(Math.max(0, ts - t0)); });
  };
  // 첫 행동: 가속·조향·경광등·단추 누름 중 먼저 온 것
  this.update = function () {
    if (!cur || cur.firstInput !== null) return;
    var P = game.player, c = P && P.controls;
    if ((c && (c.throttle > 0.05 || Math.abs(c.steer) > 0.15 || c.reverse > 0)) || (P && P.siren) || game.userActed) self.ev('firstInput');
  };
  function stats(rec, endT) {
    var evs = rec.ev.filter(function (e) { return EVENT[e[1]]; }).map(function (e) { return e[0]; });
    var first = rec.ev.filter(function (e) { return e[1] === 'praise' || e[1] === 'pulloverDone'; })[0];
    var pts = [0].concat(evs).concat([endT]), gaps = [];
    for (var i = 1; i < pts.length; i++) gaps.push(pts[i] - pts[i - 1]);
    var tp = rec.taps.slice().sort(function (a, b) { return a - b; });
    return {
      F1: rec.firstInput, F2: first ? first[0] : null,
      F3max: gaps.length ? +Math.max.apply(null, gaps).toFixed(1) : null, F3avg: gaps.length ? +(endT / Math.max(1, evs.length)).toFixed(1) : null,
      F4p50: tp.length ? Math.round(tp[Math.floor(tp.length / 2)]) : null, F4max: tp.length ? Math.round(tp[tp.length - 1]) : null, F4n: tp.length,
      F5: endT > 0 ? +(rec.noticeSec / endT).toFixed(3) : null, F5long: rec.noticeLong, F5n: rec.noticeN,
      F6: rec.retry, dur: +endT.toFixed(1), events: evs.length
    };
  }
  this.PASS = { F1: 10, F2: 45, F3max: 20, F3avg: 12, F4p50: 100, F5: 0.15, F6: 3 };
  this.end = function (reason) {
    if (!cur) return null;
    var endT = gt() - cur.t0;
    var rec = { mode: cur.mode, date: cur.date, reason: reason || '', m: stats(cur, endT), ev: cur.ev.slice(0, 120) };
    var db = load(); db.push(rec); while (db.length > SAVE_N) db.shift(); TG.save.set('metrics', db);
    lastEndAt = performance.now(); cur = null;
    return rec;
  };
  // 콘솔 표(검증·기준선용) — 통과선은 보여 주기만 한다(P0 는 판정하지 않는다)
  this.table = function (recs) {
    recs = recs || load();
    var rows = recs.map(function (r) { var m = r.m; return { mode: r.mode, F1: m.F1, F2: m.F2, F3max: m.F3max, F3avg: m.F3avg, F4p50: m.F4p50, F5: m.F5, F6: m.F6, dur: m.dur, ev: m.events }; });
    try { console.table(rows); } catch (e) {}
    return rows;
  };
};
