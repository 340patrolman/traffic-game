// 순찰차(전기 크로스오버 SUV) 차체 — ref/assets_raw/PATROL_CAR_EV_SUV.md 5절 · prototype-car/patrol_ev_proto.js 를 게임으로 옮겼다.
//  · 외부 파일 0개(캔버스 도색). 실존 차명·제조사 로고는 그리지 않는다(자리는 비워 두거나 경찰 방패).
//  · 방패는 게임의 실물 표장 TG.tex.emblem() 을 데칼 판으로 얹는다(프로토타입의 임시 그림은 쓰지 않는다).
//  · 좌표(프로토타입 그대로): +x 앞, +y 위, +z 조수석(오른쪽). 게임 차 좌표(+z 앞, +x 운전석)로는 부르는 쪽이 y 축 −90° 돌려 붙인다.
//  · 바퀴·경광등은 게임 쪽(vehicle.js)이 만든다 — 바퀴는 구르고 조향해야 하고 경광등은 사이렌에 맞춰 번쩍여야 한다.
// 치수(실차 공개 제원 · 위키백과): 전장 4.65 · 전폭 1.89 · 전고 1.60 · 축거 3.00 · 휠 반경 0.36
TG.PatrolEV = (function () {
  var L = 4.65, W = 1.89, WB = 3.0, WR = 0.36, HX = L / 2, ROOF = 1.57;
  function srgb(c) { var m = new THREE.Color(c); m.convertSRGBToLinear(); return m; }
  function lam(c, o) { return new THREE.MeshLambertMaterial(Object.assign({ color: srgb(c) }, o || {})); }
  // 옆모습 윤곽(x, y) — 뒤→아래→앞→위 순서
  var PROFILE = [[-2.30, 0.30], [2.25, 0.30], [2.33, 0.46], [2.34, 0.72], [2.29, 0.87], [2.05, 0.94], [1.15, 1.04], [1.00, 1.07],
    [0.30, 1.50], [0.08, 1.54], [-1.80, 1.57], [-2.12, 1.565], [-2.34, 1.54], [-2.33, 1.47], [-2.22, 1.41], [-2.27, 1.07], [-2.33, 0.99], [-2.34, 0.64], [-2.33, 0.44]];
  function canvasTex(w, h, draw) {
    var c = document.createElement('canvas'); c.width = w; c.height = h; var g = c.getContext('2d'); draw(g, w, h);
    var t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; return t;
  }
  function chevrons(g, x0, y0, x1, y1, step, dir) {
    g.save(); g.beginPath(); g.rect(x0, y0, x1 - x0, y1 - y0); g.clip(); g.fillStyle = '#d4f000'; g.fillRect(x0, y0, x1 - x0, y1 - y0); g.fillStyle = '#e0262b';
    var h = y1 - y0; for (var x = x0 - h * 2; x < x1 + h * 2; x += step * 2) { g.beginPath(); g.moveTo(x, y1); g.lineTo(x + step, y1); g.lineTo(x + step + dir * h, y0); g.lineTo(x + dir * h, y0); g.closePath(); g.fill(); }
    g.restore();
  }
  var FONT = '"Noto Sans KR", "Noto Sans CJK KR", "Malgun Gothic", "Apple SD Gothic Neo", sans-serif';
  // 측면 도색. flip=false 면 차 앞이 캔버스 오른쪽(조수석 면), true 면 왼쪽(운전석 면) — 글자는 양쪽 다 바로 읽힌다
  function sideTex(flip) {
    return canvasTex(2048, 720, function (g, w, h) {
      var X = function (x) { var u = (x + 2.42) / 4.84 * w; return flip ? w - u : u; }, Y = function (y) { return h - ((y + 0.03) / 1.68) * h; };
      function path(pts) { g.beginPath(); pts.forEach(function (p, i) { if (i) g.lineTo(X(p[0]), Y(p[1])); else g.moveTo(X(p[0]), Y(p[1])); }); }
      path(PROFILE); g.closePath(); g.clip();
      g.fillStyle = '#f4f5f6'; g.fillRect(0, 0, w, h);
      var poly = function (pts, c) { path(pts); g.closePath(); g.fillStyle = c; g.fill(); };
      poly([[0.98, 1.08], [0.32, 1.47], [0.05, 1.51], [-1.80, 1.51], [-2.12, 1.48], [-2.18, 1.09], [-1.95, 1.05]], '#1b222c');        // 창
      poly([[-0.42, 1.03], [-0.36, 1.50], [-0.46, 1.50], [-0.52, 1.03]], '#11161d');                                                    // B필러
      // 청색 띠: 앞 펜더 → 벨트라인 → 뒤에서 붓질처럼 위로
      poly([[2.30, 0.84], [2.05, 0.91], [1.15, 1.01], [0.98, 1.05], [-1.95, 1.04], [-2.10, 1.10], [-2.20, 1.30], [-2.02, 1.33], [-1.62, 0.95], [-1.20, 0.82], [0.0, 0.80], [1.2, 0.79], [2.30, 0.72]], '#1f4fb8');
      g.lineWidth = 12; g.strokeStyle = '#e3a21a';                                                                                      // 금색 선(청색 아래)
      path([[2.31, 0.70], [1.2, 0.76], [0.0, 0.775], [-1.18, 0.79], [-1.62, 0.92], [-2.03, 1.30], [-2.20, 1.28]]); g.stroke();
      poly([[-1.30, 0.72], [-1.62, 0.88], [-2.0, 1.18], [-2.34, 1.02], [-2.34, 0.45], [-1.9, 0.45]], '#d4f000');                         // 뒤 펜더 형광 연두
      g.save(); path([[-1.95, 0.95], [-2.34, 0.98], [-2.34, 0.48], [-2.08, 0.48]]); g.closePath(); g.clip();
      var xa = Math.min(X(-1.95), X(-2.34)), xb = Math.max(X(-1.95), X(-2.34)); chevrons(g, xa, Y(0.98), xb, Y(0.48), 26, flip ? -1 : 1); g.restore();
      poly([[-2.02, 1.36], [-1.96, 1.36], [-2.20, 1.52], [-2.27, 1.52]], '#d4f000');                                                    // D필러 연두 사선
      poly([[-2.34, 0.30], [2.30, 0.30], [2.30, 0.43], [-2.34, 0.43]], '#23262b');                                                      // 하단 클래딩
      [WB / 2, -WB / 2].forEach(function (cx) { poly([[cx - 0.62, 0.30], [cx - 0.55, 0.62], [cx - 0.28, 0.84], [cx + 0.28, 0.84], [cx + 0.55, 0.62], [cx + 0.62, 0.30]], '#23262b'); });   // 각진 휠 아치
      g.strokeStyle = 'rgba(40,50,60,0.55)'; g.lineWidth = 4;                                                                            // 문 분할선
      [[0.93, 1.02, 0.90, 0.44], [-0.47, 1.02, -0.47, 0.44], [-1.62, 1.0, -1.70, 0.44]].forEach(function (l) { g.beginPath(); g.moveTo(X(l[0]), Y(l[1])); g.lineTo(X(l[2]), Y(l[3])); g.stroke(); });
      g.strokeStyle = 'rgba(150,158,166,0.6)'; g.lineWidth = 5; g.beginPath(); g.moveTo(X(0.95), Y(0.47)); g.lineTo(X(-0.9), Y(0.56)); g.lineTo(X(-1.1), Y(0.50)); g.stroke();   // 캐릭터 라인
      g.fillStyle = '#c9ced4'; [0.60, -0.80].forEach(function (x) { g.fillRect(X(x) - (flip ? 0 : 40), Y(0.98), 40, 10); });              // 문 손잡이
      // 글자(방패는 실물 표장 데칼로 따로 얹는다)
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = '#1f3f8f'; g.font = 'bold 64px ' + FONT; g.fillText('경찰', X(0.22), Y(0.62));
      g.fillStyle = '#1f4fb8'; g.font = '900 92px Arial, ' + FONT; g.fillText('POLICE', X(-0.78), Y(0.62));
      g.fillStyle = '#1f4fb8'; g.font = 'bold 34px Arial'; g.fillText('POLICE', X(-2.12), Y(0.78));
    });
  }
  function rearTex() {
    return canvasTex(1024, 512, function (g, w, h) {   // 가로: 조수석(+z) → 운전석, 세로: y 0.30 ~ 1.08
      var Y = function (y) { return h - (y - 0.30) / 0.78 * h; };
      g.fillStyle = '#f4f5f6'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#1f4fb8'; g.font = '900 64px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('POLICE', w / 2, Y(0.99));
      g.fillStyle = '#101114'; g.fillRect(0, Y(0.94), w, Y(0.82) - Y(0.94));                                                           // 픽셀 램프 바
      for (var s = 0; s < 2; s++) { var x0 = s ? w - 190 : 30; for (var i = 0; i < 14; i++) for (var j = 0; j < 3; j++) { g.fillStyle = (i + j) % 2 ? '#ff2a2a' : '#c01818'; g.fillRect(x0 + i * 11, Y(0.93) + 4 + j * 11, 9, 9); } }
      chevrons(g, 0, Y(0.80), w, Y(0.46), 46, 1);                                                                                       // 전폭 체브론 반사판
      g.fillStyle = '#d4f000'; g.fillRect(40, Y(0.76), 260, Y(0.52) - Y(0.76)); g.fillStyle = '#111'; g.font = '900 58px Arial'; g.fillText('POLICE', 170, (Y(0.76) + Y(0.52)) / 2);
      g.fillStyle = '#fff'; g.fillRect(w / 2 - 120, Y(0.70), 240, Y(0.55) - Y(0.70)); g.fillStyle = '#222'; g.font = 'bold 44px ' + FONT; g.fillText('00경 0000', w / 2, (Y(0.70) + Y(0.55)) / 2);   // 가상 번호
      g.fillStyle = '#1d1f23'; g.fillRect(0, Y(0.46), w, h - Y(0.46)); g.fillStyle = '#c9ccd0'; g.fillRect(60, Y(0.40), w - 120, 8);
    });
  }
  function frontTex() {
    return canvasTex(1024, 256, function (g, w, h) {
      g.fillStyle = '#f4f5f6'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#111317'; g.fillRect(0, 40, w, 70);                                                                                // 전조등 사이 검정 띠(로고 자리는 비움)
      for (var s = 0; s < 2; s++) { var x0 = s ? w - 200 : 40; for (var i = 0; i < 12; i++) for (var j = 0; j < 4; j++) { g.fillStyle = '#eef6ff'; g.fillRect(x0 + i * 13, 48 + j * 14, 10, 10); } }   // 픽셀 전조등
      g.fillStyle = '#fff'; g.fillRect(w / 2 - 110, 140, 220, 56); g.fillStyle = '#222'; g.font = 'bold 36px ' + FONT; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('00경 0000', w / 2, 168);
      g.fillStyle = '#1d1f23'; g.fillRect(0, 210, w, 46);
    });
  }
  function hoodTex() {
    return canvasTex(512, 512, function (g, w, h) {
      g.fillStyle = '#f4f5f6'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#1f4fb8'; g.beginPath(); g.moveTo(0, 0); g.lineTo(70, 0); g.lineTo(40, h); g.lineTo(0, h); g.fill(); g.beginPath(); g.moveTo(w, 0); g.lineTo(w - 70, 0); g.lineTo(w - 40, h); g.lineTo(w, h); g.fill();
      g.strokeStyle = '#e3a21a'; g.lineWidth = 10; g.beginPath(); g.moveTo(76, 0); g.lineTo(46, h); g.stroke(); g.beginPath(); g.moveTo(w - 76, 0); g.lineTo(w - 46, h); g.stroke();
    });
  }
  var cache = null;
  function textures() {
    if (cache) return cache;
    return (cache = { sideR: sideTex(false), sideL: sideTex(true), rear: rearTex(), front: frontTex(), hood: hoodTex() });
  }

  function build() {
    var grp = new THREE.Group(), tx = textures();
    var shape = new THREE.Shape(); PROFILE.forEach(function (p, i) { if (i) shape.lineTo(p[0], p[1]); else shape.moveTo(p[0], p[1]); });
    var body = new THREE.ExtrudeGeometry(shape, { depth: W - 0.16, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.05, bevelSegments: 3, curveSegments: 4 });
    body.translate(0, 0, -(W - 0.16) / 2);
    var pos = body.attributes.position;                                   // 지붕 쪽은 차폭을 좁게(텀블홈)
    for (var i = 0; i < pos.count; i++) { var y = pos.getY(i); if (y > 1.0) { var k = 1 - Math.min(1, (y - 1.0) / 0.55) * 0.09; pos.setZ(i, pos.getZ(i) * k); } }
    pos.needsUpdate = true; body.computeVertexNormals();
    var bm = new THREE.Mesh(body, lam(0xf2f3f4)); bm.castShadow = true; grp.add(bm);
    // 데칼은 bevel(0.05) 보다 바깥에 띄운다(파이프라인 5절 주의 2)
    var decal = function (tex, geo, o) {
      var m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: tex, transparent: true, polygonOffset: true, polygonOffsetFactor: -2 }));
      if (o.p) m.position.set(o.p[0], o.p[1], o.p[2]); if (o.r) m.rotation.set(o.r[0], o.r[1], o.r[2]); grp.add(m); return m;
    };
    var sg = new THREE.PlaneGeometry(4.84, 1.68); sg.translate(0, 0.81, 0);
    decal(tx.sideR, sg, { p: [0, 0, W / 2 + 0.012] });
    decal(tx.sideL, sg, { p: [0, 0, -W / 2 - 0.012], r: [0, Math.PI, 0] });
    decal(tx.rear, new THREE.PlaneGeometry(1.80, 0.78), { p: [-HX - 0.075, 0.69, 0], r: [0, -Math.PI / 2, 0] });
    decal(tx.front, new THREE.PlaneGeometry(1.80, 0.46), { p: [HX + 0.075, 0.56, 0], r: [0, Math.PI / 2, 0] });
    // 보닛: (2.27,0.80)→(1.10,0.99) 경사면
    var hl = Math.hypot(1.14, 0.13), hood = decal(tx.hood, new THREE.PlaneGeometry(hl, W - 0.12), { p: [1.72, 0.99 + 0.062, 0] });
    hood.rotation.set(-Math.PI / 2, 0, 0); hood.rotateOnWorldAxis(new THREE.Vector3(0, 0, 1), Math.atan2(0.13, -1.14) + Math.PI);
    // 실물 경찰 방패(TG.tex.emblem) — 앞문 양쪽 · 보닛 가운데
    var em = TG.tex && TG.tex.emblem ? TG.tex.emblem() : null;
    if (em) {
      var emMat = new THREE.MeshLambertMaterial({ map: em, transparent: true, polygonOffset: true, polygonOffsetFactor: -4 });
      var sR = new THREE.Mesh(new THREE.PlaneGeometry(0.30, 0.30), emMat); sR.position.set(0.66, 0.64, W / 2 + 0.02); grp.add(sR);
      var sL = new THREE.Mesh(new THREE.PlaneGeometry(0.30, 0.30), emMat); sL.position.set(0.66, 0.64, -W / 2 - 0.02); sL.rotation.y = Math.PI; grp.add(sL);
      var hE = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.46), emMat); hE.position.set(0, 0, 0.004); hE.rotation.z = Math.PI / 2; hood.add(hE);   // 윗쪽이 앞유리를 향한다
    }
    // 앞유리·뒤유리
    var gm = lam(0x1a2029);
    var ws = new THREE.Mesh(new THREE.PlaneGeometry(Math.hypot(0.70, 0.43), W - 0.32), gm); ws.position.set(0.65, 1.285, 0); ws.rotation.set(-Math.PI / 2, 0, 0);
    ws.rotateOnWorldAxis(new THREE.Vector3(0, 0, 1), Math.atan2(0.43, -0.70) + Math.PI); ws.position.y += 0.065; grp.add(ws);
    var rw = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.40, 0.34), gm); rw.position.set(-2.33, 1.23, 0); rw.rotation.y = -Math.PI / 2; grp.add(rw);
    var sp = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.05, W - 0.22), lam(0x16181c)); sp.position.set(-2.30, 1.53, 0); sp.rotation.z = -0.15; grp.add(sp);   // 루프 스포일러
    [1, -1].forEach(function (s) { var m = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.10, 0.14), lam(0xf2f3f4)); m.position.set(0.92, 1.12, s * (W / 2 + 0.07)); grp.add(m); });   // 사이드미러
    grp.userData.glass = [ws, rw];
    return grp;
  }
  return { build: build, L: L, W: W, WB: WB, WR: WR, ROOF: ROOF };
})();
