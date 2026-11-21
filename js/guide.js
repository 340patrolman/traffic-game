// 🎨 그림으로 보는 설정·조작(v0.10.158 · v0.10.159 📖 그림 사전 빠짐없이) — 소유자(2026-11-22): 「설정칸에 할 수 있는 것들을 이미지와 모션으로 · 모르는 사람은 아예 모르겠다 ·
//  그려서 보여 줄 수도, 그냥 보여 줄 수도, 다르게 볼 수도 있게 · 어떻게 쓰는지를 시각적으로」.
//  세 가지 보기:
//   ① 🎨 그려서 — 일시정지 메뉴의 줄마다 움직이는 작은 그림(켜고 끄면 그림이 같이 바뀐다). 그림을 누르면 크게 「켜면 ↔ 끄면」을 나란히.
//   ② 🎬 움직여서 — 「이렇게 합니다」: 작은 폰 화면에서 손가락이 실제 단추 자리를 눌러 가며 출발 → 경광등 → 단속 → 갓길 정차 → 하차까지 보여 준다.
//   ③ 🏷 그냥(실제 화면에) — 메뉴를 걷고 지금 화면의 단추마다 이름표를 붙인다(옮겨 둔 단추도 실제 자리 그대로 · 아무 데나 누르면 메뉴로).
//  글은 그대로 「📝 글로 보기」(조작 설명). 통신·저장 없음 — 이 파일은 그림과 안내만 다루고 설정 값은 기존 입력칸(change 이벤트)으로만 바꾼다.
(function () {
  'use strict';
  function $(id) { return document.getElementById(id); }
  function G() { return TG.game || {}; }
  function tap(el, fn) { if (el) el.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); if (TG.audio && TG.audio.resume) TG.audio.resume(); fn(e); }); }
  var RM = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ───────── ① 그림(SVG 120×72) ─────────
  var ROAD = '<rect width="120" height="72" rx="9" fill="#1b2332"/><rect y="20" width="120" height="34" fill="#3b4352"/><path d="M0 37H120" stroke="#e9e9e9" stroke-width="1.4" stroke-dasharray="7 6"/><path d="M0 20.5H120M0 53.5H120" stroke="#f3c64a" stroke-width="1"/>';
  // 순찰차(위에서 본 것 · 오른쪽을 본다) — 바깥 g 는 자리, 안쪽 .mv 가 움직인다
  function PC(x, y, cls, extra) {
    return '<g transform="translate(' + x + ',' + y + ')"><g class="mv ' + (cls || '') + '">' + (extra || '') +
      '<rect x="0" y="-6" width="24" height="12" rx="3.2" fill="#f4f6fa"/><rect x="2" y="-6" width="20" height="2.2" fill="#2f5fd0"/><rect x="15.5" y="-4.6" width="5" height="9.2" rx="1.6" fill="#86b6ff" opacity=".85"/>' +
      '<rect class="lbr" x="9" y="-5" width="3" height="4.6" fill="#ff3b30"/><rect class="lbb" x="9" y=".4" width="3" height="4.6" fill="#2f7bff"/>' +
      '<rect class="brk" x="-1" y="-5" width="1.8" height="10" fill="#ff2b2b"/></g></g>';
  }
  function TXT(x, y, s, t, cls, fill) { return '<text class="' + (cls || '') + '" x="' + x + '" y="' + y + '" font-size="' + s + '" text-anchor="middle" fill="' + (fill || '#e6ecf5') + '" font-weight="700">' + t + '</text>'; }
  var STOPLINE = '<rect x="99" y="37" width="3" height="16.5" fill="#fff"/>';
  var LIGHT = '<rect x="106" y="4" width="11" height="25" rx="2.5" fill="#0d1018"/><circle cx="111.5" cy="10" r="3.4" fill="#ff3b30"/><circle cx="111.5" cy="17" r="3.4" fill="#3a2a10"/><circle cx="111.5" cy="24" r="3.4" fill="#123018"/>';
  var PICS = {
    optHints: { t: '교육 안내 표시', on: '운전하는 동안 지킬 것을 화면에 짧은 글로 알려 줍니다(정지선·보행자·제한속도…)', off: '안내 글이 뜨지 않습니다 — 익숙해진 뒤에',
      svg: function () { return ROAD + STOPLINE + PC(4, 45, 'dr') + '<g class="x-on bub"><rect x="40" y="3" width="76" height="15" rx="5" fill="#ffe9a8"/><path d="M60 18l4 5 3-5z" fill="#ffe9a8"/>' + TXT(78, 13.6, 8.6, '💡 정지선 앞에서 멈춤', '', '#3a2a00') + '</g>'; } },
    optStopbar: { t: '정지거리 바', on: '지금 속도로 브레이크를 밟으면 몇 m 가서 서는지 차 앞에 막대로 — 빠를수록 길어집니다(계기 칸에 숫자도)', off: '막대가 없습니다',
      svg: function () { return ROAD + STOPLINE + PC(4, 45, 'dr', '<rect class="x-on sb" x="25" y="-3.5" width="44" height="7" rx="2" fill="#5fe08a" opacity=".55" stroke="#9cffbd" stroke-width=".8"/>') + TXT(60, 13, 8.5, '정지거리', 'x-on'); } },
    optSound: { t: '소리', on: '경광등·무전·안내 방송이 들립니다', off: '아무 소리도 안 납니다',
      svg: function () { return '<rect width="120" height="72" rx="9" fill="#1b2332"/><path d="M38 28h10l12-10v36L48 44H38z" fill="#e6ecf5"/><g class="x-on wv"><path class="w1" d="M66 28q6 8 0 16" stroke="#9cd2ff" stroke-width="3" fill="none" stroke-linecap="round"/><path class="w2" d="M72 22q11 14 0 28" stroke="#9cd2ff" stroke-width="3" fill="none" stroke-linecap="round"/><path class="w3" d="M78 16q16 20 0 40" stroke="#9cd2ff" stroke-width="3" fill="none" stroke-linecap="round"/></g><path class="x-off" d="M68 26l18 20M86 26L68 46" stroke="#ff6b6b" stroke-width="3.5" stroke-linecap="round"/>'; } },
    optMusic: { t: '근무 배경 음악', on: '순찰 중 잔잔한 음악 · 사건이 생기면 음악이 올라옵니다', off: '음악 없이 도로 소리만',
      svg: function () { return '<rect width="120" height="72" rx="9" fill="#1b2332"/><g class="x-on nt">' + TXT(40, 50, 22, '♪', 'n1', '#ffd36b') + TXT(62, 46, 22, '♫', 'n2', '#9cd2ff') + TXT(84, 52, 22, '♪', 'n3', '#b6f0a8') + '</g><g class="x-off">' + TXT(60, 47, 24, '♫', '', '#5b6577') + '<path d="M44 22L78 56" stroke="#ff6b6b" stroke-width="3.5" stroke-linecap="round"/></g>'; } },
    optAssist: { t: '차선 유지 보조', on: '핸들에서 손을 떼면 차가 스스로 차로 가운데로 돌아옵니다', off: '손을 떼도 그대로 — 차가 옆 차로로 흘러갑니다',
      svg: function () { return ROAD + PC(4, 45, 'as') + TXT(28, 12, 8, '✋ 핸들 놓음') + '<g class="x-off wn">' + TXT(90, 14, 8.5, '⚠ 차로 넘음', '', '#ff8a8a') + '</g><g class="x-on ok">' + TXT(92, 14, 8.5, '✔ 가운데로', '', '#8ff0a8') + '</g>'; } },
    optEasy: { t: '초보 운전 보조', on: '핸들이 덜 민감해지고, 멈춰야 할 때 살짝 자동으로 브레이크를 겁니다', off: '내가 밟는 만큼만 — 늦게 밟으면 정지선을 넘습니다',
      svg: function () { return ROAD + STOPLINE + LIGHT + PC(4, 45, 'ez') + '<g class="x-on ok">' + TXT(44, 13, 8, '살짝 자동 제동', '', '#ffd36b') + '</g><g class="x-off wn">' + TXT(44, 13, 8, '⚠ 정지선 넘음', '', '#ff8a8a') + '</g>'; } },
    optVibrate: { t: '충돌 진동', on: '부딪히면 폰이 떨립니다(안드로이드 · 아이폰은 진동 기능이 없음)', off: '부딪혀도 떨리지 않습니다',
      svg: function () { return '<rect width="120" height="72" rx="9" fill="#1b2332"/><g class="ph"><rect x="42" y="8" width="36" height="56" rx="7" fill="#0d1018" stroke="#c8d2e2" stroke-width="2"/>' + TXT(60, 42, 16, '💥') + '</g><g class="x-on wv"><path class="w1" d="M34 24v24M28 28v16M86 24v24M92 28v16" stroke="#ffd36b" stroke-width="2.6" stroke-linecap="round"/></g>'; } },
    optPano: { t: '차내 광각 3면', on: '가로 화면 차내 시점에서 앞 창 · 왼쪽 창 · 오른쪽 창을 한꺼번에(실험 기능)', off: '앞 창 하나만',
      svg: function () {
        function pane(x, w) { return '<g><rect x="' + x + '" y="10" width="' + w + '" height="44" rx="3" fill="#7fa7d9"/><rect x="' + x + '" y="34" width="' + w + '" height="20" fill="#3b4352"/><path class="dsh" d="M' + (x + w / 2) + ' 36V54" stroke="#fff" stroke-width="1.6" stroke-dasharray="4 4"/></g>'; }
        return '<rect width="120" height="72" rx="9" fill="#11151e"/><g class="x-on">' + pane(4, 35) + pane(42.5, 35) + pane(81, 35) + '</g><g class="x-off">' + pane(30, 60) + '</g><rect x="0" y="54" width="120" height="18" rx="0" fill="#0b0e14"/>' + TXT(60, 66, 8, '◀ 왼쪽 · 앞 · 오른쪽 ▶', 'x-on');
      } },
    optHQ: { t: '고화질', on: '해상도와 그림자를 올립니다 — 화면이 끊기면 끄세요', off: '보통 화질(더 부드럽게 돌아갑니다)',
      svg: function () { return '<rect width="120" height="72" rx="9" fill="#7fa7d9"/><rect y="48" width="120" height="24" fill="#5c6b5a"/><circle cx="100" cy="14" r="7" fill="#fff3b0"/><g class="hq"><path class="x-on" d="M70 54l26 8H52l-12-8z" fill="rgba(0,0,0,.42)"/><rect x="40" y="20" width="30" height="34" fill="#c9d6ec"/><path d="M44 25h6v6h-6zM56 25h6v6h-6zM44 36h6v6h-6zM56 36h6v6h-6z" fill="#5a7bb0"/></g>' + TXT(24, 16, 10, 'HD', 'x-on', '#0c1a33') + '</svg>'; } },
    optStick: { t: '조이스틱', vals: { fixed: '📌 고정 — 늘 같은 자리. 한가운데를 0.7초 누르면 옮길 수 있습니다', float: '👆 따라옴 — 왼쪽 아래 아무 데나 누르면 그 자리가 스틱 가운데가 됩니다' },
      svg: function () { return '<rect width="120" height="72" rx="9" fill="#1b2332"/><rect x="4" y="6" width="112" height="60" rx="8" fill="#273246" stroke="#5a6a85"/><g class="stb"><circle cx="30" cy="44" r="15" fill="rgba(255,255,255,.14)" stroke="#dfe7f5" stroke-width="1.5"/><circle class="nub" cx="30" cy="44" r="6.5" fill="#e6ecf5"/></g><g class="fg">' + TXT(0, 0, 14, '👆') + '</g>'; } },
    optCtl: { t: '조작 배치', vals: { pedal: '🚗 핸들·페달 — 왼손 ◀ ▶ 핸들, 오른손 브레이크·가속 페달(많은 운전 게임과 같은 배치)', stick: '🕹 조이스틱 — 왼손 원형 스틱 하나로 조향·가속·브레이크, 오른손 단추', pad: '🎮 게임패드 — 왼손 십자키, 오른손 △○×□' },
      svg: function () {
        return '<rect width="120" height="72" rx="9" fill="#1b2332"/><rect x="3" y="7" width="114" height="58" rx="8" fill="#3b4f6e" stroke="#7d8faa"/><rect x="3" y="7" width="114" height="26" rx="8" fill="#6b8fc4"/>' +
          '<g class="v-pedal"><rect x="9" y="46" width="13" height="13" rx="3" fill="rgba(255,255,255,.18)" stroke="#fff"/><rect x="25" y="46" width="13" height="13" rx="3" fill="rgba(255,255,255,.18)" stroke="#fff"/>' + TXT(15.5, 56, 8, '◀') + TXT(31.5, 56, 8, '▶') +
          '<rect x="84" y="45" width="12" height="15" rx="2.5" fill="rgba(255,80,80,.35)" stroke="#ff8a8a"/><rect class="gas" x="99" y="38" width="13" height="22" rx="2.5" fill="rgba(60,200,110,.35)" stroke="#8ff0a8"/></g>' +
          '<g class="v-stick"><circle cx="22" cy="50" r="11" fill="rgba(255,255,255,.15)" stroke="#fff"/><circle class="nub" cx="22" cy="50" r="4.5" fill="#fff"/><circle cx="96" cy="52" r="7" fill="rgba(255,80,80,.4)" stroke="#fff"/><circle cx="106" cy="40" r="6" fill="rgba(80,140,255,.45)" stroke="#fff"/></g>' +
          '<g class="v-pad"><path d="M17 42h8v6h6v8h-6v6h-8v-6h-6v-8h6z" fill="rgba(255,255,255,.22)" stroke="#fff"/>' + TXT(100, 44, 7, '△', '', '#8ff0a8') + TXT(108, 52, 7, '○', '', '#ff8a8a') + TXT(100, 60, 7, '×', '', '#9cd2ff') + TXT(92, 52, 7, '□', '', '#ffb6f0') + '</g>' +
          '<g class="fg">' + TXT(0, 0, 13, '👆') + '</g>';
      } },
    optDrive: { t: '주행 모드', vals: { normal: '노멀 — 부드럽게 붙는 가속 · 조향(처음엔 이것)', sport: '스포츠 — 가속·조향이 빠르게 반응합니다' },
      svg: function () { return '<rect width="120" height="72" rx="9" fill="#1b2332"/><path d="M28 56a32 32 0 0 1 64 0" stroke="#5a6a85" stroke-width="6" fill="none"/><path class="arc" d="M28 56a32 32 0 0 1 64 0" stroke="#ffb347" stroke-width="6" fill="none" pathLength="100" stroke-dasharray="100" stroke-dashoffset="100"/><g class="ndl"><path d="M60 56L34 50" stroke="#fff" stroke-width="3" stroke-linecap="round"/></g><circle cx="60" cy="56" r="4" fill="#fff"/>' + TXT(60, 40, 12, '<tspan class="v-normal">N</tspan><tspan class="v-sport">S</tspan>', '', '#ffd36b'); } },
    optWeather: { t: '날씨·시간', vals: { auto: '🕒 자동 — 지금 시계·계절 그대로', random: '🎲 랜덤 — 근무마다 다르게', clear: '☀ 맑음', sunset: '🌇 석양', night: '🌙 밤 — 전조등·경광등이 더 중요', rain: '🌧 비 — 미끄러워 서는 거리가 길어집니다(그립 78%)', snow: '❄ 눈 — 더 미끄럽습니다(그립 62%)', windy: '💨 강풍 — 옆바람에 차가 밀립니다' },
      svg: function () { return '<rect class="sky" width="120" height="72" rx="9" fill="#7fa7d9"/><rect y="50" width="120" height="22" fill="#3b4352"/>' +
        '<g class="v-clear v-auto"><circle class="sun" cx="60" cy="28" r="11" fill="#ffe27a"/></g><g class="v-sunset"><circle cx="60" cy="50" r="13" fill="#ff9a4d"/></g><g class="v-night"><circle cx="60" cy="26" r="10" fill="#f4f1d0"/><circle cx="65" cy="22" r="9" fill="#1b2340"/></g>' +
        '<g class="v-rain rn"><path d="M20 6l-4 10M40 2l-4 10M60 8l-4 10M80 3l-4 10M100 7l-4 10M30 22l-4 10M70 20l-4 10M90 24l-4 10M50 28l-4 10M110 26l-4 10" stroke="#cfe3ff" stroke-width="1.6" stroke-linecap="round"/></g>' +
        '<g class="v-snow sn"><circle cx="18" cy="8" r="2" fill="#fff"/><circle cx="44" cy="4" r="2" fill="#fff"/><circle cx="70" cy="10" r="2" fill="#fff"/><circle cx="96" cy="5" r="2" fill="#fff"/><circle cx="30" cy="24" r="2" fill="#fff"/><circle cx="58" cy="28" r="2" fill="#fff"/><circle cx="84" cy="22" r="2" fill="#fff"/><circle cx="108" cy="26" r="2" fill="#fff"/></g>' +
        '<g class="v-windy wd"><path d="M10 20h40M24 32h56M6 44h34M60 16h40" stroke="#eef4ff" stroke-width="2.2" stroke-linecap="round" stroke-dasharray="18 10"/></g>' +
        '<g class="v-random dc">' + TXT(60, 40, 22, '🎲') + '</g>' + TXT(102, 20, 12, '🕒', 'v-auto') + '</svg>'; } },
    optVoice: { t: '목소리', on: '기기에 있는 한국어 목소리 중에서 고릅니다 — 고르면 한 번 읽어 줍니다',
      svg: function () { return '<rect width="120" height="72" rx="9" fill="#1b2332"/>' + TXT(26, 50, 26, '🗣') + '<g class="bub"><rect x="44" y="18" width="70" height="24" rx="7" fill="#e6ecf5"/><path d="M50 42l-6 8 12-8z" fill="#e6ecf5"/>' + TXT(79, 34, 9, '안전 운전 하십시오', '', '#1b2332') + '</g>'; } },
    // v0.10.159 빠졌던 줄 — 음량(밀어서 고르는 칸): 막대 넷이 지금 값만큼 켜진다
    optVolume: { t: '음량', on: '막대를 왼쪽으로 밀면 작게, 오른쪽으로 밀면 크게 — 경광등·엔진·음악 같은 게임 소리가 같이 커지고 작아집니다(읽어 주는 목소리는 폰 음량을 따릅니다)',
      svg: function () { return '<rect width="120" height="72" rx="9" fill="#1b2332"/><path d="M14 30h8l10-8v28l-10-8h-8z" fill="#e6ecf5"/>' +
        '<rect class="vb vb1" x="44" y="40" width="10" height="10" rx="2" fill="#9cd2ff"/><rect class="vb vb2" x="58" y="32" width="10" height="18" rx="2" fill="#9cd2ff"/><rect class="vb vb3" x="72" y="24" width="10" height="26" rx="2" fill="#ffd36b"/>' +
        '<rect x="14" y="58" width="92" height="4" rx="2" fill="#4a5a76"/><circle class="vk" cx="60" cy="60" r="5" fill="#fff"/>' + TXT(100, 34, 9, '0~100%', '', '#cfe0ff') + '<g class="v-vol0">' + TXT(96, 50, 13, '🔇') + '</g>'; } }
  };
  // 그림 상태: 체크칸 = on/off · 고르기 = data-v
  function paint(btn, el) {
    if (!el) return;
    if (el.type === 'checkbox') { btn.classList.toggle('on', el.checked); btn.classList.toggle('off', !el.checked); }
    else if (el.type === 'range') btn.setAttribute('data-v', 'vol' + Math.ceil((+el.value || 0) / 34));   // 음량 0 · 1~34 · 35~68 · 69~100
    else btn.setAttribute('data-v', el.value);
  }
  function svgOf(k) { var s = PICS[k].svg(); s = s.replace('</svg>', ''); return '<svg viewBox="0 0 120 72" aria-hidden="true">' + s + '</svg>'; }
  function decorate() {
    Object.keys(PICS).forEach(function (k) {
      var el = $(k); if (!el) return;
      var row = el.closest ? el.closest('label.opt') : null; if (!row || row.querySelector('.spic')) return;
      var b = document.createElement('button'); b.type = 'button'; b.className = 'spic'; b.setAttribute('data-k', k);
      b.title = PICS[k].t + ' — 눌러서 크게 보기';
      b.innerHTML = svgOf(k) + '<em>⤢</em>';
      row.insertBefore(b, row.firstChild); row.classList.add('has-pic');
      paint(b, el);
      if (el.type === 'range') el.addEventListener('input', function () { paint(b, el); });
      el.addEventListener('change', function () { paint(b, el); var v = $('spicView'); if (v && v.style.display === 'flex' && v.getAttribute('data-k') === k) openPic(k); });
      tap(b, function () { openPic(k); });
    });
  }

  // 크게 보기 — 켜면/끄면 나란히(체크칸) · 고를 수 있는 것 전부(고르기 — 그림을 누르면 그것으로 바뀐다)
  var LIVE = { optStopbar: 'stopbar', optCtl: 'tags', optStick: 'tags' };
  function openPic(k) {
    var P = PICS[k], el = $(k), v = $('spicView'); if (!P || !el || !v) return;
    v.setAttribute('data-k', k);
    var h = '<div class="card spv"><h3>' + P.t + '</h3><div class="spv-pics">';
    if (el.type === 'checkbox') {
      [['on', '켜면', P.on], ['off', '끄면', P.off]].forEach(function (s) {
        if (!s[2]) return;
        h += '<button type="button" class="spv-it spic ' + s[0] + (el.checked === (s[0] === 'on') ? ' cur' : '') + '" data-set="' + s[0] + '">' + svgOf(k) + '<b>' + s[1] + (el.checked === (s[0] === 'on') ? ' · 지금' : '') + '</b><span>' + s[2] + '</span></button>';
      });
    } else if (P.vals) {
      Object.keys(P.vals).forEach(function (val) {
        var cur = el.value === val;
        h += '<button type="button" class="spv-it spic' + (cur ? ' cur' : '') + '" data-v="' + val + '" data-set="' + val + '">' + svgOf(k) + '<b>' + (cur ? '✔ 지금' : '') + '</b><span>' + P.vals[val] + '</span></button>';
      });
    } else {
      h += '<div class="spv-it spic one">' + svgOf(k) + '<span>' + P.on + '</span></div>';
    }
    h += '</div><div class="spv-note">그림을 누르면 그대로 바뀝니다</div><div class="spv-btns">';
    if (LIVE[k] && G().state === 'play') h += '<button type="button" class="ghost" data-live="1">👀 실제 화면에서 보기</button>';
    h += '<button type="button" class="primary" data-x="1">닫기</button></div></div>';
    v.innerHTML = h; v.style.display = 'flex';
    if (el.type !== 'checkbox' && !P.vals) v.querySelector('.spv-note').style.display = 'none';
    Array.prototype.forEach.call(v.querySelectorAll('[data-set]'), function (b) {
      tap(b, function () {
        var s = b.getAttribute('data-set');
        if (el.type === 'checkbox') { var want = s === 'on'; if (el.checked !== want) { el.checked = want; el.dispatchEvent(new Event('change')); } }
        else if (el.value !== s) { el.value = s; el.dispatchEvent(new Event('change')); }
        openPic(k);
      });
    });
    tap(v.querySelector('[data-x]'), closePic);
    tap(v.querySelector('[data-live]'), function () { closePic(); var bv = $('gbView'); if (bv) bv.style.display = 'none'; if (LIVE[k] === 'tags') tags(); else liveStop(); });
  }
  function closePic() { var v = $('spicView'); if (v) { v.style.display = 'none'; v.innerHTML = ''; } }
  // v 바깥(어두운 곳)을 누르면 닫는다
  function bindVeil(id, fn) { var v = $(id); if (v) v.addEventListener('click', function (e) { if (e.target === v) fn(); }); }

  // ───────── ③ 실제 화면에 이름표 ─────────
  var NAMES = [
    ['.drvb.steer.l', '◀ 왼쪽'], ['.drvb.steer.r', '오른쪽 ▶'], ['.drvb.pg', '가속 페달'], ['.drvb.pb', '브레이크 · 꾹 = 후진'],
    ['#btnSigL', '왼쪽 깜빡이'], ['#btnHaz', '비상등'], ['#btnSigR', '오른쪽 깜빡이'], ['#btnTools', '🧰 장비 — 앰프·블랙박스·무전 등'], ['#btnFoot', '하차 · 승차'],
    ['#btnEnforce', '단속 — 위반 고르기'], ['#btnSiren', '경광등'], ['#btnPA', '앰프 방송'], ['#btnCam', '블랙박스 녹화'], ['#btnRadio', '무전 전파'],
    ['#btnEmerg', '긴급 출동'], ['#btnHere', '이 자리 자료'], ['#btnSport', '주행 모드'], ['#btnCone', '라바콘'], ['#btnTow', '견인'], ['#btnGate', '관문(다른 지도)'],
    ['#btnBeast', '비스트'], ['#btnKics', '발생보고'], ['#btnHand', '손 들기 · 꼬리 끊기'], ['#btnRun', '달리기'], ['#btnRev', '후진'], ['#btnBox', '신호 제어함'], ['#btnLook', '살피기'], ['#btnBikeBrake', '브레이크(꾹)'], ['#btnBikeLook', '좌우 살피기'], ['#btnBikeMount', '내리기 · 타기'], ['#btnBikeBell', '벨'], ['#btnTotWalk', '꾹 = 걸어요'], ['#btnTotNext', '다음 마당'],
    ['#stickZone', '스틱 — 밀면 그쪽으로'], ['#hudbar', '계기 칸 · 누르면 계급'], ['#minimap', '지도 · 누르면 확대'], ['#btnMenu', '메뉴'], ['#btnView', '시점 바꾸기'],
    ['#btnPause', '일시정지'], ['#btnSpeed', '배속'], ['#btnCtlHelp', '조작 설명'], ['#pad .dpad', '십자키 — 조향·가속·브레이크'], ['#pad .pad-shoulder.left', 'L1 왼쪽 깜빡이'], ['#pad .pad-shoulder.right', 'R1 오른쪽 깜빡이']
  ];
  function shown(el) {
    if (!el || !el.getClientRects().length) return null;
    var cs = getComputedStyle(el); if (cs.visibility === 'hidden' || +cs.opacity < 0.15) return null;
    var r = el.getBoundingClientRect(); if (r.width < 8 || r.height < 8 || r.right < 0 || r.bottom < 0 || r.left > innerWidth || r.top > innerHeight) return null;
    return r;
  }
  function hit(a, b) { return a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t; }
  function tags(only) {
    var g = G(); if (g.state !== 'play') return;
    if (g.setPaused) { g.setPaused(true, 'guide'); g.setPaused(false, 'menu'); }
    var B = document.body.classList;
    var o = document.createElement('div'); o.id = 'gTags';
    o.innerHTML = '<div class="gt-head">🏷 지금 화면의 단추 이름 — 아무 데나 누르면 메뉴로</div>';
    document.body.appendChild(o);
    var done = {}, placed = [], rings = [];
    var list = NAMES.slice();
    // 이름표 목록에 없는 단추는 단추의 설명(title) 앞부분으로
    Array.prototype.forEach.call(document.querySelectorAll('#touch .tbtn, #toolTray .tbtn'), function (el) { if (el.id) list.push(['#' + el.id, null]); });
    (only || list).forEach(function (it) {
      var el = document.querySelector(it[0]); if (!el || done[it[0]]) return;
      if (el.closest('#toolTray') && !B.contains('toolsopen')) return;   // 상자가 닫혀 있으면 안에 든 단추는 건너뛴다
      var r = shown(el); if (!r) return; done[it[0]] = 1;
      var name = it[1] || ((el.getAttribute('title') || '').split(/[:(—\-]/)[0].trim()); if (!name) return;
      var ring = document.createElement('i'); ring.className = 'gt-ring';
      ring.style.cssText = 'left:' + (r.left - 3) + 'px;top:' + (r.top - 3) + 'px;width:' + (r.width + 6) + 'px;height:' + (r.height + 6) + 'px';
      o.appendChild(ring); rings.push({ l: r.left - 3, r: r.right + 3, t: r.top - 3, b: r.bottom + 3 });
      var c = document.createElement('b'); c.className = 'gt-chip'; c.textContent = name; o.appendChild(c);
      var w = c.offsetWidth, h = c.offsetHeight, cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      var cand = [[cx - w / 2, r.top - h - 4], [cx - w / 2, r.bottom + 4], [r.left - w - 4, cy - h / 2], [r.right + 4, cy - h / 2], [cx - w / 2, cy - h / 2]];
      var pick = null;
      for (var i = 0; i < cand.length && !pick; i++) {
        var x = Math.max(4, Math.min(innerWidth - w - 4, cand[i][0])), y = Math.max(4, Math.min(innerHeight - h - 4, cand[i][1]));
        var bx = { l: x, r: x + w, t: y, b: y + h }, ok = true;
        for (var j = 0; j < placed.length; j++) if (hit(bx, placed[j])) { ok = false; break; }
        if (ok) pick = bx;
      }
      if (!pick) { var x0 = Math.max(4, Math.min(innerWidth - w - 4, cx - w / 2)), y0 = Math.max(4, Math.min(innerHeight - h - 4, cy - h / 2)); pick = { l: x0, r: x0 + w, t: y0, b: y0 + h }; c.classList.add('tight'); }
      placed.push(pick); c.style.left = pick.l + 'px'; c.style.top = pick.t + 'px';
    });
    // 머리말은 이름표를 다 붙인 뒤 빈 곳에(가운데 → 위 → 아래 차례)
    var hd = o.firstChild, hw = hd.offsetWidth, hh = hd.offsetHeight, all = placed.concat(rings);
    [0.5, 0.36, 0.64, 0.24, 0.76, 0.12].some(function (fy) {
      var y = innerHeight * fy - hh / 2, x = (innerWidth - hw) / 2, bx = { l: x, r: x + hw, t: y, b: y + hh };
      for (var j = 0; j < all.length; j++) if (hit(bx, all[j])) return false;
      hd.style.top = (y + hh / 2) + 'px'; return true;
    });
    function close() {
      o.remove();
      if (g.setPaused) { g.setPaused(false, 'guide'); g.setPaused(true, 'menu'); }
    }
    setTimeout(function () { o.addEventListener('click', close); }, 250);   // 연 손가락이 바로 닫지 않게
  }
  // 정지거리 바를 실제 자리에서 — 꺼져 있으면 잠깐만 켠다(설정은 안 바꾼다)
  function liveStop() {
    var g = G(), w = $('stopbarWrap'); if (!w || !g.hud) return;
    var was = $('optStopbar') && $('optStopbar').checked;
    if (!was && g.hud.setStopbar) g.hud.setStopbar(true);
    tags([['#stopbarWrap', '정지거리 바 — 지금 속도로 브레이크를 밟으면 서는 거리']]);
    var t = $('gTags'); if (t) t.addEventListener('click', function () { if (!was && g.hud.setStopbar) g.hud.setStopbar(false); });
  }

  // ───────── ② 움직여서 「이렇게 합니다」 ─────────
  var STEPS = [
    { f: 'pg', s: 'go', c: '⬆ <b>가속 페달</b>을 누르고 있으면 앞으로 갑니다' },
    { f: 'sl', s: 'go left', c: '◀ ▶ <b>핸들</b> — 누르는 동안 그쪽으로 돕니다' },
    { f: 'pb', s: 'stop rev', c: '<b>브레이크</b> — 서 있을 때 꾹 누르고 있으면 <b>후진(R)</b>' },
    { f: 'siren', s: 'go tc siren', c: '🔦 <b>경광등</b> — 단속하기 전에 켭니다' },
    { f: 'enf', s: 'tc siren enf', c: '🚨 <b>단속</b> — 무슨 위반인지 고릅니다(차를 손가락으로 눌러도 됩니다)' },
    { f: 'tc', s: 'tc enf tapcar', c: '🚗 <b>차를 손가락으로 직접 눌러도</b> 「무슨 위반?」이 뜹니다' },
    { f: 'sr', s: 'tc siren pull', c: '👉 <b>오른쪽 깜빡이</b> 켜고 그 차 뒤 갓길에 섭니다' },
    { f: 'foot', s: 'tc siren pull foot', c: '🚶 <b>하차</b> — 내려서 다가가면 고지 끝' },
    { f: 'tools', s: 'go tools', c: '🧰 <b>장비</b> — 앰프·블랙박스·무전·긴급이 이 안에 있습니다' },
    { f: 'ctx', s: 'go ctx', c: '그때그때 필요한 단추(<b>라바콘·견인…</b>)는 이 자리에 저절로 나타납니다' },
    { f: 'hud', s: 'go rank', c: '<b>계기 칸</b>을 누르면 계급·진급 막대가 보입니다' },
    { f: 'mm', s: 'go mmbig', c: '🗺 <b>지도</b>를 누르면 크게 — 메뉴 지도 줄에서 자동 · 늘 펼침 · 아이콘만' },
    { f: 'siren', s: 'go move', c: '✋ 단추를 <b>0.4초 길게</b> 누른 채 끌면 그 자리로 옮겨집니다 — 처음 자리로는 메뉴 「화면 배치 처음으로」' }
  ];
  var gd = { i: 0, play: true, t: null, built: false, port: null };
  function phoneHTML() {
    return '<div class="gd-sky"></div><div class="gd-road"><i class="gd-dash"></i></div>' +
      '<div class="gd-tc" data-b="tc"><i></i><b>📱</b></div><div class="gd-me"><i class="lb"></i><i class="bk l"></i><i class="bk r"></i></div>' +
      '<div class="gd-cop">👮</div><div class="gd-stamp">🧾 고지 완료</div>' +
      '<div class="gd-pop"><b>무슨 위반?</b><span class="ok">📱 휴대전화</span><span>🚦 신호위반</span><span>🔒 안전띠</span></div>' +
      '<div class="gd-hud" data-b="hud"><b>52</b> km/h <i>50</i></div><div class="gd-xp">🎖 순경 <i></i></div><div class="gd-mm" data-b="mm"></div><div class="gd-glow"></div><div class="gd-r">R 후진</div>' +
      '<div class="gd-b st l" data-b="sl">◀</div><div class="gd-b st r" data-b="sr2">▶</div>' +
      '<div class="gd-sigs"><span data-b="sl9">◀</span><span>⚠</span><span data-b="sr">▶</span></div>' +
      '<div class="gd-b tl" data-b="tools">🧰</div><div class="gd-b ft" data-b="foot">🚶</div>' +
      '<div class="gd-b pd pb" data-b="pb"><s></s>브레이크</div><div class="gd-b pd pg" data-b="pg"><s></s>가속</div>' +
      '<div class="gd-b en" data-b="enf">🚨<small>단속</small></div><div class="gd-b sr" data-b="siren">🔦</div><div class="gd-b cx" data-b="ctx">🚧</div>' +
      '<div class="gd-tray"><i>📢</i><i>📹</i><i>📡</i><i>🆘</i><i>N</i><i>📍</i></div><div class="gd-f">👆</div>';
  }
  function buildGallery() {
    var v = $('gdView'); if (!v) return;
    v.innerHTML = '<div class="card gd"><div class="gd-top"><b>🎬 이렇게 합니다</b><button type="button" class="ghost gd-x">닫기 ✕</button></div>' +
      '<div class="gd-wrap"><div class="gd-ph"></div></div><div class="gd-cap"></div>' +
      '<div class="gd-nav"><button type="button" class="ghost" data-n="-1">◀</button><button type="button" class="ghost gd-pp">⏸</button><button type="button" class="ghost" data-n="1">▶</button><span class="gd-dots"></span></div></div>';
    var dots = v.querySelector('.gd-dots');
    STEPS.forEach(function (s, i) { var d = document.createElement('i'); tap(d, function () { gdGo(i); }); dots.appendChild(d); });
    tap(v.querySelector('.gd-x'), function () { gallery(false); });
    Array.prototype.forEach.call(v.querySelectorAll('[data-n]'), function (b) { tap(b, function () { gdGo((gd.i + (+b.getAttribute('data-n')) + STEPS.length) % STEPS.length); }); });
    tap(v.querySelector('.gd-pp'), function () { gd.play = !gd.play; v.querySelector('.gd-pp').textContent = gd.play ? '⏸' : '▶ 계속'; gdTimer(); });
    tap(v.querySelector('.gd-wrap'), function () { gdGo((gd.i + 1) % STEPS.length); });
    gd.built = true;
  }
  function gdFit() {
    var v = $('gdView'), ph = v && v.querySelector('.gd-ph'), wr = v && v.querySelector('.gd-wrap'); if (!ph) return;
    var port = document.body.classList.contains('portrait') || innerHeight > innerWidth;
    if (port !== gd.port) { gd.port = port; ph.className = 'gd-ph ' + (port ? 'port' : 'land'); ph.innerHTML = phoneHTML(); }
    var W = port ? 375 : 844, H = port ? 812 : 390;
    var card = v.querySelector('.card'), cw = Math.min(innerWidth * 0.94, port ? 520 : 760) - 28;
    var s = Math.min(cw / W, (innerHeight * 0.94 - 128) / H, port ? 0.62 : 0.9);
    wr.style.width = Math.round(W * s) + 'px'; wr.style.height = Math.round(H * s) + 'px';
    ph.style.transform = 'scale(' + s + ')';
    card.style.width = Math.max(Math.round(W * s) + 28, Math.min(innerWidth * 0.94, 340)) + 'px';
  }
  function gdGo(i) {
    var v = $('gdView'), ph = v && v.querySelector('.gd-ph'); if (!ph) return;
    gd.i = i; var s = STEPS[i];
    ph.className = 'gd-ph ' + (gd.port ? 'port' : 'land') + ' ' + s.s.split(' ').map(function (x) { return 's-' + x; }).join(' ');
    void ph.offsetWidth;   // 같은 장면 다시 — 애니메이션 처음부터
    v.querySelector('.gd-cap').innerHTML = '<em>' + (i + 1) + '/' + STEPS.length + '</em> ' + s.c;
    Array.prototype.forEach.call(v.querySelectorAll('.gd-dots i'), function (d, k) { d.classList.toggle('on', k === i); });
    Array.prototype.forEach.call(ph.querySelectorAll('.hold'), function (e) { e.classList.remove('hold'); });
    var tg = ph.querySelector('[data-b="' + s.f + '"]'), fg = ph.querySelector('.gd-f');
    if (tg && fg) {
      var x = 0, y = 0, e = tg; while (e && e !== ph) { x += e.offsetLeft; y += e.offsetTop; e = e.offsetParent; }
      fg.classList.remove('press'); fg.style.left = (x + tg.offsetWidth / 2 - 20) + 'px'; fg.style.top = (y + tg.offsetHeight / 2 - 4) + 'px';
      clearTimeout(gd.pt); gd.pt = setTimeout(function () { fg.classList.add('press'); tg.classList.add('hold'); }, RM ? 0 : 650);
    }
    gdTimer();
  }
  function gdTimer() { clearTimeout(gd.t); if (gd.play && $('gdView').style.display === 'flex') gd.t = setTimeout(function () { gdGo((gd.i + 1) % STEPS.length); }, 4200); }
  function gallery(on) {
    var v = $('gdView'); if (!v) return;
    var g = G();
    if (on) {
      if (!gd.built) buildGallery();
      v.style.display = 'flex'; gd.port = null; gdFit(); gd.play = true; v.querySelector('.gd-pp').textContent = '⏸'; gdGo(0);
      if (g.setPaused && g.state === 'play') g.setPaused(true, 'guide');
    } else {
      v.style.display = 'none'; clearTimeout(gd.t); clearTimeout(gd.pt);
      if (g.setPaused && g.state === 'play') g.setPaused(false, 'guide');
    }
  }
  addEventListener('resize', function () { var v = $('gdView'); if (v && v.style.display === 'flex') { gdFit(); gdGo(gd.i); } });

  // ───────── ④ 📖 그림 사전 — 단추·설정·근무 빠짐없이(v0.10.159) ─────────
  //  소유자(11-22 둘째): 「더 구체적으로 모든 항목을 이렇게도 해낼 수 있다는 것을 자세히 · 빠진 부분이 있는지 찾아서 꼭 사용설명을」.
  //  v0.10.158 에서 빠져 있던 것: 메뉴 단추 14개(그림 없음) · 음량 줄 · 그때그때 나오는 단추 9개와 교실 단추 6개(지금 화면에 없으면
  //  이름표로도 못 본다) · 처음 화면 설정 15개 · 근무 종류 15개. 여기서 한 장에 다 모은다 — 줄마다 「누르면 → 이렇게 된다」 움직이는 그림.
  //  한 줄 = [자리(선택자) · 그림 글자 · 이름 · 어디·언제 · 어떻게 · 결과(| = 줄 바꿈) · 움직임(t 누름 · h 꾹 · d 끌기 · p 그냥) · 키보드]
  var BOOK = [
    { id: 'drive', t: '🚗 운전', bg: 'road', it: [
      ['.drvb.pg', '⬆', '가속 페달', '핸들·페달 배치 · 오른손 맨 오른쪽', '누르고 있는 동안 앞으로 갑니다. 떼면 천천히 느려집니다', '앞으로|부릉', 'h', '↑'],
      ['.drvb.pb', '⏹', '브레이크 페달', '가속 페달 바로 왼쪽', '누르면 섭니다. 다 선 뒤에도 꾹 누르고 있으면 R(후진)로 바뀌어 뒤로 갑니다', '멈춤|꾹=후진', 'h', '↓'],
      ['.drvb.steer.l', '◀', '핸들 ◀ ▶', '왼손 아래 두 칸', '누르는 동안 그쪽으로 돕니다. 떼면 바퀴가 똑바로 돌아옵니다', '그쪽으로|돎', 'h', '← →'],
      ['#btnSigL', '↰', '방향지시등 ◀ ▶', '핸들 위 줄의 양 끝', '차로를 바꾸거나 돌기 전에 한 번 — 다시 누르면 꺼집니다. 단속한 차 뒤 갓길에 설 때는 ▶', '깜빡|깜빡', 't', ', .'],
      ['#btnHaz', '⚠', '비상등', '방향지시등 가운데', '좌우가 함께 깜빡입니다 — 갓길에 섰을 때 뒤차에 알립니다(방향지시등을 대신하지는 않습니다)', '좌우|함께', 't', '/'],
      ['#stickZone', '🕹', '조이스틱', '조이스틱 배치 · 차에서 내려 걸을 때', '민 쪽으로 — 위로 밀면 가속, 아래로 밀면 브레이크, 옆으로 밀면 조향(걸을 때는 그쪽으로 걷기). 고정 스틱은 한가운데를 0.7초 누르면 옮겨집니다', '미는|쪽으로', 'd', ''],
      ['#btnRev', 'R', '후진 단추', '조이스틱·게임패드 배치', '누르는 동안 뒤로 갑니다(핸들·페달 배치에서는 브레이크를 꾹)', '뒤로', 'h', 'R'],
      ['#pad .dpad', '✚', '화면 게임패드', '조작 배치 「게임패드」', '십자키 ▲ 가속 · ▼ 브레이크 · ◀▶ 조향 · △ 앰프 · □ 단속 · ○ 경광등 · × 시점 · L1·R1 깜빡이 · SELECT 주행 모드 · START 일시정지', '△○×□', 't', ''],
      [null, '🎮', '실물 게임패드', '블루투스·USB 패드', '연결하고 아무 단추나 한 번 누르면 알아서 잡힙니다 — RT 가속 · LT 브레이크 · L3 경광등 · R3 주행 모드', '자동|인식', 'p', ''],
      [null, '⌨', '키보드', 'PC', '← → 조향 · ↑ 가속 · ↓/Space 브레이크 · R 후진 · F 단속 · L 경광등 · C 시점 · +/− 지도 · Esc 일시정지 — 단추마다의 키는 이 사전 각 칸에', 'PC에서', 'p', '']
    ] },
    { id: 'enf', t: '🚨 단속·현장', bg: 'road', it: [
      ['#btnSiren', '🔦', '경광등', '페달 위 · 단속 단추 옆', '한 번 누르면 켜지고 다시 누르면 꺼집니다. 단속·추격·긴급 전에 먼저 켭니다', '번쩍|번쩍', 't', 'L'],
      ['#btnEnforce', '🚨', '단속', '페달 위', '앞쪽에서 위반이 의심되는 차를 알아서 골라 「무슨 위반?」 보기를 엽니다. 맞히면 그 차가 오른쪽에 섭니다', '무슨|위반?', 't', 'F'],
      [null, '🚗', '차·사람 직접 누르기', '화면에 보이는 아무 차나 사람', '손가락으로 눌러도 「무슨 위반?」이 뜹니다 — 위반이 없는 차를 고르면 감점', '눌러서|고름', 't', ''],
      [null, '🧾', '갓길 정차 → 고지', '「무슨 위반?」을 맞힌 뒤', '▶ 깜빡이를 켜고 그 차 뒤 갓길에 서면 고지가 끝납니다', '고지|완료', 'p', ''],
      ['#btnFoot', '🚶', '하차 · 승차', '핸들 위 · 차가 완전히 섰을 때', '내려서 걷습니다(걷기용 조이스틱으로 바뀜). 다시 누르면 탑니다', '내려서|걷기', 't', 'X']
    ] },
    { id: 'tools', t: '🧰 장비 상자', bg: 'road', it: [
      ['#btnTools', '🧰', '장비 상자', '핸들 위', '누르면 펼쳐지고, 하나 고르면 접힙니다. 112 긴급 신고 중에는 🆘 긴급이 상자 밖으로 나옵니다', '6가지|펼침', 't', ''],
      ['#btnPA', '📢', '앰프 방송', '장비 상자 안', '확성기로 안내합니다 — 가까운 무단횡단 보행자·위반 차를 골라 그에 맞는 말을 합니다', '방송', 't', 'M'],
      ['#btnCam', '📹', '블랙박스', '장비 상자 안', '이륜차·자전거·킥보드의 단순 위반은 쫓지 않고 영상으로 남겨 통고처분을 의뢰합니다', '● 녹화', 't', 'B'],
      ['#btnRadio', '📡', '무전', '장비 상자 안', '상황실·옆 순찰차에 알리고 번호판을 조회합니다. 수배·음주 의심은 먼저 무전', '상황실|전파', 't', 'T'],
      ['#btnEmerg', '🆘', '긴급 출동', '장비 상자 안 · 112 신고 중엔 밖으로', '경광등·사이렌을 켜고 긴급으로 달립니다(교차로는 서행하며 교차 차가 멈춘 것을 확인)', '사이렌|긴급', 't', 'U'],
      ['#btnSport', 'N', '주행 모드', '장비 상자 안', '노멀 ↔ 스포츠 — 스포츠는 가속·조향이 빠르고 최고속도가 올라갑니다(추격·출동)', 'N ↔ S', 't', 'N'],
      ['#btnHere', '📍', '이 자리', '장비 상자 안', '지금 서 있는 자리에 대해 이 지도가 가진 자료를 보여 줍니다 — 사고·인구·신호·학교·국가유산', '자료|카드', 't', 'I']
    ] },
    { id: 'ctx', t: '✨ 그때그때 나오는 단추', bg: 'road', it: [
      ['#btnCone', '🚧', '라바콘', '사고·고장 현장 가까이 섰을 때 저절로', '라바콘으로 차로를 막고, 밤·악천후에는 불꽃신호기를 켭니다 — 막을 차로 수만큼 누릅니다', '차로|차단', 't', 'K'],
      ['#btnTow', '🪝', '견인', '고장 난 차 앞에 댔을 때 저절로', '견인줄로 이어 갓길·안전지대까지 끌어냅니다(대형차는 압축공기를 먼저 확인)', '끌어|내기', 't', 'J'],
      ['#btnGate', '🚪', '관문', '순환도로 밖으로 나가는 길 끝', '다른 지도로 건너갑니다(놀이용 기본 지도 ↔ 서초구 디지털 트윈)', '다른|지도', 't', 'G'],
      ['#btnBeast', '💪', '비스트', '추격전', '경광등을 켜고 대상이 앞 9~42m 에 있는 동안 차오릅니다. 가득 차면 잠깐 힘이 세집니다', '힘 ↑', 't', 'H'],
      ['#btnKics', '📝', '발생보고', '이륜차 등이 정차 요구에 불응하고 달아났을 때', '쫓지 않고 채증한 뒤 발생보고를 올립니다 — 나중에 불러 통고처분합니다', '보고|올림', 't', 'Y'],
      ['#btnBox', '🔧', '신호 제어함', '교차로 근무 · 제어함 3m 안', '조작판이 열립니다. 자동 → 수동, 막힌 방향에 녹색을 더 줍니다(보행 신호 시간은 줄일 수 없음 · 미리 눌러 두기)', '조작판', 't', 'O'],
      ['#btnHand', '✋', '손 들기 · 꼬리 끊기', '걸을 때 · 어린이 교실 · 교차로 근무', '어린이 횡단 4단계(멈춘다 · 본다 · 손을 든다 · 걷는다) — 교차로에서는 수신호로 진입을 끊습니다', '수신호', 't', 'G'],
      ['#btnLook', '👀', '살피기', '어린이 교실', '고개를 좌우로 돌려 차가 오는지 봅니다', '좌우|살핌', 't', 'Space'],
      ['#btnRun', '🏃', '걷기 · 달리기', '차에서 내려 걸을 때', '누를 때마다 걷기 ↔ 달리기', '달림', 't', 'Shift']
    ] },
    { id: 'class', t: '🏫 교실 단추', bg: 'walk', it: [
      ['#btnBikeBrake', '✊', '자전거 브레이크', '청소년 교실', '꾹 누르는 동안 섭니다', '멈춤', 'h', '↓'],
      ['#btnBikeLook', '👀', '좌우 살피기', '청소년 교실', '건너기 전에 양쪽을 봅니다', '좌우', 't', 'Space'],
      ['#btnBikeMount', '🚲', '내리기 · 타기', '청소년 교실', '횡단보도 앞에서 내려 끌고 건넙니다', '내려서|끌기', 't', 'X'],
      ['#btnBikeBell', '🔔', '벨', '청소년 교실', '앞사람에게 알립니다', '따르릉', 't', 'Z'],
      ['#btnTotWalk', '👣', '꾹 걸어요', '영아 교실', '꾹 누르는 동안 걷고, 떼면 멈춥니다(얼음땡)', '걷기|얼음', 'h', '↑'],
      ['#btnTotNext', '▶', '다음 마당', '영아 교실', '다음 놀이로 넘어갑니다', '다음', 't', '']
    ] },
    { id: 'screen', t: '📱 화면 위 단추', bg: 'menu', it: [
      ['#hudbar', '🎖', '계기 칸', '화면 위 왼쪽', '속도·제한속도·점수를 보여 줍니다. 누르면 계급·진급 막대가 잠깐 나옵니다', '계급|막대', 't', ''],
      ['#minimap', '🗺', '지도', '화면 위 오른쪽', '누르면 크게 봅니다. 메뉴 지도 줄에서 자동(신호 앞에서 접힘) · 늘 펼침 · 아이콘만을 고릅니다', '크게|보기', 't', '+ −'],
      ['#btnView', '🎥', '시점', '화면 위', '뒤에서 보기(3인칭) ↔ 차 안에서 보기(1인칭)', '3인칭|↔1인칭', 't', 'C'],
      ['#btnSpeed', '⏩', '배속', '화면 위', '신호를 기다릴 때 시간을 빨리 흐르게 합니다', '시간|빨리', 't', '[ ] \\'],
      ['#btnPause', '⏸', '일시정지', '화면 위', '멈추고 메뉴를 엽니다', '멈춤', 't', 'Esc'],
      ['#btnMenu', '☰', '메뉴', '화면 위', '설정 · 화면 배치 · 도로 복귀 · 근무 종료', '메뉴', 't', ''],
      ['#btnCtlHelp', '?', '조작 설명', '화면 위', '글로 된 조작 설명(단속 원칙 · 추격 · 교차로 근무까지)', '글로|보기', 't', ''],
      [null, '✋', '단추 옮기기', '화면의 아무 단추나', '단추를 0.4초 길게 누른 채 끌면 원하는 자리로 옮겨집니다 — 처음 자리로는 메뉴 「화면 배치 처음으로」', '끌어서 옮김', 'd', '']
    ] },
    { id: 'menu', t: '☰ 메뉴 단추', bg: 'menu', it: [
      ['#btnBuzzTest', '📳', '진동 시험', '메뉴 · 「충돌 진동」 아래', '짧게 · 길게 · 두 번 떨려 봅니다 — 이 폰이 진동이 되는지 확인(아이폰은 진동 기능이 없음)', '부르르', 't', ''],
      ['#btnStickReset', '🕹', '조이스틱 자리 처음으로', '메뉴 · 「조이스틱」 아래', '옮겨 둔 조이스틱을 처음 자리로 돌립니다', '제자리로', 't', ''],
      ['#btnVoiceTest', '🔊', '목소리 들어보기', '메뉴 · 「목소리」 아래', '고른 목소리로 한 문장 읽어 줍니다', '말해|봄', 't', ''],
      ['#pmView', '🎥', '시점 전환', '메뉴 아래 단추 줄', '메뉴를 닫고 3인칭 ↔ 1인칭으로 바꿉니다', '3인칭|↔1인칭', 't', 'C'],
      ['#pmHelp', '❔', '조작 설명', '메뉴 아래 단추 줄', '글로 된 조작 설명을 엽니다', '글로|보기', 't', ''],
      ['#pmSpeed', '⏩', '배속', '메뉴 아래 단추 줄', '메뉴를 닫고 배속 칸을 엽니다 — 신호 기다릴 때 시간을 빨리', '시간|빨리', 't', '[ ]'],
      ['#pmFirst', '🚓', '첫 출근 다시', '메뉴 아래 단추 줄', '사수와 함께하는 첫 출근을 처음부터 다시 합니다', '처음|부터', 't', ''],
      ['.mmpick[data-mm="auto"]', '🗺', '지도 자동', '메뉴 · 지도 줄', '평소엔 펼쳐 두고 신호 앞에서는 접어 신호등을 가리지 않습니다', '신호 앞|접힘', 't', ''],
      ['.mmpick[data-mm="on"]', '🗺', '지도 늘 펼침', '메뉴 · 지도 줄', '지도를 늘 펼쳐 둡니다', '늘|펼침', 't', ''],
      ['.mmpick[data-mm="tap"]', '🗺', '지도 아이콘만', '메뉴 · 지도 줄', '작은 아이콘만 두고, 누르면 10초 동안 펼칩니다', '누르면|10초', 't', ''],
      ['#btnResume', '▶', '계속', '메뉴', '메뉴를 닫고 하던 근무를 잇습니다', '이어서', 't', 'Esc'],
      ['#btnLayoutReset', '↩', '화면 배치 처음으로', '메뉴', '길게 눌러 옮겨 둔 단추를 전부 처음 자리로 돌립니다', '전부|제자리', 't', ''],
      ['#btnRecover', '🛣', '도로로 복귀', '메뉴', '길 밖이나 물에 빠져 못 움직일 때 — 마지막으로 달린 도로 자리로 옮겨 줍니다', '도로|위로', 't', ''],
      ['#btnQuit', '🏁', '근무 종료', '메뉴', '지금까지 한 것으로 근무를 끝내고 결과를 봅니다', '결과|보기', 't', '']
    ] },
    { id: 'set', t: '⚙ 메뉴 설정 줄', pics: true },
    { id: 'title', t: '🏠 처음 화면 · 결과 화면', bg: 'title', it: [
      ['#btnStart', '🚓', '출근하기', '처음 화면 가운데', '순찰 근무 한 판(5분). 캠페인 장이 있으면 그 장을 엽니다', '한 판|5분', 't', ''],
      ['#mapChips', '🗺', '지도 고르기', '처음 화면 › 🎮 다른 근무 상자', '실제 크기 서초 · 디지털 트윈 · 놀이용 지도 중에서 고릅니다(🗜 데이터 압축지도는 다른 쪽으로). 운전 중에는 순환도로 밖 관문으로도 건너갑니다', '지도|바꿈', 't', ''],
      ['#btnArea', '📍', '출발 지역', '처음 화면 › 🎮 다른 근무 상자', '동네를 고르면 그 자리에서 출발하고, 공공데이터로 그 동네를 자세히 봅니다', '동네|고름', 't', ''],
      ['.carpick', '🚔', '순찰차 고르기', '처음 화면 › ⚙ 차량·시점 상자', '차마다 가속·최고속도가 다릅니다(카드에 보이는 제원이 실제 물리값). 랜덤이면 근무마다 다른 차', '차|바꿈', 't', ''],
      ['.viewpick', '🎥', '시점', '처음 화면 › ⚙ 차량·시점 상자', '추적(3인칭) 또는 차내(1인칭)로 시작합니다', '3인칭|1인칭', 't', ''],
      ['.wpick', '🌦', '날씨', '처음 화면 › ⚙ 차량·시점 상자', '메뉴의 「날씨·시간」과 같은 것 — 시작 전에 고릅니다', '날씨|고름', 't', ''],
      ['.simpick', '🧪', '방식 — 게임 / 시뮬레이션', '처음 화면 › ⚙ 차량·시점 상자', '시뮬레이션은 운전 보조·칭찬·무전·캠페인·연출을 끄고 같은 시드로 돕니다(바꾸면 다시 불러옴)', '보조|끔', 't', ''],
      ['#campPick', '📖', '캠페인 장', '처음 화면 › ⚙ 차량·시점 상자', '이미 연 장을 골라 다시 합니다 — 「출근하기」가 그 장을 엽니다. 「처음부터」는 1장으로', '장|고름', 't', ''],
      ['.clspick', '🔗', '교실 바로 열기', '처음 화면 › ⚙ 차량·시점 상자', '청소년 · 어린이 · 영아 교실을 바로 여는 QR 과 주소 — 📋 주소 복사로 나눠 줍니다', 'QR|주소', 't', ''],
      ['.avpick', '👮', '내 경찰관', '처음 화면 › ⚙ 차량·시점 상자', '내려서 걸을 때의 내 모습(키 · 체형)', '내|모습', 't', ''],
      ['#lnkPromo', '📣', '교통안전 홍보 영상', '처음 화면 › 🎮 다른 근무 상자', '홍보 영상 쪽을 새 창으로 엽니다', '새 창', 't', ''],
      ['#lnkIntroAgain', '🎬', '인트로 다시 보기', '처음 화면 › 🎮 다른 근무 상자', '첫 장면을 다시 봅니다', '다시|보기', 't', ''],
      ['#lnkFull', '⛶', '전체화면', '처음 화면 › 🎮 다른 근무 상자', '주소창 없이 화면을 꽉 채웁니다', '꽉|채움', 't', ''],
      ['#btnShare', '📤', '결과 카드', '근무 결과 화면', '오늘 근무 결과를 한 장 카드로 만듭니다', '카드|만듦', 't', ''],
      ['#btnRetry', '▶', '다시', '근무 결과 화면', '같은 근무를 바로 한 판 더', '한 판|더', 't', '']
    ] },
    { id: 'modes', t: '🎮 근무 종류 — 할 수 있는 것', bg: 'title', it: [
      ['[data-mode="patrol"]', '🚓', '순찰 근무', '처음 화면 「출근하기」 · 🎮 다른 근무 상자', '시내를 돌며 위반을 단속하고 112 신고에 출동합니다 — 한 판 5분', '단속|출동', 'p', ''],
      ['[data-mode="circuit"]', '🎓', '연습 서킷', '🎮 다른 근무 상자', '차도 사람도 없는 연습 길에서 운전만 익힙니다 — 한 바퀴·구간 기록을 잽니다', '운전|연습', 'p', ''],
      ['[data-mode="duty"]', '🚦', '교차로 근무', '🎮 다른 근무 상자', '교차로에서 내려 신호 제어함을 다루고, 수신호로 꼬리물기를 풉니다', '신호|잡기', 'p', ''],
      ['[data-mode="chase"]', '🚨', '추격전', '🎮 다른 근무 상자', '수배·절도·음주 의심 차만 — 무전 먼저, 경광등 켜고 10~40m 거리로 20초 따라가면 섭니다(8m 안은 추돌 위험 · 어린이보호구역으로 달아나면 끊는 것이 정답)', '안전|추격', 'p', ''],
      ['[data-mode="walk"]', '🚶', '도보 근무', '🎮 다른 근무 상자', '걸어서 순찰합니다 — 보행 신호를 지키며 건넙니다', '걸어서', 'p', ''],
      ['[data-mode="jam"]', '🧩', '꼬리물기 풀기', '🎮 다른 근무 상자', '얽힌 교차로의 차를 차례로 빼내는 1분 퍼즐 — 오늘의 문제', '1분|퍼즐', 'p', ''],
      ['[data-mode="crazy"]', '🔥', '크레이지', '🎮 다른 근무 상자', '근무가 아닌 주행 연습 — 제한 시간 안에 금색 관문을 차례로 지납니다(사람을 치면 바로 끝)', '관문|통과', 'p', ''],
      ['[data-mode="open"]', '🌆', '오픈 순찰', '🎮 다른 근무 상자 · 경위부터', '시간 제한 없이 — 차가 많고 수배차가 더 자주 나옵니다. 끝내는 것은 메뉴 「근무 종료」', '무제한', 'p', ''],
      ['[data-mode="bike"]', '🚲', '청소년 교실', '🎮 다른 근무 상자 · 중·고등', '자전거로 네 장면 — 페달 · 브레이크 · 살피기 · 내려서 끌기', '자전거', 'p', ''],
      ['[data-mode="kid"]', '🧒', '어린이 교실', '🎮 다른 근무 상자 · 초등', '걸어서 길 건너기 — 멈춘다 · 본다 · 손을 든다 · 걷는다', '길|건너기', 'p', ''],
      ['[data-mode="tot"]', '👶', '영아 교실', '🎮 다른 근무 상자 · 4세', '꾹 누르면 걷고 떼면 멈추는 얼음땡 놀이', '얼음땡', 'p', ''],
      ['[data-mode="study"]', '📖', '학습·교통안전교실', '🎮 다른 근무 상자', '교통사고 12대 중과실 카드 · 자전거·킥보드 안전 카드 — 「체험하기」로 그 장면에 바로 갑니다', '카드|체험', 'p', ''],
      ['[data-mode="plan"]', '🏗', '교통시설', '🎮 다른 근무 상자', '교차로마다 신호 녹색 시간을 정하고 무인 단속 장비를 세웁니다(보행 시간은 줄일 수 없음)', '신호|시설', 'p', ''],
      ['[data-mode="hood"]', '🗺', '우리 동네', '🎮 다른 근무 상자', '교차로를 지킨 만큼 동네 안전 지수가 오릅니다(게임 설계값 — 실제 안전도가 아님)', '동네|지수', 'p', ''],
      ['[data-mode="dex"]', '📚', '도감', '🎮 다른 근무 상자', '위반 · 인물 · 교차로 도감 — 아직 못 본 칸을 채웁니다', '모으기', 'p', '']
    ] }
  ];
  var BG = {
    road: '<rect width="120" height="72" rx="9" fill="#1b2332"/><rect y="58" width="120" height="14" fill="#3b4352"/><path d="M0 65H120" stroke="#e9e9e9" stroke-width="1" stroke-dasharray="6 5"/>',
    walk: '<rect width="120" height="72" rx="9" fill="#1d2a22"/><rect y="58" width="120" height="14" fill="#46523f"/><path d="M8 65h10M26 65h10M44 65h10M62 65h10M80 65h10M98 65h10" stroke="#e9e9e9" stroke-width="5"/>',
    menu: '<rect width="120" height="72" rx="9" fill="#202838"/><rect x="3" y="3" width="114" height="66" rx="7" fill="none" stroke="#4a5a76" stroke-dasharray="3 3"/>',
    title: '<rect width="120" height="72" rx="9" fill="#16305c"/><circle cx="106" cy="8" r="18" fill="#22457e"/>'
  };
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }
  // 「누르면 → 이렇게 된다」 그림: 왼쪽 단추 · 손가락 · 오른쪽 결과 말풍선
  function cpSvg(e, bg) {
    var an = e[6] || 't', r = String(e[5] || '').split('|'), d = an === 'd';
    var big = e[1].length <= 2 && /[^\x00-\x7f]/.test(e[1]);
    var s = '<svg class="cp an-' + an + '" viewBox="0 0 120 72" aria-hidden="true">' + (BG[bg] || BG.road);
    s += '<g class="cbt"><rect class="cbr" x="10" y="18" width="32" height="32" rx="8" fill="rgba(255,255,255,.16)" stroke="#e6ecf5" stroke-width="1.4"/>' +
      (an === 'h' ? '<circle class="crg" cx="26" cy="34" r="19" fill="none" stroke="#ffd36b" stroke-width="2.4" stroke-dasharray="120" stroke-dashoffset="120" transform="rotate(-90 26 34)"/>' : '') +
      TXT(26, big ? 39.5 : 39, big ? 15 : 13, esc(e[1])) + '</g>';
    if (!d) s += '<path d="M47 34h7M51 30l4 4-4 4" stroke="#9fb0c8" stroke-width="2" fill="none" stroke-linecap="round"/>';
    if (d) s += '<g class="cres"><rect x="56" y="3" width="60" height="15" rx="6" fill="#ffe9a8"/>' + TXT(86, 13.6, 8.5, esc(r.join(' ')), '', '#3a2a10') + '</g><path d="M50 34h18" stroke="#9fb0c8" stroke-width="1.4" stroke-dasharray="3 3"/>';
    else s += '<g class="cres"><rect x="59" y="15" width="57" height="38" rx="7" fill="#ffe9a8"/>' +
      (r.length > 1 ? TXT(87.5, 31, 9.5, esc(r[0]), '', '#3a2a10') + TXT(87.5, 45, 9, esc(r[1]), '', '#5a4410') : TXT(87.5, 38, 10, esc(r[0]), '', '#3a2a10')) + '</g>';
    if (an !== 'p') s += '<g class="cfg">' + TXT(0, 0, 15, '👆') + '</g>';
    return s + '</svg>';
  }
  function flat() { var a = []; BOOK.forEach(function (g, gi) { if (g.pics) Object.keys(PICS).forEach(function (k) { if ($(k)) a.push([gi, k]); }); else g.it.forEach(function (e, ii) { a.push([gi, ii]); }); }); return a; }
  function inTray(el) { return el && el.closest && el.closest('#toolTray') && !document.body.classList.contains('toolsopen'); }
  function liveEl(sel) { if (!sel || G().state !== 'play') return null; var el = document.querySelector(sel); return el && !inTray(el) && !el.closest('.overlay') && shown(el) ? el : null; }   // 메뉴·처음 화면 단추는 「지금 화면」이 아니다
  var bk = { built: false };
  function buildBook() {
    var v = $('gbView'); if (!v) return;
    var all = flat(), h = '<div class="card gb"><div class="gb-top"><b>📖 그림 사전</b><span>단추 · 설정 · 근무 <b>빠짐없이 ' + all.length + '가지</b> — 눌러서 크게</span><button type="button" class="ghost gb-x">닫기 ✕</button></div><div class="gb-tabs">';
    BOOK.forEach(function (g) { h += '<button type="button" class="ghost" data-j="' + g.id + '">' + g.t.split(' ')[0] + '<small>' + g.t.replace(/^\S+\s/, '').split(' — ')[0] + '</small></button>'; });
    h += '</div><div class="gb-body">';
    BOOK.forEach(function (g, gi) {
      var n = g.pics ? Object.keys(PICS).filter(function (k) { return $(k); }).length : g.it.length;
      h += '<h4 data-s="' + g.id + '">' + g.t + ' <small>' + n + '가지</small></h4><div class="gb-grid">';
      if (g.pics) Object.keys(PICS).forEach(function (k) { if ($(k)) h += '<button type="button" class="gb-it" data-k="' + k + '"><span class="spic gb-pic" data-k="' + k + '">' + svgOf(k) + '</span><b>' + PICS[k].t + '</b><small>메뉴 줄 · 켜면 · 끄면 그림</small></button>'; });
      else g.it.forEach(function (e, ii) { h += '<button type="button" class="gb-it" data-g="' + gi + '" data-i="' + ii + '"><span class="gb-pic">' + cpSvg(e, g.bg) + '</span><b>' + e[2] + '</b><small>' + e[3] + '</small>' + (e[7] ? '<i>⌨ ' + esc(e[7]) + '</i>' : '') + '<u>👀 지금 화면에</u></button>'; });
      h += '</div>';
    });
    h += '<div class="gb-end">더 자세한 글은 「📝 글로 보기」(조작 설명) · 손가락으로 따라 하는 장면은 「🎬 움직여 보기」</div></div></div>';
    v.innerHTML = h;
    tap(v.querySelector('.gb-x'), function () { book(false); });
    Array.prototype.forEach.call(v.querySelectorAll('[data-j]'), function (b) { tap(b, function () { jump(b.getAttribute('data-j')); }); });
    Array.prototype.forEach.call(v.querySelectorAll('.gb-it'), function (b) {
      tap(b, function () { var k = b.getAttribute('data-k'); if (k) openPic(k); else openEntry(+b.getAttribute('data-g'), +b.getAttribute('data-i')); });
    });
    bk.built = true;
  }
  function jump(id) {
    var v = $('gbView'), body = v && v.querySelector('.gb-body'), h = body && body.querySelector('[data-s="' + id + '"]'); if (!h) return;
    body.scrollTop = h.offsetTop - body.offsetTop - 2;
  }
  function markNow() {
    var v = $('gbView'); if (!v) return;
    Array.prototype.forEach.call(v.querySelectorAll('.gb-it[data-g]'), function (b) { var e = BOOK[+b.getAttribute('data-g')].it[+b.getAttribute('data-i')]; b.classList.toggle('now', !!liveEl(e[0])); });
    Array.prototype.forEach.call(v.querySelectorAll('.gb-pic.spic'), function (s) { paint(s, $(s.getAttribute('data-k'))); });
  }
  function book(on, id) {
    var v = $('gbView'), g = G(); if (!v) return;
    if (on) { if (!bk.built) buildBook(); markNow(); v.style.display = 'flex'; if (g.setPaused && g.state === 'play') g.setPaused(true, 'guide'); if (id) jump(id); }
    else { v.style.display = 'none'; closePic(); if (g.setPaused && g.state === 'play') g.setPaused(false, 'guide'); }
  }
  // 한 칸 크게 — 어디·언제 / 어떻게 / 키 · ◀ ▶ 로 다음 칸 · 지금 화면에 있으면 👀
  function openEntry(gi, ii) {
    var g = BOOK[gi], e = g && g.it && g.it[ii], v = $('spicView'); if (!e || !v) return;
    v.setAttribute('data-k', '');
    var live = liveEl(e[0]);
    var h = '<div class="card spv gbd"><h3>' + esc(e[1]) + ' ' + e[2] + ' <small>' + g.t + '</small></h3><div class="gbd-pic">' + cpSvg(e, g.bg) + '</div>' +
      '<dl><dt>📍 어디 · 언제</dt><dd>' + e[3] + '</dd><dt>👆 어떻게</dt><dd>' + e[4] + '</dd>' + (e[7] ? '<dt>⌨ 키보드</dt><dd>' + esc(e[7]) + '</dd>' : '') + '</dl><div class="spv-btns">' +
      (live ? '<button type="button" class="ghost" data-live="1">👀 지금 화면에서 보기</button>' : '') +
      '<button type="button" class="ghost" data-n="-1">◀</button><button type="button" class="ghost" data-n="1">▶</button><button type="button" class="primary" data-x="1">닫기</button></div></div>';
    v.innerHTML = h; v.style.display = 'flex';
    tap(v.querySelector('[data-x]'), closePic);
    Array.prototype.forEach.call(v.querySelectorAll('[data-n]'), function (b) {
      tap(b, function () {
        var all = flat(), at = 0; all.forEach(function (x, i) { if (x[0] === gi && x[1] === ii) at = i; });
        var nx = all[(at + (+b.getAttribute('data-n')) + all.length) % all.length];
        if (typeof nx[1] === 'string') openPic(nx[1]); else openEntry(nx[0], nx[1]);
      });
    });
    tap(v.querySelector('[data-live]'), function () {
      closePic(); var bv = $('gbView'); if (bv) bv.style.display = 'none';
      tags([[e[0], e[2]]]);
    });
  }
  // 메뉴 단추에도 그림 — 단추 안 왼쪽(줄 단추는 위)에 작은 그림 · 그림만 누르면 크게(단추 기능은 그대로)
  function decorateButtons() {
    var gi = 0; BOOK.forEach(function (g, i) { if (g.id === 'menu') gi = i; });
    BOOK[gi].it.forEach(function (e, ii) {
      var b = document.querySelector('#pause ' + e[0]); if (!b || b.querySelector('.bpic')) return;
      var s = document.createElement('span'); s.className = 'spic bpic'; s.setAttribute('role', 'button'); s.title = e[2] + ' — 그림을 누르면 크게';
      s.innerHTML = cpSvg(e, 'menu') + '<em>⤢</em>';
      b.insertBefore(s, b.firstChild); b.classList.add('has-bpic', b.closest('.pm-row') ? 'bp-top' : 'bp-side');
      var sx = 0, sy = 0;
      s.addEventListener('pointerdown', function (ev) { ev.stopPropagation(); sx = ev.clientX; sy = ev.clientY; });   // 단추 기능(pointerdown)으로 안 넘긴다
      s.addEventListener('pointerup', function (ev) { ev.stopPropagation(); if (Math.abs(ev.clientX - sx) < 12 && Math.abs(ev.clientY - sy) < 12) openEntry(gi, ii); });
      s.addEventListener('click', function (ev) { ev.preventDefault(); ev.stopPropagation(); });
    });
  }

  function init() {
    if (!$('pause')) return;
    ['spicView', 'gdView', 'gbView'].forEach(function (id) { if (!$(id)) { var d = document.createElement('div'); d.id = id; d.className = 'overlay'; document.body.appendChild(d); } });
    decorate(); decorateButtons();
    bindVeil('spicView', closePic); bindVeil('gdView', function () { gallery(false); }); bindVeil('gbView', function () { book(false); });
    Array.prototype.forEach.call(document.querySelectorAll('[data-guide]'), function (b) {
      var k = b.getAttribute('data-guide');
      tap(b, function () {
        var g = G();
        if (k === 'motion') gallery(true);
        else if (k === 'book') { if (g.showCtlHelp && $('ctlHelp').style.display === 'flex') g.showCtlHelp(false); book(true); }
        else if (k === 'tags') { if (g.showCtlHelp && $('ctlHelp').style.display === 'flex') g.showCtlHelp(false); tags(); }
        else if (k === 'text') { if (g.setPaused) g.setPaused(false, 'menu'); if (g.showCtlHelp) g.showCtlHelp(true); }
      });
    });
    // 「이름표」는 근무 중에만(타이틀에는 붙일 단추가 없다)
    function paintTags() { var on = G().state === 'play'; Array.prototype.forEach.call(document.querySelectorAll('[data-guide="tags"]'), function (b) { b.disabled = !on; b.title = on ? '' : '근무 중에 쓸 수 있습니다'; }); }
    ['pause', 'ctlHelp'].forEach(function (id) { var e = $(id); if (e && window.MutationObserver) new MutationObserver(paintTags).observe(e, { attributes: true, attributeFilter: ['style', 'class'] }); });
    paintTags();
    var nAll = flat().length; Array.prototype.forEach.call(document.querySelectorAll('[data-guide="book"] small'), function (e) { e.textContent = '단추 · 설정 · 근무 ' + nAll + '가지'; });
    function repaint() { Array.prototype.forEach.call(document.querySelectorAll('#pause .spic'), function (b) { paint(b, $(b.getAttribute('data-k'))); }); }
    if (window.MutationObserver) new MutationObserver(repaint).observe($('pause'), { attributes: true, attributeFilter: ['style', 'class'] });
    repaint();
    TG.guide = { gallery: gallery, tags: tags, openPic: openPic, book: book, entry: openEntry, count: function () { return flat().length; }, repaint: repaint, steps: STEPS.length, pics: Object.keys(PICS) };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
