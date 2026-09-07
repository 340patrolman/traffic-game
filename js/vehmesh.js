// 차량 형상 v3: 옆면 실루엣(범퍼→후드→앞유리→지붕→뒷유리→트렁크) × 단면 곡선(바닥→로커→어깨→벨트→유리→지붕) 로프트.
// 정점 법선을 이웃 면으로 평균해 둥글게 음영이 진다. 필러·문 이음선·손잡이·LED 전조등·후미등 바·거울·번호판·바퀴(림)까지 전부 코드.
// 경찰차는 하단 청색 띠 + 황색 선, 「경찰 POLICE」 라벨·엠블럼은 vehicle.js 가 붙인다. 원점 = 차 중심 바닥, +z 앞, +x 왼쪽.
TG.GeoBuilder.prototype.wheel = function (cx, cy, cz, r, len, seg, color) {
  var col = [((color >> 16) & 255) / 255, ((color >> 8) & 255) / 255, (color & 255) / 255], base = this.n;
  for (var i = 0; i <= seg; i++) {
    var a = i / seg * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
    this.pos.push(cx - len / 2, cy + ca * r, cz + sa * r); this.nor.push(0, ca, sa); this.uv.push(0, 0); this.col.push(col[0], col[1], col[2]);
    this.pos.push(cx + len / 2, cy + ca * r, cz + sa * r); this.nor.push(0, ca, sa); this.uv.push(0, 0); this.col.push(col[0], col[1], col[2]);
  }
  for (var k = 0; k < seg; k++) { var b = base + k * 2; this.idx.push(b, b + 2, b + 3, b, b + 3, b + 1); }
  this.n += (seg + 1) * 2;
  var sides = [[-1, cx - len / 2], [1, cx + len / 2]];
  for (var s = 0; s < 2; s++) {
    var sx = sides[s][0], px = sides[s][1], cb = this.n;
    this.pos.push(px, cy, cz); this.nor.push(sx, 0, 0); this.uv.push(0, 0); this.col.push(col[0] * 0.7, col[1] * 0.7, col[2] * 0.7);
    for (var m = 0; m <= seg; m++) { var am = m / seg * Math.PI * 2; this.pos.push(px, cy + Math.cos(am) * r, cz + Math.sin(am) * r); this.nor.push(sx, 0, 0); this.uv.push(0, 0); this.col.push(col[0] * 0.7, col[1] * 0.7, col[2] * 0.7); }
    for (var q = 0; q < seg; q++) { if (sx > 0) this.idx.push(cb, cb + 1 + q, cb + 2 + q); else this.idx.push(cb, cb + 2 + q, cb + 1 + q); }
    this.n += seg + 2;
  }
};
// 정점별 법선을 주는 사각형(둥근 음영용). P: 점 4개, N: 법선 4개.
TG.GeoBuilder.prototype.quadN = function (P, N, color) {
  var col = [((color >> 16) & 255) / 255, ((color >> 8) & 255) / 255, (color & 255) / 255], base = this.n;
  for (var i = 0; i < 4; i++) { this.pos.push(P[i][0], P[i][1], P[i][2]); this.nor.push(N[i][0], N[i][1], N[i][2]); this.uv.push(0, 0); this.col.push(col[0], col[1], col[2]); }
  this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  this.n += 4;
};
TG.GeoBuilder.prototype.tri = function (a, b, c, nrm, color) {
  var col = [((color >> 16) & 255) / 255, ((color >> 8) & 255) / 255, (color & 255) / 255], base = this.n, P = [a, b, c];
  for (var i = 0; i < 3; i++) { this.pos.push(P[i][0], P[i][1], P[i][2]); this.nor.push(nrm[0], nrm[1], nrm[2]); this.uv.push(0, 0); this.col.push(col[0], col[1], col[2]); }
  this.idx.push(base, base + 1, base + 2);
  this.n += 3;
};

