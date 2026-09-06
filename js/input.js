// 입력: 터치(1급) — 왼쪽 원형 조이스틱(좌우 조향 · 위 가속 · 아래 브레이크/후진) + 오른쪽 원형 버튼(▲ 가속 · ■ 브레이크 · ▼ 후진 · 경광등).
// 키보드(부가): ← → 조향, ↑ 가속, ↓/Space 브레이크(정지 후 계속 누르면 후진), R 후진, L 경광등. 포인터 이벤트로 마우스·터치를 함께 받는다.
TG.Input = function () {
  var self = this;
  this.held = {};
  this.btn = { left: false, right: false, gas: false, brake: false, rev: false };
  this.stick = { active: false, x: 0, y: 0, id: null };
  this.pressed = {};
  this.isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) || /[?&]touch=1/.test(location.search);
  this.handlers = {};

  addEventListener('keydown', function (e) {
    if (e.repeat) return;
    self.held[e.code] = true; self.pressed[e.code] = true;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].indexOf(e.code) >= 0) e.preventDefault();
    if (self.handlers[e.code]) self.handlers[e.code]();
  });
  addEventListener('keyup', function (e) { self.held[e.code] = false; });
  addEventListener('blur', function () { self.held = {}; for (var k in self.btn) self.btn[k] = false; releaseStick(); });

  function bindHold(el, name) {
    function down(e) { e.preventDefault(); e.stopPropagation(); self.btn[name] = true; el.classList.add('held'); try { el.setPointerCapture(e.pointerId); } catch (x) {} TG.audio.resume(); }
    function up(e) { e.preventDefault(); self.btn[name] = false; el.classList.remove('held'); }
    el.addEventListener('pointerdown', down); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('lostpointercapture', up);
    el.addEventListener('touchstart', function (e) { e.preventDefault(); }, { passive: false });
    el.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  }
  var holds = document.querySelectorAll('[data-btn]');
  for (var i = 0; i < holds.length; i++) bindHold(holds[i], holds[i].getAttribute('data-btn'));

  // 원형 조이스틱: 영역 안 어디를 눌러도 그 자리가 중심. 반지름 60px 안에서 -1..1.
  var zone = document.getElementById('stickZone'), base = document.getElementById('stickBase'), nub = document.getElementById('stickNub');
  var baseX = 0, baseY = 0, R = 60;
  function moveNub(cx, cy) {
    var dx = cx - baseX, dy = cy - baseY, d = Math.hypot(dx, dy);
    if (d > R) { dx *= R / d; dy *= R / d; }
    self.stick.x = dx / R; self.stick.y = -dy / R;
    nub.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
  }
  function releaseStick() {
    self.stick.active = false; self.stick.x = 0; self.stick.y = 0; self.stick.id = null;
    if (base) { base.classList.remove('on'); nub.style.transform = 'translate(0,0)'; }
  }
  if (zone) {
    zone.addEventListener('pointerdown', function (e) {
      e.preventDefault(); TG.audio.resume();
      var r = zone.getBoundingClientRect();
      baseX = e.clientX; baseY = e.clientY;
      // 스틱 베이스를 손가락 위치로(영역 안으로 클램프)
      var bx = TG.clamp(e.clientX - r.left, 70, r.width - 70), by = TG.clamp(e.clientY - r.top, 70, r.height - 70);
      baseX = r.left + bx; baseY = r.top + by;
      base.style.left = (bx - 70) + 'px'; base.style.top = (by - 70) + 'px'; base.classList.add('on');
      self.stick.active = true; self.stick.id = e.pointerId;
      try { zone.setPointerCapture(e.pointerId); } catch (x) {}
      moveNub(e.clientX, e.clientY);
    });
    zone.addEventListener('pointermove', function (e) { if (self.stick.active && e.pointerId === self.stick.id) moveNub(e.clientX, e.clientY); });
    function endS(e) { if (e.pointerId === self.stick.id) releaseStick(); }
    zone.addEventListener('pointerup', endS); zone.addEventListener('pointercancel', endS); zone.addEventListener('lostpointercapture', endS);
    zone.addEventListener('touchstart', function (e) { e.preventDefault(); }, { passive: false });
    zone.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  }

  this.bindTap = function (el, fn) {
    if (!el) return;
    el.addEventListener('pointerdown', function (e) { e.preventDefault(); e.stopPropagation(); TG.audio.resume(); fn(); });
    el.addEventListener('touchstart', function (e) { e.preventDefault(); }, { passive: false });
  };
  this.onKey = function (code, fn) { this.handlers[code] = fn; };
  this.consume = function (code) { var p = !!this.pressed[code]; this.pressed[code] = false; return p; };
  this.clearPressed = function () { this.pressed = {}; };

  // 프레임마다 읽는 조작값. steer: +1 = 좌회전(물리 관례), throttle/brake/reverse 0..1
  // 키보드·버튼 입력은 화면의 원형 스틱에도 그대로 비춰 준다(PC 에서도 원판이 살아 움직인다).
  var mirrorX = 0, mirrorY = 0;
  this.read = function () {
    var h = this.held, b = this.btn, st = this.stick;
    var steer = (b.left || h.ArrowLeft || h.KeyA ? 1 : 0) - (b.right || h.ArrowRight || h.KeyD ? 1 : 0);
    var throttle = (b.gas || h.ArrowUp || h.KeyW) ? 1 : 0;
    var brake = (b.brake || h.ArrowDown || h.KeyS || h.Space) ? 1 : 0;
    var reverse = (b.rev || h.KeyR) ? 1 : 0;
    if (!st.active && nub) {
      var tx = -steer, ty = throttle ? -1 : (brake || reverse) ? 1 : 0;
      mirrorX += (tx - mirrorX) * 0.35; mirrorY += (ty - mirrorY) * 0.35;
      nub.style.transform = 'translate(' + (mirrorX * R * 0.8) + 'px,' + (mirrorY * R * 0.8) + 'px)';
      if (base) base.classList.toggle('live', Math.abs(mirrorX) > 0.05 || Math.abs(mirrorY) > 0.05);
    }
    if (st.active) {
      var dz = 0.12;
      if (Math.abs(st.x) > dz) steer = -Math.sign(st.x) * Math.min(1, (Math.abs(st.x) - dz) / (1 - dz)) * 1.0;
      if (st.y > dz) throttle = Math.max(throttle, Math.min(1, (st.y - dz) / (1 - dz)));
      if (st.y < -dz) brake = Math.max(brake, Math.min(1, (-st.y - dz) / (1 - dz)));
    }
    return { steer: steer, throttle: throttle, brake: brake, reverse: reverse };
  };
};
