// 👥 동별 인구·연령(v0.10.26) — 소유자 지시 「각 동별 인구, 인구분포, 연령대도 넣는 거 알지」.
//  자료는 **행정안전부 주민등록 인구통계**(행정동별 연령별 인구현황, 2026년 8월)와 **서초구청 서초통계**(월별인구현황)에서
//  받아 `data/pop-seocho.json` 에 담았다. 숫자는 코드에 한 줄도 없다.
//  ⚠ **행정동 경계는 축약 지도에 없다** — 교차로마다 가까운 동 하나를 **이름으로** 붙였다(근사 · v0.9.70 규칙).
//  쓰는 곳: ① 그 동네의 **행인 나이 구성**(어린이·노인 비율) ② 순찰 중 한 줄 안내 ③ 다른 층(TAAS 취약계층)과 맞대 보기.
TG.Pop = function (game) {
  var self = this, G = game, D = null, byName = null;

  this.load = function (path, cb) {
    if (location.protocol.indexOf('http') !== 0) { if (cb) cb('file://'); return; }
    fetch(path || 'data/pop-seocho.json').then(function (r) { return r.json(); }).then(function (j) {
      D = j; byName = {};
      for (var i = 0; i < j.dong.length; i++) byName[j.dong[i].name] = j.dong[i];
      if (cb) cb(null, j);
    }).catch(function (e) { if (cb) cb(e.message); });
  };
  this.ready = function () { return !!D; };
  this.data = function () { return D; };
  this.dongOf = function (node) {
    if (!D || !node || !G.city || !G.city.nodeName) return null;
    var nm = G.city.nodeName(node);
    if (!nm) return null;
    var dn = D.byNodeName[nm];
    return dn ? byName[dn] || null : null;
  };
  // 연령 구성 → 행인 나이 비율. 어린이 = 0~19세 · 노인 = 70세 이상(보행 사고 자료와 결이 같다).
  //  그대로 쓰면 낮 거리에 아이가 너무 많다(학교·직장에 있다) — **보이는 비율은 게임 설계값으로 눌러 쓴다.**
  this.mix = function (dong) {
    if (!dong) return null;
    var a = dong.age, tot = dong.tot || 1;
    var kid = (a[0] + a[1]) / tot, senior = (a[7] + a[8] + a[9]) / tot;
    return { tot: dong.tot, kidShare: kid, seniorShare: senior,
             kid: TG.clamp(kid * 0.55, 0.02, 0.26), senior: TG.clamp(senior * 1.15, 0.02, 0.3) };
  };
  this.line = function (node) {
    var d = self.dongOf(node); if (!d) return '';
    var m = self.mix(d);
    return '👥 ' + d.name + ' ' + d.tot.toLocaleString() + '명 · 19세 이하 ' + Math.round(m.kidShare * 100) +
           '% · 70세 이상 ' + Math.round(m.seniorShare * 100) + '% (행안부 2026.8 · 동 경계는 근사)';
  };
  this.src = function () { return D ? D.source['연령별'] : ''; };
};
