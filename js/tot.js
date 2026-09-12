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
    { id: 'ice',   name: '얼음땡 놀이',        emoji: '🧊', btn: '얼음! 땡!',    sec: 46 },
    { id: 'hold',  name: '토수니 손 잡기',     emoji: '🐻', btn: '손 잡기',     sec: 34 },
    { id: 'cross', name: '다섯 걸음으로 건너기', emoji: '🚸', btn: '하나 더!',    sec: 96 },
    { id: 'belt',  name: '안전벨트 딸깍',      emoji: '🔒', btn: '딸깍!',       sec: 34 },
    { id: 'bright',name: '밝은 옷',           emoji: '🌈', btn: '밝은 옷 입기', sec: 42 },
  ];
  // **원문 5단계**(순서를 바꾸지 않는다). 아이가 따라 외칠 수 있게 짧게.
  var FIVE = [
    { big: '① 멈춰요',         sub: '초록불이어도 먼저 멈춰요',  say: '하나! 먼저 멈춰요. 초록불이어도 바로 건너지 않아요', burst: '🛑' },
    { big: '② 차를 봐요',       sub: '오른쪽 왼쪽 · 차가 멈췄나?', say: '둘! 오른쪽 왼쪽을 봐요. 차가 멈췄는지 봐요',        burst: '👀' },
    { big: '③ 손 번쩍',         sub: '운전하는 사람이 나를 봐요',  say: '셋! 손을 번쩍 들어요',                              burst: '✋' },
    { big: '④ 다시 한 번',      sub: '차가 또 오지 않나?',        say: '넷! 초록불이어도 차가 오는지 다시 봐요',            burst: '🔁' },
    { big: '⑤ 손 잡고 천천히',  sub: '차를 보면서 · 장난 없이',    say: '다섯! 토수니 손을 잡고 차를 보면서 천천히 건너요',  burst: '🐻' },
  ];
  var SAY = {
    open:    '안녕! 나는 곰돌이 토수니예요. 오늘은 길 건너기를 같이 배워요',
    ice:     '빨간불에는 얼음! 초록불에는 땡! 하고 걸어요',
    red:     '빨간불! 얼음!',
    green:   '초록불! 땡! 걸어요',
    hold:    '길을 건널 때는 토수니 손을 꼭 잡아요',
    holdOk:  '손을 꼭 잡았어요. 참 잘했어요',
    notYet:  '아직이야. 토수니 손을 먼저 잡아요',
    crossOk: '다 건넜어요! 참 잘했어요',
    phone:   '걸을 때는 장난감도 휴대폰도 보지 않아요',
    belt:    '차를 타면 딸깍! 안전벨트를 매요',
    beltOk:  '딸깍! 안전벨트 맸어요. 참 잘했어요',
    dark:    '밤에는 어두운 옷이 잘 안 보여요',
    bright:  '밝은 옷을 입으면 멀리서도 반짝 보여요',
    end:     '참 잘했어요! 다 같이 외쳐요. 멈춰요! 차를 봐요! 손 들어요!',
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
    st.bear = TG.Character.actor(scene, terrain, 'civilian', W.pos.x - 1.25, W.pos.z + 0.2, W.heading);
    bearify(st.bear);
    hearts(0); say('open', true); next();
    return true;
  };
  self.dispose = function () {
    document.body.classList.remove('totmode');
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
    setBig(S.emoji + ' ' + S.name, { ice: '빨간불에 얼음, 초록불에 땡!', hold: '토수니 손을 꼭 잡아요',
      cross: '① 멈춰요 ② 차를 봐요 ③ 손 번쩍 ④ 다시 ⑤ 천천히', belt: '차에 타면 딸깍!', bright: '밝은 옷을 입어요' }[S.id]);
    setButton(S.btn, S.id === 'cross' && !st.held);
    if (S.id === 'ice') { st.ice = { on: true, t: 0, green: false, round: 0 }; say('ice', true); TG.audio.totIce(); }
    if (S.id === 'hold') { say('hold', true); }
    if (S.id === 'cross') { st.five = 0; st.crossed = false; st.walkT = 0; say(st.held ? FIVE[0].say : 'notYet', true); }
    if (S.id === 'belt') { st.belt = false; st.beltT = 0; say('belt', true); }
    if (S.id === 'bright') { st.night = true; if (G.weather) G.weather.set('night'); setCoat(null); say('dark', true); }
  }
  function finish() {
    st.done = true; hideSignal(); setButton('🔁 다시 하기');
    setBig('🎉 참 잘했어요!', '멈춰요 · 차를 봐요 · 손 번쩍 · 다시 · 천천히');
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
    if (S.id === 'ice') { toggleIce(); return true; }
    if (S.id === 'hold') { holdHands(); return true; }
    if (S.id === 'cross') { fiveStep(); return true; }
    if (S.id === 'belt') { beltClick(); return true; }
    if (S.id === 'bright') { wearBright(); return true; }
    return false;
  };
  self.next = function () { if (st) { if (st.done) restart(); else next(); } return true; };

  function toggleIce() {
    st.ice.green = !st.ice.green; st.ice.t = 0;
    if (st.ice.green) { say('green', true); TG.audio.totGo(); if (G.hud && G.hud.burst) G.hud.burst('🚶'); }
    else { say('red', true); TG.audio.totIce(); if (G.hud && G.hud.burst) G.hud.burst('🧊'); }
    if (st.ice.round >= 1) heart(1);
  }
  function holdHands() {
    st.held = true; heart(2);
    var W = G.walker; if (W) W.raiseHand(4);
    say('holdOk', true); TG.audio.totDing(); TG.audio.totClap(5);
    if (G.hud && G.hud.burst) G.hud.burst('🤝');
  }
  // 🚸 **원문 5단계**. 단추를 누를 때마다 한 걸음. **손을 안 잡았으면 잠긴다**(혼자 건너기 엔딩 없음).
  function fiveStep() {
    var W = G.walker;
    if (!st.held) { say('notYet', true); TG.audio.totBoing(); setButton('손 잡기가 먼저!', true); return; }
    if (st.crossed) { say('crossOk', true); return; }
    var step = st.five, F = FIVE[Math.min(step, 4)];
    if (step === 0) { if (W) { W.v = 0; W.moving = false; } TG.audio.totIce(); }
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
  function wearBright() {
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
    if (st.bear && W) {
      var h0 = st.heading0, f = [Math.sin(h0), Math.cos(h0)], r = [-f[1], f[0]], gap = st.held ? 0.8 : 1.3;
      var bx = W.pos.x - r[0] * gap, bz = W.pos.z - r[1] * gap;
      if (Math.hypot(bx - st.bear.pos.x, bz - st.bear.pos.z) > 0.45) st.bear.goTo(bx, bz, Math.max(1.0, W.v + 0.3));
      st.bear.lookAtPos(W.pos); st.bear.smile = true;
      st.bear.update(dt, TG.audio.speaking === 'kid');
    }
    if (!S) return;
    if (S.id === 'ice') {
      st.ice.t += dt;
      var span = st.ice.green ? 7 : 6;
      if (st.ice.t > span) { st.ice.t = 0; st.ice.green = !st.ice.green; st.ice.round++;
        say(st.ice.green ? 'green' : 'red', true); if (st.ice.green) TG.audio.totGo(); else TG.audio.totIce(); }
      setSignal(st.ice.green, span - st.ice.t);
      setBig(st.ice.green ? '🚶 땡! 걸어요' : '🧊 얼음! 멈춰요', st.ice.green ? '초록불' : '빨간불');
      if (W && !st.ice.green) { W.v = 0; W.moving = false; }
      if (st.ice.round >= 2) heart(1);
    } else if (S.id === 'hold') {
      hideSignal();
      setBig(st.held ? '🤝 손 잡고 걸어요' : '🐻 토수니 손을 잡아요', st.held ? '이제 건널 수 있어요' : '단추를 눌러 손을 잡아요');
      if (!st.held && st.sayCd <= 0 && st.t > 7) say('hold');
    } else if (S.id === 'cross') {
      setSignal(true, null);                          // **초록불이어도** 다섯 걸음을 지킨다 — 이 마당의 요점
      var F2 = FIVE[Math.min(st.five, 4)];
      if (!st.held) setBig('🐻 아직이야', '토수니 손을 먼저 잡아요');
      else if (st.crossed) setBig('🎉 다 건넜어요', '참 잘했어요');
      else setBig('🚸 ' + F2.big, F2.sub);
      if (st.walkT > 0) {                             // ⑤ 손 잡고 천천히 — 실제로 함께 건넌다
        st.walkT -= dt;
        if (!st.crossed && st.walkT <= 0) { st.crossed = true; say('crossOk', true); TG.audio.totFanfare(); heart(5); setButton('🎉 잘했어요!', false); }
      }
      if (st.sayCd <= 0 && st.t > 26 && !st.crossed) say('phone');
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
