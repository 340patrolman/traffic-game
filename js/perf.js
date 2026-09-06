// 프레임 시간 EMA → 스폰 예산 배율. 이미 있는 것은 지우지 않고 새로 스폰하는 양만 줄인다.
// 배율이 낮아지면 그림자를 끄고, 여유가 돌아오면 다시 켠다. 변경마다 [perf] 로그를 남긴다.
TG.perf = (function () {
  var TARGET = 1000 / 60;
  var SHRINK_AT = 30;   // 33fps 부근부터 줄이기 시작(폰 30fps 목표)
  var GROW_AT = 20;     // 50fps 이상일 때만 회복 → 두 문턱이 서로 쫓지 않는다
  var FLOOR = 0.3;      // 텅 빈 거리는 느린 거리보다 나쁜 버그
  var STEP = 0.1;
  var EVERY = 0.6;
  var WARMUP = 3;       // 셰이더 컴파일·초기 업로드는 증거가 아니다
  var ema = TARGET, scale = 1, since = 0, warm = 0, simulate = 0, shadows = true;
  var listeners = [];

  function budget(n, s) { if (n <= 0) return 0; return Math.max(2, Math.round(n * (s === undefined ? scale : s))); }

  function sample(ms) {
    if (simulate > 0) ms = simulate;
    if (!(ms > 0) || ms > 120) return;   // 탭 전환·GC 정지는 무시
    ema += (ms - ema) * 0.08;
  }
  function update(dt) {
    warm += dt;
    if (warm < WARMUP) return;
    since += dt;
    if (since < EVERY) return;
    since = 0;
    var before = scale;
    if (ema > SHRINK_AT) scale = Math.max(FLOOR, scale - STEP);
    else if (ema < GROW_AT) scale = Math.min(1, scale + STEP);
    scale = Math.round(scale * 100) / 100;
    if (scale !== before) {
      var C = TG.CONFIG;
      console.log('[perf] 프레임 ' + ema.toFixed(1) + 'ms → 스폰 배율 ' + before.toFixed(2) + ' → ' + scale.toFixed(2) +
        ' (교통 예산 ' + budget(C.TRAFFIC_MAX, before) + '→' + budget(C.TRAFFIC_MAX, scale) +
        ', 행인 ' + budget(C.PED_MAX, before) + '→' + budget(C.PED_MAX, scale) + ')');
      var wantShadows = scale >= 0.7;
      if (wantShadows !== shadows) {
        shadows = wantShadows;
        console.log('[perf] 그림자 ' + (shadows ? '켬' : '끔'));
      }
      for (var i = 0; i < listeners.length; i++) listeners[i](scale, shadows);
    }
  }
  return {
    get scale() { return scale; },
    get frameMs() { return ema; },
    get shadows() { return shadows; },
    sample: sample, update: update, budget: budget,
    onChange: function (fn) { listeners.push(fn); },
    // 저사양 시뮬레이션: 프레임이 ms 걸리는 척한다(0이면 해제)
    simulateSlow: function (ms) { simulate = ms || 0; warm = WARMUP; console.log('[perf] 저사양 시뮬레이션 ' + (ms ? ms + 'ms' : '해제')); },
    reset: function () { ema = TARGET; scale = 1; since = 0; warm = 0; shadows = true; },
  };
})();
