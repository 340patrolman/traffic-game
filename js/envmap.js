// ✨ 환경 반사(v0.10.33) — 소유자 「3d 구현과 인물과 사물들이 이상해, 현실감이 떨어져 … 차량도 현실적으로 구현해줘」
//
//  실측으로 원인을 먼저 가렸다(2026-09-27):
//   ① 교통 차량 차체가 **MeshLambertMaterial** 이었다 — Lambert 는 **정반사(하이라이트)가 원리상 0** 이다.
//      자동차 도장은 「빛이 비쳐서」 금속으로 보이는 물건이라, 아무리 잘 만들어도 마분지로 보인다.
//   ② `scene.environment` 가 **없었다**(실측 `envMap: false`). 유리·크롬은 **주변이 비쳐야** 유리·크롬이 된다.
//      비칠 것이 없으니 유리가 그냥 검은 판이었다.
//
//  ⚠ **파일을 들여오지 않는다.** HDR 파일이나 큐브맵 그림을 받아 오면 「외부 이미지 파일 0개 · 네트워크 요청 0」이 깨진다.
//     그래서 **그 날씨의 하늘색으로 작은 그라디언트를 코드로 만들어** PMREM 으로 굽는다(32×16 → 밉맵).
//     날씨 갈래마다 한 번만 굽고 캐시한다(6갈래 + 흐림).
TG.EnvMap = (function () {
  var cache = {}, pmrem = null, renderer = null;

  // 하늘 그라디언트를 등장방형(equirectangular) 작은 텍스처로 — 위 하늘색 → 지평선색 → 아래 땅색
  function gradient(skyTop, skyHorizon, ground) {
    var W = 32, H = 16, data = new Uint8Array(W * H * 3);
    function hex(c) { return [(c >> 16) & 255, (c >> 8) & 255, c & 255]; }
    var a = hex(skyTop), b = hex(skyHorizon), g = hex(ground);
    for (var y = 0; y < H; y++) {
      var v = y / (H - 1);                       // 0 = 위(천정) · 1 = 아래(발밑)
      var r, gg, bb, t;
      if (v < 0.5) { t = v / 0.5; r = a[0] + (b[0] - a[0]) * t; gg = a[1] + (b[1] - a[1]) * t; bb = a[2] + (b[2] - a[2]) * t; }
      else { t = (v - 0.5) / 0.5; r = b[0] + (g[0] - b[0]) * t; gg = b[1] + (g[1] - b[1]) * t; bb = b[2] + (g[2] - b[2]) * t; }
      for (var x = 0; x < W; x++) {
        var i = (y * W + x) * 3;
        data[i] = r; data[i + 1] = gg; data[i + 2] = bb;
      }
    }
    var tex = new THREE.DataTexture(data, W, H, THREE.RGBFormat);
    tex.needsUpdate = true;
    tex.mapping = THREE.EquirectangularReflectionMapping;
    return tex;
  }

  return {
    // 게임이 켜질 때 한 번 — 렌더러를 받아 둔다
    init: function (r) {
      renderer = r;
      if (!renderer || !THREE.PMREMGenerator) return false;
      try { pmrem = new THREE.PMREMGenerator(renderer); pmrem.compileEquirectangularShader(); } catch (e) { pmrem = null; }
      return !!pmrem;
    },
    ready: function () { return !!pmrem; },
    // 그 날씨의 반사 환경. key 는 날씨 이름이고 색은 weather 의 preset 에서 온다.
    get: function (key, skyTop, skyHorizon, ground) {
      if (!pmrem) return null;
      if (cache[key]) return cache[key];
      var src = gradient(skyTop, skyHorizon, ground);
      var rt = null;
      try { rt = pmrem.fromEquirectangular(src); } catch (e) { src.dispose(); return null; }
      src.dispose();
      cache[key] = rt.texture;
      return cache[key];
    },
    dispose: function () {
      for (var k in cache) { if (cache[k] && cache[k].dispose) cache[k].dispose(); }
      cache = {};
      if (pmrem && pmrem.dispose) pmrem.dispose();
      pmrem = null;
    }
  };
})();
