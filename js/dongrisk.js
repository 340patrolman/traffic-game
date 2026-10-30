// 동네(행정동)별 사고율(v0.10.132 · ROADMAP ③ 지표 둘째 판) — data/dong-risk-seocho.json(tools/maps/dong-risk.py).
// 사고(TAAS 2016~2025 · 100m 칸) ÷ 주민 · 생활인구 · 넓이. 화면 참고용 — 시뮬·교통 AI 입력에는 쓰지 않는다(사고 = 교정의 답).
(function () {
  'use strict';
  var TG = window.TG = window.TG || {};
  TG.DongRisk = function () {
    var self = this, D = null, BY = {};
    try {
      fetch('data/dong-risk-seocho.json').then(function (r) { return r.json(); }).then(function (j) {
        D = j; BY = {}; (j.dong || []).forEach(function (d) { BY[d.name] = d; });
      }).catch(function () { D = false; });
    } catch (e) { D = false; }
    self.ready = function () { return !!D; };
    self.data = function () { return D || null; };
    self.get = function (name) { return BY[name] || null; };
    // 생활인구 1만 명당 한 해 사고가 많은 차례
    self.list = function () { return D && D.dong ? D.dong.slice() : []; };
    self.rank = function (name) {
      var L = self.list(); for (var i = 0; i < L.length; i++) if (L[i].name === name) return { at: i + 1, of: L.length };
      return null;
    };
  };
})();
