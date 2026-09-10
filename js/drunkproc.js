// 음주운전 적발 절차. 법령·시행규칙에 적힌 순서를 그대로 밟게 한다 — 순서를 틀리면 왜 틀렸는지 조문으로 알려 준다.
// 수치·처벌·면허처분·조문은 **코드에 없다**. 전부 data/laws.json 의 drunkProc 에서 읽는다(원문 대조 2026-09-10).
// 소유자: 「음주운전 감지기와 측정기가 있는거 알지 적발절차를 미리 다 찾아 놓고 게임이지만 현실을 반영해서 하자」
TG.DrunkProc = function (game) {
  var self = this, el = null, S = null, open = false;
  function P() { return game.laws && game.laws.drunkProc ? game.laws.drunkProc : null; }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  // 대상마다 숨은 값을 한 번만 정한다: 혈중알코올농도, 측정 거부 여부, 결과 불복 여부
  function roll(car) {
    if (car.dp) return car.dp;
    var r = Math.random();
    var bac;
    if (r < 0.12) bac = 0;                                   // 감지기 무반응 — 술을 마시지 않았다
    else if (r < 0.24) bac = 0.01 + Math.random() * 0.019;   // 기준 미만(0.03% 미만)
    else if (r < 0.62) bac = 0.03 + Math.random() * 0.049;   // 0.03~0.08
    else if (r < 0.90) bac = 0.08 + Math.random() * 0.119;   // 0.08~0.2
    else bac = 0.20 + Math.random() * 0.09;                  // 0.2 이상
    car.dp = {
      bac: Math.round(bac * 1000) / 1000,
      refuse: bac >= 0.03 && Math.random() < 0.18,           // 측정 거부
      object: bac >= 0.03 && Math.random() < 0.25,           // 결과 불복 → 채혈
      kind: car.isPM ? 'pm' : car.isBike ? 'bike' : 'car',
      done: {}, order: [], miss: 0, score: 0, ended: null
    };
    return car.dp;
  }
  function gradeOf(bac) {
    var p = P(); if (!p) return null;
    for (var i = 0; i < p.grades.length; i++) {
      var g = p.grades[i];
      if (bac >= g.min && (g.max === null || bac < g.max)) return g;
    }
    return null;
  }

  // 각 단계를 지금 눌러도 되는가. 되면 null, 안 되면 왜 안 되는지(조문 포함).
  function gate(id) {
    var d = S.dp, done = d.done;
    if (id === 'suspect') return done.suspect ? '이미 했습니다' : null;
    if (id === 'detect') return done.suspect ? null : '먼저 **세울 이유**를 남깁니다 — 외관·언행·태도·운전 행태 (도로교통법 시행규칙 제27조의2 제2항 제1호 가목)';
    if (id === 'rinse') return done.detect ? null : '감지기 반응을 먼저 확인합니다 — 반응이 없으면 측정으로 넘어가지 않습니다';
    if (id === 'breath') return done.rinse ? null : '**음용수를 먼저 제공**합니다 — 입 안의 잔류 알코올을 헹궈야 합니다 (도로교통법 시행규칙 제27조의2 제2항 제1호 나목)';
    if (id === 'tell') return done.breath ? null : '측정을 먼저 합니다';
    if (id === 'blood') {
      if (!done.tell) return '결과를 먼저 고지합니다 — 불복하면 채혈로 다시 잴 수 있음을 알립니다 (도로교통법 제44조 제3항)';
      if (!d.objectShown) return '운전자가 불복 의사를 밝히지 않았습니다 — 결과 고지에서 확인합니다';
      return null;
    }
    return null;
  }

  function act(id) {
    var d = S.dp, p = P();
    var why = gate(id);
    if (why) {
      d.miss++; game.addScore(-5, null);
      game.hud.notice('⛔ 순서가 다릅니다 (−5) — ' + why.replace(/\*\*/g, ''), 'bad', 5200);
      TG.audio.bad(); render(); return;
    }
    d.done[id] = true; d.order.push(id);
    TG.audio.ui();
    if (id === 'suspect') game.hud.notice('📝 의심 사유를 남겼습니다 — 사행 주행 · 신호 반응 지연', 'info', 2600);
    else if (id === 'detect') {
      if (d.bac <= 0) {
        d.ended = 'clean';
        game.hud.notice('감지기 무반응 — 음주가 아닙니다. 다른 위반이 없으면 보냅니다', 'good', 4200);
        game.addScore(15, null);
      } else game.hud.notice('🔴 감지기 반응 — 알코올이 있습니다. 다만 이것은 **수치가 아닙니다**', 'warn', 4200);
    }
    else if (id === 'rinse') game.hud.notice('💧 음용수 제공 — 입 안을 헹구게 합니다 (시행규칙 제27조의2 제2항 제1호 나목)', 'info', 4200);
    else if (id === 'breath') {
      if (d.refuse) { d.ended = 'refuse'; game.hud.notice('🚫 측정 거부 — 수치를 못 재도 처벌과 면허취소가 따릅니다', 'alert', 5200); TG.audio.alert(); }
      else game.hud.notice('측정값 ' + d.bac.toFixed(3) + '% — 결과를 고지합니다', 'alert', 4200);
    }
    else if (id === 'tell') {
      if (d.object) { d.objectShown = true; game.hud.notice('운전자가 결과에 **불복**합니다 — 동의를 받아 채혈로 다시 잽니다 (제44조 제3항)', 'warn', 5200); }
      else { d.ended = d.bac >= (p ? p.threshold.value : 0.03) ? 'measured' : 'under'; }
    }
    else if (id === 'blood') { d.ended = 'blood'; game.hud.notice('🩸 의료기관에서 비알콜성 소독약으로 채혈 → 국립과학수사연구원 등에 감정 의뢰', 'info', 5200); }
    render();
  }

  function finish() {
    var d = S.dp, base = d.ended === 'clean' ? 0 : 40;
    var got = Math.max(0, base - d.miss * 5);
    if (got) { game.addScore(got, null); game.stats.correct++; }
    game.hud.notice(d.miss === 0 ? '✅ 절차대로 처리했습니다 (+' + got + ')' : '처리 완료 — 순서 오류 ' + d.miss + '회 (+' + got + ')',
      d.miss === 0 ? 'good' : 'warn', 4200);
    if (d.miss === 0) TG.audio.jingle(3); else TG.audio.good();
    close();
  }

  function render() {
    var p = P(), d = S.dp;
    if (!el) { el = document.createElement('div'); el.id = 'dproc'; el.className = 'overlay study'; document.body.appendChild(el); }
    if (!p) { el.innerHTML = '<div class="card wide"><h2>음주 절차</h2><div class="dim small">data/laws.json 을 읽지 못했습니다.</div><button id="dpX" class="primary">닫기</button></div>'; el.style.display = 'flex'; document.getElementById('dpX').addEventListener('click', close); return; }
    var h = '<div class="card wide"><div class="study-top"><span class="badge">🍺 음주운전 적발 절차 · ' +
      (d.kind === 'pm' ? '개인형 이동장치' : d.kind === 'bike' ? '자전거' : '자동차') + '</span>' +
      '<button id="dpX" class="study-x" aria-label="중단">✕ 중단</button></div>';
    h += '<h2>' + esc(p.title) + '</h2>';
    h += '<div class="dim small">' + esc(p.source) + '</div>';
    h += '<div class="dp-steps">';
    p.steps.forEach(function (st) {
      var okd = !!d.done[st.id], cur = !okd && !gate(st.id);
      var lock = !okd && !cur;
      h += '<div class="dp-step' + (okd ? ' done' : cur ? ' now' : ' lock') + '">' +
        '<div class="dp-n">' + (okd ? '✓' : st.n) + '</div><div class="dp-b">' +
        '<b>' + esc(st.name) + '</b>' + (st.device ? '<span class="dp-dev">' + esc(st.device) + '</span>' : '') +
        '<div class="law">' + (st.law ? esc(st.law) : '법령에 근거 조문 없음 — 실무 장비') + (st.verified ? '' : ' <span class="chk">조문 없음</span>') + '</div>' +
        '<div class="sit">' + esc(st.text) + '</div>' +
        '<div class="tip">' + esc(st.field) + '</div>' +
        (okd || d.ended ? '' : '<button class="ghost small" data-dp="' + st.id + '">' + (cur ? '▶ 이 단계 하기' : '이 단계 하기') + '</button>') +
        '</div></div>';
    });
    h += '</div>';
    // 결과
    if (d.ended) {
      h += '<div class="dp-res">';
      if (d.ended === 'clean') h += '<b>음주 아님</b><div class="sit">감지기에 반응이 없었습니다. 측정으로 넘어가지 않습니다.</div>';
      else if (d.ended === 'refuse') {
        var r = p.refuse;
        h += '<b>측정 거부 — ' + esc(r.name) + '</b><div class="law">' + esc(r.law) + ' · 벌칙 ' + esc(r.punishLaw) + '</div>';
        if (d.kind === 'car') h += '<div class="sit">' + esc(r.punish) + '<br>' + esc(r.licence) + ' (' + esc(r.licenceLaw) + ')</div>';
        else h += '<div class="sit">' + bikeRow('호흡조사 측정 불응', d.kind) + '</div>';
        h += '<div class="tip">' + esc(r.note) + '</div>';
      } else if (d.ended === 'under') h += '<b>기준 미만 — ' + d.bac.toFixed(3) + '%</b><div class="law">' + esc(p.threshold.law) + '</div><div class="sit">' + esc(p.threshold.text) + '. 기준에 미치지 않아 음주운전으로 처리하지 않습니다.</div>';
      else {
        var g = gradeOf(d.bac);
        h += '<b>측정값 ' + d.bac.toFixed(3) + '% — ' + (g ? esc(g.name) : '') + '</b>';
        if (d.ended === 'blood') h += '<div class="tip">호흡조사 결과에 불복 → 동의를 받아 채혈. 최종 수치는 감정 결과로 정해집니다.</div>';
        if (d.kind === 'car' && g) h += '<div class="law">' + esc(g.punishLaw) + ' · ' + esc(g.licenceLaw) + '</div>' +
          '<div class="sit">' + esc(g.punish) + '<br>' + esc(g.licence) + '</div>';
        else if (g) h += '<div class="sit">' + bikeRow('술에 취한 상태에서 자전거등 운전', d.kind) + '</div>';
      }
      h += '<button id="dpDone" class="primary">처리 완료</button></div>';
    }
    h += '<div class="dim small">' + esc(p.notice) + '</div>';
    // **구현과 현실의 차이를 화면에 드러낸다**(소유자: 「구현된것과 현실의 괴리가 없어야 함」).
    // 숨기면 게임을 실무로 착각하게 된다. 모르는 것은 모른다고 적는다.
    h += '<div class="dp-gap"><b>이 화면과 실제의 차이</b>' +
      '<div class="sit">측정값은 <b>연습용 임의값</b>입니다 — 실제 단속 통계가 아닙니다. ' +
      '조문·처벌·면허처분·범칙금만 원문에서 옮겼습니다.</div>';
    if (p.unverified && p.unverified.length) {
      h += '<div class="sit" style="margin-top:6px">아래는 <b>1차 출처를 찾지 못해 넣지 않은 것</b>입니다 — 실제 현장에서는 더 있습니다.</div><ul class="dp-un">';
      p.unverified.forEach(function (u) { h += '<li>' + esc(u) + '</li>'; });
      h += '</ul>';
    }
    h += '</div>';
    h += '</div>';
    el.innerHTML = h;
    el.style.display = 'flex';
    el.querySelectorAll('[data-dp]').forEach(function (b) { b.addEventListener('click', function () { act(b.getAttribute('data-dp')); }); });
    document.getElementById('dpX').addEventListener('click', close);
    var fin = document.getElementById('dpDone'); if (fin) fin.addEventListener('click', finish);
    el.onclick = function (e) { if (e.target === el) close(); };
  }
  function bikeRow(caseName, kind) {
    var p = P(); if (!p || !p.bike) return '';
    var row = p.bike.rows.filter(function (r) { return r.case === caseName; })[0];
    if (!row) return '';
    var won = kind === 'pm' ? row.pm : row.bike;
    return esc(p.bike.note) + '<br>범칙금 ' + won.toLocaleString('ko-KR') + '원 · ' + esc(p.bike.law);
  }

  self.start = function (car) {
    if (!P()) return false;
    S = { car: car, dp: roll(car) };
    open = true;
    game.setPaused(true, 'dproc');
    render();
    return true;
  };
  function close() { open = false; if (el) el.style.display = 'none'; game.setPaused(false, 'dproc'); }
  self.close = close;
  self.isOpen = function () { return open; };
};
