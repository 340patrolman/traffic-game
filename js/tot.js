// 👶 영아 교통안전교실(4세) — 어린이집 방문 교육용. 안내 친구는 **곰돌이 「토수니」**.
//
// 소유자 지시(2026-09-12, 세 차례):
//  ① 「4세용으로 어린이 안전교육을 만들어 보자. **얼음땡 놀이** — 빨간불에 서고 초록불에 걷고, 손 들고 걷고,
//     **밝은 색 옷**을 입고, 안전하게 **보호자의 손을 잡고** 걸을 것. 어린이집 20명, 4세. 귀엽고 예쁘고 쉽게.」
//  ② 참고자료(행정안전부 안전배움터 · 도로교통공단 · 어린이집안전공제회 영상 등)의 수칙 — 안전벨트, 걸을 때 스마트폰·장난감 금지.
//  ③ 참고 영상의 **원문 5단계만** 가르친다:
//     ① 우선 멈춘다(초록이어도 바로 건너지 않는다) ② 좌우로 **차가 멈췄는지** 본다 ③ 손 번쩍
//     ④ 초록이어도 차가 오는지 **다시** 확인 ⑤ 차를 보며 **장난 없이** 건넌다.
//     설계 한 줄 — 「**혼자 건너기 엔딩 없음**. 실패는 하트 깎지 않고 「아직이야」 재시도.
//     **어른(토수니) 손 잡기 전에는 건너기 잠금**.」
//     그리고 「곰돌이 토수니로 바꾸자, 저작권은 피해 가야지」 → **영상·그림책의 이름·그림·영상은 쓰지 않는다.**
//     수칙과 흐름만 우리 캐릭터로 다시 만든다(외부 이미지·영상 0개 — 곰돌이도 코드로 그린다).
//
// 하지 않는 것(스펙의 금지항): 점수·타이머·혼자 클리어 · 사고 연출 · 「초록불 = 즉시 출발」 ·
// 영어 UI · 외부 라이브러리 · 작은 단추 · 무서운 소리(경적·급제동·충돌).
TG.Tot = function (game) {
  var self = this;
  var G = game, terrain = game.terrain, scene = game.scene;
  var st = null;

  // 마당 표. sec = 저절로 넘어가는 시간(선생님이 ▶ 로 넘길 수도 있다), btn = 큰 단추에 적히는 말
  var STAGES = [
    { id: 'where', name: '여기는 어디?',      emoji: '🛣', btn: '어디일까?',   sec: 60 },
    { id: 'ice',   name: '얼음땡 놀이',        emoji: '🧊', btn: '얼음! 땡!',    sec: 58 },
    { id: 'hold',  name: '토수니 손 잡기',     emoji: '🐻', btn: '손 잡기',     sec: 34 },
    { id: 'cross', name: '다섯 걸음으로 건너기', emoji: '🚸', btn: '하나 더!',    sec: 96 },
    { id: 'alley', name: '골목길',             emoji: '🏘', btn: '어디로 걸을까?', sec: 52 },
    { id: 'belt',  name: '안전벨트 딸깍',      emoji: '🔒', btn: '딸깍!',       sec: 34 },
    { id: 'bright',name: '밝은 옷',           emoji: '🌈', btn: '밝은 옷 입기', sec: 42 },
  ];

  // **원문 5단계**(순서를 바꾸지 않는다). 아이가 따라 외칠 수 있게 짧게.
  // 소유자 제공 자료(2026-09-12)로 낱말을 맞췄다 — 한국도로교통공단 **「서다 · 보다 · 걷다」**
  //  서다: 신호를 기다릴 땐 **한발 뒤로 물러서요** · 보다: 신호가 바뀌면 **좌우를 살펴요** · 걷다: 횡단보도는 **뛰지 않고 천천히 걸어요**.
  // 대구광역시·대구경찰청·도로교통공단·한국교통안전공단 수칙(「초록불이라도 자동차가 완전히 멈추었는지 확인 후 건너기」)도 같이 담았다.
  // 그림·글꼴은 쓰지 않고 **수칙·구호 문구만** 우리 말로 재구성했다.
  var FIVE = [
    { big: '① 서다',        sub: '한 발 뒤로 물러서요 · 3초 동안',        say: '하나! 서다! 한 발 뒤로 물러서서 멈춰요. 셋을 세요', burst: '🛑' },
    { big: '② 보다',        sub: '좌우를 살펴요 — 자동차 · 오토바이 · 자전거', say: '둘! 보다! 오른쪽 왼쪽을 살펴요. 자동차도 오토바이도 자전거도 멈췄는지 봐요', burst: '👀' },
    { big: '③ 손 번쩍',     sub: '운전하는 사람이 나를 봐요',            say: '셋! 손을 번쩍 들어요',                              burst: '✋' },
    { big: '④ 다시 한 번',  sub: '차가 완전히 멈췄나?',                  say: '넷! 초록불이어도 차가 완전히 멈췄는지 다시 봐요',    burst: '🔁' },
    { big: '⑤ 걷다',        sub: '어른 손 잡고 · 뛰지 않고 천천히',       say: '다섯! 걷다! 어른 손을 잡고 뛰지 않고 천천히 걸어서 건너요', burst: '🐻' },
  ];
  // 구호(소유자 제공 자료) — 선생님이 아이들과 같이 외친다.
  var CHANT = '서다 · 보다 · 걷다';
  var CHANT2 = '1단 멈춤 · 2쪽 저쪽 · 3초 동안 · 4고 예방';

  // 🛣 여기는 어디? — 노란 빛기둥으로 **자리를 짚어 가며** 세 길을 가르친다(아이들이 손가락으로 같이 가리킨다).
  var WHERE = [
    { big: '🚶 인도',     sub: '사람이 걷는 길 — 우리는 여기!', say: '여기는 인도예요. 사람이 걷는 길이에요. 우리는 여기로 걸어요', burst: '🚶' },
    { big: '🚗 차도',     sub: '차가 다니는 길 — 들어가면 안 돼요', say: '저기는 차도예요. 차가 다니는 길이에요. 들어가면 안 돼요', burst: '🚗' },
    { big: '🚸 횡단보도', sub: '건널 때만 가는 길',               say: '여기는 횡단보도예요. 길을 건널 때만 가는 길이에요', burst: '🚸' },
  ];
  // 🏘 골목길 — 인도가 없는 좁은 길. **법으로 확인한 것만** 가르친다(도로교통법 제8조, 국가법령정보센터 원문 2026.7.1. 시행).
  //  ② 보도·차도 구분이 없고 중앙선이 있는 길 → 길가장자리(구역)로 통행해야 한다
  //  ③ 중앙선이 없는 길·보행자우선도로 → 도로의 전 부분으로 통행할 수 있다(고의로 차를 막지는 않는다)
  //  ④ 보도에서는 우측통행이 원칙
  // → 4세에게는 「길 한가운데는 위험해요, 가장자리로 걸어요 · 인도에서는 오른쪽으로」로 줄인다.
  var ALLEY = [
    { big: '🚗 길 한가운데',   sub: '차가 오면 위험해요',            say: '길 한가운데로 걸으면 차가 오는 걸 늦게 봐요. 위험해요',      burst: '⚠️', ok: false },
    { big: '🚶 길 가장자리',   sub: '여기로 걸어요',                 say: '골목길에서는 길 가장자리로 걸어요. 차가 지나갈 자리를 비켜 줘요', burst: '🚶', ok: true },
    { big: '➡️ 인도는 오른쪽', sub: '인도에서는 오른쪽으로 걸어요',   say: '넓은 길 인도에서는 오른쪽으로 걸어요',                       burst: '➡️', ok: true },
  ];

  var SAY = {
    open:    '안녕! 나는 곰돌이 토수니예요. 오늘은 길 건너기를 같이 배워요',
    ice:     '빨간불에는 얼음! 초록불에는 땡! 하고 걸어요',
    red:     '빨간불! 얼음! 발을 딱 멈춰요',
    green:   '초록불! 땡! 손 잡고 걸어요',
    iceGood: '얼음도 땡도 잘했어요! 빨간불에는 꼭 멈춰요',
    alley:   '골목길에는 인도가 없어요. 어디로 걸을까요?',
    run:     '혼자 뛰어가면 위험해요. 손 잡고 천천히 걸어요',

    hold:    '길을 건널 때는 어른 손을, 보호자 손을 꼭 잡아요',
    holdOk:  '어른 손을 꼭 잡았어요. 참 잘했어요',
    notYet:  '아직이야. 어른 손을 먼저 잡아요',
    crossOk: '다 건넜어요! 참 잘했어요',
    back:    '신호를 기다릴 때는 한 발 뒤로 물러나요. 차에서 멀리 떨어져서 기다려요',

    count:   '조금만 더, 셋을 세요. 하나, 둘, 셋',
    phone:   '길을 걸을 때는 스마트폰도 이어폰도 안 돼요. 소리도 들어야 해요',
    play:    '길가에서 공놀이도 몸장난도 안 돼요. 갑자기 도로로 뛰어 나가면 위험해요',
    belt:    '차를 타면 딸깍! 안전벨트를 매요',
    beltOk:  '딸깍! 안전벨트 맸어요. 참 잘했어요',
    dark:    '밤에는 어두운 옷이 잘 안 보여요',
    umbrella: '비 오는 날에는 앞이 잘 보이는 투명 우산을 써요. 우산을 내리면 앞이 안 보여요',
    bright:  '밝은 옷을 입으면 멀리서도 반짝 보여요',
    end:     '참 잘했어요! 다 같이 외쳐요. 서다! 보다! 걷다!',
  };
  var COATS = [
    { name: '노랑', color: 0xffd93d }, { name: '주황', color: 0xff9f45 },
    { name: '연두', color: 0x8ee36a }, { name: '분홍', color: 0xff9ec7 },
  ];
  var BEAR = 0x9a6b44, BEAR_IN = 0xe6cdae;   // 곰 털색 · 귀 안쪽·주둥이·배 색

  function el(id) { return document.getElementById(id); }
  function setCaption(t) { var e = el('totSay'); if (e) { e.textContent = t; e.style.display = t ? 'block' : 'none'; } }
  function say(key, force) {
    var t = SAY[key] || key; if (!st) return;
    if (!force && st.sayCd > 0) return;
    st.sayCd = 2.2; setCaption(t);
    TG.audio.resume(); TG.audio.say(t, { kind: 'kid', queue: !force });
  }
  function setBig(t, sub) {
    var e = el('totBig'); if (!e) return;
    var html = t ? ('<b>' + t + '</b>' + (sub ? '<i>' + sub + '</i>' : '')) : '';
    if (e._h === html) return;                       // 매 프레임 다시 그리면 튀어오르는 애니메이션이 되감긴다
    e._h = html; e.innerHTML = html; e.style.display = t ? 'block' : 'none';
    if (t) { e.classList.remove('pop'); void e.offsetWidth; e.classList.add('pop'); }
  }
  function setSignal(green, sec) {
    var w = el('totSig'); if (!w) return;
    w.style.display = 'flex'; w.classList.toggle('go', !!green);
    var n = el('totSigNum'); if (n) n.textContent = (sec === null || sec === undefined) ? '' : Math.max(0, Math.ceil(sec));
    var f = el('totSigFace'); if (f) f.textContent = green ? '🚶' : '🧍';
  }
  function hideSignal() { var w = el('totSig'); if (w) w.style.display = 'none'; }
  function setButton(txt, locked) {
    var b = el('btnTot'); if (!b) return;
    b.style.display = txt ? 'flex' : 'none';
    b.querySelector('span').textContent = txt || '';
    b.classList.toggle('locked', !!locked);          // 잠김 — 손을 잡기 전에는 건너기를 누를 수 없다(흐려진다)
  }
  function hearts(n) {                               // 점수가 아니라 **하트**다. 틀려도 **깎지 않는다**(스펙).
    var e = el('totStars'); if (!e) return;
    var s = ''; for (var i = 0; i < 5; i++) s += (i < n ? '💛' : '🤍');
    e.textContent = s; e.style.display = 'block';
  }
  function dots() {
    var e = el('totDots'); if (!e) return;
    var s = '';
    for (var i = 0; i < STAGES.length; i++) s += '<span class="' + (i === st.i ? 'on' : (i < st.i ? 'ok' : '')) + '">' + STAGES[i].emoji + '</span>';
    e.innerHTML = s; e.style.display = 'flex';
  }
  function heart(n) { if (!st) return; st.hearts = Math.max(st.hearts, n); hearts(st.hearts); }

  // ---------- 곰돌이 토수니 ----------
  // 남의 그림·영상은 쓰지 않는다(저작권). 사람 리그에 **둥근 귀·주둥이·배 무늬**를 붙여 우리 곰돌이를 만든다.
  function bearify(actor) {
    if (!actor || !actor.rig || !actor.rig.group) return;
    var rig = actor.rig, grp = rig.group, head = rig.parts && rig.parts.head;
    // **머리에 붙이는 것은 머리(목 관절)에 붙인다** — 그룹에 붙이면 발밑에 달린다(실측: 머리 지역좌표는 0,0,0 이고 목 관절이 1.56m 에 있다).
    var hp = head && head.parent ? head.parent : grp;
    var fur = new THREE.MeshLambertMaterial({ color: BEAR }), inr = new THREE.MeshLambertMaterial({ color: BEAR_IN });
    for (var s = -1; s <= 1; s += 2) {               // 둥근 귀 둘
      var ear = new THREE.Mesh(new THREE.SphereGeometry(0.085, 12, 10), fur);
      ear.position.set(s * 0.105, 0.115, -0.01); hp.add(ear);
      var ein = new THREE.Mesh(new THREE.SphereGeometry(0.048, 10, 8), inr);
      ein.position.set(s * 0.105, 0.118, 0.03); hp.add(ein);
    }
    var snout = new THREE.Mesh(new THREE.SphereGeometry(0.062, 12, 10), inr);   // 주둥이
    snout.position.set(0, -0.025, 0.115); snout.scale.set(1.1, 0.85, 0.85); hp.add(snout);
    var nose = new THREE.Mesh(new THREE.SphereGeometry(0.026, 8, 6), new THREE.MeshLambertMaterial({ color: 0x4a3527 }));
    nose.position.set(0, 0.0, 0.162); hp.add(nose);
    var belly = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.26, 0.26), inr);   // 배 무늬(몸통은 그룹 좌표계)
    belly.position.set(0, 1.22, 0.02); grp.add(belly);
    actor.bear = true;
  }


  // ---------- 시작 ----------
  self.start = function () {
    var W = G.walker; if (!W) return false;
    document.body.classList.add('totmode');
    st = { i: -1, t: 0, sayCd: 0, hearts: 0, done: false, coat: 0, night: false,
           held: false, five: 0, crossed: false, walkT: 0, belt: false, beltT: 0,
           ice: { on: false, t: 0, green: false, round: 0 } };
    self.state = st;
    st.heading0 = W.heading;                         // **고정 방향** — 카메라·조작이 같은 값을 본다(되먹임으로 아이가 돌지 않게)
    st.home = { x: W.pos.x, z: W.pos.z };
    if (W.markerKeep !== undefined) W.markerKeep = true;
    st.node = G.city && G.city.nearestNode ? G.city.nearestNode(W.pos.x, W.pos.z) : null;   // 인도·차도·횡단보도를 짚을 기준
    st.bear = TG.Character.actor(scene, terrain, 'civilian', W.pos.x - 1.25, W.pos.z + 0.2, W.heading);
    bearify(st.bear);
    hearts(0); say('open', true); next();
    return true;
  };
  self.dispose = function () {
    document.body.classList.remove('totmode'); document.body.classList.remove('toticy');
    var bg = el('totBig'); if (bg) bg.classList.remove('shiver');
    whereHide();
    if (st) stopCarsForCross(false);
    if (st && st.rainOn && G.weather) G.weather.set('clear');
    if (G.walker && G.walker.setMarker) { G.walker.setMarker(null); G.walker.markerKeep = false; }
    if (st && st.bear && st.bear.dispose) st.bear.dispose();
    hideSignal(); setCaption(''); setBig(''); setButton('');
    var e = el('totStars'); if (e) e.style.display = 'none';
    var d = el('totDots'); if (d) d.style.display = 'none';
    if (st && st.night && G.weather) G.weather.set('day');
    st = null; self.state = null;
  };
  self.on = function () { return !!st; };
  self.heading = function () { return st ? st.heading0 : null; };

  function restart() {
    var W = G.walker;
    st.i = -1; st.done = false; st.hearts = 0; st.coat = 0; st.held = false; st.five = 0; st.crossed = false; st.walkT = 0;
    if (st.night && G.weather) { G.weather.set('day'); st.night = false; }
    if (W && st.home) W.teleport(st.home.x, st.home.z, st.heading0);
    setCoat(null); hearts(0); say('open', true); next();
  }
  function next() {
    if (!st) return;
    st.i++;
    if (st.i >= STAGES.length) { finish(); return; }
    var S = STAGES[st.i]; st.t = 0; st.sayCd = 0;
    dots();
    setBig(S.emoji + ' ' + S.name, { where: '인도 · 차도 · 횡단보도', ice: '빨간불에 얼음, 초록불에 땡!', hold: '토수니 손을 꼭 잡아요',
      cross: '① 멈춰요 ② 차를 봐요 ③ 손 번쩍 ④ 다시 ⑤ 천천히', belt: '차에 타면 딸깍!', bright: '밝은 옷을 입어요' }[S.id]);
    setButton(S.btn, S.id === 'cross' && !st.held);
    if (S.id === 'where') { st.where = 0; whereShow(0); }
    if (S.id !== 'where') whereHide();
    if (S.id === 'ice') { if (G.walker) G.walker.setMarker(null); st.ice = { on: true, t: 0, green: false, round: 0 }; say('ice', true); TG.audio.totIce(); iceLook(false); }
    if (S.id === 'alley') { iceLook(true); st.alley = 0; alleyShow(0); say('alley', true); }
    if (S.id === 'hold') { iceLook(true); say('hold', true); }
    stopCarsForCross(S.id === 'cross');                 // 다섯 걸음 마당에서만 차를 세운다
    if (S.id === 'cross') { st.five = 0; st.crossed = false; st.walkT = 0; st.stopT = 0; st.stopCnt = 0; say(st.held ? FIVE[0].say : 'notYet', true); }
    if (S.id === 'belt') { st.belt = false; st.beltT = 0; say('belt', true); }
    if (S.id === 'bright') { st.night = true; if (G.weather) G.weather.set('night'); setCoat(null); say('dark', true); }
  }
  function finish() {
    st.done = true; hideSignal(); setButton('🔁 다시 하기');
    setBig('🎉 참 잘했어요!', CHANT + ' · ' + CHANT2);
    say('end', true); TG.audio.totFanfare(); heart(5);
    if (G.hud && G.hud.burst) G.hud.burst('💛');
  }

  // 밝은 옷 = **야광 조끼**를 덧입힌다(몸통은 정점색 메시라 material.color 로는 색이 안 바뀐다 — 실측)
  function makeVest() {
    var W = G.walker; if (!W || !W.rig || st.vest) return;
    var g = new THREE.Group();
    var body = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.42, 0.30), new THREE.MeshLambertMaterial({ color: 0xffd93d }));
    body.position.set(0, 1.30, 0); g.add(body); st.vestBody = body;
    var bandM = new THREE.MeshBasicMaterial({ color: 0xf2f6ff });
    for (var b = 0; b < 2; b++) {
      var band = new THREE.Mesh(new THREE.BoxGeometry(0.47, 0.055, 0.31), bandM);
      band.position.set(0, 1.22 + b * 0.15, 0); g.add(band);
    }
    g.visible = false; W.rig.group.add(g); st.vest = g;
  }
  function setCoat(color) {
    makeVest(); if (!st.vest) return;
    if (color === null) { st.vest.visible = false; st.coatColor = null; return; }
    st.vest.visible = true; if (st.vestBody) st.vestBody.material.color.setHex(color); st.coatColor = color;
  }

  // ---------- 큰 단추 ----------
  self.act = function () {
    if (!st) return false;
    TG.audio.ui(); TG.haptic(TG.HAPTIC.tap);
    var S = STAGES[st.i] || null;
    if (!S) { restart(); return true; }              // 끝난 뒤에 누르면 처음부터 다시
    if (S.id === 'where') { whereNext(); return true; }
    if (S.id === 'ice') { toggleIce(); return true; }
    if (S.id === 'hold') { holdHands(); return true; }
    if (S.id === 'cross') { fiveStep(); return true; }
    if (S.id === 'alley') { alleyNext(); return true; }
    if (S.id === 'belt') { beltClick(); return true; }
    if (S.id === 'bright') { wearBright(); return true; }
    return false;
  };
  self.next = function () { if (st) { if (st.done) restart(); else next(); } return true; };

  // 노란 빛기둥(walker.setMarker)으로 그 자리를 짚는다 — 코드에 좌표를 적지 않고 **도시 함수**로 구한다.
  // 아이가 선 보도가 어느 도로를 따라 뻗는지 — **가로 거리와 그 도로의 보도선(sideOff)을 견줘** 고른다.
  // 「둘 중 큰 쪽」으로 고르면 8차로 도로 보도(18m)와 4차로 도로(13m) 사이에서 뒤집힌다(실측에서 뒤집혔다).
  // 돌려주는 것은 **교차로에서 멀어지는 쪽** 단위벡터다.
  // 🛣 차도·인도·횡단보도를 **바닥 색과 글자로** 보여 준다.
  // 소유자(2026-09-12): 「차도와 인도 설명이 부실해 — 어디가 자동차가 다니는 차도이고 어디가 보행자가 다니는 인도인지 **위치를 잘 설명해 주지 않았어**.」
  // → 빛기둥 하나로는 「자리」를 못 가르친다. 인도는 **초록 바닥**, 차도는 **빨간 바닥**, 횡단보도는 **노란 바닥**으로 칠하고
  //    그 위에 큰 글자를 띄운다. 지금 가리키는 곳은 진하게, 나머지는 옅게.
  var WHERE_COLOR = [0x3fd06a, 0xff5a5a, 0xffd23d];
  function whereAreas() {
    var W = G.walker, nd = st.node, C = G.city;
    if (!W || !nd || !C) return null;
    var sv = sideDir(), vert = sv[1] !== 0;                                     // 보도가 z 로 뻗으면 남북 도로 옆이다
    var axis = vert ? 'v' : 'h', idx = vert ? nd.i : nd.j;
    var half = C.halfOf ? C.halfOf(axis, idx) : (vert ? C.halfV[nd.i] : C.halfH[nd.j]);
    var outer = C.sideOff(axis, idx), sw = Math.max(3.2, outer + 1.2 - half);         // 보도 폭(연석 ~ 보도 바깥선)
    var L = 26;                                                                  // 길이 26m — 아이 앞뒤로 넉넉히
    var fwd = [Math.sin(st.heading0), Math.cos(st.heading0)];                 // 아이가 보는 쪽(교차로·횡단보도 쪽) — 옆 3/4 카메라가 이 방향을 담는다
    var fsg = vert ? (fwd[1] >= 0 ? 1 : -1) : (fwd[0] >= 0 ? 1 : -1);
    var cAlong = vert ? W.pos.z + fsg * 4 : W.pos.x + fsg * 4;
    var lAlong = vert ? W.pos.z + fsg * 5 : W.pos.x + fsg * 5;                  // 글자는 띠 가운데 근처(옆 3/4 카메라가 다 담는다)
    var side = vert ? ((W.pos.x - nd.x) >= 0 ? 1 : -1) : ((W.pos.z - nd.z) >= 0 ? 1 : -1);
    var roadC = vert ? nd.x : nd.z;                                              // 차도 가운데(도로 중심선)
    var walkC = roadC + side * (half + sw / 2);                                  // 보도 가운데
    // 횡단보도: 아이가 있는 쪽 접근로의 횡단보도 띠
    var d = vert ? (W.pos.z > nd.z ? 0 : 2) : (W.pos.x > nd.x ? 1 : 3);
    var f = TG.DIR_VEC[d], cn = C.crossNear(nd, d), cf = C.crossFar(nd, d);
    var crossMid = (cn + cf) / 2, crossLen = Math.max(3, cf - cn);
    var A = [];
    if (vert) {
      A.push({ x: walkC, z: cAlong, w: sw, l: L, name: '인도', lx: walkC, lz: lAlong });
      A.push({ x: roadC, z: cAlong, w: half * 2, l: L, name: '차도', lx: roadC, lz: lAlong });
      A.push({ x: roadC, z: nd.z + f[1] * crossMid, w: half * 2, l: crossLen, name: '횡단보도' });
    } else {
      A.push({ x: cAlong, z: walkC, w: L, l: sw, name: '인도', lx: lAlong, lz: walkC });
      A.push({ x: cAlong, z: roadC, w: L, l: half * 2, name: '차도', lx: lAlong, lz: roadC });
      A.push({ x: nd.x + f[0] * crossMid, z: roadC, w: crossLen, l: half * 2, name: '횡단보도' });
    }
    return A;
  }
  // 글자는 **3D 가 아니라 화면(HUD) 띠**로 보여 준다 — 3D 글자판은 옆 3/4 카메라에서 화면 밖으로 나가거나
  // 아이 앞을 덮었다(실측 3회). 바닥 색과 **같은 색 칩**을 화면 아래에 두면 폰에서도 늘 읽힌다.
  function whereLegend(k) {
    var e = el('totWhere'); if (!e) return;
    var s = '';
    for (var i = 0; i < WHERE.length; i++) {
      s += '<span class="w' + i + (i === k ? ' on' : '') + '">' + WHERE[i].big + '</span>';
    }
    e.innerHTML = s; e.style.display = 'flex';
  }
  function whereLegendHide() { var e = el('totWhere'); if (e) e.style.display = 'none'; }
  function whereBuild() {
    if (st.whereGrp || !scene) return;
    var A = whereAreas(); if (!A) return;
    var grp = new THREE.Group(); st.whereItems = [];
    for (var i = 0; i < A.length; i++) {
      var a = A[i];
      var mat = new THREE.MeshBasicMaterial({ color: WHERE_COLOR[i], transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false });
      var pl = new THREE.Mesh(new THREE.PlaneGeometry(a.w, a.l), mat);
      pl.rotation.x = -Math.PI / 2;
      var y = terrain ? terrain.heightAt(a.x, a.z) : 0;
      pl.position.set(a.x, y + 0.22 + i * 0.02, a.z);   // **연석보다 높게** — 0.08 은 보도 메시 밑으로 들어가 안 보였다(실측)
      grp.add(pl);
      st.whereItems.push({ pl: pl, mat: mat });
    }
    scene.add(grp); st.whereGrp = grp;
  }
  function whereHighlight(k) {
    if (!st.whereItems) return;
    for (var i = 0; i < st.whereItems.length; i++) {
      var it = st.whereItems[i], on = (i === k);
      it.mat.opacity = on ? 0.5 : 0.2;
    }
  }
  function whereHide() {
    whereLegendHide();
    if (!st.whereGrp || !scene) return;
    scene.remove(st.whereGrp);
    st.whereItems = null; st.whereGrp = null;
  }

  function sideDir() {
    var W = G.walker, nd = st.node, C = G.city;
    if (!W || !nd || !C || !C.sideOff) return [0, 1];
    var dV = Math.abs(Math.abs(W.pos.x - nd.x) - C.sideOff('v', nd.i));
    var dH = Math.abs(Math.abs(W.pos.z - nd.z) - C.sideOff('h', nd.j));
    if (dV <= dH) return [0, (W.pos.z - nd.z) >= 0 ? 1 : -1];      // 남북 도로 보도 → 보도는 z 로 뻗는다
    return [(W.pos.x - nd.x) >= 0 ? 1 : -1, 0];
  }

  function whereSpot(k) {
    var W = G.walker, nd = st.node, C = G.city;
    if (!W || !nd || !C) return null;
    if (k === 0) {                                                                                 // 인도 = 아이가 선 보도. 발밑을 짚으면 기둥이 카메라를 덮는다 —
      var sv = sideDir();                                                                          // **보도를 따라 6m 앞**(교차로 반대쪽)을 짚는다
      return { x: W.pos.x + sv[0] * 6, z: W.pos.z + sv[1] * 6, name: '인도' };
    }


    if (k === 1) return { x: nd.x, z: W.pos.z, name: '차도' };                                     // 도로 한가운데(옆)
    var d = W.pos.z > nd.z ? 0 : 2;                                                                // 아이가 남쪽이면 남쪽 횡단보도
    var f = TG.DIR_VEC[d], near = C.crossNear(nd, d) + 1.2;
    return { x: nd.x + f[0] * 0, z: nd.z + f[1] * near, name: '횡단보도' };
  }
  function whereShow(k) {
    var W = G.walker, sp = whereSpot(k), F = WHERE[Math.min(k, 2)];
    whereBuild(); whereHighlight(k); whereLegend(k);
    if (W && sp) W.setMarker(sp);
    setBig(F.big, F.sub); say(F.say, true);
    TG.audio.totDing();
    if (G.hud && G.hud.burst) G.hud.burst(F.burst);
  }
  function whereNext() {
    st.where = (st.where === undefined ? 0 : st.where) + 1;
    if (st.where > 2) { st.where = 0; heart(1); }
    whereShow(st.where);
  }
  // 🏘 골목길: 단추를 누를 때마다 한가운데 → 가장자리 → 인도 오른쪽을 짚는다. **사고 장면은 없다**(무섭게 하지 않는다).
  function alleySpot(k) {
    var W = G.walker, nd = st.node, C = G.city;
    if (!W || !nd || !C) return null;
    var half = C.halfV ? C.halfV[nd.i] : 10, side = (W.pos.x - nd.x) >= 0 ? 1 : -1;
    if (k === 0) return { x: nd.x, z: W.pos.z, name: '길 한가운데' };                       // 차도 한가운데
    if (k === 1) return { x: nd.x + side * (half - 1.0), z: W.pos.z, name: '길 가장자리' }; // 차도 맨 가장자리
    var sv2 = sideDir();
    return { x: W.pos.x + sv2[0] * 6, z: W.pos.z + sv2[1] * 6, name: '인도 오른쪽' };                             // 아이가 선 보도 위 앞쪽
  }
  function alleyNext() {
    st.alley = (st.alley === undefined ? 0 : st.alley) + 1;
    if (st.alley > 2) { st.alley = 0; heart(3); }
    alleyShow(st.alley);
  }
  function alleyShow(k) {
    var W = G.walker, sp = alleySpot(k), A = ALLEY[Math.min(k, 2)];
    if (W && sp) W.setMarker(sp);
    setBig(A.big, A.sub); say(A.say, true);
    if (A.ok) { TG.audio.totDing(); } else { TG.audio.totBoing(); }
    if (G.hud && G.hud.burst) G.hud.burst(A.burst);
  }

  // ---------- 🧊 얼음땡 ----------
  // 소유자(2026-09-12): 「얼음 땡을 더 실감나게 표현해야 할 듯해.」
  // 실감의 정체는 ① 화면이 얼어붙는다(파란 테두리 + ❄) ② 아이도 **토수니도** 딱 멈춘다 ③ 큰 글씨가 떨린다 ④ 소리가 다르다.
  // ⚠ **얼음은 인도에서** 한다 — 횡단보도 위에서 멈추는 것은 위험하고 법(시행규칙 별표2)과도 맞지 않는다.
  //    건너는 중에 빨간불이 되면 「멈춤」이 아니라 「다 건널 때까지 걸어요」다(다섯 걸음 마당이 그것을 가르친다).
  function iceLook(green) {
    document.body.classList.toggle('toticy', !green);
    var b = el('totBig'); if (b) b.classList.toggle('shiver', !green);
  }
  function toggleIce() {
    st.ice.green = !st.ice.green; st.ice.t = 0; st.ice.round++;
    if (st.ice.green) { say('green', true); TG.audio.totGo(); if (G.hud && G.hud.burst) G.hud.burst('🚶'); }
    else { say('red', true); TG.audio.totIce(); if (G.hud && G.hud.burst) { G.hud.burst('🧊'); G.hud.burst('❄️'); } }
    iceLook(st.ice.green);
    if (st.ice.round >= 2) heart(1);
    if (st.ice.round >= 4) { heart(2); if (st.sayCd <= 0) say('iceGood', true); }
  }

  function holdHands() {
    st.held = true; heart(2);
    var W = G.walker; if (W) W.raiseHand(4);
    say('holdOk', true); TG.audio.totDing(); TG.audio.totClap(5);
    if (G.hud && G.hud.burst) G.hud.burst('🤝');
  }
  // 🚸 **원문 5단계**. 단추를 누를 때마다 한 걸음. **손을 안 잡았으면 잠긴다**(혼자 건너기 엔딩 없음).
  // 🚗 「초록불이라도 자동차가 **완전히 멈추었는지 확인 후** 건너기」(소유자 제공 어린이 교통안전수칙).
  // 보여 주려면 **멈춰 선 차**가 실제로 있어야 한다 — 경찰 수신호와 같은 장치(traffic.control.hand)로
  // 그 접근로의 차를 정지선 앞에 세운다(수신호는 신호기보다 우선 · 도로교통법 제5조). 급제동도 경적도 없다(traffic.quiet).
  function stopCarsForCross(on) {
    var C = G.city, nd = st.node, TR = G.traffic;
    if (!TR || !nd || !C) return;
    if (!TR.control) TR.control = { closed: [], hand: [] };
    if (!on) { TR.control.hand = []; return; }
    var sv = sideDir(), vert = sv[1] !== 0;
    var ds = vert ? [0, 2] : [1, 3];                       // 아이가 건너는 도로를 달리는 두 접근로
    TR.control.hand = [{ node: nd, d: ds[0] }, { node: nd, d: ds[1] }];
    if (!st.stopCar && TR.spawn) {                         // 교통량을 3분의 1로 줄여 두어 마침 아무도 없을 수 있다 — 한 대는 우리가 세운다
      var d0 = ds[0], f = TG.DIR_VEC[d0], sd = C.stopDist ? C.stopDist(nd, d0) : 12;
      st.stopCar = TR.spawn({ at: { x: nd.x - f[0] * (sd + 24), z: nd.z - f[1] * (sd + 24), d: d0, node: nd },
                              v: 5, cruise: 5, straight: true, type: 'sedan', trait: null, violator: false, laneIdx: 0 });
    }
  }

  function fiveStep() {
    var W = G.walker;
    if (!st.held) { say('notYet', true); TG.audio.totBoing(); setButton('손 잡기가 먼저!', true); return; }
    if (st.crossed) { say('crossOk', true); return; }
    if (st.stopT > 0) { say('count', true); TG.audio.totBoing(); return; }   // **3초 동안** 멈춘다 — 다 세기 전에는 다음으로 안 간다(구호 「3초 동안」)
    var step = st.five, F = FIVE[Math.min(step, 4)];
    if (step === 0) {                                   // ① 멈춤 = **한 발 뒤로 물러나** 3초를 센다(소유자 제공 자료 「신호를 기다릴 땐 한 발 뒤로 물러나기」)
      if (W) { W.v = 0; W.moving = false; }
      if (W && !st.backDone && st.node) { var nb = st.node, bx = W.pos.x - nb.x, bz = W.pos.z - nb.z, bl = Math.hypot(bx, bz) || 1;
        W.teleport(W.pos.x + bx / bl * 0.5, W.pos.z + bz / bl * 0.5, W.heading); st.backDone = true; }
      st.stopT = 3; TG.audio.totIce();
    }
    else if (step === 1) { if (W) W.lookScan = true; TG.audio.totCar(); }
    else if (step === 2) { if (W) W.raiseHand(16); TG.audio.totDing(); }
    else if (step === 3) { if (W) W.lookScan = true; TG.audio.totCar(); }
    else { st.walkT = 11; if (W) W.lookScan = false; TG.audio.totGo(); heart(4); }
    say(F.say, true);
    if (G.hud && G.hud.burst) G.hud.burst(F.burst);
    st.five = Math.min(5, step + 1);
    if (st.five >= 3) heart(3);
    setButton(st.five >= 5 ? '건너는 중…' : '하나 더!', false);
  }

  function beltClick() {
    st.belt = true; st.beltT = 3.2; heart(4);
    TG.audio.totBelt(); say('beltOk', true);
    if (G.hud && G.hud.burst) G.hud.burst('🔒');
  }
  // 🌂 **투명 우산** — 소유자 제공 자료(경기도교육청 등·하굣길 자료): 「비 오는 날에는 앞이 잘 보이게 투명 우산을 사용하고
  // 눈에 잘 띄도록 밝은 색 옷을 입어요.」 우산도 우리가 코드로 만든다(외부 이미지 0). 비닐이 비쳐 보이게 반투명이다.
  function makeUmbrella() {
    var W = G.walker; if (!W || !W.rig || st.umb) return;
    var g = new THREE.Group();
    var canopy = new THREE.Mesh(new THREE.SphereGeometry(0.52, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshLambertMaterial({ color: 0xeaf6ff, transparent: true, opacity: 0.42, side: THREE.DoubleSide, depthWrite: false }));
    canopy.position.set(0, 1.62, 0); g.add(canopy);
    var rim = new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.016, 6, 20), new THREE.MeshLambertMaterial({ color: 0x7fd0ff }));
    rim.rotation.x = Math.PI / 2; rim.position.set(0, 1.62, 0); g.add(rim);
    var shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.78, 6), new THREE.MeshLambertMaterial({ color: 0x5a6a86 }));
    shaft.position.set(0, 1.26, 0); g.add(shaft);
    g.position.set(0.22, 0, 0.04);                      // 오른손 쪽
    g.visible = false; W.rig.group.add(g); st.umb = g;
  }
  function wearBright() {
    if (st.coat >= COATS.length) {                      // 옷을 다 입어 보면 **비 오는 날 · 투명 우산**
      makeUmbrella();
      if (st.umb) st.umb.visible = true;
      if (!st.rainOn && G.weather) { G.weather.set('rain'); st.rainOn = true; }
      setBig('🌂 투명 우산', '비 오는 날에는 앞이 잘 보이는 투명 우산');
      say('umbrella', true); TG.audio.totDing(); heart(5);
      if (G.hud && G.hud.burst) G.hud.burst('🌂');
      return;
    }
    var c = COATS[(st.coat++) % COATS.length];
    setCoat(c.color); heart(5);
    setBig('🌈 ' + c.name + ' 옷', '밝은 옷은 멀리서도 반짝 보여요');
    say('bright', true); TG.audio.totBoing();
  }


  // ---------- 매 프레임 ----------
  self.update = function (dt) {
    if (!st) return;
    st.t += dt; st.sayCd -= dt;
    var S = STAGES[st.i] || null, W = G.walker;
    // 아이는 보도 위를 왔다 갔다 한다(7m 넘으면 돌아선다). **건너는 중에는 돌아서지 않는다.**
    if (W && st.home) {
      if (!(st.walkT > 0)) {
        var dxh = W.pos.x - st.home.x, dzh = W.pos.z - st.home.z;
        if (Math.hypot(dxh, dzh) > 7) {
          var away = dxh * Math.sin(st.heading0) + dzh * Math.cos(st.heading0);
          if (away > 0) st.heading0 = TG.wrapAngle(st.heading0 + Math.PI);
        }
      }
      W.heading = st.heading0;
    }
    // 곰돌이 토수니: 아이 옆에 붙어 따라 걷는다(손을 잡으면 더 가까이)
    var frozen = !!(S && S.id === 'ice' && st.ice && !st.ice.green);   // 얼음! — 토수니도 같이 멈춘다(실감)
    if (st.bear && W && !frozen) {
      var h0 = st.heading0, f = [Math.sin(h0), Math.cos(h0)], r = [-f[1], f[0]], gap = st.held ? 0.8 : 1.3;
      var bx = W.pos.x - r[0] * gap, bz = W.pos.z - r[1] * gap;
      if (Math.hypot(bx - st.bear.pos.x, bz - st.bear.pos.z) > 0.45) st.bear.goTo(bx, bz, Math.max(1.0, W.v + 0.3));
      st.bear.lookAtPos(W.pos); st.bear.smile = true;
      st.bear.update(dt, TG.audio.speaking === 'kid');
    }
    if (!S) return;
    if (S.id === 'where') {
      hideSignal();
      if (st.sayCd <= 0 && st.t > 9) say(WHERE[Math.min(st.where || 0, 2)].say);
    } else if (S.id === 'ice') {
      st.ice.t += dt;
      var span = st.ice.green ? 7 : 6;
      if (st.ice.t > span) {                             // 선생님이 안 눌러도 저절로 바뀐다(놀이가 끊기지 않게)
        st.ice.t = 0; st.ice.green = !st.ice.green; st.ice.round++;
        say(st.ice.green ? 'green' : 'red', true);
        if (st.ice.green) { TG.audio.totGo(); if (G.hud && G.hud.burst) G.hud.burst('🚶'); }
        else { TG.audio.totIce(); if (G.hud && G.hud.burst) { G.hud.burst('🧊'); G.hud.burst('❄️'); } }
        iceLook(st.ice.green);
      }
      setSignal(st.ice.green, span - st.ice.t);
      var cnt = st.ice.round > 0 ? ' · ' + st.ice.round + '번' : '';
      setBig(st.ice.green ? '🚶 땡! 걸어요' : '🧊 얼음! 딱 멈춰요', (st.ice.green ? '초록불' : '빨간불 — 발도 손도 멈춰요') + cnt);
      if (W && !st.ice.green) { W.v = 0; W.moving = false; }
      if (st.ice.round >= 2) heart(1);
      if (!st.ice.green && st.ice.round >= 1 && st.sayCd <= 0 && st.ice.t > 2.5) say('back');   // 기다릴 때는 한 발 뒤로(소유자 제공 자료)
    } else if (S.id === 'alley') {
      hideSignal();
      if (st.sayCd <= 0 && st.t > 10) say(ALLEY[Math.min(st.alley || 0, 2)].say);

    } else if (S.id === 'hold') {
      hideSignal();
      setBig(st.held ? '🤝 손 잡고 걸어요' : '🐻 토수니 손을 잡아요', st.held ? '이제 건널 수 있어요' : '단추를 눌러 손을 잡아요');
      if (!st.held && st.sayCd <= 0 && st.t > 7) say('hold');
    } else if (S.id === 'cross') {
      setSignal(true, null);                          // **초록불이어도** 다섯 걸음을 지킨다 — 이 마당의 요점
      var F2 = FIVE[Math.min(st.five, 4)];
      if (st.stopT > 0) st.stopT -= dt;
      if (!st.held) setBig('🐻 아직이야', '어른 손을 먼저 잡아요');
      else if (st.crossed) setBig('🎉 다 건넜어요', CHANT);
      else if (st.stopT > 0) setBig('🛑 ' + Math.ceil(st.stopT) + '초', '하나 · 둘 · 셋 — 멈춰서 세어요');
      else setBig('🚸 ' + F2.big, F2.sub);
      if (st.stopT > 0 && st.stopCnt !== Math.ceil(st.stopT)) { st.stopCnt = Math.ceil(st.stopT); TG.audio.totDing(); }
      if (st.walkT > 0) {                             // ⑤ 손 잡고 천천히 — 실제로 함께 건넌다
        st.walkT -= dt;
        if (!st.crossed && st.walkT <= 0) { st.crossed = true; say('crossOk', true); TG.audio.totFanfare(); heart(5); setButton('🎉 잘했어요!', false); }
      }
      if (!st.held && st.sayCd <= 0 && st.t > 12) say('run');                       // 혼자 뛰어나가지 않아요(소유자)
      else if (st.sayCd <= 0 && st.t > 26 && !st.crossed) say(st.t > 40 ? 'play' : 'phone');   // 스마트폰·이어폰 · 공놀이·장난

    } else if (S.id === 'belt') {
      hideSignal();
      st.beltT -= dt;
      setBig(st.beltT > 0 ? '🔒 딸깍! 맸어요' : '🔒 안전벨트 매요', '차에 타면 꼭!');
      if (st.sayCd <= 0 && st.t > 8) say('belt');
    } else if (S.id === 'bright') {
      hideSignal();
      if (st.coat === 0) { setBig('🌈 밝은 옷', '밤에는 어두운 옷이 잘 안 보여요'); if (st.t > 7 && st.sayCd <= 0) say('dark'); }
    }
    // 건너는 중(손 잡고 다섯 걸음)에는 시간이 지나도 넘기지 않는다 — 아이가 다 건너는 것을 보여 준다
    if (st.t > S.sec && !(S.id === 'cross' && st.held && !st.crossed)) next();
  };

  // 걷는 때: 얼음땡의 초록불 · 다섯 걸음의 ⑤(건너는 중). 그 밖에는 제자리.
  self.walking = function () {
    if (!st) return false;
    var S = STAGES[st.i] || null; if (!S) return false;
    if (S.id === 'cross') return st.walkT > 0;
    if (S.id === 'ice') return !!(st.ice && st.ice.green);
    return false;
  };
  self.stageName = function () { var S = STAGES[st && st.i]; return S ? S.emoji + ' ' + S.name : ''; };
  self.stageCount = STAGES.length;
  self.fiveCount = FIVE.length;
};
