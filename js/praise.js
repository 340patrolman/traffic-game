// 칭찬 · 콤보 · 등업 · 임무 피드 — 「배우는 맛」 위에 **게임의 맛**을 얹는 층.
//
// 소유자(2026-09-16, 학원 초등 저학년 시연): 「신호위반 같은 것에 대한 이해도는 높아지는데 **게임의 재미가 떨어지는** 것 같아.
//   등업 개념, 훌륭하다는 식으로 칭찬하는 것, 오버워치에서 성우들이 날리는 멘트 같은 **재치 있는 말투**.」
//   그리고 「교통경찰이 되어서 **신나게 단속**하기, **어려운 사람들을 돕기**, **성취감과 보람**, 도로교통법의 이해 —
//   안전하게 이동할 수 있는 기본 개념을 재미있게 느낄 수 있어야 한다」 · 「**콜오브듀티 같은 느낌**도 필요할 듯해」.
//
// 그래서 셋을 함께 둔다 — ① 재치 있는 칭찬(오버워치) ② 등업·콤보(성취) ③ 임무 피드·메달(콜오브듀티).
//
// 규칙 셋 — 이 게임의 원칙은 그대로다.
//  ① **칭찬은 규칙을 지켰을 때만** 나온다. 빨리 달리거나 위험하게 해서 얻는 칭찬은 없다.
//  ② **틀려도 벌하지 않는다.** 콤보만 끊기고 하트·별은 그대로다(영아 교실은 하트를 깎지 않는다 — v0.9.73 스펙).
//  ③ 대사는 **돌려 쓴다.** 같은 말이 두 번 이어 나오면 그 순간 재미가 죽는다(pick 이 직전 것을 피한다).
TG.Praise = function (game) {
  var self = this;
  // 계급(등업) — 아이가 **자기 실력으로 읽는 이름**이다. 실제 경찰 계급을 흉내 내지 않는다.
  var RANKS = [
    { xp: 0,    icon: '🌱', name: '새싹 대원' },
    { xp: 120,  icon: '🚸', name: '횡단보도 지킴이' },
    { xp: 300,  icon: '👀', name: '살피기 달인' },
    { xp: 560,  icon: '🚦', name: '신호 박사' },
    { xp: 900,  icon: '🚲', name: '두 바퀴 고수' },
    { xp: 1350, icon: '🛡', name: '안전 반장' },
    { xp: 1900, icon: '⭐', name: '교통안전 대장' }
  ];
  // 재치 있는 짧은 대사. 길면 못 읽는다 — 화면에서 0.6초 안에 읽히는 길이로 적었다.
  var LINES = {
    stop:    ['멈춤! 그게 진짜 고수지', '브레이크는 겁쟁이가 아니라 프로가 밟는 거야', '딱 멈췄다. 교과서가 울고 갔다'],
    look:    ['좌우 확인 완료 — 눈이 레이더네', '고개 돌리는 그 1초가 목숨이야', '살폈다! 오늘 시야 100점'],
    hand:    ['손 번쩍! 운전자가 널 봤어', '그 손이 제일 밝은 신호등이다', '번쩍 — 존재감 최고'],
    wait:    ['기다림도 실력이다', '초록불은 기다린 사람 편이야', '급할수록 한 박자 — 잘한다'],
    cross:   ['완벽한 횡단! 방금 거 저장했다', '멈추고 보고 손 들고 걷고 — 풀코스다', '건넜다. 오늘 제일 멋진 장면'],
    carstop: ['차 멈춘 거 확인하고 건넜다 — 프로답다', '초록불이어도 차를 봤어. 그게 차이야'],
    bike:    ['내려서 끌기 — 교과서에 실릴 자세', '두 바퀴도 규칙이 먼저. 멋지다', '자전거 고수 등장'],
    quiz:    ['정확한 판단! 현장이 편해진다', '조문까지 맞혔다 — 상황실도 놀랐다', '판단 좋았어. 그대로 가자'],
    stop_ok: ['깔끔한 정차 유도 — 교본대로다', '안전하게 세웠다. 이게 실력이지', '한 대 정리 완료'],
    help:    ['도왔다. 오늘 누군가의 하루를 구했다', '이런 게 경찰이지', '보람 한 스푼 적립'],
    scene:   ['장면 통과! 다음 무대로', '깔끔하게 해냈다', '이건 배웠다고 말해도 된다'],
    tot:     ['우와, 잘했어요!', '최고예요!', '박수! 짝짝짝', '멋지다, 우리 대원!'],
    combo3:  ['3연속 — 몸이 기억하는 중', '3연속! 감 잡았네', '세 번 연속. 이제 습관이다'],
    combo5:  ['5연속! 오늘 컨디션 최고인데?', '5연속 — 이쯤 되면 선생님이다', '다섯 번 연속. 소름'],
    combo8:  ['8연속! 전설이 쓰이는 중', '여덟 번 연속 — 기록 갱신 각', '멈출 줄을 모르네'],
    miss:    ['괜찮아, 다시 가자', '콤보는 끊겼지만 안전이 먼저', '한 번 더 — 아직 하트 그대로야']
  };
  var last = {};
  function pick(k) {
    var a = LINES[k] || [k], i = Math.floor(Math.random() * a.length);
    if (a.length > 1 && i === last[k]) i = (i + 1) % a.length;
    last[k] = i; return a[i];
  }
  function EL(id) { return document.getElementById(id); }

  this.data = TG.save.get('rank', { xp: 0, bestCombo: 0, medals: {} });      // localStorage tg_rank
  if (typeof this.data.xp !== 'number' || !isFinite(this.data.xp)) this.data = { xp: 0, bestCombo: 0, medals: {} };
  if (!this.data.medals) this.data.medals = {};
  this.combo = 0;
  this.session = { xp: 0, praises: 0, bestCombo: 0, rankUps: 0, medals: [] };

  function lvOf(xp) { var l = 0; for (var i = 0; i < RANKS.length; i++) if (xp >= RANKS[i].xp) l = i; return l; }
  this.rank = function (lv) { return RANKS[TG.clamp(lv === undefined ? lvOf(self.data.xp) : lv, 0, RANKS.length - 1)]; };
  this.ranks = RANKS;
  this.next = function () { var l = lvOf(self.data.xp); return l + 1 < RANKS.length ? RANKS[l + 1] : null; };
  this.progress = function () {                                             // 다음 계급까지 0~1
    var l = lvOf(self.data.xp), nx = RANKS[l + 1];
    if (!nx) return 1;
    return TG.clamp((self.data.xp - RANKS[l].xp) / (nx.xp - RANKS[l].xp), 0, 1);
  };
  function save() { TG.save.set('rank', self.data); }

  // ---- 화면 ----
  // 자리를 **늘 차지하지 않는다** — 얻을 때만 떠서 스스로 사라진다(좁은 폰에서 지도·단추를 덮지 않게).
  var bT = 0, cT = 0, xT = 0;
  function banner(text, sub, big) {
    var b = EL('praiseLine'); if (!b) return;
    b.className = 'on' + (big ? ' big' : '');
    var bb = b.querySelector('b'), ii = b.querySelector('i');    // 콤보 알(#comboChip)은 배너 **안에** 있다 — 지우지 않는다
    if (bb) bb.textContent = text;
    if (ii) { ii.textContent = sub || ''; ii.style.display = sub ? '' : 'none'; }
    document.body.classList.add('praising');   // 배너가 떠 있는 동안 안내문을 흐리게 — 글이 겹쳐도 읽힌다
    clearTimeout(bT); bT = setTimeout(function () { b.className = ''; document.body.classList.remove('praising'); }, big ? 2600 : 1700);
  }
  function comboChip() {
    var c = EL('comboChip'); if (!c) return;
    if (self.combo < 2) { c.className = ''; return; }
    c.className = 'on' + (self.combo >= 8 ? ' hot' : self.combo >= 5 ? ' warm' : '');
    c.textContent = '🔥 ' + self.combo + '연속';
    clearTimeout(cT); cT = setTimeout(function () { c.className = ''; }, 2400);
  }
  function xpBar(gain) {
    var w = EL('xpWrap'); if (!w) return;
    self.shift();                                        // 안내문이 떠 있으면 오른쪽 열이 그 아래로 비켜선다
    var r = self.rank(), nx = self.next();
    var ic = EL('xpIcon'), nm = EL('xpName'), fl = EL('xpFill'), tx = EL('xpText');
    if (ic) ic.textContent = r.icon;
    if (nm) nm.textContent = r.name;
    if (fl) fl.style.width = (self.progress() * 100).toFixed(1) + '%';
    if (tx) tx.textContent = (nx ? (self.data.xp - r.xp) + ' / ' + (nx.xp - r.xp) : '최고 계급') + (gain ? '  (+' + gain + ')' : '');
    w.className = 'on';
    clearTimeout(xT); xT = setTimeout(function () { w.className = ''; }, 2800);
  }
  this.shift = function () {
    var nt = EL('notice'), col = EL('xpCol');
    if (!nt || !col) return;
    // 자리는 CSS 가 화면 모양별로 정한다(세로는 큰 단추 위, 가로는 가운데 오른쪽 띠) — 여기서는 옛 인라인 값만 지운다.
    col.style.top = '';
  };
  this.showBar = function () { xpBar(0); };
  // 📋 임무 피드 — 콜오브듀티의 「+50 …」 줄처럼, 무엇을 해서 얼마를 받았는지 오른쪽에 쌓였다 사라진다.
  this.feed = function (text, xp) {
    var box = EL('xpFeed'); if (!box) return;
    // 안내문(notice)은 높이가 글에 따라 달라진다 — 떠 있으면 그 **아래로 비켜선다**(좁은 폰에서 겹치지 않게)
    self.shift();
    var d = document.createElement('div');
    d.className = 'xpf';
    var s1 = document.createElement('b'); s1.textContent = (xp > 0 ? '+' + xp : '');
    var s2 = document.createElement('span'); s2.textContent = text;
    d.appendChild(s1); d.appendChild(s2);
    box.appendChild(d);
    while (box.children.length > 5) box.removeChild(box.firstChild);
    setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, 3200);
  };
  // 🎖 메달 — 한 근무에 한 번만. 「처음으로 해낸 일」에 준다(콜오브듀티의 메달 팝업).
  this.medal = function (id, name, xp) {
    if (self.session.medals.indexOf(id) >= 0) return false;
    self.session.medals.push(id);
    self.data.medals[id] = (self.data.medals[id] || 0) + 1; save();
    banner('🎖 ' + name, self.data.medals[id] > 1 ? self.data.medals[id] + '번째' : '처음 받았다', true);
    self.feed('🎖 ' + name, xp || 0);
    if (TG.audio.jingle) TG.audio.jingle(4);
    if (TG.haptic) TG.haptic([16, 40, 16]);
    if (xp) self.addXp(xp, 'medal');
    return true;
  };

  // ---- 경험치 · 승급 ----
  this.addXp = function (n, why) {
    n = Math.round(+n || 0); if (!isFinite(n) || n <= 0) return 0;
    var before = lvOf(self.data.xp);
    self.data.xp += n; self.session.xp += n; save();
    var after = lvOf(self.data.xp);
    xpBar(n);
    if (after > before) rankUp(after);
    return n;
  };
  function rankUp(lv) {
    var r = RANKS[lv];
    self.session.rankUps++;
    banner('🎉 승급! ' + r.icon + ' ' + r.name, '규칙을 지킨 값이다 — 다음 단계로', true);
    game.slowmo = Math.max(game.slowmo || 0, 0.9); game.punch = 1.2;
    if (game.hud && game.hud.burst) game.hud.burst(r.icon, 10);
    if (TG.audio.totFanfare) TG.audio.totFanfare(); else if (TG.audio.jingle) TG.audio.jingle(4);
    if (TG.haptic) TG.haptic([20, 50, 20, 50, 30]);
    TG.audio.say('승급! 이제 ' + r.name + '이에요', { kind: (game.mode === 'tot' || game.mode === 'kid') ? 'narrator' : 'officer', queue: true });
  }

  // ---- 칭찬 한 번 ----
  // kind: LINES 의 열쇠 · xp: 경험치 · opts.feed: 피드에 적을 짧은 말 · opts.voice: 소리내어 말한다
  this.cheer = function (kind, xp, opts) {
    opts = opts || {};
    var line = pick(kind);
    self.combo++; self.session.praises++;
    if (self.combo > self.session.bestCombo) self.session.bestCombo = self.combo;
    if (self.combo > (self.data.bestCombo || 0)) { self.data.bestCombo = self.combo; save(); }
    // 콤보 문턱에서는 대사를 바꿔 준다 — 숫자가 커지는 맛
    var ckey = self.combo >= 8 ? 'combo8' : self.combo >= 5 ? 'combo5' : self.combo >= 3 ? 'combo3' : null;
    var mult = self.combo >= 8 ? 2 : self.combo >= 5 ? 1.5 : self.combo >= 3 ? 1.2 : 1;
    banner(ckey ? pick(ckey) : line, ckey ? line : '', !!ckey);
    comboChip();
    if (TG.audio.pop) TG.audio.pop();
    if (ckey && TG.audio.jingle) TG.audio.jingle(self.combo >= 8 ? 4 : 3);
    if (TG.haptic) TG.haptic(ckey ? [14, 30, 14] : 10);
    if (opts.voice || ckey) TG.audio.say(ckey ? pick(ckey) : line, { kind: opts.kind || ((game.mode === 'tot' || game.mode === 'kid') ? 'narrator' : 'officer'), queue: true });
    var got = self.addXp(Math.round((xp || 0) * mult), kind);
    if (opts.feed) self.feed(opts.feed + (mult > 1 ? ' ×' + mult : ''), got);
    return got;
  };
  // 놓쳤을 때 — **벌이 아니다.** 콤보만 끊고 「다시 가자」로 돌려보낸다.
  this.miss = function (quiet) {
    if (self.combo >= 3 && !quiet) banner(pick('miss'), '연속 ' + self.combo + '회에서 끊김', false);
    self.combo = 0;
    var c = EL('comboChip'); if (c) c.className = '';
  };
  this.reset = function () {
    self.combo = 0;
    self.session = { xp: 0, praises: 0, bestCombo: 0, rankUps: 0, medals: [] };
    self.hide();
    var box = EL('xpFeed'); if (box) box.innerHTML = '';
  };
  this.hide = function () {
    var b = EL('praiseLine'), c = EL('comboChip'), w = EL('xpWrap');
    if (b) b.className = ''; if (c) c.className = ''; if (w) w.className = '';
    document.body.classList.remove('praising');
  };
  // 근무 결과 카드에 넣을 값
  this.summary = function () {
    var r = self.rank(), nx = self.next();
    return { rank: r, next: nx, pct: self.progress(), xp: self.session.xp, total: self.data.xp,
             praises: self.session.praises, combo: self.session.bestCombo, rankUps: self.session.rankUps, medals: self.session.medals.slice() };
  };
};
