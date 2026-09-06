// HUD·오버레이. 교육 문구는 화면을 가리지 않는다: 짧게, 가장자리에, 자동으로 사라진다.
TG.hud = (function () {
  var $ = function (id) { return document.getElementById(id); };
  var el = {}, settings = { hints: true, stopbar: true, sound: true };
  var noticeT = 0, hintT = 0, hintGap = 0;

  function init(s) {
    settings = s;
    ['hud', 'speed', 'stopbar', 'stopbarWrap', 'stopdist', 'gap', 'score', 'timer', 'stops', 'sirenState', 'notice', 'hint', 'vignette', 'target', 'section', 'gear',
     'title', 'intro', 'pause', 'ticket', 'end', 'best', 'ticketOptions', 'ticketTimer', 'ticketResult', 'ticketQuestion', 'btnTicketClose', 'endStats', 'touch', 'btnSiren', 'introLines', 'introSkip']
      .forEach(function (id) { el[id] = $(id); });
    el.stopbarWrap.style.display = settings.stopbar ? '' : 'none';
  }
  function setSpeed(kmh, stopDist, limitKmh) {
    var k = Math.round(kmh);
    if (el._speed !== k) { el._speed = k; el.speed.textContent = k; el.speed.classList.toggle('over', k > limitKmh + 10); }
    var w = Math.min(100, stopDist / 60 * 100);
    el.stopbar.style.width = w + '%';
    el.stopbar.style.background = stopDist > 35 ? '#ff5d5d' : stopDist > 18 ? '#ffb340' : '#5ad37a';
    el.stopdist.textContent = stopDist < 0.5 ? '—' : Math.round(stopDist) + 'm';
  }
  function setGap(sec) {
    if (sec === null) { el.gap.style.opacity = 0; return; }
    el.gap.style.opacity = 1; el.gap.textContent = '앞차 ' + sec.toFixed(1) + '초';
    el.gap.className = sec < 1 ? 'gap danger' : sec < 2 ? 'gap warn' : 'gap';
  }
  function setSection(name, limit) { var t = name + ' · 제한 ' + limit; if (el._sec !== t) { el._sec = t; el.section.textContent = t; } }
  function setGear(g) { if (el._gear !== g) { el._gear = g; el.gear.textContent = g === 'R' ? 'R 후진' : ''; el.gear.style.display = g === 'R' ? '' : 'none'; } }
  function setScore(n) { el.score.textContent = n; }
  function setTimer(sec) { var m = Math.floor(sec / 60), s = Math.floor(sec % 60); el.timer.textContent = m + ':' + (s < 10 ? '0' : '') + s; }
  function setStops(n) { el.stops.textContent = n; }
  function setSiren(on) { el.sirenState.textContent = on ? '경광등 ON' : ''; el.sirenState.classList.toggle('on', on); if (el.btnSiren) el.btnSiren.classList.toggle('active', on); }
  function setTarget(text) { el.target.textContent = text || ''; el.target.style.display = text ? '' : 'none'; }
  function notice(text, kind, ms) { el.notice.textContent = text; el.notice.className = 'notice ' + (kind || 'info'); el.notice.style.opacity = 1; noticeT = (ms || 2600) / 1000; }
  function hint(text) {
    if (!settings.hints || hintGap > 0) return;
    hintGap = 2.5; el.hint.textContent = text; el.hint.style.opacity = 1; hintT = 3.2;
  }
  function tick(dt) {
    if (noticeT > 0) { noticeT -= dt; if (noticeT <= 0) el.notice.style.opacity = 0; }
    if (hintT > 0) { hintT -= dt; if (hintT <= 0) el.hint.style.opacity = 0; }
    if (hintGap > 0) hintGap -= dt;
  }
  function vignette(a) { el.vignette.style.opacity = TG.clamp(a, 0, 1); }
  function show(id, on) { el[id].style.display = on ? 'flex' : 'none'; }
  function showTitle(best) { el.best.textContent = best ? '최고 기록 ' + best.score + '점 · 단속 ' + best.stops + '건' : ''; show('title', true); }
  function hideTitle() { show('title', false); }
  function showIntro(on) { show('intro', on); }
  // 인트로 자막: 배열 중 idx 까지 보이게
  function introLines(lines, idx) {
    el.introLines.innerHTML = lines.map(function (l, i) { return '<div class="il' + (i <= idx ? ' on' : '') + (l.big ? ' big' : '') + (l.small ? ' small' : '') + '">' + l.text + '</div>'; }).join('');
  }
  function showPause(on) { show('pause', on); }
  function showEnd(stats) {
    var acc = stats.stops ? Math.round(stats.correct / stats.stops * 100) : 0;
    el.endStats.innerHTML =
      '<div class="row"><span>점수</span><b>' + stats.score + '</b></div>' +
      '<div class="row"><span>단속</span><b>' + stats.stops + '건 (정답률 ' + acc + '%)</b></div>' +
      '<div class="row"><span>보행자 계도</span><b>' + (stats.warned || 0) + '건</b></div>' +
      '<div class="row"><span>안전 주행 감점</span><b>' + stats.penalty + '</b></div>' +
      '<div class="row"><span>목격한 위반</span><b>' + stats.witnessed + '건</b></div>' +
      '<div class="lesson">오늘 배운 것: ' + stats.lesson + '</div>' + (stats.reason ? '<div class="reason">' + stats.reason + '</div>' : '');
    show('end', true);
  }
  function hideEnd() { show('end', false); }
  function showTicket(options, seconds, onChoice, question) {
    el.ticketOptions.innerHTML = ''; el.ticketResult.innerHTML = ''; el.ticketResult.style.display = 'none';
    el.btnTicketClose.style.display = 'none'; el.ticketQuestion.style.display = ''; el.ticketTimer.style.width = '100%';
    el.ticketQuestion.textContent = question || '위반 내용을 고르세요';
    options.forEach(function (o) {
      var b = document.createElement('button'); b.className = 'opt'; b.textContent = o.name; b.setAttribute('data-id', o.id);
      b.addEventListener('pointerdown', function (e) { e.preventDefault(); TG.audio.ui(); onChoice(o.id); });
      el.ticketOptions.appendChild(b);
    });
    show('ticket', true);
  }
  function ticketTimer(frac) { el.ticketTimer.style.width = Math.max(0, frac * 100) + '%'; }
  function ticketResult(lines, kind, onClose) {
    el.ticketOptions.innerHTML = ''; el.ticketQuestion.style.display = 'none'; el.ticketResult.style.display = 'block';
    el.ticketResult.className = 'result ' + kind;
    el.ticketResult.innerHTML = lines.map(function (l, i) { return '<div class="' + (i === 0 ? 'main' : 'sub') + '">' + l + '</div>'; }).join('');
    el.btnTicketClose.style.display = '';
    var closed = false, close = function () { if (closed) return; closed = true; onClose(); };
    el.btnTicketClose.onclick = close; el._ticketClose = close;
    setTimeout(close, 4500);
  }
  function hideTicket() { show('ticket', false); el._ticketClose = null; }
  function closeTicketNow() { if (el._ticketClose) el._ticketClose(); }
  function setHints(on) { settings.hints = on; }
  function setStopbar(on) { settings.stopbar = on; el.stopbarWrap.style.display = on ? '' : 'none'; }
  function showTouch(on) { el.touch.style.display = on ? 'block' : 'none'; }
  function showHud(on) { el.hud.style.display = on ? 'block' : 'none'; }
  return { init: init, setSpeed: setSpeed, setGap: setGap, setScore: setScore, setTimer: setTimer, setStops: setStops, setSiren: setSiren, setSection: setSection, setGear: setGear,
           setTarget: setTarget, notice: notice, hint: hint, vignette: vignette, showTitle: showTitle, hideTitle: hideTitle, showIntro: showIntro, introLines: introLines, showPause: showPause,
           showEnd: showEnd, hideEnd: hideEnd, showTicket: showTicket, ticketTimer: ticketTimer, ticketResult: ticketResult, hideTicket: hideTicket,
           closeTicketNow: closeTicketNow, setHints: setHints, setStopbar: setStopbar, showTouch: showTouch, showHud: showHud, tick: tick };
})();
