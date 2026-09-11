// 경찰 대응 원칙(도로교통법의 목적 = 위험과 장해의 방지·제거). 추격은 목적이 아니라 최후의 수단이다.
//
//  등급 A(중대·적극 대응): 음주운전 의심 · 무면허 · 수배차량(절도·강도). 무전으로 상황을 먼저 전파하고, 경광등·사이렌으로 정차 유도. 추격 허용(부수적 피해 최소화 의무).
//  등급 B(일반 차량 위반): 신호위반·보행자 보호 위반·중앙선·과속 등. 정차 유도해 현장 단속. 도주하거나 정차가 위험하면 블랙박스 영상 + 무전.
//  등급 C(이륜차·자전거·개인형 이동장치의 단순 위반): 추격하지 않는다. 순찰차 블랙박스로 영상 기록 → 통고처분 의뢰, 무전으로 전파해 다른 순찰차가 안전한 곳에서 처리.
//    이유: 이륜차·자전거·PM 은 추격하면 넘어져 사람이 죽거나 다친다. 단순 교통위반의 법익보다 추격의 위험이 크다.
TG.Response = function (game) {
  var self = this, cfg = game.cfg, S = cfg.SCORE;
  var TIER = { drunk: 'A', license: 'A', wanted: 'A', motorcycle: 'C', bicycle: 'C', pm: 'C', pmHelmet: 'C', pmTwo: 'C', bikeCross: 'C' };
  this.state = { videos: 0, radios: 0, handedOver: 0, pursuitWarn: 0, pursuitT: 0, lastRadio: '' };
  var pending = [];   // 무전 전파 뒤 인접 순찰차가 처리하는 대상

  function tierOf(car) {
    if (!car) return 'B';
    if (car.wanted) return 'A';
    var v = car.violation && car.violation.type;
    if (v && TIER[v]) return TIER[v];
    if (car.isMoto || car.isBike || car.isPM) return 'C';
    return 'B';
  }
  this.tierOf = tierOf;
  function kindName(car) { return car.isPM ? '개인형 이동장치' : car.isBike ? '자전거' : car.isMoto ? '이륜차' : car.isBus ? '버스' : car.type === 'truck' ? '화물차' : car.type === 'pickup' ? '화물차(픽업)' : '승용차'; }
  this.kindName = kindName;
  // 지금 화면 앞의 대상(선택한 것 우선, 없으면 전방 70m 안 위반 차량)
  function target(maxDist) {
    var sel = game.selected;
    if (sel && sel.kind === 'car' && sel.car.violation) return sel.car;
    var me = game.actor ? game.actor() : game.player, pf = me.forward(), best = null, bd = maxDist || 70;
    game.traffic.cars.forEach(function (c) {
      if (!c.violation && !c.wanted && !(c.incident && !c.incident.handled)) return;
      var dx = c.pos.x - me.pos.x, dz = c.pos.z - me.pos.z, d = Math.hypot(dx, dz);
      if (d < bd && dx * pf[0] + dz * pf[1] > -4) { bd = d; best = c; }
    });
    return best;
  }
  // ---------- 고장차량·교통사고 현장 처리 ----------
  // 절차: 경광등 켜고 현장 뒤에 정차 → 📡 무전(상황 전파·견인/구급 요청) → 2초 유지 = 안전조치 완료.
  var inc = { car: null, t: 0, notice: 0 };
  function incidentUpdate(dt) {
    var pl = game.player; if (!pl || game.mode === 'kid' || game.mode === 'walk') { inc.car = null; return; }
    var near = null, bd = 45;
    game.traffic.cars.forEach(function (c) {
      if (!c.incident || c.incident.handled) return;
      var d = Math.hypot(c.pos.x - pl.pos.x, c.pos.z - pl.pos.z);
      if (d < bd) { bd = d; near = c; }
    });
    if (near !== inc.car) { inc.car = near; inc.t = 0; if (near) { inc.notice = 0; } }
    if (!near) { if (pl.setSign && inc.signOn) { pl.setSign(false); inc.signOn = false; } return; }
    // 승강식 전광판: 현장 뒤에 서면 올려서 뒤차에 알린다(사고 처리 중 + 비켜갈 방향 화살표)
    if (pl.setSign && !inc.signOn && Math.hypot(near.pos.x - pl.pos.x, near.pos.z - pl.pos.z) < 30) {
      var side = (near.incident && near.incident.side) || 'left';
      pl.setSign(true, near.incident.kind === 'crash' ? '사고 처리 중' : '고장차량 서행', side === 'right' ? 'right' : 'left');
      inc.signOn = true;
      game.hud.hint('전광판을 올렸다 — 뒤차가 글자와 화살표를 보고 미리 차로를 옮긴다');
    }
    var kindTxt = near.incident.kind === 'crash' ? '교통사고' : '고장차량';
    inc.notice -= dt;
    var behind = false, pf2 = pl.forward(), dx2 = near.pos.x - pl.pos.x, dz2 = near.pos.z - pl.pos.z, along = dx2 * pf2[0] + dz2 * pf2[1];
    behind = along > 3 && along < 22 && Math.abs(dx2 * -pf2[1] + dz2 * pf2[0]) < 6;
    if (inc.notice <= 0) {
      inc.notice = 7;
      game.hud.notice('⚠ ' + kindTxt + ' 발견 — 경광등 켜고 뒤에 정차 → 📡 무전으로 견인·구급 요청', 'alert', 4200);
      game.hud.hint('현장 뒤에 서서 뒤차를 막아 준다. 삼각대 안쪽으로 들어가지 않는다');
    }
    var ok = pl.siren && behind && pl.speedKmh() < 2 && near.radioed;
    inc.t = ok ? inc.t + dt : 0;
    if (inc.t > 2) {
      near.incident.handled = true; inc.car = null; inc.t = 0;
      if (pl.setSign) { pl.setSign(false); inc.signOn = false; }
      game.addScore(S.incident, null); game.stats.incidents = (game.stats.incidents || 0) + 1;
      game.hud.notice('✅ ' + kindTxt + ' 안전조치 완료 — 견인·구급 요청, 후방 보호 (+' + S.incident + ')', 'good', 4200);
      game.hud.pop('✅ +' + S.incident, 'good'); TG.audio.jingle(3);
      TG.audio.say(kindTxt + ' 안전조치 완료. 견인 요청했습니다', { kind: 'officer', queue: true });
      setTimeout(function () { if (game.traffic.clearIncidents) game.traffic.clearIncidents(); }, 6000);
    } else if (pl.siren && behind && pl.speedKmh() < 2 && !near.radioed && inc.notice < 5.6) {
      game.hud.hint('📡 무전으로 상황을 전파하고 견인·구급을 요청하세요');
    }
  }
  this.target = target;
  function vName(car) { return car.violation ? game.enforcement.nameOf(car.violation.type) : (car.wanted ? '수배차량' : '위반 없음'); }

  // ---------- 📹 블랙박스 영상 단속 ----------
  // 정차시키지 않고 영상으로 기록해 통고처분을 의뢰한다. 이륜차·자전거·PM 의 단순 위반은 이것이 정답.
  this.blackbox = function (only) {
    if (game.state !== 'play' || game.paused) return false;
    var car = only || target(70);
    if (!car) { game.hud.notice('블랙박스: 앞쪽에 기록할 위반 대상이 없습니다', 'warn', 2200); return false; }
    var t = tierOf(car), nm = vName(car), kn = kindName(car);
    game.hud.flash(); TG.audio.shutter();
    if (t === 'A') {   // 중대 위반은 영상만으로 끝내지 않는다
      game.addScore(S.videoLow, null);
      game.hud.notice('📹 영상 기록 — ' + kn + ' ' + nm + '. 중대 위반은 영상만으로 끝내지 않습니다(무전 전파 → 정차 유도)', 'alert', 4200);
      car.videoed = true; self.state.videos++;
      return true;
    }
    game.addScore(t === 'C' ? S.video : S.videoLow, null);
    self.state.videos++; car.videoed = true;
    game.stats.videos = (game.stats.videos || 0) + 1;
    var lines = ['📹 영상 단속 — ' + kn + ' ' + nm, '번호판·시각·위치 기록 → 통고처분 의뢰'];
    if (t === 'C') lines.push('추격하지 않고 처리했습니다 (+' + S.video + ')');
    game.hud.notice(lines.join(' · '), 'good', 4200);
    game.hud.pop('📹 +' + (t === 'C' ? S.video : S.videoLow), 'good');
    TG.audio.say(kn + ' ' + nm + ', 영상 기록. 통고처분 의뢰합니다', { kind: 'officer', queue: true });
    // 영상으로 처리한 대상은 더 이상 쫓지 않는다(표시 해제)
    car.violation = null; if (car.marker) car.marker.visible = false;
    if (game.selected && game.selected.car === car) game.selectTarget && game.selectTarget(null);
    return true;
  };

  // ---------- 📡 무전 상황 전파 ----------
  // 상황실·인접 순찰차에 알린다. 등급 C 는 몇 초 뒤 다른 순찰차가 안전한 곳에서 처리하고, 등급 A 는 이때부터 추격이 정당해진다.
  this.radio = function () {
    if (TG.audio.squelch) TG.audio.squelch();   // 무전 스퀄치 — 앰프(📢)와 소리로 구분된다
    if (game.state !== 'play' || game.paused) return false;
    var car = target(120);
    if (!car) {
      game.hud.notice('📡 무전 — 순찰 중 특이사항 없음. 상황실 교신 완료', 'info', 2400);
      TG.audio.say('상황실, 순찰 중 특이사항 없습니다', { kind: 'officer', queue: true });
      return false;
    }
    if (car.incident && !car.incident.handled) {   // 현장: 견인·구급 요청 무전
      car.radioed = true; self.state.radios++; game.stats.radios = (game.stats.radios || 0) + 1;
      var it = car.incident.kind === 'crash' ? '교통사고' : '고장차량', wi = placeName(car);
      game.addScore(S.radio, null);
      game.hud.notice('📡 무전 — ' + wi + ' ' + it + '. ' + (it === '교통사고' ? '구급차·견인차 요청, 후방 차단합니다' : '견인차 요청, 후방 차단합니다'), 'alert', 4200);
      TG.audio.say('상황실, ' + wi + ' ' + it + '. ' + (it === '교통사고' ? '구급차와 견인차 요청합니다' : '견인차 요청합니다'), { kind: 'officer', queue: true });
      return true;
    }
    var t = tierOf(car), nm = vName(car), kn = kindName(car), where = placeName(car);
    car.radioed = true; self.state.radios++; game.stats.radios = (game.stats.radios || 0) + 1;
    var msg = kn + ' ' + nm + ', ' + where + '. ' + (t === 'A' ? '중대 위반 — 인접 순찰차 지원 요청, 정차 유도합니다' : '인접 순찰차 확인 요청합니다');
    self.state.lastRadio = msg;
    game.addScore(S.radio, null);
    game.hud.notice('📡 무전 — ' + msg, 'alert', 4200);
    TG.audio.say('상황실, ' + msg, { kind: 'officer', queue: true });
    if (t === 'A') { car.pursuitOk = true; game.hud.hint('무전 전파 완료 — 정차 유도 시작. 부수적 피해를 줄이며 안전하게'); }
    else pending.push({ car: car, t: 6 + Math.random() * 4 });
    return true;
  };
  function placeName(car) {
    var f = game.city.frameAt(car.pos.x, car.pos.z, car.heading);
    return (f.name || '도로').replace(/\(.*\)/, '') + ' 부근';
  }

  // ---------- 추격 감시 ----------
  // 등급 C 를 사이렌 켜고 바짝 붙어 빠르게 쫓으면 경고 → 계속하면 감점(추격 금지 원칙). 등급 A 는 무전 전파 전 추격만 감점.
  this.update = function (dt) {
    incidentUpdate(dt);
    for (var i = pending.length - 1; i >= 0; i--) {
      var p = pending[i]; p.t -= dt;
      if (p.t <= 0) {
        pending.splice(i, 1);
        if (game.traffic.cars.indexOf(p.car) < 0) continue;
        var kn2 = kindName(p.car), nm2 = vName(p.car);
        p.car.violation = null; if (p.car.marker) p.car.marker.visible = false;
        self.state.handedOver++; game.stats.handedOver = (game.stats.handedOver || 0) + 1;
        game.addScore(S.handover, null);
        game.hud.notice('📡 인접 순찰차 처리 완료 — ' + kn2 + ' ' + nm2 + ' (+' + S.handover + ')', 'good', 3600);
        TG.audio.say('인접 순찰차가 처리했습니다', { kind: 'narrator', queue: true });
      }
    }
    var pl = game.player;
    if (!pl || game.mode === 'kid' || game.mode === 'walk') return;
    var kmh = pl.speedKmh(), near = null, bd = 30, pf = pl.forward();
    game.traffic.cars.forEach(function (c) {
      if (!c.violation && !c.wanted) return;
      var dx = c.pos.x - pl.pos.x, dz = c.pos.z - pl.pos.z, d = Math.hypot(dx, dz);
      if (d < bd && dx * pf[0] + dz * pf[1] > 0) { bd = d; near = c; }
    });
    var st = self.state;
    if (near && pl.siren && kmh > 38) {
      var t2 = tierOf(near);
      if (t2 === 'C') {
        st.pursuitT += dt;
        if (st.pursuitT > 1.2 && st.pursuitWarn <= 0) {
          st.pursuitWarn = 6;
          game.hud.notice('⚠ ' + kindName(near) + ' 단순 위반은 추격하지 않습니다 — 📹 블랙박스 · 📡 무전으로', 'warn', 4200);
          game.hud.hint('추격하면 넘어져 크게 다칩니다. 영상 기록과 무전 전파가 원칙입니다');
          TG.audio.say('이륜차 추격 금지. 영상 기록하고 무전 전파합니다', { kind: 'officer', queue: true });
        }
        if (st.pursuitT > 5.5) { st.pursuitT = -6; game.penalize('pursuitBan', kindName(near) + ' 단순 위반 추격', '추격 대신 영상·무전으로 처리한다(부수적 피해 최소화)'); }
      } else if (t2 === 'A' && !near.pursuitOk) {
        // 소유자: 「추격 중 무전을 할 수도, 못 할 수도, 안 할 수도 있다. 단 공조로 검거할 때는 무전을 한다.
        //          모든 것을 무전보고하지는 않는다.」 → 무전을 강제하지 않는다. 감점 없이 한 번만 권한다.
        st.pursuitT += dt;
        if (st.pursuitT > 4 && st.pursuitWarn <= 0) { st.pursuitWarn = 20; game.hud.hint('💭 혼자 쫓기 어려우면 📡 무전으로 공조를 부른다 — 앞을 막아 주면 무리한 추격이 필요 없다'); }
      } else st.pursuitT = Math.max(0, st.pursuitT - dt);
    } else st.pursuitT = Math.max(0, st.pursuitT - dt * 2);
    st.pursuitWarn = Math.max(0, st.pursuitWarn - dt);
    // 추격 중 부수적 피해: 보행자 5m 이내를 40km/h 넘게 지나가면 경고(반복하면 감점)
    if (pl.siren && kmh > 40 && game.peds) {
      var risk = false;
      for (var k = 0; k < game.peds.peds.length; k++) { var q = game.peds.peds[k]; if (Math.hypot(q.pos.x - pl.pos.x, q.pos.z - pl.pos.z) < 5) { risk = true; break; } }
      st.riskT = risk ? (st.riskT || 0) + dt : Math.max(0, (st.riskT || 0) - dt);
      if (st.riskT > 0.8) { st.riskT = -4; game.hud.notice('⚠ 보행자 근접 — 긴급 주행도 사람 앞에서는 감속', 'warn', 2600); game.hud.hint('부수적 피해를 줄이는 것이 추격보다 우선한다'); }
    }
  };
  // MDT·HUD 에 보여 줄 대응 지침
  this.adviceFor = function (car) {
    if (car.incident && !car.incident.handled) return (car.incident.kind === 'crash' ? '교통사고' : '고장차량') + ' 현장 · 경광등 + 뒤 정차 + 📡 무전';
    var t = tierOf(car);
    if (t === 'A') return car.pursuitOk ? '중대 위반 · 정차 유도(무전 전파 완료)' : '중대 위반 · 📡 무전 전파 먼저';
    if (t === 'C') return '단순 위반 · 추격 금지 → 📹 영상 · 📡 무전 (위반이지만 안전이 우선)';
    return '일반 위반 · 정차 유도 단속';
  };
};
