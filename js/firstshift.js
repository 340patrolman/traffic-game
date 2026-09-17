// 🚓 첫 출근(재미 설계서 7절 1단계 #2 「첫 30초」) — 설명 화면 없이, 첫 판 안에서 조작을 하나씩 켠다.
//  가속 → (사수 무전) 경광등 → 단속 → 오른쪽 깜빡이·갓길 정차 → 하차. 대상은 느리고 반드시 선다 — **첫 판은 실패할 수 없다.**
//  한 번 끝나면 기기에 남긴다(localStorage tg_firstshift). 다시 보고 싶으면 일시정지 메뉴의 「첫 출근 다시」.
TG.FirstShift = function (game) {
  var self = this, st = null, pulsed = null;
  var STEPS = [
    { id: 'go',     say: '⬆ 가속을 눌러 출발!',                                   btn: null },
    { id: 'siren',  say: '🔦 경광등을 켜!',                                         btn: 'btnSiren' },
    { id: 'enf',    say: '🚨 단속 단추 — 무슨 위반인지 골라',                        btn: 'btnEnforce' },
    { id: 'pull',   say: '👉 오른쪽 깜빡이 켜고, 그 차 뒤 5~12m 갓길에 세워',          btn: 'btnSigR' },
    { id: 'foot',   say: '🚶 하차 — 내리면 고지가 끝난다',                            btn: 'btnFoot' }
  ];
  function EL(id) { return document.getElementById(id); }
  function pulse(id) {
    if (pulsed === id) return;
    if (pulsed && EL(pulsed)) EL(pulsed).classList.remove('coachpulse');
    pulsed = id; if (id && EL(id)) EL(id).classList.add('coachpulse');
  }
  function radio(text) {
    if (TG.audio.squelch) TG.audio.squelch();
    game.hud.notice('📻 사수 — ' + text, 'info', 4200);
    TG.audio.say(text, { kind: 'pa', queue: true });
  }
  this.eligible = function () { return game.mode === 'patrol' && !(TG.mode && TG.mode.sim) && !game.firstOff && !TG.save.get('firstshift', false); };
  this.on = function () { return !!st; };
  this.state = function () { return st; };
  this.start = function () {
    st = { i: 0, t: 0, tries: 0, car: null, total: 0, sawAwait: false };
    show();
  };
  this.stop = function () { st = null; pulse(null); var c = EL('coachLine'); if (c) c.hidden = true; };
  function show() {
    var s = STEPS[st.i], c = EL('coachLine');
    if (c) { c.hidden = false; c.textContent = s.say; c.classList.remove('pop'); void c.offsetWidth; c.classList.add('pop'); }
    game.hud.hintNow(s.say);
    pulse(s.btn);
  }
  function next() { st.i++; st.t = 0; if (st.i >= STEPS.length) return finish(); show(); }
  function finish() {
    TG.save.set('firstshift', true);
    self.stop();
    if (game.praise) game.praise.medal('first-shift', '첫 출근 완료', 30);
    radio('잘했다. 이제 혼자 돈다 — 무전 들어오면 알려 줄게');
    if (game.story && game.mode === 'patrol') setTimeout(function () { if (game.state === 'play' && game.mode === 'patrol' && !game.story.on()) game.story.start(); }, 6000);
  }
  // 앞 55m 같은 차로에 느린 흰 차 — 운전하며 휴대전화를 본다(위반 표시가 떠 있다)
  function spawnTarget() {
    var P = game.player, city = game.city, tr = game.traffic;
    var d = TG.headingToDir(P.heading), dv = TG.DIR_VEC[d];
    var ahead = 55, x, z;
    for (var k = 0; k < 6; k++) { x = P.pos.x + dv[0] * ahead; z = P.pos.z + dv[1] * ahead; if (!city.nearIntersectionZone(x, z)) break; ahead += 10; }   // 교차로 부근에는 세우지 않는다
    var nd = city.nodeAhead(x, z, (d + 2) % 4);   // spawn 의 at.node 는 **뒤쪽** 교차로다(그 다음 교차로를 향해 달린다)
    if (!nd) return null;
    // 가로 자리는 지금 내 차로 그대로(방향이 축과 나란할 때만 — 대개 격자 도로다)
    if (d === 0 || d === 2) x = P.pos.x; else z = P.pos.z;
    var car = tr.spawn({ at: { x: x, z: z, d: d, node: nd }, v: 6, cruise: 6, straight: true, type: 'sedan', trait: 'phone', violator: false });
    if (!car) return null;
    car.cruise = 6; car.tutorial = true;
    car.violation = { type: 'phone', t: tr.time, node: null, seen: true };
    if (car.marker) car.marker.visible = true;
    return car;
  }
  this.update = function (dt) {
    if (!st || game.state !== 'play') return;
    st.t += dt; st.total += dt;
    var P = game.player, E = game.enforcement, s = STEPS[st.i];
    if (st.total > 240) { TG.save.set('firstshift', true); self.stop(); return; }    // 너무 오래 걸리면 조용히 놓아 준다
    // 대상은 **멀면 기어가고** 가까이 오면 20km/h 쯤 — 블록 끝으로 가 버려 설 자리를 잃지 않게(첫 판은 실패할 수 없다)
    if (st.car && st.car.tutorial) { var gap = Math.hypot(st.car.pos.x - P.pos.x, st.car.pos.z - P.pos.z); st.car.cruise = gap > 35 ? 1.2 : 5.5; if (st.car.violation == null && E.target !== st.car && st.i < 3) st.car.violation = { type: 'phone', t: game.traffic.time, node: null, seen: true }; }
    if (s.id === 'go') {
      if (P.speedKmh() > 12 || st.t > 7) {
        st.car = spawnTarget();
        if (!st.car) { if (st.t > 12) { st.t = 0; } return; }
        radio('앞 흰 차, 운전하면서 휴대전화 본다. 경광등 켜');
        next();
      }
    } else if (s.id === 'siren') {
      if (P.siren) next();
    } else if (s.id === 'enf') {
      if (E.state === 'yielding' || E.state === 'stopped' || E.state === 'await') next();
      else if (st.car && game.traffic.cars.indexOf(st.car) < 0) retry();
      else if (E.state === 'idle' && game.selectTarget && st.car && Math.hypot(st.car.pos.x - P.pos.x, st.car.pos.z - P.pos.z) < 45 && st.t > 1 && !st.sel) { st.sel = true; game.selectTarget({ kind: 'car', car: st.car }); }
    } else if (s.id === 'pull') {
      if (E.state === 'await') { st.sawAwait = true; next(); }
      else if (E.state === 'idle' || E.state === 'release') retry();
    } else if (s.id === 'foot') {
      if (E.state === 'release' || (E.state === 'idle' && st.sawAwait)) finish();
    }
  };
  function retry() {
    st.tries++;
    if (st.tries > 3) { TG.save.set('firstshift', true); self.stop(); return; }
    if (st.car && st.car.tutorial) { try { game.traffic.remove(st.car); } catch (e) {} }
    st.car = null; st.sel = false; st.i = 0; st.t = 8; show();
  }
};
