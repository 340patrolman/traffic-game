// 고정 장면(기준선 8컷 · 완성도 지시서 0절) + 순찰 3판 자동 재생 계측 — index.html 끝에 붙여 쓴다(_shots.html · gitignore).
//  ?shot=1~8 : 장면을 만들고 제목을 SHOT-READY 로 바꾼다(tools/shots/shoot.ps1 이 찍는다).
//  ?shot=metrics : 순찰 근무 3판을 자동으로 돌려 F1~F6 을 #SOUT(JSON)로 낸다.
//  같은 시드(Math.random) · 같은 날씨(맑음) · 같은 신호 시각(2026-09-17 목 16:30).
(function () {
  var seed = 20260917;
  Math.random = function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  var q = new URLSearchParams(location.search), shot = q.get('shot') || '1';
  function ready() { return window.TG && TG.test && TG.test.game && TG.test.game.city && TG.test.game.praise; }
  var n = 0;
  (function wait() { if (ready()) { try { run(); } catch (e) { document.title = 'SHOT-FAIL ' + e.message; } return; } if (++n > 400) { document.title = 'SHOT-FAIL not ready'; return; } setTimeout(wait, 50); })();

  function fix(T, G) {
    T.settings.weather = 'clear'; T.settings.drive = 'normal';
    if (G.weather) G.weather.set('clear');
    if (G.signals && G.signals.applyTod && G.signalTod) G.signals.applyTod(G.signalTod, new Date(2026, 8, 17, 16, 30));
  }
  function info(T, G, name) {
    try { T.render(); } catch (e) {}
    var r = T.info ? T.info() : {};
    window.__shotInfo = { name: name, calls: r.calls, triangles: r.triangles, frameMs: r.frameMs && +r.frameMs.toFixed(1), cars: G.traffic ? G.traffic.cars.length : 0, peds: G.peds ? G.peds.peds.length : 0, mode: G.mode, state: G.state };
  }
  function done(T, G, name) { info(T, G, name); T.freeze(true); try { T.render(); } catch (e) {} document.title = 'SHOT-READY'; }

  function run() {
    var T = TG.test, G = T.game, city = T.city, xs = city.xs, zs = city.zs;
    G.firstOff = true; G.crewOff = true;
    if (shot === 'metrics') return metrics(T, G);
    var s = +shot;
    if (s === 1) {   // ① 타이틀
      fix(T, G); T.step(0.2); done(T, G, 'title'); return;
    }
    if (s === 2) {   // ② 순찰 출발 3초
      T.startMode('sedan', 'patrol'); fix(T, G); T.override({ throttle: 0.6 }); T.step(3); T.override(null); done(T, G, 'patrol-start'); return;
    }
    if (s === 3) {   // ③ 교차로 신호 대기(적색, 정지선 앞)
      T.startMode('sedan', 'patrol'); fix(T, G); var N = city.nodes[2][2];
      G.signals.set(N, 'v', 'red'); T.setPlayer(xs[2] + 2, zs[2] + city.stopDist(N, 2) + 9, Math.PI, 0); T.step(1.5); done(T, G, 'red-wait'); return;
    }
    if (s === 4) {   // ④ 위반 차량 발견 순간(앞 30m · 휴대전화 · 표시 + 플래시)
      T.startMode('sedan', 'patrol'); fix(T, G); T.clearTraffic();
      T.setPlayer(xs[2] + 2, zs[3] - 10, Math.PI, 6); T.step(0.2);
      var c = G.traffic.spawn({ at: { x: xs[2] + 2, z: zs[3] - 38, d: 2, node: city.nodes[2][3] }, v: 6, cruise: 6, straight: true, type: 'sedan', trait: 'phone', violator: false });
      if (c) { c.violation = { type: 'phone', t: G.traffic.time, node: null, seen: true }; if (c.marker) c.marker.visible = true; G.selectTarget({ kind: 'car', car: c }); }
      G.hud.notice('위반 의심: 운전 중 휴대전화 — 대상 차량 표시', 'alert', 3200); G.hud.flash(); G.punch = 1;
      T.step(0.15); done(T, G, 'violation'); return;
    }
    if (s === 5) {   // ⑤ 정차 완료 순간(정차 캠)
      T.startMode('sedan', 'patrol'); fix(T, G); T.clearTraffic(); T.clearPeds(); T.setSpawning(false); G.enforcement.reset();
      var iC = 2, f2 = TG.DIR_VEC[2], r2 = [-f2[1], f2[0]], xC = xs[iC] + r2[0] * city.laneOff('v', iC, 1), zC = 240;
      T.setPlayer(xC, zC + 14, Math.PI, 6); T.siren(true); T.step(0.3);
      var cv = G.traffic.spawn({ at: { x: xC, z: zC, d: 2, node: city.nodes[2][2] }, v: 6, straight: true, type: 'sedan', trait: null, violator: false });
      cv.violation = { type: 'signal', t: G.traffic.time, node: null, seen: true };
      T.enforce(); T.ticketChoose('signal'); T.ticketClose(); T.step(0.5); G.player.signal = 'R'; T.step(0.2);
      var midZ = (zs[2] + zs[3]) / 2, shX = xs[iC] + r2[0] * city.shoulderOff('v', iC);
      cv.pos.x = shX; cv.pos.z = midZ; cv.v = 0; cv.mode = 'stopped';
      for (var k = 0; k < 16; k++) { cv.mode = 'stopped'; cv.v = 0; T.setPlayer(shX, midZ + 8, Math.PI, 0); T.step(0.25); if (G.stopcam && G.stopcam.active()) break; }
      T.step(0.7); var sg = document.getElementById('stopGrade'); if (sg) sg.hidden = false; done(T, G, 'pullover'); return;
    }
    if (s === 6) {   // ⑥ 추격 중
      T.startMode('sedan', 'chase'); fix(T, G); T.siren(true); T.override({ throttle: 0.8 }); T.step(5); T.override(null); done(T, G, 'chase'); return;
    }
    if (s === 7) {   // ⑦ 결과 카드
      T.startMode('sedan', 'patrol'); fix(T, G); G.stats.stops = 2; G.stats.correct = 2; G.endShift('근무 시간 종료'); T.step(0.1); done(T, G, 'result'); return;
    }
    if (s === 8) {   // ⑧ 어린이 교실 첫 장면
      T.startMode('sedan', 'kid'); fix(T, G); T.step(2); done(T, G, 'kid-class'); return;
    }
    document.title = 'SHOT-FAIL unknown';
  }

  // 순찰 근무 3판 자동 재생 — 사람처럼: 출발 → 앞 위반을 보면 경광등·단속·정답 → 대상 뒤 갓길 정차 → 하차 → 다시 출발.
  // 길 끝(격자 가장자리)에 닿으면 반대 차로로 돌려 세운다. 판마다 게임 시간 180초.
  function metrics(T, G) {
    var city = T.city, xs = city.xs, zs = city.zs, recs = [], started = performance.now();
    for (var shiftN = 0; shiftN < 3; shiftN++) {
      T.startMode('sedan', 'patrol'); fix(T, G);
      T.step(1.2);                                        // 사람도 화면을 한 번 본다
      var t = 0, phase = 'drive', tgt = null, waitT = 0;
      while (t < 180 && G.state === 'play') {
        var P = G.player, E = G.enforcement, dt = 0.25;
        if (phase === 'drive') {
          // 앞 14m 안(내 차로 폭)에 사람이 있으면 선다 — 사람이 운전하듯
          var pf0 = P.forward(), pedAhead = G.peds.peds.some(function (p) { var dx = p.pos.x - P.pos.x, dz = p.pos.z - P.pos.z, al = dx * pf0[0] + dz * pf0[1], la = Math.abs(dx * -pf0[1] + dz * pf0[0]); return al > 0 && al < 14 && la < 3.2; });
          T.override(pedAhead ? { brake: 1 } : { throttle: P.speedKmh() < 40 ? 0.55 : 0.1 });
          var best = null, bd = 45, f = P.forward();
          G.traffic.cars.forEach(function (c) { if (!c.violation) return; var dx = c.pos.x - P.pos.x, dz = c.pos.z - P.pos.z, d = Math.hypot(dx, dz); if (d < bd && dx * f[0] + dz * f[1] > 0) { bd = d; best = c; } });
          if (best && E.state === 'idle') { tgt = best; T.siren(true); T.override(null); T.step(0.4); t += 0.4; T.enforce(); if (E.state === 'quiz') { if (!T.ticketChoose(E.answer())) { var o1 = document.querySelector('#ticketOptions .opt'); if (o1) o1.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); } T.ticketClose(); } phase = E.state === 'yielding' ? 'pull' : 'drive'; if (phase !== 'pull') T.siren(false); waitT = 0; }
          var nd = city.nodeAhead(P.pos.x, P.pos.z, TG.headingToDir(P.heading));
          if (!nd) { var d0 = TG.headingToDir(P.heading), back = (d0 + 2) % 4, fr = city.frameAt(P.pos.x, P.pos.z, P.heading), rv = TG.DIR_VEC[back], rr = [-rv[1], rv[0]];
            var cx = fr.axis === 'v' ? xs[fr.idx] : P.pos.x, cz = fr.axis === 'h' ? zs[fr.idx] : P.pos.z;
            T.setPlayer(cx + rr[0] * 2, cz + rr[1] * 2, TG.DIR_HEADING[back], 0); }
        } else if (phase === 'pull') {
          waitT += dt;
          var c2 = E.target;
          if (!c2 || E.state === 'idle' || E.state === 'release' || waitT > 40) { phase = 'drive'; T.siren(false); continue; }
          P.signal = 'R';
          if (c2.mode === 'stopped') {
            var cf = [Math.sin(c2.heading), Math.cos(c2.heading)];
            T.override(null); T.setPlayer(c2.pos.x - cf[0] * 8, c2.pos.z - cf[1] * 8, c2.heading, 0);
            if (E.state === 'await') { T.step(1.6); t += 1.6; G.exitCar(); for (var k2 = 0; k2 < 16 && E.state !== 'release' && E.state !== 'idle'; k2++) { T.step(0.25); t += 0.25; } if (G.afoot) G.enterCar(); T.step(0.5); t += 0.5; P.signal = null; T.siren(false); phase = 'drive'; }
          } else {
            var dd = Math.hypot(c2.pos.x - P.pos.x, c2.pos.z - P.pos.z);
            T.override(dd > 16 ? { throttle: 0.3 } : { brake: 0.5 });
          }
        }
        T.step(dt); t += dt;
        if (G.paused) { T.ticketClose(); if (G.paused && G.setPaused) G.setPaused(false, 'ticket'); }   // 퀴즈가 열린 채 남으면 시간만 가고 게임이 멈춘다
      }
      T.override(null);
      G.endShift('자동 재생');
      recs.push(G.stats.metrics);
      T.step(0.5);                                      // 결과 카드 → 다시(F6 은 다음 판 시작에서 잰다)
    }
    var hist = G.metrics.history().slice(-3);
    // F4 누름→반응: 순찰 중 경광등 단추를 10번 눌러 다음 그림까지의 시간을 잰다(비동기 — 실제 프레임을 기다린다)
    // F6 끝→다시: 결과 카드의 「다시」 단추가 스크롤 없이 보이는가 · 누르면 근무가 시작되기까지(ms)
    T.startMode('sedan', 'patrol'); fix(T, G);
    var btn = document.getElementById('btnSiren'), k = 0;
    function tapOnce() {
      if (k++ >= 10) return afterTaps();
      btn.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
      requestAnimationFrame(function () { requestAnimationFrame(function () { setTimeout(tapOnce, 60); }); });
    }
    function afterTaps() {
      var taps = (G.metrics.cur() && G.metrics.cur().taps || []).slice().sort(function (a, b) { return a - b; });
      G.stats.stops = 1; G.endShift('탭 측정');
      var again = document.getElementById('btnRetry') || document.getElementById('btnAgain'), r = again.getBoundingClientRect();
      var probe = { F4samples: taps.length, F4p50: taps.length ? Math.round(taps[Math.floor(taps.length / 2)]) : null, F4max: taps.length ? Math.round(taps[taps.length - 1]) : null,
                    againVisibleNoScroll: r.bottom <= innerHeight && r.top >= 0, againTop: Math.round(r.top), viewH: innerHeight, againLabel: again.textContent.trim() };
      var t0 = performance.now();
      again.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
      probe.afterAgain = G.state;                                   // ▶ 다시 = 같은 근무 바로 시작(옛 「다시 근무」는 타이틀로 갔다)
      if (G.state === 'title') document.getElementById('btnStart').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
      probe.F6restartMs = G.state === 'play' ? Math.round(performance.now() - t0) : null;
      probe.F6taps = (probe.afterAgain === 'title' ? 2 : 1) + (probe.againVisibleNoScroll ? 0 : 1);   // 타이틀을 거치면 한 번 더 · 단추가 안 보이면 스크롤 한 번 더
      var out = { when: new Date().toISOString(), version: TG.VERSION, map: city.mapId, pass: G.metrics.PASS, shifts: hist, probe: probe, realSec: +((performance.now() - started) / 1000).toFixed(1),
                  note: '자동 재생 3판(게임 시간 180초) · F4·F6 은 probe 로 따로 잰다 · 헤드리스(swiftshader) 수치는 참고용' };
      var pre = document.createElement('pre'); pre.id = 'SOUT'; pre.textContent = JSON.stringify(out, null, 1); document.body.appendChild(pre);
      G.metrics.table(hist);
      document.title = 'SHOT-READY';
    }
    tapOnce();
  }
})();
