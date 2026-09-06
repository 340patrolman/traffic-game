// 플레이어 순찰차: 아케이드 물리(외부 엔진 없음)지만 정지거리·안전거리·코너 한계·경사는 실제처럼 결과가 따라온다.
//  - 정지거리 = v² / (2·brake)  → 속도의 제곱에 비례
//  - 코너: 요구 횡가속 a = v²·κ (κ = tan δ / 축거). a > latMax 이면 언더스티어(덜 돌고 바깥으로 밀림)
//  - 교차로 우회전(R≈8m)은 30km/h 여유, 40km/h 는 아슬아슬하게 통과하도록 latMax 를 잡았다
//  - 후진: 정지 상태에서 브레이크를 0.35초 더 누르거나 후진 버튼(▼)/스틱 아래. 후진등 점등.
(function () {
  TG.PlayerCar = function (scene, city, cfg, spec) {
    this.city = city; this.cfg = cfg; this.spec = spec;
    this.pos = { x: city.spawn.x, z: city.spawn.z }; this.y = 0;
    this.heading = city.spawn.heading;
    this.vx = 0; this.vz = 0; this.vF = 0; this.vL = 0;
    this.steer = 0; this.brakeLevel = 0; this.stopT = 0; this.gear = 'D';
    this.controls = { throttle: 0, brake: 0, steer: 0, reverse: 0 };
    this.siren = false;
    this.radius = spec.l * 0.36; this.len = spec.l; this.wid = spec.w;
    this.telemetry = { speed: 0, ratio: 0, understeer: false, skid: 0, stopDist: 0, aLong: 0, aLat: 0, kappa: 0, offroad: false, slope: 0, limit: spec.latMax };
    this.pitch = 0; this.roll = 0; this.tPitch = 0; this.tRoll = 0; this.sirenPhase = 0;
    this.buildMesh(scene);
  };
  var P = TG.PlayerCar.prototype;

  P.buildMesh = function (scene) {
    var s = this.spec, type = s.id === 'suv' ? 'psuv' : s.id === 'flag' ? 'pflag' : 'police', T = TG.vehmesh.TYPES[type];
    this.T = T;
    this.body = new THREE.Mesh(TG.vehmesh.build(type, 0xf6f7f9, true), new THREE.MeshLambertMaterial({ vertexColors: true }));
    this.body.castShadow = true;
    var g = new THREE.Group(); g.rotation.order = 'YXZ'; g.add(this.body);
    // 차내 시점 실내(추적 시점에서는 숨김)
    this.interior = new THREE.Mesh(TG.vehmesh.interior(T), new THREE.MeshLambertMaterial({ vertexColors: true }));
    this.interior.visible = false; g.add(this.interior);
    // 실시간 계기판(캔버스 텍스처): 속도계 바늘·디지털 속도·기어·경광등 표시. 차내 시점에서만 갱신
    this.clCanvas = document.createElement('canvas'); this.clCanvas.width = 512; this.clCanvas.height = 192;
    this.clTex = new THREE.CanvasTexture(this.clCanvas);
    this.cluster = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.158), new THREE.MeshBasicMaterial({ map: this.clTex, transparent: true }));
    var dyC = T.belt - 0.02 + 0.09, dzC = 0.11 * T.l - 0.07 - 0.012;
    this.cluster.position.set(0.38, dyC, dzC); this.cluster.rotation.y = Math.PI; this.cluster.visible = false;
    g.add(this.cluster); this.clT = 0; this.drawCluster();
    // 거울 3개(룸미러·좌우 사이드미러): 뒤를 보는 카메라를 작은 렌더타깃에 그려 거울 면에 붙인다. 차내 시점에서만 갱신.
    this.mirrorCams = []; this.mirrorMeshes = []; this.mirrorRTs = []; this.mirrorTick = 0;
    var mirrorDefs = [
      { w: 0.30, h: 0.075, pos: [0, T.belt + 0.50, 0.11 * T.l - 0.03], look: [0, 0.10, -1], fov: 30, aspect: 4 },          // 룸미러
      { w: 0.22, h: 0.13, pos: [w / 2 + 0.16, T.belt + 0.10, 0.11 * T.l + 0.22], look: [0.55, -0.05, -1], fov: 34, aspect: 1.7 },   // 좌 사이드미러(운전석)
      { w: 0.22, h: 0.13, pos: [-w / 2 - 0.16, T.belt + 0.10, 0.11 * T.l + 0.22], look: [-0.55, -0.05, -1], fov: 34, aspect: 1.7 },
    ];
    for (var mi = 0; mi < mirrorDefs.length; mi++) {
      var md = mirrorDefs[mi], rt = new THREE.WebGLRenderTarget(mi === 0 ? 320 : 192, mi === 0 ? 80 : 112);
      rt.texture.wrapS = THREE.RepeatWrapping; rt.texture.repeat.x = -1;   // 거울상: 좌우 반전
      var cam = new THREE.PerspectiveCamera(md.fov, md.aspect, 0.6, 450); cam.position.set(md.pos[0], md.pos[1], md.pos[2]);
      cam.lookAt(md.pos[0] + md.look[0], md.pos[1] + md.look[1], md.pos[2] + md.look[2]); g.add(cam);
      var mm = new THREE.Mesh(new THREE.PlaneGeometry(md.w, md.h), new THREE.MeshBasicMaterial({ map: rt.texture }));
      mm.position.set(md.pos[0], md.pos[1], md.pos[2] - 0.02); mm.rotation.y = Math.PI; mm.visible = false;
      var frame = new THREE.Mesh(new THREE.BoxGeometry(md.w + 0.03, md.h + 0.03, 0.03), new THREE.MeshLambertMaterial({ color: 0x1a1e24 }));
      frame.position.set(md.pos[0], md.pos[1], md.pos[2]); frame.visible = false;
      g.add(mm); g.add(frame);
      this.mirrorCams.push(cam); this.mirrorMeshes.push(mm, frame); this.mirrorRTs.push(rt);
    }
    // 디지털 사이드미러 화면(A필러 안쪽, 운전자 쪽으로 기울임): 세로 화면처럼 시야가 좁아도 양옆이 보인다. 같은 렌더타깃을 쓴다.
    for (var di = 1; di <= 2; di++) {
      var sgn = di === 1 ? 1 : -1, dm = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.13), new THREE.MeshBasicMaterial({ map: this.mirrorRTs[di].texture }));
      dm.position.set(sgn * 0.62, T.belt + 0.14, 0.11 * T.l + 0.06); dm.rotation.y = Math.PI + sgn * 0.35; dm.visible = false;
      var df = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.16, 0.02), new THREE.MeshLambertMaterial({ color: 0x1a1e24 }));
      df.position.set(sgn * 0.62, T.belt + 0.14, 0.11 * T.l + 0.075); df.rotation.y = sgn * 0.35; df.visible = false;
      g.add(dm); g.add(df); this.mirrorMeshes.push(dm, df);
    }
    var roofY = TG.vehmesh.roofY(T), barY = roofY + 0.16, l = T.l, w = T.w, bz = -l * 0.04;
    // 경광등 바: 지붕 최고점 위. 어두운 받침 + 적·청 렌즈 4구(발광) + 흰 중앙등. 사이렌 시 좌우 번갈아 스트로브.
    var barBase = new THREE.Mesh(new THREE.BoxGeometry(1.16, 0.06, 0.34), new THREE.MeshLambertMaterial({ color: 0x1a1e24 }));
    barBase.position.set(0, roofY + 0.09, bz); g.add(barBase);
    this.barR = new THREE.Mesh(new THREE.BoxGeometry(0.50, 0.15, 0.32), new THREE.MeshBasicMaterial({ color: 0x7a1010 }));
    this.barB = new THREE.Mesh(new THREE.BoxGeometry(0.50, 0.15, 0.32), new THREE.MeshBasicMaterial({ color: 0x102270 }));
    this.barR.position.set(0.30, barY, bz); this.barB.position.set(-0.30, barY, bz);
    var barW = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.13, 0.30), new THREE.MeshBasicMaterial({ color: 0xe8edf2 }));
    barW.position.set(0, barY, bz);
    var barTop = new THREE.Mesh(new THREE.BoxGeometry(1.16, 0.02, 0.34), new THREE.MeshLambertMaterial({ color: 0x2b2f35 }));
    barTop.position.set(0, barY + 0.085, bz);
    g.add(this.barR); g.add(this.barB); g.add(barW); g.add(barTop);
    // 핸들(차내 시점): 조향에 따라 돈다
    this.steer3d = new THREE.Mesh(TG.vehmesh.steering(), new THREE.MeshLambertMaterial({ vertexColors: true }));
    this.steer3d.position.set(0.38, T.belt + 0.02, 0.11 * T.l - 0.36); this.steer3d.rotation.order = 'YXZ';
    this.steer3d.rotation.x = -0.42; this.steer3d.visible = false; g.add(this.steer3d);
    var hy = T.pts[1][1] * 0.82 + 0.08;
    this.brakeLamp = new THREE.Mesh(new THREE.BoxGeometry(w * 0.85, 0.14, 0.06), new THREE.MeshBasicMaterial({ color: 0xff2a1a }));
    this.brakeLamp.position.set(0, hy, -l / 2 - 0.03); this.brakeLamp.visible = false; g.add(this.brakeLamp);
    this.revLamp = new THREE.Mesh(new THREE.BoxGeometry(w * 0.5, 0.1, 0.06), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    this.revLamp.position.set(0, hy - 0.16, -l / 2 - 0.03); this.revLamp.visible = false; g.add(this.revLamp);
    // 바퀴(앞바퀴 조향)
    this.wheels = [];
    var wgeo = TG.vehmesh.wheelGeo(T.wheelR, !!T.detail), wmat = new THREE.MeshLambertMaterial({ vertexColors: true });
    var pairs = [[-1, 1], [1, 1], [-1, -1], [1, -1]];
    for (var i = 0; i < 4; i++) { var wh = new THREE.Mesh(wgeo, wmat); wh.position.set(pairs[i][0] * (w / 2 - 0.05), T.wheelR, pairs[i][1] * l * 0.31); g.add(wh); this.wheels.push(wh); }
    // 문 라벨 「서울경찰」 · 뒤 「112」
    var lab = new THREE.MeshBasicMaterial({ map: TG.tex.label('서울경찰 POLICE', '#ffffff'), transparent: true });
    var lg = new THREE.PlaneGeometry(1.5, 0.3);
    var lL = new THREE.Mesh(lg, lab); lL.position.set(w / 2 + 0.07, T.belt - 0.22, -0.1); lL.rotation.y = Math.PI / 2;
    var lR = new THREE.Mesh(lg, lab); lR.position.set(-w / 2 - 0.07, T.belt - 0.22, -0.1); lR.rotation.y = -Math.PI / 2;
    var l112 = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.2), new THREE.MeshBasicMaterial({ map: TG.tex.label('112', '#1f4fa8'), transparent: true }));
    l112.position.set(0, hy + 0.2, -l / 2 - 0.03); l112.rotation.y = Math.PI;
    g.add(lL); g.add(lR); g.add(l112);
    this.mesh = g; scene.add(g); this.syncMesh();
  };

  P.forward = function () { return [Math.sin(this.heading), Math.cos(this.heading)]; };
  P.speedKmh = function () { return Math.abs(this.vF) * 3.6; };

  P.update = function (dt) {
    var c = this.controls, s = this.spec, T = this.telemetry, city = this.city;
    var want = TG.clamp(c.steer, -1, 1), rate = Math.abs(want) < Math.abs(this.steer) ? 7 : 4;
    this.steer += TG.clamp(want - this.steer, -rate * dt, rate * dt);
    this.brakeLevel = c.brake > 0 ? Math.min(1, this.brakeLevel + dt * 5) : 0;

    var fx = Math.sin(this.heading), fz = Math.cos(this.heading), rx = -fz, rz = fx;
    var vF = this.vx * fx + this.vz * fz, vL = this.vx * rx + this.vz * rz, vF0 = vF;
    var onRoad = city.onRoadAny(this.pos.x, this.pos.z);
    T.offroad = !onRoad;
    var surface = onRoad ? 1.0 : 0.72;

    // 경사(앞뒤 높이차)
    var hA = city.heightAt(this.pos.x + fx * 2, this.pos.z + fz * 2), hB = city.heightAt(this.pos.x - fx * 2, this.pos.z - fz * 2);
    var slope = (hA - hB) / 4; T.slope = slope;
    vF -= 9.81 * slope * 0.7 * dt;

    // 종방향: 가속 / 제동 / 후진
    var brk = c.brake * this.brakeLevel;
    var wantRev = c.reverse > 0;
    if (wantRev && vF < 0.6) {                       // 후진 버튼: 거의 정지면 즉시 후진
      vF = Math.max(-s.revMax, vF - 3.0 * dt); this.stopT = 1;
    } else if (brk > 0 || (wantRev && vF >= 0.6)) {
      var b = Math.max(brk, wantRev ? 1 : 0);
      if (vF > 0.25) { vF -= b * s.brake * surface * dt; this.stopT = 0; }
      else if (c.throttle === 0) {
        this.stopT += dt;                            // 정지 후 0.2초 더 누르면 후진(↓ 키·스틱 아래·브레이크 버튼 모두)
        if (this.stopT > 0.2 || vF < -0.1) vF = Math.max(-s.revMax, vF - 3.0 * dt); else vF = 0;
      } else vF = 0;
    } else if (c.throttle > 0) {
      this.stopT = 0;
      if (vF < -0.2) vF += s.brake * dt;
      else vF += c.throttle * s.accel * (1 - Math.max(0, vF) / s.maxSpeed) * surface * dt;
    } else this.stopT = 0;
    vF -= vF * (onRoad ? 0.025 : 0.9) * dt;
    if (Math.abs(vF) < 0.4 * dt + 0.02 && c.throttle === 0 && !wantRev) vF = 0; else vF -= Math.sign(vF) * 0.35 * dt;
    vF = TG.clamp(vF, -s.revMax, s.maxSpeed);
    this.gear = vF < -0.05 ? 'R' : 'D';

    // 조향 기하 → 요구 횡가속 → 그립 한계
    var delta = this.steer * s.steerMax / (1 + Math.abs(vF) / 20);
    var kappa = Math.tan(delta) / s.wheelbase, aDem = vF * vF * kappa, limit = s.latMax * surface, ratio = Math.abs(aDem) / limit;
    var yawRate, gripK = s.grip * surface;
    if (ratio <= 1) yawRate = vF * kappa;
    else { yawRate = vF * kappa / ratio; vL += Math.sign(kappa) * (Math.abs(aDem) - limit) * 0.5 * dt; gripK *= 0.35; }
    if (vF < 0) yawRate = -yawRate * 0.7;
    this.heading += yawRate * dt;
    vL *= Math.exp(-gripK * dt);

    var fx2 = Math.sin(this.heading), fz2 = Math.cos(this.heading), rx2 = -fz2, rz2 = fx2;
    this.vx = fx2 * vF + rx2 * vL; this.vz = fz2 * vF + rz2 * vL;
    var nx = this.pos.x + this.vx * dt, nz = this.pos.z + this.vz * dt;
    var fixed = city.collideCircle(nx, nz, this.radius);
    this.lastImpact = 0;
    if (fixed.x !== nx || fixed.z !== nz) {
      var pnx = fixed.x - nx, pnz = fixed.z - nz, pl = Math.hypot(pnx, pnz) || 1, nX = pnx / pl, nZ = pnz / pl, into = -(this.vx * nX + this.vz * nZ);
      if (into > 0) { this.vx += nX * into * 1.2; this.vz += nZ * into * 1.2; this.lastImpact = into; }
      vF = this.vx * fx2 + this.vz * fz2; vL = this.vx * rx2 + this.vz * rz2;
    }
    this.pos.x = fixed.x; this.pos.z = fixed.z;
    this.vF = vF; this.vL = vL;
    this.y = city.heightAt(this.pos.x, this.pos.z);

    T.speed = Math.abs(vF); T.aLong = (vF - vF0) / Math.max(dt, 1e-4); T.aLat = vF * yawRate; T.kappa = kappa; T.ratio = ratio;
    T.understeer = ratio > 1 && Math.abs(vF) > 3;
    T.skid = TG.clamp((ratio - 0.85) / 0.5, 0, 1);
    if (brk > 0.9 && vF > 6 && !onRoad) T.skid = Math.max(T.skid, 0.4);
    T.stopDist = vF > 0 ? vF * vF / (2 * s.brake) : 0; T.limit = limit;

    // 시각: 지형 기울기 + 동적 피치·롤
    var hL = city.heightAt(this.pos.x + rx2 * 0.9, this.pos.z + rz2 * 0.9), hR = city.heightAt(this.pos.x - rx2 * 0.9, this.pos.z - rz2 * 0.9);
    var groundPitch = -Math.atan2(hA - hB, 4), groundRoll = Math.atan2(hR - hL, 1.8);
    var pitchT = TG.clamp(-T.aLong * 0.012, -0.06, 0.07), rollT = TG.clamp(T.aLat * 0.012, -0.08, 0.08);
    this.pitch += (groundPitch + pitchT - this.pitch) * Math.min(1, dt * 8);
    this.roll += (groundRoll + rollT - this.roll) * Math.min(1, dt * 8);
    this.brakeLamp.visible = (c.brake > 0 || wantRev) && vF > 0.3;
    this.revLamp.visible = this.gear === 'R';
    if (this.view === 'cockpit') { this.clT += dt; if (this.clT > 0.1) { this.clT = 0; this.drawCluster(); } }
    var spin = vF * dt / 0.34;
    for (var i = 0; i < 4; i++) { this.wheels[i].rotation.x += spin; if (i < 2) this.wheels[i].rotation.y = delta; }
    if (this.siren) {
      this.sirenPhase += dt * 12;
      var ph = this.sirenPhase % 4, redOn = ph < 1 || (ph >= 2 && ph < 2.5), blueOn = (ph >= 1 && ph < 2) || ph >= 3;   // 더블 플래시 스트로브
      this.barR.material.color.setHex(redOn ? 0xff2a1a : 0x7a1010); this.barB.material.color.setHex(blueOn ? 0x3a78ff : 0x102270);
    } else if (this.sirenPhase !== 0) { this.sirenPhase = 0; this.barR.material.color.setHex(0x7a1010); this.barB.material.color.setHex(0x102270); }
    this.steer3d.rotation.z = -this.steer * 1.4;   // 핸들 회전(좌회전 +steer → 반시계)
    this.syncMesh();
  };
  P.syncMesh = function () { this.mesh.position.set(this.pos.x, this.y, this.pos.z); this.mesh.rotation.set(this.pitch, this.heading, this.roll); };
  P.setSiren = function (on) { this.siren = on; };
  // 시점: 'chase'(추적) | 'cockpit'(차내). 차내에서는 실내를 보이고, 차체 뒷면 컬링 덕에 앞유리·후드가 자연스럽게 보인다.
  // 거울 갱신: 프레임마다 하나씩 돌아가며(3프레임에 한 번씩) 그린다. 거울 면 자체는 그리는 동안 숨긴다.
  P.updateMirrors = function (renderer, scene) {
    if (!this.mirrorCams.length) return;
    var i = this.mirrorTick % this.mirrorCams.length; this.mirrorTick++;
    var cam = this.mirrorCams[i], rt = this.mirrorRTs[i];
    for (var k = 0; k < this.mirrorMeshes.length; k++) this.mirrorMeshes[k].visible = false;
    this.interior.visible = false; this.cluster.visible = false;
    var prevShadow = renderer.shadowMap.enabled; renderer.shadowMap.enabled = false;
    renderer.setRenderTarget(rt); renderer.render(scene, cam); renderer.setRenderTarget(null);
    renderer.shadowMap.enabled = prevShadow;
    this.interior.visible = true; this.cluster.visible = true;
    for (var m = 0; m < this.mirrorMeshes.length; m++) this.mirrorMeshes[m].visible = true;
  };
  P.setView = function (mode) {
    this.view = mode;
    this.interior.visible = mode === 'cockpit';
    this.cluster.visible = mode === 'cockpit';
    this.steer3d.visible = mode === 'cockpit';
    for (var i = 0; i < this.mirrorMeshes.length; i++) this.mirrorMeshes[i].visible = mode === 'cockpit';
    this.brakeLamp.visible = false; this.revLamp.visible = false;
    if (mode === 'cockpit') this.drawCluster();
  };
  // 계기판 그리기: 왼쪽 속도계(0~200, 바늘), 오른쪽 디지털 속도·기어·경광등·정지거리
  P.drawCluster = function () {
    var c = this.clCanvas, g = c.getContext('2d'), W = c.width, H = c.height, kmh = this.speedKmh(), T = this.telemetry;
    g.clearRect(0, 0, W, H);
    g.fillStyle = '#0b0e12'; g.fillRect(0, 0, W, H);
    // 속도계 다이얼
    var cx = 128, cy = 118, R = 92, a0 = Math.PI * 0.8, a1 = Math.PI * 2.2;
    g.lineWidth = 10; g.strokeStyle = '#2a3340'; g.beginPath(); g.arc(cx, cy, R, a0, a1); g.stroke();
    var frac = TG.clamp(kmh / 200, 0, 1);
    g.strokeStyle = kmh > 60 ? '#ff6a4d' : '#4d8dff'; g.beginPath(); g.arc(cx, cy, R, a0, a0 + (a1 - a0) * frac); g.stroke();
    g.fillStyle = '#c9d3dd'; g.font = 'bold 15px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (var k = 0; k <= 10; k++) {
      var a = a0 + (a1 - a0) * k / 10, tx = cx + Math.cos(a) * (R - 22), ty = cy + Math.sin(a) * (R - 22);
      g.fillText(String(k * 20), tx, ty);
      g.strokeStyle = '#8a95a3'; g.lineWidth = 2; g.beginPath(); g.moveTo(cx + Math.cos(a) * (R - 8), cy + Math.sin(a) * (R - 8)); g.lineTo(cx + Math.cos(a) * (R + 4), cy + Math.sin(a) * (R + 4)); g.stroke();
    }
    var na = a0 + (a1 - a0) * frac;
    g.strokeStyle = '#ff3b30'; g.lineWidth = 4; g.beginPath(); g.moveTo(cx - Math.cos(na) * 12, cy - Math.sin(na) * 12); g.lineTo(cx + Math.cos(na) * (R - 14), cy + Math.sin(na) * (R - 14)); g.stroke();
    g.fillStyle = '#e8edf2'; g.beginPath(); g.arc(cx, cy, 9, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#8a95a3'; g.font = '13px sans-serif'; g.fillText('km/h', cx, cy + 42);
    // 오른쪽 디지털 패널
    g.fillStyle = '#121820'; g.fillRect(262, 18, 234, 156);
    g.fillStyle = '#ffffff'; g.font = 'bold 72px sans-serif'; g.textAlign = 'right'; g.fillText(String(Math.round(kmh)), 440, 72);
    g.fillStyle = '#8a95a3'; g.font = '16px sans-serif'; g.textAlign = 'left'; g.fillText('km/h', 448, 82);
    g.fillStyle = this.gear === 'R' ? '#ff6a4d' : '#5ad37a'; g.font = 'bold 26px sans-serif'; g.fillText(this.gear === 'R' ? 'R 후진' : 'D', 276, 124);
    g.fillStyle = this.siren ? (Math.floor(this.sirenPhase) % 2 ? '#ff3b30' : '#2a60ff') : '#3a4048'; g.font = 'bold 18px sans-serif'; g.fillText(this.siren ? '● 경광등' : '○ 경광등', 276, 156);
    g.fillStyle = '#c9d3dd'; g.font = '16px sans-serif'; g.textAlign = 'right'; g.fillText('정지거리 ' + (T.stopDist < 0.5 ? '—' : Math.round(T.stopDist) + 'm'), 484, 156);
    g.fillStyle = '#ffcf3f'; g.font = 'bold 14px sans-serif'; g.textAlign = 'left'; g.fillText('SEOUL POLICE 112', 276, 22);
    this.clTex.needsUpdate = true;
  };
  // 운전석 눈 위치(월드). 차체의 헤딩·피치·롤을 그대로 따른다.
  P.eyeWorld = function (off) {
    var v = new THREE.Vector3(off.x, off.y, off.z);
    this.mesh.updateMatrixWorld();
    return this.mesh.localToWorld(v);
  };
  P.resync = function () { var fx = Math.sin(this.heading), fz = Math.cos(this.heading); this.vF = this.vx * fx + this.vz * fz; this.vL = this.vx * (-fz) + this.vz * fx; };
  P.teleport = function (x, z, heading) { this.pos.x = x; this.pos.z = z; this.heading = heading; this.vx = this.vz = this.vF = this.vL = 0; this.steer = 0; this.y = this.city.heightAt(x, z); this.syncMesh(); };
})();
