// 사람 캐릭터(교통경찰관 · 어린이 · 행인): 관절 리그 + 걷기/달리기/서기/손 들기/수신호 애니메이션. 파일 0개 — 전부 코드 지오메트리.
// 리그: 골반 → 몸통 → 목 → 머리(정모/모자), 어깨 → 위팔 → 팔꿈치 → 아래팔 → 손, 엉덩이 → 허벅지 → 무릎 → 정강이 → 신발.
// animate(state, dt): state = { speed, moving, hand(손 들기 남은 초), gesture('stop'|'go'|'wave'|null), look(머리 좌우 rad), run }
TG.GeoBuilder.prototype.sphere = function (cx, cy, cz, r, seg, rings, color, sy) {
  var col = [((color >> 16) & 255) / 255, ((color >> 8) & 255) / 255, (color & 255) / 255], base = this.n; sy = sy || 1;
  for (var j = 0; j <= rings; j++) {
    var v = j / rings, th = v * Math.PI, st = Math.sin(th), ct = Math.cos(th);
    for (var i = 0; i <= seg; i++) {
      var u = i / seg, ph = u * Math.PI * 2, nx = Math.cos(ph) * st, ny = ct, nz = Math.sin(ph) * st;
      this.pos.push(cx + nx * r, cy + ny * r * sy, cz + nz * r); this.nor.push(nx, ny, nz); this.uv.push(u, v); this.col.push(col[0], col[1], col[2]);
    }
  }
  for (var j2 = 0; j2 < rings; j2++) for (var i2 = 0; i2 < seg; i2++) {
    var a = base + j2 * (seg + 1) + i2, b = a + seg + 1;
    this.idx.push(a, a + 1, b, a + 1, b + 1, b);
  }
  this.n += (rings + 1) * (seg + 1);
};

