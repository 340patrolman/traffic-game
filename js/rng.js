// 결정적 난수(mulberry32)와 작은 수학 도우미. 지도 생성은 항상 같은 씨앗을 쓴다.
TG.makeRNG = function (seed) {
  var a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    var t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
TG.pick = function (rng, arr) { return arr[Math.floor(rng() * arr.length)]; };
TG.irange = function (rng, a, b) { return a + Math.floor(rng() * (b - a + 1)); };
TG.chance = function (rng, p) { return rng() < p; };
TG.clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
TG.lerp = function (a, b, t) { return a + (b - a) * t; };
TG.wrapAngle = function (a) { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
// 방위 0..3 = 남(+z) 동(+x) 북(-z) 서(-x). heading은 forward=(sin h, cos h).
TG.DIR_HEADING = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
TG.DIR_VEC = [[0, 1], [1, 0], [0, -1], [-1, 0]];
TG.headingToDir = function (h) {
  var fx = Math.sin(h), fz = Math.cos(h);
  if (Math.abs(fx) > Math.abs(fz)) return fx > 0 ? 1 : 3;
  return fz > 0 ? 0 : 2;
};
