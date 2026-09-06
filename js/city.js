// 도로망 = 진실의 원천. 격자 도로(우측통행), 교차로 노드, 블록·건물·표지 배치, 충돌.
// 도로마다 폭이 다르다: 이면도로 왕복 2차로(반폭 6), 간선 왕복 4차로(반폭 10, 가운데 남북·동서 도로).
// 좌표계: y 위. heading h → forward f=(sin h, cos h), right r=(-fz, fx). 방위 0..3 = 남(+z) 동(+x) 북(-z) 서(-x).
TG.buildCity = function (cfg) {
  var rng = TG.makeRNG(cfg.SEED);
  var xs = cfg.ROAD_XS, zs = cfg.ROAD_ZS, SW = cfg.SIDEWALK_W;
  var M = cfg.WORLD_MARGIN;
  var bounds = { x0: xs[0] - M, x1: xs[xs.length - 1] + M, z0: zs[0] - M, z1: zs[zs.length - 1] + M };
  // 도로별 차로 수(편도) 와 반폭
  var lanesV = xs.map(function (_, i) { return cfg.AVENUE_V.indexOf(i) >= 0 ? 2 : 1; });
  var lanesH = zs.map(function (_, j) { return cfg.AVENUE_H.indexOf(j) >= 0 ? 2 : 1; });
  var halfV = lanesV.map(function (n) { return n === 2 ? cfg.ROAD_HALF4 : cfg.ROAD_HALF; });
  var halfH = lanesH.map(function (n) { return n === 2 ? cfg.ROAD_HALF4 : cfg.ROAD_HALF; });

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
  function laneOff(axis, idx, laneIdx) { return (laneIdx === 1 && lanesOf(axis, idx) === 2) ? cfg.LANE2_OFF : cfg.LANE_OFF; }
  function shoulderOff(axis, idx) { return lanesOf(axis, idx) === 2 ? cfg.SHOULDER4_OFF : cfg.SHOULDER_OFF; }
  function shoulderMin(axis, idx) { return lanesOf(axis, idx) === 2 ? cfg.LANE2_OFF + 1.9 : cfg.STOP_SHOULDER_MIN; }
  function sideOff(axis, idx) { return halfOf(axis, idx) + SW / 2; }   // 보도 중앙선(행인이 걷는 선)

  // ---- 블록 채우기 ----
  var buildings = [], trees = [], lamps = [], signs = [], roadTexts = [], parks = [], blocks = [];
  var schoolBlock = { i: 1, j: 2 }, parkBlock = { i: 2, j: 1 };
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
      var nx = TG.irange(rng, 2, 3), nz = TG.irange(rng, 2, 3);
      var lotW = (ix1 - ix0 - (nx - 1) * 2.5) / nx, lotD = (iz1 - iz0 - (nz - 1) * 2.5) / nz;
      var cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, dc = Math.hypot(cx - 160, cz - 160) / 160;
      for (var lx = 0; lx < nx; lx++) for (var lz = 0; lz < nz; lz++) {
        var bx0 = ix0 + lx * (lotW + 2.5), bz0 = iz0 + lz * (lotD + 2.5), bx1 = bx0 + lotW, bz1 = bz0 + lotD, r = rng();
        if (r < 0.12) { for (var t3 = 0; t3 < 3; t3++) trees.push({ x: bx0 + 2 + rng() * (lotW - 4), z: bz0 + 2 + rng() * (lotD - 4), s: 0.7 + rng() * 0.6 }); continue; }
        var style, h;
        if (dc < 0.45) { style = r < 0.55 ? 'office' : 'shop'; h = style === 'office' ? 12 + rng() * 15 : 4 + rng() * 5; }
        else { style = r < 0.4 ? 'apt' : (r < 0.7 ? 'shop' : 'office'); h = style === 'apt' ? 24 + rng() * 21 : style === 'shop' ? 4 + rng() * 4 : 9 + rng() * 9; }
        h = Math.round(h / 3) * 3;
        var inset = style === 'apt' ? 3 : 1.2;
        buildings.push({ x0: bx0 + inset, z0: bz0 + inset, x1: bx1 - inset, z1: bz1 - inset, h: h, style: style, seed: TG.irange(rng, 1, 999) });
      }
    }
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
      var kindA = nearSchool ? 'school' : ((si * 3 + sj * 5 + d) % 4 === 0 ? 'limit50' : (d % 2 === 0 ? 'crosswalk' : 'signalAhead'));
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
  var EXT = cfg.ROAD_HALF + SW + 4;
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
  // 격자 도로 스텁 끝 8곳(도시 밖으로 이어지지 않는 곳)에 낮은 벽: 차가 도로 밖으로 나가지 않는다. 북(2,0)·동(4,2) 스텁은 연결로로 이어진다.
  (function () {
    for (var i = 0; i < xs.length; i++) {
      if (i === 1 || i === 3) walls.push({ x1: xs[i] - halfV[i], z1: zs[0] - EXT + 0.6, x2: xs[i] + halfV[i], z2: zs[0] - EXT + 0.6, stub: true });
      if (i === 1 || i === 3) walls.push({ x1: xs[i] - halfV[i], z1: zs[zs.length - 1] + EXT - 0.6, x2: xs[i] + halfV[i], z2: zs[zs.length - 1] + EXT - 0.6, stub: true });
    }
    for (var j = 0; j < zs.length; j++) {
      if (j !== 2) walls.push({ x1: xs[0] - EXT + 0.6, z1: zs[j] - halfH[j], x2: xs[0] - EXT + 0.6, z2: zs[j] + halfH[j], stub: true });
      if (j !== 2) walls.push({ x1: xs[xs.length - 1] + EXT - 0.6, z1: zs[j] - halfH[j], x2: xs[xs.length - 1] + EXT - 0.6, z2: zs[j] + halfH[j], stub: true });
    }
  })();
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
      var lf = laneFrame(x, z, heading);
      return { kind: 'grid', name: lf.lanes === 2 ? '시내 간선(왕복 4차로)' : '시내(왕복 2차로)', lateral: lf.lateral, limit: cfg.ROAD_LIMIT_KMH, half: lf.half,
               shoulder: shoulderOff(lf.axis, lf.idx), shoulderMin: shoulderMin(lf.axis, lf.idx), onRoad: onRoad(x, z), lanes: lf.lanes, y: 0, dir: lf.dir, axis: lf.axis, idx: lf.idx, center: lf.center };
    }
    if (terrain) {
      var q = terrain.nearest(x, z, true);
      if (q && q.dist < q.p.half + 3) {
        var fx = Math.sin(heading), fz = Math.cos(heading), dirA = (fx * q.tx + fz * q.tz) >= 0, lat = dirA ? q.lateral : -q.lateral, p = q.p, k = p.kind;
        var name = k === 'highway' ? '순환고속도로(왕복 6차로)' : k === 'suburb' ? '교외 도로(왕복 2차로)' : k === 'ramp' ? '진입로' : '램프';
        var oneLane = p.f < 0.5;
        return { kind: 'link', name: name, lateral: lat, limit: terrain.limitOf(k), half: p.half, shoulder: terrain.shoulderOf(p),
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
    nearestX: nearestX, nearestZ: nearestZ, nearestIdx: nearestIdx, inBounds: inBounds, onRoad: onRoad, onRoadAny: onRoadAny, inIntersection: inIntersection, onSidewalk: onSidewalk,
    laneFrame: laneFrame, frameAt: frameAt, nodeAhead: nodeAhead, nodeFrom: nodeFrom, distToNearestNode: distToNearestNode, nearIntersectionZone: nearIntersectionZone,
    collideCircle: collideCircle, heightAt: heightAt, inGridArea: inGridArea,
    axisOfDir: axisOfDir, halfOf: halfOf, lanesOf: lanesOf, roadOf: roadOf, crossHalf: crossHalf, stopDist: stopDist, crossNear: crossNear, crossFar: crossFar,
    laneOff: laneOff, shoulderOff: shoulderOff, shoulderMin: shoulderMin, sideOff: sideOff,
    attachTerrain: function (t) { terrain = t; city.terrain = t; bounds.x0 = t.bounds.x0; bounds.x1 = t.bounds.x1; bounds.z0 = t.bounds.z0; bounds.z1 = t.bounds.z1; for (var i = 0; i < t.walls.length; i++) walls.push(t.walls[i]); },
    exitFor: function (node, dir) { return terrain ? terrain.exitFor(node, dir) : null; },
  };
  return city;
};
