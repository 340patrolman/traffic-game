// 지형·교외·순환 고속도로.
//  - 지형: 높이 함수 hBase(x,z) = 구릉 + 산 봉우리 + 동쪽 바다 + 도시 평탄화. 강(river)은 따로 더해 다리 밑을 판다.
//  - 도로(링크): 스플라인 샘플 4m 간격. 종류: ring(순환 고속도로 3차로·1차로 버스전용, 닫힌 고리) / connE(도시 동쪽 출구 ↔ 링 동쪽, 교외 굽은 길)
//    / connN(도시 북쪽 출구 ↔ 링 북쪽, 진입로) / 램프 4개(각 접속부 진입·진출, 일방통행). 램프는 우회전으로만 이어져 평면 교차가 없다.
//  - 방향 A = 샘플 증가 방향. 링 A 는 시계 방향(안쪽 차로), B 는 바깥 차로. 접속부는 A 방향에만 붙는다(한 번 올라타면 계속 돈다).
TG.buildTerrain = function (scene, city, cfg) {
  var STEP = cfg.LINK_STEP;
  function hash(ix, iz) { var n = (ix * 374761393 + iz * 668265263) | 0; n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967295; }
  function sm(t) { return t * t * (3 - 2 * t); }
  function noise(x, z) {
    var ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz;
    var a = hash(ix, iz), b = hash(ix + 1, iz), c = hash(ix, iz + 1), d = hash(ix + 1, iz + 1), u = sm(fx), v = sm(fz);
    return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
  }
  function fbm(x, z) { return noise(x, z) * 0.6 + noise(x * 2.1 + 7, z * 2.1 + 3) * 0.28 + noise(x * 4.3 + 1, z * 4.3 + 9) * 0.12; }
  function sstep(a, b, x) { var t = TG.clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }

  var PEAKS = [[-250, -720, 190, 320], [420, -880, 230, 360], [1050, -600, 170, 300], [-700, -100, 170, 300], [-680, 520, 130, 240],
               [300, 1000, 170, 300], [950, 950, 140, 260], [-350, 950, 120, 240], [1200, 300, 90, 200]];
  function shoreX(z) { return 830 + 40 * Math.sin(z / 170); }
  function hBase(x, z) {
    var h = fbm(x / 260, z / 260) * 11 - 3;
    var m = 0;
    for (var i = 0; i < PEAKS.length; i++) { var p = PEAKS[i], dx = (x - p[0]) / p[3], dz = (z - p[1]) / p[3]; m += p[2] * Math.exp(-(dx * dx + dz * dz) * 1.6); }
    h += m * (0.85 + 0.3 * fbm(x / 90, z / 90));
    var ts = sstep(shoreX(z) - 70, shoreX(z) + 40, x);
    h = h * (1 - ts) + (-6) * ts;
    var ddx = Math.max(-70 - x, x - 390, 0), ddz = Math.max(-70 - z, z - 390, 0);
    h *= sstep(0, 90, Math.hypot(ddx, ddz));
    return h * sstep(52, 130, Math.abs(z - riverZ(x)));   // 한강 둔치: 강 양옆 52m 는 평지, 130m 까지 완만히 언덕으로
  }
  // 한강(축약): 도시 북쪽을 동서로 흐른다. **반포대교(반포대로) · 한남대교(강남대로) · 동작대교(동작대로)**
  // 세 다리가 건너고, 건너면 올림픽대로(링 북쪽 호)에 붙어 순환도로로 이어진다 — 길이 끝나지 않는다(소유자 설계).
  function riverZ(x) { return -112 + 18 * Math.sin(x / 230 + 0.6); }   // 도시(z 0) 와 올림픽대로(z 약 -245) 사이
  function riverX(z) { return 99999; }
  // 양재천(축약): 도시 남쪽(남부순환로 아래)을 동서로 흐르는 얕은 하천. 경부고속도로·양재IC·수서IC 연결로가 다리로 건넌다. 비가 오면 setFlood 로 수위가 올라 산책로가 잠긴다.
  function yjZ(x) { return 356 + 5 * Math.sin(x / 120); }
  function river(x, z) {
    var d = Math.abs(z - riverZ(x)), rv = -4.6 * (1 - sstep(44, 62, d));   // 한강: 반폭 44m(가장자리 62m) — 전 24/34
    var d2 = Math.abs(z - yjZ(x)); rv += -2.8 * (1 - sstep(11, 17, d2)) * sstep(-90, -50, x) * (1 - sstep(390, 430, x));   // 양재천: 반폭 11m(가장자리 17m)
    return rv;
  }
  var flood = false;   // 강우 침수(수위 +1.2m): 양재천 산책로·한강 둔치가 물에 잠기고 잠수교가 통제된다

  // ---------- 링크 빌더 ----------
  var links = [], walls = [];
  function cr(p0, p1, p2, p3, t) { var t2 = t * t, t3 = t2 * t; return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3); }
  // CP: 제어점 배열. closed 면 고리. kind: 'highway'|'suburb'|'ramp'|'onramp'|'offramp'
  function buildLink(id, CP, kind, closed) {
    var fine = [], n = CP.length;
    function at(i) { return closed ? CP[((i % n) + n) % n] : CP[TG.clamp(i, 0, n - 1)]; }
    var segs = closed ? n : n - 1;
    for (var i = 0; i < segs; i++) for (var k = 0; k < 24; k++) {
      var t = k / 24, a = at(i - 1), b = at(i), c = at(i + 1), d = at(i + 2);
      fine.push([cr(a[0], b[0], c[0], d[0], t), cr(a[1], b[1], c[1], d[1], t)]);
    }
    if (!closed) fine.push([CP[n - 1][0], CP[n - 1][1]]); else fine.push([CP[0][0], CP[0][1]]);
    var pts = [], acc = 0, s = 0;
    pts.push({ x: fine[0][0], z: fine[0][1], s: 0 });
    for (var j = 1; j < fine.length; j++) {
      var dx = fine[j][0] - fine[j - 1][0], dz = fine[j][1] - fine[j - 1][1], dd = Math.hypot(dx, dz), from = 0;
      while (dd > 0 && acc + (dd - from) >= STEP) {
        var need = STEP - acc, u = (from + need) / dd;
        s += STEP; pts.push({ x: fine[j - 1][0] + dx * u, z: fine[j - 1][1] + dz * u, s: s }); from += need; acc = 0;
      }
      acc += dd - from;
    }
    if (closed && Math.hypot(pts[pts.length - 1].x - pts[0].x, pts[pts.length - 1].z - pts[0].z) < STEP * 0.6) pts.pop();
    var N = pts.length;
    function P(i) { return closed ? pts[((i % N) + N) % N] : pts[TG.clamp(i, 0, N - 1)]; }
    for (var q = 0; q < N; q++) {
      var a2 = P(q - 1), b2 = P(q + 1), tx = b2.x - a2.x, tz = b2.z - a2.z, tl = Math.hypot(tx, tz) || 1;
      pts[q].tx = tx / tl; pts[q].tz = tz / tl; pts[q].rx = -tz / tl; pts[q].rz = tx / tl; pts[q].hb = hBase(pts[q].x, pts[q].z);
    }
    for (var pass = 0; pass < 3; pass++) {
      var out = [];
      for (var q2 = 0; q2 < N; q2++) { var sum = 0; for (var w = -6; w <= 6; w++) sum += P(q2 + w).hb; out.push(sum / 13); }
      for (var q3 = 0; q3 < N; q3++) pts[q3].hb = out[q3];
    }
    var isHW = kind === 'highway';
    for (var q4 = 0; q4 < N; q4++) {
      var p = pts[q4];
      // 다리 판정은 **물 판정과 같은 기준**으로 한다. 전에는 river < -1.2 만 봐서,
      // 강을 넓히자 물에는 잠기는데 다리로는 잡히지 않는 구간이 18곳 생겼다(도로가 물에 빠진다).
      p.y = Math.max(0, p.hb); p.bridge = (hBase(p.x, p.z) + river(p.x, p.z)) < -0.7; p.kind = kind; p.f = isHW ? 1 : 0;
      p.half = isHW ? cfg.HW_HALF : (kind === 'onramp' || kind === 'offramp') ? 5.8 : kind === 'circuit' ? 7.5 : cfg.ROAD_HALF;
      var p0 = P(q4 - 2), p1 = P(q4 + 2);
      p.kappa = Math.abs(TG.wrapAngle(Math.atan2(p1.tx, p1.tz) - Math.atan2(p0.tx, p0.tz))) / (4 * STEP);
      p.link = null; p.i = q4;
    }
    var link = { id: id, pts: pts, N: N, closed: closed, kind: kind, oneWay: kind === 'onramp' || kind === 'offramp', total: pts[N - 1].s,
                 exitsA: [], exitsB: [], nextA: null, nextB: null, prevA: null, prevB: null, P: P };
    for (var q5 = 0; q5 < N; q5++) pts[q5].link = link;
    links.push(link);
    return link;
  }

  // ---------- 순환 고속도로(타원) + 연결로 + 램프 ----------
  var CXC = 160, CZC = 160, RA = 440, RB = 420;
  var ringCP = [];
  for (var th = 0; th < 40; th++) { var ang = th / 40 * Math.PI * 2; ringCP.push([CXC + RA * Math.cos(ang) + Math.sin(ang * 3) * 12, CZC + RB * Math.sin(ang) + Math.cos(ang * 2) * 10]); }
  var ring = buildLink('ring', ringCP, 'highway', true);
  // 링 위 접속점: 동쪽(θ≈0) / 북쪽(θ≈-90°)
  function ringIndexNear(x, z) { var best = 0, bd = 1e9; for (var i = 0; i < ring.N; i++) { var d = Math.hypot(ring.pts[i].x - x, ring.pts[i].z - z); if (d < bd) { bd = d; best = i; } } return best; }
  var jE = ringIndexNear(CXC + RA, CZC), jN = ringIndexNear(CXC, CZC - RB);
  var JE = ring.pts[jE], JN = ring.pts[jN];
  // ---------- 인터체인지 8곳: 도시 스텁 8개 → 연결로 → 링(우회전 합류 on / 우회전 진출 off) ----------
  function trimLink(link, start, end) {
    var a = 0, b = link.N - 1, ba = 1e9, bb = 1e9;
    for (var i = 0; i < link.N; i++) { var da = Math.hypot(link.pts[i].x - start[0], link.pts[i].z - start[1]); if (da < ba) { ba = da; a = i; } var db = Math.hypot(link.pts[i].x - end[0], link.pts[i].z - end[1]); if (db < bb) { bb = db; b = i; } }
    link.pts = link.pts.slice(a, b + 1); link.N = link.pts.length;
    // 스플라인이 제자리에서 되돌아 꺾이는 점(앞 점과 STEP 의 60% 미만)은 버린다.
    // 남으면 그 자리에서 노면 사각형이 뒤집혀 **도로가 끊긴 것처럼** 보이고 차가 튕긴다(한남대교 연결로 1곳).
    var keep = [link.pts[0]];
    for (var m = 1; m < link.N; m++) {
      var pv = keep[keep.length - 1], cu = link.pts[m];
      if (m < link.N - 1 && Math.hypot(cu.x - pv.x, cu.z - pv.z) < STEP * 0.6) continue;
      keep.push(cu);
    }
    if (keep.length !== link.N) {   // 버린 점이 있으면 거리·접선을 실제 좌표로 다시 낸다
      link.pts = keep; link.N = keep.length;
      link.pts[0].s = 0;
      for (m = 1; m < link.N; m++) link.pts[m].s = link.pts[m - 1].s + Math.hypot(link.pts[m].x - link.pts[m - 1].x, link.pts[m].z - link.pts[m - 1].z);
      for (m = 0; m < link.N; m++) {
        var A2 = link.pts[Math.max(0, m - 1)], B2 = link.pts[Math.min(link.N - 1, m + 1)];
        var tx2 = B2.x - A2.x, tz2 = B2.z - A2.z, tl2 = Math.hypot(tx2, tz2) || 1;
        link.pts[m].tx = tx2 / tl2; link.pts[m].tz = tz2 / tl2; link.pts[m].rx = -tz2 / tl2; link.pts[m].rz = tx2 / tl2;
      }
    }
    var s0 = link.pts[0].s;   // 기준을 먼저 떠 둔다 — 루프 안에서 pts[0].s 를 읽으면 첫 번째만 0 이 되고 나머지는 그대로 남는다(오래된 버그)
    for (var k = 0; k < link.N; k++) { link.pts[k].i = k; link.pts[k].s -= s0; }
    link.P = function (i) { return link.pts[TG.clamp(i, 0, link.N - 1)]; };
    link.total = link.pts[link.N - 1].s;
  }
  // 램프: 연결로 A 끝(도시→링) → 링 A 바깥 차로 로 우회전 합류 / 링 A → 연결로 B 로 우회전 진출
  // 링 위의 가장 가까운 점(높이·거리) — 램프 노면을 본선에 맞출 때 쓴다
  function ringNear(x, z) {
    var k = ringIndexNear(x, z), b = null, bd = 1e9;
    for (var d = -3; d <= 3; d++) { var p = ring.P(k + d), dd = Math.hypot(p.x - x, p.z - z); if (dd < bd) { bd = dd; b = p; } }
    return { p: b, d: bd, y: b.y };
  }
  // 램프의 한쪽 끝을 상대 도로 폭까지 넓힌다 — 왕복 8차로(반폭 17m)가 반폭 5.8m 램프로 갑자기 좁아져
  // 이음부 양쪽에 맨땅이 드러나고 차가 포장 밖으로 나갔다(소유자: 「차들이 도로가 아닌 맨땅을 달리고 있어」).
  // 종단 꺾임 완화(양 끝은 고정) — 기울기 구간과 본선 높이 구간이 만나는 자리를 매끄럽게 잇는다
  function smoothY(link) {
    for (var pass = 0; pass < 3; pass++) {
      var out = [];
      for (var i = 0; i < link.N; i++) {
        if (i === 0 || i === link.N - 1) { out.push(link.pts[i].y); continue; }
        var a = link.pts[Math.max(0, i - 2)].y, b = link.pts[i - 1].y, c = link.pts[i].y;
        var d = link.pts[i + 1].y, e = link.pts[Math.min(link.N - 1, i + 2)].y;
        out.push((a + b * 2 + c * 3 + d * 2 + e) / 9);
      }
      for (var k = 0; k < link.N; k++) link.pts[k].y = out[k];
    }
  }
  function taperHalf(link, atStart, wide, len) {
    var TL = len || 44;
    for (var i = 0; i < link.N; i++) {
      var p = link.pts[i], d = atStart ? p.s : (link.total - p.s);
      if (d >= TL) continue;
      var t = d / TL, w = wide * (1 - t) + p.half * t;
      if (w > p.half) p.half = w;
    }
  }
  function ramps(conn, j, tag, split) {
    var J = ring.pts[j];
    var E = conn.pts[conn.N - 1];                            // 연결로의 실제 끝(분기점). 램프는 반드시 이 점에서 시작하고 끝난다
    var tc = [E.tx, E.tz], rc = [-tc[1], tc[0]];
    var LO = cfg.HW_LANES[cfg.HW_LANES.length - 1];
    var SP = Math.max(30, (J.x - E.x) * tc[0] + (J.z - E.z) * tc[1]);   // 분기점 → 링 접속점 실측 거리
    var tR = [J.tx, J.tz];                                   // 링 진행 방향(접선)
    var Rf = Math.max(34, SP - LO);                          // 원호 반지름
    // 원호: 분기점 E(방향 tc)에서 링 방향 sgn·tR 으로 90° 돈다. 진입·진출 램프가 같은 점에서 갈라진다.
    function arc(sgn) {
      var T = [E.x, E.z];
      var C = [T[0] + tR[0] * sgn * Rf, T[1] + tR[1] * sgn * Rf], out = [];
      for (var k = 0; k <= 4; k++) {
        var th = (k / 4) * Math.PI / 2, cs = Math.cos(th), sn = Math.sin(th);
        out.push([C[0] - tR[0] * sgn * Rf * cs + tc[0] * Rf * sn, C[1] - tR[1] * sgn * Rf * cs + tc[1] * Rf * sn]);
      }
      return out;
    }
    // 원호 끝을 「링 바깥 차로선 위의 실제 점」으로 바꿔 붙인다 — 링이 휘어 있어 계산값과 어긋나면 그 자리에서 꺾인다.
    function ringLane(k) { var p = ring.P(k); return [p.x + p.rx * LO, p.z + p.rz * LO]; }
    // 진입 램프: 분기점 → 원호 → 링과 나란히(가속차로) → 합류
    var aOn = arc(1), Ton = aOn[0];
    var jOn = ringIndexNear(aOn[4][0], aOn[4][1]); aOn[4] = ringLane(jOn);
    var onCP = [[Ton[0] - tc[0] * 34, Ton[1] - tc[1] * 34]].concat(aOn)
      .concat([ringLane(jOn + 6), ringLane(jOn + 14), ringLane(jOn + 22), ringLane(jOn + 28)]);
    var on = buildLink('on' + tag, onCP, 'onramp', false);
    trimLink(on, [Ton[0] - tc[0] * 2.5, Ton[1] - tc[1] * 2.5], ringLane(jOn + 22));   // 분기점보다 2.5m 뒤에서 시작해 연결로 포장과 겹치게 한다(틈 방지)
    // 진출 램프: 링(감속차로) → 원호 → 분기점
    var aOff = arc(-1), Toff = aOff[0];
    var jOff = ringIndexNear(aOff[4][0], aOff[4][1]); aOff[4] = ringLane(jOff);
    var aRev = aOff.slice().reverse();
    var offCP = [ringLane(jOff - 28), ringLane(jOff - 22), ringLane(jOff - 14), ringLane(jOff - 6)]
      .concat(aRev).concat([[Toff[0] - tc[0] * 34, Toff[1] - tc[1] * 34]]);
    var off = buildLink('off' + tag, offCP, 'offramp', false);
    trimLink(off, ringLane(jOff - 22), [Toff[0] - tc[0] * 2.5, Toff[1] - tc[1] * 2.5]);
    on.mergeFrom = 0.55; off.mergeFrom = -1;                 // 안쪽 선을 점선으로 바꾸는 지점(합류·분기 구간)
    // 노면 높이 이음: 링 포장 안에 드는 구간은 링 높이 그대로, 나머지는 분기점 높이까지 일정 기울기로 잇는다.
    // 전에는 링크마다 지형을 따로 완만화해 합류부에 1~2.4m 턱이 있었다(소유자: 「매끈하게 연결되어야 하는데 턱이 있고」).
    var HH = cfg.HW_HALF + 2.5, y0 = E.y + 0.02, i, q;
    var iR = on.N;
    for (i = 0; i < on.N; i++) { q = ringNear(on.pts[i].x, on.pts[i].z); if (q.d <= HH) { if (iR === on.N) iR = i; on.pts[i].y = q.y; } }
    if (iR > 0) { var y1 = on.pts[Math.min(iR, on.N - 1)].y, s1 = Math.max(1e-3, on.pts[Math.min(iR, on.N - 1)].s);
      for (i = 0; i < Math.min(iR, on.N); i++) on.pts[i].y = y0 + (y1 - y0) * (on.pts[i].s / s1); }
    var iC = -1;
    for (i = 0; i < off.N; i++) { q = ringNear(off.pts[i].x, off.pts[i].z); if (q.d <= HH) { iC = i; off.pts[i].y = q.y; } }
    var i0 = Math.max(iC, 0), yA = off.pts[i0].y, sA = off.pts[i0].s, sT = Math.max(1e-3, off.total - sA);
    for (i = i0 + 1; i < off.N; i++) off.pts[i].y = yA + (y0 - yA) * ((off.pts[i].s - sA) / sT);
    smoothY(on); smoothY(off);
    taperHalf(on, true, E.half, Math.min(90, on.total * 0.45)); taperHalf(off, false, E.half, Math.min(90, off.total * 0.45));   // 램프 ↔ 연결로: 급하게 좁아지지 않도록 길게 줄인다
    conn.splitEnd = true;          // 끝이 램프 분기점이다(난간을 세우지 않는 구간)
    var connEndIdx = conn.N - 1;   // 연결로 끝 = 램프 분기점
    conn.nextA = { link: on, index: 0, lane: 0, joinIndex: connEndIdx };
    on.nextA = { link: ring, index: ((jOn + 22) % ring.N + ring.N) % ring.N, merge: true };
    ring.exitsA.push({ atIndex: ((jOff - 22) % ring.N + ring.N) % ring.N, decideIndex: ((jOff - 46) % ring.N + ring.N) % ring.N, link: off });
    off.nextA = { link: conn, index: connEndIdx, dirA: false };
    // 분기점 너머는 램프·링 지형이 이어져(heightAt 이 링 높이로 올라감) 직진해도 빠지지 않는다 — 차단벽 없음
    return { on: on, off: off };
  }
  // IC 정의: 도시 노드 + 나가는 방향 + 링 각도(θ, x=cos·z=sin). 연결로 끝은 링 접속점 15m 안쪽에서 방사 방향으로 닿는다.
  var ICS = [
    { tag: 'E',  node: [4, 2], dir: 1, th: 0,    kind: 'suburb', via: [[420, 150], [455, 176]] },
    { tag: 'N',  node: [2, 0], dir: 2, th: -90,  kind: 'ramp',   via: [[162, -80], [150, -140], [158, -200]] },
    { tag: 'S',  node: [2, 4], dir: 0, th: 90,   kind: 'highway', via: [[150, 405], [172, 440]] },   // 경부고속도로: 편도 3차로 + 1차로 버스전용(다인승)
    { tag: 'W',  node: [0, 2], dir: 3, th: 180,  kind: 'suburb', via: [[-100, 150], [-140, 172]] },
    { tag: 'NE', node: [4, 0], dir: 2, th: -45,  kind: 'suburb', via: [[330, -60], [380, -100]] },
    { tag: 'NW', node: [0, 0], dir: 2, th: -135, kind: 'suburb', via: [[-10, -60], [-70, -100]] },
    { tag: 'SE', node: [4, 4], dir: 0, th: 45,   kind: 'suburb', via: [[330, 380], [380, 420]] },
    { tag: 'SW', node: [0, 4], dir: 0, th: 135,  kind: 'suburb', via: [[-10, 380], [-70, 420]] },
  ];
  var conns = [], ramps_ = {};
  ICS.forEach(function (ic) {
    var node = city.nodes[ic.node[0]][ic.node[1]], dv = TG.DIR_VEC[ic.dir], half = city.crossHalf(node, ic.dir);   // 도로 폭에 맞춰 교차로 상자 밖에서 시작(고정값이면 넓은 도로에서 연결부가 꺾였다)
    var start = [node.x + dv[0] * city.EXT, node.z + dv[1] * city.EXT];   // 스텁 끝 = 연결로 시작(city.EXT 로 통일해 정확히 맞물린다)
    var a = ic.th * Math.PI / 180, j = ringIndexNear(CXC + RA * Math.cos(a), CZC + RB * Math.sin(a)), J = ring.pts[j];
    var rad = [J.x - CXC, J.z - CZC], rl = Math.hypot(rad[0], rad[1]) || 1; rad = [rad[0] / rl, rad[1] / rl];
    var end = [J.x - rad[0] * 15, J.z - rad[1] * 15];
    // 도시에서 곧게 나가는 길이는 첫 경유점까지 거리의 절반까지만(고정 45m 면 경유점을 지나쳐 스플라인이 꺾인다 — 차가 튕겨 나가던 원인)
    var v0 = ic.via[0], run = Math.min(45, Math.max(12, Math.hypot(v0[0] - start[0], v0[1] - start[1]) * 0.45));
    var CP = [[start[0] - dv[0] * 30, start[1] - dv[1] * 30], start, [start[0] + dv[0] * run, start[1] + dv[1] * run]].concat(ic.via).concat([[end[0] - rad[0] * 50, end[1] - rad[1] * 50], end, [end[0] + rad[0] * 30, end[1] + rad[1] * 30]]);
    var conn = buildLink('conn' + ic.tag, CP, ic.kind, false);
    trimLink(conn, [start[0] - dv[0] * 4, start[1] - dv[1] * 4], end);   // 도시 스텁 포장과 4m 겹치게 시작한다(사이에 잔디가 보였다)
    // 램프 분기점은 **다리 위에 두지 않는다**. 한남대교 연결로는 링 접속점에서 56m 뒤가 한강 한복판이어서
    // 분기점과 두 램프가 강 위에 조각조각 떠 있었다(소유자: 「도로가 또 끊어져 있음 · 연결성이 매우 중요함에도」).
    // 링에서 멀어지는 쪽으로 물러나며 물 위가 아닌 첫 지점을 분기점으로 삼는다 — 강은 램프가 아니라 **연결로 본선**이 건넌다.
    var Ept = conn.pts[conn.N - 1], SPLIT = 56;
    for (var sp = 56; sp <= 136; sp += 6) { SPLIT = sp; if (river(J.x - Ept.tx * sp, J.z - Ept.tz * sp) > -1.2) break; }
    var split = [J.x - Ept.tx * SPLIT, J.z - Ept.tz * SPLIT];   // 90° 원호(반경 약 59m)가 들어갈 만큼 링에서 떨어뜨린다
    trimLink(conn, [start[0] - dv[0] * 4, start[1] - dv[1] * 4], split);
    var cAx = city.axisOfDir(ic.dir), cIdx = cAx === 'v' ? ic.node[0] : ic.node[1];
    taperHalf(conn, true, city.halfOf(cAx, cIdx), 90);   // 도시 도로 폭에서 연결로 폭으로 점차 줄인다
    conn.cityStart = { node: node, dir: ic.dir };
    conn.cityEnd = { node: node, dir: (ic.dir + 2) % 4 };
    conn.ic = ic.tag;
    ramps_[ic.tag] = ramps(conn, j, ic.tag, 56);
    conns.push(conn);
  });
  var connE = conns[0], connN = conns[1], rE = ramps_.E, rN = ramps_.N;
  // 도로명·제한속도(축약 서초구): 남쪽 연결로 = 경부고속도로(100), 북쪽 = 반포대로·반포대교(80), 서쪽 = 서초대로 연장(60), 동쪽 = 서초대로 연장·테헤란로 방향(60). 링 북쪽 호는 올림픽대로(80, frameAt).
  // 서울 구간 왕복 8차로 + 1차로 버스전용(다인승). 올림픽대로·순환고속도로에는 버스전용차로가 없다
  conns[2].name = '경부고속도로'; conns[2].limit = 100; conns[2].busLane = true;
  conns[1].name = '반포대로 · 반포대교'; conns[1].limit = 80;
  conns[5].name = '동작대로 · 동작대교'; conns[5].limit = 80;
  conns[3].name = '서초대로 연장 · 사당 방향'; conns[0].name = '서초대로 연장 · 테헤란로 방향';
  conns[4].name = '강남대로 · 한남대교'; conns[4].limit = 80;   // 강남대로 북단 = 한남대교(소유자 지시: 다리 둘은 반포대교·한남대교)
  conns[6].name = '강남대로 연장 · 도곡 방향'; conns[7].name = '동작대로 연장 · 남태령 방향';
  // 연습 서킷(도시 동쪽 해안 평지, 링 바깥): 긴 직선 → 헤어핀 → S 커브 → 스위퍼. 교통 없음. AI 는 오지 않는다(연결 없음).
  // 전에는 x 180~318 · z 400~536 에 있어서 **경부고속도로 연결로와 양재IC 램프를 22m 파고들었다** —
  // 고속도로 옆에 적·백 코너 연석과 서킷 노면이 겹쳐 보였고, frameAt 이 고속도로 위를 「연습 서킷(반폭 7.5m) 밖」으로
  // 잡아 도로 위인데 도로 밖으로 판정됐다(소유자: 「차들이 도로에 반쯤 들어가서 달리고 있음」).
  // x 를 460m 동쪽으로 옮겨 가장 가까운 도로 끝에서 56m, 고저차 1.5m 의 평지에 놓았다.
  var circuit = buildLink('circuit', [[660, 400], [760, 400], [778, 428], [752, 456], [715, 455], [698, 486], [726, 514], [702, 536], [660, 532], [644, 502], [656, 470], [640, 436]], 'circuit', true);

  // ---------- 공간 해시(모든 링크) ----------
  var CELL = 24, grid = {};
  links.forEach(function (L) { for (var q = 0; q < L.N; q++) { var key = Math.floor(L.pts[q].x / CELL) + ',' + Math.floor(L.pts[q].z / CELL); (grid[key] = grid[key] || []).push(L.pts[q]); } });
  // 가장 가까운 링크 지점. 램프는 링·연결로보다 우선순위가 낮다(겹치는 곳에서 본선 기준).
  // lowest: 지형을 깎을 때 쓰는 모드. 겹치는 도로가 있으면 **가장 낮은 노면**을 기준으로 삼는다.
  // (고가 연결로가 순환고속도로 위를 지나가는 곳에서 지형이 고가 높이까지 올라와 본선을 파묻던 원인)
  function nearest(x, z, allowRamp, lowest) {
    var cx = Math.floor(x / CELL), cz = Math.floor(z / CELL), best = null, bd = 1e9, low = null;
    for (var ox = -1; ox <= 1; ox++) for (var oz = -1; oz <= 1; oz++) {
      var list = grid[(cx + ox) + ',' + (cz + oz)]; if (!list) continue;
      for (var m = 0; m < list.length; m++) {
        var p = list[m], d2 = (p.x - x) * (p.x - x) + (p.z - z) * (p.z - z);
        if (allowRamp === 'no') { if (p.link.oneWay) continue; }        // 본선만 본다
        else if (!allowRamp && p.link.oneWay) d2 += 36;   // 램프는 6m 페널티
        if (d2 < bd) { bd = d2; best = p; }
        if (lowest) {                                 // 노면 폭 안에 드는 후보 중 가장 낮은 것
          var lat = (x - p.x) * p.rx + (z - p.z) * p.rz, alo = (x - p.x) * p.tx + (z - p.z) * p.tz;
          if (Math.abs(lat) <= p.half + 4 && Math.abs(alo) <= 6 && (!low || p.y < low.y)) low = p;
        }
      }
    }
    if (lowest && low && best !== low && low.y < best.y - 0.05) best = low;   // 아래를 지나는 도로가 있으면 그것을 기준으로
    if (!best) return null;
    var L = best.link, i = best.i, br = null, brd = 1e9;
    for (var sgn = -1; sgn <= 0; sgn++) {
      var i0 = i + sgn, i1 = i0 + 1;
      if (!L.closed && (i0 < 0 || i1 >= L.N)) continue;
      var A = L.P(i0), B = L.P(i1), vx = B.x - A.x, vz = B.z - A.z, L2 = vx * vx + vz * vz || 1;
      var tt = TG.clamp(((x - A.x) * vx + (z - A.z) * vz) / L2, 0, 1);
      var px = A.x + vx * tt, pz = A.z + vz * tt, dd = Math.hypot(x - px, z - pz);
      if (dd < brd) { brd = dd; br = { link: L, i: tt < 0.5 ? A.i : B.i, p: tt < 0.5 ? A : B, x: px, z: pz, y: A.y + (B.y - A.y) * tt, tx: A.tx, tz: A.tz }; }
    }
    if (!br) br = { link: L, i: i, p: best, x: best.x, z: best.z, y: best.y, tx: best.tx, tz: best.tz };
    br.lateral = (x - br.x) * (-br.tz) + (z - br.z) * br.tx;
    br.dist = Math.abs(br.lateral);
    return br;
  }
  // 도로마다 가장 가까운 한 점씩 모은다(같은 링크의 여러 점이 중복해서 끌어당기지 않게)
  function roadCands(x, z) {
    var cx = Math.floor(x / CELL), cz = Math.floor(z / CELL), by = {}, out = [];
    for (var ox = -1; ox <= 1; ox++) for (var oz = -1; oz <= 1; oz++) {
      var list = grid[(cx + ox) + ',' + (cz + oz)]; if (!list) continue;
      for (var m = 0; m < list.length; m++) {
        var p = list[m], d = Math.hypot(p.x - x, p.z - z);
        if (d > 40) continue;
        var k = p.link.id, cur = by[k];
        if (!cur || d < cur.dist) by[k] = { p: p, dist: d, y: p.y, half: p.half };
      }
    }
    for (var k2 in by) out.push(by[k2]);
    return out;
  }
  // 어느 노면이든 **하나라도** 그 폭 안이면 도로 위다. `nearest` 한 점만 보면 IC 합류부에서
  // 폭 좁은 램프가 본선보다 가까워 본선 바깥 차로가 「도로 밖」으로 잡힌다(실측 73곳 — 그립이 0.72 로 떨어지고
  // HUD 에 도로 밖으로 표시돼 소유자가 「길이 끊겼다」로 느낀 자리다).
  function onDeck(x, z) {
    var cs = roadCands(x, z);
    for (var i = 0; i < cs.length; i++) if (cs[i].dist <= cs[i].half) return true;
    return false;
  }
  function groundAt(x, z) {
    var rv = river(x, z), h = hBase(x, z) + rv;
    var cs = roadCands(x, z);
    if (!cs.length) return h;
    // 가장 낮은 노면을 기준으로, **그보다 4m 안쪽에 있는 노면들만** 함께 본다.
    // 4m 이상 높은 것은 고가(위로 지나가는 길)이므로 지형을 끌어올리지 않는다 — 본선이 흙에 묻히던 원인(v0.9.2).
    var lo = 1e9, near = null, nd = 1e9, m2;
    for (m2 = 0; m2 < cs.length; m2++) { if (cs[m2].y < lo) lo = cs[m2].y; if (cs[m2].dist < nd) { nd = cs[m2].dist; near = cs[m2]; } }
    var sw = 0, sy = 0, tmax = 0, nearLow = null, nld = 1e9, deckCap = null;
    for (m2 = 0; m2 < cs.length; m2++) {
      var c = cs[m2]; if (c.y > lo + 4) continue;
      if (c.dist < nld) { nld = c.dist; nearLow = c; }
      if (c.dist <= c.half + 0.5 && (deckCap === null || c.y - 0.12 < deckCap)) deckCap = c.y - 0.12;   // 이 자리를 덮는 노면
      var t = 1 - sstep(c.half + 4, 36, c.dist); if (t <= 0) continue;
      // 거리 가중 평균: 나란히 가는 램프와 본선 사이에서 **절벽 대신 성토 사면**이 생긴다
      var w = t * t / Math.max(1.2, c.dist);
      sw += w; sy += w * (c.y - 0.12); if (t > tmax) tmax = t;
    }
    if (sw <= 0) return h;
    var target = sy / sw;
    // 내가 딛고 선 노면보다 지형이 높아지지 않게 눌러 둔다 — 이걸 빼면 경사로 옆에서 지형이 노면 위로 올라와
    // 차가 흙벽에 걸려 전진도 후진도 못 한다(실측 노면보다 0.45m 위였다).
    if (nearLow) target = Math.min(target, nearLow.y - 0.12);
    if (deckCap !== null) target = Math.min(target, deckCap);   // 포장이 덮은 자리는 그 포장 밑으로
    if (rv > -1.0) return h * (1 - tmax) + target * tmax;
    // 강·하천 위: 다리 노면 아래로 꺼지지 않게 한다
    if (near && near.dist <= near.half + 0.6) return near.y - 0.12;
    if (near && near.dist < near.half + 2) return Math.min(h, near.y - 1.5);
    return h;
  }
  // 차량·사람이 실제로 올라서 있는 노면 높이. 겹치는 도로(램프 ↔ 본선)가 있으면
  // 지금 높이(yHint)에 가장 가까운 노면을 고른다 — 램프 위의 차는 램프에, 밑을 지나는 차는 본선에 붙는다.
  // 전에는 지형용 groundAt(가장 낮은 노면)을 그대로 썼기 때문에 램프 위의 차가 아래 본선 높이로 내려앉아
  // 노면에 파묻히고 카메라가 포장 밑으로 들어가 화면이 검게 나왔다.
  function surfaceAt(x, z, yHint) {
    var cx = Math.floor(x / CELL), cz = Math.floor(z / CELL);
    var hint = (yHint === undefined || yHint === null || !isFinite(yHint)) ? null : yHint;
    // 1차: 지금 높이와 같은 층(±3m)의 도로만 후보로 본다. 2차: 못 찾으면 층을 가리지 않는다.
    for (var pass = 0; pass < 2; pass++) {
      var best = null, bs = 1e9, useHint = pass === 0 && hint !== null;
      for (var ox = -1; ox <= 1; ox++) for (var oz = -1; oz <= 1; oz++) {
        var list = grid[(cx + ox) + ',' + (cz + oz)]; if (!list) continue;
        for (var m = 0; m < list.length; m++) {
          var p = list[m], lat = (x - p.x) * p.rx + (z - p.z) * p.rz, alo = (x - p.x) * p.tx + (z - p.z) * p.tz;
          if (Math.abs(lat) > p.half + 1.5 || Math.abs(alo) > 5) continue;
          if (useHint && Math.abs(p.y - hint) > 3.0) continue;
          var sc = Math.abs(lat) + Math.abs(alo) * 0.2;   // 중심선에 가까운 도로가 내가 달리고 있는 도로
          if (sc < bs) { bs = sc; best = p; }
        }
      }
      // 노면 「위」를 준다 — 포장은 p.y + 0.02(램프 0.04) 에 깔린다. 전에는 지형 기준(p.y − 0.12)을 줘서
      // 바퀴가 아스팔트 30cm 아래에 잠겼다(소유자: 「차량이 도로에 묻혀서 달리고 있음」).
      if (best) return best.y + 0.02;
      if (!useHint) break;
    }
    return groundAt(x, z);
  }
  function isWater(x, z) { return hBase(x, z) + river(x, z) < -0.9 + (flood ? 1.2 : 0); }
  function nearStream(x, z) { return Math.abs(z - yjZ(x)) < 20 && x > -80 && x < 420; }
  function limitOf(kind) { return kind === 'highway' ? cfg.HW_LIMIT_KMH : kind === 'suburb' ? cfg.SUB_LIMIT_KMH : kind === 'circuit' ? 999 : 80; }
  function laneOffsets(p) { return p.f > 0.5 ? cfg.HW_LANES.slice() : [cfg.LANE_OFF]; }
  // 시설물(표지 기둥·갠트리 다리)은 **다른 도로의 포장 안에 서면 안 된다**.
  // 소유자: 「도로 한가운데 차들이 주행하는 곳에 도로표지판이 있어서 사고를 내려고 하고 있음」.
  function clearSpot(x, z, L, ux, uz) {
    for (var k = 0; k <= 6; k++) {
      var sx = x + ux * 3 * k, sz = z + uz * 3 * k, q = nearest(sx, sz, true);
      if (!q || q.link === L || q.dist > q.p.half + 0.9) return [sx, sz];
    }
    return null;
  }
  function shoulderOf(p) { return p.f > 0.5 ? cfg.HW_SHOULDER : (p.link.oneWay ? 3.4 : cfg.SHOULDER_OFF); }

  // ---------- 메시 ----------
  var G = TG.GeoBuilder, lambertVC = new THREE.MeshLambertMaterial({ vertexColors: true });
  TG.mats = TG.mats || { road: [], ground: [] }; TG.mats.ground.push(lambertVC);
  function mesh(geo, mat, cast, receive) { var m = new THREE.Mesh(geo, mat); m.castShadow = !!cast; m.receiveShadow = !!receive; m.matrixAutoUpdate = false; m.updateMatrix(); scene.add(m); return m; }
  function rgb(hex) { return [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255]; }
  function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }

  var X0 = -900, X1 = 1400, Z0 = -1000, Z1 = 1200, TS = 20;
  var NX = Math.floor((X1 - X0) / TS) + 1, NZ = Math.floor((Z1 - Z0) / TS) + 1;
  var tg = new THREE.BufferGeometry(), tp = [], tc = [], ti = [];
  var C_SAND = rgb(0xd8c79a), C_GRASS = rgb(0x7ea45c), C_F1 = rgb(0x8db35f), C_F2 = rgb(0x9fc06a), C_HILL = rgb(0x5e8c47), C_FOREST = rgb(0x466f3a), C_ROCK = rgb(0x8d8a84), C_SNOW = rgb(0xf2f4f7), C_BED = rgb(0x6e6a5a);
  for (var iz = 0; iz < NZ; iz++) for (var ix = 0; ix < NX; ix++) {
    var wx = X0 + ix * TS, wz = Z0 + iz * TS, hh = groundAt(wx, wz), col;
    tp.push(wx, hh, wz);
    if (hh < -0.8) col = C_BED;
    else if (hh < 0.6) col = mix(C_SAND, C_GRASS, sstep(-0.8, 0.6, hh));
    else if (hh < 14) { var field = (Math.floor(wx / 60) + Math.floor(wz / 60)) % 2 === 0; col = mix(field ? C_F1 : C_F2, C_HILL, sstep(3, 14, hh)); }
    else if (hh < 70) col = mix(C_HILL, C_FOREST, sstep(14, 70, hh));
    else if (hh < 130) col = mix(C_FOREST, C_ROCK, sstep(70, 130, hh));
    else col = mix(C_ROCK, C_SNOW, sstep(130, 185, hh));
    if (wx > -70 && wx < 390 && wz > -70 && wz < 390 && hh > -0.8) col = rgb(0x7a9c58);
    tc.push(col[0], col[1], col[2]);
  }
  for (var iz2 = 0; iz2 < NZ - 1; iz2++) for (var ix2 = 0; ix2 < NX - 1; ix2++) { var a0 = iz2 * NX + ix2, b0 = a0 + 1, c0 = a0 + NX, d0 = c0 + 1; ti.push(a0, c0, b0, b0, c0, d0); }
  tg.setAttribute('position', new THREE.Float32BufferAttribute(tp, 3)); tg.setAttribute('color', new THREE.Float32BufferAttribute(tc, 3)); tg.setIndex(ti); tg.computeVertexNormals();
  mesh(tg, lambertVC, false, true);

  var waterMat = new THREE.MeshLambertMaterial({ map: TG.tex.water(), transparent: true, opacity: 0.88 });
  var wg = new G(); wg.rect(1120, 100, 700, 2300, 0, -1.0, 0xffffff);
  var wgeo = wg.build(), wuv = wgeo.attributes.uv.array; for (var u = 0; u < wuv.length; u += 2) { wuv[u] *= 40; wuv[u + 1] *= 130; } wgeo.attributes.uv.needsUpdate = true;
  mesh(wgeo, waterMat, false, false);
  var rg = new G();
  for (var rx2 = X0; rx2 < X1; rx2 += 20) { var za = riverZ(rx2), zb = riverZ(rx2 + 20); rg.quad([rx2, -1.3, za - 64], [rx2, -1.3, za + 64], [rx2 + 20, -1.3, zb + 64], [rx2 + 20, -1.3, zb - 64], [0, 1, 0], 0x3f7fb0, [[0, rx2 / 40], [3.2, rx2 / 40], [3.2, (rx2 + 20) / 40], [0, (rx2 + 20) / 40]]); }
  var hanMesh = mesh(rg.build(), waterMat, false, false);
  // 양재천 수면(폭 26m) + 양쪽 산책로(콘크리트 띠). 침수 때 수면이 1.2m 올라 산책로가 잠긴다.
  var sg2 = new G(), pathG = new G();
  for (var sx2 = -80; sx2 < 420; sx2 += 10) {
    var zA = yjZ(sx2), zB = yjZ(sx2 + 10);
    sg2.quad([sx2, -1.15, zA - 13], [sx2, -1.15, zA + 13], [sx2 + 10, -1.15, zB + 13], [sx2 + 10, -1.15, zB - 13], [0, 1, 0], 0x4f8fbf, [[0, sx2 / 20], [1.3, sx2 / 20], [1.3, (sx2 + 10) / 20], [0, (sx2 + 10) / 20]]);
    for (var pside = -1; pside <= 1; pside += 2) { var pz0 = zA + pside * 15.5, pz1 = zB + pside * 15.5, py0 = groundAt(sx2, pz0) + 0.05, py1 = groundAt(sx2 + 10, pz1) + 0.05; pathG.quad([sx2, py0, pz0 - 1.3], [sx2, py0, pz0 + 1.3], [sx2 + 10, py1, pz1 + 1.3], [sx2 + 10, py1, pz1 - 1.3], [0, 1, 0], 0xd9d4c7, null); }
  }
  var streamMesh = mesh(sg2.build(), waterMat, false, false); mesh(pathG.build(), lambertVC, false, true);
  hanMesh.matrixAutoUpdate = true; streamMesh.matrixAutoUpdate = true;

  var sky = new THREE.SphereGeometry(2200, 28, 14), spos = sky.attributes.position, scol = [], ZEN = rgb(0x3f7fd6), HOR = rgb(0xdbe9f6);
  for (var sv = 0; sv < spos.count; sv++) { var yy = spos.getY(sv) / 2200, tcol = mix(HOR, ZEN, sstep(-0.05, 0.6, yy)); scol.push(tcol[0], tcol[1], tcol[2]); }
  sky.setAttribute('color', new THREE.Float32BufferAttribute(scol, 3));
  var skyMesh = new THREE.Mesh(sky, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false })); skyMesh.renderOrder = -10; scene.add(skyMesh);
  var cg = new G(), crng = TG.makeRNG(77);
  for (var ci = 0; ci < 18; ci++) { var cx2 = -800 + crng() * 2200, cz2 = -900 + crng() * 2000, cw = 180 + crng() * 200; cg.rect(cx2, cz2, cw, cw * 0.5, crng() * 3, 260 + crng() * 100, 0xffffff); }
  mesh(cg.build(), new THREE.MeshBasicMaterial({ map: TG.tex.cloud(), transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false, opacity: 0.9 }), false, false);

  // 도로 리본(링크 전부)
  var road = new G(), mark = new G(), props = new G(), busTextGeo = new G(), signFaces = {};
  var YEL = 0xf0c000, WHT = 0xf2f2ee, BLU = 0x2f6fd6;
  function Pt(p, off, lift) { return [p.x + p.rx * off, p.y + (lift || 0), p.z + p.rz * off]; }
  function ribbon(gb, a, b, oa, ob, lift, color, uvS) {
    var A0 = Pt(a, oa, lift), B0 = Pt(a, ob, lift), A1 = Pt(b, oa, lift), B1 = Pt(b, ob, lift);
    gb.quad(A0, B0, B1, A1, [0, 1, 0], color, uvS ? [[oa / uvS, a.s / uvS], [ob / uvS, a.s / uvS], [ob / uvS, b.s / uvS], [oa / uvS, b.s / uvS]] : null);
  }
  function wallQuad(gb, a, b, off, h0, h1, color) {
    var A0 = Pt(a, off, h0), A1 = Pt(a, off, h1), B0 = Pt(b, off, h0), B1 = Pt(b, off, h1);
    gb.quad(A0, B0, B1, A1, [a.rx, 0, a.rz], color, null); gb.quad(B0, A0, A1, B1, [-a.rx, 0, -a.rz], color, null);
  }
  function face(kind, x, y, z, rot, w, h) { (signFaces[kind] = signFaces[kind] || new G()).vquad(x, y, z, w, h, rot, 0xffffff, null); }
  // IC 분기점 직진 차단봉(황·흑 줄무늬)
  walls.forEach(function (W) {
    if (!W.icEnd) return;
    var cx = (W.x1 + W.x2) / 2, cz = (W.z1 + W.z2) / 2, len = Math.hypot(W.x2 - W.x1, W.z2 - W.z1), rot = Math.atan2(W.tz, W.tx) + Math.PI / 2, y = groundAt(cx, cz);
    props.box(cx, y + 0.55, cz, len, 0.5, 0.3, 0xf2c200, { rotY: rot });
    var ux = (W.x2 - W.x1) / (len || 1), uz = (W.z2 - W.z1) / (len || 1);
    for (var k = -1; k <= 1; k++) props.box(cx + ux * k * len / 3, y + 0.55, cz + uz * k * len / 3, 1.2, 0.52, 0.32, 0x15171a, { rotY: rot });
    props.box(cx, y + 0.15, cz, len + 0.2, 0.3, 0.4, 0xc9c5ba, { rotY: rot });
  });
  // 램프가 링 가장자리를 가로지르는 곳(±16m)은 가드레일을 비운다 — 진입·진출로가 벽에 막히지 않는다. 램프가 있는 쪽(lateral 부호)만.
  // 램프가 본선 포장 안을 달리는 구간(가속·감속차로)을 표시한다 — 그 구간에서는 램프의 가장자리선을 그리지 않는다.
  // 그리지 않으면 램프 차로선이 본선 차로를 가로질러 이어져 보였다(소유자: 「연결도로선이 본선도로까지 이어짐」).
  links.forEach(function (Lm) { if (!Lm.oneWay) return; for (var mi = 0; mi < Lm.N; mi++) { var mp = Lm.pts[mi], mq = nearest(mp.x, mp.z, 'no'); mp.inMain = !!(mq && mq.dist <= mq.p.half - 1.5 && Math.abs(mq.y - mp.y) < 1.5); } });
  var rampPts = []; links.forEach(function (Lr) { if (Lr.oneWay) for (var ri = 0; ri < Lr.N; ri++) rampPts.push(Lr.pts[ri]); });
  function rampGap(L, p, side) {
    if (!L.closed) return false;
    // 램프가 본선 옆을 지나거나 합류하는 구간에서는 방호벽·난간을 비운다(실제 IC 도 합류부에 방호벽이 끊긴다).
    // 탐색 반경 18 → 26m, 측방 띠 9.5~24 → 7.5~28m: 원호에서 가속차로로 바뀌는 구간(측방 13~19m)에서
    // 램프 중심선이 본선 방호벽 선(반폭 −0.4 = 16.6m) 위를 지나 차가 벽에 걸려 멈췄다.
    for (var k = 0; k < rampPts.length; k++) { var rp = rampPts[k]; if (Math.abs(rp.x - p.x) > 26 || Math.abs(rp.z - p.z) > 26) continue; var lat = (rp.x - p.x) * p.rx + (rp.z - p.z) * p.rz; var alo = (rp.x - p.x) * p.tx + (rp.z - p.z) * p.tz;
      if (Math.abs(alo) <= 12 && Math.sign(lat) === side && Math.abs(lat) > 1.2 && Math.abs(lat) < 28) return true; }
    return false;
  }
  links.forEach(function (L) {
    var segs = L.closed ? L.N : L.N - 1;
    for (var i = 0; i < segs; i++) {
      var p = L.P(i), q = L.P(i + 1), half = p.half, hw = p.f > 0.5, ramp = L.oneWay;
      var noseZone = L.splitEnd && (L.total - p.s) < 46;   // 램프 분기점 앞: 난간·방호벽을 세우지 않는다(램프가 이 선을 가로지른다)
      var overMain = ramp && p.inMain;                     // 본선 포장 안 = 본선이 이미 깔았다
      if (!overMain) ribbon(road, p, q, -half, half, ramp ? 0.04 : 0.02, 0xffffff, 8);
      // 노면 옆치마(4m 벽)는 **정말로 지형이 꺼진 곳**에만 세운다.
      // 램프가 본선 포장 위를 나란히 달리는 구간에서는 이 벽이 차로 가운데를 가로지르는 「턱」으로 보였다
      // (소유자: 「매끈하게 연결되어야 하는데 턱이 있고 차들이 도로에 반쯤 들어가서 달리고 있음」).
      for (var ws = -1; ws <= 1 && !overMain; ws += 2) {   // 본선 위에 겹친 램프에는 옆치마를 세우지 않는다
        var wex = p.x + p.rx * ws * half, wez = p.z + p.rz * ws * half;
        var wox = p.x + p.rx * ws * (half + 7), woz = p.z + p.rz * ws * (half + 7);
        var wq = nearest(wex, wez, true);
        var covered = wq && wq.link !== L && wq.dist <= wq.p.half + 1 && Math.abs(wq.p.y - p.y) < 1.5;   // 다른 도로 포장 위
        if (!covered && p.y - groundAt(wox, woz) > 0.5) wallQuad(props, p, q, ws * half, -4, 0.02, 0x6b6a5e);
      }
      var LIFT = ramp ? 0.07 : 0.05;
      if (ramp) {
        var ru = (i + 0.5) / L.N, inMerge = L.mergeFrom > 0 ? ru > L.mergeFrom : ru < 0.42, dsh = (i % 2) === 0;
        // 넓어진 이음부(taperHalf 구간)에서는 램프 가장자리선을 긋지 않는다 —
        // 선이 노면을 대각으로 가로질러 「V」 자로 보였다(소유자: 「차선이 대각으로 그려져 있는 부분 전부 없애고」).
        if (!p.inMain && p.half < 6.4 && (!inMerge || dsh)) { ribbon(mark, p, q, half - 0.3, half - 0.16, LIFT, WHT); ribbon(mark, p, q, -half + 0.16, -half + 0.3, LIFT, WHT); }
      }
      else if (L.kind === 'circuit') {   // 서킷: 흰 가장자리선, 코너 연석(적·백), 출발선(체크), 코너 앞 러버콘
        ribbon(mark, p, q, half - 0.5, half - 0.32, LIFT, WHT); ribbon(mark, p, q, -half + 0.32, -half + 0.5, LIFT, WHT);
        if (p.kappa > 0.012) for (var cs = -1; cs <= 1; cs += 2) ribbon(mark, p, q, cs * (half - 0.3), cs * (half + 0.5), LIFT + 0.02, (i % 2) ? 0xe53935 : 0xffffff);
        if (i === 0) for (var cc = 0; cc < 6; cc++) ribbon(mark, p, q, -half + cc * half / 3, -half + (cc + 1) * half / 3, LIFT + 0.02, (cc % 2) ? WHT : 0x1b1d20);
        if (p.kappa < 0.006 && L.P(i + 10).kappa > 0.018 && L.P(i + 1).kappa < 0.006) for (var co = -1; co <= 1; co += 2) { var cp = Pt(p, co * (half + 1.2), 0); props.cylinder(cp[0], cp[1], cp[2], 0.28, 0.06, 0.75, 6, 0xff7a00); }
      }
      else if (!hw) {
        ribbon(mark, p, q, -0.3, -0.15, LIFT, YEL); ribbon(mark, p, q, 0.15, 0.3, LIFT, YEL);
        ribbon(mark, p, q, half - 2.37, half - 2.23, LIFT, WHT); ribbon(mark, p, q, -half + 2.23, -half + 2.37, LIFT, WHT);
      } else {
        var dash = (i % 2) === 0, nHW = cfg.HW_LANES.length;
        for (var side = -1; side <= 1; side += 2) {
          // 차로 경계: 편도 4차로면 3곳. 1차로 경계는 버스전용차로가 있는 도로(경부고속도로)만 청색 실선, 나머지는 흰 점선
          for (var hk = 1; hk < nHW; hk++) {
            var hb = 0.25 + cfg.LANE_W * hk;
            if (hk === 1 && L.busLane) {   // 청색 복선: 1차로(버스전용차로)를 확보한다
              ribbon(mark, p, q, side * (hb - 0.42), side * (hb - 0.22), LIFT, BLU);
              ribbon(mark, p, q, side * (hb + 0.08), side * (hb + 0.28), LIFT, BLU);
            }
            else if (dash) ribbon(mark, p, q, side * (hb - 0.07), side * (hb + 0.07), LIFT, WHT);
          }
          ribbon(mark, p, q, side * (0.25 + cfg.LANE_W * nHW - 0.07), side * (0.25 + cfg.LANE_W * nHW + 0.07), LIFT, WHT);
          var barOk = !noseZone && !rampGap(L, p, side);   // 방호벽을 비운 자리에는 **지주(말뚝)도 세우지 않는다** —
          if (barOk) wallQuad(props, p, q, side * (half - 0.4), 0.55, 0.85, 0xd9dde2);   // 벽만 지우고 말뚝을 남겨 램프가 말뚝으로 막혀 있었다(소유자 지적)
          if (barOk && i % 2 === 0) { var gp = Pt(p, side * (half - 0.4), 0); props.box(gp[0], gp[1] + 0.4, gp[2], 0.12, 0.8, 0.12, 0x8f959c, {}); }
          var w0 = Pt(p, side * (half - 0.4), 0), w1 = Pt(q, side * (half - 0.4), 0);
          if (barOk) walls.push({ x1: w0[0], z1: w0[2], x2: w1[0], z2: w1[2] });
        }
        var medNose = noseZone || (L.cityStart && p.s < 70);   // 도시 진입부 70m · 램프 분기부: 중앙분리대를 세우지 않는다
        if (!medNose) {
          wallQuad(props, p, q, -0.35, 0, 0.85, 0xb9b6ad); wallQuad(props, p, q, 0.35, 0, 0.85, 0xb9b6ad); ribbon(props, p, q, -0.35, 0.35, 0.85, 0xc8c5bc);
          var m0 = Pt(p, 0, 0), m1 = Pt(q, 0, 0); walls.push({ x1: m0[0], z1: m0[2], x2: m1[0], z2: m1[2] });
        } else {                                               // 벽 대신 황색 복선(도시 도로와 같은 표시)
          ribbon(mark, p, q, -0.40, -0.24, LIFT, YEL); ribbon(mark, p, q, 0.24, 0.40, LIFT, YEL);
        }
        if (i % 10 === 0) {
          var pp = Pt(p, 0, 0), rot = Math.atan2(p.rx, p.rz);
          props.cylinder(pp[0], pp[1] + 0.8, pp[2], 0.14, 0.1, 11, 6, 0x8f959c);
          props.box(pp[0] + p.rx * 3, pp[1] + 11.6, pp[2] + p.rz * 3, 0.14, 0.14, 6, 0x8f959c, { rotY: rot }); props.box(pp[0] - p.rx * 3, pp[1] + 11.6, pp[2] - p.rz * 3, 0.14, 0.14, 6, 0x8f959c, { rotY: rot });
          props.box(pp[0] + p.rx * 5.6, pp[1] + 11.4, pp[2] + p.rz * 5.6, 0.5, 0.2, 0.9, 0xfff2c8, {}); props.box(pp[0] - p.rx * 5.6, pp[1] + 11.4, pp[2] - p.rz * 5.6, 0.5, 0.2, 0.9, 0xfff2c8, {});
        }
        if (i % 30 === 0) for (var dirn = -1; dirn <= 1; dirn += 2) {
          var rot2 = Math.atan2(p.tx * dirn, p.tz * dirn), off = dirn * cfg.HW_LANES[0];
          busTextGeo.rect(p.x + p.rx * off + p.tx * dirn * 6, p.z + p.rz * off + p.tz * dirn * 6, 2.2, 4 * 2.4, rot2 + Math.PI, p.y + 0.06, 0xffffff);
        }
      }
      if (p.bridge) {   // 다리: 램프는 난간 없이 상판만(합류부에서 본선 위에 난간이 서지 않게)
        for (var s3 = -1; s3 <= 1; s3 += 2) { if (L.oneWay) break;
          if (!noseZone) wallQuad(props, p, q, s3 * (half + 0.2), 0, 1.1, 0xc9cdd2);
          var bp = Pt(p, s3 * (half + 0.2), 0), bq = Pt(q, s3 * (half + 0.2), 0);
          var railOk = !L.oneWay && !noseZone && !rampGap(L, p, s3);
          if (railOk) props.box(bp[0], bp[1] + 0.55, bp[2], 0.16, 1.1, 0.16, 0x8f959c, {});
          if (railOk) walls.push({ x1: bp[0], z1: bp[2], x2: bq[0], z2: bq[2] });   // 램프 난간·램프 합류부 난간은 충돌 없음(시각만)
        }
        ribbon(props, p, q, -half - 0.3, half + 0.3, -0.9, 0xa9a59c);
        if (i % 5 === 0) { var pc = Pt(p, 0, 0); props.box(pc[0], pc[1] - 4, pc[2], half * 1.2, 8, 1.6, 0x9d9a91, { rotY: Math.atan2(p.tx, p.tz) }); }
      }
      // 제한속도 표지(200m 마다, 양방향; 램프 제외)
      if (!ramp && i % 50 === 25) for (var dn = -1; dn <= 1; dn += 2) {
        if (hw && dn === 0) continue;
        var offS = dn * (half + 1.6), spotS = clearSpot(p.x + p.rx * offS, p.z + p.rz * offS, L, p.rx * dn, p.rz * dn);
        if (!spotS) continue;
        var sx = spotS[0], sz = spotS[1], rotS = Math.atan2(p.tx * dn, p.tz * dn) + Math.PI;
        props.cylinder(sx, p.y, sz, 0.06, 0.05, 2.9, 5, 0x8f959c);
        var lim = limitOf(p.kind); face(lim === 100 ? 'limit100' : lim === 80 ? 'limit80' : 'limit60', sx, p.y + 2.75, sz, rotS, 0.9, 0.9);
      }
    }
  });
  // 안내 갠트리
  // 안내표지 갠트리: dn2=+1 쪽 표지는 A 방향 운전자가, -1 쪽은 B 방향 운전자가 본다(textB 생략 시 같은 글).
  function gantry(L, i, text, textB) {
    var p5 = L.P(i);
    for (var dn2 = -1; dn2 <= 1; dn2 += 2) {
      var txt = dn2 > 0 ? text : (textB || text);
      var offG = dn2 * (p5.half + 1.2), spotG = clearSpot(p5.x + p5.rx * offG, p5.z + p5.rz * offG, L, p5.rx * dn2, p5.rz * dn2);
      if (!spotG) continue;                                     // 다리를 세울 자리가 차로 안뿐이면 세우지 않는다
      var gx = spotG[0], gz = spotG[1];
      props.cylinder(gx, p5.y, gz, 0.18, 0.15, 6.5, 6, 0x4a4f55);
      var rotG = Math.atan2(p5.tx * dn2, p5.tz * dn2) + Math.PI, cxg = p5.x + p5.rx * dn2 * (p5.half * 0.5), czg = p5.z + p5.rz * dn2 * (p5.half * 0.5);
      props.box((gx + cxg) / 2, p5.y + 6.6, (gz + czg) / 2, 0.2, 0.2, Math.hypot(gx - cxg, gz - czg), 0x4a4f55, { rotY: Math.atan2(p5.rx, p5.rz) });
      face('hw:' + txt, cxg, p5.y + 5.4, czg, rotG, 6, 2.2);
    }
  }
  gantry(ring, (jE + 20) % ring.N, '경부고속도로 · 제한 100'); gantry(ring, (jN + 20) % ring.N, '올림픽대로 · 제한 80');   // 버스전용차로는 경부고속도로 남쪽 연결로(link.busLane)에만 있다
  // IC 안내표지(강남·서초 축약): 연결로 도시 쪽 「순환고속도로 → ○○IC」, 분기 54m 전 「↱ ○○IC 진입」, 링 위 출구 500m·직전 「↗ ○○IC 출구」. 시내 방향 면에는 「강남역·시내 방향」.
  var IC_INFO = { E: ['강남IC', '강남역·테헤란로 방향'], N: ['반포IC', '반포대교·용산 방향'], S: ['경부고속도로 시점', '양재·판교 방향'], W: ['사당IC', '사당·동작 방향'],
                  NE: ['신논현IC', '논현·신사 방향'], NW: ['동작대교IC', '이촌·용산 방향'], SE: ['양재IC', '양재천·도곡 방향'], SW: ['방배IC', '방배·남태령 방향'] };
  conns.forEach(function (c) {
    var info = IC_INFO[c.ic] || [c.id, '']; c.icName = info[0]; c.icDest = info[1];
    gantry(c, Math.min(6, c.N - 1), '경부고속도로 →|' + info[0] + ' · ' + info[1], '서초 · 시내 방향|' + (c.name || '') );
    gantry(c, Math.max(2, c.N - 18), '↱ ' + info[0] + ' 진입|' + info[1] + ' · 우측 램프', '강남역 · 시내 방향|직진');
  });
  ring.exitsA.forEach(function (ex) {
    var c = ex.link.nextA && ex.link.nextA.link, info = c && IC_INFO[c.ic]; if (!info) return;
    gantry(ring, ((ex.atIndex - 45) % ring.N + ring.N) % ring.N, '↗ ' + info[0] + ' 출구 500m|' + info[1], '본선|계속 주행');
    gantry(ring, ((ex.atIndex - 12) % ring.N + ring.N) % ring.N, '↗ ' + info[0] + ' 출구|' + info[1] + ' · 우측', '본선|계속 주행');
  });
  mesh(busTextGeo.build(), new THREE.MeshBasicMaterial({ map: TG.tex.roadText('버스전용', '#2f6fd6'), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), false, false);
  var roadMatT = new THREE.MeshLambertMaterial({ map: TG.tex.asphalt(), vertexColors: true }); TG.mats.road.push(roadMatT);
  mesh(road.build(), roadMatT, false, true);
  mesh(mark.build(), new THREE.MeshBasicMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }), false, false);
  Object.keys(signFaces).forEach(function (k) {
    var tex = k.indexOf('hw:') === 0 ? TG.tex.hwSign(k.slice(3)) : TG.tex.sign(k);
    mesh(signFaces[k].build(), new THREE.MeshBasicMaterial({ map: tex, transparent: true }), false, false);   // 뒷면에 글씨가 거울로 비치지 않게 단면
  });

  // 나무·농가
  var trees = new G(), trng = TG.makeRNG(1234), placed = 0;
  function tree(x, z, sc, dark) {
    var y = groundAt(x, z), col = dark ? [0x3f6b32, 0x476f38, 0x385f2c][placed % 3] : [0x4f8a3a, 0x5c9a42, 0x437a33][placed % 3];
    trees.cylinder(x, y, z, 0.22 * sc, 0.16 * sc, 2.4 * sc, 5, 0x6b4a2b);
    trees.cylinder(x, y + 1.6 * sc, z, 2.1 * sc, 0.9 * sc, 2.2 * sc, 6, col, false);
    trees.cylinder(x, y + 3.2 * sc, z, 1.6 * sc, 0.6 * sc, 2.0 * sc, 6, col, false);
    trees.cylinder(x, y + 4.6 * sc, z, 1.1 * sc, 0.1, 1.8 * sc, 6, col, true);
    placed++;
  }
  for (var tI = 0; tI < 4000 && placed < 1500; tI++) {
    var tx2 = -880 + trng() * 2260, tz2 = -980 + trng() * 2160;
    if (tx2 > -80 && tx2 < 400 && tz2 > -80 && tz2 < 400) continue;
    var hh2 = hBase(tx2, tz2) + river(tx2, tz2);
    if (hh2 < 0.3 || hh2 > 120) continue;
    var q8 = nearest(tx2, tz2, true); if (q8 && q8.dist < q8.p.half + 6) continue;
    if (trng() > (hh2 < 14 ? 0.22 : 0.8)) continue;
    tree(tx2, tz2, hh2 < 14 ? 0.9 + trng() * 0.6 : 1.4 + trng() * 1.4, hh2 > 30);
  }
  for (var i5 = 6; i5 < connE.N - 6; i5 += 8) { var p6 = connE.P(i5); if (p6.bridge) continue; for (var dn3 = -1; dn3 <= 1; dn3 += 2) tree(p6.x + p6.rx * dn3 * (p6.half + 3.5), p6.z + p6.rz * dn3 * (p6.half + 3.5), 0.9 + (i5 % 3) * 0.15, false); }
  // ---------- 한강 시설 · 서초구 남쪽 자연(소유자 설계) ----------
  // 반포대교·한남대교가 한강을 건너 올림픽대로에 붙으면서 생긴 자리에
  // 세빛섬·반포한강공원(북쪽) 과 우면산·양재시민의숲(남쪽)을 놓는다.
  // 지형 높이(hBase)는 손대지 않는다 — 봉우리를 넣으면 그 아래 도로가 함께 들려 파묻힌다(v0.9.2 교훈).
  var scenery = [];
  (function () {
    function farFromRoad(x, z, need) { var q = nearest(x, z, true); return !q || q.dist > q.p.half + need; }
    // ① 세빛섬: 반포대교 동쪽 물 위 세 개의 원형 구조물(꽃봉오리). 수면 -1.3 위로 올라온다.
    var isles = [[204, -102, 12.5, 10.5], [228, -90, 9.5, 8.0], [186, -118, 7.5, 6.2]];
    isles.forEach(function (I, k) {
      var x = I[0], z = I[1], r = I[2], hh = I[3];
      if (!farFromRoad(x, z, 16)) return;
      props.cylinder(x, -1.6, z, r, r * 1.05, 1.5, 20, 0xb9bec4, true);                  // 부유 기초
      props.cylinder(x, -0.1, z, r * 0.86, r * 0.62, hh * 0.55, 20, 0xe9e4d6, true);      // 아래 꽃잎
      props.cylinder(x, -0.1 + hh * 0.55, z, r * 0.66, r * 0.34, hh * 0.45, 20, 0xf2eee2, true);   // 위 꽃잎
      props.cylinder(x, -0.1 + hh, z, r * 0.2, r * 0.1, 1.6, 12, 0xd7d3c8, true);
      for (var g2 = 0; g2 < 3; g2++) props.cylinder(x, -0.1 + hh * 0.2 + g2 * hh * 0.28, z, r * (0.88 - g2 * 0.2), r * (0.86 - g2 * 0.2), 0.28, 20, 0x6fa8d6, true);   // 유리 띠
      scenery.push({ kind: 'sebit', x: x, z: z, r: r, name: k === 0 ? '세빛섬' : null });
    });
    // 세빛섬 보행 연결교(반포대교 동쪽 보도에서 첫 섬으로)
    var bz = riverZ(178);
    props.box(190, -0.6, bz + 6, 26, 0.35, 2.6, 0xd9d3c4, { rotY: 0.42 });
    for (var pb = 0; pb < 4; pb++) props.cylinder(180 + pb * 7, -5.5, bz + 6 + pb * 3.1, 0.5, 0.5, 5.2, 8, 0x8f959c);

    // ② 반포한강공원: 강 남안 둔치(평지)에 잔디·산책로·자전거도로·나무. 다리와 링을 피해서 깐다.
    for (var px = -40; px <= 380; px += 10) {
      var zb = riverZ(px) + 60;                                  // 둔치 안쪽(도시 쪽)
      if (!farFromRoad(px, zb, 9)) continue;
      props.box(px, 0.06, zb, 10, 0.12, 26, 0x6f9a4c, {});        // 잔디밭
      props.box(px, 0.14, zb - 9, 10, 0.14, 3.2, 0xcfc7b4, {});   // 산책로
      props.box(px, 0.14, zb + 7, 10, 0.14, 2.6, 0xa9553a, {});   // 자전거도로(적색 포장)
      if (((px / 10) | 0) % 3 === 0) { tree(px + 3, zb - 12.5, 1.0, false); tree(px - 3, zb + 12, 0.9, false); }
      if (((px / 10) | 0) % 6 === 0) { props.box(px, 0.5, zb + 1.5, 1.8, 0.1, 0.5, 0x8a6a4a, {}); props.box(px, 0.25, zb + 1.5, 1.7, 0.5, 0.08, 0x8a6a4a, {}); }   // 벤치
    }
    scenery.push({ kind: 'park', x: 120, z: riverZ(120) + 60, name: '반포한강공원' });

    // ③ 우면산: 지형이 아니라 **초록 언덕 구조물** + 나무로 만든다(도로가 들리지 않는다).
    var UM = { x: 60, z: 462, r: 74, h: 58 };
    if (farFromRoad(UM.x, UM.z, 40)) {
      var y0 = groundAt(UM.x, UM.z);
      // GeoBuilder.cylinder 의 반경은 (아래, 위) 순서다 — 뒤집어 넣으면 사발처럼 위가 벌어진다.
      props.cylinder(UM.x, y0, UM.z, UM.r, UM.r * 0.72, UM.h * 0.42, 26, 0x6f8f52, true);
      props.cylinder(UM.x + 6, y0 + UM.h * 0.42, UM.z - 4, UM.r * 0.72, UM.r * 0.40, UM.h * 0.36, 24, 0x5f8348, true);
      props.cylinder(UM.x + 10, y0 + UM.h * 0.78, UM.z - 7, UM.r * 0.40, UM.r * 0.10, UM.h * 0.24, 20, 0x54783f, true);
      // 산의 숲. **경사면 높이를 원뿔 식으로 정확히 구해 그 위에 세운다** — 대충 놓으면 나무가 산 속에 파묻힌다.
      function slopeY(ur) {                                         // 아래 원뿔: 바닥 반경 r → 위 0.72r, 높이 h*0.42
        if (ur >= UM.r) return y0;
        if (ur >= UM.r * 0.72) return y0 + (UM.r - ur) / (UM.r * 0.28) * UM.h * 0.42;
        if (ur >= UM.r * 0.40) return y0 + UM.h * 0.42 + (UM.r * 0.72 - ur) / (UM.r * 0.32) * UM.h * 0.36;
        return y0 + UM.h * 0.78;
      }
      for (var ut = 0; ut < 54; ut++) {
        var ua = ut * 2.399, ur = UM.r * (0.42 + 0.56 * ((ut % 8) / 8));
        var ux = UM.x + Math.cos(ua) * ur, uz = UM.z + Math.sin(ua) * ur;
        var uy = slopeY(ur) + 0.2;
        props.cylinder(ux, uy, uz, 0.34, 0.34, 2.0, 6, 0x6b5340, true);
        props.cylinder(ux, uy + 2.0, uz, 2.4, 0.5, 6.0, 8, ut % 3 ? 0x2f6b3a : 0x35753f, true);
      }
      for (var ub = 0; ub < 26; ub++) {                             // 산 아래 자락(평지)에는 일반 나무
        var ba2 = ub * 2.399 + 0.7, br2 = UM.r * (1.03 + 0.24 * ((ub % 5) / 5));
        tree(UM.x + Math.cos(ba2) * br2, UM.z + Math.sin(ba2) * br2, 1.1 + (ub % 3) * 0.2, true);
      }
      scenery.push({ kind: 'mount', x: UM.x, z: UM.z, r: UM.r, name: '우면산' });
    }

    // ④ 양재시민의숲: 경부고속도로 동쪽 숲(잔디·산책로·나무 무리 + 매헌 기념관 형태의 작은 전시동)
    var YJ = { x0: 206, z0: 396, x1: 322, z1: 486 };
    if (farFromRoad((YJ.x0 + YJ.x1) / 2, (YJ.z0 + YJ.z1) / 2, 26)) {
      var gy = groundAt((YJ.x0 + YJ.x1) / 2, (YJ.z0 + YJ.z1) / 2);
      props.box((YJ.x0 + YJ.x1) / 2, gy + 0.06, (YJ.z0 + YJ.z1) / 2, YJ.x1 - YJ.x0, 0.12, YJ.z1 - YJ.z0, 0x6f9a4c, {});
      for (var wk = 0; wk < 3; wk++) props.box((YJ.x0 + YJ.x1) / 2, gy + 0.14, YJ.z0 + 18 + wk * 26, YJ.x1 - YJ.x0 - 12, 0.14, 3.0, 0xcfc7b4, {});
      props.box((YJ.x0 + YJ.x1) / 2, gy + 0.14, (YJ.x0 + YJ.x1) / 2 * 0 + (YJ.z0 + YJ.z1) / 2, 3.0, 0.14, YJ.z1 - YJ.z0 - 10, 0xcfc7b4, {});
      for (var yt = 0; yt < 54; yt++) {
        var yx = YJ.x0 + 8 + ((yt * 37) % (YJ.x1 - YJ.x0 - 16)), yz = YJ.z0 + 8 + ((yt * 61) % (YJ.z1 - YJ.z0 - 16));
        if (Math.abs(((yz - YJ.z0 - 18) % 26)) < 4) continue;      // 산책로는 비운다
        tree(yx, yz, 1.05 + (yt % 4) * 0.14, yt % 4 === 0);
      }
      var mx2 = YJ.x0 + 22, mz2 = YJ.z1 - 22;
      props.box(mx2, gy + 3.0, mz2, 18, 6.0, 12, 0xe6e0d2, {});     // 기념관 본관
      props.box(mx2, gy + 6.4, mz2, 19, 0.8, 13, 0x8b6f4a, { noBottom: true });
      props.box(mx2, gy + 0.9, mz2 - 7.4, 6.0, 1.8, 1.0, 0xd7d3c8, {});
      props.cylinder(mx2 + 11, gy, mz2 - 9, 0.13, 0.11, 9, 6, 0x8f959c); props.box(mx2 + 11.8, gy + 8.1, mz2 - 9, 1.6, 1.0, 0.05, 0xffffff, {});
      scenery.push({ kind: 'park', x: (YJ.x0 + YJ.x1) / 2, z: (YJ.z0 + YJ.z1) / 2, name: '양재시민의숲' });
    }

    // ⑤ 다리 교각: 물 위 상판 아래에 기둥을 세운다(반포대교·한남대교·동작대교·순환도로 강 구간)
    [conns[1], conns[4], conns[5], ring].forEach(function (L) {
      if (!L) return;
      for (var i = 0; i < L.N; i++) {
        var p = L.P(i); if (!p.bridge || i % 5 !== 0) continue;
        var deck = Math.max(0.4, p.y);
        for (var sg = -1; sg <= 1; sg += 2) {
          var qx = p.x + p.rx * sg * (p.half * 0.55), qz = p.z + p.rz * sg * (p.half * 0.55);
          props.cylinder(qx, -6.4, qz, 1.35, 1.6, deck + 6.4, 10, 0x9aa0a8, false);
        }
        props.box(p.x, deck - 0.55, p.z, p.half * 1.5, 0.5, 2.2, 0xa9afb6, { rotY: Math.atan2(p.tx, p.tz) });   // 가로보
      }
    });
  })();

  mesh(trees.build(), lambertVC, true, false);
  mesh(props.build(), lambertVC, true, false);
  var farm = new G(), frng = TG.makeRNG(55);
  for (var fi = 0; fi < 40; fi++) {
    var fx = -250 + frng() * 850, fz = -230 + frng() * 800, fh = hBase(fx, fz);
    if (fx > -80 && fx < 400 && fz > -80 && fz < 400) continue;
    if (fh < 0.5 || fh > 12) continue;
    var q9 = nearest(fx, fz, true); if (!q9 || q9.dist < 24 || q9.dist > 120) continue;
    var fw = 8 + frng() * 8, fd = 6 + frng() * 6, fy = groundAt(fx, fz);
    farm.box(fx, fy + 1.8, fz, fw, 3.6, fd, [0xe8e2d4, 0xd9cfc0, 0xc9d3dd][fi % 3], {});
    farm.box(fx, fy + 4.0, fz, fw + 0.6, 0.8, fd + 0.6, [0x8a4a3a, 0x3b4a58, 0x6d4f3a][fi % 3], {});
  }
  mesh(farm.build(), lambertVC, true, true);

  // ---------- 잠수교(반포대교 아래 낮은 다리) + 침수 통제 ----------
  // 반포대교(conns[5]) 다리 구간 아래 −0.55m 에 낮은 상판. 평소엔 수면(−1.3) 위로 드러나고, 비가 오면 수면이 올라 잠긴다 → 양쪽 끝 차단봉·「잠수교 통제」 표지가 선다.
  var jamsu = { x: 0, z: 0, ends: [] }, jamsuGroup = new THREE.Group(), jg = new G(), jb = new G();
  (function () {
    var L5 = null, first = -1, last = -1;   // 반포대교(conns[5])가 강을 건너지 않는 축약 지도에서는 강을 건너는 첫 연결로(한남대교) 아래에 둔다
    [conns[5], conns[1], conns[4]].forEach(function (Lc) { if (L5) return; for (var q = 0; q < Lc.N; q++) if (Lc.pts[q].bridge) { L5 = Lc; break; } });
    if (!L5) return; jamsu.link = L5;
    for (var i5 = 0; i5 < L5.N; i5++) if (L5.pts[i5].bridge) { if (first < 0) first = i5; last = i5; }
    if (first < 0) return;
    for (var i6 = first; i6 < last; i6++) {
      var a = L5.P(i6), b = L5.P(i6 + 1);
      jg.quad([a.x + a.rx * -4.2, -0.55, a.z + a.rz * -4.2], [a.x + a.rx * 4.2, -0.55, a.z + a.rz * 4.2], [b.x + b.rx * 4.2, -0.55, b.z + b.rz * 4.2], [b.x + b.rx * -4.2, -0.55, b.z + b.rz * -4.2], [0, 1, 0], 0x9a9a92, null);
      for (var cs = -1; cs <= 1; cs += 2) jg.quad([a.x + a.rx * cs * 4.2, -0.55, a.z + a.rz * cs * 4.2], [a.x + a.rx * cs * 4.6, -0.3, a.z + a.rz * cs * 4.6], [b.x + b.rx * cs * 4.6, -0.3, b.z + b.rz * cs * 4.6], [b.x + b.rx * cs * 4.2, -0.55, b.z + b.rz * cs * 4.2], [0, 1, 0], 0xc9c5ba, null);
      if (i6 % 6 === 0) jg.cylinder(a.x, -6, a.z, 1.1, 1.1, 5.6, 8, 0x7d7d76);   // 교각
    }
    var mid = L5.P(Math.floor((first + last) / 2)); jamsu.x = mid.x; jamsu.z = mid.z;
    [first, last].forEach(function (ie, k) {
      var e = L5.P(ie); jamsu.ends.push({ x: e.x, z: e.z });
      jb.box(e.x, -0.2, e.z, 8.4, 0.5, 0.3, 0xf2c200, { rotY: Math.atan2(e.tx, e.tz) + Math.PI / 2 });
      for (var kk = -1; kk <= 1; kk++) jb.box(e.x + e.rx * kk * 2.8, -0.2, e.z + e.rz * kk * 2.8, 1.2, 0.52, 0.32, 0x15171a, { rotY: Math.atan2(e.tx, e.tz) + Math.PI / 2 });
      jb.cylinder(e.x + e.rx * 4.9, -0.55, e.z + e.rz * 4.9, 0.08, 0.08, 3.0, 5, 0x4a4f55);
      var sgn = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.1), new THREE.MeshBasicMaterial({ map: TG.tex.hwSign('잠수교 통제|수위 상승 · ' + ((L5.name || '').split(' · ')[1] || '상판') + ' 이용'), side: THREE.DoubleSide }));
      sgn.position.set(e.x + e.rx * 4.9, 2.0, e.z + e.rz * 4.9); sgn.rotation.y = Math.atan2(e.tx, e.tz) + (k === 0 ? Math.PI : 0); jamsuGroup.add(sgn);
    });
    var jm = new THREE.Mesh(jg.build(), lambertVC); jm.matrixAutoUpdate = false; jm.updateMatrix(); jm.receiveShadow = true; scene.add(jm);
    var jbm = new THREE.Mesh(jb.build(), lambertVC); jamsuGroup.add(jbm);
    jamsuGroup.visible = false; scene.add(jamsuGroup);
    var fsm = new THREE.MeshBasicMaterial({ map: TG.tex.sign('flood'), transparent: true, side: THREE.DoubleSide });
    for (var fx2 = -60; fx2 <= 400; fx2 += 115) { var fz = yjZ(fx2) + 18.5, fm = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.1), fsm); fm.position.set(fx2, groundAt(fx2, fz) + 2.2, fz); jamsuGroup.add(fm); }   // 양재천 산책로 「통제」 표지(침수 때만)
  })();
  function setFlood(on) {
    flood = !!on;
    hanMesh.position.y = flood ? 1.2 : 0; streamMesh.position.y = flood ? 1.2 : 0;
    jamsuGroup.visible = flood;
  }

  return {
    links: links, ring: ring, circuit: circuit, connE: connE, connN: connN, conns: conns, rampsE: rE, rampsN: rN, walls: walls, skyMesh: skyMesh, waterMat: waterMat, bounds: { x0: X0 + 20, x1: X1 - 20, z0: Z0 + 20, z1: Z1 - 20 },
    heightAt: surfaceAt, groundAt: groundAt, hBase: hBase, isWater: isWater, riverZ: riverZ, yjZ: yjZ, scenery: scenery, nearest: nearest, onDeck: onDeck, laneOffsets: laneOffsets, shoulderOf: shoulderOf, limitOf: limitOf,
    setFlood: setFlood, get flood() { return flood; }, yjZ: yjZ, riverZ: riverZ, nearStream: nearStream, jamsu: jamsu,
    // 도시 노드에서 나가는 출구: {link, dirA:true}
    exitFor: function (node, dir) {
      for (var c = 0; c < conns.length; c++) if (node === conns[c].cityStart.node && dir === conns[c].cityStart.dir) return { link: conns[c], dirA: true };
      return null;
    },
  };
};
