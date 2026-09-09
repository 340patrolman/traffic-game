// 차량 감각 입자·플레어(파일 0개): 배기 연기(내연기관 급가속) · 타이어 연기(미끄러짐) · 야간 전조등 플레어(가산 스프라이트) · 물보라(비).
// 입자는 THREE.Points 하나(고정 풀 160개). 매 프레임 위치·크기·투명도를 갱신한다.
TG.VFX = function (scene) {
  var N = 260, pos = new Float32Array(N * 3), life = new Float32Array(N), max = new Float32Array(N), vel = new Float32Array(N * 3), size = new Float32Array(N), head = 0;
  var geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  var mat = new THREE.PointsMaterial({ map: TG.tex.smoke ? TG.tex.smoke() : null, size: 1.2, transparent: true, opacity: 0.55, depthWrite: false, color: 0xd9d9d9, sizeAttenuation: true });
  var pts = new THREE.Points(geo, mat); pts.frustumCulled = false; scene.add(pts);
  for (var i = 0; i < N; i++) { pos[i * 3 + 1] = -100; }
  function puff(x, y, z, vx, vy, vz, sec, sz) {
    var i = head; head = (head + 1) % N; pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z; vel[i * 3] = vx; vel[i * 3 + 1] = vy; vel[i * 3 + 2] = vz; life[i] = sec; max[i] = sec; size[i] = sz || 1;
  }
  this.puff = puff;
  this.update = function (dt) {
    var any = false;
    for (var i = 0; i < N; i++) {
      if (life[i] <= 0) continue; any = true;
      life[i] -= dt; if (life[i] <= 0) { pos[i * 3 + 1] = -100; continue; }
      pos[i * 3] += vel[i * 3] * dt; pos[i * 3 + 1] += vel[i * 3 + 1] * dt; pos[i * 3 + 2] += vel[i * 3 + 2] * dt; vel[i * 3 + 1] += 0.6 * dt; vel[i * 3] *= 0.97; vel[i * 3 + 2] *= 0.97;
    }
    if (any) geo.attributes.position.needsUpdate = true;
  };
  // 전조등 플레어: 차 앞 두 점에 가산 스프라이트. 밤에만 보인다
  var flareMat = new THREE.SpriteMaterial({ map: TG.tex.flare ? TG.tex.flare() : null, color: 0xfff2c8, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending });
  this.attachFlares = function (mesh, w, l, y) {
    var out = [];
    [-1, 1].forEach(function (s) { var sp = new THREE.Sprite(flareMat); sp.scale.set(1.6, 1.0, 1); sp.position.set(s * w * 0.36, y, l / 2 + 0.05); sp.visible = false; mesh.add(sp); out.push(sp); });
    return out;
  };
};
