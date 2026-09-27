// ✨ 빛 번짐(Bloom) — 고화질에서만(v0.10.38 · 소유자 「남은 일 모두 허용」 · 제미나이 검토 「경광등 Bloom」).
//  three.js 예제의 EffectComposer·UnrealBloomPass 를 받아 오지 않고(파일 0개 추가 · 빌드 도구 없음) **셰이더 셋을 직접** 쓴다.
//   ① 장면을 한 장에 그린다(WebGL2 면 4배 다중 표본 — 계단이 안 생기게)
//   ② 밝은 곳만 뽑는다(가장 밝은 채널이 문턱을 넘는 곳 · 부드러운 무릎)
//   ③ 절반·사분의 일 크기에서 가로·세로로 번지게(가우스 5탭 × 2)
//   ④ 원래 장면 위에 더한다.
//  폰 기본은 끔 — 「고화질」을 켰을 때만 돈다(폰 30fps 규칙). 파노라마(차내 3면)에서는 쓰지 않는다.
//  문턱·세기는 게임 설계값이다.
TG.Bloom = function (renderer) {
  var self = this;
  this.on = true; this.threshold = 0.92; this.strength = 0.5;
  var VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
  function mat(fs, uni) { return new THREE.ShaderMaterial({ uniforms: uni, vertexShader: VS, fragmentShader: fs, depthTest: false, depthWrite: false }); }
  var bright = mat('uniform sampler2D tD; uniform float th; varying vec2 vUv;' +
    'void main(){ vec3 c = texture2D(tD, vUv).rgb; float l = max(c.r, max(c.g, c.b)); float w = smoothstep(th - 0.12, th + 0.12, l); gl_FragColor = vec4(c * w, 1.0); }',
    { tD: { value: null }, th: { value: self.threshold } });
  var blur = mat('uniform sampler2D tD; uniform vec2 dir; varying vec2 vUv;' +
    'void main(){ vec3 s = texture2D(tD, vUv).rgb * 0.227;' +
    ' s += texture2D(tD, vUv + dir * 1.385).rgb * 0.316; s += texture2D(tD, vUv - dir * 1.385).rgb * 0.316;' +
    ' s += texture2D(tD, vUv + dir * 3.231).rgb * 0.070; s += texture2D(tD, vUv - dir * 3.231).rgb * 0.070; gl_FragColor = vec4(s, 1.0); }',
    { tD: { value: null }, dir: { value: new THREE.Vector2() } });
  var comp = mat('uniform sampler2D tS; uniform sampler2D tB1; uniform sampler2D tB2; uniform float k; varying vec2 vUv;' +
    'void main(){ vec3 c = texture2D(tS, vUv).rgb + (texture2D(tB1, vUv).rgb * 0.7 + texture2D(tB2, vUv).rgb * 0.9) * k; gl_FragColor = vec4(min(c, vec3(1.0)), 1.0); }',
    { tS: { value: null }, tB1: { value: null }, tB2: { value: null }, k: { value: self.strength } });
  var qs = new THREE.Scene(), qc = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), bright);
  quad.frustumCulled = false; qs.add(quad);
  var W = 0, H = 0, rtS = null, rtA = null, rtB = null, rtC = null, rtD = null, buf = new THREE.Vector2();
  function mk(w, h) { var t = new THREE.WebGLRenderTarget(w, h, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false }); return t; }
  function alloc(w, h) {
    [rtS, rtA, rtB, rtC, rtD].forEach(function (t) { if (t) t.dispose(); });
    var ms = renderer.capabilities.isWebGL2 && THREE.WebGLMultisampleRenderTarget;
    rtS = ms ? new THREE.WebGLMultisampleRenderTarget(w, h, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter }) : new THREE.WebGLRenderTarget(w, h, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
    if (ms) rtS.samples = 4;
    rtS.texture.encoding = THREE.sRGBEncoding;   // 장면이 화면과 같은 값으로 나오게(재질이 출력 인코딩을 여기서 읽는다)
    var w2 = Math.max(1, w >> 1), h2 = Math.max(1, h >> 1), w4 = Math.max(1, w >> 2), h4 = Math.max(1, h >> 2);
    rtA = mk(w2, h2); rtB = mk(w2, h2); rtC = mk(w4, h4); rtD = mk(w4, h4);
    W = w; H = h;
  }
  function pass(m, target) { quad.material = m; renderer.setRenderTarget(target); renderer.render(qs, qc); }
  this.render = function (scene, camera) {
    renderer.getDrawingBufferSize(buf);
    var w = Math.floor(buf.x), h = Math.floor(buf.y);
    if (w !== W || h !== H || !rtS) alloc(w, h);
    var prevRT = renderer.getRenderTarget();
    renderer.setRenderTarget(rtS); renderer.render(scene, camera);
    bright.uniforms.tD.value = rtS.texture; bright.uniforms.th.value = self.threshold; pass(bright, rtA);
    var w2 = rtA.width, h2 = rtA.height, w4 = rtC.width, h4 = rtC.height;
    blur.uniforms.tD.value = rtA.texture; blur.uniforms.dir.value.set(1 / w2, 0); pass(blur, rtB);
    blur.uniforms.tD.value = rtB.texture; blur.uniforms.dir.value.set(0, 1 / h2); pass(blur, rtA);
    blur.uniforms.tD.value = rtA.texture; blur.uniforms.dir.value.set(1 / w4, 0); pass(blur, rtC);
    blur.uniforms.tD.value = rtC.texture; blur.uniforms.dir.value.set(0, 1 / h4); pass(blur, rtD);
    comp.uniforms.tS.value = rtS.texture; comp.uniforms.tB1.value = rtA.texture; comp.uniforms.tB2.value = rtD.texture; comp.uniforms.k.value = self.strength * (TG.nightNow ? 1 : 0.45);   // 낮에는 흰 노면·하늘이 번지지 않게 절반 아래로
    pass(comp, prevRT || null);
  };
  this.dispose = function () { [rtS, rtA, rtB, rtC, rtD].forEach(function (t) { if (t) t.dispose(); }); rtS = null; W = H = 0; };
};
