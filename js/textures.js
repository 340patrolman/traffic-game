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

  // 보행 신호등(세로 2구)
  function pedHead(walk) {
    var key = 'ph:' + walk;
    if (cache[key]) return cache[key];
    var c = canvas(64, 128), g = c.getContext('2d');
    g.fillStyle = '#1d2126'; g.fillRect(0, 0, 64, 128);
    g.fillStyle = walk ? '#2a2f36' : '#ff3b30'; g.beginPath(); g.arc(32, 32, 22, 0, Math.PI * 2); g.fill();
    g.fillStyle = walk ? '#34c759' : '#2a2f36'; g.beginPath(); g.arc(32, 96, 22, 0, Math.PI * 2); g.fill();
    return (cache[key] = toTexture(c));
  }

  // 짧은 라벨(차량 문 「경찰」 등). 청색 글자, 투명 배경.
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
    var c = canvas(512, 192), g = c.getContext('2d');
    g.fillStyle = '#1e7a3a'; g.fillRect(0, 0, 512, 192);
    g.strokeStyle = '#fff'; g.lineWidth = 8; g.strokeRect(10, 10, 492, 172);
    g.fillStyle = '#fff'; g.font = 'bold 64px ' + FONT; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, 256, 96);
    return (cache[key] = toTexture(c));
  }

  // 위반 차량 표시 화살표(스프라이트)
  function marker() {
    if (cache.marker) return cache.marker;
    var c = canvas(128, 128), g = c.getContext('2d');
    g.fillStyle = '#ff9f0a';
    g.beginPath(); g.moveTo(64, 120); g.lineTo(20, 60); g.lineTo(46, 60); g.lineTo(46, 8); g.lineTo(82, 8); g.lineTo(82, 60); g.lineTo(108, 60); g.closePath(); g.fill();
    g.strokeStyle = '#3a2400'; g.lineWidth = 6; g.stroke();
    return (cache.marker = toTexture(c));
  }

  return { roadText: roadText, sign: sign, facade: facade, shopStrip: shopStrip, signalHead: signalHead, pedHead: pedHead, marker: marker, label: label,
           asphalt: asphalt, paving: paving, cloud: cloud, water: water, busStop: busStop, hwSign: hwSign };
})();
