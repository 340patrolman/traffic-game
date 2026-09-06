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
    this.body = new THREE.Mesh(TG.vehmesh.build(type, 0xf6f7f9, true), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.42, metalness: 0.08 }));
    this.body.castShadow = true;
    var g = new THREE.Group(); g.rotation.order = 'YXZ'; g.add(this.body);
    var LAY = TG.vehmesh.layout(T); this.layout = LAY;
    // 차내 시점 실내(추적 시점에서는 숨김)
    this.interior = new THREE.Mesh(TG.vehmesh.interior(T), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0.02, color: 0x6a6f76 }));   // color 는 정점색에 곱해진다(실내는 햇빛 노출을 낮춰 어둡게)
    this.interior.visible = false; g.add(this.interior);
    // 디지털 계기판(캔버스 텍스처): 큰 속도 숫자·제한속도·기어·경광등·정지거리. 차내 시점에서만 갱신
    this.clCanvas = document.createElement('canvas'); this.clCanvas.width = 512; this.clCanvas.height = 192;
    this.clTex = new THREE.CanvasTexture(this.clCanvas);
    this.cluster = new THREE.Mesh(new THREE.PlaneGeometry(LAY.clusterW, LAY.clusterW * 192 / 512), new THREE.MeshBasicMaterial({ map: this.clTex }));
    this.cluster.position.set(LAY.wheel.x, LAY.clusterY, LAY.clusterZ - 0.002); this.cluster.rotation.y = Math.PI; this.cluster.visible = false;
    g.add(this.cluster); this.clT = 0;
    // 중앙 내비 태블릿: 미니맵 캔버스를 그대로 화면으로 쓴다(실시간 지도)
    var mm = document.getElementById('minimap');
    this.navTex = mm ? new THREE.CanvasTexture(mm) : null;
    this.nav = new THREE.Mesh(new THREE.PlaneGeometry(LAY.nav.w, LAY.nav.h), this.navTex ? new THREE.MeshBasicMaterial({ map: this.navTex }) : new THREE.MeshBasicMaterial({ color: 0x14324f }));
    this.nav.position.set(LAY.nav.x, LAY.nav.y, LAY.nav.z); this.nav.rotation.y = Math.PI; this.nav.visible = false; g.add(this.nav);
    // 조수석 쪽 단속 단말(MDT) 화면: 점수·단속·대상 상태
    this.mdtCanvas = document.createElement('canvas'); this.mdtCanvas.width = 320; this.mdtCanvas.height = 192;
    this.mdtTex = new THREE.CanvasTexture(this.mdtCanvas);
    this.mdt = new THREE.Mesh(new THREE.PlaneGeometry(LAY.mdt.w, LAY.mdt.h), new THREE.MeshBasicMaterial({ map: this.mdtTex }));
    this.mdt.position.set(LAY.mdt.x, LAY.mdt.y, LAY.mdt.z); this.mdt.rotation.y = Math.PI - 0.25; this.mdt.visible = false; g.add(this.mdt);
    this.mdtInfo = {}; this.drawCluster(); this.drawMDT();
    // 거울 3개(룸미러·좌우 사이드미러): 뒤를 보는 카메라를 작은 렌더타깃에 그려 거울 면에 붙인다. 차내 시점에서만 갱신.
    this.mirrorCams = []; this.mirrorMeshes = []; this.mirrorRTs = []; this.mirrorTick = 0;
    var mirrorDefs = [
      { w: 0.30, h: 0.075, pos: [LAY.roomMirror.x, LAY.roomMirror.y, LAY.roomMirror.z], look: [0, 0.10, -1], fov: 30, aspect: 4 },
      { w: 0.22, h: 0.13, pos: [LAY.sideMirror.x, LAY.sideMirror.y, LAY.sideMirror.z], look: [0.55, -0.05, -1], fov: 34, aspect: 1.7 },
      { w: 0.22, h: 0.13, pos: [-LAY.sideMirror.x, LAY.sideMirror.y, LAY.sideMirror.z], look: [-0.55, -0.05, -1], fov: 34, aspect: 1.7 },
    ];
    var frameMat = new THREE.MeshLambertMaterial({ color: 0x15171a }), houseMat = new THREE.MeshLambertMaterial({ color: 0xf1f3f5 });
    for (var mi = 0; mi < mirrorDefs.length; mi++) {
      var md = mirrorDefs[mi], rt = new THREE.WebGLRenderTarget(mi === 0 ? 320 : 192, mi === 0 ? 80 : 112);
      rt.texture.wrapS = THREE.RepeatWrapping; rt.texture.repeat.x = -1;   // 거울상: 좌우 반전
      var cam = new THREE.PerspectiveCamera(md.fov, md.aspect, 0.6, 450); cam.position.set(md.pos[0], md.pos[1], md.pos[2]);
      cam.lookAt(md.pos[0] + md.look[0], md.pos[1] + md.look[1], md.pos[2] + md.look[2]); g.add(cam);
      var mm2 = new THREE.Mesh(new THREE.PlaneGeometry(md.w, md.h), new THREE.MeshBasicMaterial({ map: rt.texture }));
      mm2.position.set(md.pos[0], md.pos[1], md.pos[2] - 0.02); mm2.rotation.y = Math.PI; mm2.visible = false;
      var frame = new THREE.Mesh(new THREE.BoxGeometry(md.w + 0.03, md.h + 0.03, 0.03), frameMat);
      frame.position.set(md.pos[0], md.pos[1], md.pos[2]); frame.visible = false;
      g.add(mm2); g.add(frame);
      if (mi > 0) { var house = new THREE.Mesh(new THREE.BoxGeometry(md.w + 0.05, md.h + 0.05, 0.12), houseMat); house.position.set(md.pos[0], md.pos[1], md.pos[2] + 0.07); house.visible = false; g.add(house); this.mirrorMeshes.push(house); }
      this.mirrorCams.push(cam); this.mirrorMeshes.push(mm2, frame); this.mirrorRTs.push(rt);
    }
    // 디지털 사이드미러 화면(A필러 안쪽): 세로 화면처럼 시야가 좁아도 양옆이 보인다. 같은 렌더타깃을 쓴다.
    for (var di = 1; di <= 2; di++) {
      var sgn = di === 1 ? 1 : -1, dm = new THREE.Mesh(new THREE.PlaneGeometry(0.20, 0.12), new THREE.MeshBasicMaterial({ map: this.mirrorRTs[di].texture }));
      dm.position.set(sgn * LAY.screen.x, LAY.screen.y, LAY.screen.z); dm.rotation.y = Math.PI + sgn * 0.30; dm.visible = false;
      var df = new THREE.Mesh(new THREE.BoxGeometry(0.23, 0.15, 0.02), frameMat);
      df.position.set(sgn * LAY.screen.x, LAY.screen.y, LAY.screen.z + 0.015); df.rotation.y = sgn * 0.30; df.visible = false;
      g.add(dm); g.add(df); this.mirrorMeshes.push(dm, df);
    }
    var roofY = TG.vehmesh.roofY(T), barY = roofY + 0.15, l = T.l, w = T.w, bz = -l * 0.04;
    // 경광등 바(참고 사진): 낮은 받침 + 적(우)·청(좌) LED 바 + 흰 중앙 모듈 + 앞쪽 카메라 돔. 사이렌 시 좌우 번갈아 스트로브.
    var barBase = new THREE.Mesh(new THREE.BoxGeometry(1.20, 0.05, 0.30), new THREE.MeshLambertMaterial({ color: 0x1a1e24 }));
    barBase.position.set(0, roofY + 0.085, bz); g.add(barBase);
    this.barR = new THREE.Mesh(new THREE.BoxGeometry(0.50, 0.13, 0.26), new THREE.MeshBasicMaterial({ color: 0x7a1010 }));
    this.barB = new THREE.Mesh(new THREE.BoxGeometry(0.50, 0.13, 0.26), new THREE.MeshBasicMaterial({ color: 0x102270 }));
    this.barR.position.set(-0.32, barY, bz); this.barB.position.set(0.32, barY, bz);
    var barW = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.24), new THREE.MeshBasicMaterial({ color: 0xe8edf2 }));
    barW.position.set(0, barY, bz);
    var barTop = new THREE.Mesh(new THREE.BoxGeometry(1.20, 0.02, 0.30), new THREE.MeshLambertMaterial({ color: 0x2b2f35 }));
    barTop.position.set(0, barY + 0.075, bz);
    var dome = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.11, 14), new THREE.MeshLambertMaterial({ color: 0xf1f3f5 }));
    dome.position.set(0, barY + 0.02, bz + 0.22);
    var lens = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.02, 10), new THREE.MeshBasicMaterial({ color: 0x0a0c10 }));
    lens.rotation.x = Math.PI / 2; lens.position.set(0, barY + 0.03, bz + 0.29);
    g.add(this.barR); g.add(this.barB); g.add(barW); g.add(barTop); g.add(dome); g.add(lens);
    // 핸들(순찰차 사진 참고): 가죽 림(아래가 살짝 평평), 3스포크(크롬 인서트), 둥근 에어백 패드 + 엠블럼, 컬럼 슈라우드. 로컬 z 축이 운전자 쪽, 조향 시 z 축으로 돈다
    this.steer3d = new THREE.Group();
    var rimMat = new THREE.MeshStandardMaterial({ color: 0x111417, roughness: 0.55, metalness: 0.05 }), spokeMat = new THREE.MeshStandardMaterial({ color: 0x1c2027, roughness: 0.5, metalness: 0.1 });
    var chromeMat = new THREE.MeshStandardMaterial({ color: 0xaeb4bb, roughness: 0.25, metalness: 0.6 });
    var rim = new THREE.Mesh(new THREE.TorusGeometry(0.185, 0.0215, 14, 48), rimMat); rim.scale.y = 0.96; this.steer3d.add(rim);
    var flat = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.036, 0.04), rimMat); flat.position.set(0, -0.176, 0); this.steer3d.add(flat);   // 아래 평평한 부분
    [[Math.PI, 0.17], [0, 0.17], [-Math.PI / 2, 0.16]].forEach(function (sp) {
      var a = sp[0], len = sp[1], s = new THREE.Mesh(new THREE.BoxGeometry(len, 0.048, 0.024), spokeMat);
      s.position.set(Math.cos(a) * (0.06 + len / 2), Math.sin(a) * (0.06 + len / 2), 0.004); s.rotation.z = a; this.steer3d.add(s);
      var ins = new THREE.Mesh(new THREE.BoxGeometry(len * 0.8, 0.012, 0.004), chromeMat); ins.position.set(Math.cos(a) * (0.06 + len / 2), Math.sin(a) * (0.06 + len / 2), 0.017); ins.rotation.z = a; this.steer3d.add(ins);
    }, this);
    var pad = new THREE.Mesh(new THREE.SphereGeometry(0.075, 20, 14), spokeMat); pad.scale.set(1.25, 0.95, 0.5); pad.position.z = 0.01; this.steer3d.add(pad);
    var hubEm = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.06), new THREE.MeshBasicMaterial({ map: TG.tex.emblem(), transparent: true })); hubEm.position.z = 0.049; this.steer3d.add(hubEm);
    var shroud = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.065, 0.12, 16), new THREE.MeshStandardMaterial({ color: 0x0f1216, roughness: 0.8 })); shroud.rotation.x = Math.PI / 2; shroud.position.z = -0.08; this.steer3d.add(shroud);
    // 운전자의 두 손(9시·3시): 림을 감싼 손가락(토러스 조각) + 손등(둥근 공) + 엄지, 남색 소매 + 형광 커프. 핸들과 함께 돈다
    var sleeveMat = new THREE.MeshStandardMaterial({ color: 0x2b3a55, roughness: 0.9 }), skinMat = new THREE.MeshStandardMaterial({ color: 0xe0b596, roughness: 0.75 }), cuffMat = new THREE.MeshStandardMaterial({ color: 0xd4ff3c, roughness: 0.9 });
    [-1, 1].forEach(function (hs) {
      var grip = new THREE.Mesh(new THREE.TorusGeometry(0.034, 0.016, 10, 16, Math.PI * 1.35), skinMat);
      grip.position.set(hs * 0.185, 0.012, 0.0); grip.rotation.y = Math.PI / 2; grip.rotation.z = hs > 0 ? -0.2 : Math.PI + 0.2; this.steer3d.add(grip);
      var palm = new THREE.Mesh(new THREE.SphereGeometry(0.046, 14, 10), skinMat); palm.scale.set(0.8, 0.85, 1.1); palm.position.set(hs * 0.205, -0.01, 0.045); this.steer3d.add(palm);
      var thumb = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.013, 0.05, 8), skinMat); thumb.position.set(hs * 0.16, 0.03, 0.03); thumb.rotation.z = hs * 0.9; this.steer3d.add(thumb);
      var sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.046, 0.052, 0.30, 12), sleeveMat); sleeve.position.set(hs * 0.215, -0.07, 0.20); sleeve.rotation.x = Math.PI / 2 - 0.45; this.steer3d.add(sleeve);
      var cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.049, 0.049, 0.035, 12), cuffMat); cuff.position.set(hs * 0.212, -0.015, 0.075); cuff.rotation.x = Math.PI / 2 - 0.45; this.steer3d.add(cuff);
    }, this);
    this.steer3d.position.set(LAY.wheel.x, LAY.wheel.y, LAY.wheel.z); this.steer3d.rotation.order = 'YXZ';
    this.steer3d.rotation.x = LAY.wheel.tilt; this.steer3d.visible = false; g.add(this.steer3d);
    // 앞유리: 옅은 청색 유리 + 위쪽 선팅 띠(차내 시점에서만)
    var wsDz = LAY.wsTop - LAY.wsBase, wsDy = LAY.wsTopY - LAY.wsBaseY, wsLen = Math.hypot(wsDz, wsDy), wsAng = Math.atan2(wsDy, -wsDz);
    var glassMat = new THREE.MeshBasicMaterial({ color: 0x9ec3e6, transparent: true, opacity: 0.09, depthWrite: false, side: THREE.DoubleSide });
    this.windshield = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.92, wsLen), glassMat);
    this.windshield.position.set(0, (LAY.wsBaseY + LAY.wsTopY) / 2, (LAY.wsBase + LAY.wsTop) / 2 - 0.02); this.windshield.rotation.x = -(Math.PI / 2 - wsAng); this.windshield.visible = false; g.add(this.windshield);
    var tint = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.92, wsLen * 0.16), new THREE.MeshBasicMaterial({ color: 0x1a2a44, transparent: true, opacity: 0.45, depthWrite: false, side: THREE.DoubleSide }));
    tint.position.set(0, wsLen * 0.42, 0.001); this.windshield.add(tint);
    this.mirrorMeshes.push(this.windshield);
    var pr = TG.vehmesh.profile(T), topR = pr.top(pr.zr), hy = Math.min(topR - 0.12, T.belt - 0.15);
    this.brakeLamp = new THREE.Mesh(new THREE.BoxGeometry(w * 0.86, 0.06, 0.05), new THREE.MeshBasicMaterial({ color: 0xff2a1a }));
    this.brakeLamp.position.set(0, hy, -l / 2 - 0.02); this.brakeLamp.visible = false; g.add(this.brakeLamp);
    this.revLamp = new THREE.Mesh(new THREE.BoxGeometry(w * 0.5, 0.06, 0.05), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    this.revLamp.position.set(0, hy - 0.12, -l / 2 - 0.02); this.revLamp.visible = false; g.add(this.revLamp);
    // 바퀴(앞바퀴 조향)
    this.wheels = [];
    var wgeo = TG.vehmesh.wheelGeo(T.wheelR, !!T.detail), wmat = new THREE.MeshLambertMaterial({ vertexColors: true });
    var pairs = [[-1, 1], [1, 1], [-1, -1], [1, -1]];
    for (var i = 0; i < 4; i++) { var wh = new THREE.Mesh(wgeo, wmat); wh.position.set(pairs[i][0] * (w / 2 - 0.07), T.wheelR, pairs[i][1] * l * 0.31); g.add(wh); this.wheels.push(wh); }
    // 도색 데칼(참고 사진 순찰차): 옆면 청색 스우시 띠 + 황색 테두리 + 앞문 엠블럼 + 뒷문 「경찰 POLICE」, 후드 청색 쐐기 + 엠블럼, 트렁크 「112」
    // +x 는 차 왼쪽(운전석). 왼쪽 데칼은 u 가 뒤→앞으로 가며 +z 로 진행, 오른쪽은 글자가 거꾸로 보이지 않게 flip 텍스처.
    var decalOpts = { transparent: true, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 };
    var decL = new THREE.Mesh(TG.vehmesh.sideDecal(T, 1), new THREE.MeshLambertMaterial(Object.assign({ map: TG.tex.liverySide(false) }, decalOpts)));
    var decR = new THREE.Mesh(TG.vehmesh.sideDecal(T, -1), new THREE.MeshLambertMaterial(Object.assign({ map: TG.tex.liverySide(true) }, decalOpts)));
    var decH = new THREE.Mesh(TG.vehmesh.hoodDecal(T), new THREE.MeshLambertMaterial(Object.assign({ map: TG.tex.liveryHood() }, decalOpts)));
    g.add(decL); g.add(decR); g.add(decH);
    var l112 = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.2), new THREE.MeshBasicMaterial({ map: TG.tex.label('112', '#1f4fa8'), transparent: true }));
    var trunkZ = -l * 0.42; l112.position.set(0, TG.vehmesh.hoodAt(T, trunkZ) + 0.012, trunkZ); l112.rotation.x = -Math.PI / 2; g.add(l112);
    this.mesh = g; scene.add(g); this.syncMesh();
  };

  P.forward = function () { return [Math.sin(this.heading), Math.cos(this.heading)]; };
  P.speedKmh = function () { return Math.abs(this.vF) * 3.6; };

  // 차선 유지 보조: 조향을 놓고 있으면 가장 가까운 차로 중앙·도로 방향으로 부드럽게 돌아간다.
  // 교차로 근처·도로 밖·후진·크게 벗어난 상태(갓길 정차 등)·운전자가 조향 중이면 개입하지 않는다. 일시정지 메뉴에서 끌 수 있다.
  P.laneAssist = function (want) {
    if (this.assist === false || Math.abs(want) > 0.12 || this.vF < 2) return 0;
    var city = this.city, cfg = this.cfg, fr = city.frameAt(this.pos.x, this.pos.z, this.heading);
    if (!fr.onRoad || fr.kind === 'off') return 0;
    var roadH, lat = fr.lateral, centers = [];
    if (fr.kind === 'grid') {
      if (city.nearIntersectionZone(this.pos.x, this.pos.z)) return 0;
      roadH = fr.dir * Math.PI / 2;
      for (var k = 0; k < fr.lanes; k++) centers.push(city.laneOff(fr.axis, fr.idx, k));
    } else {
      if (fr.tx === undefined) return 0;
      roadH = Math.atan2(fr.tx, fr.tz);
      centers = fr.oneLane ? [cfg.LANE_OFF] : cfg.HW_LANES.slice();
    }
    var best = centers[0];
    for (var i = 1; i < centers.length; i++) if (Math.abs(centers[i] - lat) < Math.abs(best - lat)) best = centers[i];
    var e = lat - best;                                   // + 이면 차로 중앙보다 오른쪽 → 왼쪽(heading +)으로
    if (Math.abs(e) > 3.2) return 0;
    var desired = roadH + Math.atan2(e, 14), dh = desired - this.heading;
    dh = Math.atan2(Math.sin(dh), Math.cos(dh));
    if (Math.abs(dh) > 0.9) return 0;
    var a = dh * 2.0 - (this.yawPrev || 0) * 0.6;
    return TG.clamp(a, -0.35, 0.35);
  };

  P.update = function (dt) {
    var c = this.controls, s = this.spec, T = this.telemetry, city = this.city;
    var want = TG.clamp(c.steer, -1, 1);
    want = TG.clamp(want + this.laneAssist(want), -1, 1);
    var rate = Math.abs(want) < Math.abs(this.steer) ? 6 : 3.2;   // 풀 조향까지 0.3초: 키를 톡 쳐도 확 꺾이지 않는다
    this.steer += TG.clamp(want - this.steer, -rate * dt, rate * dt);
    this.brakeLevel = c.brake > 0 ? Math.min(1, this.brakeLevel + dt * 5) : 0;

    var fx = Math.sin(this.heading), fz = Math.cos(this.heading), rx = -fz, rz = fx;
    var vF = this.vx * fx + this.vz * fz, vL = this.vx * rx + this.vz * rz, vF0 = vF;
    var onRoad = city.onRoadAny(this.pos.x, this.pos.z);
    T.offroad = !onRoad;
    var surface = (onRoad ? 1.0 : 0.72) * (this.surfaceFactor || 1);   // 날씨(비·눈) 그립 계수

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
        this.stopT += dt;                            // 정지하면 바로(0.08초) 후진 시작 — ↓ 키·스틱 아래 계속 누르기
        if (this.stopT > 0.08 || vF < -0.1) vF = Math.max(-s.revMax, vF - 3.0 * dt); else vF = 0;
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
    var delta = this.steer * s.steerMax / (1 + Math.abs(vF) / 14);   // 속도가 오르면 같은 조향에 덜 꺾인다(예민함 완화)
    var kappa = Math.tan(delta) / s.wheelbase, aDem = vF * vF * kappa, limit = s.latMax * surface, ratio = Math.abs(aDem) / limit;
    var yawRate, gripK = s.grip * surface;
    if (ratio <= 1) yawRate = vF * kappa;
    else { yawRate = vF * kappa / ratio; vL += Math.sign(kappa) * (Math.abs(aDem) - limit) * 0.35 * dt; gripK *= 0.45; }   // 한계 초과 시 미끄러짐을 조금 줄여 「단단한」 느낌
    // 오버스티어: 한계를 넘긴 상태에서 강한 제동·미끄러운 노면이면 뒤가 흐른다. 반대로 꺾으면(카운터 스티어) 빨리 잡힌다.
    T.oversteer = false;
    if (ratio > 1 && (brk > 0.5 || (this.surfaceFactor || 1) < 0.85) && Math.abs(vF) > 5) { T.oversteer = true; yawRate *= 1.35; if (Math.abs(this.steer) > 0.1 && Math.sign(this.steer) === -Math.sign(yawRate)) { yawRate *= 0.6; gripK *= 1.6; } }
    if (vF < 0) yawRate = -yawRate * 0.7;
    this.heading += yawRate * dt; this.yawPrev = yawRate;
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
    var prevShadow = renderer.shadowMap.enabled; renderer.shadowMap.enabled = false;
    renderer.setRenderTarget(rt); renderer.render(scene, cam); renderer.setRenderTarget(null);
    renderer.shadowMap.enabled = prevShadow;
    for (var m = 0; m < this.mirrorMeshes.length; m++) this.mirrorMeshes[m].visible = true;
  };
  P.setView = function (mode) {
    this.view = mode; var c = mode === 'cockpit';
    this.interior.visible = c; this.cluster.visible = c; this.nav.visible = c; this.mdt.visible = c; this.steer3d.visible = c;
    for (var i = 0; i < this.mirrorMeshes.length; i++) this.mirrorMeshes[i].visible = c;
    this.brakeLamp.visible = false; this.revLamp.visible = false;
    if (c) { this.drawCluster(); this.drawMDT(); }
  };
  // 디지털 계기판: 왼쪽 큰 속도 숫자 + 위쪽 속도 아크, 가운데 제한속도 표지, 오른쪽 기어·경광등·정지거리·남은 시간
  P.drawCluster = function () {
    var c = this.clCanvas, g = c.getContext('2d'), W = c.width, H = c.height, kmh = this.speedKmh(), T = this.telemetry, I = this.mdtInfo || {};
    g.clearRect(0, 0, W, H);
    g.fillStyle = '#080b10'; g.fillRect(0, 0, W, H);
    var grd = g.createLinearGradient(0, 0, 0, H); grd.addColorStop(0, 'rgba(40,70,120,0.35)'); grd.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = grd; g.fillRect(0, 0, W, 60);
    // 속도 아크(0~200)
    var frac = TG.clamp(kmh / 200, 0, 1);
    g.lineWidth = 8; g.lineCap = 'round'; g.strokeStyle = '#1e2733'; g.beginPath(); g.moveTo(28, 22); g.lineTo(W - 28, 22); g.stroke();
    g.strokeStyle = kmh > (I.limit || 60) + 10 ? '#ff5a3c' : '#4d9dff'; g.beginPath(); g.moveTo(28, 22); g.lineTo(28 + (W - 56) * frac, 22); g.stroke();
    // 속도 숫자
    g.fillStyle = '#ffffff'; g.font = 'bold 92px sans-serif'; g.textAlign = 'right'; g.textBaseline = 'alphabetic'; g.fillText(String(Math.round(kmh)), 196, 128);
    g.fillStyle = '#8a95a3'; g.font = '17px sans-serif'; g.textAlign = 'left'; g.fillText('km/h', 202, 128);
    g.fillStyle = this.gear === 'R' ? '#ff6a4d' : '#5ad37a'; g.font = 'bold 24px sans-serif'; g.fillText(this.gear === 'R' ? 'R 후진' : 'D', 36, 168);
    // 제한속도 표지
    if (I.limit && I.limit < 900) {
      g.beginPath(); g.arc(282, 112, 32, 0, Math.PI * 2); g.fillStyle = '#ffffff'; g.fill(); g.lineWidth = 7; g.strokeStyle = '#d0202a'; g.stroke();
      g.fillStyle = '#111'; g.font = 'bold 30px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(I.limit), 282, 113);
    }
    // 오른쪽 상태
    g.textAlign = 'left'; g.textBaseline = 'middle';
    g.fillStyle = this.siren ? (Math.floor(this.sirenPhase) % 2 ? '#ff3b30' : '#3a78ff') : '#3a4048'; g.font = 'bold 18px sans-serif'; g.fillText(this.siren ? '● 경광등 ON' : '○ 경광등', 336, 70);
    g.fillStyle = '#c9d3dd'; g.font = '16px sans-serif'; g.fillText('정지거리 ' + (T.stopDist < 0.5 ? '—' : Math.round(T.stopDist) + 'm'), 336, 100);
    g.fillText('안전거리 ' + (I.gap ? I.gap : '—'), 336, 126);
    g.fillStyle = '#ffcf3f'; g.font = 'bold 15px sans-serif'; g.fillText((I.section || '') , 336, 154);
    g.fillStyle = '#7e8896'; g.font = '13px sans-serif'; g.fillText('SEOUL POLICE 112', 336, 178);
    g.fillStyle = T.understeer ? '#ff5a3c' : '#2a3340'; g.font = 'bold 14px sans-serif'; g.textAlign = 'right'; g.fillText(T.understeer ? '! 한계' : '', 196, 168);
    this.clTex.needsUpdate = true;
    if (this.navTex) this.navTex.needsUpdate = true;
  };
  // 단속 단말(MDT): 점수·단속 건수·근무 시간·대상 상태·위반 의심
  P.drawMDT = function () {
    var c = this.mdtCanvas, g = c.getContext('2d'), W = c.width, H = c.height, I = this.mdtInfo || {};
    g.fillStyle = '#0d1626'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#1f4fa8'; g.fillRect(0, 0, W, 34);
    g.fillStyle = '#ffffff'; g.font = 'bold 17px sans-serif'; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText('서울경찰 · 교통단속 단말', 12, 17);
    g.fillStyle = '#9fc0ff'; g.font = '13px sans-serif'; g.textAlign = 'right'; g.fillText(I.time || '', W - 12, 17);
    function row(y, k, v, col) { g.textAlign = 'left'; g.fillStyle = '#8a95a3'; g.font = '14px sans-serif'; g.fillText(k, 14, y); g.textAlign = 'right'; g.fillStyle = col || '#e8edf2'; g.font = 'bold 18px sans-serif'; g.fillText(String(v), W - 14, y); }
    row(60, '점수', I.score !== undefined ? I.score : 0, '#ffcf3f');
    row(88, '단속 건수', (I.stops || 0) + '건');
    row(116, '위반 의심 차량', (I.suspects || 0) + '대', I.suspects ? '#ff8a5c' : '#e8edf2');
    row(144, '대상 상태', I.target || '대기', I.target ? '#5ad37a' : '#e8edf2');
    g.fillStyle = '#1c2a44'; g.fillRect(12, 160, W - 24, 22);
    g.fillStyle = '#cfe0ff'; g.font = '13px sans-serif'; g.textAlign = 'left'; g.fillText(I.hint || '차량·보행자를 터치하면 위반 확인', 18, 171);
    this.mdtTex.needsUpdate = true;
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
