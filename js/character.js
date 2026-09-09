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
  var C = { NAVY: 0x1e3763, NAVY2: 0x25417a, VEST: 0xe6ff4d, SILVER: 0xdfe6ea, SKIN: 0xf1c9a5, BLACK: 0x15171c, WHITE: 0xf7f7f7, GOLD: 0xd7ab2a, HAIR: 0x2a1c14, LIP: 0xc9776b, EYE: 0x1b1d22,
            CHEEK: 0xf49a9a, BATON: 0xe2342c, BATON2: 0x2a2e33, SHIRT_W: 0xf2f4f7, EPAU: 0x1b2c52,
            KID_SHIRT: 0xff6b6b, KID_PANTS: 0x2f5fd1, KID_CAP: 0xffd23f, KID_BAG: 0xe53935, KID_SHOE: 0xf4f4f4 };
  function mesh(gb, cast) { var m = new THREE.Mesh(gb.build(), mat); m.castShadow = cast !== false; return m; }
  function seg(r0, r1, len, color) { var gb = new TG.GeoBuilder(); gb.cylinder(0, -len, 0, r1, r0, len, 10, color, false); gb.sphere(0, 0, 0, r0 * 1.02, 8, 6, color); return gb; }   // 관절 위(0)에서 아래(-len)로
  // 얼굴: 눈·눈썹·입·귀. 앞 = +z
  function face(gb, y, r, skin, hair, kid) {
    gb.sphere(0, y, 0, r, 18, 12, skin, 1.08);
    var bw = kid ? 0.040 : 0.05, bh = kid ? 0.006 : 0.009;                                        // 어린이는 눈썹을 얇고 짧게
    gb.box(-0.046, y + (kid ? 0.062 : 0.055), r * 1.02, bw, bh, 0.015, hair, {}); gb.box(0.046, y + (kid ? 0.062 : 0.055), r * 1.02, bw, bh, 0.015, hair, {});
    gb.box(0, y - 0.008, r * 1.01, 0.022, 0.032, 0.022, skin, {});   // 코
    gb.box(-r * 0.98, y, 0, 0.025, 0.045, 0.03, skin, {}); gb.box(r * 0.98, y, 0, 0.025, 0.045, 0.03, skin, {});   // 귀
    var ch = kid ? 0.030 : 0.022;                                                                                   // 볼 홍조(친근한 인상)
    gb.box(-r * 0.52, y - 0.030, r * 0.94, ch, ch * 0.72, 0.008, C.CHEEK, {}); gb.box(r * 0.52, y - 0.030, r * 0.94, ch, ch * 0.72, 0.008, C.CHEEK, {});
    gb.sphere(0, y + 0.045, -r * 0.22, r * 0.99, 16, 8, hair, 0.80);            // 뒷머리(얼굴 앞으로 나오지 않게 뒤로 물린다)
    gb.box(0, y + 0.075, -r * 0.58, r * 1.82, r * 0.86, r * 0.86, hair, {});     // 뒤통수
    gb.box(0, y + r * 0.66, r * 0.26, r * 1.55, r * 0.34, r * 0.86, hair, {});   // 앞머리(이마 위 — 눈보다 위에만)
  }
  function build(kind, opts) {
    opts = opts || {};
    var kid = kind === 'kid', officer = kind === 'officer', civ = kind === 'civilian';
    var skin = opts.skin || C.SKIN, hair = opts.hair || C.HAIR;
    // 교통경찰 근무복: **상의 흰색 · 하의 남색**(지역경찰의 남색 상의와 다르다 — 소유자 정정)
    var shirt = officer ? C.SHIRT_W : kid ? C.KID_SHIRT : (opts.shirt || 0x3b6fd1), pants = officer ? C.NAVY : kid ? C.KID_PANTS : (opts.pants || 0x2b3140);
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
      tb.box(0, HIP + 0.615, 0, 0.30, 0.035, 0.235, C.EPAU, {});                                                                  // 남색 옷깃
      for (var ep = -1; ep <= 1; ep += 2) { tb.box(ep * 0.175, HIP + 0.625, 0, 0.10, 0.028, 0.13, C.EPAU, {}); tb.box(ep * 0.175, HIP + 0.641, 0.03, 0.05, 0.012, 0.02, C.GOLD, {}); }   // 견장(계급장)
      tb.box(-0.13, HIP + 0.46, 0.15, 0.05, 0.10, 0.03, C.BLACK, {});   // 무전기(가슴 왼쪽, 착용자 기준 오른쪽)
      tb.box(0.12, HIP + 0.52, 0.152, 0.06, 0.02, 0.005, C.GOLD, {});   // 명찰
    }
    if (kid) { tb.box(0, HIP + 0.36, -0.20, 0.30, 0.36, 0.14, C.KID_BAG, {}); tb.box(0, HIP + 0.36, -0.275, 0.24, 0.24, 0.02, 0xffd23f, {}); for (var s = -1; s <= 1; s += 2) tb.box(s * 0.10, HIP + 0.50, -0.08, 0.04, 0.24, 0.05, C.KID_BAG, {}); }   // 책가방·멜빵
    if (civ && opts.bag) tb.box(0.24, HIP + 0.20, 0, 0.09, 0.30, 0.22, 0x6d4f3a, {});
    var torso = mesh(tb); g.add(torso); R.parts.torso = torso;
    // 뒷면 「경찰 POLICE」 라벨(조끼)
    if (officer && TG.tex && TG.tex.label) {
      var lbTex = TG.tex.vestLabel ? TG.tex.vestLabel('교통경찰', 'POLICE') : TG.tex.label('POLICE', '#1e3763');
      var lb = new THREE.Mesh(new THREE.PlaneGeometry(0.30, 0.15), new THREE.MeshBasicMaterial({ map: lbTex, transparent: true }));
      lb.position.set(0, HIP + 0.44, -0.148); lb.rotation.y = Math.PI; g.add(lb);
      var lf = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.06), new THREE.MeshBasicMaterial({ map: TG.tex.label('교통', '#1e3763'), transparent: true }));
      lf.position.set(0.10, HIP + 0.42, 0.148); g.add(lf);
    }
    // ---- 목·머리(목 관절: 좌우 둘러보기) ----
    var neck = new THREE.Object3D(); neck.position.set(0, HIP + 0.63, 0); g.add(neck); R.joints.neck = neck;
    var hb = new TG.GeoBuilder(); hb.cylinder(0, 0, 0, 0.055, 0.06, 0.07, 8, skin, false);
    var HR = kid ? 0.168 : 0.12, HY = 0.07 + HR;   // 어린이는 머리를 크게(치비 비율) — 귀엽게 보인다
    face(hb, HY, HR, skin, hair, kid);
    if (officer) {   // 정모: 흰 덮개 + 남색 밴드 + 검정 챙 + 금색 표장
      hb.cylinder(0, HY + HR * 0.55, 0, HR * 1.13, HR * 1.06, 0.052, 16, C.GOLD, false);                       // 금색 밴드(실물)
      hb.cylinder(0, HY + HR * 0.55 - 0.004, 0, HR * 1.14, HR * 1.07, 0.012, 16, C.BLACK, false);                // 밴드 아래 검정 선
      hb.cylinder(0, HY + HR * 0.55 + 0.052, 0, HR * 1.06, HR * 1.14, 0.062, 16, C.WHITE, true);                 // 흰 덮개
      hb.box(0, HY + HR * 0.55 + 0.002, HR * 1.06, HR * 1.95, 0.02, HR * 0.95, C.BLACK, {});                     // 검정 챙
      hb.box(0, HY + HR * 0.55 + 0.026, HR * 1.10, 0.062, 0.042, 0.012, C.GOLD, {});                             // 참수리 표장(금색)
      hb.box(0, HY + HR * 0.55 + 0.048, HR * 1.10, 0.030, 0.020, 0.012, C.GOLD, {});
    } else if (kid) {   // 노란 안전 모자 + 모자 아래로 보이는 머리카락
      hb.sphere(0, HY + HR * 0.30, -HR * 0.06, HR * 1.02, 14, 8, hair, 0.62);
      hb.cylinder(0, HY + HR * 0.45, 0, HR * 1.12, HR * 1.03, 0.09, 16, C.KID_CAP, true);
      hb.box(0, HY + HR * 0.45 + 0.005, HR * 1.0, HR * 1.6, 0.018, HR * 0.8, C.KID_CAP, {});
    } else if (opts.helmet) {   // 이륜차·자전거·킥보드 탑승자 헬멧: 둥근 껍데기 + 바이저 + 턱끈
      hb.sphere(0, HY + 0.02, 0, HR * 1.16, 16, 10, opts.helmet === true ? 0xf2f2f2 : opts.helmet, 0.92);
      hb.box(0, HY + 0.01, HR * 1.02, HR * 1.5, HR * 0.7, 0.02, 0x121418, {});
      hb.box(0, HY - HR * 0.75, 0, HR * 1.1, 0.02, HR * 1.6, 0x2a2e33, {});
    } else if (opts.hat) { hb.cylinder(0, HY + HR * 0.5, 0, HR * 1.08, HR * 0.98, 0.08, 14, opts.hat, true); }
    var head = mesh(hb); neck.add(head); R.parts.head = head;
    // 눈·입은 따로(깜빡임·말할 때 움직임). 눈: 흰자 + 눈동자, 입: 살구색 선(웃으면 넓어진다)
    var ek = kid ? 1.72 : 1.05, eg = new TG.GeoBuilder();                                                        // 어린이 눈은 크고 동그랗게
    eg.box(0, 0, 0, 0.036 * ek, 0.03 * ek, 0.012, C.WHITE, {}); eg.box(0, 0, 0.008, 0.018 * ek, 0.022 * ek, 0.012, C.EYE, {});
    eg.box(0.004 * ek, 0.005 * ek, 0.016, 0.007 * ek, 0.007 * ek, 0.004, C.WHITE, {});
    var eyeGeo = eg.build(), eyes = [];
    // 눈은 머리 표면 **밖으로** 내밀어야 보인다(전에는 HR·0.9 로 구 안쪽에 박혀 얼굴이 없어 보였다)
    [-0.042 * (kid ? 1.18 : 1), 0.042 * (kid ? 1.18 : 1)].forEach(function (ex) { var e = new THREE.Mesh(eyeGeo, mat); e.position.set(ex, HY + (kid ? 0.012 : 0.02), HR * 1.05); neck.add(e); eyes.push(e); });
    var mg = new TG.GeoBuilder(); mg.box(0, 0, 0, kid ? 0.050 : 0.046, kid ? 0.016 : 0.012, 0.012, C.LIP, {}); mg.box(0, -0.002, 0.004, kid ? 0.034 : 0.03, 0.008, 0.006, 0x6b2a25, {});
    if (kid) { mg.box(-0.030, 0.008, 0.002, 0.014, 0.011, 0.010, C.LIP, {}); mg.box(0.030, 0.008, 0.002, 0.014, 0.011, 0.010, C.LIP, {}); }   // 입꼬리를 올려 웃는 입
    var mouth = new THREE.Mesh(mg.build(), mat); mouth.position.set(0, HY - (kid ? 0.055 : 0.05), HR * 1.03); neck.add(mouth);
    R.parts.eyes = eyes; R.parts.mouth = mouth; R.blinkT = 2 + Math.random() * 3; R.blink = 0; R.talkT = 0; R.smile = 0;
    // ---- 팔(어깨 → 위팔 → 팔꿈치 → 아래팔 → 손) ----
    var UA = kid ? 0.20 : 0.28, FA = kid ? 0.18 : 0.26;
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
    // 신호봉(적색 유도등) — 교통경찰의 상징. 왼손(차 국소 +x 쪽 팔)에 들고 수신호 때만 보인다.
    if (officer) {
      var bt = new TG.GeoBuilder();
      bt.cylinder(0, -0.06, 0, 0.014, 0.016, 0.10, 8, C.BATON2, false);                     // 손잡이
      bt.cylinder(0, 0.30, 0, 0.019, 0.019, 0.36, 10, C.BATON, false);                      // 적색 봉
      bt.sphere(0, 0.32, 0, 0.021, 8, 6, 0xff6a5e);
      var baton = new THREE.Mesh(bt.build(), mat);
      baton.position.set(0, -FA - 0.10, 0.02); baton.rotation.x = -0.35;
      baton.visible = false; aL.el.add(baton); R.parts.baton = baton;
    }
    // ---- 다리(엉덩이 → 허벅지 → 무릎 → 정강이 → 신발) ----
    var TH = kid ? 0.33 : 0.44, SH = kid ? 0.31 : 0.42;
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
    if (kid) g.scale.set(0.62, 0.62, 0.62);   // 머리를 크게 한 만큼 전체를 조금 줄여 아이 키를 유지한다
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
    if (R.parts.baton) R.parts.baton.visible = R.gestureAmt > 0.08 && ges !== 'operate';   // 신호봉은 수신호할 때만 든다(박스 조작 중에는 넣는다)
    var armSw = 0.5 * amp;
    // 왼팔(+x)
    // 팔은 반대쪽 다리와 함께(왼다리 앞 = 오른팔 앞). 왼다리는 sin(ph)>0 일 때 앞으로 나간다
    var lx = Math.sin(ph) * armSw, lel = -(0.32 + Math.max(0, -Math.sin(ph)) * 0.55 * amp), lz = 0.10 + 0.06 * amp;
    if (ges === 'stop') { lx = lerp(lx, -0.25, R.gestureAmt); lz = lerp(lz, 1.35, R.gestureAmt); lel = lerp(lel, -0.2, R.gestureAmt); J.elL.rotation.z = lerp(J.elL.rotation.z, 1.25 * R.gestureAmt, k); } else J.elL.rotation.z = lerp(J.elL.rotation.z, 0, k);
    J.shL.rotation.x = lerp(J.shL.rotation.x, lx, k); J.shL.rotation.z = lerp(J.shL.rotation.z, lz, k); J.elL.rotation.x = lerp(J.elL.rotation.x, lel, k);
    // 오른팔(−x): 손 들기 / 「가세요」 손짓 / 인사
    var rx = -Math.sin(ph) * armSw, rel = -(0.32 + Math.max(0, Math.sin(ph)) * 0.55 * amp), rz = -(0.10 + 0.06 * amp);
    if (hand) { rx = lerp(rx, -2.95, R.handAmt); rz = lerp(rz, -0.18, R.handAmt); rel = lerp(rel, -0.15, R.handAmt); }
    else if (ges === 'go') { var wv = Math.sin(R.t * 5) * 0.35; rx = lerp(rx, -1.35 + wv, R.gestureAmt); rel = lerp(rel, -0.5, R.gestureAmt); rz = lerp(rz, -0.25, R.gestureAmt); }
    else if (ges === 'wave') { var wv2 = Math.sin(R.t * 7) * 0.3; rx = lerp(rx, -2.6, R.gestureAmt); rel = lerp(rel, -0.6, R.gestureAmt); rz = lerp(rz, -0.35 + wv2, R.gestureAmt); }
    else if (ges === 'operate') {   // 신호기 박스 조작: 팔을 앞으로 들어 스위치를 만진다(작게 흔들려 손끝이 움직인다)
      var op = Math.sin(R.t * 3.1) * 0.10;
      rx = lerp(rx, -1.28 + op, R.gestureAmt); rel = lerp(rel, -0.95, R.gestureAmt); rz = lerp(rz, -0.42, R.gestureAmt);
    }
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
    // 표정: 눈 깜빡임(3~6초마다 0.12초), 말할 때 입 벌림(talking), 웃음(smile → 입 넓고 살짝 위로)
    if (R.parts.eyes) {
      R.blinkT -= dt; if (R.blinkT <= 0) { R.blinkT = 3 + Math.random() * 3; R.blink = 0.13; }
      var closed = R.blink > 0; if (closed) R.blink -= dt;
      for (var e = 0; e < 2; e++) R.parts.eyes[e].scale.y = closed ? 0.12 : 1;
      var talking = !!s.talking; R.talkT += dt * (talking ? 14 : 0);
      var open = talking ? 1 + Math.abs(Math.sin(R.talkT)) * 2.2 + Math.abs(Math.sin(R.talkT * 0.37)) * 0.8 : 1;
      R.smile = lerp(R.smile, s.smile ? 1 : 0, Math.min(1, dt * 4));
      R.parts.mouth.scale.set(1 + R.smile * 0.5, open, 1); R.parts.mouth.position.y = (R.parts.head.userData.my || (R.parts.head.userData.my = R.parts.mouth.position.y)) + R.smile * 0.012;
    }
  }
  // ---- 자율 배우(홍보 장면·어린이 교실 동행 경찰관): 목표점으로 걷고 바라보고 몸짓한다 ----
  function actor(scene, terrain, kind, x, z, h) {
    var rig = build(kind), a = { kind: kind, rig: rig, pos: { x: x, z: z }, heading: h || 0, v: 0, target: null, speed: kind === 'kid' ? 1.15 : 1.35, hand: 0, gesture: null, look: 0, lookScan: false, smile: false, len: 0.6, wid: 0.6, vF: 0, radius: 0.4, telemetry: { speed: 0 } };
    a.forward = function () { return [Math.sin(a.heading), Math.cos(a.heading)]; };
    a.goTo = function (tx, tz, spd) { a.target = { x: tx, z: tz }; if (spd) a.speed = spd; };
    a.face = function (hh) { a.faceTo = hh; };
    a.lookAtPos = function (p) { a.look = p ? TG.wrapAngle(Math.atan2(p.x - a.pos.x, p.z - a.pos.z) - a.heading) * 0.85 : 0; };
    a.update = function (dt, talking) {
      var want = 0;
      if (a.target) { var dx = a.target.x - a.pos.x, dz = a.target.z - a.pos.z, d = Math.hypot(dx, dz); if (d < 0.1) a.target = null; else { want = a.speed; var dh = TG.wrapAngle(Math.atan2(dx, dz) - a.heading); a.heading += dh * Math.min(1, dt * 8); } }
      else if (a.faceTo !== undefined) { var dh2 = TG.wrapAngle(a.faceTo - a.heading); a.heading += dh2 * Math.min(1, dt * 5); }
      a.v += (want - a.v) * Math.min(1, dt * 7); var f = a.forward(); a.pos.x += f[0] * a.v * dt; a.pos.z += f[1] * a.v * dt; a.vF = a.v; a.telemetry.speed = a.v;
      if (a.hand > 0) a.hand -= dt;
      rig.baseY = terrain ? terrain.heightAt(a.pos.x, a.pos.z) : 0; rig.group.position.x = a.pos.x; rig.group.position.z = a.pos.z; rig.group.rotation.y = a.heading;
      animate(rig, { speed: a.v, moving: a.v > 0.12, hand: a.hand, gesture: a.gesture, look: a.look, lookScan: a.lookScan, talking: talking, smile: a.smile }, dt);
    };
    a.dispose = function () { scene.remove(rig.group); };
    scene.add(rig.group); return a;
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
  // ---- 정지 자세(탑승자): 'ride' = 이륜차·자전거 착석(허벅지 앞·정강이 아래·상체 숙임·팔 핸들로), 'stand' = 킥보드 직립(무릎 살짝) ----
  function pose(rig, kind) {
    var J = rig.joints;
    if (kind === 'ride') {
      J.hpL.rotation.x = -1.00; J.hpR.rotation.x = -1.00; J.knL.rotation.x = 1.55; J.knR.rotation.x = 1.55;
      J.hpL.rotation.z = 0.42; J.hpR.rotation.z = -0.42;   // 탱크·프레임을 다리로 감싸도록 벌린다
      // 몸통 메시의 원점은 발끝(y=0)이라 rotation.x 를 크게 주면 상체가 꺾인다 — 상체는 세워 두고 목만 살짝 숙인다
      J.shL.rotation.x = -1.05; J.shR.rotation.x = -1.05; J.shL.rotation.z = 0.30; J.shR.rotation.z = -0.30;
      J.elL.rotation.x = -0.28; J.elR.rotation.x = -0.28;
      J.neck.rotation.x = 0.12;
    } else {
      J.hpL.rotation.x = -0.10; J.hpR.rotation.x = 0.06; J.knL.rotation.x = 0.16; J.knR.rotation.x = 0.12;
      J.shL.rotation.x = -1.15; J.shR.rotation.x = -1.15; J.shL.rotation.z = 0.24; J.shR.rotation.z = -0.24;
      J.elL.rotation.x = -0.22; J.elR.rotation.x = -0.22;
      J.neck.rotation.x = 0.06;
    }
    rig.frozen = true;
    return rig;
  }
  return { build: build, animate: animate, lite: lite, actor: actor, pose: pose, COLORS: C };
})();