TG.Character = (function () {
  var mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  var C = { NAVY: 0x1e3763, NAVY2: 0x25417a, VEST: 0xd7ff3a, SILVER: 0xe8e8e8, SKIN: 0xf1c9a5, BLACK: 0x15171c, WHITE: 0xf4f4f4, GOLD: 0xc9a227, HAIR: 0x2a1c14, LIP: 0xc9776b, EYE: 0x1b1d22,
            KID_SHIRT: 0xff6b6b, KID_PANTS: 0x2f5fd1, KID_CAP: 0xffd23f, KID_BAG: 0xe53935, KID_SHOE: 0xf4f4f4 };
  function mesh(gb, cast) { var m = new THREE.Mesh(gb.build(), mat); m.castShadow = cast !== false; return m; }
  function seg(r0, r1, len, color) { var gb = new TG.GeoBuilder(); gb.cylinder(0, -len, 0, r1, r0, len, 10, color, false); gb.sphere(0, 0, 0, r0 * 1.02, 8, 6, color); return gb; }   // 관절 위(0)에서 아래(-len)로
  // 얼굴: 눈·눈썹·입·귀. 앞 = +z
  function face(gb, y, r, skin, hair, kid) {
    gb.sphere(0, y, 0, r, 18, 12, skin, 1.08);
    gb.box(-0.04, y + 0.02, r * 0.86, 0.035, 0.028, 0.02, C.WHITE, {}); gb.box(0.04, y + 0.02, r * 0.86, 0.035, 0.028, 0.02, C.WHITE, {});
    gb.box(-0.04, y + 0.02, r * 0.9, 0.018, 0.02, 0.015, C.EYE, {}); gb.box(0.04, y + 0.02, r * 0.9, 0.018, 0.02, 0.015, C.EYE, {});
    gb.box(-0.045, y + 0.055, r * 0.86, 0.05, 0.008, 0.015, hair, {}); gb.box(0.045, y + 0.055, r * 0.86, 0.05, 0.008, 0.015, hair, {});   // 눈썹
    gb.box(0, y - 0.005, r * 0.95, 0.02, 0.03, 0.02, skin, {});   // 코
    gb.box(0, y - 0.05, r * 0.88, kid ? 0.035 : 0.045, 0.012, 0.012, C.LIP, {});   // 입
    gb.box(-r * 0.98, y, 0, 0.025, 0.045, 0.03, skin, {}); gb.box(r * 0.98, y, 0, 0.025, 0.045, 0.03, skin, {});   // 귀
    gb.sphere(0, y + 0.035, -0.01, r * 1.02, 16, 8, hair, 0.72);   // 머리카락(윗부분·뒤)
    gb.box(0, y + 0.06, -r * 0.55, r * 1.9, r * 0.9, r * 0.9, hair, {});
  }
  function build(kind, opts) {
    opts = opts || {};
    var kid = kind === 'kid', officer = kind === 'officer', civ = kind === 'civilian';
    var skin = opts.skin || C.SKIN, hair = opts.hair || C.HAIR;
    var shirt = officer ? C.NAVY : kid ? C.KID_SHIRT : (opts.shirt || 0x3b6fd1), pants = officer ? C.NAVY2 : kid ? C.KID_PANTS : (opts.pants || 0x2b3140);
    var shoe = kid ? C.KID_SHOE : (officer ? C.BLACK : (opts.shoe || 0x2a2a2a)), glove = officer ? C.WHITE : skin;
    var g = new THREE.Group(), R = { group: g, kind: kind, kid: kid, joints: {}, parts: {}, t: 0, ph: 0, lookNow: 0, glance: 0, glanceT: 2 + Math.random() * 3, gestureAmt: 0, handAmt: 0 };
    // ---- 골반·몸통(한 메시) ----
    var HIP = 0.92, tb = new TG.GeoBuilder();
    tb.box(0, HIP + 0.08, 0, 0.34, 0.17, 0.22, pants, {});
    tb.box(0, HIP + 0.26, 0, 0.34, 0.20, 0.22, shirt, {});
    tb.box(0, HIP + 0.48, 0, 0.40, 0.26, 0.245, shirt, {});
    tb.box(0, HIP + 0.60, 0, 0.44, 0.06, 0.24, shirt, {});   // 어깨선
    if (officer) {
      tb.box(0, HIP + 0.40, 0, 0.43, 0.38, 0.29, C.VEST, {}); tb.box(0, HIP + 0.50, 0, 0.44, 0.05, 0.30, C.SILVER, {}); tb.box(0, HIP + 0.30, 0, 0.44, 0.05, 0.30, C.SILVER, {});
      tb.box(0, HIP + 0.02, 0, 0.36, 0.06, 0.24, C.BLACK, {}); tb.box(0, HIP + 0.02, 0.125, 0.05, 0.05, 0.015, C.GOLD, {});   // 벨트·버클
      tb.box(-0.13, HIP + 0.46, 0.15, 0.05, 0.10, 0.03, C.BLACK, {});   // 무전기(가슴 왼쪽, 착용자 기준 오른쪽)
      tb.box(0.12, HIP + 0.52, 0.152, 0.06, 0.02, 0.005, C.GOLD, {});   // 명찰
    }
    if (kid) { tb.box(0, HIP + 0.36, -0.20, 0.30, 0.36, 0.14, C.KID_BAG, {}); tb.box(0, HIP + 0.36, -0.275, 0.24, 0.24, 0.02, 0xffd23f, {}); for (var s = -1; s <= 1; s += 2) tb.box(s * 0.10, HIP + 0.50, -0.08, 0.04, 0.24, 0.05, C.KID_BAG, {}); }   // 책가방·멜빵
    if (civ && opts.bag) tb.box(0.24, HIP + 0.20, 0, 0.09, 0.30, 0.22, 0x6d4f3a, {});
    var torso = mesh(tb); g.add(torso); R.parts.torso = torso;
    // 뒷면 「경찰 POLICE」 라벨(조끼)
    if (officer && TG.tex && TG.tex.label) {
      var lb = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.12), new THREE.MeshBasicMaterial({ map: TG.tex.label('POLICE', '#1e3763'), transparent: true }));
      lb.position.set(0, HIP + 0.44, -0.148); lb.rotation.y = Math.PI; g.add(lb);
      var lf = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.06), new THREE.MeshBasicMaterial({ map: TG.tex.label('교통', '#1e3763'), transparent: true }));
      lf.position.set(0.10, HIP + 0.42, 0.148); g.add(lf);
    }
    // ---- 목·머리(목 관절: 좌우 둘러보기) ----
    var neck = new THREE.Object3D(); neck.position.set(0, HIP + 0.63, 0); g.add(neck); R.joints.neck = neck;
    var hb = new TG.GeoBuilder(); hb.cylinder(0, 0, 0, 0.055, 0.06, 0.07, 8, skin, false);
    var HR = kid ? 0.135 : 0.12, HY = 0.07 + HR;
    face(hb, HY, HR, skin, hair, kid);
    if (officer) {   // 정모: 흰 덮개 + 남색 밴드 + 검정 챙 + 금색 표장
      hb.cylinder(0, HY + HR * 0.55, 0, HR * 1.12, HR * 1.05, 0.05, 16, C.NAVY, false);
      hb.cylinder(0, HY + HR * 0.55 + 0.05, 0, HR * 1.05, HR * 1.12, 0.06, 16, C.WHITE, true);
      hb.box(0, HY + HR * 0.55 + 0.005, HR * 1.05, HR * 1.9, 0.018, HR * 0.9, C.BLACK, {});
      hb.box(0, HY + HR * 0.55 + 0.08, HR * 1.09, 0.05, 0.05, 0.012, C.GOLD, {});
    } else if (kid) {   // 노란 안전 모자
      hb.cylinder(0, HY + HR * 0.45, 0, HR * 1.1, HR * 1.0, 0.09, 16, C.KID_CAP, true);
      hb.box(0, HY + HR * 0.45 + 0.005, HR * 1.0, HR * 1.6, 0.018, HR * 0.8, C.KID_CAP, {});
    } else if (opts.hat) { hb.cylinder(0, HY + HR * 0.5, 0, HR * 1.08, HR * 0.98, 0.08, 14, opts.hat, true); }
    var head = mesh(hb); neck.add(head); R.parts.head = head;
    // ---- 팔(어깨 → 위팔 → 팔꿈치 → 아래팔 → 손) ----
    var UA = kid ? 0.22 : 0.28, FA = kid ? 0.20 : 0.26;
    function arm(side) {
      var sh = new THREE.Object3D(); sh.position.set(side * 0.235, HIP + 0.58, 0); g.add(sh);
      var up = mesh(seg(0.056, 0.05, UA, shirt)); sh.add(up);
      var el = new THREE.Object3D(); el.position.set(0, -UA, 0); sh.add(el);
      var fo = mesh(seg(0.05, 0.043, FA, officer ? shirt : (kid ? skin : shirt))); el.add(fo);
      var hb2 = new TG.GeoBuilder(); hb2.box(0, -FA - 0.05, 0, 0.07, 0.09, 0.045, glove, {}); if (officer) hb2.box(0, -FA + 0.01, 0, 0.09, 0.05, 0.065, C.WHITE, {});   // 장갑·소매
      el.add(mesh(hb2));
      return { sh: sh, el: el };
    }
    var aL = arm(1), aR = arm(-1); R.joints.shL = aL.sh; R.joints.elL = aL.el; R.joints.shR = aR.sh; R.joints.elR = aR.el;
    // ---- 다리(엉덩이 → 허벅지 → 무릎 → 정강이 → 신발) ----
    var TH = kid ? 0.36 : 0.44, SH = kid ? 0.34 : 0.42;
    function leg(side) {
      var hp = new THREE.Object3D(); hp.position.set(side * 0.105, HIP, 0); g.add(hp);
      hp.add(mesh(seg(0.085, 0.072, TH, pants)));
      var kn = new THREE.Object3D(); kn.position.set(0, -TH, 0); hp.add(kn);
      var lo = new TG.GeoBuilder(); lo.cylinder(0, -SH, 0, 0.062, 0.07, SH, 10, pants, false); lo.sphere(0, 0, 0, 0.072, 8, 6, pants);
      lo.box(0, -SH - 0.035, 0.03, 0.11, 0.07, 0.27, shoe, {}); lo.box(0, -SH - 0.06, 0.05, 0.112, 0.02, 0.275, kid ? 0xdddddd : 0x111111, {});
      kn.add(mesh(lo));
      return { hp: hp, kn: kn };
    }
    var lL = leg(1), lR = leg(-1); R.joints.hpL = lL.hp; R.joints.knL = lL.kn; R.joints.hpR = lR.hp; R.joints.knR = lR.kn;
    R.height = HIP + 0.63 + 0.07 + HR * 2.2;
    if (kid) g.scale.set(0.66, 0.66, 0.66);
    R.hipY = HIP; R.torsoY = HIP + 0.4;
    return R;
  }
  function lerp(a, b, k) { return a + (b - a) * k; }
  // ---- 애니메이션 ----
  function animate(R, s, dt) {
    var J = R.joints, sp = s.speed || 0, run = sp > 2.4, amp = TG.clamp(sp / 1.5, 0, 1.35);
    R.t += dt;
    if (s.moving) R.ph += dt * sp * 4.6; else { var k0 = R.ph % (Math.PI * 2); if (k0 > 0.05) R.ph += dt * 6; }   // 멈추면 발을 모은다
    var ph = R.ph, k = Math.min(1, dt * 10);
    var sw = Math.sin(ph) * (0.42 + 0.1 * amp) * amp;
    // 다리: 앞으로 흔들 때(−) 무릎은 지나갈 때 굽힌다. 뒤로 찰 때 살짝 굽힘
    function legPose(hp, kn, p) { var swing = -Math.sin(p) * (0.45 + 0.15 * (run ? 1 : 0)) * amp, bend = Math.max(0, Math.cos(p)) * (0.9 + 0.5 * (run ? 1 : 0)) * amp + Math.max(0, -Math.sin(p)) * 0.15 * amp; hp.rotation.x = lerp(hp.rotation.x, swing, k); kn.rotation.x = lerp(kn.rotation.x, bend, k); }
    legPose(J.hpL, J.knL, ph); legPose(J.hpR, J.knR, ph + Math.PI);
    // 팔: 반대쪽 다리와 함께. 팔꿈치는 항상 약간 굽고, 앞으로 갈 때 더 굽는다
    var hand = s.hand > 0, ges = s.gesture || null;
    R.handAmt = lerp(R.handAmt, hand ? 1 : 0, Math.min(1, dt * 7)); R.gestureAmt = lerp(R.gestureAmt, ges ? 1 : 0, Math.min(1, dt * 6));
    var armSw = 0.5 * amp;
    // 왼팔(+x)
    var lx = Math.sin(ph + Math.PI) * armSw, lel = -(0.32 + Math.max(0, Math.sin(ph + Math.PI)) * 0.55 * amp), lz = 0.10 + 0.06 * amp;
    if (ges === 'stop') { lx = lerp(lx, -0.25, R.gestureAmt); lz = lerp(lz, 1.35, R.gestureAmt); lel = lerp(lel, -0.2, R.gestureAmt); J.elL.rotation.z = lerp(J.elL.rotation.z, 1.25 * R.gestureAmt, k); } else J.elL.rotation.z = lerp(J.elL.rotation.z, 0, k);
    J.shL.rotation.x = lerp(J.shL.rotation.x, lx, k); J.shL.rotation.z = lerp(J.shL.rotation.z, lz, k); J.elL.rotation.x = lerp(J.elL.rotation.x, lel, k);
    // 오른팔(−x): 손 들기 / 「가세요」 손짓 / 인사
    var rx = Math.sin(ph) * armSw, rel = -(0.32 + Math.max(0, Math.sin(ph)) * 0.55 * amp), rz = -(0.10 + 0.06 * amp);
    if (hand) { rx = lerp(rx, -2.95, R.handAmt); rz = lerp(rz, -0.18, R.handAmt); rel = lerp(rel, -0.15, R.handAmt); }
    else if (ges === 'go') { var wv = Math.sin(R.t * 5) * 0.35; rx = lerp(rx, -1.35 + wv, R.gestureAmt); rel = lerp(rel, -0.5, R.gestureAmt); rz = lerp(rz, -0.25, R.gestureAmt); }
    else if (ges === 'wave') { var wv2 = Math.sin(R.t * 7) * 0.3; rx = lerp(rx, -2.6, R.gestureAmt); rel = lerp(rel, -0.6, R.gestureAmt); rz = lerp(rz, -0.35 + wv2, R.gestureAmt); }
    J.shR.rotation.x = lerp(J.shR.rotation.x, rx, k); J.shR.rotation.z = lerp(J.shR.rotation.z, rz, k); J.elR.rotation.x = lerp(J.elR.rotation.x, rel, k);
    // 몸통: 위아래 흔들림·좌우 기울기·달릴 때 앞으로 숙임·숨쉬기
    var bob = Math.abs(Math.cos(ph)) * 0.035 * amp, breathe = (1 - Math.min(1, amp)) * Math.sin(R.t * 1.6) * 0.008;
    R.group.position.y = (R.baseY || 0) + bob + breathe;
    R.parts.torso.rotation.z = lerp(R.parts.torso.rotation.z, Math.sin(ph) * 0.035 * amp, k);
    R.parts.torso.rotation.x = lerp(R.parts.torso.rotation.x, run ? -0.1 : -0.02 * amp, k);
    R.parts.torso.rotation.y = lerp(R.parts.torso.rotation.y, -Math.sin(ph) * 0.05 * amp, k);
    // 머리: 시선(look) + 가끔 두리번, 걷는 리듬에 살짝
    R.glanceT -= dt; if (R.glanceT <= 0) { R.glanceT = 2.5 + Math.random() * 4; R.glance = (Math.random() - 0.5) * (s.moving ? 0.5 : 1.1); }
    var lookT = TG.clamp((s.look || 0) + R.glance * (s.lookScan ? 1.6 : 1), -1.3, 1.3);
    R.lookNow = lerp(R.lookNow, lookT, Math.min(1, dt * 3.5));
    J.neck.rotation.y = R.lookNow; J.neck.rotation.x = Math.cos(ph) * 0.03 * amp + (run ? 0.05 : 0); J.neck.rotation.z = -R.parts.torso.rotation.z * 0.6;
  }
  // ---- 행인용 경량 캐릭터(메시 5개: 몸통+머리, 팔 2, 다리 2 — 폰 성능): 얼굴·머리카락·신발·가방은 같은 품질, 관절은 어깨·엉덩이만 ----
  var liteCache = {};
  function lite(opts) {
    opts = opts || {}; var key = [opts.shirt, opts.pants, opts.skin, opts.hair, opts.bag ? 1 : 0, opts.hat || 0, opts.female ? 1 : 0].join(':');
    var geo = liteCache[key];
    if (!geo) {
      var skin = opts.skin || C.SKIN, hair = opts.hair || C.HAIR, shirt = opts.shirt || 0x3b6fd1, pants = opts.pants || 0x2b3140, HIP = 0.92;
      var tb = new TG.GeoBuilder();
      tb.box(0, HIP + 0.08, 0, 0.34, 0.17, 0.22, pants, {}); tb.box(0, HIP + 0.26, 0, 0.34, 0.20, 0.22, shirt, {}); tb.box(0, HIP + 0.48, 0, 0.40, 0.26, 0.245, shirt, {}); tb.box(0, HIP + 0.60, 0, 0.44, 0.06, 0.24, shirt, {});
      if (opts.female) tb.box(0, HIP + 0.02, 0, 0.36, 0.14, 0.24, pants, {});   // 치마
      if (opts.bag) tb.box(0.24, HIP + 0.20, 0, 0.09, 0.30, 0.22, 0x6d4f3a, {});
      tb.cylinder(0, HIP + 0.63, 0, 0.055, 0.06, 0.07, 8, skin, false);
      var HR = 0.12, HY = HIP + 0.63 + 0.07 + HR; face(tb, HY, HR, skin, hair, false);
      if (opts.female) tb.box(0, HY - 0.02, -HR * 0.8, HR * 1.7, HR * 1.6, HR * 0.8, hair, {});   // 긴 머리
      if (opts.hat) { tb.cylinder(0, HY + HR * 0.5, 0, HR * 1.08, HR * 0.98, 0.08, 14, opts.hat, true); tb.box(0, HY + HR * 0.5, HR * 1.0, HR * 1.6, 0.015, HR * 0.8, opts.hat, {}); }
      var ag = new TG.GeoBuilder(); ag.cylinder(0, -0.28, 0, 0.05, 0.056, 0.28, 8, shirt, false); ag.sphere(0, 0, 0, 0.057, 8, 6, shirt); ag.cylinder(0, -0.54, 0, 0.043, 0.05, 0.26, 8, skin, false); ag.box(0, -0.59, 0.02, 0.07, 0.09, 0.045, skin, {});
      var lg = new TG.GeoBuilder(); lg.cylinder(0, -0.44, 0, 0.072, 0.085, 0.44, 8, pants, false); lg.sphere(0, 0, 0, 0.086, 8, 6, pants); lg.cylinder(0, -0.86, 0, 0.062, 0.07, 0.42, 8, pants, false); lg.box(0, -0.895, 0.03, 0.11, 0.07, 0.27, opts.shoe || 0x2a2a2a, {});
      geo = liteCache[key] = { torso: tb.build(), arm: ag.build(), leg: lg.build() };
    }
    var g = new THREE.Group(), torso = new THREE.Mesh(geo.torso, mat); torso.castShadow = true; g.add(torso);
    var legL = new THREE.Mesh(geo.leg, mat), legR = new THREE.Mesh(geo.leg, mat), armL = new THREE.Mesh(geo.arm, mat), armR = new THREE.Mesh(geo.arm, mat);
    legL.position.set(0.105, 0.92, 0); legR.position.set(-0.105, 0.92, 0); armL.position.set(0.235, 1.50, 0); armR.position.set(-0.235, 1.50, 0);
    armL.rotation.z = 0.12; armR.rotation.z = -0.12;
    g.add(legL); g.add(legR); g.add(armL); g.add(armR);
    return { group: g, limbs: [legL, legR, armL, armR] };
  }
  return { build: build, animate: animate, lite: lite, COLORS: C };
})();
