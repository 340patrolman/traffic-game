// 도시 정적 메시. 전부 코드로 생성. 같은 재질끼리 하나의 지오메트리로 합쳐 드로우콜을 아낀다. 도로 폭은 city 가 정한다(왕복 2·4차로).
(function () {
  function GeoBuilder() { this.pos = []; this.nor = []; this.uv = []; this.col = []; this.idx = []; this.n = 0; }
  function rgb(hex) { return [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255]; }
  GeoBuilder.prototype.quad = function (a, b, c, d, nrm, color, uvs) {
    var col = rgb(color), base = this.n, P = [a, b, c, d];
    uvs = uvs || [[0, 0], [1, 0], [1, 1], [0, 1]];
    for (var i = 0; i < 4; i++) { this.pos.push(P[i][0], P[i][1], P[i][2]); this.nor.push(nrm[0], nrm[1], nrm[2]); this.uv.push(uvs[i][0], uvs[i][1]); this.col.push(col[0], col[1], col[2]); }
    this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    this.n += 4;
  };
  GeoBuilder.prototype.rect = function (x, z, w, d, rotY, y, color, uvS) {
    var c = Math.cos(rotY), s = Math.sin(rotY), hw = w / 2, hd = d / 2;
    function pt(lx, lz) { return [x + lx * c + lz * s, y, z - lx * s + lz * c]; }
    var uv = uvS ? [[0, 0], [w / uvS, 0], [w / uvS, d / uvS], [0, d / uvS]] : null;
    this.quad(pt(-hw, hd), pt(hw, hd), pt(hw, -hd), pt(-hw, -hd), [0, 1, 0], color, uv);
  };
  GeoBuilder.prototype.vquad = function (x, y, z, w, h, rotY, color, uvScale) {
    var fx = Math.sin(rotY), fz = Math.cos(rotY), rx = -fz, rz = fx, hw = w / 2, hh = h / 2;
    var L = [x + rx * hw, z + rz * hw], R = [x - rx * hw, z - rz * hw];
    var su = uvScale ? w / uvScale[0] : 1, sv = uvScale ? h / uvScale[1] : 1;
    this.quad([L[0], y - hh, L[1]], [R[0], y - hh, R[1]], [R[0], y + hh, R[1]], [L[0], y + hh, L[1]], [fx, 0, fz], color, [[0, 0], [su, 0], [su, sv], [0, sv]]);
  };
  GeoBuilder.prototype.box = function (cx, cy, cz, w, h, d, color, opts) {
    opts = opts || {};
    var rot = opts.rotY || 0, c = Math.cos(rot), s = Math.sin(rot), hw = w / 2, hh = h / 2, hd = d / 2;
    function P(lx, ly, lz) { return [cx + lx * c + lz * s, cy + ly, cz - lx * s + lz * c]; }
    var us = opts.uvScale;
    function uv(len, hgt) { return us ? [[0, 0], [len / us[0], 0], [len / us[0], hgt / us[1]], [0, hgt / us[1]]] : null; }
    var fN = [s, 0, c], bN = [-s, 0, -c], rN = [c, 0, -s], lN = [-c, 0, s];
    this.quad(P(-hw, -hh, hd), P(hw, -hh, hd), P(hw, hh, hd), P(-hw, hh, hd), fN, color, uv(w, h));
    this.quad(P(hw, -hh, -hd), P(-hw, -hh, -hd), P(-hw, hh, -hd), P(hw, hh, -hd), bN, color, uv(w, h));
    this.quad(P(hw, -hh, hd), P(hw, -hh, -hd), P(hw, hh, -hd), P(hw, hh, hd), rN, color, uv(d, h));
    this.quad(P(-hw, -hh, -hd), P(-hw, -hh, hd), P(-hw, hh, hd), P(-hw, hh, -hd), lN, color, uv(d, h));
    if (!opts.noTop && !opts.sidesOnly) this.quad(P(-hw, hh, hd), P(hw, hh, hd), P(hw, hh, -hd), P(-hw, hh, -hd), [0, 1, 0], color, null);
    if (!opts.noBottom && !opts.sidesOnly) this.quad(P(-hw, -hh, -hd), P(hw, -hh, -hd), P(hw, -hh, hd), P(-hw, -hh, hd), [0, -1, 0], color, null);
  };
  GeoBuilder.prototype.cylinder = function (cx, cy, cz, r0, r1, h, seg, color, capTop) {
    var col = rgb(color), base = this.n;
    for (var i = 0; i <= seg; i++) {
      var a = i / seg * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
      this.pos.push(cx + ca * r0, cy, cz + sa * r0); this.nor.push(ca, 0, sa); this.uv.push(i / seg, 0); this.col.push(col[0], col[1], col[2]);
      this.pos.push(cx + ca * r1, cy + h, cz + sa * r1); this.nor.push(ca, 0, sa); this.uv.push(i / seg, 1); this.col.push(col[0], col[1], col[2]);
    }
    for (var k = 0; k < seg; k++) { var b = base + k * 2; this.idx.push(b, b + 3, b + 2, b, b + 1, b + 3); }
    this.n += (seg + 1) * 2;
    if (capTop) {
      var cb = this.n;
      this.pos.push(cx, cy + h, cz); this.nor.push(0, 1, 0); this.uv.push(0.5, 0.5); this.col.push(col[0], col[1], col[2]);
      for (var m = 0; m <= seg; m++) { var am = m / seg * Math.PI * 2; this.pos.push(cx + Math.cos(am) * r1, cy + h, cz + Math.sin(am) * r1); this.nor.push(0, 1, 0); this.uv.push(0.5, 0.5); this.col.push(col[0], col[1], col[2]); }
      for (var q = 0; q < seg; q++) this.idx.push(cb, cb + 2 + q, cb + 1 + q);
      this.n += seg + 2;
    }
  };
  GeoBuilder.prototype.beam = function (a, b, t, color) {
    var dx = b[0] - a[0], dz = b[2] - a[2], L = Math.hypot(dx, dz) || 1, nx = -dz / L * t, nz = dx / L * t;
    this.quad([a[0] + nx, a[1] + t, a[2] + nz], [b[0] + nx, b[1] + t, b[2] + nz], [b[0] - nx, b[1] + t, b[2] - nz], [a[0] - nx, a[1] + t, a[2] - nz], [0, 1, 0], color, null);
    this.quad([a[0] - nx, a[1] - t, a[2] - nz], [b[0] - nx, b[1] - t, b[2] - nz], [b[0] + nx, b[1] - t, b[2] + nz], [a[0] + nx, a[1] - t, a[2] + nz], [0, -1, 0], color, null);
  };
  GeoBuilder.prototype.build = function () {
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setIndex(this.idx); g.computeBoundingSphere(); return g;
  };
  GeoBuilder.prototype.empty = function () { return this.n === 0; };
  TG.GeoBuilder = GeoBuilder;

  TG.buildWorld = function (scene, city, cfg) {
    var SW = cfg.SIDEWALK_W, xs = city.xs, zs = city.zs, hV = city.halfV, hH = city.halfH, EXT = city.EXT;
    var statics = [];
    function addMesh(geo, mat, cast, receive) { var m = new THREE.Mesh(geo, mat); m.castShadow = !!cast; m.receiveShadow = !!receive; m.matrixAutoUpdate = false; m.updateMatrix(); scene.add(m); statics.push(m); return m; }
    var lambertVC = new THREE.MeshLambertMaterial({ vertexColors: true });
    TG.mats = TG.mats || { road: [], ground: [] }; TG.mats.ground.push(lambertVC);
    var basicVC = new THREE.MeshBasicMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });

    // 도로(아스팔트 텍스처): 도로마다 폭
    var road = new GeoBuilder();
    // 스텁(도시 밖으로 나가는 짧은 연장)은 IC 연결로가 붙는 도로에만 그린다. 나머지는 바깥 간선의 교차로 상자에서 끝난다(막다른 길 없음).
    var zL = zs[zs.length - 1], xL = xs[xs.length - 1];
    for (var i = 0; i < xs.length; i++) { var sv = city.hasStub('v', i, 0), za = zs[0] - (sv ? EXT : hH[0]), zb = zL + (sv ? EXT : hH[zs.length - 1]); road.rect(xs[i], (za + zb) / 2, hV[i] * 2, zb - za, 0, 0.05, 0xffffff, 8); }
    for (var j = 0; j < zs.length; j++) { var sh = city.hasStub('h', j, 0), xa = xs[0] - (sh ? EXT : hV[0]), xb = xL + (sh ? EXT : hV[xs.length - 1]); road.rect((xa + xb) / 2, zs[j], xb - xa, hH[j] * 2, 0, 0.05, 0xffffff, 8); }
    var roadMatW = new THREE.MeshLambertMaterial({ map: TG.tex.asphalt(), vertexColors: true }); TG.mats.road.push(roadMatW);
    addMesh(road.build(), roadMatW, false, true);

    // 보도 + 연석 + 공원
    var walk = new GeoBuilder(), curb = new GeoBuilder();
    function slab(x0, z0, x1, z1) {
      walk.rect((x0 + x1) / 2, (z0 + z1) / 2, x1 - x0, z1 - z0, 0, 0.2, 0xffffff, 2);
      curb.box((x0 + x1) / 2, 0.1, z0 + 0.15, x1 - x0, 0.2, 0.3, 0xa9a59c, { noBottom: true }); curb.box((x0 + x1) / 2, 0.1, z1 - 0.15, x1 - x0, 0.2, 0.3, 0xa9a59c, { noBottom: true });
      curb.box(x0 + 0.15, 0.1, (z0 + z1) / 2, 0.3, 0.2, z1 - z0, 0xa9a59c, { noBottom: true }); curb.box(x1 - 0.15, 0.1, (z0 + z1) / 2, 0.3, 0.2, z1 - z0, 0xa9a59c, { noBottom: true });
      curb.box((x0 + x1) / 2, 0.09, (z0 + z1) / 2, x1 - x0, 0.18, z1 - z0, 0xb3afa6, { sidesOnly: true });
    }
    city.blocks.forEach(function (b) { slab(b.x0, b.z0, b.x1, b.z1); });
    var o0 = xs[0] - hV[0], o1 = xs[xs.length - 1] + hV[xs.length - 1], p0 = zs[0] - hH[0], p1 = zs[zs.length - 1] + hH[zs.length - 1];
    slab(o0 - SW, p0 - SW, o1 + SW, p0); slab(o0 - SW, p1, o1 + SW, p1 + SW); slab(o0 - SW, p0, o0, p1); slab(o1, p0, o1 + SW, p1);
    var walkMat = new THREE.MeshLambertMaterial({ map: TG.tex.paving(), vertexColors: true }); TG.mats.road.push(walkMat);
    addMesh(walk.build(), walkMat, false, true);
    addMesh(curb.build(), lambertVC, false, true);
    var park = new GeoBuilder();
    city.parks.forEach(function (p) { park.rect((p.x0 + p.x1) / 2, (p.z0 + p.z1) / 2, p.x1 - p.x0, p.z1 - p.z0, 0, 0.21, 0x6f9a4c); });
    addMesh(park.build(), lambertVC, false, true);

    // 노면 표시: 중앙 황색 복선, 차로 경계(4차로면 3.7 점선), 가장자리 실선
    var mk = new GeoBuilder(), Y = 0.07, YEL = 0xf0c000, WHT = 0xf2f2ee;
    function seg(axis, fixed, a0, a1, lanes) {
      var len = a1 - a0, mid = (a0 + a1) / 2; if (len <= 0) return;
      var edge = 0.25 + cfg.LANE_W * lanes;   // 마지막 차로 밖 가장자리 실선
      function line(off, wdt, col) { if (axis === 'v') mk.rect(fixed + off, mid, wdt, len, 0, Y, col); else mk.rect(mid, fixed + off, len, wdt, 0, Y, col); }
      line(-0.22, 0.15, YEL); line(0.22, 0.15, YEL); line(-edge, 0.14, WHT); line(edge, 0.14, WHT);
      for (var lk = 1; lk < lanes; lk++) {   // 차로 사이 점선(4m 선, 4m 공백) — 편도 차로 수 −1 개
        var bnd = 0.25 + cfg.LANE_W * lk;
        for (var s = a0 + 1; s < a1 - 2; s += 8) {
          if (axis === 'v') { mk.rect(fixed - bnd, s + 2, 0.14, 4, 0, Y, WHT); mk.rect(fixed + bnd, s + 2, 0.14, 4, 0, Y, WHT); }
          else { mk.rect(s + 2, fixed - bnd, 4, 0.14, 0, Y, WHT); mk.rect(s + 2, fixed + bnd, 4, 0.14, 0, Y, WHT); }
        }
      }
    }
    for (var i2 = 0; i2 < xs.length; i2++) {
      var nd0 = city.nodes[i2][0], ndL = city.nodes[i2][zs.length - 1];
      if (city.hasStub('v', i2, 0)) seg('v', xs[i2], zs[0] - EXT, zs[0] - city.crossFar(nd0, 0), city.lanesV[i2]);
      for (var j2 = 0; j2 < zs.length - 1; j2++) seg('v', xs[i2], zs[j2] + city.crossFar(city.nodes[i2][j2], 2), zs[j2 + 1] - city.crossFar(city.nodes[i2][j2 + 1], 0), city.lanesV[i2]);
      if (city.hasStub('v', i2, 1)) seg('v', xs[i2], zs[zs.length - 1] + city.crossFar(ndL, 2), zs[zs.length - 1] + EXT, city.lanesV[i2]);
    }
    for (var j3 = 0; j3 < zs.length; j3++) {
      var nd1 = city.nodes[0][j3], ndR = city.nodes[xs.length - 1][j3];
      if (city.hasStub('h', j3, 0)) seg('h', zs[j3], xs[0] - EXT, xs[0] - city.crossFar(nd1, 1), city.lanesH[j3]);
      for (var i3 = 0; i3 < xs.length - 1; i3++) seg('h', zs[j3], xs[i3] + city.crossFar(city.nodes[i3][j3], 3), xs[i3 + 1] - city.crossFar(city.nodes[i3 + 1][j3], 1), city.lanesH[j3]);
      if (city.hasStub('h', j3, 1)) seg('h', zs[j3], xs[xs.length - 1] + city.crossFar(ndR, 3), xs[xs.length - 1] + EXT, city.lanesH[j3]);
    }
    // 교차로: 접근로마다 정지선(접근 도로의 우측 반폭) + 횡단보도(접근 도로 전폭)
    for (var ni = 0; ni < xs.length; ni++) for (var nj = 0; nj < zs.length; nj++) {
      var node = city.nodes[ni][nj];
      for (var d = 0; d < 4; d++) {
        var f = TG.DIR_VEC[d], r = [-f[1], f[0]];
        if (!city.nodeFrom(node, (d + 2) % 4) && !city.exitFor(node, (d + 2) % 4)) continue;
        var rd = city.roadOf(node, d), half = city.halfOf(rd.axis, rd.idx), rot = TG.DIR_HEADING[d];
        var sd = city.stopDist(node, d), cn = city.crossNear(node, d), cf = city.crossFar(node, d), cm = (cn + cf) / 2, cl = cf - cn;
        mk.rect(node.x - f[0] * sd + r[0] * (half / 2 + 0.1), node.z - f[1] * sd + r[1] * (half / 2 + 0.1), half - 0.2, 0.45, rot, Y, WHT);
        for (var lat = -half + 0.5; lat < half; lat += 1.0) mk.rect(node.x - f[0] * cm + r[0] * lat, node.z - f[1] * cm + r[1] * lat, 0.5, cl, rot, Y, WHT);
      }
    }
    addMesh(mk.build(), basicVC, false, false);
    var textGroups = {};
    city.roadTexts.forEach(function (t) {
      if (!textGroups[t.text]) textGroups[t.text] = new GeoBuilder();
      var n = t.text.length;
      textGroups[t.text].rect(t.x + Math.sin(t.rot) * n * 1.2, t.z + Math.cos(t.rot) * n * 1.2, 2.0, n * 2.4, t.rot + Math.PI, Y + 0.005, 0xffffff);
    });
    Object.keys(textGroups).forEach(function (txt) { addMesh(textGroups[txt].build(), new THREE.MeshBasicMaterial({ map: TG.tex.roadText(txt), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), false, false); });

    // 건물
    var walls = { apt: new GeoBuilder(), office: new GeoBuilder(), shop: new GeoBuilder(), tower: new GeoBuilder() };
    var roofs = new GeoBuilder(), strips = [new GeoBuilder(), new GeoBuilder(), new GeoBuilder()], labels = new GeoBuilder(), glass = new GeoBuilder();
    var tints = { apt: [0xf1efe9, 0xe8e3d6, 0xdfe4ea], office: [0xffffff, 0xd8dee6, 0xc9d3dd], shop: [0xffffff, 0xe6d9c8, 0xd9cfc0], tower: [0x9fc4e8, 0x8fd0c8, 0xd9c39a] };
    city.buildings.forEach(function (b) {
      var w = b.x1 - b.x0, dd = b.z1 - b.z0, cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2, tint = tints[b.style][b.seed % 3];
      if (b.style === 'tower') {   // 고층 타워: 본체 + 셋백 상층부 + 크라운 + 첨탑/헬리패드(심시티 느낌의 스카이라인)
        var h1 = b.h * 0.62, w2 = w * 0.78, d2 = dd * 0.78;
        walls.tower.box(cx, h1 / 2 + 0.2, cz, w, h1, dd, tint, { sidesOnly: true, uvScale: [3, 3] });
        walls.tower.box(cx, h1 + (b.h - h1) / 2 + 0.2, cz, w2, b.h - h1, d2, tint, { sidesOnly: true, uvScale: [3, 3] });
        roofs.box(cx, h1 + 0.3, cz, w + 0.2, 0.5, dd + 0.2, 0x3a3f47, { noBottom: true });
        roofs.box(cx, b.h + 0.3, cz, w2 + 0.2, 0.5, d2 + 0.2, 0x3a3f47, { noBottom: true });
        roofs.box(cx, b.h + 1.2, cz, w2 * 0.55, 1.8, d2 * 0.55, 0x2b2f36, {});
        if (b.seed % 3 === 0) { roofs.box(cx, b.h + 6, cz, 0.5, 9, 0.5, 0xc9ccd0, {}); roofs.box(cx, b.h + 10.6, cz, 0.9, 0.5, 0.9, 0xff4040, {}); }
        else if (b.seed % 3 === 1) roofs.cylinder(cx, b.h + 0.55, cz, Math.min(w, dd) * 0.28, Math.min(w, dd) * 0.28, 0.2, 16, 0xe9ecef, true);
        else for (var sp = 0; sp < 3; sp++) roofs.box(cx - w2 * 0.3 + sp * w2 * 0.3, b.h + 2.4, cz, 0.3, 4.2 - sp, 0.3, 0xc9ccd0, {});
        return;
      }
      walls[b.style].box(cx, b.h / 2 + 0.2, cz, w, b.h, dd, tint, { sidesOnly: true, uvScale: [4, 3] });
      roofs.box(cx, b.h + 0.2, cz, w + 0.3, 0.4, dd + 0.3, b.style === 'apt' ? 0x8b8f96 : 0x5d6168, { noBottom: true });
      roofs.box(cx - w * 0.25, b.h + 1.3, cz - dd * 0.2, Math.min(4, w * 0.3), 2.2, Math.min(3, dd * 0.3), 0x9aa0a6, {});
      roofs.cylinder(cx + w * 0.25, b.h + 0.4, cz + dd * 0.2, 1.1, 1.1, 2.4, 8, 0xd9d9d0, true);
      for (var a = 0; a < 3; a++) roofs.box(cx - w * 0.3 + a * w * 0.25, b.h + 0.65, cz + dd * 0.35, 0.9, 0.7, 0.5, 0xc9ccd0, {});
      if (b.style === 'shop') { strips[b.seed % 3].box(cx, 3.6, cz, w + 0.3, 1.1, dd + 0.3, 0xffffff, { sidesOnly: true, uvScale: [16, 1.1] }); glass.box(cx, 1.5, cz, w + 0.05, 2.4, dd + 0.05, 0x3a5470, { sidesOnly: true }); }
      if (b.style === 'apt') {
        for (var fl = 1; fl * 3 < b.h - 1; fl++) roofs.box(cx, fl * 3 + 0.2, cz, w + 1.2, 0.18, dd + 1.2, 0xd6d3cb, { noBottom: true });
        labels.vquad(cx, b.h - 2.2, b.z0 - 0.05, Math.min(6, w * 0.6), 1.6, Math.PI, 0xffffff, null); labels.vquad(cx, b.h - 2.2, b.z1 + 0.05, Math.min(6, w * 0.6), 1.6, 0, 0xffffff, null);
      }
    });
    // 랜드마크(강남·서초 축약): 무역센터형 계단식 유리 타워 + 전시장 / 법원(백색 열주) / 예술의전당형 돔 / 강남대로 쌍둥이 타워 / 종합운동장형 원형 경기장
    (city.landmarks || []).forEach(function (L) {
      var w = L.x1 - L.x0, dd = L.z1 - L.z0, cx = (L.x0 + L.x1) / 2, cz = (L.z0 + L.z1) / 2;
      if (L.kind === 'trade') {
        var tx = L.x1 - 16, tz = L.z0 + 18;
        for (var s = 0; s < 4; s++) walls.tower.box(tx - s * 2.2, 0.2 + (s + 0.5) * 27, tz, 22 - s * 3, 27, 22, 0x9fc4e8, { sidesOnly: true, uvScale: [3, 3] });
        roofs.box(tx - 6.6, 108.4, tz, 13, 0.6, 22, 0x3a3f47, { noBottom: true }); roofs.box(tx - 6.6, 112, tz, 0.5, 8, 0.5, 0xc9ccd0, {}); roofs.box(tx - 6.6, 116.4, tz, 1.0, 0.6, 1.0, 0xff4040, {});
        roofs.box(cx - 8, 7.2, cz + dd * 0.22, w - 20, 14, dd * 0.5, 0xdfe3e8, {});                        // 전시장(넓고 낮은 유리·금속 지붕)
        glass.box(cx - 8, 6.5, cz + dd * 0.22, w - 19.5, 10, dd * 0.5 + 0.5, 0x3a5470, { sidesOnly: true });
        for (var a = 0; a < 6; a++) roofs.box(L.x0 + 6 + a * (w - 24) / 5, 15.2, cz + dd * 0.22, 1.2, 2.4, dd * 0.5, 0xb9bec4, {});   // 지붕 아치 뼈대
        roofs.box(cx, 0.35, cz - dd * 0.3, w * 0.9, 0.3, 10, 0xc9c5ba, {});                                 // 앞 광장
      } else if (L.kind === 'court') {
        roofs.box(cx, 6.2, cz, w * 0.78, 12, dd * 0.55, 0xe9e6de, {});                                       // 법원 본관(백색)
        roofs.box(cx, 12.5, cz, w * 0.82, 0.8, dd * 0.6, 0x8b8f96, { noBottom: true });
        for (var c = 0; c < 9; c++) roofs.cylinder(L.x0 + w * 0.13 + c * (w * 0.74) / 8, 0.3, cz - dd * 0.29, 0.8, 0.8, 11.5, 10, 0xf2f0ea, true);   // 열주
        roofs.box(cx, 11.9, cz - dd * 0.29, w * 0.8, 1.0, 3, 0xe9e6de, {});
        roofs.box(cx, 0.6, cz - dd * 0.42, w * 0.5, 1.2, 3, 0xd7d3c8, {});                                   // 계단
        roofs.box(cx - w * 0.3, 4.2, cz + dd * 0.35, w * 0.35, 8, dd * 0.2, 0xe4e1d9, {}); roofs.box(cx + w * 0.3, 4.2, cz + dd * 0.35, w * 0.35, 8, dd * 0.2, 0xe4e1d9, {});   // 별관
        roofs.cylinder(cx, 0.3, cz - dd * 0.42 - 6, 0.14, 0.12, 9, 6, 0x8f959c); roofs.box(cx, 9.5, cz - dd * 0.42 - 6, 1.2, 0.8, 0.05, 0xffffff, {});   // 국기 게양대
      } else if (L.kind === 'arts') {
        var r = Math.min(w, dd) * 0.28;
        roofs.cylinder(cx, 0.3, cz, r, r, 10, 28, 0xd9d3c4, true);                                           // 드럼
        roofs.cylinder(cx, 10.3, cz, r * 1.08, r * 0.9, 3, 28, 0x6b5d4c, true);                              // 갓 모양 처마
        roofs.cylinder(cx, 13.3, cz, r * 0.8, r * 0.35, 6, 28, 0x8a7a63, true);                              // 돔(원뿔대)
        roofs.cylinder(cx, 19.3, cz, r * 0.35, 0.6, 3, 16, 0x8a7a63, true);
        roofs.box(cx - w * 0.3, 5.2, cz + dd * 0.3, w * 0.3, 10, dd * 0.25, 0xd9d3c4, {}); roofs.box(cx + w * 0.3, 5.2, cz + dd * 0.3, w * 0.3, 10, dd * 0.25, 0xd9d3c4, {});   // 음악당·미술관
        roofs.box(cx, 0.3, cz - dd * 0.3, w * 0.8, 0.25, dd * 0.25, 0xc9c5ba, {});
      } else if (L.kind === 'twin') {
        for (var t = -1; t <= 1; t += 2) { walls.office.box(cx + t * w * 0.22, 0.2 + 34, cz, w * 0.3, 68, dd * 0.55, 0xb3563a, { sidesOnly: true, uvScale: [4, 3] }); roofs.box(cx + t * w * 0.22, 68.5, cz, w * 0.32, 0.6, dd * 0.57, 0x4a2c22, { noBottom: true }); }
        glass.box(cx, 42, cz, w * 0.16, 4, dd * 0.3, 0x3a5470, {});                                          // 연결 다리
        roofs.box(cx, 2.2, cz, w * 0.75, 4.4, dd * 0.6, 0x9a4b33, {});                                       // 저층부
      } else if (L.kind === 'terminal') {   // 고속버스터미널: 긴 승강장 캐노피 + 대합실 + 서 있는 버스들
        roofs.box(cx, 5.2, cz + dd * 0.22, w * 0.86, 10, dd * 0.36, 0xd9d6cf, {});                              // 대합실·상가
        glass.box(cx, 4.4, cz + dd * 0.22, w * 0.86 + 0.4, 5, dd * 0.36 + 0.4, 0x3a5470, { sidesOnly: true });
        roofs.box(cx, 7.4, cz - dd * 0.18, w * 0.9, 0.5, dd * 0.4, 0x8b8f96, { noBottom: true });                 // 승강장 캐노피
        for (var pc = 0; pc < 8; pc++) roofs.box(L.x0 + w * 0.08 + pc * (w * 0.84) / 7, 3.6, cz - dd * 0.18, 0.5, 7.4, 0.5, 0xb9bec4, {});
        for (var bb = 0; bb < 5; bb++) { var bx = L.x0 + w * 0.14 + bb * (w * 0.72) / 4; roofs.box(bx, 1.8, cz - dd * 0.2, 2.5, 3.2, 11, [0x2f6fd6, 0xd7262b, 0x2ea043, 0xf3c418, 0x1f4fa8][bb], {}); roofs.box(bx, 2.6, cz - dd * 0.2, 2.55, 1.0, 11.05, 0xdfe4ea, {}); }   // 정차한 고속버스
        roofs.box(cx, 0.3, cz - dd * 0.42, w * 0.9, 0.25, dd * 0.12, 0xc9c5ba, {});
        roofs.box(cx, 13.5, cz + dd * 0.22, w * 0.5, 2.2, 0.4, 0x1f4fa8, {});                                     // 옥상 간판 띠
      } else if (L.kind === 'gu') {   // 서초구청: 8층 백색 청사 + 앞 광장·국기 게양대·「서초구청」 표지
        roofs.box(cx, 14.2, cz + dd * 0.12, w * 0.62, 28, dd * 0.42, 0xe9ebee, {});
        for (var fl = 1; fl < 8; fl++) glass.box(cx, 1.5 + fl * 3.5, cz + dd * 0.12, w * 0.62 + 0.2, 1.6, dd * 0.42 + 0.2, 0x3a5470, { sidesOnly: true });
        roofs.box(cx, 28.6, cz + dd * 0.12, w * 0.66, 0.8, dd * 0.46, 0x9aa0a8, { noBottom: true });
        roofs.box(cx, 2.4, cz - dd * 0.22, w * 0.5, 4.8, dd * 0.2, 0xe2e4e8, {});                                 // 민원실(저층)
        roofs.box(cx, 0.3, cz - dd * 0.4, w * 0.8, 0.25, dd * 0.14, 0xc9c5ba, {});                                // 광장
        for (var fp = -1; fp <= 1; fp++) { roofs.cylinder(cx + fp * 4, 0.3, cz - dd * 0.44, 0.12, 0.1, 10, 6, 0x8f959c); roofs.box(cx + fp * 4 + 0.7, 9.3, cz - dd * 0.44, 1.4, 0.9, 0.05, fp === 0 ? 0xffffff : 0x2f6fd6, {}); }   // 국기·구기
        roofs.box(cx, 5.6, cz - dd * 0.22 - dd * 0.1 - 0.3, w * 0.36, 1.2, 0.3, 0x1f4fa8, {});                    // 정문 간판 띠
      } else if (L.kind === 'library') {   // 국립중앙도서관: 낮고 넓은 석재 본관 + 긴 가로 창띠 + 앞 광장
        roofs.box(cx, 8.2, cz + dd * 0.08, w * 0.74, 16, dd * 0.44, 0xe3ded2, {});
        for (var lb = 0; lb < 4; lb++) glass.box(cx, 3.0 + lb * 3.6, cz + dd * 0.08, w * 0.75, 1.5, dd * 0.44 + 0.2, 0x44607e, { sidesOnly: true });
        roofs.box(cx, 16.6, cz + dd * 0.08, w * 0.78, 0.9, dd * 0.48, 0x8b8f96, { noBottom: true });
        roofs.box(cx, 2.6, cz - dd * 0.26, w * 0.44, 5.2, dd * 0.16, 0xece7db, {});                          // 열람동(저층)
        roofs.box(cx, 0.32, cz - dd * 0.42, w * 0.8, 0.28, dd * 0.16, 0xc9c5ba, {});                         // 앞 광장
        for (var lt = -1; lt <= 1; lt += 2) roofs.box(cx + lt * w * 0.3, 1.4, cz - dd * 0.42, 1.6, 2.8, 1.6, 0xd7d3c8, {});   // 광장 조형물
      } else if (L.kind === 'hospital') {   // 서울성모병원: 흰 병동 타워 + 저층 외래동 + 응급실 캐노피 + 옥상 헬리포트
        var hx = cx, hz = cz + dd * 0.06;
        walls.office.box(hx, 0.2 + 21, hz, w * 0.5, 42, dd * 0.36, 0xf2f4f6, { sidesOnly: true, uvScale: [3, 5] });
        roofs.box(hx, 42.4, hz, w * 0.54, 0.8, dd * 0.4, 0xdfe3e8, { noBottom: true });
        roofs.cylinder(hx, 43.0, hz, Math.min(w, dd) * 0.11, Math.min(w, dd) * 0.11, 0.3, 20, 0x6f7680, true);   // 헬리포트
        roofs.cylinder(hx, 43.4, hz, Math.min(w, dd) * 0.075, Math.min(w, dd) * 0.075, 0.12, 20, 0xf4f6f8, true);
        roofs.box(hx, 4.6, cz - dd * 0.28, w * 0.66, 9.2, dd * 0.2, 0xe9ecef, {});                            // 외래·응급동
        roofs.box(hx, 9.6, cz - dd * 0.28, w * 0.68, 0.7, dd * 0.24, 0x9aa0a8, { noBottom: true });
        roofs.box(hx, 3.2, cz - dd * 0.42, w * 0.3, 0.35, 5.5, 0xdfe3e8, {});                                 // 응급실 진입 캐노피
        for (var hp = -1; hp <= 1; hp += 2) roofs.cylinder(hx + hp * w * 0.14, 0.3, cz - dd * 0.42, 0.16, 0.14, 3.1, 8, 0xb9bec4);
        roofs.box(hx, 2.1, cz - dd * 0.42 - 2.6, 3.4, 1.1, 0.3, 0xd7262b, {});                                // 응급(적색 띠)
        roofs.box(hx, 0.32, cz - dd * 0.5, w * 0.7, 0.28, dd * 0.1, 0xc9c5ba, {});
      } else if (L.kind === 'stadium') {
        var rs = Math.min(w, dd) * 0.42;
        roofs.cylinder(cx, 0.3, cz, rs, rs * 1.04, 14, 36, 0xd8d3ca, false);                                  // 관중석 외벽
        roofs.cylinder(cx, 0.3, cz, rs * 0.55, rs * 0.55, 0.3, 36, 0x4c9a4a, true);                            // 그라운드
        for (var q = 0; q < 12; q++) { var ang = q / 12 * Math.PI * 2; roofs.box(cx + Math.cos(ang) * rs * 1.0, 16, cz + Math.sin(ang) * rs * 1.0, 1.4, 6, 1.4, 0xb9bec4, { rotY: -ang }); }   // 조명탑
        roofs.cylinder(cx, 13.8, cz, rs * 1.06, rs * 0.7, 1.2, 36, 0xc9ccd0, false);                            // 지붕 링
      }
    });
    TG.mats.facade = TG.mats.facade || [];
    Object.keys(walls).forEach(function (st) { if (!walls[st].empty()) { var fm = new THREE.MeshLambertMaterial({ map: TG.tex.facade(st), vertexColors: true }); TG.mats.facade.push(fm); addMesh(walls[st].build(), fm, true, true); } });
    addMesh(roofs.build(), lambertVC, true, false);
    addMesh(glass.build(), new THREE.MeshLambertMaterial({ vertexColors: true }), false, false);
    strips.forEach(function (s, k) { if (!s.empty()) addMesh(s.build(), new THREE.MeshLambertMaterial({ map: TG.tex.shopStrip(k + 1), vertexColors: true }), false, false); });
    if (!labels.empty()) addMesh(labels.build(), new THREE.MeshBasicMaterial({ map: TG.tex.label('101동', '#1f4fa8'), transparent: true, side: THREE.DoubleSide }), false, false);

    // 나무·가로등·표지판 기둥·전봇대·전선·버스정류장
    var props = new GeoBuilder(), wires = new GeoBuilder();
    // 스텁 끝 차단봉(황·흑 줄무늬): 「막다른 길」 표시
    city.walls.forEach(function (W) {
      if (!W.stub) return;
      var vert = Math.abs(W.x2 - W.x1) < 0.01, cx = (W.x1 + W.x2) / 2, cz = (W.z1 + W.z2) / 2, len = vert ? Math.abs(W.z2 - W.z1) : Math.abs(W.x2 - W.x1);
      props.box(cx, 0.55, cz, vert ? 0.3 : len, 0.5, vert ? len : 0.3, 0xf2c200, {});
      for (var k = -1; k <= 1; k++) props.box(cx + (vert ? 0 : k * len / 3), 0.55, cz + (vert ? k * len / 3 : 0), vert ? 0.32 : 1.2, 0.52, vert ? 1.2 : 0.32, 0x15171a, {});
      props.box(cx, 0.15, cz, vert ? 0.4 : len + 0.2, 0.3, vert ? len + 0.2 : 0.4, 0xc9c5ba, {});
    });
    city.trees.forEach(function (t) {
      props.cylinder(t.x, 0.2, t.z, 0.2 * t.s, 0.14 * t.s, 2.2 * t.s, 6, 0x6b4a2b);
      var col = [0x4f8a3a, 0x5c9a42, 0x437a33][Math.floor(t.s * 10) % 3];
      if (Math.floor(t.s * 100) % 2 === 0) { props.cylinder(t.x, 1.8 * t.s, t.z, 1.9 * t.s, 0.9 * t.s, 2.0 * t.s, 7, col, false); props.cylinder(t.x, 3.2 * t.s, t.z, 1.4 * t.s, 0.15, 2.0 * t.s, 7, col, true); }
      else { props.cylinder(t.x, 2.0 * t.s, t.z, 1.2 * t.s, 1.9 * t.s, 1.4 * t.s, 8, col, false); props.cylinder(t.x, 3.4 * t.s, t.z, 1.9 * t.s, 0.9 * t.s, 1.6 * t.s, 8, col, true); }
    });
    city.lamps.forEach(function (l) {
      props.cylinder(l.x, 0.2, l.z, 0.14, 0.1, 7, 6, 0x8f959c);
      var fx = Math.sin(l.rot), fz = Math.cos(l.rot);
      props.box(l.x + fx * 1.2, 7, l.z + fz * 1.2, 0.16, 0.16, 2.4, 0x8f959c, { rotY: l.rot }); props.box(l.x + fx * 2.3, 6.85, l.z + fz * 2.3, 0.5, 0.22, 0.9, 0xfff2c8, { rotY: l.rot });
    });
    city.signs.forEach(function (s) { props.cylinder(s.x, 0.2, s.z, 0.06, 0.05, 2.9, 5, 0x8f959c); });
    for (var pi = 0; pi < xs.length; pi++) {
      var prev = null;
      for (var pz = zs[0] + 16; pz < zs[zs.length - 1]; pz += 32) {
        if (Math.abs(pz - city.nearestZ(pz)) < 16) continue;
        var px = xs[pi] - hV[pi] - 2.6;
        props.cylinder(px, 0.2, pz, 0.17, 0.13, 9.5, 6, 0x7a6a58); props.box(px, 9.2, pz, 0.12, 0.12, 1.8, 0x5a4a3a, {}); props.box(px, 8.6, pz, 0.12, 0.12, 1.4, 0x5a4a3a, {});
        if (prev && pz - prev[2] < 40) { wires.beam([prev[0], 9.3, prev[2] + 0.8], [px, 9.3, pz + 0.8], 0.02, 0x222222); wires.beam([prev[0], 9.3, prev[2] - 0.8], [px, 9.3, pz - 0.8], 0.02, 0x222222); wires.beam([prev[0], 8.7, prev[2]], [px, 8.7, pz], 0.02, 0x222222); }
        prev = [px, 0, pz];
      }
    }
    var shelters = new GeoBuilder(), busSigns = new GeoBuilder();
    for (var bi = 0; bi < xs.length - 1; bi++) for (var bj = 0; bj < zs.length; bj++) {
      if ((bi + bj) % 3 !== 1) continue;
      var sx = (xs[bi] + xs[bi + 1]) / 2 + 10, sz = zs[bj] + hH[bj] + 1.6;
      shelters.box(sx, 2.6, sz, 4.2, 0.12, 1.6, 0x2f3d4c, {}); shelters.box(sx - 2.0, 1.3, sz, 0.1, 2.6, 1.6, 0x8f959c, {}); shelters.box(sx + 2.0, 1.3, sz, 0.1, 2.6, 1.6, 0x8f959c, {});
      shelters.box(sx, 1.4, sz + 0.75, 4.2, 2.2, 0.06, 0x5a7a9a, {}); shelters.box(sx, 0.55, sz + 0.3, 3.2, 0.08, 0.4, 0x8a6a4a, {});
      props.cylinder(sx + 2.6, 0.2, sz - 0.4, 0.05, 0.05, 2.8, 5, 0x8f959c); busSigns.vquad(sx + 2.6, 2.4, sz - 0.4, 0.5, 1.0, Math.PI, 0xffffff, null);
      props.cylinder(sx - 3.2, 0.2, sz, 0.28, 0.28, 0.8, 8, 0x3a3f45, true);
    }
    // ---- 지하철역 출입구 + 역 이름 표지 ----
    // 실제 서초구 역 위치에 세운다(2호선 서초대로: 방배 → 서초 → 교대 → 강남).
    // 표지는 역마다 다른 텍스처라 노선별로 묶어 그린다.
    var swFaces = {};
    (city.subways || []).forEach(function (S) {
      var f = [Math.sin(S.rot), Math.cos(S.rot)], r = [-f[1], f[0]];
      function P(a, b) { return [S.x + f[0] * b + r[0] * a, S.z + f[1] * b + r[1] * a]; }
      var c0 = P(0, 0);
      props.box(c0[0], 0.55, c0[1], 3.6, 1.1, 2.6, 0xdfe3e8, {});                     // 계단 입구 옹벽
      props.box(c0[0], 1.18, c0[1], 3.8, 0.16, 2.8, 0xb9bec4, { noBottom: true });     // 테두리
      var mouth = P(0, 1.0);   // 계단 입구는 도로 쪽으로 열린다
      props.box(mouth[0], 0.35, mouth[1], 3.0, 0.7, 0.6, 0x2a2e33, {});                // 어두운 계단 입구
      for (var hr = -1; hr <= 1; hr += 2) {                                            // 난간
        var a0 = P(hr * 1.7, -1.2), a1 = P(hr * 1.7, 1.2);
        props.cylinder(a0[0], 1.1, a0[1], 0.05, 0.05, 1.0, 6, 0xa9b0b8);
        props.cylinder(a1[0], 1.1, a1[1], 0.05, 0.05, 1.0, 6, 0xa9b0b8);
        props.box((a0[0] + a1[0]) / 2, 2.0, (a0[1] + a1[1]) / 2, 0.07, 0.07, 2.4, 0xa9b0b8, { rotY: S.rot });
      }
      var pole = P(2.5, 0);
      props.cylinder(pole[0], 0.2, pole[1], 0.09, 0.08, 3.0, 8, 0x6f7680);             // 표지 기둥
      var key = 'sw:' + S.name;
      (swFaces[key] = swFaces[key] || { S: S, gb: new GeoBuilder() });
      swFaces[key].gb.vquad(pole[0], 2.55, pole[1], 2.3, 0.78, S.rot + Math.PI, 0xffffff, null);   // 앞면이 도로를 보게(그냥 S.rot 이면 글씨가 뒤집혀 보인다)
    });
    Object.keys(swFaces).forEach(function (k) {
      var e = swFaces[k];
      addMesh(e.gb.build(), new THREE.MeshBasicMaterial({ map: TG.tex.subwaySign(e.S.name, e.S.lines, e.S.colors), transparent: true, side: THREE.DoubleSide }), false, false);
    });

    // ---- 서초동 향나무(서울특별시 기념물) ----
    // 담장을 두른 작은 마당 안에 굵고 낮은 향나무 한 그루 + 안내석. 서초구를 한눈에 알리는 표식이다.
    var monFaces = new GeoBuilder();
    (city.monuments || []).forEach(function (M) {
      if (M.kind !== 'juniper') return;
      var R = M.r;
      props.box(M.x, 0.16, M.z, R * 2, 0.3, R * 2, 0xd9d3c4, {});                       // 마당(마사토)
      for (var wq = 0; wq < 4; wq++) {                                                  // 낮은 담장 네 면
        var hor = wq % 2 === 0, sgn = wq < 2 ? 1 : -1;
        props.box(M.x + (hor ? 0 : sgn * R), 0.55, M.z + (hor ? sgn * R : 0), hor ? R * 2 : 0.35, 0.8, hor ? 0.35 : R * 2, 0xb9a98c, {});
      }
      props.box(M.x, 0.62, M.z - R + 0.2, 2.6, 0.9, 0.4, 0x8a7a63, {});                 // 출입구 문지방
      // 향나무: 수백 년 묵은 나무라 **줄기가 굵고 낮으며 수관이 옆으로 넓게 퍼진다**(뾰족한 침엽수와 다르다).
      props.cylinder(M.x, 0.3, M.z, 0.95, 0.72, 2.6, 12, 0x6b5340, true);              // 굵은 밑동
      props.cylinder(M.x - 0.35, 2.9, M.z + 0.2, 0.56, 0.34, 1.8, 10, 0x6b5340, true);  // 살짝 기운 줄기
      for (var br = 0; br < 7; br++) {
        var ba = br / 7 * Math.PI * 2 + 0.35, bl = 4.2 + (br % 3) * 1.0, by = 2.9 + (br % 2) * 0.7;
        props.box(M.x + Math.cos(ba) * bl * 0.5, by, M.z + Math.sin(ba) * bl * 0.5, bl, 0.3, 0.3, 0x6b5340, { rotY: -ba });   // 옆으로 뻗은 가지
        props.cylinder(M.x + Math.cos(ba) * bl, by - 0.5, M.z + Math.sin(ba) * bl, 2.5, 1.5, 1.5, 10, 0x2f6b3a, true);        // 가지 끝 잎덩이
      }
      props.cylinder(M.x, 3.6, M.z, 5.4, 4.0, 1.9, 16, 0x35753f, true);                 // 넓게 퍼진 수관(아래층)
      props.cylinder(M.x, 5.3, M.z, 3.9, 2.2, 1.5, 14, 0x2f6b3a, true);                 // 수관(위층)
      props.cylinder(M.x, 6.6, M.z, 2.0, 0.7, 1.1, 12, 0x35753f, true);                 // 꼭대기(둥글게 마감)
      for (var pr = 0; pr < 3; pr++) {                                                   // 가지를 받친 지주목(노거수 보호)
        var pa = pr / 3 * Math.PI * 2 + 0.9;
        props.cylinder(M.x + Math.cos(pa) * 4.0, 0.3, M.z + Math.sin(pa) * 4.0, 0.11, 0.09, 3.0, 6, 0x8a7250);
      }
      // 안내석
      var sx2 = M.x + R - 2.4, sz2 = M.z - R + 2.4;
      props.box(sx2, 0.55, sz2, 1.8, 1.1, 0.5, 0x4a3b2c, {});
      monFaces.vquad(sx2, 1.05, sz2 - 0.28, 1.6, 0.8, 0, 0xffffff, null);
    });
    if (!monFaces.empty()) addMesh(monFaces.build(), new THREE.MeshBasicMaterial({ map: TG.tex.stoneLabel('서초동 향나무', '서울특별시 기념물'), transparent: true, side: THREE.DoubleSide }), false, false);

    addMesh(props.build(), lambertVC, true, false);
    addMesh(wires.build(), new THREE.MeshBasicMaterial({ vertexColors: true }), false, false);
    addMesh(shelters.build(), lambertVC, true, false);
    addMesh(busSigns.build(), new THREE.MeshBasicMaterial({ map: TG.tex.busStop(), side: THREE.DoubleSide }), false, false);
    var signFaces = {};
    city.signs.forEach(function (s) { (signFaces[s.kind] = signFaces[s.kind] || new GeoBuilder()).vquad(s.x, 2.75, s.z, 0.9, 0.9, s.rot, 0xffffff, null); });
    Object.keys(signFaces).forEach(function (k) { addMesh(signFaces[k].build(), new THREE.MeshBasicMaterial({ map: TG.tex.sign(k), transparent: true, side: THREE.DoubleSide }), false, false); });

    // 신호등: 접근로마다 교차로 건너편 우측 모서리 기둥 + 암 + 머리(차로 위). 4차로면 암을 길게 뽑아 두 차로를 덮는다.
    var sigProps = new GeoBuilder(), heads = [], headGeo = new THREE.PlaneGeometry(2.0, 0.56), pedGeo = new THREE.PlaneGeometry(0.5, 1.0);
    // 신호등 머리 재질은 signals.update 가 매 프레임 갈아 끼운다. 그 전에 렌더하면 material 이 null 이라 three 가 죽는다 — 보이지 않는 임시 재질을 물려 둔다.
    var headHold = new THREE.MeshBasicMaterial({ visible: false });
    for (var hi = 0; hi < xs.length; hi++) for (var hj = 0; hj < zs.length; hj++) {
      var nd = city.nodes[hi][hj];
      for (var hd = 0; hd < 4; hd++) {
        if (!city.nodeFrom(nd, (hd + 2) % 4) && !city.exitFor(nd, (hd + 2) % 4)) continue;
        var f2 = TG.DIR_VEC[hd], r2 = [-f2[1], f2[0]], rd2 = city.roadOf(nd, hd), halfA = city.halfOf(rd2.axis, rd2.idx), lanes = city.lanesOf(rd2.axis, rd2.idx);
        // 차량 신호등 기둥은 **보행 신호등과 같은 자리**(보도 바깥선)에 세운다 — 전에는 차도 가장자리에서 1.6m,
        // 즉 보도 한가운데라 걸어가는 사람 앞을 막았다(소유자: 「신호등 시설물 위치를 보행자 신호등 있는 곳에 같이」). 암은 그만큼 길어진다.
        // 기둥은 **이 접근로의 정지선 바로 옆**(진행 방향 오른쪽 보도)에 선다(소유자 지시).
        // 여기 달린 차량 신호등 머리는 반대편(-f2 로 오는) 운전자가 읽는다 — 그래야 정지선 옆에 두고도 보인다.
        var stopA = city.stopDist(nd, hd) + 0.9, sideA = city.sideOff(rd2.axis, rd2.idx) + 1.0;
        var px2 = nd.x - f2[0] * stopA + r2[0] * sideA, pz2 = nd.z - f2[1] * stopA + r2[1] * sideA;
        sigProps.cylinder(px2, 0.2, pz2, 0.16, 0.13, 6.4, 6, 0x4a4f55);   // 가로등은 달지 않는다(소유자 지시) - 가로등은 별도 기둥
        var headOff = cfg.LANE_OFF + cfg.LANE_W * (lanes - 1) / 2, armLen = sideA - headOff + 0.6;
        sigProps.box(px2 - r2[0] * armLen / 2, 6.1, pz2 - r2[1] * armLen / 2, 0.14, 0.14, armLen, 0x4a4f55, { rotY: TG.DIR_HEADING[hd] + Math.PI / 2 });
        var hx = nd.x - f2[0] * stopA + r2[0] * headOff, hz = nd.z - f2[1] * stopA + r2[1] * headOff;
        sigProps.box(hx - f2[0] * 0.18, 5.6, hz - f2[1] * 0.18, 2.1, 0.66, 0.3, 0x1d2126, { rotY: TG.DIR_HEADING[hd] });
        var head = new THREE.Mesh(headGeo, headHold); head.position.set(hx, 5.6, hz); head.rotation.y = TG.DIR_HEADING[hd]; head.matrixAutoUpdate = false; head.updateMatrix(); scene.add(head);
        heads.push({ node: nd, d: hd, mesh: head, kind: 'veh', axis: (hd === 0 || hd === 2) ? 'v' : 'h' });
        // 보행 신호등: 횡단보도 양쪽 끝 연석에 하나씩, 길 건너편을 향한다(건너려는 사람이 맞은편 신호를 본다). 기둥 3m + 머리(잔여시간 표시) + 보행자 작동 버튼함
        // 보행 신호등을 **차량 신호등과 같은 기둥**에 붙인다(소유자: 「보행신호폴과 차량신호폴을 하나로 합치고」).
        // 이 기둥은 반대편 접근로의 **정지선 옆 모퉁이**에 서 있다 — 즉 「횡단보도 전 정지선쯤」이고,
        // 건너려는 사람의 오른쪽이다. 기둥이 교차로당 8개 → **4개**로 줄어 횡단보도 앞에 선 사람이 잘 보인다.
        var yawP = Math.atan2(-r2[0], -r2[1]);                        // 머리는 길 건너편을 향한다(맞은편 사람이 읽는다)
        sigProps.box(px2 - r2[0] * 0.02, 2.75, pz2 - r2[1] * 0.02, 0.56, 1.08, 0.16, 0x1d2126, { rotY: yawP });   // 보행등 함체
        sigProps.box(px2 - r2[0] * 0.08, 3.32, pz2 - r2[1] * 0.08, 0.6, 0.06, 0.28, 0x1d2126, { rotY: yawP });    // 차양
        sigProps.box(px2, 1.15, pz2, 0.12, 0.16, 0.08, 0xf3c418, { rotY: yawP });                                 // 보행자 작동 버튼함
        var ph = new THREE.Mesh(pedGeo, headHold);
        ph.position.set(px2 - r2[0] * 0.11, 2.75, pz2 - r2[1] * 0.11); ph.rotation.y = yawP;
        ph.matrixAutoUpdate = false; ph.updateMatrix(); scene.add(ph);
        heads.push({ node: nd, d: (hd + 2) % 4, mesh: ph, kind: 'ped', axis: (hd === 0 || hd === 2) ? 'v' : 'h' });
        // 같은 기둥에 90° 돌려 하나 더 — 이 모퉁이에서 만나는 **직각 방향 횡단보도**의 보행등이다.
        // 기둥을 늘리지 않고 보행등 수를 늘린다(소유자: 「기둥 하나에 90도로 2곳에 신호를 보여줄 수 있고」).
        var yawQ = Math.atan2(-f2[0], -f2[1]);
        sigProps.box(px2 - f2[0] * 0.02, 2.75, pz2 - f2[1] * 0.02, 0.56, 1.08, 0.16, 0x1d2126, { rotY: yawQ });
        sigProps.box(px2 - f2[0] * 0.08, 3.32, pz2 - f2[1] * 0.08, 0.6, 0.06, 0.28, 0x1d2126, { rotY: yawQ });
        var ph2 = new THREE.Mesh(pedGeo, headHold);
        ph2.position.set(px2 - f2[0] * 0.11, 2.75, pz2 - f2[1] * 0.11); ph2.rotation.y = yawQ;
        ph2.matrixAutoUpdate = false; ph2.updateMatrix(); scene.add(ph2);
        heads.push({ node: nd, d: (hd + 1) % 4, mesh: ph2, kind: 'ped', axis: (hd === 0 || hd === 2) ? 'h' : 'v' });
      }
    }
    addMesh(sigProps.build(), lambertVC, true, false);


    var hemi = new THREE.HemisphereLight(0xd6e6ff, 0x7f7256, 0.75); scene.add(hemi);
    var sun = new THREE.DirectionalLight(0xfff0d2, 1.15);
    sun.position.set(60, 110, 40); sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048); sun.shadow.camera.near = 10; sun.shadow.camera.far = 340;
    sun.shadow.camera.left = -90; sun.shadow.camera.right = 90; sun.shadow.camera.top = 90; sun.shadow.camera.bottom = -90; sun.shadow.bias = -0.0012;
    scene.add(sun); scene.add(sun.target);
    scene.fog = new THREE.Fog(0xcfe0f3, 220, 1500);
    return { statics: statics, heads: heads, sun: sun, hemi: hemi, followSun: function (x, z) { sun.position.set(x + 60, this.sunHeight || 110, z + 40); sun.target.position.set(x, 0, z); sun.target.updateMatrixWorld(); } };
  };
})();
