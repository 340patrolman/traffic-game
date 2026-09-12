// 4구 신호(적·황·좌회전·녹) 주기 제어. 교차로마다 위상 오프셋. 보행 신호는 직각 방향 차량 녹색 초반에만 켜진다.
TG.Signals = function (city, world, cfg) {
  var G = cfg.SIG_GREEN, Y = cfg.SIG_YELLOW, R = cfg.SIG_ALLRED, HALF = G + Y + R, CYCLE = HALF * 2;
  // 교차로마다 고유값(강제값): 최소 녹색 시간. 보행 신호 최소(cfg.PED_WALK)는 어느 교차로에서도 줄일 수 없다.
  // 수동 조작에서 버튼을 눌러도 최소 녹색·보행 최소를 채운 뒤 황색·전적색을 거쳐야 넘어간다 — 교차로 특성을 알아야 조작할 수 있다.
  var NODE_MIN = { '2,1': 18, '2,2': 16, '3,2': 18, '4,2': 20, '2,0': 16, '4,1': 18, '3,4': 15, '2,4': 15, '4,4': 18 };   // 성모병원·서초역·교대역·강남역·고속터미널·신논현·남부터미널·예술의전당·양재역
  // **주기는 경찰청 실측값을 쓴다.** 지도 파일의 signals 블록에서 읽는다(코드에 숫자를 적지 않는다).
  // 이름이 맞는 실제 교차로가 없는 곳은 서울 주간 운영계획의 주기 중앙값으로 물러서고, 화면에 「추정」이라고 밝힌다.
  var SIG = (TG.MAP && TG.MAP.signals) || null;
  var SIG_CYC = (SIG && SIG.cycles) || {};
  var SIG_DEF = (SIG && +SIG.cycleDefault) || 0;
  var ctrl = {};
  city.xs.forEach(function (_, i) { city.zs.forEach(function (__, j) {
    var key = i + ',' + j;
    var rc = SIG_CYC[key] || null, cyc = (rc && +rc.sec) || SIG_DEF || 0;
    ctrl[key] = { t: ((i * 7 + j * 11) % 10) * 3, manual: false, req: null, minGreen: NODE_MIN[key] || 12, gv: G, gh: G, lv: leftFor('v', i), lh: leftFor('h', j),   // gv·gh = 남북·동서 **직진** 녹색 · lv·lh = 보호 좌회전 녹색(넓은 도로만, 0 이면 직좌 동시)
                  cycle: cyc, cycSrc: rc ? (rc.src || '실측') : (SIG_DEF ? '추정' : ''), cycReal: !!rc,
                  cycPhases: rc ? (+rc.phases || 0) : 0, cycLap: !!(rc && rc.lap) };
  }); });
  function keyOf(node) { return node.i + ',' + node.j; }
  // ---- 보호 좌회전 현시(v0.9.49) ----
  // 한 주기 = [남북 직진 gv · 황 · 전적] [남북 좌회전 lv · 황 · 전적] [동서 직진 gh · 황 · 전적] [동서 좌회전 lh · 황 · 전적].
  // 좌회전 현시가 없는 축(좁은 도로)은 그 토막이 없고 좌회전은 직진과 같이 간다(직좌 동시 — 전 판과 같다).
  function leftFor(axis, idx) { return city.lanesOf(axis, idx) >= (cfg.SIG_LEFT_MIN_LANES || 3) ? (cfg.SIG_LEFT_SEC || 0) : 0; }
  function lvOf(node) { return ctrl[keyOf(node)].lv || 0; }
  function lhOf(node) { return ctrl[keyOf(node)].lh || 0; }
  function leftSeg(L) { return L > 0 ? L + Y + R : 0; }
  function leftExtra(node) { return leftSeg(lvOf(node)) + leftSeg(lhOf(node)); }
  function hasLeft(node, axis) { return (axis === 'v' ? lvOf(node) : lhOf(node)) > 0; }
  // ---- 실측 현시(로컬 전용 — v0.9.50) ----
  // 도면(KSC-5800SE)의 현시 목록을 그대로 돈다: 현시마다 켜지는 이동류(1~8)와 시간(A링, 황색·전적색 포함). 저장소에는 없고
  // data/local/phases-seocho.json 이 있을 때만 쓴다(공개 여부 미정). 수동 조작 중이거나 녹색을 손으로 고친 교차로는 일반형으로 돈다.
  var S_CODE = [4, 2, 8, 6], L_CODE = [7, 5, 3, 1];   // 진행 방향 d(0 남행 · 1 동행 · 2 북행 · 3 서행) → 직진 · 좌회전 이동류
  var PAIR = { 1: 5, 5: 1, 3: 7, 7: 3, 2: 6, 6: 2, 4: 8, 8: 4 };   // 도면에 없는 접근로(예: 성모병원 동측)는 맞은편 이동류를 따른다
  function realOn(c) { return !!(c && c.realPlan && !c.realOff && !c.manual); }
  function runsOf(inP, durs) {   // 이어지는 현시를 하나로 붙인 구간 [첫 현시, 끝 현시, 길이, 늘 켜짐]
    var n = inP.length, out = [], brk = inP.indexOf(false), tot = 0;
    durs.forEach(function (x) { tot += x; });
    if (inP.indexOf(true) < 0) return out;
    if (brk < 0) return [[0, n - 1, tot, true]];
    for (var k = 1; k <= n; k++) {
      var p = (brk + k) % n;
      if (!inP[p] || inP[(p + n - 1) % n]) continue;
      var e = p, len = durs[p];
      while (inP[(e + 1) % n] && (e + 1) % n !== p) { e = (e + 1) % n; len += durs[e]; }
      out.push([p, e, len, false]);
    }
    return out;
  }
  function buildReal(c, plan, date) {
    // 요일(1 월~목 · 2 금 · 3 토 · 4 일·공휴일) · 시각 → 계획 번호 → 현시 시간(A링)
    var dow = date.getDay(), dt = dow === 0 ? 4 : dow === 6 ? 3 : dow === 5 ? 2 : 1;
    var rows = plan.tod && (plan.tod[dt] || plan.tod['1']), mins = date.getHours() * 60 + date.getMinutes(), pno = null;
    if (!rows || !rows.length || !plan.phases || !plan.phases.length) return false;
    rows.forEach(function (r) { var hm = String(r[0]).split(':'); if ((+hm[0]) * 60 + (+hm[1] || 0) <= mins) pno = r[2]; });
    if (pno === null) pno = rows[rows.length - 1][2];   // 첫 계획 전(자정 직후)은 전날 마지막 계획이 이어진다(근사)
    var pat = plan.patterns && plan.patterns[pno], n = plan.phases.length;
    if (!pat || !pat.a || pat.a.length < n) return false;
    var durs = pat.a.slice(0, n), tot = 0, starts = [], yel = [], ar = [];
    for (var i = 0; i < n; i++) { starts.push(tot); tot += durs[i]; yel.push(plan.yellow && plan.yellow[i] > 0 ? plan.yellow[i] : Y); ar.push(plan.allred && plan.allred[i] >= 0 ? plan.allred[i] : R); }
    if (!tot) return false;
    var iv = {}, has = {};
    for (var m = 1; m <= 8; m++) {
      var inP = plan.phases.map(function (x) { return x.moves.indexOf(m) >= 0; });
      iv[m] = runsOf(inP, durs).map(function (r) { return r[3] ? { s: 0, g: tot, y: 0 } : { s: starts[r[0]], g: Math.max(1, r[2] - yel[r[1]] - ar[r[1]]), y: yel[r[1]] }; });
      has[m] = iv[m].length > 0;
    }
    // 보행: 보행 표시가 있는 현시 중 **건너는 도로와 직각인 직진**이 켜진 현시(근사 — 도면의 횡단보도를 게임의 횡단보도에 1:1 로 붙이지 못했다)
    var ped = {};
    ['v', 'h'].forEach(function (cx) {
      var perp = cx === 'v' ? [2, 6] : [4, 8];
      var inQ = plan.phases.map(function (x) { return !!x.ped && (x.moves.indexOf(perp[0]) >= 0 || x.moves.indexOf(perp[1]) >= 0); });
      ped[cx] = runsOf(inQ, durs).map(function (r) { return { s: r[3] ? 0 : starts[r[0]], g: r[3] ? tot : Math.max(1, r[2] - yel[r[1]] - ar[r[1]]) }; });
    });
    c.realPlan = { cycle: tot, pno: pno, iv: iv, has: has, ped: ped, n: n, durs: durs, no: plan.no, name: plan.name, offset: pat.offset || 0 };
    return true;
  }
  function ivState(list, t, C) {   // 녹색 구간 목록에서 지금 상태: 녹색 → 황색 → 적색(다음 녹색까지 남은 초)
    var best = null;
    for (var i = 0; i < list.length; i++) {
      var a = list[i], e = t - a.s; if (e < 0) e += C;
      if (e < a.g) return { s: 'green', remain: a.g - e, elapsed: e };
      if (e < a.g + a.y) return { s: 'yellow', remain: a.g + a.y - e, elapsed: e - a.g };
      if (!best || C - e < best.remain) best = { s: 'red', remain: C - e, elapsed: e - a.g - a.y };
    }
    return best;
  }
  function realMove(c, code) {
    var rp = c.realPlan, m = rp.has[code] ? code : (rp.has[PAIR[code]] ? PAIR[code] : 0);
    if (!m) return null;
    return ivState(rp.iv[m], ((c.t % rp.cycle) + rp.cycle) % rp.cycle, rp.cycle);
  }
  function mergeSt(a, b) {   // 한 축의 두 접근로를 하나로 볼 때(축 단위 API): 어느 쪽이든 녹색이면 녹색
    if (!a) return b; if (!b) return a;
    if (a.s === 'green' || b.s === 'green') return a.s !== 'green' ? b : (b.s === 'green' && b.remain > a.remain ? b : a);
    if (a.s === 'yellow' || b.s === 'yellow') return a.s === 'yellow' ? a : b;
    return a.remain < b.remain ? a : b;
  }
  function realPedInfo(node, crossAxis) {
    var c = ctrl[keyOf(node)]; if (!realOn(c)) return null;
    var rp = c.realPlan, list = rp.ped[crossAxis] || [], C = rp.cycle, t = ((c.t % C) + C) % C, Wn = pedTime(node, crossAxis), best = null;
    for (var i = 0; i < list.length; i++) {
      var a = list[i], W = Math.min(Wn, a.g), e = t - a.s; if (e < 0) e += C;
      if (e < W) return { walk: true, remain: W - e, W: W };
      if (!best || C - e < best.remain) best = { walk: false, remain: C - e, W: W };
    }
    return best || { walk: false, remain: C, W: 0 };
  }
  // 이 접근로(진행 방향 d)의 직진·좌회전 신호. 실측 현시가 있으면 그 이동류, 없으면 일반형(축 단위).
  function moveState(node, d, man) {
    var c = ctrl[keyOf(node)];
    if (realOn(c)) { var r = realMove(c, man === 'L' ? L_CODE[d] : S_CODE[d]); if (r) return r; }
    var ax = (d === 0 || d === 2) ? 'v' : 'h';
    return man === 'L' ? leftState(node, ax) : state(node, ax);
  }
  // 이 접근로의 1차로가 좌회전 전용인가(좌회전 신호가 따로 도는가)
  function hasLeftFor(node, d) {
    var c = ctrl[keyOf(node)];
    if (realOn(c)) return !!(c.realPlan.has[L_CODE[d]] || c.realPlan.has[PAIR[L_CODE[d]]]);
    return hasLeft(node, (d === 0 || d === 2) ? 'v' : 'h');
  }
  function applyReal(data, date) {
    if (!data || !data.nodes) return 0;
    date = date || new Date();
    var n = 0, secs = date.getHours() * 3600 + date.getMinutes() * 60 + date.getSeconds();
    for (var k in data.nodes) {
      var c = ctrl[k]; if (!c) continue;
      // 주기 시작 = 0시 + 옵셋 — **가설**이다(실시간 SPaT 로 확인하기 전). 틀려도 현시 순서·길이는 도면 그대로다.
      if (buildReal(c, data.nodes[k], date)) { n++; var rp = c.realPlan; c.t = (((secs - rp.offset) % rp.cycle) + rp.cycle) % rp.cycle; }
      else c.realPlan = null;
    }
    return n;
  }
  function restoreReal(node) { ctrl[keyOf(node)].realOff = false; }
  // 한 교차로만 **실측 현시를 끄고 일반형**으로 돌린다 — 영아·어린이 교실은 화면이 신호를 직접 잡아야 하기 때문이다.
  // (실측 현시는 도면의 보행 표시를 근사로만 옮겨 두어 `set(…,'green')` 으로도 보행 초록이 안 켜지는 교차로가 있다 · v0.9.50)
  function setRealOff(node, off) { var c = ctrl[keyOf(node)]; if (c) c.realOff = !!off; }
  function realInfo(node) {
    var c = ctrl[keyOf(node)]; if (!realOn(c)) return null;
    var rp = c.realPlan;
    return { no: rp.no, name: rp.name, pno: rp.pno, cycle: rp.cycle, n: rp.n, durs: rp.durs.slice(), ref: '주기 시작 0시+옵셋(가설)' };
  }
  // **읽는 순간 하한을 강제한다.** 저장된 값(교통시설 화면·이전 판)이 보행 시간보다 짧으면
  // 「보고 출발해도 다 건너기 전에 적색」이 다시 생긴다. 어디서 무엇을 써 넣었든 이 문을 지난다.
  function gvOf(node) { var c = ctrl[keyOf(node)]; return Math.max(c.gv, greenMin(node, 'v')); }
  function ghOf(node) { var c = ctrl[keyOf(node)]; return Math.max(c.gh, greenMin(node, 'h')); }
  function greenFor(node, axis) { return axis === 'v' ? gvOf(node) : ghOf(node); }
  // ↓ 아래 raiseToPedMin() 은 ctrl 을 다 만든 뒤 이 파일 끝에서 한 번 부른다.
  // 기본 녹색(cfg.SIG_GREEN)이 넓은 횡단보도의 보행 시간을 못 품는 교차로가 있었다.
  // 그러면 pedTime 이 「차량 녹색 − 2」로 깎여, 보행 신호를 보고 제때 출발해도 다 건너기 전에 적색이 됐다
  // (소유자: 「횡단보도 보행자 신호가 너무 짧아서 제 시간에 출발해도 빨간불이 되는경우가 있다」).
  // 그래서 초기값을 교차로마다 greenMin 까지 끌어올린다 — 보행 시간이 줄어드는 일이 없어진다.
  function raiseToPedMin() {
    for (var k in ctrl) {
      var kn = k.split(','), nd = city.nodes[+kn[0]][+kn[1]], c = ctrl[k];
      c.gv = Math.max(c.gv, greenMin(nd, 'v'));
      c.gh = Math.max(c.gh, greenMin(nd, 'h'));
    }
  }
  function cycleOf(node) { var c = ctrl[keyOf(node)]; if (realOn(c)) return c.realPlan.cycle; return gvOf(node) + ghOf(node) + 2 * (Y + R) + leftExtra(node); }
  // 실측 주기에 맞춰 녹색을 **늘린다. 줄이지는 않는다** — 보행 하한이 언제나 먼저다.
  // 남는 시간은 차로 수(수용력)에 비례해 남북·동서로 나눈다. 실제로는 교통량으로 나누지만
  // 방향별 교통량 자료가 없으므로 차로 수를 대리값으로 쓴다 — 이 배분은 **게임 설계값**이고 실측이 아니다.
  // (경찰청 자료가 주는 A링·B링 현시값은 어느 현시가 어느 방향인지 알려주지 않는다. 주기만 실측을 쓴다.)
  function applyCycles() {
    for (var k in ctrl) {
      var kn = k.split(','), i = +kn[0], j = +kn[1], nd = city.nodes[i][j], c = ctrl[k];
      if (!c.cycle) continue;
      var T = c.cycle - 2 * (Y + R) - leftExtra(nd), fv = greenMin(nd, 'v'), fh = greenMin(nd, 'h');   // 좌회전 현시 토막은 주기에서 먼저 뺀다
      if (T <= fv + fh) { c.gv = fv; c.gh = fh; continue; }   // 보행 시간이 실측 주기보다 크면 보행이 이긴다(주기가 그만큼 길어진다)
      var lv = city.lanesOf('v', i), lh = city.lanesOf('h', j);
      var extra = T - fv - fh, share = lv / (lv + lh);
      c.gv = Math.round(fv + extra * share);
      c.gh = T - c.gv;
      if (c.gh < fh) { c.gh = fh; c.gv = T - fh; }
    }
  }
  // **시간대별 계획(TOD)**을 지금 시각으로 적용한다. 자료가 늦게 도착하므로(fetch) 나중에 한 번 더 부른다.
  // 실측 교차로만 바뀐다 — 개방 목록에 없는 곳은 추정 주기로 남는다.
  function applyTod(tod, date) {
    if (!tod || !tod.ready) return 0;
    var n = 0;
    for (var k in ctrl) {
      var c = ctrl[k];
      if (!c.cycReal || !c.cycSrc) continue;
      var inf = tod.info(c.cycSrc, date);
      if (!inf || !inf.cycle) continue;
      c.cycle = inf.cycle; c.tod = inf; n++;
    }
    if (n) applyCycles();
    return n;
  }
  // 화면에 「실측 200초(사당역)」인지 「추정 160초」인지 밝힌다. 출처를 숨기지 않는다.
  function cycleInfo(node) {
    var c = ctrl[keyOf(node)];
    return { target: c.cycle || 0, real: c.cycReal, src: c.cycSrc || '', phases: (c.tod ? c.tod.phases : c.cycPhases) || 0,
             lap: c.tod ? c.tod.lap : !!c.cycLap, tod: c.tod || null,
             actual: cycleOf(node), source: (SIG && SIG.source) || '' };
  }
  // 녹색 시간 하한: 그 방향의 최소 녹색과, 직각 횡단보도의 보행 시간 + 2초. **보행 시간은 줄일 수 없다**(소유자 강조).
  function greenMin(node, axis) {
    // 그 방향 녹색은 **직각 횡단보도의 보행 시간**을 품어야 한다. 계산은 pedTime 한 곳에만 둔다
    // (전에는 여기에 5초·1.15m/s 를 따로 적어 두어, pedTime 을 고쳐도 이쪽이 따라오지 않았다).
    var c = ctrl[keyOf(node)], crossAx = axis === 'v' ? 'h' : 'v';
    return Math.max(c.minGreen, Math.ceil(pedTime(node, crossAx)) + 2);
  }
  function setGreen(node, axis, sec) {
    var c = ctrl[keyOf(node)], lo = greenMin(node, axis), hi = 150;   // 실측 주기가 200초까지 있어 60초 상한으로는 담을 수 없다
    c.realOff = true;   // 녹색을 손으로 고치면 그 교차로는 실측 현시 대신 일반형(가정 시나리오)으로 돈다 — 되돌리기는 restoreReal
    var v = Math.round(TG.clamp(sec, lo, hi));
    if (axis === 'v') c.gv = v; else c.gh = v;
    return { sec: v, min: lo, max: hi, clamped: v !== Math.round(sec) };
  }
  function greenInfo(node) {
    var c = ctrl[keyOf(node)];
    return { gv: gvOf(node), gh: ghOf(node), minV: greenMin(node, 'v'), minH: greenMin(node, 'h'), cycle: cycleOf(node),
             pedV: Math.round(pedTime(node, 'v')), pedH: Math.round(pedTime(node, 'h')), minGreen: c.minGreen,
             target: c.cycle || 0, real: c.cycReal, src: c.cycSrc || '', phases: c.cycPhases || 0, lap: !!c.cycLap, leftV: lvOf(node), leftH: lhOf(node), realPlan: realInfo(node) };
  }
  // 보행 시간 = 진입 시간 + 횡단 거리 ÷ 설계 보행속도. 값은 config 에 있고 **법령 수치가 아니라 게임 설계값**이다.
  // 어린이보호구역은 더 느린 속도로 잡는다 — 아이가 뛰지 않고 건널 수 있어야 한다.
  // crossAxis 는 **건너는 도로**의 축이다(그 도로의 보도선 사이가 횡단 거리).
  function pedTime(node, crossAxis) {
    var idx = crossAxis === 'v' ? node.i : node.j;
    // 횡단 거리는 **연석에서 연석까지**(차도 폭)다. 보도 바깥선까지 재면 양쪽 보도 폭(6m)만큼 과하게 잡혀
    // 주기가 100초 가까이 늘어난다 — 사람은 보도 위를 「건너지」 않는다.
    var len = 2 * city.halfOf(crossAxis, idx);
    var school = city.inSchoolZone ? city.inSchoolZone(node.x, node.z) : false;
    var v = school ? (cfg.PED_SPEED_SCHOOL || 0.8) : (cfg.PED_SPEED || 1.0);
    // **차량 녹색 길이로 깎지 않는다.** 짧으면 차량 녹색을 늘리는 쪽이다(raiseToPedMin).
    return Math.max(cfg.PED_WALK, (cfg.PED_ENTER_SEC || 7) + len / v);
  }
  // 지금 녹색인 축과 경과·지속 시간(전환 중이면 null)
  function greenNow(node) {
    var c = ctrl[keyOf(node)], gv = gvOf(node), gh = ghOf(node), p = phase(c.t, gv, gh, lvOf(node), lhOf(node));
    if (p.ns.s === 'green') return { axis: 'v', elapsed: p.ns.elapsed, dur: gv, at: 0 };
    if (p.ew.s === 'green') return { axis: 'h', elapsed: p.ew.elapsed, dur: gh, at: p.Hv };
    return null;
  }
  // 수동 전환에 필요한 남은 시간: 최소 녹색·보행 최소를 채우고 + 황색 + 전적색
  function waitFor(node, axis) {
    var c = ctrl[keyOf(node)], g = greenNow(node);
    if (!g) return { wait: 1.5, why: '전환 중' };
    if (g.axis === axis) return { wait: 0, why: '이미 녹색' };
    var needMin = Math.max(c.minGreen, pedTime(node, g.axis === 'v' ? 'h' : 'v') + 2);   // 보행 신호를 줄일 수 없다 → 그 횡단보도의 보행 시간 + 여유
    var left = Math.max(0, needMin - g.elapsed);
    // 지금 축의 좌회전 현시까지 돌고 넘어간다(v0.9.49)
    return { wait: left + Y + R + leftSeg(g.axis === 'v' ? lvOf(node) : lhOf(node)), why: left > 0 ? (pedWalk(node, g.axis === 'v' ? 'h' : 'v') ? '보행 신호 최소 시간' : '최소 녹색 시간') : '황색·전적색 통과' };
  }
  function setManual(node, on) { var c = ctrl[keyOf(node)]; c.manual = !!on; c.req = null; return c.manual; }
  function isManual(node) { return !!ctrl[keyOf(node)].manual; }
  // 수동 요청: 이 축을 녹색으로. 즉시 바뀌지 않고 최소 시간을 채운 뒤 넘어간다.
  function request(node, axis) {
    var c = ctrl[keyOf(node)];
    if (!c.manual) return { ok: false, why: '자동 운영 중 — 수동으로 먼저 전환하세요' };
    var w = waitFor(node, axis);
    if (w.wait <= 0) return { ok: false, why: '이미 그 방향이 녹색입니다' };
    c.req = axis;
    return { ok: true, wait: w.wait, why: w.why };
  }
  function manualInfo(node) {
    var c = ctrl[keyOf(node)], g = greenNow(node);
    return { manual: c.manual, req: c.req, minGreen: c.minGreen, axis: g ? g.axis : null, elapsed: g ? g.elapsed : 0,
             // 전환(황색·전적색) 중에는 녹색 축이 없다. 그때 cfg.PED_WALK(하한 20초)를 보여 주면
             // 「보행 최소 20초」라는 **틀린 숫자**가 화면에 뜬다 — 이 교차로의 실제 보행 시간은 도로 폭으로 정해진다(v0.9.28).
             // 그래서 두 횡단보도 중 **긴 쪽**을 보여 준다.
             holding: !!(c.manual && g && g.elapsed >= g.dur - 0.05 && !c.req),
             pedMin: g ? Math.round(pedTime(node, g.axis === 'v' ? 'h' : 'v'))
                       : Math.round(Math.max(pedTime(node, 'v'), pedTime(node, 'h'))) };
  }

  var mats = {
    green: new THREE.MeshBasicMaterial({ map: TG.tex.signalHead('greenLeft') }),
    yellow: new THREE.MeshBasicMaterial({ map: TG.tex.signalHead('yellow') }),
    red: new THREE.MeshBasicMaterial({ map: TG.tex.signalHead('red') }),
    straight: new THREE.MeshBasicMaterial({ map: TG.tex.signalHead('green') }),     // 보호 좌회전 교차로의 직진 현시: 녹색만
    left: new THREE.MeshBasicMaterial({ map: TG.tex.signalHead('redLeft') }),       // 좌회전 현시: 적색 + 좌회전 화살표
  };
  // 보행 신호등: 적색 서 있는 사람 / 녹색 걷는 사람 + 잔여 시간 숫자(한국식 잔여시간 표시기). 보행 녹색의 점멸 토막(횡단 거리에 비례 — v0.9.48) 동안 녹색이 깜빡인다.
  var pedMats = { stop: new THREE.MeshBasicMaterial({ map: TG.tex.pedHead(false) }), off: new THREE.MeshBasicMaterial({ map: TG.tex.pedHead(true, -1) }) };
  function pedMat(remain) { var n = Math.max(1, Math.ceil(remain)), k = 'w' + n; if (!pedMats[k]) pedMats[k] = new THREE.MeshBasicMaterial({ map: TG.tex.pedHead(true, n) }); return pedMats[k]; }
  // 점멸의 꺼진 순간: 사람만 꺼지고 숫자는 남는다(실물 잔여시간 표시기와 같다)
  function pedMatOff(remain) { var n = Math.max(1, Math.ceil(remain)), k = 'o' + n; if (!pedMats[k]) pedMats[k] = new THREE.MeshBasicMaterial({ map: TG.tex.pedHead(true, n, true) }); return pedMats[k]; }
  // 적색 대기: 다음 녹색까지 남은 초를 적색 숫자로(두 자리까지). 100 이상은 빈 판
  function pedMatWait(wait) { var n = Math.ceil(wait); if (n < 1 || n > 99) return pedMats.stop; var k = 'r' + n; if (!pedMats[k]) pedMats[k] = new THREE.MeshBasicMaterial({ map: TG.tex.pedHead(false, n) }); return pedMats[k]; }

  // 축별 상태. axis 'v' = 남북 도로(x 고정) 위를 달리는 차량, 'h' = 동서.
  // 교차로마다 남북 녹색 gv · 동서 녹색 gh 가 다르다. 한 주기 = gv + Y + R + gh + Y + R.
  // lv·lh(보호 좌회전)가 0 이면 전 판과 같은 2현시다. 적색의 remain 은 다음 녹색 시작까지, elapsed 는 황색이 끝난 뒤로 잰다.
  function phase(t, gv, gh, lv, lh) {
    gv = gv || G; gh = gh || G; lv = lv || 0; lh = lh || 0;
    var Sv = gv + Y + R, Hv = Sv + leftSeg(lv), Sh = gh + Y + R, C = Hv + Sh + leftSeg(lh);
    t = ((t % C) + C) % C;
    function seg(start, g) {   // 녹색 [start, start+g) → 황색 Y → 그 뒤는 적색
      var e = t - start; if (e < 0) e += C;
      if (e < g) return { s: 'green', remain: g - e, elapsed: e };
      if (e < g + Y) return { s: 'yellow', remain: g + Y - e, elapsed: e - g };
      return { s: 'red', remain: C - e, elapsed: e - g - Y };
    }
    var ns = seg(0, gv), ew = seg(Hv, gh);
    return { ns: ns, ew: ew, lv: lv > 0 ? seg(Sv, lv) : ns, lh: lh > 0 ? seg(Hv + Sh, lh) : ew, t: t, cycle: C, Hv: Hv };
  }
  function ph(node) { var c = ctrl[keyOf(node)]; return phase(c.t, gvOf(node), ghOf(node), lvOf(node), lhOf(node)); }
  function state(node, axis) {
    var c = ctrl[keyOf(node)];
    if (realOn(c)) { var r2 = mergeSt(realMove(c, axis === 'v' ? 4 : 2), realMove(c, axis === 'v' ? 8 : 6)); if (r2) return r2; }
    var p = ph(node);
    return axis === 'v' ? p.ns : p.ew;
  }
  // 보호 좌회전 신호(좌회전 화살표). 그 축에 좌회전 현시가 없으면(좁은 도로) 직진과 같다 — 직좌 동시.
  function leftState(node, axis) {
    var c = ctrl[keyOf(node)];
    if (realOn(c)) { var r3 = mergeSt(realMove(c, axis === 'v' ? 7 : 5), realMove(c, axis === 'v' ? 3 : 1)); if (r3) return r3; }
    var p = ph(node); return axis === 'v' ? p.lv : p.lh;
  }
  // crossAxis: 건너는 도로의 축. 'v' 도로를 건넌다 = x 방향으로 걷는다 = 동서 차량 녹색 초반
  function pedWalk(node, crossAxis) {
    var rq = realPedInfo(node, crossAxis); if (rq) return rq.walk;
    var p = ph(node);
    var W = pedTime(node, crossAxis);
    if (crossAxis === 'v') return p.ew.s === 'green' && p.ew.elapsed < W;
    return p.ns.s === 'green' && p.ns.elapsed < W;
  }
  // 보행 신호 잔여 시간: 녹색이면 남은 보행 시간, 적색이면 다음 보행 신호까지 남은 시간(초)
  function pedRemain(node, crossAxis) {
    var rq = realPedInfo(node, crossAxis); if (rq) return rq.remain;
    var c = ctrl[keyOf(node)], p = ph(node), s = crossAxis === 'v' ? p.ew : p.ns, start = crossAxis === 'v' ? p.Hv : 0;
    var W = pedTime(node, crossAxis);
    if (s.s === 'green' && s.elapsed < W) return W - s.elapsed;
    var until = start - p.t; while (until <= 0) until += p.cycle;
    return until;
  }
  // 보행 녹색의 **점멸 토막** 길이: 횡단 거리에 비례(실측 현시도 비율), 고정 녹색은 적어도 PED_STEADY_MIN 초 남긴다.
  function flashTime(node, crossAxis) {
    var len = 2 * city.halfOf(crossAxis, crossAxis === 'v' ? node.i : node.j), W = pedTime(node, crossAxis);
    return Math.max(3, Math.min((cfg.PED_FLASH_K || 0.76) * len, W - (cfg.PED_STEADY_MIN || 6)));
  }
  // 지금 녹색 점멸인가 — 점멸에는 횡단을 **시작할 수 없다**(시행규칙 별표2). 건너는 중이면 신속히 마친다.
  function pedFlash(node, crossAxis) {
    var rq = realPedInfo(node, crossAxis);
    if (rq) return rq.walk && rq.remain <= Math.min(flashTime(node, crossAxis), Math.max(3, rq.W - (cfg.PED_STEADY_MIN || 6)));   // 실측 현시: 보행 창이 짧으면 점멸도 그 안에서
    return pedWalk(node, crossAxis) && pedRemain(node, crossAxis) <= flashTime(node, crossAxis);
  }
  // ---- 보행 시간 연장 ----
  // 아직 횡단보도 위에 사람이 있는데 초록불이 꺼지면, 뛰라는 말이 된다(소유자 신고).
  // 그 동안 시간을 멈춰 초록불을 붙잡는다 — 실제 스마트 횡단보도와 같은 생각이다.
  // 무한정은 안 된다: 한 번의 보행 신호에서 **최대 PED_EXTEND_MAX 초**까지만 늘린다.
  var hold = {};
  function holdPed(node, crossAxis) {
    var k = keyOf(node), h = hold[k] = hold[k] || { used: 0, ax: crossAxis, t: 0 };
    if (h.ax !== crossAxis) { h.ax = crossAxis; h.used = 0; }
    h.t = 0.4;   // 이 호출이 끊기면(다 건넜다) 0.4초 뒤 연장도 끝난다
  }
  function holdTick(c, nd, k, dt) {
    var h = hold[k];
    if (!h) return false;
    if (h.t > 0) h.t -= dt; else { h.used = 0; return false; }
    var walking = pedWalk(nd, h.ax);
    if (!walking) { h.used = 0; return false; }
    var rem = pedRemain(nd, h.ax);
    if (rem > 2.5) { return false; }                       // 아직 여유가 있다 — 연장할 필요 없다
    if (h.used >= (cfg.PED_EXTEND_MAX || 12)) return false; // 한도까지 늘렸다
    h.used += dt;
    return true;                                           // 시간을 멈춘다(초록불 유지)
  }
  function extendInfo(node) { var h = hold[keyOf(node)]; return h ? { used: Math.round(h.used * 10) / 10, ax: h.ax } : null; }

  var blinkT = 0;
  function update(dt) {
    for (var k in ctrl) {
      var c = ctrl[k], kn = k.split(','), nd = city.nodes[+kn[0]][+kn[1]];
      if (holdTick(c, nd, k, dt)) continue;   // 아직 건너는 사람이 있다 — 초록불을 붙잡는다
      if (!c.manual) { c.t += dt; continue; }
      // 수동: 현재 녹색 끝에서 멈춰 유지(요청 없으면 계속 녹색). 요청이 있으면 최소 시간을 채운 뒤 황색·전적색을 거쳐 다음 녹색으로.
      var g = greenNow(nd);
      if (g) {
        // 이미 그 방향이 녹색이면 요청은 이룬 것이다 — 안 지우면 「유지 중」으로 안 보이고 연장 판정도 어긋난다.
        if (c.req === g.axis) c.req = null;
        // 하한은 cfg.PED_WALK(20) 가 아니라 **이 교차로의 실제 최소 녹색**이다(도로 폭으로 정해진 보행 시간을 품는다).
        var needMin = greenMin(nd, g.axis);
        var canLeave = c.req && c.req !== g.axis && g.elapsed >= needMin;
        var atEnd = g.elapsed >= g.dur - 0.05;
        if (atEnd && !canLeave) { c.t = g.at + g.dur - 0.05; continue; }   // 녹색 유지(연장)
        c.t += dt;
      } else {
        c.t += dt;   // 황색·전적색은 그대로 흐른다
        var g2 = greenNow(nd);
        if (g2 && c.req === g2.axis) c.req = null;   // 요청 방향이 녹색이 되면 요청 해제
      }
    }
    blinkT += dt;
    var heads = world.heads;
    for (var i = 0; i < heads.length; i++) {
      var h = heads[i];
      if (h.kind === 'veh') {
        // 머리마다 **자기가 맡은 진행 방향**의 직진·좌회전을 보여 준다(정지선 앞 머리 = 이 접근로로 오는 차 · 건너편 머리 = 맞은편에서 오는 차).
        // 직진+좌회전 녹색 = 녹색+화살표(직좌 동시) · 직진만 = 녹색 · 좌회전만 = 적색+화살표.
        var dT = h.near ? h.d : (h.d + 2) % 4, sS = moveState(h.node, dT, 'S').s, sL = moveState(h.node, dT, 'L').s, key2;
        key2 = sS === 'green' ? (sL === 'green' ? 'green' : 'straight') : sL === 'green' ? 'left' : (sS === 'yellow' || sL === 'yellow') ? 'yellow' : 'red';
        if (h.last !== key2) { h.last = key2; h.mesh.material = mats[key2]; }
      } else {
        var w = pedWalk(h.node, h.axis), key = 'stop', m = pedMats.stop, rem = pedRemain(h.node, h.axis);
        // 녹색: 남은 보행 초(녹색 숫자). **점멸 토막 내내**(횡단 거리에 비례 — v0.9.48, 전 판은 끝 3초) 사람 그림이 깜빡이고 숫자는 남는다.
        // 적색: 다음 녹색까지 남은 대기 초(적색 숫자) — 소유자 제공 사진(용인 수지구 혁신신호등)·홍보담당 지적.
        // 수동 조작 중에는 언제 바뀔지 알 수 없으므로 대기 초를 띄우지 않는다.
        if (w) { if (pedFlash(h.node, h.axis) && (blinkT * 4) % 2 >= 1) { key = 'o' + Math.max(1, Math.ceil(rem)); m = pedMatOff(rem); } else { key = 'w' + Math.max(1, Math.ceil(rem)); m = pedMat(rem); } }
        else if (!ctrl[keyOf(h.node)].manual && Math.ceil(rem) <= 99) { key = 'r' + Math.ceil(rem); m = pedMatWait(rem); }
        if (h.last !== key) { h.last = key; h.mesh.material = m; }
      }
    }
  }
  function force(i, j, t) { ctrl[i + ',' + j].t = t; }
  // 테스트·디버그: 어떤 노드의 축 axis 를 지금 즉시 상태 s 로 만든다
  // s = 'green' | 'yellow' | 'red' | 'left'(그 축의 보호 좌회전 녹색 — 좌회전 현시가 있을 때)
  function set(node, axis, s) {
    var c = ctrl[keyOf(node)];
    if (realOn(c)) {   // 실측 현시: 그 이동류가 켜지는 현시로 옮긴다('red' 는 직각 방향 직진 현시로)
      var rp = c.realPlan, a = null;
      var codes = s === 'left' ? (axis === 'v' ? [7, 3] : [5, 1]) : s === 'red' ? (axis === 'v' ? [2, 6] : [4, 8]) : (axis === 'v' ? [4, 8] : [2, 6]);
      codes.forEach(function (cd) { if (!a && rp.has[cd]) a = rp.iv[cd][0]; });
      if (a) { c.t = s === 'yellow' ? a.s + a.g + 0.5 : a.s + 0.5; return; }
    }
    var Hv = ph(node).Hv, gv = gvOf(node), gh = ghOf(node), t;
    if (axis === 'v') t = s === 'green' ? 0.5 : s === 'yellow' ? gv + 0.5 : s === 'left' ? gv + Y + R + 0.5 : Hv + 0.5;
    else t = s === 'green' ? Hv + 0.5 : s === 'yellow' ? Hv + gh + 0.5 : s === 'left' ? Hv + gh + Y + R + 0.5 : 0.5;
    c.t = t;
  }
  raiseToPedMin();   // 어느 교차로에서도 보행 시간이 차량 녹색에 밀려 줄어들지 않게, 처음부터 녹색을 충분히 준다
  applyCycles();     // 그 위에서 실측 주기까지 녹색을 늘린다(보행 하한은 건드리지 않는다)
  return { state: state, pedWalk: pedWalk, pedRemain: pedRemain, pedTime: pedTime, pedFlash: pedFlash, flashTime: flashTime, update: update, force: force, set: set, CYCLE: CYCLE, phase: ph,
           holdPed: holdPed, extendInfo: extendInfo,
           setManual: setManual, isManual: isManual, request: request, waitFor: waitFor, manualInfo: manualInfo, minGreenOf: function (node) { return ctrl[keyOf(node)].minGreen; },
           greenFor: greenFor, greenMin: greenMin, setGreen: setGreen, greenInfo: greenInfo, cycleOf: cycleOf, cycleInfo: cycleInfo, applyTod: applyTod,
           leftState: leftState, hasLeft: hasLeft, leftExtra: leftExtra,
           moveState: moveState, hasLeftFor: hasLeftFor, applyReal: applyReal, restoreReal: restoreReal, setRealOff: setRealOff, realInfo: realInfo };
};
