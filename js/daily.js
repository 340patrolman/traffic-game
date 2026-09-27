// 📅 오늘의 임무(v0.10.36) — 소유자 「너무 교육적으로 되어 있어서 재미감을 상실했다는 평이 많아 … 한두 번 하고 말면 그걸로 끝이니까」.
//  상용 게임이 사람을 다시 부르는 가장 값싼 장치는 **매일 바뀌는 작은 목표**다. 날짜로 정해지는 임무 셋을 근무를 넘어 쌓고,
//  근무 중 채우는 순간 바로 알린다(끝나고 알려 주면 늦다). 셋을 다 채운 날이 이어지면 「연속」이 는다.
//  · 목표는 **이미 세고 있는 근무 기록(G.stats)** 만 읽는다 — 새 채점을 만들지 않는다.
//  · 기기에만 둔다(localStorage tg_daily · 서버 0). 🧪 시뮬레이션·검사 모드에서는 쌓지 않는다.
//  · 숫자(목표 수·경험치)는 **게임 설계값**이다.
TG.Daily = function (game) {
  var self = this;
  function by(t) { return function (s) { return (s.byType && s.byType[t]) || 0; }; }
  var CAT = [
    { id: 'correct3', text: '정확한 단속 3건', goal: 3, get: function (s) { return s.correct || 0; } },
    { id: 'speed1', text: '과속 차 단속 1건', goal: 1, get: by('speeding'), law: 1 },
    { id: 'belt1', text: '안전띠 안 맨 운전자 단속 1건', goal: 1, get: by('seatbelt'), law: 1 },
    { id: 'tint1', text: '짙은 선팅 적발 1건', goal: 1, get: by('tint'), law: 1 },
    { id: 'dist1', text: '바짝 붙는 차(안전거리) 단속 1건', goal: 1, get: by('distance'), law: 1 },
    { id: 'center1', text: '중앙선 넘은 차 단속 1건', goal: 1, get: by('centerline'), law: 1 },
    { id: 'phone1', text: '운전 중 휴대전화 단속 1건', goal: 1, get: by('phone'), law: 1 },
    { id: 'perfect2', text: '🏅 완벽한 정차 2번', goal: 2, get: function (s) { return s.perfectStops || 0; } },
    { id: 'dispatch1', text: '🚨 112 출동 제시간 도착 1번', goal: 1, get: function (s) { return s.dispatchOnTime || 0; } },
    { id: 'scene1', text: '🚧 사고·고장 현장 지키기 1건', goal: 1, get: function (s) { return s.incidents || 0; } },
    { id: 'video2', text: '📹 이륜차·킥보드 영상 단속 2건', goal: 2, get: function (s) { return s.videos || 0; } },
    { id: 'junction3', text: '🚦 교차로 근무 소통 확보 3회', goal: 3, get: function (s) { return s.junction || 0; } },
    { id: 'chase1', text: '🚔 추격전 검거(또는 중단 판단) 1번', goal: 1, get: function (s) { return (s.chaseCatch || 0) + (s.chaseBreak || 0); } }
  ];
  var BYID = {}; CAT.forEach(function (c) { BYID[c.id] = c; });
  function today() { var d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
  function hash(str) { var h = 2166136261; for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  // 날짜로 셋을 고른다 — 하나는 「법규 단속」 갈래, 둘은 나머지에서(같은 날이면 누구에게나 같다)
  function picksFor(date) {
    var h = hash('tg-daily-' + date), laws = CAT.filter(function (c) { return c.law; }), rest = CAT.filter(function (c) { return !c.law; }), out = [];
    out.push(laws[h % laws.length].id);
    var a = (h >>> 8) % rest.length, b = (h >>> 16) % rest.length; if (b === a) b = (b + 1) % rest.length;
    out.push(rest[a].id, rest[b].id);
    return out;
  }
  function off() { return !!(game.dailyOff || (TG.mode && TG.mode.sim)); }
  var D = TG.save.get('daily', null);
  function fresh() {
    var t = today();
    if (!D || D.date !== t) {
      var y = new Date(); y.setDate(y.getDate() - 1);
      var ystr = y.getFullYear() + '-' + (y.getMonth() + 1) + '-' + y.getDate();
      var streak = D && D.allDone && D.date === ystr ? (D.streak || 0) : 0;   // 어제 셋을 다 했으면 연속이 이어진다
      D = { date: t, picks: picksFor(t), prog: {}, done: {}, allDone: false, streak: streak };
      TG.save.set('daily', D);
    }
    return D;
  }
  fresh();
  var base = {};   // 이번 근무를 시작할 때의 진행(근무 중 실시간 표시용)
  var shiftStats = null;
  this.list = function () {
    fresh();
    return D.picks.map(function (id) { var c = BYID[id]; return { id: id, text: c.text, goal: c.goal, prog: Math.min(c.goal, D.prog[id] || 0), done: !!D.done[id] }; });
  };
  this.count = function () { return self.list().filter(function (m) { return m.done; }).length; };
  this.streak = function () { fresh(); return D.streak || 0; };
  this.line = function () { var n = self.count(); return '📅 오늘의 임무 ' + n + '/3' + (D.streak ? ' · 🔥 연속 ' + D.streak + '일' : ''); };
  this.begin = function () { fresh(); base = {}; D.picks.forEach(function (id) { base[id] = D.prog[id] || 0; }); shiftStats = game.stats; };
  function complete(id) {
    if (D.done[id]) return;
    D.done[id] = true;
    var c = BYID[id];
    if (game.praise) { game.praise.feed('📅 임무 완료 · ' + c.text, 0); game.praise.addXp(40, 'daily'); }
    if (game.hud && game.hud.notice) game.hud.notice('📅 오늘의 임무 완료 — ' + c.text + ' (+40 XP)', 'good', 2400);
    if (TG.audio.jingle) TG.audio.jingle(3);
    if (D.picks.every(function (p) { return D.done[p]; }) && !D.allDone) {
      D.allDone = true; D.streak = (D.streak || 0) + 1;
      if (game.praise) game.praise.medal('daily_all', '오늘의 임무 셋 전부' + (D.streak > 1 ? ' · 🔥 ' + D.streak + '일 연속' : ''), 80 + Math.min(5, D.streak) * 20);
    }
    TG.save.set('daily', D);
  }
  // 근무 중 2초마다 — 채운 순간을 바로 알린다
  var tk = 0;
  this.tick = function (dt) {
    if (off() || game.state !== 'play' || !game.stats) return;
    tk -= dt; if (tk > 0) return; tk = 2;
    sync();
  };
  function sync() {
    if (!game.stats) return;
    if (shiftStats !== game.stats) self.begin();
    D.picks.forEach(function (id) {
      var c = BYID[id], now = (base[id] || 0) + c.get(game.stats);
      if (now > (D.prog[id] || 0)) D.prog[id] = now;
      if (!D.done[id] && now >= c.goal) complete(id);
    });
  }
  // 근무가 끝나면 한 번 더 셈하고(끝날 때 들어온 값) 결과 카드에 얹을 줄을 돌려준다
  this.finish = function () {
    if (off()) return null;
    sync();
    shiftStats = null;
    TG.save.set('daily', D);
    return { list: self.list(), streak: D.streak || 0, all: !!D.allDone };
  };
};