TG.vehmesh = (function () {
  var GLASS = 0x1b2530, DARK = 0x15171a, LOW = 0x22252a, LIGHT = 0xfff6d8, TAIL = 0xd41a1a, PLATE = 0xf4f4ec, RIM = 0xc0c4ca, CHROME = 0xd8dde3;
  var BLUE = 0x1a4fb0, YEL = 0xf3c418;
  // pts: [zFrac(+앞 … −뒤), y, glass(1)] — glass 가 붙은 점으로 끝나는 구간이 유리(앞유리·뒷유리)
  var TYPES = {
    sedan:  { w: 1.82, l: 4.65, belt: 0.92, wheelR: 0.33, taper: 0.05, pts: [[0.5, 0.40], [0.5, 0.60], [0.45, 0.72], [0.17, 0.82], [0.05, 1.36, 1], [-0.27, 1.40], [-0.40, 1.06, 1], [-0.5, 0.98], [-0.5, 0.40]] },
    hatch:  { w: 1.74, l: 4.05, belt: 0.92, wheelR: 0.31, taper: 0.05, pts: [[0.5, 0.40], [0.5, 0.62], [0.42, 0.74], [0.19, 0.84], [0.04, 1.40, 1], [-0.37, 1.45], [-0.47, 1.04, 1], [-0.5, 0.96], [-0.5, 0.40]] },
    suv:    { w: 1.92, l: 4.75, belt: 1.08, wheelR: 0.37, taper: 0.04, pts: [[0.5, 0.44], [0.5, 0.84], [0.43, 0.98], [0.17, 1.06], [0.06, 1.72, 1], [-0.40, 1.76], [-0.48, 1.22, 1], [-0.5, 1.10], [-0.5, 0.44]] },
    van:    { w: 1.98, l: 5.10, belt: 1.12, glassTop: 1.75, wheelR: 0.35, pts: [[0.5, 0.44], [0.5, 0.92], [0.45, 1.02], [0.34, 1.96, 1], [-0.47, 2.02], [-0.5, 1.92], [-0.5, 0.44]] },
    truck:  { w: 2.15, l: 6.4, belt: 1.15, glassTop: 2.0, wheelR: 0.42, cargo: true, pts: [[0.5, 0.50], [0.5, 1.12], [0.47, 1.28], [0.40, 2.35, 1], [0.17, 2.42], [0.15, 1.0], [0.15, 0.50]] },
    bus:    { w: 2.45, l: 11.0, belt: 1.30, glassTop: 2.45, wheelR: 0.48, bus: true, pts: [[0.5, 0.45], [0.5, 1.30], [0.49, 2.95], [0.46, 3.18], [-0.46, 3.22], [-0.5, 3.0], [-0.5, 0.45]] },
    // 순찰 세단(중형): 낮은 후드·패스트백 지붕·짧은 데크(참고 사진의 실루엣), 전폭 후미등 바
    police: { w: 1.86, l: 4.85, belt: 0.92, wheelR: 0.34, police: true, detail: true, taper: 0.06, roofScale: 0.85, tailBar: true,
              pts: [[0.5, 0.36], [0.5, 0.50], [0.49, 0.62], [0.46, 0.70], [0.40, 0.75], [0.28, 0.80], [0.16, 0.84], [0.10, 0.86], [0.02, 1.20, 1], [-0.07, 1.34, 1], [-0.14, 1.40], [-0.24, 1.41], [-0.33, 1.34], [-0.41, 1.16, 1], [-0.46, 1.02, 1], [-0.49, 0.95], [-0.5, 0.86], [-0.5, 0.36]] },
    // 순찰 전기 SUV: 각진 크로스오버(짧은 오버행·수평 벨트·평평한 지붕), 픽셀 LED 바
    psuv:   { w: 1.94, l: 4.65, belt: 1.02, wheelR: 0.37, police: true, detail: true, taper: 0.03, roofScale: 0.90, pixel: true, tailBar: true,
              pts: [[0.5, 0.42], [0.5, 0.60], [0.49, 0.78], [0.46, 0.88], [0.40, 0.94], [0.24, 0.98], [0.14, 1.00], [0.02, 1.52, 1], [-0.10, 1.62], [-0.32, 1.64], [-0.42, 1.48, 1], [-0.47, 1.30, 1], [-0.5, 1.10], [-0.5, 0.42]] },
    // 순찰 대형 세단(플래그십): 긴 후드·완만한 패스트백·큰 그릴·2단 전조등
    pflag:  { w: 1.92, l: 5.05, belt: 0.96, wheelR: 0.36, police: true, detail: true, taper: 0.07, roofScale: 0.84, twoTier: true,
              pts: [[0.5, 0.38], [0.5, 0.52], [0.495, 0.66], [0.47, 0.74], [0.42, 0.79], [0.30, 0.84], [0.19, 0.88], [0.12, 0.91], [0.03, 1.22, 1], [-0.06, 1.36, 1], [-0.14, 1.42], [-0.24, 1.43], [-0.32, 1.38], [-0.40, 1.22, 1], [-0.45, 1.06, 1], [-0.49, 0.98], [-0.5, 0.90], [-0.5, 0.38]] },
  };
  var cache = {};
  function lighten(hex, f) {
    var r = Math.min(255, ((hex >> 16) & 255) * f), g = Math.min(255, ((hex >> 8) & 255) * f), b = Math.min(255, (hex & 255) * f);
    return (r << 16) | (g << 8) | b;
  }
  function norm3(v) { var l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }
  function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }

  // 옆면 실루엣 → 윗선 함수 top(z) 와 유리 구간 판정. 같은 z 의 점들은 수직면(앞·뒤 캡)으로 처리한다.
  function profile(T) {
    var l = T.l, env = [];
    T.pts.forEach(function (p) {
      var q = { z: p[0] * l, y: p[1], glass: !!p[2] };
      if (env.length && Math.abs(env[env.length - 1].z - q.z) < 1e-6) { env[env.length - 1].y = Math.max(env[env.length - 1].y, q.y); env[env.length - 1].glass = env[env.length - 1].glass || q.glass; }
      else env.push(q);
    });
    function seg(z) { for (var i = 0; i < env.length - 1; i++) if (z <= env[i].z + 1e-9 && z >= env[i + 1].z - 1e-9) return i; return z > env[0].z ? 0 : env.length - 2; }
    function top(z) { var i = seg(z), a = env[i], b = env[i + 1], t = (a.z - b.z) < 1e-9 ? 0 : (a.z - z) / (a.z - b.z); return a.y + (b.y - a.y) * t; }
    function glassAt(z) { var i = seg(z); return env[i + 1].glass && (env[i].y > T.belt || env[i + 1].y > T.belt); }
    var zs = [];
    for (var i = 0; i < env.length - 1; i++) {
      var a = env[i].z, b = env[i + 1].z, n = Math.max(1, Math.ceil((a - b) / 0.22));
      for (var k = 0; k < n; k++) zs.push(a + (b - a) * k / n);
    }
    zs.push(env[env.length - 1].z);
    return { top: top, glassAt: glassAt, zs: zs, zf: env[0].z, zr: env[env.length - 1].z, wsBase: null, env: env };
  }
  // 단면(오른쪽 반) 13점. 색은 점 k→k+1 띠(12개).
  function section(T, z, top, glassSeg, color) {
    var w = T.w, l = T.l, belt = T.belt, bottom = 0.30, taper = T.taper || 0, rs = (T.roofScale || 0.86) / 0.86, glassTop = T.glassTop || 99;
    var u = Math.abs(z) / (l / 2), hw = w / 2 * (1 - taper * u * u * u);
    var endR = Math.max(0, (Math.abs(z) - (l / 2 - 0.45)) / 0.45); hw *= 1 - 0.32 * endR * endR;   // 앞뒤 모서리 둥글림
    var gh = top > belt + 0.06, P = [];
    function A(x, y) { P.push([x, y]); }
    A(0, bottom); A(hw * 0.82, bottom); A(hw * 0.96, bottom + 0.09);
    A(hw, Math.min(belt - 0.52, top - 0.03)); A(hw, Math.min(belt - 0.30, top - 0.02)); A(hw, Math.min(belt - 0.27, top - 0.015)); A(hw * 0.995, Math.min(belt - 0.02, top - 0.01));
    if (gh) { A(hw * 0.97, belt + 0.02); A(hw * 0.90 * rs, belt + 0.07); A(hw * 0.87 * rs, Math.min(glassTop, top - 0.07)); A(hw * 0.83 * rs, top - 0.06); A(hw * 0.60 * rs, top - 0.012); A(0, top); }
    else { A(hw * 0.99, top - 0.045); A(hw * 0.97, top - 0.03); A(hw * 0.92, top - 0.02); A(hw * 0.80, top - 0.008); A(hw * 0.45, top + 0.010); A(0, top + 0.016); }
    var side = color, roof = lighten(color, 1.04), pol = !!T.police, bodyAbove = !!T.glassTop;
    var C = [DARK, LOW, side, side, side, side, side,   // 경찰 도색은 데칼(vehicle.js)이 맡는다 — 로프트는 흰 차체
             gh ? GLASS : side, gh ? GLASS : side, gh ? (bodyAbove ? roof : GLASS) : roof, gh ? (glassSeg ? GLASS : roof) : roof, gh ? (glassSeg ? GLASS : roof) : roof];
    return { P: P, C: C };
  }

  // gb 에 차체를 그린다.
  function body(gb, T, color, opts) {
    opts = opts || {};
    var w = T.w, l = T.l, belt = T.belt, pr = profile(T), zs = pr.zs, M = zs.length, K = 13;
    var S = [], SC = [];
    for (var s = 0; s < M; s++) { var sec = section(T, zs[s], pr.top(zs[s]), pr.glassAt(zs[s]), color); S.push(sec.P); SC.push(sec.C); }
    // 정점 배열 V[side][s][k] 와 법선
    function V(side, s, k) { var p = S[s][k]; return [side * p[0], p[1], zs[s]]; }
    function N(side, s, k) {
      var k0 = Math.max(0, k - 1), k1 = Math.min(K - 1, k + 1), s0 = Math.max(0, s - 1), s1 = Math.min(M - 1, s + 1);
      var dK = sub(V(side, s, k1), V(side, s, k0)), dS = sub(V(side, s1, k), V(side, s0, k));
      var n = norm3(cross(dK, dS));
      var out = [side * (k === 0 ? 0 : 1), k >= K - 3 ? 1 : (k <= 1 ? -1 : 0.2), 0];
      if (n[0] * out[0] + n[1] * out[1] < 0) n = [-n[0], -n[1], -n[2]];
      if (k === 0) n = [0, -1, 0]; if (k === K - 1) n = [0, 1, 0];
      return n;
    }
    for (var side = -1; side <= 1; side += 2) {
      for (var s2 = 0; s2 < M - 1; s2++) for (var k = 0; k < K - 1; k++) {
        var a = V(side, s2, k), b = V(side, s2, k + 1), c = V(side, s2 + 1, k + 1), d = V(side, s2 + 1, k);
        var na = N(side, s2, k), nb = N(side, s2, k + 1), nc = N(side, s2 + 1, k + 1), nd = N(side, s2 + 1, k);
        var col = SC[s2][k];
        var g = cross(sub(b, a), sub(c, a)), avg = [na[0] + nc[0], na[1] + nc[1], na[2] + nc[2]];
        if (g[0] * avg[0] + g[1] * avg[1] + g[2] * avg[2] < 0) gb.quadN([a, d, c, b], [na, nd, nc, nb], col); else gb.quadN([a, b, c, d], [na, nb, nc, nd], col);
      }
    }
    // 앞·뒤 캡(부채꼴): 아래쪽은 범퍼(어두움)
    [[0, 1], [M - 1, -1]].forEach(function (cap) {
      var s3 = cap[0], nz = cap[1], zc = zs[s3], top = pr.top(zc), ctr = [0, (0.30 + top) / 2, zc], nrm = [0, 0, nz];
      var ring = [];
      for (var k2 = 0; k2 < K; k2++) ring.push(V(1, s3, k2));
      for (var k3 = K - 2; k3 >= 0; k3--) ring.push(V(-1, s3, k3));
      for (var i = 0; i < ring.length - 1; i++) {
        var kk = i < K ? i : (2 * K - 2 - i), colc = kk <= 2 ? LOW : (kk <= 4 && T.police ? (kk === 3 ? BLUE : YEL) : color);
        if (nz > 0) gb.tri(ctr, ring[i + 1], ring[i], nrm, colc); else gb.tri(ctr, ring[i], ring[i + 1], nrm, colc);
      }
    });
    var zf = pr.zf, zr = pr.zr, topF = pr.top(zf), topR = pr.top(zr), hwF = S[0][3][0], hwR = S[M - 1][3][0];
    // 필러(앞유리 옆·B·뒷유리 옆) — 유리 띠 위에 얹는 어두운 띠
    var env = pr.env, ws = null, rw = null;
    for (var e = 0; e < env.length - 1; e++) { if (env[e + 1].glass && env[e].z > 0 && !ws) ws = [env[e], env[e + 1]]; if (env[e + 1].glass && env[e].z < 0) rw = [env[e], env[e + 1]]; }
    function pillar(pa, pb, tint) {
      var n = 5;
      for (var i = 0; i < n; i++) {
        var t = (i + 0.5) / n, z = pa.z + (pb.z - pa.z) * t, y = pa.y + (pb.y - pa.y) * t;
        var secP = section(T, z, pr.top(z), true, color).P, x = Math.max(secP[8][0], secP[10][0]) + 0.005;
        var hgt = Math.abs(pb.y - pa.y) / n + 0.05;
        gb.box(x, y, z, 0.07, hgt, Math.abs(pb.z - pa.z) / n + 0.02, tint, {}); gb.box(-x, y, z, 0.07, hgt, Math.abs(pb.z - pa.z) / n + 0.02, tint, {});
      }
    }
    if (ws && !T.bus && !T.cargo) pillar({ z: ws[0].z, y: belt + 0.05 }, { z: ws[1].z, y: ws[1].y - 0.06 }, DARK);
    if (rw && !T.bus && !T.cargo && !T.van) pillar({ z: rw[0].z, y: rw[0].y - 0.06 }, { z: rw[1].z, y: belt + 0.05 }, DARK);
    if (!T.bus && !T.cargo && ws) {   // B 필러
      var zb = -l * 0.03, tb = pr.top(zb), sb = section(T, zb, tb, false, color).P, xb = sb[8][0] + 0.004;
      gb.box(xb, (belt + tb) / 2, zb, 0.05, tb - belt - 0.10, 0.10, DARK, {}); gb.box(-xb, (belt + tb) / 2, zb, 0.05, tb - belt - 0.10, 0.10, DARK, {});
    }
    // 바닥
    gb.quad([-w / 2 * 0.82, 0.30, zf], [-w / 2 * 0.82, 0.30, zr], [w / 2 * 0.82, 0.30, zr], [w / 2 * 0.82, 0.30, zf], [0, -1, 0], DARK, null);
    // 화물칸(트럭)
    if (T.cargo) {
      gb.box(0, 0.45 + 1.3, (0.13 * l + (-0.5 * l)) / 2, w, 2.6, 0.63 * l, lighten(color, 0.9), {});
      gb.box(0, 0.42, 0.13 * l + 0.4, w * 0.9, 0.16, 0.6, DARK, {});
    }
    // 전조등·그릴·범퍼(앞)
    var hy = Math.min(topF - 0.10, belt - 0.22), gz = zf + 0.012;
    if (T.pixel) {   // 픽셀 LED: 전폭 얇은 바 + 픽셀 블록
      gb.box(0, topF - 0.08, gz, hwF * 1.7, 0.035, 0.03, LIGHT, { sidesOnly: true });
      for (var px = -3; px <= 3; px++) gb.box(px * hwF * 0.24, topF - 0.14, gz, hwF * 0.16, 0.05, 0.03, LIGHT, { sidesOnly: true });
    } else if (T.twoTier) {
      for (var sd0 = -1; sd0 <= 1; sd0 += 2) { gb.box(sd0 * hwF * 0.68, hy + 0.08, gz, hwF * 0.5, 0.045, 0.03, LIGHT, { sidesOnly: true }); gb.box(sd0 * hwF * 0.68, hy - 0.04, gz, hwF * 0.5, 0.045, 0.03, LIGHT, { sidesOnly: true }); }
      gb.box(0, hy - 0.02, gz, hwF * 0.9, 0.34, 0.03, 0x111316, { sidesOnly: true });
      for (var gl = 0; gl < 6; gl++) gb.box(0, hy - 0.16 + gl * 0.055, gz + 0.008, hwF * 0.86, 0.018, 0.02, CHROME, { sidesOnly: true });
    } else {
      for (var sd = -1; sd <= 1; sd += 2) {
        gb.box(sd * hwF * 0.64, hy + 0.02, gz, hwF * 0.56, 0.12, 0.03, LIGHT, { sidesOnly: true });
        if (T.detail) gb.box(sd * hwF * 0.64, hy + 0.10, gz + 0.006, hwF * 0.56, 0.025, 0.02, 0xffffff, { sidesOnly: true });
      }
      gb.box(0, hy - 0.05, gz, hwF * 0.62, 0.20, 0.03, 0x111316, { sidesOnly: true });
    }
    gb.box(0, 0.30 + 0.13, gz, hwF * 1.5, 0.12, 0.03, 0x1a1c20, { sidesOnly: true });                    // 아래 흡기구
    gb.box(0, 0.30 + 0.27, gz + 0.01, 0.50, 0.11, 0.02, PLATE, { sidesOnly: true });                      // 번호판(앞)
    // 후미등(뒤): 전폭 바 또는 좌우 블록, 번호판, 머플러
    var ty = Math.min(topR - 0.12, belt - 0.15), rz = zr - 0.012;
    if (T.tailBar) {
      gb.box(0, ty, rz, hwR * 1.8, 0.05, 0.03, TAIL, { sidesOnly: true });
      for (var sd2 = -1; sd2 <= 1; sd2 += 2) gb.box(sd2 * hwR * 0.74, ty - 0.06, rz, hwR * 0.4, 0.10, 0.03, TAIL, { sidesOnly: true });
    } else {
      for (var sd3 = -1; sd3 <= 1; sd3 += 2) gb.box(sd3 * hwR * 0.66, ty, rz, hwR * 0.5, 0.13, 0.03, TAIL, { sidesOnly: true });
    }
    gb.box(0, 0.30 + 0.27, rz - 0.01, 0.50, 0.11, 0.02, PLATE, { sidesOnly: true });
    gb.box(0, 0.30 + 0.12, rz, hwR * 1.5, 0.10, 0.03, 0x1a1c20, { sidesOnly: true });
    if (T.detail) for (var sd4 = -1; sd4 <= 1; sd4 += 2) gb.box(sd4 * hwR * 0.62, 0.30 + 0.12, rz - 0.02, 0.15, 0.07, 0.05, CHROME, { sidesOnly: true });
    // 사이드미러(앞유리 밑단 옆): 하우징 + 어두운 거울면
    if (ws) {
      var mz = ws[0].z + 0.10, my = belt + 0.11, mx = section(T, mz, pr.top(mz), false, color).P[6][0];
      for (var sm = -1; sm <= 1; sm += 2) { gb.box(sm * (mx + 0.11), my, mz, 0.24, 0.11, 0.15, color, {}); gb.box(sm * (mx + 0.11), my, mz - 0.078, 0.20, 0.09, 0.01, GLASS, { sidesOnly: true }); }
    }
    // 문 이음선·손잡이·안테나(승용)
    if (!T.bus && !T.cargo && !T.van) {
      [l * 0.12, -l * 0.03, -l * 0.24].forEach(function (zsm, idx) {
        if (idx === 1) return;
        var sx = section(T, zsm, pr.top(zsm), false, color).P[5][0] + 0.004;
        gb.box(sx, (0.40 + belt) / 2, zsm, 0.008, belt - 0.42, 0.014, 0x2a2e33, {}); gb.box(-sx, (0.40 + belt) / 2, zsm, 0.008, belt - 0.42, 0.014, 0x2a2e33, {});
      });
      [l * 0.06, -l * 0.19].forEach(function (zh) {
        var sx2 = section(T, zh, pr.top(zh), false, color).P[6][0] + 0.006;
        gb.box(sx2, belt - 0.16, zh, 0.02, 0.028, 0.16, T.detail ? CHROME : lighten(color, 0.85), {}); gb.box(-sx2, belt - 0.16, zh, 0.02, 0.028, 0.16, T.detail ? CHROME : lighten(color, 0.85), {});
      });
      var rz2 = -l * 0.30, rt = pr.top(rz2);
      if (rt > belt + 0.2) gb.box(0, rt + 0.03, rz2, 0.06, 0.06, 0.22, DARK, {});    // 샤크핀 안테나
    }
    // 경찰차: 경광등 받침(지붕 최고점)
    if (T.police) { var rY = roofY(T); gb.box(0, rY + 0.03, -l * 0.04, 1.05, 0.06, 0.36, 0x2b2f35, {}); }
    // 버스: 앞 행선판 + 문
    if (T.bus) {
      gb.box(0, 2.65, zf + 0.03, w * 0.7, 0.4, 0.04, 0xffd23f, { sidesOnly: true });
      gb.box(-w / 2 - 0.01, 1.2, l * 0.30, 0.03, 1.9, 1.1, 0x2f4256, { sidesOnly: true });
      gb.box(-w / 2 - 0.01, 1.2, -l * 0.15, 0.03, 1.9, 1.1, 0x2f4256, { sidesOnly: true });
    }
  }

  function wheels(gb, T) {
    var r = T.wheelR, w = T.w, l = T.l;
    var zs = T.bus ? [l * 0.33, -l * 0.30] : T.cargo ? [l * 0.33, -l * 0.12, -l * 0.34] : [l * 0.31, -l * 0.31];
    for (var i = 0; i < zs.length; i++) for (var s = -1; s <= 1; s += 2) wheelAt(gb, s * (w / 2 - 0.07), r, zs[i], r, !!T.detail);
  }
  // 타이어 + 림. detail 이면 5-스포크 림(스포크 5개 + 허브).
  function wheelAt(gb, x, y, z, r, detail) {
    gb.wheel(x, y, z, r, 0.26, detail ? 22 : 12, DARK);
    if (!detail) { gb.wheel(x, y, z, r * 0.55, 0.28, 8, RIM); return; }
    gb.wheel(x, y, z, r * 0.62, 0.27, 16, 0x2a2e33);
    gb.wheel(x, y, z, r * 0.64, 0.285, 16, RIM);
    gb.wheel(x, y, z, r * 0.14, 0.30, 8, RIM);
    for (var k = 0; k < 5; k++) {
      var a = k / 5 * Math.PI * 2, sl = r * 0.5;
      var cy = y + Math.cos(a) * sl / 2, cz = z + Math.sin(a) * sl / 2;
      spokeBox(gb, x, cy, cz, a, sl, 0.09, 0.30, RIM);
    }
  }
  function spokeBox(gb, x, cy, cz, ang, len, thick, wid, color) {
    var c = Math.cos(ang), s = Math.sin(ang), hl = len / 2, ht = thick / 2, hw = wid / 2;
    function P(u, v, sx) { return [x + sx * hw, cy + u * c - v * s, cz + u * s + v * c]; }
    for (var side = -1; side <= 1; side += 2) {
      var A = P(-hl, -ht, side), B = P(hl, -ht, side), C2 = P(hl, ht, side), D = P(-hl, ht, side);
      if (side > 0) gb.quad(A, B, C2, D, [1, 0, 0], color, null); else gb.quad(A, D, C2, B, [-1, 0, 0], color, null);
    }
    gb.quad(P(-hl, ht, -1), P(hl, ht, -1), P(hl, ht, 1), P(-hl, ht, 1), [0, -s, c], color, null);
    gb.quad(P(-hl, -ht, 1), P(hl, -ht, 1), P(hl, -ht, -1), P(-hl, -ht, -1), [0, s, -c], color, null);
  }

  // 이륜차(오토바이)·자전거: 바퀴 2개 + 프레임 + 탑승자(헬멧·상체·팔·다리). 로프트를 쓰지 않는다. 원점 = 바닥 중심, +z 앞, +x 왼쪽.
  TYPES.moto = { w: 0.78, l: 2.15, belt: 0.85, wheelR: 0.31, two: 'moto', pts: [[0.5, 0.3], [-0.5, 0.3]] };
  TYPES.bike = { w: 0.55, l: 1.80, belt: 0.95, wheelR: 0.34, two: 'bike', pts: [[0.5, 0.3], [-0.5, 0.3]] };
  function twoWheeler(gb, T, color) {
    var moto = T.two === 'moto', l = T.l, r = T.wheelR, FR = moto ? color : 0x2f8f5a, SKIN = 0xe0b596, JEANS = 0x2b3a55, TOP = moto ? 0x1f2429 : (color || 0xc94d43), HELMET = moto ? 0xf2f2f2 : 0xf3c418;
    gb.wheel(0, r, l * 0.36, r, moto ? 0.14 : 0.05, 14, DARK); gb.wheel(0, r, -l * 0.36, r, moto ? 0.16 : 0.05, 14, DARK);
    gb.wheel(0, r, l * 0.36, r * 0.55, moto ? 0.10 : 0.03, 8, RIM); gb.wheel(0, r, -l * 0.36, r * 0.55, moto ? 0.12 : 0.03, 8, RIM);
    if (moto) {
      gb.box(0, r + 0.25, 0.05, 0.42, 0.34, 1.0, FR, {});                       // 탱크·엔진부
      gb.box(0, r + 0.42, -0.35, 0.36, 0.10, 0.62, 0x15171a, {});               // 시트
      gb.box(0, r + 0.32, l * 0.30, 0.34, 0.30, 0.34, FR, {});                  // 앞 카울
      gb.box(0, r + 0.44, l * 0.36, 0.14, 0.10, 0.06, LIGHT, { sidesOnly: true });   // 전조등
      gb.box(0, r + 0.30, -l * 0.40, 0.14, 0.06, 0.05, TAIL, { sidesOnly: true });   // 후미등
      gb.box(0, r + 0.55, l * 0.22, 0.66, 0.03, 0.03, 0x2a2e33, {});            // 핸들바
      gb.box(0, r + 0.02, -l * 0.44, 0.30, 0.10, 0.04, PLATE, { sidesOnly: true }); // 번호판
      for (var s = -1; s <= 1; s += 2) gb.box(s * 0.18, r + 0.05, l * 0.02, 0.06, 0.18, 0.5, 0x2a2e33, {});   // 머플러·프레임
    } else {
      gb.box(0, r + 0.18, 0.0, 0.05, 0.05, l * 0.62, FR, {});                     // 아래 프레임
      gb.box(0, r + 0.55, -0.02, 0.05, 0.05, l * 0.46, FR, {});                   // 위 프레임
      gb.box(0, r + 0.36, -l * 0.32, 0.05, 0.36, 0.05, FR, {}); gb.box(0, r + 0.36, l * 0.28, 0.05, 0.36, 0.05, FR, {});   // 시트 기둥·헤드튜브
      gb.box(0, r + 0.62, -l * 0.30, 0.20, 0.05, 0.24, 0x15171a, {});            // 안장
      gb.box(0, r + 0.62, l * 0.30, 0.50, 0.03, 0.03, 0x2a2e33, {});             // 핸들
      gb.box(0, r + 0.02, l * 0.0, 0.28, 0.02, 0.02, 0x2a2e33, {});              // 페달 축
    }
    // 탑승자: 다리·몸통·팔·머리·헬멧
    var seatY = r + (moto ? 0.47 : 0.65), seatZ = moto ? -0.2 : -l * 0.24;
    for (var q = -1; q <= 1; q += 2) { gb.box(q * (moto ? 0.2 : 0.14), seatY - 0.16, seatZ + 0.10, 0.12, 0.32, 0.14, JEANS, {}); gb.box(q * (moto ? 0.2 : 0.14), seatY - 0.36, seatZ + 0.22, 0.10, 0.10, 0.22, 0x1a1c20, {}); }
    gb.box(0, seatY + 0.28, seatZ + 0.02, 0.38, 0.52, 0.24, TOP, {});          // 상체(앞으로 살짝 숙임)
    for (var a = -1; a <= 1; a += 2) gb.box(a * 0.22, seatY + 0.32, seatZ + 0.28, 0.09, 0.09, 0.46, TOP, {});   // 팔(핸들로)
    gb.box(0, seatY + 0.62, seatZ + 0.02, 0.18, 0.18, 0.18, SKIN, {});          // 머리
    gb.box(0, seatY + 0.68, seatZ + 0.02, 0.22, 0.15, 0.24, HELMET, {});        // 헬멧
    if (moto) gb.box(0, seatY + 0.60, seatZ + 0.15, 0.2, 0.08, 0.02, 0x0b0e12, { sidesOnly: true });   // 바이저
  }
  function build(type, color, bodyOnly) {
    var key = type + ':' + color + ':' + (bodyOnly ? 1 : 0);
    if (cache[key]) return cache[key];
    var T = TYPES[type], gb = new TG.GeoBuilder();
    if (T.two) { twoWheeler(gb, T, color); return (cache[key] = gb.build()); }
    body(gb, T, color, {});
    if (!bodyOnly) wheels(gb, T);
    return (cache[key] = gb.build());
  }
  function wheelGeo(r, detail) {
    var key = 'wh:' + r + ':' + (detail ? 1 : 0);
    if (cache[key]) return cache[key];
    var gb = new TG.GeoBuilder();
    wheelAt(gb, 0, 0, 0, r, !!detail);
    return (cache[key] = gb.build());
  }
  function roofY(T) { var y = 0; for (var i = 0; i < T.pts.length; i++) y = Math.max(y, T.pts[i][1]); return y; }
  // 후드 높이(엠블럼 위치용): 앞유리 밑단 앞 0.9m 지점의 윗선
  function hoodAt(T, zBack) { var pr = profile(T); return pr.top(zBack); }
  // 후드 데칼 지오메트리: 후드 곡면을 따라가는 띠(UV: u 좌→우, v 앞→앞유리). 도색 텍스처를 얹는다.
  function hoodDecal(T) {
    var key = 'hd:' + T.w + ':' + T.l;
    if (cache[key]) return cache[key];
    var pr = profile(T), env = pr.env, wsBase = null;
    for (var e = 0; e < env.length - 1; e++) if (env[e + 1].glass && env[e].z > 0 && !wsBase) wsBase = env[e].z;
    var z0 = pr.zf - 0.08, z1 = (wsBase || T.l * 0.15) - 0.04, N = 10, pos = [], uv = [], idx = [];
    for (var i = 0; i <= N; i++) {
      var t = i / N, z = z0 + (z1 - z0) * t, hw = section(T, z, pr.top(z), false, 0xffffff).P[6][0] * 0.94, y = pr.top(z) + 0.012;
      pos.push(hw, y, z, -hw, y, z); uv.push(0, t, 1, t);
    }
    for (var k = 0; k < N; k++) { var b = k * 2; idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3); }
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    return (cache[key] = g);
  }
  // 옆면 데칼 지오메트리: 로커~벨트 사이 평평한 옆면에 붙는 사각형(UV: u 뒤→앞, v 벨트→로커). side = ±1
  function sideDecal(T, side) {
    var key = 'sd:' + T.w + ':' + T.l + ':' + side;
    if (cache[key]) return cache[key];
    var pr = profile(T), l = T.l, belt = T.belt, z0 = -l * 0.42, z1 = l * 0.46, N = 12, pos = [], uv = [], idx = [];
    for (var i = 0; i <= N; i++) {
      var t = i / N, z = z0 + (z1 - z0) * t, P = section(T, z, pr.top(z), false, 0xffffff).P, x = side * (P[5][0] + 0.012);
      var yTop = Math.min(belt - 0.03, pr.top(z) - 0.05), yBot = 0.40;
      pos.push(x, yTop, z, x, yBot, z); uv.push(t, 1, t, 0);
    }
    for (var k = 0; k < N; k++) { var b = k * 2; if (side > 0) idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); else idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3); }
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    return (cache[key] = g);
  }

  // ---------- 실내(차내 시점) ----------
  // 배치는 운전자 눈(E)을 기준: 순찰차 사진처럼 낮고 넓은 대시보드, 중앙 내비 태블릿, 조수석 쪽 단속 단말(MDT), 룸미러·블랙박스, 선바이저, 도어 트림, 동승 경찰관.
  function layout(T) {
    var key = 'lay:' + T.w + ':' + T.l;
    if (cache[key]) return cache[key];
    var roof = roofY(T), l = T.l, pr = profile(T), env = pr.env, ws0 = null, ws1 = null;
    for (var e = 0; e < env.length - 1; e++) if (env[e + 1].glass && env[e].z > 0 && !ws0) { ws0 = env[e]; ws1 = env[e + 1]; }
    var wsBase = ws0 ? ws0.z : l * 0.15, wsTop = ws1 ? ws1.z : l * 0.03, wsBaseY = ws0 ? ws0.y : T.belt, wsTopY = ws1 ? ws1.y : roof;
    var eyeZ = wsBase - 0.95, eyeY = roof - 0.27;   // 눈은 앞유리 밑단에서 0.95m 뒤(운전석). 예전 식은 눈을 앞유리 위에 두어 대시보드가 후드 위로 나갔다
    var L = {
      eye: { x: 0.38, y: eyeY, z: eyeZ }, roof: roof, wsBase: wsBase, wsTop: wsTop, wsBaseY: wsBaseY, wsTopY: wsTopY,
      dashTop: eyeY - 0.40, dashFront: eyeZ + 0.46,
      clusterY: eyeY - 0.29, clusterZ: eyeZ + 0.66, clusterW: 0.34, clusterH: 0.13,
      wheel: { x: 0.38, y: eyeY - 0.31, z: eyeZ + 0.37, tilt: -0.56 },
      nav: { x: 0.0, y: eyeY - 0.27, z: eyeZ + 0.62, w: 0.26, h: 0.17 },
      mdt: { x: -0.45, y: eyeY - 0.26, z: eyeZ + 0.60, w: 0.30, h: 0.18 },
      roomMirror: { x: 0, y: eyeY + 0.13, z: eyeZ + 0.46 },
      sideMirror: { x: T.w / 2 + 0.17, y: T.belt + 0.11, z: wsBase + 0.10 },
      screen: { x: 0.72, y: eyeY - 0.24, z: eyeZ + 0.58 },
    };
    return (cache[key] = L);
  }
  // 두 점을 잇는 기울어진 빔(폭 w 는 x 방향, 두께 d 는 진행 방향에 수직). 필러처럼 계단 없이 매끈하게.
  function slantBeam(gb, x0, y0, z0, x1, y1, z1, w, d, color) {
    var dy = y1 - y0, dz = z1 - z0, len = Math.hypot(dy, dz) || 1, ny = -dz / len * d / 2, nz = dy / len * d / 2, hw = w / 2;
    function P(x, y, z, sx, sn) { return [x + sx * hw, y + sn * ny, z + sn * nz]; }
    var A0 = P(x0, y0, z0, -1, -1), B0 = P(x0, y0, z0, 1, -1), C0 = P(x0, y0, z0, 1, 1), D0 = P(x0, y0, z0, -1, 1);
    var A1 = P(x1, y1, z1, -1, -1), B1 = P(x1, y1, z1, 1, -1), C1 = P(x1, y1, z1, 1, 1), D1 = P(x1, y1, z1, -1, 1);
    gb.quad(A0, A1, D1, D0, [-1, 0, 0], color, null); gb.quad(B0, C0, C1, B1, [1, 0, 0], color, null);
    gb.quad(A0, B0, B1, A1, [0, -nz, ny], color, null); gb.quad(D0, D1, C1, C0, [0, nz, -ny], color, null);
  }
  function interior(T) {
    var key = 'int:' + T.w + ':' + T.l;
    if (cache[key]) return cache[key];
    var gb = new TG.GeoBuilder(), w = T.w, l = T.l, belt = T.belt, L = layout(T);
    var DASH = 0x1b1e23, DASH2 = 0x262a30, PAD = 0x2e3239, TRIM = 0x8b9096, HEAD = 0xb4b8bd, SEAT = 0x2a2d33, SEAT2 = 0x35393f, VEST = 0xd4ff3c, SKIN = 0xe6b89c, CAP = 0x1d2a4d, SCREEN = 0x0b0e12;
    var top = L.dashTop, zf = L.dashFront, zb = L.wsBase + 0.02, depth = zb - zf, hw = w * 0.47, pr = profile(T);
    gb.box(0, L.wsBaseY - 0.02, zb + 0.02, w * 0.96, 0.05, 0.10, 0x1a1c20, {});                      // 카울(와이퍼 홈)
    for (var wi = -1; wi <= 1; wi += 2) gb.box(wi * 0.35, L.wsBaseY + 0.005, zb + 0.10, 0.02, 0.015, 0.55, 0x111316, { rotY: wi * 0.35 });   // 와이퍼
    // 대시보드: 상판(부드러운 어두운 패드) + 앞면 두 단 + 은색 가로 몰딩
    gb.box(0, top - 0.05, (zf + zb) / 2, hw * 2, 0.10, depth, DASH, {});
    gb.box(0, top - 0.02, zb - 0.03, hw * 2 * 0.98, 0.04, 0.08, DASH2, {});
    gb.box(0, top - 0.20, zf + 0.10, hw * 2, 0.22, 0.20, DASH, {});
    gb.box(0, top - 0.42, zf + 0.16, hw * 2, 0.24, 0.10, DASH2, {});                                   // 무릎 쪽 하단
    gb.box(0, top - 0.10, zf - 0.005, hw * 2 * 0.98, 0.012, 0.02, TRIM, {});                          // 가로 몰딩(은색)
    gb.box(0, top - 0.31, zf - 0.002, hw * 2 * 0.98, 0.006, 0.02, TRIM, {});
    // 송풍구(좌·우·중앙 2)
    [0.72, 0.16, -0.16, -0.72].forEach(function (vx) { gb.box(vx, top - 0.16, zf - 0.006, 0.16, 0.05, 0.012, 0x0f1114, {}); for (var f = -1; f <= 1; f++) gb.box(vx, top - 0.16 + f * 0.015, zf - 0.012, 0.15, 0.004, 0.006, TRIM, {}); });
    // 계기판 후드(바이내클): 운전석 앞, 위 챙
    gb.box(L.wheel.x, L.clusterY + 0.02, L.clusterZ + 0.06, L.clusterW + 0.12, L.clusterH + 0.10, 0.14, DASH, {});
    gb.box(L.wheel.x, L.clusterY + L.clusterH / 2 + 0.06, L.clusterZ - 0.02, L.clusterW + 0.16, 0.03, 0.26, DASH, {});
    gb.box(L.wheel.x, L.clusterY, L.clusterZ + 0.005, L.clusterW + 0.02, L.clusterH + 0.02, 0.01, SCREEN, {});
    // 중앙 내비 태블릿 받침 + 조수석 쪽 MDT(단속 단말) 받침·거치대
    gb.box(L.nav.x, L.nav.y, L.nav.z + 0.012, L.nav.w + 0.03, L.nav.h + 0.03, 0.02, 0x0f1114, {});
    gb.box(L.nav.x, L.nav.y - L.nav.h / 2 - 0.03, L.nav.z + 0.02, 0.06, 0.06, 0.05, TRIM, {});
    gb.box(L.mdt.x, L.mdt.y, L.mdt.z + 0.012, L.mdt.w + 0.03, L.mdt.h + 0.03, 0.02, 0x0f1114, { rotY: -0.25 });
    gb.box(L.mdt.x, L.mdt.y - L.mdt.h / 2 - 0.04, L.mdt.z + 0.03, 0.05, 0.08, 0.05, TRIM, {});
    // 센터 스택: 공조 노브·비상등·버튼 열
    gb.box(0, top - 0.24, zf - 0.004, 0.30, 0.09, 0.01, 0x0f1114, {});
    for (var kb = -2; kb <= 2; kb++) gb.box(kb * 0.055, top - 0.22, zf - 0.012, 0.04, 0.02, 0.01, kb === 0 ? 0xd12b2b : TRIM, {});
    gb.cylinder(-0.09, top - 0.30, zf - 0.02, 0.02, 0.02, 0.02, 10, TRIM, true); gb.cylinder(0.09, top - 0.30, zf - 0.02, 0.02, 0.02, 0.02, 10, TRIM, true);
    // 핸들 컬럼 + 레버 두 개
    gb.box(L.wheel.x, L.wheel.y - 0.03, (L.wheel.z + zf) / 2, 0.09, 0.09, zf - L.wheel.z + 0.02, 0x111418, {});
    gb.box(L.wheel.x + 0.14, L.wheel.y + 0.02, L.wheel.z + 0.10, 0.12, 0.02, 0.02, 0x111418, {}); gb.box(L.wheel.x - 0.14, L.wheel.y + 0.02, L.wheel.z + 0.10, 0.12, 0.02, 0.02, 0x111418, {});
    // 센터 콘솔: 기어 노브·컵홀더·무전기(적색 LED)
    gb.box(0, belt - 0.56, zf - 0.40, 0.36, 0.44, 0.95, SEAT, {});
    gb.box(0, belt - 0.32, zf - 0.20, 0.30, 0.03, 0.22, 0x0f1114, {});
    gb.box(0, belt - 0.24, zf - 0.22, 0.05, 0.14, 0.05, TRIM, {}); gb.box(0, belt - 0.14, zf - 0.22, 0.09, 0.06, 0.09, 0x111418, {});
    gb.cylinder(-0.08, belt - 0.33, zf - 0.55, 0.035, 0.035, 0.02, 10, 0x0f1114, true); gb.cylinder(0.08, belt - 0.33, zf - 0.55, 0.035, 0.035, 0.02, 10, 0x0f1114, true);
    gb.box(0, belt - 0.30, zf - 0.02, 0.18, 0.06, 0.12, 0x101215, {}); gb.box(0.05, belt - 0.265, zf - 0.02, 0.012, 0.006, 0.012, 0xff3b30, {});
    // 시트(운전석·조수석): 방석·등받이·헤드레스트
    for (var s = -1; s <= 1; s += 2) {
      var sx = s * 0.40;
      gb.box(sx, belt - 0.45, L.eye.z - 0.10, 0.52, 0.16, 0.52, SEAT, {});
      gb.box(sx, belt - 0.02, L.eye.z - 0.34, 0.54, 0.70, 0.16, SEAT, {});
      gb.box(sx, belt - 0.02, L.eye.z - 0.335, 0.34, 0.50, 0.02, SEAT2, {});
      gb.box(sx, belt + 0.40, L.eye.z - 0.33, 0.26, 0.20, 0.12, SEAT, {});
    }
    // 동승 경찰관(조수석): 형광 조끼·팔·머리·경찰 모자. 오른쪽 옆 패널에서 보인다
    var ox = -0.40, oz = L.eye.z - 0.12;
    gb.box(ox, belt - 0.02, oz, 0.42, 0.56, 0.26, 0x2b3a55, {});                                     // 상의(근무복 남색)
    gb.box(ox, belt + 0.02, oz + 0.005, 0.40, 0.42, 0.27, VEST, {});                                   // 형광 조끼
    gb.box(ox, belt + 0.10, oz + 0.01, 0.41, 0.03, 0.275, 0xc8ccd2, {}); gb.box(ox, belt - 0.06, oz + 0.01, 0.41, 0.03, 0.275, 0xc8ccd2, {});   // 반사띠
    gb.box(ox + 0.26, belt - 0.10, oz + 0.10, 0.10, 0.44, 0.12, 0x2b3a55, {}); gb.box(ox - 0.26, belt - 0.10, oz + 0.10, 0.10, 0.44, 0.12, 0x2b3a55, {});   // 팔
    gb.box(ox + 0.26, belt - 0.32, oz + 0.22, 0.09, 0.08, 0.10, SKIN, {}); gb.box(ox - 0.26, belt - 0.32, oz + 0.22, 0.09, 0.08, 0.10, SKIN, {});           // 손
    gb.box(ox, belt + 0.42, oz, 0.20, 0.24, 0.22, SKIN, {});                                           // 머리
    gb.box(ox, belt + 0.58, oz, 0.24, 0.09, 0.25, CAP, {}); gb.box(ox, belt + 0.60, oz + 0.005, 0.245, 0.03, 0.255, 0xe8ecf0, {}); gb.box(ox, belt + 0.545, oz + 0.16, 0.22, 0.02, 0.10, 0x101215, {});   // 모자(남색·흰 띠·챙)
    gb.box(ox + 0.10, belt + 0.02, oz + 0.145, 0.05, 0.52, 0.015, 0x3a3d44, {});                        // 안전벨트(어깨띠)
    // 도어 트림(양쪽): 창턱·상단 패드·팔걸이·하단 패널·손잡이
    for (var d = -1; d <= 1; d += 2) {
      var dx = d * (w / 2 - 0.05), zc = L.eye.z - 0.05;
      gb.box(dx, belt + 0.01, zc, 0.06, 0.05, 1.45, DASH2, {});
      gb.box(dx, belt - 0.16, zc, 0.05, 0.30, 1.45, DASH, {});
      gb.box(dx - d * 0.06, belt - 0.24, zc + 0.10, 0.14, 0.05, 0.55, PAD, {});
      gb.box(dx, belt - 0.55, zc, 0.04, 0.48, 1.45, 0x3c4048, {});
      gb.cylinder(dx - d * 0.03, belt - 0.62, zc - 0.25, 0.09, 0.09, 0.012, 12, 0x2a2d33, true);              // 스피커 그릴
      gb.box(dx - d * 0.03, belt - 0.72, zc + 0.30, 0.03, 0.12, 0.42, 0x2f3238, {});                          // 도어 포켓
      gb.box(dx - d * 0.05, belt - 0.12, zc + 0.30, 0.06, 0.03, 0.14, TRIM, {});
      gb.box(dx - d * 0.04, belt - 0.05, zc + 0.35, 0.05, 0.02, 0.12, 0x0f1114, {});                   // 창문 스위치
    }
    // A필러(앞유리 옆 비스듬히 5토막)·헤더·선바이저·천장(밝은 헤드라이너)·B필러
    for (var s2 = -1; s2 <= 1; s2 += 2) {
      // A필러: 앞유리 밑단 → 윗단을 잇는 하나의 기울어진 빔(계단 없음)
      var pa = section(T, zb, pr.top(zb), true, 0xffffff).P, pb = section(T, L.wsTop, pr.top(L.wsTop), true, 0xffffff).P;
      slantBeam(gb, s2 * (Math.max(pa[8][0], pa[10][0]) - 0.02), L.wsBaseY + 0.02, zb, s2 * (Math.max(pb[8][0], pb[10][0]) - 0.02), L.wsTopY - 0.02, L.wsTop, 0.06, 0.09, DASH2);
      for (var i2 = 0; i2 < 0; i2++) {
        var t = (i2 + 0.5) / 8, pz = zb + (L.wsTop - zb) * t, py = L.wsBaseY + (L.wsTopY - L.wsBaseY) * t;
        var secP = section(T, pz, pr.top(pz), true, 0xffffff).P, px = s2 * (Math.max(secP[8][0], secP[10][0]) - 0.012);
        gb.box(px, py, pz, 0.05, Math.abs(L.wsTopY - L.wsBaseY) / 8 + 0.04, Math.abs(L.wsTop - zb) / 8 + 0.02, DASH2, {});
      }
      var bz = -l * 0.03, bt = pr.top(bz), bsec = section(T, bz, bt, false, 0xffffff).P;
      gb.box(s2 * (bsec[8][0] - 0.03), (belt + bt) / 2, bz, 0.07, bt - belt - 0.08, 0.10, DASH2, {});
    }
    gb.box(0, L.roof - 0.04, L.wsTop - 0.03, w * 0.92, 0.06, 0.10, DASH2, {});                        // 헤더
    for (var v = -1; v <= 1; v += 2) gb.box(v * 0.40, L.roof - 0.09, L.wsTop - 0.02 - 0.12, 0.44, 0.012, 0.22, 0x9ea3a9, {});   // 선바이저
    gb.box(0, L.roof - 0.02, L.wsTop - 0.02 - l * 0.20, w * 0.90, 0.03, l * 0.40, HEAD, { noTop: true });   // 헤드라이너
    gb.box(0, L.roof - 0.05, L.wsTop - 0.02 - 0.55, 0.16, 0.05, 0.14, 0x1a1c20, {});                    // 실내등·마이크
    // 룸미러 위 블랙박스(대시캠)
    gb.box(L.roomMirror.x, L.roomMirror.y + 0.075, L.roomMirror.z + 0.03, 0.10, 0.06, 0.07, 0x111316, {});
    gb.cylinder(L.roomMirror.x, L.roomMirror.y + 0.05, L.roomMirror.z + 0.075, 0.012, 0.014, 0.02, 8, 0x0a0c0f, true);
    return (cache[key] = gb.build());
  }
  return { TYPES: TYPES, build: build, wheelGeo: wheelGeo, interior: interior, roofY: roofY, layout: layout, hoodAt: hoodAt, profile: profile, hoodDecal: hoodDecal, sideDecal: sideDecal };
})();
