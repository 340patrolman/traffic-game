// 📊 지금 이 시각, 실제로 위험한 곳(v0.10.120) — 소유자 「유기적인 연결 — 권고대로」 2단계.
// 순찰 근무를 시작할 때 출발 지역을 고르지 않았으면, 기기 시각의 시간대(6시간 띠)에 서초 교차로 25곳 둘레에서
// 실제 사고(TAAS 2016~2025)가 많았던 곳 상위 셋 중 하나로 배치한다(사고 수 가중 · 판마다 조금씩 다르게).
// 자료 = data/taas-time-seocho.json(tools/maps/taas-time.py — 교차로 둘레 150m 100m 칸 합 · 근사 · 서초구 쪽 칸만).
// 숫자는 파일에서만 읽는다. 「위험하다」는 이 앱의 근사 표현이지 공식 위험도가 아니다(화면에 밝힌다).
TG.NowRisk = (function () {
  var self = {}, D = null;
  self.load = function () {
    if (D !== null) return;
    D = false;
    try { fetch('data/taas-time-seocho.json').then(function (r) { return r.json(); }).then(function (j) { D = j; }).catch(function () { D = false; }); } catch (e) { D = false; }
  };
  self.ready = function () { return !!(D && D.nodes); };
  self.data = function () { return D || null; };
  function bandOf(h) { return Math.max(0, Math.min(3, Math.floor(h / 6))); }
  // 지금 시각 → 교차로 순위 [{n, cnt, score, fat}] (사고 수 많은 순)
  self.rank = function (date) {
    if (!self.ready()) return [];
    var d = date || new Date(), h = d.getHours(), b = bandOf(h);
    var L = D.nodes.map(function (n) {
      var fat = (n.fatal || []).filter(function (f) { return Math.abs(f[2] - h) <= 1 || Math.abs(f[2] - h) >= 23; });
      return { n: n, cnt: n.band[b] || 0, fat: fat, score: (n.band[b] || 0) + fat.length * 15 };   // 같은 시각(±1시간) 사망사고 한 건 = 15건 몫(게임 설계값)
    });
    L.sort(function (a, c) { return c.score - a.score; });
    return L;
  };
  // 상위 셋 중 사고 수 가중으로 하나
  self.pick = function (date) {
    var L = self.rank(date).slice(0, 3); if (!L.length || !L[0].score) return null;
    var sum = 0; L.forEach(function (x) { sum += x.score; });
    var r = Math.random() * sum, k = 0; while (k < L.length - 1 && r > L[k].score) { r -= L[k].score; k++; }
    var x = L[k], d = date || new Date(), b = bandOf(d.getHours());
    return { i: x.n.i, j: x.n.j, name: x.n.name, band: D.bands[b], cnt: x.cnt, tot: x.n.tot, rank: k + 1, viol: (x.n.viol || []).filter(function (v) { return v[0] !== '기타'; }), fat: x.fat, years: D.years, hour: d.getHours() };
  };
  // 결과 카드·안내 한 줄
  self.line = function (p) {
    if (!p) return '';
    var v = p.viol.slice(0, 2).map(function (x) { return x[0]; }).join('·');
    return p.name + ' — ' + p.years + ' 이 시간대(' + p.band + ') 실제 사고 ' + p.cnt + '건' + (p.tot ? '(이 교차로 10년 ' + p.tot + '건의 ' + Math.round(p.cnt / p.tot * 100) + '%)' : '') + (v ? ' · 많은 법규위반 ' + v : '');
  };
  self.fatalLine = function (p) {
    if (!p || !p.fat || !p.fat.length) return '';
    var dow = (D && D.dow) || [];
    return '🕯 이 교차로 둘레, 같은 시각(±1시간) 사망사고 ' + p.fat.length + '건 — ' + p.fat.map(function (f) { return f[0] + '년 ' + (dow[f[1]] || '') + '요일 ' + f[2] + '시'; }).join(' · ');
  };
  return self;
})();
