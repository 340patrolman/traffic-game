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
    for (var i = 0; i < n; i++) g.fillText(text[i], 64, 128 * i + 66);   // 첫 글자를 캔버스 위쪽에 — 운전석에서 위에서부터 읽힌다
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
  // 보행 신호등 **3구**(소유자 제공 사진 · 용인 수지구 「혁신신호등」): 위 적색 사람 · 가운데 녹색 사람 · 아래 LED 숫자판.
  // 숫자판은 녹색일 때 남은 보행 초(녹색 숫자), **적색일 때도 다음 녹색까지 남은 대기 초(적색 숫자)**를 보인다
  // (소유자: 「보행자 신호등 밑부분에 초가 나오는데 이 부분이 빠졌다」 — 홍보담당 지적). 두 자리까지만 띄운다(100 이상은 빈 판).
  // 전부 LED 점으로 그린다 — 사진의 신호등이 점으로 된 사람·숫자다.
  // walk: 녹색 여부 · n: 표시할 초(없으면 빈 판 · -1 은 옛 점멸 꺼짐) · manOff: 녹색 점멸의 꺼진 순간(사람만 꺼지고 숫자는 남는다)
  var DIG5x7 = {
    '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
    '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
    '2': ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
    '3': ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
    '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
    '5': ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
    '6': ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
    '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
    '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
    '9': ['01110', '10001', '10001', '01111', '00001', '00010', '01100']
  };
  // 사람 그림을 LED 점으로 바꾼다 — 켜지면 밝은 점, 꺼지면 어두운 점 흔적(실물도 꺼진 LED 가 희미하게 보인다)
  function ledMan(walking, on, colorOn) {
    var key = 'ledman:' + walking + ':' + on + ':' + colorOn;
    if (cache[key]) return cache[key];
    var S = 48, src = canvas(S, S), g = src.getContext('2d');
    g.fillStyle = '#fff'; g.strokeStyle = '#fff'; g.lineCap = 'round'; g.lineWidth = 5.5;
    var cx = 24, cy = 26;
    g.beginPath(); g.arc(cx, cy - 15, 4.4, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.moveTo(cx, cy - 9); g.lineTo(cx, cy + 4); g.stroke();
    if (walking) {
      g.beginPath(); g.moveTo(cx, cy + 4); g.lineTo(cx - 8, cy + 18); g.moveTo(cx, cy + 4); g.lineTo(cx + 7, cy + 17); g.stroke();
      g.beginPath(); g.moveTo(cx, cy - 6); g.lineTo(cx - 8, cy + 2); g.moveTo(cx, cy - 6); g.lineTo(cx + 8, cy - 1); g.stroke();
    } else {
      g.beginPath(); g.moveTo(cx - 3, cy + 4); g.lineTo(cx - 3, cy + 19); g.moveTo(cx + 3, cy + 4); g.lineTo(cx + 3, cy + 19); g.stroke();
      g.beginPath(); g.moveTo(cx - 3, cy - 7); g.lineTo(cx - 7, cy + 5); g.moveTo(cx + 3, cy - 7); g.lineTo(cx + 7, cy + 5); g.stroke();
    }
    var px = g.getImageData(0, 0, S, S).data, out = canvas(S, S), o = out.getContext('2d'), P = 2.4;
    o.fillStyle = on ? colorOn : '#262b31';
    for (var y = P / 2; y < S; y += P) for (var x = P / 2; x < S; x += P) {
      if (px[((y | 0) * S + (x | 0)) * 4 + 3] < 90) continue;
      o.beginPath(); o.arc(x, y, P * 0.36, 0, Math.PI * 2); o.fill();
    }
    return (cache[key] = out);
  }
  function ledDigits(g, text, x0, y0, w, h, color) {
    var cols = text.length * 5 + (text.length - 1), pitch = Math.min(w / cols, h / 7);
    var ox = x0 + (w - pitch * cols) / 2, oy = y0 + (h - pitch * 7) / 2;
    g.fillStyle = color;
    for (var ci = 0; ci < text.length; ci++) {
      var gl = DIG5x7[text.charAt(ci)]; if (!gl) continue;
      for (var r = 0; r < 7; r++) for (var cc = 0; cc < 5; cc++) {
        if (gl[r].charAt(cc) !== '1') continue;
        g.beginPath(); g.arc(ox + (ci * 6 + cc + 0.5) * pitch, oy + (r + 0.5) * pitch, pitch * 0.38, 0, Math.PI * 2); g.fill();
      }
    }
  }
  function pedHead(walk, n, manOff) {
    var key = 'ph3:' + walk + ':' + (n === undefined ? '' : n) + ':' + (manOff ? 1 : 0);
    if (cache[key]) return cache[key];
    var W = 48, H = 144, c = canvas(W, H), g = c.getContext('2d');
    g.fillStyle = '#15181c'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#0b0d10';
    for (var s = 0; s < 3; s++) g.fillRect(3, s * 48 + 3, W - 6, 42);   // 렌즈 칸
    var redOn = !walk, greenOn = walk && !manOff && n !== -1;
    g.drawImage(ledMan(false, redOn, '#ff3b30'), 0, 0);
    g.drawImage(ledMan(true, greenOn, '#39d353'), 0, 48);
    if (n > 0 && n < 100) ledDigits(g, String(n), 5, 96 + 7, W - 10, 34, walk ? '#39d353' : '#ff3b30');
    return (cache[key] = toTexture(c));
  }

  // 짧은 라벨(차량 문 「경찰」 등). 청색 글자, 투명 배경.
  // 순찰차 도색 데칼(참고 사진): 옆면 = 아래 청색 띠가 앞 펜더에서 위로 솟는 스우시 + 황색 테두리 + 앞문 엠블럼 + 뒷문 「경찰 POLICE」.
  // 후드 = 앞이 넓고 앞유리 쪽으로 좁아지는 청색 쐐기 + 황색 테두리 + 가운데 엠블럼. 투명 배경이라 흰 차체 위에 얹는다.
  // 경찰 표장(참수리): 금색 이중 테두리 + 점선 고리 + 「경 찰 청」·「KOREAN NATIONAL POLICE AGENCY」 아치 글씨,
  // 가운데는 날개를 펼친 참수리 + 저울(천칭) 막대 + 무궁화 + 태극. 외부 이미지 없이 캔버스로만 그린다(에셋 0 규칙).
  function arcText(g, text, cx, cy, r, a0, a1, size, color, flip) {
    g.save(); g.fillStyle = color; g.font = 'bold ' + size + 'px ' + FONT; g.textAlign = 'center'; g.textBaseline = 'middle';
    var n = text.length;
    for (var i = 0; i < n; i++) {
      var t = n === 1 ? 0.5 : i / (n - 1), a = a0 + (a1 - a0) * t;
      g.save(); g.translate(cx + Math.cos(a) * r, cy + Math.sin(a) * r); g.rotate(a + (flip ? -Math.PI / 2 : Math.PI / 2)); g.fillText(text[i], 0, 0); g.restore();
    }
    g.restore();
  }
  // ---------- 경찰 마크(소유자 제공 실물 이미지 기준) ----------
  // 두 가지 형태를 쓴다.
  //   ① 방패형 「경찰 POLICE」 — 순찰차 도어·HUD·타이틀에 붙는 것(소유자: 「순찰차에 붙이는 이미지야」)
  //   ② 참수리 표장 — 경찰청 로고 형태(참수리 + 무궁화 + 태극). 신호제어기·정모에 붙는다.
  // 외부 이미지 파일은 쓰지 않는다(에셋 0 규칙) — 캔버스로 그린다.
  var GOLD = '#e8b923', GOLD_D = '#a8781a', GOLD_L = '#ffdf6b', BLUE = '#1b3f94', BLUE_D = '#122c6b', WHITE = '#ffffff';
  // 태극: 붉은 위·푸른 아래를 S 로 나눈 원. 실물처럼 좌상이 붉다(−45° 회전).
  function taegeuk(g, r) {
    g.save(); g.rotate(-Math.PI / 4);
    g.fillStyle = '#cd2e3a';
    g.beginPath(); g.arc(0, 0, r, Math.PI, 0); g.arc(r / 2, 0, r / 2, 0, Math.PI, true); g.arc(-r / 2, 0, r / 2, 0, Math.PI); g.closePath(); g.fill();
    g.fillStyle = '#0047a0';
    g.beginPath(); g.arc(0, 0, r, 0, Math.PI); g.arc(-r / 2, 0, r / 2, Math.PI, 0, true); g.arc(r / 2, 0, r / 2, Math.PI, 0); g.closePath(); g.fill();
    g.restore();
  }
  // 무궁화 다섯 장(금색) — 참수리 가슴 뒤에 깔린다
  function mugunghwa(g, r) {
    for (var p = 0; p < 5; p++) {
      g.save(); g.rotate(-Math.PI / 2 + p * Math.PI * 2 / 5);
      g.fillStyle = GOLD; g.strokeStyle = GOLD_D; g.lineWidth = r * 0.055;
      g.beginPath();
      g.moveTo(0, -r * 0.18);
      g.bezierCurveTo(r * 0.70, -r * 1.10, r * 1.36, -r * 0.34, r * 0.94, r * 0.18);
      g.bezierCurveTo(r * 0.58, r * 0.58, r * 0.08, r * 0.36, 0, -r * 0.18);
      g.closePath(); g.fill(); g.stroke();
      g.restore();
    }
  }
  // 참수리(경찰 표장): 좌우로 활짝 편 금색 날개 — 안쪽은 거의 수평, 바깥으로 갈수록 길어지며 **끝이 위로 벌어진다**.
  // 가운데에 작은 몸통, 그 위에 옆을 보는 머리와 갈고리 부리. 원점은 어깨 중앙, span = 한쪽 날개 길이.
  // (소유자가 준 실물 사진의 형태를 그대로 따랐다. 외부 이미지 파일은 쓰지 않는다 — 캔버스로만 그린다.)
  function eagle(g, span) {
    var FE = 7;
    for (var side = -1; side <= 1; side += 2) {
      g.save(); g.scale(side, 1);
      for (var k = 0; k < FE; k++) {
        var t = k / (FE - 1);
        var len = span * (0.60 + t * 0.40);                 // 바깥으로 갈수록 길다
        var ang = -0.06 - t * 0.22;                         // 바깥으로 갈수록 위로 들린다(완만하게)
        var thick = span * (0.135 - t * 0.050);
        g.save(); g.translate(span * 0.10, -span * 0.02); g.rotate(ang);
        g.fillStyle = (k % 2) ? GOLD_L : GOLD; g.strokeStyle = GOLD_D; g.lineWidth = span * 0.016;
        g.beginPath();
        g.moveTo(0, -thick * 0.5);
        g.quadraticCurveTo(len * 0.62, -thick * 1.05, len * 0.97, -thick * 0.55);
        g.quadraticCurveTo(len * 1.02, 0, len * 0.90, thick * 0.48);
        g.quadraticCurveTo(len * 0.50, thick * 0.72, 0, thick * 0.60);
        g.closePath(); g.fill(); g.stroke();
        g.restore();
      }
      g.restore();
    }
    // 저울: 어깨 아래 가로 막대와 좌우 접시 — 실물 표장에 있는 요소다
    g.strokeStyle = GOLD_D; g.fillStyle = GOLD; g.lineWidth = span * 0.030;
    g.beginPath(); g.moveTo(-span * 0.60, span * 0.12); g.lineTo(span * 0.60, span * 0.12); g.stroke();
    for (var sc = -1; sc <= 1; sc += 2) {
      g.lineWidth = span * 0.014;
      g.beginPath(); g.moveTo(sc * span * 0.56, span * 0.12); g.lineTo(sc * span * 0.56, span * 0.20); g.stroke();
      g.beginPath(); g.arc(sc * span * 0.56, span * 0.20, span * 0.115, 0, Math.PI); g.closePath(); g.fill(); g.stroke();
    }
    // 몸통(작고 둥글다) + 꼬리깃
    g.fillStyle = GOLD; g.strokeStyle = GOLD_D; g.lineWidth = span * 0.018;
    g.beginPath();
    g.moveTo(0, -span * 0.17);
    g.bezierCurveTo(span * 0.140, -span * 0.05, span * 0.120, span * 0.18, span * 0.075, span * 0.32);
    g.lineTo(-span * 0.075, span * 0.32);
    g.bezierCurveTo(-span * 0.120, span * 0.18, -span * 0.140, -span * 0.05, 0, -span * 0.17);
    g.closePath(); g.fill(); g.stroke();
    g.beginPath();                                          // 꼬리깃
    g.moveTo(-span * 0.075, span * 0.30); g.lineTo(span * 0.075, span * 0.30);
    g.lineTo(span * 0.115, span * 0.62); g.lineTo(0, span * 0.50); g.lineTo(-span * 0.115, span * 0.62);
    g.closePath(); g.fill(); g.stroke();
    // 머리: 어깨 바로 위에 얹힌다(목을 길게 뽑지 않는다 — 길면 오리처럼 보인다).
    // 왼쪽을 보고, 이마에서 부리로 곧게 내려오다 끝이 아래로 꺾이는 짧은 갈고리 부리.
    g.save(); g.translate(-span * 0.015, -span * 0.185);
    var h = span * 0.20;                                     // 머리 크기(반지름 기준)
    g.fillStyle = GOLD_L; g.strokeStyle = GOLD_D; g.lineWidth = span * 0.017;
    g.beginPath();
    g.moveTo(h * 0.62, h * 0.52);                            // 목덜미(오른쪽 아래)
    g.bezierCurveTo(h * 0.95, h * 0.10, h * 0.80, -h * 0.78, h * 0.02, -h * 0.90);   // 뒤통수
    g.bezierCurveTo(-h * 0.48, -h * 0.96, -h * 0.78, -h * 0.58, -h * 0.86, -h * 0.20);  // 이마
    g.lineTo(-h * 1.52, h * 0.02);                           // 부리 위 능선 → 끝
    g.quadraticCurveTo(-h * 1.34, h * 0.46, -h * 0.90, h * 0.30);   // 갈고리(끝이 아래로)
    g.bezierCurveTo(-h * 0.40, h * 0.62, h * 0.20, h * 0.72, h * 0.62, h * 0.52);
    g.closePath(); g.fill(); g.stroke();
    g.fillStyle = GOLD; g.beginPath();                        // 부리 아래턱
    g.moveTo(-h * 0.90, h * 0.30); g.lineTo(-h * 1.34, h * 0.10); g.lineTo(-h * 0.72, h * 0.36);
    g.closePath(); g.fill();
    g.fillStyle = '#2e2109';                                  // 눈
    g.beginPath(); g.arc(-h * 0.30, -h * 0.30, h * 0.17, 0, Math.PI * 2); g.fill();
    g.restore();
  }
  // ① 방패형 경찰 마크(소유자 제공 실물 사진 그대로): 금색 테두리 방패 · 남색 바탕 ·
  //    위에 참수리, 가운데 무궁화 + 태극, 그 좌우에 「경」「찰」, 아래에 「POLICE」.
  //    전 판에는 **무궁화가 아예 없었다** — 그래서 실물과 달라 보였다.
  function drawShield(g, cx, cy, r) {
    g.save(); g.translate(cx, cy); g.scale(r / 128, r / 128);
    // 방패 외곽: 윗변은 모서리를 크게 굴린 직선, 옆은 살짝 부풀었다가 아래에서 둥근 끝으로 모인다
    function shieldPath(k) {
      var W = 108 * k, T = -118 * k, B = 126 * k, R = 30 * k;
      g.beginPath();
      g.moveTo(-W + R, T);
      g.lineTo(W - R, T);
      g.quadraticCurveTo(W, T, W, T + R);
      g.bezierCurveTo(W, 24 * k, W * 0.82, 84 * k, 0, B);
      g.bezierCurveTo(-W * 0.82, 84 * k, -W, 24 * k, -W, T + R);
      g.quadraticCurveTo(-W, T, -W + R, T);
      g.closePath();
    }
    g.fillStyle = GOLD_D; shieldPath(1.00); g.fill();                     // 바깥 진한 금테
    g.fillStyle = GOLD;   shieldPath(0.975); g.fill();                    // 금테
    g.fillStyle = BLUE;   shieldPath(0.905); g.fill();                    // 남색 바탕
    g.strokeStyle = 'rgba(255,255,255,0.20)'; g.lineWidth = 2.4; shieldPath(0.865); g.stroke();
    g.save(); g.translate(0, -54); eagle(g, 92); g.restore();             // 참수리(위)
    g.save(); g.translate(0, 18); mugunghwa(g, 40);                       // 무궁화(가운데)
    g.fillStyle = GOLD_L; g.beginPath(); g.arc(0, 0, 21, 0, Math.PI * 2); g.fill();
    g.strokeStyle = GOLD_D; g.lineWidth = 2.2; g.beginPath(); g.arc(0, 0, 21, 0, Math.PI * 2); g.stroke();
    taegeuk(g, 17);
    g.restore();
    g.fillStyle = WHITE; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = 'bold 42px ' + FONT;
    g.fillText('경', -70, 18); g.fillText('찰', 70, 18);                  // 무궁화 좌우
    g.font = 'bold 32px ' + FONT; g.letterSpacing = '3px';
    g.fillText('POLICE', 0, 76);
    g.letterSpacing = '0px';
    g.restore();
  }
  // ② 참수리 표장(경찰청 로고 형태) — 신호제어기·정모·홍보물
  function drawEagleMark(g, cx, cy, r) {
    g.save(); g.translate(cx, cy); g.scale(r / 128, r / 128);
    g.save(); g.translate(0, 26); mugunghwa(g, 46); g.restore();
    g.save(); g.translate(0, -6); eagle(g, 116); g.restore();
    g.save(); g.translate(0, 26);
    g.fillStyle = GOLD_L; g.beginPath(); g.arc(0, 0, 26, 0, Math.PI * 2); g.fill();
    g.strokeStyle = GOLD_D; g.lineWidth = 2.4; g.beginPath(); g.arc(0, 0, 26, 0, Math.PI * 2); g.stroke();
    taegeuk(g, 21);
    g.restore();
    g.restore();
  }
  function drawEmblem(g, cx, cy, r) { drawShield(g, cx, cy, r); }
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
  // 순찰차 뒷면(소유자: 「뒷모습 매우 중요해」): 후부 반사판 — 형광 연두·적색 사선 + 청색 「POLICE」.
  // 실물 사진을 보고 캔버스로 그린다(외부 이미지 0개). 사선 방향은 가운데에서 바깥으로 벌어진다.
  function liveryRear() {
    if (cache.lvr) return cache.lvr;
    var W = 1024, H = 256, c = canvas(W, H), g = c.getContext('2d');
    g.clearRect(0, 0, W, H);
    // 아래 2/3 = 사선 반사판
    var y0 = H * 0.34, hh = H - y0, step = 58;
    g.save(); g.beginPath(); g.rect(0, y0, W, hh); g.clip();
    g.fillStyle = '#f2f6f8'; g.fillRect(0, y0, W, hh);
    for (var side = 0; side < 2; side++) {
      var x0 = side ? W / 2 : 0, x1 = side ? W : W / 2, dir = side ? 1 : -1, k = 0;
      for (var x = side ? W / 2 : W / 2; side ? x < W + hh : x > -hh; x += dir * step, k++) {
        g.fillStyle = (k % 2) ? '#e02a1e' : '#d8f43c';
        g.beginPath();
        g.moveTo(x, y0); g.lineTo(x + dir * step * 0.5, y0); g.lineTo(x + dir * (step * 0.5 - hh * 0.75), H); g.lineTo(x - dir * hh * 0.75, H);
        g.closePath(); g.fill();
      }
    }
    g.restore();
    g.strokeStyle = '#c9ced2'; g.lineWidth = 4; g.beginPath(); g.moveTo(0, y0); g.lineTo(W, y0); g.stroke();
    // 위 1/3 = 흰 바탕 + 청색 POLICE + 좌우 작은 태극/112
    g.fillStyle = '#f7f9fb'; g.fillRect(0, 0, W, y0 - 2);
    g.fillStyle = '#1b3f8f'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = 'bold 74px ' + FONT; g.letterSpacing = '10px';
    g.fillText('POLICE', W * 0.5, y0 * 0.52);
    g.letterSpacing = '0px';
    g.font = 'bold 40px ' + FONT; g.fillText('112', W * 0.13, y0 * 0.54); g.fillText('112', W * 0.87, y0 * 0.54);
    return (cache.lvr = toTexture(c));
  }
  // 승강식 전광판(사고·고장 현장에서 올린다): 검정 판에 호박색 점자식 글씨 + 화살표.
  // arrow: 'left' | 'right' | 'both' | null
  function ledBoard(text, arrow) {
    var key = 'led:' + text + '|' + (arrow || '');
    if (cache[key]) return cache[key];
    var W = 1024, H = 256, c = canvas(W, H), g = c.getContext('2d');
    g.fillStyle = '#07090c'; g.fillRect(0, 0, W, H);
    g.strokeStyle = '#2b3138'; g.lineWidth = 10; g.strokeRect(5, 5, W - 10, H - 10);
    var AM = '#ffb020';
    // 글씨(점자식 느낌: 글자를 그린 뒤 격자 구멍을 덮어 씌운다)
    g.fillStyle = AM; g.textAlign = 'center'; g.textBaseline = 'middle';
    var size = 118; g.font = 'bold ' + size + 'px ' + FONT;
    while (size > 40 && g.measureText(text).width > W * (arrow ? 0.62 : 0.9)) { size -= 4; g.font = 'bold ' + size + 'px ' + FONT; }
    g.fillText(text, arrow ? W * 0.40 : W * 0.5, H * 0.5);
    if (arrow) {   // 화살표(차로 변경 유도)
      var ax = W * 0.84, ay = H * 0.5, s = H * 0.30;
      function tri(dir) { g.beginPath(); g.moveTo(ax + dir * s, ay); g.lineTo(ax - dir * s * 0.35, ay - s * 0.86); g.lineTo(ax - dir * s * 0.35, ay + s * 0.86); g.closePath(); g.fill(); }
      g.fillStyle = AM;
      if (arrow === 'both') { ax = W * 0.76; tri(-1); ax = W * 0.93; tri(1); }
      else tri(arrow === 'right' ? 1 : -1);
    }
    // 점자 격자
    g.fillStyle = 'rgba(7,9,12,0.55)';
    for (var y = 0; y < H; y += 8) g.fillRect(0, y, W, 3);
    for (var x = 0; x < W; x += 8) g.fillRect(x, 0, 3, H);
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
  // 참수리 표장(경찰 로고). 차 문·후드·순찰차 데칼이 같은 그림을 쓴다.
  // 소유자가 준 실물 이미지가 있으면 **그대로** 쓴다(js/emblem.js 의 데이터 URI). 없으면 캔버스로 그린다.
  // 원본 이미지에서 **가장자리와 이어진 흰 바탕만** 지우고, 남은 그림의 경계로 잘라 정사각 텍스처로 만든다.
  // 안쪽의 흰 글씨(방패의 「POLICE」)는 가장자리와 이어져 있지 않으므로 그대로 남는다.
  // 이 처리를 코드에서 하는 이유: 이 PC 에 이미지 도구가 없고, 원본 바이트를 그대로 심어 두는 편이 정확하기 때문이다.
  function cutWhite(im) {
    var W = im.width, H = im.height, w = canvas(W, H), wg = w.getContext('2d');
    wg.drawImage(im, 0, 0);
    var d = wg.getImageData(0, 0, W, H), p = d.data;
    var seen = new Uint8Array(W * H), st = [], i, x, y;
    function push(k) { if (seen[k]) return; var o = k * 4; if (p[o] > 232 && p[o + 1] > 232 && p[o + 2] > 232) { seen[k] = 1; st.push(k); } }
    for (x = 0; x < W; x++) { push(x); push((H - 1) * W + x); }
    for (y = 0; y < H; y++) { push(y * W); push(y * W + W - 1); }
    while (st.length) {
      i = st.pop(); p[i * 4 + 3] = 0; x = i % W; y = (i - x) / W;
      if (x > 0) push(i - 1); if (x < W - 1) push(i + 1); if (y > 0) push(i - W); if (y < H - 1) push(i + W);
    }
    wg.putImageData(d, 0, 0);
    var x0 = W, y0 = H, x1 = -1, y1 = -1;                       // 남은 그림의 경계
    for (y = 0; y < H; y++) for (x = 0; x < W; x++) if (p[(y * W + x) * 4 + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 < x0) { x0 = 0; y0 = 0; x1 = W - 1; y1 = H - 1; }
    var cw = x1 - x0 + 1, ch = y1 - y0 + 1, S = Math.max(cw, ch);
    var oc = canvas(S, S), og = oc.getContext('2d');
    og.clearRect(0, 0, S, S);
    og.drawImage(w, x0, y0, cw, ch, (S - cw) / 2, (S - ch) / 2, cw, ch);   // 정사각형 가운데 정렬
    return oc;
  }
  // 소유자가 준 실물 이미지가 있으면 **그대로** 쓴다(js/emblem.js 의 데이터 URI). 없으면 캔버스로 그린다.
  function urlTexture(url, done) {
    var c = canvas(8, 8), t = new THREE.CanvasTexture(c);
    t.anisotropy = 4;
    var im = new Image();
    im.onload = function () {
      var oc = cutWhite(im);
      c.width = oc.width; c.height = oc.height;
      c.getContext('2d').drawImage(oc, 0, 0);
      t.needsUpdate = true;
      if (done) done(oc);
    };
    im.src = url; return t;
  }
  function emblem() {
    if (cache.emblem) return cache.emblem;
    if (TG.EMBLEM && TG.EMBLEM.shield) return (cache.emblem = urlTexture(TG.EMBLEM.shield));
    var c = canvas(512, 512), g = c.getContext('2d');
    g.clearRect(0, 0, 512, 512);
    drawEmblem(g, 256, 256, 250);
    return (cache.emblem = toTexture(c));
  }
  // 화면(DOM)용 표장: 같은 캔버스를 PNG data URL 로 한 번만 뽑는다(외부 이미지 파일 0개 규칙 유지)
  // cb 를 주면 흰 바탕을 지운 PNG 를 넘겨준다(이미지 해독이 비동기라 그렇다). 반환값은 즉시 쓸 수 있는 값이다.
  function emblemPNG(cb) {
    if (cache.emblemCut && cb) { cb(cache.emblemCut); return cache.emblemCut; }
    if (TG.EMBLEM && TG.EMBLEM.shield) {
      if (cb && !cache.emblemCutPending) {
        cache.emblemCutPending = 1;
        urlTexture(TG.EMBLEM.shield, function (oc) { cache.emblemCut = oc.toDataURL('image/png'); cb(cache.emblemCut); });
      }
      return (cache.emblemPNG = TG.EMBLEM.shield);
    }
    if (cache.emblemPNG) return cache.emblemPNG;
    var c = canvas(512, 512), g = c.getContext('2d');
    g.clearRect(0, 0, 512, 512); drawEmblem(g, 256, 256, 250);
    return (cache.emblemPNG = c.toDataURL('image/png'));
  }
  // 참수리 표장 텍스처(신호제어기·정모·홍보물)
  function emblemEagle() {
    if (cache.emblemEagle) return cache.emblemEagle;
    if (TG.EMBLEM && TG.EMBLEM.eagle) return (cache.emblemEagle = urlTexture(TG.EMBLEM.eagle));
    var c = canvas(512, 512), g = c.getContext('2d');
    g.clearRect(0, 0, 512, 512); drawEagleMark(g, 256, 262, 236);
    return (cache.emblemEagle = toTexture(c));
  }
  function emblemOld() {
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
    return toTexture(c);
  }
  // 교통경찰 조끼 등판 라벨: 청색 판에 「교통경찰」 + 「POLICE」 두 줄(실물 반사 조끼 등판 표기).
  // 소유자 참고 사진(교통경찰 근무 사진·일러스트)을 보고 캔버스로 그린다 — 외부 이미지 파일은 쓰지 않는다.
  // 신호제어기 명판: 흰 판 + 검정 테두리 + 「경찰청 표준 교통신호제어기」(소유자 제공 실물 사진 그대로).
  function ctrlPlate(text) {
    var key = 'cp:' + text;
    if (cache[key]) return cache[key];
    var W = 512, H = 96, c = canvas(W, H), g = c.getContext('2d');
    g.clearRect(0, 0, W, H);
    g.fillStyle = '#f2f3f0'; g.fillRect(4, 4, W - 8, H - 8);
    g.strokeStyle = '#1b1f24'; g.lineWidth = 5; g.strokeRect(7, 7, W - 14, H - 14);
    g.fillStyle = '#14181d'; g.textAlign = 'center'; g.textBaseline = 'middle';
    var size = 52; g.font = 'bold ' + size + 'px ' + FONT;
    while (size > 20 && g.measureText(text).width > W - 40) { size -= 2; g.font = 'bold ' + size + 'px ' + FONT; }
    g.fillText(text, W / 2, H / 2 + 2);
    return (cache[key] = toTexture(c));
  }
  function vestLabel(top, bottom) {
    var key = 'vest:' + top + '|' + bottom;
    if (cache[key]) return cache[key];
    var W = 512, H = 256, c = canvas(W, H), g = c.getContext('2d');
    g.clearRect(0, 0, W, H);
    // 청색 판 + 흰 테두리
    g.fillStyle = "#1b3f8f"; g.fillRect(8, 8, W - 16, H - 16);
    g.strokeStyle = "#ffffff"; g.lineWidth = 7; g.strokeRect(11, 11, W - 22, H - 22);
    g.fillStyle = '#ffffff'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = 'bold 96px ' + FONT; g.fillText(top, W / 2, 88);
    g.font = 'bold 62px ' + FONT; g.letterSpacing = '6px'; g.fillText(bottom, W / 2, 178);
    return (cache[key] = toTexture(c));
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

  // 지하철역 출입구 표지: 흰 바탕에 노선 색 원(번호) + 역 이름. 실존 로고·상표는 쓰지 않는다.
  function subwaySign(name, lines, colors) {
    var key = 'sw:' + name + '|' + lines.join(',');
    if (cache[key]) return cache[key];
    var W = 384, H = 128, c = canvas(W, H), g = c.getContext('2d');
    g.fillStyle = '#f7f8fa'; g.fillRect(0, 0, W, H);
    g.strokeStyle = '#2c3340'; g.lineWidth = 6; g.strokeRect(3, 3, W - 6, H - 6);
    var r = 26, x0 = 16 + r;
    for (var i = 0; i < lines.length && i < 3; i++) {
      g.beginPath(); g.arc(x0 + i * (r * 2 + 8), H / 2, r, 0, Math.PI * 2);
      g.fillStyle = colors[i] || '#888'; g.fill();
      g.fillStyle = '#fff'; g.font = 'bold 32px ' + FONT; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(lines[i], x0 + i * (r * 2 + 8), H / 2 + 2);
    }
    var tx = x0 + Math.min(3, lines.length) * (r * 2 + 8) + 6, avail = W - tx - 16;
    g.fillStyle = '#151a22'; g.textAlign = 'left'; g.textBaseline = 'middle';
    var size = 46; g.font = 'bold ' + size + 'px ' + FONT;
    while (size > 20 && g.measureText(name).width > avail) { size -= 2; g.font = 'bold ' + size + 'px ' + FONT; }
    g.fillText(name, tx, H / 2 + 2);
    return (cache[key] = toTexture(c));
  }
  // 문화재 안내석(향나무 등): 짙은 갈색 판에 흰 글씨
  function stoneLabel(text, sub) {
    var key = 'st:' + text + '|' + (sub || '');
    if (cache[key]) return cache[key];
    var W = 256, H = 128, c = canvas(W, H), g = c.getContext('2d');
    g.fillStyle = '#4a3b2c'; g.fillRect(0, 0, W, H);
    g.strokeStyle = '#d9c9a8'; g.lineWidth = 4; g.strokeRect(8, 8, W - 16, H - 16);
    g.fillStyle = '#f4ecdd'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = 'bold 38px ' + FONT; g.fillText(text, W / 2, sub ? 52 : 64);
    if (sub) { g.font = '22px ' + FONT; g.fillStyle = '#d9c9a8'; g.fillText(sub, W / 2, 92); }
    return (cache[key] = toTexture(c));
  }

  // 무인 교통단속 예고 표지: 흰 바탕 + 색 테두리 + 「무인 ○○ 단속」
  function camSign(text, color) {
    var key = 'cs:' + text + (color || '');
    if (cache[key]) return cache[key];
    var W = 384, H = 132, c = canvas(W, H), g = c.getContext('2d');
    g.fillStyle = '#f7f8fa'; g.fillRect(0, 0, W, H);
    g.strokeStyle = color || '#1f4fa8'; g.lineWidth = 10; g.strokeRect(5, 5, W - 10, H - 10);
    g.fillStyle = color || '#1f4fa8'; g.textAlign = 'center'; g.textBaseline = 'middle';
    var size = 54; g.font = 'bold ' + size + 'px ' + FONT;
    while (size > 20 && g.measureText(text).width > W - 40) { size -= 2; g.font = 'bold ' + size + 'px ' + FONT; }
    g.fillText(text, W / 2, H / 2 + 2);
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

  // 휴대전화 화면(실존 앱·상표 없음): 'chat' 말풍선(손에 든 폰 — 문자·메신저) · 'map' 지도 안내(거치대 — 내비게이션)
  function phoneScreen(kind) {
    var key = 'ps:' + kind;
    if (cache[key]) return cache[key];
    var chat = kind === 'chat', c = canvas(chat ? 64 : 128, chat ? 128 : 64), g = c.getContext('2d');
    if (chat) {
      g.fillStyle = '#b9d3e8'; g.fillRect(0, 0, 64, 128);
      g.fillStyle = '#2f3b4a'; g.fillRect(0, 0, 64, 12);
      var ys = [20, 38, 56, 74, 92, 108];
      for (var i = 0; i < ys.length; i++) { var mine = i % 2 === 1, bw = 24 + (i * 13) % 20; g.fillStyle = mine ? '#ffe14d' : '#ffffff'; g.fillRect(mine ? 60 - bw : 4, ys[i], bw, 12); }
      g.fillStyle = '#ffffff'; g.fillRect(0, 120, 64, 8);
    } else {
      g.fillStyle = '#e8ecef'; g.fillRect(0, 0, 128, 64);
      g.strokeStyle = '#ffffff'; g.lineWidth = 6; g.beginPath(); g.moveTo(0, 44); g.lineTo(128, 30); g.moveTo(40, 0); g.lineTo(56, 64); g.moveTo(92, 0); g.lineTo(100, 64); g.stroke();
      g.strokeStyle = '#2d7ff9'; g.lineWidth = 5; g.beginPath(); g.moveTo(52, 64); g.lineTo(48, 40); g.lineTo(96, 32); g.stroke();
      g.fillStyle = '#2d7ff9'; g.beginPath(); g.moveTo(52, 60); g.lineTo(46, 50); g.lineTo(58, 50); g.fill();
      g.fillStyle = '#1f2a37'; g.fillRect(0, 0, 128, 10);
    }
    return (cache[key] = toTexture(c));
  }
  return { smoke: smoke, flare: flare, phoneScreen: phoneScreen, roadText: roadText, sign: sign, facade: facade, shopStrip: shopStrip, signalHead: signalHead, pedHead: pedHead, marker: marker, label: label, subwaySign: subwaySign, stoneLabel: stoneLabel, camSign: camSign, emblem: emblem, emblemEagle: emblemEagle, emblemPNG: emblemPNG, vestLabel: vestLabel, ctrlPlate: ctrlPlate, liverySide: liverySide, liveryRear: liveryRear, ledBoard: ledBoard, liveryHood: liveryHood,
           asphalt: asphalt, paving: paving, cloud: cloud, water: water, busStop: busStop, hwSign: hwSign };
})();
