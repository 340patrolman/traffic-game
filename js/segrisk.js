// 도로 구간(교차로 사이 단일로)별 실제 사고(v0.10.133 · ROADMAP ③ 지표 셋째 판) — data/seg-risk-seocho.json(tools/maps/seg-risk.py).
// 서초 간선 10개 × 교차로 사이 40구간 · TAAS 2016~2025 100m 칸 · 교차로 둘레 80m 는 뺌. 화면 참고용 — 시뮬·교통 AI 입력에는 쓰지 않는다(사고 = 교정의 답).
(function () {
  'use strict';
  var TG = window.TG = window.TG || {};
  TG.SegRisk = function () {
    var self = this, D = null, BY = {};
    try {
      fetch('data/seg-risk-seocho.json').then(function (r) { return r.json(); }).then(function (j) {
        D = j; BY = {}; (j.segs || []).forEach(function (s) { BY[s.id] = s; });
      }).catch(function () { D = false; });
    } catch (e) { D = false; }
    self.ready = function () { return !!D; };
    self.data = function () { return D || null; };
    self.get = function (id) { return BY[id] || null; };
    // 1km 당 많은 차례(300m 넘는 단일로만)
    self.list = function () { return D && D.segs ? D.segs.filter(function (s) { return s.rank; }).sort(function (a, b) { return a.rank - b.rank; }) : []; };
    // 이 지도의 자리 → 구간. 도로 이름이 자료와 같을 때만(서초 간선 25곳 격자 지도) · 교차로 둘레면 null
    self.at = function (C, x, z) {
      if (!D || !C || !C.xs || !C.zs || C.xs.length !== 5 || C.zs.length !== 5) return null;
      var i = C.nearestIdx(C.xs, x), j = C.nearestIdx(C.zs, z), v = Math.abs(x - C.xs[i]) <= Math.abs(z - C.zs[j]);
      var axis = v ? 'v' : 'h', idx = v ? i : j, along = v ? z : x, A = v ? C.zs : C.xs;
      var name = ((v ? C.roadNamesV : C.roadNamesH) || [])[idx];
      if (!(along > A[0]) || !(along < A[4])) return null;
      var k = 0; while (k < 3 && along > A[k + 1]) k++;
      var s = BY[axis + idx + '-' + k]; if (!s || s.road !== name) return null;
      var half = (C.halfOf ? Math.max(C.halfOf(v ? 'h' : 'v', k), C.halfOf(v ? 'h' : 'v', k + 1)) : 10) + 6;
      if (along - A[k] < half || A[k + 1] - along < half) return null;      // 교차로 상자 둘레는 교차로 몫
      return s;
    };
    self.line = function (s) {
      if (!s) return '';
      var v = (s.viol || []).slice(0, 2).map(function (q) { return q[0]; }).join('·');
      return s.road + ' ' + s.from + ' ↔ ' + s.to + ' — 한 해 ' + s.perYr + '건' + (s.perKm != null ? ' · 단일로 1km 당 ' + s.perKm + '건 · 서초 ' + self.list().length + '구간 중 ' + s.rank + '위' : ' · 단일로가 짧아 1km 당 값 없음') +
        (s.mvk != null ? ' · 100만 대·km 당 ' + s.mvk + '건' : '') + (v ? ' · 많은 법규위반 ' + v : '') + (s.approx ? ' · 구간 끝 근사' : '');
    };
  };
})();
