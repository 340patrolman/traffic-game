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
    { id: 'theft', why: '절도 혐의자 탑승', name: '차량 절도 피의자', radio: '차량 절도 피의자가 탄 차량으로 확인됩니다. 추적 중' },
    { id: 'drunk', why: '음주 의심 · 비틀거림', name: '음주 의심 도주차량', radio: '음주 의심 차량입니다. 비틀거리며 도주 중' },   // 음주 도주는 적당한 범위에서 추격이 가능하다(법익이 크다)
    { id: 'wanted', why: '수배 조회 일치', name: '수배 차량', radio: '수배 차량으로 조회됩니다. 지원 요청합니다' },
  ];
  this.car = null; this.state = 'idle'; this.kind = KIND[0];
  this.t = { safe: 0, close: 0, follow: 0, lost: 0, warn: 0, tick: 0 };
  this.log = { collateral: 0, closeCalls: 0, safeAwards: 0, radioed: false, result: '', topKmh: 0 };
  this.said = {};

  // 대상 차량: 플레이어 앞 같은 방향 도로에 만든다. 도주(flee)라 흐름보다 빠르고 적색도 통과한다.
  this.spawn = function () {
    var pl = game.player, f = pl.forward();
    for (var tries = 0; tries < 24; tries++) {
      var ahead = 55 + tries * 4, x = pl.pos.x + f[0] * ahead, z = pl.pos.z + f[1] * ahead;
      var fr = city.frameAt(x, z, pl.heading);
      if (!fr.onRoad || fr.kind === 'link') continue;
      if (city.inSchoolZone(x, z)) continue;   // 시작부터 보호구역이면 바로 중단 판정이 떠 배울 기회가 없다
      var i = city.nearestIdx(city.xs, x), j = city.nearestIdx(city.zs, z), node = city.nodes[i][j];
      var d = Math.abs(f[0]) > Math.abs(f[1]) ? (f[0] > 0 ? 1 : 3) : (f[1] > 0 ? 0 : 2);
      if (!city.nodeFrom(node, d)) continue;
      var car = traffic.spawn({ at: { x: x, z: z, d: d, node: node }, v: Math.max(8, pl.telemetry.speed), cruise: 17, violator: true, laneIdx: 0, type: 'sedan' });
      if (!car) continue;
      car.wanted = true; car.flee = true; car.chase = true;
      self.car = car; self.kind = KIND[Math.floor(Math.random() * KIND.length)];
      self.state = 'follow'; self.t = { safe: 0, close: 0, follow: 0, lost: 0, warn: 0, tick: 0 };
      self.log = { collateral: 0, closeCalls: 0, safeAwards: 0, radioed: false, result: '', topKmh: 0 };
      self.said = {};
      game.hud.notice('📡 상황실 — ' + self.kind.name + ' 발견. 경광등 켜고 뒤에 붙되 안전거리를 지키세요', 'alert', 5200);
      game.hud.hint('경광등을 켜고 안전거리 10~40m 로 따라간다. 📡 무전을 하면 공조로 앞을 막아 준다(모든 것을 무전보고하지는 않는다)');
      if (TG.audio.squelch) TG.audio.squelch(); TG.audio.pa(self.kind.radio);   // 상황실 무전(📡)
      game.slowmo = 0.85; game.punch = 1.0; if (game.hud.vignette) game.hud.vignette(0.3);   // 대상 발견 순간 연출(짧게)
      if (TG.audio.chaseTheme) TG.audio.chaseTheme();   // 추격 음악 시작 — 대상과 가까울수록 밝고 크게(chaseTension)
      document.body.classList.add('chasing');
      return car;
    }
    return null;
  };
  // ---------- 🚨 추격 패널(HUD) ----------
  // 소유자(2026-09-12): 「추격전을 할 때 **상용게임 느낌** 물씬 나게 … 상용 퀄리티 높은 게임처럼 구성해줘.」
  // 상용 추격전이 늘 화면에 두는 것 셋을 그대로 둔다 —
  //  ① **거리 게이지**(너무 붙었나 · 적정 · 멀다)  ② **검거 게이지**(원칙을 지킨 시간이 쌓인다)  ③ **화면 밖 대상 화살표**.
  // 숫자 한 줄로는 달리면서 읽을 수 없다(0.5초 안에 읽히는 것이 상용의 기준이다).
  function q(sel) { var b = document.getElementById('chaseHud'); return b ? b.querySelector(sel) : null; }
  this.panel = function (camera) {
    var box = document.getElementById('chaseHud'), arrow = document.getElementById('chaseArrow');
    if (!box) return;
    if (self.state !== 'follow' || !self.car) { if (arrow) arrow.className = ''; return; }
    var d = dist(), radioed = !!(self.car.radioed || self.car.pursuitOk), need = radioed ? 12 : 20, siren = game.player.siren;
    var nm = q('.ch-name'); if (nm) nm.textContent = '🚨 ' + self.kind.name;
    var wy = q('.ch-why'); if (wy) wy.textContent = self.kind.why || '';
    var pct = TG.clamp(d / 60, 0, 1) * 100, mk = q('.ch-mark');
    if (mk) { mk.style.left = pct.toFixed(1) + '%'; mk.className = 'ch-mark ' + (d < 9 ? 'near' : d > 42 ? 'far' : 'ok'); }
    var nu = q('.ch-num'); if (nu) nu.textContent = Math.round(d) + 'm';
    var fl = q('.ch-fill'); if (fl) fl.style.width = (Math.min(1, self.t.safe / need) * 100).toFixed(0) + '%';
    var pt = q('.ch-ptxt'); if (pt) pt.textContent = '검거까지 ' + Math.max(0, Math.ceil(need - self.t.safe)) + '초';
    var cs = q('.ch-siren'); if (cs) { cs.textContent = siren ? '경광등 ON' : '경광등 OFF'; cs.className = 'ch-siren ' + (siren ? 'on' : 'warn'); }
    var cc = q('.ch-coop'); if (cc) { cc.textContent = radioed ? '📡 공조' : '단독'; cc.className = 'ch-coop ' + (radioed ? 'on' : ''); }
    var cd = q('.ch-dist'); if (cd) { cd.textContent = d < 9 ? '너무 가깝다' : d > 42 ? '멀다' : '적정 거리'; cd.className = 'ch-dist ' + (d < 9 ? 'warn' : d > 42 ? '' : 'on'); }
    // 화면 밖 대상: 카메라로 투영해 좌·우를 가린다
    if (arrow && camera && window.THREE) {
      var v = new THREE.Vector3(self.car.pos.x, (self.car.y || 0) + 0.8, self.car.pos.z).project(camera);
      var off = v.z > 1 || v.x < -1 || v.x > 1;
      arrow.className = off ? (v.x < 0 ? 'left' : 'right') : '';
      if (off) { var sp = arrow.querySelector('span'); if (sp) sp.textContent = v.x < 0 ? '◀' : '▶'; }
    }
  };
  this.hidePanel = function () {
    var arrow = document.getElementById('chaseArrow'); if (arrow) arrow.className = '';
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
  function caught(coop) {
    self.state = 'stopped'; self.log.result = 'caught'; self.log.coop = !!coop;
    if (TG.audio.stopChaseTheme) TG.audio.stopChaseTheme(1.6);
    document.body.classList.remove('chasing');
    game.slowmo = 1.1; game.punch = 1.2;   // 검거 순간: 짧은 슬로모션 + 화각 펀치(재미)
    var c = self.car; if (c) { c.flee = false; c.chase = false; c.cruise = 0; c.violation = c.violation || { type: self.kind.id === 'drunk' ? 'drunk' : 'license', seen: true }; }
    var bonus = S.chaseCatch + (coop ? 20 : 0);
    game.addScore(bonus, null); game.stats.chaseCatch = (game.stats.chaseCatch || 0) + 1;
    game.hud.notice('✅ 대상 정차 — ' + (coop ? '📡 공조 검거(앞을 막았다)' : '단독 검거') + ' (+' + bonus + ')', 'good', 6000);
    game.hud.pop('✅ +' + bonus, 'good'); TG.audio.jingle(4);
    game.hud.hint(coop ? '📡 공조로 검거했다 — 앞을 막으면 무리한 추격이 필요 없다' : '안전거리를 지켜 스스로 세웠다. 무전으로 공조하면 더 빨리 끝난다');
    if (coop && TG.audio.squelch) TG.audio.squelch();
  }
  this.update = function (dt) {
    var pl = game.player, c = self.car;
    if (self.state !== 'follow' || !c) return;
    if (traffic.cars.indexOf(c) < 0) { self.state = 'lost'; self.log.result = 'lost'; if (TG.audio.stopChaseTheme) TG.audio.stopChaseTheme(1.2); document.body.classList.remove('chasing'); game.hud.notice('대상 차량을 놓쳤습니다 — 📡 무전 전파로 인접 순찰차에 인계됩니다', 'warn', 4200); return; }
    var d = dist(), bh = behind(), siren = pl.siren, radioed = !!(c.radioed || c.pursuitOk);
    self.log.radioed = self.log.radioed || radioed;
    self.t.follow += dt;
    var kmh = pl.speedKmh();
    if (TG.audio.chaseTension && isFinite(d) && isFinite(kmh)) TG.audio.chaseTension(Math.min(1, (kmh / 110) * 0.6 + (d < 60 ? (60 - d) / 60 * 0.5 : 0)));
    // 📡 무전 교신 — 상용 추격전은 「상황실과 주고받는 말」로 긴장을 만든다. 우리 것은 **원칙대로** 주고받는다.
    self.log.topKmh = Math.max(self.log.topKmh || 0, kmh);
    if (radioed && !self.said.coop && self.t.safe > 5) {
      self.said.coop = true;
      if (TG.audio.squelch) TG.audio.squelch();
      game.hud.notice('📡 상황실 — 인접 순찰차가 전방을 막습니다. 간격 유지하고 따라가세요', 'alert', 4200);
      TG.audio.pa('인접 순찰차가 전방을 막습니다. 간격 유지하십시오');
    }
    if (!radioed && !self.said.solo && self.t.follow > 12) {
      self.said.solo = true;
      game.hud.hint('💭 혼자 쫓기 어려우면 📡 무전으로 공조를 부른다 — 앞을 막아 주면 12초에 끝난다');
    }
    if (!self.said.near && d < 12 && behind()) {
      self.said.near = true;
      game.hud.hint('💭 너무 붙었다 — 대상이 급제동하면 그대로 추돌이다. 10m 이상 벌린다');
    }
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
    if (self.t.follow > 5 && city.inSchoolZone(c.pos.x, c.pos.z) && d < 90) { breakOff('어린이보호구역으로 도주 — 추격을 끊고 무전·영상으로', S.chaseBreak); return; }
    // 상황실 중단 지시를 따랐는가(경광등 끄고 감속)
    if (self.order && !siren && pl.speedKmh() < 45) { breakOff('상황실 지시에 따라 중단', S.chaseBreak); return; }
    // 안전 거리
    if (d < 8 && bh) {
      self.t.close += dt;
      if (self.t.close > 1.2) { self.t.close = 0; self.log.closeCalls++; game.penalize('chaseClose', '추격 중 안전거리 미확보(8m 안)', '뒤에 붙어 밀어내지 않는다 — 대상이 급제동하면 추돌이다'); }
    } else self.t.close = Math.max(0, self.t.close - dt * 0.5);
    // 원칙대로 따라가는 시간: 경광등 ON · 무전 전파 · 10~40m · 대상이 앞에
    // 원칙대로 따라가는 시간: 경광등 ON · 대상이 앞에 · 10~42m. **무전은 필수가 아니다** —
    // 무전을 하면 공조(인접 순찰차가 앞을 막는다)로 12초에 끝나고, 안 하면 단독으로 20초를 따라간다.
    var ok = siren && bh && d >= 9 && d <= 42;
    var need = radioed ? 12 : 20;
    if (ok) {
      self.t.safe += dt; self.t.lost = 0;
      self.t.tick += dt;
      if (self.t.tick >= 10) { self.t.tick = 0; self.log.safeAwards++; game.addScore(S.chaseSafe, null); game.hud.notice('📏 안전거리 유지 · 무전 전파 — 원칙대로 따라가고 있습니다 (+' + S.chaseSafe + ')', 'good', 2600); }
      if (self.t.safe >= need) { caught(radioed); return; }
    } else {
      self.t.lost += dt; self.t.tick = Math.max(0, self.t.tick - dt * 0.5);
      if (self.t.lost > 4 && self.t.warn <= 0) {
        self.t.warn = 8;
        game.hud.hint(!siren ? '경광등을 켠다 — 다른 차와 보행자에게 알리는 것이 먼저다'
          : d > 42 ? '너무 멀어졌다 — 먼지와 제동등을 보고 따라간다' : '너무 가깝다 — 10m 이상 벌린다');
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
           ' · ' + (game.player.siren ? '경광등 ON' : '⚠ 경광등 OFF') + ' · ' + (radioed ? '📡 공조' : '단독') +
           ' · ' + self.t.safe.toFixed(0) + '/' + (radioed ? 12 : 20) + '초';
  };
  this.dispose = function () {
    self.hidePanel();
    if (TG.audio.stopChaseTheme) TG.audio.stopChaseTheme(0.6);
    document.body.classList.remove('chasing');
    if (self.car) { self.car.flee = false; self.car.chase = false; }
    self.car = null; self.state = 'idle';
  };
};
