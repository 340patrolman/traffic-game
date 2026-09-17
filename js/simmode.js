// 🧪 시뮬레이션 모드 스위치(ROADMAP E1 · NORTH_STAR) — 같은 도시를 「게임」이 아니라 「실험」으로 돌린다.
//  켜면: 운전 보조(차선 유지·초보 자동 제동) 끔 · 칭찬·경험치·메달 끔 · 사수 무전·첫 출근·사건 사슬·캠페인 끔 · 정차 캠·슬로모션·히트스톱 끔 ·
//        Math.random 을 고정 시드로(같은 조건이면 같은 결과). 계측(metrics)·법규 판정·신호·교통 AI 는 **그대로** 돈다.
//  켜는 법: 주소 ?sim=1 · 또는 타이틀 ⚙ 「🧪 시뮬레이션」(설정 tg_settings.sim 에 저장하고 다시 불러온다 — 시드는 처음부터 걸어야 의미가 있다).
//  검사 모드(?test=1)는 저장값을 보지 않는다(주소에 sim=1 이 있을 때만). 각 기능은 TG.mode.sim 을 **그때그때** 읽는다.
//  js/save.js 다음에 불러야 한다.
TG.mode = (function () {
  var q = location.search, test = /[?&]test=1/.test(q);
  var saved = false;
  try { saved = !!((TG.save && TG.save.get('settings', {})) || {}).sim; } catch (e) {}
  var sim = /[?&]sim=1/.test(q) || (!test && !/[?&]sim=0/.test(q) && saved);
  var nativeRandom = Math.random;
  function seedRandom(seed) {
    var s = (seed >>> 0) || 1;
    Math.random = function () { s |= 0; s = s + 0x6D2B79F5 | 0; var t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  var M = {
    sim: sim,
    seed: (TG.CONFIG && TG.CONFIG.SEED) || 340,
    seedRandom: seedRandom,
    unseed: function () { Math.random = nativeRandom; },
    // 설정에 저장하고 다시 불러온다
    set: function (on) {
      try { var st = TG.save.get('settings', {}) || {}; st.sim = !!on; TG.save.set('settings', st); } catch (e) {}
      var u = location.pathname + location.search.replace(/([?&])sim=[01]&?/, '$1').replace(/[?&]$/, '');
      location.replace(u);
    }
  };
  if (sim) seedRandom(M.seed);
  return M;
})();
