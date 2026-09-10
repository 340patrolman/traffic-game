// 미니맵: 도시 격자·순환고속도로(경부고속도로·올림픽대로)·연결로를 한 번 그려 두고, 매 프레임 플레이어(파란 화살표)·위반 차량(주황)·정차 대상(빨강)만 덧그린다.
TG.Minimap = function (canvas, city, terrain) {
  var self = this;
  var W = canvas.width, H = canvas.height, ctx = canvas.getContext('2d');
  var K = W / 236;   // 기준 캔버스(236px) 대비 배율 — 글자·선 두께를 함께 키운다
  var X0 = -330, X1 = 650, Z0 = -320, Z1 = 640;           // 링을 포함하는 범위
  var sx = W / (X1 - X0), sz = H / (Z1 - Z0);
  function mx(x) { return (x - X0) * sx; }
  function mz(z) { return (z - Z0) * sz; }
  var base = document.createElement('canvas'); base.width = W; base.height = H;
  (function drawBase() {
    var g = base.getContext('2d');
    g.fillStyle = 'rgba(12,18,28,0.92)'; g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(60,110,70,0.5)'; g.fillRect(mx(-70), mz(-70), (460) * sx, (460) * sz);
    // 링·연결로
    g.lineCap = 'round';
    terrain.links.forEach(function (L) {
      g.strokeStyle = L.kind === 'highway' ? '#7f8fa8' : '#8d9aa5'; g.lineWidth = (L.kind === 'highway' ? 4 : 2.2) * K;
      g.beginPath();
      for (var i = 0; i < L.N; i++) { var p = L.pts[i]; if (i === 0) g.moveTo(mx(p.x), mz(p.z)); else g.lineTo(mx(p.x), mz(p.z)); }
      if (L.closed) g.closePath();
      g.stroke();
    });
    // 도시 격자
    for (var i = 0; i < city.xs.length; i++) { g.strokeStyle = '#b9c3cf'; g.lineWidth = (1.2 + city.lanesV[i] * 0.9) * K; g.beginPath(); g.moveTo(mx(city.xs[i]), mz(city.zs[0] - 10)); g.lineTo(mx(city.xs[i]), mz(city.zs[city.zs.length - 1] + 10)); g.stroke(); }
    for (var j = 0; j < city.zs.length; j++) { g.strokeStyle = '#b9c3cf'; g.lineWidth = (1.2 + city.lanesH[j] * 0.9) * K; g.beginPath(); g.moveTo(mx(city.xs[0] - 10), mz(city.zs[j])); g.lineTo(mx(city.xs[city.xs.length - 1] + 10), mz(city.zs[j])); g.stroke(); }
    // 강·바다 힌트
    g.strokeStyle = 'rgba(80,150,220,0.7)'; g.lineWidth = 2 * K; g.beginPath();
    g.lineWidth = 5 * K; g.strokeStyle = 'rgba(80,150,220,0.75)';
    for (var x = X0; x <= X1; x += 20) { var rz = terrain.riverZ ? terrain.riverZ(x) : -112; if (x === X0) g.moveTo(mx(x), mz(rz)); else g.lineTo(mx(x), mz(rz)); }
    g.stroke();
    // 이름표가 서로 겹쳐 읽을 수 없었다(소유자 신고). **먼저 그리는 것이 이긴다** —
    // 자리를 차지한 글자와 겹치는 이름표는 건너뛴다. 그래서 **중요한 순서대로** 그린다:
    // 도로명 → 다리 → 지하철역 → 랜드마크 → 자연·기타. 달리는 사람에게 가장 쓸모 있는 것이 도로명이다.
    g.textAlign = 'center';
    var placed = [], skipped = [];
    function lab(text, x, y, rot) {
      var w = g.measureText(text).width, h = parseInt(g.font, 10) || 11;
      var bw = rot ? h + 3 : w + 4, bh = rot ? w + 4 : h + 3;
      var bx = x - bw / 2, by = rot ? y - bh / 2 : y - h + 1;
      for (var i = 0; i < placed.length; i++) {
        var p = placed[i];
        if (bx < p.x + p.w && bx + bw > p.x && by < p.y + p.h && by + bh > p.y) { skipped.push(text); return false; }
      }
      placed.push({ x: bx, y: by, w: bw, h: bh, t: text });
      if (rot) { g.save(); g.translate(x, y); g.rotate(rot); g.fillText(text, 0, 0); g.restore(); }
      else g.fillText(text, x, y);
      return true;
    }
    // ① 도로명 — **격자에서 뽑는다**(자리를 코드에 적지 않는다). 지도 파일이 격자를 바꾸면 이름표도 따라 움직인다.
    // 차로가 많은(=간선) 도로부터 적어 좁은 미니맵에서 중요한 것이 남게 한다.
    g.font = Math.round(9.5 * K) + 'px sans-serif'; g.fillStyle = '#cfe0ff';
    var zMid = (city.zs[0] + city.zs[city.zs.length - 1]) / 2, xMid = (city.xs[0] + city.xs[city.xs.length - 1]) / 2;
    var roadsV = city.xs.map(function (x, i) { return { name: (city.roadNamesV || [])[i], x: x, n: city.lanesV[i] }; })
      .filter(function (r) { return r.name; }).sort(function (a, b) { return b.n - a.n; });
    var roadsH = city.zs.map(function (z, j) { return { name: (city.roadNamesH || [])[j], z: z, n: city.lanesH[j] }; })
      .filter(function (r) { return r.name; }).sort(function (a, b) { return b.n - a.n; });
    // 격자 **안**에 놓으면 세로 이름표(글자 길이만큼 긴 상자)가 가로 이름표를 다 밀어낸다.
    // 그래서 도로 이름표는 **격자 바깥 여백**에 붙인다 — 가로 이름표는 격자 왼쪽, 세로 이름표는 격자 위쪽.
    // 그 자리에는 다른 이름표가 없어서 열 개가 다 남는다. 도로 끝에 붙으므로 어느 도로인지도 분명하다.
    var padX = city.xs[0] - 46, padZ = city.zs[0] - 30;
    roadsV.forEach(function (r) { lab(r.name, mx(r.x) - 5, mz(padZ), -Math.PI / 2); });
    roadsH.forEach(function (r) { lab(r.name, mx(padX), mz(r.z) + 4); });
    g.font = 'bold ' + Math.round(11 * K) + 'px sans-serif'; g.fillStyle = '#e8edf2';
    lab('올림픽대로', mx(160), mz(-262) - 3); lab('경부고속도로', mx(160), mz(585) + 8);
    lab('경부고속도로', mx(160) + 9, mz(470), -Math.PI / 2);
    // ② 다리
    g.fillStyle = '#e6f0ff'; lab('반포대교', mx(160) + 30, mz(-70)); lab('한남대교', mx(320) - 26, mz(-70));
    // ③ 지하철역 — 점은 늘 찍고 이름만 겹침을 피한다
    g.font = 'bold ' + Math.round(10.5 * K) + 'px sans-serif';
    (city.subways || []).forEach(function (S) {
      g.beginPath(); g.arc(mx(S.x), mz(S.z), 3.0 * K, 0, Math.PI * 2); g.fillStyle = S.colors[0] || '#888'; g.fill();
      g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 1.1 * K; g.stroke();
      g.fillStyle = '#ffd86b'; lab(S.name.replace('역', ''), mx(S.x), mz(S.z) - 6 * K);
    });
    // ④ 랜드마크
    g.fillStyle = '#e6f0ff';
    lab('고속터미널', mx(200), mz(40)); lab('성모병원', mx(200), mz(120)); lab('중앙도서관', mx(120), mz(120));
    lab('법원·검찰', mx(280), mz(200)); lab('예술의전당', mx(200), mz(282)); lab('구청', mx(280), mz(282));
    lab('서리풀공원', mx(120), mz(282)); lab('향나무', mx(193), mz(190));
    // ⑤ 자연·기타
    g.fillStyle = '#bfe3ff';
    (terrain.scenery || []).forEach(function (S) { if (S.name) lab(S.name, mx(S.x), mz(S.z)); });
    g.fillStyle = '#ffd86b'; lab('서초구', mx(70), mz(292));
    g.fillStyle = '#e8edf2'; lab('한강', mx(40), mz(-200) - 4);
    self.labels = { placed: placed, skipped: skipped };   // 검증에서 겹침 0 을 확인한다
  })();
  // 확대: 1(전체) → 2 → 4 배, 플레이어를 가운데 두고 확대한다. 미니맵을 터치/클릭하면 다음 단계, +/- 키로도.
  this.zoom = 1; this.levels = [1, 2, 4];
  this.cycleZoom = function () { var i = this.levels.indexOf(this.zoom); this.zoom = this.levels[(i + 1) % this.levels.length]; return this.zoom; };
  this.setZoom = function (z) { this.zoom = TG.clamp(z, 1, 4); };
  var self = this;
  canvas.addEventListener('pointerdown', function (e) { e.preventDefault(); e.stopPropagation(); self.cycleZoom(); });
  this.draw = function (player, cars, target, marker) {
    ctx.clearRect(0, 0, W, H);
    var zm = self.zoom;
    ctx.save();

    if (zm > 1 && player) { ctx.translate(W / 2, H / 2); ctx.scale(zm, zm); ctx.translate(-mx(player.pos.x), -mz(player.pos.z)); }
    ctx.drawImage(base, 0, 0);
    if (self.layers) self.layers.drawMini(ctx, mx, mz, K / Math.sqrt(zm));   // 지도 레이어(사고다발지·위험도·단속 장비)
    for (var i = 0; i < cars.length; i++) {
      var c = cars[i]; if (!c.violation && c !== target) continue;
      ctx.fillStyle = c === target ? '#ff3b30' : '#ff9f0a';
      ctx.beginPath(); ctx.arc(mx(c.pos.x), mz(c.pos.z), (c === target ? 4 : 3) * K / Math.sqrt(zm), 0, Math.PI * 2); ctx.fill();
    }
    if (marker) {   // 보행자 모드 목적지: 노란 깃발 점
      var s0 = K / Math.sqrt(zm); ctx.fillStyle = '#ffcf3f'; ctx.strokeStyle = '#000'; ctx.lineWidth = 1 * K;
      ctx.beginPath(); ctx.arc(mx(marker.x), mz(marker.z), 4.5 * s0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
    // 현재 위치: 흰 테두리 원 + 진행 방향 화살표 + 맥동 고리(작은 미니맵에서도 눈에 띄게)
    if (player) {
      var px = mx(player.pos.x), pz = mz(player.pos.z), h = player.heading, s = K / Math.sqrt(zm);
      var pulse = 1 + 0.35 * Math.sin(Date.now() / 260);
      ctx.save(); ctx.translate(px, pz); ctx.scale(s, s);
      ctx.strokeStyle = 'rgba(77,141,255,0.85)'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.arc(0, 0, 8.5 * pulse, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = 'rgba(10,14,22,0.75)'; ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.fill();
      ctx.rotate(Math.PI - h);   // heading 0(+z) 이 캔버스 아래쪽
      ctx.fillStyle = '#4d8dff'; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(0, -7.5); ctx.lineTo(5, 5.5); ctx.lineTo(0, 2.5); ctx.lineTo(-5, 5.5); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
    if (player) {   // 범례는 확대·이동 변환 밖에서(항상 왼쪽 아래 고정)
      ctx.fillStyle = 'rgba(10,14,22,0.6)'; ctx.fillRect(3, H - 15, 62, 12);
      ctx.fillStyle = '#9fc0ff'; ctx.font = 'bold ' + Math.round(11 * K) + 'px sans-serif'; ctx.textAlign = 'left'; ctx.fillText('▲ 현재 위치', 7 * K, H - 7 * K);
    }
    if (zm > 1) { ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(W - 30, 4, 26, 14); ctx.fillStyle = '#fff'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('×' + zm, W - 17, 15); }
  };
};
