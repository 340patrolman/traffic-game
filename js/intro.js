// 인트로 연출 — 「이 게임이 무엇인가」를 17초에 보여 준다.
//
// 상용 게임 인트로의 문법을 그대로 쓴다: 레터박스 → 조문(콜드 오픈) → 몽타주 3컷(출동 · 하차 근무 · 어린이 횡단)
// → 테마의 대타격(10.4초)에 맞춘 타이틀 등장 → 크레인 아웃 + 세 가지 목적.
// 카메라는 샷 표(SHOTS)로만 움직인다. 각 샷은 시작 시각·길이·화각·위치·시선·자막을 함께 들고 있다.
// 배우(경찰관·어린이)와 신호제어기는 실제 게임 오브젝트다 — 인트로용 별도 모델을 만들지 않는다(에셋 0).
TG.Intro = function (game) {
  var self = this, city = game.city, terrain = game.terrain, cfg = game.cfg;
  var NODE = city.nodes[2][2];                       // 서울성모병원 사거리(반포대로 × 서초대로 · 하차 근무 무대)
  var BOX = null, junc = null, officer = null, kid = null, guard = null, fovBase = 74;
  this.t = 0; this.done = false; this.shot = -1; this.theme = false; this.stackIdx = -1;
  var el = { shot: null, title: null, flash: null, lines: null };
  function $(id) { return document.getElementById(id); }
  function sm(u) { return u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u); }        // smoothstep
  function ease(u) { return 1 - Math.pow(1 - Math.max(0, Math.min(1, u)), 3); }   // ease-out
  function mix(a, b, u) { return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u]; }

  // 조문 콜드 오픈 — 게임의 목적을 먼저 말한다(도로교통법 제1조 원문 인용).
  var FALLBACK = '이 법은 도로에서 일어나는 교통상의 위험과 장해를 방지하고 제거하여 안전하고 원활한 교통을 확보함을 목적으로 한다.';
  function stackLines() {
    var laws = game.laws, purpose = (laws && laws.act && laws.act.purpose) ? laws.act.purpose : FALLBACK;
    var cite = (laws && laws.act) ? (laws.act.name + ' ' + laws.act.purposeArticle + '(목적)') : '도로교통법 제1조(목적)';
    return [
      { at: 0.5, text: '도로에서 일어나는 위험과 장해(障害)를 막고, 없애고,' },
      { at: 1.8, text: '안전하고 원활한 교통을 확보한다.' },
      { at: 2.9, text: cite + ' 원문 인용 · 장해(障害) = 가로막아 해가 되는 것', small: true },
      { at: 3.5, text: '그 목적을 매일 도로 위에서 실현하는 사람 — 교통경찰.' },
    ];
  }

  // 순찰차: 반포대로를 북쪽으로 달려 교차로에 접근한다(경광등 ON). 진행 방향 2 = 북(−z), 우측 = +x.
  function driveCar(t) {
    var pl = game.player; if (!pl) return;
    var lane = city.laneOff('v', NODE.i, 0), u = Math.min(1, Math.max(0, (t - 2.2) / 8.2));
    var z = 214 - u * 96, x = NODE.x + lane, sp = 13;
    pl.teleport(x, z, Math.PI);                       // 북쪽(−z) 을 향한다
    pl.vx = 0; pl.vz = -sp; if (pl.resync) pl.resync();
  }

  // 운전석 눈 위치(1인칭). player.eyeWorld 가 차체 좌표를 세계 좌표로 바꿔 준다.
  function eye1(fwd, down) {
    var pl = game.player, E = pl.layout.eye;
    var e = pl.eyeWorld(E), a = pl.eyeWorld({ x: E.x * 0.4, y: E.y - (down || 1.6), z: E.z + (fwd || 16) });
    return { p: [e.x, e.y, e.z], l: [a.x, a.y, a.z] };
  }
  var SHOTS = [
    // ① 도시 — 남쪽 IC 위에서 시작해 내려온다(길이 이어져 있다). 조문이 깔린다. 넉넉히 읽을 시간을 준다.
    { at: 0, dur: 4.6, fov: 66, cam: function (u) {
        var e = sm(u);
        return { p: mix([258, 196, 646], [104, 62, 236], e), l: mix([158, 12, 498], [16, 8, 122], e) };
      } },
    // ② 1인칭 — 운전석에서 본다. 핸들·손·계기판이 보인다.
    { at: 4.6, dur: 2.2, fov: 92, view: 'cockpit', kick: '01 · 순찰 근무', ttl: '운전석에서 도로를 읽는다', sub: '차로 · 속도 · 앞차와의 간격', cam: function () { return eye1(20, 1.15); } },
    // ③ 3인칭 — 경광등을 켠 순찰차를 옆에서 따라간다.
    { at: 6.8, dur: 2.2, fov: 42, kick: '02 · 위반 발견', ttl: '안전하게 세우고 고지한다', sub: '경광등 → 우측 가장자리 → 확인', cam: function (u) {
        var pl = game.player, e = sm(u);
        return { p: [pl.pos.x + 8.4 - e * 2.0, 1.55 + e * 0.45, pl.pos.z + 3.2 + e * 7.2], l: [pl.pos.x, (pl.y || 0) + 0.82, pl.pos.z - e * 2] };
      } },
    // ④ 하차 근무 — 제어함 앞의 경찰관(3인칭 근접).
    { at: 9.0, dur: 2.0, fov: 38, kick: '03 · 교차로 근무', ttl: '신호기 박스를 조작한다', sub: '자동 → 수동. 막힌 방향에 녹색을 더 준다', cam: function (u) {
        var e = sm(u), b = BOX || { x: 18.5, z: 99 };
        return { p: mix([b.x - 2.4, 1.66, b.z - 5.2], [b.x - 1.7, 1.46, b.z - 2.3], e), l: mix([b.x - 0.3, 1.24, b.z + 0.5], [b.x - 0.25, 1.18, b.z + 0.2], e) };
      } },
    // ⑤ 어린이 횡단 — 손을 든 아이, 정지 수신호(3인칭 근접).
    { at: 11.0, dur: 1.6, fov: 28, kick: '04 · 어린이 보행 교실', ttl: '멈춘다 · 본다 · 손을 든다 · 걷는다', sub: '어린이 보행 안전수칙 4단계', cam: function (u) {
        var e = ease(u);
        return { p: mix([6.5, 1.00, 100.5], [13.8, 1.02, 95.0], e), l: mix([17.5, 0.95, 92.3], [17.2, 0.98, 92.3], e) };
      } },
    // ⑥ 타이틀 — 테마의 대타격에 맞춰 확 빠진다(12.6초 고정).
    { at: 12.6, dur: 1.8, fov: 60, cam: function (u) {
        var e = ease(u), p;
        if (e < 0.5) p = mix([10.4, 1.12, 96.6], [12, 42, 118], e / 0.5);
        else p = mix([12, 42, 118], [18, 62, 178], (e - 0.5) / 0.5);
        return { p: p, l: mix([16.2, 1.10, 92.3], [3, 7, 83], sm(u)) };
      } },
    // ⑦ 1인칭 순찰 — 타이틀 뒤에 「이 게임이 무엇인가」를 보여 준다.
    { at: 14.4, dur: 3.2, fov: 94, view: 'cockpit', kick: '함께 달린다', ttl: '서울을 순찰한다', sub: '반포대로 · 서초대로 · 경부고속도로 · 올림픽대로 · 철길건널목', cam: function () { return eye1(22, 1.05); } },
    // ⑧ 3인칭 추적 — 순찰차를 뒤에서 넓게.
    { at: 17.6, dur: 3.0, fov: 58, kick: '', ttl: '근무 연습 · 스트레스 해소 · 교통안전 홍보', sub: '세 가지를 한 번에', cam: function (u) {
        var pl = game.player, e = sm(u), f = [Math.sin(pl.heading), Math.cos(pl.heading)];
        return { p: [pl.pos.x - f[0] * (7 + e * 4), (pl.y || 0) + 2.6 + e * 1.2, pl.pos.z - f[1] * (7 + e * 4)], l: [pl.pos.x + f[0] * 6, (pl.y || 0) + 1.1, pl.pos.z + f[1] * 6] };
      } },
    // ⑨ 크레인 아웃 — 도시가 넓어진다.
    { at: 20.6, dur: 3.4, fov: 62, cam: function (u) {
        var e = sm(u);
        return { p: mix([18, 62, 178], [112, 122, 302], e), l: mix([3, 7, 83], [62, 10, 152], e) };
      } },
    // ⑩ 정착 — 천천히 흐르며 끝난다.
    { at: 24.0, dur: 2.4, fov: 62, cam: function (u) {
        var e = sm(u);
        return { p: mix([112, 122, 302], [142, 146, 344], e), l: mix([62, 10, 152], [80, 12, 162], e) };
      } },
  ];
  var TOTAL = 26.4;

  this.total = TOTAL;

  // 인트로용 교통·행인 미리 배치 — 항공 샷에서 도시가 텅 비어 있으면 현실감이 없다.
  // 평소 스폰은 플레이어 주변(SPAWN_MIN~MAX)에서만 일어나므로 인트로에서는 직접 깐다.
  function seedCity() {
    var made = 0, pm = 0;
    for (var i = 0; i < city.xs.length; i++) for (var j = 0; j < city.zs.length; j++) {
      if (made >= 30) break;
      var node = city.nodes[i][j];
      for (var d = 0; d < 4; d++) {
        if (made >= 30) break;
        if (((i + j + d) % 3) !== 0) continue;                         // 너무 빽빽하지 않게 걸러 낸다
        var up = city.nodeFrom(node, (d + 2) % 4); if (!up) continue;
        var rd = city.roadOf(node, d), lanes = city.lanesOf(rd.axis, rd.idx);
        var lane = made % Math.max(1, lanes), f = TG.DIR_VEC[d], r = [-f[1], f[0]];
        var back = 26 + (made % 5) * 15, lo = city.laneOff(rd.axis, rd.idx, lane);
        var x = node.x - f[0] * back + r[0] * lo, z = node.z - f[1] * back + r[1] * lo;
        if (game.traffic.spawn({ at: { x: x, z: z, d: d, node: up }, v: 8, cruise: 11, violator: false, laneIdx: lane })) made++;
      }
    }
    for (var q = 0; q < 16; q++) {                                     // 보도의 행인
      var ni = q % city.xs.length, nj = (q * 3) % city.zs.length, nd2 = city.nodes[ni][nj];
      var side = (q % 2) ? 1 : -1, ax = (q % 2) ? 'v' : 'h', idx = (q % 2) ? ni : nj;
      var so = city.sideOff(ax, idx), along = 16 + (q % 4) * 13;
      var px = ax === 'v' ? nd2.x + side * so : nd2.x + along, pz = ax === 'v' ? nd2.z + along : nd2.z + side * so;
      if (game.peds.spawn({ at: { x: px, z: pz, axis: ax, idx: idx, coord: ax === 'v' ? city.xs[idx] : city.zs[idx], side: side, d: ax === 'v' ? 2 : 3 }, jaywalker: false })) pm++;
    }
    return [made, pm];
  }
  this.start = function () {
    self.t = 0; self.done = false; self.shot = -1; self.theme = false; self.stackIdx = -1; self.view = null;
    el.shot = $('introShot'); el.title = $('introTitle'); el.flash = $('introFlash'); el.lines = $('introLines');
    self.lines = stackLines();
    game.hud.introLines(self.lines, -1);
    game.hud.showIntro(true);
    document.body.classList.remove('cine-out');
    if (el.shot) el.shot.classList.remove('on');
    if (el.title) { el.title.classList.remove('on'); el.title.classList.remove('tagon'); }
    var em = $('introEmblem');
    if (em && !em.src && TG.tex.emblemPNG) { em.src = TG.tex.emblemPNG(function (u) { em.src = u; }); }   // 흰 바탕을 지운 판이 준비되면 바꿔 끼운다
    fovBase = game.camera.fov;
    // 무대 만들기: 신호제어기 + 제어함 앞의 경찰관 + 횡단보도의 어린이와 보호 경찰관
    junc = new TG.Junction(game); junc.node = NODE;
    BOX = junc.placeBox(NODE, 1, 1);
    officer = TG.Character.actor(game.scene, terrain, 'officer', BOX.x - 0.82, BOX.z + 0.30, Math.PI / 2);   // 제어함 왼쪽에서 함을 마주 본다
    var cz = NODE.z + city.halfH[NODE.j] + 2.3;                       // 남쪽 횡단보도 띠
    kid = TG.Character.actor(game.scene, terrain, 'kid', 17.6, cz, -Math.PI / 2);
    guard = TG.Character.actor(game.scene, terrain, 'officer', 12.4, cz - 1.1, 0);
    kid.hand = 0; guard.gesture = null;
    game.player.setSiren(true); TG.audio.setSiren(false);
    game.signals.set(NODE, 'h', 'green');                             // 남북 적색 → 반포대로 횡단보도 보행 녹색
    if (game.weather) game.weather.set('sunset');                     // 인트로는 석양 고정 — 근무 시작 때 다시 뽑는다
    // 배경을 또렷하게: 인트로 동안만 안개를 물린다(석양 안개가 짙어 도시가 뿌옇게 보였다 — 소유자: 「배경을 멋있게」).
    if (game.scene && game.scene.fog) {
      self.fogSave = { near: game.scene.fog.near, far: game.scene.fog.far };
      game.scene.fog.near = game.scene.fog.near * 2.4; game.scene.fog.far = game.scene.fog.far * 2.0;
    }
    if (junc.setPanel) junc.setPanel(true, true, false);              // 조작문을 열고 수동으로 넣은 상태(인트로의 핵심 동작)
    if (junc.setBoxLamp) junc.setBoxLamp(true);
    self.seeded = seedCity();                                         // 도시가 비어 보이지 않게 미리 깔아 둔다
    self.actors = { officer: officer, kid: kid, guard: guard, box: BOX };   // 검증·디버그용
    return true;
  };

  this.dispose = function () {
    if (junc) { junc.dispose(); junc = null; BOX = null; }
    [officer, kid, guard].forEach(function (a) { if (a) a.dispose(); });
    officer = kid = guard = null;
    document.body.classList.add('cine-out');
    if (el.shot) el.shot.classList.remove('on');
    if (el.title) { el.title.classList.remove('on'); el.title.classList.remove('tagon'); }
    // 1인칭 샷을 썼으면 3인칭으로 되돌리고, 안개·근접 평면도 원래대로
    if (game.player && game.player.setView) game.player.setView('chase');
    self.view = null;
    if (self.fogSave && game.scene && game.scene.fog) { game.scene.fog.near = self.fogSave.near; game.scene.fog.far = self.fogSave.far; self.fogSave = null; }
    game.camera.near = 0.5;
    game.camera.fov = fovBase; game.camera.updateProjectionMatrix();
  };

  // 자막: 조문 스택(0~6.3초) → 몽타주 자막(샷별) → 타이틀
  function caption(i, t) {
    var s = SHOTS[i];
    if (t < 4.5) {                                   // 조문 콜드 오픈
      var idx = -1; for (var k = 0; k < self.lines.length; k++) if (t >= self.lines[k].at) idx = k;
      if (idx !== self.stackIdx) { self.stackIdx = idx; game.hud.introLines(self.lines, idx); }
    } else if (el.lines && el.lines.childNodes.length) { el.lines.innerHTML = ''; }
    if (!el.shot) return;
    if (s.ttl) {
      if (self.shot !== i) {
        el.shot.querySelector('.kick').textContent = s.kick || '';
        el.shot.querySelector('.ttl').textContent = s.ttl;
        el.shot.querySelector('.sub').textContent = s.sub || '';
        el.shot.classList.add('on');
      }
    } else el.shot.classList.remove('on');
  }

  this.update = function (dt) {
    self.t += dt;
    var t = self.t;
    if (!self.theme && TG.audio.running) self.theme = TG.audio.introTheme(t);   // 소리가 풀리는 순간부터 테마를 이어서
    driveCar(t);
    // 배우 연기: 6.5초 경찰관이 제어함을 조작(수신호) → 8.8초 어린이가 손을 들고, 보호 경찰관이 정지 수신호
    if (junc && junc.boxAnim) junc.boxAnim(dt);
    if (officer) { officer.gesture = (t >= 8.9 && t < 10.6) ? 'operate' : (t >= 10.6 && t < 11.2) ? 'go' : null; officer.lookAtPos({ x: BOX.x, z: BOX.z }); officer.update(dt, false); }   // 박스를 조작하다가 손으로 「가세요」
    if (kid) { if (t > 10.6) kid.hand = 30; kid.lookScan = t > 10.4 && t < 11.6; if (t > 11.6 && kid.goTo) kid.goTo(-2, NODE.z + city.halfH[NODE.j] + 2.3, 1.1); kid.smile = t > 11.0; kid.update(dt, false); }
    if (guard) { guard.gesture = t > 10.8 ? 'stop' : null; guard.update(dt, false); }
    // 샷 찾기 + 카메라
    var i = 0; for (var k = 0; k < SHOTS.length; k++) if (t >= SHOTS[k].at) i = k;
    var s = SHOTS[i], u = Math.max(0, Math.min(1, (t - s.at) / s.dur)), c = s.cam(u, t);
    var cam = game.camera;
    var wantView = s.view === 'cockpit' ? 'cockpit' : 'chase';   // 1인칭 샷에서는 차내(핸들·손·계기판)를 켠다
    if (self.view !== wantView) {
      self.view = wantView;
      if (game.player.setView) game.player.setView(wantView);
      cam.near = wantView === 'cockpit' ? 0.12 : 0.5; cam.updateProjectionMatrix();
    }
    if (Math.abs(cam.fov - s.fov) > 0.01) { cam.fov += (s.fov - cam.fov) * Math.min(1, dt * 3.2); cam.updateProjectionMatrix(); }
    var hh = Math.sin(t * 3.7) * 0.028 + Math.sin(t * 1.9) * 0.02;    // 아주 약한 손떨림 — 실사감
    cam.position.set(c.p[0] + hh, c.p[1] + hh * 0.5, c.p[2] - hh);
    cam.lookAt(c.l[0], c.l[1], c.l[2]);
    caption(i, t);
    // 타이틀 등장: 테마의 대타격과 같은 순간
    if (t >= 12.6 && self.shot !== 'title' && el.title) {
      el.title.classList.add('on');
      if (el.flash) { el.flash.classList.remove('on'); void el.flash.offsetWidth; el.flash.classList.add('on'); }
      document.body.classList.add('cine-out');                        // 레터박스가 열린다
      self.shot = 'title';
    }
    if (t >= 13.6 && el.title) el.title.classList.add('tagon');
    if (t >= 14.3 && el.title && self.shot === 'title') { el.title.classList.remove('on'); self.shot = 'titleOut'; }   // 뒤 샷을 덮지 않게 물러난다
    if (SHOTS[i].ttl) self.shot = i;
    if (game.weather) game.weather.update(dt, cam.position);   // 석양 색·안개·조명이 실제로 적용되게(인트로 루프는 play 가 아니다)
    if (self.fogSave && game.scene.fog) { game.scene.fog.near = self.fogSave.near * 2.4; game.scene.fog.far = self.fogSave.far * 2.0; }   // weather 가 되돌린 안개를 다시 물린다
    game.world.followSun(cam.position.x, cam.position.z);
    return t < TOTAL;
  };
  // 테스트·디버그: 특정 초로 건너뛴다
  this.jump = function (sec) { self.t = sec; };
};
