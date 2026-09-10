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
  function setSection(name, limit) { var t = name + ' · 제한 ' + ((limit === '—' || limit >= 999) ? '없음' : limit); if (el._sec !== t) { el._sec = t; el.section.textContent = t; } }
  function setGear(g) { if (el._gear !== g) { el._gear = g; el.gear.textContent = g === 'R' ? 'R 후진' : ''; el.gear.style.display = g === 'R' ? '' : 'none'; } }
  function setScore(n) { el.score.textContent = n; }
  function setTimer(sec) { var m = Math.floor(sec / 60), s = Math.floor(sec % 60); el.timer.textContent = m + ':' + (s < 10 ? '0' : '') + s; }
  function setStops(n) { el.stops.textContent = n; }
  function setSiren(on) { el.sirenState.textContent = on ? '경광등 ON' : ''; el.sirenState.classList.toggle('on', on); if (el.btnSiren) el.btnSiren.classList.toggle('active', on); }
  function setTarget(text) { el.target.textContent = text || ''; el.target.style.display = text ? '' : 'none'; }
  function notice(text, kind, ms) {
    el.notice.textContent = text; el.notice.className = 'notice ' + (kind || 'info'); el.notice.style.opacity = 1; noticeT = (ms || 2600) / 1000;
    pushKidChips();
  }
  // 좁은 화면에서는 안내문이 두세 줄이 되어 **어린이 4단계 칩을 덮었다**(화면 점검에서 발견).
  // 안내문 높이만큼 칩을 아래로 내린다. 안내문이 사라지면 되돌린다.
  function pushKidChips() {
    var kn = document.getElementById('kidNow'); if (!kn) return;
    var h = el.notice.style.opacity > 0 ? el.notice.getBoundingClientRect().height : 0;
    kn.style.transform = h > 40 ? 'translateY(' + Math.round(h - 34) + 'px)' : '';
  }
  function hint(text) {
    if (!settings.hints || hintGap > 0) return;
    hintGap = 2.5; el.hint.textContent = text; el.hint.style.opacity = 1; hintT = 3.2;
  }
  function tick(dt) {
    if (noticeT > 0) { noticeT -= dt; if (noticeT <= 0) { el.notice.style.opacity = 0; pushKidChips(); } }
    if (hintT > 0) { hintT -= dt; if (hintT <= 0) el.hint.style.opacity = 0; }
    if (hintGap > 0) hintGap -= dt;
  }
  function vignette(a) { el.vignette.style.opacity = TG.clamp(a, 0, 1); }
  function show(id, on) { el[id].style.display = on ? 'flex' : 'none'; }
  // 타이틀에 **누적 근무 일지**를 함께 보인다 — 한 판이 끝나면 아무것도 안 남던 것을 메운다.
  function showTitle(best, careerLine) {
    var a = best ? '최고 기록 ' + best.score + '점 · 단속 ' + best.stops + '건' : '';
    el.best.textContent = careerLine ? (a ? a + '\n' + careerLine : careerLine) : a;
    el.best.classList.toggle('two', !!(a && careerLine));
    show('title', true);
  }
  function hideTitle() { show('title', false); }
  function showIntro(on) { show('intro', on); }
  // 인트로 자막: 배열 중 idx 까지 보이게
  function introLines(lines, idx) {
    el.introLines.innerHTML = lines.map(function (l, i) { return '<div class="il' + (i <= idx ? ' on' : '') + (l.big ? ' big' : '') + (l.small ? ' small' : '') + '">' + l.text + '</div>'; }).join('');
  }
  function showPause(on) { show('pause', on); }
  function showEnd(stats) {
    var acc = stats.stops ? Math.round(stats.correct / stats.stops * 100) : 0, starsN = stats.stars === undefined ? 0 : stats.stars, sh = '';
    for (var si = 0; si < 5; si++) sh += '<span class="' + (si < starsN ? 'on' : 'off') + '">★</span>';
    var bh = (stats.badges || []).map(function (b) { return '<span class="badge2' + (b.gold ? ' gold' : '') + '">' + b.text + '</span>'; }).join('');
    el.endStats.innerHTML =
      '<div class="stars">' + sh + '</div>' + (bh ? '<div class="badges">' + bh + '</div>' : '') +
      '<div class="row"><span>점수</span><b>' + stats.score + '</b></div>' +
      '<div class="row"><span>단속</span><b>' + stats.stops + '건 (정답률 ' + acc + '%)</b></div>' +
      '<div class="row"><span>보행자 계도</span><b>' + (stats.warned || 0) + '건</b></div>' +
      '<div class="row"><span>안전 주행 감점</span><b>' + stats.penalty + '</b></div>' +
      '<div class="row"><span>목격한 위반</span><b>' + stats.witnessed + '건</b></div>' +
      (stats.incidents ? '<div class="row"><span>✅ 현장 안전조치</span><b>' + stats.incidents + '건</b></div>' : '') +
      ((stats.videos || stats.radios || stats.handedOver) ? '<div class="row"><span>📹 영상 단속 · 📡 무전</span><b>' + (stats.videos || 0) + '건 · ' + (stats.radios || 0) + '회' + (stats.handedOver ? ' (인계 ' + stats.handedOver + ')' : '') + '</b></div>' : '') +
      '<div class="lesson">오늘 배운 것: ' + stats.lesson + '</div>' + (stats.reason ? '<div class="reason">' + stats.reason + '</div>' : '') +
      // 틀린 것을 그냥 지나치지 않는다 — 무엇을 다시 봐야 하는지 여기서 말해 준다
      (stats.review ? '<div class="review">📕 다시 볼 것 · ' + stats.review + '</div>' : '') +
      (stats.career ? '<div class="career">📒 ' + stats.career + '</div>' : '');
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
  function setTimerText(t) { el.timer.textContent = t; }
  // 게임 감각: 점수 팝(떠오르는 숫자) · 위반 포착 플래시 · 별 터짐
  function pop(text, kind) { var box = $('pops'); if (!box) return; var d = document.createElement('div'); d.className = 'pop ' + (kind || ''); d.textContent = text; d.style.left = (44 + Math.random() * 12) + '%'; box.appendChild(d); setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, 1400); }
  function flash() { var f = $('flash'); if (!f) return; f.classList.remove('on'); void f.offsetWidth; f.classList.add('on'); }
  function burst(emoji, n) { var box = $('pops'); if (!box) return; for (var i = 0; i < (n || 8); i++) { var s = document.createElement('div'); s.className = 'burst'; s.textContent = emoji; var a = Math.random() * Math.PI * 2, r = 60 + Math.random() * 120; s.style.left = '50%'; s.style.top = '42%'; s.style.setProperty('--dx', Math.cos(a) * r + 'px'); s.style.setProperty('--dy', (Math.sin(a) * r - 40) + 'px'); box.appendChild(s); (function (el2) { setTimeout(function () { if (el2.parentNode) el2.parentNode.removeChild(el2); }, 1500); })(s); } }
  function setSectionText(t) { if (el._sec !== t) { el._sec = t; el.section.textContent = t; } }
  function hintNow(text) { hintGap = 0; hint(text); }   // 감속 시점처럼 급한 안내: 간격 무시
  // 모드를 바꿀 때 앞 모드의 안내를 **지운다**. hint('') 는 hintGap 에 막히고 빈 글씨로 남을 뿐이라 따로 둔다.
  function clearHint() { hintGap = 0; hintT = 0; el.hint.textContent = ''; el.hint.style.opacity = 0; noticeT = 0; el.notice.style.opacity = 0; }
  return { init: init, setTimerText: setTimerText, setSectionText: setSectionText, pop: pop, flash: flash, burst: burst, hintNow: hintNow, setSpeed: setSpeed, setGap: setGap, setScore: setScore, setTimer: setTimer, setStops: setStops, setSiren: setSiren, setSection: setSection, setGear: setGear,
           setTarget: setTarget, notice: notice, hint: hint, clearHint: clearHint, vignette: vignette, showTitle: showTitle, hideTitle: hideTitle, showIntro: showIntro, introLines: introLines, showPause: showPause,
           showEnd: showEnd, hideEnd: hideEnd, showTicket: showTicket, ticketTimer: ticketTimer, ticketResult: ticketResult, hideTicket: hideTicket,
           closeTicketNow: closeTicketNow, setHints: setHints, setStopbar: setStopbar, showTouch: showTouch, showHud: showHud, tick: tick };
})();
