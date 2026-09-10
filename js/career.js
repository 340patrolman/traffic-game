// 근무 일지와 오답 노트. 이 게임의 두 구멍을 메운다.
//  ① 한 판이 끝나면 **아무것도 남지 않았다** — 내일 다시 켤 이유가 없었다. 누적 기록을 남긴다.
//  ② 틀린 문제가 **틀린 채로 지나갔다** — 학습은 반복과 복습에서 온다. 틀린 것을 모아 다시 보여 준다.
// 전부 이 기기에만 저장한다(localStorage, 키 접두사 tg_). 서버 0대·네트워크 요청 0 은 그대로다.
TG.Career = function (game) {
  var self = this;
  var C = null, W = null;

  function today() { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function daysBetween(a, b) {
    if (!a || !b) return 99;
    var pa = a.split('-'), pb = b.split('-');
    var ta = Date.UTC(+pa[0], +pa[1] - 1, +pa[2]), tb = Date.UTC(+pb[0], +pb[1] - 1, +pb[2]);
    return Math.round((tb - ta) / 86400000);
  }
  function load() {
    C = TG.save.get('career', null);
    if (!C || typeof C !== 'object') C = { shifts: 0, best: 0, total: 0, stops: 0, correct: 0, wrong: 0, modes: {}, last: '', streak: 0, days: 0 };
    ['shifts', 'best', 'total', 'stops', 'correct', 'wrong', 'streak', 'days'].forEach(function (k) { if (typeof C[k] !== 'number' || !isFinite(C[k])) C[k] = 0; });
    if (!C.modes || typeof C.modes !== 'object') C.modes = {};
    W = TG.save.get('wrong', null);
    if (!W || typeof W !== 'object') W = {};
  }
  function saveC() { TG.save.set('career', C); }
  function saveW() { TG.save.set('wrong', W); }
  load();

  // ---- 오답 노트 ----
  // 맞히면 그 항목의 남은 횟수가 하나 줄고, 0 이 되면 노트에서 빠진다. 틀리면 다시 는다.
  self.noteAnswer = function (id, correct) {
    if (!id || id === 'none') { if (correct) C.correct++; else C.wrong++; saveC(); return; }
    if (correct) {
      C.correct++;
      if (W[id]) { W[id].left--; W[id].ok = (W[id].ok || 0) + 1; if (W[id].left <= 0) delete W[id]; saveW(); }
    } else {
      C.wrong++;
      var w = W[id] = W[id] || { n: 0, left: 0, ok: 0, at: '' };
      w.n++; w.left = Math.min(3, w.left + 2);   // 두 번 더 맞혀야 노트에서 빠진다(최대 3)
      w.at = today();
      saveW();
    }
    saveC();
  };
  self.wrongList = function () {
    return Object.keys(W).map(function (id) { return { id: id, n: W[id].n, left: W[id].left, at: W[id].at }; })
      .sort(function (a, b) { return b.n - a.n || (a.id < b.id ? -1 : 1); });
  };
  self.wrongCount = function () { return Object.keys(W).length; };
  self.clearWrong = function () { W = {}; saveW(); };

  // ---- 근무 일지 ----
  self.finishShift = function (info) {
    info = info || {};
    var t = today();
    if (C.last !== t) {
      C.streak = daysBetween(C.last, t) === 1 ? C.streak + 1 : 1;
      C.days++;
      C.last = t;
    }
    C.shifts++;
    var sc = isFinite(info.score) ? info.score : 0;
    C.total += sc;
    if (sc > C.best) C.best = sc;
    C.stops += isFinite(info.stops) ? info.stops : 0;
    var m = info.mode || 'patrol';
    C.modes[m] = (C.modes[m] || 0) + 1;
    saveC();
    return self.summary();
  };
  self.summary = function () {
    var tries = C.correct + C.wrong;
    return {
      shifts: C.shifts, best: C.best, total: C.total, stops: C.stops,
      correct: C.correct, wrong: C.wrong,
      rate: tries ? Math.round(C.correct / tries * 100) : null,
      streak: C.streak, days: C.days, modes: C.modes,
      wrongOpen: self.wrongCount()
    };
  };
  // 타이틀·결과에 쓰는 한 줄
  self.line = function () {
    var s = self.summary();
    if (!s.shifts) return '';
    var bits = ['근무 ' + s.shifts + '회'];
    if (s.rate !== null) bits.push('정답률 ' + s.rate + '%');
    bits.push('최고 ' + s.best + '점');
    if (s.streak > 1) bits.push('연속 ' + s.streak + '일');
    if (s.wrongOpen) bits.push('다시 볼 것 ' + s.wrongOpen + '개');
    return bits.join(' · ');
  };
  self.reset = function () { C = null; W = null; TG.save.set('career', null); TG.save.set('wrong', null); load(); };

  // ---- 학습 화면에 붙는 「다시 볼 것」 ----
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function lawOf(id) {
    var L = game.laws; if (!L || !L.violations) return null;
    for (var i = 0; i < L.violations.length; i++) if (L.violations[i].id === id) return L.violations[i];
    return null;
  }
  self.html = function () {
    var list = self.wrongList();
    var s = self.summary();
    var h = '';
    if (s.shifts) {
      h += '<h2 style="margin-top:22px">📒 근무 일지</h2>';
      h += '<div class="dim small">이 기기에만 남습니다. 서버로 보내지 않습니다.</div>';
      h += '<div class="cards"><div class="sitem"><div class="num">📊</div><div class="body">' +
        '<b>' + esc(self.line()) + '</b>' +
        '<div class="sit">단속 ' + s.stops + '회 · 정답 ' + s.correct + ' · 오답 ' + s.wrong +
        (s.days ? ' · 근무한 날 ' + s.days + '일' : '') + '</div>' +
        '<div class="tip">' + Object.keys(s.modes).map(function (m) { return (MODE_KO[m] || m) + ' ' + s.modes[m]; }).join(' · ') + '</div>' +
        '</div></div></div>';
    }
    if (!list.length) return h;
    h += '<h2 style="margin-top:22px">📕 다시 볼 것 — 틀린 ' + list.length + '개</h2>';
    h += '<div class="dim small">틀린 항목은 <b>두 번 더 맞혀야</b> 이 목록에서 빠집니다. 학습은 반복에서 옵니다.</div>';
    h += '<div class="cards">';
    list.forEach(function (w, i) {
      var L = lawOf(w.id);
      h += '<div class="sitem"><div class="num">' + (i + 1) + '</div><div class="body">' +
        '<b>' + esc(L ? L.short || L.name : w.id) + ' <span class="chk">' + w.left + '번 더 맞히면 빠집니다</span></b>' +
        (L && L.law ? '<div class="law">' + esc(L.law.act + ' ' + L.law.article) + (L.law.verified === false ? ' <span class="chk">확인 중</span>' : '') + '</div>' : '') +
        (L && L.field ? '<div class="sit">' + esc(L.field) + '</div>' : '') +
        '<div class="tip">틀린 횟수 ' + w.n + (w.at ? ' · 마지막 ' + esc(w.at) : '') + '</div>' +
        '</div></div>';
    });
    h += '</div>';
    return h;
  };
  var MODE_KO = { patrol: '순찰', duty: '교차로', chase: '추격', walk: '보행', kid: '어린이 교실', free: '자유', circuit: '서킷' };
};
