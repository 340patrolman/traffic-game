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

  this.on = function () { return !!sel; };
  this.target = function () { return sel; };

  this.open = function (s, label) {
    if (!s || quiet() || G.state !== 'play') return false;
    var e = ent(s); if (!e || !e.pos) return false;
    sel = s; t = MAX;
    var card = EL('inspectCard'); if (!card) return false;
    var nm = card.querySelector('.ip-name'), vi = card.querySelector('.ip-vio'), hi = card.querySelector('.ip-hint');
    if (nm) nm.textContent = label || '대상';
    var vname = null;
    if (s.kind === 'car' && e.violation && G.enforcement && G.enforcement.nameOf) vname = G.enforcement.nameOf(e.violation.type);
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
    sel = null; t = 0;
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
