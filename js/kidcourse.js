// 어린이 교통안전 교실 — 횡단보도만이 아니라 **전반 교통안전**을 여섯 단계로 다룬다.
// 소유자: 「어린이들이 횡단보도를 건널때 만을 말하고 있는데 전반적인 교통안전을 말하는것이였고」
// 무엇을 가르칠지는 서초구 실제 자료가 정했다(data/taas-vuln-seocho.json):
//   어린이 사고 395건 중 횡단중은 40건뿐이고 측면충돌 134 · 추돌 54 가 더 많다 → 차에 **타고 있을 때**도 다친다.
//   차도통행중 11 · 길가장자리구역통행중 5 · 보도통행중 5 → 걸을 자리.
//   자전거 사고 중 보도통행중 37건 → 자전거는 보도로 다니는 것이 아니다.
//   보행자 사고 가해차종에 이륜 117 · 자전거 98 · PM 72 → 위험한 것이 자동차만은 아니다.
// 법령 문구는 코드에 없다 — data/laws.json 의 carSafe · rideSafe · schoolZone 에서 읽는다.
TG.KidCourse = function (game) {
  var self = this;
  var S = null;
  // 여섯 단계. want 는 「이 단계를 마쳤다」고 볼 조건, from 은 문구를 가져올 laws.json 자리.
  var STAGES = [
    { id: 'walk',  icon: '🚶', name: '걸을 자리', want: '보도로 8초 걷기',
      why: '차도·길가장자리로 걸으면 위험해요. 어린이 사고에도 차도통행중·길가장자리통행중이 있어요.' },
    { id: 'cross', icon: '🚦', name: '건널 자리', want: '초록불에 횡단보도 건너기',
      why: '멈춘다 · 본다 · 손을 든다 · 걷는다. 초록불이 깜빡이면 다음 초록불을 기다려요.' },
    { id: 'car',   icon: '🚗', name: '차에 탈 때', want: '순찰차 가까이 가 보기', from: 'carSafe',
      why: '어린이는 걸을 때만 다치지 않아요. 차에 타고 있을 때가 더 많아요 — 안전띠를 매고, 인도 쪽 문으로 내려요.' },
    { id: 'bike',  icon: '🚲', name: '자전거', want: '지나가는 자전거 보기', from: 'rideSafe',
      why: '몸에 맞는 자전거를 타고, 좌우를 살펴요. 자전거는 보도로 다니는 것이 아니에요.' },
    { id: 'pm',    icon: '🛴', name: '킥보드', want: '지나가는 킥보드·오토바이 보기', from: 'rideSafe',
      why: '전동킥보드는 면허가 있어야 타요. 발로 미는 킥보드도 보호장구를 꼭 써요.' },
    { id: 'jungle', icon: '🌳', name: '서로 조심', want: '앞의 다섯 가지 모두',
      why: '길에는 차도 오토바이도 킥보드도 다녀요. 달리는 기쁨에 취해 주변을 못 보면 위험해요 — 서로 조심해요.' }
  ];
  function laws(key) { return (game.laws && game.laws[key]) ? game.laws[key] : null; }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  self.start = function () {
    S = { done: {}, order: [], sidewalkT: 0, cardCd: 0, lastNote: '' };
    self.state = S;
  };
  self.reset = function () { S = null; self.state = null; };
  self.isOn = function () { return !!S; };
  self.count = function () { return S ? S.order.length : 0; };
  self.total = STAGES.length;

  function finish(id) {
    if (!S || S.done[id]) return false;
    var st = null;
    for (var i = 0; i < STAGES.length; i++) if (STAGES[i].id === id) st = STAGES[i];
    if (!st) return false;
    S.done[id] = true; S.order.push(id);
    game.addScore(15, null);
    game.hud.notice(st.icon + ' ' + st.name + ' 배웠어요 (+15) — ' + st.why, 'good', 5200);
    TG.audio.jingle(2);
    // 다섯 개를 다 배우면 마지막 「서로 조심」이 열린다
    if (S.order.length === STAGES.length - 1 && !S.done.jungle) {
      setTimeout(function () { if (S) finish('jungle'); }, 2600);
    }
    return true;
  }
  self.finish = finish;

  // 게임이 사건을 알려 준다: 'sidewalk'(보도 위, dt 초) · 'road'(차도로 나감) · 'crossed' · 'car' · 'bike' · 'pm'
  self.note = function (kind, dt) {
    if (!S) return;
    if (kind === 'sidewalk') { S.sidewalkT += (dt || 0); if (S.sidewalkT >= 8) finish('walk'); return; }
    if (kind === 'road') { S.sidewalkT = 0; return; }
    if (kind === 'crossed') { finish('cross'); return; }
    if (kind === 'car') { finish('car'); return; }
    if (kind === 'bike') { finish('bike'); return; }
    if (kind === 'pm' || kind === 'moto') { finish('pm'); return; }
  };

  // HUD 한 줄: 지금 무엇을 배우는 중인가
  self.hudLine = function () {
    if (!S) return '';
    for (var i = 0; i < STAGES.length; i++) {
      var st = STAGES[i];
      if (!S.done[st.id]) return '📚 ' + (S.order.length + 1) + '/' + STAGES.length + ' ' + st.icon + ' ' + st.name + ' — ' + st.want;
    }
    return '📚 여섯 가지 모두 배웠어요!';
  };
  // 배지 줄(결과 카드)
  self.badges = function () {
    if (!S) return [];
    return STAGES.filter(function (st) { return S.done[st.id]; }).map(function (st) { return { text: st.icon + ' ' + st.name, gold: st.id === 'jungle' }; });
  };
  // 학습 화면에 넣을 표 — 무엇을 가르치는지 한눈에
  self.html = function () {
    var h = '<h2 style="margin-top:22px">🧒 어린이 교통안전 교실 — 여섯 가지</h2>';
    h += '<div class="dim small">횡단보도만이 아니라 걷기·타기·차 안까지 다룹니다. 무엇을 가르칠지는 서초구 실제 사고 자료가 정했습니다.</div>';
    h += '<div class="cards">';
    STAGES.forEach(function (st, i) {
      var src = st.from ? laws(st.from) : null;
      h += '<div class="sitem"><div class="num">' + (i + 1) + '</div><div class="body"><b>' + st.icon + ' ' + esc(st.name) + '</b>' +
        (src ? '<div class="law">' + esc(src.title) + '</div>' : '') +
        '<div class="sit">' + esc(st.why) + '</div>' +
        '<div class="tip">교실에서 하는 일 · ' + esc(st.want) + '</div></div></div>';
    });
    h += '</div>';
    return h;
  };
  self.stages = STAGES;
};
