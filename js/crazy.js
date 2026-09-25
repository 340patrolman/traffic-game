// 🔥 크레이지 모드(v0.10.22) — 소유자 지시 「크레이지 모드도 있으면 재미있을듯」.
//  **이것은 근무가 아니다.** 제한 시간 안에 도시의 금색 관문을 차례로 통과하는 주행 연습이다.
//  이 프로젝트의 절대 규칙은 그대로 지킨다:
//   · **사람을 치면 즉시 끝난다**(다른 모드와 같은 판정 — 여기서만 봐주지 않는다).
//   · 난폭 운전에 상을 주지 않는다 — 점수는 **관문 통과**에서만 나오고, 부순 것·스친 것에는 한 점도 없다.
//   · 신호·속도 감점은 걸지 않되(그것이 「크레이지」다) **무시한 신호를 세어 끝에 그대로 보여 준다** — 숨기지 않는다.
//  숫자는 전부 게임 설계값이다(법령·통계가 아니다).
TG.Crazy = function (game) {
  var self = this, G = game, scene = G.scene, city = G.city;
  var K = { sec: 100, add: 7, pts: 60, r: 7.5, keep: 3 };   // 시작 시간 · 관문마다 더하는 초 · 점수 · 반지름 · 동시에 보이는 관문 수
  var rings = [], t = 0, log = null, mat = null;

  function ringMesh(x, z, y) {
    if (!mat) mat = new THREE.MeshBasicMaterial({ color: 0xffc83f, transparent: true, opacity: 0.72, side: THREE.DoubleSide });
    var g = new THREE.Mesh(new THREE.TorusGeometry(K.r, 0.45, 8, 28), mat);
    g.position.set(x, y + K.r * 0.55, z);
    // ëëì êµ¬ë©ì ê¸°ë³¸ì¼ë¡ z ì¶ì í¥íë¤ â ë¨ë¶ ëë¡(v)ì ì¸ì°ë¯ë¡ ê·¸ëë¡ ëë©´ ì°¨ê° ì§ëê°ë ë¬¸ì´ ëë¤.
    //  (ëë ¤ ëíë©´ ë°ë¥ì ê¹ë ¤ ì´ì ììì ì¤ í ì¤ë¡ë§ ë³´ì¸ë¤ â ì¬ì§ì¼ë¡ ì¡ìë¤.)
    g.renderOrder = 4; scene.add(g);
    return g;
  }
  // 관문 자리 — 격자 도로 위 차로 중심(교차로 사이 한가운데). 지도가 바뀌면 자리도 따라간다.
  function spot() {
    var nx = city.nodes.length, nz = city.nodes[0].length;
    for (var tryN = 0; tryN < 30; tryN++) {
      var i = Math.floor(Math.random() * nx), j = Math.floor(Math.random() * (nz - 1));
      var a = city.nodes[i][j], b = city.nodes[i][j + 1];
      if (!a || !b) continue;
      var x = a.x + city.laneOff('v', i, 0), z = (a.z + b.z) / 2;
      var p = G.player ? G.player.pos : { x: 0, z: 0 };
      if (Math.hypot(x - p.x, z - p.z) < 60) continue;   // 눈앞에 띄우지 않는다
      return { x: x, z: z };
    }
    return null;
  }
  function addRing() {
    var s = spot(); if (!s) return;
    var y = G.terrain ? G.terrain.heightAt(s.x, s.z, 0) : 0;
    rings.push({ x: s.x, z: s.z, y: y, mesh: ringMesh(s.x, s.z, y) });
  }
  this.on = function () { return G.mode === 'crazy'; };
  this.log = function () { return log; };
  this.start = function () {
    self.clear();
    log = { gates: 0, best: 0, redRun: 0, topKmh: 0, scrapes: 0 };
    t = 0; G.timeLeft = K.sec;
    for (var i = 0; i < K.keep; i++) addRing();
    if (G.hud) {
      G.hud.notice('🔥 크레이지 — 금색 관문을 지나면 시간이 는다', 'alert', 2600);
      G.hud.hint('💭 연습 모드다 — 실제 근무가 아니다. 사람을 치면 그 자리에서 끝난다.');
    }
  };
  this.clear = function () {
    for (var i = 0; i < rings.length; i++) if (rings[i].mesh) scene.remove(rings[i].mesh);
    rings = []; log = null;
  };
  // 무시한 신호를 센다 — 감점은 없지만 기록은 남긴다(penalize 가 크레이지에서 걸리지 않으므로 main 이 여기로 알려 준다)
  this.onRedRun = function () { if (log) log.redRun++; };
  this.onScrape = function () { if (log) log.scrapes++; };

  this.update = function (dt) {
    if (!self.on() || !log || G.state !== 'play') return;
    t += dt;
    var p = G.player; if (!p) return;
    var kmh = p.speedKmh ? p.speedKmh() : 0;
    if (kmh > log.topKmh) log.topKmh = kmh;
    for (var i = rings.length - 1; i >= 0; i--) {
      var r = rings[i];
      if (Math.hypot(p.pos.x - r.x, p.pos.z - r.z) < K.r * 0.9) {
        scene.remove(r.mesh); rings.splice(i, 1);
        log.gates++; log.best = Math.max(log.best, log.gates);
        G.timeLeft += K.add;
        G.addScore(K.pts, null);
        if (G.praise) G.praise.cheer('scene', '🔥 관문 ' + log.gates + ' — +' + K.add + '초');
        if (TG.audio && TG.audio.jingle) TG.audio.jingle(2);
        G.punch = Math.max(G.punch || 0, 0.5);
        addRing();
      } else if (r.mesh) {
        r.mesh.rotation.z = t * 1.6;   // 눈에 띄게 돈다
      }
    }
    // 목표 줄 — 가장 가까운 관문까지(0.3초마다)
    self._tt = (self._tt || 0) + dt;
    if (self._tt > 0.3 && G.hud) {
      self._tt = 0;
      var n = self.nearest();
      if (n) G.hud.setTarget('🔥 관문 ' + Math.round(n.d) + 'm · 통과 ' + log.gates + '개 · 지나면 +' + K.add + '초');
    }
  };
  // 남은 관문 방향(가장 가까운 것) — HUD 목표 줄에 쓴다
  this.nearest = function () {
    var p = G.player; if (!p || !rings.length) return null;
    var best = null, bd = 1e9;
    for (var i = 0; i < rings.length; i++) {
      var d = Math.hypot(p.pos.x - rings[i].x, p.pos.z - rings[i].z);
      if (d < bd) { bd = d; best = rings[i]; }
    }
    return best ? { x: best.x, z: best.z, d: bd } : null;
  };
};
