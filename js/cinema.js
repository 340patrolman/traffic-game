// 🎬 연출(v0.10.16) — 상용 게임의 「서사·액션·스타일」을 화면 연출로만 얹는다.
//  규칙: 주행 물리·단속 판정·점수는 한 줄도 건드리지 않는다. 여기서 하는 일은 **보여 주는 것**뿐이다.
//   ① brief()  장 브리핑 — 근무를 여는 시네마틱 카드(월 · 장 제목 · 사수 한마디 · 목표)
//   ② stamp()  스타일 스탬프 — 코드1 출동 · 작전 종료 · 검거처럼 「순간」을 큰 글씨로 찍는다
//   ③ lockOn() 액션 락온 — 위반 차를 발견한 순간 대상 위에 브래킷이 조여든다(카메라로 투영해 따라간다)
//  전부 pointer-events:none 이라 조작을 막지 않는다. 교실(영아·어린이·청소년)에서는 쓰지 않는다 — 아이들 화면은 그대로 둔다.
//  움직임을 줄이도록 설정한 기기(prefers-reduced-motion)에서는 글만 뜨고 움직이지 않는다(CSS 가 맡는다).
TG.Cinema = function (game) {
  var self = this, G = game;
  var cardT = null, stampT = null, lock = null, lockT = 0;
  function EL(id) { return document.getElementById(id); }
  function quiet() {
    var m = G.mode;
    return m === 'tot' || m === 'kid' || m === 'bike' || (TG.mode && TG.mode.sim);
  }
  // 📖 장 브리핑: 2.6초 뒤 스스로 사라지고, 화면을 누르면 바로 사라진다
  this.brief = function (o) {
    var b = EL('cineCard'); if (!b || quiet() || !o) return false;
    var kick = b.querySelector('.ci-kick'), ttl = b.querySelector('.ci-ttl'), sub = b.querySelector('.ci-sub'), goal = b.querySelector('.ci-goal');
    if (kick) kick.textContent = o.kick || '';
    if (ttl) ttl.textContent = o.title || '';
    if (sub) sub.textContent = o.sub || '';
    if (goal) { goal.textContent = o.goal || ''; goal.style.display = o.goal ? '' : 'none'; }
    b.className = 'on';
    document.body.classList.add('cine');
    clearTimeout(cardT);
    cardT = setTimeout(self.hideBrief, o.ms || 2600);
    document.addEventListener('pointerdown', tapSkip, { capture: true, once: true });   // 화면을 누르면 바로 넘어간다(이벤트는 그대로 흘려보낸다)
    return true;
  };
  function tapSkip() { if (self.briefOn()) self.hideBrief(); }
  this.hideBrief = function () {
    var b = EL('cineCard'); if (b) b.className = '';
    document.body.classList.remove('cine');
    document.removeEventListener('pointerdown', tapSkip, { capture: true });
    clearTimeout(cardT); cardT = null;
  };
  this.briefOn = function () { var b = EL('cineCard'); return !!(b && b.className.indexOf('on') >= 0); };
  // 🅰 스타일 스탬프: 0.9초. kind = urgent(적색) · good(초록) · gold(금색)
  this.stamp = function (text, sub, kind) {
    var s = EL('cineStamp'); if (!s || quiet() || !text) return false;
    var bb = s.querySelector('b'), ii = s.querySelector('i');
    if (bb) bb.textContent = text;
    if (ii) { ii.textContent = sub || ''; ii.style.display = sub ? '' : 'none'; }
    s.className = 'on ' + (kind || 'good');
    clearTimeout(stampT);
    stampT = setTimeout(function () { s.className = ''; }, 900);
    return true;
  };
  // 🎯 락온: 발견한 대상 위에 브래킷. 대상이 사라지거나 1.1초가 지나면 스스로 꺼진다.
  this.lockOn = function (car, label) {
    if (!car || quiet()) return false;
    var l = EL('lockOn'); if (!l) return false;
    lock = car; lockT = 1.1;
    var t = l.querySelector('b'); if (t) t.textContent = label || '';
    l.className = 'on';
    return true;
  };
  this.lockTarget = function () { return lock; };
  // 매 프레임: 락온 브래킷을 카메라로 투영해 대상 위에 붙인다(추격 화살표와 같은 방식)
  this.update = function (dt, camera) {
    var l = EL('lockOn'); if (!l) return;
    if (!lock || lockT <= 0 || !camera || !window.THREE || quiet()) { if (l.className) { l.className = ''; lock = null; } return; }
    lockT -= dt;
    if (lockT <= 0 || !lock.pos) { l.className = ''; lock = null; return; }
    var v = new THREE.Vector3(lock.pos.x, (lock.y || 0) + 1.5, lock.pos.z).project(camera);
    if (v.z > 1 || v.x < -1 || v.x > 1 || v.y < -1 || v.y > 1) { l.className = ''; return; }
    l.className = 'on';
    l.style.left = ((v.x * 0.5 + 0.5) * 100).toFixed(1) + '%';
    l.style.top = ((-v.y * 0.5 + 0.5) * 100).toFixed(1) + '%';
    // 멀리 있는 차에 큰 브래킷을 씌우면 어색하다 — **거리에 따라 크기를 줄인다**(46~150px · 게임 설계값)
    var d = Math.hypot(camera.position.x - lock.pos.x, camera.position.z - lock.pos.z);
    var w = Math.round(TG.clamp(1600 / Math.max(6, d), 46, 150));
    l.style.width = w + 'px'; l.style.height = w + 'px'; l.style.margin = (-w / 2) + 'px 0 0 ' + (-w / 2) + 'px';
    var k = TG.clamp(lockT / 1.1, 0, 1);
    l.style.setProperty('--lk', (1 + k * 0.7).toFixed(2));
  };
  this.clear = function () {
    self.hideBrief();
    var s = EL('cineStamp'); if (s) s.className = '';
    var l = EL('lockOn'); if (l) l.className = '';
    lock = null; lockT = 0;
    clearTimeout(stampT); stampT = null;
  };
};
