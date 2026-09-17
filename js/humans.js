// 사람 모델(외부 CC0 에셋) — 한 곳에서 읽고, 없거나 실패하면 코드 리그(character.js)로 물러선다.
//
// 규칙(CLAUDE.md 「절충 — 사람 모델만, 파일 안에 심기」 2026-09-17)
//  · 모델은 js/humans-data.js 에 base64 로 심는다 → 네트워크 요청 0 · file:// 실행 그대로.
//  · 로더는 three.js 같은 판(r128)의 lib/GLTFLoader.js 하나. 동작 클립은 없으므로 **코드 리그를 조종간으로 둔다** —
//    character.js 의 animate()·pose() 가 만든 관절 회전을 매 프레임 뼈로 옮긴다(retarget). 걷기·손 들기·수신호·자전거 자세가 그대로 산다.
//  · 준비가 안 됐거나(?humans=0 · 데이터 없음 · 해석 실패) 모르는 사람 종류면 **지금까지의 코드 리그가 그대로 보인다**.
//
// 지금 입힌 사람: **임시안**(ref/assets_raw/CHARACTER_ART_PIPELINE.md 6·7절) — 교통경찰(v3 스킨 + 코드 정모·신호봉) · 어린이(prototype-v3).
//  Kenney 메시 + 새 얼굴 스킨 + 뼈 비율 + 코드 머리 부품. 전용 모델(파이프라인 1절 결정 대기)이 나오면 이 표만 바꾼다.
//  행인·청소년·영유아는 아직 코드 리그다.
TG.Humans = (function () {
  var S = { ready: false, failed: false, reason: '', proto: null, restModel: {}, mats: {}, measure: {}, count: 0 };
  // 사람 종류별 프리셋. height = 부품을 뺀 키(m, 월드). head·leg = 뼈 배율(머리 크기·다리 길이로 나이를 구분한다 — 파이프라인 2절)
  var KIND = {
    officer: { skin: 'police_m', height: 1.76, head: 0.80, leg: 1.14, hat: 'police', baton: true },
    // 어린이 = prototype-v3(파이프라인 7절): 바가지 머리·삐친 머리 · 노란 목 스카프 · 파란 반팔·검정 반바지·흰 양말·빨간 운동화(스킨)
    kid:     { skin: 'kid',      height: 1.20, head: 1.45, leg: 0.86, chest: 1.08, hips: 1.06, arm: 0.90, acc: ['bowl', 'scarf'] }
  };
  // 👮 내 경찰관 변형(소유자: 「내가 준비한 것에 바리에이션만」) — 같은 모델·같은 스킨에 **체형과 선글라스만** 바꾼다.
  //  이름: officer_<체형>[_sh]. 새 그림·새 모델은 들여오지 않는다(파이프라인 1절 결정 전).
  var BUILDS = {
    std:    { name: '보통',   over: {} },
    tall:   { name: '큰 키',   over: { height: 1.86, leg: 1.20, chest: 1.04 } },
    short:  { name: '작은 키', over: { height: 1.68, head: 0.84, leg: 1.08 } },
    sturdy: { name: '다부진',  over: { height: 1.78, chest: 1.16, hips: 1.10, arm: 1.05 } }
  };
  Object.keys(BUILDS).forEach(function (b) {
    [false, true].forEach(function (sh) {
      var k = 'officer' + (b === 'std' ? '' : '_' + b) + (sh ? '_sh' : ''); if (KIND[k]) return;
      var P = {}; Object.keys(KIND.officer).forEach(function (x) { P[x] = KIND.officer[x]; });
      Object.keys(BUILDS[b].over).forEach(function (x) { P[x] = BUILDS[b].over[x]; });
      if (sh) P.acc = ['shades'];
      KIND[k] = P;
    });
  });
  function avatarKind(av) { av = av || TG.save.get('avatar', null) || {}; var b = BUILDS[av.build] ? av.build : 'std'; return 'officer' + (b === 'std' ? '' : '_' + b) + (av.shades ? '_sh' : ''); }
  // 코드 리그 관절 → 모델 뼈. 팔은 모델 공간에서 T포즈 → 차렷 보정(왼팔 +x → 아래, 오른팔 −x → 아래)
  var MAP = {
    Spine: 'torso', Neck: 'neck',
    LeftArm: 'shL', LeftForeArm: 'elL', RightArm: 'shR', RightForeArm: 'elR',
    LeftUpLeg: 'hpL', LeftLeg: 'knL', RightUpLeg: 'hpR', RightLeg: 'knR'
  };
  var Z = new THREE.Vector3(0, 0, 1);
  var A_L = new THREE.Quaternion().setFromAxisAngle(Z, -Math.PI / 2), A_R = new THREE.Quaternion().setFromAxisAngle(Z, Math.PI / 2);
  var ALIGN = { LeftArm: A_L, LeftForeArm: A_L, RightArm: A_R, RightForeArm: A_R };

  function enabled() {
    try { return !/[?&]humans=0\b/.test(location.search); } catch (e) { return true; }
  }
  function b64buf(s) {
    var bin = atob(s), n = bin.length, u = new Uint8Array(n);
    for (var i = 0; i < n; i++) u[i] = bin.charCodeAt(i);
    return u.buffer;
  }
  function fail(why) { S.failed = true; S.reason = why; if (window.console) console.warn('[TG] 사람 모델 사용 안 함 — ' + why + ' (코드 리그로 그린다)'); }

  function load() {
    if (!enabled()) return fail('?humans=0');
    var D = TG.HUMAN_DATA;
    if (!D || !D.male) return fail('데이터 없음');
    if (!THREE.GLTFLoader) return fail('GLTFLoader 없음');
    try {
      new THREE.GLTFLoader().parse(b64buf(D.male), '', function (g) {
        var sc = g.scene, sm = null;
        sc.traverse(function (o) { if (o.isSkinnedMesh) sm = o; });
        if (!sm) return fail('스킨 메시 없음');
        sc.updateMatrixWorld(true);
        var p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
        sc.traverse(function (o) { if (o.isBone) { o.matrixWorld.decompose(p, q, s); S.restModel[o.name] = { q: q.clone(), p: p.clone(), s: s.x }; } });
        S.proto = sc; S.ready = true;
        for (var k in KIND) { material(KIND[k].skin); measure(k); }   // 스킨을 미리 풀어 둔다(첫 화면이 검게 나오지 않게)
        if (window.console) console.log('[TG] 사람 모델 준비 — 뼈 ' + sm.skeleton.bones.length + ' · 정점 ' + sm.geometry.attributes.position.count + ' · 종류 ' + Object.keys(KIND).join(','));
      }, function (e) { fail('해석 실패 ' + (e && e.message || e)); });
    } catch (e) { fail('해석 예외 ' + e.message); }
  }

  function material(skin) {
    if (S.mats[skin]) return S.mats[skin];
    var src = TG.HUMAN_DATA.skins && TG.HUMAN_DATA.skins[skin];
    var m = new THREE.MeshLambertMaterial({ skinning: true, side: THREE.DoubleSide });
    if (src) {
      var tex = new THREE.TextureLoader().load(src);   // data: URI — 요청 없음
      tex.flipY = false; tex.encoding = THREE.sRGBEncoding; tex.anisotropy = 4;
      m.map = tex;
    } else m.color.setHex(0xcccccc);
    S.mats[skin] = m;
    return m;
  }

  // 스킨 메시 복제: 뼈를 새로 묶어야 서로 따로 움직인다(SkeletonUtils.clone 과 같은 일)
  function cloneRig(src) {
    var root = src.clone(true), dst = {}, srcMeshes = [], dstMeshes = [];
    root.traverse(function (o) { if (o.isBone) dst[o.name] = o; if (o.isSkinnedMesh) dstMeshes.push(o); });
    src.traverse(function (o) { if (o.isSkinnedMesh) srcMeshes.push(o); });
    dstMeshes.forEach(function (m, i) {
      var s = srcMeshes[i];
      m.bind(new THREE.Skeleton(s.skeleton.bones.map(function (b) { return dst[b.name]; }), s.skeleton.boneInverses), s.bindMatrix);
    });
    return { root: root, bones: dst, mesh: dstMeshes[0] };
  }
  // 뼈 비율(머리 크기·다리 길이). 배율만 바꾼다 — 회전 옮기기(sync)와 섞이지 않는다
  function proportion(bones, P) {
    if (P.head && bones.Head) bones.Head.scale.multiplyScalar(P.head);
    if (P.leg) ['LeftUpLeg', 'RightUpLeg'].forEach(function (n) { if (bones[n]) bones[n].scale.y *= P.leg; });
    if (P.chest && bones.Chest) { bones.Chest.scale.x *= P.chest; bones.Chest.scale.z *= P.chest; }
    if (P.hips && bones.Hips) { bones.Hips.scale.x *= P.hips; bones.Hips.scale.z *= P.hips; }
    if (P.arm) ['LeftArm', 'RightArm'].forEach(function (n) { if (bones[n]) bones[n].scale.multiplyScalar(P.arm); });
  }
  // 단색 부품 재질 — **sRGB → 선형 변환 필수**(안 하면 검정 머리가 회색으로 뜬다 · 파이프라인 7절)
  var lams = {};
  function lam(hex) { if (!lams[hex]) { lams[hex] = new THREE.MeshLambertMaterial({ color: hex }); lams[hex].color.convertSRGBToLinear(); } return lams[hex]; }
  // 부품(prototype-v3 proto.html 과 같은 모양): 모델 공간에서 만들고 뼈 기준 로컬 행렬로 적어 둔다
  function accParts(list, B, HB) {
    var out = [], hp = new THREE.Vector3(), he = new THREE.Vector3();
    B.Head.getWorldPosition(hp); B.Head_end.getWorldPosition(he);
    var center = hp.clone().lerp(he, 0.5), R = hp.distanceTo(he) * 0.5, inv = new THREE.Matrix4(), tmp = new THREE.Object3D();
    function off(x, y, z) { return center.clone().add(new THREE.Vector3(x * R, y * R, z * R)); }
    function add(tag, geo, hex, pos, rot, scl, boneName) {
      var bone = B[boneName || 'Head'];
      tmp.position.copy(pos); tmp.rotation.set(rot ? rot[0] : 0, rot ? rot[1] : 0, rot ? rot[2] : 0); tmp.scale.set(scl ? scl[0] : 1, scl ? scl[1] : 1, scl ? scl[2] : 1); tmp.updateMatrix();
      out.push({ tag: tag, bone: boneName || 'Head', geo: geo, mat: lam(hex), local: inv.copy(bone.matrixWorld).invert().clone().multiply(tmp.matrix) });
    }
    list.forEach(function (a) {
      if (a === 'bowl') {   // 바가지 머리: 윗머리(적도 = 눈썹선) · 옆·뒤(얼굴 앞은 비움) · 앞머리 끝선 · 삐친 머리 한 가닥
        var HAIR = 0x1a1614;
        add('hair', new THREE.SphereGeometry(R * 1.16, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.5), HAIR, off(0, 0.2, -0.02), null, [1.0, 1.1, 1.05]);
        add('hair', new THREE.CylinderGeometry(R * 1.12, R * 1.1, R * 0.62, 32, 1, true, Math.PI * 0.34, Math.PI * 1.32), HAIR, off(0, -0.09, -0.02), null, [1.0, 1, 1.04]);
        add('hair', new THREE.CylinderGeometry(R * 1.125, R * 1.125, R * 0.08, 32, 1, true, -Math.PI * 0.34, Math.PI * 0.68), HAIR, off(0, 0.2, -0.02), null, [1.0, 1, 1.05]);
        add('hair', new THREE.TorusGeometry(R * 0.17, R * 0.04, 6, 14, Math.PI * 1.1), HAIR, off(0, 1.36, -0.15), [0, Math.PI / 2, 0.9]);
      }
      if (a === 'shades' && HB) {   // 선글라스: **머리 정점 상자**에서 자리를 잰다(뼈 길이로 잡은 반지름은 캐릭터형 큰 머리보다 작아 안에 묻혔다) · 모델 앞 = +z
        var SH = 0x15181c, hw = (HB.max.x - HB.min.x), hh = (HB.max.y - HB.min.y), cx = (HB.min.x + HB.max.x) / 2, ey = HB.min.y + hh * 0.44, fz = HB.max.z + hw * 0.01;
        add('shades', new THREE.BoxGeometry(hw * 0.30, hh * 0.13, hw * 0.03), SH, new THREE.Vector3(cx - hw * 0.19, ey, fz));
        add('shades', new THREE.BoxGeometry(hw * 0.30, hh * 0.13, hw * 0.03), SH, new THREE.Vector3(cx + hw * 0.19, ey, fz));
        add('shades', new THREE.BoxGeometry(hw * 0.10, hh * 0.025, hw * 0.03), SH, new THREE.Vector3(cx, ey + hh * 0.03, fz));
        add('shades', new THREE.BoxGeometry(hw * 0.02, hh * 0.025, hw * 0.55), SH, new THREE.Vector3(HB.min.x - hw * 0.005, ey + hh * 0.03, fz - hw * 0.27));
        add('shades', new THREE.BoxGeometry(hw * 0.02, hh * 0.025, hw * 0.55), SH, new THREE.Vector3(HB.max.x + hw * 0.005, ey + hh * 0.03, fz - hw * 0.27));
      }
      if (a === 'scarf' && B.Neck) {   // 노란 목 스카프(고리)
        var n = new THREE.Vector3(); B.Neck.getWorldPosition(n);
        add('scarf', new THREE.TorusGeometry(R * 0.36, R * 0.075, 8, 24), 0xfcce2a, n.clone().add(new THREE.Vector3(0, -R * 0.08, 0)), [Math.PI / 2, 0, 0], null, 'Neck');
      }
    });
    return out;
  }
  // 종류별 치수(모델 단위, 루트 배율 1): 키·발바닥·골반·머리 상자·몸통 상자·머리/가슴 뼈 자리
  function measure(kind) {
    if (S.measure[kind]) return S.measure[kind];
    var P = KIND[kind], c = cloneRig(S.proto); proportion(c.bones, P); c.root.updateMatrixWorld(true);
    var sm = c.mesh, pos = sm.geometry.attributes.position, si = sm.geometry.attributes.skinIndex, sw = sm.geometry.attributes.skinWeight;
    var names = sm.skeleton.bones.map(function (b) { return b.name; });
    var all = new THREE.Box3(), head = new THREE.Box3(), torso = new THREE.Box3(), v = new THREE.Vector3();
    for (var i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i); sm.boneTransform(i, v); v.applyMatrix4(sm.matrixWorld); all.expandByPoint(v);
      var bn = names[si.getX(i)];
      if (sw.getX(i) >= 0.5 && bn === 'Head') head.expandByPoint(v);
      if (sw.getX(i) >= 0.5 && (bn === 'Spine' || bn === 'Chest' || bn === 'UpperChest')) torso.expandByPoint(v);
    }
    function bw(n) { var p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(); c.bones[n].matrixWorld.decompose(p, q, s); return { p: p, s: s.x }; }
    var hp = new THREE.Vector3(); c.bones.Hips.getWorldPosition(hp);
    return (S.measure[kind] = { H: all.max.y - all.min.y, minY: all.min.y, hipY: hp.y, head: head, torso: torso, headBone: bw('Head'), chestBone: bw('Chest'),
                                acc: P.acc ? accParts(P.acc, c.bones, head) : [] });
  }

  var partMat = null;
  function partMaterial() { return partMat || (partMat = new THREE.MeshLambertMaterial({ vertexColors: true })); }
  // 머리 부품: 경찰 정모(흰 덮개·금색 밴드·검정 챙·금색 표장) · 어린이 노란 안전모
  function hatMesh(type, hb) {
    var C = TG.Character.COLORS, W = (hb.max.x - hb.min.x) / 2, D = (hb.max.z - hb.min.z) / 2, top = hb.max.y, Hh = hb.max.y - hb.min.y;
    var R0 = Math.max(W, D), g = new TG.GeoBuilder();
    if (type === 'police') {
      var y0 = top - Hh * 0.30;
      g.cylinder(0, y0, 0, R0 * 1.02, R0 * 0.99, Hh * 0.10, 20, C.GOLD, false);                  // 금색 밴드
      g.cylinder(0, y0 - 0.006, 0, R0 * 1.03, R0 * 1.03, 0.014, 20, C.BLACK, false);             // 밴드 아래 검정 선
      g.cylinder(0, y0 + Hh * 0.10, 0, R0 * 0.99, R0 * 1.12, Hh * 0.13, 20, C.WHITE, true);      // 흰 덮개(위가 넓다)
      g.box(0, y0 + 0.004, R0 * 0.98, R0 * 1.55, 0.03, R0 * 0.80, C.BLACK, {});                  // 검정 챙
      g.box(0, y0 + Hh * 0.05, R0 * 1.04, R0 * 0.34, Hh * 0.08, 0.02, C.GOLD, {});               // 참수리 표장
    } else {
      var yk = top - Hh * 0.34;
      g.sphere(0, yk, 0, R0 * 1.06, 18, 10, C.KID_CAP, 0.62);                                     // 노란 안전모(둥근 모자)
      g.box(0, yk + 0.004, R0 * 0.98, R0 * 1.3, 0.026, R0 * 0.62, C.KID_CAP, {});                // 챙
    }
    var m = new THREE.Mesh(g.build(), partMaterial()); m.castShadow = true;
    return m;
  }
  function bagMesh(tb) {
    var C = TG.Character.COLORS, w = (tb.max.x - tb.min.x), h = (tb.max.y - tb.min.y), g = new TG.GeoBuilder();
    var cy = (tb.min.y + tb.max.y) / 2 + h * 0.05, z0 = tb.min.z - w * 0.18;
    g.box(0, cy, z0, w * 0.72, h * 0.80, w * 0.36, C.KID_BAG, {});                                  // 책가방
    g.box(0, cy - h * 0.08, z0 - w * 0.19, w * 0.54, h * 0.40, 0.02, 0xffd23f, {});               // 앞주머니
    var m = new THREE.Mesh(g.build(), partMaterial()); m.castShadow = true;
    return m;
  }
  // 모델 단위로 만든 부품을 뼈에 붙인다(뼈의 휴지 자리·배율로 로컬 좌표를 낸다)
  function pin(bone, mesh, rest) {
    mesh.scale.setScalar(1 / rest.s);
    mesh.position.set(-rest.p.x / rest.s, -rest.p.y / rest.s, -rest.p.z / rest.s);
    bone.add(mesh);
  }

  // 코드 리그 R 에 모델을 입힌다. 성공하면 true(코드 리그 메시는 숨기고 관절만 조종간으로 남긴다)
  function attach(R, kind) {
    var P = KIND[kind];
    if (!S.ready || !P) return false;
    var M = measure(kind), c = cloneRig(S.proto); proportion(c.bones, P);
    var gs = R.group.scale.y || 1, K = (P.height / gs) / M.H;            // 어린이 리그는 그룹이 0.62배라 그만큼 나눈다
    c.mesh.material = material(P.skin); c.mesh.castShadow = true; c.mesh.receiveShadow = false; c.mesh.frustumCulled = false;
    c.root.scale.setScalar(K);
    var baton = R.parts.baton || null;
    R.group.traverse(function (o) { if (o.isMesh) o.visible = false; });
    R.group.add(c.root);
    if (P.hat && c.bones.Head) { var hat = hatMesh(P.hat, M.head); pin(c.bones.Head, hat, M.headBone); R.parts.cap = hat; }
    if (P.bag && c.bones.Chest) { var bag = bagMesh(M.torso); pin(c.bones.Chest, bag, M.chestBone); R.parts.bag = bag; }
    R.parts.acc = {};
    M.acc.forEach(function (a) {
      var m = new THREE.Mesh(a.geo, a.mat); m.castShadow = true;
      a.local.decompose(m.position, m.quaternion, m.scale);
      c.bones[a.bone].add(m); (R.parts.acc[a.tag] = R.parts.acc[a.tag] || []).push(m);
    });
    // 신호봉(적색 유도등): 왼손 뼈에 쥐여 준다 — 손잡이는 주먹 안, 적색 봉은 팔 방향(뼈 +y)으로 뻗는다.
    // 코드 리그의 신호봉은 아래팔 자리에 맞춘 것이라 쓰지 않고 새로 만든다(보이고 숨기는 것은 animate 가 R.parts.baton 으로 한다).
    if (P.baton && baton && c.bones.LeftHand) {
      var hs = S.restModel.LeftHand.s, C = TG.Character.COLORS, bt = new TG.GeoBuilder();
      bt.cylinder(0, -0.04, 0, 0.017, 0.017, 0.12, 8, C.BATON2, false);
      bt.cylinder(0, 0.08, 0, 0.021, 0.019, 0.40, 10, C.BATON, true);
      bt.sphere(0, 0.48, 0, 0.02, 8, 6, 0xff6a5e);
      var nb = new THREE.Mesh(bt.build(), partMaterial()); nb.castShadow = true; nb.visible = false;
      var ks = hs * K * gs;
      nb.position.set(0, 0.07 / ks, 0); nb.scale.setScalar(1 / ks);
      c.bones.LeftHand.add(nb); R.parts.baton = nb;
    }
    R.glb = { root: c.root, bones: c.bones, mesh: c.mesh, kind: kind, K: K, M: M };
    S.count++;
    sync(R);
    return true;
  }

  var qa = new THREE.Quaternion(), qt = new THREE.Quaternion(), qInv = new THREE.Quaternion();
  var PQ = [];   // 재귀 깊이별 임시 쿼터니언
  function procQ(R, key, out) {
    var J = R.joints;
    switch (key) {
      case 'torso': return out.copy(R.parts.torso.quaternion);
      case 'neck': return out.copy(J.neck.quaternion);
      case 'shL': case 'shR': case 'hpL': case 'hpR': return out.copy(J[key].quaternion);
      case 'elL': return out.copy(J.shL.quaternion).multiply(J.elL.quaternion);
      case 'elR': return out.copy(J.shR.quaternion).multiply(J.elR.quaternion);
      case 'knL': return out.copy(J.hpL.quaternion).multiply(J.knL.quaternion);
      case 'knR': return out.copy(J.hpR.quaternion).multiply(J.knR.quaternion);
    }
    return out.identity();
  }
  function walk(R, bone, parentQ, depth) {
    var myQ = PQ[depth] || (PQ[depth] = new THREE.Quaternion());
    var key = MAP[bone.name];
    if (key) {
      procQ(R, key, qt);                                          // 코드 리그 관절의 몸 기준 회전
      if (ALIGN[bone.name]) qt.multiply(ALIGN[bone.name]);        // T포즈 → 차렷 보정
      qt.multiply(S.restModel[bone.name].q);                      // 모델 공간 목표 = 관절 회전 × 뼈 휴지 방향
      qInv.copy(parentQ).invert();
      bone.quaternion.copy(qInv).multiply(qt);
      myQ.copy(qt);
    } else {
      myQ.copy(parentQ).multiply(bone.userData.q0 || (bone.userData.q0 = bone.quaternion.clone()));
    }
    var ch = bone.children;
    for (var i = 0; i < ch.length; i++) if (ch[i].isBone) walk(R, ch[i], myQ, depth + 1);
  }
  var ID = new THREE.Quaternion();
  function sync(R) {
    if (!R || !R.glb) return;
    var G = R.glb, K = G.K, M = G.M;
    // 발바닥을 땅에 맞춘다(다리 배율로 발이 내려간 만큼). 앉은 자세(자전거·이륜차)는 코드 리그 골반 높이에 맞춰 올린다 —
    // 모델은 머리가 큰 캐릭터형이라 골반이 낮아 안장보다 낮게 앉는다.
    G.root.position.y = R.poseKind === 'ride' ? (R.hipY || 0.92) - 0.06 - M.hipY * K : -M.minY * K;
    var ch = G.root.children;
    for (var i = 0; i < ch.length; i++) {
      var o = ch[i];
      if (o.isBone) walk(R, o, ID, 0);
      else if (o.children) for (var k = 0; k < o.children.length; k++) if (o.children[k].isBone) walk(R, o.children[k], qa.copy(o.quaternion), 1);
    }
  }

  // 덧입는 것(영아 교실 야광 조끼): 모델이면 **가슴 뼈**에 몸통 크기로 붙인다 — 코드 리그 높이(그룹 좌표)에 두면 머리 큰 모델에서 떠 보인다
  function vest(R) {
    if (!R || !R.glb) return null;
    var M = R.glb.M, tb = M.torso, w = tb.max.x - tb.min.x, h = tb.max.y - tb.min.y, d = tb.max.z - tb.min.z;
    var cx = (tb.min.x + tb.max.x) / 2, cy = (tb.min.y + tb.max.y) / 2, cz = (tb.min.z + tb.max.z) / 2;
    var g = new THREE.Group();
    var body = new THREE.Mesh(new THREE.BoxGeometry(w * 1.34, h * 0.92, d * 1.34), new THREE.MeshLambertMaterial({ color: 0xffd93d }));
    body.position.set(cx, cy - h * 0.04, cz); g.add(body);
    var bandM = new THREE.MeshBasicMaterial({ color: 0xf2f6ff });
    for (var b = 0; b < 2; b++) { var band = new THREE.Mesh(new THREE.BoxGeometry(w * 1.36, h * 0.10, d * 1.36), bandM); band.position.set(cx, cy - h * 0.22 + b * h * 0.28, cz); g.add(band); }
    pin(R.glb.bones.Chest, g, M.chestBone);
    return { group: g, body: body };
  }
  // 그룹 좌표로 본 키(우산 높이 등) — 모델이 아니면 null
  function heightLocal(R) { return R && R.glb ? KIND[R.glb.kind].height / (R.group.scale.y || 1) : null; }

  load();
  return { state: S, attach: attach, sync: sync, ready: function () { return S.ready; }, kinds: KIND, builds: BUILDS, avatarKind: avatarKind, measure: measure, vest: vest, heightLocal: heightLocal };
})();
