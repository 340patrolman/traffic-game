// 미니맵: 도시 격자·순환고속도로·연결로를 한 번 그려 두고, 매 프레임 플레이어(파란 화살표)·위반 차량(주황)·정차 대상(빨강)만 덧그린다.
TG.Minimap = function (canvas, city, terrain) {
  var W = canvas.width, H = canvas.height, ctx = canvas.getContext('2d');
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
      g.strokeStyle = L.kind === 'highway' ? '#7f8fa8' : '#8d9aa5'; g.lineWidth = L.kind === 'highway' ? 4 : 2.2;
      g.beginPath();
      for (var i = 0; i < L.N; i++) { var p = L.pts[i]; if (i === 0) g.moveTo(mx(p.x), mz(p.z)); else g.lineTo(mx(p.x), mz(p.z)); }
      if (L.closed) g.closePath();
      g.stroke();
    });
    // 도시 격자
    for (var i = 0; i < city.xs.length; i++) { g.strokeStyle = '#b9c3cf'; g.lineWidth = city.lanesV[i] === 2 ? 3.2 : 1.8; g.beginPath(); g.moveTo(mx(city.xs[i]), mz(city.zs[0] - 10)); g.lineTo(mx(city.xs[i]), mz(city.zs[city.zs.length - 1] + 10)); g.stroke(); }
    for (var j = 0; j < city.zs.length; j++) { g.strokeStyle = '#b9c3cf'; g.lineWidth = city.lanesH[j] === 2 ? 3.2 : 1.8; g.beginPath(); g.moveTo(mx(city.xs[0] - 10), mz(city.zs[j])); g.lineTo(mx(city.xs[city.xs.length - 1] + 10), mz(city.zs[j])); g.stroke(); }
    // 강·바다 힌트
    g.strokeStyle = 'rgba(80,150,220,0.7)'; g.lineWidth = 2; g.beginPath();
    g.lineWidth = 5; g.strokeStyle = 'rgba(80,150,220,0.75)';
    for (var x = X0; x <= X1; x += 20) { var rz = -212 + 18 * Math.sin(x / 230 + 0.6); if (x === X0) g.moveTo(mx(x), mz(rz)); else g.lineTo(mx(x), mz(rz)); }
    g.stroke();
    g.font = 'bold 9px sans-serif'; g.fillStyle = '#e8edf2'; g.textAlign = 'center';
    g.fillText('올림픽대로', mx(160), mz(-262) - 3); g.fillText('순환고속도로', mx(160), mz(585) + 8); g.fillText('한강', mx(40), mz(-200) - 4);
    g.save(); g.translate(mx(160) + 9, mz(470)); g.rotate(-Math.PI / 2); g.fillText('경부고속도로', 0, 0); g.restore();
    g.font = 'bold 8px sans-serif'; g.fillStyle = '#ffd86b';
    g.fillText('서초구', mx(60), mz(300)); g.fillText('강남구', mx(260), mz(300)); g.fillText('강남역', mx(160), mz(152));
    g.fillStyle = '#cfe0ff'; g.font = '7px sans-serif'; g.fillText('테헤란로', mx(250), mz(172)); g.fillText('서초대로', mx(70), mz(172)); g.fillText('반포대로', mx(0), mz(60) - 4); g.save(); g.translate(mx(160) - 6, mz(60)); g.rotate(-Math.PI / 2); g.fillText('강남대로', 0, 0); g.restore();
  })();
  this.draw = function (player, cars, target) {
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(base, 0, 0);
    for (var i = 0; i < cars.length; i++) {
      var c = cars[i]; if (!c.violation && c !== target) continue;
      ctx.fillStyle = c === target ? '#ff3b30' : '#ff9f0a';
      ctx.beginPath(); ctx.arc(mx(c.pos.x), mz(c.pos.z), c === target ? 4 : 3, 0, Math.PI * 2); ctx.fill();
    }
    if (player) {
      var px = mx(player.pos.x), pz = mz(player.pos.z), h = player.heading;
      ctx.save(); ctx.translate(px, pz); ctx.rotate(Math.PI - h);   // heading 0(+z) 이 캔버스 아래쪽
      ctx.fillStyle = '#4d8dff'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(4, 5); ctx.lineTo(0, 2.5); ctx.lineTo(-4, 5); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore();
    }
  };
};
