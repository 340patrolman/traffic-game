// 👻 서킷 고스트(v0.10.139) — 최고 랩을 반투명 순찰차로 다시 달린다. 연습 서킷·자유 주행(랩 타임을 재는 두 모드)에서만.
// 랩 동안 0.2초마다 자리(x·y·z·방향)를 적고, 그 랩이 최고 기록이면(또는 아직 고스트가 없으면) 이 기기에 남긴다(tg_ghost_<모드>).
// 다음 랩이 시작되면 같은 랩 시각의 자리에 고스트를 놓는다 — 부딪히지 않고(충돌 없음) 그림자도 없다. 서버·통신 0.
(function () {
  'use strict';
  var TG = window.TG = window.TG || {};
  var DT = 0.2, MAXN = 6000;   // 0.2초 × 6000 = 20분 — 그보다 긴 랩은 적지 않는다(저장 크기)
  TG.Ghost = function (scene) {
    var self = this, rec = null, best = null, name = null, mesh = null, lastT = -1;
    function key(n) { return 'ghost_' + n; }
    function r2(v) { return Math.round(v * 100) / 100; }
    function ensureMesh() {
      if (mesh || !TG.vehmesh) return mesh;
      var geo = TG.vehmesh.build('police', 0xf6f7f9, false);
      mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x7fd3ff, transparent: true, opacity: 0.34, depthWrite: false }));
      mesh.rotation.order = 'YXZ'; mesh.renderOrder = 4; mesh.visible = false; mesh.castShadow = false; mesh.name = 'ghost';
      scene.add(mesh); return mesh;
    }
    // 모드가 바뀌면 그 모드의 고스트를 읽는다(없으면 null) — n 이 null 이면 끈다
    self.load = function (n) {
      name = n || null; rec = null; lastT = -1; best = null;
      if (name) { var g = TG.save.get(key(name), null); if (g && g.p && g.p.length >= 8 && isFinite(g.t)) best = g; }
      if (mesh) mesh.visible = false;
      return !!best;
    };
    self.has = function () { return !!best; };
    self.mode = function () { return name; };
    self.best = function () { return best; };
    // 새 랩 시작 — 적기를 처음부터
    self.begin = function () { if (!name) return; rec = { p: [] }; lastT = -1; };
    // 랩 시각 t 에 자리를 적는다(0.2초마다 하나)
    self.rec = function (t, pl) {
      if (!rec || !pl || !pl.mesh) return;
      var k = Math.floor(t / DT); if (k <= lastT || rec.p.length / 4 >= MAXN) return; lastT = k;
      var m = pl.mesh.position; if (!isFinite(m.x) || !isFinite(m.z)) return;
      rec.p.push(r2(m.x), r2(m.y), r2(m.z), Math.round(pl.heading * 1000) / 1000);
    };
    // 랩 끝 — 최고 기록이거나 아직 고스트가 없으면 이번 랩을 고스트로 남긴다
    self.finish = function (lapT, isBest) {
      var r = rec; rec = null;
      if (!name || !r || r.p.length < 8 || !isFinite(lapT)) return false;
      if (!(isBest || !best || lapT < best.t)) return false;
      best = { t: Math.round(lapT * 100) / 100, dt: DT, p: r.p, at: Date.now() };
      try { TG.save.set(key(name), best); } catch (e) { }
      return true;
    };
    // 랩 시각 t 의 고스트 자리(앞뒤 두 점 사이를 잇는다) — 없으면 null
    self.at = function (t) {
      if (!best || !(t >= 0)) return null;
      var p = best.p, n = p.length / 4, f = t / (best.dt || DT), i = Math.floor(f);
      if (i >= n - 1) return null;   // 고스트 랩이 끝났다(더 빠른 랩이었다)
      var a = i * 4, b = a + 4, u = f - i, dh = p[b + 3] - p[a + 3];
      while (dh > Math.PI) dh -= 2 * Math.PI; while (dh < -Math.PI) dh += 2 * Math.PI;
      return { x: p[a] + (p[b] - p[a]) * u, y: p[a + 1] + (p[b + 1] - p[a + 1]) * u, z: p[a + 2] + (p[b + 2] - p[a + 2]) * u, h: p[a + 3] + dh * u };
    };
    // 매 프레임 — 랩이 돌고 있으면 그 시각 자리에 고스트를 둔다
    self.play = function (t) {
      var q = (t == null || !best) ? null : self.at(t);
      if (!q) { if (mesh) mesh.visible = false; return null; }
      ensureMesh(); if (!mesh) return null;
      mesh.position.set(q.x, q.y, q.z); mesh.rotation.set(0, q.h, 0); mesh.visible = true;
      return q;
    };
    self.clear = function () { if (name) { try { TG.save.set(key(name), null); } catch (e) { } } best = null; if (mesh) mesh.visible = false; };
    self.visible = function () { return !!(mesh && mesh.visible); };
  };
})();
