// 단속: 목격(traffic) → 경광등 켜고 뒤에 붙기 → 대상이 우측 갓길 정차 → 플레이어가 그 뒤 갓길에 안전 정차 → 고지 미니게임(10초).
TG.Enforcement = function (game) {
  var cfg = game.cfg, city = game.city;
  var self = this;
  this.state = 'idle';
  this.target = null;
  var holdT = 0, lastCand = null, sirenOffT = 0, warnT = 0, releaseT = 0;
  var ticket = null;

  function candidate() {
    var pl = game.player, T = game.traffic;
    var pf = pl.forward(), rx = -pf[1], rz = pf[0];
    var best = null, bestD = 1e9;
    for (var i = 0; i < T.cars.length; i++) {
      var c = T.cars[i];
      if (c.mode !== 'drive' && c.mode !== 'release') continue;
      var dx = c.pos.x - pl.pos.x, dz = c.pos.z - pl.pos.z;
      var along = dx * pf[0] + dz * pf[1], lat = dx * rx + dz * rz;
      if (along < 2 || along > cfg.PULL_RANGE || Math.abs(lat) > 4.5) continue;
      var cf = [Math.sin(c.heading), Math.cos(c.heading)];
      if (cf[0] * pf[0] + cf[1] * pf[1] < 0.75) continue;
      var score = along - (c.violation ? 8 : 0);   // 위반 표시 차량 우선
      if (score < bestD) { bestD = score; best = c; }
    }
    return best;
  }
  function distToTarget() {
    var pl = game.player, c = self.target;
    return Math.hypot(c.pos.x - pl.pos.x, c.pos.z - pl.pos.z);
  }
  function cancel(msg) {
    if (self.target) game.traffic.setYield(self.target, false);
    self.target = null; self.state = 'idle'; holdT = 0; lastCand = null;
    if (msg) game.hud.notice(msg, 'warn');
  }

  this.update = function (dt) {
    var pl = game.player;
    if (self.state === 'idle') {
      if (!pl.siren) { holdT = 0; lastCand = null; return; }
      var c = candidate();
      if (c && c === lastCand) holdT += dt; else holdT = 0;
      lastCand = c;
      if (c) game.hud.setTarget('정차 유도 중… ' + Math.round(holdT / cfg.PULL_HOLD * 100) + '%');
      else game.hud.setTarget(null);
      if (c && holdT >= cfg.PULL_HOLD) {
        self.target = c; self.state = 'yielding'; sirenOffT = 0;
        game.traffic.setYield(c, true);
        game.hud.notice('대상 차량이 우측으로 정차합니다 — 뒤에 안전하게 정차하세요', 'info', 4000);
        game.hud.setTarget('정차 유도 중');
        TG.audio.alert();
        TG.audio.pa('앞 차량, 우측 가장자리에 정차하십시오');
      }
      return;
    }
    if (self.state === 'yielding' || self.state === 'stopped') {
      // 대상이 안전한 곳(교차로·횡단보도 밖)을 찾아 더 가는 동안은 여유를 둔다
      if (distToTarget() > 130) { cancel('대상을 놓쳤습니다 — 정차 유도 취소'); game.hud.setTarget(null); return; }
      if (!pl.siren) { sirenOffT += dt; if (sirenOffT > 3) { cancel('경광등을 꺼서 정차 유도가 취소되었습니다'); game.hud.setTarget(null); return; } }
      else sirenOffT = 0;
      var c2 = self.target;
      if (c2.mode === 'stopped') {
        if (self.state !== 'stopped') { self.state = 'stopped'; game.hud.setTarget('대상 정차 — 그 뒤 우측 가장자리에 정차하세요'); }
        // 플레이어 정차 판정: 대상 뒤 3~15m, 횡 3.5m 이내, 차로 밖(중앙선에서 2.6m 이상 우측)
        if (pl.telemetry.speed < 0.3) {
          var cf = [Math.sin(c2.heading), Math.cos(c2.heading)], crx = -cf[1], crz = cf[0];
          var dx = pl.pos.x - c2.pos.x, dz = pl.pos.z - c2.pos.z;
          var along = dx * cf[0] + dz * cf[1], lat = dx * crx + dz * crz;
          var frame = city.frameAt(pl.pos.x, pl.pos.z, pl.heading);
          var behind = along <= -cfg.STOP_BEHIND_MIN && along >= -cfg.STOP_BEHIND_MAX && Math.abs(lat) < 3.5;
          var shoulder = frame.lateral >= frame.shoulderMin;
          if (behind && shoulder) { openTicket(c2); return; }
          warnT -= dt;
          if (warnT <= 0) {
            warnT = 2.5;
            if (!behind) game.hud.notice('대상 차량 바로 뒤(3~15m)에 정차하세요', 'warn', 2200);
            else game.hud.notice('안전 확보 안 됨 — 차로 위입니다. 우측 가장자리로 이동하세요', 'warn', 2200);
          }
        }
      }
      return;
    }
    if (self.state === 'release') {
      releaseT -= dt;
      if (releaseT <= 0) { self.state = 'idle'; self.target = null; }
    }
  };

  // ---------- 고지 미니게임 ----------
  function lawById(id) {
    var L = game.laws; if (!L) return null;
    for (var i = 0; i < L.violations.length; i++) if (L.violations[i].id === id) return L.violations[i];
    return null;
  }
  function fmtFine(law) {
    if (!law || !law.fine) return '확인 중';
    if (law.fine.verified && law.fine['승용'] !== null) return law.fine['승용'].toLocaleString('ko-KR') + '원(승용)';
    if (law.fine.candidate && law.fine.candidate['승용']) return '확인 중 · ' + (law.fine.candidate_source || '참고') + ' 값 ' + law.fine.candidate['승용'].toLocaleString('ko-KR') + '원';
    return '확인 중';
  }
  function fmtPoints(law) {
    if (!law || !law.points) return '확인 중';
    if (law.points.verified && law.points.value !== null) return law.points.value + '점';
    if (law.points.candidate) return '확인 중 · ' + (law.points.candidate_source || '참고') + ' 값 ' + law.points.candidate + '점';
    return '확인 중';
  }
  function fmtArticle(law) {
    if (!law || !law.law) return '';
    if (law.law.article) return law.law.act + ' ' + law.law.article + (law.law.verified ? '' : ' (확인 중)');
    return law.law.act + ' 조문 확인 중';
  }
  function optionList(car) {
    var onHighway = city.frameAt(car.pos.x, car.pos.z, car.heading).kind === 'link';
    var ids = onHighway ? ['buslane', 'signal', 'unsafe', 'centerline'] : ['signal', 'centerline', 'pedestrian', 'unsafe'];
    var names = { signal: '신호위반', centerline: '중앙선 침범', pedestrian: '보행자 보호 위반', unsafe: '안전운전 위반', buslane: '버스전용차로 위반' };
    var out = ids.map(function (id) { var l = lawById(id); return { id: id, name: l ? l.short : names[id] }; });
    out.push({ id: 'none', name: '위반 없음' });
    return out;
  }
  function openTicket(car) {
    self.state = 'ticket';
    game.setPaused(true, 'ticket');
    var answer = car.violation ? car.violation.type : 'none';
    ticket = { car: car, answer: answer, t: cfg.TICKET_SECONDS, done: false };
    game.hud.showTicket(optionList(car), cfg.TICKET_SECONDS, function (choiceId) { resolve(choiceId); });
    game.hud.setTarget(null);
  }
  function resolve(choice) {
    if (!ticket || ticket.done) return;
    ticket.done = true;
    var ans = ticket.answer, S = cfg.SCORE, law = ans !== 'none' ? lawById(ans) : null;
    var lines = [], delta = 0, kind = 'ok';
    if (ans === 'none') {
      delta = S.noViolation; kind = 'warn';
      lines.push('위반 없음 — 안내 후 귀가 (' + delta + ')');
      if (choice !== 'none' && choice !== 'timeout') lines.push('이 차량은 위반이 없었습니다. 무작위 정차는 감점입니다.');
      TG.audio.bad();
    } else if (choice === ans) {
      delta = S.correct; lines.push('정답 · ' + (law ? law.name : ans) + ' (+' + delta + ')');
      if (law) lines.push(fmtArticle(law));
      lines.push('범칙금 ' + fmtFine(law) + ' · 벌점 ' + fmtPoints(law));
      if (law && law.law && !law.law.verified) lines.push('조문·수치는 확인 중입니다(소유자가 별표 원문과 대조 후 확정)');
      TG.audio.good();
      game.stats.correct++;
    } else {
      delta = choice === 'timeout' ? 0 : S.wrongChoice; kind = 'warn';
      lines.push((choice === 'timeout' ? '시간 초과' : '오답') + ' — 정답은 「' + (law ? law.short : ans) + '」' + (delta ? ' (+' + delta + ')' : ''));
      if (law && law.teach) lines.push(law.teach);
      TG.audio.bad();
    }
    game.stats.stops++;
    if (ans !== 'none') game.stats.violatorStops++;
    game.addScore(delta, null);
    game.hud.ticketResult(lines, kind, function () { closeTicket(); });
  }
  function closeTicket() {
    var car = ticket.car; ticket = null;
    game.hud.hideTicket();
    game.setPaused(false, 'ticket');
    game.traffic.setYield(car, false);
    self.state = 'release'; releaseT = 4;
  }
  this.tickTicket = function (dt) {
    if (!ticket || ticket.done) return;
    ticket.t -= dt;
    game.hud.ticketTimer(ticket.t / cfg.TICKET_SECONDS);
    if (ticket.t <= 0) resolve('timeout');
  };
  this.cancel = cancel;
  this.reset = function () { if (ticket) { ticket = null; game.hud.hideTicket(); } self.state = 'idle'; self.target = null; holdT = 0; lastCand = null; };
};
