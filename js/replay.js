// 👁 두 시점 되돌려 보기 — 「하지 말라는 걸 하면 무슨 일이 벌어지는가」를 **아이 눈**과 **운전자 눈**으로 보여 준다.
//
// 소유자(2026-09-16): 「게임의 재미를 위해서 **하지 말라는 거 하면 벌어질 일들을 보여주는 게 좋지 —
//   아이 시점과 운전자 시점으로.**」
//
// 왜 두 시점인가: 차 사이에서 튀어나오는 사고는 **둘 다 서로를 못 본다**. 말로 「위험해요」라고 하면 남지 않지만,
// 아이 눈으로 「차가 안 보인다」를 보고 운전자 눈으로 「아이가 갑자기 나타난다」를 보면 그 자리에서 이해된다.
//
// 규칙
//  · **사고를 보여주지 않는다.** 차는 아이 앞에서 서고, 되돌려 보기는 그 직전 순간의 **시야**만 보여 준다.
//  · 되돌려 보기 동안 세상은 멈춘다(카메라만 움직인다) — 아이가 조작할 것이 없다.
//  · 문장은 짧게. 한 컷에 한 줄.
TG.Replay = function (game) {
  var self = this, shots = null, idx = 0, t = 0, ended = 0;
  var camPos = null, camLook = null;

  function el(id) { return document.getElementById(id); }
  function card(shot, n, total) {
    var box = el('replayCard'); if (!box) return;
    var kick = box.querySelector('.rp-kick'), ttl = box.querySelector('.rp-ttl'), sub = box.querySelector('.rp-sub'), dots = box.querySelector('.rp-dots');
    if (kick) kick.textContent = shot.kick || '';
    if (ttl) ttl.textContent = shot.ttl || '';
    if (sub) { sub.textContent = shot.sub || ''; sub.style.display = shot.sub ? '' : 'none'; }
    if (dots) {
      dots.innerHTML = '';
      for (var i = 0; i < total; i++) { var s = document.createElement('i'); s.className = i === n ? 'on' : ''; dots.appendChild(s); }
    }
    box.className = 'on';
  }
  function hideCard() { var b = el('replayCard'); if (b) b.className = ''; }

  // shots: [{ pos:[x,y,z], look:[x,y,z], sec, kick, ttl, sub, fov }]
  this.play = function (list, onEnd) {
    if (!list || !list.length) return false;
    shots = list; idx = 0; t = 0; self.onEnd = onEnd || null;
    document.body.classList.add('replaying');
    step(0);
    if (TG.audio.whoosh) TG.audio.whoosh();
    return true;
  };
  function step(i) {
    idx = i; t = 0;
    var s = shots[i];
    camPos = s.pos; camLook = s.look;
    card(s, i, shots.length);
    if (s.say && TG.audio.say) TG.audio.say(s.say, { kind: 'narrator', queue: false });
  }
  this.active = function () { return !!shots; };
  this.update = function (dt) {
    if (!shots) return;
    t += dt;
    var s = shots[idx];
    if (t >= (s.sec || 2.4)) {
      if (idx + 1 < shots.length) step(idx + 1);
      else self.stop();
    }
  };
  this.stop = function () {
    if (!shots) return;
    shots = null; camPos = camLook = null;
    document.body.classList.remove('replaying');
    hideCard();
    var fn = self.onEnd; self.onEnd = null;
    if (fn) fn();
  };
  // 카메라는 이 층이 잡는다(main.js camFx 끝에서 부른다)
  this.apply = function (camera) {
    if (!shots || !camPos || !camLook) return false;
    var s = shots[idx], k = Math.min(1, t / 0.45);                       // 컷이 바뀔 때 0.45초 동안 부드럽게 다가간다
    var push = s.push || 0;
    camera.position.set(camPos[0], camPos[1], camPos[2] + 0);
    if (push) {                                                          // 앞으로 살짝 밀며 보는 컷(속도감)
      var dx = camLook[0] - camPos[0], dz = camLook[2] - camPos[2], d = Math.hypot(dx, dz) || 1;
      camera.position.x += (dx / d) * push * k; camera.position.z += (dz / d) * push * k;
    }
    camera.lookAt(camLook[0], camLook[1], camLook[2]);
    return true;
  };

  // ---- 자주 쓰는 두 컷: 「차 사이에서 튀어나오기」 ----
  // childPos: 아이(또는 자전거) 자리 · carObj: 다가오던 차 · blockObj: 시야를 막은 것(주차 차량)
  this.blindSpot = function (childPos, carObj, opts) {
    opts = opts || {};
    var cy = (childPos.y || 0) + (opts.eye || 1.15);                     // 아이 눈높이
    var cx = childPos.x, cz = childPos.z;
    var car = carObj && carObj.pos ? carObj.pos : null;
    if (!car) return false;
    var carY = (carObj.y || 0) + 1.15;                                   // 운전석 눈높이
    var shots = [
      { pos: [cx, cy, cz], look: [car.x, carY - 0.4, car.z], sec: opts.sec || 2.6, push: 0.6,
        kick: '① 아이 눈', ttl: opts.childTtl || '차 사이에서는 차가 안 보인다',
        sub: opts.childSub || '세워 둔 차가 시야를 막는다 — 나오기 전에는 아무것도 안 보인다',
        say: opts.childSay || '아이 눈으로 보면, 세워 둔 차에 가려 오는 차가 보이지 않아요' },
      { pos: [car.x, carY, car.z], look: [cx, cy - 0.2, cz], sec: opts.sec || 2.6, push: 0.8,
        kick: '② 운전자 눈', ttl: opts.driverTtl || '운전자도 아이를 못 본다',
        sub: opts.driverSub || '갑자기 나타나면 브레이크를 밟아도 늦는다 — 관성 때문에 바로 멈추지 않는다',
        say: opts.driverSay || '운전자 눈으로 보면, 아이가 갑자기 나타나요. 그래서 멈추고 살펴야 해요' }
    ];
    return self.play(shots, opts.onEnd);
  };
};
