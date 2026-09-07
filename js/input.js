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

  // 키 코드: 일부 환경(한글 IME·임베디드 브라우저·원격 입력)에서는 e.code 가 비어 온다 → e.key 로 복원한다. 한글 자모(ㅈ=W, ㅁ=A …)도 같은 키로 본다.
  var JAMO = { 'ㅂ': 'Q', 'ㅈ': 'W', 'ㄷ': 'E', 'ㄱ': 'R', 'ㅅ': 'T', 'ㅛ': 'Y', 'ㅕ': 'U', 'ㅑ': 'I', 'ㅐ': 'O', 'ㅔ': 'P', 'ㅁ': 'A', 'ㄴ': 'S', 'ㅇ': 'D', 'ㄹ': 'F', 'ㅎ': 'G', 'ㅗ': 'H', 'ㅓ': 'J', 'ㅏ': 'K', 'ㅣ': 'L', 'ㅋ': 'Z', 'ㅌ': 'X', 'ㅊ': 'C', 'ㅍ': 'V', 'ㅠ': 'B', 'ㅜ': 'N', 'ㅡ': 'M' };
  var NAMED = { ' ': 'Space', 'Spacebar': 'Space', 'Esc': 'Escape', 'Up': 'ArrowUp', 'Down': 'ArrowDown', 'Left': 'ArrowLeft', 'Right': 'ArrowRight' };
  function codeOf(e) {
    var c = e.code;
    if (c && c !== 'Unidentified') { if (/^Key[A-Z]$/.test(c) || /^Arrow|^Digit|^Space$|^Escape$|^Enter$|^Shift|^Control|^Alt/.test(c)) return c; }
    var k = e.key || '';
    if (NAMED[k]) return NAMED[k];
    if (/^Arrow(Up|Down|Left|Right)$/.test(k) || k === 'Escape' || k === 'Enter') return k;
    if (JAMO[k]) return 'Key' + JAMO[k];
    if (/^[a-zA-Z]$/.test(k)) return 'Key' + k.toUpperCase();
    if (/^[0-9]$/.test(k)) return 'Digit' + k;
    if (!c && e.keyCode) { var kc = e.keyCode; if (kc === 37) return 'ArrowLeft'; if (kc === 38) return 'ArrowUp'; if (kc === 39) return 'ArrowRight'; if (kc === 40) return 'ArrowDown'; if (kc === 32) return 'Space'; if (kc === 27) return 'Escape'; if (kc === 13) return 'Enter'; if (kc >= 65 && kc <= 90) return 'Key' + String.fromCharCode(kc); }
    return c || k;
  }
  addEventListener('keydown', function (e) {
    var code = codeOf(e);
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].indexOf(code) >= 0) e.preventDefault();
    if (e.repeat) return;
    self.held[code] = true; self.pressed[code] = true;
    if (self.handlers[code]) self.handlers[code]();
  });
  addEventListener('keyup', function (e) { self.held[codeOf(e)] = false; });
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
  // 화면 게임패드의 얼굴 버튼(△○×□·L1·R1 …): data-key="KeyF" 처럼 키 이름을 적어 두면 그 키 핸들러를 그대로 부른다
  var taps = document.querySelectorAll('[data-key]');
  for (var ti = 0; ti < taps.length; ti++) (function (el) { var code = el.getAttribute('data-key'); self.bindTap(el, function () { self.pressed[code] = true; if (self.handlers[code]) self.handlers[code](); }); })(taps[ti]);

  // 실물 게임패드(Gamepad API, 표준 배치): 왼쪽 스틱 조향 · RT 가속 · LT 브레이크 · A/× 가속 · B/○ 브레이크 · X/□ 단속 · Y/△ 앰프
  // L1/R1 좌·우 방향지시등 · L2 후진(브레이크와 겸함) · 십자 = 방향키 · Start 일시정지 · Select 시점 · L3 경광등 · R3 주행 모드
  var GP_MAP = { 0: 'GpA', 1: 'GpB', 2: 'KeyF', 3: 'KeyM', 4: 'Comma', 5: 'Period', 8: 'KeyC', 9: 'Escape', 10: 'KeyL', 11: 'KeyN', 12: 'ArrowUp', 13: 'ArrowDown', 14: 'ArrowLeft', 15: 'ArrowRight' };
  this.gp = { on: false, id: '', steer: 0, throttle: 0, brake: 0, prev: {}, held: {}, lx: 0, ly: 0, rx: 0 };
  this.onGamepad = function () {};
  addEventListener('gamepadconnected', function (e) { self.gp.on = true; self.gp.id = e.gamepad.id; self.onGamepad(true, e.gamepad.id); });
  addEventListener('gamepaddisconnected', function () { self.gp.on = false; self.gp.held = {}; self.onGamepad(false, ''); });
  function pollGamepad() {
    var g = self.gp; g.steer = 0; g.throttle = 0; g.brake = 0; g.lx = 0; g.ly = 0; g.rx = 0;
    if (!navigator.getGamepads) return;
    var pads = navigator.getGamepads(), pad = null;
    for (var i = 0; i < pads.length; i++) if (pads[i] && pads[i].connected) { pad = pads[i]; break; }
    if (!pad) { if (g.on) { g.on = false; g.held = {}; } return; }
    if (!g.on) { g.on = true; g.id = pad.id; self.onGamepad(true, pad.id); }
    function ax(i) { var v = pad.axes[i] || 0; return Math.abs(v) < 0.15 ? 0 : (v - Math.sign(v) * 0.15) / 0.85; }
    function bt(i) { var b = pad.buttons[i]; return b ? (typeof b.value === 'number' ? b.value : (b.pressed ? 1 : 0)) : 0; }
    g.lx = ax(0); g.ly = -ax(1); g.rx = ax(2);
    g.steer = -g.lx; g.throttle = Math.max(bt(7), bt(0)); g.brake = Math.max(bt(6), bt(1));
    for (var k in GP_MAP) {
      var down = bt(+k) > 0.5, code = GP_MAP[k];
      g.held[code] = down;
      if (down && !g.prev[k]) { if (code !== 'GpA' && code !== 'GpB') { self.pressed[code] = true; if (self.handlers[code]) self.handlers[code](); } }
      g.prev[k] = down;
    }
    g.held.ShiftLeft = bt(0) > 0.5;   // 보행자 모드: A/× = 달리기
  }
  this.pollGamepad = pollGamepad;

  // 보행자 모드: 이동 벡터(스틱·방향키·십자·게임패드 왼쪽 스틱). x 우측 +, y 앞 +. run: 달리기(Shift · A/×)
  this.readMove = function () {
    pollGamepad();
    var h = this.held, b = this.btn, st = this.stick, g = this.gp;
    var x = (b.right || h.ArrowRight || h.KeyD || g.held.ArrowRight ? 1 : 0) - (b.left || h.ArrowLeft || h.KeyA || g.held.ArrowLeft ? 1 : 0);
    var y = (b.gas || h.ArrowUp || h.KeyW || g.held.ArrowUp ? 1 : 0) - (b.brake || b.rev || h.ArrowDown || h.KeyS || g.held.ArrowDown ? 1 : 0);
    var run = !!(h.ShiftLeft || h.ShiftRight || g.held.ShiftLeft);
    if (x || y) { var l = Math.hypot(x, y); x = x / l * 0.75; y = y / l * 0.75; }
    if (st.active && Math.hypot(st.x, st.y) > 0.1) { x = st.x; y = st.y; }
    else if (g.on && Math.hypot(g.lx, g.ly) > 0.1) { x = g.lx; y = g.ly; }
    if (!st.active && nub) { mirrorX += (x - mirrorX) * 0.35; mirrorY += (-y - mirrorY) * 0.35; nub.style.transform = 'translate(' + (mirrorX * R * 0.8) + 'px,' + (mirrorY * R * 0.8) + 'px)'; if (base) base.classList.toggle('live', Math.abs(mirrorX) > 0.05 || Math.abs(mirrorY) > 0.05); }
    return { x: x, y: y, run: run, look: g.rx };
  };

  // 프레임마다 읽는 조작값. steer: +1 = 좌회전(물리 관례), throttle/brake/reverse 0..1
  // 키보드·버튼 입력은 화면의 원형 스틱에도 그대로 비춰 준다(PC 에서도 원판이 살아 움직인다).
  var mirrorX = 0, mirrorY = 0;
  this.read = function () {
    pollGamepad();
    var h = this.held, b = this.btn, st = this.stick, g = this.gp;
    var steer = (b.left || h.ArrowLeft || h.KeyA || g.held.ArrowLeft ? 1 : 0) - (b.right || h.ArrowRight || h.KeyD || g.held.ArrowRight ? 1 : 0);
    var throttle = (b.gas || h.ArrowUp || h.KeyW || g.held.ArrowUp) ? 1 : 0;
    var brake = (b.brake || h.ArrowDown || h.KeyS || h.Space || g.held.ArrowDown) ? 1 : 0;
    var reverse = (b.rev || h.KeyR) ? 1 : 0;
    if (g.on) { if (Math.abs(g.steer) > 0.02) steer = g.steer; throttle = Math.max(throttle, g.throttle); brake = Math.max(brake, g.brake); }
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
