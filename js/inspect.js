// 🔍 확대 보기(v0.10.20) — 소유자 지시: 「단속 행위자 화살표를 보고 해당 차량이나 사람을 터치하면
//  화면이 확대되면서 잘 보고 판단할 수 있도록 해보자.」
//  터치 → **그 대상으로 화면이 당겨지고**(망원 화각) 잠깐 느려진다 → 무엇이 보이는지 읽고 → 「🚨 단속」 또는 「닫기」.
//  판정·점수는 종전 그대로다. 여기서 하는 일은 **보여 주고 시간을 주는 것**뿐이다(연출 층).
//  · 교실(영아·어린이·청소년)에서는 쓰지 않는다 — 아이들 화면은 그대로 둔다.
//  · 세상은 멈추지 않는다(느려질 뿐) — 멈추면 뒤차가 오는 상황을 못 배운다.
TG.Inspect = function (game) {
  var self = this, G = game;
  var sel = null, t = 0, MAX = 6.0;
  function EL(id) { return document.getElementById(id); }
  function quiet() {
    var m = G.mode;
    return m === 'tot' || m === 'kid' || m === 'bike';
  }
  function ent(s) { return !s ? null : (s.kind === 'car' ? s.car : s.ped); }
  // 📸 위반마다 **보여 줄 장면**(v0.10.51 · 소유자 「안전띠 미착용이면 미착용 장면이 나와야 하고 다른 위반 사항도 보여져야 해」).
  //  [카메라 자리, 보이는 것 한 줄]. 자리: window = 운전석 창 가까이(안전띠·휴대전화·동물·선팅) · front = 앞에서(밤 무등화) ·
  //  side = 옆에서(과속·개문) · sideFar = 옆 멀리(안전거리 — 앞차까지) · rearHigh = 뒤 위에서(중앙선·신호·차로·비틀거림) · sideNear = 옆 가까이(두 바퀴)
  var SHOTS = {
    seatbelt: ['window', '운전자 어깨에 안전띠가 없다 — 맨 운전자는 창 너머로 띠가 비스듬히 보인다'],
    phone: ['window', '달리면서 휴대전화를 손에 들고 보고 있다'],
    animal: ['window', '동물을 안고 운전한다'],
    tint: ['window', '창이 짙어 운전자가 보이지 않는다'],
    drunk: ['rearHigh', '차로 안에서 좌우로 비틀거린다'],
    nolight: ['front', '밤인데 전조등·미등이 꺼져 있다'],
    speeding: ['side', null], distance: ['sideFar', null],
    centerline: ['rearHigh', '황색 중앙선을 넘어 달린다'],
    passenger: ['side', '문을 연 채 달린다'], cargo: ['rearHigh', '짐칸에서 짐이 떨어진다'], litter: ['side', '창밖으로 꽁초를 던졌다'],
    pm: ['sideNear', '킥보드가 보도를 달린다'], pmHelmet: ['sideNear', '킥보드 운전자가 안전모를 쓰지 않았다'], pmTwo: ['sideNear', '킥보드에 두 사람이 탔다'],
    motorcycle: ['sideNear', '이륜차가 보도를 달린다'], bicycle: ['sideNear', '자전거가 보도를 타고 달린다'], bikeCross: ['sideNear', '횡단보도를 타고 건넌다'],
    sidewalk: ['side', '차가 보도로 올라가 달린다'], signal: ['rearHigh', '적색 신호에 정지선을 넘었다'], pedestrian: ['rearHigh', '횡단보도의 사람 앞에서 서지 않았다'],
    buslane: ['rearHigh', '버스전용차로를 달린다'], lane: ['rearHigh', '지정차로가 아닌 왼쪽 차로를 달린다'], nosignal: ['rearHigh', '방향지시등 없이 차로를 바꿨다'],
    overtake: ['rearHigh', '오른쪽으로 앞지르기를 했다'], gridlock: ['rearHigh', '막힌 교차로에 들어가 섰다'], railroad: ['rearHigh', '차단기가 내려온 건널목을 지났다'],
    buslaneC: ['rearHigh', '중앙버스전용차로(청색 실선 안쪽 1차로)를 버스가 아닌 차가 달린다'],
    uturn: ['rearHigh', '다른 차가 오가는 교차로에서 차 사이로 유턴했다'], parking: ['side', null]
  };
  function typeOf(e) { return G.enforcement && G.enforcement.suspectOf ? G.enforcement.suspectOf(e) : (e.violation && e.violation.type); }
  function lineOf(e, ty) {
    var sh = SHOTS[ty]; if (!sh) return null;
    if (ty === 'speeding') { var v = e.violation && e.violation.kmh ? e.violation : e._evSpd; return v ? '측정 ' + v.kmh + 'km/h · 제한 ' + v.limit + ' — ' + (v.kmh - v.limit) + 'km/h 넘게 달린다' : '제한속도보다 훨씬 빠르게 달린다'; }
    if (ty === 'parking') return '운전자 없이 서 있다 — 횡단보도까지 ' + (e.parkCw > 0 ? e.parkCw.toFixed(1) + 'm' : '걸쳐') + ' (10m 안 정차·주차 금지)';
    if (ty === 'distance') return (e.tgGap ? '앞차와 ' + e.tgGap.toFixed(1) + 'm · ' + Math.round(e.v * 3.6) + 'km/h — ' : '') + '멈출 거리 없이 바짝 붙어 달린다';
    return sh[1];
  }
  this.evidence = function (e) { var ty = e && typeOf(e); return ty ? { type: ty, shot: (SHOTS[ty] || [null])[0], line: lineOf(e, ty) } : null; };
  var silent = false, hidGlass = null;
  function restoreGlass() { if (hidGlass && hidGlass.glassMesh) hidGlass.glassMesh.visible = true; hidGlass = null; xrayOff(); }
  // 🩻 증거 확대(v0.10.51): 그 차 하나의 차체만 반투명(운전자·휴대전화·동물·바퀴는 그대로) — 재질은 그 메시에만 복제해 끼우고 끝나면 돌려놓는다
  var xray = null, xrayKeep = [];
  function xrayOn(e) {
    xrayOff(); if (!e || !e.mesh) return; xray = e;
    var keep = [e.driverMesh, e.phoneMesh, e.mountMesh, e.animalMesh, e.marker, e.shadowMesh];
    e.mesh.children.forEach(function (m) {
      if (!m.isMesh || !m.material || keep.indexOf(m) >= 0 || m === e.glassMesh) return;
      var c = m.material.clone(); c.transparent = true; c.opacity = 0.2; c.depthWrite = false;
      xrayKeep.push([m, m.material]); m.material = c;
    });
  }
  function xrayOff() { xrayKeep.forEach(function (p) { if (p[0].material && p[0].material.dispose) p[0].material.dispose(); p[0].material = p[1]; }); xrayKeep = []; xray = null; }
  // 객관식이 떠 있는 동안 뒤 화면을 **그 위반 장면**으로(멈춘 그림) — 카드는 띄우지 않는다(enforcement.quiz 에서)
  this.show = function (s) {
    if (!s || quiet() || s.kind !== 'car') return false;
    var e = ent(s); if (!e || !e.pos) return false;
    sel = s; t = MAX; silent = true; document.body.classList.add('quizshot'); return true;
  };

  this.on = function () { return !!sel; };
  this.target = function () { return sel; };

  this.open = function (s, label) {
    if (!s || quiet() || G.state !== 'play') return false;
    var e = ent(s); if (!e || !e.pos) return false;
    sel = s; t = MAX;
    var card = EL('inspectCard'); if (!card) return false;
    var nm = card.querySelector('.ip-name'), vi = card.querySelector('.ip-vio'), hi = card.querySelector('.ip-hint');
    if (nm) nm.textContent = label || '대상';
    var vname = null, ev = s.kind === 'car' ? self.evidence(e) : null; silent = false;
    if (ev && G.enforcement && G.enforcement.nameOf) vname = G.enforcement.nameOf(ev.type) + (ev.line ? ' — ' + ev.line : '');
    else if (s.kind === 'ped' && (e.jayLive || e.jayDone)) vname = e.jayKind === 'red' ? '신호위반 보행 의심' : '무단횡단 의심';
    if (vi) { vi.textContent = vname ? '⚠ ' + vname : '표시된 위반 없음 — 더 보고 판단한다'; vi.className = 'ip-vio' + (vname ? ' bad' : ''); }
    if (hi) hi.textContent = vname ? '눈으로 확인하고 단속한다 — 보기에서 위반을 고르면 고지가 시작된다' : '위반이 안 보이면 보내 주는 것도 판단이다';
    card.className = 'on';
    document.body.classList.add('inspecting');
    G.slowmo = Math.max(G.slowmo || 0, 0.35);   // 판단할 틈 — 멈추지는 않는다
    TG.audio.ui();
    return true;
  };
  this.close = function () {
    sel = null; t = 0; silent = false; restoreGlass(); document.body.classList.remove('quizshot');
    var card = EL('inspectCard'); if (card) card.className = '';
    document.body.classList.remove('inspecting');
  };
  // 매 프레임: 대상이 사라지거나 멀어지거나 시간이 다 되면 닫는다
  this.update = function (dt) {
    if (!sel) return;
    var e = ent(sel);
    var alive = sel.kind === 'car' ? (G.traffic && G.traffic.cars.indexOf(e) >= 0) : (G.peds && G.peds.peds.indexOf(e) >= 0);
    var me = G.actor ? G.actor() : G.player;
    if (!alive || !me || Math.hypot(e.pos.x - me.pos.x, e.pos.z - me.pos.z) > 95) { self.close(); return; }
    t -= dt;
    if (t <= 0) self.close();
    else if (G.slowmo < 0.2) G.slowmo = 0.3;   // 느림이 풀리지 않게 조금씩 이어 준다
  };
  // 카메라를 가져간다(camFx 첫머리에서 부른다) — 대상 쪽으로 당기고 화각을 좁힌다(망원)
  this.apply = function (camera) {
    if (!sel || !camera) return false;
    var e = ent(sel); if (!e || !e.pos) return false;
    var me = G.actor ? G.actor() : G.player; if (!me) return false;
    var ty = (sel.kind === 'car' ? (e.y || 0) + 0.9 : (e.y || 0) + 1.0);
    // 📸 위반 장면(v0.10.51) — 그 위반이 **보이는 자리**로 카메라를 옮긴다. 좌표: 앞 f=(sin h, cos h) · 오른쪽 r=(−fz, fx) · 차 로컬 +x = 왼쪽(운전석)
    var ev = sel.kind === 'car' ? self.evidence(e) : null;
    if (ev && ev.shot) {
      var h = e.heading || 0, fx = Math.sin(h), fz = Math.cos(h), rx = -fz, rz = fx, lx = fz, lz = -fx, y0 = e.y || 0, cp, lk, fv = 40;
      if (ev.shot === 'window') {
        var LO = (TG.vehmesh && TG.vehmesh.layout && TG.vehmesh.TYPES[e.type]) ? TG.vehmesh.layout(TG.vehmesh.TYPES[e.type]).eye : { x: 0.37, y: 1.2, z: 0.2 };
        var ex = e.pos.x + lx * LO.x + fx * LO.z, ez = e.pos.z + lz * LO.x + fz * LO.z, ey = y0 + LO.y;
        // 머리·가슴이 화면 위쪽 반에 오게 조금 아래를 본다(아래쪽은 객관식 판이 쓴다) · 창 유리는 잠깐 걷는다(짙은 유리 너머로 띠가 안 보였다 — 선팅은 그 짙음이 곧 증거라 둔다)
        cp = [ex + lx * 1.6 + fx * 0.9, y0 + 1.5, ez + lz * 1.6 + fz * 0.9]; lk = [ex, ey - 0.32, ez]; fv = 40;   // 창 앞쪽 옆 눈높이에서 가슴 앞을 비스듬히 — 띠는 가슴 앞면에 있다
        if (ev.type !== 'tint' && e.glassMesh && e.glassMesh.visible) { e.glassMesh.visible = false; hidGlass = e; }
        if (ev.type !== 'tint' && xray !== e) xrayOn(e);   // 🩻 차체를 잠깐 비치게 — 문턱·지붕·기둥이 가슴(띠)·손(휴대전화)을 가렸다(실측 세 자리 모두)
      } else if (ev.shot === 'front') { cp = [e.pos.x + fx * 13 + rx * 2.2, y0 + 1.5, e.pos.z + fz * 13 + rz * 2.2]; lk = [e.pos.x, y0 + 0.8, e.pos.z]; fv = 38; }
      else if (ev.shot === 'side') { cp = [e.pos.x + rx * 6.5 - fx * 1.5, y0 + 1.9, e.pos.z + rz * 6.5 - fz * 1.5]; lk = [e.pos.x, y0 + 0.9, e.pos.z]; fv = 44; }
      else if (ev.shot === 'sideFar') { cp = [e.pos.x + rx * 11 + fx * 4, y0 + 3.4, e.pos.z + rz * 11 + fz * 4]; lk = [e.pos.x + fx * 4.5, y0 + 0.9, e.pos.z + fz * 4.5]; fv = 50; }
      else if (ev.shot === 'sideNear') { cp = [e.pos.x + rx * 3.4 + fx * 0.8, y0 + 1.45, e.pos.z + rz * 3.4 + fz * 0.8]; lk = [e.pos.x, y0 + 1.0, e.pos.z]; fv = 46; }
      else { cp = [e.pos.x - fx * 10, y0 + 6.2, e.pos.z - fz * 10]; lk = [e.pos.x + fx * 6, y0 + 0.5, e.pos.z + fz * 6]; fv = 52; }
      camera.position.set(cp[0], cp[1], cp[2]); camera.lookAt(lk[0], lk[1], lk[2]);
      if (Math.abs(camera.fov - fv) > 0.05) { camera.fov = fv; camera.updateProjectionMatrix(); }
      self.lastShot = ev.shot;
      return true;
    }
    self.lastShot = 'me';
    var dx = e.pos.x - me.pos.x, dz = e.pos.z - me.pos.z, d = Math.hypot(dx, dz) || 1;
    var ux = dx / d, uz = dz / d;
    // 대상 뒤가 아니라 **내 쪽에서** 본다 — 실제로 내가 보는 그림이어야 판단이 된다
    var back = TG.clamp(d * 0.35, 4, 12), side = 1.6;
    camera.position.set(e.pos.x - ux * back - uz * side, ty + 1.9, e.pos.z - uz * back + ux * side);
    camera.lookAt(e.pos.x, ty, e.pos.z);
    var fov = 30;
    if (Math.abs(camera.fov - fov) > 0.05) { camera.fov = fov; camera.updateProjectionMatrix(); }
    return true;
  };
};
