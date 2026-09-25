// 🏫 학사 시간표(v0.10.24) — 소유자 지시 「서울시교육청 자료로 개학·수업시간·방학, 초중고에 맞게 찾아서 멘트도 만들자」.
//  **날짜는 지어내지 않았다** — 교육부 나이스(NEIS) 교육정보 개방 포털의 학사일정(SchoolSchedule)에서
//  서울특별시교육청(B10) 소속 **서초구 학교의 실제 값**을 받아 `data/schooltime.json` 에 담았다(수집 2026-09-25).
//  등교·하교 시각과 교시당 수업시간은 **공개 자료에 시각이 없어** 게임 설계값으로 두고 화면에 그렇게 밝힌다.
//  게임은 이 값으로 **사수 멘트와 안내의 때**를 고를 뿐, 법규 판정은 한 줄도 바꾸지 않는다.
TG.SchoolTime = function (game) {
  var self = this, G = game, D = null;

  this.load = function (path, cb) {
    if (location.protocol.indexOf('http') !== 0) { if (cb) cb('file://'); return; }
    fetch(path || 'data/schooltime.json').then(function (r) { return r.json(); }).then(function (j) {
      D = j; if (cb) cb(null, j);
    }).catch(function (e) { if (cb) cb(e.message); });
  };
  this.ready = function () { return !!D; };
  this.data = function () { return D; };
  function ymd(d) { return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); }
  function num(s) { return s ? +String(s).replace(/-/g, '') : 0; }

  // 지금이 학기 중인가 · 방학인가 · 개학날인가. 날짜는 파일 값만 본다.
  this.season = function (date) {
    if (!D) return null;
    var d = date || new Date(), n = ymd(d), C = D.calendar2026;
    if (n === num(C['봄개학'].date) || n === num(C['여름개학'].date)) return 'open';
    if (n >= num(C['여름방학'].from) && n <= num(C['여름방학'].to)) return 'vac';
    if (n >= num(C['겨울방학'].from) || n < num(C['봄개학'].date)) return 'vac';
    return 'term';
  };
  // 지금이 하루 중 어느 때인가(등교·하교·수업 중·야간). 시각은 **게임 설계값**이다.
  this.slot = function (date) {
    if (!D) return null;
    var d = date || new Date(), t = d.getHours() * 60 + d.getMinutes(), H = D.hours;
    function mm(s) { var a = String(s).split(':'); return (+a[0]) * 60 + (+a[1] || 0); }
    var wk = d.getDay() >= 1 && d.getDay() <= 5;
    if (!wk) return 'off';
    if (t >= mm(H['등교'].from) && t <= mm(H['등교'].to)) return 'in';
    if (t >= mm(H['초등하교'].from) && t <= mm(H['중고하교'].to)) return 'out';
    if (t > mm(H['등교'].to) && t < mm(H['초등하교'].from)) return 'class';
    if (t >= 20 * 60 || t < 6 * 60) return 'night';
    return 'term';
  };
  // 사수가 할 말 한 줄 — 방학이면 등굣길 이야기를 하지 않는다(소유자 「이 밤에 등굣길 신고는 오류」와 같은 결).
  this.line = function (date) {
    if (!D) return '';
    var se = self.season(date), sl = self.slot(date), L = D.lines, key;
    if (se === 'open') key = '개학';
    else if (se === 'vac') key = '방학';
    else if (sl === 'in') key = '등교';
    else if (sl === 'out') key = '하교';
    else if (sl === 'class') key = '수업중';
    else if (sl === 'night') key = '야간';
    if (!key || !L[key] || !L[key].length) return '';
    return L[key][Math.floor(Math.random() * L[key].length)];
  };
  // 학습 화면·안내에 그대로 쓰는 요약(출처와 「확인 중」을 같이 낸다 — 숨기지 않는다)
  this.brief = function (date) {
    if (!D) return null;
    var C = D.calendar2026, se = self.season(date), sl = self.slot(date);
    return {
      season: se, slot: sl, line: self.line(date),
      cal: [C['봄개학'].date + ' 개학', C['여름방학식'].date + ' 여름방학식', C['여름개학'].date + ' 개학', C['종업식'].date + ' 종업식'],
      src: D.source['학사일정'],
      note: D.source.note + ' 등·하교 시각과 교시당 수업시간(초 40 · 중 45 · 고 50분)은 공개 자료에 시각이 없어 게임 설계값이고, 원문 대조 전이라 「확인 중」이다.'
    };
  };
};
