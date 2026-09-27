// 📖 캠페인 「서초, 1년」(재미 설계서 3절) — 1막 신참(1~4장) · 2막 시련(5~8장, v0.10.12) · 3막 성장(9~12장, v0.10.12) 열두 장.
//  (v0.10.47) 장 이름은 **차례**다(종전 3월~2월). 게임 안 날짜·시각·날씨는 늘 **지금 실제**를 따른다 — 장이 날짜·계절을 지어내지 않는다.
//  「🚓 출근하기」가 **지금 장**을 연다. 장마다 새 규칙은 하나만(톱니형) · 목표를 채우면 다음 장이 열린다(기기에 저장 tg_campaign).
//  목표는 근무 결과(G.stats · 감점 · 사건 사슬)로만 판정한다 — 새 채점을 만들지 않는다.
//  장이 판을 차릴 것(날씨·곧 올 신고·위반 차 성향·시작 자리)은 setup(game) 에서 game.chapterKit · game.director.bias 로만 한다.
TG.Campaign = function (game) {
  var self = this;
  var CH = [
    { id: 'm03', act: 1, month: '1장', title: '첫 스쿨존', mode: 'patrol',
      hook: '학교 앞은 시속 30. 우리부터 지킨다.',
      rule: '신호·속도 위반을 찾아 세운다',
      goals: [
        { t: '위반 차량 한 대 세워 고지', ok: function (s) { return (s.stops || 0) >= 1; } },
        { t: '사고 없이', ok: function (s, p) { return !p.crash && !p.pedestrian; } }
      ] },
    { id: 'm04', act: 1, month: '2장', title: '사람이 먼저', mode: 'patrol',
      hook: '길에 사람이 많다. 횡단보도 앞에서 서는지 봐라.',
      rule: '+ 보행자를 지키는 운전',
      goals: [
        { t: '정확한 단속 2건', ok: function (s) { return (s.correct || 0) >= 2; } },
        { t: '감점 −10 안쪽', ok: function (s, p, g) { return g.penaltyTotal >= -10; } }
      ] },
    { id: 'm05', act: 1, month: '3장', title: '교차로 수신호', mode: 'duty',
      hook: '행사로 성모병원 사거리가 막힌다. 내려서 풀어라.',
      rule: '+ 신호기 수동 조작 · 꼬리 끊기',
      goals: [
        { t: '소통 확보 3회', ok: function (s) { return (s.junction || 0) >= 3; } },
        { t: '사고 없이', ok: function (s, p) { return !p.crash && !p.pedestrian; } }
      ] },
    { id: 'm06', act: 1, month: '4장', title: '배달 이륜차 — 사람을 바꾼다', mode: 'patrol',
      hook: '배달 오토바이가 인도로 다닌다는 신고가 는다. 쫓지 말고, 바꿔라.',
      rule: '+ 이륜차는 추격 금지 — 📹 영상 · 📡 무전 · 계도',
      goals: [
        { t: '📹 영상 단속이나 📡 무전 1회', ok: function (s) { return (s.videos || 0) + (s.radios || 0) >= 1; } },
        { t: '아는 얼굴 한 명 바꾸기 · 또는 작전 완료', ok: function (s, p, g) { var st = g.story; return !!(st && (st.ok || (st.changed && st.changed.length))) || (g.facesFixed || 0) > 0; } }
      ] },
    // ── 2막 시련 — 사고 현장 · 음주 · 고속도로 · 킥보드 ──
    //  (v0.10.47) 장은 **달이 아니라 차례**다 — 소유자 「오늘이 개학이 아닌데 개학이라고 한다. 날짜와 시간을 현재에 맞추라」.
    //  종전 「3월 개학 · 7월 장마(비 강제) · 1월 폭설(눈 강제)」은 오늘 날짜·날씨와 어긋났다. 날씨·시각은 실제(기기 시계·티북 날씨)를 따른다.
    { id: 'm07', act: 2, month: '5장', title: '사고 현장 — 안전조치', mode: 'patrol',
      hook: '사고 신고가 곧 들어온다. 뒤를 막고, 차로를 닫고, 끌어낸다.',
      rule: '+ 현장 안전조치 · 견인',
      setup: function (g) { g.chapterKit.incidentSoon(14); },
      goals: [
        { t: '사고·고장 현장 안전조치 1건', ok: function (s) { return (s.incidents || 0) + (s.tows || 0) >= 1; } },
        { t: '사고 없이', ok: function (s, p) { return !p.crash && !p.pedestrian; } }
      ] },
    { id: 'm08', act: 2, month: '6장', title: '음주운전', mode: 'patrol',
      hook: '비틀거리는 차를 찾아라. 절차 순서를 지킨다 — 감지, 음용수, 측정.',
      rule: '+ 음주 단속 절차',
      setup: function (g) { if (g.director) g.director.bias = 'drunk'; },
      goals: [
        { t: '음주운전 의심 차량 1대 단속', ok: function (s) { return ((s.byType || {}).drunk || 0) >= 1; } },
        { t: '감점 −10 안쪽', ok: function (s, p, g) { return g.penaltyTotal >= -10; } }
      ] },
    { id: 'm09', act: 2, month: '7장', title: '고속도로', mode: 'patrol',
      hook: '고속도로다. 버스전용차로와 지정차로를 지키지 않는 차가 있다.',
      rule: '+ 고속도로 · 지정차로 · 버스전용차로',
      setup: function (g) { g.chapterKit.onRing(); },
      goals: [
        { t: '고속도로에서 위반 차량 1대 단속', ok: function (s) { var b = s.byType || {}; return (s.hwStops || 0) >= 1 || (b.lane || 0) + (b.buslane || 0) >= 1; } },
        { t: '사고 없이', ok: function (s, p) { return !p.crash && !p.pedestrian; } }
      ] },
    { id: 'm10', act: 2, month: '8장', title: '킥보드', mode: 'patrol',
      hook: '킥보드가 쏟아진다. 헬멧 없이, 둘이 탄다. 쫓지 말고 영상으로 남긴다.',
      rule: '+ 개인형 이동장치 · 추격 금지',
      setup: function (g) { if (g.director) g.director.bias = 'pm'; },
      goals: [
        { t: '킥보드 위반 📹 영상 1건', ok: function (s) { return (s.pmVideos || 0) >= 1; } },
        { t: '추격 금지 지키기', ok: function (s, p) { return !p.pursuitBan && !p.crash && !p.pedestrian; } }
      ] },
    // ── 3막 성장 — 긴급 출동 · 도주 · 모든 규칙 · 결산 ──
    { id: 'm11', act: 3, month: '9장', title: '긴급 출동', mode: 'patrol',
      hook: '112 코드1이 들어온다. 급해도 교차로는 서행 — 특례에는 한계가 있다.',
      rule: '+ 112 긴급출동 특례의 한계',
      setup: function (g) { g.chapterKit.dispatchSoon(12); },
      goals: [
        { t: '제시간 출동 1건', ok: function (s) { return (s.dispatchOnTime || 0) >= 1; } },
        { t: '교차로 과속·충돌 위험 없이', ok: function (s) { return !(s.emergFast || 0) && !(s.emergConflict || 0); } }
      ] },
    { id: 'm12', act: 3, month: '10장', title: '도주 차량', mode: 'chase',
      hook: '음주 도주 차량이다. 원칙을 지키는 추격 — 필요하면 멈추는 것도 판단이다.',
      rule: '+ 원칙 지키는 추격',
      goals: [
        { t: '검거 또는 중단 판단', ok: function (s) { return !!(s.chase && (s.chase.result === 'caught' || s.chase.result === 'break')); } },
        { t: '무리한 추격 없이', ok: function (s, p) { return !p.chaseReckless && !p.crash && !p.pedestrian; } }
      ] },
    { id: 'm01', act: 3, month: '11장', title: '모든 규칙', mode: 'patrol',
      hook: '배운 것을 모두 쓴다. 브레이크는 일찍, 간격은 넓게.',
      rule: '+ 모든 규칙 복합',
      goals: [
        { t: '위반 차량 2대 단속', ok: function (s) { return (s.stops || 0) >= 2; } },
        { t: '감점 −10 안쪽 · 사고 없이', ok: function (s, p, g) { return g.penaltyTotal >= -10 && !p.crash && !p.pedestrian; } }
      ] },
    { id: 'm02', act: 3, month: '12장', title: '1년 결산', mode: 'patrol',
      hook: '마지막 장이다. 1년 동안 배운 대로. 동네가 얼마나 바뀌었는지 보자.',
      rule: '1년 결산',
      goals: [
        { t: '정확한 단속 3건', ok: function (s) { return (s.correct || 0) >= 3; } },
        { t: '감점 −10 안쪽 · 사고 없이', ok: function (s, p, g) { return g.penaltyTotal >= -10 && !p.crash && !p.pedestrian; } }

      ] }
  ];
  var ACTS = { 1: '1막 신참', 2: '2막 시련', 3: '3막 성장' };
  var ACT_END = { 1: '📖 1막 신참 끝 — 2막 「시련」: 사고 현장이 기다린다', 2: '📖 2막 시련 끝 — 3막 「성장」: 긴급 출동이다', 3: '🎉 서초, 1년 — 끝. 수고했다. 동네가 달라졌다' };
  var db = TG.save.get('campaign', null) || { i: 0, cleared: {} };
  function save() { TG.save.set('campaign', db); }
  this.chapters = CH;
  this.index = function () { return db.i; };
  this.current = function () { return CH[db.i] || null; };          // null = 1막을 다 끝냈다
  this.done = function () { return db.i >= CH.length; };
  this.mode = function () { var c = self.current(); return c ? c.mode : 'patrol'; };
  this.reset = function () { db = { i: 0, cleared: {}, max: 0 }; save(); };
  this.jump = function (i) { db.i = TG.clamp(i, 0, CH.length); db.max = Math.max(db.max || 0, db.i); save(); };
  this.maxIndex = function () { return Math.max(db.max || 0, db.i); };   // 지금까지 연 가장 뒤 장(고르기 목록)   // 검사·「장 다시 하기」용
  // 타이틀 카드: 지금 장 · 목표 · 진행 점
  this.paint = function () {
    var box = document.getElementById('chapterCard'), c = self.current(), bs = document.getElementById('btnStart');
    if (!box) return;
    if (TG.mode && TG.mode.sim) { box.innerHTML = ''; return; }   // 🧪 시뮬레이션에는 캠페인이 없다
    var dots = CH.map(function (x, k) { return '<i class="' + (k < db.i ? 'on' : k === db.i ? 'cur' : '') + '">' + x.month.replace('장', '') + '</i>'; }).join('');
    if (!c) {
      box.innerHTML = '<b>📖 서초, 1년 · 완주</b><span>' + ACT_END[3] + ' — 처음부터 다시 하려면 ⚙ 에서</span><div class="cc-dots">' + dots + '</div>';
    } else {
      box.innerHTML = '<b>📖 서초, 1년 · ' + ACTS[c.act] + ' · ' + c.month + ' 「' + c.title + '」</b>' +
        '<span>' + c.rule + ' — 목표: ' + c.goals.map(function (g) { return g.t; }).join(' · ') + '</span><div class="cc-dots">' + dots + '</div>';
    }
    if (bs) { var sm = bs.querySelector('small'); if (sm) sm.textContent = c ? (c.month + ' · ' + (c.mode === 'duty' ? '교차로 근무' : '순찰 근무') + ' 한 판') : '순찰 근무 한 판 · 5분'; }
  };
  function todayKo() { var d = new Date(), p = function (n) { return (n < 10 ? '0' : '') + n; }; return (d.getMonth() + 1) + '월 ' + d.getDate() + '일(' + '일월화수목금토'[d.getDay()] + ') ' + p(d.getHours()) + ':' + p(d.getMinutes()); }
  // 근무 시작(출근하기로 연 판만)
  this.begin = function () {
    var c = self.current(); game.chapterRun = c ? c.id : null;
    if (!c) return;
    if (c.setup) { try { c.setup(game); } catch (e) { console.warn('[campaign] setup', c.id, e); } }
    // 🎬 v0.10.16 — 안내문 두 줄로 알리던 것을 **시네마틱 카드 한 번**으로. 글은 그대로이고 자리와 연출만 바뀐다.
    var brief = game.cinema && game.cinema.brief({
      kick: ACTS[c.act] + ' · ' + c.month + ' · ' + todayKo(),   // 오늘 실제 날짜·시각(v0.10.47)
      title: c.title,
      sub: c.hook,
      goal: '목표 — ' + c.goals.map(function (g) { return g.t; }).join(' · '),
      ms: 2800
    });
    if (!brief) game.hud.notice('📖 ' + c.month + ' 「' + c.title + '」 — ' + c.goals.map(function (g) { return g.t; }).join(' · '), 'info', 2600);
    setTimeout(function () {
      if (game.state !== 'play' || game.chapterRun !== c.id) return;
      if (TG.audio.squelch) TG.audio.squelch();
      TG.audio.say(c.hook, { kind: 'pa', pitch: 0.86, rate: 0.94, queue: true });
      game.hud.hint('📻 사수 — ' + c.hook);
    }, brief ? 1400 : 3000);
  };
  // 근무 끝: 목표를 채웠으면 다음 장. 결과 카드에 얹을 값을 돌려준다.
  this.finish = function (stats, pen, extra) {
    var id = game.chapterRun; game.chapterRun = null;
    var c = self.current(); if (!id || !c || c.id !== id) return null;
    var g = { penaltyTotal: extra.penaltyTotal, story: extra.story, facesFixed: extra.facesFixed };
    var goals = c.goals.map(function (x) { return { t: x.t, ok: !!x.ok(stats, pen, g) }; });
    var ok = goals.every(function (x) { return x.ok; });
    var r = { id: c.id, month: c.month, title: c.title, goals: goals, ok: ok, next: null };
    if (ok) {
      db.cleared[c.id] = (db.cleared[c.id] || 0) + 1; db.i++; db.max = Math.max(db.max || 0, db.i); save();
      var n = self.current();
      var actDone = !n || n.act !== c.act;
      r.next = actDone ? ACT_END[c.act] : '📖 다음 장 — ' + n.month + ' 「' + n.title + '」: ' + n.hook;
      if (game.praise) game.praise.medal('ch-' + c.id, c.month + ' 「' + c.title + '」 완료', 40);
      if (actDone && game.praise) game.praise.medal('act' + c.act, ACTS[c.act] + ' 완료', 100);
    } else {
      r.next = '📖 ' + c.month + ' 「' + c.title + '」 다시 — 못 채운 목표만 채우면 다음 장이 열린다';
    }
    return r;
  };
};
