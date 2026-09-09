// 추격전 — 「추격은 최후의 수단」을 몸으로 익히는 모드.
//
// 이 모드는 빨리 달리는 재미를 주지만, 이기는 방법은 난폭 운전이 아니다.
//  ① 📡 무전 전파가 먼저다. 무전 없이 쫓으면 추격이 정당화되지 않는다(감점).
//  ② 안전 거리 10~40m 를 지키며 따라간다. 8m 안으로 붙으면 추돌·회피 사고를 만든다(감점).
//  ③ 부수적 피해가 생기면(차량 접촉·보행자 근접) 상황실이 추격 중단을 지시한다.
//  ④ 어린이보호구역·보행자가 많은 곳으로 도주하면 **추격을 끊는 것이 정답**이다(중단 = 큰 가점).
//     번호판은 이미 무전으로 전파됐고, 블랙박스 영상이 남아 있다 — 사람이 다치는 것보다 낫다.
//  ⑤ 원칙대로 20초를 따라가면 대상이 포기하고 우측에 정차한다(검거).
// 대상은 등급 A(수배차량)뿐이다. 이륜차·자전거·PM 의 단순 위반은 이 모드에 나오지 않는다(js/response.js 등급 C).
TG.Chase = function (game) {
  var self = this, city = game.city, traffic = game.traffic, cfg = game.cfg, S = cfg.SCORE;
  var KIND = [
    { id: 'theft', name: '차량 절도 피의자', radio: '차량 절도 피의자가 탄 차량으로 확인됩니다. 추적 중' },
    { id: 'drunk', name: '음주 의심 차량', radio: '음주 의심 차량입니다. 비틀거리며 주행 중' },
    { id: 'wanted', name: '수배 차량', radio: '수배 차량으로 조회됩니다. 지원 요청합니다' },
  ];
  this.car = null; this.state = 'idle'; this.kind = KIND[0];
  this.t = { safe: 0, close: 0, follow: 0, lost: 0, warn: 0, tick: 0 };
  this.log = { collateral: 0, closeCalls: 0, safeAwards: 0, radioed: false, result: '' };

  // 대상 차량: 플레이어 앞 같은 방향 도로에 만든다. 도주(flee)라 흐름보다 빠르고 적색도 통과한다.
  this.spawn = function () {
    var pl = game.player, f = pl.forward();
    for (var tries = 0; tries < 24; tries++) {
      var ahead = 55 + tries * 4, x = pl.pos.x + f[0] * ahead, z = pl.pos.z + f[1] * ahead;
      var fr = city.frameAt(x, z, pl.heading);
      if (!fr.onRoad || fr.kind === 'link') continue;
      var i = city.nearestIdx(city.xs, x), j = city.nearestIdx(city.zs, z), node = city.nodes[i][j];
      var d = Math.abs(f[0]) > Math.abs(f[1]) ? (f[0] > 0 ? 1 : 3) : (f[1] > 0 ? 0 : 2);
      if (!city.nodeFrom(node, d)) continue;
      var car = traffic.spawn({ at: { x: x, z: z, d: d, node: node }, v: Math.max(8, pl.telemetry.speed), cruise: 17, violator: true, laneIdx: 0, type: 'sedan' });
      if (!car) continue;
      car.wanted = true; car.flee = true; car.chase = true;
      self.car = car; self.kind = KIND[Math.floor(Math.random() * KIND.length)];
      self.state = 'follow'; self.t = { safe: 0, close: 0, follow: 0, lost: 0, warn: 0, tick: 0 };
      self.log = { collateral: 0, closeCalls: 0, safeAwards: 0, radioed: false, result: '' };
      game.hud.notice('📡 상황실 — ' + self.kind.name + ' 발견. 경광등 켜고 뒤에 붙되 안전거리를 지키세요', 'alert', 5200);
      game.hud.hint('📡 무전으로 먼저 전파한다. 무전 없는 추격은 정당화되지 않는다');
      if (TG.audio.squelch) TG.audio.squelch(); TG.audio.pa(self.kind.radio);   // 상황실 무전(📡)
      if (TG.audio.chaseTheme) TG.audio.chaseTheme();   // 추격 음악 시작 — 대상과 가까울수록 밝고 크게(chaseTension)
      document.body.classList.add('chasing');
      return car;
    }
    return null;
  };
  function dist() {
    var pl = game.player, c = self.car; if (!c) return 1e9;
    return Math.hypot(c.pos.x - pl.pos.x, c.pos.z - pl.pos.z);
  }
  function behind() {   // 대상이 내 앞에 있는가(뒤를 따르는 자세인가)
    var pl = game.player, c = self.car, f = pl.forward();
    return ((c.pos.x - pl.pos.x) * f[0] + (c.pos.z - pl.pos.z) * f[1]) > 0;
  }
  // 부수적 피해: 추격 중 충돌 1회는 경고, 2회면 상황실이 중단을 지시한다
  this.onCollateral = function () {
    if (self.state !== 'follow') return;
    self.log.collateral++;
    game.penalize('chaseReckless', '추격 중 차량 접촉 — 부수적 피해', '추격의 위험이 검거 이익보다 크면 멈춘다');
    if (self.log.collateral >= 2 && !self.order) {
      self.order = true;
      game.hud.notice('📡 상황실 — 부수적 피해가 발생했습니다. 추격을 중단하고 무전·영상으로 처리하세요', 'alert', 5600);
      game.hud.hint('경광등을 끄고 속도를 줄이면 추격 중단으로 처리됩니다');
      if (TG.audio.squelch) TG.audio.squelch(); TG.audio.pa('추격 중단. 무전과 영상으로 처리하세요');
    }
  };
  // 추격 중단(정답인 경우가 있다): 어린이보호구역 도주 · 상황실 지시 · 보행자 밀집
  function breakOff(why, bonus) {
    self.state = 'break'; self.log.result = 'break';
    if (TG.audio.stopChaseTheme) TG.audio.stopChaseTheme(1.4);
    document.body.classList.remove('chasing');
    if (self.car) { self.car.flee = false; self.car.chase = false; self.car.cruise = 12; }
    game.player.setSiren(false); TG.audio.setSiren(false); game.hud.setSiren(false);
    game.addScore(bonus, null); game.stats.chaseBreak = (game.stats.chaseBreak || 0) + 1;
    game.hud.notice('🛑 추격 중단 — ' + why + ' (+' + bonus + ')', 'good', 6000);
    game.hud.pop('🛑 +' + bonus, 'good'); TG.audio.jingle(3);
    game.hud.hint('번호판은 이미 무전으로 전파됐고 블랙박스 영상이 남았다 — 사람이 다치는 것보다 낫다');
    TG.audio.say('추격 중단합니다. 무전 전파와 영상으로 처리하겠습니다', { kind: 'officer', queue: true });
  }
  this.breakOff = breakOff;
  // 검거: 대상이 포기하고 우측에 정차한다
  function caught() {
    self.state = 'stopped'; self.log.result = 'caught';
    if (TG.audio.stopChaseTheme) TG.audio.stopChaseTheme(1.6);
    document.body.classList.remove('chasing');
    game.slowmo = 1.1; game.punch = 1.2;   // 검거 순간: 짧은 슬로모션 + 화각 펀치(재미)
    var c = self.car; if (c) { c.flee = false; c.chase = false; c.cruise = 0; c.violation = c.violation || { type: self.kind.id === 'drunk' ? 'drunk' : 'license', seen: true }; }
    game.addScore(S.chaseCatch, null); game.stats.chaseCatch = (game.stats.chaseCatch || 0) + 1;
    game.hud.notice('✅ 대상 정차 — 원칙대로 따라가 검거 (+' + S.chaseCatch + ')', 'good', 6000);
    game.hud.pop('✅ +' + S.chaseCatch, 'good'); TG.audio.jingle(4);
    game.hud.hint('안전거리를 지키고 무전으로 전파했다 — 이것이 추격의 정석');
  }
  this.update = function (dt) {
    var pl = game.player, c = self.car;
    if (self.state !== 'follow' || !c) return;
    if (traffic.cars.indexOf(c) < 0) { self.state = 'lost'; self.log.result = 'lost'; if (TG.audio.stopChaseTheme) TG.audio.stopChaseTheme(1.2); document.body.classList.remove('chasing'); game.hud.notice('대상 차량을 놓쳤습니다 — 📡 무전 전파로 인접 순찰차에 인계됩니다', 'warn', 4200); return; }
    var d = dist(), bh = behind(), siren = pl.siren, radioed = !!(c.radioed || c.pursuitOk);
    self.log.radioed = self.log.radioed || radioed;
    self.t.follow += dt;
    var kmh = pl.speedKmh();
    if (TG.audio.chaseTension) TG.audio.chaseTension(Math.min(1, (kmh / 110) * 0.6 + (d < 60 ? (60 - d) / 60 * 0.5 : 0)));
    // 아슬아슬: 다른 차를 2m 안으로 스치며 지나갈 때. 점수는 없다 — 부수적 피해 직전이라는 긴장 신호다.
    self.t.miss = (self.t.miss || 0) - dt;
    if (kmh > 55 && self.t.miss <= 0) {
      for (var mi = 0; mi < traffic.cars.length; mi++) {
        var o = traffic.cars[mi]; if (o === c) continue;
        var mdx = o.pos.x - pl.pos.x, mdz = o.pos.z - pl.pos.z, md = Math.hypot(mdx, mdz);
        if (md > 2.6) continue;
        self.t.miss = 2.2; self.log.misses = (self.log.misses || 0) + 1;
        game.hud.pop('⚠ 아슬아슬', 'bad'); game.hud.hint('💭 부수적 피해 직전이었다 — 간격을 두고 따라간다');
        game.shake = Math.max(game.shake || 0, 0.5); TG.audio.whoosh();
        break;
      }
    }
    // 어린이보호구역으로 도주 → 추격을 끊는 것이 정답
    if (city.inSchoolZone(c.pos.x, c.pos.z) && d < 90) { breakOff('어린이보호구역으로 도주 — 추격을 끊고 무전·영상으로', S.chaseBreak); return; }
    // 상황실 중단 지시를 따랐는가(경광등 끄고 감속)
    if (self.order && !siren && pl.speedKmh() < 45) { breakOff('상황실 지시에 따라 중단', S.chaseBreak); return; }
    // 안전 거리
    if (d < 8 && bh) {
      self.t.close += dt;
      if (self.t.close > 1.2) { self.t.close = 0; self.log.closeCalls++; game.penalize('chaseClose', '추격 중 안전거리 미확보(8m 안)', '뒤에 붙어 밀어내지 않는다 — 대상이 급제동하면 추돌이다'); }
    } else self.t.close = Math.max(0, self.t.close - dt * 0.5);
    // 원칙대로 따라가는 시간: 경광등 ON · 무전 전파 · 10~40m · 대상이 앞에
    var ok = siren && radioed && bh && d >= 9 && d <= 42;
    if (ok) {
      self.t.safe += dt; self.t.lost = 0;
      self.t.tick += dt;
      if (self.t.tick >= 10) { self.t.tick = 0; self.log.safeAwards++; game.addScore(S.chaseSafe, null); game.hud.notice('📏 안전거리 유지 · 무전 전파 — 원칙대로 따라가고 있습니다 (+' + S.chaseSafe + ')', 'good', 2600); }
      if (self.t.safe >= 20) { caught(); return; }
    } else {
      self.t.lost += dt; self.t.tick = Math.max(0, self.t.tick - dt * 0.5);
      if (self.t.lost > 4 && self.t.warn <= 0) {
        self.t.warn = 8;
        game.hud.hint(!siren ? '경광등을 켠다 — 다른 차와 보행자에게 알리는 것이 먼저다'
          : !radioed ? '📡 무전으로 상황을 전파한다 — 무전 없는 추격은 정당화되지 않는다'
          : d > 42 ? '너무 멀어졌다 — 시야에 두고 따라간다' : '너무 가깝다 — 10m 이상 벌린다');
      }
      self.t.warn -= dt;
    }
    if (d > 220) { self.t.lost += dt; if (self.t.lost > 12) { self.state = 'lost'; self.log.result = 'lost'; if (TG.audio.stopChaseTheme) TG.audio.stopChaseTheme(1.2); document.body.classList.remove('chasing'); game.hud.notice('대상을 시야에서 놓쳤습니다 — 📡 전파된 수배로 인접 순찰차가 처리합니다', 'warn', 4600); } }
  };
  // HUD 한 줄
  this.line = function () {
    if (self.state !== 'follow' || !self.car) return self.state === 'break' ? '🛑 추격 중단 — 무전·영상 처리' : self.state === 'stopped' ? '✅ 대상 정차' : '';
    var d = Math.round(dist()), radioed = !!(self.car.radioed || self.car.pursuitOk);
    return '🚨 ' + self.kind.name + ' · ' + d + 'm ' + (d < 9 ? '⚠ 너무 가깝다' : d > 42 ? '멀다' : '적정') +
           ' · ' + (game.player.siren ? '경광등 ON' : '⚠ 경광등 OFF') + ' · ' + (radioed ? '📡 전파됨' : '⚠ 무전 필요') +
           ' · 원칙 유지 ' + self.t.safe.toFixed(0) + '/20초';
  };
  this.dispose = function () {
    if (TG.audio.stopChaseTheme) TG.audio.stopChaseTheme(0.6);
    document.body.classList.remove('chasing');
    if (self.car) { self.car.flee = false; self.car.chase = false; }
    self.car = null; self.state = 'idle';
  };
};
