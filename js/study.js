// 학습 모드: 「교통사고 12대 중과실」 카드 + 「자전거·킥보드 안전」 카드 + 「체험하기」(게임 속 해당 상황으로 이동).
// 법령 문구·조문은 data/laws.json(study12 · rideSafe)에서만 읽는다 — 코드에는 숫자가 없다. verified:false 항목은 「확인 중」 표시.
// 자전거·킥보드 카드는 초등 / 중고등 / 공통으로 나눠 보여 준다(소유자: 「초등학생과 중고등학생을 위해서 만들자」).
TG.study = (function () {
  var el = null, isOpen = false;
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }
  function render(G) {
    if (!el) { el = document.createElement('div'); el.id = 'study'; el.className = 'overlay study'; document.body.appendChild(el); }
    var S = G.laws && G.laws.study12;
    // 닫기 단추가 카드 **맨 아래**에만 있어서, 카드가 길어지면 빠져나올 방법이 없었다
    // (소유자: 「교통사고 12대 중과실로 들어가면 빠져 나올 방법이 없어 갖혀버리게 되고」).
    // 위쪽에 붙어 따라다니는 닫기 줄을 둔다. Esc 와 바깥 클릭으로도 닫힌다.
    var html = '<div class="card wide"><div class="study-top"><span class="badge">학습 · 12대 중과실 · 어린이보호구역 · 안전띠 · 자전거·킥보드</span>' +
      '<button id="btnStudyX" class="study-x" aria-label="닫기">✕ 닫기</button></div><h2>' + esc(S ? S.title : '교통사고 12대 중과실') + '</h2>';
    html += '<div class="dim small">' + esc(S ? S.source : '법령 데이터(laws.json)를 읽지 못했습니다 — 파일로 열면 브라우저가 fetch 를 막습니다. 정적 서버나 GitHub Pages 로 여세요.') + '</div>';
    html += '<div class="cards">';
    (S ? S.items : []).forEach(function (it, i) {
      html += '<div class="sitem"><div class="num">' + (i + 1) + '</div><div class="body"><b>' + esc(it.name) + '</b>' +
        '<div class="law">' + esc(it.law) + (it.verified ? '' : ' <span class="chk">확인 중</span>') + '</div>' +
        '<div class="sit">' + esc(it.situation) + '</div><div class="tip">' + esc(it.tip) + '</div>' +
        (it.scene ? '<button class="ghost small" data-scene="' + esc(it.scene) + '">🚓 게임에서 체험하기</button>' : '') + '</div></div>';
    });
    html += '</div>';
    // ② 어린이보호구역 · ③ 자전거·킥보드 — 학년별로 묶어서. 항목에 scene 이 있으면 「게임에서 시연」 버튼이 붙는다.
    [G.laws && G.laws.schoolZone, G.laws && G.laws.carSafe, G.laws && G.laws.rideSafe].forEach(function (R) {
    if (R && R.items && R.items.length) {
      html += '<h2 style="margin-top:22px">' + esc(R.title) + '</h2>';
      html += '<div class="dim small">' + esc(R.source) + '</div>';
      var groups = [['초등', '🧒 초등학생'], ['중고등', '🎒 중·고등학생'], ['공통', '🚸 공통']];
      groups.forEach(function (g) {
        var list = R.items.filter(function (it) { return it.age === g[0]; });
        if (!list.length) return;
        html += '<div class="badge" style="margin:14px 0 6px">' + esc(g[1]) + '</div><div class="cards">';
        list.forEach(function (it, k) {
          html += '<div class="sitem"><div class="num">' + (k + 1) + '</div><div class="body"><b>' + esc(it.name) + '</b>' +
            '<div class="law">' + esc(it.law) + (it.verified ? '' : ' <span class="chk">확인 중</span>') + '</div>' +
            '<div class="sit">' + esc(it.situation) + '</div><div class="tip">' + esc(it.tip) + '</div>' +
            (it.scene ? '<button class="ghost small" data-scene="' + esc(it.scene) + '">🚓 게임에서 시연</button>' : '') +
            '</div></div>';
        });
        html += '</div>';
      });
    }
    });
    if (G.kidCourse && G.kidCourse.html) html += G.kidCourse.html();
    html += '<div class="dim small">이 게임은 법령의 정본이 아닙니다. 범칙금·벌점·조문은 T-Book 과 법령 원문으로 확인하세요.</div><button id="btnStudyClose" class="primary">닫기</button></div>';
    el.innerHTML = html;
    el.querySelectorAll('[data-scene]').forEach(function (b) { b.addEventListener('click', function () { close(); if (G.startScenario) G.startScenario(b.getAttribute('data-scene')); }); });
    document.getElementById('btnStudyClose').addEventListener('click', close);
    document.getElementById('btnStudyX').addEventListener('click', close);
    el.addEventListener('click', function (e) { if (e.target === el) close(); });   // 카드 바깥을 누르면 닫힌다
  }
  function open(G) { render(G); el.style.display = 'flex'; isOpen = true; }
  function close() { if (el) el.style.display = 'none'; isOpen = false; }
  return { open: open, close: close, isOpen: function () { return isOpen; } };
})();
