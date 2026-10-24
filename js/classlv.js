// 🏫 교통안전 교실 레벨업 — 청소년 · 어린이 · 영유아 세 교실의 성장판(v0.10.114).
//  소유자(2026-10-24): 「교통안전교실을 분리해서 청소년 어린이 영유아로 나누어져 있는데 **제대로 미션을 마치면 레벨업**되게 하면서
//   **성취감을 자극**하게 구성 · 매우 리얼리스틱하게 완벽하게」.
//
// 규칙
//  ① 레벨은 **미션을 제대로 마쳐야** 오른다 — 시간을 오래 들이거나 점수를 모아서는 안 오른다. 레벨마다 「이 미션들을 이만큼 잘」이 정해져 있다.
//     「제대로」의 잣대는 교실이 이미 재는 값을 그대로 쓴다 — 어린이 횡단 별(멈춤·초록불·걷기) · 청소년 장면 재시도 횟수 · 영유아 「아직이야」.
//  ② 미션마다 **가장 잘한 기록**만 남는다(⭐1~3). 못해도 깎지 않는다 — 다시 하면 더 좋은 기록이 남는다(교실에서는 벌하지 않는다).
//  ③ 마지막 레벨은 **모든 미션을 완벽하게** — 한 번 운 좋게 지나간 것으로는 안 된다(습관이 되었는지).
//  ④ 영유아(만 3~5세)는 **숫자·점수를 보이지 않는다**(tot.js 스펙) — 「스티커」와 반 이름으로만.
//  ⑤ 이 기기에만 저장한다(localStorage 키 tg_classlv) — 서버 0 · 네트워크 0 그대로.
TG.ClassLv = function (game) {
  var self = this, G = game;
  var Q = { pass: 1, good: 2, perfect: 3 };
  // 미션 이름은 각 교실 모듈의 마당·장면 이름과 같게 둔다(모듈을 고치면 여기도).
  var TR = {
    tot: { key: 'tot', icon: '👶', name: '영유아 교실', who: '만 3~5세 · 어린이집·유치원', unit: '스티커', nums: false, mode: 'tot', col: '#f59e0b',
      m: { where: '여기는 어디?', ice: '얼음땡 놀이', hold: '토수니 손 잡기', cross: '다섯 걸음으로 건너기', tryme: '해보기 — 만약에', alley: '골목길', belt: '안전벨트 딸깍', bright: '밝은 옷' },
      L: [
        { icon: '🌱', name: '새싹반',     need: { where: 1, ice: 1 },   learn: '길·보도·횡단보도를 알고, 빨간불에는 얼음!' },
        { icon: '🌼', name: '꽃잎반',     need: { hold: 1, cross: 1 },  learn: '어른 손을 잡고 서다 · 보다 · 걷다로 건너요' },
        { icon: '🌈', name: '무지개반',   need: { tryme: 1, alley: 1 }, learn: '「만약에」에도 손을 잡고, 골목은 가장자리로 걸어요' },
        { icon: '🐻', name: '토수니 짝꿍', need: { belt: 1, bright: 1 }, learn: '차에서는 안전벨트 딸깍, 밖에서는 밝은 옷' },
        { icon: '🏅', name: '꼬마 교통안전 지킴이', need: 'all3', learn: '여덟 마당을 「아직이야」 없이 — 이제 습관이 되었어요' }
      ] },
    kid: { key: 'kid', icon: '🧒', name: '어린이 교실', who: '초등학생 · 보행', unit: '배지', nums: true, mode: 'kid', col: '#2563eb',
      m: { walk: '걸을 자리', cross: '건널 자리(⭐ 멈춤·초록불·걷기)', car: '차에 탈 때', bike: '자전거', pm: '킥보드', rain: '비 오는 날', jungle: '서로 조심' },
      L: [
        { icon: '🚶', name: '걸음 지킴이',   need: { walk: 2 },          learn: '차도·길가장자리가 아니라 보도로 걸어요' },
        { icon: '🚦', name: '횡단보도 박사', need: { cross: 2 },         learn: '멈추고 · 초록불에 · 뛰지 않고 건너요(⭐2 이상)' },
        { icon: '🚗', name: '차 안전 대장',  need: { car: 2, rain: 2 },  learn: '차 안에서도 다쳐요 — 안전띠 · 인도 쪽 문 · 비 오는 날 투명 우산' },
        { icon: '🛴', name: '탈것 살피미',   need: { bike: 2, pm: 2 },   learn: '자전거 · 킥보드 · 오토바이도 살펴요' },
        { icon: '🌳', name: '어린이 교통안전 리더', need: { jungle: 2, cross: 3 }, learn: '일곱 가지를 다 배우고, 횡단은 ⭐3 — 청소년 자전거 교실이 열려요' }
      ] },
    bike: { key: 'bike', icon: '🚲', name: '청소년 교실', who: '중·고등학생 · 자전거', unit: '라이더 등급', nums: true, mode: 'bike', col: '#16a34a',
      m: { gap: '차 사이로 나가기', cross: '횡단보도는 끌고', lane: '어디로 달릴까', brake: '멈추는 거리', 'class': '이건 자전거일까?', free: '자유 주행' },
      L: [
        { icon: '🥉', name: '브론즈 라이더', need: { gap: 2 },                 learn: '🛑 멈추고 👀 살핀 뒤 나가요 — 차 사이에서 갑자기 나가지 않아요' },
        { icon: '🥈', name: '실버 라이더',   need: { cross: 2, lane: 2 },      learn: '횡단보도는 내려서 끌고, 차도 오른쪽 가장자리로 달려요' },
        { icon: '🥇', name: '골드 라이더',   need: { brake: 2, 'class': 2 },   learn: '멈추는 데는 거리가 든다 · 스로틀 달린 「자토바이」는 자전거가 아니다' },
        { icon: '🏆', name: '로드 마스터',   need: { free: 2 },                learn: '원칙대로 자유 주행 — 가장자리 · 신호 · 끌고 건너기' },
        { icon: '🪪', name: '원동기 면허 준비생', need: 'all3', learn: '여섯 장면을 재시도 없이 — 만 16세 원동기 면허 공부를 시작할 차례' }
      ] }
  };
  self.tracks = TR;
  var D = TG.save.get('classlv', null);
  if (!D || typeof D !== 'object') D = {};
  Object.keys(TR).forEach(function (k) { if (!D[k] || typeof D[k] !== 'object') D[k] = { best: {}, lv: 0, n: 0 }; if (!D[k].best) D[k].best = {}; });
  function save() { TG.save.set('classlv', D); }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function needOf(t, L) { if (L.need !== 'all3') return L.need; var o = {}; Object.keys(t.m).forEach(function (id) { o[id] = 3; }); return o; }
  function met(k, L) { var t = TR[k], n = needOf(t, L), b = D[k].best; return Object.keys(n).every(function (id) { return (b[id] || 0) >= n[id]; }); }
  function lvOf(k) { var t = TR[k], l = 0; for (var i = 0; i < t.L.length; i++) { if (met(k, t.L[i])) l = i + 1; else break; } return l; }
  self.level = function (k) { return lvOf(k); };
  // 다음 레벨까지 남은 것 — [미션 id, 이름, 지금 ⭐, 필요 ⭐]
  self.todo = function (k) { var t = TR[k], l = lvOf(k); if (l >= t.L.length) return []; var n = needOf(t, t.L[l]), b = D[k].best;
    return Object.keys(n).filter(function (id) { return (b[id] || 0) < n[id]; }).map(function (id) { return [id, t.m[id] || id, b[id] || 0, n[id]]; }); };
  self.best = function (k, id) { return D[k].best[id] || 0; };

  // ---- 미션 하나를 마쳤다 ----
  //  k = 'tot' | 'kid' | 'bike' · id = 미션 · q = 1~3(또는 'pass'·'good'·'perfect')
  self.award = function (k, id, q) {
    if (TG.mode && TG.mode.sim) return 0;
    var t = TR[k]; if (!t || !t.m[id]) return 0;
    q = typeof q === 'string' ? (Q[q] || 1) : TG.clamp(Math.round(+q || 1), 1, 3);
    var b = D[k].best, was = b[id] || 0, l0 = lvOf(k); D[k].n = (D[k].n || 0) + 1;
    if (q > was) b[id] = q;
    var l1 = lvOf(k); D[k].lv = l1; save();
    if (q > was) toast(k, id, q, was);
    if (l1 > l0) for (var L = l0 + 1; L <= l1; L++) queueUp(k, L);
    paintChip();
    return q;
  };

  // ---- 화면 ----
  function el(id) { return document.getElementById(id); }
  function stars(q, max) { var s = ''; for (var i = 1; i <= (max || 3); i++) s += i <= q ? '⭐' : '☆'; return s; }
  function lvLabel(k, l) { var t = TR[k]; if (!l) return t.nums ? 'Lv.0 · 첫걸음' : '첫걸음'; var L = t.L[l - 1]; return (t.nums ? 'Lv.' + l + ' ' : '') + L.name; }
  // 레벨 배지(캔버스 · 에셋 0) — 리본 · 메달 · 그림 · 레벨 띠
  var BADGE = {};
  function badge(k, l) {
    var key = k + l; if (BADGE[key]) return BADGE[key];
    var t = TR[k], L = l ? t.L[l - 1] : null, c = document.createElement('canvas'); c.width = c.height = 200; var g = c.getContext('2d');
    var col = l ? t.col : '#94a3b8', last = l === t.L.length;
    g.fillStyle = last ? '#b91c1c' : col; g.beginPath(); g.moveTo(62, 104); g.lineTo(42, 192); g.lineTo(72, 176); g.lineTo(96, 196); g.lineTo(100, 110); g.fill();
    g.beginPath(); g.moveTo(138, 104); g.lineTo(158, 192); g.lineTo(128, 176); g.lineTo(104, 196); g.lineTo(100, 110); g.fill();
    var gr = g.createRadialGradient(84, 70, 10, 100, 92, 74); gr.addColorStop(0, last ? '#fff7cc' : '#ffffff'); gr.addColorStop(1, last ? '#f2b705' : col);
    g.fillStyle = gr; g.beginPath(); g.arc(100, 92, 70, 0, Math.PI * 2); g.fill();
    g.lineWidth = 7; g.strokeStyle = last ? '#a16207' : 'rgba(15,23,42,.35)'; g.stroke();
    g.lineWidth = 2; g.strokeStyle = 'rgba(255,255,255,.85)'; g.beginPath(); g.arc(100, 92, 60, 0, Math.PI * 2); g.stroke();
    g.font = '64px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(L ? L.icon : t.icon, 100, 88);
    if (t.nums && l) { g.fillStyle = '#0f172a'; g.beginPath(); if (g.roundRect) g.roundRect(64, 138, 72, 26, 13); else g.rect(64, 138, 72, 26); g.fill(); g.fillStyle = '#fff'; g.font = '900 17px system-ui,sans-serif'; g.fillText('Lv.' + l, 100, 152); }
    return (BADGE[key] = c.toDataURL());
  }
  self.badge = badge;
  function toast(k, id, q, was) {
    var t = TR[k], nm = t.m[id] || id, todo = self.todo(k), l = lvOf(k);
    var nx = l < t.L.length ? ' · 다음 「' + t.L[l].name + '」까지 ' + (todo.length ? todo.length + '개' : '거의 다') : '';
    if (G.praise && G.praise.feed) G.praise.feed((t.nums ? stars(q) + ' ' : '🌟 스티커 · ') + nm, 0);
    if (G.hud && G.hud.notice && !(G.mode === 'tot')) G.hud.notice('🏅 ' + nm + ' ' + stars(q) + (was ? ' — 기록이 올랐어요(' + stars(was) + ' → ' + stars(q) + ')' : ' — 미션 완료') + nx, 'good', 3600);
  }
  // 레벨업 창 — 여러 레벨이 한꺼번에 오르면 차례로 보인다
  var UPQ = [], upOn = false;
  function queueUp(k, l) { self.lastUp = k + l; if (G.clvQuiet) return; UPQ.push([k, l]); if (!upOn) nextUp(); }
  function box() {
    var b = el('clvUp'); if (b) return b;
    b = document.createElement('div'); b.id = 'clvUp'; b.setAttribute('role', 'dialog'); b.setAttribute('aria-modal', 'true');
    document.body.appendChild(b);
    b.addEventListener('click', function (e) { var a = e.target.closest('[data-clv]'); if (!a) return; var v = a.getAttribute('data-clv');
      if (v === 'ok') { closeUp(); nextUp(); } else if (v === 'close') { closeUp(); } else if (/^go:/.test(v)) { closeUp(); var mb = document.querySelector('.mpick[data-mode="' + v.slice(3) + '"]'); if (mb) mb.click(); } });
    return b;
  }
  function closeUp() { var b = el('clvUp'); if (b) b.className = ''; upOn = false; if (G.setPaused) G.setPaused(false, 'clvUp'); }
  function nextUp() {
    var q = UPQ.shift(); if (!q) return; upOn = true;
    var k = q[0], l = q[1], t = TR[k], L = t.L[l - 1], last = l === t.L.length, nx = last ? null : t.L[l];
    var nxNeed = nx ? Object.keys(needOf(t, nx)).map(function (id) { return '🔒 ' + esc(t.m[id] || id) + (t.nums && needOf(t, nx)[id] > 1 ? ' ' + stars(needOf(t, nx)[id]) : ''); }).join('<br>') : '';
    var b = box();
    b.innerHTML = '<div class="cu-box' + (last ? ' gold' : '') + '"><div class="cu-kick">' + (last ? '🎓 수료!' : (t.nums ? '레벨 업!' : '참 잘했어요!')) + '</div>' +
      '<img class="cu-badge" alt="' + esc(L.name) + ' 배지" src="' + badge(k, l) + '">' +
      '<div class="cu-name">' + esc(lvLabel(k, l)) + '</div><div class="cu-trk">' + esc(t.icon + ' ' + t.name + ' · ' + t.who) + '</div>' +
      '<div class="cu-learn">✅ ' + esc(L.learn) + '</div>' +
      (nx ? '<div class="cu-next"><b>다음 · ' + esc(lvLabel(k, l + 1)) + '</b><br>' + nxNeed + '</div>' : '<div class="cu-next"><b>' + esc(t.name) + ' 다섯 단계를 모두 마쳤어요</b>' + (k === 'kid' ? '<br>🚲 청소년(자전거) 교실이 기다려요' : k === 'tot' ? '<br>🧒 어린이 교실로 자라요' : '<br>🪪 만 16세가 되면 원동기 면허 — 그전엔 전동킥보드를 타지 않아요') + '</div>') +
      '<div class="cu-btns"><button data-clv="ok">' + (UPQ.length ? '다음 배지 보기 ›' : '계속하기') + '</button></div></div>';
    b.className = 'on' + (last ? ' gold' : '');
    if (G.setPaused) G.setPaused(true, 'clvUp');
    if (TG.audio.totFanfare) TG.audio.totFanfare(); else if (TG.audio.jingle) TG.audio.jingle(4);
    if (G.hud && G.hud.burst) { G.hud.burst(L.icon, 10); G.hud.burst('⭐', 8); }
    if (TG.haptic) TG.haptic([20, 50, 20, 50, 40]);
    if (TG.audio.say) TG.audio.say((t.nums ? '레벨 업! ' : '참 잘했어요! ') + L.name + (last ? '. 수료를 축하해요!' : '이 되었어요!'), { kind: 'narrator', queue: true });
  }
  // 교실 안 작은 줄(HUD) — 지금 레벨 · 다음 레벨까지 남은 미션
  function paintChip() {
    var k = G.mode === 'tot' || G.mode === 'kid' || G.mode === 'bike' ? G.mode : null, c = el('clvChip');
    if (!k) { if (c) c.className = ''; return; }
    if (!c) { c = document.createElement('div'); c.id = 'clvChip'; document.body.appendChild(c); c.addEventListener('click', function () { self.hub(k); }); }
    var t = TR[k], l = lvOf(k), todo = self.todo(k), have = t.nums ? '' : ' · 스티커 ' + Object.keys(D[k].best).length;
    c.innerHTML = '<img alt="" src="' + badge(k, l) + '"><span><b>' + esc(lvLabel(k, l)) + '</b><i>' + (l >= t.L.length ? '수료 🎓' + have : '다음 ' + esc(t.L[l].name) + ' · 남은 미션 ' + todo.length + have) + '</i></span>';
    c.title = '🏫 ' + c.textContent + ' — 누르면 성장판'; c.setAttribute('aria-label', c.title);
    c.className = 'on';
    placeChip(); setTimeout(placeChip, 350);
  }
  // 자리 — 세로 화면은 메뉴 단추 아래(css) · 가로 화면은 계기 칸이 왼쪽 위를 덮으므로 오른쪽 작은 단추 줄 왼쪽 끝 옆(JS 로 잰다)
  function placeChip() { var c = el('clvChip'); if (!c) return; c.style.top = c.style.left = '';
    if (document.body.classList.contains('portrait')) return;
    var L = null; ['btnSpeed', 'btnCtlHelp', 'btnView', 'btnMenu', 'btnPause'].forEach(function (id) { var e = el(id); if (!e || !e.getClientRects().length) return; var r = e.getBoundingClientRect(); if (r.width && (!L || r.left < L.left)) L = r; });
    if (L) { c.style.top = Math.round(L.top) + 'px'; c.style.left = Math.round(L.left - 48) + 'px'; } }
  window.addEventListener('resize', function () { setTimeout(placeChip, 120); });
  self.paint = paintChip;
  // 성장판 — 세 교실(또는 하나) 레벨 · 미션 기록 · 시작 단추
  self.hub = function (only) {
    var b = box(), ks = only ? [only] : ['bike', 'kid', 'tot'];
    var h = '<div class="cu-box hub"><div class="cu-kick">🏫 교통안전 교실 — 성장판</div><div class="cu-trk">미션을 <b>제대로</b> 마치면 레벨이 올라요 · 가장 잘한 기록만 남아요 · 이 기기에만 저장</div>';
    ks.forEach(function (k) {
      var t = TR[k], l = lvOf(k), b2 = D[k].best;
      h += '<section class="cu-tr"><div class="cu-trh"><img alt="" src="' + badge(k, l) + '"><div><b>' + esc(t.icon + ' ' + t.name) + '</b><small>' + esc(t.who) + '</small><em>' + esc(lvLabel(k, l)) + ' / ' + t.L.length + '단계</em></div>' +
        (only ? '' : '<button data-clv="go:' + t.mode + '">시작 ›</button>') + '</div><ol class="cu-lv">';
      t.L.forEach(function (L, i) { var ok = i < l, cur = i === l, n = needOf(t, L);
        h += '<li class="' + (ok ? 'ok' : cur ? 'cur' : 'lock') + '"><span>' + (ok ? '✅' : cur ? '▶' : '🔒') + ' ' + L.icon + ' ' + esc((t.nums ? 'Lv.' + (i + 1) + ' ' : '') + L.name) + '</span>' +
          (cur ? '<div class="cu-ms">' + Object.keys(n).map(function (id) { var q = b2[id] || 0, done = q >= n[id]; return '<i class="' + (done ? 'd' : '') + '">' + (done ? '✔ ' : '· ') + esc(t.m[id] || id) + (t.nums ? ' ' + stars(q) + (n[id] > q ? ' <u>(' + stars(n[id]) + ' 필요)</u>' : '') : '') + '</i>'; }).join('') + '</div>' : '') + '</li>'; });
      h += '</ol></section>';
    });
    h += '<div class="cu-btns"><button data-clv="close">닫기</button></div></div>';
    b.innerHTML = h; b.className = 'on hub'; upOn = true;
    if (G.state === 'play' && G.setPaused) G.setPaused(true, 'clvUp');
  };
  self.hideChip = function () { var c = el('clvChip'); if (c) c.className = ''; };
  self.isOpen = function () { var b = el('clvUp'); return !!(b && /\bon\b/.test(b.className)); };
  self.close = function () { closeUp(); UPQ.length = 0; };
  // 첫 화면 교실 단추에 지금 레벨을 단다
  self.paintMenu = function () {
    ['bike', 'kid', 'tot'].forEach(function (k) {
      var bt = document.querySelector('.mpick[data-mode="' + k + '"]'); if (!bt) return;
      var s = bt.querySelector('.clv'); if (!s) { s = document.createElement('em'); s.className = 'clv'; bt.appendChild(s); }
      s.textContent = lvLabel(k, lvOf(k));
    });
    var hb = el('btnClassHub'); if (hb) { var sm = hb.querySelector('small'); if (sm) sm.textContent = ['bike', 'kid', 'tot'].map(function (k) { return TR[k].icon + ' ' + lvLabel(k, lvOf(k)); }).join(' · '); }
  };
  // 검사 창구 — 기록을 지운다(검사·「처음부터」)
  self.resetAll = function () { Object.keys(TR).forEach(function (k) { D[k] = { best: {}, lv: 0, n: 0 }; }); save(); self.paintMenu(); paintChip(); };
  self.data = function () { return D; };
};
