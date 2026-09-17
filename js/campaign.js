// 📖 캠페인 「서초, 1년」(재미 설계서 3절 · 7절 2단계 #5) — 1막 신참(3~6월) 네 장.
//  「🚓 출근하기」가 **지금 장**을 연다. 장마다 새 규칙은 하나만(톱니형) · 목표를 채우면 다음 장이 열린다(기기에 저장 tg_campaign).
//  목표는 근무 결과(G.stats · 감점 · 사건 사슬)로만 판정한다 — 새 채점을 만들지 않는다.
//  2막(장마·휴가철 음주·추석 고속도로·축제 킥보드) · 3막(수능·연말 추격·폭설·인사이동)은 다음 판에서 잇는다.
TG.Campaign = function (game) {
  var self = this;
  var CH = [
    { id: 'm03', act: 1, month: '3월', title: '개학 — 첫 스쿨존', mode: 'patrol',
      hook: '개학이다. 학교 앞은 시속 30. 우리부터 지킨다.',
      rule: '신호·속도 위반을 찾아 세운다',
      goals: [
        { t: '위반 차량 한 대 세워 고지', ok: function (s) { return (s.stops || 0) >= 1; } },
        { t: '사고 없이', ok: function (s, p) { return !p.crash && !p.pedestrian; } }
      ] },
    { id: 'm04', act: 1, month: '4월', title: '벚꽃길 — 사람이 먼저', mode: 'patrol',
      hook: '벚꽃 철이다. 길에 사람이 많다. 횡단보도 앞에서 서는지 봐라.',
      rule: '+ 보행자를 지키는 운전',
      goals: [
        { t: '정확한 단속 2건', ok: function (s) { return (s.correct || 0) >= 2; } },
        { t: '감점 −10 안쪽', ok: function (s, p, g) { return g.penaltyTotal >= -10; } }
      ] },
    { id: 'm05', act: 1, month: '5월', title: '가정의 달 — 교차로 수신호', mode: 'duty',
      hook: '어린이날 행사로 성모병원 사거리가 막힌다. 내려서 풀어라.',
      rule: '+ 신호기 수동 조작 · 꼬리 끊기',
      goals: [
        { t: '소통 확보 3회', ok: function (s) { return (s.junction || 0) >= 3; } },
        { t: '사고 없이', ok: function (s, p) { return !p.crash && !p.pedestrian; } }
      ] },
    { id: 'm06', act: 1, month: '6월', title: '배달 이륜차 — 사람을 바꾼다', mode: 'patrol',
      hook: '배달 오토바이가 인도로 다닌다는 신고가 는다. 쫓지 말고, 바꿔라.',
      rule: '+ 이륜차는 추격 금지 — 📹 영상 · 📡 무전 · 계도',
      goals: [
        { t: '📹 영상 단속이나 📡 무전 1회', ok: function (s) { return (s.videos || 0) + (s.radios || 0) >= 1; } },
        { t: '아는 얼굴 한 명 바꾸기 · 또는 작전 완료', ok: function (s, p, g) { var st = g.story; return !!(st && (st.ok || (st.changed && st.changed.length))) || (g.facesFixed || 0) > 0; } }
      ] }
  ];
  var ACT_END = { act: 1, name: '1막 신참 — 끝', next: '2막 「시련」 — 7월, 장마가 온다(준비 중)' };
  var db = TG.save.get('campaign', null) || { i: 0, cleared: {} };
  function save() { TG.save.set('campaign', db); }
  this.chapters = CH;
  this.index = function () { return db.i; };
  this.current = function () { return CH[db.i] || null; };          // null = 1막을 다 끝냈다
  this.done = function () { return db.i >= CH.length; };
  this.mode = function () { var c = self.current(); return c ? c.mode : 'patrol'; };
  this.reset = function () { db = { i: 0, cleared: {} }; save(); };
  this.jump = function (i) { db.i = TG.clamp(i, 0, CH.length); save(); };   // 검사·「장 다시 하기」용
  // 타이틀 카드: 지금 장 · 목표 · 진행 점
  this.paint = function () {
    var box = document.getElementById('chapterCard'), c = self.current(), bs = document.getElementById('btnStart');
    if (!box) return;
    if (TG.mode && TG.mode.sim) { box.innerHTML = ''; return; }   // 🧪 시뮬레이션에는 캠페인이 없다
    var dots = CH.map(function (x, k) { return '<i class="' + (k < db.i ? 'on' : k === db.i ? 'cur' : '') + '">' + x.month.replace('월', '') + '</i>'; }).join('');
    if (!c) {
      box.innerHTML = '<b>📖 서초, 1년 · ' + ACT_END.name + '</b><span>' + ACT_END.next + '</span><div class="cc-dots">' + dots + '</div>';
    } else {
      box.innerHTML = '<b>📖 서초, 1년 · 1막 신참 · ' + c.month + ' 「' + c.title + '」</b>' +
        '<span>' + c.rule + ' — 목표: ' + c.goals.map(function (g) { return g.t; }).join(' · ') + '</span><div class="cc-dots">' + dots + '</div>';
    }
    if (bs) { var sm = bs.querySelector('small'); if (sm) sm.textContent = c ? (c.month + ' · ' + (c.mode === 'duty' ? '교차로 근무' : '순찰 근무') + ' 한 판') : '순찰 근무 한 판 · 5분'; }
  };
  // 근무 시작(출근하기로 연 판만)
  this.begin = function () {
    var c = self.current(); game.chapterRun = c ? c.id : null;
    if (!c) return;
    game.hud.notice('📖 ' + c.month + ' 「' + c.title + '」 — ' + c.goals.map(function (g) { return g.t; }).join(' · '), 'info', 4500);
    setTimeout(function () {
      if (game.state !== 'play' || game.chapterRun !== c.id) return;
      game.hud.notice('📻 사수 — ' + c.hook, 'info', 4200);
      if (TG.audio.squelch) TG.audio.squelch();
      TG.audio.say(c.hook, { kind: 'pa', pitch: 0.86, rate: 0.94, queue: true });
    }, 5200);
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
      db.cleared[c.id] = (db.cleared[c.id] || 0) + 1; db.i++; save();
      var n = self.current();
      r.next = n ? '📖 다음 장 — ' + n.month + ' 「' + n.title + '」: ' + n.hook : '🎉 ' + ACT_END.name + ' · ' + ACT_END.next;
      if (game.praise) game.praise.medal('ch-' + c.id, c.month + ' 「' + c.title + '」 완료', 40);
      if (!n && game.praise) game.praise.medal('act1', '1막 신참 완료', 100);
    } else {
      r.next = '📖 ' + c.month + ' 「' + c.title + '」 다시 — 못 채운 목표만 채우면 다음 장이 열린다';
    }
    return r;
  };
};
