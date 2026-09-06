// 날씨·시간대: 맑음 · 석양 · 밤 · 비 · 눈. 조명(반구광·태양)·안개·하늘색·노면색·입자(비/눈)·가로등 불빛·전조등을 한 곳에서 바꾼다.
// 노면 그립도 여기서 정한다(비 0.78 · 눈 0.62). 파일 0개 — 입자 점 텍스처도 캔버스로 만든다.
TG.WEATHERS = { clear: 1, sunset: 1, night: 1, rain: 1, snow: 1, windy: 1, auto: 1, random: 1 };
TG.Weather = function (scene, world, terrain, city, renderer) {
  var self = this;
  this.name = 'clear'; this.grip = 1; this.dark = false;
  var PRESETS = {
    clear:  { label: '맑음',  hemi: [0xd6e6ff, 0x7f7256, 0.75], sun: [0xfff0d2, 1.15, 110], fog: [0xcfe0f3, 220, 1500], sky: [0x3f7fd6, 0xdbe9f6], exposure: 1.02, road: 0xffffff, ground: 0xffffff, grip: 1.0, particles: null },
    sunset: { label: '석양',  hemi: [0xffcfa8, 0x6b5a48, 0.6],  sun: [0xffb070, 1.0, 38],   fog: [0xf1c7a3, 200, 1400], sky: [0x4a5aa8, 0xffb27a], exposure: 1.0,  road: 0xf2e6da, ground: 0xf4dcc4, grip: 1.0, particles: null },
    night:  { label: '밤',    hemi: [0x2a3a5c, 0x0e1116, 0.42], sun: [0x9fb4ff, 0.22, 90],  fog: [0x0a0f1c, 110, 900],  sky: [0x04070e, 0x131a2c], exposure: 0.95, road: 0xb8bcc6, ground: 0x9aa3b8, grip: 1.0, particles: null, dark: true },
    rain:   { label: '비',    hemi: [0x9aa6b5, 0x55534d, 0.62], sun: [0xc0c8d0, 0.45, 100], fog: [0x9fa9b5, 90, 700],   sky: [0x5c6673, 0xaab3bd], exposure: 0.95, road: 0x7d8186, ground: 0xc7cbcf, grip: 0.78, particles: 'rain' },
    snow:   { label: '눈',    hemi: [0xe8f0ff, 0xb9c0c8, 0.85], sun: [0xffffff, 0.65, 100], fog: [0xe6ecf2, 100, 800],  sky: [0x9fb0c4, 0xf0f4f8], exposure: 1.0,  road: 0xd9dde2, ground: 0xf4f7fa, grip: 0.62, particles: 'snow' },
    windy:  { label: '강풍',  hemi: [0xc9d3dc, 0x6e6a60, 0.7],  sun: [0xe8e2d0, 0.8, 90],   fog: [0xb9c2cc, 140, 900],  sky: [0x5f7290, 0xc7ced6], exposure: 0.98, road: 0xf2f2f2, ground: 0xe6e3da, grip: 0.95, particles: 'dust', wind: 1 },
  };
  this.presets = PRESETS;
  this.wind = 0; this.gust = 0; this.windDir = [1, 0.2];   // 서→동 바람(월드 벡터)
  // 자동/랜덤: 기기 시계·달로 시간대와 계절을 정한다(네트워크 없음 — 실제 기상 연동은 「네트워크 요청 0」 규칙에 어긋난다).
  this.pick = function (mode) {
    var names = ['clear', 'sunset', 'night', 'rain', 'snow', 'windy'];
    if (mode === 'random') return names[Math.floor(Math.random() * names.length)];
    var d = new Date(), h = d.getHours(), m = d.getMonth() + 1, r = Math.random();
    var winter = m === 12 || m <= 2, monsoon = m >= 6 && m <= 8;
    if (r < (monsoon ? 0.35 : 0.15)) return 'rain';
    if (winter && r < 0.4) return 'snow';
    if (r < 0.5 && (m === 3 || m === 4 || m === 11)) return 'windy';
    if (h >= 20 || h < 6) return 'night';
    if ((h >= 17 && h < 20) || (h >= 6 && h < 8)) return 'sunset';
    return 'clear';
  };
  // 바람이 차에 주는 옆 방향 힘(m/s²): 진행 방향 오른쪽 성분. 돌풍은 시간에 따라 출렁인다.
  this.lateralGust = function (heading) {
    if (!self.wind) return 0;
    var rx = -Math.cos(heading), rz = Math.sin(heading);   // right = (-fz, fx)
    var t = performance.now() / 1000, g = 0.55 + 0.45 * Math.sin(t * 0.9) * Math.sin(t * 0.23 + 1.7);
    self.gust = g;
    return (self.windDir[0] * rx + self.windDir[1] * rz) * self.wind * g * 3.2;
  };
  function rgb(hex) { return [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255]; }
  function sstep(a, b, x) { var t = TG.clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
  // 하늘 돔 정점색 다시 칠하기(terrain 과 같은 공식)
  function setSky(zenHex, horHex) {
    var sky = terrain.skyMesh && terrain.skyMesh.geometry; if (!sky) return;
    var spos = sky.attributes.position, col = sky.attributes.color, ZEN = rgb(zenHex), HOR = rgb(horHex);
    for (var i = 0; i < spos.count; i++) { var yy = spos.getY(i) / 2200, t = sstep(-0.05, 0.6, yy); col.setXYZ(i, HOR[0] + (ZEN[0] - HOR[0]) * t, HOR[1] + (ZEN[1] - HOR[1]) * t, HOR[2] + (ZEN[2] - HOR[2]) * t); }
    col.needsUpdate = true;
  }
  // 입자(비·눈): 카메라 주변 상자 안에서 떨어지고 바닥에 닿으면 위로 되돌린다
  var N = 1600, geo = new THREE.BufferGeometry(), pos = new Float32Array(N * 3), spd = new Float32Array(N), sway = new Float32Array(N);
  for (var i = 0; i < N; i++) { pos[i * 3] = (Math.random() - 0.5) * 70; pos[i * 3 + 1] = Math.random() * 40; pos[i * 3 + 2] = (Math.random() - 0.5) * 70; spd[i] = 0.7 + Math.random() * 0.6; sway[i] = Math.random() * Math.PI * 2; }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  function dotTex(kind) {
    var c = document.createElement('canvas'); c.width = 32; c.height = 32; var g = c.getContext('2d'); g.clearRect(0, 0, 32, 32);
    if (kind === 'rain') { var gr = g.createLinearGradient(0, 0, 0, 32); gr.addColorStop(0, 'rgba(210,225,240,0)'); gr.addColorStop(0.5, 'rgba(210,225,240,0.9)'); gr.addColorStop(1, 'rgba(210,225,240,0)'); g.fillStyle = gr; g.fillRect(13, 0, 6, 32); }
    else { var rg = g.createRadialGradient(16, 16, 2, 16, 16, 14); rg.addColorStop(0, 'rgba(255,255,255,1)'); rg.addColorStop(0.6, 'rgba(255,255,255,0.7)'); rg.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = rg; g.fillRect(0, 0, 32, 32); }
    var t = new THREE.CanvasTexture(c); return t;
  }
  var rainMat = new THREE.PointsMaterial({ size: 1.4, map: dotTex('rain'), transparent: true, depthWrite: false, opacity: 0.55, color: 0xdfe8f2, sizeAttenuation: true });
  var snowMat = new THREE.PointsMaterial({ size: 0.5, map: dotTex('snow'), transparent: true, depthWrite: false, opacity: 0.95, color: 0xffffff, sizeAttenuation: true });
  var dustMat = new THREE.PointsMaterial({ size: 0.35, map: dotTex('snow'), transparent: true, depthWrite: false, opacity: 0.35, color: 0xd8cfb8, sizeAttenuation: true });
  var points = new THREE.Points(geo, rainMat); points.visible = false; points.frustumCulled = false; scene.add(points);
  var kind = null, center = new THREE.Vector3();
  // 가로등 불빛(밤): 램프 머리 위치에 가산 혼합 점
  var lampGeo = new THREE.BufferGeometry(), lp = [];
  (city.lamps || []).forEach(function (l) { lp.push(l.x + Math.sin(l.rot) * 2.3, 6.75, l.z + Math.cos(l.rot) * 2.3); });
  lampGeo.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3));
  var lampPts = new THREE.Points(lampGeo, new THREE.PointsMaterial({ size: 7, map: dotTex('snow'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xffd58a, opacity: 0.85 }));
  lampPts.visible = false; lampPts.frustumCulled = false; scene.add(lampPts);
  // 전조등(플레이어): 밤에만 켜지는 스포트라이트 + 앞유리 아래 조명 원뿔
  var spot = new THREE.SpotLight(0xfff4d6, 0, 70, 0.55, 0.5, 1.2); spot.visible = false;
  var spotTarget = new THREE.Object3D(); spot.target = spotTarget;
  this.attachPlayer = function (mesh, len) { mesh.add(spot); mesh.add(spotTarget); spot.position.set(0, 0.75, len / 2); spotTarget.position.set(0, -0.6, len / 2 + 22); };
  this.set = function (name) {
    var P = PRESETS[name] || PRESETS.clear; self.name = PRESETS[name] ? name : 'clear'; self.grip = P.grip; self.dark = !!P.dark;
    world.hemi.color.setHex(P.hemi[0]); world.hemi.groundColor.setHex(P.hemi[1]); world.hemi.intensity = P.hemi[2];
    world.sun.color.setHex(P.sun[0]); world.sun.intensity = P.sun[1]; world.sunHeight = P.sun[2];
    scene.fog.color.setHex(P.fog[0]); scene.fog.near = P.fog[1]; scene.fog.far = P.fog[2];
    setSky(P.sky[0], P.sky[1]);
    if (renderer) renderer.toneMappingExposure = P.exposure;
    var M = TG.mats || { road: [], ground: [] };
    M.road.forEach(function (m) { m.color.setHex(P.road); });
    M.ground.forEach(function (m) { m.color.setHex(P.ground); });
    kind = P.particles; points.visible = !!kind; if (kind) points.material = kind === 'rain' ? rainMat : kind === 'dust' ? dustMat : snowMat;
    self.wind = P.wind || 0;
    lampPts.visible = !!P.dark; spot.visible = !!P.dark; spot.intensity = P.dark ? 2.2 : 0;
    if (terrain.waterMat) terrain.waterMat.opacity = P.dark ? 0.95 : 0.88;
    (M.facade || []).forEach(function (m) { m.emissive.setHex(P.dark ? 0x7a6a44 : 0x000000); m.emissiveMap = P.dark ? m.map : null; m.needsUpdate = true; });   // 밤: 창문 불빛
  };
  this.update = function (dt, cam) {
    if (!kind) return;
    center.copy(cam);
    var fall = kind === 'rain' ? 26 : kind === 'dust' ? 0.6 : 2.2, drift = kind === 'rain' ? 4 : kind === 'dust' ? 14 * (0.5 + self.gust) : 1.2, t = performance.now() / 1000;
    for (var i = 0; i < N; i++) {
      var ix = i * 3, y = pos[ix + 1] - fall * spd[i] * dt;
      if (y < center.y - 6) { y += 40; pos[ix] = center.x + (Math.random() - 0.5) * 70; pos[ix + 2] = center.z + (Math.random() - 0.5) * 70; }
      pos[ix + 1] = y;
      if (kind === 'snow') pos[ix] += Math.sin(t * 1.3 + sway[i]) * drift * dt;
      else if (kind === 'dust') { pos[ix] += self.windDir[0] * drift * dt; pos[ix + 2] += self.windDir[1] * drift * dt; }
      else pos[ix + 2] -= drift * dt;
      var dx = pos[ix] - center.x, dz = pos[ix + 2] - center.z;
      if (dx > 35) pos[ix] -= 70; else if (dx < -35) pos[ix] += 70;
      if (dz > 35) pos[ix + 2] -= 70; else if (dz < -35) pos[ix + 2] += 70;
    }
    geo.attributes.position.needsUpdate = true;
  };
};
