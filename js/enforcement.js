// 단속: 화면의 차량·보행자를 터치 → 「무슨 위반인가?」 객관식(퀴즈) → 정답이면 조치.
//   차량: 경광등 켜고 정차 유도 → 대상이 우측 갓길에 정차 → 플레이어가 그 뒤 갓길에 안전 정차 → 「고지 완료」 보너스 + 법조항(data/laws.json = T-Book 참고값) 표시.
//   보행자(무단횡단·신호위반 보행): 정답이면 계도·통고, 법조항 표시.
// 위반이 없는 대상을 세우면 감점. 법령 수치는 코드에 없다 — laws.json 에서만 읽는다.
TG.Enforcement = function (game) {
  var cfg = game.cfg, city = game.city;
  var self = this;
  this.state = 'idle';     // idle | quiz | yielding | stopped | release
  this.target = null;
  var sirenOffT = 0, warnT = 0, releaseT = 0, ticket = null;

  function me() { return game.actor ? game.actor() : game.player; }   // 순찰차, 보행자 모드면 걷는 경찰관
  function onFoot() { return game.mode === 'walk' || game.mode === 'kid'; }
  function distToTarget() { var pl = me(), c = self.target; return Math.hypot(c.pos.x - pl.pos.x, c.pos.z - pl.pos.z); }
  function cancel(msg) {
    if (self.target) game.traffic.setYield(self.target, false);
    self.target = null; self.state = 'idle';
    if (msg) game.hud.notice(msg, 'warn');
  }
  // ---------- 법령 표시 ----------
  function lawById(id) { var L = game.laws; if (!L) return null; for (var i = 0; i < L.violations.length; i++) if (L.violations[i].id === id) return L.violations[i]; return null; }
  function fmtFine(law, cls) {
    cls = cls || '승용';
    if (!law || !law.fine) return '확인 중';
    if (law.fine.verified && law.fine[cls] !== null && law.fine[cls] !== undefined) return law.fine[cls].toLocaleString('ko-KR') + '원(' + cls + ')';
    if (law.fine.candidate && law.fine.candidate[cls]) return '확인 중 · ' + (law.fine.candidate_source || '참고') + ' 값 ' + law.fine.candidate[cls].toLocaleString('ko-KR') + '원';
    return '확인 중';
  }
  function fmtPoints(law) {
    if (!law || !law.points) return '확인 중';
    if (law.points.verified && law.points.value !== null) return law.points.value + '점';
    if (law.points.candidate) return '확인 중 · ' + (law.points.candidate_source || '참고') + ' 값 ' + law.points.candidate + '점';
    return '확인 중';
  }
  function fmtArticle(law) {
    if (!law || !law.law) return '조문 확인 중';
    if (law.law.article) return law.law.act + ' ' + law.law.article + (law.law.verified ? '' : ' (확인 중)');
    return law.law.act + ' 조문 확인 중';
  }
  function lawLines(id, cls) {
    var law = lawById(id), out = [];
    out.push(fmtArticle(law));
    if (id === 'jaywalk' || id === 'jaywalk-red') out.push('범칙금(보행자) ' + fmtFine(law, '보행자') + ' · 벌점 없음');
    else out.push('범칙금 ' + fmtFine(law, cls) + ' · 벌점 ' + fmtPoints(law));
    if (law && law.teach) out.push(law.teach);
    return out;
  }
  var NAMES = { signal: '신호위반', centerline: '중앙선 침범', pedestrian: '보행자 보호의무 위반', unsafe: '안전운전 의무 위반', buslane: '버스전용차로 위반', jaywalk: '무단횡단(횡단보도 밖)', 'jaywalk-red': '보행자 신호위반(횡단보도 위 · 보행 적색)',
                phone: '운전 중 휴대전화 사용', litter: '차 밖으로 물건(꽁초) 던지기', animal: '동물을 안고 운전', nosignal: '방향지시등 없이 차로 변경', solidline: '실선 구간 차로 변경',
                motorcycle: '이륜차 보도 통행', bicycle: '자전거 보도 주행(타고 달림)', overtake: '앞지르기 방법 위반(우측 앞지르기)', railroad: '철길건널목 통과방법 위반', license: '무면허 운전',
                drunk: '음주운전 의심(측정 필요)', sidewalk: '보도 침범(차가 보도로 주행)', passenger: '승객 추락방지의무 위반(문 열고 주행)', cargo: '적재물 추락방지 조치 위반(낙하물)',
                pm: '개인형 이동장치 보도 통행', pmHelmet: 'PM 인명보호장구 미착용', pmTwo: 'PM 2인 이상 탑승', wanted: '수배차량(중대 사건)', none: '위반 없음' };
  this.nameOf = function (id) { return NAMES[id] || id; };
  function carOptions(car) {
    var onHighway = city.frameAt(car.pos.x, car.pos.z, car.heading).kind === 'link';
    var ids = onHighway ? ['buslane', 'signal', 'unsafe', 'centerline'] : ['signal', 'pedestrian', 'centerline', 'nosignal'];
    if (car.isMoto) ids = ['motorcycle', 'signal', 'pedestrian', 'unsafe'];
    if (car.isBike) ids = ['bicycle', 'signal', 'pedestrian', 'unsafe'];
    if (car.isPM) ids = ['pm', 'pmHelmet', 'pmTwo', 'signal'];
    // 이 차량에 기록된 위반이 기본 보기에 없으면(휴대전화·꽁초·동물·실선 등) 하나를 바꿔 넣는다 — 정답이 항상 보기 안에 있게
    var v = car.violation && car.violation.type;
    if (v && ids.indexOf(v) < 0) ids[ids.length - 1] = v;
    else if (!v && car.trait && ids.indexOf(car.trait) < 0) ids[ids.length - 1] = car.trait;   // 습관 차량(아직 기록 전)도 보기에 후보로
    else if (!v) { var extra = ['phone', 'litter', 'animal', 'solidline', 'drunk', 'overtake', 'sidewalk', 'cargo', 'passenger'][Math.floor(Math.random() * 9)]; if (ids.indexOf(extra) < 0) ids[ids.length - 1] = extra; }
    var out = ids.map(function (id) { var l = lawById(id); return { id: id, name: l ? l.short : NAMES[id] }; });
    out.push({ id: 'none', name: '위반 없음' });
    return out;
  }
  function pedViolationOf(p) { var recent = p.jayLive || (p.jayDone && p.jayT < 14); if (!recent) return 'none'; return p.jayKind === 'red' ? 'jaywalk-red' : 'jaywalk'; }

  // ---------- 퀴즈(터치한 대상의 위반 고르기) ----------
  this.quiz = function (sel) {
    var pl = me();
    if (self.state === 'quiz') return false;
    if (self.state !== 'idle') { game.hud.notice('정차 유도 중입니다 — 먼저 마무리하세요', 'warn', 1800); return false; }
    var e = sel.kind === 'car' ? sel.car : sel.ped, d = Math.hypot(e.pos.x - pl.pos.x, e.pos.z - pl.pos.z), maxD = onFoot() ? 45 : 75;
    if (sel.kind === 'car' && d > maxD) { game.hud.notice('너무 멉니다 — ' + maxD + 'm 이내로 접근하세요', 'warn', 2000); return false; }
    if (sel.kind === 'ped' && d > 40) { game.hud.notice('너무 멉니다 — 보행자 40m 이내로 접근하세요', 'warn', 2000); return false; }
    if (sel.kind === 'car' && e.mode !== 'drive' && e.mode !== 'release') { game.hud.notice('이미 정차 중인 차량입니다', 'warn', 1800); return false; }
    if (sel.kind === 'ped' && e.warned) { game.hud.notice('이미 계도한 보행자입니다', 'warn', 1800); return false; }
    var answer = sel.kind === 'car' ? (e.violation ? e.violation.type : 'none') : pedViolationOf(e);
    var opts = sel.kind === 'car' ? carOptions(e) : [{ id: 'jaywalk', name: '무단횡단 — 횡단보도가 아닌 곳을 건넘(§10)' }, { id: 'jaywalk-red', name: '보행자 신호위반 — 차량 녹색·보행 적색인데 횡단보도를 건넘(§5)' }, { id: 'none', name: '위반 없음' }];
    self.state = 'quiz'; game.setPaused(true, 'ticket');
    ticket = { sel: sel, answer: answer, t: cfg.TICKET_SECONDS, done: false };
    function choose(choice) {
      if (!ticket || ticket.done) return; ticket.done = true;
      var lines = [], delta = 0, kind = 'ok', S = cfg.SCORE, lawId = answer, act = false;
      if (answer === 'none') {
        if (choice === 'none') { delta = 5; lines.push('정답 · 위반 없음 — 잘 봤습니다 (+5)'); lines.push('위반을 직접 목격한 대상만 단속합니다.'); TG.audio.good(); game.stats.correct++; }
        else { delta = S.noViolation; kind = 'warn'; lines.push('위반 없음 — 무작위 단속은 감점 (' + delta + ')'); TG.audio.bad(); }
      } else if (choice === answer) {
        delta = S.correct; act = true; lines.push('정답 · ' + NAMES[answer] + ' (+' + delta + ')'); lines = lines.concat(lawLines(lawId, e.isBus ? '승합' : '승용')); TG.audio.good(); game.stats.correct++;
      } else if (choice !== 'none' && choice !== 'timeout' && (choice === 'jaywalk' || choice === 'jaywalk-red') && (answer === 'jaywalk' || answer === 'jaywalk-red')) {
        delta = S.wrongChoice; act = true; kind = 'warn'; lines.push('부분 정답 — 정확히는 「' + NAMES[answer] + '」 (+' + delta + ')'); lines = lines.concat(lawLines(answer)); TG.audio.bad();
      } else {
        kind = 'warn'; lines.push((choice === 'timeout' ? '시간 초과' : '오답') + ' — 정답은 「' + NAMES[answer] + '」'); lines = lines.concat(lawLines(lawId, '승용')); lines.push('다시 관찰하고 단속하세요.'); TG.audio.bad();
      }
      game.stats.stops++; if (sel.kind === 'ped') game.stats.warned++;
      game.addScore(delta, null);
      game.hud.ticketResult(lines, kind, function () {
        ticket = null; game.hud.hideTicket(); game.setPaused(false, 'ticket'); self.state = 'idle';
        if (act) {
          if (sel.kind !== 'car') warnPed(e);
          else if (game.response && game.response.tierOf(e) === 'C') game.response.blackbox(e);   // 이륜차·자전거·PM 단순 위반: 추격·정차 유도 없이 영상 단속
          else startPullover(e);
        }
      });
    }
    ticket.onChoice = choose;
    game.hud.showTicket(opts, cfg.TICKET_SECONDS, choose, sel.kind === 'car' ? '이 차량의 위반은?' : '이 보행자의 위반은?');
    game.hud.setTarget(null);
    return true;
  };
  function warnPed(p) { p.warned = true; if (p.state !== 'jaywalk' && p.state !== 'cross') { p.state = 'warned'; p.waitT = 0; } game.hud.notice('보행자 계도 완료 — 횡단보도로 안내', 'good', 2400); }
  // 정차 유도 시작(정답 뒤 자동). 경광등을 켜고 대상을 우측으로 세운다.
  function startPullover(car) {
    var pl = me();
    if (car.mode !== 'drive' && car.mode !== 'release') return;
    if (!onFoot() && !pl.siren) { pl.setSiren(true); TG.audio.setSiren(true); game.hud.setSiren(true); }
    self.target = car; self.state = 'yielding'; sirenOffT = 0; warnT = 0;
    game.traffic.setYield(car, true);
    if (onFoot()) { game.hud.notice('수신호 정차 — 차량이 우측에 섭니다. 운전석 옆(3m 안)으로 걸어가면 고지 완료', 'info', 4200); TG.audio.alert(); TG.audio.pa('앞 차량, 우측 가장자리에 정차하세요. 수신호입니다'); }
    else { game.hud.notice('정차 유도 — 대상이 우측으로 정차합니다. 그 뒤 갓길에 안전하게 정차하면 고지 완료', 'info', 4200); TG.audio.alert(); TG.audio.pa('앞 차량, 우측 가장자리에 정차하십시오'); }
    game.hud.setTarget('정차 유도 중');
  }
  // 고지 완료: 플레이어가 대상 뒤 갓길에 안전하게 섰을 때(도보: 운전석 옆에 섰을 때). MDT 면허 조회 — 무면허가 드러나면 추가 조치(+15, 「무면허 운전」 조문)
  function completePullover(car) {
    var bonus = 10;
    game.addScore(bonus, null);
    game.hud.notice('고지 완료 — ' + (onFoot() ? '운전자에게 위반 고지' : '안전한 위치에 정차') + ' (+' + bonus + ')', 'good', 3200);
    game.hud.hint(onFoot() ? '차도 쪽에 등을 보이지 않는다 — 차 뒤쪽·보도 쪽에서 응대' : '단속 뒤에는 차로로 안전하게 복귀한다');
    TG.audio.good();
    if (car.noLicense) {
      car.noLicense = false; game.addScore(15, null); game.stats.correct++;
      var L2 = lawById('license');
      setTimeout(function () { game.hud.notice('MDT 면허 조회: 무면허 운전 확인 — 추가 조치 (+15) · ' + fmtArticle(L2), 'alert', 5200); TG.audio.alert(); }, 1800);
    } else setTimeout(function () { if (game.state === 'play') game.hud.hint('MDT 면허 조회: 이상 없음'); }, 1800);
    game.traffic.setYield(car, false);
    self.state = 'release'; releaseT = 4; game.hud.setTarget(null);
  }

  this.update = function (dt) {
    var pl = me();
    if (self.state === 'idle' || self.state === 'quiz') return;
    if (self.state === 'yielding' || self.state === 'stopped') {
      if (distToTarget() > 130) { cancel('대상을 놓쳤습니다 — 정차 유도 취소'); game.hud.setTarget(null); return; }
      if (!onFoot()) { if (!pl.siren) { sirenOffT += dt; if (sirenOffT > 3) { cancel('경광등을 꺼서 정차 유도가 취소되었습니다'); game.hud.setTarget(null); return; } } else sirenOffT = 0; }
      var c2 = self.target;
      if (c2.mode === 'stopped') {
        if (self.state !== 'stopped') { self.state = 'stopped'; game.hud.setTarget(onFoot() ? '대상 정차 — 운전석 옆(3m 안)으로 가세요' : '대상 정차 — 그 뒤 우측 가장자리에 정차하세요'); }
        if (onFoot()) { if (distToTarget() < 3.6 && pl.telemetry.speed < 0.5) { completePullover(c2); self.target = null; } return; }
        if (pl.telemetry.speed < 0.3) {
          var cf = [Math.sin(c2.heading), Math.cos(c2.heading)], crx = -cf[1], crz = cf[0];
          var dx = pl.pos.x - c2.pos.x, dz = pl.pos.z - c2.pos.z, along = dx * cf[0] + dz * cf[1], lat = dx * crx + dz * crz;
          var frame = city.frameAt(pl.pos.x, pl.pos.z, pl.heading);
          var behind = along <= -cfg.STOP_BEHIND_MIN && along >= -cfg.STOP_BEHIND_MAX && Math.abs(lat) < 3.5;
          var shoulder = frame.lateral >= frame.shoulderMin;
          if (behind && shoulder) { completePullover(c2); self.target = null; return; }
          warnT -= dt;
          if (warnT <= 0) { warnT = 2.5; if (!behind) game.hud.notice('대상 차량 바로 뒤(3~15m)에 정차하세요', 'warn', 2200); else game.hud.notice('안전 확보 안 됨 — 차로 위입니다. 우측 가장자리로 이동하세요', 'warn', 2200); }
        }
      }
      return;
    }
    if (self.state === 'release') { releaseT -= dt; if (releaseT <= 0) { self.state = 'idle'; self.target = null; } }
  };
  this.tickTicket = function (dt) {
    if (!ticket || ticket.done) return;
    ticket.t -= dt; game.hud.ticketTimer(ticket.t / cfg.TICKET_SECONDS);
    if (ticket.t <= 0 && ticket.onChoice) ticket.onChoice('timeout');
  };
  this.cancel = cancel;
  this.reset = function () { if (ticket) { ticket = null; game.hud.hideTicket(); } self.state = 'idle'; self.target = null; };
};
