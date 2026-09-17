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
// 시설물 자리 기록(점검용) — 기둥·표지·가로수·교각처럼 차가 부딪힐 수 있는 것.
// 그리는 코드와 **같은 변수**로 적는다(점검이 그림과 다른 자리를 보면 소용이 없다).
// y0·y1 = 세로 범위(월드 y). meta = 링크 번호 등 점검이 가를 때 쓰는 값.
TG.FAC = [];
TG.facReg = function (kind, x, z, r, y0, y1, meta) { TG.FAC.push({ kind: kind, x: x, z: z, r: r, y0: y0, y1: y1, meta: meta || null }); };
