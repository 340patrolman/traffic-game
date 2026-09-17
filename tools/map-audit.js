// 전체 지도 일괄 점검(시설물 · 방호벽 · 시작 자리) — 2026-09-17 소유자 지시
//  1) 좌표계 일치: 데이터(링크 점·격자·시설물 기록)와 **그려진 메시**가 같은 자리인가(위에서 쏜 레이)
//  2) 시설물(기둥·표지·가로수·교각…)이 **차도 안**에 서 있는가 → 구간별 위반 목록
//  3) 방호벽·중앙분리대가 **다른 도로의 차도**를 가로지르는가
//  4) 시작 자리(모드·체험 장면·관문)가 위반 판정 영역(충돌·역방향·도로 밖) 밖인가 + 3초 동안 가만히 두면 점수가 그대로인가
// 쓰는 법: index.html 끝에 이 파일을 붙인 사본을 ?test=1(&map=…) 로 연다. 결과는 #AOUT · 콘솔 [AUDIT] · 제목 AUDIT-DONE.
(function () {
  var OUT = [];
  function out(s) { OUT.push(s); try { console.log('[AUDIT] ' + s); } catch (e) {} }
  function done() {
    var pre = document.createElement('pre'); pre.id = 'AOUT'; pre.textContent = OUT.join('\n');
    document.body.appendChild(pre); document.title = 'AUDIT-DONE';
  }
  function ready() { return window.TG && TG.test && TG.test.game && TG.test.game.city && TG.test.terrain && TG.test.game.player !== undefined; }
  var tries = 0;
  (function wait() { if (ready()) { try { run(); } catch (e) { out('ERROR ' + e.message + ' ' + (e.stack || '').split('\n')[1]); } done(); return; } if (++tries > 400) { out('ERROR not ready'); done(); return; } setTimeout(wait, 50); })();

  function run() {
    var T = TG.test, G = T.game, city = T.city, terrain = T.terrain, C = TG.CONFIG || {};
    var xs = city.xs, zs = city.zs, EXT = city.EXT;
    out('지도 = ' + (city.mapId || '?') + ' · 격자 ' + xs.length + 'x' + zs.length + ' · EXT ' + EXT.toFixed(1));

    // ---------------- 1) 좌표계 ----------------
    var ray = new THREE.Raycaster(), down = new THREE.Vector3(0, -1, 0);
    var roadMats = (TG.mats && TG.mats.road) || [];
    var meshes = [];
    function collect() { meshes = []; G.scene.traverse(function (o) { if (o.isMesh && o.visible) meshes.push(o); }); }
    try { collect(); } catch (e) { meshes = []; }
    function isRoad(o) { var m = o.material; if (Array.isArray(m)) m = m[0]; return roadMats.indexOf(m) >= 0 || (m && m.map && roadMats.some(function (r) { return r.map === m.map; })); }
    var lk = terrain.links || [], samp = 0, hitRoad = 0, yOff = 0, worst = 0, worstAt = '';
    lk.forEach(function (L) {
      if (L.kind === 'circuit') return;
      for (var i = 2; i < L.N - 2; i += 6) {
        var p = L.P(i); samp++;
        ray.set(new THREE.Vector3(p.x, p.y + 30, p.z), down);
        var hs = meshes.length ? ray.intersectObjects(meshes, false) : [];
        var h = null; for (var k = 0; k < hs.length; k++) if (Math.abs(hs[k].point.y - p.y) < 0.25 || (isRoad(hs[k].object) && Math.abs(hs[k].point.y - p.y) < 1.2)) { h = hs[k]; break; }
        if (h) { hitRoad++; var dy = Math.abs(h.point.y - p.y); if (dy > worst) { worst = dy; worstAt = (L.name || L.kind) + ' #' + i; } if (dy > 0.15) yOff++; }
      }
    });
    var gs = 0, gh = 0;
    for (var gi = 0; gi < xs.length; gi++) for (var gz = zs[0] + 10; gz < zs[zs.length - 1]; gz += 25) {
      gs++; ray.set(new THREE.Vector3(xs[gi] + 1.5, 30, gz), down);
      var gh2 = meshes.length ? ray.intersectObjects(meshes, false) : [];
      for (var k2 = 0; k2 < gh2.length; k2++) if (isRoad(gh2[k2].object)) { gh++; break; }
    }
    // 시설물 기록 ↔ 그려진 기둥: 기둥 꼭대기 바로 아래에서 옆으로 쏘아 기둥에 맞는지(좌표가 어긋나면 허공을 지난다)
    var FAC = (TG.FAC || []).slice(), fs = 0, fh = 0, fmiss = [];
    FAC.forEach(function (F, n) {
      if (n % 7 !== 0 || F.kind === 'shelter' || F.kind === 'subway' || F.kind === 'pier' || F.kind === 'bin') return;
      fs++;
      var yy = (F.y0 != null ? F.y0 : 0) + 0.9;
      ray.set(new THREE.Vector3(F.x - 3, yy, F.z), new THREE.Vector3(1, 0, 0)); ray.far = 6;
      var hh = meshes.length ? ray.intersectObjects(meshes, false) : [];
      var ok = hh.some(function (q) { return Math.abs(q.point.x - (F.x - F.r)) < 0.35 && Math.abs(q.point.z - F.z) < 0.35; });
      if (ok) fh++; else if (fmiss.length < 6) fmiss.push(F.kind + '(' + F.x.toFixed(1) + ',' + F.z.toFixed(1) + ')');
    });
    ray.far = Infinity;
    out('① 좌표계 — 메시 ' + meshes.length + ' · 링크 중심 ' + samp + '점 중 노면 맞음 ' + hitRoad + ' · 높이 어긋남(>0.15m) ' + yOff + ' · 최대 ' + worst.toFixed(3) + 'm ' + worstAt +
        ' · 격자 ' + gs + '점 중 노면 ' + gh + ' · 시설물 기둥 ' + fs + '개 중 그림과 일치 ' + fh + (fmiss.length ? ' · 빗나감 ' + fmiss.join(' ') : ''));
    out('① 방향 규약 — DIR_VEC ' + JSON.stringify(TG.DIR_VEC) + ' · 링크 우측 = (-tz, tx) ' + (function () { var p = lk[0].P(5); return Math.abs(p.rx + p.tz) < 1e-6 && Math.abs(p.rz - p.tx) < 1e-6; })() +
        ' · frameAt 격자 판정 상자 = 격자 범위 ' + (function () { var x0 = xs[0] - EXT, x1 = xs[xs.length - 1] + EXT, z0 = zs[0] - EXT, z1 = zs[zs.length - 1] + EXT; return '[' + x0.toFixed(0) + '~' + x1.toFixed(0) + ' × ' + z0.toFixed(0) + '~' + z1.toFixed(0) + ']'; })());

    // 도로 모양: 20m 앞뒤 접선이 거꾸로(머리핀)이거나 반경 12m 미만인 곳 — 경유점이 지도와 어긋나면 여기서 드러난다
    var bends = [];
    lk.forEach(function (L) {
      if (L.kind === 'circuit') return;
      var minR = 1e9, rev = 0;
      for (var i = 0; i + 5 < L.N; i++) {
        var a = L.pts[i], b = L.pts[i + 5];
        if (a.tx * b.tx + a.tz * b.tz < 0) rev++;
        var ang = Math.acos(TG.clamp(a.tx * b.tx + a.tz * b.tz, -1, 1)), ds = Math.abs(b.s - a.s) || 1;
        if (ang > 1e-3) minR = Math.min(minR, ds / ang);
      }
      if (rev || minR < 12) bends.push((L.name || L.kind + '#' + L.id) + ' 역방향 ' + rev + ' · 최소 반경 ' + minR.toFixed(1) + 'm');
    });
    out('① 도로 모양 — 링크 ' + lk.length + '개 중 머리핀·급커브 ' + bends.length + (bends.length ? ' · ' + bends.join(' / ') : ''));

    // ---------------- 2) 차도 판정 ----------------
    var gridLo = { x0: xs[0] - EXT, x1: xs[xs.length - 1] + EXT, z0: zs[0] - EXT, z1: zs[zs.length - 1] + EXT };
    function gridHit(x, z, r, em) { em = em || 0.05;   // 격자 차도(연석~연석)에 원이 들어오는가
      var res = null;
      for (var i = 0; i < xs.length; i++) { var d = Math.abs(x - xs[i]) - r; if (d < city.halfV[i] - em && z > gridLo.z0 && z < gridLo.z1) { res = { sec: '격자 · ' + ((city.roadNamesV || [])[i] || ('남북' + i)), pen: city.halfV[i] - d }; break; } }
      if (!res) for (var j = 0; j < zs.length; j++) { var d2 = Math.abs(z - zs[j]) - r; if (d2 < city.halfH[j] - em && x > gridLo.x0 && x < gridLo.x1) { res = { sec: '격자 · ' + ((city.roadNamesH || [])[j] || ('동서' + j)), pen: city.halfH[j] - d2 }; break; } }
      return res;
    }
    // 링크 격자(빠른 찾기)
    var CELL = 20, cell = {};
    lk.forEach(function (L) { for (var i = 0; i < L.N - 1; i++) { var a = L.pts[i]; var key = Math.floor(a.x / CELL) + ',' + Math.floor(a.z / CELL); (cell[key] = cell[key] || []).push({ L: L, i: i }); } });
    function secName(L) { return L.name || (L === terrain.ring ? '순환고속도로' : L.kind + '#' + L.id); }
    function linkHits(x, z, r, y0, y1, skipId) {   // 링크 차도에 원이 들어오는가(세로 범위도 겹쳐야)
      var cx = Math.floor(x / CELL), cz = Math.floor(z / CELL), seen = {}, hits = [];
      for (var ox = -2; ox <= 2; ox++) for (var oz = -2; oz <= 2; oz++) {
        var list = cell[(cx + ox) + ',' + (cz + oz)]; if (!list) continue;
        for (var m = 0; m < list.length; m++) {
          var L = list[m].L, i = list[m].i; if (L.id === skipId || L.kind === 'circuit') continue;
          var a = L.pts[i], b = L.pts[i + 1], vx = b.x - a.x, vz = b.z - a.z, l2 = vx * vx + vz * vz; if (l2 < 1e-6) continue;
          var t = ((x - a.x) * vx + (z - a.z) * vz) / l2; if (t < -0.02 || t > 1.02) continue;
          var tc = TG.clamp(t, 0, 1), px = a.x + vx * tc, pz = a.z + vz * tc, d = Math.hypot(x - px, z - pz);
          var half = a.half + (b.half - a.half) * tc, ry = a.y + (b.y - a.y) * tc;
          var edge = half - 0.6;                                  // 방호벽(half-0.4) 안쪽이 차도
          if (d - r >= edge) continue;
          if (a.med && d + r < 0.55) continue;                    // 중앙분리대 위(분리대가 실제로 서 있는 점)
          if (!(y0 < ry + 4.0 && y1 > ry + 0.3)) continue;        // 세로로 차가 지나는 높이와 겹치지 않으면 무관(고가 밑 교각 등)
          var k = L.id; if (seen[k]) continue; seen[k] = 1;
          hits.push({ sec: secName(L), pen: edge - (d - r), L: L, i: i, lat: d, half: half });
        }
      }
      return hits;
    }

    var bySec = {}, list = [], nF = 0;
    function add(sec, s) { bySec[sec] = (bySec[sec] || 0) + 1; list.push(sec + ' | ' + s); }
    var cams = (G.facil && G.facil.poles) || [];
    FAC.concat(cams).forEach(function (F) {
      nF++;
      var y0 = F.y0 != null ? F.y0 : 0, y1 = F.y1 != null ? F.y1 : 3;
      var gH = (y0 < 4 && y1 > 0.3) ? gridHit(F.x, F.z, F.r) : null;
      if (gH) add(gH.sec, F.kind + ' (' + F.x.toFixed(1) + ',' + F.z.toFixed(1) + ') r' + F.r + ' 침범 ' + gH.pen.toFixed(2) + 'm' + (F.meta ? ' ' + JSON.stringify(F.meta) : ''));
      var own = F.meta && F.meta.link != null && F.kind === 'pier' ? F.meta.link : -1;
      linkHits(F.x, F.z, F.r, y0, y1, own).forEach(function (h) {
        if (gH && city.onRoad(F.x, F.z)) return;                 // 격자와 겹친 스텁 구간은 격자 쪽에서 이미 셌다
        add(h.sec, F.kind + ' (' + F.x.toFixed(1) + ',' + F.z.toFixed(1) + ') r' + F.r + ' 가로 ' + h.lat.toFixed(2) + '/' + h.half.toFixed(1) + ' 침범 ' + h.pen.toFixed(2) + 'm #' + h.i + (F.meta ? ' ' + JSON.stringify(F.meta) : ''));
      });
    });
    out('② 시설물 ' + nF + '개(카메라 지주 ' + cams.length + ') — 차도 안 ' + list.length + '건');

    // ---------------- 3) 방호벽 ----------------
    var wl = terrain.walls || [], wsamp = 0, wlist = [], wsec = {};
    wl.forEach(function (W, wi) {
      if (W.lk == null) return;
      var len = Math.hypot(W.x2 - W.x1, W.z2 - W.z1), n = Math.max(1, Math.ceil(len / 1.0));
      var hitSec = null, pen = 0, at = null;
      for (var s = 0; s <= n; s++) {
        var x = W.x1 + (W.x2 - W.x1) * s / n, z = W.z1 + (W.z2 - W.z1) * s / n; wsamp++;
        var gh3 = gridHit(x, z, 0.15, 0.6);
        var hs = linkHits(x, z, 0.15, (W.y || 0), (W.y || 0) + 1.0, W.lk);
        var h3 = gh3 || hs[0];
        if (h3 && h3.pen > pen) { pen = h3.pen; hitSec = h3.sec; at = [x, z]; }
      }
      if (hitSec && pen > 0.3) { wsec[hitSec] = (wsec[hitSec] || 0) + 1; if (wlist.length < 400) wlist.push(hitSec + ' | 벽(' + W.kind + ' · 링크 ' + W.lk + ') (' + at[0].toFixed(1) + ',' + at[1].toFixed(1) + ') 침범 ' + pen.toFixed(2) + 'm'); }
    });
    out('③ 방호벽 ' + wl.filter(function (w) { return w.lk != null; }).length + '개(' + wsamp + '점) — 다른 차도 안 ' + wlist.length + '건');

    // 구간별 집계
    var secs = {}; Object.keys(bySec).forEach(function (k) { secs[k] = (secs[k] || { f: 0, w: 0 }); secs[k].f = bySec[k]; });
    Object.keys(wsec).forEach(function (k) { secs[k] = (secs[k] || { f: 0, w: 0 }); secs[k].w = wsec[k]; });
    var ks = Object.keys(secs).sort(function (a, b) { return (secs[b].f + secs[b].w) - (secs[a].f + secs[a].w); });
    out('— 구간별(시설물 / 방호벽) —');
    ks.forEach(function (k) { out('  ' + k + ' : ' + secs[k].f + ' / ' + secs[k].w); });
    out('— 시설물 위반 목록 —'); list.slice(0, 200).forEach(function (s) { out('  ' + s); });
    out('— 방호벽 위반 목록 —'); wlist.slice(0, 120).forEach(function (s) { out('  ' + s); });

    // ---------------- 4) 시작 자리 ----------------
    var FACALL = FAC.concat(cams);
    function footprint(x, z, h, len, wid) {   // 차체 사각형이 벽·시설물에 닿는가
      var fx = Math.sin(h), fz = Math.cos(h), rx = -fz, rz = fx, bad = [];
      var allW = city.walls || [];
      for (var w = 0; w < allW.length; w++) {
        var W = allW[w];
        if (Math.min(W.x1, W.x2) > x + len || Math.max(W.x1, W.x2) < x - len || Math.min(W.z1, W.z2) > z + len || Math.max(W.z1, W.z2) < z - len) continue;
        for (var s = 0; s <= 10; s++) {
          var px = W.x1 + (W.x2 - W.x1) * s / 10 - x, pz = W.z1 + (W.z2 - W.z1) * s / 10 - z;
          var al = px * fx + pz * fz, la = px * rx + pz * rz;
          if (Math.abs(al) < len / 2 + 0.2 && Math.abs(la) < wid / 2 + 0.2) { bad.push('벽(' + (W.kind || (W.stub ? 'stub' : 'city')) + ')'); break; }
        }
      }
      FACALL.forEach(function (F) {
        var px = F.x - x, pz = F.z - z; if (Math.abs(px) > len || Math.abs(pz) > len) return;
        var al = px * fx + pz * fz, la = px * rx + pz * rz;
        if (Math.abs(al) < len / 2 + F.r && Math.abs(la) < wid / 2 + F.r) bad.push(F.kind);
      });
      return bad;
    }
    var spawnBad = 0, spawnN = 0;
    function checkCar(label) {
      var P = G.player; if (!P || G.afoot) return;
      spawnN++;
      var x = P.pos.x, z = P.pos.z, h = P.heading, fr = city.frameAt(x, z, h), prob = [];
      if (!city.onRoadAny(x, z)) prob.push('도로 밖');
      if (fr.kind !== 'off' && fr.lateral < 0.3 && !(fr.oneWay)) prob.push('역방향(가로 ' + fr.lateral.toFixed(2) + ')');
      var fb = footprint(x, z, h, P.len, P.wid); if (fb.length) prob.push('충돌 ' + fb.join(','));
      var near = (T.traffic.cars || []).filter(function (c) { return Math.hypot(c.pos.x - x, c.pos.z - z) < (P.len + c.len) / 2; });
      if (near.length) prob.push('차와 겹침 ' + near.length);
      var s0 = G.score;
      T.step(3);
      var ds = G.score - s0;
      if (ds < 0) prob.push('3초 정지 중 점수 ' + ds);
      if (prob.length) spawnBad++;
      out('  ' + (prob.length ? '✗ ' : '○ ') + label + ' (' + x.toFixed(1) + ',' + z.toFixed(1) + ' h' + h.toFixed(2) + ') ' + (fr.name || '') + (prob.length ? ' — ' + prob.join(' · ') : ''));
    }
    function checkFoot(label) {
      var W = T.walker(); if (!W) return;
      spawnN++;
      var x = W.pos.x, z = W.pos.z, prob = [];
      if (city.onRoad(x, z)) prob.push('차도 위');
      if (linkHits(x, z, 0.3, W.y || 0, (W.y || 0) + 1.7, -1).length) prob.push('링크 차도 위');
      FACALL.forEach(function (F) { if (Math.hypot(F.x - x, F.z - z) < F.r + 0.3) prob.push('시설물 ' + F.kind); });
      if (prob.length) spawnBad++;
      out('  ' + (prob.length ? '✗ ' : '○ ') + label + ' (' + x.toFixed(1) + ',' + z.toFixed(1) + ')' + (prob.length ? ' — ' + prob.join(' · ') : ''));
    }
    out('④ 시작 자리');
    T.clearTraffic && T.clearTraffic();
    ['patrol', 'free', 'chase', 'circuit', 'duty'].forEach(function (m) { T.startMode('sedan', m); checkCar('모드 ' + m); });
    ['walk', 'kid', 'tot', 'bike'].forEach(function (m) { T.startMode('sedan', m); checkFoot('모드 ' + m); });
    ['signal', 'pedestrian', 'centerline', 'speed', 'school', 'schoolzone', 'bikecross', 'cargo', 'drunk', 'license', 'overtake', 'passenger', 'phone', 'railroad', 'sidewalk'].forEach(function (id) {
      try { T.scenario(id); checkCar('체험 ' + id); } catch (e) { out('  ! 체험 ' + id + ' ' + e.message); }
    });
    if (terrain.gate) { G.enterGate = true; T.startMode('sedan', 'patrol'); checkCar('관문 도착'); }   // 게임이 쓰는 도착 경로 그대로
    T.startMode('sedan', 'patrol');
    out('④ 시작 자리 ' + spawnN + '곳 — 문제 ' + spawnBad);
    out('SUMMARY bend=' + bends.length + ' fac=' + list.length + ' wall=' + wlist.length + ' spawn=' + spawnBad + ' coordYOff=' + yOff);
  }
})();
