// Web Audio 합성. 오디오 파일 0개. 첫 사용자 입력 뒤에 컨텍스트를 연다.
TG.audio = (function () {
  var ctx = null, master = null, muted = false, ready = false, volume = 0.32;   // 기본 음량: 은은하게(전체 마스터 0.32)
  function setVolume(v) { volume = TG.clamp(v, 0, 1); if (master && !muted) master.gain.setTargetAtTime(volume, ctx.currentTime, 0.05); }
  var engine = null, skid = null, siren = null, sirenOn = false, wind = null, ambient = null;
  // 현장 소리: 바람(속도에 비례한 저역 노이즈) + 도심 웅웅거림(저음 화음) — 모두 합성
  function buildAmbient() {
    var src = ctx.createBufferSource(); src.buffer = noiseBuffer(2.0); src.loop = true;
    var f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 500; f.Q.value = 0.7;
    var g = ctx.createGain(); g.gain.value = 0;
    src.connect(f); f.connect(g); g.connect(master); src.start();
    wind = { g: g, f: f };
    var g2 = ctx.createGain(); g2.gain.value = 0.012;
    [55, 82.4, 110].forEach(function (fr, i) { var o = ctx.createOscillator(); o.type = i === 1 ? 'triangle' : 'sine'; o.frequency.value = fr; var lf = ctx.createGain(); lf.gain.value = 0.5; o.connect(lf); lf.connect(g2); o.start(); });
    g2.connect(master);
    ambient = { g: g2 };
  }
  // 앰프(차량 확성기) 안내: 브라우저 내장 음성(오프라인, 파일 없음). 음성이 없으면 차임만.
  function pa(text) {
    if (!ready) return;
    blip(880, 0.12, 'square', 0.15); setTimeout(function () { blip(1174, 0.16, 'square', 0.15); }, 150);
    try {
      if (!window.speechSynthesis) return;
      var u = new SpeechSynthesisUtterance(text); u.lang = 'ko-KR'; u.rate = 1.0; u.pitch = 0.9; u.volume = muted ? 0 : 1;
      window.speechSynthesis.cancel(); window.speechSynthesis.speak(u);
    } catch (e) { /* 음성 미지원 브라우저 */ }
  }

  function ensure() {
    if (ready) return true;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try {
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : volume;
      master.connect(ctx.destination);
      buildEngine(); buildSkid(); buildSiren(); buildAmbient();
      ready = true;
    } catch (e) { return false; }
    return true;
  }
  function resume() {
    if (!ensure()) return;
    if (ctx.state === 'suspended') ctx.resume();
  }

  function noiseBuffer(sec) {
    var len = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }

  function buildEngine() {
    var o1 = ctx.createOscillator(), o2 = ctx.createOscillator();
    o1.type = 'sawtooth'; o2.type = 'triangle';
    var f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 380; f.Q.value = 2;
    var g = ctx.createGain(); g.gain.value = 0.0;
    o1.connect(f); o2.connect(f); f.connect(g); g.connect(master);
    o1.start(); o2.start();
    engine = { o1: o1, o2: o2, f: f, g: g };
  }
  function buildSkid() {
    var src = ctx.createBufferSource(); src.buffer = noiseBuffer(1.5); src.loop = true;
    var f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1800; f.Q.value = 1.4;
    var g = ctx.createGain(); g.gain.value = 0;
    src.connect(f); f.connect(g); g.connect(master); src.start();
    skid = { g: g, f: f };
  }
  function buildSiren() {
    var o = ctx.createOscillator(); o.type = 'square';
    var f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1400;
    var g = ctx.createGain(); g.gain.value = 0;
    o.frequency.value = 700;
    o.connect(f); f.connect(g); g.connect(master); o.start();
    siren = { o: o, g: g, phase: 0 };
  }

  // 파워트레인: 'ice'(내연기관: 6단 변속, 회전수에 따른 엔진음·변속 시 회전수 낙차) / 'ev'(전기차: 인버터 고음 휘파람 + 저속 보행자 경고음 AVAS + 회생제동 허밍)
  var powertrain = 'ice', gear = 1, shiftT = 0, rpmSm = 0.2, ev = null;
  var SHIFT_KMH = [0, 18, 36, 58, 82, 112, 200];   // 단수별 상한 속도
  function buildEV() {
    var o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = 200;
    var o2 = ctx.createOscillator(); o2.type = 'triangle'; o2.frequency.value = 400;
    var f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 1.2;
    var g = ctx.createGain(); g.gain.value = 0;
    o.connect(f); o2.connect(f); f.connect(g); g.connect(master); o.start(); o2.start();
    var a1 = ctx.createOscillator(); a1.type = 'sine'; a1.frequency.value = 330;   // AVAS 2음 패드
    var a2 = ctx.createOscillator(); a2.type = 'sine'; a2.frequency.value = 415;
    var ag = ctx.createGain(); ag.gain.value = 0;
    a1.connect(ag); a2.connect(ag); ag.connect(master); a1.start(); a2.start();
    ev = { o: o, o2: o2, f: f, g: g, ag: ag, a1: a1, a2: a2, t: 0 };
  }
  function setPowertrain(kind) { powertrain = kind === 'ev' ? 'ev' : 'ice'; gear = 1; rpmSm = 0.2; }
  // 매 프레임: speedNorm 0..1(최고속 대비), throttle 0..1, skidLevel 0..1, kmh, decel(감속 중이면 true)
  function update(dt, speedNorm, throttle, skidLevel, kmh, decel) {
    if (!ready) return;
    kmh = kmh || 0;
    var now = ctx.currentTime;
    if (powertrain === 'ice') {
      // 변속: 상한을 넘으면 올리고(회전수 낙차), 아래 단 하한의 70% 아래면 내린다
      if (kmh > SHIFT_KMH[gear] && gear < 6) { gear++; shiftT = 0.18; }
      else if (gear > 1 && kmh < SHIFT_KMH[gear - 1] * 0.7) { gear--; }
      var lo = SHIFT_KMH[gear - 1], hi = SHIFT_KMH[gear];
      var rpmT = 0.18 + 0.72 * TG.clamp((kmh - lo) / Math.max(1, hi - lo), 0, 1);
      if (throttle > 0.1 && kmh < 3) rpmT = 0.45;        // 출발 시 회전수 올림
      if (shiftT > 0) { shiftT -= dt; rpmT *= 0.55; }    // 변속 순간 회전수 낙차
      rpmSm += (rpmT - rpmSm) * Math.min(1, dt * 6);
      var base = 45 + rpmSm * 170;
      engine.o1.frequency.setTargetAtTime(base, now, 0.04);
      engine.o2.frequency.setTargetAtTime(base * 1.5, now, 0.04);
      engine.f.frequency.setTargetAtTime(260 + rpmSm * 1100 + throttle * 500, now, 0.06);
      engine.g.gain.setTargetAtTime((shiftT > 0 ? 0.025 : 0.04) + rpmSm * 0.06 + throttle * 0.035, now, 0.08);
      if (ev) { ev.g.gain.setTargetAtTime(0, now, 0.1); ev.ag.gain.setTargetAtTime(0, now, 0.1); }
    } else {
      if (!ev) buildEV();
      engine.g.gain.setTargetAtTime(0, now, 0.1);
      var whine = 120 + kmh * 16;                        // 인버터 휘파람: 속도에 비례
      ev.o.frequency.setTargetAtTime(whine, now, 0.05); ev.o2.frequency.setTargetAtTime(whine * 2.01, now, 0.05);
      ev.f.frequency.setTargetAtTime(400 + kmh * 30, now, 0.1);
      var load = throttle * 0.8 + (decel ? 0.5 : 0) + speedNorm * 0.3;
      ev.g.gain.setTargetAtTime(kmh > 1 ? 0.008 + load * 0.022 : 0, now, 0.1);
      // AVAS: 25km/h 이하에서 천천히 물결치는 2음 패드(전기차 저속 경고음)
      ev.t += dt;
      var avas = kmh > 0.5 && kmh < 25 ? (0.012 + 0.008 * Math.sin(ev.t * 3)) * (1 - kmh / 25) : 0;
      ev.ag.gain.setTargetAtTime(avas, now, 0.15);
      ev.a1.frequency.setTargetAtTime(330 + kmh * 4, now, 0.2); ev.a2.frequency.setTargetAtTime(415 + kmh * 5, now, 0.2);
    }
    skid.g.gain.setTargetAtTime(skidLevel > 0 ? 0.05 + skidLevel * 0.22 : 0, ctx.currentTime, 0.05);
    if (wind) { wind.g.gain.setTargetAtTime(speedNorm * speedNorm * 0.09, ctx.currentTime, 0.2); wind.f.frequency.setTargetAtTime(300 + speedNorm * 900, ctx.currentTime, 0.2); }
    skid.f.frequency.setTargetAtTime(1400 + skidLevel * 900, ctx.currentTime, 0.1);
    if (sirenOn) {
      siren.phase += dt;
      var t = siren.phase % 1.4;                 // 웨일: 0.7초 상승, 0.7초 하강
      var k = t < 0.7 ? t / 0.7 : 1 - (t - 0.7) / 0.7;
      siren.o.frequency.setTargetAtTime(600 + k * 700, ctx.currentTime, 0.02);
    }
  }
  function setSiren(on) {
    sirenOn = on;
    if (!ready) return;
    siren.g.gain.setTargetAtTime(on ? 0.07 : 0, ctx.currentTime, 0.05);
  }

  function blip(freq, dur, type, vol) {
    if (!ready) return;
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'sine'; o.frequency.value = freq;
    g.gain.value = vol || 0.25;
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.connect(g); g.connect(master); o.start(); o.stop(ctx.currentTime + dur);
  }
  function thump(strength) {
    if (!ready) return;
    var src = ctx.createBufferSource(); src.buffer = noiseBuffer(0.3);
    var f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 400;
    var g = ctx.createGain(); g.gain.value = 0.4 * Math.min(1, strength);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    src.connect(f); f.connect(g); g.connect(master); src.start();
    blip(60, 0.25, 'sine', 0.5 * Math.min(1, strength));
  }
  function ui() { blip(880, 0.06, 'square', 0.08); }
  function bell() { blip(1480, 0.12, 'triangle', 0.09); }   // 철길건널목 경보종
  function good() { blip(660, 0.12, 'triangle', 0.2); setTimeout(function () { blip(990, 0.18, 'triangle', 0.2); }, 110); }
  function bad() { blip(220, 0.25, 'sawtooth', 0.18); }
  function alert() { blip(1200, 0.1, 'square', 0.12); setTimeout(function () { blip(1200, 0.1, 'square', 0.12); }, 140); }


  // ---------- 인트로 테마(합성, 13.5초) ----------
  // 낮은 드론 + 금관 느낌 패드(톱니파+저역필터) + 팀파니 + 라이저 + 타이틀 순간 심벌·반짝임. 오디오 파일 0개.
  // offset: 인트로가 이미 몇 초 지났는지(사용자 터치로 오디오가 늦게 풀리면 그 시점부터 이어서 연주).
  var theme = null;
  function introTheme(offset) {
    if (!ensure()) return false;
    if (ctx.state !== 'running') return false;
    stopIntro(0);
    var now = ctx.currentTime, t0 = now - (offset || 0), nodes = [], bus = ctx.createGain();
    bus.gain.value = 0.9; bus.connect(master);
    theme = { bus: bus, nodes: nodes };
    function T(t) { return Math.max(now, t0 + t); }
    function osc(type, freq, det) { var o = ctx.createOscillator(); o.type = type; o.frequency.value = freq; if (det) o.detune.value = det; nodes.push(o); return o; }
    var N = { D2: 73.42, A2: 110, Bb2: 116.54, D3: 146.83, F3: 174.61, Fs3: 185, G3: 196, A3: 220, Bb3: 233.08, C4: 261.63, Cs4: 277.18, D4: 293.66, D5: 587.33, A5: 880, D6: 1174.66, Fs5: 739.99 };
    // 1) 드론(끝까지)
    var dg = ctx.createGain(); dg.gain.setValueAtTime(0, T(0)); dg.gain.linearRampToValueAtTime(0.22, T(3)); dg.gain.setValueAtTime(0.22, T(10.3)); dg.gain.linearRampToValueAtTime(0.3, T(10.5)); dg.connect(bus);
    [36.71, 73.42].forEach(function (f, i) { var o = osc('sine', f); var g = ctx.createGain(); g.gain.value = i ? 0.5 : 1; o.connect(g); g.connect(dg); o.start(T(0)); o.stop(T(14)); });
    // 2) 금관 패드: 화음 진행 Dm → Bb → A → D(장조, 타이틀)
    var chords = [
      { at: 0.4, to: 4.4, n: [N.D2, N.D3, N.F3, N.A3], v: 0.10 },
      { at: 4.4, to: 8.4, n: [N.Bb2, N.D3, N.F3, N.Bb3], v: 0.13 },
      { at: 8.4, to: 10.4, n: [N.A2, N.Cs4, N.A3, N.G3], v: 0.16 },
      { at: 10.4, to: 13.6, n: [N.D2, N.D3, N.Fs3, N.A3, N.D4], v: 0.26 },
    ];
    var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 1.2;
    lp.frequency.setValueAtTime(320, T(0)); lp.frequency.linearRampToValueAtTime(900, T(8.4)); lp.frequency.linearRampToValueAtTime(2600, T(10.5)); lp.frequency.setValueAtTime(2600, T(12.5)); lp.frequency.linearRampToValueAtTime(600, T(13.6));
    lp.connect(bus);
    chords.forEach(function (c) {
      if (t0 + c.to < now) return;
      var g = ctx.createGain(); g.gain.setValueAtTime(0, T(c.at)); g.gain.linearRampToValueAtTime(c.v, T(c.at + 0.9)); g.gain.setValueAtTime(c.v, T(c.to - 0.25)); g.gain.linearRampToValueAtTime(0, T(c.to + 0.15)); g.connect(lp);
      c.n.forEach(function (f) { [-7, 6].forEach(function (d) { var o = osc('sawtooth', f, d); o.connect(g); o.start(T(c.at)); o.stop(T(c.to + 0.2)); }); });
    });
    // 3) 팀파니(저음 사인 피치 하강 + 짧은 노이즈)
    function drum(at, vol, f) {
      if (t0 + at + 1.2 < now) return;
      var o = osc('sine', f || 110); var g = ctx.createGain();
      o.frequency.setValueAtTime(f || 110, T(at)); o.frequency.exponentialRampToValueAtTime(42, T(at + 0.35));
      g.gain.setValueAtTime(0.0001, T(at)); g.gain.exponentialRampToValueAtTime(vol, T(at + 0.012)); g.gain.exponentialRampToValueAtTime(0.0001, T(at + 1.1));
      o.connect(g); g.connect(bus); o.start(T(at)); o.stop(T(at + 1.2));
      var nb = ctx.createBufferSource(); nb.buffer = noiseBuffer(0.3); var nf = ctx.createBiquadFilter(); nf.type = 'lowpass'; nf.frequency.value = 500; var ng = ctx.createGain();
      ng.gain.setValueAtTime(vol * 0.5, T(at)); ng.gain.exponentialRampToValueAtTime(0.0001, T(at + 0.25)); nb.connect(nf); nf.connect(ng); ng.connect(bus); nb.start(T(at)); nodes.push(nb);
    }
    drum(0.6, 0.5); drum(2.6, 0.35); drum(4.4, 0.55); drum(6.6, 0.4); drum(8.4, 0.6);
    for (var i = 0; i < 8; i++) drum(9.2 + i * 0.15, 0.22 + i * 0.03, 90);   // 타이틀 직전 롤
    drum(10.4, 0.9, 130); drum(11.4, 0.45);
    // 4) 라이저(대역필터 노이즈, 8.4→10.4 상승) + 심벌(10.4) + 반짝임 아르페지오
    if (t0 + 10.4 > now) {
      var rs = ctx.createBufferSource(); rs.buffer = noiseBuffer(2.2); var rf = ctx.createBiquadFilter(); rf.type = 'bandpass'; rf.Q.value = 3; var rg = ctx.createGain();
      rf.frequency.setValueAtTime(200, T(8.4)); rf.frequency.exponentialRampToValueAtTime(4000, T(10.4));
      rg.gain.setValueAtTime(0.0001, T(8.4)); rg.gain.exponentialRampToValueAtTime(0.28, T(10.35)); rg.gain.setValueAtTime(0, T(10.4));
      rs.connect(rf); rf.connect(rg); rg.connect(bus); rs.start(T(8.4)); rs.stop(T(10.45)); nodes.push(rs);
    }
    if (t0 + 12.5 > now) {
      var cs = ctx.createBufferSource(); cs.buffer = noiseBuffer(2.5); var cf = ctx.createBiquadFilter(); cf.type = 'highpass'; cf.frequency.value = 5000; var cg = ctx.createGain();
      cg.gain.setValueAtTime(0.0001, T(10.4)); cg.gain.exponentialRampToValueAtTime(0.35, T(10.41)); cg.gain.exponentialRampToValueAtTime(0.0001, T(12.6));
      cs.connect(cf); cf.connect(cg); cg.connect(bus); cs.start(T(10.4)); cs.stop(T(12.7)); nodes.push(cs);
      [N.D5, N.Fs5, N.A5, N.D6, N.A5, N.D6].forEach(function (f, k) {
        var at = 10.5 + k * 0.16, o = osc('triangle', f), g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, T(at)); g.gain.exponentialRampToValueAtTime(0.12, T(at + 0.02)); g.gain.exponentialRampToValueAtTime(0.0001, T(at + 1.4));
        o.connect(g); g.connect(bus); o.start(T(at)); o.stop(T(at + 1.5));
      });
    }
    return true;
  }
  function stopIntro(fade) {
    if (!theme) return;
    var th = theme; theme = null; var f = fade === undefined ? 0.7 : fade, now = ctx.currentTime;
    th.bus.gain.setValueAtTime(th.bus.gain.value, now); th.bus.gain.linearRampToValueAtTime(0, now + f + 0.001);
    setTimeout(function () { th.nodes.forEach(function (n) { try { n.stop(); } catch (e) { } }); try { th.bus.disconnect(); } catch (e) { } }, (f + 0.05) * 1000);
  }
  function setMuted(m) { muted = m; if (master) master.gain.setTargetAtTime(m ? 0 : volume, ctx.currentTime, 0.05); }

  return { resume: resume, update: update, setSiren: setSiren, setPowertrain: setPowertrain, setVolume: setVolume, thump: thump, ui: ui, bell: bell, good: good, bad: bad, alert: alert, pa: pa, introTheme: introTheme, stopIntro: stopIntro, get running() { return ready && ctx.state === 'running'; },
           setMuted: setMuted, get muted() { return muted; }, get ready() { return ready; } };
})();
