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
  // 음성(speechSynthesis, 오프라인): 한국어 목소리를 고르고 화자별 높낮이·속도. officer(경찰관) · kid(어린이) · pa(확성기)
  var VOICE = { officer: { pitch: 0.88, rate: 0.98 }, kid: { pitch: 1.45, rate: 1.04 }, pa: { pitch: 0.9, rate: 1.0 }, narrator: { pitch: 1.0, rate: 0.95 } };
  var koVoice = null, lastSaid = '', speaking = null;
  function pickVoice() {
    try {
      if (!window.speechSynthesis) return null;
      var vs = window.speechSynthesis.getVoices(), best = null, score = -1;
      for (var i = 0; i < vs.length; i++) {
        var v = vs[i], lang = (v.lang || '').toLowerCase(); if (lang.indexOf('ko') !== 0) continue;
        var s = 1 + (/google|neural|natural|premium|heami|sunhi|injoon|yuna/i.test(v.name) ? 2 : 0) + (v.localService ? 0.5 : 0);
        if (s > score) { score = s; best = v; }
      }
      return best;
    } catch (e) { return null; }
  }
  if (window.speechSynthesis) { try { window.speechSynthesis.onvoiceschanged = function () { koVoice = pickVoice(); }; koVoice = pickVoice(); } catch (e) {} }
  function say(text, opts) {
    opts = opts || {};
    try {
      if (!window.speechSynthesis || !text) return false;
      var kind = VOICE[opts.kind] || VOICE.officer, u = new SpeechSynthesisUtterance(text);
      u.lang = 'ko-KR'; u.rate = opts.rate || kind.rate; u.pitch = opts.pitch || kind.pitch; u.volume = muted ? 0 : (opts.volume || 1);
      if (!koVoice) koVoice = pickVoice(); if (koVoice) u.voice = koVoice;
      if (!opts.queue) window.speechSynthesis.cancel();
      else if (text === lastSaid && window.speechSynthesis.speaking) return false;   // 같은 말이 겹쳐 쌓이지 않게
      // 말하는 동안 캐릭터 입이 움직이도록 화자 표시(speaking = 'officer'|'kid'|...)
      u.onstart = function () { speaking = opts.kind || 'officer'; }; u.onend = function () { speaking = null; }; u.onerror = function () { speaking = null; };
      lastSaid = text; window.speechSynthesis.speak(u);
      return true;
    } catch (e) { return false; }   /* 음성 미지원 브라우저 */
  }
  function pa(text) {
    if (!ready) return;
    blip(880, 0.12, 'square', 0.15); setTimeout(function () { blip(1174, 0.16, 'square', 0.15); }, 150);
    say(text, { kind: 'pa' });
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
  // ---------- 효과음 팩(전부 합성) ----------
  function env(node, t0, a, d, peak) { node.gain.setValueAtTime(0.0001, t0); node.gain.exponentialRampToValueAtTime(peak, t0 + a); node.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d); }
  function tone(freq, t0, a, d, type, vol, slide) { var o = ctx.createOscillator(), g = ctx.createGain(); o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t0); if (slide) o.frequency.exponentialRampToValueAtTime(slide, t0 + a + d); env(g, t0, a, d, vol); o.connect(g); g.connect(master); o.start(t0); o.stop(t0 + a + d + 0.02); }
  function noiseHit(t0, dur, vol, fc, q) { var s = ctx.createBufferSource(); s.buffer = noiseBuf || (noiseBuf = noiseBuffer(1.0)); var f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = fc; f.Q.value = q || 1; var g = ctx.createGain(); env(g, t0, 0.005, dur, vol); s.connect(f); f.connect(g); g.connect(master); s.start(t0); s.stop(t0 + dur + 0.05); }
  var noiseBuf = null, stepL = false;
  // 발소리: 걷기(부드러운 두드림) / 달리기(빠르고 큼). 왼발·오른발 음색을 살짝 다르게
  function footstep(run, surface) { if (!ready) return; stepL = !stepL; var t0 = ctx.currentTime, fc = surface === 'road' ? 900 : 1400; noiseHit(t0, run ? 0.09 : 0.07, run ? 0.16 : 0.09, fc + (stepL ? 0 : 250), 1.2); tone(stepL ? 95 : 110, t0, 0.004, 0.06, 'sine', run ? 0.12 : 0.06); }
  // 방향지시등 릴레이 「딱·딱」
  function tick(on) { if (!ready) return; var t0 = ctx.currentTime; noiseHit(t0, 0.025, on ? 0.12 : 0.08, on ? 2400 : 1600, 3); }
  // 횡단보도 음향신호기: 남북 = 뻐꾸기(두 음), 동서 = 귀뚜라미(짧은 떨림). 실제 한국 신호기 규격을 흉내 낸 합성음
  function crossSignal(kind) {
    if (!ready) return; var t0 = ctx.currentTime;
    if (kind === 'cuckoo') { tone(1046, t0, 0.01, 0.16, 'sine', 0.16); tone(830, t0 + 0.2, 0.01, 0.2, 'sine', 0.15); }
    else { for (var i = 0; i < 6; i++) tone(2400 + (i % 2) * 300, t0 + i * 0.045, 0.004, 0.03, 'square', 0.05); }
  }
  // 별·정답 팡파르(아르페지오) — 별 개수만큼 길어진다
  function jingle(n) { if (!ready) return; var t0 = ctx.currentTime, notes = [523, 659, 784, 1046, 1318]; for (var i = 0; i < Math.min(5, 2 + (n || 1)); i++) { tone(notes[i], t0 + i * 0.09, 0.01, 0.35, 'triangle', 0.16); tone(notes[i] * 2, t0 + i * 0.09, 0.01, 0.18, 'sine', 0.05); } }
  // 점수 팝 · 메뉴 전환 휙 · 경적 · 카메라 셔터(위반 포착)
  function pop() { if (!ready) return; var t0 = ctx.currentTime; tone(880, t0, 0.005, 0.09, 'triangle', 0.14, 1320); }
  function whoosh() { if (!ready) return; noiseHit(ctx.currentTime, 0.22, 0.12, 1200, 0.6); }
  function horn(long) { if (!ready) return; var t0 = ctx.currentTime, d = long ? 0.5 : 0.18; tone(440, t0, 0.02, d, 'sawtooth', 0.09); tone(554, t0, 0.02, d, 'square', 0.06); }
  function shutter() { if (!ready) return; var t0 = ctx.currentTime; noiseHit(t0, 0.03, 0.2, 3000, 2); noiseHit(t0 + 0.05, 0.05, 0.14, 1800, 2); }
  // 비 소리(필터 노이즈 루프) — 날씨가 비일 때만
  var rainNode = null;
  function rain(on) {
    if (!ready) return;
    if (on && !rainNode) { var s = ctx.createBufferSource(); s.buffer = noiseBuffer(3.0); s.loop = true; var f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 1800; var g = ctx.createGain(); g.gain.value = 0.0001; s.connect(f); f.connect(g); g.connect(master); s.start(); g.gain.setTargetAtTime(0.07, ctx.currentTime, 1.2); rainNode = { s: s, g: g }; }
    else if (!on && rainNode) { var rn = rainNode; rainNode = null; rn.g.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.8); setTimeout(function () { try { rn.s.stop(); } catch (e) {} }, 2500); }
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
  // 무전 스퀄치: 짧은 노이즈 버스트 + 클릭 — 무전(📡)과 앰프(📢)를 소리로도 구분한다
  function squelch() {
    if (!ensure()) return;
    var now = ctx.currentTime, src = ctx.createBufferSource(); src.buffer = noiseBuffer(0.22);
    var bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1750; bp.Q.value = 1.6;
    var g2 = ctx.createGain(); g2.gain.setValueAtTime(0.0001, now); g2.gain.exponentialRampToValueAtTime(0.16, now + 0.012); g2.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
    src.connect(bp); bp.connect(g2); g2.connect(master); src.start(now); src.stop(now + 0.2);
    blip(1320, 0.05, 'square', 0.05);
  }
  function ui() { blip(880, 0.06, 'square', 0.08); }
  function bell() { blip(1480, 0.12, 'triangle', 0.09); }   // 철길건널목 경보종
  function good() { blip(660, 0.12, 'triangle', 0.2); setTimeout(function () { blip(990, 0.18, 'triangle', 0.2); }, 110); }
  function bad() { blip(220, 0.25, 'sawtooth', 0.18); }
  function alert() { blip(1200, 0.1, 'square', 0.12); setTimeout(function () { blip(1200, 0.1, 'square', 0.12); }, 140); }


  // ---------- 인트로 테마 · 타이틀 테마(합성, 오디오 파일 0개) ----------
  // 소유자 요청: 「인트로 화면에서 웅장한 사운드」.
  // 웅장함은 ① 넓은 공간감(리버브) ② 저음 드론 + 팀파니 ③ 금관 모티프 ④ 합창 패드 ⑤ 마지막 대타격에서 나온다.
  // 리버브는 컨볼루션(무거움) 대신 딜레이 3개를 되먹인 콤 필터 홀 — 폰에서도 가볍다.
  var rv = null;
  function reverb() {
    if (rv) return rv;
    var input = ctx.createGain(), out = ctx.createGain(); out.gain.value = 0.42;
    [[0.031, 0.66], [0.047, 0.62], [0.067, 0.58], [0.089, 0.54]].forEach(function (t) {
      var d = ctx.createDelay(1.0); d.delayTime.value = t[0];
      var fb = ctx.createGain(); fb.gain.value = t[1];
      var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400;
      input.connect(d); d.connect(lp); lp.connect(fb); fb.connect(d); lp.connect(out);
    });
    out.connect(master); rv = input;
    return rv;
  }
  function panner(v) {   // 스테레오 폭(지원하지 않는 브라우저는 그냥 게인)
    if (ctx.createStereoPanner) { var p = ctx.createStereoPanner(); p.pan.value = v; return p; }
    return ctx.createGain();
  }
  var theme = null;
  // offset: 인트로가 이미 몇 초 지났는지(사용자 터치로 오디오가 늦게 풀리면 그 시점부터 이어서 연주).
  function introTheme(offset) {
    if (!ensure()) return false;
    if (ctx.state !== 'running') return false;
    stopIntro(0); stopTitleTheme(0);
    var now = ctx.currentTime, t0 = now - (offset || 0), nodes = [];
    // 버스: 컴프레서를 거쳐 마스터로(합주가 뭉쳐서 크게 들린다) + 리버브 센드
    var bus = ctx.createGain(); bus.gain.value = 1.0;
    var comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -20; comp.knee.value = 12; comp.ratio.value = 3.2; comp.attack.value = 0.006; comp.release.value = 0.22;
    var send = ctx.createGain(); send.gain.value = 0.5;
    bus.connect(comp); comp.connect(master); bus.connect(send); send.connect(reverb());
    theme = { bus: bus, nodes: nodes };
    function T(t) { return Math.max(now, t0 + t); }
    function osc(type, freq, det) { var o = ctx.createOscillator(); o.type = type; o.frequency.value = freq; if (det) o.detune.value = det; nodes.push(o); return o; }
    var N = { D1: 36.71, D2: 73.42, A2: 110, Bb2: 116.54, D3: 146.83, F3: 174.61, Fs3: 185, G3: 196, A3: 220, Bb3: 233.08, C4: 261.63, Cs4: 277.18, D4: 293.66,
              Fs4: 369.99, A4: 440, D5: 587.33, Fs5: 739.99, A5: 880, D6: 1174.66 };
    // 1) 저음 드론(끝까지) — 웅장함의 바닥
    var dg = ctx.createGain(); dg.gain.setValueAtTime(0, T(0)); dg.gain.linearRampToValueAtTime(0.22, T(3)); dg.gain.setValueAtTime(0.22, T(10.3)); dg.gain.linearRampToValueAtTime(0.34, T(10.5)); dg.gain.setValueAtTime(0.34, T(13.2)); dg.gain.linearRampToValueAtTime(0, T(14.4)); dg.connect(bus);
    [N.D1, N.D2].forEach(function (f, i) { var o = osc('sine', f); var g = ctx.createGain(); g.gain.value = i ? 0.5 : 1; o.connect(g); g.connect(dg); o.start(T(0)); o.stop(T(14.6)); });
    // 2) 금관 패드: Dm → Bb → A → D(장조, 타이틀). 톱니 2겹을 좌우로 벌려 폭을 만든다
    var chords = [
      { at: 0.4, to: 4.4, n: [N.D2, N.D3, N.F3, N.A3], v: 0.10 },
      { at: 4.4, to: 8.4, n: [N.Bb2, N.D3, N.F3, N.Bb3], v: 0.13 },
      { at: 8.4, to: 10.4, n: [N.A2, N.Cs4, N.A3, N.G3], v: 0.16 },
      { at: 10.4, to: 14.2, n: [N.D2, N.D3, N.Fs3, N.A3, N.D4], v: 0.26 },
    ];
    var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 1.2;
    lp.frequency.setValueAtTime(320, T(0)); lp.frequency.linearRampToValueAtTime(900, T(8.4)); lp.frequency.linearRampToValueAtTime(2800, T(10.5)); lp.frequency.setValueAtTime(2800, T(13)); lp.frequency.linearRampToValueAtTime(600, T(14.2));
    lp.connect(bus);
    chords.forEach(function (c) {
      if (t0 + c.to < now) return;
      var g = ctx.createGain(); g.gain.setValueAtTime(0, T(c.at)); g.gain.linearRampToValueAtTime(c.v, T(c.at + 0.9)); g.gain.setValueAtTime(c.v, T(c.to - 0.3)); g.gain.linearRampToValueAtTime(0, T(c.to + 0.15)); g.connect(lp);
      c.n.forEach(function (f) { [-8, 7].forEach(function (d, k) { var o = osc('sawtooth', f, d), p = panner(k ? 0.55 : -0.55); o.connect(p); p.connect(g); o.start(T(c.at)); o.stop(T(c.to + 0.2)); }); });
    });
    // 3) 금관 모티프(호른) — 4음: D–A–D–F♯. 3초에 낮게 한 번, 10.5초에 옥타브 위로 화음까지
    function brass(at, dur, freq, vol, pan) {
      if (t0 + at + dur < now) return;
      var g = ctx.createGain(), f = ctx.createBiquadFilter(), p = panner(pan || 0);
      f.type = 'lowpass'; f.Q.value = 1.6;
      f.frequency.setValueAtTime(500, T(at)); f.frequency.linearRampToValueAtTime(freq * 6 + 900, T(at + 0.09)); f.frequency.linearRampToValueAtTime(freq * 3 + 500, T(at + dur));
      g.gain.setValueAtTime(0.0001, T(at)); g.gain.linearRampToValueAtTime(vol, T(at + 0.07)); g.gain.setValueAtTime(vol, T(at + dur - 0.12)); g.gain.linearRampToValueAtTime(0.0001, T(at + dur + 0.06));
      [0, -6, 6].forEach(function (d, k) { var o = osc(k === 2 ? 'square' : 'sawtooth', freq, d), sg = ctx.createGain(); sg.gain.value = k === 2 ? 0.25 : 0.6; o.connect(sg); sg.connect(f); o.start(T(at)); o.stop(T(at + dur + 0.1)); });
      f.connect(g); g.connect(p); p.connect(bus);
    }
    var MOTIF = [[0, 0.55, N.D3], [0.6, 0.55, N.A3], [1.2, 0.5, N.D4], [1.75, 1.1, N.Fs4]];
    MOTIF.forEach(function (m) { brass(3.0 + m[0], m[1], m[2], 0.075, -0.2); });                       // 낮게 예고
    MOTIF.forEach(function (m) { brass(10.55 + m[0] * 1.05, m[1] * 1.1, m[2] * 2, 0.135, 0); });        // 타이틀에서 본 주제
    MOTIF.forEach(function (m) { brass(10.55 + m[0] * 1.05, m[1] * 1.1, m[2] * 2 * 1.5, 0.055, 0.45); }); // 5도 화음
    brass(12.7, 1.4, N.D5, 0.11, 0.15); brass(12.7, 1.4, N.Fs5, 0.05, -0.35);                           // 마지막 지속음
    // 4) 합창 패드(사인 스택 + 느린 떨림) — 8.4초부터, 대타격에서 활짝
    if (t0 + 14 > now) {
      var chg = ctx.createGain(); chg.gain.setValueAtTime(0, T(8.4)); chg.gain.linearRampToValueAtTime(0.05, T(10.3)); chg.gain.linearRampToValueAtTime(0.14, T(10.7)); chg.gain.setValueAtTime(0.14, T(13.2)); chg.gain.linearRampToValueAtTime(0, T(14.3)); chg.connect(bus);
      var trem = osc('sine', 4.6), tg = ctx.createGain(); tg.gain.value = 0.14; trem.connect(tg); tg.connect(chg.gain); trem.start(T(8.4)); trem.stop(T(14.4));
      [N.D4, N.Fs4, N.A4, N.D5].forEach(function (f, k) { [-5, 5].forEach(function (d, j) { var o = osc('sine', f, d), p = panner(j ? 0.4 : -0.4), g2 = ctx.createGain(); g2.gain.value = 0.5 - k * 0.08; o.connect(g2); g2.connect(p); p.connect(chg); o.start(T(8.4)); o.stop(T(14.4)); }); });
    }
    // 5) 팀파니·타이코(저음 사인 피치 하강 + 짧은 노이즈)
    function drum(at, vol, f) {
      if (t0 + at + 1.2 < now) return;
      var o = osc('sine', f || 110); var g = ctx.createGain();
      o.frequency.setValueAtTime(f || 110, T(at)); o.frequency.exponentialRampToValueAtTime(42, T(at + 0.35));
      g.gain.setValueAtTime(0.0001, T(at)); g.gain.exponentialRampToValueAtTime(vol, T(at + 0.012)); g.gain.exponentialRampToValueAtTime(0.0001, T(at + 1.1));
      o.connect(g); g.connect(bus); o.start(T(at)); o.stop(T(at + 1.2));
      var nb = ctx.createBufferSource(); nb.buffer = noiseBuffer(0.3); var nf = ctx.createBiquadFilter(); nf.type = 'lowpass'; nf.frequency.value = 500; var ng = ctx.createGain();
      ng.gain.setValueAtTime(vol * 0.5, T(at)); ng.gain.exponentialRampToValueAtTime(0.0001, T(at + 0.25)); nb.connect(nf); nf.connect(ng); ng.connect(bus); nb.start(T(at)); nodes.push(nb);
    }
    drum(0.6, 0.5); drum(2.6, 0.35);
    drum(4.4, 0.55); drum(5.0, 0.22, 96); drum(6.6, 0.4); drum(7.2, 0.2, 96);   // 타이코 2연타
    drum(8.4, 0.6);
    for (var i = 0; i < 8; i++) drum(9.2 + i * 0.15, 0.22 + i * 0.03, 90);      // 타이틀 직전 롤
    drum(10.4, 1.0, 140); drum(10.4, 0.7, 62); drum(11.4, 0.45); drum(12.4, 0.5, 120); drum(13.2, 0.3);
    // 6) 라이저(대역필터 노이즈, 8.4→10.4 상승) + 심벌(10.4) + 반짝임 아르페지오
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
        var at = 10.5 + k * 0.16, o = osc('triangle', f), g = ctx.createGain(), p = panner(k % 2 ? 0.5 : -0.5);
        g.gain.setValueAtTime(0.0001, T(at)); g.gain.exponentialRampToValueAtTime(0.12, T(at + 0.02)); g.gain.exponentialRampToValueAtTime(0.0001, T(at + 1.4));
        o.connect(g); g.connect(p); p.connect(bus); o.start(T(at)); o.stop(T(at + 1.5));
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
  // 타이틀 화면 테마: 인트로 주제를 조용히 되짚는 16초 루프(드론 + 아르페지오 + 두 마디마다 팀파니 한 번).
  // 타이틀이 무음이면 게임이 꺼진 것처럼 보인다 — 출동을 누르면 멈춘다.
  var titleTh = null;
  function titleTheme() {
    if (!ensure() || ctx.state !== 'running' || titleTh || theme) return false;
    var now = ctx.currentTime + 0.05, nodes = [], bus = ctx.createGain(); bus.gain.value = 0.0001;
    var send = ctx.createGain(); send.gain.value = 0.55;
    bus.connect(master); bus.connect(send); send.connect(reverb());
    bus.gain.linearRampToValueAtTime(0.5, now + 2.5);
    titleTh = { bus: bus, nodes: nodes, timer: null };
    function osc(type, freq, det) { var o = ctx.createOscillator(); o.type = type; o.frequency.value = freq; if (det) o.detune.value = det; nodes.push(o); return o; }
    // 드론 D
    var dg = ctx.createGain(); dg.gain.value = 0.12; dg.connect(bus);
    [36.71, 73.42, 110].forEach(function (f, i) { var o = osc('sine', f), g = ctx.createGain(); g.gain.value = i === 2 ? 0.25 : 0.6; o.connect(g); g.connect(dg); o.start(now); });
    // 아르페지오(D–F♯–A–D)를 0.75초마다, 4마디마다 팀파니. 16초 루프.
    var STEP = 0.75, SEQ = [293.66, 369.99, 440, 587.33, 440, 369.99, 293.66, 220], k = 0, base = now;
    function tick() {
      if (!titleTh) return;
      var t = base + k * STEP;
      if (t < ctx.currentTime) { base = ctx.currentTime; t = base; }
      var f = SEQ[k % SEQ.length], o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f;
      var g = ctx.createGain(), p = panner(k % 2 ? 0.35 : -0.35);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.07, t + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.5);
      o.connect(g); g.connect(p); p.connect(bus); o.start(t); o.stop(t + 1.6);
      if (k % 8 === 0) {   // 6초마다 낮은 북 한 번
        var d = ctx.createOscillator(); d.type = 'sine'; d.frequency.setValueAtTime(104, t); d.frequency.exponentialRampToValueAtTime(44, t + 0.3);
        var dgg = ctx.createGain(); dgg.gain.setValueAtTime(0.0001, t); dgg.gain.exponentialRampToValueAtTime(0.32, t + 0.012); dgg.gain.exponentialRampToValueAtTime(0.0001, t + 1.0);
        d.connect(dgg); dgg.connect(bus); d.start(t); d.stop(t + 1.1);
      }
      k++;
      titleTh.timer = setTimeout(tick, STEP * 1000);
    }
    tick();
    return true;
  }
  function stopTitleTheme(fade) {
    if (!titleTh) return;
    var th = titleTh; titleTh = null; var f = fade === undefined ? 0.8 : fade, now = ctx.currentTime;
    if (th.timer) clearTimeout(th.timer);
    th.bus.gain.setValueAtTime(th.bus.gain.value, now); th.bus.gain.linearRampToValueAtTime(0, now + f + 0.001);
    setTimeout(function () { th.nodes.forEach(function (n) { try { n.stop(); } catch (e) { } }); try { th.bus.disconnect(); } catch (e) { } }, (f + 0.05) * 1000);
  }
  function setMuted(m) { muted = m; if (master) master.gain.setTargetAtTime(m ? 0 : volume, ctx.currentTime, 0.05); }

  return { resume: resume, update: update, setSiren: setSiren, setPowertrain: setPowertrain, setVolume: setVolume, thump: thump, ui: ui, squelch: squelch, bell: bell, say: say, good: good,
           footstep: footstep, tick: tick, crossSignal: crossSignal, jingle: jingle, pop: pop, whoosh: whoosh, horn: horn, shutter: shutter, rain: rain, get speaking() { return speaking; }, bad: bad, alert: alert, pa: pa, introTheme: introTheme, stopIntro: stopIntro, titleTheme: titleTheme, stopTitleTheme: stopTitleTheme, get running() { return ready && ctx.state === 'running'; },
           setMuted: setMuted, get muted() { return muted; }, get ready() { return ready; } };
})();
