// 학습 모드: 「교통사고 12대 중과실」 카드 + 「체험하기」(게임 속 해당 상황으로 이동).
// 법령 문구·조문은 data/laws.json(study12)에서만 읽는다 — 코드에는 숫자가 없다. verified:false 항목은 「확인 중」 표시.
TG.study = (function () {
  var el = null, isOpen = false;
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }
  function render(G) {
    if (!el) { el = document.createElement('div'); el.id = 'study'; el.className = 'overlay study'; document.body.appendChild(el); }
    var S = G.laws && G.laws.study12;
    var html = '<div class="card wide"><div class="badge">학습 · 도로교통법 상황 12</div><h2>' + esc(S ? S.title : '교통사고 12대 중과실') + '</h2>';
    html += '<div class="dim small">' + esc(S ? S.source : '법령 데이터(laws.json)를 읽지 못했습니다 — 파일로 열면 브라우저가 fetch 를 막습니다. 정적 서버나 GitHub Pages 로 여세요.') + '</div>';
    html += '<div class="cards">';
    (S ? S.items : []).forEach(function (it, i) {
      html += '<div class="sitem"><div class="num">' + (i + 1) + '</div><div class="body"><b>' + esc(it.name) + '</b>' +
        '<div class="law">' + esc(it.law) + (it.verified ? '' : ' <span class="chk">확인 중</span>') + '</div>' +
        '<div class="sit">' + esc(it.situation) + '</div><div class="tip">' + esc(it.tip) + '</div>' +
        (it.scene ? '<button class="ghost small" data-scene="' + esc(it.scene) + '">🚓 게임에서 체험하기</button>' : '') + '</div></div>';
    });
    html += '</div><div class="dim small">이 게임은 법령의 정본이 아닙니다. 범칙금·벌점·조문은 T-Book 과 법령 원문으로 확인하세요.</div><button id="btnStudyClose" class="primary">닫기</button></div>';
    el.innerHTML = html;
    el.querySelectorAll('[data-scene]').forEach(function (b) { b.addEventListener('click', function () { close(); if (G.startScenario) G.startScenario(b.getAttribute('data-scene')); }); });
    document.getElementById('btnStudyClose').addEventListener('click', close);
  }
  function open(G) { render(G); el.style.display = 'flex'; isOpen = true; }
  function close() { if (el) el.style.display = 'none'; isOpen = false; }
  return { open: open, close: close, isOpen: function () { return isOpen; } };
})();
