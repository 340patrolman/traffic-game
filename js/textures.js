// 모든 그림은 canvas로 그린다. 외부 이미지 0개. 한글 노면 문자·표지판·건물 외벽·신호등 머리.
TG.tex = (function () {
  var cache = {};
  var FONT = '"Malgun Gothic","Apple SD Gothic Neo","Noto Sans KR","NanumGothic",sans-serif';

  function canvas(w, h) {
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }
  function toTexture(c, repeatX, repeatY) {
    var t = new THREE.CanvasTexture(c);
    t.anisotropy = 4;
    if (repeatX || repeatY) {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(repeatX || 1, repeatY || 1);
    }
    return t;
  }

  // 노면 문자(흰색, 투명 배경). 한국식으로 글자를 세로로 쌓는다. 첫 글자가 운전자에게 가장 가깝다(캔버스 아래).
  function roadText(text, color) {
    var key = 'rt:' + text + (color || '');
    if (cache[key]) return cache[key];
    var n = text.length, c = canvas(128, 128 * n), g = c.getContext('2d');
    g.clearRect(0, 0, 128, 128 * n);
    g.fillStyle = color || '#f4f4f0';
    g.font = 'bold 108px ' + FONT;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    for (var i = 0; i < n; i++) g.fillText(text[i], 64, 128 * (n - 1 - i) + 66);
    return (cache[key] = toTexture(c));
  }

  // 표지판. 한국 도로표지 규격을 참고한 도형: 규제(원, 적색 테두리), 주의(삼각, 적색 테두리·황색 바탕), 안내(사각, 청색).
  function sign(kind) {
    var key = 'sg:' + kind;
    if (cache[key]) return cache[key];
    var c = canvas(256, 256), g = c.getContext('2d');
    g.clearRect(0, 0, 256, 256);
    function circle(fill, stroke) {
      g.beginPath(); g.arc(128, 128, 118, 0, Math.PI * 2);
      g.fillStyle = fill; g.fill();
      g.lineWidth = 22; g.strokeStyle = stroke; g.stroke();
    }
    function tri(fill, stroke) {
      g.beginPath(); g.moveTo(128, 14); g.lineTo(246, 236); g.lineTo(10, 236); g.closePath();
      g.fillStyle = fill; g.fill(); g.lineWidth = 16; g.strokeStyle = stroke; g.lineJoin = 'round'; g.stroke();
    }
    function rect(fill) {
      g.fillStyle = fill; g.beginPath();
      g.moveTo(24, 8); g.lineTo(232, 8); g.quadraticCurveTo(248, 8, 248, 24); g.lineTo(248, 232);
      g.quadraticCurveTo(248, 248, 232, 248); g.lineTo(24, 248); g.quadraticCurveTo(8, 248, 8, 232);
      g.lineTo(8, 24); g.quadraticCurveTo(8, 8, 24, 8); g.fill();
    }
    g.textAlign = 'center'; g.textBaseline = 'middle';
    if (kind.indexOf('limit') === 0) {
      circle('#ffffff', '#d7262b');
      var num = kind.slice(5);
      g.fillStyle = '#111'; g.font = 'bold ' + (num.length > 2 ? 96 : 120) + 'px ' + FONT;
      g.fillText(num, 128, 136);
    } else if (kind === 'rail') {   // 철길건널목: 황색 삼각 경고 + 열차 실루엣 + 「건널목」
      tri('#ffe94a', '#d7262b');
      g.fillStyle = '#111'; g.fillRect(84, 120, 88, 46); g.fillRect(100, 100, 56, 24);
      g.beginPath(); g.arc(102, 176, 12, 0, Math.PI * 2); g.arc(154, 176, 12, 0, Math.PI * 2); g.fill();
      g.font = 'bold 26px ' + FONT; g.fillText('건널목', 128, 214);
    } else if (kind === 'flood') {   // 침수·통제: 청색 원 + 물결 + 「통제」
      circle('#1f4fa8', '#ffffff');
      g.strokeStyle = '#ffffff'; g.lineWidth = 10; g.lineCap = 'round';
      for (var wv = 0; wv < 2; wv++) { g.beginPath(); for (var wx = 48; wx <= 208; wx += 8) { var wy = 100 + wv * 34 + Math.sin(wx / 12) * 8; if (wx === 48) g.moveTo(wx, wy); else g.lineTo(wx, wy); } g.stroke(); }
      g.fillStyle = '#ffffff'; g.font = 'bold 40px ' + FONT; g.fillText('통제', 128, 190);
    } else if (kind === 'school') {
      rect('#f7c600');
      g.fillStyle = '#111'; g.font = 'bold 44px ' + FONT;
      g.fillText('어린이', 128, 84); g.fillText('보호구역', 128, 136);
      g.font = 'bold 30px ' + FONT; g.fillText('SCHOOL ZONE', 128, 196);
    } else if (kind === 'crosswalk') {
      tri('#f7c600', '#d7262b');
      g.fillStyle = '#111';
      for (var i = 0; i < 5; i++) g.fillRect(62 + i * 28, 150, 14, 60);
      // 걷는 사람 실루엣(단순)
      g.beginPath(); g.arc(128, 96, 12, 0, Math.PI * 2); g.fill();
      g.fillRect(120, 108, 16, 34);
    } else if (kind === 'noparking') {
      circle('#2c5aa0', '#d7262b');
      g.strokeStyle = '#d7262b'; g.lineWidth = 22;
      g.beginPath(); g.moveTo(52, 52); g.lineTo(204, 204); g.stroke();
      g.fillStyle = '#fff'; g.font = 'bold 40px ' + FONT; g.fillText('주차금지', 128, 128);
    } else if (kind === 'signalAhead') {
      tri('#f7c600', '#d7262b');
      var cols = ['#d7262b', '#f7c600', '#2ea043'];
      g.fillStyle = '#111'; g.fillRect(108, 96, 40, 118);
      for (var k = 0; k < 3; k++) { g.fillStyle = cols[k]; g.beginPath(); g.arc(128, 116 + k * 38, 14, 0, Math.PI * 2); g.fill(); }
    } else if (kind === 'stop') {
      // 일시정지: 팔각 적색
      g.fillStyle = '#d7262b'; g.beginPath();
      for (var a = 0; a < 8; a++) {
        var ang = Math.PI / 8 + a * Math.PI / 4;
        var x = 128 + Math.cos(ang) * 120, y = 128 + Math.sin(ang) * 120;
        if (a === 0) g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.closePath(); g.fill();
      g.fillStyle = '#fff'; g.font = 'bold 74px ' + FONT; g.fillText('정지', 128, 132);
    } else if (kind === 'oneway') {
      rect('#2c5aa0');
      g.fillStyle = '#fff'; g.font = 'bold 34px ' + FONT;
      g.fillText('우측통행', 128, 128);
    }
    return (cache[key] = toTexture(c));
  }

  // 건물 외벽 타일(창문 격자). 1타일 = 가로 4m × 세로 3m(1층).
  function facade(style) {
    var key = 'fc:' + style;
    if (cache[key]) return cache[key];
    var c = canvas(128, 128), g = c.getContext('2d');
    if (style === 'apt') {         // 아파트: 밝은 벽, 큰 창 + 발코니 난간선
      g.fillStyle = '#e4e2dc'; g.fillRect(0, 0, 128, 128);
      g.fillStyle = '#5a6b7c'; g.fillRect(14, 22, 44, 46); g.fillRect(70, 22, 44, 46);
      g.fillStyle = '#c9c6bd'; g.fillRect(0, 80, 128, 6);
      g.fillStyle = '#b9b6ad'; g.fillRect(0, 118, 128, 10);
    } else if (style === 'office') { // 상가·오피스: 어두운 유리 띠
      g.fillStyle = '#8d97a3'; g.fillRect(0, 0, 128, 128);
      g.fillStyle = '#2f3d4c'; g.fillRect(6, 18, 116, 60);
      g.fillStyle = '#4e6376'; g.fillRect(6, 18, 116, 8);
      g.fillStyle = '#75808c'; g.fillRect(0, 96, 128, 32);
    } else if (style === 'shop') {   // 저층 상가: 벽돌 톤 + 작은 창
      g.fillStyle = '#b98f6c'; g.fillRect(0, 0, 128, 128);
      g.fillStyle = '#a97d5b';
      for (var y = 0; y < 128; y += 16) for (var x = ((y / 16) % 2) * 16; x < 128; x += 32) g.fillRect(x, y, 14, 7);
      g.fillStyle = '#3b4a58'; g.fillRect(24, 30, 32, 44); g.fillRect(72, 30, 32, 44);
    } else if (style === 'tower') {  // 고층 타워: 유리 커튼월(어두운 유리 + 밝은 멀리언, 일부 창은 불 켜짐)
      g.fillStyle = '#1f2f42'; g.fillRect(0, 0, 128, 128);
      for (var ty = 0; ty < 128; ty += 16) for (var tx = 0; tx < 128; tx += 16) { var lit = ((tx * 7 + ty * 13) % 23) < 6; g.fillStyle = lit ? '#e8dcb0' : ((tx + ty) % 32 === 0 ? '#2c4258' : '#25394f'); g.fillRect(tx + 2, ty + 2, 12, 12); }
      g.fillStyle = '#8aa0b8'; for (var mx = 0; mx < 128; mx += 16) g.fillRect(mx, 0, 2, 128); for (var my = 0; my < 128; my += 16) g.fillRect(0, my, 128, 2);
    } else {                          // 기본 콘크리트
      g.fillStyle = '#c8c4bb'; g.fillRect(0, 0, 128, 128);
      g.fillStyle = '#4c5866'; g.fillRect(20, 26, 36, 48); g.fillRect(72, 26, 36, 48);
    }
    return (cache[key] = toTexture(c, 1, 1));
  }

  // 상가 간판 띠(1층 위). 실존 브랜드명 금지 — 업종명만.
  var SHOP_WORDS = ['분식', '편의점', '약국', '미용실', '치킨', '카페', '부동산', '학원', '세탁', '식당', '문구', '안경', '떡집', '헬스', '꽃집', '서점'];
  function shopStrip(seed) {
    var key = 'ss:' + seed;
    if (cache[key]) return cache[key];
    var rng = TG.makeRNG(seed);
    var c = canvas(512, 64), g = c.getContext('2d');
    var n = 4;
    var pal = [['#d7262b', '#fff'], ['#2c5aa0', '#fff'], ['#f7c600', '#111'], ['#2ea043', '#fff'], ['#ffffff', '#111'], ['#1a1a1a', '#ffd23f']];
    for (var i = 0; i < n; i++) {
      var p = TG.pick(rng, pal);
      g.fillStyle = p[0]; g.fillRect(i * 128, 0, 126, 64);
      g.fillStyle = p[1]; g.font = 'bold 34px ' + FONT; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(TG.pick(rng, SHOP_WORDS), i * 128 + 63, 34);
    }
    return (cache[key] = toTexture(c, 1, 1));
  }

  // 4구 신호등 머리: [적, 황, 좌회전 화살표, 녹]. 가로 배치.
  function signalHead(state) {
    var key = 'sh:' + state;
    if (cache[key]) return cache[key];
    var c = canvas(256, 72), g = c.getContext('2d');
    g.fillStyle = '#1d2126'; g.fillRect(0, 0, 256, 72);
    g.fillStyle = '#0d0f12'; g.fillRect(4, 4, 248, 64);
    var on = { red: state === 'red' || state === 'redLeft', yellow: state === 'yellow',
               left: state === 'greenLeft' || state === 'redLeft', green: state === 'green' || state === 'greenLeft' };
    function lamp(i, colorOn, isOn, arrow) {
      var cx = 32 + i * 64, cy = 36;
      if (isOn) { g.shadowColor = colorOn; g.shadowBlur = 18; } else g.shadowBlur = 0;
      g.fillStyle = isOn ? colorOn : '#2a2f36';
      if (arrow) {
        g.beginPath();
        g.moveTo(cx - 22, cy); g.lineTo(cx - 4, cy - 18); g.lineTo(cx - 4, cy - 7); g.lineTo(cx + 22, cy - 7);
        g.lineTo(cx + 22, cy + 7); g.lineTo(cx - 4, cy + 7); g.lineTo(cx - 4, cy + 18); g.closePath(); g.fill();
      } else { g.beginPath(); g.arc(cx, cy, 24, 0, Math.PI * 2); g.fill(); }
      g.shadowBlur = 0;
    }
    lamp(0, '#ff3b30', on.red);
    lamp(1, '#ffcc00', on.yellow);
    lamp(2, '#34c759', on.left, true);
    lamp(3, '#34c759', on.green);
    return (cache[key] = toTexture(c));
  }

  // 보행 신호등(세로 2구): 위 = 적색 서 있는 사람, 아래 = 녹색 걷는 사람 + 잔여시간 숫자. n = -1 이면 둘 다 꺼짐(깜빡임 프레임)
  function pedHead(walk, n) {
    var key = 'ph:' + walk + ':' + (n === undefined ? '' : n);
    if (cache[key]) return cache[key];
    var c = canvas(64, 128), g = c.getContext('2d');
    g.fillStyle = '#1d2126'; g.fillRect(0, 0, 64, 128);
    var redOn = !walk, greenOn = walk && n !== -1;
    g.fillStyle = redOn ? '#ff3b30' : '#2a2f36'; g.beginPath(); g.arc(32, 32, 24, 0, Math.PI * 2); g.fill();
    g.fillStyle = greenOn ? '#34c759' : '#2a2f36'; g.beginPath(); g.arc(32, 96, 24, 0, Math.PI * 2); g.fill();
    function man(cx, cy, walking, color) {
      g.fillStyle = color; g.strokeStyle = color; g.lineWidth = 4; g.lineCap = 'round';
      g.beginPath(); g.arc(cx, cy - 13, 3.5, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.moveTo(cx, cy - 9); g.lineTo(cx, cy + 2); g.stroke();
      if (walking) { g.beginPath(); g.moveTo(cx, cy + 2); g.lineTo(cx - 6, cy + 13); g.moveTo(cx, cy + 2); g.lineTo(cx + 6, cy + 12); g.moveTo(cx, cy - 6); g.lineTo(cx - 6, cy - 1); g.moveTo(cx, cy - 6); g.lineTo(cx + 6, cy - 9); g.stroke(); }
      else { g.beginPath(); g.moveTo(cx - 2, cy + 2); g.lineTo(cx - 2, cy + 13); g.moveTo(cx + 2, cy + 2); g.lineTo(cx + 2, cy + 13); g.moveTo(cx, cy - 6); g.lineTo(cx - 5, cy); g.moveTo(cx, cy - 6); g.lineTo(cx + 5, cy); g.stroke(); }
    }
    man(32, 32, false, redOn ? '#3a0c0a' : '#1a1d22');
    man(walk && n > 0 ? 22 : 32, 96, true, greenOn ? '#0b3d1c' : '#1a1d22');
    if (walk && n > 0) { g.fillStyle = greenOn ? '#0b3d1c' : '#1a1d22'; g.font = 'bold 22px ' + FONT; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(n), 44, 96); }
    return (cache[key] = toTexture(c));
  }

  // 짧은 라벨(차량 문 「경찰」 등). 청색 글자, 투명 배경.
  // 순찰차 도색 데칼(참고 사진): 옆면 = 아래 청색 띠가 앞 펜더에서 위로 솟는 스우시 + 황색 테두리 + 앞문 엠블럼 + 뒷문 「경찰 POLICE」.
  // 후드 = 앞이 넓고 앞유리 쪽으로 좁아지는 청색 쐐기 + 황색 테두리 + 가운데 엠블럼. 투명 배경이라 흰 차체 위에 얹는다.
  function drawEmblem(g, cx, cy, r) {
    g.save(); g.translate(cx, cy); g.scale(r / 128, r / 128); g.translate(-128, -128);
    g.lineWidth = 16; g.strokeStyle = '#c9a227'; g.beginPath(); g.arc(128, 128, 112, 0, Math.PI * 2); g.stroke();
    g.fillStyle = '#1f4fa8'; g.beginPath(); g.arc(128, 128, 100, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#ffffff';
    g.beginPath(); g.moveTo(128, 70); g.quadraticCurveTo(58, 96, 44, 138); g.quadraticCurveTo(96, 122, 118, 132); g.lineTo(128, 172); g.lineTo(138, 132); g.quadraticCurveTo(160, 122, 212, 138); g.quadraticCurveTo(198, 96, 128, 70); g.closePath(); g.fill();
    g.beginPath(); g.arc(128, 78, 14, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#c9a227'; g.font = 'bold 30px ' + FONT; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('POLICE', 128, 200);
    g.restore();
  }
  function liverySide(flip) {
    var key = 'lvs:' + (flip ? 1 : 0);
    if (cache[key]) return cache[key];
    var W = 1024, H = 256, c = canvas(W, H), g = c.getContext('2d');
    g.clearRect(0, 0, W, H);
    // u: 0 = 차 뒤, 1 = 차 앞. 오른쪽 면은 캔버스 전체를 좌우 반전해 그린다(면의 u 방향이 화면에서 뒤집히므로 글자가 바로 읽힌다)
    if (flip) { g.translate(W, 0); g.scale(-1, 1); }
    function X(u) { return u * W; }
    function band(color, dy) {
      g.fillStyle = color; g.beginPath();
      g.moveTo(X(0), H); g.lineTo(X(0), 0.60 * H + dy); g.lineTo(X(0.66), 0.60 * H + dy);
      g.bezierCurveTo(X(0.80), 0.60 * H + dy, X(0.86), 0.30 * H + dy, X(0.93), 0.20 * H + dy);   // 앞 펜더 스우시
      g.lineTo(X(1), 0.16 * H + dy); g.lineTo(X(1), H); g.closePath(); g.fill();
    }
    band('#f3c418', -14); band('#1a4fb0', 0);
    g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(0, H - 22, W, 22);   // 로커 그림자
    drawEmblem(g, X(0.70), 0.30 * H, 44);
    g.fillStyle = '#1f4fa8'; g.font = 'bold 54px ' + FONT; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('경찰', X(0.27), 0.30 * H); g.fillText('POLICE', X(0.47), 0.30 * H);
    return (cache[key] = toTexture(c));
  }
  function liveryHood() {
    if (cache.lvh) return cache.lvh;
    var W = 512, H = 512, c = canvas(W, H), g = c.getContext('2d');
    g.clearRect(0, 0, W, H);
    // u: 0 좌 1 우. 텍스처 v=0 은 캔버스 아래(flipY) = 차 앞(범퍼), v=1 = 캔버스 위 = 앞유리 쪽. 앞에서 넓고 앞유리 쪽으로 좁아지는 쐐기.
    function wedge(color, grow) {
      g.fillStyle = color; g.beginPath();
      g.moveTo((0.0 - grow) * W, H); g.lineTo((1.0 + grow) * W, H); g.lineTo((0.64 + grow) * W, 0.12 * H); g.lineTo((0.36 - grow) * W, 0.12 * H); g.closePath(); g.fill();
    }
    wedge('#f3c418', 0.035); wedge('#1a4fb0', 0);
    g.save(); g.translate(0.5 * W, 0.58 * H); g.scale(-1, -1); drawEmblem(g, 0, 0, 62); g.restore();   // 운전석(뒤)에서 바로 읽히게 180° 회전
    return (cache.lvh = toTexture(c));
  }
  // 경찰 엠블럼(양식화): 금색 월계 고리 + 청색 원 + 흰 참수리 실루엣 + 'POLICE'. 실제 휘장을 복제하지 않는다.
  function emblem() {
    if (cache.emblem) return cache.emblem;
    var c = canvas(256, 256), g = c.getContext('2d');
    g.clearRect(0, 0, 256, 256);
    g.lineWidth = 16; g.strokeStyle = '#c9a227'; g.beginPath(); g.arc(128, 128, 112, 0, Math.PI * 2); g.stroke();
    g.fillStyle = '#1f4fa8'; g.beginPath(); g.arc(128, 128, 100, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#e8c74a'; g.lineWidth = 3;
    for (var k = 0; k < 20; k++) { var a = Math.PI * 0.15 + k / 19 * Math.PI * 1.7, r0 = 106, r1 = 118; g.beginPath(); g.moveTo(128 + Math.cos(a) * r0, 128 + Math.sin(a) * r0); g.lineTo(128 + Math.cos(a) * r1, 128 + Math.sin(a) * r1); g.stroke(); }
    g.fillStyle = '#ffffff';
    g.beginPath(); g.moveTo(128, 70); g.quadraticCurveTo(58, 96, 44, 138); g.quadraticCurveTo(96, 122, 118, 132); g.lineTo(128, 172); g.lineTo(138, 132); g.quadraticCurveTo(160, 122, 212, 138); g.quadraticCurveTo(198, 96, 128, 70); g.closePath(); g.fill();
    g.beginPath(); g.arc(128, 78, 14, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#c9a227'; g.font = 'bold 30px ' + FONT; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('POLICE', 128, 200);
    return (cache.emblem = toTexture(c));
  }
  function label(text, color) {
    var key = 'lb:' + text + (color || '');
    if (cache[key]) return cache[key];
    var W = Math.max(256, 36 * text.length + 48), c = canvas(W, 64), g = c.getContext('2d');
    g.clearRect(0, 0, W, 64);
    g.fillStyle = color || '#1f4fa8';
    var size = 48; g.font = 'bold ' + size + 'px ' + FONT;
    while (size > 18 && g.measureText(text).width > W - 16) { size -= 2; g.font = 'bold ' + size + 'px ' + FONT; }
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, W / 2, 34);
    return (cache[key] = toTexture(c));
  }

  // 아스팔트: 회색 노이즈 + 미세한 균열. 8m 마다 반복.
  function asphalt() {
    if (cache.asphalt) return cache.asphalt;
    var c = canvas(256, 256), g = c.getContext('2d');
    g.fillStyle = '#4a4d52'; g.fillRect(0, 0, 256, 256);
    var rng = TG.makeRNG(11);
    for (var i = 0; i < 9000; i++) {
      var v = 60 + Math.floor(rng() * 40);
      g.fillStyle = 'rgb(' + v + ',' + (v + 2) + ',' + (v + 5) + ')';
      g.fillRect(rng() * 256, rng() * 256, 1.5, 1.5);
    }
    g.strokeStyle = 'rgba(30,30,34,0.35)'; g.lineWidth = 1;
    for (var k = 0; k < 6; k++) { g.beginPath(); var x = rng() * 256, y = rng() * 256; g.moveTo(x, y); for (var s = 0; s < 5; s++) { x += (rng() - 0.5) * 40; y += (rng() - 0.5) * 40; g.lineTo(x, y); } g.stroke(); }
    return (cache.asphalt = toTexture(c, 1, 1));
  }
  // 보도블록: 격자 타일. 2m 마다 반복.
  function paving() {
    if (cache.paving) return cache.paving;
    var c = canvas(128, 128), g = c.getContext('2d');
    g.fillStyle = '#b9b5ac'; g.fillRect(0, 0, 128, 128);
    var rng = TG.makeRNG(5);
    for (var y = 0; y < 128; y += 32) for (var x = 0; x < 128; x += 32) {
      var v = 175 + Math.floor(rng() * 20);
      g.fillStyle = 'rgb(' + v + ',' + (v - 3) + ',' + (v - 10) + ')';
      g.fillRect(x + 1, y + 1, 30, 30);
    }
    return (cache.paving = toTexture(c, 1, 1));
  }
  // 구름(부드러운 흰 얼룩, 투명 배경)
  function cloud() {
    if (cache.cloud) return cache.cloud;
    var c = canvas(256, 128), g = c.getContext('2d');
    g.clearRect(0, 0, 256, 128);
    var rng = TG.makeRNG(3);
    for (var i = 0; i < 26; i++) {
      var x = 40 + rng() * 176, y = 40 + rng() * 48, r = 18 + rng() * 26;
      var grd = g.createRadialGradient(x, y, 0, x, y, r);
      grd.addColorStop(0, 'rgba(255,255,255,0.9)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grd; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    }
    return (cache.cloud = toTexture(c));
  }
  // 물결(수면용 밝은 줄무늬)
  function water() {
    if (cache.water) return cache.water;
    var c = canvas(128, 128), g = c.getContext('2d');
    g.fillStyle = '#3d7fb8'; g.fillRect(0, 0, 128, 128);
    var rng = TG.makeRNG(9);
    g.strokeStyle = 'rgba(200,230,255,0.35)'; g.lineWidth = 2;
    for (var i = 0; i < 14; i++) { g.beginPath(); var y = rng() * 128; g.moveTo(0, y); g.bezierCurveTo(40, y + 6, 88, y - 6, 128, y); g.stroke(); }
    return (cache.water = toTexture(c, 1, 1));
  }
  // 버스 정류장 표지
  function busStop() {
    if (cache.busStop) return cache.busStop;
    var c = canvas(128, 256), g = c.getContext('2d');
    g.fillStyle = '#2c5aa0'; g.fillRect(0, 0, 128, 256);
    g.fillStyle = '#fff'; g.font = 'bold 44px ' + FONT; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('버스', 64, 60); g.fillText('정류장', 64, 118);
    g.fillStyle = '#ffd23f'; g.fillRect(24, 170, 80, 40); g.fillStyle = '#111'; g.fillRect(30, 180, 20, 12); g.fillRect(78, 180, 20, 12);
    return (cache.busStop = toTexture(c));
  }
  // 고속도로 표지(청색 바탕 안내)
  function hwSign(text) {
    var key = 'hw:' + text;
    if (cache[key]) return cache[key];
    // '|' 로 두 줄(위: IC 이름·화살표, 아래: 방면). 한국 고속도로 안내표지(녹색 바탕·흰 글자·흰 테두리)
    var lines = String(text).split('|'), c = canvas(768, 256), g = c.getContext('2d');
    g.fillStyle = '#1e7a3a'; g.fillRect(0, 0, 768, 256);
    g.strokeStyle = '#fff'; g.lineWidth = 8; g.strokeRect(10, 10, 748, 236);
    g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
    if (lines.length === 1) { g.font = 'bold 72px ' + FONT; g.fillText(lines[0], 384, 128); }
    else { g.font = 'bold 66px ' + FONT; g.fillText(lines[0], 384, 88); g.font = '600 48px ' + FONT; g.fillStyle = '#e8f5ea'; g.fillText(lines[1], 384, 178); }
    return (cache[key] = toTexture(c));
  }

  // 위반 차량 표시 화살표(스프라이트)
  // 연기(부드러운 원) · 전조등 플레어(가운데 밝고 가로로 긴 빛)
  function smoke() { var key = 'smoke'; if (cache[key]) return cache[key]; var c = canvas(64, 64), g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 2, 32, 32, 30); gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return (cache[key] = toTexture(c)); }
  function flare() { var key = 'flare'; if (cache[key]) return cache[key]; var c = canvas(128, 64), g = c.getContext('2d'), gr = g.createRadialGradient(64, 32, 1, 64, 32, 62); gr.addColorStop(0, 'rgba(255,250,235,1)'); gr.addColorStop(0.15, 'rgba(255,240,200,0.75)'); gr.addColorStop(0.5, 'rgba(255,225,160,0.18)'); gr.addColorStop(1, 'rgba(255,220,150,0)'); g.save(); g.scale(1, 0.5); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); g.restore(); return (cache[key] = toTexture(c)); }
  function marker() {
    if (cache.marker) return cache.marker;
    var c = canvas(128, 128), g = c.getContext('2d');
    g.fillStyle = '#ff9f0a';
    g.beginPath(); g.moveTo(64, 120); g.lineTo(20, 60); g.lineTo(46, 60); g.lineTo(46, 8); g.lineTo(82, 8); g.lineTo(82, 60); g.lineTo(108, 60); g.closePath(); g.fill();
    g.strokeStyle = '#3a2400'; g.lineWidth = 6; g.stroke();
    return (cache.marker = toTexture(c));
  }

  return { smoke: smoke, flare: flare, roadText: roadText, sign: sign, facade: facade, shopStrip: shopStrip, signalHead: signalHead, pedHead: pedHead, marker: marker, label: label, emblem: emblem, liverySide: liverySide, liveryHood: liveryHood,
           asphalt: asphalt, paving: paving, cloud: cloud, water: water, busStop: busStop, hwSign: hwSign };
})();
