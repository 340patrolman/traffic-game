// 차량 형상: 옆면 실루엣(범퍼→후드→앞유리→지붕→뒷유리→트렁크)을 폭 방향으로 밀어낸 로프트.
// 벨트라인 위는 유리 띠, 지붕은 살짝 좁아진다. 전조등·후미등·그릴·거울·번호판·바퀴(림)까지 전부 코드.
// 바퀴: x축 방향 원기둥(양쪽 캡 포함). 원점 = 바퀴 중심.
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

TG.vehmesh = (function () {
  var GLASS = 0x22303f, DARK = 0x1a1c20, LIGHT = 0xfff3c4, TAIL = 0xc41818, PLATE = 0xf4f4ec, RIM = 0xb9bcc2;
  // pts: [zFrac(+앞 … −뒤), y, glass(1)]  — 연속 두 점 사이 구간이 glass=1 이면 그 구간은 유리
  var TYPES = {
    sedan:  { w: 1.82, l: 4.65, belt: 0.92, wheelR: 0.33, pts: [[0.5, 0.40], [0.5, 0.60], [0.45, 0.72], [0.17, 0.82], [0.05, 1.36, 1], [-0.27, 1.40], [-0.40, 1.06, 1], [-0.5, 0.98], [-0.5, 0.40]] },
    hatch:  { w: 1.74, l: 4.05, belt: 0.92, wheelR: 0.31, pts: [[0.5, 0.40], [0.5, 0.62], [0.42, 0.74], [0.19, 0.84], [0.04, 1.40, 1], [-0.37, 1.45], [-0.47, 1.04, 1], [-0.5, 0.96], [-0.5, 0.40]] },
    suv:    { w: 1.92, l: 4.75, belt: 1.08, wheelR: 0.37, pts: [[0.5, 0.44], [0.5, 0.84], [0.43, 0.98], [0.17, 1.06], [0.06, 1.72, 1], [-0.40, 1.76], [-0.48, 1.22, 1], [-0.5, 1.10], [-0.5, 0.44]] },
    van:    { w: 1.98, l: 5.10, belt: 1.12, glassTop: 1.75, wheelR: 0.35, pts: [[0.5, 0.44], [0.5, 0.92], [0.45, 1.02], [0.34, 1.96, 1], [-0.47, 2.02], [-0.5, 1.92], [-0.5, 0.44]] },
    truck:  { w: 2.15, l: 6.4, belt: 1.15, glassTop: 2.0, wheelR: 0.42, cargo: true, pts: [[0.5, 0.50], [0.5, 1.12], [0.47, 1.28], [0.40, 2.35, 1], [0.17, 2.42], [0.15, 1.0], [0.15, 0.50]] },
    bus:    { w: 2.45, l: 11.0, belt: 1.30, glassTop: 2.45, wheelR: 0.48, bus: true, pts: [[0.5, 0.45], [0.5, 1.30], [0.49, 2.95], [0.46, 3.18], [-0.46, 3.22], [-0.5, 3.0], [-0.5, 0.45]] },
    police: { w: 1.85, l: 4.70, belt: 0.92, wheelR: 0.33, police: true, pts: [[0.5, 0.40], [0.5, 0.60], [0.45, 0.72], [0.17, 0.82], [0.05, 1.36, 1], [-0.27, 1.40], [-0.40, 1.06, 1], [-0.5, 0.98], [-0.5, 0.40]] },
    psuv:   { w: 1.95, l: 4.90, belt: 1.08, wheelR: 0.37, police: true, pts: [[0.5, 0.44], [0.5, 0.84], [0.43, 0.98], [0.17, 1.06], [0.06, 1.72, 1], [-0.40, 1.76], [-0.48, 1.22, 1], [-0.5, 1.10], [-0.5, 0.44]] },
    // 대형 플래그십 세단(고해상도): 긴 후드·완만한 패스트백 지붕·짧은 데크. 평면도도 앞뒤가 좁아진다(taper).
    pflag:  { w: 1.92, l: 5.05, belt: 0.96, wheelR: 0.36, police: true, detail: true, taper: 0.07, roofScale: 0.84,
              pts: [[0.5, 0.38], [0.5, 0.52], [0.495, 0.66], [0.47, 0.74], [0.42, 0.79], [0.30, 0.84], [0.19, 0.88], [0.12, 0.91], [0.03, 1.22, 1], [-0.06, 1.36, 1], [-0.14, 1.42], [-0.24, 1.43], [-0.32, 1.38], [-0.40, 1.22, 1], [-0.45, 1.06, 1], [-0.49, 0.98], [-0.5, 0.86], [-0.5, 0.38]] },
  };
  var cache = {};

  function lighten(hex, f) {
    var r = Math.min(255, ((hex >> 16) & 255) * f), g = Math.min(255, ((hex >> 8) & 255) * f), b = Math.min(255, (hex & 255) * f);
    return (r << 16) | (g << 8) | b;
  }

  // gb 에 차체를 그린다. 원점 = 차 중심 바닥, +z 앞, +x 왼쪽(three.js 관례에 맞춤: 그룹 rotation.y=heading 일 때 앞이 forward)
  function body(gb, T, color, opts) {
    opts = opts || {};
    var w = T.w, l = T.l, belt = T.belt, glassTop = T.glassTop || 99, roofScale = T.roofScale || 0.86, bottom = 0.34, taper = T.taper || 0;
    var pts = T.pts.map(function (p) { return { z: p[0] * l, y: p[1], glass: !!p[2] }; });
    var roofColor = lighten(color, 1.06), sideColor = color, lowColor = lighten(color, 0.82);
    // 평면 타퍼: 앞뒤 끝으로 갈수록 폭이 조금 좁아진다
    function planW(z) { var u = Math.abs(z) / (l / 2); return w / 2 * (1 - taper * u * u * u); }
    function halfW(y, z) { var hw = z === undefined ? w / 2 : planW(z); return y > belt + 0.04 ? hw * roofScale : hw; }
    // 윗면 로프트(+ 앞뒤 수직면은 첫/끝 점이 수직이라 자동으로 포함)
    for (var i = 0; i < pts.length - 1; i++) {
      var a = pts[i], b = pts[i + 1];
      var wa = halfW(a.y, a.z), wb = halfW(b.y, b.z);
      var dz = b.z - a.z, dy = b.y - a.y, len = Math.hypot(dz, dy) || 1;
      var nz = dy / len, ny = -dz / len;          // 세그먼트에 수직(바깥쪽: 앞→뒤 진행 시 위쪽)
      if (ny < 0) { ny = -ny; nz = -nz; }
      // 유리 표시(glass)가 붙은 점으로 '올라가거나 내려가는' 구간이 유리(앞유리·뒷유리). 벨트 위 평평한 구간은 지붕.
      var col = b.glass ? GLASS : (a.y > belt + 0.04 && b.y > belt + 0.04 ? roofColor : sideColor);
      if (Math.abs(dz) < 1e-4) col = (a.z > 0 ? sideColor : lowColor); // 앞/뒤 수직면
      // 앞→뒤로 갈 때 왼쪽(+x)에서 오른쪽(−x)로: 반시계(위에서 볼 때 법선 위)
      // 감기 방향: (B−A)×(C−A) 가 위(+y)를 향해야 앞면. 앞→뒤(z 감소) 진행이므로 [왼앞, 왼뒤, 오른뒤, 오른앞] 순서.
      gb.quad([wa, a.y, a.z], [wb, b.y, b.z], [-wb, b.y, b.z], [-wa, a.y, a.z], [0, ny, nz], col, null);
    }
    // 옆면: 각 세그먼트마다 하단 띠(bottom~belt) + 유리/상단 띠(belt~y)
    for (var side = -1; side <= 1; side += 2) {
      var nrm = [side, 0, 0];
      for (var k = 0; k < pts.length - 1; k++) {
        var p0 = pts[k], p1 = pts[k + 1];
        if (Math.abs(p1.z - p0.z) < 1e-4) continue;
        var y0 = Math.min(p0.y, belt), y1 = Math.min(p1.y, belt);
        var x0 = side * planW(p0.z), x1 = side * planW(p1.z);
        // 하단 띠
        quadSide(gb, side, x0, x0, bottom, y0, p0.z, x1, x1, bottom, y1, p1.z, nrm, sideColor);
        // 상단 띠(벨트 위)
        if (p0.y > belt || p1.y > belt) {
          var gy0 = Math.max(p0.y, belt), gy1 = Math.max(p1.y, belt);
          var ux0 = side * halfW(gy0, p0.z), ux1 = side * halfW(gy1, p1.z);
          var gcap0 = Math.min(gy0, glassTop), gcap1 = Math.min(gy1, glassTop);
          var glassSeg = (p0.y > belt && p1.y > belt) && !(p0.z > 0.13 * l && p1.z > 0.13 * l && T.cargo);
          // 유리 띠(belt~glassTop)
          quadSide(gb, side, x0, ux0, belt, gcap0, p0.z, x1, ux1, belt, gcap1, p1.z, nrm, glassSeg ? GLASS : sideColor);
          // glassTop 위 차체(버스·밴·트럭)
          if (gy0 > glassTop || gy1 > glassTop) quadSide(gb, side, ux0, ux0, gcap0, gy0, p0.z, ux1, ux1, gcap1, gy1, p1.z, nrm, roofColor);
        }
      }
    }
    // 바닥
    var zf = pts[0].z, zr = pts[pts.length - 1].z;
    gb.quad([-w / 2, bottom, zf], [-w / 2, bottom, zr], [w / 2, bottom, zr], [w / 2, bottom, zf], [0, -1, 0], DARK, null);
    // 화물칸(트럭)
    if (T.cargo) {
      gb.box(0, 0.45 + 1.3, (0.13 * l + (-0.5 * l)) / 2, w, 2.6, 0.63 * l, lighten(color, 0.9), {});
      gb.box(0, 0.42, 0.13 * l + 0.4, w * 0.9, 0.16, 0.6, DARK, {});
    }
    // 전조등·후미등·그릴·번호판
    var hy = pts[1].y * 0.82 + 0.08;
    for (var sx = -1; sx <= 1; sx += 2) {
      gb.box(sx * w * 0.32, hy, zf + 0.02, w * 0.22, 0.14, 0.05, LIGHT, { sidesOnly: true });
      gb.box(sx * w * 0.32, hy, zr - 0.02, w * 0.22, 0.14, 0.05, TAIL, { sidesOnly: true });
    }
    gb.box(0, hy - 0.05, zf + 0.02, w * 0.36, 0.16, 0.04, DARK, { sidesOnly: true });
    gb.box(0, bottom + 0.16, zf + 0.02, 0.44, 0.12, 0.03, PLATE, { sidesOnly: true });
    gb.box(0, bottom + 0.16, zr - 0.02, 0.44, 0.12, 0.03, PLATE, { sidesOnly: true });
    // 거울(앞유리 아래 양쪽)
    var mz = 0, my = belt + 0.1;
    for (var q = 0; q < pts.length; q++) if (pts[q].glass) { mz = pts[q].z + 0.15; break; }
    gb.box(w / 2 + 0.1, my, mz, 0.2, 0.12, 0.16, color, {}); gb.box(-w / 2 - 0.1, my, mz, 0.2, 0.12, 0.16, color, {});
    // 고해상도 디테일(플래그십): 2단 그릴·가는 주간주행등·크롬 벨트 몰딩·도어 핸들·도어 이음선·사이드 스커트·머플러·안테나
    if (T.detail) {
      var CHROME = 0xd8dde3, gz = zf + 0.03, gy = pts[2].y * 0.5 + 0.2;
      gb.box(0, gy + 0.06, gz, w * 0.5, 0.34, 0.04, 0x15181c, { sidesOnly: true });
      for (var gb2 = 0; gb2 < 5; gb2++) gb.box(0, gy - 0.08 + gb2 * 0.07, gz + 0.01, w * 0.46, 0.02, 0.03, CHROME, { sidesOnly: true });
      gb.box(0, gy + 0.06, gz + 0.01, w * 0.52, 0.36, 0.02, CHROME, { sidesOnly: true });
      for (var sd = -1; sd <= 1; sd += 2) {
        gb.box(sd * w * 0.36, hy + 0.09, gz, w * 0.22, 0.03, 0.03, 0xffffff, { sidesOnly: true });   // 주간주행등(위 선)
        gb.box(sd * w * 0.36, hy - 0.09, gz, w * 0.22, 0.03, 0.03, 0xffffff, { sidesOnly: true });   // 주간주행등(아래 선)
        gb.box(sd * w * 0.36, hy, zr - 0.02, w * 0.24, 0.05, 0.03, 0xff6060, { sidesOnly: true });     // 후미등 가는 선
        var sx0 = sd * (planW(0) + 0.01);
        gb.box(sx0, belt + 0.02, 0, 0.02, 0.03, l * 0.62, CHROME, {});                                   // 크롬 벨트 몰딩
        gb.box(sx0, belt - 0.25, l * 0.10, 0.03, 0.03, 0.18, CHROME, {});                               // 앞문 핸들
        gb.box(sx0, belt - 0.25, -l * 0.14, 0.03, 0.03, 0.18, CHROME, {});                              // 뒷문 핸들
        gb.box(sx0, (bottom + belt) / 2, -l * 0.02, 0.012, belt - bottom - 0.1, 0.012, 0x2a2e33, {});     // 앞뒷문 이음선
        gb.box(sx0, (bottom + belt) / 2, -l * 0.26, 0.012, belt - bottom - 0.1, 0.012, 0x2a2e33, {});     // 뒷문·펜더 이음선
        gb.box(sd * (w / 2 - 0.02), bottom + 0.06, 0, 0.04, 0.12, l * 0.58, 0x1a1c20, {});                // 사이드 스커트
        gb.box(sd * w * 0.3, bottom + 0.05, zr - 0.03, 0.14, 0.09, 0.05, CHROME, { sidesOnly: true });    // 머플러 팁
      }
      gb.box(0, pts[10].y + 0.02, pts[12].z, 0.06, 0.05, 0.22, 0x1a1c20, {});                            // 샤크핀 안테나
    }
    // 경찰차: 청색 띠 + 경광등 받침
    if (T.police) {
      gb.box(0, belt - 0.22, 0, w + 0.03, 0.2, l * (T.detail ? 0.62 : 0.8), 0x1f4fa8, { sidesOnly: true });
      var roofY = 0; for (var rp = 0; rp < pts.length; rp++) roofY = Math.max(roofY, pts[rp].y);
      gb.box(0, roofY + 0.04, -l * 0.04, 1.05, 0.08, 0.36, 0x2b2f35, {});   // 경광등 받침(지붕 최고점 기준)
    }
    // 버스: 앞 행선판 + 문
    if (T.bus) {
      gb.box(0, 2.65, zf + 0.03, w * 0.7, 0.4, 0.04, 0xffd23f, { sidesOnly: true });
      gb.box(-w / 2 - 0.01, 1.2, l * 0.30, 0.03, 1.9, 1.1, 0x2f4256, { sidesOnly: true });
      gb.box(-w / 2 - 0.01, 1.2, -l * 0.15, 0.03, 1.9, 1.1, 0x2f4256, { sidesOnly: true });
    }
  }
  function quadSide(gb, side, xa0, xa1, ya0, ya1, za, xb0, xb1, yb0, yb1, zb, nrm, color) {
    // (xa0,ya0)-(xa1,ya1) at za, (xb0,yb0)-(xb1,yb1) at zb. 바깥에서 볼 때 반시계.
    // (B−A)×(C−A) 가 side 방향(±x)을 향하도록: +x 면은 [앞아래, 뒤아래, 뒤위, 앞위], −x 면은 그 반대
    var A = [xa0, ya0, za], B = [xb0, yb0, zb], C = [xb1, yb1, zb], D = [xa1, ya1, za];
    if (side > 0) gb.quad(A, B, C, D, nrm, color, null); else gb.quad(A, D, C, B, nrm, color, null);
  }

  function wheels(gb, T) {
    var r = T.wheelR, w = T.w, l = T.l;
    var zs = T.bus ? [l * 0.33, -l * 0.30] : T.cargo ? [l * 0.33, -l * 0.12, -l * 0.34] : [l * 0.31, -l * 0.31];
    for (var i = 0; i < zs.length; i++) for (var s = -1; s <= 1; s += 2) wheelAt(gb, s * (w / 2 - 0.05), r, zs[i], r, !!T.detail);
  }
  // 타이어 + 림. detail 이면 5-스포크 림(스포크 5개 + 허브) 으로 해상도를 올린다.
  function wheelAt(gb, x, y, z, r, detail) {
    gb.wheel(x, y, z, r, 0.26, detail ? 20 : 12, DARK);
    if (!detail) { gb.wheel(x, y, z, r * 0.55, 0.28, 8, RIM); return; }
    gb.wheel(x, y, z, r * 0.62, 0.27, 16, 0x2a2e33);          // 림 안쪽(어두운 배경)
    gb.wheel(x, y, z, r * 0.64, 0.285, 16, RIM);              // 림 테두리
    gb.wheel(x, y, z, r * 0.14, 0.30, 8, RIM);                // 허브
    for (var k = 0; k < 5; k++) {
      var a = k / 5 * Math.PI * 2, sl = r * 0.5;
      // 스포크: y–z 평면에서 각도 a 방향의 가는 상자(회전은 좌표 직접 계산)
      var cy = y + Math.cos(a) * sl / 2, cz = z + Math.sin(a) * sl / 2;
      spokeBox(gb, x, cy, cz, a, sl, 0.09, 0.30, RIM);
    }
  }
  function spokeBox(gb, x, cy, cz, ang, len, thick, wid, color) {
    var c = Math.cos(ang), s = Math.sin(ang), hl = len / 2, ht = thick / 2, hw = wid / 2;
    function P(u, v, sx) { return [x + sx * hw, cy + u * c - v * s, cz + u * s + v * c]; }
    var col = color;
    for (var side = -1; side <= 1; side += 2) {
      var A = P(-hl, -ht, side), B = P(hl, -ht, side), C2 = P(hl, ht, side), D = P(-hl, ht, side);
      if (side > 0) gb.quad(A, B, C2, D, [1, 0, 0], col, null); else gb.quad(A, D, C2, B, [-1, 0, 0], col, null);
    }
    gb.quad(P(-hl, ht, -1), P(hl, ht, -1), P(hl, ht, 1), P(-hl, ht, 1), [0, -s, c], col, null);
    gb.quad(P(-hl, -ht, 1), P(hl, -ht, 1), P(hl, -ht, -1), P(-hl, -ht, -1), [0, s, -c], col, null);
  }

  // 전체(차체+바퀴) 합친 지오메트리(캐시). 플레이어는 바퀴를 따로 돌리므로 bodyOnly 사용.
  function build(type, color, bodyOnly) {
    var key = type + ':' + color + ':' + (bodyOnly ? 1 : 0);
    if (cache[key]) return cache[key];
    var T = TYPES[type], gb = new TG.GeoBuilder();
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
  // 차내 시점용 실내: 대시보드·계기판·핸들·시트·A필러·룸미러. 원점/축은 차체와 같다.
  function interior(T) {
    var key = 'int:' + T.w + ':' + T.l;
    if (cache[key]) return cache[key];
    var gb = new TG.GeoBuilder(), w = T.w, l = T.l, belt = T.belt, DASH = 0x1f2429, DASH2 = 0x2a3038, LEATHER = 0x2b2f36, TRIM = 0x8a8f96, STITCH = 0x3a4048;
    // 대시보드: 눈높이(belt+0.5)보다 충분히 낮게. 상판은 앞으로 갈수록 내려가는 3단 경사, 운전석 쪽에 계기판 후드(바이내클).
    // 눈높이 1.34 기준: 상판은 0.98 이하(앞유리 아래), 계기판·중앙 디스플레이는 눈에서 30~40° 아래에 오도록 높인다
    var dz = 0.11 * l, dy = belt - 0.02;
    gb.box(0, dy - 0.05, dz + 0.10, w * 0.92, 0.10, 0.30, DASH, {});                // 상판(앞유리 아래, 평평)
    gb.box(0, dy - 0.12, dz + 0.36, w * 0.92, 0.06, 0.24, DASH2, {});               // 상판 앞쪽(낮게)
    gb.box(0, dy - 0.32, dz + 0.02, w * 0.92, 0.42, 0.30, DASH, {});                // 대시보드 앞면(무릎 쪽)
    gb.box(0, dy - 0.11, dz - 0.14, w * 0.92, 0.02, 0.03, STITCH, {});              // 가로 장식선
    // 계기판 후드(바이내클): 운전석 앞, 상판 위로 솟아 눈에 보인다
    gb.box(0.38, dy + 0.10, dz + 0.02, 0.50, 0.20, 0.16, DASH, {});                 // 후드 몸통
    gb.box(0.38, dy + 0.22, dz - 0.02, 0.54, 0.04, 0.26, DASH, {});                 // 후드 챙
    gb.box(0.38, dy + 0.09, dz - 0.07, 0.46, 0.17, 0.02, 0x0b0e12, {});             // 계기판 바탕(검정, 텍스처는 vehicle.js)
    // 중앙 디스플레이(세워서) + 센터 콘솔 + 기어 레버
    gb.box(0, dy + 0.08, dz - 0.06, 0.36, 0.22, 0.03, 0x0b0e12, {});
    gb.box(0, dy + 0.08, dz - 0.075, 0.32, 0.18, 0.01, 0x14324f, { sidesOnly: true });
    gb.box(0, belt - 0.55, dz - 0.55, 0.34, 0.45, 1.0, LEATHER, {});
    gb.box(0, belt - 0.24, dz - 0.62, 0.05, 0.16, 0.05, TRIM, {}); gb.box(0, belt - 0.14, dz - 0.62, 0.08, 0.06, 0.08, 0x111418, {});
    // 핸들 컬럼(핸들 자체는 vehicle.js 가 별도 메시로 붙여 조향에 따라 돌린다)
    gb.box(0.38, dy - 0.02, dz - 0.22, 0.09, 0.09, 0.30, 0x111418, { rotY: 0 });
    // 시트 2개(등받이·헤드레스트)
    for (var s = -1; s <= 1; s += 2) { gb.box(s * 0.38, belt - 0.12, -l * 0.03, 0.52, 0.56, 0.14, LEATHER, {}); gb.box(s * 0.38, belt + 0.32, -l * 0.03, 0.26, 0.22, 0.12, LEATHER, {}); }
    // A필러·앞유리 헤더·룸미러·천장
    for (var s2 = -1; s2 <= 1; s2 += 2) gb.box(s2 * (w / 2 - 0.07), belt + 0.30, dz + 0.16, 0.07, 0.62, 0.16, DASH, {});
    gb.box(0, belt + 0.70, dz + 0.16, w * 0.9, 0.05, 0.08, DASH, {});                                   // 앞유리 헤더(가늘게, 눈높이보다 충분히 위)
    gb.box(0, belt + 0.72, -l * 0.20, w * 0.88, 0.03, l * 0.26, DASH, { noTop: true });               // 천장(눈 뒤쪽부터)
    return (cache[key] = gb.build());
  }
  // 핸들: 원점 = 허브 중심, 링은 로컬 x–y 평면(z 는 운전자 쪽). 조향 시 z 축으로 돌린다.
  function steering() {
    if (cache.steer) return cache.steer;
    var gb = new TG.GeoBuilder(), R = 0.19;
    for (var k = 0; k < 20; k++) {
      var a = k / 20 * Math.PI * 2, b = (k + 1) / 20 * Math.PI * 2, mx = Math.cos((a + b) / 2) * R, my = Math.sin((a + b) / 2) * R;
      gb.box(mx, my, 0, 0.07, 0.07, 0.06, 0x111418, { rotY: 0 });
    }
    gb.box(0, 0, 0, R * 1.75, 0.045, 0.05, 0x1a1e24, {});
    gb.box(0, -R * 0.45, 0, 0.05, R * 0.9, 0.05, 0x1a1e24, {});
    gb.box(0, 0, 0.01, 0.12, 0.10, 0.07, 0x8a8f96, {});
    gb.box(0, 0.012, 0.045, 0.06, 0.025, 0.005, 0x1f4fa8, { sidesOnly: true });   // 허브 엠블럼 자리(청색)
    return (cache.steer = gb.build());
  }
  function roofY(T) { var y = 0; for (var i = 0; i < T.pts.length; i++) y = Math.max(y, T.pts[i][1]); return y; }
  return { TYPES: TYPES, build: build, wheelGeo: wheelGeo, interior: interior, steering: steering, roofY: roofY };
})();
