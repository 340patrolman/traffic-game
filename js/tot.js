// 👶 영아 교통안전교실(4세) — 어린이집 방문 교육용.
//
// 소유자: 「4세용으로 어린이 안전교육을 만들어 보자. **얼음땡 놀이** — 빨간불에 서고 초록불에 걷고,
// 유아용으로 손 들고 걷고, **밝은 색 옷**을 입고, 안전하게 **보호자의 손을 잡고** 걸을 것.
// 다음 주에 직원이 어린이집에 가서 교통안전 홍보를 하는데 20명가량, 4세라니까 쉽게 표현해야 한다. 귀엽고 예쁘고 쉽게.」
//
// 그래서 이 모드는 **아이가 조작하는 게임이 아니라, 선생님(경찰관)이 앞에서 틀어 놓고 아이들이 몸으로 따라 하는 화면**이다.
//  · 조작은 **큰 단추 하나**. 나머지는 저절로 굴러간다(20명 앞에서 손이 바쁘면 안 된다).
//  · 글씨·신호등은 프로젝터에서 보이게 아주 크게. 말은 짧고 쉬운 낱말로.
//  · 점수·감점·시간 제한이 없다. 잘하면 별과 박수만 있다.
//
// 네 마당: ① 🧊 얼음땡 신호놀이 ② 🤝 손 잡고 건너기 ③ ✋ 손 들고 건너기 ④ 🌈 밝은 옷 입기(밤에 견주기)
TG.Tot = function (game) {
  var self = this, C = TG.CONFIG;
  var G = game, city = game.city, terrain = game.terrain, scene = game.scene, hud = game.hud;
  var st = null;

  // 마당 표(순서대로). sec = 저절로 넘어가는 시간, btn = 큰 단추에 적히는 말
  // 소유자가 준 참고자료(2026-09-12)를 그대로 담았다 — **보행 3원칙(멈추기·좌우 살피기·손 들기)**,
  // 「초록불이어도 **차가 완전히 멈췄는지** 확인하고 건넌다」, **안전벨트**, 「걸을 때 스마트폰·장난감 금지」.
  // 출처는 행정안전부 안전배움터 · 도로교통공단 · 어린이집안전공제회 영상 등으로 소유자가 알려 준 것이고, **원문 대조는 아직 안 했다**(laws.json totClass.sourceNote).
  var STAGES = [
    { id: 'ice',   name: '얼음땡 놀이',   emoji: '🧊', btn: '얼음! 땡!',    sec: 46 },
    { id: 'three', name: '멈춰 살펴 손들어', emoji: '🛑', btn: '하나 더!',   sec: 54 },
    { id: 'check', name: '차 멈췄나 확인',  emoji: '👀', btn: '차 보기',     sec: 44 },
    { id: 'hold',  name: '손 잡고',       emoji: '🤝', btn: '손 잡기',      sec: 38 },
    { id: 'belt',  name: '안전벨트 딸깍',  emoji: '🔒', btn: '딸깍!',       sec: 38 },
    { id: 'bright',name: '밝은 옷',       emoji: '🌈', btn: '밝은 옷 입기',  sec: 44 },
  ];
  // 아주 쉬운 말. 한 문장에 한 가지만 말한다(4세).
  var SAY = {
    open:   '안녕! 나는 꼬마 친구예요. 오늘은 길 건너기 놀이를 해요',
    three:  '하나, 멈춰요! 둘, 살펴요! 셋, 손 들어요!',
    stop:   '하나! 멈춰요',
    look:   '둘! 오른쪽 왼쪽 살펴요',
    up:     '셋! 손을 번쩍 들어요',
    threeOk:'와! 멈춰요, 살펴요, 손 들어요. 참 잘했어요',
    check:  '초록불이어도 차가 멈췄는지 꼭 봐요',
    checkOk:'차가 멈췄어요. 이제 건너요',
    phone:  '걸을 때는 장난감도 휴대폰도 보지 않아요',
    belt:   '차를 타면 딸깍! 안전벨트를 매요',
    beltOk: '딸깍! 안전벨트 맸어요. 참 잘했어요',
    ice:    '빨간불에는 얼음! 초록불에는 땡! 하고 걸어요',
    red:    '빨간불! 얼음!',
    green:  '초록불! 땡! 걸어요',
    hold:   '길을 건널 때는 어른 손을 꼭 잡아요',
    holdOk: '손을 꼭 잡았어요. 참 잘했어요',
    hand:   '손을 번쩍 들어요. 그러면 운전하는 아저씨가 나를 잘 봐요',
    handOk: '와, 차가 멈췄어요. 손을 들어 줘서 고마워요',
    dark:   '밤에는 어두운 옷이 잘 안 보여요',
    bright: '밝은 옷을 입으면 멀리서도 반짝 보여요',
    end:    '참 잘했어요! 다 같이 외쳐요. 멈춰요! 살펴요! 손 들어요!',
  };
  var COATS = [
    { name: '노랑', color: 0xffd93d, bright: true },
    { name: '주황', color: 0xff9f45, bright: true },
    { name: '연두', color: 0x8ee36a, bright: true },
    { name: '분홍', color: 0xff9ec7, bright: true },
  ];

  function el(id) { return document.getElementById(id); }
  function say(key, force) {
    var t = SAY[key] || key;
    if (!st) return;
    if (!force && st.sayCd > 0) return;
    st.sayCd = 2.2;
    setCaption(t);
    TG.audio.resume(); TG.audio.say(t, { kind: 'kid', queue: !force });
  }
  function setCaption(t) { var e = el('totSay'); if (e) { e.textContent = t; e.style.display = t ? 'block' : 'none'; } }
  function setBig(t, sub) {
    var e = el('totBig'); if (!e) return;
    e.innerHTML = t ? ('<b>' + t + '</b>' + (sub ? '<i>' + sub + '</i>' : '')) : '';
    e.style.display = t ? 'block' : 'none';
    if (t) { e.classList.remove('pop'); void e.offsetWidth; e.classList.add('pop'); }
  }
  function setSignal(green, sec) {
    var w = el('totSig'); if (!w) return;
    w.style.display = 'flex';
    w.classList.toggle('go', !!green);
    var n = el('totSigNum'); if (n) n.textContent = sec === null || sec === undefined ? '' : Math.max(0, Math.ceil(sec));
    var f = el('totSigFace'); if (f) f.textContent = green ? '🚶' : '🧍';
  }
  function hideSignal() { var w = el('totSig'); if (w) w.style.display = 'none'; }
  function setButton(txt) { var b = el('btnTot'); if (b) { b.style.display = txt ? 'flex' : 'none'; b.querySelector('span').textContent = txt || ''; } }
  function dots() {
    var e = el('totDots'); if (!e) return;
    var s = '';
    for (var i = 0; i < STAGES.length; i++) s += '<span class="' + (i === st.i ? 'on' : (i < st.i ? 'ok' : '')) + '">' + STAGES[i].emoji + '</span>';
    e.innerHTML = s; e.style.display = 'flex';
  }
  function stars(n) {
    var e = el('totStars'); if (!e) return;
    var s = ''; for (var i = 0; i < 4; i++) s += (i < n ? '⭐' : '☆');
    e.textContent = s; e.style.display = 'block';
  }

  // ---------- 시작 ----------
  self.start = function () {
    var W = G.walker; if (!W) return false;
    document.body.classList.add('totmode');
    st = { i: -1, t: 0, sayCd: 0, stars: 0, ice: { on: false, t: 0, green: false, round: 0 }, done: false, coat: 0, night: false, held: false, handT: 0 };
    st.heading0 = W.heading;   // **고정 방향** — 카메라도 조작도 이 값을 쓴다(되먹임으로 아이가 도는 것을 막는다)
    st.home = { x: W.pos.x, z: W.pos.z };   // 보도 위 제자리. 여기서 7m 넘게 가면 돌아선다(차도로 나가면 안 된다)
    self.state = st;
    // 보호자(엄마). 아이 왼쪽에 서서 같이 걷는다.
    st.mom = TG.Character.actor(scene, terrain, 'civilian', W.pos.x - 1.0, W.pos.z + 0.2, W.heading);
    if (st.mom && st.mom.rig && st.mom.rig.group) st.mom.rig.group.scale.setScalar(1.0);
    stars(0);
    say('open', true);
    next();
    return true;
  };
  self.dispose = function () {
    document.body.classList.remove('totmode');
    if (st && st.mom && st.mom.dispose) st.mom.dispose();
    hideSignal(); setCaption(''); setBig(''); setButton('');
    var e = el('totStars'); if (e) e.style.display = 'none';
    var d = el('totDots'); if (d) d.style.display = 'none';
    if (st && st.night && G.weather) G.weather.set('day');
    st = null; self.state = null;
  };
  self.on = function () { return !!st; };
  self.heading = function () { return st ? st.heading0 : null; };   // 화면과 조작이 함께 쓰는 **한 방향**

  function restart() {
    st.i = -1; st.done = false; st.stars = 0; st.coat = 0; st.held = false; st.handT = 0;
    if (st.night && G.weather) { G.weather.set('day'); st.night = false; }
    setCoat(null); stars(0); say('open', true); next();
  }
  function next() {
    if (!st) return;
    st.i++;
    if (st.i >= STAGES.length) { finish(); return; }
    var S = STAGES[st.i];
    st.t = 0; st.sayCd = 0;
    dots();
    setBig(S.emoji + ' ' + S.name, { ice: '빨간불에 얼음, 초록불에 땡!', three: '하나 멈춰요 · 둘 살펴요 · 셋 손 들어요',
      check: '초록불이어도 차를 봐요', hold: '어른 손을 꼭 잡아요', belt: '차에 타면 딸깍!', bright: '밝은 옷을 입어요' }[S.id] || '');
    setButton(S.btn);
    if (S.id === 'ice') { st.ice = { on: true, t: 0, green: false, round: 0 }; say('ice', true); TG.audio.totIce(); }
    if (S.id === 'three') { st.three = 0; say('three', true); TG.audio.totDing(); }
    if (S.id === 'check') { st.checked = false; say('check', true); }
    if (S.id === 'hold') { st.held = false; say('hold', true); }
    if (S.id === 'belt') { st.belt = false; say('belt', true); }
    if (S.id === 'bright') {
      st.night = true; if (G.weather) G.weather.set('night');
      say('dark', true);
      setCoat(null);   // 처음엔 조끼 없이(어두운 옷)
    }
  }
  function finish() {
    st.done = true;
    hideSignal(); setButton('🔁 다시 하기');
    setBig('🎉 참 잘했어요!', '멈춰요 · 살펴요 · 손 들어요 · 차 보고 건너요');
    say('end', true);
    TG.audio.totFanfare();
    stars(4);
    if (G.hud && G.hud.burst) G.hud.burst('⭐');
  }

  // 밝은 옷 = **야광 조끼**를 덧입힌다. 몸통은 정점색(vertexColors) 메시라 material.color 로는 색이 안 바뀐다(실측).
  function makeVest() {
    var W = G.walker; if (!W || !W.rig || st.vest) return;
    var g = new THREE.Group();
    var body = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.42, 0.30), new THREE.MeshLambertMaterial({ color: 0xffd93d }));
    body.position.set(0, 1.30, 0); g.add(body); st.vestBody = body;
    var bandM = new THREE.MeshBasicMaterial({ color: 0xf2f6ff });
    for (var b = 0; b < 2; b++) {                                  // 은색 반사 띠 두 줄 — 실제 야광 조끼처럼
      var band = new THREE.Mesh(new THREE.BoxGeometry(0.47, 0.055, 0.31), bandM);
      band.position.set(0, 1.22 + b * 0.15, 0); g.add(band);
    }
    g.visible = false; W.rig.group.add(g); st.vest = g;
  }
  function setCoat(color) {
    var W = G.walker; if (!W || !W.rig) return;
    makeVest();
    if (!st.vest) return;
    if (color === null) { st.vest.visible = false; st.coatColor = null; return; }
    st.vest.visible = true; if (st.vestBody) st.vestBody.material.color.setHex(color);
    st.coatColor = color;
  }

  // ---------- 큰 단추 ----------
  self.act = function () {
    if (!st) return false;
    var S = STAGES[st.i] || null;
    TG.audio.ui(); TG.haptic(TG.HAPTIC.tap);
    if (!S) { restart(); return true; }   // 끝난 뒤에 누르면 처음부터 다시(한 번으로 안 끝난다)
    if (S.id === 'ice') { toggleIce(); return true; }
    if (S.id === 'three') { threeStep(); return true; }
    if (S.id === 'check') { checkCar(); return true; }
    if (S.id === 'hold') { holdHands(); return true; }
    if (S.id === 'belt') { beltClick(); return true; }
    if (S.id === 'bright') { wearBright(); return true; }
    return false;
  };
  function toggleIce() {
    st.ice.green = !st.ice.green; st.ice.t = 0;
    if (st.ice.green) { say('green', true); if (G.hud && G.hud.burst) G.hud.burst('🚶'); TG.audio.totGo(); }
    else { say('red', true); if (G.hud && G.hud.burst) G.hud.burst('🧊'); TG.audio.totIce(); }
  }
  // 🛑 보행 3원칙 — 단추를 누를 때마다 하나씩(멈춰요 → 살펴요 → 손 들어요). 아이들이 같이 외친다.
  function threeStep() {
    var W = G.walker; st.three = (st.three || 0) + 1;
    if (st.three === 1) { if (W) { W.v = 0; W.moving = false; } say('stop', true); TG.audio.totIce(); if (G.hud && G.hud.burst) G.hud.burst('🛑'); }
    else if (st.three === 2) { if (W) W.lookScan = true; say('look', true); TG.audio.totBoing(); if (G.hud && G.hud.burst) G.hud.burst('👀'); }
    else { if (W) { W.raiseHand(10); W.lookScan = false; } say('up', true); TG.audio.totDing(); if (G.hud && G.hud.burst) G.hud.burst('✋');
      st.stars = Math.max(st.stars, 2); stars(st.stars); st.three = 0; setTimeout(function () { if (st) say('threeOk', true); }, 900); TG.audio.totClap(6); }
  }
  // 👀 초록불이어도 **차가 멈췄는지** 확인하고 건넌다(소유자 자료의 핵심 한 줄)
  function checkCar() {
    st.checked = true; st.checkT = 3.4;
    var W = G.walker; if (W) { W.lookScan = true; W.raiseHand(8); }
    TG.audio.totCar(); say('checkOk', true);
    st.stars = Math.max(st.stars, 3); stars(st.stars);
    if (G.hud && G.hud.burst) G.hud.burst('🚗');
  }
  // 🔒 안전벨트 딸깍 — 차에 타면 반드시
  function beltClick() {
    st.belt = true; st.beltT = 3.2;
    TG.audio.totBelt(); say('beltOk', true);
    st.stars = Math.max(st.stars, 4); stars(st.stars);
    if (G.hud && G.hud.burst) G.hud.burst('🔒');
  }
  function holdHands() {
    st.held = true; st.stars = Math.max(st.stars, 2); stars(st.stars);
    var W = G.walker; if (W) W.raiseHand(6);
    say('holdOk', true); TG.audio.totDing(); TG.audio.totClap(5);
    if (G.hud && G.hud.burst) G.hud.burst('🤝');
  }
  function wearBright() {
    var c = COATS[(st.coat++) % COATS.length];
    setCoat(c.color);
    st.stars = Math.max(st.stars, 4); stars(st.stars);
    setBig('🌈 ' + c.name + ' 옷', '밝은 옷은 멀리서도 반짝 보여요');
    say('bright', true); TG.audio.totBoing();
  }

  // ---------- 매 프레임 ----------
  self.update = function (dt) {
    if (!st) return;
    st.t += dt; st.sayCd -= dt;
    var S = STAGES[st.i] || null;
    var W = G.walker;
    // 보호자: 아이 옆에 붙어 따라 걷는다(손 잡으면 더 가까이)
    // 보도 위를 **왔다 갔다** 한다 — 7m 넘게 가면 돌아선다(아이가 차도로 걸어 나가면 안 된다).
    if (W && st.home) {
      var dxh = W.pos.x - st.home.x, dzh = W.pos.z - st.home.z;
      if (Math.hypot(dxh, dzh) > 7) {
        var away = dxh * Math.sin(st.heading0) + dzh * Math.cos(st.heading0);
        if (away > 0) st.heading0 = TG.wrapAngle(st.heading0 + Math.PI);   // 멀어지는 쪽이면 돌아선다
      }
      W.heading = st.heading0;   // 걷기만 하고 방향은 스스로 바뀌지 않는다
    }
    if (st.mom && W) {
      var h0 = st.heading0, f = [Math.sin(h0), Math.cos(h0)], r = [-f[1], f[0]], gap = st.held ? 0.78 : 1.2;
      // 카메라는 아이 오른쪽 앞에 있다(main walkCamera) — 보호자는 **왼쪽**에 세워 아이를 가리지 않게 한다.
      var mx = W.pos.x - r[0] * gap, mz = W.pos.z - r[1] * gap;
      if (Math.hypot(mx - st.mom.pos.x, mz - st.mom.pos.z) > 0.5) st.mom.goTo(mx, mz, Math.max(1.0, W.v));
      st.mom.lookAtPos(W.pos);
      st.mom.smile = true;
      st.mom.update(dt, TG.audio.speaking === 'kid');
    }
    if (!S) return;
    if (S.id === 'ice') {
      // 얼음땡: 6초 빨강 → 7초 초록을 저절로 오간다(단추로 바로 바꿀 수도 있다)
      st.ice.t += dt;
      var span = st.ice.green ? 7 : 6;
      if (st.ice.t > span) { st.ice.t = 0; st.ice.green = !st.ice.green; st.ice.round++; say(st.ice.green ? 'green' : 'red', true);
        if (st.ice.green) TG.audio.totGo(); else TG.audio.totIce(); }
      setSignal(st.ice.green, span - st.ice.t);
      setBig(st.ice.green ? '🚶 땡! 걸어요' : '🧊 얼음! 멈춰요', st.ice.green ? '초록불' : '빨간불');
      if (W) { W.tot = { frozen: !st.ice.green }; if (!st.ice.green) { W.v = 0; W.moving = false; } }
      if (st.ice.round >= 2 && st.stars < 1) { st.stars = 1; stars(1); }
    } else if (S.id === 'three') {
      hideSignal();
      setBig('🛑 ' + ['하나! 멈춰요', '둘! 살펴요', '셋! 손 들어요'][st.three || 0], '단추를 누르면 하나씩');
      if (st.sayCd <= 0 && st.t > 8) say('three');
    } else if (S.id === 'check') {
      setSignal(true, null);                                  // 초록불인데도 차를 본다 — 그것이 이 마당이다
      st.checkT = (st.checkT || 0) - dt;
      setBig(st.checkT > 0 ? '👀 차가 멈췄어요' : '👀 차를 봐요', st.checkT > 0 ? '이제 건너요' : '초록불이어도 꼭!');
      if (st.sayCd <= 0 && st.t > 9) say(st.t > 22 ? 'phone' : 'check');   // 걸을 때 장난감·휴대폰 금지도 한 번 말한다
    } else if (S.id === 'belt') {
      hideSignal();
      st.beltT = (st.beltT || 0) - dt;
      setBig(st.beltT > 0 ? '🔒 딸깍! 맸어요' : '🔒 안전벨트 매요', '차에 타면 꼭!');
      if (st.sayCd <= 0 && st.t > 8) say('belt');
    } else if (S.id === 'hold') {
      hideSignal();
      if (!st.held && st.t > 6 && st.sayCd <= 0) say('hold');
      if (st.held) setBig('🤝 손 잡고 걸어요', '어른 손을 꼭!');
    } else if (S.id === 'bright') {
      hideSignal();
      if (st.coat === 0 && st.t > 7 && st.sayCd <= 0) say('dark');
    }
    if (st.t > S.sec) next();
  };

  self.next = function () { if (st) { if (st.done) restart(); else next(); } return true; };   // 선생님이 앞으로 넘긴다
  self.stageName = function () { var S = STAGES[st && st.i]; return S ? S.emoji + ' ' + S.name : ''; };
  self.stageCount = STAGES.length;
};
