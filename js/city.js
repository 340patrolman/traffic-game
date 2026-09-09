// 도로망 = 진실의 원천. 격자 도로(우측통행), 교차로 노드, 블록·건물·표지 배치, 충돌.
// 도로마다 편도 차로 수가 다르다(config.LANES_V/H): 반포대로·강남대로·남부순환로 왕복 8차로, 서초대로(테헤란로) 왕복 6차로, 나머지 왕복 4차로.
// 좌표계: y 위. heading h → forward f=(sin h, cos h), right r=(-fz, fx). 방위 0..3 = 남(+z) 동(+x) 북(-z) 서(-x).
TG.buildCity = function (cfg) {
  var rng = TG.makeRNG(cfg.SEED);
  var xs = cfg.ROAD_XS, zs = cfg.ROAD_ZS, SW = cfg.SIDEWALK_W;
  var M = cfg.WORLD_MARGIN;
  var bounds = { x0: xs[0] - M, x1: xs[xs.length - 1] + M, z0: zs[0] - M, z1: zs[zs.length - 1] + M };
  // 도로별 차로 수(편도) 와 반폭
  // 도로마다 편도 차로 수가 다르다(config.LANES_V/H). 반폭 = 3 + 차로폭 × 편도차로수
  function halfFor(n) { return 3 + cfg.LANE_W * n; }
  var lanesV = xs.map(function (_, i) { return (cfg.LANES_V && cfg.LANES_V[i]) || 2; });
  var lanesH = zs.map(function (_, j) { return (cfg.LANES_H && cfg.LANES_H[j]) || 2; });
  var halfV = lanesV.map(halfFor), halfH = lanesH.map(halfFor);

  var nodes = [];
  for (var i = 0; i < xs.length; i++) { nodes[i] = []; for (var j = 0; j < zs.length; j++) nodes[i][j] = { i: i, j: j, x: xs[i], z: zs[j] }; }
  function nearestIdx(arr, v) { var best = 0, bd = Infinity; for (var k = 0; k < arr.length; k++) { var d = Math.abs(arr[k] - v); if (d < bd) { bd = d; best = k; } } return best; }

  // ---- 도로 기하 도우미 ----
  function axisOfDir(d) { return (d === 0 || d === 2) ? 'v' : 'h'; }
  function halfOf(axis, idx) { return axis === 'v' ? halfV[idx] : halfH[idx]; }
  function lanesOf(axis, idx) { return axis === 'v' ? lanesV[idx] : lanesH[idx]; }
  // 노드에서 방위 d 로 달리는 차의 '진행 도로'(축·인덱스) 와 '가로지르는 도로'
  function roadOf(node, d) { return axisOfDir(d) === 'v' ? { axis: 'v', idx: node.i } : { axis: 'h', idx: node.j }; }
  function crossHalf(node, d) { return axisOfDir(d) === 'v' ? halfH[node.j] : halfV[node.i]; }   // 교차로 상자의 진행 방향 반폭
  function stopDist(node, d) { return crossHalf(node, d) + cfg.STOP_GAP; }
  function crossNear(node, d) { return crossHalf(node, d) + 0.5; }
  function crossFar(node, d) { return crossHalf(node, d) + 4.0; }
  // 차로 중심(중앙선에서 우측 +): 1차로 2.0, 그다음부터 차로폭씩. 갓길은 마지막 차로 밖.
  function laneOff(axis, idx, laneIdx) { var n = lanesOf(axis, idx); return cfg.LANE_OFF + cfg.LANE_W * TG.clamp(laneIdx || 0, 0, n - 1); }
  function shoulderOff(axis, idx) { return cfg.LANE_W * lanesOf(axis, idx) + 1.65; }
  function shoulderMin(axis, idx) { return laneOff(axis, idx, lanesOf(axis, idx) - 1) + 1.9; }
  function laneIndexAt(axis, idx, lateral) { return TG.clamp(Math.round((lateral - cfg.LANE_OFF) / cfg.LANE_W), 0, lanesOf(axis, idx) - 1); }
  function sideOff(axis, idx) { return halfOf(axis, idx) + SW / 2; }   // 보도 중앙선(행인이 걷는 선)

  // ---- 블록 채우기 ----
  var buildings = [], trees = [], lamps = [], signs = [], roadTexts = [], parks = [], blocks = [], landmarks = [];
  var schoolBlock = { i: 1, j: 2 }, parkBlock = { i: 2, j: 1 };
  // 서울 강남·서초를 본뜬 배치(축약). 세로: 반포대로·논현로·강남대로(4차로)·언주로·선릉로 / 가로: 사평대로·도산대로·테헤란로(4차로)·역삼로·남부순환로.
  // 강남대로×테헤란로 = 강남역 사거리(중심). 랜드마크: 북동 무역센터·전시장(삼성동), 남서 법원(서초동), 남서 끝 예술의전당(돔), 북쪽 강남대로 쌍둥이 타워. 실존 상호·로고는 쓰지 않는다.
  // 서초구 위주 축약 지도: 남북 = 반포대로 · 서초중앙로 · 강남대로(강남구 경계) · 논현로 · 언주로, 동서 = 신반포로 · 사평대로 · 서초대로(강남역 동쪽은 테헤란로) · 효령로 · 남부순환로
  var roadNamesV = ['반포대로', '서초중앙로', '강남대로', '논현로', '언주로'], roadNamesH = ['신반포로', '사평대로', '테헤란로', '효령로', '남부순환로'];
  var NODE_NAMES = { '0,0': '고속터미널 사거리', '0,1': '서울성모병원 사거리', '0,2': '서초역 사거리', '1,2': '교대역 사거리', '2,2': '강남역 사거리', '3,2': '역삼역 사거리', '1,1': '반포 사거리', '0,3': '서초3동 사거리', '1,4': '남부터미널 사거리' };
  var LANDMARK_BLOCKS = { '3,0': 'trade', '0,3': 'court', '0,4': 'arts', '1,0': 'twin', '3,3': 'stadium', '0,0': 'terminal', '0,2': 'gu' };   // 고속버스터미널(신반포로·사평대로 사이, 반포대로 옆) · 서초구청(서초역 남쪽)   // + 고속버스터미널(반포) · 서초구청(서초역)
  // 가로 2번 도로는 강남대로 서쪽이 서초대로, 동쪽이 테헤란로(실제처럼 강남역에서 이름이 바뀐다)
  function hName(j, x) { return j === 2 ? (x < xs[2] ? '서초대로' : '테헤란로') : roadNamesH[j]; }
  function nodeName(node) { var nm = NODE_NAMES[node.i + ',' + node.j]; if (nm) return nm; return roadNamesV[node.i] + '·' + hName(node.j, node.x - 1) + ' 교차로'; }
  // 어린이보호구역: 학교 블록(1,2)에 붙은 논현로(x=xs[1])·역삼로(z=zs[3]) 구간. 간선(강남대로·테헤란로)은 제외.
  function inSchoolZone(x, z) {
    var sx0 = xs[schoolBlock.i], sx1 = xs[schoolBlock.i + 1], sz0 = zs[schoolBlock.j], sz1 = zs[schoolBlock.j + 1];
    if (Math.abs(x - sx0) <= halfV[schoolBlock.i] + 1 && z > sz0 + 12 && z < sz1 - 12) return true;
    if (Math.abs(z - sz1) <= halfH[schoolBlock.j + 1] + 1 && x > sx0 + 12 && x < sx1 - 12) return true;
    return false;
  }
  for (var bi = 0; bi < xs.length - 1; bi++) {
    for (var bj = 0; bj < zs.length - 1; bj++) {
      var x0 = xs[bi] + halfV[bi], x1 = xs[bi + 1] - halfV[bi + 1], z0 = zs[bj] + halfH[bj], z1 = zs[bj + 1] - halfH[bj + 1];
      var kind = (bi === parkBlock.i && bj === parkBlock.j) ? 'park' : (bi === schoolBlock.i && bj === schoolBlock.j) ? 'school' : 'city';
      blocks.push({ x0: x0, z0: z0, x1: x1, z1: z1, kind: kind });
      var ix0 = x0 + SW + 0.6, ix1 = x1 - SW - 0.6, iz0 = z0 + SW + 0.6, iz1 = z1 - SW - 0.6;
      if (kind === 'park') {
        parks.push({ x0: ix0, z0: iz0, x1: ix1, z1: iz1 });
        for (var t = 0; t < 26; t++) trees.push({ x: ix0 + 3 + rng() * (ix1 - ix0 - 6), z: iz0 + 3 + rng() * (iz1 - iz0 - 6), s: 0.8 + rng() * 0.8 });
        continue;
      }
      if (kind === 'school') {
        buildings.push({ x0: ix0 + 4, z0: iz0 + 4, x1: ix1 - 4, z1: iz0 + 18, h: 12, style: 'apt', seed: 7 });
        parks.push({ x0: ix0 + 4, z0: iz0 + 22, x1: ix1 - 4, z1: iz1 - 4 });
        for (var t2 = 0; t2 < 8; t2++) trees.push({ x: ix0 + 6 + rng() * (ix1 - ix0 - 12), z: iz1 - 6, s: 0.9 });
        continue;
      }
      var lmKind = LANDMARK_BLOCKS[bi + ',' + bj];
      if (lmKind) { landmarks.push({ kind: lmKind, x0: ix0, z0: iz0, x1: ix1, z1: iz1 }); blocks[blocks.length - 1].kind = 'landmark'; continue; }
      var nx = TG.irange(rng, 2, 3), nz = TG.irange(rng, 2, 3);
      var lotW = (ix1 - ix0 - (nx - 1) * 2.5) / nx, lotD = (iz1 - iz0 - (nz - 1) * 2.5) / nz;
      var cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, dc = Math.hypot(cx - 160, cz - 160) / 160;
      for (var lx = 0; lx < nx; lx++) for (var lz = 0; lz < nz; lz++) {
        var bx0 = ix0 + lx * (lotW + 2.5), bz0 = iz0 + lz * (lotD + 2.5), bx1 = bx0 + lotW, bz1 = bz0 + lotD, r = rng();
        if (r < 0.12) { for (var t3 = 0; t3 < 3; t3++) trees.push({ x: bx0 + 2 + rng() * (lotW - 4), z: bz0 + 2 + rng() * (lotD - 4), s: 0.7 + rng() * 0.6 }); continue; }
        var style, h;
        if (dc < 0.5) { style = r < 0.42 ? 'tower' : r < 0.72 ? 'office' : 'shop'; h = style === 'tower' ? 36 + rng() * 54 : style === 'office' ? 15 + rng() * 18 : 4 + rng() * 5; }
        else if (dc < 0.8) { style = r < 0.25 ? 'tower' : r < 0.55 ? 'apt' : r < 0.8 ? 'office' : 'shop'; h = style === 'tower' ? 30 + rng() * 30 : style === 'apt' ? 27 + rng() * 24 : style === 'office' ? 12 + rng() * 12 : 4 + rng() * 5; }
        else { style = r < 0.4 ? 'apt' : (r < 0.7 ? 'shop' : 'office'); h = style === 'apt' ? 24 + rng() * 21 : style === 'shop' ? 4 + rng() * 4 : 9 + rng() * 9; }
        h = Math.round(h / 3) * 3;
        var inset = style === 'apt' ? 3 : style === 'tower' ? 2 : 1.2;
        buildings.push({ x0: bx0 + inset, z0: bz0 + inset, x1: bx1 - inset, z1: bz1 - inset, h: h, style: style, seed: TG.irange(rng, 1, 999) });
      }
    }
  }

  // ---- 노면 도로명(블록 가운데, 우측 차로, 진행 방향으로 읽힘) ----
  for (var ri = 0; ri < xs.length; ri++) for (var rj = 0; rj < zs.length - 1; rj++) {
    if ((ri + rj) % 2) continue;
    var mzR = (zs[rj] + zs[rj + 1]) / 2, lo = laneOff('v', ri, 0);
    roadTexts.push({ x: xs[ri] + lo, z: mzR + 6, text: roadNamesV[ri], rot: TG.DIR_HEADING[2] });        // 북행 차로(우측 = +x)
    roadTexts.push({ x: xs[ri] - lo, z: mzR - 6, text: roadNamesV[ri], rot: TG.DIR_HEADING[0] });        // 남행 차로
  }
  for (var rj2 = 0; rj2 < zs.length; rj2++) for (var ri2 = 0; ri2 < xs.length - 1; ri2++) {
    if ((ri2 + rj2) % 2 === 0) continue;
    var mxR = (xs[ri2] + xs[ri2 + 1]) / 2, lo2 = laneOff('h', rj2, 0);
    roadTexts.push({ x: mxR + 6, z: zs[rj2] + lo2, text: hName(rj2, mxR), rot: TG.DIR_HEADING[1] });     // 동행 차로(우측 = +z)
    roadTexts.push({ x: mxR - 6, z: zs[rj2] - lo2, text: hName(rj2, mxR), rot: TG.DIR_HEADING[3] });     // 서행 차로(우측 = -z)
  }
  // ---- 가로등: 보도 바깥선(반폭 + 2.4), 24m 간격 ----
  for (var i2 = 0; i2 < xs.length; i2++) for (var z = zs[0] + 20; z < zs[zs.length - 1]; z += 24) {
    if (Math.abs(z - zs[nearestIdx(zs, z)]) < 14 + 4) continue;
    lamps.push({ x: xs[i2] + halfV[i2] + 2.4, z: z, rot: -Math.PI / 2 }); lamps.push({ x: xs[i2] - halfV[i2] - 2.4, z: z, rot: Math.PI / 2 });
  }
  for (var j2 = 0; j2 < zs.length; j2++) for (var x = xs[0] + 32; x < xs[xs.length - 1]; x += 24) {
    if (Math.abs(x - xs[nearestIdx(xs, x)]) < 14 + 4) continue;
    lamps.push({ x: x, z: zs[j2] + halfH[j2] + 2.4, rot: Math.PI }); lamps.push({ x: x, z: zs[j2] - halfH[j2] - 2.4, rot: 0 });
  }

  // ---- 표지판·노면 문자: 접근로 우측 보도 ----
  function approachSpot(node, d, back, side) {
    var f = TG.DIR_VEC[d], r = [-f[1], f[0]];
    return { x: node.x - f[0] * back + r[0] * side, z: node.z - f[1] * back + r[1] * side, rot: TG.DIR_HEADING[d] + Math.PI };
  }
  var schoolX0 = xs[schoolBlock.i], schoolX1 = xs[schoolBlock.i + 1], schoolZ0 = zs[schoolBlock.j], schoolZ1 = zs[schoolBlock.j + 1];
  for (var si = 0; si < xs.length; si++) for (var sj = 0; sj < zs.length; sj++) {
    for (var d = 0; d < 4; d++) {
      var f = TG.DIR_VEC[d], bi2 = si - f[0], bj2 = sj - f[1];
      if (bi2 < 0 || bj2 < 0 || bi2 >= xs.length || bj2 >= zs.length) continue;
      var node = nodes[si][sj], road = roadOf(node, d), sideS = halfOf(road.axis, road.idx) + 1.4, back0 = stopDist(node, d);
      var mx = node.x - f[0] * 30, mz = node.z - f[1] * 30;
      var nearSchool = (mx >= schoolX0 - 8 && mx <= schoolX1 + 8 && mz >= schoolZ0 - 8 && mz <= schoolZ1 + 8);
      var kindA = nearSchool ? 'school' : ((si * 3 + sj * 5 + d) % 4 === 0 ? (lanesOf(road.axis, road.idx) >= 2 ? 'limit50' : 'limit40') : (d % 2 === 0 ? 'crosswalk' : 'signalAhead'));
      signs.push(Object.assign(approachSpot(node, d, back0 + 15, sideS), { kind: kindA }));
      if (nearSchool) {
        signs.push(Object.assign(approachSpot(node, d, back0 + 10, sideS), { kind: 'limit30' }));
        roadTexts.push(Object.assign(approachSpot(node, d, back0 + 23, laneOff(road.axis, road.idx, 0)), { text: '어린이보호구역', rot: TG.DIR_HEADING[d] }));
      } else if ((si + sj + d) % 5 === 0) {
        roadTexts.push(Object.assign(approachSpot(node, d, back0 + 19, laneOff(road.axis, road.idx, 0)), { text: '천천히', rot: TG.DIR_HEADING[d] }));
      }
    }
  }

  // ---- 조회 ----
  function nearestX(x) { return xs[nearestIdx(xs, x)]; }
  function nearestZ(z) { return zs[nearestIdx(zs, z)]; }
  function inBounds(x, z) { return x >= bounds.x0 && x <= bounds.x1 && z >= bounds.z0 && z <= bounds.z1; }
  var EXT = Math.max.apply(null, halfV.concat(halfH)) + SW + 4;   // 스텁(도시 밖 연장) 길이 = 가장 넓은 도로 기준. IC 연결로 시작점과 같은 값이라 정확히 맞물린다
  function onRoad(x, z) {
    var i = nearestIdx(xs, x), j = nearestIdx(zs, z);
    var onV = Math.abs(x - xs[i]) <= halfV[i] && z >= zs[0] - EXT && z <= zs[zs.length - 1] + EXT;
    var onH = Math.abs(z - zs[j]) <= halfH[j] && x >= xs[0] - EXT && x <= xs[xs.length - 1] + EXT;
    return onV || onH;
  }
  function inIntersection(x, z) { var i = nearestIdx(xs, x), j = nearestIdx(zs, z); return Math.abs(x - xs[i]) <= halfV[i] && Math.abs(z - zs[j]) <= halfH[j]; }
  function onSidewalk(x, z) {
    if (onRoad(x, z)) return false;
    var i = nearestIdx(xs, x), j = nearestIdx(zs, z);
    return Math.abs(x - xs[i]) <= halfV[i] + SW || Math.abs(z - zs[j]) <= halfH[j] + SW;
  }
  // 진행 방향 기준 차로 좌표. lateral: 중앙선에서 우측(+).
  function laneFrame(x, z, heading) {
    var d = TG.headingToDir(heading), f = TG.DIR_VEC[d], r = [-f[1], f[0]];
    if (d === 0 || d === 2) { var i = nearestIdx(xs, x); return { axis: 'v', idx: i, center: xs[i], lateral: (x - xs[i]) * r[0], dir: d, half: halfV[i], lanes: lanesV[i] }; }
    var j = nearestIdx(zs, z); return { axis: 'h', idx: j, center: zs[j], lateral: (z - zs[j]) * r[1], dir: d, half: halfH[j], lanes: lanesH[j] };
  }
  function nodeAhead(x, z, d, tol) {
    tol = tol || 0;
    if (d === 0 || d === 2) {
      var i = nearestIdx(xs, x), j;
      if (d === 0) { for (j = 0; j < zs.length; j++) if (zs[j] > z + tol) return nodes[i][j]; }
      else { for (j = zs.length - 1; j >= 0; j--) if (zs[j] < z - tol) return nodes[i][j]; }
      return null;
    }
    var jj = nearestIdx(zs, z), ii;
    if (d === 1) { for (ii = 0; ii < xs.length; ii++) if (xs[ii] > x + tol) return nodes[ii][jj]; }
    else { for (ii = xs.length - 1; ii >= 0; ii--) if (xs[ii] < x - tol) return nodes[ii][jj]; }
    return null;
  }
  function nodeFrom(node, d) { var i = node.i + TG.DIR_VEC[d][0], j = node.j + TG.DIR_VEC[d][1]; if (i < 0 || j < 0 || i >= xs.length || j >= zs.length) return null; return nodes[i][j]; }
  function distToNearestNode(x, z) { return Math.max(Math.abs(x - nearestX(x)), Math.abs(z - nearestZ(z))); }
  // 가장 가까운 노드의 교차로·횡단보도 영역 안인가(정차 유도 시 피할 곳)
  function nearIntersectionZone(x, z) {
    var i = nearestIdx(xs, x), j = nearestIdx(zs, z);
    return Math.abs(x - xs[i]) <= halfV[i] + 8 && Math.abs(z - zs[j]) <= halfH[j] + 8;
  }

  var walls = [];
  // 막다른 스텁은 없다(소유자: 「길이 곳곳에 막혀 있다」). 도시 밖으로 이어지는 스텁은 IC 연결로가 붙는 8곳뿐이고,
  // 나머지 도로는 바깥 간선(반포대로·선릉로·사평대로·남부순환로)에서 T 자로 끝난다. world.js 가 이 함수로 스텁을 그릴지 정한다.
  function hasStub(axis, idx, end) {   // end: 0 = 북/서 끝, 1 = 남/동 끝
    if (axis === 'v') return idx === 0 || idx === 2 || idx === 4;
    return idx === 2;
  }
  function collideCircle(x, z, r) {
    for (var pass = 0; pass < 2; pass++) {
      for (var b = 0; b < buildings.length; b++) {
        var B = buildings[b];
        if (x < B.x0 - r || x > B.x1 + r || z < B.z0 - r || z > B.z1 + r) continue;
        var cx = TG.clamp(x, B.x0, B.x1), cz = TG.clamp(z, B.z0, B.z1), dx = x - cx, dz = z - cz, d2 = dx * dx + dz * dz;
        if (d2 < r * r && d2 > 1e-9) { var dd = Math.sqrt(d2), push = (r - dd) / dd; x += dx * push; z += dz * push; }
        else if (d2 <= 1e-9) { x = B.x1 + r; }
      }
      for (var w = 0; w < walls.length; w++) {
        var W = walls[w];
        if (Math.abs(W.x1 - x) > 12 && Math.abs(W.x2 - x) > 12) continue;
        if (Math.abs(W.z1 - z) > 12 && Math.abs(W.z2 - z) > 12) continue;
        var vx = W.x2 - W.x1, vz = W.z2 - W.z1, L2 = vx * vx + vz * vz || 1;
        var t = TG.clamp(((x - W.x1) * vx + (z - W.z1) * vz) / L2, 0, 1), px = W.x1 + vx * t, pz = W.z1 + vz * t, ex = x - px, ez = z - pz, e2 = ex * ex + ez * ez;
        if (e2 < r * r && e2 > 1e-9) { var ed = Math.sqrt(e2), pu = (r - ed) / ed; x += ex * pu; z += ez * pu; }
      }
      if (x < bounds.x0 + r) x = bounds.x0 + r; if (x > bounds.x1 - r) x = bounds.x1 - r;
      if (z < bounds.z0 + r) z = bounds.z0 + r; if (z > bounds.z1 - r) z = bounds.z1 - r;
    }
    return { x: x, z: z };
  }

  var spawn = { x: xs[2] - cfg.LANE_OFF, z: zs[1] + 30, heading: 0 };
  function inGridArea(x, z) {
    var i = nearestIdx(xs, x), j = nearestIdx(zs, z);
    var onV = Math.abs(x - xs[i]) <= halfV[i] && z >= zs[0] - EXT && z <= zs[zs.length - 1] + EXT;
    var onH = Math.abs(z - zs[j]) <= halfH[j] && x >= xs[0] - EXT && x <= xs[xs.length - 1] + EXT;
    return onV || onH;
  }
  var terrain = null;
  function frameAt(x, z, heading) {
    if (inGridArea(x, z) || (x > -20 && x < 340 && z > -20 && z < 340)) {
      var lf = laneFrame(x, z, heading), school = inSchoolZone(x, z);
      // 제한속도(안전속도 5030 취지): 4차로 간선 50, 2차로 40, 어린이보호구역 30
      var lim = school ? 30 : (lf.lanes >= 2 ? 50 : 40);
      return { kind: 'grid', name: (lf.axis === 'v' ? roadNamesV[lf.idx] : hName(lf.idx, x)) + '(왕복 ' + (lf.lanes * 2) + '차로)' + (school ? ' · 어린이보호구역' : ''), lateral: lf.lateral, limit: lim, half: lf.half, school: school,
               shoulder: shoulderOff(lf.axis, lf.idx), shoulderMin: shoulderMin(lf.axis, lf.idx), onRoad: onRoad(x, z), lanes: lf.lanes, y: 0, dir: lf.dir, axis: lf.axis, idx: lf.idx, center: lf.center };
    }
    if (terrain) {
      var q = terrain.nearest(x, z, true);
      if (q && q.dist > q.p.half) { var q2 = terrain.nearest(x, z, false); if (q2 && q2.dist <= q2.p.half) q = q2; }   // 램프 옆 본선 위(합류부)는 본선 프레임
      if (q && q.dist < q.p.half + 3) {
        var fx = Math.sin(heading), fz = Math.cos(heading), dirA = (fx * q.tx + fz * q.tz) >= 0, lat = dirA ? q.lateral : -q.lateral, p = q.p, k = p.kind;
        var hwN = (cfg.HW_LANES ? cfg.HW_LANES.length : 3) * 2;   // 실제 차로 수로 표기한다(고정 「6차로」 였다)
        var name = k === 'highway' ? (z < -120 ? '올림픽대로(왕복 ' + hwN + '차로)' : '순환고속도로(왕복 ' + hwN + '차로)') : k === 'suburb' ? '교외 도로(왕복 2차로)' : k === 'ramp' ? '진입로' : k === 'circuit' ? '연습 서킷' : '램프';
        var lim2 = k === 'highway' ? (z < -120 ? 80 : terrain.limitOf(k)) : terrain.limitOf(k);
        if (q.link.name) name = q.link.name + (k === 'suburb' ? '(왕복 2차로)' : '');
        if (q.link.limit) lim2 = q.link.limit;
        var oneLane = p.f < 0.5;
        return { kind: 'link', name: name, lateral: lat, limit: lim2, half: p.half, shoulder: terrain.shoulderOf(p),
                 shoulderMin: oneLane ? cfg.STOP_SHOULDER_MIN : cfg.HW_LANES[2] + 1.9, onRoad: q.dist <= p.half, lanes: oneLane ? 1 : 3,
                 y: q.y, link: q.link, i: q.i, dirA: dirA, busLane: !oneLane && lat > 0.3 && lat < 3.7, oneWay: q.link.oneWay, tx: dirA ? q.tx : -q.tx, tz: dirA ? q.tz : -q.tz, oneLane: oneLane };
      }
    }
    return { kind: 'off', name: '도로 밖', lateral: 0, limit: 999, half: 0, shoulder: 0, shoulderMin: 0, onRoad: false, lanes: 0, y: terrain ? terrain.heightAt(x, z) : 0 };
  }
  function onRoadAny(x, z) { if (onRoad(x, z)) return true; if (!terrain) return false; var q = terrain.nearest(x, z, true); return !!(q && q.dist <= q.p.half); }
  function heightAt(x, z) { return terrain ? terrain.heightAt(x, z) : 0; }

  var city = {
    xs: xs, zs: zs, nodes: nodes, bounds: bounds, buildings: buildings, trees: trees, lamps: lamps, signs: signs, roadTexts: roadTexts, parks: parks, blocks: blocks,
    schoolBlock: schoolBlock, spawn: spawn, walls: walls, halfV: halfV, halfH: halfH, lanesV: lanesV, lanesH: lanesH, EXT: EXT,
    landmarks: landmarks, roadNamesV: roadNamesV, roadNamesH: roadNamesH, hName: hName, nodeName: nodeName, hasStub: hasStub, inSchoolZone: inSchoolZone,
    nearestX: nearestX, nearestZ: nearestZ, nearestIdx: nearestIdx, inBounds: inBounds, onRoad: onRoad, onRoadAny: onRoadAny, inIntersection: inIntersection, onSidewalk: onSidewalk,
    laneFrame: laneFrame, frameAt: frameAt, nodeAhead: nodeAhead, nodeFrom: nodeFrom, distToNearestNode: distToNearestNode, nearIntersectionZone: nearIntersectionZone,
    collideCircle: collideCircle, heightAt: heightAt, inGridArea: inGridArea,
    axisOfDir: axisOfDir, halfOf: halfOf, lanesOf: lanesOf, roadOf: roadOf, crossHalf: crossHalf, stopDist: stopDist, crossNear: crossNear, crossFar: crossFar,
    laneOff: laneOff, shoulderOff: shoulderOff, shoulderMin: shoulderMin, sideOff: sideOff, laneIndexAt: laneIndexAt,
    attachTerrain: function (t) { terrain = t; city.terrain = t; bounds.x0 = t.bounds.x0; bounds.x1 = t.bounds.x1; bounds.z0 = t.bounds.z0; bounds.z1 = t.bounds.z1; for (var i = 0; i < t.walls.length; i++) walls.push(t.walls[i]); },
    exitFor: function (node, dir) { return terrain ? terrain.exitFor(node, dir) : null; },
  };
  return city;
};
