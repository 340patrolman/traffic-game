// 📤 결과 공유 카드(재미 설계서 5절 #10 · 7절 3단계) — 서버 0 그대로. 근무 결과를 **그림 한 장**으로 만들어 기기에 저장하거나 기기의 공유 창으로 보낸다.
//  반 대항·친구 자랑은 그림으로 한다(점수 서버를 두지 않는다). 그림 안 QR 은 게임 주소(누구나 같은 주소 — 개인 정보 없음).
//  그림에는 이름·위치를 넣지 않는다. 날짜·모드·점수·별·계급·배지·동네 지수만.
TG.ShareCard = function (game) {
  var self = this, el = null, last = null;
  var URL_GAME = 'https://340patrolman.github.io/traffic-game/';
  var MODE_KO = { patrol: '순찰 근무', free: '자유 주행', circuit: '연습 서킷', duty: '교차로 근무', chase: '추격전', walk: '도보 근무', kid: '어린이 교실', tot: '영아 교실', bike: '청소년 교실' };
  function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  function font(px, w) { return (w || 800) + ' ' + px + 'px "Noto Sans KR","Apple SD Gothic Neo","Malgun Gothic",sans-serif'; }
  // 그림 그리기 — 계급장 그림은 data URL 이라 불러오기를 기다린다
  this.build = function (st, cb) {
    var W = 1080, H = 1350, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    var g = cv.getContext('2d');
    var bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#0d1b33'); bg.addColorStop(1, '#060a14'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
    g.strokeStyle = 'rgba(120,160,230,.55)'; g.lineWidth = 6; rr(g, 30, 30, W - 60, H - 60, 40); g.stroke();
    g.textAlign = 'center'; g.fillStyle = '#9fc0ff'; g.font = font(40, 700); g.fillText('SEOUL POLICE · 교통순찰', W / 2, 120);
    g.fillStyle = '#ffffff'; g.font = font(110, 900); g.fillText('SEOUL PATROL', W / 2, 240);
    g.fillStyle = '#cfe0ff'; g.font = font(46, 700);
    g.fillText((MODE_KO[game.mode] || '근무') + ' · ' + new Date().toISOString().slice(0, 10), W / 2, 320);
    // 점수 · 별
    g.fillStyle = '#ffd24a'; g.font = font(170, 900); g.fillText(String(Math.round(game.score || 0)), W / 2, 520);
    g.fillStyle = '#e8eefc'; g.font = font(40, 700); g.fillText('점', W / 2 + 10, 580);
    var stars = st.goalStars !== undefined ? st.goalStars : Math.min(3, st.stars || 0), sN = st.goalStars !== undefined ? 3 : 5;
    var starTxt = ''; for (var i = 0; i < sN; i++) starTxt += i < (st.goalStars !== undefined ? stars : (st.stars || 0)) ? '★' : '☆';
    g.fillStyle = '#ffd24a'; g.font = font(90, 900); g.fillText(starTxt, W / 2, 700);
    // 한 줄 기록
    var rows = [];
    if (st.stops) rows.push('단속 ' + st.stops + '건 · 정확 ' + (st.correct || 0) + '건');
    if (st.incidents) rows.push('현장 안전조치 ' + st.incidents + '건');
    if (st.dispatchOnTime) rows.push('112 제시간 출동 ' + st.dispatchOnTime + '건');
    if (st.chapter) rows.push('📖 ' + st.chapter.month + ' 「' + st.chapter.title + '」 ' + (st.chapter.ok ? '완료' : '도전'));
    if (game.hood) rows.push('🗺 우리 동네 안전 지수 ' + game.hood.average());
    (st.badges || []).slice(0, 3).forEach(function (b) { rows.push(b.text); });
    g.fillStyle = '#e8eefc'; g.font = font(40, 700);
    rows.slice(0, 6).forEach(function (t, k) { g.fillText(t, W / 2, 790 + k * 58); });
    // 계급 · QR
    var qc = document.createElement('canvas');
    if (TG.qr) TG.qr.draw(qc, URL_GAME, 220);
    g.fillStyle = '#fff'; rr(g, W - 330, H - 330, 260, 260, 18); g.fill();
    if (qc.width) g.drawImage(qc, W - 320, H - 320, 240, 240);
    g.textAlign = 'left'; g.fillStyle = '#9fc0ff'; g.font = font(34, 700);
    g.fillText('나도 해 보기 →', W - 600, H - 190);
    g.fillStyle = 'rgba(232,238,252,.6)'; g.font = font(26, 500);
    g.fillText('기록은 이 기기에만 · 서버 없음', 80, H - 70);
    var rk = game.praise ? game.praise.rank() : null, done = function () { last = cv; cb(cv); };
    if (rk && game.praise.insignia) {
      var img = new Image();
      img.onload = function () { g.drawImage(img, 80, H - 330, 150, 150); g.fillStyle = '#ffffff'; g.font = font(48, 900); g.fillText(rk.name, 250, H - 250); g.fillStyle = '#cfe0ff'; g.font = font(30, 700); g.fillText('진급 점수 ' + game.praise.points() + '점', 250, H - 200); done(); };
      img.onerror = done;
      img.src = game.praise.insignia(game.praise.level());
    } else done();
  };
  function blobOf(cv, cb) { if (cv.toBlob) cv.toBlob(cb, 'image/png'); else cb(null); }
  this.open = function (st) {
    if (!el) {
      el = document.createElement('div'); el.id = 'share'; el.className = 'overlay share';
      el.addEventListener('click', function (e) { if (e.target === el) self.close(); });
      document.body.appendChild(el);
    }
    el.innerHTML = '<div class="card wide share-card"><div class="badge">📤 결과 카드</div><div class="shimg">그리는 중…</div>' +
      '<div class="endbtns"><button class="primary" id="shSave">💾 저장</button><button class="ghost" id="shSend">📤 공유</button><button class="ghost" id="shX">닫기</button></div>' +
      '<div class="dim small">그림에는 이름·위치가 들어가지 않습니다. 반 친구와 점수를 겨룰 때 그림을 보여 주세요.</div></div>';
    el.style.display = 'flex';
    document.getElementById('shX').addEventListener('click', self.close);
    var canShare = !!(navigator.share && navigator.canShare);
    if (!canShare) document.getElementById('shSend').style.display = 'none';
    self.build(st || game.stats || {}, function (cv) {
      var box = el.querySelector('.shimg'); box.textContent = '';
      var im = new Image(); im.alt = '근무 결과 카드'; im.src = cv.toDataURL('image/png'); box.appendChild(im);
    });
    document.getElementById('shSave').addEventListener('click', function () {
      if (!last) return;
      blobOf(last, function (b) {
        var a = document.createElement('a'); a.download = 'seoul-patrol-' + new Date().toISOString().slice(0, 10) + '.png';
        a.href = b ? URL.createObjectURL(b) : last.toDataURL('image/png');
        document.body.appendChild(a); a.click(); a.remove();
        if (b) setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
      });
    });
    document.getElementById('shSend').addEventListener('click', function () {
      if (!last) return;
      blobOf(last, function (b) {
        if (!b) return;
        var f = new File([b], 'seoul-patrol.png', { type: 'image/png' });
        if (navigator.canShare({ files: [f] })) navigator.share({ files: [f], title: 'SEOUL PATROL 근무 결과' }).catch(function () {});
      });
    });
  };
  this.close = function () { if (el) el.style.display = 'none'; };
  this.isOpen = function () { return !!el && el.style.display !== 'none'; };
  this.last = function () { return last; };
};
