// 🎬 정차 캠(재미 설계서 7절 1단계 #3) — 위반 차량을 갓길에 **안전하게** 세운 순간의 손맛.
//  ① 히트스톱 0.12초(세상이 멈칫) → ② 1.6초 컷: 순찰차 뒤 보도 쪽에서 두 차를 앞뒤로 한 화면에 → ③ 세 항목 등급이 하나씩 켜진다.
//  세 항목: 🔦 경광등 · 👉 오른쪽 깜빡이(정차 유도 중 한 번이라도) · 📏 자리(대상 뒤 5~12m · 갓길 · 나란히).
//  ⚠ 충돌·과속에는 절대 이 연출을 주지 않는다 — 부르는 곳은 enforcement 의 「정차 완료(await)」 한 곳뿐이다.
TG.StopCam = function (game) {
  var self = this, t = 0, dur = 1.6, on = false, car = null, pos = null, look = null, from = null;
  this.last = null;           // 검증이 읽는다: { checks:[…], score, grade }
  function EL(id) { return document.getElementById(id); }

  // 정차 유도가 시작된 뒤 오른쪽 깜빡이를 켰는가 — enforcement 가 매 프레임 알려 준다
  this.sawSignal = false;
  this.noteSignal = function (sig) { if (sig === 'R') self.sawSignal = true; };
  this.resetSignal = function () { self.sawSignal = false; };

  this.active = function () { return on; };
  this.start = function (target, pl) {
    if (!target || !pl) return null;
    var cf = [Math.sin(target.heading), Math.cos(target.heading)], rx = -cf[1], rz = cf[0];
    var dx = pl.pos.x - target.pos.x, dz = pl.pos.z - target.pos.z, along = -(dx * cf[0] + dz * cf[1]), lat = Math.abs(dx * rx + dz * rz);
    var dh = Math.abs(TG.wrapAngle(pl.heading - target.heading));
    var checks = [
      { id: 'siren', label: '🔦 경광등', ok: !!pl.siren },
      { id: 'signal', label: '👉 오른쪽 깜빡이', ok: !!self.sawSignal },
      { id: 'spot', label: '📏 뒤 5~12m · 나란히', ok: along >= 5 && along <= 12 && lat < 1.6 && dh < 0.3 }
    ];
    var score = checks.filter(function (c) { return c.ok; }).length;
    var grade = score === 3 ? '완벽한 정차' : score === 2 ? '좋은 정차' : '정차 완료';
    if (score === 3 && game.stats) game.stats.perfectStops = (game.stats.perfectStops || 0) + 1;
    self.last = { checks: checks, score: score, grade: grade, along: +along.toFixed(1), lat: +lat.toFixed(1) };
    // 카메라: 순찰차 **뒤 오른편**(보도 쪽) 위에서 앞을 본다 — 순찰차와 세운 차가 앞뒤로 한 화면에 든다(세로 화면에도 맞는다).
    // 조금 높고 먼 데서 시작해 0.5초 동안 다가간다.
    car = target; t = 0; on = true;
    var pf = [Math.sin(pl.heading), Math.cos(pl.heading)];
    pos = [pl.pos.x - pf[0] * 6.5 + rx * 2.8, (pl.y || 0) + 2.5, pl.pos.z - pf[1] * 6.5 + rz * 2.8];
    look = [pl.pos.x + (target.pos.x - pl.pos.x) * 0.6, (target.y || 0) + 0.8, pl.pos.z + (target.pos.z - pl.pos.z) * 0.6];   // 두 차 사이(세운 차 쪽)
    from = [pos[0] - pf[0] * 3 + rx * 1.2, pos[1] + 1.6, pos[2] - pf[1] * 3 + rz * 1.2];
    game.hitstop = 0.12;
    game.slowmo = Math.max(game.slowmo || 0, 1.2);
    document.body.classList.add('stopcam');
    card(checks, grade, score);
    if (game.crew) game.crew.say(score === 3 ? 'stopPerfect' : 'stopOk', 1.8, 30);
    if (TG.audio.shutter) TG.audio.shutter();
    if (TG.haptic) TG.haptic(score === 3 ? [18, 40, 18] : [12, 30, 12]);
    self.resetSignal();
    return self.last;
  };
  function card(checks, grade, score) {
    var box = EL('stopGrade'); if (!box) return;
    box.innerHTML = '';
    var h = document.createElement('b'); h.className = 'sg-h' + (score === 3 ? ' gold' : ''); h.textContent = (score === 3 ? '🏅 ' : '🚓 ') + grade;
    box.appendChild(h);
    checks.forEach(function (c, i) {
      var r = document.createElement('div'); r.className = 'sg-r ' + (c.ok ? 'ok' : 'no');
      r.style.animationDelay = (0.25 + i * 0.28) + 's';
      r.textContent = (c.ok ? '✔ ' : '— ') + c.label;
      box.appendChild(r);
    });
    box.hidden = false; box.classList.remove('on'); void box.offsetWidth; box.classList.add('on');
    clearTimeout(card.tm); card.tm = setTimeout(function () { box.classList.remove('on'); box.hidden = true; }, 2600);
  }
  this.update = function (dt) {
    if (!on) return;
    t += dt;
    if (t >= dur) self.stop();
  };
  this.stop = function () { on = false; car = null; document.body.classList.remove('stopcam'); };
  // main.js camFx 첫머리에서 부른다 — 컷 동안 카메라를 잡는다
  this.apply = function (camera) {
    if (!on || !pos) return false;
    var k = Math.min(1, t / 0.5), e = 1 - Math.pow(1 - k, 3);
    camera.position.set(from[0] + (pos[0] - from[0]) * e, from[1] + (pos[1] - from[1]) * e, from[2] + (pos[2] - from[2]) * e);
    if (camera.fov !== 50) { camera.fov = 50; camera.updateProjectionMatrix(); }   // 좁게 — 두 차가 크게 보이게(끝나면 main 이 화각을 되돌린다)
    camera.lookAt(look[0], look[1], look[2]);
    return true;
  };
};
