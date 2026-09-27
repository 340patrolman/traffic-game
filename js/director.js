// 🎬 사건 감독(ROADMAP A-P2 · 완성도 지시서 P2) — 순찰 근무에 **빈 시간이 20초를 넘지 않게** 한다.
//  기준선(v0.10.6): 빈 시간 최대 31~61초. 한가한 순간이 길면 「할 일이 없는 게임」이 된다.
//  방법은 **진짜 위반을 눈앞에 놓는 것**이다 — 사건을 지어내 알림만 띄우지 않는다.
//   · 한가함이 IDLE 초(+흔들림)를 넘으면 내 앞 35~50m, **내 차로가 아닌 차로**에 습관이 있는 차(휴대전화·음주 비틀)를 하나 낸다.
//   · 기록(「위반 의심」)은 교통 AI 의 평소 목격 규칙이 한다 — 감독은 차를 놓기만 한다.
//   · 정차 유도·추격·112 출동·하차 중처럼 **맡은 일이 있으면 한가한 것이 아니다**(4초마다 계측에 'busy' 를 남긴다).
//  켜지 않는 때: 순찰 근무가 아닐 때 · 🧪 시뮬레이션 · 첫 출근 · 고속도로·연결로 위(격자 도로에서만 놓는다).
//  숫자(IDLE·거리)는 **게임 설계값**이다.
TG.Director = function (game) {
  var self = this, lastT = 0, busyT = 0, wasBusy = false, jit = 0, pending = null, pendT = 0, nth = 0;
  this.IDLE = 10;          // 이만큼 한가하면 사건을 놓는다(흔들림 0~3초를 더한다 — 판정까지 목격 시간 2~5초가 더 걸린다)
  this.log = [];
  // 감독이 놓는 것은 **멀리서도 곧 보이는** 위반만(휴대전화·음주 비틀·과속). 안전띠·선팅은 18~22m 안에서만 보여 한가함을 못 줄인다 — 평소 교통에 섞여 나온다.
  var POOL = [{ type: 'sedan', trait: 'phone' }, { type: 'hatch', trait: 'speeder' }, { type: 'suv', trait: 'phone' }, { type: 'sedan', trait: 'drunk' }];
  // 🗺 디지털 트윈(v0.10.36 · 소유자 「교통사고 관련해서 해당 종목이나 관련 내용이 많은 곳에서 해당 단속을 할 수 있게」):
  //   가까운 교차로의 **실제 TAAS 사고 경위 상위**를 보고 그 위반을 하는 차를 먼저 놓는다. 경위 이름 → 습관(게임에서 보이는 모습)
  // 신호위반·보행자보호 성향은 적색·횡단 때에야 드러나 한가함을 못 채운다 — 평소 교통(violator·pedViolator)에 맡기고 감독은 곧 보이는 것만 놓는다
  var LAW_TRAIT = { '안전거리미확보': { type: 'sedan', trait: 'tailgate', lead: true },
                    '안전운전불이행': { type: 'hatch', trait: 'phone' }, '교차로운행방법위반': { type: 'sedan', trait: 'speeder' } };
  var told = {};   // 한 근무에 교차로마다 한 번만 알려 준다
  function localPick() {
    var P = game.player, city = game.city, L = game.layers;
    if (!P || !city || !L || !L.nodeViolations || !city.nearestNode) return null;
    var nd = city.nearestNode(P.pos.x, P.pos.z), info = nd ? L.nodeViolations(nd.i, nd.j) : null;
    if (!info || !info.violations.length) return null;
    var cand = info.violations.filter(function (v) { return LAW_TRAIT[v[0]]; });
    if (!cand.length) return null;
    var tot = cand.reduce(function (s, v) { return s + v[1]; }, 0), r = Math.random() * tot, pick = cand[0];
    for (var i = 0; i < cand.length; i++) { r -= cand[i][1]; if (r <= 0) { pick = cand[i]; break; } }
    var key = nd.i + ',' + nd.j;
    if (!told[key] && game.hud && game.hud.hint) {
      told[key] = true;
      game.hud.hint('📊 ' + info.name + ' — 실제 사고 경위(' + info.years + ') ' + cand.slice(0, 2).map(function (v) { return v[0] + ' ' + v[1] + '건'; }).join(' · ') + ' — 그 위반부터 본다');
    }
    return LAW_TRAIT[pick[0]];
  }
  function now() { return game.traffic ? game.traffic.time : 0; }
  function sim() { return !!(TG.mode && TG.mode.sim); }
  this.bias = null;        // 📖 캠페인 장이 고른다: 'drunk'(8월) · 'pm'(10월) — reset 이 지운다
  var BIAS = { drunk: [{ type: 'sedan', trait: 'drunk' }, { type: 'suv', trait: 'drunk' }, { type: 'hatch', trait: 'phone' }],
               pm: [{ type: 'pm', trait: null, pmHelmet: false }, { type: 'pm', trait: null, pmHelmet: false }, { type: 'sedan', trait: 'phone' }] };
  this.reset = function () { told = {}; self.bias = null; lastT = now(); busyT = 0; jit = Math.random() * 3; pending = null; pendT = 0; nth = 0; wasBusy = false; self.log = []; };
  // 계측이 사건을 적을 때마다 부른다(metrics.ev) — 사건이 났으면 한가함은 0 부터
  this.mark = function () { lastT = now(); if (pending && pending.violation && pending.violation.seen) pending = null; };
  this.idle = function () { return now() - lastT; };
  function busy() {
    var E = game.enforcement;
    if (E && E.state && E.state !== 'idle') return true;
    if (game.chase && game.chase.car) return true;
    if (game.dispatch && game.dispatch.active) return true;
    if (game.afoot || (game.drunkProc && game.drunkProc.isOpen && game.drunkProc.isOpen())) return true;
    if (game.stopcam && game.stopcam.active && game.stopcam.active()) return true;
    return false;
  }
  function place() {
    var P = game.player, city = game.city, tr = game.traffic;
    if (!P || !city || !tr) return null;
    var fr = city.frameAt(P.pos.x, P.pos.z, P.heading);
    if (!fr || fr.kind === 'link') return null;                       // 격자 도로에서만
    var d = TG.headingToDir(P.heading), f = TG.DIR_VEC[d], r = [-f[1], f[0]];
    var hf = Math.sin(P.heading) * f[0] + Math.cos(P.heading) * f[1];
    if (hf < 0.9) return null;                                         // 도로와 나란히 달릴 때만
    var axis = (d === 0 || d === 2) ? 'v' : 'h';
    var idx = axis === 'v' ? city.nearestIdx(city.xs, P.pos.x) : city.nearestIdx(city.zs, P.pos.z);
    var n = city.lanesOf(axis, idx);
    var myLane = city.laneIndexAt ? city.laneIndexAt(axis, idx, fr.lateral) : 0;
    var lane = n > 1 ? (myLane === 0 ? 1 : myLane - 1) : 0;
    if (n <= 1) return null;                                           // 차로가 하나뿐이면 내 앞을 막는다
    var la = city.laneOff(axis, idx, lane);
    var pool = (self.bias && BIAS[self.bias]) || POOL, pick = pool[nth % pool.length];
    if (!self.bias && nth % 3 !== 2) { var lp = localPick(); if (lp && !(lp.lane0 && myLane === 0)) pick = lp; }   // 셋 중 둘은 그 교차로의 실제 사고 경위대로, 하나는 섞는다
    // 과속 차는 **뒤에서 달려와 옆 차로로 지나간다**(v0.10.39) — 앞에 느리게 놓으면 빨라지는 동안 시야 밖으로 멀어져 목격이 안 됐다(트윈 검증)
    var SPD = pick.trait === 'speeder', spots = SPD ? [-26, -33, -40] : [38, 45, 52];
    for (var si = 0; si < spots.length; si++) {
      var ahead = spots[si], ax = P.pos.x + f[0] * ahead, az = P.pos.z + f[1] * ahead;
      if (city.nearIntersectionZone(ax, az)) continue;                  // 교차로 부근에는 놓지 않는다
      var cx = axis === 'v' ? city.xs[idx] : ax, cz = axis === 'v' ? az : city.zs[idx];
      var x = cx + r[0] * la, z = cz + r[1] * la;
      var nd = city.nodeAhead(x, z, (d + 2) % 4);                      // spawn 의 at.node 는 뒤쪽 교차로
      if (!nd) continue;
      var useLane = pick.lane0 ? 0 : lane;
      if (useLane !== lane) { var la0 = city.laneOff(axis, idx, useLane); x = cx + r[0] * la0; z = cz + r[1] * la0; }
      if (pick.lead) tr.spawn({ at: { x: x + f[0] * 14, z: z + f[1] * 14, d: d, node: nd }, laneIdx: useLane, v: 7.5, cruise: 7.5, straight: true, type: 'hatch', trait: null, violator: false });   // 느린 앞차 — 붙거나(안전거리) 넘어 앞지를(중앙선) 까닭
      var car = tr.spawn({ at: { x: x, z: z, d: d, node: nd }, laneIdx: useLane, v: SPD ? 21 : Math.max(5, Math.min(9, Math.abs(P.vF || 0) * 0.7)), straight: true, type: pick.type, trait: pick.trait, pmHelmet: pick.pmHelmet, violator: !!pick.violator, pedViolator: pick.pedViolator });
      if (car) { car.directed = true; car.traitT = 6; car.drunkSeen = 2.5; car.pmT = 1.5; nth++; return car; }   // 목격 시간을 조금 앞당긴다(휴대전화 8초·음주 5초 → 2~3초)
    }
    return null;
  }
  this.update = function (dt) {
    if (game.directorOff || !(game.mode === 'patrol' || game.mode === 'open') || game.state !== 'play' || sim() || (game.first && game.first.on && game.first.on())) { lastT = now(); return; }   // 검사 모드는 기본으로 끈다(다른 검사에 차가 끼어들지 않게)
    if (busy()) {
      busyT += dt; lastT = now(); wasBusy = true;
      if (busyT >= 4) { busyT = 0; if (game.metrics) game.metrics.ev('busy'); }
      return;
    }
    busyT = 0;
    // 맡은 일이 막 끝났다 — 끝난 순간을 계측에 남긴다(4초 간격 표시만 있으면 빈 시간이 그만큼 길게 잡힌다)
    if (wasBusy) { wasBusy = false; if (game.metrics) game.metrics.ev('busy'); }
    // 놓은 차가 아직 기록되지 않았으면 조금 기다린다(목격 규칙이 2~5초 걸린다)
    if (pending) {
      pendT += dt;
      if (pending.violation && pending.violation.seen) { pending = null; return; }
      if (pendT < 9 && game.traffic.cars.indexOf(pending) >= 0) return;
      pending = null;                                                   // 놓쳤다 — 다음 기회에 다시 놓는다
    }
    if (self.idle() < self.IDLE + jit) return;
    var car = place();
    if (car) { pending = car; pendT = 0; jit = Math.random() * 3; self.log.push([+now().toFixed(1), car.trait]); }
    else lastT = now() - self.IDLE - jit + 2;                          // 자리가 없으면 2초 뒤 다시 본다
  };
};
