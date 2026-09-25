// 🏢 실제 건물 윤곽(v0.10.31) — 소유자 「제대로 게임과 디지털 트윈이 되게」.
//  **1:1 지도에서만 쓴다.** 축약 지도(seocho-twin)는 도로 간격을 약 13배 압축해 담아 실제 건물을 넣을 수 없다
//  (실측: 사당역↔강남역 실제 4,725m 가 게임 360 units · 1 unit ≈ 13.1m → 40m 건물이 3 units).
//  자료는 OpenStreetMap(ODbL) 건물 윤곽 그대로이고, **층수(building:levels)가 있으면 그 값 × 3.2m**,
//  없으면 **바닥 넓이로 어림한다**(그것은 설계값이라고 화면에 적는다).
TG.RealBuild = function () {
  var self = this, group = null, info = { count: 0, withLevels: 0, source: '' };
  var named = [];   // 이름이 있는 건물(OSM name 태그) — 「이 자리」 조회가 쓴다

  function area2(p) {   // 다각형 넓이(신발끈) — 방향(시계/반시계)도 여기서 나온다
    var s = 0;
    for (var i = 0, n = p.length; i < n; i++) { var a = p[i], b = p[(i + 1) % n]; s += a[0] * b[1] - b[0] * a[1]; }
    return s / 2;
  }
  function centroid(p) {
    var cx = 0, cz = 0, a = area2(p);
    if (Math.abs(a) < 1e-6) {
      for (var k = 0; k < p.length; k++) { cx += p[k][0]; cz += p[k][1]; }
      return [cx / p.length, cz / p.length];
    }
    for (var i = 0, n = p.length; i < n; i++) {
      var q = p[i], r = p[(i + 1) % n], f = q[0] * r[1] - r[0] * q[1];
      cx += (q[0] + r[0]) * f; cz += (q[1] + r[1]) * f;
    }
    return [cx / (6 * a), cz / (6 * a)];
  }
  // 층수가 없을 때의 높이 — **설계값**이다. 바닥이 넓으면 높게(아파트·오피스), 좁으면 낮게(상가·주택).
  function guessH(ar) {
    if (ar > 2200) return 34;
    if (ar > 1200) return 24;
    if (ar > 600) return 15;
    if (ar > 250) return 9;
    return 5.5;
  }
  var TINT = [0xf1efe9, 0xe8e3d6, 0xdfe4ea, 0xd8dee6, 0xe6d9c8, 0xcfd6dd];

  // ⚠ 우리 격자는 **곧은 선**이고 실제 반포대로·서초대로는 굽는다. 그래서 실제 윤곽 가운데 일부가
  //  우리 차도 위에 걸친다(실측: 114동 중 51동). **건물이 차로 한가운데 서 있는 것은 사고다**(v0.9.10 clearSpot 과 같은 규칙).
  //  자료 파일은 OSM 원본 그대로 두고 **그리는 쪽에서** 비킨다 — 12m 안이면 밀어내고, 그보다 크면 그 동은 그리지 않는다.
  //  밀어낸 동수·지운 동수를 info() 에 담아 화면에 그대로 적는다. **지어내지 않고, 차로에도 세우지 않는다.**
  var CLEAR_MARGIN = 2.5, CLEAR_MAX = 12;
  function clearRoads(p, city) {
    if (!city || !city.halfOf || !TG.MAP || !TG.MAP.grid) return [0, 0];
    var g = TG.MAP.grid, dx = 0, dz = 0, x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9, i;
    for (i = 0; i < p.length; i++) {
      if (p[i][0] < x0) x0 = p[i][0]; if (p[i][0] > x1) x1 = p[i][0];
      if (p[i][1] < z0) z0 = p[i][1]; if (p[i][1] > z1) z1 = p[i][1];
    }
    (g.xs || []).forEach(function (c, k) {
      var h = city.halfOf('v', k) + CLEAR_MARGIN;
      if (x1 > c - h && x0 < c + h) {
        var L = (c - h) - x1, R = (c + h) - x0, d = Math.abs(L) < Math.abs(R) ? L : R;
        if (Math.abs(d) > Math.abs(dx)) dx = d;
      }
    });
    (g.zs || []).forEach(function (c, k) {
      var h = city.halfOf('h', k) + CLEAR_MARGIN;
      if (z1 > c - h && z0 < c + h) {
        var U = (c - h) - z1, D = (c + h) - z0, d = Math.abs(U) < Math.abs(D) ? U : D;
        if (Math.abs(d) > Math.abs(dz)) dz = d;
      }
    });
    return [dx, dz];
  }
  // 격자 말고도 도로는 더 있다 — 순환 고속도로·연결로·램프·연습 서킷(굽은 도로라 축으로 못 민다).
  //  가장 깊이 박힌 점을 찾아 **그 도로의 직각 바깥으로** 조금씩 밀어 본다(최대 6번).
  //  CLEAR_MAX 를 넘으면 포기하고 그 동은 그리지 않는다 — 없는 자리에 세우지 않는다.
  function clearLinks(p, city, terrain, dx, dz) {
    if (!city || !city.onRoadAny || !terrain || !terrain.nearest) return [dx, dz];
    for (var it = 0; it < 6; it++) {
      var wd = 0, wx = 0, wz = 0;
      for (var i = 0; i < p.length; i++) {
        var qx = p[i][0] + dx, qz = p[i][1] + dz;
        if (!city.onRoadAny(qx, qz)) continue;
        var nr = terrain.nearest(qx, qz); if (!nr) continue;
        var half = (nr.p && nr.p.half) || (nr.link && nr.link.half) || 8;
        var depth = half + CLEAR_MARGIN - nr.dist;
        if (depth > wd) {
          wd = depth;
          var sg = nr.lateral >= 0 ? 1 : -1;
          wx = -nr.tz * sg; wz = nr.tx * sg;
        }
      }
      if (wd <= 0) break;
      dx += wx * (wd + 0.4); dz += wz * (wd + 0.4);
      if (Math.hypot(dx, dz) > CLEAR_MAX) return null;
    }
    return [dx, dz];
  }

  this.build = function (scene, data, terrain, city) {
    self.clear(scene);
    if (!data || !data.buildings || !window.THREE || !TG.GeoBuilder) return info;
    named = [];
    var gb = new TG.GeoBuilder(), roof = new TG.GeoBuilder(), n = 0, lv = 0, moved = 0, dropped = 0, maxMove = 0, wet = 0, steep = 0;
    data.buildings.forEach(function (b, bi) {
      var p = b.p; if (!p || p.length < 3) return;
      // 마지막 점이 첫 점과 같으면(닫힌 고리) 하나 뺀다 — 벽이 겹쳐 z-싸움이 난다
      if (p.length > 3 && p[0][0] === p[p.length - 1][0] && p[0][1] === p[p.length - 1][1]) p = p.slice(0, -1);
      var ar = Math.abs(area2(p));
      if (ar < 20) return;                                   // 20㎡ 미만은 그리지 않는다(성능)
      // 차도를 비킨다 — 12m 안이면 밀고, 그보다 크면 그 동은 그리지 않는다
      var off = clearRoads(p, city);
      if (Math.hypot(off[0], off[1]) > CLEAR_MAX) { dropped++; return; }
      off = clearLinks(p, city, terrain, off[0], off[1]);
      if (!off) { dropped++; return; }
      var od = Math.hypot(off[0], off[1]);
      if (od > CLEAR_MAX) { dropped++; return; }
      if (od > 0.01) {
        p = p.map(function (q) { return [q[0] + off[0], q[1] + off[1]]; });
        moved++; if (od > maxMove) maxMove = od;
      }
      // 밀고 나서도 차도에 걸치면 그 동은 그리지 않는다(곡선·교차 구간) — 차로 한가운데 건물은 사고다
      if (city && city.onRoadAny) {
        for (var pi = 0; pi < p.length; pi++) {
          if (city.onRoadAny(p[pi][0], p[pi][1])) { dropped++; if (od > 0.01) moved--; return; }
        }
      }
      var h = (b.lv > 0) ? b.lv * 3.2 : guessH(ar);
      if (b.lv > 0) lv++;
      var c = centroid(p);
      // 바닥 높이는 **네 모퉁이 중 가장 낮은 곳**이다 — 가운데로 잡으면 비탈에서 한쪽이 공중에 뜬다.
      //  물 위(−1m 아래)이거나 4m 넘게 기울어진 자리는 그리지 않는다 — 이 지도의 지형(한강·우면산·고속도로 둑)은
      //  축약 지도에 맞춘 절대 좌표라 1:1 지도에서는 실제 건물 자리와 겹친다(실측 30동). **물 위에 건물을 세우지 않는다.**
      var y0 = 0, yHi = 0;
      if (terrain) {
        y0 = 1e9; yHi = -1e9;
        for (var gi = 0; gi < p.length; gi++) {
          var gy = terrain.groundAt(p[gi][0], p[gi][1]);
          if (gy < y0) y0 = gy; if (gy > yHi) yHi = gy;
        }
        if (y0 < -1) { wet++; dropped++; return; }
        if (yHi - y0 > 4) { steep++; dropped++; return; }
      }
      var tint = TINT[(bi + Math.round(ar)) % TINT.length];
      var ccw = area2(p) > 0;
      for (var i = 0; i < p.length; i++) {
        var a = p[i], q = p[(i + 1) % p.length];
        var dx = q[0] - a[0], dz = q[1] - a[1], L = Math.hypot(dx, dz);
        if (!(L > 0.2)) continue;
        var nx = (ccw ? dz : -dz) / L, nz = (ccw ? -dx : dx) / L;   // 바깥을 보는 법선
        gb.quad([a[0], y0, a[1]], [q[0], y0, q[1]], [q[0], y0 + h, q[1]], [a[0], y0 + h, a[1]],
                [nx, 0, nz], tint, [[0, 0], [L / 6, 0], [L / 6, h / 3], [0, h / 3]]);
      }
      // 지붕 — 무게중심에서 부채꼴로. 오목한 건물은 조금 어긋나지만 위에서만 보이고 사람 눈높이에서는 안 보인다.
      for (var j = 0; j < p.length; j++) {
        var s0 = p[j], s1 = p[(j + 1) % p.length];
        roof.quad([c[0], y0 + h, c[1]], [s0[0], y0 + h, s0[1]], [s1[0], y0 + h, s1[1]], [c[0], y0 + h, c[1]],
                  [0, 1, 0], 0x3a3f47, null);
      }
      // ⚠ c 는 **이미 비킨 뒤의** 윤곽에서 낸 무게중심이다 — off 를 또 더하면 두 번 밀린다
      if (b.n) named.push({ name: b.n, x: c[0], z: c[1], lv: b.lv || 0 });
      n++;
    });
    group = new THREE.Group();
    var matW = new THREE.MeshLambertMaterial({ vertexColors: true });
    var matR = new THREE.MeshLambertMaterial({ vertexColors: true });
    TG.mats = TG.mats || { road: [], ground: [] }; TG.mats.ground.push(matW, matR);
    var mw = new THREE.Mesh(gb.build(), matW); mw.name = 'realWall'; mw.castShadow = true; mw.receiveShadow = true;
    var mr = new THREE.Mesh(roof.build(), matR); mr.name = 'realRoof'; mr.receiveShadow = true;
    mw.matrixAutoUpdate = false; mr.matrixAutoUpdate = false;
    group.add(mw); group.add(mr); scene.add(group);
    info = { count: n, withLevels: lv, moved: moved, dropped: dropped, wet: wet, steep: steep, maxMove: +maxMove.toFixed(1), source: data.source || '' };
    return info;
  };
  this.clear = function (scene) { if (group && scene) scene.remove(group); group = null; };
  this.info = function () { return info; };
  // 이 자리 가까운 **이름 있는** 건물(OSM name) — 「📍 이 자리」 조회용
  this.near = function (x, z, rad) {
    rad = rad || 120; var out = [];
    named.forEach(function (b) {
      var d = Math.hypot(b.x - x, b.z - z);
      if (d <= rad) out.push({ name: b.name, lv: b.lv, dist: Math.round(d) });
    });
    out.sort(function (a, b) { return a.dist - b.dist; });
    return out;
  };
};
